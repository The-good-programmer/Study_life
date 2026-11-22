import type { RetrievalCard, StudySession } from '../types';
import { ApiConfig } from './apiConfig';
import { studyableCards } from '../utils/cardProgress';
import { buildQuizOptions, orderOptionsForCard } from '../utils/quizOptions';
import { maskCloze } from '../utils/cloze';
import { shuffle } from '../utils/shuffle';
import { getEffectiveCardType } from '../components/cockpit/retrievalLogic';
import { wrongAnswersOf } from '../components/studio/deckDraft';

export const DUEL_QUESTIONS = 10;
export const MIN_DUEL_QUESTIONS = 4;
/** Seconds to answer each question. */
export const DUEL_SECONDS_PER_QUESTION = 20;

export interface DuelQuestion {
  question: string;
  options: string[];
  /** Missing while you haven't answered yet. */
  answerIndex?: number;
  yourAnswer?: number | null;
  theirAnswer?: number | null;
}

export interface DuelPlayer {
  id: string;
  name: string;
  score: number | null;
  ms: number | null;
}

export interface Duel {
  id: string;
  deckTitle: string;
  status: 'your-turn' | 'waiting' | 'done' | 'expired';
  role: 'challenger' | 'opponent';
  createdAt: string;
  completedAt: string | null;
  expiresAt: string;
  questionCount: number;
  you: DuelPlayer;
  them: DuelPlayer;
  questions: DuelQuestion[];
}

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const failure = (res: { status: number; error?: string }) =>
  res.status === 0 ? "Couldn't reach Studify. Check your connection." : res.error || 'Something went wrong.';

const listeners = new Set<() => void>();

/**
 * Up to 10 multiple-choice questions from a deck: each card's own choices when it has them,
 * otherwise wrong answers taken from the deck's other cards. Diagram cards and cards without three
 * believable wrong answers are left out.
 */
export function buildDuelQuestions(deck: StudySession, random: () => number = Math.random, count = DUEL_QUESTIONS): (DuelQuestion & { answerIndex: number })[] {
  const cards = deck.concepts.flatMap(concept => studyableCards(concept.retrievalCards));
  const keyTerms = deck.concepts.flatMap(concept => (concept.keyTerms ?? []).map(term => term.term));
  const questions: (DuelQuestion & { answerIndex: number })[] = [];
  for (const card of shuffle(cards, random)) {
    if (questions.length >= count) break;
    const question = toQuestion(card, cards, keyTerms);
    if (question) questions.push(question);
  }
  return questions;
}

function toQuestion(card: RetrievalCard, deckCards: RetrievalCard[], keyTerms: string[]): (DuelQuestion & { answerIndex: number }) | null {
  const type = getEffectiveCardType(card);
  if (type === 'image-occlusion') return null;
  const answer = card.answer.trim();
  const question = (type === 'cloze' ? maskCloze(card.clozeTemplate || card.question) : card.question).trim();
  if (!answer || !question) return null;
  const own = wrongAnswersOf(card).map(o => o.trim()).filter(o => o && o.toLowerCase() !== answer.toLowerCase());
  const options = own.length >= 3 ? orderOptionsForCard([answer, ...own.slice(0, 3)], card.id) : buildQuizOptions(card, deckCards, keyTerms);
  if (options.length !== 4 || new Set(options.map(o => o.toLowerCase())).size !== 4) return null;
  if (options.some(o => o.length > 400) || question.length > 400) return null;
  return { question, options, answerIndex: options.indexOf(answer) };
}

/** Whether a deck has enough questions for a duel. */
export const canDuelWith = (deck: StudySession): boolean => buildDuelQuestions(deck, () => 0.5, MIN_DUEL_QUESTIONS).length >= MIN_DUEL_QUESTIONS;

/** "You won", "You lost", "A draw", from the scores (time breaks a tie). */
export function duelOutcome(duel: Duel): 'won' | 'lost' | 'draw' | null {
  const { you, them } = duel;
  if (duel.status !== 'done' || you.score === null || them.score === null) return null;
  if (you.score !== them.score) return you.score > them.score ? 'won' : 'lost';
  if (you.ms !== null && them.ms !== null && you.ms !== them.ms && you.ms > 0 && them.ms > 0) return you.ms < them.ms ? 'won' : 'lost';
  return 'draw';
}

export class DuelService {
  public static async list(): Promise<Result<Duel[]>> {
    const res = await ApiConfig.request<{ duels: Duel[] }>('/duels');
    return res.ok && res.data ? { ok: true, data: res.data.duels } : { ok: false, error: failure(res) };
  }

  /** Sends a challenge with your own answers (a choice index, or null when time ran out). */
  public static async challenge(input: {
    friendId: string;
    deckTitle: string;
    questions: (DuelQuestion & { answerIndex: number })[];
    answers: (number | null)[];
    ms: number;
  }): Promise<Result<Duel>> {
    const res = await ApiConfig.request<{ duel: Duel }>('/duels', {
      method: 'POST',
      body: JSON.stringify({
        ...input,
        questions: input.questions.map(({ question, options, answerIndex }) => ({ question, options, answerIndex })),
      }),
    });
    if (!res.ok || !res.data) return { ok: false, error: failure(res) };
    listeners.forEach(listener => listener());
    return { ok: true, data: res.data.duel };
  }

  public static async play(duelId: string, answers: (number | null)[], ms: number): Promise<Result<Duel>> {
    const res = await ApiConfig.request<{ duel: Duel }>(`/duels/${duelId}/play`, { method: 'POST', body: JSON.stringify({ answers, ms }) });
    if (!res.ok || !res.data) return { ok: false, error: failure(res) };
    listeners.forEach(listener => listener());
    return { ok: true, data: res.data.duel };
  }

  public static subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }
}
