import { beforeEach, describe, expect, it } from 'vitest';
import type { RetrievalCard, StudySession } from '../types';
import { StorageService } from './storageService';
import { buildDailyQueue } from './dailyReview';
import { isCardDue, withNewerContent, withSavedProgress } from '../utils/cardProgress';
import { cardEditPatch } from '../components/cockpit/cardEdit';
import { buildDeckFromDraft } from '../components/studio/deckDraft';

const NOW = new Date('2026-11-22T10:00:00Z');
const card = (id: string, extra: Partial<RetrievalCard> = {}): RetrievalCard =>
  ({ id, conceptId: 'c', question: `Q ${id}`, answer: `A ${id}`, stability: 0, difficulty: 5, reps: 0, lapses: 0, ...extra }) as RetrievalCard;
const deck = (id: string, cards: RetrievalCard[]): StudySession =>
  ({
    id,
    title: id,
    category: 'Biology',
    description: '',
    createdAt: '2026-11-01T00:00:00Z',
    currentConceptIndex: 0,
    currentPhase: 'retrieval',
    elapsedSeconds: 0,
    concepts: [{ id: 'c', order: 1, title: 'Cells', estimatedMinutes: 5, mentalModel: '', coreTakeaways: [], keyTerms: [], feynmanPrompt: '', sampleMasteryExplanation: '', retrievalCards: cards }],
  }) as StudySession;
const cardsIn = (id: string) => StorageService.getSessions().find(s => s.id === id)!.concepts[0].retrievalCards;

describe('fixing a card during a review', () => {
  beforeEach(() => localStorage.clear());

  it('changes the saved card and every deck that holds it, with the time of the edit', () => {
    StorageService.saveSession(deck('bio', [card('x'), card('y')]));
    StorageService.saveSession(deck('mix', [card('x')]));
    const saved = StorageService.updateCardContent('x', { question: 'Fixed question', answer: 'Fixed answer' }, NOW);
    expect(saved).toMatchObject({ question: 'Fixed question', answer: 'Fixed answer', updatedAt: NOW.toISOString() });
    expect(cardsIn('bio')[0]).toMatchObject({ question: 'Fixed question', updatedAt: NOW.toISOString() });
    expect(cardsIn('mix')[0].answer).toBe('Fixed answer');
    expect(StorageService.getAllCards().find(c => c.id === 'x')!.question).toBe('Fixed question');
  });

  it('keeps the edit when the study screen saves its older copy of the deck', () => {
    const inMemory = deck('bio', [card('x', { reps: 1, lastReviewDate: '2026-11-20T00:00:00Z' })]);
    StorageService.saveSession(inMemory);
    StorageService.updateCardContent('x', { question: 'Fixed' }, NOW);
    StorageService.saveSession(inMemory); // the deck as the study screen held it, before the fix
    expect(cardsIn('bio')[0].question).toBe('Fixed');
    expect(StorageService.getAllCards().find(c => c.id === 'x')!.question).toBe('Fixed');
  });

  it('lets a later edit in the deck editor win over an earlier fix', () => {
    StorageService.saveSession(deck('bio', [card('x')]));
    StorageService.updateCardContent('x', { question: 'Fixed in review' }, NOW);
    const stored = StorageService.getSessions()[0];
    const draft = stored.concepts.map(c => ({ ...c, retrievalCards: c.retrievalCards.map(rc => ({ ...rc, question: 'Edited in deck editor' })) }));
    const later = new Date(NOW.getTime() + 60_000);
    const edited = buildDeckFromDraft({ title: 'bio', category: 'Biology', description: '' }, draft, stored, later);
    expect(edited.concepts[0].retrievalCards[0].updatedAt).toBe(later.toISOString());
    StorageService.saveSession(edited);
    expect(cardsIn('bio')[0].question).toBe('Edited in deck editor');
  });

  it('only takes the other copy\'s content when it was edited later', () => {
    const old = card('x', { question: 'old', updatedAt: '2026-11-01T00:00:00Z' });
    const fixed = card('x', { question: 'new', updatedAt: '2026-11-02T00:00:00Z', reps: 4 });
    expect(withNewerContent(old, fixed).question).toBe('new');
    expect(withNewerContent(fixed, old).question).toBe('new');
    expect(withSavedProgress(card('x'), fixed)).toMatchObject({ question: 'new', reps: 4 });
  });

  it('builds the change from the form, keeping a multiple-choice answer among its options', () => {
    const choice = card('m', { cardType: 'multiple-choice', answer: 'Paris', options: ['Paris', 'Rome', 'Oslo', 'Bern'] });
    expect(cardEditPatch(choice, { question: 'Capital of France?', answer: 'Paris, France', hint: '' })).toEqual({
      patch: { question: 'Capital of France?', answer: 'Paris, France', hint: undefined, options: ['Paris, France', 'Rome', 'Oslo', 'Bern'] },
    });
    expect(cardEditPatch(card('s'), { question: ' ', answer: 'a', hint: '' })).toEqual({ error: 'The question is empty.' });
    const cloze = card('z', { cardType: 'cloze', clozeTemplate: 'The {{cell}} is small' });
    expect(cardEditPatch(cloze, { question: 'The {{nucleus}} holds DNA', answer: '', hint: '' })).toEqual({
      patch: { question: 'The {{nucleus}} holds DNA', clozeTemplate: 'The {{nucleus}} holds DNA', answer: 'nucleus', hint: undefined },
    });
    expect(cardEditPatch(cloze, { question: 'No blanks', answer: '', hint: '' })).toHaveProperty('error');
  });
});

describe('hiding a card', () => {
  beforeEach(() => localStorage.clear());

  it('takes it out of every review until it is shown again', () => {
    const due = card('x', { reps: 2, stability: 3, lastReviewDate: '2026-11-15T00:00:00Z', nextReviewDate: '2026-11-20T00:00:00Z' });
    StorageService.saveSession(deck('bio', [due, card('y')]));
    StorageService.setCardHidden('x', true, NOW);
    expect(cardsIn('bio')[0].hidden).toBe(true);
    expect(isCardDue(cardsIn('bio')[0], NOW)).toBe(false);
    expect(StorageService.getDueCards().map(c => c.id)).not.toContain('x');
    expect(StorageService.getDailyQueue(NOW).cards.map(c => c.id)).toEqual(['y']);

    StorageService.setCardHidden('x', false, NOW);
    expect(cardsIn('bio')[0].hidden).toBeUndefined();
    expect(StorageService.getDailyQueue(NOW).cards.map(c => c.id)).toEqual(['x', 'y']);
  });

  it('leaves hidden new cards out of the daily queue', () => {
    const queue = buildDailyQueue([deck('bio', [card('a', { hidden: true }), card('b')])], new Map(), { now: NOW, newPerDay: 10, newStartedToday: 0 });
    expect(queue.cards.map(c => c.id)).toEqual(['b']);
  });
});
