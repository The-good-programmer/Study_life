export const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Punctuation at a word's edges; letters and digits in any script are kept. */
const EDGE_PUNCTUATION = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;
/** Any punctuation that may sit around a word in the PDF text. */
const AROUND = '[^\\s\\p{L}\\p{N}]*';

/**
 * Patterns that find an AI-supplied quote in a PDF's text; use them with the "iu" flags.
 * There is one per part between ellipses ("..." or "…"): the part's words in order, with
 * any whitespace between them and any punctuation around them, since PDF text and quotes
 * differ in both. Parts under three words are too common to point at anything.
 */
export const quotePatterns = (snippet: string): string[] =>
  snippet
    .split(/\.\.\.|…/)
    .map(part => part.split(/\s+/).map(word => word.replace(EDGE_PUNCTUATION, '')).filter(Boolean))
    .filter(words => words.length >= 3)
    .map(words => words.map(word => `${AROUND}${escapeRegex(word)}${AROUND}`).join('\\s+'));
