import React from 'react';
import { renderFormattedText } from '../../utils/mathFormatter';

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
              className="my-2 block rounded-xl border border-line bg-canvas px-3 py-1.5 text-center font-serif font-medium text-ink"
              dangerouslySetInnerHTML={{ __html: renderFormattedText(formula) }}
            />
          );
        } else if (part.startsWith('$') && part.endsWith('$')) {
          const formula = part.slice(1, -1).trim();
          return (
            <span
              key={idx}
              className="mx-0.5 font-serif font-medium italic text-brand-text"
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
