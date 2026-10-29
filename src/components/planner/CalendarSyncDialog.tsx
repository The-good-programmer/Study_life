import React, { useEffect, useId, useState } from 'react';
import { Check, Copy, Download, ExternalLink, Link2, Loader2, RefreshCw } from 'lucide-react';
import { CalendarFeedService, currentCalendar, feedUrl, googleCalendarUrl, webcalUrl } from '../../services/calendarFeedService';
import { cn } from '../../utils/cn';
import { Dialog, DialogHeader, DialogPanel } from '../common/Dialog';
import { Button } from '../ui/primitives';
import { INPUT_CLASS } from './plannerUi';

export interface CalendarSyncDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAuth?: () => void;
}

type LinkState = { kind: 'loading' } | { kind: 'off' } | { kind: 'on'; token: string } | { kind: 'error'; message: string };

const download = () => {
  const url = URL.createObjectURL(new Blob([currentCalendar()], { type: 'text/calendar' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'studify-planner.ics';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Puts the planner in the student's own calendar: a file to import once, or a link that stays up to date. */
export const CalendarSyncDialog: React.FC<CalendarSyncDialogProps> = ({ isOpen, onClose, onOpenAuth }) => {
  const fieldId = useId();
  const signedIn = CalendarFeedService.isSignedIn();
  const [link, setLink] = useState<LinkState>({ kind: 'loading' });
  const [working, setWorking] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen || !signedIn) return;
    let cancelled = false;
    void CalendarFeedService.status().then(result => {
      if (cancelled) return;
      setLink('error' in result ? { kind: 'error', message: result.error } : result.token ? { kind: 'on', token: result.token } : { kind: 'off' });
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, signedIn]);

  if (!isOpen) return null;

  const run = async (action: () => Promise<{ token: string } | { ok: true } | { error: string }>) => {
    setWorking(true);
    const result = await action();
    setWorking(false);
    if ('error' in result) setLink({ kind: 'error', message: result.error });
    else if ('token' in result) setLink({ kind: 'on', token: result.token });
    else setLink({ kind: 'off' });
  };

  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(feedUrl(token));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the link is selectable in the field.
    }
  };

  const titleId = `${fieldId}-title`;

  return (
    <Dialog isOpen={isOpen} onClose={onClose} titleId={titleId} className="max-w-lg">
      <DialogPanel className="max-h-[90dvh]">
        <DialogHeader
          titleId={titleId}
          title="Add to your calendar"
          description="Your exams and deadlines in Google Calendar, Apple Calendar or Outlook."
          onClose={onClose}
        />

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          <section className="space-y-3">
            <div>
              <h3 className="text-[14px] font-semibold text-ink">Keep it up to date</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
                Subscribe to a private link, and changes here show up in your calendar on its own. Google checks every few hours, sometimes up to a day.
              </p>
            </div>

            {!signedIn && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-canvas p-3.5">
                <p className="min-w-0 flex-1 text-[13px] text-ink-muted">Sign in to get a link. Without an account, download the file below.</p>
                {onOpenAuth && (
                  <Button size="sm" onClick={onOpenAuth}>
                    Sign in
                  </Button>
                )}
              </div>
            )}

            {signedIn && link.kind === 'loading' && (
              <p className="flex items-center gap-2 text-[13px] text-ink-subtle" role="status">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Checking your link…
              </p>
            )}

            {signedIn && (link.kind === 'off' || link.kind === 'error') && (
              <div className="space-y-2">
                <Button variant="primary" icon={working ? Loader2 : Link2} onClick={() => run(CalendarFeedService.turnOn)} disabled={working}>
                  Get my calendar link
                </Button>
                {link.kind === 'error' && (
                  <p className="text-xs font-medium text-danger" role="alert">
                    {link.message}
                  </p>
                )}
              </div>
            )}

            {signedIn && link.kind === 'on' && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" icon={ExternalLink} onClick={() => window.open(googleCalendarUrl(link.token), '_blank', 'noopener')}>
                    Google Calendar
                  </Button>
                  <Button icon={ExternalLink} onClick={() => window.location.assign(webcalUrl(link.token))}>
                    Apple Calendar or Outlook
                  </Button>
                </div>
                <div>
                  <label htmlFor={`${fieldId}-link`} className="text-xs font-medium text-ink-muted">
                    Or paste this link into any calendar's "subscribe by URL"
                  </label>
                  <div className="mt-1.5 flex gap-2">
                    <input
                      id={`${fieldId}-link`}
                      readOnly
                      value={feedUrl(link.token)}
                      onFocus={e => e.target.select()}
                      className={cn(INPUT_CLASS, 'min-w-0 flex-1 font-mono text-xs')}
                    />
                    <Button icon={copied ? Check : Copy} onClick={() => copy(link.token)}>
                      {copied ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-ink-subtle">
                  Anyone with this link can see your exams and homework. If it gets out, get a new one: the old link stops working.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="ghost" icon={RefreshCw} onClick={() => run(CalendarFeedService.reset)} disabled={working} className="-ml-2">
                    Get a new link
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => run(CalendarFeedService.turnOff)} disabled={working}>
                    Turn off
                  </Button>
                </div>
              </div>
            )}
          </section>

          <section className="space-y-3 border-t border-line pt-5">
            <div>
              <h3 className="text-[14px] font-semibold text-ink">Download a file</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
                Import it once. Later changes here won't show up in your calendar; download it again if you change things.
              </p>
            </div>
            <Button icon={Download} onClick={download}>
              Download .ics file
            </Button>
          </section>
        </div>
      </DialogPanel>
    </Dialog>
  );
};
