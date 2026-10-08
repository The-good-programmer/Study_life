import React, { useEffect, useState } from 'react';
import { Headphones, Pause, Play, SkipBack, SkipForward, X } from 'lucide-react';
import type { ConceptCheckpoint, StudySession } from '../../types';
import { speechService } from '../../services/speechService';
import { cn } from '../../utils/cn';
import { IconButton } from '../ui/primitives';

interface AudioBriefingBarProps {
  session: StudySession;
  initialConceptIndex?: number;
  onClose?: () => void;
}

const SPEEDS = [1, 1.25, 1.5, 0.75];

/** What is read aloud for one concept; sections without content are left out. */
const speechFor = (concept: ConceptCheckpoint, index: number, total: number): string =>
  [
    `Concept ${index + 1} of ${total}: ${concept.title}.`,
    concept.mentalModel && `The big idea. ${concept.mentalModel}`,
    concept.coreTakeaways?.length ? `Key points. ${concept.coreTakeaways.join('. ')}.` : '',
    concept.keyTerms?.length ? `Key terms. ${concept.keyTerms.map(t => `${t.term}: ${t.definition}`).join('. ')}.` : '',
  ]
    .filter(Boolean)
    .join(' ');

/** A player that reads the deck aloud, concept by concept, with the browser's own voice. */
export const AudioBriefingBar: React.FC<AudioBriefingBarProps> = ({ session, initialConceptIndex = 0, onClose }) => {
  const concepts = session.concepts;
  const [index, setIndex] = useState(Math.min(initialConceptIndex, Math.max(0, concepts.length - 1)));
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(() => speechService.getRate());
  const supported = speechService.isSupported();
  const concept = concepts[index];

  useEffect(() => {
    const unsubscribe = speechService.subscribe(setIsPlaying);
    return () => {
      unsubscribe();
      speechService.stop();
    };
  }, []);

  /** Reads one concept, then moves on to the next until the deck ends. */
  const playFrom = (start: number) => {
    const target = concepts[start];
    if (!target) return;
    setIndex(start);
    setIsPaused(false);
    speechService.speak(speechFor(target, start, concepts.length), () => {
      if (start + 1 < concepts.length) playFrom(start + 1);
    });
  };

  const togglePlay = () => {
    if (isPlaying) {
      speechService.pause();
      setIsPaused(true);
    } else if (isPaused && speechService.isPaused()) {
      speechService.resume();
      setIsPaused(false);
    } else {
      playFrom(index);
    }
  };

  const jump = (to: number) => {
    if (to < 0 || to >= concepts.length) return;
    if (isPlaying || isPaused) playFrom(to);
    else setIndex(to);
  };

  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length] ?? 1;
    setSpeed(next);
    speechService.setRate(next);
    // The browser can't change the speed of words already queued, so restart this concept.
    if (isPlaying || isPaused) playFrom(index);
  };

  const close = () => {
    speechService.stop();
    onClose?.();
  };

  return (
    <div
      role="region"
      aria-label="Audio briefing"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex justify-center px-3 animate-rise md:bottom-5 md:justify-end md:px-6"
    >
      <div className="pointer-events-auto flex w-full max-w-xl items-center gap-3 rounded-2xl border border-line-strong bg-surface-solid/95 p-2 pr-2.5 shadow-[0_16px_40px_-18px_rgb(0_0_0/0.6)] backdrop-blur-xl">
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-text" aria-hidden="true">
          {isPlaying ? (
            <span className="flex h-4 items-end gap-0.5">
              <span className="w-0.5 rounded-full bg-current animate-eq-1" />
              <span className="w-0.5 rounded-full bg-current animate-eq-2" />
              <span className="w-0.5 rounded-full bg-current animate-eq-3" />
              <span className="w-0.5 rounded-full bg-current animate-eq-4" />
            </span>
          ) : (
            <Headphones className="h-[18px] w-[18px]" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-ink-subtle">
            {supported ? (
              <>
                {session.title} · {index + 1} of {concepts.length}
              </>
            ) : (
              "This browser can't read aloud. Try Chrome, Edge or Safari."
            )}
          </p>
          <p className="truncate text-[13px] font-medium text-ink">{concept?.title ?? session.title}</p>
          <div className="mt-1.5 flex gap-0.5" aria-hidden="true">
            {concepts.map((c, i) => (
              <span key={c.id} className={cn('h-1 flex-1 rounded-full', i < index ? 'bg-brand' : i === index ? 'bg-brand/60' : 'bg-surface-hover')} />
            ))}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <span className="hidden sm:flex">
            <IconButton icon={SkipBack} label="Previous concept" onClick={() => jump(index - 1)} disabled={index === 0} className="disabled:opacity-40" />
          </span>
          <button
            type="button"
            onClick={togglePlay}
            disabled={!supported || !concept}
            aria-label={isPlaying ? 'Pause' : isPaused ? 'Resume' : 'Play'}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-brand-ink transition-colors hover:bg-brand-hover disabled:opacity-50 cursor-pointer"
          >
            {isPlaying ? <Pause className="h-4 w-4 fill-current" aria-hidden="true" /> : <Play className="ml-0.5 h-4 w-4 fill-current" aria-hidden="true" />}
          </button>
          <IconButton icon={SkipForward} label="Next concept" onClick={() => jump(index + 1)} disabled={index >= concepts.length - 1} className="disabled:opacity-40" />
          <button
            type="button"
            onClick={cycleSpeed}
            aria-label={`Speed ${speed} times. Change speed`}
            className="h-9 rounded-lg px-2 text-xs font-medium tabular-nums text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink cursor-pointer"
          >
            {speed}×
          </button>
          {onClose && <IconButton icon={X} label="Close the briefing" onClick={close} />}
        </div>
      </div>
    </div>
  );
};
