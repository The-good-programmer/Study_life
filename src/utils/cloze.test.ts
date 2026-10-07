import { describe, it, expect } from 'vitest';
import { fillCloze, hasCloze, maskCloze } from './cloze';

const sentence = 'Inward current through {{L-type Ca2+}} channels is balanced by {{delayed rectifier K+}} currents.';

describe('cloze helpers', () => {
  it('detects blanks', () => {
    expect(hasCloze(sentence)).toBe(true);
    expect(hasCloze('No blanks here')).toBe(false);
    expect(hasCloze('Only {one} brace')).toBe(false);
  });

  it('hides every blank, so the answer is not shown', () => {
    const masked = maskCloze(sentence);
    expect(masked).toBe('Inward current through _____ channels is balanced by _____ currents.');
    expect(masked).not.toContain('L-type');
    expect(masked).not.toContain('{{');
  });

  it('accepts a custom placeholder', () => {
    expect(maskCloze('A {{b}} c', '[?]')).toBe('A [?] c');
  });

  it('fills blanks back into a normal sentence', () => {
    expect(fillCloze(sentence)).toBe('Inward current through L-type Ca2+ channels is balanced by delayed rectifier K+ currents.');
  });

  it('leaves text without blanks unchanged', () => {
    expect(maskCloze('Plain question?')).toBe('Plain question?');
    expect(fillCloze('Plain question?')).toBe('Plain question?');
  });
});
