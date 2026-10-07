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

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-3.5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-surface-hover border border-line-strong flex items-center justify-center text-xl shrink-0 overflow-hidden">
            {profile.pictureUrl ? (
              <img src={profile.pictureUrl} alt={profile.name} className="w-full h-full object-cover" />
            ) : (
              <GoogleIcon className="w-6 h-6" />
            )}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-ink truncate flex items-center gap-1.5">
              <span>{profile.name}</span>
              <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-brand-soft text-brand-text border border-brand/30 flex items-center gap-1 font-mono">
                <CheckCircle2 className="w-2.5 h-2.5 text-brand-text" />
                Google
              </span>
            </div>
            <div className="text-[11px] text-ink-subtle truncate">{profile.email}</div>
          </div>
        </div>
      </div>

      <div className="p-3 rounded-2xl bg-surface border border-line text-xs text-ink-muted flex items-start gap-2.5">
        <Info className="w-4 h-4 text-brand-text shrink-0 mt-0.5" />
        <span className="leading-relaxed text-ink-subtle text-[11px]">
          One last step: your country and level help Studify match decks to your curriculum.
        </span>
      </div>

      <EducationFields
        value={edu}
        onChange={setEdu}
        title="Your level"
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
          className="py-3 px-4 rounded-xl bg-canvas text-ink-muted hover:text-ink border border-line text-xs font-semibold cursor-pointer"
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
