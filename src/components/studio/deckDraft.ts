import type { CardType, ConceptCheckpoint, RetrievalCard, StudySession } from '../../types';
import { hasCloze } from '../../utils/cloze';
import { getEffectiveCardType, isOptionCorrect } from '../cockpit/retrievalLogic';

/** Pure rules for the deck editor and importer: what a card needs, and how a draft becomes a deck. */

export type EditableCardType = Exclude<CardType, 'image-occlusion'>;

const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const newCard = (conceptId: string, cardType: EditableCardType = 'standard'): RetrievalCard => ({
  id: uid('rc'),
  conceptId,
  cardType,
  question: '',
  answer: '',
  hint: '',
  explanation: '',
  options: cardType === 'multiple-choice' ? ['', '', '', ''] : undefined,
  stability: 1,
  difficulty: 5,
  reps: 0,
  lapses: 0,
});

export const newConcept = (order: number): ConceptCheckpoint => {
  const id = uid('c');
  return {
    id,
    order,
    title: '',
    estimatedMinutes: 0,
    mentalModel: '',
    coreTakeaways: [],
    keyTerms: [],
    feynmanPrompt: '',
    sampleMasteryExplanation: '',
    retrievalCards: [newCard(id)],
  };
};

/** The words inside {{ }} in a fill-in-the-blank sentence, which are the card's answer. */
export const clozeAnswer = (text: string): string =>
  [...text.matchAll(/\{\{(.*?)\}\}/g)]
    .map(match => match[1].trim())
    .filter(Boolean)
    .join(', ');

/** Up to three wrong answers of a multiple-choice card, wherever the right one is stored. */
export const wrongAnswersOf = (card: Pick<RetrievalCard, 'answer' | 'options'>): string[] => {
  let skippedAnswer = false;
  const wrong = (card.options ?? []).filter(option => {
    if (!skippedAnswer && card.answer.trim() && isOptionCorrect(option, card.answer)) {
      skippedAnswer = true;
      return false;
    }
    return true;
  });
  return [...wrong, '', '', ''].slice(0, 3);
};

/** Sets the right and wrong answers of a multiple-choice card (empty slots kept while editing). */
export const withChoices = (card: RetrievalCard, answer: string, wrong: string[]): RetrievalCard => ({
  ...card,
  answer,
  options: [answer, ...wrong],
});

/** Switches a card's type, keeping what still makes sense. */
export const withCardType = (card: RetrievalCard, cardType: EditableCardType): RetrievalCard => {
  if (cardType === 'multiple-choice') return { ...card, cardType, options: [card.answer, ...wrongAnswersOf(card)], clozeTemplate: undefined };
  if (cardType === 'cloze') return { ...card, cardType, options: undefined, clozeTemplate: card.question, answer: clozeAnswer(card.question) };
  return { ...card, cardType, options: undefined, clozeTemplate: undefined };
};

export type CardIssue = 'question' | 'answer' | 'blank' | 'wrong-answers';

export const CARD_ISSUE_TEXT: Record<CardIssue, string> = {
  question: 'Add a question',
  answer: 'Add an answer',
  blank: 'Put the hidden words in {{double braces}}',
  'wrong-answers': 'Add at least one wrong answer',
};

/** A card nobody typed into. It is dropped on save instead of being flagged. */
export const isUntouched = (card: RetrievalCard): boolean =>
  getEffectiveCardType(card) !== 'image-occlusion' &&
  !card.question.trim() &&
  !card.answer.trim() &&
  !(card.options ?? []).some(option => option.trim());

/** What is missing before a card can be studied, or null when it is ready. */
export const cardIssue = (card: RetrievalCard): CardIssue | null => {
  const type = getEffectiveCardType(card);
  if (type === 'image-occlusion') return null;
  if (!card.question.trim()) return 'question';
  if (type === 'cloze') return hasCloze(card.question) && clozeAnswer(card.question) ? null : 'blank';
  if (!card.answer.trim()) return 'answer';
  if (type === 'multiple-choice' && !wrongAnswersOf(card).some(option => option.trim())) return 'wrong-answers';
  return null;
};

