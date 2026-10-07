import React, { useEffect, useState } from 'react';
import { cn } from '../../utils/cn';

interface AudioWaveformVisualizerProps {
  isActive: boolean;
  mode: 'candidate' | 'examiner';
  barCount?: number;
  className?: string;
}

/** A small live level meter: green while the learner speaks, brand while the examiner reads aloud. */
export const AudioWaveformVisualizer: React.FC<AudioWaveformVisualizerProps> = ({
  isActive,
  mode,
  barCount = 18,
  className = '',
}) => {
  const [heights, setHeights] = useState<number[]>(() => Array(barCount).fill(15));

  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      setHeights(
        Array.from({ length: barCount }, (_, i) => {
          // Taller bars in the middle, like a voice level meter.
          const centerDist = Math.abs(i - barCount / 2) / (barCount / 2);
          return Math.round(20 + Math.random() * 65 * (1 - centerDist * 0.4));
        }),
      );
    }, 90);

    return () => clearInterval(interval);
  }, [isActive, barCount]);

  const barColor = mode === 'candidate' ? 'bg-success' : 'bg-brand';

  return (
    <div
      className={cn('inline-flex h-8 items-center gap-2 rounded-full border border-line bg-canvas px-3', className)}
      role="status"
      aria-label={mode === 'candidate' ? 'Listening' : 'Reading aloud'}
    >
      <span className="text-xs font-medium text-ink-subtle">{mode === 'candidate' ? 'Listening' : 'Speaking'}</span>
      <span className="flex h-5 items-center gap-0.5" aria-hidden="true">
        {(isActive ? heights : Array<number>(barCount).fill(12)).map((h, idx) => (
          <span
            key={idx}
            className={cn('w-0.5 rounded-full transition-[height] duration-100 ease-out', barColor)}
            style={{ height: `${isActive ? h : 12}%`, opacity: isActive ? 0.35 + (h / 100) * 0.65 : 0.3 }}
          />
        ))}
      </span>
    </div>
  );
};
