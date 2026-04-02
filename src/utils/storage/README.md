# Storage & Persistence

IndexedDB, memory stores, caching, and data persistence modules.

## Modules to Move Here (Week 1 Phase 2)

- `neuroMemory.ts` — Daily memory logs, persistence
- `memoryStore.ts` — Memory search and storage
- `blackboard.ts` — Ephemeral shared state
- `adLibraryCache.ts` — Ad library caching
- `cloudSyncManager.ts` — Cloud sync coordination
- `sessionFileSystem.ts` — Virtual file system for sessions
- `storageManager.ts` — General storage abstraction
- `deduplicator.ts` — Memory deduplication logic
- `cacheService.ts` — Request/response caching
- `approvalStore.ts` — Approval/decision store

## Structure

```
storage/
├── README.md (this file)
├── neuroMemory.ts
├── memoryStore.ts
├── blackboard.ts
├── sessionFileSystem.ts
├── adLibraryCache.ts
├── index.ts (exports all public APIs)
└── ... (other storage modules)
```

## Usage

```typescript
// Before: scattered imports
import { neuroMemory } from '../neuroMemory';
import { blackboard } from '../blackboard';
import { vfs } from '../sessionFileSystem';

// After: organized imports
import { neuroMemory, blackboard, vfs } from '../storage';
```

## Guidelines

1. All persistence/storage logic belongs here
2. IndexedDB wrappers belong here
3. No API calls to external services (use `web/` or `ai-services/`)
4. No UI components
5. Export all public APIs from `index.ts`