const normalizeCard = (card: RetrievalCard, conceptId: string): RetrievalCard => {
  const type = getEffectiveCardType(card);
  const base: RetrievalCard = {
    ...card,
    conceptId,
    cardType: type,
    question: card.question.trim(),
    answer: card.answer.trim(),
    hint: card.hint?.trim() || undefined,
    explanation: card.explanation?.trim() || undefined,
  };
  if (type === 'cloze') return { ...base, answer: clozeAnswer(base.question), clozeTemplate: base.question, options: undefined };
  if (type === 'multiple-choice') {
    const wrong = wrongAnswersOf(card).map(option => option.trim()).filter(Boolean);
    return { ...base, options: [base.answer, ...wrong], clozeTemplate: undefined };
  }
  if (type === 'standard') return { ...base, options: undefined, clozeTemplate: undefined };
  return base;
};

export interface DeckMeta {
  title: string;
  category: string;
  description: string;
  folderId?: string;
}

/**
 * Turns the editor's draft into a deck: untouched cards are dropped, blanks and
 * choices are normalised, and the explain step gets a sensible prompt when none
 * was written. Editing keeps the deck's id, creation date and progress fields.
 */
export const buildDeckFromDraft = (
  meta: DeckMeta,
  concepts: ConceptCheckpoint[],
  existing?: StudySession | null,
  now: Date = new Date(),
): StudySession => {
  const cleanConcepts = concepts
    .map((concept, index) => {
      const title = concept.title.trim() || `Part ${index + 1}`;
      const cards = concept.retrievalCards.filter(card => !isUntouched(card)).map(card => normalizeCard(card, concept.id));
      const mentalModel = concept.mentalModel.trim();
      return {
        ...concept,
        order: index + 1,
        title,
        mentalModel,
        coreTakeaways: concept.coreTakeaways.map(point => point.trim()).filter(Boolean),
        keyTerms: concept.keyTerms
          .map(term => ({ term: term.term.trim(), definition: term.definition.trim() }))
          .filter(term => term.term),
        feynmanPrompt: concept.feynmanPrompt.trim() || `Explain ${title} in your own words, as if to a friend.`,
        sampleMasteryExplanation: concept.sampleMasteryExplanation.trim() || mentalModel,
        estimatedMinutes: concept.estimatedMinutes > 0 ? concept.estimatedMinutes : Math.max(5, cards.length * 2),
        retrievalCards: cards,
        isBlank: !concept.title.trim() && !mentalModel && cards.length === 0,
      };
    })
    .filter(concept => !concept.isBlank)
    .map(({ isBlank: _isBlank, ...concept }, index) => ({ ...concept, order: index + 1 }));

  return {
    ...(existing ?? {}),
    id: existing?.id ?? uid('session'),
    title: meta.title.trim(),
    category: meta.category.trim() || 'General',
    folderId: meta.folderId || undefined,
    description: meta.description.trim(),
    currentConceptIndex: 0,
    currentPhase: 'priming',
    elapsedSeconds: existing?.elapsedSeconds ?? 0,
    createdAt: existing?.createdAt ?? now.toISOString(),
    concepts: cleanConcepts,
  };
};

/* ------------------------------------------------------------------ */
/* Import                                                              */
/* ------------------------------------------------------------------ */

export type Delimiter = 'tab' | 'comma' | 'semicolon' | 'pipe';

export const DELIMITERS: { value: Delimiter; label: string; char: string }[] = [
  { value: 'tab', label: 'Tab (Anki, Quizlet)', char: '\t' },
  { value: 'comma', label: 'Comma (CSV)', char: ',' },
  { value: 'semicolon', label: 'Semicolon', char: ';' },
  { value: 'pipe', label: 'Pipe ( | )', char: '|' },
];

export interface ImportRow {
  front: string;
  back: string;
  hint?: string;
}

