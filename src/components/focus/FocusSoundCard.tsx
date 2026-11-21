import React, { useEffect, useState } from 'react';
import { Volume1, Volume2 } from 'lucide-react';
import { FOCUS_SOUNDS, soundEngine, type SoundType } from '../../services/soundEngine';
import { cn } from '../../utils/cn';
import { Card, SectionHeader } from '../ui/primitives';

/** Background sound for the session: the same sound as the top bar's sound menu. */
export const FocusSoundCard: React.FC = () => {
  const [sound, setSound] = useState<SoundType>(() => soundEngine.getCurrentSound());
  const [volume, setVolume] = useState(() => soundEngine.getVolume());

  useEffect(
    () =>
      soundEngine.subscribe((current, vol) => {
        setSound(current);
        setVolume(vol);
      }),
    [],
  );

  return (
    <Card className="space-y-4">
      <SectionHeader title="Background sound" description="Steady noise can mask talking and other distractions." />
      <div role="radiogroup" aria-label="Background sound" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {FOCUS_SOUNDS.map(preset => (
          <button
            key={preset.id}
            type="button"
            role="radio"
            aria-checked={sound === preset.id}
            title={preset.desc}
            onClick={() => soundEngine.play(preset.id)}
            className={cn(
              'h-10 truncate rounded-xl border px-3 text-[13px] font-medium transition-colors cursor-pointer',
              sound === preset.id
                ? 'border-brand/50 bg-brand-soft text-brand-text'
                : 'border-line bg-canvas text-ink-muted hover:border-line-strong hover:text-ink',
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-3">
        <Volume1 className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
        <span className="sr-only">Volume</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={e => soundEngine.setVolume(parseFloat(e.target.value))}
          className="h-1.5 w-full cursor-pointer accent-[var(--brand)]"
        />
        <Volume2 className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
      </label>
    </Card>
  );
};
