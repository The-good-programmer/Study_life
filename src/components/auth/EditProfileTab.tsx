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
        <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-indigo-400" />
          Display Name
        </label>
        <input
          type="text"
          required
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full px-3.5 py-2 rounded-xl bg-slate-900/80 border border-white/[0.1] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
        />
      </div>

      <EducationFields value={edu} onChange={setEdu} title="Target Grade & Educational System" />

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
          <School className="w-3.5 h-3.5 text-indigo-400" />
          School or Institution
        </label>
        <input
          type="text"
          placeholder="e.g. Harvard University"
          value={institution}
          onChange={e => setInstitution(e.target.value)}
          className="w-full px-3.5 py-2 rounded-xl bg-slate-900/80 border border-white/[0.1] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
        />
      </div>

      <div className="pt-2 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="py-2.5 px-4 rounded-xl bg-slate-900 text-slate-300 hover:text-white border border-white/[0.08] text-xs font-semibold cursor-pointer"
        >
          Cancel
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onDelete(user.id)}
            className="p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            title="Delete Account"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Delete</span>
          </button>

          <button
            type="submit"
            className="py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
          >
            Save Changes
          </button>
        </div>
      </div>
    </form>
  );
};
