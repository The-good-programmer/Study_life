import { describe, it, expect } from 'vitest';
import { evaluateTextAnswer } from './examEvaluator';

describe('evaluateTextAnswer (ExamSimulator)', () => {
  it('accepts exact matches regardless of casing', () => {
    expect(evaluateTextAnswer('Aortic Arch', 'aortic arch')).toBe(true);
    expect(evaluateTextAnswer('superior vena cava', 'Superior Vena Cava')).toBe(true);
  });

  it('normalizes punctuation and leading articles', () => {
    expect(evaluateTextAnswer('The aortic arch.', 'Aortic Arch')).toBe(true);
    expect(evaluateTextAnswer('  a superior vena cava!  ', 'Superior Vena Cava')).toBe(true);
    expect(evaluateTextAnswer('LTP,', 'LTP')).toBe(true);
  });

  it('rejects permissive short substring gaming', () => {
    // These previously passed due to cleanTarget.includes(cleanUserAns)
    expect(evaluateTextAnswer('arch', 'Aortic Arch')).toBe(false);
    expect(evaluateTextAnswer('cava', 'Superior Vena Cava')).toBe(false);
    expect(evaluateTextAnswer('vena', 'Superior Vena Cava')).toBe(false);
    expect(evaluateTextAnswer('term', 'Long-Term Potentiation (LTP)')).toBe(false);
    expect(evaluateTextAnswer('phase', 'Phase 2 Plateau')).toBe(false);
  });

  it('extracts and validates alias variants in parentheses and slashes', () => {
    expect(evaluateTextAnswer('LTP', 'Long-Term Potentiation (LTP)')).toBe(true);
    expect(evaluateTextAnswer('Long-Term Potentiation', 'Long-Term Potentiation (LTP)')).toBe(true);
    expect(evaluateTextAnswer('Epinephrine', 'Adrenaline / Epinephrine')).toBe(true);
    expect(evaluateTextAnswer('Adrenaline', 'Adrenaline / Epinephrine')).toBe(true);
  });

  it('accepts full explanatory sentences containing the complete target keyphrase', () => {
    expect(evaluateTextAnswer('Blood enters the heart via the superior vena cava from the upper body', 'Superior Vena Cava')).toBe(true);
    expect(evaluateTextAnswer('The structure responsible is the aortic arch', 'Aortic Arch')).toBe(true);
  });

  it('supports single character typo tolerance on long medical terms', () => {
    expect(evaluateTextAnswer('verapimil', 'Verapamil')).toBe(true);
    expect(evaluateTextAnswer('flecainid', 'Flecainide')).toBe(true);
    // Reject excessive errors
    expect(evaluateTextAnswer('vera', 'Verapamil')).toBe(false);
  });

  it('requires high token overlap for multi-word conceptual explanations', () => {
    const target = 'Mitral valve closure marks onset of isovolumetric contraction';
    // User provides substantial recall
    expect(evaluateTextAnswer('Mitral valve closure marks isovolumetric contraction', target)).toBe(true);
    // Insufficient partial recall is rejected
    expect(evaluateTextAnswer('mitral valve', target)).toBe(false);
    expect(evaluateTextAnswer('isovolumetric contraction', target)).toBe(false);
  });
});
