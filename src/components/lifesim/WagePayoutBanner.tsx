import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import confetti from 'canvas-confetti';
import { CoinIcon } from '../ui/primitives';

interface WageDetail {
  activity: string;
  rawAmount: number;
  buffBonus: number;
  totalAmount: number;
}

const VISIBLE_MS = 4500;

/** A short toast when study pays tokens into the wallet. */
export const WagePayoutBanner: React.FC = () => {
  const [wage, setWage] = useState<WageDetail | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const handleWageEvent = (event: Event) => {
      const detail = (event as CustomEvent<WageDetail>).detail;
      if (!detail) return;
      setWage(detail);

      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (!reduceMotion) {
        try {
          confetti({ particleCount: 18, spread: 40, origin: { y: 0.9, x: 0.5 }, colors: ['#f2bf4b', '#34d399', '#8b8ff7'] });
        } catch {
          // Confetti is decoration only.
        }
      }

      // A new payout restarts the timer instead of being hidden by the previous one.
      clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setWage(null), VISIBLE_MS);
    };

    window.addEventListener('study-wage-earned', handleWageEvent);
    return () => {
      window.removeEventListener('study-wage-earned', handleWageEvent);
      clearTimeout(hideTimer.current);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 md:bottom-6" role="status" aria-live="polite">
      {wage && (
        <div
          key={`${wage.activity}-${wage.totalAmount}`}
          className="pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl border border-line-strong bg-surface-solid py-2.5 pl-3 pr-2 shadow-[0_18px_40px_-16px_rgb(0_0_0/0.6)] animate-rise"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold-soft">
            <CoinIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold tabular-nums text-ink">
              +{wage.totalAmount.toLocaleString()} tokens
              {wage.buffBonus > 0 && <span className="ml-1.5 text-xs font-medium text-success">incl. +{wage.buffBonus} meal bonus</span>}
            </p>
            <p className="truncate text-xs text-ink-subtle">Paid for {wage.activity}</p>
          </div>
          <button
            type="button"
            onClick={() => setWage(null)}
            aria-label="Dismiss"
            className="ml-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
};
