// ══════════════════════════════════════════════════════
// ██  Long-Term Memory Types — Phase F
// ══════════════════════════════════════════════════════

export type MemoryEntryType =
  | 'insight'
  | 'pattern'
  | 'failure'
  | 'success'
  | 'audience'
  | 'creative';

export type MemoryImpact = 'high' | 'medium' | 'low';

export interface MemoryEntry {
  id: string;
  campaignId: string;
  cycleNumber: number;
  type: MemoryEntryType;
  content: string;
  confidence: number;   // 0-1
  usageCount: number;
  lastUsed: number;     // Unix ms
  createdAt: number;    // Unix ms
  tags: string[];
  impact: MemoryImpact;
}

export interface MemoryStore {
  campaignId: string;
  globalInsights: MemoryEntry[];     // cross-campaign learnings
  audiencePatterns: MemoryEntry[];
  creativePatterns: MemoryEntry[];
  failurePatterns: MemoryEntry[];
  successPatterns: MemoryEntry[];
  totalCycles: number;
  lastUpdated: number;               // Unix ms
}

export interface MemorySearchResult {
  entry: MemoryEntry;
  relevanceScore: number;
}
