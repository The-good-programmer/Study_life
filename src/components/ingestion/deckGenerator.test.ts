import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ConceptCheckpoint, RetrievalCard, StudentEducationProfile, StudySession } from '../../types';
import type { ExtractedPDF } from '../../services/pdfService';
import { AIService } from '../../services/aiService';
import { buildSession, describeGenerationError, hasContent } from './deckGenerator';
import { groundSessionInPdf } from './pdfGrounding';

const profile: StudentEducationProfile = { age: 15, country: 'United States', grade: '10th Grade' };

const card = (id: string, question: string, answer: string): RetrievalCard =>
  ({ id, conceptId: 'k1', question, answer, stability: 0, difficulty: 5, reps: 0, lapses: 0 }) as RetrievalCard;

const session = (): StudySession =>
  ({
    id: 's1',
    title: 'AI title',
    concepts: [
      {
        id: 'k1',
        title: 'Mitochondria',
        coreTakeaways: ['Powerhouse of the cell'],
        keyTerms: [{ term: 'ATP synthase', definition: '' }],
        retrievalCards: [card('c1', 'Which organelle makes ATP?', 'Mitochondria'), card('c2', 'What carries instructions?', 'Ribosome')],
      } as unknown as ConceptCheckpoint,
    ],
  }) as unknown as StudySession;

const pdf: ExtractedPDF = {
  text: 'lecture text',
  numPages: 2,
  wordCount: 40,
  fileName: 'biology-notes.pdf',
  pdfDataUrl: 'data:application/pdf;base64,AAA',
  pages: [
    { pageNumber: 1, text: 'The ribosome reads messenger RNA to build proteins.' },
    { pageNumber: 2, text: 'Mitochondria make ATP using ATP synthase in the inner membrane.' },
  ],
} as ExtractedPDF;

describe('groundSessionInPdf', () => {
  it('names the deck after the file and attaches the source document', () => {
    const grounded = groundSessionInPdf(session(), pdf);
    expect(grounded.title).toBe('biology-notes.pdf');
    expect(grounded.sourceDocument).toMatchObject({ name: 'biology-notes.pdf', totalPages: 2, pdfDataUrl: pdf.pdfDataUrl });
  });

  it('anchors concepts and each card to the page that mentions them', () => {
    const grounded = groundSessionInPdf(session(), pdf);
    const concept = grounded.concepts[0];
    expect(concept.sourceAnchor?.pageNumber).toBe(2);
    expect(concept.retrievalCards[0].sourceAnchor?.pageNumber).toBe(2);
    expect(concept.retrievalCards[1].sourceAnchor?.pageNumber).toBe(1);
  });

  it('does not mutate the input session', () => {
    const original = session();
    groundSessionInPdf(original, pdf);
    expect(original.title).toBe('AI title');
    expect(original.concepts[0].retrievalCards[0].sourceAnchor).toBeUndefined();
  });
});

describe('buildSession', () => {
  let generate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    generate = vi.spyOn(AIService, 'generateStudySession').mockImplementation(async () => session());
  });

  it('passes depth tier and language through for a topic', async () => {
    await buildSession({ kind: 'topic', text: 'Photosynthesis', depthTier: 'intermediate' as never, languageCode: 'es' }, profile);
    expect(generate).toHaveBeenCalledWith('Photosynthesis', false, 'intermediate', 'es', undefined, profile);
  });

  it('treats pasted notes as raw notes', async () => {
    await buildSession({ kind: 'notes', text: 'my messy notes' }, profile);
    expect(generate).toHaveBeenCalledWith('my messy notes', true, undefined, undefined, undefined, profile);
  });

  it('generates from the PDF text and grounds the result in the document', async () => {
    const result = await buildSession({ kind: 'pdf', pdf }, profile);
    expect(generate).toHaveBeenCalledWith('lecture text', true, undefined, undefined, undefined, profile);
    expect(result.title).toBe('biology-notes.pdf');
    expect(result.concepts[0].retrievalCards[0].sourceAnchor).toBeDefined();
  });

  it('lets generation errors reach the caller', async () => {
    generate.mockRejectedValueOnce(new Error('quota exceeded'));
    await expect(buildSession({ kind: 'notes', text: 'x' }, profile)).rejects.toThrow('quota exceeded');
  });
});

describe('hasContent', () => {
  it('ignores blank text and empty PDFs', () => {
    expect(hasContent({ kind: 'topic', text: '   ' })).toBe(false);
    expect(hasContent({ kind: 'notes', text: '' })).toBe(false);
    expect(hasContent({ kind: 'pdf', pdf: { ...pdf, text: ' ' } })).toBe(false);
    expect(hasContent({ kind: 'topic', text: 'Photosynthesis' })).toBe(true);
    expect(hasContent({ kind: 'pdf', pdf })).toBe(true);
  });
});

describe('describeGenerationError', () => {
  it('passes on a daily limit, and keeps technical reasons out of sight', () => {
    const limit = describeGenerationError(new Error('Daily AI limit reached.'));
    expect(limit).toMatch(/couldn't build your deck/i);
    expect(limit).toContain('Daily AI limit reached');
    expect(limit).toMatch(/tomorrow/);

    const technical = describeGenerationError(new Error('No AI provider available (server offline and no client API key configured).'));
    expect(technical).toMatch(/couldn't build your deck/i);
    expect(technical).not.toMatch(/provider|API key/);
  });

  it('copes with non-Error values', () => {
    expect(describeGenerationError('boom')).toMatch(/couldn't build your deck/i);
    expect(describeGenerationError(undefined)).not.toContain('()');
  });
});

describe('checking a new deck', () => {
  it('has the AI check the cards against the notes, and says which step it is on', async () => {
    vi.spyOn(AIService, 'generateStudySession').mockImplementation(async () => session());
    vi.spyOn(AIService, 'needsSignIn').mockReturnValue(false);
    const review = vi.spyOn(AIService, 'generateText').mockResolvedValue(JSON.stringify({ cards: [{ id: 'c2', verdict: 'fix', answer: 'DNA', reason: 'Ribosomes build proteins' }] }));
    const stages: string[] = [];
    const result = await buildSession({ kind: 'notes', text: 'my notes about cells' }, profile, stage => stages.push(stage));
    expect(stages).toEqual(['writing', 'checking']);
    expect(String(review.mock.calls[0][0])).toContain('my notes about cells');
    expect(result.concepts[0].retrievalCards[1].answer).toBe('DNA');
    expect(result.quality).toEqual({ checked: 1, fixed: 1, removed: 0 });
    vi.restoreAllMocks();
  });
});

