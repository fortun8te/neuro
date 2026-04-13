// ══════════════════════════════════════════════════════
// ██  Competitive Intelligence Types
// ══════════════════════════════════════════════════════

export interface CompetitorProfile {
  name: string;
  domain: string;
  positioning: string;
  targetAudience: string;
  keyMessages: string[];
  pricePoint: 'budget' | 'mid' | 'premium' | 'luxury';
  channels: string[];
  strengths: string[];
  weaknesses: string[];
  visualStyle: string;
  ctaStyle: string;
  recentActivity: string[];
  threatLevel: 0 | 1 | 2 | 3; // 0=minimal, 3=high
}

export interface CompetitiveMatrix {
  brand: string;
  competitors: CompetitorProfile[];
  marketGaps: string[];
  positioningOpportunities: string[];
  directThreats: string[];
  timestamp: number;
}

export interface CompetitiveInsight {
  type: 'gap' | 'threat' | 'opportunity' | 'trend';
  description: string;
  confidence: number;
  sources: string[];
  actionable: boolean;
  recommendation: string;
}

export interface CompetitorAnalysisStatus {
  domain: string;
  status: 'pending' | 'analyzing' | 'complete' | 'error';
  error?: string;
  startedAt?: number;
  completedAt?: number;
}
