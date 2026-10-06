import type { StudySession } from '../types';

export class ExportService {
  private static escapeHtml(str: string | undefined | null): string {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Generates a beautifully typeset, printable HTML study sheet
   * with executive mental models, Cornell nomenclature glossary, and retrieval ledgers.
   */
  public static generatePrintableHTML(session: StudySession): string {
    const totalCards = session.concepts.reduce((acc, c) => acc + c.retrievalCards.length, 0);
    const dateStr = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const esc = this.escapeHtml;

    const conceptsHTML = session.concepts.map((concept, idx) => `
      <section class="concept-section">
        <div class="concept-header">
          <span class="concept-badge">Checkpoint ${idx + 1}</span>
          <h2 class="concept-title">${esc(concept.title)}</h2>
          <span class="concept-time">⏱ ${concept.estimatedMinutes} min</span>
        </div>

        <div class="mental-model-box">
          <div class="box-label">🧠 Intuitive Mental Model & Blueprint</div>
          <p>${esc(concept.mentalModel)}</p>
        </div>

        <div class="two-col-grid">
          <div class="col">
            <h3 class="section-subtitle">🎯 Core Takeaways & Mechanisms</h3>
            <ul class="takeaways-list">
              ${concept.coreTakeaways.map(t => `<li>${esc(t)}</li>`).join('')}
            </ul>
          </div>

          <div class="col">
            <h3 class="section-subtitle">📖 Key Nomenclature Glossary</h3>
            <table class="terms-table">
              <thead>
                <tr>
                  <th style="width: 38%;">Term</th>
                  <th>Definition & Function</th>
                </tr>
              </thead>
              <tbody>
                ${concept.keyTerms.map(k => `
                  <tr>
                    <td><strong>${esc(k.term)}</strong></td>
                    <td>${esc(k.definition)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="feynman-box">
          <div class="box-label">🗣 Feynman Verbal Challenge</div>
          <p class="feynman-prompt">"${esc(concept.feynmanPrompt)}"</p>
          <div class="feynman-solution">
            <strong>Mastery Benchmark:</strong> ${esc(concept.sampleMasteryExplanation)}
          </div>
        </div>

        <div class="cards-ledger">
          <h3 class="section-subtitle">⚡ Active Retrieval Practice Ledger (Cornell Cue Format)</h3>
          <table class="cards-table">
            <thead>
              <tr>
                <th style="width: 5%;">Self-Test</th>
                <th style="width: 45%;">Retrieval Cue / Question</th>
                <th style="width: 50%;">Target Recall Answer & Cognitive Detail</th>
              </tr>
            </thead>
            <tbody>
              ${concept.retrievalCards.map(rc => `
                <tr>
                  <td style="text-align: center;"><input type="checkbox" /></td>
                  <td>
                    <strong>${esc(rc.question)}</strong>
                    ${rc.hint ? `<div class="card-hint">💡 Hint: ${esc(rc.hint)}</div>` : ''}
                  </td>
                  <td>
                    <div class="card-answer">${esc(rc.answer)}</div>
                    ${rc.explanation ? `<div class="card-explanation">${esc(rc.explanation)}</div>` : ''}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </section>
    `).join('<hr class="page-divider" />');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${session.title} — Studify High-Yield Study Sheet</title>
  <style>
    @page {
      margin: 18mm 16mm;
      size: A4 portrait;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      line-height: 1.55;
      font-size: 13px;
      padding: 24px;
      max-width: 900px;
      margin: 0 auto;
    }
    .sheet-header {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 16px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .brand-tag {
      font-size: 11px;
      text-transform: uppercase;
      font-weight: 800;
      letter-spacing: 0.1em;
      color: #4f46e5;
      margin-bottom: 4px;
    }
    .doc-title {
      font-size: 26px;
      font-weight: 900;
      color: #0f172a;
      line-height: 1.2;
    }
    .meta-details {
      text-align: right;
      font-size: 11px;
      color: #475569;
    }
    .meta-pill {
      display: inline-block;
      padding: 2px 8px;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 9999px;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .overview-strip {
      display: flex;
      gap: 16px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 24px;
      font-size: 12px;
    }
    .overview-item {
      flex: 1;
    }
    .overview-label {
      font-size: 10px;
      text-transform: uppercase;
      font-weight: 700;
      color: #64748b;
    }
    .overview-value {
      font-weight: 700;
      color: #0f172a;
      font-size: 14px;
    }
    .concept-section {
      page-break-inside: avoid;
      margin-bottom: 32px;
    }
    .concept-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
    }
    .concept-badge {
      background: #4f46e5;
      color: #ffffff;
      font-size: 10px;
      font-weight: 800;
      padding: 3px 8px;
      border-radius: 6px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .concept-title {
      font-size: 18px;
      font-weight: 800;
      color: #1e1b4b;
      flex: 1;
    }
    .concept-time {
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
    }
    .mental-model-box {
      background: #f5f3ff;
      border-left: 4px solid #6366f1;
      padding: 12px 14px;
      border-radius: 0 6px 6px 0;
      margin-bottom: 16px;
      font-size: 12.5px;
      color: #312e81;
    }
    .box-label {
      font-weight: 800;
      font-size: 11px;
      text-transform: uppercase;
      margin-bottom: 4px;
      letter-spacing: 0.04em;
    }
    .two-col-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 16px;
    }
    .section-subtitle {
      font-size: 12px;
      text-transform: uppercase;
      font-weight: 800;
      letter-spacing: 0.04em;
      color: #334155;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
      margin-bottom: 8px;
    }
    .takeaways-list {
      padding-left: 18px;
      color: #1e293b;
      font-size: 12px;
    }
    .takeaways-list li {
      margin-bottom: 6px;
    }
    .terms-table, .cards-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11.5px;
    }
    .terms-table th, .terms-table td,
    .cards-table th, .cards-table td {
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
      text-align: left;
      vertical-align: top;
    }
    .terms-table th, .cards-table th {
      background: #f1f5f9;
      font-weight: 700;
      color: #334155;
      font-size: 10.5px;
      text-transform: uppercase;
    }
    .feynman-box {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 6px;
      padding: 10px 14px;
      margin-bottom: 16px;
      font-size: 12px;
    }
    .feynman-box .box-label {
      color: #92400e;
    }
    .feynman-prompt {
      font-style: italic;
      color: #78350f;
      margin-bottom: 6px;
    }
    .feynman-solution {
      color: #451a03;
      border-top: 1px dashed #fcd34d;
      padding-top: 6px;
      font-size: 11.5px;
    }
    .cards-ledger {
      margin-top: 16px;
    }
    .card-hint {
      font-size: 10.5px;
      color: #b45309;
      margin-top: 4px;
    }
    .card-answer {
      font-weight: 600;
      color: #0f172a;
    }
    .card-explanation {
      font-size: 11px;
      color: #475569;
      margin-top: 4px;
    }
    .page-divider {
      border: none;
      border-top: 2px dashed #cbd5e1;
      margin: 32px 0;
      page-break-after: always;
    }
    .sheet-footer {
      border-top: 1px solid #cbd5e1;
      padding-top: 12px;
      margin-top: 36px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10.5px;
      color: #64748b;
    }
    .print-actions {
      position: fixed;
      bottom: 24px;
      right: 24px;
      display: flex;
      gap: 8px;
      z-index: 1000;
    }
    .action-btn {
      background: #4f46e5;
      color: #ffffff;
      border: none;
      padding: 10px 18px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);
      transition: background 0.2s;
    }
    .action-btn:hover {
      background: #4338ca;
    }
    @media print {
      body {
        padding: 0;
        max-width: 100%;
      }
      .print-actions {
        display: none !important;
      }
      .concept-section {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="print-actions">
    <button class="action-btn" onclick="window.print()">🖨 Print / Save as PDF</button>
  </div>

  <header class="sheet-header">
    <div>
      <div class="brand-tag">Studify Cognitive Architecture — High-Yield Review Sheet</div>
      <h1 class="doc-title">${esc(session.title)}</h1>
    </div>
    <div class="meta-details">
      <div class="meta-pill">${esc(session.category)}</div>
      <div>Generated on ${dateStr}</div>
      <div>FSRS Spaced Repetition Certified</div>
    </div>
  </header>

  <div class="overview-strip">
    <div class="overview-item">
      <div class="overview-label">Total Checkpoints</div>
      <div class="overview-value">${session.concepts.length} Concept Nodes</div>
    </div>
    <div class="overview-item">
      <div class="overview-label">Active Retrieval Deck</div>
      <div class="overview-value">${totalCards} Recall Items</div>
    </div>
    <div class="overview-item">
      <div class="overview-label">Methodology</div>
      <div class="overview-value">Dual-Coding + Feynman + FSRS</div>
    </div>
  </div>

  <main>
    ${conceptsHTML}
  </main>

  <footer class="sheet-footer">
    <div>Studify — The Habit-Forming Spaced Recall Platform</div>
    <div>Spaced Schedule: 1d ➔ 3d ➔ 7d ➔ 21d ➔ Permanent Neocortical Transfer</div>
  </footer>
</body>
</html>`;
  }

  /**
   * Opens the printable study sheet directly in a browser print dialog
   */
  public static printStudySheet(session: StudySession): void {
    const html = this.generatePrintableHTML(session);
    const win = window.open('', '_blank');
    if (!win) {
      this.downloadStudySheetHTML(session);
      return;
    }

    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  /**
   * Downloads the standalone HTML study sheet
   */
  public static downloadStudySheetHTML(session: StudySession): void {
    const html = this.generatePrintableHTML(session);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const slug = session.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    this.triggerDownload(blob, `axon-study-sheet-${slug}.html`);
  }

  /**
   * Exports session as comprehensive Markdown formatted for Notion, Obsidian, Logseq
   */
  public static exportToMarkdown(session: StudySession): string {
    const lines: string[] = [];

    // Frontmatter
    lines.push('---');
    lines.push(`title: "${session.title}"`);
    lines.push(`category: "${session.category}"`);
    lines.push(`created: ${new Date().toISOString()}`);
    lines.push('tags: [axon, cognitive-science, active-recall, fsrs]');
    lines.push('---\n');

    lines.push(`# ${session.title}\n`);
    lines.push(`> **Category:** ${session.category} | **Concepts:** ${session.concepts.length} | **Methodology:** Feynman + FSRS Active Retrieval\n`);

    session.concepts.forEach((concept, idx) => {
      lines.push(`## Checkpoint ${idx + 1}: ${concept.title}\n`);
      lines.push(`> [!NOTE] Mental Model Blueprint`);
      lines.push(`> ${concept.mentalModel}\n`);

      lines.push(`### Core Takeaways`);
      concept.coreTakeaways.forEach(t => lines.push(`- ${t}`));
      lines.push('');

      lines.push(`### Key Nomenclature Glossary`);
      lines.push(`| Term | Definition |`);
      lines.push(`| :--- | :--- |`);
      concept.keyTerms.forEach(k => lines.push(`| **${k.term}** | ${k.definition} |`));
      lines.push('');

      lines.push(`### Feynman Explanation Challenge`);
      lines.push(`*Prompt:* "${concept.feynmanPrompt}"\n`);
      lines.push(`*Mastery Explanation:* ${concept.sampleMasteryExplanation}\n`);

      lines.push(`### Active Retrieval Flashcards`);
      concept.retrievalCards.forEach((c, cIdx) => {
        lines.push(`#### Card ${cIdx + 1} (${c.cardType || 'standard'})`);
        lines.push(`**Q:** ${c.question}`);
        if (c.hint) lines.push(`*Hint:* ${c.hint}`);
        lines.push(`**A:** ${c.answer}`);
        if (c.explanation) lines.push(`*Explanation:* ${c.explanation}`);
        lines.push('');
      });

      lines.push('---\n');
    });

    return lines.join('\n');
  }

  /**
   * Downloads session as markdown file
   */
  public static downloadMarkdown(session: StudySession): void {
    const md = this.exportToMarkdown(session);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const slug = session.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    this.triggerDownload(blob, `axon-${slug}.md`);
  }

  /**
   * Exports all flashcards in Anki/Quizlet compatible Tab-Separated Values (TSV) format
   */
  public static exportToAnkiTSV(session: StudySession): string {
    const lines: string[] = [];
    session.concepts.forEach(concept => {
      concept.retrievalCards.forEach(c => {
        const front = c.question.replace(/\t/g, ' ').replace(/\n/g, '<br>');
        let back = c.answer.replace(/\t/g, ' ').replace(/\n/g, '<br>');
        if (c.explanation) {
          back += `<br><br><em>Cognitive Detail:</em> ${c.explanation.replace(/\t/g, ' ').replace(/\n/g, '<br>')}`;
        }
        const hint = (c.hint || '').replace(/\t/g, ' ').replace(/\n/g, '<br>');
        const tags = `axon ${session.category.toLowerCase().replace(/\s+/g, '-')} ${concept.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

        lines.push(`${front}\t${back}\t${hint}\t${tags}`);
      });
    });
    return lines.join('\n');
  }

  /**
   * Downloads Anki TSV file
   */
  public static downloadAnkiTSV(session: StudySession): void {
    const tsv = this.exportToAnkiTSV(session);
    const blob = new Blob([tsv], { type: 'text/tab-separated-values;charset=utf-8' });
    const slug = session.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    this.triggerDownload(blob, `axon-anki-${slug}.tsv`);
  }

  /**
   * High-fidelity JSON export preserving all cognitive checkpoints, key terms, and FSRS card parameters
   */
  public static exportToJSON(session: StudySession): string {
    return JSON.stringify(session, null, 2);
  }

  /**
   * Downloads session as JSON backup file
   */
  public static downloadJSON(session: StudySession): void {
    const json = this.exportToJSON(session);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const slug = session.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    this.triggerDownload(blob, `axon-deck-${slug}.json`);
  }

  private static triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
