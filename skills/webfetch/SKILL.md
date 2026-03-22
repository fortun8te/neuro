---
name: webfetch
description: >
  Search the web and fetch page content. Use when the user asks factual questions,
  wants to look something up, check weather, find information, or needs current data.
  Triggers on: "what is", "look up", "search for", "find out", "check", "weather",
  "how much", "when is", "who is", "latest news about".
version: 1.0.0
---

# Web Fetch

Search the web using SearXNG and return summarized results.

## When to use
- User asks a factual question that needs current data
- User wants to look something up
- User asks about weather, prices, news, events
- User says "look it up", "check that", "find out"

## How it works
1. Extract the search query from the user's message
2. Call SearXNG API via /api/search proxy
3. Take top 8 results with titles and snippets
4. Return the combined text as context for the LLM

## Query extraction examples
- "what's the weather in amsterdam" -> "weather amsterdam"
- "can u look up what time it is" -> "current time"
- "how much does an iphone cost" -> "iphone price 2026"
- "who won the superbowl" -> "superbowl winner 2026"
