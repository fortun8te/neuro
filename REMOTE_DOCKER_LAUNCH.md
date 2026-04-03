# Remote Docker Launch Strategy

**Status:** Research & Design
**Use Case:** Launch local PC Docker services from remote Vercel deployment
**Dependency Chain:** PC Online → SSH/Wake-on-LAN → Docker-compose → SearXNG + Wayfarer

---

## Problem Statement

Currently:
- **Remote (Vercel)**: Uses Tailscale VPN to reach `100.74.135.83:8888` (SearXNG) + `100.74.135.83:8889` (Wayfarer)
- **Local (npm run dev)**: Uses localhost (requires manual `docker-compose up -d`)

**Goal:** Enable Vercel app to detect if your local PC is online, then automatically launch Docker services on it (without requiring you to manually run `docker-compose up`).

---

## Option 1: Tailscale + SSH (Recommended)

### How It Works
1. Your PC has Tailscale client connected (always-on)
2. Vercel app checks if PC is reachable via Tailscale IP (`100.74.135.83`)
3. If reachable, Vercel makes SSH request to launch `docker-compose up -d`
4. Docker services start automatically

### Pros
- ✅ Simple — leverages existing Tailscale setup
- ✅ Secure — SSH key-based auth (no passwords)
- ✅ Already have the IP `100.74.135.83`
- ✅ Works across networks (coffee shop, office, etc.)

### Cons
- ⚠️ Requires SSH daemon on your PC (easy to enable)
- ⚠️ Requires storing SSH private key in Vercel secrets (small risk)
- ⚠️ Only works if PC is already on

### Implementation

**Step 1: Enable SSH on Mac**
```bash
# System Settings → General → Sharing → Remote Login (turn on)
# Or via terminal:
sudo systemsetup -setremotelogin on
```

**Step 2: Add SSH key to Vercel**
```bash
# Generate key (one-time)
ssh-keygen -t ed25519 -f ~/.ssh/nomads_docker -N ""

# Copy public key to Mac authorized_keys
cat ~/.ssh/nomads_docker.pub >> ~/.ssh/authorized_keys

# Add private key to Vercel secrets
# Vercel Dashboard → Settings → Environment Variables → TAILSCALE_SSH_KEY
# Paste contents of ~/.ssh/nomads_docker (PRIVATE key)
```

**Step 3: Create remote launcher function**
```typescript
// frontend/utils/remoteDockerLauncher.ts
export async function launchRemoteDocker(): Promise<boolean> {
  try {
    // 1. Check if PC is reachable
    const response = await fetch('http://100.74.135.83:8888/config', {
      signal: AbortSignal.timeout(3000),
    });

    if (response.ok) {
      console.log('✅ Docker already running on local PC');
      return true;
    }
  } catch {
    // Not reachable, try to launch
  }

  // 2. Send request to launch Docker
  try {
    const sshKey = process.env.TAILSCALE_SSH_KEY || '';
    const result = await fetch('/api/launch-docker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sshKey }),
    });

    if (result.ok) {
      // Wait for services to start
      await new Promise(resolve => setTimeout(resolve, 5000));
      return true;
    }
  } catch (err) {
    console.error('Failed to launch Docker:', err);
    return false;
  }

  return false;
}
```

**Step 4: Create API endpoint** (Vercel serverless function)
```typescript
// api/launch-docker.ts
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sshKey } = req.body;

  try {
    // Launch docker-compose on remote PC via SSH
    const command = `ssh -i <(echo "$SSH_KEY") -o StrictHostKeyChecking=no mk@100.74.135.83 'cd ~/Downloads/nomads && docker-compose up -d'`;

    const { stdout, stderr } = await execAsync(command, {
      env: { ...process.env, SSH_KEY: sshKey },
      timeout: 30000,
    });

    // Wait for services to be ready
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check if services are up
    const healthCheck = await fetch('http://100.74.135.83:8888/config', {
      signal: AbortSignal.timeout(5000),
    }).catch(() => null);

    return res.status(healthCheck?.ok ? 200 : 202).json({
      success: healthCheck?.ok ?? false,
      message: 'Docker launch initiated',
      stdout,
      stderr,
    });
  } catch (err) {
    return res.status(500).json({
      error: 'Failed to launch Docker',
      details: err instanceof Error ? err.message : String(err),
    });
  }
}
```

---

## Option 2: Wake-on-LAN (WOL)

### How It Works
1. If PC is completely off, send WOL magic packet
2. PC boots up
3. Tailscale auto-connects (if enabled)
4. Then use SSH to launch Docker (Option 1)

### Pros
- ✅ Works even if PC is completely powered off
- ✅ No ongoing power drain (can shut down PC)

### Cons
- ⚠️ Slower (PC takes 30-60s to boot)
- ⚠️ Requires BIOS configuration (Enable Wake-on-LAN)
- ⚠️ Requires knowing MAC address
- ⚠️ Only works on same network (unless using tailscale-wol service)

### Implementation
```typescript
// Use npm package: 'wol'
import { send } from 'wol';

export async function wakeOnLan(macAddress: string) {
  return new Promise((resolve, reject) => {
    send(macAddress, (err) => {
      if (err) reject(err);
      else resolve(true);
    });
  });
}

// Then combine with SSH launcher after waiting for boot
```

---

## Option 3: HTTP Webhook (Simplest)

### How It Works
1. Your local PC runs a simple webhook listener (port 5555)
2. Vercel sends HTTP POST request to `100.74.135.83:5555/launch`
3. Webhook script runs `docker-compose up -d`

