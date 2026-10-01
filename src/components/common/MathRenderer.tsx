import React from 'react';

interface MathRendererProps {
  text: string;
  className?: string;
}

/**
 * Lightweight, zero-dependency STEM mathematical and chemical formula renderer
 * Formats inline LaTeX ($...$), block math ($$...$$), superscripts, subscripts, Greek symbols, and chemical arrows
 */
export const MathRenderer: React.FC<MathRendererProps> = ({ text, className = '' }) => {
  if (!text) return null;

  // Split by inline math ($...$) or block math ($$...$$)
  const renderFormattedText = (raw: string) => {
    // Replace standard math symbols and Greek letters
    const formatted = raw
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
      .replace(/->/g, '→')
      .replace(/<=>/g, '⇌')
      .replace(/\\infty/g, '∞');

    // Parse superscripts like x^2 or x^{10}
    const withSup = formatted.replace(/\^\{([^}]+)\}|\^([0-9a-zA-Z+-]+)/g, (_, group1, group2) => {
      return `<sup>${group1 || group2}</sup>`;
    });

    // Parse subscripts like H_2O or x_{i}
    const withSub = withSup.replace(/_\{([^}]+)\}|_([0-9a-zA-Z+-]+)/g, (_, group1, group2) => {
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

  // If text contains $...$ or $$...$$
  const parts = text.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/g);

  return (
    <span className={`leading-relaxed ${className}`}>
      {parts.map((part, idx) => {
        if (part.startsWith('$$') && part.endsWith('$$')) {
          const formula = part.slice(2, -2).trim();
          return (
            <span
              key={idx}
              className="block my-2 text-center font-serif text-indigo-300 font-medium py-1.5 px-3 bg-slate-950/60 rounded-xl border border-indigo-950/50"
              dangerouslySetInnerHTML={{ __html: renderFormattedText(formula) }}
            />
          );
        } else if (part.startsWith('$') && part.endsWith('$')) {
          const formula = part.slice(1, -1).trim();
          return (
            <span
              key={idx}
              className="font-serif text-indigo-300 font-medium mx-0.5 italic"
              dangerouslySetInnerHTML={{ __html: renderFormattedText(formula) }}
            />
          );
        } else {
          return (
            <span
              key={idx}
              dangerouslySetInnerHTML={{ __html: renderFormattedText(part) }}
            />
          );
        }
      })}
    </span>
  );
};
