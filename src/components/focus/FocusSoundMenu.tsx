import React, { useEffect, useState } from 'react';
import { Check, ChevronDown, Music2, Volume1, Volume2 } from 'lucide-react';
import { FOCUS_SOUNDS, soundEngine, type SoundType } from '../../services/soundEngine';
import { cn } from '../../utils/cn';
import { usePopover } from './usePopover';

/** Background sound for the session, in a small menu: the same sound as the top bar's sound menu. */
export const FocusSoundMenu: React.FC = () => {
  const { open, setOpen, rootRef } = usePopover();
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

  const label = FOCUS_SOUNDS.find(s => s.id === sound)?.label ?? 'Off';
  const playing = sound !== 'off';

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Background sound: ${label}`}
        className={cn(
          'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors cursor-pointer',
          playing ? 'border-brand/40 bg-brand-soft text-brand-text' : 'border-line text-ink-subtle hover:border-line-strong hover:text-ink',
        )}
      >
        <Music2 className="h-3.5 w-3.5" aria-hidden="true" />
        {playing ? label : 'Sound'}
        <ChevronDown className="h-3 w-3 opacity-70" aria-hidden="true" />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Background sound"
          className="absolute bottom-full right-0 z-30 mb-1.5 w-64 rounded-xl border border-line-strong bg-surface-solid p-1 shadow-[0_18px_40px_-16px_rgb(0_0_0/0.6)] animate-fadeIn"
        >
          <p className="px-2.5 pb-1 pt-2 text-[11px] text-ink-subtle">Steady noise can mask talking and other distractions.</p>
          <div role="radiogroup" aria-label="Sound">
            {FOCUS_SOUNDS.map(preset => (
              <button
                key={preset.id}
                type="button"
                role="radio"
                aria-checked={sound === preset.id}
                onClick={() => soundEngine.play(preset.id)}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-surface-hover cursor-pointer"
              >
                <Check className={cn('h-3.5 w-3.5 shrink-0 text-brand-text', sound !== preset.id && 'invisible')} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] text-ink">{preset.label}</span>
                  <span className="block truncate text-[11px] text-ink-subtle">{preset.desc}</span>
                </span>
              </button>
            ))}
          </div>
          <label className="mt-1 flex items-center gap-2.5 border-t border-line px-2.5 pb-2 pt-3">
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
        </div>
      )}
    </div>
  );
};
