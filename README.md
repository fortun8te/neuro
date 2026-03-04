# NOMADS - Autonomous Creative Advertising Agent

NOMADS is an AI system that generates complete advertising campaigns independently. Give it a brief and target market, and it will research the space, define creative strategy, generate designs, evaluate them, and archive the learnings for the next campaign.

The system works through a 5-stage cycle that mimics how professional creative teams operate, but executes in minutes instead of weeks.

---

## How It Works: The Framework

NOMADS creates ads through an intelligent 5-stage cycle. Each stage builds on the previous one. The entire process runs autonomously without human input.

### Stage 1: Research (45-90 seconds)

The system becomes a competitive intelligence analyst. It uses a sophisticated multi-agent orchestration system to deeply analyze your target market and competitors.

**Input:** Campaign brief, target market, product details
**Output:** Market analysis, audience insights, competitive gaps, positioning opportunities

**Research Architecture:**
- **Zakaria Framework**: Deep-dive research into customer desires, objections, positioning
- **Orchestrated Web Search**: Parallel researcher agents query Google/DuckDuckGo for real market data
- **Coverage Graph**: Tracks 10 research dimensions (market size, competitors, objections, trends, regional factors, pricing, channels, positioning, psychology, media patterns)
- **Reflection Agent**: Identifies gaps in coverage and suggests new research angles

**What it discovers:**
- Who your audience is and what they deeply care about (not just surface wants)
- What competitors are doing well vs what they're missing
- What messages and tactics are working
- Where the opportunity gap is
- What you could say that competitors aren't
- Regional and cultural nuances
- Psychological triggers that drive decisions

**Example:** "Women 25-45 want effective skincare AND natural ingredients. No competitor combines scientific credibility with a natural story while addressing specific skin concerns. That's your gap. They research on Reddit/skincare blogs and trust dermatologist recommendations."

**Status:** ✅ **FULLY WORKING**
- Real web search via DuckDuckGo
- Parallel researcher agents (3 at a time)
- Orchestrator decides what to research next
- Coverage tracking across 10 dimensions
- Reflection agent identifies gaps
- 80% coverage threshold for completion

### Stage 2: Taste (30-60 seconds)

Now that we understand the market, the system defines the creative direction. This is the personality, visual style, and messaging strategy for your brand.

**Input:** Research insights, campaign brief, product features
**Output:** Creative direction, visual identity, messaging strategy

**What it defines:**
- Visual identity (colors, photography style, typography, mood)
- Tone of voice (how should we talk to the audience)
- Key messages to emphasize
- Emotional strategy (what feeling should we create)
- Unique competitive angle
- Execution framework (format, pacing, proof points)
- Call-to-action strategy

**Example:** "Use forest green and gold. Photography: botanical but real skin—not overly edited. Tone: knowledgeable but warm, not clinical. Message formula: effective + natural + conscious choice. Emotional hook: empowered confidence. CTA: 'Discover your formula'."

**Status:** ✅ **FULLY WORKING**
- Integrated with research outputs
- Generates multi-paragraph creative briefs
- Real-time streaming output
- Stores visual direction with campaign

### Stage 3: Make (2-5 minutes) [PENDING]

The system generates actual visual designs using the creative direction. Multiple variations are created, each testing a different angle or message.

**Input:** Creative direction, campaign brief, asset library
**Output:** 4-8 design variations in multiple formats

**What it would create:**
- Instagram feeds, stories, reels
- Facebook ads
- Email headers
- Website banners
- Mobile versions
- Each variant tests a different message angle

**Status:** 🔴 **BLOCKED - PENDING FIGMA INTEGRATION**
- Needs Figma MCP to generate designs programmatically
- Would use creative direction to create structured designs
- Reference: Figma MCP at https://github.com/arinspunk/claude-talk-to-figma-mcp

### Stage 4: Test (1-2 minutes) [PENDING]

The system evaluates each design variation to predict which will perform best. It acts like a design critic and performance analyst.

**Input:** Design variations, creative brief
**Output:** Performance predictions, ranked designs, improvement suggestions

**What it would evaluate:**
- Design quality and professional execution
- Message clarity and impact
- Predicted click-through rate
- Predicted conversion rate
- Which variation performs best
- What elements are most effective
- What could be improved

**Example:** "Results variation (before/after) scores 9/10 CTR prediction. Values variation scores 8.5/10. Results is more persuasive for this demographic. Recommend allocating 80% budget there."

