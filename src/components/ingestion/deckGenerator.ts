import type { DepthTier, StudentEducationProfile, StudySession } from '../../types';
import { AIService } from '../../services/aiService';
import type { ExtractedPDF } from '../../services/pdfService';
import { groundSessionInPdf } from './pdfGrounding';
import { reviewGeneratedDeck } from '../../services/deckReview';

/** What the student asked to turn into a study deck. */
export type GenerationRequest =
  | { kind: 'topic'; text: string; depthTier?: DepthTier; languageCode?: string }
  | { kind: 'notes'; text: string }
  | { kind: 'pdf'; pdf: ExtractedPDF };

/** True when there is something to generate from. */
export const hasContent = (request: GenerationRequest): boolean =>
  request.kind === 'pdf' ? request.pdf.text.trim().length > 0 : request.text.trim().length > 0;

export type GenerationStage = 'writing' | 'checking';

/** The material a deck was made from, for checking the cards against (none for a topic). */
const sourceOf = (request: GenerationRequest): string | undefined =>
  request.kind === 'pdf' ? request.pdf.text : request.kind === 'notes' ? request.text : undefined;

/**
 * Turns a request into a study session, calibrated to the student's grade and curriculum, then has
 * the AI check every card before the student sees it.
 */
export const buildSession = async (
  request: GenerationRequest,
  profile: StudentEducationProfile,
  onStage?: (stage: GenerationStage) => void,
): Promise<StudySession> => {
  onStage?.('writing');
  let session: StudySession;
  switch (request.kind) {
    case 'topic':
      session = await AIService.generateStudySession(request.text, false, request.depthTier, request.languageCode, undefined, profile);
      break;
    case 'notes':
      session = await AIService.generateStudySession(request.text, true, undefined, undefined, undefined, profile);
      break;
    case 'pdf':
      session = groundSessionInPdf(await AIService.generateStudySession(request.pdf.text, true, undefined, undefined, undefined, profile), request.pdf);
      break;
  }
  // Without AI (a template deck) there is nothing to check with.
  if (AIService.needsSignIn()) return session;
  onStage?.('checking');
  return reviewGeneratedDeck(session, sourceOf(request));
};

/** A message a student can act on, instead of a silent failure. */
export const describeGenerationError = (err: unknown): string => {
  const reason = err instanceof Error ? err.message : '';
  // A daily limit is worth saying as it is; other reasons are technical and stay in the console.
  if (/limit/i.test(reason)) return `We couldn't build your deck: ${reason.replace(/\.$/, '')}. Try again tomorrow, or add your own Gemini key in Settings → AI.`;
  if (reason) console.warn('[Deck generation]', reason);
  return "We couldn't build your deck just now. Check your connection and try again in a moment.";
};