const contentLines = (text: string) =>
  text
    .split(/\r?\n/)
    .filter(line => line.trim() && !line.trimStart().startsWith('#'));

/** Guesses the separator from the first card line (Anki's "#separator" lines are skipped). */
export const detectDelimiter = (text: string): Delimiter => {
  const first = contentLines(text)[0] ?? '';
  if (first.includes('\t')) return 'tab';
  if (first.includes('|')) return 'pipe';
  if (first.includes(';')) return 'semicolon';
  return 'comma';
};

/** Splits one line, honouring "quoted, fields" with "" for a literal quote. */
const splitLine = (line: string, separator: string): string[] => {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === '"' && current.trim() === '') {
      inQuotes = true;
      current = '';
    } else if (char === separator) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
};

const ENTITIES: Record<string, string> = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };

/** Anki exports keep HTML; cards here are plain text. */
const cleanField = (text: string): string =>
  text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, entity => ENTITIES[entity] ?? entity)
    .trim();

export const parseImport = (text: string, delimiter: Delimiter): ImportRow[] => {
  const separator = DELIMITERS.find(d => d.value === delimiter)?.char ?? '\t';
  return contentLines(text).flatMap(line => {
    const [front = '', back = '', hint = ''] = splitLine(line, separator).map(cleanField);
    if (!front || !back) return [];
    return [{ front, back, ...(hint ? { hint } : {}) }];
  });
};

/** A deck of plain flashcards from imported rows; sentences with {{ }} become fill-in-the-blank cards. */
export const buildImportedDeck = (rows: ImportRow[], meta: DeckMeta, now: Date = new Date()): StudySession => {
  const title = meta.title.trim() || 'Imported cards';
  const conceptId = uid('c');
  const cards: RetrievalCard[] = rows.map(row => {
    const isCloze = hasCloze(row.front);
    return {
      id: uid('rc'),
      conceptId,
      cardType: isCloze ? 'cloze' : 'standard',
      question: row.front,
      answer: isCloze ? clozeAnswer(row.front) || row.back : row.back,
      hint: row.hint,
      clozeTemplate: isCloze ? row.front : undefined,
      stability: 1,
      difficulty: 5,
      reps: 0,
      lapses: 0,
    };
  });
  return {
    id: uid('session'),
    title,
    category: meta.category.trim() || 'Imported',
    folderId: meta.folderId || undefined,
    description: `${cards.length} imported ${cards.length === 1 ? 'card' : 'cards'}.`,
    currentConceptIndex: 0,
    currentPhase: 'priming',
    elapsedSeconds: 0,
    createdAt: now.toISOString(),
    concepts: [
      {
        id: conceptId,
        order: 1,
        title,
        estimatedMinutes: Math.max(5, Math.round(cards.length * 0.5)),
        mentalModel: '',
        coreTakeaways: [],
        keyTerms: [],
        feynmanPrompt: `Explain the main ideas of ${title} in your own words.`,
        sampleMasteryExplanation: '',
        retrievalCards: cards,
      },
    ],
  };
};

/**
 * A deck restored from a JSON file gets new ids when its own ids are already in use,
 * so it can never overwrite a deck, or the review progress of cards, you already have.
 */
export const withFreshIdsIfTaken = (deck: StudySession, existingDecks: StudySession[]): StudySession => {
  const takenCardIds = new Set(existingDecks.flatMap(d => d.concepts.flatMap(c => c.retrievalCards.map(card => card.id))));
  const clashes =
    existingDecks.some(d => d.id === deck.id) || deck.concepts.some(c => c.retrievalCards.some(card => takenCardIds.has(card.id)));
  if (!clashes) return deck;
  return {
    ...deck,
    id: uid('session'),
    concepts: deck.concepts.map(concept => {
      const conceptId = uid('c');
      return {
        ...concept,
        id: conceptId,
        retrievalCards: concept.retrievalCards.map(card => ({ ...card, id: uid('rc'), conceptId })),
      };
    }),
  };
};
