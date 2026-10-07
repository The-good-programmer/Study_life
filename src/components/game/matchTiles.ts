import type { StudySession } from '../../types';
import { maskCloze } from '../../utils/cloze';
import { shuffle } from '../../utils/shuffle';
import { getEffectiveCardType } from '../cockpit/retrievalLogic';

export interface MatchTile {
  id: string;
  cardId: string;
  text: string;
  type: 'question' | 'answer';
  isMatched: boolean;
}

/** Pairs per game: enough to be a real round, few enough to fit on a phone screen. */
export const MAX_PAIRS = 6;
/** A round with fewer pairs is practice only: too quick to be worth paying for. */
export const MIN_PAID_PAIRS = 4;

const TILE_TEXT_LIMIT = 90;
const clip = (text: string) => (text.length > TILE_TEXT_LIMIT ? `${text.slice(0, TILE_TEXT_LIMIT - 1).trimEnd()}…` : text);
const normalize = (text: string) => text.trim().toLowerCase();

/**
 * Question and answer tiles for one round. Blanks are masked (a {{blank}} would
 * show its own answer), diagram cards are left out (their prompts are all alike
 * without the image), and cards that repeat a question or an answer are skipped
 * so every tile has exactly one partner.
 */
export function buildMatchTiles(session: StudySession, random: () => number = Math.random, maxPairs = MAX_PAIRS): MatchTile[] {
  const seenQuestions = new Set<string>();
  const seenAnswers = new Set<string>();
  const usable = shuffle(
    session.concepts.flatMap(c => c.retrievalCards || []),
    random,
  ).filter(card => {
    if (getEffectiveCardType(card) === 'image-occlusion') return false;
    const question = normalize(maskCloze(card.question));
    const answer = normalize(card.answer);
    if (!question || !answer || question === answer || seenQuestions.has(question) || seenAnswers.has(answer)) return false;
    seenQuestions.add(question);
    seenAnswers.add(answer);
    return true;
  });

  const tiles = usable.slice(0, maxPairs).flatMap((card, index) => [
    { id: `q-${card.id}-${index}`, cardId: card.id, text: clip(maskCloze(card.question).trim()), type: 'question' as const, isMatched: false },
    { id: `a-${card.id}-${index}`, cardId: card.id, text: clip(card.answer.trim()), type: 'answer' as const, isMatched: false },
  ]);
  return shuffle(tiles, random);
}

/** Two tiles match when they are the question and the answer of the same card. */
export const isMatchingPair = (a: MatchTile, b: MatchTile): boolean => a.cardId === b.cardId && a.type !== b.type;
