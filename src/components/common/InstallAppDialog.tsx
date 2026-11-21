import React, { useId } from 'react';
import { Share, SquarePlus } from 'lucide-react';
import { Dialog, DialogFooter, DialogHeader, DialogPanel } from './Dialog';
import { Button } from '../ui/primitives';

/** How to add Studify to an iPhone or iPad Home Screen (Safari has no install button). */
export const InstallAppDialog: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const titleId = useId();
  const steps = [
    { icon: Share, text: 'Tap the Share button in Safari (the square with an arrow, at the bottom or top of the screen).' },
    { icon: SquarePlus, text: 'Scroll down and tap "Add to Home Screen", then "Add".' },
  ];
  return (
    <Dialog isOpen={isOpen} onClose={onClose} titleId={titleId} className="max-w-md">
      <DialogPanel>
        <DialogHeader titleId={titleId} title="Add Studify to your Home Screen" description="It opens like an app, works offline, and can send you study reminders." onClose={onClose} />
        <ol className="space-y-3 px-5 py-5 sm:px-6">
          {steps.map(({ icon: Icon, text }, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-text" aria-hidden="true">
                <Icon className="h-4.5 w-4.5" />
              </span>
              <p className="pt-1.5 text-[14px] leading-relaxed text-ink">
                <span className="font-semibold">{i + 1}. </span>
                {text}
              </p>
            </li>
          ))}
          <li className="rounded-xl bg-surface-hover px-3.5 py-2.5 text-[13px] text-ink-muted">
            Then open Studify from your Home Screen. On iPhone, reminders only work from there.
          </li>
        </ol>
        <DialogFooter className="justify-end">
          <Button variant="primary" onClick={onClose}>
            Got it
          </Button>
        </DialogFooter>
      </DialogPanel>
    </Dialog>
  );
};
