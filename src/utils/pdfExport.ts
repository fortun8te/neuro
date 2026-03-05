/**
 * PDF Export for NOMAD research findings
 * Uses jspdf + jspdf-autotable for tables, dynamic-imported to keep initial bundle lean
 */
import type { Campaign, Cycle, DeepDesire, Objection } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────
function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function wrap(doc: any, text: string, x: number, y: number, maxWidth: number): number {
  const lines: string[] = doc.splitTextToSize(text || '—', maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * doc.getLineHeight() * 0.35;
}

function sectionTitle(doc: any, title: string, y: number, pageWidth: number): number {
  if (y > 260) { doc.addPage(); y = 20; }
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 30);
  doc.text(title.toUpperCase(), 14, y);
  doc.setDrawColor(180, 180, 180);
  doc.line(14, y + 2, pageWidth - 14, y + 2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(50, 50, 50);
  return y + 10;
}

function checkPage(doc: any, y: number, needed: number = 30): number {
  if (y + needed > 275) { doc.addPage(); return 20; }
  return y;
}

// ─── Main Export ──────────────────────────────────────────────────────
export async function exportResearchPDF(campaign: Campaign, cycle: Cycle): Promise<void> {
  // Dynamic imports to avoid bloating initial bundle
  const { default: jsPDF } = await import('jspdf');
  await import('jspdf-autotable');

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - 28;
  let y = 20;

  // ── 1. HEADER ──────────────────────────────────────────────────────
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 20, 20);
  doc.text('NOMAD', 14, y);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text('Research Intelligence Report', 50, y);
  y += 4;
  doc.setDrawColor(30, 30, 30);
  doc.setLineWidth(0.5);
  doc.line(14, y, pageWidth - 14, y);
  y += 10;

  // Campaign + date info
  doc.setFontSize(10);
  doc.setTextColor(50, 50, 50);
  doc.setFont('helvetica', 'bold');
  doc.text(`Brand: ${campaign.brand}`, 14, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`Cycle ${cycle.cycleNumber}  |  ${formatDate(cycle.startedAt)}`, pageWidth - 14, y, { align: 'right' });
  y += 12;

  // ── 2. CAMPAIGN BRIEF ─────────────────────────────────────────────
  y = sectionTitle(doc, 'Campaign Brief', y, pageWidth);

  const briefRows = [
    ['Brand', campaign.brand],
    ['Target Audience', campaign.targetAudience],
    ['Marketing Goal', campaign.marketingGoal],
    ['Product', campaign.productDescription],
    ['Features', campaign.productFeatures.join(', ')],
    ['Price', campaign.productPrice || 'Not specified'],
    ['Research Mode', campaign.researchMode],
    ['Max Iterations', String(campaign.maxResearchIterations)],
    ['Time Limit', `${campaign.maxResearchTimeMinutes} minutes`],
  ];

  (doc as any).autoTable({
    startY: y,
    head: [],
    body: briefRows,
    theme: 'plain',
    styles: { fontSize: 8, cellPadding: 2, textColor: [50, 50, 50] },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 40, textColor: [80, 80, 80] },
      1: { cellWidth: contentWidth - 40 },
    },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // ── 3. RESEARCH FINDINGS ──────────────────────────────────────────
  const findings = cycle.researchFindings;

  if (findings) {
    // ─── Deep Desires ───────────────────────────────────────────────
    if (findings.deepDesires && findings.deepDesires.length > 0) {
      y = checkPage(doc, y, 40);
      y = sectionTitle(doc, 'Deep Customer Desires', y, pageWidth);

      const desireRows = findings.deepDesires.map((d: DeepDesire, i: number) => [
        String(i + 1),
        d.targetSegment || '—',
        d.surfaceProblem || '—',
        d.deepestDesire || '—',
        d.desireIntensity || '—',
        d.turningPoint || '—',
      ]);

      (doc as any).autoTable({
        startY: y,
        head: [['#', 'Segment', 'Surface Problem', 'Deepest Desire', 'Intensity', 'Turning Point']],
        body: desireRows,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 2, textColor: [40, 40, 40], lineColor: [200, 200, 200] },
        headStyles: { fillColor: [240, 240, 240], textColor: [30, 30, 30], fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 8 },
          1: { cellWidth: 25 },
          4: { cellWidth: 18 },
        },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    // ─── Root Cause Mechanism ────────────────────────────────────────
    if (findings.rootCauseMechanism) {
      y = checkPage(doc, y, 40);
      y = sectionTitle(doc, 'Root Cause Mechanism', y, pageWidth);
      const rc = findings.rootCauseMechanism;

      const rcRows = [
        ['Root Cause', rc.rootCause || '—'],
        ['Mechanism', rc.mechanism || '—'],
        ['AHA Insight', rc.ahaInsight || '—'],
        ['Chain of Yes', (rc.chainOfYes || []).join(' → ') || '—'],
      ];

      (doc as any).autoTable({
        startY: y,
        head: [],
        body: rcRows,
        theme: 'plain',
        styles: { fontSize: 8, cellPadding: 2.5, textColor: [50, 50, 50] },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 35, textColor: [80, 80, 80] },
          1: { cellWidth: contentWidth - 35 },
        },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    // ─── Objections ──────────────────────────────────────────────────
    if (findings.objections && findings.objections.length > 0) {
      y = checkPage(doc, y, 40);
      y = sectionTitle(doc, 'Purchase Objections', y, pageWidth);

      const objRows = findings.objections.map((o: Objection, i: number) => [
        String(i + 1),
        o.objection || '—',
        o.frequency || '—',
        o.impact || '—',
        o.handlingApproach || '—',
        (o.requiredProof || []).join(', ') || '—',
      ]);

      (doc as any).autoTable({
        startY: y,
        head: [['#', 'Objection', 'Freq', 'Impact', 'Handling Approach', 'Proof Needed']],
        body: objRows,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 2, textColor: [40, 40, 40], lineColor: [200, 200, 200] },
        headStyles: { fillColor: [240, 240, 240], textColor: [30, 30, 30], fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 8 },
          2: { cellWidth: 16 },
          3: { cellWidth: 14 },
        },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    // ─── Avatar Persona ──────────────────────────────────────────────
    if (findings.persona) {
      y = checkPage(doc, y, 40);
      y = sectionTitle(doc, 'Avatar Persona', y, pageWidth);
      const p = findings.persona;

      const personaRows = [
        ['Name / Age', `${p.name || '—'}, ${p.age || '—'}`],
        ['Identity', p.identity || '—'],
        ['Situation', p.situation || '—'],
        ['Daily Life', p.dailyLife || '—'],
        ['Pain Narrative', p.painNarrative || '—'],
        ['Turning Point', p.turningPointMoment || '—'],
        ['Inner Monologue', p.innerMonologue || '—'],
        ['Purchase Journey', p.purchaseJourney || '—'],
        ['Social Influence', p.socialInfluence || '—'],
        ['Deepest Desire', p.deepDesire || '—'],
        ['Biggest Fear', p.biggestFear || '—'],
        ['Failed Solutions', (p.failedSolutions || []).join('; ') || '—'],
        ['Language Patterns', (p.languagePatterns || []).join('; ') || '—'],
      ];

      (doc as any).autoTable({
        startY: y,
        head: [],
        body: personaRows,
        theme: 'plain',
        styles: { fontSize: 8, cellPadding: 2.5, textColor: [50, 50, 50] },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 35, textColor: [80, 80, 80] },
          1: { cellWidth: contentWidth - 35 },
        },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    // ─── Market Sophistication ───────────────────────────────────────
    if (findings.marketSophistication) {
      y = checkPage(doc, y, 20);
      y = sectionTitle(doc, 'Market Sophistication', y, pageWidth);
      const levels: Record<number, string> = {
        1: 'Level 1 — First to market. Simple, direct claims work.',
        2: 'Level 2 — Competition exists. Need bigger / better claims.',
        3: 'Level 3 — Skeptical market. Need unique mechanism / proof.',
        4: 'Level 4 — Exhausted market. Need new identity / paradigm shift.',
      };
      doc.text(levels[findings.marketSophistication] || `Level ${findings.marketSophistication}`, 14, y);
      y += 10;
    }

    // ─── Verbatim Quotes ─────────────────────────────────────────────
    if (findings.verbatimQuotes && findings.verbatimQuotes.length > 0) {
      y = checkPage(doc, y, 30);
      y = sectionTitle(doc, 'Verbatim Customer Quotes', y, pageWidth);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(70, 70, 70);

      for (const quote of findings.verbatimQuotes.slice(0, 15)) {
        y = checkPage(doc, y, 12);
        const q = `"${quote}"`;
        const lines = doc.splitTextToSize(q, contentWidth - 10);
        doc.text(lines, 20, y);
        y += lines.length * 3.5 + 3;
      }

      doc.setFont('helvetica', 'normal');
      y += 5;
    }

    // ─── Avatar Language ─────────────────────────────────────────────
    if (findings.avatarLanguage && findings.avatarLanguage.length > 0) {
      y = checkPage(doc, y, 20);
      y = sectionTitle(doc, 'Avatar Language / Phrases', y, pageWidth);
      doc.setFontSize(8);
      const langText = findings.avatarLanguage.slice(0, 20).map(l => `• ${l}`).join('\n');
      y = wrap(doc, langText, 16, y, contentWidth - 4);
      y += 8;
    }

    // ─── Competitor Weaknesses ────────────────────────────────────────
    if (findings.competitorWeaknesses && findings.competitorWeaknesses.length > 0) {
      y = checkPage(doc, y, 20);
      y = sectionTitle(doc, 'Competitor Weaknesses', y, pageWidth);
      doc.setFontSize(8);
      const compText = findings.competitorWeaknesses.slice(0, 15).map(c => `• ${c}`).join('\n');
      y = wrap(doc, compText, 16, y, contentWidth - 4);
      y += 8;
    }

    // ─── Visual Findings ─────────────────────────────────────────────
    if (findings.visualFindings) {
      y = checkPage(doc, y, 40);
      y = sectionTitle(doc, 'Visual Intelligence', y, pageWidth);
      const vf = findings.visualFindings;

      doc.setFontSize(8);
      doc.text(`Screenshots analyzed: ${vf.totalAnalyzed} / ${vf.totalScreenshots}  |  Model: ${vf.analysisModel}`, 14, y);
      y += 6;

      if (vf.commonPatterns && vf.commonPatterns.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.text('Common Visual Patterns:', 14, y);
        doc.setFont('helvetica', 'normal');
        y += 4;
        const pText = vf.commonPatterns.map(p => `• ${p}`).join('\n');
        y = wrap(doc, pText, 16, y, contentWidth - 4);
        y += 4;
      }

      if (vf.visualGaps && vf.visualGaps.length > 0) {
        y = checkPage(doc, y, 15);
        doc.setFont('helvetica', 'bold');
        doc.text('Visual Gaps (Opportunities):', 14, y);
        doc.setFont('helvetica', 'normal');
        y += 4;
        const gText = vf.visualGaps.map(g => `• ${g}`).join('\n');
        y = wrap(doc, gText, 16, y, contentWidth - 4);
        y += 4;
      }

      if (vf.recommendedDifferentiation && vf.recommendedDifferentiation.length > 0) {
        y = checkPage(doc, y, 15);
        doc.setFont('helvetica', 'bold');
        doc.text('Recommended Differentiation:', 14, y);
        doc.setFont('helvetica', 'normal');
        y += 4;
        const dText = vf.recommendedDifferentiation.map(d => `• ${d}`).join('\n');
        y = wrap(doc, dText, 16, y, contentWidth - 4);
        y += 8;
      }
    }

    // ─── Competitor Ad Intelligence ───────────────────────────────────
    if (findings.competitorAds && findings.competitorAds.competitors.length > 0) {
      const ca = findings.competitorAds;
      y = checkPage(doc, y, 40);
      y = sectionTitle(doc, 'Competitor Ad Intelligence', y, pageWidth);

      doc.setFontSize(8);
      doc.setTextColor(70, 70, 70);
      const totalAds = ca.competitors.reduce((s, c) => s + c.adExamples.length, 0);
      doc.text(`${totalAds} ad examples across ${ca.competitors.length} competitors | ${ca.visionAnalyzed} vision-analyzed`, 14, y);
      y += 7;

      // Per-competitor overview table
      const compRows = ca.competitors.map(c => [
        c.brand,
        String(c.adExamples.length),
        c.estimatedActiveAds ? `~${c.estimatedActiveAds}` : '—',
        c.dominantAngles.slice(0, 2).join(', ') || '—',
        (c.positioning || '—').slice(0, 80),
      ]);

      (doc as any).autoTable({
        startY: y,
        head: [['Brand', 'Ads Found', 'Active Ads', 'Dominant Angles', 'Positioning']],
        body: compRows,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 2, textColor: [40, 40, 40], lineColor: [200, 200, 200] },
        headStyles: { fillColor: [240, 240, 240], textColor: [30, 30, 30], fontStyle: 'bold' },
        columnStyles: { 0: { cellWidth: 25 }, 1: { cellWidth: 18 }, 2: { cellWidth: 18 }, 3: { cellWidth: 35 } },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 6;

      // Ad examples table (all competitors combined, truncated)
      const adRows = ca.competitors.flatMap(c =>
        c.adExamples.slice(0, 4).map(a => [
          c.brand,
          (a.adCopy || '').slice(0, 60) + ((a.adCopy || '').length > 60 ? '…' : ''),
          a.hookAngle || '—',
          a.emotionalDriver || '—',
          a.offerStructure || '—',
          a.estimatedLongevity || '—',
        ])
      );

      if (adRows.length > 0) {
        y = checkPage(doc, y, 30);
        (doc as any).autoTable({
          startY: y,
          head: [['Brand', 'Ad Copy (preview)', 'Hook', 'Emotion', 'Offer', 'Longevity']],
          body: adRows,
          theme: 'grid',
          styles: { fontSize: 6.5, cellPadding: 1.5, textColor: [40, 40, 40], lineColor: [200, 200, 200] },
          headStyles: { fillColor: [245, 245, 245], textColor: [30, 30, 30], fontStyle: 'bold' },
          columnStyles: { 0: { cellWidth: 20 }, 2: { cellWidth: 25 }, 3: { cellWidth: 25 }, 4: { cellWidth: 22 } },
          margin: { left: 14, right: 14 },
        });
        y = (doc as any).lastAutoTable.finalY + 6;
      }

      // Industry patterns
      const ip = ca.industryPatterns;
      y = checkPage(doc, y, 30);

      if (ip.unusedAngles.length > 0) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 100, 30);
        doc.text('CREATIVE OPPORTUNITIES (unused angles):', 14, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(50, 50, 50);
        y += 5;
        const oppText = ip.unusedAngles.map(a => `• ${a}`).join('\n');
        y = wrap(doc, oppText, 16, y, contentWidth - 4);
        y += 4;
      }

      if (ip.dominantHooks.length > 0) {
        y = checkPage(doc, y, 15);
        doc.setFont('helvetica', 'bold');
        doc.text('Saturated hooks (everyone uses these):', 14, y);
        doc.setFont('helvetica', 'normal');
        y += 4;
        y = wrap(doc, ip.dominantHooks.map(h => `• ${h}`).join('\n'), 16, y, contentWidth - 4);
        y += 8;
      }
    }
  }

  // ── 4. STAGE OUTPUTS ──────────────────────────────────────────────
  const stageNames: Array<{ key: string; label: string }> = [
    { key: 'objections', label: 'Objections' },
    { key: 'taste', label: 'Taste / Creative Direction' },
    { key: 'make', label: 'Make / Ad Concepts' },
    { key: 'test', label: 'Test / Evaluation' },
    { key: 'memories', label: 'Memories / Learnings' },
  ];

  for (const { key, label } of stageNames) {
    const stage = cycle.stages[key as keyof typeof cycle.stages];
    if (!stage || !stage.agentOutput || stage.status === 'pending') continue;

    y = checkPage(doc, y, 30);
    y = sectionTitle(doc, `Stage: ${label}`, y, pageWidth);

    doc.setFontSize(8);

    // Stage metadata
    if (stage.model) {
      doc.setTextColor(120, 120, 120);
      let meta = `Model: ${stage.model}`;
      if (stage.processingTime) meta += `  |  Time: ${Math.round(stage.processingTime / 1000)}s`;
      doc.text(meta, 14, y);
      y += 5;
    }

    doc.setTextColor(50, 50, 50);

    // Clean output text — strip streaming artifacts, limit length
    let outputText = stage.agentOutput || '';
    // Remove orchestrator thinking sections
    outputText = outputText.replace(/\[Orchestrator thinking\][^\n]*/g, '');
    outputText = outputText.replace(/\[Thinking\][^\n]*/g, '');
    // Remove METRICS lines
    outputText = outputText.replace(/\[METRICS\][^\n]*/g, '');
    // Collapse multiple blank lines
    outputText = outputText.replace(/\n{3,}/g, '\n\n');
    outputText = outputText.trim();

    // Truncate very long stage outputs
    if (outputText.length > 8000) {
      outputText = outputText.slice(0, 8000) + '\n\n[... truncated for PDF — see full output in NOMAD UI]';
    }

    const lines = doc.splitTextToSize(outputText, contentWidth);
    for (let i = 0; i < lines.length; i++) {
      y = checkPage(doc, y, 5);
      doc.text(lines[i], 14, y);
      y += 3.2;
    }

    y += 8;
  }

  // ── 5. FOOTER — Page Numbers ───────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 160);
    doc.text(
      `NOMAD Research Report — ${campaign.brand} — Page ${i}/${totalPages}`,
      pageWidth / 2,
      290,
      { align: 'center' }
    );
  }

  // ── 6. SAVE ────────────────────────────────────────────────────────
  const filename = `NOMAD_${campaign.brand.replace(/\s+/g, '_')}_Cycle${cycle.cycleNumber}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
