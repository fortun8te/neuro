# Web & External Services

Web scraping, HTTP clients, and external service integrations.

## Modules to Move Here (Week 1 Phase 2)

- `wayfarer.ts` — Wayfarer web research API client
- `searxng.ts` — SearXNG search integration
- `browserIntegration.ts` — Browser automation
- `webScraperAgent.ts` — Web scraping orchestration
- `competitorSwot.ts` — Competitor research
- `socialIntelligence.ts` — Social media intelligence
- `visualScoutAgent.ts` — Visual scouting via Playwright
- `downloadService.ts` — File download utilities
- `twitterClient.ts` — Twitter/X API client
- `chartDetector.ts` — Chart/visualization detection
- `tabManager.ts` — Browser tab management

## Structure

```
web/
├── README.md (this file)
├── wayfarer.ts
├── searxng.ts
├── visualScoutAgent.ts
├── competitorSwot.ts
├── index.ts (exports all public APIs)
└── ... (other web modules)
```

## Usage

```typescript
// Before: scattered imports
import { wayfarerService, screenshotService } from '../wayfarer';
import { visualScoutAgent } from '../visualScoutAgent';

// After: organized imports
import { wayfarerService, screenshotService, visualScoutAgent } from '../web';
```

## Guidelines

1. All external API calls belong here
2. Web scraping/automation belongs here
3. Network request handling belongs here
4. No storage logic (use `storage/`)
5. No LLM calls (use `ai-services/`)
6. Export all public APIs from `index.ts`
