import type { DepthTier, StudentEducationProfile, StudySession } from '../../types';
import { AIService } from '../../services/aiService';
import type { ExtractedPDF } from '../../services/pdfService';
import { groundSessionInPdf } from './pdfGrounding';

/** What the student asked to turn into a study deck. */
export type GenerationRequest =
  | { kind: 'topic'; text: string; depthTier?: DepthTier; languageCode?: string }
  | { kind: 'notes'; text: string }
  | { kind: 'pdf'; pdf: ExtractedPDF };

/** True when there is something to generate from. */
export const hasContent = (request: GenerationRequest): boolean =>
  request.kind === 'pdf' ? request.pdf.text.trim().length > 0 : request.text.trim().length > 0;

/** Turns a request into a study session, calibrated to the student's grade and curriculum. */
export const buildSession = async (
  request: GenerationRequest,
  profile: StudentEducationProfile,
): Promise<StudySession> => {
  switch (request.kind) {
    case 'topic':
      return AIService.generateStudySession(request.text, false, request.depthTier, request.languageCode, undefined, profile);
    case 'notes':
      return AIService.generateStudySession(request.text, true, undefined, undefined, undefined, profile);
    case 'pdf': {
      const session = await AIService.generateStudySession(request.pdf.text, true, undefined, undefined, undefined, profile);
      return groundSessionInPdf(session, request.pdf);
    }
  }
};

/** A message a student can act on, instead of a silent failure. */
export const describeGenerationError = (err: unknown): string => {
  const detail = err instanceof Error && err.message ? ` (${err.message})` : '';
  return `We couldn't build your deck right now${detail}. Check your connection and Gemini API key in Settings, then try again.`;
};
