import type { ConceptCheckpoint, RetrievalCard, StudySession, UserAccount } from '../types';

/** As the server shows it (server/src/deckSharing.js): first name and initial, and nobody under 16 by name. */
export const ANONYMOUS_AUTHOR = 'a Studify student';

export function authorPreview(user: Pick<UserAccount, 'name' | 'age'> | null | undefined): string {
  const age = Number(user?.age);
  if (!user || !Number.isFinite(age) || age < 16) return ANONYMOUS_AUTHOR;
  const [first, second] = String(user.name || '').trim().split(/\s+/);
  if (!first) return ANONYMOUS_AUTHOR;
  return second ? `${first} ${second[0].toUpperCase()}.` : first;
}

const NEW_CARD = { stability: 0, difficulty: 0, reps: 0, lapses: 0 } as const;

/**
 * What of a deck is shared: its cards and teaching content only. Never the sharer's review history,
 * hidden cards, sketches, own notes or PDF, or their education profile.
 */
export function shareableDeck(session: StudySession): StudySession {
  const concepts: ConceptCheckpoint[] = session.concepts
    .map(concept => ({
      id: concept.id,
      order: concept.order,
      title: concept.title,
      estimatedMinutes: concept.estimatedMinutes,
      mentalModel: concept.mentalModel,
      coreTakeaways: concept.coreTakeaways,
      keyTerms: concept.keyTerms,
      conceptNodes: concept.conceptNodes,
      feynmanPrompt: concept.feynmanPrompt,
      sampleMasteryExplanation: concept.sampleMasteryExplanation,
      retrievalCards: concept.retrievalCards
        .filter(card => !card.hidden)
        .map(
          (card): RetrievalCard => ({
            id: card.id,
            conceptId: card.conceptId,
            cardType: card.cardType,
            question: card.question,
            answer: card.answer,
            hint: card.hint,
            explanation: card.explanation,
            options: card.options,
            diagnosticDistractors: card.diagnosticDistractors,
            socraticHintLadder: card.socraticHintLadder,
            clozeTemplate: card.clozeTemplate,
            imageUrl: card.imageUrl,
            occlusionMode: card.occlusionMode,
            masks: card.masks,
            ...NEW_CARD,
          }),
        ),
    }))
    .filter(concept => concept.retrievalCards.length > 0);
  return {
    id: session.id,
    title: session.title,
    category: session.category,
    description: session.description,
    concepts,
    currentConceptIndex: 0,
    currentPhase: 'priming',
    elapsedSeconds: 0,
    createdAt: session.createdAt,
    depthTier: session.depthTier,
    gradeLevel: session.gradeLevel,
    languageCode: session.languageCode,
  };
}

const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * A shared deck as a new deck of the student's own: new ids (so it never touches a deck or card
 * they already have, the author's own included) and every card new to them.
 */
export function ownCopyOf(shared: StudySession): StudySession {
  return {
    ...shareableDeck(shared),
    id: uid('session'),
    createdAt: new Date().toISOString(),
    concepts: shareableDeck(shared).concepts.map(concept => {
      const conceptId = uid('c');
      return { ...concept, id: conceptId, retrievalCards: concept.retrievalCards.map(card => ({ ...card, id: uid('rc'), conceptId })) };
    }),
  };
}
