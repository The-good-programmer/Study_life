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
});
