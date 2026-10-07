import React from 'react';
import { Flame, Gamepad2 } from 'lucide-react';
import type { FSRSRating } from '../../types';
import { ProgressBar } from '../ui/primitives';

interface StudyHUDProps {
  currentIndex: number;
  totalCards: number;
  lastRating: FSRSRating | null;
  combo: number;
  isAnswerRevealed: boolean;
  /** True while the multiple-choice result is showing (nothing to rate). */
  isShowingChoiceResult?: boolean;
  gamepadConnected: boolean;
  gamepadName?: string | null;
  onOpenShortcuts?: () => void;
}

/** One quiet line of guidance for where the learner is in the card. */
const statusFor = (
  combo: number,
  lastRating: FSRSRating | null,
  isAnswerRevealed: boolean,
  isShowingChoiceResult: boolean,
): string => {
  if (isShowingChoiceResult) return 'Read the explanation, then continue to the next card.';
  if (isAnswerRevealed) return 'Rate how well you remembered it. Be honest: it sets when the card comes back.';
  if (combo >= 3) return `${combo} in a row. Keep going.`;
  if (lastRating === 'again') return 'Missing a card and seeing it again is how it sticks.';
  return 'Try to recall the answer before you reveal it.';
};

/** Progress, card count and streak for the current set of cards. */
export const StudyHUD: React.FC<StudyHUDProps> = ({
  currentIndex,
  totalCards,
  lastRating,
  combo,
  isAnswerRevealed,
  isShowingChoiceResult = false,
  gamepadConnected,
  gamepadName,
  onOpenShortcuts,
}) => {
  const progress = totalCards > 0 ? (currentIndex / totalCards) * 100 : 0;
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-3 text-[13px]">
        <p className="min-w-0 truncate text-ink-muted">{statusFor(combo, lastRating, isAnswerRevealed, isShowingChoiceResult)}</p>
        <div className="flex shrink-0 items-center gap-2">
          {combo >= 2 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-gold-soft px-1.5 py-0.5 text-xs font-semibold tabular-nums text-gold">
              <Flame className="h-3 w-3 fill-current" aria-hidden="true" />
              {combo}
            </span>
          )}
          {gamepadConnected && (
            <button
              type="button"
              onClick={onOpenShortcuts}
              title={`Controller connected: ${gamepadName || 'gamepad'}`}
              className="inline-flex items-center gap-1 rounded-md bg-success-soft px-1.5 py-0.5 text-xs font-medium text-success cursor-pointer"
            >
              <Gamepad2 className="h-3.5 w-3.5" aria-hidden="true" />
              Controller
            </button>
          )}
          <span className="tabular-nums text-ink-subtle">
            <span className="font-medium text-ink">{Math.min(currentIndex + 1, totalCards)}</span> / {totalCards}
          </span>
        </div>
      </div>
      <ProgressBar value={progress} label="Cards completed" />
    </div>
  );
};
