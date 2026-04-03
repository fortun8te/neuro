#!/bin/bash
# Neuro Remote Infrastructure Setup Script
# Run this on your REMOTE SERVER (not local machine)
# Usage: bash scripts/setup-remote.sh

set -e

echo ""
echo "╔════════════════════════════════════════════════════╗"
echo "║   Neuro Remote Infrastructure Setup                ║"
echo "║   Run this on your REMOTE SERVER                   ║"
echo "║   NOT on your local development machine            ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Install Docker first:"
    echo "   curl https://get.docker.com | sh"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose not found. Install Docker Compose first:"
    echo "   sudo curl -L https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m) -o /usr/local/bin/docker-compose"
    echo "   sudo chmod +x /usr/local/bin/docker-compose"
    exit 1
fi

echo "✅ Docker and Docker Compose found"
echo ""

# Check Python 3.11 for Wayfarer
echo "Checking for Python 3.11+ (for Wayfarer)..."
if ! command -v python3.11 &> /dev/null; then
    echo "⚠️  Python 3.11 not found. Wayfarer will not start."
    echo "   Install with: apt-get install python3.11 python3.11-venv python3.11-dev"
    echo ""
    read -p "Continue without Wayfarer? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "✅ Python 3.11 found"
fi

echo ""
echo "═══════════════════════════════════════════════════════"
echo "Starting SearXNG cluster (instances 1-2)..."
echo "═══════════════════════════════════════════════════════"
echo ""

# Create required directories
mkdir -p searxng
touch searxng/settings.yml 2>/dev/null || true

# Start SearXNG + Nginx
docker-compose up -d searxng-1 searxng-2 nginx

echo ""
echo "✅ SearXNG cluster started"
docker-compose ps | grep searxng

echo ""
echo "═══════════════════════════════════════════════════════"
echo "Testing SearXNG health..."
echo "═══════════════════════════════════════════════════════"
echo ""

# Wait for services to be ready
sleep 10

# Test health endpoint
if curl -f http://localhost:80/health > /dev/null 2>&1; then
    echo "✅ Nginx load balancer is healthy"
else
    echo "⚠️  Nginx not responding yet. It may take another 30 seconds..."
fi

echo ""
echo "═══════════════════════════════════════════════════════"
echo "Setting up Wayfarer (optional)..."
echo "═══════════════════════════════════════════════════════"
echo ""

if command -v python3.11 &> /dev/null; then
    if [ -d "wayfarer" ]; then
        echo "Installing Wayfarer dependencies..."
        cd wayfarer
        pip3.11 install -r requirements.txt 2>/dev/null || pip3.11 install --user -r requirements.txt
        cd ..
        
        echo ""
        echo "✅ Wayfarer dependencies installed"
        echo ""
        echo "To start Wayfarer (in background):"
        echo "  screen -S wayfarer -d -m bash -c 'cd $(pwd)/wayfarer && SEARXNG_URL=http://localhost:80 python3.11 -m uvicorn wayfarer_server:app --host 0.0.0.0 --port 8889'"
        echo ""
        echo "Or start in foreground:"
        echo "  cd wayfarer && SEARXNG_URL=http://localhost:80 python3.11 -m uvicorn wayfarer_server:app --host 0.0.0.0 --port 8889"
    else
        echo "⚠️  Wayfarer directory not found. Skipping setup."
    fi
else
    echo "⚠️  Python 3.11 not available. Wayfarer cannot be started."
fi

echo ""
echo "═══════════════════════════════════════════════════════"
echo "✅ Remote infrastructure setup complete!"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "Next steps on your LOCAL machine:"
echo ""
echo "1. Update .env with your remote server IP:"
echo "   VITE_OLLAMA_URL=http://$(hostname -I | awk '{print $1}'):11440"
echo "   VITE_WAYFARER_URL=http://$(hostname -I | awk '{print $1}'):8889"
echo "   VITE_SEARXNG_URL=http://$(hostname -I | awk '{print $1}'):80"
echo ""
echo "2. Test connectivity:"
echo "   npm run cli -- --health"
echo ""
echo "3. Run parallelization tests:"
echo "   npm run cli -- --parallel"
echo ""
echo "4. Start development:"
echo "   npm run dev"
echo ""

# Show running services
echo "═══════════════════════════════════════════════════════"
echo "Currently running services:"
echo "═══════════════════════════════════════════════════════"
docker-compose ps

echo ""
echo "View logs:"
echo "  docker-compose logs -f searxng-1"
echo "  docker-compose logs -f nginx"
echo ""
