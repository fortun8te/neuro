// ══════════════════════════════════════════════════════
// ██  Competitive Matrix Store
// Module-level store that allows Dashboard to inject the
// current competitive matrix into the research pipeline
// without requiring prop-drilling through useCycleLoop.
// ══════════════════════════════════════════════════════

import type { CompetitiveMatrix } from '../types/competitive';

let _currentMatrix: CompetitiveMatrix | null = null;

/** Set the active competitive matrix (called from Dashboard before research starts) */
export function setActiveCompetitiveMatrix(matrix: CompetitiveMatrix | null): void {
  _currentMatrix = matrix;
}

/** Get the active competitive matrix (called from useOrchestratedResearch) */
export function getActiveCompetitiveMatrix(): CompetitiveMatrix | null {
  return _currentMatrix;
}

/** Clear the active matrix (called after research completes) */
export function clearActiveCompetitiveMatrix(): void {
  _currentMatrix = null;
}
