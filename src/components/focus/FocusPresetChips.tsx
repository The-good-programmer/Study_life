import React from 'react';
import { FocusService } from '../../services/focusService';
import { FOCUS_PRESETS, matchingPreset, presetSettings, type FocusSettings } from '../../services/focusTimer';
import { cn } from '../../utils/cn';

/** One-tap session lengths: 25 / 5, 50 / 10 and 90 / 20. */
export const FocusPresetChips: React.FC<{ settings: FocusSettings; className?: string }> = ({ settings, className }) => {
  const active = matchingPreset(settings);
  return (
    <div role="radiogroup" aria-label="Session length" className={cn('flex flex-wrap items-center justify-center gap-1.5', className)}>
      {FOCUS_PRESETS.map(preset => (
        <button
          key={preset.id}
          type="button"
          role="radio"
          aria-checked={active === preset.id}
          title={`${preset.focusMinutes} min focus, ${preset.shortBreakMinutes} min breaks, ${preset.longBreakMinutes} min long break`}
          onClick={() => FocusService.saveSettings(presetSettings(preset))}
          className={cn(
            'h-7 rounded-full border px-3 text-xs font-medium tabular-nums transition-colors cursor-pointer',
            active === preset.id
              ? 'border-brand/50 bg-brand-soft text-brand-text'
              : 'border-line text-ink-subtle hover:border-line-strong hover:text-ink',
          )}
        >
          {preset.label}
        </button>
      ))}
      {active === null && (
        <span className="h-7 rounded-full border border-brand/50 bg-brand-soft px-3 text-xs font-medium leading-7 text-brand-text tabular-nums">
          {settings.focusMinutes} / {settings.shortBreakMinutes}
        </span>
      )}
    </div>
  );
};
