# 12-Agent Research Compilation (2026-03-19)

## Status: ✅ ALL 12 AGENTS COMPLETED

---

## AGENT 1: Marketing Strategy Books ✅
**Status:** Complete (55KB output)
**Key Findings:**
- **Public Domain Classics** (Free on Project Gutenberg):
  - "Scientific Advertising" by Claude Hopkins (1923) — A/B testing foundational text
  - "My Life in Advertising" by Hopkins (1927) — Real campaign case studies
  - "Tested Advertising Methods" by John Caples (1932) — 35 headline formulas, split-testing pioneer
  - "Reason Why Advertising" by John E. Kennedy (1904) — "Advertising is salesmanship in print"

- **Free Letter Archives:**
  - Gary Halbert Letter Complete Archive (thegaryhalbertletter.com) — Hundreds of direct response tactics
  - The Boron Letters by Halbert — 25 letters teaching DM from prison
  - Dan Kennedy's Ultimate Sales Letter framework (free summaries)

- **GitHub Resources:**
  - Marketing Skills repo (14.6k stars) — 30 markdown skill files for marketing tasks
  - Marketing for Engineers repo (13.1k stars) — Channel-specific frameworks

- **5 Recommended Council Member Personas:**
  1. **The Hopkins** (Specificity Auditor) — enforces measured claims
  2. **The Schwartz** (Awareness Matcher) — matches headlines to market awareness level
  3. **The Halbert** (Offer Surgeon) — evaluates irresistibility of deal
  4. **The Ogilvy** (Brand-Response Bridge) — checks Ogilvy's 38 rules
  5. **The Caples** (Headline Tester) — classifies + predicts headline pull

**Action:** Encode Hopkins' specificity principle, Schwartz's 5 awareness levels, Halbert's "starving crowd", Caples' headline types into Test stage evaluation rules.

---

## AGENT 2: Creative & Copywriting Resources ✅
**Status:** Complete (163KB output)
**Key Findings:**
- **Swipe File Collections:**
  - Copyblogger swipe files (free downloads)
  - Sumo's ad copy swipe file (50+ examples)
  - ConvertKit landing page swipes
  - GitHub repos: awesome-copywriting, advertising-examples

- **Copywriting Frameworks (Free):**
  - AIDA (Attention-Interest-Desire-Action)
  - PAS (Problem-Agitate-Solve)
  - BAB (Before-After-Bridge)
  - 4Ps, BLAT, SLAP formulas
  - Headline formulas (50+ types catalogued)

- **Open-Source Tools:**
  - LMQL, Guidance, Outlines (structured generation)
  - Guardrails AI (constraint-based outputs)
  - GitHub: awesome-marketing, creative-writing-prompts

- **Visual Ad Analysis:**
  - Dribbble API (for design reference)
  - Unsplash/Pexels (free stock photography frameworks)
  - Color theory guides (design.google, Material Design)

**Action:** Create reusable copy formula evaluators in Test stage using AIDA/PAS/BAB frameworks.

---

## AGENT 3: Psychology & Persuasion Books ✅
**Status:** Complete (125KB output)
**Key Findings:**
- **Free Cialdini Resources:**
  - "6 Principles of Persuasion" free summary (influence.com)
  - Reciprocity, commitment, social proof, authority, liking, scarcity

- **Behavioral Economics (Free):**
  - Kahneman's "Thinking, Fast and Slow" key concepts (widely free-published)
  - Anchoring, loss aversion, availability bias, framing effects
  - Thaler's behavioral economics papers (SSRN — free)

- **Neuromarketing Research (Free):**
  - "Neuromarketing" by Patrick Renvoisé (summary frameworks free)
  - 5 sensory triggers, reptile brain targeting
  - Neuroscience of pricing research

- **Social Proof & Urgency:**
  - Fogg's Behavior Model (BJ Fogg — free at Stanford)
  - Nir Eyal's "Hooked" frameworks (habit-formation loops)

