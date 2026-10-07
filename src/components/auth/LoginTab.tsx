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
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-indigo-400" />
            Email Address
          </label>
          <input
            type="email"
            required
            placeholder="student@school.edu"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-white/[0.1] text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-indigo-400" />
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-white/[0.1] text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(shown => !shown)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {accounts.length > 0 && (
          <div className="pt-2">
            <span className="text-[11px] font-semibold text-slate-400 block mb-2">
              Or select an account saved on this browser:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {accounts.map(acc => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => pickAccount(acc)}
                  className="text-left p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] flex items-center gap-2.5 transition-all cursor-pointer"
                >
                  <AccountAvatar
                    pictureUrl={acc.pictureUrl}
                    name={acc.name}
                    avatar={acc.avatar}
                    className="w-8 h-8 rounded-lg bg-indigo-600/20 text-base"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                      <span>{acc.name}</span>
                      {acc.provider === 'google' && <GoogleIcon className="w-2.5 h-2.5 shrink-0" />}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">{acc.email}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <PrimaryGradientButton loading={isLoggingIn} icon={<LogIn className="w-4 h-4" />} className="mt-2">
          Log In to Account
        </PrimaryGradientButton>

        <div className="text-center pt-2">
          <button
            type="button"
            onClick={onGotoRegister}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
          >
            Don't have an account? Sign up here →
          </button>
        </div>
      </form>
    </div>
  );
};
