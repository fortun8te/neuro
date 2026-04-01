/**
 * Research Progress Tracker
 * Tracks autonomous research loop iterations and generates progress visualization
 */

export interface ResearchIteration {
  iterationNum: number;
  timestamp: number;
  approach: string;
  score: number;
  metrics: {
    confidence: number;
    speed: number;
    efficiency: number;
    quality: string;
  };
  evaluation: {
    passedCriteria: string[];
    failedCriteria: string[];
    gaps: string[];
  };
  kept: boolean;
  reason?: string;
}

export interface ResearchProgress {
  taskObjective: string;
  startTime: number;
  iterations: ResearchIteration[];
  bestScore: number;
  bestIteration: number;
  totalIterations: number;
  keptIterations: number;
  discardedIterations: number;
  elapsedSeconds: number;
}

export class ResearchProgressTracker {
  private progress: ResearchProgress;

  constructor(objective: string) {
    this.progress = {
      taskObjective: objective,
      startTime: Date.now(),
      iterations: [],
      bestScore: 0,
      bestIteration: 0,
      totalIterations: 0,
      keptIterations: 0,
      discardedIterations: 0,
      elapsedSeconds: 0,
    };
  }

  addIteration(
    approach: string,
    score: number,
    metrics: ResearchIteration['metrics'],
    evaluation: ResearchIteration['evaluation'],
    kept: boolean,
    reason?: string
  ): void {
    const iteration: ResearchIteration = {
      iterationNum: this.progress.totalIterations + 1,
      timestamp: Date.now(),
      approach,
      score,
      metrics,
      evaluation,
      kept,
      reason,
    };

    this.progress.iterations.push(iteration);
    this.progress.totalIterations += 1;

    if (kept) {
      this.progress.keptIterations += 1;
      if (score > this.progress.bestScore) {
        this.progress.bestScore = score;
        this.progress.bestIteration = iteration.iterationNum;
      }
    } else {
      this.progress.discardedIterations += 1;
    }

    this.progress.elapsedSeconds = Math.round(
      (Date.now() - this.progress.startTime) / 1000
    );
  }

  getProgress(): ResearchProgress {
    return this.progress;
  }

  /**
   * Generate ASCII chart (for CLI output)
   */
  generateASCIIChart(): string {
    if (this.progress.iterations.length === 0) {
      return 'No iterations yet';
    }

    const width = 80;
    const height = 20;
    const iterations = this.progress.iterations;
    const maxScore = Math.max(...iterations.map((i) => i.score), 100);

    // Create grid
    const grid: string[][] = Array(height)
      .fill(null)
      .map(() => Array(width).fill(' '));

    // Scale iterations to width
    const xScale = (width - 10) / Math.max(iterations.length - 1, 1);
    const yScale = (height - 3) / maxScore;

    // Plot points and lines
    let prevX = -1;
    let prevY = -1;

    iterations.forEach((iter) => {
      const x = Math.round(10 + (iter.iterationNum - 1) * xScale);
      const y = Math.round(height - 2 - iter.score * yScale);

      // Draw connecting line
      if (prevX !== -1 && prevY !== -1) {
        drawLine(grid, prevX, prevY, x, y, iter.kept ? '─' : '·');
      }

      // Draw point
      const symbol = iter.kept ? '●' : '○';
      if (y >= 0 && y < height && x >= 0 && x < width) {
        grid[y][x] = symbol;
      }

      prevX = x;
      prevY = y;
    });

    // Add axes
    for (let i = 0; i < width; i++) {
      grid[height - 1][i] = '─';
    }
    for (let i = 0; i < height; i++) {
      grid[i][0] = '│';
    }
    grid[height - 1][0] = '└';

    // Add labels
    const yLabel = `Quality Score`;
    const xLabel = `Iteration #`;

    let result = '\n';
    grid.forEach((row) => {
      result += row.join('') + '\n';
    });

    result += `${xLabel}\n`;
    result += `● = Kept  ○ = Discarded\n`;

    return result;
  }

  /**
   * Generate detailed report
   */
  generateReport(): string {
    const p = this.progress;
    const avgScore =
      this.progress.iterations.length > 0
        ? Math.round(
            this.progress.iterations.reduce((sum, i) => sum + i.score, 0) /
              this.progress.iterations.length
          )
        : 0;

    let report = `
╔═══════════════════════════════════════════════════════════════════╗
║          AUTONOMOUS RESEARCH PROGRESS REPORT                      ║
╚═══════════════════════════════════════════════════════════════════╝

Objective: ${p.taskObjective}

STATISTICS
──────────
Total Iterations:     ${p.totalIterations}
Kept Improvements:    ${p.keptIterations} (${Math.round((p.keptIterations / p.totalIterations) * 100)}%)
Discarded Attempts:   ${p.discardedIterations} (${Math.round((p.discardedIterations / p.totalIterations) * 100)}%)
Best Score:           ${p.bestScore}/100 (Iteration #${p.bestIteration})
Average Score:        ${avgScore}/100
Elapsed Time:         ${p.elapsedSeconds}s

ITERATION DETAILS
─────────────────
`;

    this.progress.iterations.forEach((iter) => {
      report += `
[${iter.kept ? '✓ KEPT' : '✗ DISC'}] Iteration #${iter.iterationNum} — Score: ${iter.score}/100
  Approach: ${iter.approach.substring(0, 60)}${iter.approach.length > 60 ? '...' : ''}
  Passed: ${iter.evaluation.passedCriteria.join(', ') || 'None'}
  Failed: ${iter.evaluation.failedCriteria.join(', ') || 'None'}
  Gaps: ${iter.evaluation.gaps.join(', ') || 'None'}
  ${iter.reason ? `Reason: ${iter.reason}` : ''}
`;
    });

    report += `
IMPROVEMENTS OVER TIME
──────────────────────
`;

    let prevScore = 0;
    this.progress.iterations.forEach((iter) => {
      if (iter.kept) {
        const improvement = iter.score - prevScore;
        const arrow = improvement > 0 ? '↑' : '→';
        report += `  ${arrow} Iteration #${iter.iterationNum}: ${prevScore} → ${iter.score} (+${improvement})\n`;
        prevScore = iter.score;
      }
    });

    return report;
  }

  /**
   * Export as JSON for external visualization
   */
  exportJSON(): string {
    return JSON.stringify(this.progress, null, 2);
  }

  /**
   * Generate CSV for spreadsheet import
   */
  exportCSV(): string {
    let csv =
      'Iteration,Timestamp,Score,Kept,Approach,Passed Criteria,Failed Criteria,Gaps\n';

    this.progress.iterations.forEach((iter) => {
      const row = [
        iter.iterationNum,
        new Date(iter.timestamp).toISOString(),
        iter.score,
        iter.kept ? 'Yes' : 'No',
        `"${iter.approach}"`,
        `"${iter.evaluation.passedCriteria.join('; ')}"`,
        `"${iter.evaluation.failedCriteria.join('; ')}"`,
        `"${iter.evaluation.gaps.join('; ')}"`,
      ];
      csv += row.join(',') + '\n';
    });

    return csv;
  }
}

/**
 * Helper: Bresenham line drawing for ASCII
 */
function drawLine(
  grid: string[][],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  symbol: string
): void {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  let x = x0;
  let y = y0;

  while (true) {
    if (x >= 0 && x < grid[0].length && y >= 0 && y < grid.length) {
      if (grid[y][x] === ' ') {
        grid[y][x] = symbol;
      }
    }

    if (x === x1 && y === y1) break;

    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}
