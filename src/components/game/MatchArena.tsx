import React, { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { ArrowLeft, Check, Flame, Play, RotateCcw, Timer, Trophy, Zap } from 'lucide-react';
import type { StudySession } from '../../types';
import { soundEngine } from '../../services/soundEngine';
import { grantReward } from '../../services/economy/rewardService';
import { shouldIgnoreShortcut } from '../../utils/keyboard';
import { cn } from '../../utils/cn';
import { Button, Tokens } from '../ui/primitives';
import { buildMatchTiles, isMatchingPair, MIN_PAID_PAIRS } from './matchTiles';
import type { MatchTile } from './matchTiles';

interface MatchArenaProps {
  session: StudySession;
  onBack: () => void;
  onLaunchStudy?: () => void;
}

const bestTimeKey = (id: string) => `axon_match_best_${id}`;
const formatSeconds = (ms: number) => (ms / 1000).toFixed(1);

/** Speed match: pair each question with its answer against the clock. */
export const MatchArena: React.FC<MatchArenaProps> = ({ session, onBack, onLaunchStudy }) => {
  const [tiles, setTiles] = useState<MatchTile[]>(() => buildMatchTiles(session));
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [mismatchedTileIds, setMismatchedTileIds] = useState<string[]>([]);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [pay, setPay] = useState<{ xp: number; tokens: number } | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);
  const [bestTimeMs, setBestTimeMs] = useState<number | null>(() => {
    const raw = localStorage.getItem(bestTimeKey(session.id)) || localStorage.getItem(`studify_match_best_${session.id}`);
    return raw ? parseInt(raw, 10) : null;
  });
  const handleTileClickRef = useRef<(tile: MatchTile) => void>(() => {});
  const mismatchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(mismatchTimer.current), []);

  const pairCount = tiles.length / 2;
  const matchedPairs = tiles.filter(t => t.isMatched).length / 2;
  const isPaidRound = pairCount >= MIN_PAID_PAIRS;

  // The clock reads real time, so it stays right even if the tab is throttled.
  useEffect(() => {
    if (isCompleted) return;
    const timer = setInterval(() => setElapsedMs(Date.now() - startedAt), 100);
    return () => clearInterval(timer);
  }, [isCompleted, startedAt]);

  const handleTileClick = (tile: MatchTile) => {
    if (tile.isMatched || mismatchedTileIds.length > 0 || isCompleted) return;
    if (!selectedTileId || selectedTileId === tile.id) {
      setSelectedTileId(selectedTileId === tile.id ? null : tile.id);
      return;
    }
    const first = tiles.find(t => t.id === selectedTileId);
    if (!first) {
      setSelectedTileId(tile.id);
      return;
    }

    if (!isMatchingPair(first, tile)) {
      soundEngine.playIncorrectChime();
      setStreak(0);
      setMistakes(m => m + 1);
      setMismatchedTileIds([first.id, tile.id]);
      mismatchTimer.current = setTimeout(() => {
        setMismatchedTileIds([]);
        setSelectedTileId(null);
      }, 650);
      return;
    }

    soundEngine.playCorrectChime();
    const nextStreak = streak + 1;
    setStreak(nextStreak);
    setMaxStreak(best => Math.max(best, nextStreak));
    const nextTiles = tiles.map(t => (t.id === first.id || t.id === tile.id ? { ...t, isMatched: true } : t));
    setTiles(nextTiles);
    setSelectedTileId(null);

    if (nextTiles.every(t => t.isMatched)) {
      const finalTime = Date.now() - startedAt;
      setElapsedMs(finalTime);
      setIsCompleted(true);
      soundEngine.playCompletionChime();
      if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        try {
          confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 } });
        } catch {
          // Decoration only.
        }
      }
      if (isPaidRound) {
        const grant = grantReward({ kind: 'match-clear' }, { label: 'Speed match' });
        setPay({ xp: grant.xp, tokens: grant.wage?.totalAmount ?? 0 });
      }
      if (!bestTimeMs || finalTime < bestTimeMs) {
        setIsNewBest(!!bestTimeMs);
        setBestTimeMs(finalTime);
        try {
          localStorage.setItem(bestTimeKey(session.id), String(finalTime));
        } catch {
          // A best time is nice to have.
        }
      }
    }
  };

  useEffect(() => {
    handleTileClickRef.current = handleTileClick;
  });

  // Number keys pick the open tiles in order; Escape drops the selection.
  useEffect(() => {
    if (isCompleted || tiles.length === 0) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        setSelectedTileId(null);
        return;
      }
      if (shouldIgnoreShortcut(e)) return;
      const open = tiles.filter(t => !t.isMatched);
      const digit = parseInt(e.key, 10);
      if (digit >= 1 && digit <= Math.min(9, open.length)) {
        e.preventDefault();
        handleTileClickRef.current(open[digit - 1]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tiles, isCompleted]);

  const resetGame = () => {
    clearTimeout(mismatchTimer.current);
    setTiles(buildMatchTiles(session));
    setSelectedTileId(null);
    setMismatchedTileIds([]);
    setStartedAt(Date.now());
    setElapsedMs(0);
    setIsCompleted(false);
    setStreak(0);
    setMaxStreak(0);
    setMistakes(0);
    setPay(null);
    setIsNewBest(false);
  };

  if (tiles.length === 0) {
    return (
      <div className="mx-auto mt-10 w-full max-w-md rounded-3xl border border-line bg-surface p-8 text-center animate-fadeIn">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gold-soft text-gold">
          <Zap className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-lg font-semibold text-ink">Not enough cards to match</h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
          Speed match needs cards with a question and an answer. Add some to this deck first.
        </p>
        <Button variant="primary" icon={ArrowLeft} className="mt-5" onClick={onBack}>
          Back
        </Button>
      </div>
    );
  }

  const openTiles = tiles.filter(t => !t.isMatched);

  return (
    <div className="mx-auto w-full max-w-4xl animate-fadeIn">
      <header className="flex items-center justify-between gap-3">
        <Button variant="ghost" icon={ArrowLeft} onClick={onBack} className="-ml-2">
          Back
        </Button>
        <div className="min-w-0 text-center">
          <p className="text-xs font-medium text-brand-text">Speed match</p>
          <h1 className="truncate text-[15px] font-semibold text-ink">{session.title}</h1>
        </div>
        <Button variant="ghost" icon={RotateCcw} onClick={resetGame} className="-mr-2">
          <span className="hidden sm:inline">New game</span>
        </Button>
      </header>

      {!isCompleted ? (
        <>
          <dl className="mt-5 grid grid-cols-3 gap-2">
            <Stat icon={Timer} label="Time" value={`${formatSeconds(elapsedMs)}s`} />
            <Stat icon={Check} label="Pairs" value={`${matchedPairs} / ${pairCount}`} />
            <Stat icon={Flame} label="Streak" value={`×${streak}`} highlight={streak >= 3} />
          </dl>

          <p className="mt-5 text-[13px] text-ink-subtle">
            Pick a question, then its answer.
            <span className="hidden sm:inline"> Number keys work too.</span>
            {!isPaidRound && ` Practice round: decks with ${MIN_PAID_PAIRS}+ cards pay.`}
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
            {tiles.map(tile => {
              if (tile.isMatched) {
                return (
                  <div
                    key={tile.id}
                    className="flex min-h-[112px] items-center justify-center rounded-2xl border border-dashed border-line text-success/60"
                    aria-hidden="true"
                  >
                    <Check className="h-5 w-5" />
                  </div>
                );
              }
              const isSelected = selectedTileId === tile.id;
              const isMismatched = mismatchedTileIds.includes(tile.id);
              const keyNumber = openTiles.findIndex(t => t.id === tile.id) + 1;
              return (
                <button
                  key={tile.id}
                  type="button"
                  onClick={() => handleTileClick(tile)}
                  aria-pressed={isSelected}
                  aria-label={`${tile.type === 'question' ? 'Question' : 'Answer'}: ${tile.text}`}
                  className={cn(
                    'flex min-h-[112px] flex-col rounded-2xl border p-3.5 text-left transition-[background-color,border-color,transform] duration-150 cursor-pointer',
                    isSelected && 'border-brand bg-brand-soft',
                    isMismatched && 'border-danger bg-danger-soft animate-shake',
                    !isSelected && !isMismatched && 'border-line bg-surface hover:border-line-strong hover:bg-surface-hover',
                  )}
                >
                  <span className="flex items-center justify-between gap-2 text-xs text-ink-subtle">
                    <span className={cn(tile.type === 'answer' && 'text-success')}>{tile.type === 'question' ? 'Question' : 'Answer'}</span>
                    {keyNumber > 0 && keyNumber <= 9 && (
                      <kbd className="hidden h-5 min-w-5 items-center justify-center rounded border border-line px-1 font-mono text-[10.5px] sm:inline-flex">
                        {keyNumber}
                      </kbd>
                    )}
                  </span>
                  <span className="mt-1.5 line-clamp-4 text-[13px] font-medium leading-relaxed text-ink">{tile.text}</span>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <section className="mx-auto mt-8 max-w-md rounded-3xl border border-line-strong bg-surface p-6 text-center animate-rise sm:p-8">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-success-soft text-success">
            <Trophy className="h-6 w-6" aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-2xl font-semibold text-ink">All matched</h2>
          <p className="mt-1 text-[15px] text-ink-muted">
            {pairCount} pairs in {formatSeconds(elapsedMs)} seconds
            {isNewBest && <span className="ml-1.5 font-medium text-success">· new best</span>}
          </p>

          <dl className="mt-6 grid grid-cols-3 gap-2 text-left">
            <Stat label="Time" value={`${formatSeconds(elapsedMs)}s`} />
            <Stat label="Best streak" value={`×${maxStreak}`} />
            <Stat label="Mistakes" value={String(mistakes)} />
          </dl>

          <p className="mt-4 text-[13px] text-ink-subtle">
            {pay && (pay.tokens > 0 || pay.xp > 0) ? (
              <span className="inline-flex items-center gap-1.5">
                Paid
                {pay.tokens > 0 && <Tokens amount={pay.tokens} signed className="text-ink-muted" />}
                {pay.xp > 0 && <span className="tabular-nums text-ink-muted">+{pay.xp} XP</span>}
              </span>
            ) : isPaidRound ? (
              "You have had today's paid speed matches. Keep playing for practice."
            ) : (
              `Practice round. Decks with ${MIN_PAID_PAIRS} or more cards pay.`
            )}
            {bestTimeMs !== null && !isNewBest && <span className="block mt-1">Your best: {formatSeconds(bestTimeMs)}s</span>}
          </p>

          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            <Button icon={RotateCcw} onClick={resetGame} data-autofocus>
              Play again
            </Button>
            {onLaunchStudy && (
              <Button variant="primary" icon={Play} onClick={onLaunchStudy}>
                Study this deck
              </Button>
            )}
          </div>
        </section>
      )}
    </div>
  );
};

const Stat: React.FC<{ icon?: typeof Timer; label: string; value: string; highlight?: boolean }> = ({ icon: Icon, label, value, highlight }) => (
  <div className="rounded-2xl border border-line bg-surface px-3 py-2.5">
    <dt className="flex items-center gap-1.5 text-xs text-ink-subtle">
      {Icon && <Icon className={cn('h-3.5 w-3.5', highlight && 'text-gold')} aria-hidden="true" />}
      {label}
    </dt>
    <dd className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-ink">{value}</dd>
  </div>
);
