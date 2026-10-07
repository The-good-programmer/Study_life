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
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-indigo-400" />
              Full Name
            </label>
            <input
              type="text"
              required
              placeholder="Alex Rivera"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-900/80 border border-white/[0.1] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-indigo-400" />
              Email
            </label>
            <input
              type="email"
              required
              placeholder="alex@school.edu"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-900/80 border border-white/[0.1] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-indigo-400" />
              Create Password
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
              className="w-full px-3.5 py-2 rounded-xl bg-slate-900/80 border border-white/[0.1] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(shown => !shown)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {password && (
            <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mt-1">
              <div
                className={`h-full transition-all duration-300 ${strength.color.split(' ')[1]}`}
                style={{ width: `${strength.percent}%` }}
              />
            </div>
          )}
        </div>

        <EducationFields value={edu} onChange={setEdu} />

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <School className="w-3.5 h-3.5 text-indigo-400" />
            School or University (Optional)
          </label>
          <input
            type="text"
            placeholder="e.g. Stanford University, Lincoln High, or Self-Taught"
            value={institution}
            onChange={e => setInstitution(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl bg-slate-900/80 border border-white/[0.1] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
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
          Create Free Private Account
        </PrimaryGradientButton>

        <div className="text-center pt-2">
          <button
            type="button"
            onClick={onGotoLogin}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
          >
            Already have an account? Log in here →
          </button>
        </div>
      </form>
    </div>
  );
};
