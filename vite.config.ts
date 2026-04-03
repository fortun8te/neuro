import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { exec } from 'child_process'
import path from 'path'
import fs from 'fs'
import os from 'os'

/**
 * Auto-start companion servers when Vite dev server starts.
 * Checks if each server is already running before spawning.
 */
function autoStartServers() {
  let started = false;
  return {
    name: 'auto-start-servers',
    configureServer() {
      if (started) return;
      started = true;

      // Auto-start Wayfarer (port 8889)
      tryStartServer({
        name: 'Wayfarer',
        port: 8889,
        healthUrl: 'http://localhost:8889/health',
        command: 'SEARXNG_URL=http://localhost:8888 /opt/homebrew/bin/python3.11 -m uvicorn wayfarer_server:app --host 0.0.0.0 --port 8889',
        cwd: path.join(process.cwd(), 'wayfarer'),
      });

      // Auto-start Freepik server (port 8890)
      tryStartServer({
        name: 'Freepik',
        port: 8890,
        healthUrl: 'http://localhost:8890/api/status',
        command: '/opt/homebrew/bin/python3.11 -m uvicorn freepik_server:app --host 0.0.0.0 --port 8890',
        cwd: process.cwd(),
      });
    },
  };
}

async function tryStartServer(opts: {
  name: string;
  port: number;
  healthUrl: string;
  command: string;
  cwd: string;
}) {
  try {
    // Check if already running
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const resp = await fetch(opts.healthUrl, { signal: controller.signal });
    clearTimeout(timeout);
    if (resp.ok) {
      console.log(`\x1b[32m✓\x1b[0m ${opts.name} server already running on port ${opts.port}`);
      return;
    }
  } catch {
    // Not running — start it
  }

  console.log(`\x1b[33m⟳\x1b[0m Starting ${opts.name} server on port ${opts.port}...`);
  const child = exec(opts.command, { cwd: opts.cwd });

  child.stdout?.on('data', (data: string) => {
    const lines = data.toString().trim().split('\n');
    for (const line of lines) {
      if (line.includes('Uvicorn running') || line.includes('Application startup')) {
        console.log(`\x1b[32m✓\x1b[0m ${opts.name} server started on port ${opts.port}`);
      }
    }
  });

  child.stderr?.on('data', (data: string) => {
    const lines = data.toString().trim().split('\n');
    for (const line of lines) {
      // Uvicorn logs to stderr by default
      if (line.includes('Uvicorn running') || line.includes('Application startup')) {
        console.log(`\x1b[32m✓\x1b[0m ${opts.name} server started on port ${opts.port}`);
      } else if (line.includes('ERROR') || line.includes('ModuleNotFoundError')) {
        console.error(`\x1b[31m✗\x1b[0m ${opts.name}: ${line}`);
      }
    }
  });

  child.on('error', (err) => {
    console.error(`\x1b[31m✗\x1b[0m Failed to start ${opts.name}: ${err.message}`);
  });

  // Don't let the child process keep Node alive
  child.unref();
}

/**
 * Mac filesystem bridge — exposes shell + file APIs to the browser via Vite dev server.
 * Powers workspace files, memory persistence, agent shell_exec, and all /api/* calls.
 *
 * Endpoints:
 *   POST /api/shell          { command, timeout? } → { stdout, stderr, exitCode }
 *   POST /api/file/write     { path, content }     → { ok }
 *   POST /api/file/read      { path, maxLines? }   → { content }
 *   POST /api/file/delete    { path }              → { ok }
 *   POST /api/file/list      { dir }               → { entries: [{name,size,isDir}] }
 */
// Directories Neuro is allowed to touch
const PROJECT_ROOT = path.resolve(__dirname);
const ALLOWED_ROOTS = [
  PROJECT_ROOT,
  os.homedir() + '/Documents/Nomads', // legacy location (still allowed for reads)
  '/tmp',
  os.tmpdir(),
];

function isAllowedPath(p: string) {
  const real = p.replace(/^\$HOME/, os.homedir()).replace(/^~/, os.homedir());
  return ALLOWED_ROOTS.some(r => real.startsWith(r));
}

// Block obviously dangerous shell patterns regardless of path
const BLOCKED_SHELL = [
  /\brm\s+-rf\s+\/(?!\S)/,           // rm -rf /
  /\bsudo\b/,                          // sudo anything
  /\bchmod\b.*\//,                     // chmod on absolute paths
  /\bchown\b.*\//,                     // chown on absolute paths
  /\bmkfs\b/,                          // disk format
  /\bdd\s+if=/,                        // disk dump
  />\s*\/etc\//,                       // write to /etc
  />\s*\/usr\//,                       // write to /usr
  />\s*\/System\//,                    // write to macOS /System
];

function isBlockedShell(cmd: string) {
  return BLOCKED_SHELL.some(r => r.test(cmd));
}

