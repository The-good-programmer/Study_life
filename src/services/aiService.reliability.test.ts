import { afterEach, describe, expect, it, vi } from 'vitest';
import { AIService, describeGeminiError } from './aiService';
import { ApiConfig } from './apiConfig';
import { StorageService } from './storageService';

const concept: any = {
  id: 'c-rel',
  title: 'Competitive Enzyme Inhibition',
  mentalModel: 'Musical chairs for the active site',
  coreTakeaways: ['The inhibitor competes for the active site', 'Apparent Km rises while Vmax stays'],
  keyTerms: [{ term: 'Km', definition: 'Substrate concentration at half Vmax' }],
  feynmanPrompt: 'Explain competitive inhibition simply',
  sampleMasteryExplanation: '',
  retrievalCards: [],
};

const longExplanation =
  'The inhibitor looks like the substrate, so it sits in the active site and blocks it. Adding more substrate wins the seat back, which is why Vmax stays the same.';

/** Pretends an AI provider is set up and answers every request with `reply`. */
const aiReplies = (reply: string | Error) => {
  vi.spyOn(AIService, 'isAvailable').mockReturnValue(true);
  return vi.spyOn(AIService, 'generateText').mockImplementation(async () => {
    if (reply instanceof Error) throw reply;
    return reply;
  });
};

afterEach(() => vi.restoreAllMocks());

describe('AI reliability', () => {
  it('falls back to the self-check instead of inventing a grade when the reply has no score', async () => {
    aiReplies('{"grade": "Solid Understanding"}');
    const result = await AIService.evaluateFeynmanExplanation(concept, longExplanation);
    expect(result.isOfflineSelfCheck).toBe(true);
    expect(result.grade).toBe('Self-Review');
  });

  it('keeps a real score of zero', async () => {
    aiReplies('{"score": 0, "grade": "Novice", "masteredPoints": [], "missingNuances": ["All of it"], "jargonDetected": [], "actionableFeedback": "Start again."}');
    const result = await AIService.evaluateFeynmanExplanation(concept, longExplanation);
    expect(result.score).toBe(0);
    expect(result.isOfflineSelfCheck).toBeUndefined();
  });

  it('ends the final viva round with a structured verdict even when streaming is available', async () => {
    vi.spyOn(ApiConfig, 'canUseServerAi').mockResolvedValue(true);
    const stream = vi.spyOn(ApiConfig, 'streamRequest');
    aiReplies(JSON.stringify({
      isComplete: true,
      examinerText: 'Your defense holds.',
      turnType: 'verdict',
      reaction: 'impressed',
      reactionNote: 'Clear mechanism.',
      jargonDetected: [],
      verdict: {
        overallGrade: 'Pass with Distinction',
        depthScore: 88,
        analogyIntegrity: 85,
        jargonFreeScore: 90,
        roundsCompleted: 3,
        verdictSummary: 'Strong.',
        keyStrengths: ['Mechanism'],
        vulnerableBlindspots: ['Edge cases'],
      },
    }));

    const chunks: string[] = [];
    const response = await AIService.streamVivaVoceTurn(concept, [], longExplanation, 3, (c) => chunks.push(c));

    expect(stream).not.toHaveBeenCalled();
    expect(response.isComplete).toBe(true);
    expect(response.verdict?.overallGrade).toBe('Pass with Distinction');
    expect(chunks.join('')).toBe('Your defense holds.');
  });

  it('still gives a verdict from the offline examiner when the AI verdict is missing', async () => {
    aiReplies('{"isComplete": true, "examinerText": "Done."}');
    const response = await AIService.conductVivaVoceTurn(concept, [], longExplanation, 3);
    expect(response.isComplete).toBe(true);
    expect(response.verdict?.overallGrade).toBeTruthy();
  });

  it('does not call a failed offline defense a success', async () => {
    const weak = await AIService.conductVivaVoceTurn(concept, [], 'Km is a thing.', 3);
    expect(weak.verdict?.overallGrade).toBe('Incomplete Defense');
    expect(weak.verdict?.verdictSummary).toMatch(/not yet explained/);

    const strong = await AIService.conductVivaVoceTurn(
      concept,
      [],
      'Think of it like musical chairs: the inhibitor resembles the substrate, so it takes the active site seat and blocks binding. Because more substrate wins the seat back more often, the enzyme still reaches the same top speed, which leads to a higher apparent Km but the same Vmax overall.',
      3,
    );
    expect(['Pass with Distinction', 'Summa Cum Laude']).toContain(strong.verdict?.overallGrade);
  });

  it('reports a failed deck generation instead of saving a template deck as the AI result', async () => {
    aiReplies(new Error('Daily AI limit reached.'));
    await expect(AIService.generateStudySession('Photosynthesis')).rejects.toThrow('Daily AI limit reached.');
  });

  it('rejects an AI reply with no concepts', async () => {
    aiReplies('{"title": "Empty"}');
    await expect(AIService.generateStudySession('Photosynthesis')).rejects.toThrow(/no study concepts/);
  });

  it('still builds an offline deck when no AI is set up', async () => {
    vi.spyOn(AIService, 'isAvailable').mockReturnValue(false);
    const session = await AIService.generateStudySession('Photosynthesis');
    expect(session.concepts.length).toBeGreaterThan(0);
  });

  it("passes on the shared service's reason when it refuses a request", async () => {
    vi.spyOn(ApiConfig, 'canUseServerAi').mockResolvedValue(true);
    vi.spyOn(ApiConfig, 'request').mockResolvedValue({ ok: false, status: 429, error: 'Daily AI limit reached.' });
    vi.spyOn(StorageService, 'getApiKey').mockReturnValue(null as unknown as string);
    await expect(AIService.generateText('hi')).rejects.toThrow('Daily AI limit reached.');
  });
});

describe('describeGeminiError', () => {
  it('turns raw SDK errors into sentences a student can act on', () => {
    const sdk = (code: number, status: string) => new Error(JSON.stringify({ error: { code, message: 'x', status } }));
    expect(describeGeminiError(sdk(429, 'RESOURCE_EXHAUSTED'))).toMatch(/usage limit/);
    expect(describeGeminiError(new Error('API key not valid. Please pass a valid API key.'))).toMatch(/refused your Gemini API key/);
    expect(describeGeminiError(sdk(404, 'NOT_FOUND'))).toMatch(/None of Studify's AI models/);
    expect(describeGeminiError(sdk(503, 'UNAVAILABLE'))).toMatch(/busy/);
    expect(describeGeminiError(new TypeError('Failed to fetch'))).toMatch(/connection/);
    expect(describeGeminiError(new Error('Something else'))).toBe('Something else');
  });

  it('is what a failing client key reports', async () => {
    vi.spyOn(ApiConfig, 'canUseServerAi').mockResolvedValue(false);
    vi.spyOn(StorageService, 'getApiKey').mockReturnValue('test-key');
    vi.spyOn(AIService as any, 'generateContentWithFallback').mockRejectedValue(new Error('{"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}'));
    await expect(AIService.generateText('hi')).rejects.toThrow(/usage limit/);
  });
});
