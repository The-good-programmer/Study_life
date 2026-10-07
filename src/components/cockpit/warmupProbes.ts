import type { DiagnosticProbe, StudySession } from '../../types';
import { maskCloze } from '../../utils/cloze';
import { buildQuizOptions } from '../../utils/quizOptions';
import { shuffle } from '../../utils/shuffle';
import { getEffectiveCardType } from './retrievalLogic';

/** The warm-up is a quick check: at most this many questions, one per concept. */
export const MAX_WARMUP_PROBES = 4;

const normalize = (text: string) => text.trim().toLowerCase();

/**
 * One multiple-choice question per concept, asked before studying (pre-testing).
 * Prefers a card that already has choices, then a plain card turned into a
 * 4-choice question with plausible distractors, then a key term matched to its
 * definition. Blanks are masked so the question never shows its own answer, and
 * diagram cards are skipped because the warm-up does not show the image.
 */
export function buildWarmupProbes(
  session: StudySession,
  random: () => number = Math.random,
  maxProbes = MAX_WARMUP_PROBES,
): DiagnosticProbe[] {
  const deckCards = session.concepts.flatMap(c => c.retrievalCards || []);
  const probes: DiagnosticProbe[] = [];

  for (const concept of session.concepts) {
    if (probes.length >= maxProbes) break;
    const cards = (concept.retrievalCards || []).filter(card => getEffectiveCardType(card) !== 'image-occlusion');
    const base = { conceptId: concept.id, conceptTitle: concept.title };

    const choiceCard = cards.find(card => card.options && card.options.length >= 2);
    if (choiceCard?.options) {
      probes.push({ ...base, question: maskCloze(choiceCard.question), options: choiceCard.options, correctAnswer: choiceCard.answer });
      continue;
    }

    const keyTerms = (concept.keyTerms || []).map(k => k.term);
    let built = false;
    for (const card of cards) {
      const options = buildQuizOptions(card, deckCards, keyTerms);
      if (options.length >= 2) {
        probes.push({ ...base, question: maskCloze(card.question), options, correctAnswer: card.answer });
        built = true;
        break;
      }
    }
    if (built) continue;

    const term = concept.keyTerms?.[0];
    if (term?.definition) {
      const seen = new Set([normalize(term.definition)]);
      const distractors: string[] = [];
      for (const other of session.concepts.flatMap(c => c.keyTerms || [])) {
        const key = normalize(other.definition || '');
        if (!key || seen.has(key)) continue;
        seen.add(key);
        distractors.push(other.definition);
      }
      if (distractors.length > 0) {
        probes.push({
          ...base,
          question: `Which of these describes "${term.term}"?`,
          options: shuffle([term.definition, ...shuffle(distractors, random).slice(0, 3)], random),
          correctAnswer: term.definition,
        });
      }
    }
  }

  return probes;
}
