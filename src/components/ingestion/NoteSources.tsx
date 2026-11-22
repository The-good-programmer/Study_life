import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Camera, FileAudio, Mic, RefreshCw, Square, SquarePlay } from 'lucide-react';
import { photoForAi } from '../../utils/photoForAi';
import { MAX_NOTE_PHOTOS, NoTextInPhotoError, readNotesFromPhoto } from '../../services/photoNotes';
import {
  CLIP_SECONDS,
  LectureRecorder,
  MAX_AUDIO_FILE_BYTES,
  MAX_AUDIO_MINUTES,
  NothingToReadError,
  SAMPLE_RATE,
  decodeAudio,
  notesFromYouTube,
  splitSamples,
  transcribeClip,
  youtubeVideoId,
} from '../../services/lectureAudio';
import { Button } from '../ui/primitives';

type Busy =
  | { kind: 'photos'; done: number; total: number }
  | { kind: 'audio'; done: number; total: number }
  | { kind: 'video' }
  | { kind: 'recording'; seconds: number; parts: number; pending: number }
  | { kind: 'finishing'; pending: number };

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/**
 * Ways to fill the notes box besides typing: photos of notes, a lecture recorded here, an audio file,
 * or a YouTube video. The AI writes out the text and it is added to the box for the student to check.
 */
