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
  <div className="p-3 rounded-2xl bg-slate-900/80 border border-white/[0.08] space-y-1">
    <div className={`flex items-center gap-1.5 ${tone} text-xs font-semibold`}>
      {icon}
      <span>{label}</span>
    </div>
    <div className="text-sm font-bold text-white truncate">{value}</div>
    <div className="text-[11px] text-slate-500">{caption}</div>
  </div>
);

export const ProfileTab: React.FC<ProfileTabProps> = ({ user, canSwitchAccount, onEdit, onSwitch, onLogout }) => {
  const stats = StorageService.getStats();
  const country = EducationCatalog.getCountry(user.country);

  return (
    <div className="space-y-5">
      <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-purple-950/30 to-slate-900 border border-indigo-500/30 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <AccountAvatar
            pictureUrl={user.pictureUrl}
            name={user.name}
            avatar={user.avatar}
            className="w-14 h-14 rounded-2xl bg-indigo-600/30 border border-indigo-500/40 text-3xl shadow-inner"
          />
          <div>
            <h3 className="text-base font-extrabold text-white flex items-center gap-2 flex-wrap">
              <span>{user.name}</span>
              {user.provider === 'google' && (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-white text-slate-900 flex items-center gap-1 shadow-sm">
                  <GoogleIcon className="w-3 h-3" />
                  <span>Google</span>
                </span>
              )}
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5">
                <span>{country.flag}</span>
                <span>
                  {user.grade} • Age {user.age}
                </span>
              </span>
            </h3>
            <p className="text-xs text-slate-400">{user.email}</p>
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
              <Globe className="w-3 h-3 text-indigo-400 shrink-0" />
              <span>
                {user.country} ({country.systemName})
              </span>
            </p>
            {user.institution && (
              <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                <School className="w-3 h-3 text-slate-500" />
                {user.institution}
              </p>
            )}
          </div>
        </div>

        <button
          onClick={onEdit}
          className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-slate-300 hover:text-white transition-all text-xs flex items-center gap-1.5 cursor-pointer"
          title="Edit Profile"
        >
          <Edit3 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Edit</span>
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <StatCard
          icon={<Coins className="w-3.5 h-3.5" />}
          tone="text-amber-400"
          label="Study Wallet"
          value={`🪙 ${lifeSimService.getWalletBalance()} Tokens`}
          caption="Study wage balance"
        />
        <StatCard
          icon={<Flame className="w-3.5 h-3.5 fill-amber-400" />}
          tone="text-amber-400"
          label="Streak"
          value={`${stats.currentStreak} Days`}
          caption="Active consistency"
        />
        <StatCard
          icon={<Clock className="w-3.5 h-3.5" />}
          tone="text-indigo-400"
          label="Total Time"
          value={`${stats.totalStudyMinutes}m`}
          caption="Deep study focus"
        />
        <StatCard
          icon={<Layers className="w-3.5 h-3.5" />}
          tone="text-emerald-400"
          label="Retention"
          value={`${Math.round((stats.targetRetention || 0.9) * 100)}%`}
          caption="FSRS Target rate"
        />
      </div>

      <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-xs text-slate-400 space-y-1.5">
        <div className="flex items-center gap-2 text-slate-300 font-semibold">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Client-Side Cryptographic Security</span>
        </div>
        <p className="text-[11px] leading-relaxed text-slate-500">
          Your account password is salt-hashed with Web Crypto SHA-256. All decks, cards, and study stats are isolated in
          your personal browser storage space.
        </p>
      </div>

      <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
        <button
          onClick={onLogout}
          className="flex-1 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/[0.1] text-slate-300 hover:text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5 text-slate-400" />
          <span>Log Out (Switch to Guest)</span>
        </button>

        {canSwitchAccount && (
          <button
            onClick={onSwitch}
            className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Switch Account</span>
          </button>
        )}
      </div>
    </div>
  );
};
