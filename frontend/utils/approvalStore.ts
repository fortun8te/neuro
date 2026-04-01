/**
 * ApprovalStore — session-scoped approval cache (Codex pattern)
 * Serializes keys to JSON for consistent lookups regardless of object key order.
 */

export type ReviewDecision = 'allow_once' | 'allow_session' | 'deny';

export class ApprovalStore {
  private map = new Map<string, ReviewDecision>();

  check(key: object): ReviewDecision | undefined {
    return this.map.get(JSON.stringify(key));
  }

  set(key: object, decision: ReviewDecision): void {
    this.map.set(JSON.stringify(key), decision);
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}

export const globalApprovalStore = new ApprovalStore();
