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
  const escaped = escapeHtml(raw);

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

  // Parse superscripts like x^2 or x^{10}
  const withSup = formatted.replace(/\^\{([^}]+)\}|\^([0-9a-zA-Z+-])/g, (_, group1, group2) => {
    return `<sup>${group1 || group2}</sup>`;
  });

  // Parse subscripts like H_2O or x_{i}
  const withSub = withSup.replace(/_\{([^}]+)\}|_([0-9a-zA-Z+-])/g, (_, group1, group2) => {
    return `<sub>${group1 || group2}</sub>`;
  });

  // Parse fractions \frac{a}{b}
  const withFractions = withSub.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, (_, num, den) => {
    return `<span class="inline-flex flex-col text-center align-middle mx-1 text-[0.85em] leading-none"><span class="border-b border-current pb-0.5">${num}</span><span class="pt-0.5">${den}</span></span>`;
  });

  // Parse inline code `code`
  const withCode = withFractions.replace(/`([^`]+)`/g, (_, code) => {
    return `<code class="px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300 font-mono text-[0.9em] border border-slate-700/60">${code}</code>`;
  });

  return withCode;
};
