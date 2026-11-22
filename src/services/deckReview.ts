import type { RetrievalCard, StudySession } from '../types';
import { AIService } from './aiService';
import { DECK_REVIEW_SCHEMA } from './aiSchemas';
import { cleanCard } from './deckQuality';

/**
 * A second AI check of a deck the AI just wrote: every card is looked at for wrong facts, more than
 * one right answer, questions that give the answer away and wrong choices that are also right. Cards
 * are fixed or, when they can't be saved, removed (never the last card of a concept). If the check
 * can't run, the deck is kept as it is: it never stops a student getting their deck.
 */

/** Material sent with the check, so it is checked against what the student gave. */
const MAX_SOURCE_CHARS = 60_000;

interface Verdict {
  id: string;
  verdict: 'ok' | 'fix' | 'remove';
  question?: string;
  answer?: string;
  options?: string[];
  reason?: string;
}

const describe = (card: RetrievalCard): string => {
  const lines = [`[${card.id}] (${card.cardType ?? 'standard'})`, `Q: ${card.clozeTemplate || card.question}`, `A: ${card.answer}`];
  if (card.options?.length) lines.push(`Choices: ${card.options.join(' | ')}`);
  return lines.join('\n');
};

export function reviewPrompt(session: StudySession, sourceText?: string): string {
  const cards = session.concepts.flatMap(concept => concept.retrievalCards.filter(card => card.cardType !== 'image-occlusion'));
  const source = sourceText?.trim()
    ? `Check the cards against this material the student gave. A card stating something the material doesn't support is wrong.\nMATERIAL:\n"""${sourceText.slice(0, MAX_SOURCE_CHARS)}"""`
    : 'Check the cards against well-established knowledge of the subject.';
  return `You are checking flashcards an AI wrote for a student (deck: "${session.title}") before the student studies them.
${source}

For every card decide:
- ok: correct, clear, and has exactly one right answer.
- fix: something is wrong or unclear (a wrong fact, an answer that doesn't answer the question, more than one right answer, a question that gives the answer away, or a wrong choice that is also right). Give only the fields that change. For a fill-in-the-blank card, give the whole corrected sentence as the question with the hidden words in {{double braces}}. For a multiple-choice card, give choices as the answer followed by three wrong ones.
- remove: only when the card can't be saved (nonsense, or a repeat of another card).
Keep the cards' language and level. Give a short reason for every fix and removal. Don't rewrite cards that are ok.

CARDS:
${cards.map(describe).join('\n\n')}`;
}

/** The deck with the review's fixes and removals applied, and what was done. */
export function applyReview(session: StudySession, verdicts: readonly Verdict[]): StudySession {
  const byId = new Map(verdicts.filter(v => v && typeof v.id === 'string').map(v => [v.id, v]));
  let fixed = 0;
  let removed = 0;
  let checked = 0;
  const concepts = session.concepts.map(concept => {
    const kept: RetrievalCard[] = [];
    const removable: RetrievalCard[] = [];
    for (const card of concept.retrievalCards) {
      const verdict = byId.get(card.id);
      if (verdict) checked++;
      if (verdict?.verdict === 'remove') {
        removable.push(card);
        continue;
      }
      if (verdict?.verdict === 'fix') {
        const isCloze = card.cardType === 'cloze';
        const patched = cleanCard({
          ...card,
          ...(verdict.question?.trim() ? (isCloze ? { question: verdict.question, clozeTemplate: verdict.question } : { question: verdict.question }) : {}),
          ...(verdict.answer?.trim() ? { answer: verdict.answer } : {}),
          ...(verdict.options?.length ? { options: verdict.options } : {}),
          // An explanation written for the old answer could now be wrong.
          ...(verdict.answer?.trim() && verdict.answer.trim() !== card.answer ? { explanation: undefined, diagnosticDistractors: undefined } : {}),
        });
        if (patched) {
          kept.push(patched);
          fixed++;
          continue;
        }
      }
      kept.push(card);
    }
    // A concept keeps at least one card, even one the check would remove.
    if (kept.length === 0 && removable.length > 0) kept.push(removable.shift()!);
    removed += removable.length;
    return { ...concept, retrievalCards: kept };
  });
  return { ...session, concepts, quality: { checked, fixed, removed } };
}

/** The deck after the AI's second check, or as it was if the check couldn't run. */
export async function reviewGeneratedDeck(session: StudySession, sourceText?: string): Promise<StudySession> {
  try {
    const text = await AIService.generateText(reviewPrompt(session, sourceText), 'application/json', false, DECK_REVIEW_SCHEMA);
    const parsed = AIService.safeParseJSON<{ cards?: Verdict[] }>(text, {});
    if (!Array.isArray(parsed.cards)) throw new Error('The check sent back something unreadable.');
    return applyReview(session, parsed.cards);
  } catch (err) {
    console.warn('[Deck check] Skipped:', err instanceof Error ? err.message : err);
    return session;
  }
}
