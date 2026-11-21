import React, { useState } from 'react';
import { FocusService } from '../../services/focusService';
import { SETTING_LIMITS, type FocusSettings } from '../../services/focusTimer';
import { Toggle } from '../ui/primitives';

type NumberKey = keyof typeof SETTING_LIMITS;

const NUMBER_FIELDS: { key: NumberKey; label: string; unit: string }[] = [
  { key: 'focusMinutes', label: 'Focus', unit: 'min' },
  { key: 'shortBreakMinutes', label: 'Short break', unit: 'min' },
  { key: 'longBreakMinutes', label: 'Long break', unit: 'min' },
  { key: 'longBreakEvery', label: 'Long break after', unit: 'sessions' },
];

/** A number setting typed freely, then saved (and kept in range) when the field is left. */
const NumberField: React.FC<{ field: (typeof NUMBER_FIELDS)[number]; value: number }> = ({ field, value }) => {
  const [draft, setDraft] = useState<string | null>(null);
  const [min, max] = SETTING_LIMITS[field.key];
  const commit = () => {
    if (draft === null) return;
    if (draft.trim() !== '') FocusService.saveSettings({ [field.key]: Number(draft) });
    setDraft(null);
  };
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-ink-subtle">{field.label}</span>
      <span className="flex h-10 items-center rounded-xl border border-line-strong bg-canvas pr-3 transition-colors focus-within:border-brand">
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={draft ?? String(value)}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          className="h-full w-full min-w-0 rounded-xl bg-transparent px-3 text-sm text-ink tabular-nums focus:outline-none"
        />
        <span className="shrink-0 text-xs text-ink-subtle">{field.unit}</span>
      </span>
    </label>
  );
};

export const FocusSettingsPanel: React.FC<{ settings: FocusSettings }> = ({ settings }) => {
  const [notifyNote, setNotifyNote] = useState<string | null>(null);
  const notificationsSupported = typeof window !== 'undefined' && 'Notification' in window;

  const setNotify = async (on: boolean) => {
    setNotifyNote(null);
    if (!on) {
      FocusService.saveSettings({ notify: false });
      return;
    }
    if (!notificationsSupported) {
      setNotifyNote("This browser can't show notifications.");
      return;
    }
    const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
    if (permission === 'granted') {
      FocusService.saveSettings({ notify: true });
    } else {
      setNotifyNote('Notifications are blocked for this site. Allow them in your browser\'s site settings, then try again.');
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-line bg-canvas p-4 animate-fadeIn">
      <div className="grid grid-cols-2 gap-3">
        {NUMBER_FIELDS.map(field => (
          <NumberField key={field.key} field={field} value={settings[field.key]} />
        ))}
      </div>
      <div className="flex flex-col items-start gap-0.5">
        <Toggle checked={settings.autoStartBreaks} onChange={on => FocusService.saveSettings({ autoStartBreaks: on })} label="Start breaks on their own" className="-ml-2" />
        <Toggle checked={settings.autoStartFocus} onChange={on => FocusService.saveSettings({ autoStartFocus: on })} label="Start focus sessions on their own" className="-ml-2" />
        <Toggle checked={settings.chime} onChange={on => FocusService.saveSettings({ chime: on })} label="Chime when time's up" className="-ml-2" />
        <Toggle checked={settings.notify} onChange={on => void setNotify(on)} label="Notify me when time's up" className="-ml-2" />
        {notifyNote && <p className="pl-1 text-xs text-danger">{notifyNote}</p>}
      </div>
      <p className="text-xs text-ink-subtle">New lengths apply to the next session; one already going keeps its own.</p>
    </div>
  );
};
