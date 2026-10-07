import React, { useState } from 'react';
import { User, Mail, Lock, Eye, EyeOff, School, UserPlus } from 'lucide-react';
import type { UserAccount } from '../../types';
import { AuthService } from '../../services/authService';
import { EducationFields } from './EducationFields';
import { createEducationDraft, resolveGrade } from './educationDraft';
import type { EducationDraft } from './educationDraft';
import {
  AvatarPicker,
  ErrorBanner,
  GoogleSignInButton,
  GuestMigrationToggle,
  OrDivider,
  PrimaryGradientButton,
} from './AuthParts';
import { getPasswordStrength } from './passwordStrength';

interface RegisterTabProps {
  googleError: string | null;
  isGoogleLoading: boolean;
  guest: { hasData: boolean; deckCount: number; cardCount: number };
  onGoogleClick: () => void;
  onGotoLogin: () => void;
  onSuccess: (user: UserAccount | null) => void;
}

export const RegisterTab: React.FC<RegisterTabProps> = ({
  googleError,
  isGoogleLoading,
  guest,
  onGoogleClick,
  onGotoLogin,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [edu, setEdu] = useState<EducationDraft>(() => createEducationDraft());
  const [avatar, setAvatar] = useState('🧠');
  const [institution, setInstitution] = useState('');
  const [migrateGuestData, setMigrateGuestData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  const strength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsRegistering(true);
    try {
      const res = await AuthService.register({
        name,
        email,
        password,
        age: edu.age,
        country: edu.country,
        grade: resolveGrade(edu),
        avatar,
        institution,
        migrateGuestData,
      });
      if (!res.success) {
        setError(res.error || 'Registration failed. Please check your inputs.');
        setIsRegistering(false);
        return;
      }
      setIsRegistering(false);
      onSuccess(res.user || null);
    } catch (err: unknown) {
      setIsRegistering(false);
      setError(err instanceof Error ? err.message : 'Unknown registration error');
    }
  };

  return (
    <div className="space-y-4">
      <ErrorBanner message={error} />
      <ErrorBanner message={googleError} />

      <GoogleSignInButton label="Sign up with Google" loading={isGoogleLoading} onClick={onGoogleClick} />
      <OrDivider label="or register with email" />

      <form onSubmit={handleSubmit} className="space-y-4">
        <AvatarPicker label="Choose Profile Avatar" value={avatar} onChange={setAvatar} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
              <User className="h-3.5 w-3.5 text-ink-subtle" />
              Name
            </label>
            <input
              type="text"
              required
              placeholder="Alex Rivera"
              value={name}
              onChange={e => setName(e.target.value)}
              className="h-10 w-full rounded-xl border border-line-strong bg-canvas px-3 text-sm text-ink placeholder:text-ink-subtle transition-colors focus:border-brand focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
              <Mail className="h-3.5 w-3.5 text-ink-subtle" />
              Email
            </label>
            <input
              type="email"
              required
              placeholder="alex@school.edu"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="h-10 w-full rounded-xl border border-line-strong bg-canvas px-3 text-sm text-ink placeholder:text-ink-subtle transition-colors focus:border-brand focus:outline-none"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="flex items-center justify-between text-[13px] font-medium text-ink">
            <span className="flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-ink-subtle" />
              Password
            </span>
            {password && (
              <span className={`text-[11px] font-semibold ${strength.color.split(' ')[0]}`}>{strength.label}</span>
            )}
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={6}
              placeholder="At least 6 characters"
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
          {password && (
            <div className="w-full h-1 bg-surface-hover rounded-full overflow-hidden mt-1">
              <div
                className={`h-full transition-all duration-300 ${strength.color.split(' ')[1]}`}
                style={{ width: `${strength.percent}%` }}
              />
            </div>
          )}
        </div>

        <EducationFields value={edu} onChange={setEdu} />

        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
            <School className="h-3.5 w-3.5 text-ink-subtle" />
            School (optional)
          </label>
          <input
            type="text"
            placeholder="e.g. Stanford University, Lincoln High, or Self-Taught"
            value={institution}
            onChange={e => setInstitution(e.target.value)}
            className="h-10 w-full rounded-xl border border-line-strong bg-canvas px-3 text-sm text-ink placeholder:text-ink-subtle transition-colors focus:border-brand focus:outline-none"
          />
        </div>

        {guest.hasData && (
          <GuestMigrationToggle
            deckCount={guest.deckCount}
            cardCount={guest.cardCount}
            checked={migrateGuestData}
            onChange={setMigrateGuestData}
            target="new account"
          />
        )}

        <PrimaryGradientButton loading={isRegistering} icon={<UserPlus className="w-4 h-4" />} className="mt-2">
          Create account
        </PrimaryGradientButton>

        <div className="text-center pt-2">
          <button
            type="button"
            onClick={onGotoLogin}
            className="text-xs text-brand-text hover:text-ink font-semibold cursor-pointer"
          >
            Already have an account? Log in
          </button>
        </div>
      </form>
    </div>
  );
};