**Status:** 🔴 **BLOCKED - NEEDS VISION LLM**
- Would use Claude's vision capabilities to analyze designs
- Requires visual understanding of creative quality

### Stage 5: Memories (10-20 seconds)

The system archives everything and extracts learnings. This creates a knowledge base that makes future campaigns smarter.

**Input:** All outputs from previous stages
**Output:** Archived cycle, learnings summary, reusable assets

**What it preserves:**
- Campaign summary
- Research insights (what did we learn about the audience)
- Creative direction that worked
- Winning design patterns
- Why they performed best
- Reusable templates and frameworks
- Next campaign recommendations

**Status:** ✅ **WORKING**
- Stores all campaign data to IndexedDB
- Persists across sessions
- Queryable history

---

## The Process Flow

```
USER INPUT
Campaign brief + target market + product details
     |
     v
RESEARCH STAGE ✅
Deep market analysis + web search + coverage tracking + reflection
     |
     v
TASTE STAGE ✅
Define creative direction, visual style, messaging
     |
     v
MAKE STAGE 🔴 [PENDING]
Generate 4-8 design variations (needs Figma MCP)
     |
     v
TEST STAGE 🔴 [PENDING]
Evaluate designs, predict performance (needs Vision LLM)
     |
     v
MEMORIES STAGE ✅
Archive learnings, extract insights
     |
     v
OUTPUT
Complete campaign: insights + strategy + designs + learnings
```

---

## What's Been Completed

### Phase 1-2: Foundation ✅
- React + TypeScript + Vite setup
- Tailwind CSS v4 styling
- IndexedDB persistence
- React Context state management
- Dashboard UI

### Phase 3: Core Research System ✅
- **Zakaria Framework Integration**: Maps customer desires → objections → positioning
- **Orchestrated Research**: Multi-agent architecture with decision-making orchestrator
- **Web Search**: Real DuckDuckGo integration (free, reliable, no auth needed)
- **Parallel Researchers**: Deploy multiple agents simultaneously
- **Research Agents**: Each focuses on specific topic, synthesizes findings
- **Coverage Tracking**: 10-dimensional coverage graph instead of single completeness score
- **Reflection Agent**: Analyzes gaps and generates new research angles

### Phase 4: QuickChat Builder ✅
- Conversational campaign setup
- **Livestream Output**: Real-time token streaming as AI generates
- **Thinking Indicator**: Shows "🧠 Thinking..." during generation
- Smart question routing
- Auto-extracts campaign parameters
- Form validation and confirmation

### Phase 5: Infrastructure & Optimization ✅
- Local Ollama integration (localhost:11434)
- Model support: mistral:latest, gpt-oss:20b
- Streaming response handling
- Real-time UI updates
- Kill/Reset campaign controls
- Debug menu with health checks
- Cancel button for in-progress tasks

### Phase 6: Advanced Features ✅
- **Coverage Graph**: Replaced simple completeness scoring with dimensional tracking
  - Market size & trends
  - Competitor analysis
  - Customer objections
  - Emerging trends
  - Regional differences
  - Pricing strategies
  - Channel effectiveness
  - Brand positioning gaps
  - Psychological triggers
  - Media consumption patterns
- **Reflection Agent**: Evaluates research gaps and generates novel investigation angles
- **Orchestrator Refinement**: Uses coverage percentage (80% threshold) instead of arbitrary completeness scores

---

## What Still Needs to Be Done

### 1. Make Stage: Design Generation (HIGH PRIORITY)
**What:** Generate actual visual designs based on creative direction
**Why:** Currently has strategy but no visual output
**How:** Integrate Figma MCP to create designs programmatically
**Effort:** 2-3 days
**Blocker:** Figma MCP integration
**Reference:** https://github.com/arinspunk/claude-talk-to-figma-mcp

**Implementation approach:**
- Take creative direction output from Taste stage
- Convert to Figma design specs (colors, typography, imagery, layout)
- Generate 4-8 variations testing different message angles
- Each design follows brand guidelines but emphasizes different angle
- Export as Figma files or images

### 2. Test Stage: Design Evaluation (HIGH PRIORITY)
**What:** Evaluate designs and predict performance
**Why:** Need to rank variations and pick winners
**How:** Use Claude's vision capabilities to analyze designs
**Effort:** 1-2 days
**Blocker:** Requires Vision LLM access (Claude 4V)

