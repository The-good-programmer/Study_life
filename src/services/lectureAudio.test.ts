import { afterEach, describe, expect, it, vi } from 'vitest';
import { AIService } from './aiService';
import { NO_SPEECH, NothingToReadError, encodeWav8, isSilent, mixToMono, notesFromYouTube, splitSamples, toBase64, transcribeClip, youtubeVideoId } from './lectureAudio';

const tone = (n: number, amp = 0.5) => Float32Array.from({ length: n }, (_, i) => amp * Math.sin(i / 5));

describe('lecture audio', () => {
  afterEach(() => vi.restoreAllMocks());

  it('cuts audio into 3-minute clips small enough for one AI request', () => {
    const clips = splitSamples(new Float32Array(16_000 * 400), 16_000);
    expect(clips.map(c => c.length / 16_000)).toEqual([180, 180, 40]);
    const wav = encodeWav8(clips[0]);
    expect(wav.length).toBeLessThan(4 * 1024 * 1024);
    expect(toBase64(wav).length * 0.75).toBeLessThan(4 * 1024 * 1024);
  });

  it('writes a valid 8-bit mono WAV', () => {
    const wav = encodeWav8(Float32Array.from([-1, 0, 1]), 16_000);
    const view = new DataView(wav.buffer);
    expect(new TextDecoder().decode(wav.subarray(0, 4))).toBe('RIFF');
    expect(new TextDecoder().decode(wav.subarray(8, 12))).toBe('WAVE');
    expect([view.getUint16(22, true), view.getUint32(24, true), view.getUint16(34, true), view.getUint32(40, true)]).toEqual([1, 16_000, 8, 3]);
    expect([...wav.subarray(44)]).toEqual([0, 128, 255]);
  });

  it('mixes stereo to mono and spots silence', () => {
    expect([...mixToMono([Float32Array.from([1, 0]), Float32Array.from([0, 0])])]).toEqual([0.5, 0]);
    expect(isSilent(new Float32Array(1000))).toBe(true);
    expect(isSilent(tone(1000))).toBe(false);
  });

  it('sends a clip as WAV and returns its words, skipping silence and clips with no speech', async () => {
    const spy = vi.spyOn(AIService, 'generateText').mockResolvedValueOnce(' Today: the cell membrane. ').mockResolvedValueOnce(NO_SPEECH);
    await expect(transcribeClip(tone(16_000))).resolves.toBe('Today: the cell membrane.');
    expect(spy.mock.calls[0][0][0].parts[1].inlineData.mimeType).toBe('audio/wav');
    await expect(transcribeClip(tone(16_000))).resolves.toBe('');
    await expect(transcribeClip(new Float32Array(16_000))).resolves.toBe('');
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('reads the video id from every kind of YouTube link', () => {
    for (const link of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s',
      'youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ?si=abc',
      'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
      'https://www.youtube.com/live/dQw4w9WgXcQ',
    ]) {
      expect(youtubeVideoId(link)).toBe('dQw4w9WgXcQ');
    }
    expect(youtubeVideoId('https://vimeo.com/123')).toBeNull();
    expect(youtubeVideoId('not a link')).toBeNull();
  });

  it('asks for notes from the video, its first hour only', async () => {
    const spy = vi.spyOn(AIService, 'generateText').mockResolvedValue('## Cells\n- Membrane');
    await expect(notesFromYouTube('dQw4w9WgXcQ')).resolves.toBe('## Cells\n- Membrane');
    expect(spy.mock.calls[0][0][0].parts[0]).toEqual({ fileData: { fileUri: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }, videoMetadata: { endOffset: '3600s' } });
    spy.mockResolvedValue('NO_STUDY_CONTENT');
    await expect(notesFromYouTube('dQw4w9WgXcQ')).rejects.toBeInstanceOf(NothingToReadError);
  });
});
