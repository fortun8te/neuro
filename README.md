# Neuro — Agentic Creative Intelligence

A sophisticated AI agent framework for autonomous creative work, research orchestration, and multi-modal reasoning.

## Overview

Neuro is an advanced agentic system built on Claude 3.5's extended thinking capabilities, combining:

- **Autonomous Research** — Multi-phase orchestrated web research with compression and synthesis
- **Creative Generation** — AI-powered ad creative, messaging, and content creation
- **Multi-Agent Coordination** — Parallel subagent deployment for complex tasks
- **Visual Intelligence** — Screenshot analysis and competitive visual scouting
- **Context Management** — Sophisticated context window handling with compression and retrieval

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.11+ (for Wayfarer service)
- Docker (for SearXNG search engine)
- Ollama with models deployed

### Installation

```bash
# Clone and setup
git clone https://github.com/yourusername/neuro.git
cd neuro

# Install dependencies
npm install

# Configure environment
cp config/.env.example .env
# Edit .env with your infrastructure URLs

# Start services
npm run dev
```

### Architecture

```
neuro/
├── frontend/          # React + TypeScript UI
├── backend/           # Node.js services & APIs
├── services/          # Specialized services
│   └── wayfarer/      # Web research orchestration
├── config/            # Configuration & env vars
├── docs/              # Documentation
├── scripts/           # Utility scripts
├── tests/             # Test suites
├── public/            # Static assets
└── prompts/           # AI system prompts
```

## Core Features

### 1. Orchestrated Research
Multi-phase research system that:
- Analyzes customer desires and objections
- Maps audience behavior patterns
- Scouts competitor landscape
- Executes parallel web research
- Synthesizes findings into actionable insights

### 2. Creative Pipeline
End-to-end workflow:
- Research → Objection Mapping → Taste Development → Creative Generation → Testing → Memory

### 3. Subagent Architecture
Deploy multiple specialized agents in parallel:
- Visual Scout Agent (screenshot analysis)
- Researcher Agents (web search & compression)
- Council Brains (reasoning & voting)
- Executor Agents (action planning)

### 4. Advanced Context Management
- Semantic retrieval via Context-1
- Intelligent truncation strategies
- Compression with summarization
- Live streaming of generation output

## Configuration

### Environment Variables

```bash
VITE_OLLAMA_URL=http://localhost:11440          # Ollama server
VITE_WAYFARER_URL=http://localhost:8889         # Wayfarer service
VITE_SEARXNG_URL=http://localhost:8888          # SearXNG search
VITE_CONTEXT1_URL=http://localhost:8001         # Context-1 retrieval
```

### Model Configuration

Models are configured in `frontend/utils/modelConfig.ts`. Default assignments:

- **qwen3.5:2b** — Fast routing & compression
- **qwen3.5:4b** — Research orchestration
- **qwen3.5:9b** — Quality reasoning & creative work
- **nemotron-3-super:120b** — Production creative (use sparingly)
- **Context-1** — Semantic retrieval subagent

## Development

### Running Tests

```bash
npm run test
```

### Building for Production

```bash
npm run build
```

### Development Server

```bash
npm run dev
```

## Documentation

- [Setup Guide](./docs/SETUP.md) — Detailed infrastructure setup
- [Architecture](./docs/) — System design and components
- [API Reference](./docs/) — Backend API documentation
- [Prompt Engineering](./prompts/) — System prompt catalog

## Key Innovations

- **Extended Thinking** — Leverages Claude's thinking tokens for deep reasoning
- **Hybrid Retrieval** — BM25 + dense semantic search via Context-1
- **Streaming Architecture** — Real-time output with onChunk callbacks
- **Safety Gates** — Approval systems and policy enforcement
- **Cost Tracking** — Token usage monitoring across all models

## Roadmap

- [ ] Figma integration for visual design handoff
- [ ] Multi-modal input (video, audio)
- [ ] Advanced scheduling & automation
- [ ] Knowledge graph construction
- [ ] Custom model fine-tuning

## Support

For issues and questions:
- GitHub Issues: [Report bugs](https://github.com/yourusername/neuro/issues)
- Documentation: Check `./docs/` folder
- Environment Setup: See `./docs/SETUP.md`

## License

Proprietary — All rights reserved.

## Acknowledgments

Built with:
- [Claude API](https://anthropic.com) — LLM backbone
- [Qwen 3.5](https://huggingface.co/Qwen) — Open-source models
- [React 18](https://react.dev) — UI framework
- [Vite](https://vitejs.dev) — Build tooling
- [Tailwind CSS](https://tailwindcss.com) — Styling

---

**Status:** Active Development
**Last Updated:** April 2026
