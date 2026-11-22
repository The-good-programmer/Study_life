import { describe, expect, it } from 'vitest';
import type { StudySession } from '../types';
import { ANONYMOUS_AUTHOR, authorPreview, ownCopyOf, shareableDeck } from './deckSharing';

const studied: StudySession = {
  id: 'deck-1',
  title: 'Cells',
  category: 'Biology',
  description: 'Unit 3',
  currentConceptIndex: 1,
  currentPhase: 'retrieval',
  elapsedSeconds: 900,
  createdAt: '2026-11-01T00:00:00Z',
  studentProfile: { age: 15, country: 'Turkey', grade: '10th grade' },
  sourceDocument: { title: 'My notes', text: 'private notes' } as unknown as StudySession['sourceDocument'],
  concepts: [
    {
      id: 'c1',
      order: 1,
      title: 'Mitochondria',
      estimatedMinutes: 5,
      mentalModel: 'A power plant',
      coreTakeaways: [],
      keyTerms: [],
      feynmanPrompt: '',
      sampleMasteryExplanation: '',
      diagramDataUrl: 'data:image/png;base64,MY-SKETCH',
      retrievalCards: [
        { id: 'rc1', conceptId: 'c1', question: 'What makes ATP?', answer: 'Mitochondria', stability: 12, difficulty: 6, reps: 7, lapses: 2, lastReviewDate: '2026-11-20T00:00:00Z', isStarred: true, diagramDataUrl: 'data:MY-SKETCH' },
        { id: 'rc2', conceptId: 'c1', question: 'Hidden', answer: 'Card', stability: 1, difficulty: 5, reps: 0, lapses: 0, hidden: true },
      ],
    },
  ],
};

describe('sharing a deck', () => {
  it('names adults by first name and initial, and nobody under 16', () => {
    expect(authorPreview({ name: 'Ada Lovelace', age: 19 })).toBe('Ada L.');
    expect(authorPreview({ name: 'Ada', age: 30 })).toBe('Ada');
    expect(authorPreview({ name: 'Young Student', age: 15 })).toBe(ANONYMOUS_AUTHOR);
    expect(authorPreview(null)).toBe(ANONYMOUS_AUTHOR);
  });

  it('shares the cards, never review history, hidden cards, sketches, notes or the profile', () => {
    const shared = shareableDeck(studied);
    const json = JSON.stringify(shared);
    expect(json).not.toContain('MY-SKETCH');
    expect(json).not.toContain('private notes');
    expect(json).not.toContain('Turkey');
    expect(json).not.toContain('2026-11-20');
    expect(shared.concepts[0].retrievalCards).toHaveLength(1);
    expect(shared.concepts[0].retrievalCards[0]).toMatchObject({ question: 'What makes ATP?', reps: 0, lapses: 0, stability: 0 });
    expect(shared.concepts[0].retrievalCards[0].isStarred).toBeUndefined();
  });

  it('adds a shared deck as a new deck with new ids and every card new', () => {
    const copy = ownCopyOf(studied);
    expect(copy.id).not.toBe(studied.id);
    const card = copy.concepts[0].retrievalCards[0];
    expect(card.id).not.toBe('rc1');
    expect(card.conceptId).toBe(copy.concepts[0].id);
    expect(card.reps).toBe(0);
  });
});
