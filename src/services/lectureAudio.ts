import { AIService } from './aiService';

/**
 * Lectures and videos into notes. Audio (a recording made in Studify, or a file) is decoded in the
 * browser, mixed to one channel at 16 kHz and cut into 3-minute WAV clips; each clip is small enough
 * for one AI request (under 4 MB) and is written out on its own, so a long lecture never has to be
 * sent at once. A YouTube link goes to the AI as it is: Gemini reads public videos itself.
 */

/** Speech needs no more; the AI hears audio at 16 kHz anyway. */
export const SAMPLE_RATE = 16_000;
/** 3 minutes of 16 kHz 8-bit audio is 2.9 MB: under the 4 MB the AI service takes per clip. */
export const CLIP_SECONDS = 180;
/** Longer files take too much memory to decode in a phone's browser. */
export const MAX_AUDIO_MINUTES = 120;
export const MAX_AUDIO_FILE_BYTES = 200 * 1024 * 1024;
/** Videos are read up to this point, which keeps a long video affordable. */
export const MAX_VIDEO_SECONDS = 3600;

export const NO_SPEECH = 'NO_SPEECH';
export const NO_VIDEO_CONTENT = 'NO_STUDY_CONTENT';

export class NothingToReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NothingToReadError';
  }
}

/** The samples cut into clips of `seconds` (the last one shorter). */
export function splitSamples(samples: Float32Array, sampleRate: number, seconds = CLIP_SECONDS): Float32Array[] {
  const size = Math.max(1, Math.round(sampleRate * seconds));
  const clips: Float32Array[] = [];
  for (let start = 0; start < samples.length; start += size) clips.push(samples.subarray(start, Math.min(samples.length, start + size)));
  return clips;
}

/** The channels mixed into one. */
export function mixToMono(channels: readonly Float32Array[]): Float32Array {
  if (channels.length === 1) return channels[0];
  const out = new Float32Array(channels[0].length);
  for (const channel of channels) for (let i = 0; i < out.length; i++) out[i] += channel[i] / channels.length;
  return out;
}

/** Mono samples (-1…1) as an 8-bit PCM WAV file. */
export function encodeWav8(samples: Float32Array, sampleRate = SAMPLE_RATE): Uint8Array {
  const header = 44;
  const bytes = new Uint8Array(header + samples.length);
  const view = new DataView(bytes.buffer);
  const ascii = (offset: number, text: string) => [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + samples.length, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true); // bytes per second
  view.setUint16(32, 1, true); // block align
  view.setUint16(34, 8, true); // bits per sample
  ascii(36, 'data');
  view.setUint32(40, samples.length, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    bytes[header + i] = Math.round((s + 1) * 127.5); // 8-bit WAV is unsigned, silence at 128
  }
  return bytes;
}

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) binary += String.fromCharCode(...bytes.subarray(i, i + step));
  return btoa(binary);
}

/** Whether a clip is all but silent (a pause in a recording), so it needn't be sent. */
export function isSilent(samples: Float32Array, threshold = 0.01): boolean {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return samples.length === 0 || Math.sqrt(sum / samples.length) < threshold;
}

/** Any audio the browser can play (MP3, M4A, WAV, OGG, a recording), as 16 kHz mono samples. */
export async function decodeAudio(blob: Blob): Promise<Float32Array> {
  const data = await blob.arrayBuffer();
  const context = new OfflineAudioContext(1, 1, SAMPLE_RATE);
  const buffer = await context.decodeAudioData(data);
  return mixToMono(Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i)));
}

export const TRANSCRIBE_PROMPT = `This is part of a lecture or class a student recorded. Write out what is said, as clean paragraphs in the language spoken.
Leave out filler words, repetitions and small talk unrelated to the lesson. Keep every fact, definition, example, formula and name. Do not summarize or add anything.
If there is no speech in the audio, answer with exactly ${NO_SPEECH} and nothing else.`;

/** The words in one clip of audio, or '' for a clip with no speech. */
export async function transcribeClip(samples: Float32Array): Promise<string> {
  if (isSilent(samples)) return '';
  const data = toBase64(encodeWav8(samples));
  const reply = (
    await AIService.generateText([{ role: 'user', parts: [{ text: TRANSCRIBE_PROMPT }, { inlineData: { mimeType: 'audio/wav', data } }] }])
  ).trim();
  return !reply || reply.includes(NO_SPEECH) ? '' : reply;
}

/** The 11-character id of a YouTube video from any of its usual links, or null. */
export function youtubeVideoId(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim().startsWith('http') ? input.trim() : `https://${input.trim()}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, '');
  let id: string | null = null;
  if (host === 'youtu.be') id = url.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v');
    else {
      const match = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([\w-]{11})/);
      id = match?.[1] ?? null;
    }
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}

export const VIDEO_PROMPT = `A student wants to study this video. Write detailed study notes from it, in the language of the video:
every key idea, definition, example, formula, date and name, in the order they come up, under short headings, with "- " points.
Include what is shown on screen (slides, diagrams, worked examples) as well as what is said. Do not add facts that are not in the video.
If the video has nothing to study (music, entertainment with no lesson), answer with exactly ${NO_VIDEO_CONTENT} and nothing else.`;

/** Study notes written from a public YouTube video (its first hour). */
export async function notesFromYouTube(videoId: string): Promise<string> {
  const reply = (
    await AIService.generateText([
      {
        role: 'user',
        parts: [
          { fileData: { fileUri: `https://www.youtube.com/watch?v=${videoId}` }, videoMetadata: { endOffset: `${MAX_VIDEO_SECONDS}s` } },
          { text: VIDEO_PROMPT },
        ],
      },
    ])
  ).trim();
  if (!reply || reply.includes(NO_VIDEO_CONTENT)) throw new NothingToReadError("That video doesn't seem to have anything to study. Try a lecture or explainer video.");
  return reply.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '').trim();
}

/**
 * Records a lecture from the microphone in 3-minute parts, handing each finished part over while
 * recording goes on, so the words appear as the lecture goes. Each part is a whole audio file.
 */
export class LectureRecorder {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private wakeLock: { release: () => Promise<void> } | null = null;
  private stopping = false;

  private readonly onPart: (part: Blob) => void;
  private readonly partSeconds: number;

  constructor(onPart: (part: Blob) => void, partSeconds = CLIP_SECONDS) {
    this.onPart = onPart;
    this.partSeconds = partSeconds;
  }

  static isSupported(): boolean {
    return typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  }

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: false, noiseSuppression: true } });
    this.stopping = false;
    try {
      // Keep the screen on: a phone that locks stops the recording.
      this.wakeLock = (await (navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request('screen')) ?? null;
    } catch {
      this.wakeLock = null;
    }
    this.startPart();
  }

  private startPart() {
    if (!this.stream) return;
    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(this.stream, { audioBitsPerSecond: 32_000 });
    recorder.ondataavailable = e => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      if (chunks.length) this.onPart(new Blob(chunks, { type: recorder.mimeType }));
      if (!this.stopping) this.startPart();
    };
    recorder.start();
    this.recorder = recorder;
    this.timer = setTimeout(() => recorder.state === 'recording' && recorder.stop(), this.partSeconds * 1000);
  }

  /** Stops recording; the last part is handed over as well. */
  stop(): void {
    this.stopping = true;
    if (this.timer) clearTimeout(this.timer);
    if (this.recorder?.state === 'recording') this.recorder.stop();
    this.stream?.getTracks().forEach(track => track.stop());
    void this.wakeLock?.release().catch(() => {});
    this.stream = null;
    this.wakeLock = null;
  }
}
