import { describe, expect, it } from 'vitest';
import { quotePatterns } from './quotePatterns';

const matches = (snippet: string, text: string) => quotePatterns(snippet).filter(p => new RegExp(p, 'iu').test(text));

describe('quotePatterns', () => {
  const page =
    'Crucially, Cas9 will only bind and cleave double-stranded DNA if the target sequence is immediately adjacent\nto a Protospacer Adjacent Motif (PAM). For SpCas9, the PAM sequence is NGG.';

  it('finds a quote across PDF line breaks, whatever the punctuation around its words', () => {
    expect(matches('“Cas9 will only bind and cleave double-stranded DNA.”', page)).toHaveLength(1);
    expect(matches('immediately adjacent to a Protospacer Adjacent Motif PAM', page)).toHaveLength(1);
  });

  it('matches each part of a quote shortened with an ellipsis', () => {
    const snippet = 'Cas9 will only bind... adjacent to a Protospacer Adjacent Motif (PAM)… NGG';
    expect(quotePatterns(snippet)).toHaveLength(2);
    expect(matches(snippet, page)).toHaveLength(2);
  });

  it('keeps letters from any language, and finds nothing that is not there', () => {
    expect(matches('Hücre zarı çift katmanlıdır', 'Hücre zarı, çift katmanlıdır.')).toHaveLength(1);
    expect(matches('Cas9 cuts single strands only', page)).toHaveLength(0);
  });

  it('skips parts too short to point at anything, and escapes regex characters', () => {
    expect(quotePatterns('the PAM')).toEqual([]);
    expect(() => new RegExp(quotePatterns('a (b) [c] d+e?')[0], 'iu')).not.toThrow();
  });
});