export const NoteSources: React.FC<{
  onAddText: (text: string) => void;
  onBusyChange: (busy: boolean) => void;
  needsSignIn: boolean;
  onNeedSignIn?: () => void;
  disabled?: boolean;
}> = ({ onAddText, onBusyChange, needsSignIn, onNeedSignIn, disabled }) => {
  const [busy, setBusyState] = useState<Busy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showVideo, setShowVideo] = useState(false);
  const [videoLink, setVideoLink] = useState('');
  const photoInput = useRef<HTMLInputElement>(null);
  const audioInput = useRef<HTMLInputElement>(null);
  const recorder = useRef<LectureRecorder | null>(null);
  const partQueue = useRef<Promise<void>>(Promise.resolve());
  const counts = useRef({ parts: 0, pending: 0, failed: 0 });

  const setBusy = (next: Busy | null | ((prev: Busy | null) => Busy | null)) => {
    setBusyState(prev => {
      const value = typeof next === 'function' ? next(prev) : next;
      if (!!value !== !!prev) onBusyChange(!!value);
      return value;
    });
  };

  // Leaving the tab or page stops the microphone, and the notes box isn't held as busy.
  const onBusyChangeRef = useRef(onBusyChange);
  useEffect(() => {
    onBusyChangeRef.current = onBusyChange;
  }, [onBusyChange]);
  useEffect(
    () => () => {
      recorder.current?.stop();
      onBusyChangeRef.current(false);
    },
    [],
  );

  // The recording clock.
  const recording = busy?.kind === 'recording';
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setBusyState(prev => (prev?.kind === 'recording' ? { ...prev, seconds: prev.seconds + 1 } : prev)), 1000);
    return () => clearInterval(timer);
  }, [recording]);

  /** AI needs an account (or the student's own key): ask them to sign in instead of failing. */
  const canUseAi = () => {
    if (!needsSignIn) return true;
    onNeedSignIn?.();
    return false;
  };

  const handlePhotos = async (list: FileList | null) => {
    const files = Array.from(list ?? []).filter(f => f.type.startsWith('image/'));
    if (photoInput.current) photoInput.current.value = '';
    if (files.length === 0 || !canUseAi()) return;
    const chosen = files.slice(0, MAX_NOTE_PHOTOS);
    setError(files.length > MAX_NOTE_PHOTOS ? `Only the first ${MAX_NOTE_PHOTOS} photos were read. Add the rest after these.` : null);
    let unread = 0;
    for (let i = 0; i < chosen.length; i++) {
      setBusy({ kind: 'photos', done: i, total: chosen.length });
      try {
        onAddText(await readNotesFromPhoto(await photoForAi(chosen[i])));
      } catch (err) {
        unread++;
        if (!(err instanceof NoTextInPhotoError)) console.error('[Notes photo]', err);
        setError(
          err instanceof NoTextInPhotoError
            ? err.message
            : chosen.length > 1
              ? `${unread} of ${chosen.length} photos couldn't be read. Check your connection and try those again.`
              : "That photo couldn't be read. Check your connection and try again.",
        );
      }
    }
    setBusy(null);
  };

  const handleAudioFile = async (list: FileList | null) => {
    const file = list?.[0];
    if (audioInput.current) audioInput.current.value = '';
    if (!file || !canUseAi()) return;
    setError(null);
    if (file.size > MAX_AUDIO_FILE_BYTES) {
      setError('That file is too big. Use a recording under 2 hours.');
      return;
    }
    setBusy({ kind: 'audio', done: 0, total: 0 });
    let samples: Float32Array;
    try {
      samples = await decodeAudio(file);
    } catch {
      setBusy(null);
      setError("Couldn't open that file. Use an MP3, M4A, WAV or OGG recording.");
      return;
    }
    if (samples.length > MAX_AUDIO_MINUTES * 60 * SAMPLE_RATE) {
      setBusy(null);
      setError(`That recording is over ${MAX_AUDIO_MINUTES / 60} hours. Cut it into shorter parts and add them one by one.`);
      return;
    }
    const clips = splitSamples(samples, SAMPLE_RATE);
    let failed = 0;
    let heard = 0;
    for (let i = 0; i < clips.length; i++) {
      setBusy({ kind: 'audio', done: i, total: clips.length });
      try {
        const text = await transcribeClip(clips[i]);
        if (text) {
          heard++;
          onAddText(text);
        }
      } catch (err) {
        failed++;
        console.error('[Lecture audio]', err);
      }
    }
    setBusy(null);
    if (failed > 0) setError(`${failed} of ${clips.length} parts couldn't be written out. Check your connection, then add the file again for the missing parts.`);
    else if (heard === 0) setError("Couldn't hear any speech in that recording.");
  };

  /** Writes out one recorded part, after the ones before it. */
  const queuePart = (part: Blob) => {
    counts.current.pending++;
    setBusyState(prev => (prev && 'pending' in prev ? { ...prev, pending: counts.current.pending } : prev));
    partQueue.current = partQueue.current.then(async () => {
      try {
        const samples = await decodeAudio(part);
        for (const clip of splitSamples(samples, SAMPLE_RATE)) {
          const text = await transcribeClip(clip);
          if (text) onAddText(text);
        }
      } catch (err) {
        counts.current.failed++;
        console.error('[Lecture recording]', err);
        setError(`${counts.current.failed} ${counts.current.failed === 1 ? 'part' : 'parts'} of the recording couldn't be written out. Check your connection.`);
      } finally {
        counts.current.pending--;
        counts.current.parts++;
        setBusy(prev => {
          if (prev?.kind === 'recording') return { ...prev, parts: counts.current.parts, pending: counts.current.pending };
          if (prev?.kind === 'finishing') return counts.current.pending > 0 ? { ...prev, pending: counts.current.pending } : null;
          return prev;
        });
      }
    });
  };

  const startRecording = async () => {
    if (!canUseAi()) return;
    setError(null);
    counts.current = { parts: 0, pending: 0, failed: 0 };
    const next = new LectureRecorder(queuePart, CLIP_SECONDS);
    try {
      await next.start();
    } catch {
      setError('Studify needs the microphone to record. Allow it in your browser and try again.');
      return;
    }
    recorder.current = next;
    setBusy({ kind: 'recording', seconds: 0, parts: 0, pending: 0 });
  };

  const stopRecording = () => {
    recorder.current?.stop();
    recorder.current = null;
    // The last part is handed over as the recorder stops; it shows as pending a moment later.
    setBusy({ kind: 'finishing', pending: Math.max(1, counts.current.pending) });
    void partQueue.current.then(() =>
      setTimeout(() => {
        void partQueue.current.then(() => setBusy(prev => (prev?.kind === 'finishing' && counts.current.pending === 0 ? null : prev)));
      }, 300),
    );
  };

  const handleVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = youtubeVideoId(videoLink);
    if (!id) {
      setError('Paste a YouTube link, like https://www.youtube.com/watch?v=…');
      return;
    }
    if (!canUseAi()) return;
    setError(null);
    setBusy({ kind: 'video' });
    try {
      onAddText(await notesFromYouTube(id));
      setVideoLink('');
      setShowVideo(false);
    } catch (err) {
      setError(
        err instanceof NothingToReadError
          ? err.message
          : "Couldn't read that video. It has to be public on YouTube; private and members-only videos can't be read.",
      );
    } finally {
      setBusy(null);
    }
  };

  const status = (() => {
    if (!busy) return null;
    switch (busy.kind) {
      case 'photos':
        return busy.total > 1 ? `Reading photo ${busy.done + 1} of ${busy.total}…` : 'Reading your photo…';
      case 'audio':
        return busy.total === 0 ? 'Opening the recording…' : `Writing out part ${busy.done + 1} of ${busy.total} (3 minutes each)…`;
      case 'video':
        return 'Watching the video and writing notes. A long video takes a minute or two…';
      case 'recording':
        return `Recording ${clock(busy.seconds)}. Keep Studify open. The words appear every 3 minutes${busy.parts ? ` (${busy.parts} written out)` : ''}.`;
      case 'finishing':
        return 'Writing out the last part…';
    }
  })();

  const idle = !busy && !disabled;

  return (
    <div className="space-y-2.5">
      <input ref={photoInput} type="file" accept="image/*" multiple onChange={e => void handlePhotos(e.target.files)} className="hidden" tabIndex={-1} aria-hidden="true" />
      <input ref={audioInput} type="file" accept="audio/*,.m4a,.mp3,.wav,.ogg" onChange={e => void handleAudioFile(e.target.files)} className="hidden" tabIndex={-1} aria-hidden="true" />

      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <Button size="sm" icon={Camera} onClick={() => photoInput.current?.click()} disabled={!idle}>
          Add photos
        </Button>
        {recording ? (
          <Button size="sm" variant="danger" icon={Square} onClick={stopRecording}>
            Stop {clock(busy.seconds)}
          </Button>
        ) : (
          <Button size="sm" icon={Mic} onClick={() => void startRecording()} disabled={!idle || !LectureRecorder.isSupported()}>
            Record lecture
          </Button>
        )}
        <Button size="sm" icon={FileAudio} onClick={() => audioInput.current?.click()} disabled={!idle}>
          Audio file
        </Button>
        <Button size="sm" icon={SquarePlay} onClick={() => setShowVideo(v => !v)} disabled={!idle} aria-expanded={showVideo}>
          YouTube link
        </Button>
      </div>

      {showVideo && (
        <form onSubmit={e => void handleVideo(e)} className="flex gap-2 animate-fadeIn">
          <label htmlFor="youtube-link" className="sr-only">
            YouTube link
          </label>
          <input
            id="youtube-link"
            value={videoLink}
            onChange={e => setVideoLink(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=…"
            inputMode="url"
            autoComplete="off"
            disabled={!!busy}
            className="h-10 min-w-0 flex-1 rounded-xl border border-line-strong bg-canvas px-3 text-sm text-ink placeholder:text-ink-subtle transition-colors focus:border-brand focus:outline-none"
          />
          <Button type="submit" variant="secondary" disabled={!videoLink.trim() || !!busy}>
            Get notes
          </Button>
        </form>
      )}

      {status ? (
        <p className="flex items-start gap-2 text-xs text-ink-muted" role="status" aria-live="polite">
          {busy?.kind === 'recording' ? (
            <span className="mt-1 h-2 w-2 shrink-0 animate-pulse rounded-full bg-danger" aria-hidden="true" />
          ) : (
            <RefreshCw className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />
          )}
          {status}
        </p>
      ) : (
        <p className="text-xs text-ink-subtle">
          The AI writes out photos, lectures (up to {MAX_AUDIO_MINUTES / 60} hours) and YouTube videos (the first hour) into the box above, for you to check.
        </p>
      )}

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
};
