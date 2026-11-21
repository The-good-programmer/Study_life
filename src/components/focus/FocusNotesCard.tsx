import React, { useEffect, useRef, useState } from 'react';
import { FocusService, MAX_NOTES_LENGTH } from '../../services/focusService';
import { Card, SectionHeader } from '../ui/primitives';

const SAVE_DELAY_MS = 400;

/** A notes pad that saves as you type, for questions and stray thoughts during a session. */
export const FocusNotesCard: React.FC = () => {
  const [notes, setNotes] = useState(() => FocusService.getNotes());
  const [status, setStatus] = useState<'saved' | 'saving'>('saved');
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const flush = () => {
    clearTimeout(timer.current);
    if (pending.current !== null) {
      FocusService.saveNotes(pending.current);
      pending.current = null;
    }
    setStatus('saved');
  };

  // Save what's typed when the page is left or hidden.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden' && pending.current !== null) {
        FocusService.saveNotes(pending.current);
        pending.current = null;
      }
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      clearTimeout(timer.current);
      if (pending.current !== null) FocusService.saveNotes(pending.current);
    };
  }, []);

  const onChange = (value: string) => {
    setNotes(value);
    setStatus('saving');
    pending.current = value;
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY_MS);
  };

  return (
    <Card className="flex flex-col gap-3">
      <SectionHeader
        title="Notes"
        description="Park questions and distractions here, and come back to them later."
        action={
          <span className="text-xs text-ink-subtle" aria-live="polite">
            {status === 'saving' ? 'Saving…' : notes ? 'Saved' : ''}
          </span>
        }
      />
      <label htmlFor="focus-notes" className="sr-only">
        Notes
      </label>
      <textarea
        id="focus-notes"
        value={notes}
        onChange={e => onChange(e.target.value)}
        onBlur={flush}
        maxLength={MAX_NOTES_LENGTH}
        rows={9}
        placeholder="Ask the teacher about question 3…"
        className="min-h-48 w-full resize-y rounded-xl border border-line-strong bg-canvas px-3 py-2.5 text-sm leading-relaxed text-ink placeholder:text-ink-subtle transition-colors focus:border-brand focus:outline-none"
      />
    </Card>
  );
};
