import React from 'react';
import { Lightbulb, Star } from 'lucide-react';
import type { RoomDesignEvaluation } from '../../types/lifeSim';
import { Dialog, DialogFooter, DialogHeader, DialogPanel } from '../common/Dialog';
import { Button } from '../ui/primitives';

const points = (value: number) => `+${value.toFixed(2)}`;

/** The next change that would raise the rating most, in a sentence. */
const nextStep = ({ breakdown: b }: RoomDesignEvaluation): string => {
  if (b.filledSlots < b.totalSlots) {
    return `Fill one of the ${b.totalSlots - b.filledSlots} empty spots: each adds about ${(0.9 / b.totalSlots).toFixed(2)}.`;
  }
  if (b.harmony === 0) return 'Use three pieces in one style for another 0.35.';
  if (b.value < 0.65) return 'Swap in pricier pieces: their worth adds up to 0.65 in all.';
  return 'Nothing left to add. This room is rated as high as a room goes.';
};

/** How a room's rating adds up, and what would raise it. */
export const RoomRatingDialog: React.FC<{ roomName: string; evaluation: RoomDesignEvaluation; onClose: () => void }> = ({
  roomName,
  evaluation,
  onClose,
}) => {
  const b = evaluation.breakdown;
  const parts = [
    { label: 'Every room starts at', value: b.base.toFixed(2), max: null },
    { label: `Spots with a piece: ${b.filledSlots} of ${b.totalSlots}`, value: points(b.completeness), max: '0.90' },
    { label: `What the pieces are worth: ${evaluation.totalValue} tokens`, value: points(b.value), max: '0.65' },
    {
      label: b.matchedStyle ? `Three or more ${b.matchedStyle} pieces` : 'Three pieces in one style',
      value: points(b.harmony),
      max: '0.35',
    },
  ];
  const isCapped = b.base + b.completeness + b.value + b.harmony > 5;

  return (
    <Dialog isOpen onClose={onClose} titleId="rating-title" className="max-w-md">
      <DialogPanel>
        <DialogHeader titleId="rating-title" title={roomName} description="Room rating" onClose={onClose} />

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          <p className="flex items-baseline gap-2">
            <Star className="h-6 w-6 self-center fill-gold text-gold" aria-hidden="true" />
            <span className="text-[34px] font-semibold leading-none tracking-tight tabular-nums text-ink">{evaluation.starRating.toFixed(2)}</span>
            <span className="text-[15px] text-ink-subtle">of 5</span>
          </p>

          <dl className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
            {parts.map(part => (
              <div key={part.label} className="flex items-center justify-between gap-3 bg-canvas px-4 py-2.5 text-[13px]">
                <dt className="min-w-0 text-ink-muted">{part.label}</dt>
                <dd className="shrink-0 tabular-nums">
                  <span className="font-medium text-ink">{part.value}</span>
                  {part.max && <span className="text-ink-subtle"> of {part.max}</span>}
                </dd>
              </div>
            ))}
          </dl>
          {isCapped && <p className="-mt-3 text-xs text-ink-subtle">The total is capped at 5.</p>}

          <p className="flex items-start gap-2.5 rounded-2xl bg-gold-soft px-4 py-3 text-[13px] leading-relaxed text-ink">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
            {nextStep(evaluation)}
          </p>

          <p className="text-xs text-ink-subtle">
            Its pieces add {evaluation.totalFocusBonus} focus and {evaluation.totalComfortBonus} comfort. Furniture changes how the room looks and
            rates, not your pay.
          </p>
        </div>

        <DialogFooter className="justify-end">
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogPanel>
    </Dialog>
  );
};
