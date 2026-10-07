import React from 'react';
import { ArrowRight, UserPlus } from 'lucide-react';
import type { UserAccount } from '../../types';
import { AccountAvatar, GoogleIcon } from './AuthParts';

interface SwitchAccountTabProps {
  accounts: UserAccount[];
  currentUserId?: string;
  onSwitch: (account: UserAccount) => void;
  onAddAccount: () => void;
  onBack: () => void;
  onLogout: () => void;
}

export const SwitchAccountTab: React.FC<SwitchAccountTabProps> = ({
  accounts,
  currentUserId,
  onSwitch,
  onAddAccount,
  onBack,
  onLogout,
}) => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <span className="text-xs font-bold text-slate-300">Switch to Another Profile</span>
      <button
        onClick={onAddAccount}
        className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 cursor-pointer"
      >
        <UserPlus className="w-3.5 h-3.5" />
        <span>Add another account</span>
      </button>
    </div>

    <div className="space-y-2">
      {accounts.map(acc => {
        const isCurrent = currentUserId === acc.id;
        return (
          <div
            key={acc.id}
            className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition-all ${
              isCurrent
                ? 'bg-indigo-950/40 border-indigo-500/50 ring-1 ring-indigo-500/30'
                : 'bg-slate-900/60 border-white/[0.08] hover:bg-white/[0.04]'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <AccountAvatar
                pictureUrl={acc.pictureUrl}
                name={acc.name}
                avatar={acc.avatar}
                className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-xl"
              />
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate flex items-center gap-2">
                  {acc.name}
                  {acc.provider === 'google' && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-white text-slate-900 font-medium flex items-center gap-1 shadow-sm">
                      <GoogleIcon className="w-2.5 h-2.5" />
                      Google
                    </span>
                  )}
                  {isCurrent && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono">
                      Active
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 truncate">{acc.email}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {!isCurrent && (
                <button
                  onClick={() => onSwitch(acc)}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <span>Switch</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>

    <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between">
      <button onClick={onBack} className="text-xs text-slate-400 hover:text-white cursor-pointer">
        ← Back to Profile
      </button>
      <button onClick={onLogout} className="text-xs text-rose-400 hover:text-rose-300 font-semibold cursor-pointer">
        Log Out to Guest Mode
      </button>
    </div>
  </div>
);
