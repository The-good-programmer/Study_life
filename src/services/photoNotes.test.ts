import { afterEach, describe, expect, it, vi } from 'vitest';
import { AIService } from './aiService';
import { NO_TEXT, NoTextInPhotoError, appendNotes, readNotesFromPhoto } from './photoNotes';

const image = { mimeType: 'image/jpeg', data: 'abc' };

describe('reading notes from a photo', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sends the photo with the transcription prompt and returns the text', async () => {
    const spy = vi.spyOn(AIService, 'generateText').mockResolvedValue('```\nCell membrane\n- lipid bilayer\n```');
    await expect(readNotesFromPhoto(image)).resolves.toBe('Cell membrane\n- lipid bilayer');
    const [contents] = spy.mock.calls[0];
    expect(contents).toEqual([{ role: 'user', parts: [{ text: expect.stringContaining('exactly as it is written') }, { inlineData: image }] }]);
  });

  it('says so when the photo has no readable text', async () => {
    vi.spyOn(AIService, 'generateText').mockResolvedValue(NO_TEXT);
    await expect(readNotesFromPhoto(image)).rejects.toBeInstanceOf(NoTextInPhotoError);
    vi.spyOn(AIService, 'generateText').mockResolvedValue('  ');
    await expect(readNotesFromPhoto(image)).rejects.toBeInstanceOf(NoTextInPhotoError);
  });

  it('adds a photo after the notes already in the box', () => {
    expect(appendNotes('', 'B')).toBe('B');
    expect(appendNotes('A\n', 'B')).toBe('A\n\nB');
  });
});
