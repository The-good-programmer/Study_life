import { describe, it, expect } from 'vitest';
import type { ConceptCheckpoint, RetrievalCard } from '../../types';
import {
  blendInterleavedCards,
  evaluateBlurting,
  getBlurtingTargets,
  getEffectiveCardType,
  isOptionCorrect,
} from './retrievalLogic';

const card = (id: string, extra: Partial<RetrievalCard> = {}): RetrievalCard => ({
  id,
  conceptId: 'c',
  question: `Question ${id}`,
  answer: `Answer ${id}`,
  stability: 0,
  difficulty: 5,
  reps: 0,
  lapses: 0,
  ...extra,
});

const concept = (id: string, cards: RetrievalCard[], extra: Partial<ConceptCheckpoint> = {}): ConceptCheckpoint => ({
  id,
  order: 0,
  title: `Concept ${id}`,
  estimatedMinutes: 3,
  mentalModel: '',
  coreTakeaways: [],
  keyTerms: [],
  feynmanPrompt: '',
  sampleMasteryExplanation: '',
  retrievalCards: cards,
  ...extra,
});

describe('blendInterleavedCards', () => {
  // Real card ids share a long prefix, which defeated the old first-character hash.
  const c1 = concept('k1', [card('card-1'), card('card-2'), card('card-3')]);
  const c2 = concept('k2', [card('card-4'), card('card-5'), card('card-6')]);
  const c3 = concept('k3', [card('card-7'), card('card-8'), card('card-9'), card('card-10', { id: 'card-10' })]);
  const all = [c1, c2, c3];

  it('leaves the deck alone for the first concept, when disabled, or with no history', () => {
    expect(blendInterleavedCards(c1, all, 0, true).cards).toEqual(c1.retrievalCards);
    expect(blendInterleavedCards(c3, all, 2, false).cards).toEqual(c3.retrievalCards);
    expect(blendInterleavedCards(c3, undefined, 2, true).cards).toEqual(c3.retrievalCards);
    expect(blendInterleavedCards(c3, all, undefined, true).interleaveMap.size).toBe(0);
    const emptyHistory = [concept('e', []), c3];
    expect(blendInterleavedCards(c3, emptyHistory, 1, true).interleaveMap.size).toBe(0);
  });

  it('adds 1-2 earlier cards without losing or duplicating any current card', () => {
    const { cards, interleaveMap } = blendInterleavedCards(c3, all, 2, true);
    expect(interleaveMap.size).toBe(2); // round(4 * 0.4) = 2
    expect(cards).toHaveLength(c3.retrievalCards.length + 2);
    c3.retrievalCards.forEach(own => expect(cards).toContain(own));
    expect(new Set(cards.map(c => c.id)).size).toBe(cards.length);
  });

  it('never opens the deck with an old card', () => {
    expect(blendInterleavedCards(c3, all, 2, true).cards[0]).toBe(c3.retrievalCards[0]);
  });

  it('spreads picks across different earlier concepts', () => {
    const { interleaveMap } = blendInterleavedCards(c3, all, 2, true);
    expect(new Set(interleaveMap.values()).size).toBe(2);
  });

  it('is deterministic', () => {
    const a = blendInterleavedCards(c3, all, 2, true).cards.map(c => c.id);
    const b = blendInterleavedCards(c3, all, 2, true).cards.map(c => c.id);
    expect(a).toEqual(b);
  });

  it('does not always borrow the earliest card (ids sharing a prefix still vary)', () => {
    const picks = new Set<string>();
    for (let i = 0; i < 12; i++) {
      const current = concept(`cur-${i}`, [card(`x-${i}-1`), card(`x-${i}-2`), card(`x-${i}-3`)]);
      blendInterleavedCards(current, [c1, c2, current], 2, true).interleaveMap.forEach((_, id) => picks.add(id));
    }
    expect(picks.size).toBeGreaterThan(2);
  });

  it('fills from the same concept when there are fewer earlier concepts than picks', () => {
    const only = concept('only', [card('o-1'), card('o-2'), card('o-3')]);
    const { interleaveMap } = blendInterleavedCards(c3, [only, c3], 1, true);
    expect(interleaveMap.size).toBe(2);
    expect(new Set(interleaveMap.values())).toEqual(new Set(['Concept only']));
  });
});

describe('isOptionCorrect', () => {
  it('matches exact answers regardless of case and spacing', () => {
    expect(isOptionCorrect('  Mitochondria ', 'mitochondria')).toBe(true);
  });

  it('ignores letter and number choice labels on either side', () => {
    expect(isOptionCorrect('B) Mitochondria', 'Mitochondria')).toBe(true);
    expect(isOptionCorrect('Mitochondria', '2. Mitochondria')).toBe(true);
    expect(isOptionCorrect('c. Golgi body', 'A) Golgi body')).toBe(true);
  });

  it('rejects different answers', () => {
    expect(isOptionCorrect('Ribosome', 'Mitochondria')).toBe(false);
  });
});

describe('getEffectiveCardType', () => {
  it('prefers an explicit type', () => {
    expect(getEffectiveCardType(card('a', { cardType: 'cloze' }))).toBe('cloze');
  });

  it('infers image occlusion only when masks exist', () => {
    const mask = { id: 'm' } as unknown as NonNullable<RetrievalCard['masks']>[number];
    expect(getEffectiveCardType(card('a', { imageUrl: 'x.png', masks: [mask] }))).toBe('image-occlusion');
    expect(getEffectiveCardType(card('a', { imageUrl: 'x.png', masks: [] }))).toBe('standard');
  });

  it('infers cloze from a template or a {{blank}} marker', () => {
    expect(getEffectiveCardType(card('a', { clozeTemplate: 'The {{x}}' }))).toBe('cloze');
    expect(getEffectiveCardType(card('a', { question: 'The {{blank}} is' }))).toBe('cloze');
  });

  it('infers multiple choice from options, else standard', () => {
    expect(getEffectiveCardType(card('a', { options: ['a', 'b'] }))).toBe('multiple-choice');
    expect(getEffectiveCardType(card('a'))).toBe('standard');
    expect(getEffectiveCardType(undefined)).toBe('standard');
  });
});

describe('blurting', () => {
  it('targets key terms first, then takeaways, then card answers', () => {
    const terms = concept('t', [card('a')], { keyTerms: [{ term: 'ATP', definition: '' }], coreTakeaways: ['T1'] });
    expect(getBlurtingTargets(terms)).toEqual(['ATP']);
    expect(getBlurtingTargets(concept('t', [card('a')], { coreTakeaways: ['T1'] }))).toEqual(['T1']);
    expect(getBlurtingTargets(concept('t', [card('a')]))).toEqual(['Answer a']);
  });

  it('splits recalled and missed targets case-insensitively', () => {
    const result = evaluateBlurting('The ATP is made by the mitochondria', ['atp', 'Mitochondria', 'Ribosome']);
    expect(result).toEqual({ recalled: ['atp', 'Mitochondria'], missed: ['Ribosome'] });
  });

  it('marks everything missed for empty text', () => {
    expect(evaluateBlurting('', ['a', 'b'])).toEqual({ recalled: [], missed: ['a', 'b'] });
  });
});