**Implementation approach:**
- Load designs generated in Make stage
- Analyze design quality, clarity, impact
- Predict CTR/conversion based on psychological principles
- Rank variations by predicted performance
- Suggest improvements

### 3. Polish & Refinement (MEDIUM PRIORITY)
- User onboarding flow
- Example campaigns to try
- Error handling improvements
- Performance optimization for large campaigns
- Export options (PDF, images, HTML)

### 4. Advanced Features (NICE TO HAVE)
- A/B test variant generation
- Campaign scheduling integration
- Analytics feedback loop (learn from actual performance)
- Multi-brand campaign templates
- Competitor tracking over time
- Market trend alerts

---

## Tech Stack

**Frontend:**
- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS v4
- React Context + Hooks

**Storage:**
- IndexedDB (local, persistent)
- idb-keyval wrapper

**AI/LLM:**
- Local Ollama (localhost:11434)
- Models: mistral:latest, gpt-oss:20b
- Web Search: DuckDuckGo API (free)

**Future:**
- Figma MCP (for Make stage)
- Claude Vision (for Test stage)

**All data stays local.** Everything runs on your machine. No cloud uploads, no licensing fees, no monthly bills.

---

## Current Status & Performance

**Working & Tested:**
- ✅ Research stage: Real web search + coverage tracking + reflection
- ✅ Taste stage: Creative direction generation
- ✅ QuickChat: Livestream conversation with thinking indicator
- ✅ Dashboard: Create campaigns, manage cycles, view outputs
- ✅ Persistence: Data saved to IndexedDB, survives reload
- ✅ Pause/Resume: Stop and restart execution mid-cycle
- ✅ Infrastructure: Local Ollama + DuckDuckGo working reliably

**Blocked:**
- 🔴 Make stage: Needs Figma integration for design generation
- 🔴 Test stage: Needs Vision LLM for design evaluation

**Timeline:**
- Research stage: 45-90 seconds
- Taste stage: 30-60 seconds
- Full Research + Taste cycle: ~2-3 minutes
- Full cycle with Make + Test: ~5-10 minutes (once implemented)

---

## Getting Started