### Pros
- ✅ Simplest implementation (no SSH keys)
- ✅ Single HTTP request
- ✅ No authentication complexity

### Cons
- ⚠️ Less secure (anyone on Tailscale can trigger)
- ⚠️ Requires running local daemon
- ⚠️ Simple token auth only

### Implementation

**Local webhook listener** (run on your PC)
```bash
# Create ~/nomads-launcher/launcher.sh
#!/bin/bash
cd ~/Downloads/nomads && docker-compose up -d
```

```python
# Create ~/nomads-launcher/server.py (runs on your PC)
from fastapi import FastAPI, HTTPException
import subprocess
import os

app = FastAPI()

WEBHOOK_TOKEN = os.getenv('WEBHOOK_TOKEN', 'change-me-in-env')

@app.post('/launch')
async def launch_docker(token: str):
    if token != WEBHOOK_TOKEN:
        raise HTTPException(status_code=401, detail='Unauthorized')

    try:
        result = subprocess.run(['bash', '/Users/mk/nomads-launcher/launcher.sh'],
                              capture_output=True, timeout=10)
        return {'status': 'launched', 'output': result.stdout.decode()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

```bash
# Start on your PC (runs forever, can add to launchd/systemd)
cd ~/nomads-launcher && python3 -m uvicorn server:app --host 0.0.0.0 --port 5555
```

**Vercel frontend call**
```typescript
export async function launchRemoteDocker(): Promise<boolean> {
  try {
    const response = await fetch('http://100.74.135.83:5555/launch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: process.env.VITE_WEBHOOK_TOKEN }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
```

---

## Comparison Matrix

| Approach | Security | Complexity | Boot from OFF | Reliability |
|----------|----------|------------|---------------|-------------|
| SSH (Option 1) | ✅ High | Medium | ❌ No | ✅ Excellent |
| WOL + SSH | ✅ High | Hard | ✅ Yes | ✅ Good |
| HTTP Webhook | ⚠️ Medium | Easy | ❌ No | ⚠️ Fair |

---

## Recommendation: **Option 1 (SSH) + Option 3 (Webhook)**

Hybrid approach:
1. **Primary**: Try SSH (secure, production-grade)
2. **Fallback**: Use HTTP webhook if SSH fails
3. **User override**: Manual button in UI to force launch

This gives you:
- ✅ Automatic launch on app load (if PC is on)
- ✅ Security for important operations
- ✅ Simple fallback
- ✅ User control

---

## Integration with Nomads UI

### Where to Add

**AgentPanel.tsx** — Add infrastructure status check:
```typescript
useEffect(() => {
  // On app load, check if we need to launch remote Docker
  checkAndLaunchDocker();
}, []);

async function checkAndLaunchDocker() {
  const mode = INFRASTRUCTURE.getMode();

  if (mode === 'local') {
    // Already using local services
    return;
  }

  // Check if remote services are accessible
  const health = await checkInfrastructure();

  if (!health.searxng && !health.wayfarer) {
    // Try to launch Docker on local PC
    const launched = await launchRemoteDocker();
    if (launched) {
      showNotification('🚀 Docker launched on local PC');
    } else {
      showNotification('⚠️ Could not auto-launch Docker. You may need to manually run: docker-compose up -d');
    }
  }
}
```

### Settings UI Toggle
```typescript
// SettingsModal.tsx
<SettingItem
  label="Auto-Launch Docker"
  description="Automatically start Docker services on your PC when needed"
  control={
    <Toggle
      checked={autoLaunchDocker}
      onChange={setAutoLaunchDocker}
    />
  }
/>

{autoLaunchDocker && (
  <Button
    onClick={() => launchRemoteDocker()}
    variant="secondary"
  >
    Launch Docker Now
  </Button>
)}
```

---

## Security Considerations

### SSH Approach
- ✅ Private key stored in Vercel secrets (encrypted at rest)
- ✅ SSH key has no password (fine for CI/CD)
- ✅ Restrict SSH key to single command (optional): `command="cd ~/Downloads/nomads && docker-compose up -d" ssh-ed25519 AAAA...`
- ❌ Key rotation required periodically

### Webhook Approach
- ✅ Simpler (no keys to manage)
- ⚠️ Token in environment variable
- ❌ Anyone with token can launch
- Mitigation: Verify source IP via Tailscale

---

## Testing Before Production

1. **Test SSH locally first**
   ```bash
   ssh -i ~/.ssh/nomads_docker mk@100.74.135.83 'docker ps'
   ```

2. **Test from another machine**
   ```bash
   # On any machine with Tailscale
   ssh -i nomads_docker mk@100.74.135.83 'cd ~/Downloads/nomads && docker-compose up -d'
   ```

3. **Verify docker-compose works**
   ```bash
   cd ~/Downloads/nomads && docker-compose up -d
   docker ps  # Should show searxng containers
   ```

---

## Next Steps

1. Enable SSH on your Mac: `System Settings → General → Sharing → Remote Login`
2. Test SSH connectivity: `ssh mk@100.74.135.83 'echo Hello'`
3. Generate ED25519 key and add to Vercel secrets
4. Implement `remoteDockerLauncher.ts` + API endpoint
5. Add checkbox in SettingsModal for "Auto-Launch Docker"
6. Test with app load: Does Docker auto-start?

---

## Questions

- Want to use SSH (recommended) or HTTP webhook?
- Should auto-launch be default ON or OFF?
- Want fallback notification if auto-launch fails?
