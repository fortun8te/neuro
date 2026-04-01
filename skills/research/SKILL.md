---
name: research
description: >
  Deep multi-source web research. Use when the user needs comprehensive analysis
  across many sources, competitive research, market analysis, or deep investigation.
  Triggers on: "research", "analyze", "deep dive", "investigate", "compare",
  "competitive analysis", "market research".
version: 1.0.0
---

# Deep Research

Batch-fetch 10-50+ web pages and synthesize findings.

## When to use
- User asks for research or analysis requiring multiple sources
- User wants competitive intelligence or market analysis
- User says "research", "deep dive", "analyze competitors"
- Simple factual questions should use webfetch instead

## How it works
1. Generate 3-5 search queries from the goal
2. Search SearXNG for each query
3. Batch-fetch all unique URLs via Wayfarer
4. Summarize each page with qwen3.5:2b
5. Synthesize all summaries with qwen3.5:4b
