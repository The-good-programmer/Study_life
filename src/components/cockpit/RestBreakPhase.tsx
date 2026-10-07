import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowRight, Droplets, Eye, Pause, Play } from 'lucide-react';
import { soundEngine } from '../../services/soundEngine';
import { estimateReward, grantReward } from '../../services/economy/rewardService';
import { lifeSimService } from '../../services/lifeSimService';
import { CharacterCompanion } from '../character/CharacterCompanion';
import { Button, IconButton, Tokens } from '../ui/primitives';

interface RestBreakPhaseProps {
  onComplete: () => void;
  onSkip: () => void;
}

const REST_SECONDS = 180;
/** A break pays once the learner has actually rested this long; leaving earlier is a skip. */
const PAID_REST_SECONDS = 120;

/** Box breathing: four steps of four seconds. */
const BREATH_STEPS = ['Breathe in', 'Hold', 'Breathe out', 'Hold'];
const BREATH_STEP_SECONDS = 4;

const formatClock = (totalSeconds: number) => {
  const s = Math.max(0, totalSeconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** The last step of each concept in a guided session: a short, guided break. */
export const RestBreakPhase: React.FC<RestBreakPhaseProps> = ({ onComplete, onSkip }) => {
  const [elapsed, setElapsed] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [pay] = useState(() => {
    const { xp, tokens } = estimateReward({ kind: 'rest' });
    return { xp, tokens: Math.round(tokens * lifeSimService.getActiveMultiplier()) };
  });
  const finishedRef = useRef(false);

  const finish = useCallback(
    (paid: boolean) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      if (paid) {
        grantReward({ kind: 'rest' }, { label: 'Rest break' });
        soundEngine.playCompletionChime();
        onComplete();
      } else {
        onSkip();
      }
    },
    [onComplete, onSkip],
  );

  // Let the breathing circle start small and grow on the first breath.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setHasStarted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => setElapsed(s => Math.min(REST_SECONDS, s + 1)), 1000);
    return () => clearInterval(timer);
  }, [isPaused]);

  useEffect(() => {
    if (elapsed >= REST_SECONDS) finish(true);
  }, [elapsed, finish]);

  const step = Math.floor(elapsed / BREATH_STEP_SECONDS) % BREATH_STEPS.length;
  const count = BREATH_STEP_SECONDS - (elapsed % BREATH_STEP_SECONDS);
  const isFull = hasStarted && (step === 0 || step === 1);
  const canCollect = elapsed >= PAID_REST_SECONDS;
  const hasPay = pay.tokens > 0 || pay.xp > 0;

  return (
    <div className="mx-auto max-w-xl animate-fadeIn text-center">
      <p className="text-xs font-medium text-success">Rest</p>
      <h2 className="mt-1 text-2xl font-semibold text-ink">Take a short break</h2>
      <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-ink-muted">
        Your brain keeps working on what you just learned while you rest. Follow the circle and breathe.
      </p>

      {/* Breathing guide */}
      <div className="relative mx-auto my-8 flex h-56 w-56 items-center justify-center" aria-live="polite">
        <div
          className="absolute inset-0 rounded-full bg-success-soft transition-transform ease-in-out motion-reduce:transition-none"
          style={{ transform: `scale(${isFull ? 1 : 0.62})`, transitionDuration: `${BREATH_STEP_SECONDS}s` }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-7 rounded-full border border-success/40 transition-transform ease-in-out motion-reduce:transition-none"
          style={{ transform: `scale(${isFull ? 1.08 : 0.7})`, transitionDuration: `${BREATH_STEP_SECONDS}s` }}
          aria-hidden="true"
        />
        <div className="relative">
          <p className="text-lg font-semibold text-ink">{isPaused ? 'Paused' : BREATH_STEPS[step]}</p>
          {!isPaused && <p className="mt-0.5 font-mono text-sm tabular-nums text-success">{count}</p>}
        </div>
      </div>

      <div className="flex items-center justify-center gap-2">
        <span className="font-mono text-3xl font-semibold tabular-nums text-ink" aria-label={`${formatClock(REST_SECONDS - elapsed)} left`}>
          {formatClock(REST_SECONDS - elapsed)}
        </span>
        <IconButton icon={isPaused ? Play : Pause} label={isPaused ? 'Resume' : 'Pause'} onClick={() => setIsPaused(p => !p)} />
      </div>

      <div className="mt-8 grid gap-2 text-left sm:grid-cols-2">
        <RestTip icon={Eye}>Look at something far away for 20 seconds.</RestTip>
        <RestTip icon={Droplets}>Have a sip of water.</RestTip>
      </div>

      <div className="mt-6 flex justify-center">
        <CharacterCompanion
          variant="card"
          size="sm"
          speech="Breaks are part of studying. While you rest, your brain replays what you just learned."
          className="w-full max-w-md text-left"
        />
      </div>

      <div className="mt-8 flex flex-col-reverse items-stretch gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" onClick={() => finish(false)}>
          Skip break
        </Button>
        <div className="flex flex-col items-center gap-1.5 sm:items-end">
          <Button variant="primary" size="lg" trailingIcon={ArrowRight} onClick={() => finish(true)} disabled={!canCollect}>
            {canCollect ? 'Continue' : `Continue in ${formatClock(PAID_REST_SECONDS - elapsed)}`}
          </Button>
          {hasPay && (
            <p className="inline-flex items-center gap-1.5 text-xs text-ink-subtle">
              {canCollect ? 'This break pays' : 'Rest 2 minutes to earn'}
              {pay.tokens > 0 && <Tokens amount={pay.tokens} signed className="text-ink-muted" />}
              {pay.xp > 0 && <span className="tabular-nums text-ink-muted">+{pay.xp} XP</span>}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const RestTip: React.FC<{ icon: LucideIcon; children: React.ReactNode }> = ({ icon: Icon, children }) => (
  <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-[13px] text-ink-muted">
    <Icon className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
    {children}
  </div>
);
