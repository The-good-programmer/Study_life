import React from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '../../utils/cn';
import { Button } from '../ui/primitives';

interface AiUnavailableNoticeProps {
  /** What the AI would do, e.g. "make decks" or "give feedback on your explanation". */
  action: string;
  /** Opens sign-in. Without it, the notice says where to sign in instead. */
  onSignIn?: () => void;
  /** A guest who still has their free AI deck: says the first one needs no account. */
  freeDeck?: boolean;
  className?: string;
}

/** Says before anything is tried that the AI needs a (free) account or the student's own key. */
export const AiUnavailableNotice: React.FC<AiUnavailableNoticeProps> = ({ action, onSignIn, freeDeck, className }) => (
  <div role="note" className={cn('flex flex-col gap-3 rounded-2xl border border-brand/30 bg-brand-soft p-4 sm:flex-row sm:items-center', className)}>
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/15 text-brand-text" aria-hidden="true">
      <Sparkles className="h-4.5 w-4.5" />
    </span>
    <div className="min-w-0 flex-1">
      <p className="text-[13px] font-semibold text-ink">
        {freeDeck ? 'Your first AI deck is free, no account needed' : `Sign in (free) to ${action} with AI`}
      </p>
      <p className="mt-0.5 text-xs text-ink-muted">
        {freeDeck
          ? 'Sign up free to make more, or add your own Gemini key in Settings → AI.'
          : onSignIn ? 'Or add your own Gemini key in Settings → AI.' : 'Use the account button in the menu, or add your own Gemini key in Settings → AI.'}
      </p>
    </div>
    {onSignIn && (
      <Button variant="primary" size="sm" onClick={onSignIn} className="shrink-0 self-start sm:self-center">
        {freeDeck ? 'Sign up' : 'Sign in'}
      </Button>
    )}
  </div>
);