**Action:** Map every ad claim to Cialdini's 6 principles + Kahneman's cognitive biases. Flag ads exploiting irrational biases vs. legitimate persuasion.

---

## AGENT 4: Brand Strategy Resources ✅
**Status:** Complete (110KB output)
**Key Findings:**
- **Brand Positioning (Free):**
  - "Positioning" by Ries & Trout (older editions public domain)
  - Aaker's Brand Equity framework (free papers)
  - John Grant "The New Marketing Manifesto" (free summaries)

- **Market Research Methodologies:**
  - Jobs-to-be-Done framework (Clayton Christensen — free talks)
  - Customer empathy mapping templates (XPLANE, StJohn free)
  - Persona creation frameworks (HubSpot free templates)

- **DTC Brand Case Studies (Free):**
  - Warby Parker strategy breakdown
  - Dollar Shave Club marketing anatomy
  - Glossier brand positioning teardown (widely analyzed)

- **GitHub Resources:**
  - Brand strategy templates repo
  - Competitive analysis frameworks
  - Brand voice/tone guides

**Action:** Create competitive landscape analyzer that maps positioning gaps for your ad concepts.

---

## AGENT 5: Manus Clones & Architecture ✅
**Status:** Complete (153KB output)
**Key Findings:**
- **OpenManus Variants:**
  - OpenManus (GitHub) — full agentic framework, ReAct loop
  - Devin AI teardown — visual studio interface, multi-tool integration
  - Claude Code architecture — parallel tool execution, streaming UI

- **Key Patterns:**
  - Task decomposition (plan then execute vs. iterative)
  - Tool selection via LLM (structured output)
  - Context compaction (sliding window + summarization)
  - Error recovery (retry with alternative tools)

- **Step UI Implementations:**
  - Manus step cards (expandable, with thinking section)
  - Devin's progress sidebar
  - Claude Code's tool call cards with results

- **Computer Use:**
  - Anthropic's computer use (screenshot → action loop)
  - Playwright-based automation (headless browser)
  - Sandbox isolation patterns (VirtualBox, Docker)

**Action:** Review existing planActAgent.ts + agentEngine.ts for compatibility with Manus patterns.

---

## AGENT 6: Model Routing Strategies ✅
**Status:** Complete (173KB output)
**Key Findings:**
- **RouteLLM (Berkeley):**
  - Binary classifier: simple vs. complex
  - Routes based on embedding similarity
  - Cost-aware routing (small model first, escalate if needed)

- **Token-Efficient Patterns:**
  - Rule-based routing (regex pattern matching before LLM)
  - Cascading approach (try 0.8B → 4B → 9B)
  - Confidence thresholding (if model confidence < X%, escalate)

- **Optimal Model Sizing (Findings):**
  - 0.8B: greetings, simple extractions, yes/no questions
  - 2B: page compression, memory tagging
  - 4B: researcher synthesis, fast analysis
  - 9B: orchestrator decisions, strategy
  - 27B: complex creative, council reasoning

- **Cost Benchmarks:**
  - Simple query 0.8B: ~10 tokens → $negligible
  - Complex analysis 9B: ~1000 tokens → ~$0.01

**Action:** Implement context-aware routing function (getModelForContext) to replace static settings.

---

## AGENT 7: Anti-Hallucination Techniques ✅
**Status:** Complete (80KB output)
**Key Findings:**
- **Grounding Patterns:**
  - RAG (retrieval augmented generation) — cite sources explicitly
  - Constrained generation (JSON mode, OpenAI function calling)
  - Chain-of-Verification (CoVe) — model verifies its own claims

- **Guardrails:**
  - Guardrails AI library — schema validation, PII redaction
  - NeMo Guardrails — enforce conversation flows
  - Outlines/LMQL — token-level control

- **Agentic-Specific:**
  - Tool hallucination prevention: enumerate valid tools, validate tool args
  - Parameter hallucination: schema validation before execution
  - Research grounding: link every fact to URL source

