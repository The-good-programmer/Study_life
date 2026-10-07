import React, { useState } from 'react';
import { CheckCircle2, Info, Sparkles } from 'lucide-react';
import type { GoogleProfilePayload, UserAccount } from '../../types';
import { AuthService } from '../../services/authService';
import { EducationFields } from './EducationFields';
import { createEducationDraft, resolveGrade } from './educationDraft';
import type { EducationDraft } from './educationDraft';
import { ErrorBanner, GoogleIcon, GuestMigrationToggle, PrimaryGradientButton } from './AuthParts';

interface GoogleSetupTabProps {
  profile: GoogleProfilePayload;
  guest: { hasData: boolean; deckCount: number; cardCount: number };
  onCancel: () => void;
  onSuccess: (user: UserAccount) => void;
}

/** First-time Google onboarding: collects country, grade and age before the account is created. */
export const GoogleSetupTab: React.FC<GoogleSetupTabProps> = ({ profile, guest, onCancel, onSuccess }) => {
  const [edu, setEdu] = useState<EducationDraft>(() => createEducationDraft({ age: 15 }));
  const [migrateGuestData, setMigrateGuestData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const res = await AuthService.signInWithGoogle({
        googleId: profile.googleId,
        email: profile.email,
        name: profile.name,
        pictureUrl: profile.pictureUrl,
        age: edu.age,
        country: edu.country,
        grade: resolveGrade(edu),
        avatar: '🌐',
        migrateGuestData,
      });
      if (!res.success || !res.user) {
        setError(res.error || 'Failed to complete profile registration.');
        setIsLoading(false);
        return;
      }
      setIsLoading(false);
      onSuccess(res.user);
    } catch (err: unknown) {
      setIsLoading(false);
      setError(err instanceof Error ? err.message : 'Profile completion error');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <ErrorBanner message={error} />

      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-purple-950/30 border border-blue-500/30 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-white/[0.08] border border-white/[0.12] flex items-center justify-center text-xl shrink-0 overflow-hidden">
            {profile.pictureUrl ? (
              <img src={profile.pictureUrl} alt={profile.name} className="w-full h-full object-cover" />
            ) : (
              <GoogleIcon className="w-6 h-6" />
            )}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
              <span>{profile.name}</span>
              <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1 font-mono">
                <CheckCircle2 className="w-2.5 h-2.5 text-blue-400" />
                Verified Google
              </span>
            </div>
            <div className="text-[11px] text-slate-400 truncate">{profile.email}</div>
          </div>
        </div>
      </div>

      <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.08] text-xs text-slate-300 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <span className="leading-relaxed text-slate-400 text-[11px]">
          One last step! Gemini AI customizes flashcard depth, vocabulary, and exam topics based on your country and
          grade curriculum.
        </span>
      </div>

      <EducationFields
        value={edu}
        onChange={setEdu}
        title="Target Grade & Educational System"
        customGradePlaceholder="e.g. 4th Grade, University Sophomore, or AP Scholar"
      />

      {guest.hasData && (
        <GuestMigrationToggle
          deckCount={guest.deckCount}
          cardCount={guest.cardCount}
          checked={migrateGuestData}
          onChange={setMigrateGuestData}
          target="Google account"
        />
      )}

      <div className="pt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="py-3 px-4 rounded-xl bg-slate-900 text-slate-300 hover:text-white border border-white/[0.08] text-xs font-semibold cursor-pointer"
        >
          Cancel
        </button>
        <PrimaryGradientButton
          loading={isLoading}
          size="sm"
          icon={<Sparkles className="w-4 h-4" />}
          fullWidth={false}
          className="flex-1"
        >
          Complete & Start Studying ✨
        </PrimaryGradientButton>
      </div>
    </form>
  );
};
