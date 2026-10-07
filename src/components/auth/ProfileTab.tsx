import React from 'react';
import {
  Clock,
  Coins,
  Edit3,
  Flame,
  Globe,
  Layers,
  LogOut,
  RefreshCw,
  School,
  ShieldCheck,
} from 'lucide-react';
import type { UserAccount } from '../../types';
import { StorageService } from '../../services/storageService';
import { lifeSimService } from '../../services/lifeSimService';
import { EducationCatalog } from '../../services/educationCatalog';
import { AccountAvatar, GoogleIcon } from './AuthParts';

interface ProfileTabProps {
  user: UserAccount;
  canSwitchAccount: boolean;
  onEdit: () => void;
  onSwitch: () => void;
  onLogout: () => void;
}

const StatCard: React.FC<{
  icon: React.ReactNode;
  tone: string;
  label: string;
  value: React.ReactNode;
  caption: string;
}> = ({ icon, tone, label, value, caption }) => (
  <div className="p-3 rounded-2xl bg-canvas border border-line space-y-1">
    <div className={`flex items-center gap-1.5 ${tone} text-xs font-semibold`}>
      {icon}
      <span>{label}</span>
    </div>
    <div className="text-sm font-semibold text-ink truncate">{value}</div>
    <div className="text-[11px] text-ink-subtle">{caption}</div>
  </div>
);

export const ProfileTab: React.FC<ProfileTabProps> = ({ user, canSwitchAccount, onEdit, onSwitch, onLogout }) => {
  const stats = StorageService.getStats();
  const country = EducationCatalog.getCountry(user.country);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-center gap-3.5">
          <AccountAvatar
            pictureUrl={user.pictureUrl}
            name={user.name}
            avatar={user.avatar}
            className="w-14 h-14 rounded-2xl bg-brand-soft border border-brand/40 text-3xl shadow-inner"
          />
          <div>
            <h3 className="text-base font-semibold text-ink flex items-center gap-2 flex-wrap">
              <span>{user.name}</span>
              {user.provider === 'google' && (
                <span className="inline-flex items-center gap-1 rounded-md border border-line px-1.5 py-0.5 text-[11px] font-medium text-ink-muted">
                  <GoogleIcon className="w-3 h-3" />
                  <span>Google</span>
                </span>
              )}
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-brand-soft text-brand-text border border-brand/30 flex items-center gap-1.5">
                <span>{country.flag}</span>
                <span>
                  {user.grade} • Age {user.age}
                </span>
              </span>
            </h3>
            <p className="text-xs text-ink-subtle">{user.email}</p>
            <p className="text-[11px] text-ink-subtle flex items-center gap-1.5 mt-0.5">
              <Globe className="w-3 h-3 text-brand-text shrink-0" />
              <span>
                {user.country} ({country.systemName})
              </span>
            </p>
            {user.institution && (
              <p className="text-[11px] text-ink-subtle flex items-center gap-1 mt-0.5">
                <School className="w-3 h-3 text-ink-subtle" />
                {user.institution}
              </p>
            )}
          </div>
        </div>

        <button
          onClick={onEdit}
          className="p-2 rounded-xl bg-surface hover:bg-surface-hover border border-line text-ink-muted hover:text-ink transition-all text-xs flex items-center gap-1.5 cursor-pointer"
          title="Edit Profile"
        >
          <Edit3 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Edit</span>
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <StatCard
          icon={<Coins className="w-3.5 h-3.5" />}
          tone="text-gold"
          label="Study Wallet"
          value={`🪙 ${lifeSimService.getWalletBalance()} Tokens`}
          caption="Study wage balance"
        />
        <StatCard
          icon={<Flame className="w-3.5 h-3.5 fill-gold" />}
          tone="text-gold"
          label="Streak"
          value={`${stats.currentStreak} Days`}
          caption="Active consistency"
        />
        <StatCard
          icon={<Clock className="w-3.5 h-3.5" />}
          tone="text-brand-text"
          label="Total Time"
          value={`${stats.totalStudyMinutes}m`}
          caption="Time studied"
        />
        <StatCard
          icon={<Layers className="w-3.5 h-3.5" />}
          tone="text-success"
          label="Retention"
          value={`${Math.round((stats.targetRetention || 0.9) * 100)}%`}
          caption="Memory target"
        />
      </div>

      <div className="p-3.5 rounded-2xl bg-surface border border-line text-xs text-ink-subtle space-y-1.5">
        <div className="flex items-center gap-2 text-ink-muted font-semibold">
          <ShieldCheck className="w-4 h-4 text-success" />
          <span>Private to this browser</span>
        </div>
        <p className="text-[11px] leading-relaxed text-ink-subtle">
          Your password is never stored as plain text, and your decks, cards and stats stay in this browser.
        </p>
      </div>

      <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
        <button
          onClick={onLogout}
          className="flex-1 py-2.5 px-4 rounded-xl bg-canvas hover:bg-surface-hover border border-line-strong text-ink-muted hover:text-ink font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5 text-ink-subtle" />
          <span>Log out</span>
        </button>

        {canSwitchAccount && (
          <button
            onClick={onSwitch}
            className="flex-1 py-2.5 px-4 rounded-xl bg-brand-soft hover:bg-brand-soft border border-brand/40 text-brand-text font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Switch account</span>
          </button>
        )}
      </div>
    </div>
  );
};
