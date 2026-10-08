import { describe, expect, it } from 'vitest';
import type { ConceptCheckpoint, RetrievalCard, StudySession } from '../../types';
import { buildDeckProgress, sessionFromConcept } from './knowledgeMap';

const NOW = new Date('2026-10-08T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

const card = (id: string, overrides: Partial<RetrievalCard> = {}): RetrievalCard => ({
  id,
  conceptId: 'k',
  question: `Q ${id}`,
  answer: `A ${id}`,
  stability: 1,
  difficulty: 5,
  reps: 0,
  lapses: 0,
  ...overrides,
});

/** A card reviewed `stability` days of memory ago, next due in `dueInDays`. */
const reviewed = (id: string, stability: number, dueInDays: number, overrides: Partial<RetrievalCard> = {}): RetrievalCard =>
  card(id, {
    reps: 3,
    stability,
    lastReviewDate: new Date(NOW.getTime() - DAY).toISOString(),
    nextReviewDate: new Date(NOW.getTime() + dueInDays * DAY).toISOString(),
    ...overrides,
  });

const concept = (id: string, cards: RetrievalCard[]): ConceptCheckpoint => ({
  id,
  order: 1,
  title: `Concept ${id}`,
  estimatedMinutes: 10,
  mentalModel: '',
  coreTakeaways: [],
  keyTerms: [],
  feynmanPrompt: '',
  sampleMasteryExplanation: '',
  retrievalCards: cards,
});

const deck = (concepts: ConceptCheckpoint[], overrides: Partial<StudySession> = {}): StudySession => ({
  id: 'deck',
  title: 'Deck',
  category: 'Biology',
  description: '',
  concepts,
  currentConceptIndex: 0,
  currentPhase: 'priming',
  elapsedSeconds: 0,
  createdAt: '2026-10-01T00:00:00.000Z',
  ...overrides,
});

const progressOf = (session: StudySession, saved: RetrievalCard[] = []) =>
  buildDeckProgress(session, new Map(saved.map(c => [c.id, c])), NOW);

describe('buildDeckProgress', () => {
  it('reads progress from the saved cards, not the deck copies that can lag behind', () => {
    const progress = progressOf(deck([concept('a', [card('a1'), card('a2')])]), [reviewed('a1', 30, 20), reviewed('a2', 25, 10)]);
    expect(progress.concepts[0]).toMatchObject({ status: 'mastered', reviewedCount: 2, masteredCount: 2 });
  });

  it('gives each concept a status from its cards', () => {
    const progress = progressOf(
      deck([
        concept('new', [card('n1')]),
        concept('due', [reviewed('d1', 30, 5), reviewed('d2', 4, -1)]),
        concept('learning', [reviewed('l1', 30, 5), card('l2')]),
        concept('mastered', [reviewed('m1', 21, 3), reviewed('m2', 60, 40)]),
      ]),
    );
    expect(progress.concepts.map(c => c.status)).toEqual(['new', 'due', 'learning', 'mastered']);
    expect(progress.counts).toEqual({ new: 1, due: 1, learning: 1, mastered: 1 });
    expect(progress.concepts[1].dueCount).toBe(1);
    expect(progress.cardCount).toBe(7);
  });

  it('suggests the first concept not started yet, skipping ones without cards', () => {
    const progress = progressOf(
      deck([concept('done', [reviewed('x', 30, 9)]), concept('empty', []), concept('next', [card('y')]), concept('later', [card('z')])]),
    );
    expect(progress.nextIndex).toBe(2);
    expect(progressOf(deck([concept('done', [reviewed('x', 3, 2)])])).nextIndex).toBeNull();
  });

  it('averages the recall chance of reviewed cards only, and counts hard cards', () => {
    const progress = progressOf(deck([concept('a', [reviewed('a1', 10, 9, { lapses: 4 }), card('a2')]), concept('b', [card('b1')])]));
    const [a, b] = progress.concepts;
    expect(a.recallChance).toBeGreaterThan(80);
    expect(a.recallChance).toBeLessThanOrEqual(100);
    expect(a.hardCount).toBe(1);
    expect(b.recallChance).toBeNull();
  });

  it('finds the warm-up question for a concept by id, or by title for older decks', () => {
    const probe = (conceptId: string, conceptTitle: string) => ({
      conceptId,
      conceptTitle,
      question: `About ${conceptTitle}?`,
      options: ['x', 'y'],
      correctAnswer: 'x',
      userAnswer: 'y',
      isCorrect: false,
    });
    const progress = progressOf(
      deck([concept('a', [card('a1')]), concept('b', [card('b1')]), concept('c', [card('c1')])], {
        diagnosticReport: { probes: [probe('a', 'Concept a'), probe('old-id', ' concept B ')], score: 0, completedAt: NOW.toISOString() },
      }),
    );
    expect(progress.concepts.map(c => c.warmup?.question)).toEqual(['About Concept a?', 'About  concept B ?', undefined]);
  });
});

describe('sessionFromConcept', () => {
  it('starts a guided session at the concept, even when the deck was last used for flashcards', () => {
    const session = sessionFromConcept(deck([concept('a', [])], { currentPhase: 'summary', casualFlashcardMode: true }), 3);
    expect(session).toMatchObject({ currentConceptIndex: 3, currentPhase: 'priming', casualFlashcardMode: false });
  });
});