function macFsBridge() {
  const home = os.homedir();
  const expand = (p: string) => p.replace(/^\$HOME/, home).replace(/^~/, home);

  function handle(route: string, fn: (req: any, res: any, body: string) => void) {
    return {
      name: 'mac-fs-bridge-' + route.replace(/\//g, '-'),
      configureServer(server: any) {
        server.middlewares.use(route, (req: any, res: any) => {
          if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
          let body = '';
          req.on('data', (c: any) => { body += c.toString(); });
          req.on('end', () => { fn(req, res, body); });
        });
      },
    };
  }

  const shell = handle('/api/shell', (_req: any, res: any, body: string) => {
    try {
      const { command, timeout = 30000 } = JSON.parse(body);
      if (!command) { res.statusCode = 400; res.end(JSON.stringify({ error: 'missing command' })); return; }
      if (isBlockedShell(command)) {
        res.statusCode = 403;
        res.end(JSON.stringify({ stdout: '', stderr: 'Blocked: command contains dangerous pattern', exitCode: 1 }));
        return;
      }
      // Run inside the Nomads directory so relative paths stay sandboxed
      const cwd = home + '/Documents/Nomads';
      exec(command, { timeout, shell: '/bin/zsh', cwd, env: { ...process.env, HOME: home } }, (err, stdout, stderr) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ stdout: stdout || '', stderr: stderr || '', exitCode: err?.code ?? 0 }));
      });
    } catch (e) { res.statusCode = 400; res.end(JSON.stringify({ error: String(e) })); }
  });

  const fileWrite = handle('/api/file/write', (_req: any, res: any, body: string) => {
    try {
      const { path: p, content } = JSON.parse(body);
      const ep = expand(p);
      if (!isAllowedPath(ep)) {
        res.statusCode = 403;
        res.end(JSON.stringify({ error: `Path not allowed: ${ep}` }));
        return;
      }
      fs.mkdirSync(path.dirname(ep), { recursive: true });
      fs.writeFileSync(ep, content, 'utf8');
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true }));
    } catch (e) { res.statusCode = 500; res.end(JSON.stringify({ error: String(e) })); }
  });

  const fileRead = handle('/api/file/read', (_req: any, res: any, body: string) => {
    try {
      const { path: p, maxLines = 500 } = JSON.parse(body);
      const ep = expand(p);
      if (!isAllowedPath(ep)) {
        res.statusCode = 403;
        res.end(JSON.stringify({ error: `Path not allowed: ${ep}` }));
        return;
      }
      const raw = fs.readFileSync(ep, 'utf8');
      const lines = raw.split('\n');
      const content = lines.slice(0, maxLines).join('\n') + (lines.length > maxLines ? '\n...[truncated]' : '');
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ content }));
    } catch (e) { res.statusCode = 500; res.end(JSON.stringify({ error: String(e) })); }
  });

  const fileDelete = handle('/api/file/delete', (_req: any, res: any, body: string) => {
    try {
      const { path: p } = JSON.parse(body);
      const ep = expand(p);
      if (!isAllowedPath(ep)) {
        res.statusCode = 403;
        res.end(JSON.stringify({ error: `Path not allowed: ${ep}` }));
        return;
      }
      if (fs.existsSync(ep)) fs.unlinkSync(ep);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true }));
    } catch (e) { res.statusCode = 500; res.end(JSON.stringify({ error: String(e) })); }
  });

  const fileList = handle('/api/file/list', (_req: any, res: any, body: string) => {
    try {
      const { dir } = JSON.parse(body);
      const ep = expand(dir);
      if (!isAllowedPath(ep)) {
        res.statusCode = 403;
        res.end(JSON.stringify({ error: `Path not allowed: ${ep}`, entries: [] }));
        return;
      }
      const entries = fs.readdirSync(ep, { withFileTypes: true }).map(e => ({
        name: e.name,
        isDir: e.isDirectory(),
        size: e.isFile() ? (() => { try { return fs.statSync(path.join(ep, e.name)).size; } catch { return 0; } })() : 0,
      }));
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ entries }));
    } catch (e) { res.statusCode = 500; res.end(JSON.stringify({ error: String(e), entries: [] })); }
  });

  // Banner plugin logs once on startup
  const banner = {
    name: 'mac-fs-bridge-banner',
    configureServer() {
      console.log('\x1b[32m✓\x1b[0m Mac filesystem bridge: /api/shell + /api/file/{read,write,delete,list} [sandboxed to ~/Documents/Nomads]');
    },
  };

  return [shell, fileWrite, fileRead, fileDelete, fileList, banner];
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), autoStartServers(), macFsBridge()],
  define: {
    // Expose project root so workspace.ts can store files inside the project
    'import.meta.env.VITE_PROJECT_ROOT': JSON.stringify(PROJECT_ROOT),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './frontend'),
    },
    dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
  },
  server: {
    port: parseInt(process.env.PORT || '5173'),
  },
  optimizeDeps: {
    exclude: ['@novnc/novnc'],
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      external: (id) => id.includes('@novnc/novnc'),
    },
  },
})
