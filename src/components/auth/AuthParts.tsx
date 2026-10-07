import React from 'react';
import { AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';

/** Small presentational pieces shared by the account modal's tabs. */

export const GoogleIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24">
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
  <div
    className={`w-4 h-4 border-2 rounded-full animate-spin ${
      tone === 'light' ? 'border-white/30 border-t-white' : 'border-slate-400 border-t-slate-900'
    }`}
  />
);

export const ErrorBanner: React.FC<{ message: string | null }> = ({ message }) =>
  message ? (
    <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5 animate-shake">
      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
      <span>{message}</span>
    </div>
  ) : null;

export const SuccessBanner: React.FC<{ message: string | null }> = ({ message }) =>
  message ? (
    <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5 animate-fadeIn">
      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
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
    onClick={onClick}
    className={`pb-2.5 px-3 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
      active ? 'border-indigo-500 text-white font-bold' : 'border-transparent text-slate-400 hover:text-slate-200'
    }`}
  >
    {icon}
    <span>{children}</span>
  </button>
);

export const GoogleSignInButton: React.FC<{
  label: string;
  loading: boolean;
  onClick: () => void;
}> = ({ label, loading, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={loading}
    className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-xs transition-all flex items-center justify-center gap-2.5 shadow-sm border border-slate-200 cursor-pointer disabled:opacity-60"
  >
    {loading ? (
      <Spinner tone="dark" />
    ) : (
      <>
        <GoogleIcon className="w-4 h-4" />
        <span>{label}</span>
      </>
    )}
  </button>
);

export const OrDivider: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center gap-3 my-1">
    <div className="flex-1 h-px bg-white/[0.08]" />
    <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">{label}</span>
    <div className="flex-1 h-px bg-white/[0.08]" />
  </div>
);

export const PrimaryGradientButton: React.FC<{
  loading: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
  size?: 'md' | 'sm';
  fullWidth?: boolean;
  className?: string;
}> = ({ loading, icon, children, size = 'md', fullWidth = true, className = '' }) => (
  <button
    type="submit"
    disabled={loading}
    className={`${fullWidth ? 'w-full' : ''} ${size === 'md' ? 'py-3 text-sm' : 'py-3 text-xs'} px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${className}`}
  >
    {loading ? (
      <Spinner />
    ) : (
      <>
        {icon}
        <span>{children}</span>
      </>
    )}
  </button>
);

export const AvatarPicker: React.FC<{
  label: string;
  value: string;
  onChange: (avatar: string) => void;
}> = ({ label, value, onChange }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
      <span>{label}</span>
      <span className="text-[11px] text-slate-500">Selected: {value}</span>
    </label>
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
      {AVATAR_OPTIONS.map(av => (
        <button
          key={av}
          type="button"
          onClick={() => onChange(av)}
          className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-all shrink-0 cursor-pointer ${
            value === av
              ? 'bg-indigo-600 ring-2 ring-indigo-400 scale-110 shadow-md'
              : 'bg-slate-900 border border-white/[0.08] hover:bg-white/[0.08]'
          }`}
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
  <div className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 space-y-2">
    <div className="flex items-center justify-between">
      <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
        Guest Study Progress Detected
      </span>
      <span className="text-[11px] font-mono text-slate-400">
        {deckCount} decks • {cardCount} cards
      </span>
    </div>
    <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="mt-0.5 rounded border-indigo-500/50 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
      />
      <span>Import my current guest flashcards, decks, and FSRS memory stats into this {target}</span>
    </label>
  </div>
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
