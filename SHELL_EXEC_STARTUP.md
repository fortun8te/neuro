# Shell Exec Server — Installation & Startup Guide

## Overview

The Shell Exec Server is a Node.js backend service that handles filesystem operations for Neuro Cloud Sync. It provides secure, rate-limited access to:

- Directory creation (`mkdir`)
- File reading (`cat`)
- File writing (`echo`)
- File deletion (`rm`)
- Directory listing (`ls`)
- File metadata (`stat`)
- File checksums (`md5`)

---

## Installation

### Prerequisites

- **Node.js** 16+ ([Download](https://nodejs.org))
- **npm** 7+ (comes with Node.js)
- **Bash** or **Zsh** shell (macOS/Linux)

### Step 1: Copy Backend Files

```bash
# From project root
cp shell-exec-server.js ~/neuro-server/
cp shell-exec-package.json ~/neuro-server/package.json
cd ~/neuro-server
```

### Step 2: Install Dependencies

```bash
npm install
```

Expected output:
```
added 45 packages in 2.3s
```

### Step 3: Verify Installation

```bash
node shell-exec-server.js
```

Expected output:
```
╔══════════════════════════════════════════════════════════════╗
║     Neuro Shell Execution Server                            ║
║     Listening on http://localhost:3001                      ║
║     Environment: development                                ║
╚══════════════════════════════════════════════════════════════╝

Allowed commands:
  • mkdir
  • ls
  • cat
  • echo
  • rm
  • stat
  • md5
```

---

## Running the Server

### Option A: Foreground (For Development)

```bash
cd ~/neuro-server
node shell-exec-server.js
```

Keep this terminal open while using Neuro. Press `Ctrl+C` to stop.

### Option B: Background (Persistent)

#### macOS/Linux - Using nohup:
```bash
cd ~/neuro-server
nohup node shell-exec-server.js > shell-exec.log 2>&1 &
echo $! > shell-exec.pid

# Verify it's running
tail -f shell-exec.log
```

#### macOS - Using Homebrew Services (Advanced):
```bash
# Create LaunchAgent plist
mkdir -p ~/Library/LaunchAgents
cat > ~/Library/LaunchAgents/com.neuro.shell-exec.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.neuro.shell-exec</string>
  <key>Program</key>
  <string>/usr/local/bin/node</string>
  <key>ProgramArguments</key>
  <array>
    <string>/Users/[YOUR_USERNAME]/neuro-server/shell-exec-server.js</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/neuro-shell-exec.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/neuro-shell-exec.err</string>
</dict>
</plist>
EOF

# Load the service
launchctl load ~/Library/LaunchAgents/com.neuro.shell-exec.plist

# Check status
launchctl list | grep shell-exec

# View logs
tail -f /tmp/neuro-shell-exec.log
```

---

## Configuration

### Environment Variables

```bash
# Port (default: 3001)
export SHELL_EXEC_PORT=3001

# Node environment (default: development)
export NODE_ENV=production

# Start server
node shell-exec-server.js
```

Or create `.env` file in server directory:
```
SHELL_EXEC_PORT=3001
NODE_ENV=production
```

---

## Testing the Server

### Test Health Check

```bash
curl http://localhost:3001/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-03-31T10:30:45.123Z",
  "uptime": 12.456
}
```

### Test Command Execution

```bash
curl -X POST http://localhost:3001/api/shell-exec \
  -H "Content-Type: application/json" \
  -d '{"command": "mkdir -p ~/Neuro/Documents/Canvas"}'
```

Expected response:
```json
{
  "success": true,
  "stdout": "",
  "stderr": "",
  "code": 0
}
```

### Test File Write

```bash
curl -X POST http://localhost:3001/api/write-file \
  -H "Content-Type: application/json" \
  -d '{
    "path": "~/Neuro/Documents/test.txt",
    "content": "Hello, Neuro!"
  }'
```

Expected response:
```json
{
  "success": true,
  "path": "/Users/[username]/Neuro/Documents/test.txt"
}
```

### Test File Read

```bash
curl http://localhost:3001/api/read-file/~\/Neuro\/Documents\/test.txt
```

Expected response:
```json
{
  "success": true,
  "content": "Hello, Neuro!"
}
```

---

## Stopping the Server

### If Running in Foreground

Press `Ctrl+C` in the terminal

### If Running in Background

```bash
# Using nohup
kill $(cat ~/neuro-server/shell-exec.pid)

# Using launchctl (macOS)
launchctl unload ~/Library/LaunchAgents/com.neuro.shell-exec.plist
```

---

## Troubleshooting

### Port Already in Use

```bash
# Find process on port 3001
lsof -i :3001

# Kill it (replace PID with actual PID)
kill -9 <PID>

# Or use different port
SHELL_EXEC_PORT=3002 node shell-exec-server.js
```

### Permission Denied Errors

```bash
# Ensure home directory is writable
chmod 755 ~

# Ensure Neuro directory exists
mkdir -p ~/Neuro/Documents/{Canvas,Research,Workspace}

# Check permissions
ls -la ~ | grep Neuro
```

### CORS Errors

Server is correctly configured for CORS. If you still see errors:

1. Check that server is actually running:
   ```bash
   curl http://localhost:3001/api/health
   ```

2. Verify Neuro app is using correct URL:
   ```javascript
   // In browser console
   console.log(import.meta.env.VITE_SHELL_EXEC_URL)
   ```

3. If local development, ensure `localhost:3001` is allowed

### Connection Refused

```bash
# Server not running. Start it:
cd ~/neuro-server
node shell-exec-server.js

# Or check if it's listening:
netstat -tuln | grep 3001
# Should show: tcp4  0  0 127.0.0.1.3001  LISTEN
```

---

## Security Notes

### What the Server Does:

✅ **Safe Operations:**
- Creates directories in home folder
- Reads/writes files in home folder
- Lists directory contents
- Calculates file checksums
- Deletes files (only in home folder)

❌ **Blocked Operations:**
- Command chaining (`;` or `&&`)
- Pipes (`|`)
- Root directory access (`/etc`, `/var`)
- Recursive deletion (`rm -r`)
- `sudo` commands
- Script injection

### Rate Limiting:

- **10 requests per second per IP**
- Exceeding limit returns 429 Too Many Requests
- Limit is enforced automatically

### Allowed Commands:

Only these commands are whitelisted:
- `mkdir -p [path]`
- `ls -[flags] [path]`
- `cat [file]`
- `echo "content" > [file]`
- `rm -f [file]`
- `stat [file]`
- `md5 < [file]`

All other commands are blocked with 403 Forbidden

### Path Validation:

All paths are validated to:
- Expand `~` to home directory
- Be within user's home directory
- Prevent directory traversal (`../`)
- Prevent absolute path escapes

---

## Monitoring

### View Logs

```bash
# If running in foreground
# Logs appear in terminal

# If running in background
tail -f ~/neuro-server/shell-exec.log

# Or if using launchctl
tail -f /tmp/neuro-shell-exec.log
```

### Performance Metrics

Watch the logs for:
- Response times (should be <100ms for most operations)
- Error rates (should be <1%)
- Blocked commands (watch for attack patterns)

Example good log line:
```
[EXEC] mkdir -p ~/Neuro/Documents/Canvas
```

Example concerning pattern:
```
[BLOCKED] 192.168.1.100: rm -rf /etc
[BLOCKED] 192.168.1.100: ls | grep password
```

---

## Production Deployment

For production (beyond development):

### Option A: systemd (Linux)

```bash
# Create service file
sudo tee /etc/systemd/system/neuro-shell-exec.service << 'EOF'
[Unit]
Description=Neuro Shell Execution Server
After=network.target

[Service]
Type=simple
User=neuro
WorkingDirectory=/home/neuro/neuro-server
ExecStart=/usr/bin/node shell-exec-server.js
Restart=on-failure
RestartSec=5s
StandardOutput=append:/var/log/neuro-shell-exec.log
StandardError=append:/var/log/neuro-shell-exec.err
Environment="SHELL_EXEC_PORT=3001"
Environment="NODE_ENV=production"

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable neuro-shell-exec
sudo systemctl start neuro-shell-exec
```

### Option B: PM2 (Node Process Manager)

```bash
# Install PM2 globally
npm install -g pm2

# Start server with PM2
pm2 start shell-exec-server.js --name neuro-shell-exec

# Make it auto-restart on reboot
pm2 startup
pm2 save

# Check status
pm2 status
pm2 logs neuro-shell-exec
```

### Option C: Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY shell-exec-package.json package.json
COPY shell-exec-server.js .

RUN npm install

EXPOSE 3001

CMD ["node", "shell-exec-server.js"]
```

```bash
# Build and run
docker build -t neuro-shell-exec .
docker run -d -p 3001:3001 neuro-shell-exec
```

---

## Maintenance

### Regular Tasks

Weekly:
- Review logs for errors or blocked commands
- Ensure disk space is available in home folder

Monthly:
- Update Node.js: `nvm install node && nvm alias default node`
- Update dependencies: `npm update` (in server directory)
- Check for security issues: `npm audit`

---

## Support & Debugging

### Check if Server is Running

```bash
# Method 1: cURL
curl http://localhost:3001/api/health

# Method 2: netstat
netstat -tuln | grep 3001

# Method 3: ps
ps aux | grep shell-exec-server.js

# Method 4: lsof
lsof -i :3001
```

### Restart Server

```bash
# Kill existing process
pkill -f shell-exec-server.js

# Start fresh
cd ~/neuro-server
node shell-exec-server.js
```

### Reset Everything

```bash
# Remove server directory
rm -rf ~/neuro-server

# Reinstall from scratch
cp shell-exec-server.js ~/neuro-server/
cp shell-exec-package.json ~/neuro-server/package.json
cd ~/neuro-server
npm install
node shell-exec-server.js
```

---

## Next Steps

Once the server is running:

1. **Verify in Neuro App:**
   - Go to Settings → Cloud Sync
   - Should show "Shell Exec Service: http://localhost:3001"

2. **Test Sync:**
   - Create a document in Canvas
   - Check ~/Neuro/Documents/Canvas/ for the file
   - Verify it syncs to Firestore

3. **Monitor:**
   - Watch shell-exec.log for operations
   - Test conflict resolution with multiple edits

---

## Done! 🎉

Shell Exec Server is now running and ready for file sync operations.

**Next:** Configure Firebase ([FIREBASE_SETUP.md](./FIREBASE_SETUP.md))
