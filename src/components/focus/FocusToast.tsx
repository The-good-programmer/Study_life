import React from 'react';
import { Timer, X } from 'lucide-react';

interface FocusToastProps {
  message: { title: string; body: string } | null;
  onDismiss: () => void;
  /** Leave out on the Focus page itself. */
  onOpen?: () => void;
}

/** Says on screen that a focus session or break has ended. */
export const FocusToast: React.FC<FocusToastProps> = ({ message, onDismiss, onOpen }) => (
  <div className="pointer-events-none fixed inset-x-0 top-16 z-50 flex justify-center px-4" role="status" aria-live="polite">
    {message && (
      <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-line-strong bg-surface-solid py-2.5 pl-3 pr-2 shadow-[0_18px_40px_-16px_rgb(0_0_0/0.6)] animate-rise">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-text">
          <Timer className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{message.title}</p>
          <p className="text-xs text-ink-subtle">{message.body}</p>
        </div>
        {onOpen && (
          <button
            type="button"
            onClick={() => {
              onOpen();
              onDismiss();
            }}
            className="h-8 shrink-0 rounded-lg px-2.5 text-xs font-medium text-brand-text transition-colors hover:bg-brand-soft cursor-pointer"
          >
            Open
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink cursor-pointer"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    )}
  </div>
);
