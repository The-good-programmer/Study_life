import React, { useState } from 'react';
import { ArrowLeft, KeyRound, Mail } from 'lucide-react';
import type { UserAccount } from '../../types';
import { AuthService } from '../../services/authService';
import { AUTH_INPUT, ErrorBanner, PrimaryGradientButton, SuccessBanner } from './AuthParts';

/** "Forgot password?": asks for the email and sends a reset link. */
export const ForgotPasswordForm: React.FC<{ initialEmail?: string; onBack: () => void }> = ({ initialEmail = '', onBack }) => {
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await AuthService.requestPasswordReset(email);
    setBusy(false);
    if (result.ok) setSent(result.message);
    else setError(result.message);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h3 className="text-[15px] font-semibold text-ink">Reset your password</h3>
        <p className="mt-1 text-[13px] text-ink-muted">Enter the email you signed up with. We'll send a link to choose a new password.</p>
      </div>
      <ErrorBanner message={error} />
      <SuccessBanner message={sent} />
      {!sent && (
        <>
          <label className="block space-y-1.5">
            <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
              <Mail className="h-3.5 w-3.5 text-ink-subtle" aria-hidden="true" />
              Email
            </span>
            <input type="email" required autoFocus value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className={AUTH_INPUT} />
          </label>
          <PrimaryGradientButton loading={busy} icon={<Mail className="h-4 w-4" />}>
            Send reset link
          </PrimaryGradientButton>
        </>
      )}
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-text hover:underline cursor-pointer">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Back to log in
      </button>
    </form>
  );
};

/** Opened from the link in the reset email: choose a new password, then you're signed in. */
export const ResetPasswordForm: React.FC<{ token: string; onDone: (user: UserAccount | null) => void; onAskAgain: () => void }> = ({
  token,
  onDone,
  onAskAgain,
}) => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await AuthService.resetPassword(token, password);
    setBusy(false);
    if (res.success) onDone(res.user ?? null);
    else setError(res.error ?? "Couldn't reset your password.");
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h3 className="text-[15px] font-semibold text-ink">Choose a new password</h3>
        <p className="mt-1 text-[13px] text-ink-muted">At least 6 characters. You'll be signed in straight away.</p>
      </div>
      <ErrorBanner message={error} />
      <label className="block space-y-1.5">
        <span className="text-[13px] font-medium text-ink">New password</span>
        <input type="password" required minLength={6} autoFocus autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className={AUTH_INPUT} />
      </label>
      <label className="block space-y-1.5">
        <span className="text-[13px] font-medium text-ink">Type it again</span>
        <input type="password" required minLength={6} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} className={AUTH_INPUT} />
      </label>
      <PrimaryGradientButton loading={busy} icon={<KeyRound className="h-4 w-4" />}>
        Save and sign in
      </PrimaryGradientButton>
      {error && /expired|already used/.test(error) && (
        <button type="button" onClick={onAskAgain} className="text-[13px] font-medium text-brand-text hover:underline cursor-pointer">
          Send me a new link
        </button>
      )}
    </form>
  );
};
