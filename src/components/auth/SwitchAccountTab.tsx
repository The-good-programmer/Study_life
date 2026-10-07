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
      <span className="text-xs font-semibold text-ink-muted">Accounts on this browser</span>
      <button
        onClick={onAddAccount}
        className="text-xs text-brand-text hover:text-ink font-semibold flex items-center gap-1 cursor-pointer"
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
                ? 'bg-brand-soft border-brand/50 ring-1 ring-brand-soft'
                : 'bg-surface border-line hover:bg-surface-hover'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <AccountAvatar
                pictureUrl={acc.pictureUrl}
                name={acc.name}
                avatar={acc.avatar}
                className="w-10 h-10 rounded-xl bg-brand-soft border border-brand/30 text-xl"
              />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-ink truncate flex items-center gap-2">
                  {acc.name}
                  {acc.provider === 'google' && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-line px-1.5 py-0.5 text-[11px] font-medium text-ink-muted">
                      <GoogleIcon className="w-2.5 h-2.5" />
                      Google
                    </span>
                  )}
                  {isCurrent && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-success-soft text-success font-mono">
                      Active
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-ink-subtle truncate">{acc.email}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {!isCurrent && (
                <button
                  onClick={() => onSwitch(acc)}
                  className="px-3 py-1.5 rounded-xl bg-brand hover:bg-brand-hover text-brand-ink font-semibold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
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

    <div className="pt-2 border-t border-line flex items-center justify-between">
      <button onClick={onBack} className="text-xs text-ink-subtle hover:text-ink cursor-pointer">
        ← Back to Profile
      </button>
      <button onClick={onLogout} className="text-xs text-danger hover:opacity-80 font-semibold cursor-pointer">
        Log out and continue as a guest
      </button>
    </div>
  </div>
);
