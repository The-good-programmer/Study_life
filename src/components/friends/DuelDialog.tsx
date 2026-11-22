import React, { useId, useMemo, useState } from 'react';
import { Check, Clock, Swords, Trophy, X } from 'lucide-react';
import type { StudySession } from '../../types';
import { StorageService } from '../../services/storageService';
import { DUEL_SECONDS_PER_QUESTION, DuelService, buildDuelQuestions, canDuelWith, duelOutcome, type Duel, type DuelQuestion } from '../../services/duelService';
import type { Friend } from '../../services/friendsService';
import { soundEngine } from '../../services/soundEngine';
import { cn } from '../../utils/cn';
import { Dialog, DialogFooter, DialogHeader, DialogPanel } from '../common/Dialog';
import { Badge, Button } from '../ui/primitives';
import { DuelPlay } from './DuelPlay';
import { FriendAvatar } from './FriendAvatar';

export type DuelDialogMode =
  /** Challenge a friend (picked first when not given). */
  | { kind: 'challenge'; friend?: Friend; friends: Friend[] }
  /** Answer a challenge, or look at a finished one. */
  | { kind: 'duel'; duel: Duel };

type Step =
  | { kind: 'friend' }
  | { kind: 'deck'; friend: Friend }
  | { kind: 'intro' }
  | { kind: 'play'; questions: DuelQuestion[]; friend?: Friend; deck?: StudySession }
  | { kind: 'sending' }
  | { kind: 'result'; duel: Duel }
  | { kind: 'error'; message: string };

const seconds = (ms: number | null) => (ms ? `${Math.round(ms / 1000)}s` : '');

