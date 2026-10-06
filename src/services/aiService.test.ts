import { describe, it, expect } from 'vitest';
import { AIService } from './aiService';

describe('AIService', () => {
  it('correctly identifies models that support reasoning / thinkingConfig', () => {
    expect(AIService.supportsThinking('gemini-2.5-flash')).toBe(true);
    expect(AIService.supportsThinking('gemini-2.5-flash-lite')).toBe(true);
    expect(AIService.supportsThinking('gemini-2.5-pro')).toBe(true);
    expect(AIService.supportsThinking('gemini-3.1-pro-preview')).toBe(true);

    expect(AIService.supportsThinking('gemini-2.0-flash')).toBe(false);
    expect(AIService.supportsThinking('gemini-1.5-pro')).toBe(false);
    expect(AIService.supportsThinking('gemini-1.5-flash')).toBe(false);
  });

  it('safely extracts and parses JSON even with markdown fences or surrounding chatter', () => {
    const rawWithMarkdown = '```json\n{"score": 92, "mastered": true}\n```';
    const parsed1 = AIService.safeParseJSON(rawWithMarkdown, { score: 0 });
    expect(parsed1.score).toBe(92);

    const rawWithChatter = 'Here is your evaluation:\n{"feedback": "Well done", "points": [1, 2]}\nHope this helps!';
    const parsed2 = AIService.safeParseJSON(rawWithChatter, { feedback: '' });
    expect(parsed2.feedback).toBe('Well done');
    expect((parsed2 as any).points).toEqual([1, 2]);

    const invalid = 'Sorry, unable to evaluate right now.';
    const fallback = { fallback: true };
    const parsed3 = AIService.safeParseJSON(invalid, fallback);
    expect(parsed3).toEqual(fallback);
  });

  it('performs structured offline Feynman evaluation with anchor rubrics', async () => {
    const mockConcept: any = {
      id: 'c-test-1',
      title: 'Action Potential Depolarization',
      mentalModel: 'Voltage-gated gates swinging open',
      coreTakeaways: ['Voltage-gated Na+ channels open', 'Membrane potential rises to +30mV'],
      keyTerms: [{ term: 'Sodium', definition: 'Positively charged cation' }],
      feynmanPrompt: 'Explain how depolarization works to a 10 year old',
      sampleMasteryExplanation: 'Sodium ions rush in through open channels...',
    };

    const shortAttempt = await AIService.evaluateFeynmanExplanation(mockConcept, 'It depolarizes.');
    expect(shortAttempt.score).toBe(30);
    expect(shortAttempt.grade).toBe('Novice');
    expect(shortAttempt.actionableFeedback).toBeTruthy();

    const solidAttempt = await AIService.evaluateFeynmanExplanation(
      mockConcept,
      'When the cell reaches threshold voltage, voltage-gated sodium channels open rapidly. Positively charged sodium ions rush into the cell down their electrochemical gradient, causing the internal potential to become positive and depolarize.'
    );
    expect(solidAttempt.isOfflineSelfCheck).toBe(true);
    expect(solidAttempt.grade).toBe('Self-Review');
    expect(solidAttempt.masteredPoints.length).toBeGreaterThan(0);
    expect(solidAttempt.actionableFeedback).toBeTruthy();
  });

  it('streams Socratic viva voce tokens smoothly with typewriter chunks', async () => {
    const mockConcept: any = {
      id: 'c-test-2',
      title: 'Competitive Enzyme Inhibition',
      mentalModel: 'Musical chairs for active site',
      coreTakeaways: ['Inhibitor competes for active site', 'Increases apparent Km without changing Vmax'],
      keyTerms: [{ term: 'Km', definition: 'Substrate concentration at half Vmax' }],
    };

    const chunks: string[] = [];
    const response = await AIService.streamVivaVoceTurn(
      mockConcept,
      [],
      'The competitive inhibitor resembles the substrate and binds the active site, requiring higher substrate to reach Vmax.',
      1,
      (chunk) => chunks.push(chunk)
    );

    expect(chunks.length).toBeGreaterThan(0);
    expect(response.nextTurn).toBeDefined();
    expect(response.nextTurn.role).toBe('examiner');
    expect(response.nextTurn.text.length).toBeGreaterThan(10);
  });

  it('adapts heuristic viva voce examiner according to concept retrievability state', async () => {
    const strugglingConcept: any = {
      id: 'c-struggle',
      title: 'Action Potential Threshold',
      mentalModel: 'Domino tipping point',
      coreTakeaways: ['All-or-nothing threshold', 'Depolarization cascade'],
      keyTerms: [{ term: 'Threshold', definition: 'Voltage level required to fire' }],
      retrievalCards: [
        {
          id: 'card-str-1',
          question: 'What is threshold?',
          answer: '-55mV level',
          lapses: 4,
          stability: 1,
          retrievability: 35,
          lastReviewDate: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
        }
      ]
    };

    const scaffoldTurn = await AIService.conductVivaVoceTurn(
      strugglingConcept,
      [],
      'It fires when it reaches threshold.',
      1
    );

    expect(scaffoldTurn.nextTurn.text).toContain('deconstruct the mechanism step-by-step');

    const masteredConcept: any = {
      id: 'c-mastered',
      title: 'Action Potential Threshold',
      mentalModel: 'Domino tipping point',
      coreTakeaways: ['All-or-nothing threshold', 'Depolarization cascade'],
      keyTerms: [{ term: 'Threshold', definition: 'Voltage level required to fire' }],
      retrievalCards: [
        {
          id: 'card-mas-1',
          question: 'What is threshold?',
          answer: '-55mV level',
          lapses: 0,
          stability: 25,
          retrievability: 96,
          lastReviewDate: new Date().toISOString(),
        }
      ]
    };

    const adversarialTurn = await AIService.conductVivaVoceTurn(
      masteredConcept,
      [],
      'It fires when threshold reaches -55mV.',
      1
    );

    expect(adversarialTurn.nextTurn.text).toContain('advanced defense demands stress-testing');
  });
});