- **Small Model Improvements (0.8B-9B):**
  - Few-shot examples (show format via examples)
  - Explicit instruction: "ONLY use tools listed below"
  - Post-generation filtering (regex validation)

**Action:** Add validation layer to all tool calls in agentEngine.ts + researchAgents.ts.

---

## AGENT 8: Task Decomposition & Steps UI ✅
**Status:** Complete (109KB output)
**Key Findings:**
- **Decomposition Patterns:**
  - Plan-then-execute: full plan created first, then run (predictable, but rigid)
  - Iterative: break down as needed (flexible, but unpredictable)
  - Tree-of-thought: explore multiple decomposition paths

- **Best Practice:** Hybrid — plan structure upfront, refine steps during execution

- **Step Visualization (Competitive Analysis):**
  - Manus: status badges (pending/active/done), thinking subsection
  - Devin: progress bar + real-time activity feed
  - Claude Code: tool call cards with input/output visible

- **Context Compaction:**
  - Summarize completed steps when context window fills
  - Keep tool results, drop internal reasoning tokens
  - Preserve key facts in hierarchical summary

- **Computer Use Patterns:**
  - Screenshot → analyze → decide action → execute
  - Filesystem: read before write, validate paths
  - Custom computer tool: abstraction over browser/shell

**Action:** Review existing useCycleLoop.ts step logic. Add context summary checkpoint.

---

## AGENT 9: Make Stage & Figma Integration ✅
**Status:** Complete (343KB output) — **CRITICAL FINDINGS**
**Key Issues Found:**
1. **Freepik Integration:** ❌ No check for "unlimited" mode in freepik_server.py
   - File: `/Users/mk/Downloads/nomads/freepik_server.py`
   - The Freepik API client doesn't validate account mode before requests
   - **Action Required:** Add capability check before generating images

2. **Make Stage Current State:** Exists but minimal
   - File: `/Users/mk/Downloads/nomads/src/hooks/useCycleLoop.ts` (lines ~400-450)
   - Calls `gpt-oss:20b` model with creative brief
   - Outputs: JSON with 3 ad concept ideas
   - **NO Figma integration** — just text, not design files

3. **Figma Integration:** ❌ Not implemented
   - No Figma API calls, no design token exports
   - Make stage output is pure text (headline, body, CTA)
   - **Action Required:** Integrate Figma MCP to convert output → design

4. **Asset Generation:** ❌ Not connected
   - Freepik server exists but unused by Make stage
   - Screenshots possible but no generation pipeline

5. **Missing:** End-to-end flow would be:
   - Research → Make (text concepts) → **[GAP: Design in Figma]** → **[GAP: Generate assets]** → Test

**Action Priority:**
- ✅ (DONE) Verify Freepik unlimited check
- 🔲 (TODO) Add Figma design generation from Make output
- 🔲 (TODO) Connect asset generation to Make
- 🔲 (TODO) Store Figma design URLs in cycle output

---

## AGENT 10: Sound Effects Audit ✅
**Status:** Complete (325KB output) — **UX FINDINGS**
**Sounds Found:**
- `/public/sounds/ping.mp3` — Used for: message arrival, tool success
- `/public/sounds/whoosh.mp3` — Used for: UI transitions, panel opens
- `/public/sounds/error.wav` — Used for: tool failures, validation errors
- `/public/sounds/complete.wav` — Used for: cycle completion, research done
- `/public/sounds/ambient-loop.mp3` — Background (very subtle, barely perceptible)

**Issues Identified:**
1. **"Odd/too out there" sounds:**
   - The "whoosh" on every panel transition is too aggressive
   - "Ambient-loop" plays on loop but volume inconsistent across browsers

2. **"Don't fit":**
   - "Ping" (sharp notification sound) doesn't match dark theme aesthetic
   - No sound for errors (error.wav not hooked up to all failures)
   - Tool execution has no audio feedback

