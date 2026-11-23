/**
 * Lightweight STEM mathematical and chemical formula formatter
 * Formats inline LaTeX, superscripts, subscripts, Greek symbols, and chemical arrows
 */

// Escape HTML characters to prevent XSS while allowing safe formula markup
export const escapeHtml = (str: string): string => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

// Split by inline math ($...$) or block math ($$...$$)
export const renderFormattedText = (raw: string): string => {
  // 1. First escape raw HTML to prevent XSS injection
  // (U+E000, a private-use character, marks the kept URLs and code below, so it is removed from card text.)
  const escaped = escapeHtml(raw.replace(/\uE000/g, ''));

  // 2. Replace standard math symbols, Greek letters, and arrows (supporting escaped arrows)
  const formatted = escaped
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\gamma/g, 'γ')
    .replace(/\\Delta/g, 'Δ')
    .replace(/\\delta/g, 'δ')
    .replace(/\\theta/g, 'θ')
    .replace(/\\lambda/g, 'λ')
    .replace(/\\mu/g, 'μ')
    .replace(/\\pi/g, 'π')
    .replace(/\\sigma/g, 'σ')
    .replace(/\\omega/g, 'ω')
    .replace(/\\times/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/\\pm/g, '±')
    .replace(/\\le/g, '≤')
    .replace(/\\ge/g, '≥')
    .replace(/\\approx/g, '≈')
    .replace(/\\neq/g, '≠')
    .replace(/\\rightarrow/g, '→')
    .replace(/-&gt;/g, '→')
    .replace(/&lt;=&gt;/g, '⇌')
    .replace(/\\infty/g, '∞');

  // Keep URLs and `code` out of the formatting below: their underscores and carets are literal.
  const kept: string[] = [];
  const keep = (text: string) => `\uE000${kept.push(text) - 1}\uE000`;
  const guarded = formatted.replace(/`[^`]+`|https?:\/\/[^\s<>"]+/g, keep);

  // Parse superscripts like x^2, x^{10} or e^x. A single letter counts only at the end of a word,
  // so names like snake_case or user_id stay as written.
  const withSup = guarded.replace(/\^\{([^}]+)\}|\^([0-9+-]|[a-zA-Z](?![a-zA-Z]))/g, (_, group1, group2) => {
    return `<sup>${group1 || group2}</sup>`;
  });

  // Parse subscripts like H_2O, x_{i} or x_i (same single-letter rule)
  const withSub = withSup
    .replace(/_\{([^}]+)\}|_([0-9+-]|[a-zA-Z](?![a-zA-Z]))/g, (_, group1, group2) => {
      return `<sub>${group1 || group2}</sub>`;
    })
    .replace(/\uE000(\d+)\uE000/g, (_, i) => kept[Number(i)]);

  // Parse fractions \frac{a}{b}
  const withFractions = withSub.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, (_, num, den) => {
    return `<span class="inline-flex flex-col text-center align-middle mx-1 text-[0.85em] leading-none"><span class="border-b border-current pb-0.5">${num}</span><span class="pt-0.5">${den}</span></span>`;
  });

  // Parse inline code `code`
  const withCode = withFractions.replace(/`([^`]+)`/g, (_, code) => {
    return `<code class="px-1.5 py-0.5 rounded border border-line bg-surface-hover font-mono text-[0.9em] text-ink">${code}</code>`;
  });

  return withCode;
};
