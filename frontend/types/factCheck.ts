/**
 * Fact Checking System Types
 * Validates research claims against multiple sources
 */

// ─────────────────────────────────────────────────────────────
// Fact Claim — Claims extracted from research findings
// ─────────────────────────────────────────────────────────────

export interface FactClaim {
  id: string;                    // Unique identifier
  claim: string;                 // The verifiable statement
  sourceSection: string;         // Where it came from (e.g., 'deepDesires', 'objections')
  sourceIndex?: number;          // Index within that section
  extractedAt: number;           // Timestamp
  claimType: 'statistic' | 'fact' | 'quote' | 'trend' | 'attribution';
  confidence: number;            // Original confidence 0-1
}

// ─────────────────────────────────────────────────────────────
// Fact Check Result — Verdict for a single claim
// ─────────────────────────────────────────────────────────────

export interface FactCheckResult {
  claimId: string;               // Reference to FactClaim.id
  claim: string;                 // The claim being checked
  verdict: 'verified' | 'disputed' | 'unverified';
  confidence: number;            // Final confidence 0-1
  evidence: {
    supporting: string[];        // URLs/quotes that support the claim
    contradicting: string[];     // URLs/quotes that contradict it
    neutral: string[];           // URLs that are tangentially relevant
  };
  sourceAgreement: number;       // % of sources that support claim (0-100)
  reasonForVerdict: string;      // Plain English explanation
  checkedAt: number;             // Timestamp
  sourceUrls: string[];          // All URLs checked for this claim
}

// ─────────────────────────────────────────────────────────────
// Flagged Claim — Claims that require special handling
// ─────────────────────────────────────────────────────────────

export interface FlaggedClaim {
  claimId: string;
  claim: string;
  flag: 'low-authority' | 'requires-attribution' | 'contradicted' | 'unverified' | 'age-old' | 'regional';
  reason: string;               // Explanation for the flag
  recommendation: string;       // How to handle it in downstream stages
  severity: 'low' | 'medium' | 'high';
}

// ─────────────────────────────────────────────────────────────
// Fact Check Report — Complete fact check results
// ─────────────────────────────────────────────────────────────

export interface FactCheckReport {
  checkedClaims: FactCheckResult[];
  totalClaimsChecked: number;
  verifiedCount: number;
  disputedCount: number;
  unverifiedCount: number;
  overallCredibility: number;    // 0-100, weighted by claim importance
  flaggedClaims: FlaggedClaim[];
  uncheckedClaims: {             // Claims that couldn't be checked
    ids: string[];
    reasons: string[];
  };
  completedAt: number;
  processingTimeMs: number;
  checkerModel: string;
  validatorModel: string;
}

// ─────────────────────────────────────────────────────────────
// Source Authority Assessment
// ─────────────────────────────────────────────────────────────

export interface SourceAuthority {
  url: string;
  domain: string;
  authority: number;            // 0-1, how trustworthy this source is
  category: 'academic' | 'news' | 'official' | 'review' | 'social' | 'blog' | 'forum' | 'archive' | 'other';
  relevantFor: string[];        // What claim types this is good for
  notSuitableFor: string[];     // What claims it shouldn't be used for
  notes?: string;
}