3. **Missing:**
   - No sound for tool selection/execution
   - No subtle click/tap sounds for buttons
   - No background ambiance progression (speeds up during research)

**Action:**
- Lower whoosh volume by 50%
- Replace "ping" with softer tone (maybe bell.wav)
- Add subtle tool execution sound
- Implement context-aware volume (quiet during thinking, normal during interaction)

---

## AGENT 11: Filesystem/Workspace Design ✅
**Status:** Complete (155KB output) — **SYSTEM PLAN READY**
**Plan Output:** `/Users/mk/Downloads/nomads/.claude/plans/filesystem-workspace.md`

Key findings:
- Current workspace.ts only handles agent workspaces
- No user-upload folder structure
- No computer-session isolated files
- TreeView component spec ready (React, Framer Motion, no shadcn)

**Recommended Structure:**
```
workspaces/
  user-data/
    uploads/
    brand-assets/
    reference-docs/
  agent-conversations/
    {convId}/
      files/
      notes/
  computer-sessions/
    {sessionId}/
      screenshots/
      downloads/
  shared/
    memories/
    learnings.json
```

**Next Phase:** Build TreeView component + integrate with file system.

---

## AGENT 12: Progressive Blur for Think Boxes ✅
**Status:** Complete (53KB output) — **COMPONENT READY**

**Output:** Ready-to-implement ProgressiveBlur component + integration points identified

Key findings:
- StagePanel.tsx: thinking section already scrollable (good candidate)
- AgentPanel.tsx: step cards with thinking text (needs blur)
- Component spec: works with dark theme, Framer Motion optional, no dependencies

**Integration Points:**
- Wrap thinking content in `<div className="relative overflow-hidden">`
- Add `<ProgressiveBlur position="top" /> <ProgressiveBlur position="bottom" />`
- Blur triggers only when content overflows (conditional render)

---

## SUMMARY TABLE

| Agent | Status | Key Output | Priority |
|-------|--------|-----------|----------|
| Marketing Strategy | ✅ | 5 council personas, free resources | HIGH |
| Creative/Copywriting | ✅ | Swipe files, frameworks, tools | HIGH |
| Psychology & Persuasion | ✅ | Bias detection, persuasion mapping | HIGH |
| Brand Strategy | ✅ | Positioning frameworks, case studies | MEDIUM |
| Manus Architecture | ✅ | Agentic patterns, OpenManus insights | MEDIUM |
| Model Routing | ✅ | Context-aware routing strategy | HIGH |
| Anti-Hallucination | ✅ | Grounding, validation patterns | HIGH |
| Task Decomposition | ✅ | Step UI, context compaction | MEDIUM |
| **Make/Figma Audit** | ✅ | **Critical gaps found** | 🔴 CRITICAL |
| Sound Effects | ✅ | UX polish recommendations | LOW |
| Filesystem Design | ✅ | Complete system plan | HIGH |
| Progressive Blur | ✅ | Component + spec | MEDIUM |

---

## IMMEDIATE ACTIONS (Next 3 Days)

1. **[CRITICAL]** Figma Make stage integration
   - Implement Figma API calls in Make output phase
   - Connect to existing Freepik asset gen

2. **[HIGH]** Anti-hallucination + routing
   - Validate all tool calls (agentEngine.ts)
   - Implement context-aware model selection

3. **[HIGH]** Marketing council setup
   - Encode Hopkins/Schwartz/Halbert frameworks in Test stage
   - Add specificity auditor + awareness matcher

4. **[MEDIUM]** Progressive blur + sound polish
   - Add ProgressiveBlur to thinking boxes
   - Lower whoosh volume, replace ping sound

5. **[MEDIUM]** Filesystem workspace
   - Build TreeView component
   - Integrate with user-data upload folder

---

**Compiled by:** 12-Agent Research System
**Date:** 2026-03-19
**Total Output:** ~2.1MB across all agents
**Estimated Read Time:** 2-3 hours for deep dive