### Requirements
- Node.js 16+
- npm
- Ollama running locally (https://ollama.ai)

### Setup

```bash
# Terminal 1: Start Ollama
ollama serve

# In another terminal, pull a model if needed
ollama pull mistral

# Terminal 2: Start the app
cd /Users/mk/Downloads/ad-agent
npm install
npm run dev
```

Open http://localhost:5173

### First Campaign

1. Click **"Create Campaign"** or use **QuickChat**
2. Enter campaign details (brand, product, target audience, goal)
3. Click **"START"** to begin the research cycle
4. Watch Research stage analyze your market in real-time
5. Watch Taste stage generate creative direction
6. Review outputs and save campaign

### Using QuickChat

1. Click **"Quick Chat"** button
2. Type about your product/brand (e.g., "I'm building a fitness app for women")
3. Answer AI's follow-up questions
4. Watch livestream as AI thinks and responds
5. System auto-completes when it has enough info
6. Review extracted campaign data and confirm

---

## Project Structure

```
src/
  components/
    Dashboard.tsx              Main app shell
    CampaignSelector.tsx       Create/select campaigns
    CycleTimeline.tsx          View cycle progress
    QuickChatBuilder.tsx       Conversational setup (with livestream!)
    SettingsModal.tsx          Config + debug menu
    ResearchOutput.tsx         Display research findings
    ControlPanel.tsx           Stage controls

  context/
    CampaignContext.tsx        Centralized state management

  hooks/
    useCycleLoop.ts            Orchestrates all 5 stages
    useOllama.ts               Connects to local Ollama
    useStorage.ts              IndexedDB persistence
    useOrchestratedResearch.ts Research agent orchestration
    useCampaign.ts             Campaign CRUD operations

  utils/
    researchAgents.ts          Researcher + Orchestrator + Reflection Agent
    ollama.ts                  Ollama API wrapper with streaming
    searxng.ts                 DuckDuckGo web search integration
    prompts.ts                 Research/Taste/Test prompts

  types/
    index.ts                   All TypeScript interfaces
```

**Key Files:**

- **src/hooks/useCycleLoop.ts**: Orchestrates all 5 stages. When user clicks START, this handles execution flow.
- **src/utils/researchAgents.ts**: Contains orchestrator, researcher agents, reflection agent. Handles multi-agent coordination.
- **src/utils/ollama.ts**: Ollama API wrapper with streaming support.
- **src/components/QuickChatBuilder.tsx**: Livestream conversation with real-time token rendering.

---

## Important Concepts

**Campaign:** A brand/product being advertised. Contains all stages' outputs.

**Cycle:** A single execution through all 5 stages. Each campaign can have multiple cycles.

**Stage:** One of the 5 processes (Research, Taste, Make, Test, Memories).

**Output:** The text, strategy, or designs generated by a stage.

**Coverage Graph:** Tracks which research dimensions have been covered (10 total). Replaces single completeness score.

**Reflection Agent:** After research, analyzes gaps and suggests new angles to investigate.

**Orchestrator:** Makes decisions about what to research next based on coverage and campaign needs.

**Flow:**
1. User creates campaign with QuickChat or manual entry
2. User clicks START
3. Context creates new cycle object
4. useCycleLoop detects it and starts executing
5. Research stage: Orchestrator + researchers analyze market
6. Coverage graph updated as research completes
7. Reflection agent identifies gaps
8. Orchestrator decides if more research needed
9. Once coverage threshold reached (80%), Taste stage begins
10. Taste stage generates creative direction
11. All outputs saved to IndexedDB
12. UI updates in real-time with streaming output
13. Cycle marked complete, archived in storage

---

## Common Commands

```bash
npm run dev              Start development server
npm run build            Production build
npm run preview          Preview production build

# Ollama
ollama serve             Start Ollama AI server
ollama pull mistral      Download mistral model
curl http://localhost:11434/api/tags    Check Ollama models
```

---

## Troubleshooting

**App won't start:**
- Ensure Node.js 16+ installed
- Run `npm install` in project directory
- Check that port 5173 isn't in use

**Ollama connection failing:**
- Verify Ollama is running: `curl http://localhost:11434/api/tags`
- Ensure Ollama models downloaded: `ollama list`
- Restart Ollama if needed: `ollama serve`

**No web search results:**
- Check DuckDuckGo is accessible from your network
- Verify internet connection
- App falls back to LLM-only if search unavailable

**Slow response times:**
- This is normal—LLM inference is slow
- First request to a model is slower (loading)
- Mistral is faster; gpt-oss is more capable but slower
- Consider limiting number of parallel researchers

---

## Architecture & Design Decisions

**Why Local Ollama?**
- Complete privacy (no data sent anywhere)
- No API keys or subscriptions needed
- Works offline
- Fast iteration during development

**Why DuckDuckGo for search?**
- Free (no API key)
- Privacy-focused
- Reliable
- No rate limiting issues

**Why Coverage Graph instead of completeness %?**
- Single score was arbitrary (95%? 80%?)
- Coverage graph shows WHAT is covered
- Reflection agent can identify specific gaps
- More actionable for orchestrator decisions

**Why Orchestrator + Researchers?**
- Parallel research is faster than sequential
- Orchestrator decides strategically what to research
- Reflection agent ensures nothing is missed
- Mimics how real teams work (lead makes decisions, team executes)

---

## Performance Characteristics

**Typical Timings:**
- Research: 45-90 seconds (depends on search results, LLM response time)
- Taste: 30-60 seconds
- Make: 2-5 minutes (pending implementation)
- Test: 1-2 minutes (pending implementation)
- Full cycle: 5-15 minutes (once Make/Test implemented)

**Bottleneck:** LLM inference speed. Mistral is 10-20 seconds per response. gpt-oss is 30-60 seconds but higher quality.

---

## Repository & Links

**Repository:** https://github.com/fortun8te/nomads

**Current Branch:** main

**Latest Commit:** Coverage Graph + Reflection Agent + QuickChat Livestream

**Last Updated:** March 4, 2026

---

## Next Steps for Development

1. **Immediate:** Integrate Figma MCP for Make stage
   - Reference: https://github.com/arinspunk/claude-talk-to-figma-mcp
   - Would unlock design generation

2. **Soon:** Implement Test stage with Vision LLM
   - Uses Claude's vision to evaluate designs
   - Predicts performance metrics

3. **Polish:** UX improvements and edge cases
   - Error handling for network failures
   - Campaign templates
   - Export options

4. **Advanced:** Analytics integration
   - Track actual ad performance
   - Feed results back to system
   - Improve recommendations over time

---

## Questions?

- See ARCHITECTURE.md for code deep dive
- See NOMADS.md for complete project details
- See PROJECT_VISION.md for mission and vision
