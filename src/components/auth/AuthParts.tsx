import React from 'react';
import { AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';
import { cn } from '../../utils/cn';

/** Small presentational pieces shared by the account modal's tabs. */

/** Text inputs in the account forms. */
export const AUTH_INPUT =
  'h-10 w-full rounded-xl border border-line-strong bg-canvas px-3 text-sm text-ink placeholder:text-ink-subtle transition-colors focus:border-brand focus:outline-none';

export const GoogleIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

const AVATAR_OPTIONS = ['🧠', '🚀', '🦉', '🎓', '⚡', '🔬', '🪐', '🎨', '💡', '🧬', '🏆', '💎', '📚', '🌟'];

export const Spinner: React.FC<{ tone?: 'light' | 'dark' }> = ({ tone = 'light' }) => (
  <span
    className={cn(
      'inline-block h-4 w-4 animate-spin rounded-full border-2',
      tone === 'light' ? 'border-white/30 border-t-white' : 'border-black/20 border-t-black/70',
    )}
    role="status"
    aria-label="Loading"
  />
);

export const ErrorBanner: React.FC<{ message: string | null }> = ({ message }) =>
  message ? (
    <div className="flex items-start gap-2.5 rounded-xl bg-danger-soft px-3.5 py-2.5 text-[13px] text-danger animate-shake" role="alert">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  ) : null;

export const SuccessBanner: React.FC<{ message: string | null }> = ({ message }) =>
  message ? (
    <div className="flex items-start gap-2.5 rounded-xl bg-success-soft px-3.5 py-2.5 text-[13px] text-success animate-fadeIn" role="status">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  ) : null;

export const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}> = ({ active, onClick, icon, children }) => (
  <button
    type="button"
    role="tab"
    aria-selected={active}
    onClick={onClick}
    className={cn(
      'inline-flex shrink-0 items-center gap-1.5 border-b-2 pb-2.5 text-[13px] font-medium transition-colors cursor-pointer',
      active ? 'border-ink text-ink' : 'border-transparent text-ink-subtle hover:text-ink',
    )}
  >
    {icon}
    {children}
  </button>
);

/** Follows Google's button style: white in both themes. */
export const GoogleSignInButton: React.FC<{
  label: string;
  loading: boolean;
  onClick: () => void;
}> = ({ label, loading, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={loading}
    className="flex h-10 w-full items-center justify-center gap-2.5 rounded-xl border border-[#dadce0] bg-white px-4 text-sm font-medium text-[#1f1f1f] transition-colors hover:bg-[#f8f9fa] disabled:opacity-60 cursor-pointer"
  >
    {loading ? (
      <Spinner tone="dark" />
    ) : (
      <>
        <GoogleIcon className="h-4 w-4" />
        {label}
      </>
    )}
  </button>
);

export const OrDivider: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center gap-3">
    <div className="h-px flex-1 bg-line" />
    <span className="text-xs text-ink-subtle">{label}</span>
    <div className="h-px flex-1 bg-line" />
  </div>
);

/** The main submit button of an account form. */
export const PrimaryGradientButton: React.FC<{
  loading: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
  size?: 'md' | 'sm';
  fullWidth?: boolean;
  className?: string;
  /** Id of the form to submit, when the button sits outside it (e.g. in a dialog footer). */
  form?: string;
}> = ({ loading, icon, children, size = 'md', fullWidth = true, className = '', form }) => (
  <button
    type="submit"
    form={form}
    disabled={loading}
    className={cn(
      'inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 font-medium text-brand-ink transition-colors hover:bg-brand-hover disabled:opacity-60 cursor-pointer',
      'shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_1px_2px_rgb(0_0_0/0.3)]',
      size === 'md' ? 'h-11 text-sm' : 'h-10 text-[13px]',
      fullWidth && 'w-full',
      className,
    )}
  >
    {loading ? (
      <Spinner />
    ) : (
      <>
        {icon}
        {children}
      </>
    )}
  </button>
);

export const AvatarPicker: React.FC<{
  label: string;
  value: string;
  onChange: (avatar: string) => void;
}> = ({ label, value, onChange }) => (
  <div>
    <p className="text-[13px] font-medium text-ink">{label}</p>
    <div className="mt-1.5 flex gap-1.5 overflow-x-auto pb-1 no-scrollbar" role="radiogroup" aria-label={label}>
      {AVATAR_OPTIONS.map(av => (
        <button
          key={av}
          type="button"
          role="radio"
          aria-checked={value === av}
          onClick={() => onChange(av)}
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg transition-colors cursor-pointer',
            value === av ? 'bg-brand-soft ring-2 ring-brand' : 'border border-line hover:bg-surface-hover',
          )}
        >
          {av}
        </button>
      ))}
    </div>
  </div>
);

export const GuestMigrationToggle: React.FC<{
  deckCount: number;
  cardCount: number;
  checked: boolean;
  onChange: (checked: boolean) => void;
  target: string;
}> = ({ deckCount, cardCount, checked, onChange, target }) => (
  <label className="flex cursor-pointer select-none items-start gap-3 rounded-2xl border border-brand/30 bg-brand-soft p-3.5">
    <input
      type="checkbox"
      checked={checked}
      onChange={e => onChange(e.target.checked)}
      className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-brand"
    />
    <span className="min-w-0">
      <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
        <Sparkles className="h-3.5 w-3.5 text-brand-text" aria-hidden="true" />
        Bring your guest progress
      </span>
      <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">
        Move your {deckCount} {deckCount === 1 ? 'deck' : 'decks'} and {cardCount} {cardCount === 1 ? 'card' : 'cards'}, with their review
        history, into this {target}.
      </span>
    </span>
  </label>
);

export const AccountAvatar: React.FC<{
  pictureUrl?: string;
  name: string;
  avatar: string;
  className: string;
}> = ({ pictureUrl, name, avatar, className }) => (
  <div className={`flex items-center justify-center shrink-0 overflow-hidden ${className}`}>
    {pictureUrl ? <img src={pictureUrl} alt={name} className="w-full h-full object-cover" /> : avatar}
  </div>
);
