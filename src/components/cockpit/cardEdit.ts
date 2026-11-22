import type { RetrievalCard } from '../../types';
import type { CardContentPatch } from '../../utils/cardProgress';
import { hasCloze } from '../../utils/cloze';
import { clozeAnswer } from '../studio/deckDraft';
import { getEffectiveCardType } from './retrievalLogic';

/** The change to save from what was typed, or an error to show. */
export function cardEditPatch(
  card: RetrievalCard,
  form: { question: string; answer: string; hint: string },
): { patch: CardContentPatch } | { error: string } {
  const question = form.question.trim();
  const hint = form.hint.trim() || undefined;
  if (getEffectiveCardType(card) === 'cloze') {
    if (!hasCloze(question)) return { error: 'Put the hidden words in {{double braces}}, like "The {{mitochondria}} makes energy".' };
    return { patch: { question, clozeTemplate: question, answer: clozeAnswer(question), hint } };
  }
  const answer = form.answer.trim();
  if (!question) return { error: 'The question is empty.' };
  if (!answer) return { error: 'The answer is empty.' };
  // A multiple-choice card lists its answer among the options: the edited answer replaces it there.
  const options = card.options?.map(option => (option === card.answer ? answer : option));
  return { patch: { question, answer, hint, ...(options ? { options } : {}) } };
}
