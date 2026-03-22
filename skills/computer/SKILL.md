---
name: computer
description: >
  Control a virtual computer with browser, file manager, and terminal.
  Use when the user needs to interact with websites (click, type, fill forms,
  navigate), manage files, or run commands. Use for tasks that require
  multi-step browser interaction beyond simple search.
  Triggers on: "go to", "open", "click", "navigate to", "fill out",
  "sign up", "log in", "download", "use computer", "browse".
version: 1.0.0
---

# Computer Use

Control a virtual desktop with Chrome, Finder, and Terminal.

## When to use
- User needs to interact with a specific website (click buttons, fill forms)
- User needs to navigate and read specific pages
- User wants to manage files (create, move, delete)
- User wants to run terminal commands
- Simple factual lookups should use webfetch instead

## How it works
1. Open the browser/finder/terminal as needed
2. Planner decomposes the task into steps
3. Executor runs each step with vision feedback loop
4. Results reported back with screenshots
