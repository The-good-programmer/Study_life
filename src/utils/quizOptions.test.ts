import { describe, it, expect } from 'vitest';
import { buildQuizOptions } from './quizOptions';
import { isBoardExamDeck, rankStarterDecksForGrade } from '../data/curatedStarterCatalog';

const card = (id: string, conceptId: string, answer: string) => ({ id, conceptId, answer });

describe('buildQuizOptions', () => {
  const target = card('c1', 'k1', 'Mitochondria');

  it('returns the answer plus three distractors, stable across calls', () => {
    const deck = [
      target,
      card('c2', 'k1', 'Ribosome'),
      card('c3', 'k1', 'Golgi body'),
      card('c4', 'k1', 'Lysosome'),
    ];
    const first = buildQuizOptions(target, deck);
    expect(first).toHaveLength(4);
    expect(first).toContain('Mitochondria');
    expect(buildQuizOptions(target, deck)).toEqual(first);
  });

  it('prefers the same concept, then key terms, before other concepts', () => {
    const deck = [
      target,
      card('c2', 'k1', 'Ribosome'),
      card('c3', 'k2', 'Photosynthesis'),
      card('c4', 'k2', 'Glycolysis'),
      card('c5', 'k2', 'Osmosis'),
    ];
    const options = buildQuizOptions(target, deck, ['Nucleus', 'Vacuole']);
    expect(options).toEqual(expect.arrayContaining(['Mitochondria', 'Ribosome', 'Nucleus', 'Vacuole']));
    expect(options).toHaveLength(4);
  });

  it('skips distractors whose length gives the answer away', () => {
    const longAnswer = card('a', 'k1', 'Left Ventricle, Aortic Arch, Superior Vena Cava, Pulmonary Trunk');
    const deck = [
      longAnswer,
      card('b', 'k1', 'IKr'),
      card('c', 'k1', 'L-type Ca2+'),
      card('d', 'k1', 'Na+ channel'),
    ];
    expect(buildQuizOptions(longAnswer, deck)).toEqual([]);
  });

  it('returns [] with fewer than three plausible distractors', () => {
    const deck = [target, card('c2', 'k1', 'Ribosome'), card('c3', 'k1', 'ribosome ')];
    expect(buildQuizOptions(target, deck)).toEqual([]);
  });
});

describe('starter deck ranking', () => {
  const decks = [
    { title: 'USMLE Step 1: Cardio', tags: ['USMLE Step 1'] },
    { title: 'MCAT Kinetics', tags: ['MCAT'] },
    { title: 'AP Biology', tags: ['AP Biology'] },
    { title: 'Spanish Core', tags: ['Spanish'] },
  ];

  it('detects board-exam decks', () => {
    expect(isBoardExamDeck(decks[0])).toBe(true);
    expect(isBoardExamDeck(decks[1])).toBe(true);
    expect(isBoardExamDeck(decks[2])).toBe(false);
  });

  it('puts board-exam decks last for school students and guests', () => {
    for (const grade of ['9th Grade', undefined, null]) {
      const ranked = rankStarterDecksForGrade(decks, grade).map(d => d.title);
      expect(ranked).toEqual(['AP Biology', 'Spanish Core', 'USMLE Step 1: Cardio', 'MCAT Kinetics']);
    }
  });

  it('keeps the original order for university and medical students', () => {
    const ranked = rankStarterDecksForGrade(decks, 'Medical School Year 2').map(d => d.title);
    expect(ranked).toEqual(decks.map(d => d.title));
  });
});
