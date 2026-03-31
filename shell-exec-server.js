#!/usr/bin/env node

/**
 * Shell Execution Server
 * Handles filesystem operations for Neuro Cloud Sync
 *
 * Usage:
 *   node shell-exec-server.js --port 3001
 *
 * Environment:
 *   SHELL_EXEC_PORT=3001 (default)
 *   NODE_ENV=production (for safety)
 */

const express = require('express');
const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs').promises;
const rateLimit = require('express-rate-limit');
const cors = require('cors');

const execAsync = promisify(exec);

const app = express();
const PORT = process.env.SHELL_EXEC_PORT || 3001;

// ─────────────────────────────────────────────────────────────
// Security: Command whitelist (prevent arbitrary execution)
// ─────────────────────────────────────────────────────────────

const ALLOWED_COMMANDS = {
  // Directory operations
  'mkdir': /^mkdir\s+(-p\s+)?["']?[~\/\w\-\/.]+["']?$/i,
  'ls': /^ls\s+(-[lah]+\s+)?["']?[~\/\w\-\/.]+["']?$/i,

  // File operations
  'cat': /^cat\s+["']?[~\/\w\-\/.]+["']?$/i,
  'echo': /^echo\s+(.+)\s+>\s+["']?[~\/\w\-\/.]+["']?$/i,
  'rm': /^rm\s+(-f\s+)?["']?[~\/\w\-\/.]+["']?$/i,

  // Metadata
  'stat': /^stat\s+(-f\s+)?["']?[~\/\w\-\/.]+["']?$/i,
  'md5': /^(md5|md5sum)\s+<\s+["']?[~\/\w\-\/.]+["']?$/i,
};

const BLOCKED_PATTERNS = [
  /;/,           // Command chaining
  /\|/,          // Pipes
  /`/,           // Command substitution
  /\$\(/,        // Command substitution
  /&&/,          // Logical AND
  /\|\|/,        // Logical OR
  />/,           // Output redirection (except echo > file)
  /</,           // Input redirection
  /rm\s+-r/,     // Recursive delete
  /sudo/,        // Sudo
  /rm\s+\//,     // Root deletion
];

// ─────────────────────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────────────────────

app.use(express.json());
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:8080'],
  credentials: true,
}));

// Rate limiting: 10 requests per second per IP
const limiter = rateLimit({
  windowMs: 1000,
  max: 10,
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/shell-exec', limiter);

// ─────────────────────────────────────────────────────────────
// Security Functions
// ─────────────────────────────────────────────────────────────

function isCommandAllowed(command) {
  // Check if command matches any blocked patterns
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(command)) {
      return false;
    }
  }

  // Check if command matches whitelist
  for (const [cmd, regex] of Object.entries(ALLOWED_COMMANDS)) {
    if (command.toLowerCase().startsWith(cmd) && regex.test(command)) {
      return true;
    }
  }

  return false;
}

function sanitizePath(pathStr) {
  // Expand ~ to home directory
  if (pathStr.startsWith('~')) {
    const home = require('os').homedir();
    pathStr = pathStr.replace('~', home);
  }

  // Resolve to absolute path and validate it's within user's home
  const resolved = path.resolve(pathStr);
  const home = require('os').homedir();

  if (!resolved.startsWith(home)) {
    throw new Error('Path outside home directory is not allowed');
  }

  return resolved;
}

// ─────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/shell-exec
 * Execute a shell command safely
 *
 * Request: { command: "mkdir -p ~/Neuro/Documents" }
 * Response: { success: boolean, stdout?: string, stderr?: string, code?: number }
 */
app.post('/api/shell-exec', async (req, res) => {
  try {
    const { command } = req.body;

    if (!command || typeof command !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid command: must be a string',
      });
    }

    // Validate command against whitelist
    if (!isCommandAllowed(command)) {
      console.warn(`[BLOCKED] ${req.ip}: ${command}`);
      return res.status(403).json({
        success: false,
        error: 'Command not allowed',
      });
    }

    console.log(`[EXEC] ${command}`);

    // Execute with timeout
    const { stdout, stderr } = await execAsync(command, {
      timeout: 5000, // 5 second timeout
      maxBuffer: 1024 * 1024, // 1MB buffer
      shell: '/bin/bash',
    });

    return res.json({
      success: true,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      code: 0,
    });
  } catch (error) {
    console.error(`[ERROR] ${error.message}`);

    return res.status(500).json({
      success: false,
      stdout: error.stdout?.trim() || '',
      stderr: error.stderr?.trim() || error.message,
      code: error.code || 1,
      error: error.message,
    });
  }
});

/**
 * POST /api/write-file
 * Safely write content to a file
 *
 * Request: { path: "~/Neuro/Documents/file.txt", content: "..." }
 * Response: { success: boolean, path?: string, error?: string }
 */
app.post('/api/write-file', async (req, res) => {
  try {
    const { path: filePath, content } = req.body;

    if (!filePath || typeof filePath !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid path',
      });
    }

    const sanitized = sanitizePath(filePath);

    // Ensure parent directory exists
    const dir = path.dirname(sanitized);
    await fs.mkdir(dir, { recursive: true });

    // Write file
    await fs.writeFile(sanitized, content, 'utf-8');

    console.log(`[WRITE] ${sanitized}`);

    return res.json({
      success: true,
      path: sanitized,
    });
  } catch (error) {
    console.error(`[WRITE ERROR] ${error.message}`);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/read-file/:filePath
 * Safely read a file
 *
 * Response: { success: boolean, content?: string, error?: string }
 */
app.get('/api/read-file/*', async (req, res) => {
  try {
    const filePath = req.params[0]; // Get wildcard param
    const sanitized = sanitizePath(filePath);

    const content = await fs.readFile(sanitized, 'utf-8');

    console.log(`[READ] ${sanitized}`);

    return res.json({
      success: true,
      content,
    });
  } catch (error) {
    console.error(`[READ ERROR] ${error.message}`);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/health
 * Health check
 */
app.get('/api/health', (req, res) => {
  return res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * GET /
 * Welcome message
 */
app.get('/', (req, res) => {
  return res.json({
    service: 'Neuro Shell Execution Server',
    version: '1.0.0',
    endpoints: [
      'POST /api/shell-exec',
      'POST /api/write-file',
      'GET /api/read-file/*',
      'GET /api/health',
    ],
    environment: process.env.NODE_ENV || 'development',
  });
});

// ─────────────────────────────────────────────────────────────
// Server startup
// ─────────────────────────────────────────────────────────────

const server = app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║     Neuro Shell Execution Server                            ║
║     Listening on http://localhost:${PORT}                      ║
║     Environment: ${process.env.NODE_ENV || 'development':<29}║
╚══════════════════════════════════════════════════════════════╝
  `);

  console.log('Allowed commands:');
  Object.keys(ALLOWED_COMMANDS).forEach(cmd => {
    console.log(`  • ${cmd}`);
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\nShutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
