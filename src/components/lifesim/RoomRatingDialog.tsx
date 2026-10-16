import React from 'react';
import { Lightbulb, Star } from 'lucide-react';
import type { RoomDesignEvaluation } from '../../types/lifeSim';
import { ROOM_RATING_POINTS } from '../../services/lifeSimService';
import { Dialog, DialogFooter, DialogHeader, DialogPanel } from '../common/Dialog';
import { Button, ProgressBar } from '../ui/primitives';

const points = (value: number) => `+${value.toFixed(2)}`;

/** How a room's rating adds up, and what would raise it. */
export const RoomRatingDialog: React.FC<{ roomName: string; evaluation: RoomDesignEvaluation; onClose: () => void }> = ({
  roomName,
  evaluation,
  onClose,
}) => {
  const b = evaluation.breakdown;
  const parts = [
    {
      label: 'Spots with a piece',
      detail: `${b.filledSlots} of ${b.totalSlots}`,
      value: b.completeness,
      max: ROOM_RATING_POINTS.fill,
    },
    {
      label: 'What the pieces are worth',
      detail: `${evaluation.totalValue} of ${b.valueTarget} tokens`,
      value: b.value,
      max: ROOM_RATING_POINTS.value,
    },
    {
      label: 'Pieces in one style',
      detail: b.matchedStyle ? `${b.matchingPieces} ${b.matchedStyle} of ${b.styleTarget}` : `0 of ${b.styleTarget}`,
      value: b.harmony,
      max: ROOM_RATING_POINTS.style,
    },
  ];

  return (
    <Dialog isOpen onClose={onClose} titleId="rating-title" className="max-w-md">
      <DialogPanel>
        <DialogHeader titleId="rating-title" title={roomName} description="Room rating" onClose={onClose} />

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          <div>
            <p className="flex items-baseline gap-2">
              <Star className="h-6 w-6 self-center fill-gold text-gold" aria-hidden="true" />
              <span className="text-[34px] font-semibold leading-none tracking-tight tabular-nums text-ink">{evaluation.starRating.toFixed(2)}</span>
              <span className="text-[15px] text-ink-subtle">of 5</span>
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
              An empty room rates {ROOM_RATING_POINTS.base}. Fill every spot with valuable pieces that share a style to reach 5.
            </p>
          </div>

          <dl className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
            <div className="flex items-center justify-between gap-3 bg-canvas px-4 py-2.5 text-[13px]">
              <dt className="min-w-0 text-ink-muted">Every room starts at</dt>
              <dd className="shrink-0 font-medium tabular-nums text-ink">{b.base.toFixed(2)}</dd>
            </div>
            {parts.map(part => (
              <div key={part.label} className="grid grid-cols-[1fr_auto] items-center gap-x-3 bg-canvas px-4 py-2.5 text-[13px]">
                <dt className="min-w-0 text-ink-muted">
                  {part.label}
                  <span className="text-ink-subtle"> · {part.detail}</span>
                </dt>
                <dd className="tabular-nums">
                  <span className="font-medium text-ink">{points(part.value)}</span>
                  <span className="text-ink-subtle"> of {part.max.toFixed(2)}</span>
                </dd>
                <dd className="col-span-2 mt-1.5" aria-hidden="true">
                  <ProgressBar value={(part.value / part.max) * 100} tone="gold" />
                </dd>
              </div>
            ))}
          </dl>

          {evaluation.jurorFeedback[0] && (
            <p className="flex items-start gap-2.5 rounded-2xl bg-gold-soft px-4 py-3 text-[13px] leading-relaxed text-ink">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
              {evaluation.jurorFeedback[0]}
            </p>
          )}

          <p className="text-xs text-ink-subtle">Furniture changes how the room looks and rates, not your pay.</p>
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