/** Challenging a friend to a duel on a deck, answering one, and the results. */
export const DuelDialog: React.FC<{ mode: DuelDialogMode; onClose: () => void }> = ({ mode, onClose }) => {
  const titleId = useId();
  const decks = useMemo(() => StorageService.getSessions().filter(canDuelWith), []);
  const [step, setStep] = useState<Step>(() => {
    if (mode.kind === 'challenge') return mode.friend ? { kind: 'deck', friend: mode.friend } : { kind: 'friend' };
    return mode.duel.status === 'your-turn' ? { kind: 'intro' } : { kind: 'result', duel: mode.duel };
  });

  const startChallenge = (friend: Friend, deck: StudySession) => {
    setStep({ kind: 'play', questions: buildDuelQuestions(StorageService.deckWithLatestProgress(deck)), friend, deck });
  };

  const finish = async (answers: (number | null)[], ms: number) => {
    if (step.kind !== 'play') return;
    setStep({ kind: 'sending' });
    const res =
      mode.kind === 'duel'
        ? await DuelService.play(mode.duel.id, answers, ms)
        : await DuelService.challenge({
            friendId: step.friend!.id,
            deckTitle: step.deck!.title,
            questions: step.questions as (DuelQuestion & { answerIndex: number })[],
            answers,
            ms,
          });
    if (!res.ok) {
      setStep({ kind: 'error', message: res.error });
      return;
    }
    const outcome = duelOutcome(res.data);
    if (outcome === 'won' || (res.data.status === 'waiting' && (res.data.you.score ?? 0) >= res.data.questionCount * 0.7)) soundEngine.playCompletionChime();
    setStep({ kind: 'result', duel: res.data });
  };

  const title =
    step.kind === 'friend' ? 'Challenge a friend'
      : step.kind === 'deck' ? `Challenge ${step.friend.name}`
        : step.kind === 'result' ? 'Duel results'
          : mode.kind === 'duel' ? `${mode.duel.them.name}'s challenge`
            : 'Duel';

  const playing = step.kind === 'play';

  return (
    <Dialog isOpen onClose={playing ? () => {} : onClose} titleId={titleId} className="max-w-lg">
      <DialogPanel className="max-h-[90dvh]">
        <DialogHeader titleId={titleId} title={title} onClose={playing ? undefined : onClose} />
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          {step.kind === 'friend' && mode.kind === 'challenge' && (
            mode.friends.length === 0 ? (
              <p className="text-[14px] text-ink-muted">Add a friend first, then challenge them on one of your decks.</p>
            ) : (
              <ul className="space-y-2">
                {mode.friends.map(friend => (
                  <li key={friend.id}>
                    <button
                      type="button"
                      onClick={() => setStep({ kind: 'deck', friend })}
                      className="flex w-full items-center gap-3 rounded-xl border border-line px-3 py-2.5 text-left transition-colors hover:border-brand/60 cursor-pointer"
                    >
                      <FriendAvatar friend={friend} className="h-8 w-8 text-base" />
                      <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink">{friend.name}</span>
                      <Swords className="h-4 w-4 text-ink-subtle" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )
          )}

          {step.kind === 'deck' && (
            <div className="space-y-3">
              <p className="text-[14px] text-ink-muted">
                Pick a deck. You both answer the same {DUEL_SECONDS_PER_QUESTION}-second multiple-choice questions from it; the best score wins, and time breaks a tie. You go first.
              </p>
              {decks.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line-strong px-4 py-5 text-center text-[13px] text-ink-subtle">
                  You need a deck with at least 4 cards to make a duel.
                </p>
              ) : (
                <ul className="space-y-2">
                  {decks.map(deck => (
                    <li key={deck.id}>
                      <button
                        type="button"
                        onClick={() => startChallenge(step.friend, deck)}
                        className="flex w-full items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-3 text-left transition-colors hover:border-brand/60 cursor-pointer"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[14px] font-medium text-ink">{deck.title}</span>
                          <span className="block text-xs text-ink-subtle">{deck.category}</span>
                        </span>
                        <Badge tone="brand">Start</Badge>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {step.kind === 'intro' && mode.kind === 'duel' && (
            <div className="space-y-3 text-center">
              <Swords className="mx-auto h-10 w-10 text-brand-text" aria-hidden="true" />
              <p className="text-[16px] font-semibold text-ink">
                {mode.duel.them.name} challenged you on {mode.duel.deckTitle}
              </p>
              <p className="text-[14px] text-ink-muted">
                {mode.duel.questionCount} questions, {DUEL_SECONDS_PER_QUESTION} seconds each. You'll see both scores at the end.
              </p>
            </div>
          )}

          {step.kind === 'play' && <DuelPlay questions={step.questions} onFinish={(answers, ms) => void finish(answers, ms)} />}

          {step.kind === 'sending' && <p className="py-8 text-center text-[14px] text-ink-muted" role="status">Checking your answers…</p>}

          {step.kind === 'error' && (
            <p role="alert" className="text-[14px] text-danger">
              {step.message}
            </p>
          )}

          {step.kind === 'result' && <DuelResults duel={step.duel} />}
        </div>
        {(step.kind === 'intro' || step.kind === 'result' || step.kind === 'error') && (
          <DialogFooter className="justify-end">
            {step.kind === 'intro' && mode.kind === 'duel' ? (
              <>
                <Button variant="ghost" onClick={onClose}>
                  Later
                </Button>
                <Button variant="primary" icon={Swords} onClick={() => setStep({ kind: 'play', questions: mode.duel.questions })}>
                  Start
                </Button>
              </>
            ) : (
              <Button variant="primary" onClick={onClose}>
                Done
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogPanel>
    </Dialog>
  );
};

/** Both scores and every question with the right answer. */
const DuelResults: React.FC<{ duel: Duel }> = ({ duel }) => {
  const outcome = duelOutcome(duel);
  const headline =
    duel.status === 'waiting' ? `Sent to ${duel.them.name}`
      : duel.status === 'expired' ? 'This challenge expired'
        : outcome === 'won' ? 'You won!'
          : outcome === 'lost' ? `${duel.them.name} won`
            : 'A draw';
  return (
    <div className="space-y-5">
      <div className="text-center">
        {outcome === 'won' ? <Trophy className="mx-auto h-9 w-9 text-gold" aria-hidden="true" /> : <Swords className="mx-auto h-9 w-9 text-brand-text" aria-hidden="true" />}
        <p className="mt-2 text-[18px] font-semibold text-ink">{headline}</p>
        <p className="text-[13px] text-ink-subtle">{duel.deckTitle}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-center">
        {[
          { label: 'You', player: duel.you },
          { label: duel.them.name, player: duel.them },
        ].map(({ label, player }) => (
          <div key={label} className="rounded-xl border border-line bg-canvas px-3 py-3">
            <p className="truncate text-xs text-ink-subtle">{label}</p>
            <p className="text-[22px] font-semibold tabular-nums text-ink">
              {player.score === null ? '–' : `${player.score}/${duel.questionCount}`}
            </p>
            <p className="text-xs tabular-nums text-ink-subtle">{player.score === null ? (duel.status === 'expired' ? 'Not played' : 'Not played yet') : seconds(player.ms)}</p>
          </div>
        ))}
      </div>
      {duel.status === 'waiting' && (
        <p className="flex items-center justify-center gap-1.5 text-[13px] text-ink-muted">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          {duel.them.name} has a week to answer. You'll see their score on Today.
        </p>
      )}
      {duel.questions.length > 0 && duel.questions[0].answerIndex !== undefined && (
        <ol className="space-y-2">
          {duel.questions.map((q, i) => {
            const right = q.yourAnswer === q.answerIndex;
            return (
              <li key={i} className="rounded-xl border border-line px-3.5 py-2.5">
                <p className="text-[13px] font-medium text-ink">{q.question}</p>
                <p className="mt-1 flex items-start gap-1.5 text-[13px]">
                  {right ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-label="Right" /> : <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" aria-label="Wrong" />}
                  <span className={cn(right ? 'text-success' : 'text-ink-muted')}>
                    {q.options[q.answerIndex!]}
                    {!right && <span className="text-ink-subtle"> · you: {q.yourAnswer === null || q.yourAnswer === undefined ? 'no answer' : q.options[q.yourAnswer]}</span>}
                  </span>
                </p>
                {duel.status === 'done' && q.theirAnswer !== undefined && (
                  <p className="mt-0.5 pl-5 text-xs text-ink-subtle">
                    {duel.them.name}: {q.theirAnswer === null ? 'no answer' : q.theirAnswer === q.answerIndex ? 'right' : q.options[q.theirAnswer]}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};
