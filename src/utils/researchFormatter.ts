// Format research findings for UI display with keywords and insights

export interface ResearchFindings {
  taskName: string;
  keywords: string[];
  keyPoints: string[];
  insights: string[];
}

export function formatResearchProgress(taskName: string, keywords: string[]): string {
  return `
RESEARCHING: ${taskName.toUpperCase()}
Keywords: ${keywords.join(' • ')}
`;
}

export function formatResearchFinding(taskName: string, findings: string): string {
  // Extract keywords from findings (capitalized words, key terms)
  const keywordMatch = findings.match(/KEY FINDINGS:([^]*?)(?=STRATEGIC|$)/);
  const keywords = keywordMatch
    ? keywordMatch[1]
        .split(/[,\n]/)
        .map((k) => k.trim())
        .filter((k) => k && k.length > 2)
        .slice(0, 8) // Limit to 8 keywords
    : [];

  const strategicMatch = findings.match(/STRATEGIC IMPLICATIONS:([^]*?)(?=SPECIFIC|$)/);
  const strategic = strategicMatch ? strategicMatch[1].trim() : '';

  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINDING: ${taskName}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 KEY KEYWORDS:
${keywords.map((k) => `  • ${k}`).join('\n')}

💡 STRATEGIC INSIGHT:
${strategic || findings.substring(0, 200)}
`;
}

export function formatResearchComplete(findings: string): string {
  // Extract top-level insights
  const sections = findings.split('§').filter((s) => s.trim());

  return `
═══════════════════════════════════════════════════
RESEARCH COMPLETE - STRATEGIC FINDINGS
═══════════════════════════════════════════════════

${sections.map((section) => {
  const lines = section.split('\n');
  const title = lines[0].trim();
  const content = lines.slice(1).join('\n');
  return `
📊 ${title.toUpperCase()}
${content.substring(0, 300)}...
`;
}).join('\n')}
`;
}
