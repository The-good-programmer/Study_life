import { describe, it, expect } from 'vitest';
import type { ConceptCheckpoint, RetrievalCard, StudySession } from '../../types';
import {
  buildDeckFromDraft,
  buildImportedDeck,
  cardIssue,
  clozeAnswer,
  detectDelimiter,
  newCard,
  newConcept,
  parseImport,
  withCardType,
  withChoices,
  withFreshIdsIfTaken,
  wrongAnswersOf,
} from './deckDraft';

const meta = { title: '  Cell biology ', category: '', description: ' ', folderId: undefined };

const card = (extra: Partial<RetrievalCard>): RetrievalCard => ({ ...newCard('k'), ...extra });

describe('card rules', () => {
  it('reads the answer of a fill-in-the-blank sentence from its braces', () => {
    expect(clozeAnswer('Plants make {{glucose}} using {{light energy}}.')).toBe('glucose, light energy');
    expect(clozeAnswer('No blanks here')).toBe('');
  });

  it('finds the wrong answers wherever the right one is stored', () => {
    expect(wrongAnswersOf({ answer: 'Paris', options: ['Rome', 'Paris', 'Madrid'] })).toEqual(['Rome', 'Madrid', '']);
    expect(wrongAnswersOf({ answer: 'B) Paris', options: ['A) Rome', 'B) Paris'] })).toEqual(['A) Rome', '', '']);
  });

  it('says what a card still needs', () => {
    expect(cardIssue(card({ question: '', answer: 'x' }))).toBe('question');
    expect(cardIssue(card({ question: 'What?', answer: '' }))).toBe('answer');
    expect(cardIssue(card({ cardType: 'cloze', question: 'No braces at all' }))).toBe('blank');
    expect(cardIssue(card({ cardType: 'cloze', question: 'The {{nucleus}} holds DNA.' }))).toBeNull();
    expect(cardIssue(withChoices(card({ cardType: 'multiple-choice', question: 'Capital?' }), 'Paris', ['', '', '']))).toBe('wrong-answers');
    expect(cardIssue(withChoices(card({ cardType: 'multiple-choice', question: 'Capital?' }), 'Paris', ['Rome', '', '']))).toBeNull();
  });

  it('keeps the answer when a card changes type', () => {
    const asChoice = withCardType(card({ question: 'Capital of France?', answer: 'Paris' }), 'multiple-choice');
    expect(asChoice.options?.[0]).toBe('Paris');
    const asCloze = withCardType(card({ question: 'The capital is {{Paris}}.' }), 'cloze');
    expect(asCloze.answer).toBe('Paris');
  });
});

describe('buildDeckFromDraft', () => {
  const concept = (extra: Partial<ConceptCheckpoint>): ConceptCheckpoint => ({ ...newConcept(1), ...extra });

  it('drops untouched cards and blank parts, and fills in sensible defaults', () => {
    const filled = card({ question: ' What holds DNA? ', answer: ' The nucleus ' });
    const deck = buildDeckFromDraft(meta, [
      concept({ title: '', retrievalCards: [filled, newCard('k')] }),
      concept({ title: '', retrievalCards: [newCard('k')] }),
    ]);
    expect(deck.title).toBe('Cell biology');
    expect(deck.category).toBe('General');
    expect(deck.concepts).toHaveLength(1);
    expect(deck.concepts[0].title).toBe('Part 1');
    expect(deck.concepts[0].feynmanPrompt).toBe('Explain Part 1 in your own words, as if to a friend.');
    expect(deck.concepts[0].retrievalCards.map(c => [c.question, c.answer])).toEqual([['What holds DNA?', 'The nucleus']]);
  });

  it('normalises blanks and choices', () => {
    const cloze = card({ cardType: 'cloze', question: 'The {{nucleus}} holds DNA.', answer: 'stale' });
    const choice = withChoices(card({ cardType: 'multiple-choice', question: 'Capital?' }), 'Paris', ['Rome', '', 'Madrid']);
    const [savedCloze, savedChoice] = buildDeckFromDraft(meta, [concept({ title: 'Cells', retrievalCards: [cloze, choice] })]).concepts[0]
      .retrievalCards;
    expect(savedCloze.answer).toBe('nucleus');
    expect(savedCloze.clozeTemplate).toBe('The {{nucleus}} holds DNA.');
    expect(savedChoice.options).toEqual(['Paris', 'Rome', 'Madrid']);
  });

  it('keeps the id and creation date when editing a deck', () => {
    const existing = { id: 'deck-1', createdAt: '2026-01-01T00:00:00.000Z', elapsedSeconds: 40 } as StudySession;
    const deck = buildDeckFromDraft(meta, [concept({ title: 'Cells', retrievalCards: [card({ question: 'Q', answer: 'A' })] })], existing);
    expect(deck.id).toBe('deck-1');
    expect(deck.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(deck.elapsedSeconds).toBe(40);
  });
});

describe('import', () => {
  it('detects the separator, skipping Anki header lines', () => {
    expect(detectDelimiter('#separator:tab\nfront\tback')).toBe('tab');
    expect(detectDelimiter('front,back')).toBe('comma');
    expect(detectDelimiter('front;back')).toBe('semicolon');
    expect(detectDelimiter('front|back')).toBe('pipe');
  });

  it('reads quoted fields, Anki HTML and optional hints', () => {
    const rows = parseImport('#html:true\n"Capital, France","Paris"\nH<sub>2</sub>O,water<br>liquid,think rain\nonly-front', 'comma');
    expect(rows).toEqual([
      { front: 'Capital, France', back: 'Paris' },
      { front: 'H2O', back: 'water\nliquid', hint: 'think rain' },
    ]);
  });

  it('builds a deck, turning {{ }} sentences into fill-in-the-blank cards', () => {
    const deck = buildImportedDeck(
      [
        { front: 'The {{mitochondrion}} makes ATP.', back: 'mitochondrion' },
        { front: 'What makes ATP?', back: 'Mitochondria' },
      ],
      { title: 'Bio', category: '', description: '' },
    );
    const cards = deck.concepts[0].retrievalCards;
    expect(cards.map(c => c.cardType)).toEqual(['cloze', 'standard']);
    expect(cards[0].answer).toBe('mitochondrion');
    expect(deck.concepts[0].keyTerms).toEqual([]);
  });

  it('gives a restored deck new ids only when they are already in use', () => {
    const restored = buildImportedDeck([{ front: 'Q', back: 'A' }], { title: 'Bio', category: '', description: '' });
    expect(withFreshIdsIfTaken(restored, [])).toBe(restored);
    const copy = withFreshIdsIfTaken(restored, [restored]);
    expect(copy.id).not.toBe(restored.id);
    expect(copy.concepts[0].retrievalCards[0].id).not.toBe(restored.concepts[0].retrievalCards[0].id);
    expect(copy.concepts[0].retrievalCards[0].conceptId).toBe(copy.concepts[0].id);
  });
});
