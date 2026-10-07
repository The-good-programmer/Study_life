import React, { useState } from 'react';
import { School, Trash2, User } from 'lucide-react';
import type { UserAccount } from '../../types';
import { AuthService } from '../../services/authService';
import { EducationFields } from './EducationFields';
import { educationFromUser, resolveGrade } from './educationDraft';
import type { EducationDraft } from './educationDraft';
import { AvatarPicker, ErrorBanner, SuccessBanner } from './AuthParts';

interface EditProfileTabProps {
  user: UserAccount;
  onCancel: () => void;
  /** Called as soon as the profile is saved. */
  onSaved: (user: UserAccount) => void;
  /** Called after the confirmation has been shown. */
  onDone: () => void;
  onDelete: (userId: string) => void;
}

export const EditProfileTab: React.FC<EditProfileTabProps> = ({ user, onCancel, onSaved, onDone, onDelete }) => {
  const [name, setName] = useState(user.name);
  const [edu, setEdu] = useState<EducationDraft>(() => educationFromUser(user));
  const [avatar, setAvatar] = useState(user.avatar || '🧠');
  const [institution, setInstitution] = useState(user.institution || '');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) {
      setError('Name must be at least 2 characters.');
      return;
    }

    const updated = AuthService.updateProfile(user.id, {
      name,
      age: edu.age,
      country: edu.country,
      grade: resolveGrade(edu),
      avatar,
      institution,
    });

    if (updated) {
      setSuccessMsg('Profile updated successfully!');
      onSaved(updated);
      // Let the confirmation show briefly before returning to the overview.
      setTimeout(onDone, 900);
    } else {
      setError('Could not save your profile. Please try again.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <SuccessBanner message={successMsg} />
      <ErrorBanner message={error} />

      <AvatarPicker label="Profile Avatar" value={avatar} onChange={setAvatar} />

      <div className="space-y-1.5">
        <label className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
          <User className="h-3.5 w-3.5 text-ink-subtle" />
          Name
        </label>
        <input
          type="text"
          required
          value={name}
          onChange={e => setName(e.target.value)}
          className="h-10 w-full rounded-xl border border-line-strong bg-canvas px-3 text-sm text-ink placeholder:text-ink-subtle transition-colors focus:border-brand focus:outline-none"
        />
      </div>

      <EducationFields value={edu} onChange={setEdu} title="Target Grade & Educational System" />

      <div className="space-y-1.5">
        <label className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
          <School className="h-3.5 w-3.5 text-ink-subtle" />
          School
        </label>
        <input
          type="text"
          placeholder="e.g. Harvard University"
          value={institution}
          onChange={e => setInstitution(e.target.value)}
          className="h-10 w-full rounded-xl border border-line-strong bg-canvas px-3 text-sm text-ink placeholder:text-ink-subtle transition-colors focus:border-brand focus:outline-none"
        />
      </div>

      <div className="pt-2 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="py-2.5 px-4 rounded-xl bg-canvas text-ink-muted hover:text-ink border border-line text-xs font-semibold cursor-pointer"
        >
          Cancel
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onDelete(user.id)}
            className="p-2.5 rounded-xl bg-danger-soft hover:bg-danger-soft text-danger border border-danger/30 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            title="Delete Account"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Delete</span>
          </button>

          <button
            type="submit"
            className="py-2.5 px-5 rounded-xl bg-brand hover:bg-brand-hover text-brand-ink font-semibold text-xs shadow-md transition-all cursor-pointer"
          >
            Save changes
          </button>
        </div>
      </div>
    </form>
  );
};
