import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, LogIn } from 'lucide-react';
import type { GoogleProfilePayload, UserAccount } from '../../types';
import { AuthService } from '../../services/authService';
import {
  AccountAvatar,
  ErrorBanner,
  GoogleIcon,
  GoogleSignInButton,
  OrDivider,
  PrimaryGradientButton,
} from './AuthParts';

export interface LoginPrefill {
  email: string;
  error: string;
}

interface LoginTabProps {
  accounts: UserAccount[];
  googleError: string | null;
  isGoogleLoading: boolean;
  /** Set when arriving from "switch account" for a password-protected profile. */
  prefill?: LoginPrefill | null;
  onGoogleClick: () => void;
  onGoogleAccount: (payload: GoogleProfilePayload) => void;
  onGotoRegister: () => void;
  onSuccess: (user: UserAccount | null) => void;
}

export const LoginTab: React.FC<LoginTabProps> = ({
  accounts,
  googleError,
  isGoogleLoading,
  prefill,
  onGoogleClick,
  onGoogleAccount,
  onGotoRegister,
  onSuccess,
}) => {
  const [email, setEmail] = useState(prefill?.email ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(prefill?.error ?? null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoggingIn(true);
    try {
      const res = await AuthService.login({ email, password });
      if (!res.success) {
        setError(res.error || 'Failed to log in. Please check credentials.');
        setIsLoggingIn(false);
        return;
      }
      setIsLoggingIn(false);
      onSuccess(res.user || null);
    } catch (err: unknown) {
      setIsLoggingIn(false);
      setError(err instanceof Error ? err.message : 'Unknown login error');
    }
  };

  const pickAccount = (acc: UserAccount) => {
    if (acc.provider === 'google') {
      onGoogleAccount({
        googleId: acc.googleId || `google-${acc.id}`,
        email: acc.email,
        name: acc.name,
        pictureUrl: acc.pictureUrl,
      });
    } else {
      setEmail(acc.email);
    }
  };

  return (
    <div className="space-y-4">
      <ErrorBanner message={error} />
      <ErrorBanner message={googleError} />

      <GoogleSignInButton label="Continue with Google" loading={isGoogleLoading} onClick={onGoogleClick} />
      <OrDivider label="or sign in with email" />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
            <Mail className="h-3.5 w-3.5 text-ink-subtle" />
            Email
          </label>
          <input
            type="email"
            required
            placeholder="student@school.edu"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="h-10 w-full rounded-xl border border-line-strong bg-canvas px-3 text-sm text-ink placeholder:text-ink-subtle transition-colors focus:border-brand focus:outline-none"
          />
        </div>

        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
            <Lock className="h-3.5 w-3.5 text-ink-subtle" />
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="h-10 w-full rounded-xl border border-line-strong bg-canvas px-3 text-sm text-ink placeholder:text-ink-subtle transition-colors focus:border-brand focus:outline-none pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(shown => !shown)}
              className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {accounts.length > 0 && (
          <div className="pt-2">
            <span className="text-[11px] font-semibold text-ink-subtle block mb-2">
              Accounts on this browser
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {accounts.map(acc => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => pickAccount(acc)}
                  className="text-left p-2.5 rounded-xl bg-surface hover:bg-surface-hover border border-line flex items-center gap-2.5 transition-all cursor-pointer"
                >
                  <AccountAvatar
                    pictureUrl={acc.pictureUrl}
                    name={acc.name}
                    avatar={acc.avatar}
                    className="w-8 h-8 rounded-lg bg-brand-soft text-base"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-ink truncate flex items-center gap-1.5">
                      <span>{acc.name}</span>
                      {acc.provider === 'google' && <GoogleIcon className="w-2.5 h-2.5 shrink-0" />}
                    </div>
                    <div className="text-[11px] text-ink-subtle truncate">{acc.email}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <PrimaryGradientButton loading={isLoggingIn} icon={<LogIn className="w-4 h-4" />} className="mt-2">
          Log in
        </PrimaryGradientButton>

        <div className="text-center pt-2">
          <button
            type="button"
            onClick={onGotoRegister}
            className="text-xs text-brand-text hover:text-ink font-semibold cursor-pointer"
          >
            New to Studify? Create an account
          </button>
        </div>
      </form>
    </div>
  );
};
