import type { StudySession } from '../../types';
import { PDFService } from '../../services/pdfService';
import type { ExtractedPDF } from '../../services/pdfService';

/**
 * Attaches the source PDF to a generated session and anchors every concept and
 * flashcard to the page it most likely came from, so the split reader can jump there.
 */
export const groundSessionInPdf = (session: StudySession, pdf: ExtractedPDF): StudySession => ({
  ...session,
  title: pdf.fileName,
  sourceDocument: {
    name: pdf.fileName,
    totalPages: pdf.numPages,
    pages: pdf.pages,
    pdfDataUrl: pdf.pdfDataUrl,
  },
  concepts: session.concepts.map(concept => {
    const conceptKeywords = [concept.title, ...concept.coreTakeaways, ...concept.keyTerms.map(k => k.term)];
    return {
      ...concept,
      sourceAnchor: PDFService.findBestSourceAnchor(conceptKeywords, pdf.pages, pdf.fileName),
      retrievalCards: concept.retrievalCards.map(card => ({
        ...card,
        sourceAnchor: PDFService.findBestSourceAnchor(
          [card.question, card.answer, ...(card.options || [])],
          pdf.pages,
          pdf.fileName,
        ),
      })),
    };
  }),
});
