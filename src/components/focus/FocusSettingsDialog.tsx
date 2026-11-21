import React, { useId, useState } from 'react';
import { FocusService } from '../../services/focusService';
import { SETTING_LIMITS, type FocusSettings } from '../../services/focusTimer';
import { Button, Toggle } from '../ui/primitives';
import { Dialog, DialogFooter, DialogHeader, DialogPanel } from '../common/Dialog';
import { FocusPresetChips } from './FocusPresetChips';

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

/** Timer settings in a pop-up, so the timer itself never moves. */
export const FocusSettingsDialog: React.FC<{ isOpen: boolean; onClose: () => void; settings: FocusSettings }> = ({ isOpen, onClose, settings }) => {
  const titleId = useId();
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
    <Dialog isOpen={isOpen} onClose={onClose} titleId={titleId} className="max-w-md">
      <DialogPanel className="max-h-[90dvh]">
        <DialogHeader titleId={titleId} title="Timer settings" description="Session lengths, sounds and alerts." onClose={onClose} />
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          <section className="space-y-3">
            <h3 className="text-[14px] font-semibold text-ink">Session length</h3>
            <FocusPresetChips settings={settings} className="justify-start" />
            <div className="grid grid-cols-2 gap-3">
              {NUMBER_FIELDS.map(field => (
                <NumberField key={field.key} field={field} value={settings[field.key]} />
              ))}
            </div>
            <p className="text-xs text-ink-subtle">New lengths apply to the next session; one already going keeps its own.</p>
          </section>
          <section className="space-y-1">
            <h3 className="pb-1 text-[14px] font-semibold text-ink">While the timer runs</h3>
            <div className="flex flex-col items-start gap-0.5">
            <Toggle checked={settings.autoStartBreaks} onChange={on => FocusService.saveSettings({ autoStartBreaks: on })} label="Start breaks on their own" className="-ml-2" />
            <Toggle checked={settings.autoStartFocus} onChange={on => FocusService.saveSettings({ autoStartFocus: on })} label="Start focus sessions on their own" className="-ml-2" />
            <Toggle checked={settings.chime} onChange={on => FocusService.saveSettings({ chime: on })} label="Chime when time's up" className="-ml-2" />
            <Toggle checked={settings.notify} onChange={on => void setNotify(on)} label="Notify me when time's up" className="-ml-2" />
            <Toggle checked={settings.keepAwake} onChange={on => FocusService.saveSettings({ keepAwake: on })} label="Keep the screen on while the timer runs" className="-ml-2" />
            {notifyNote && <p className="pl-1 text-xs text-danger">{notifyNote}</p>}
            </div>
          </section>
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
