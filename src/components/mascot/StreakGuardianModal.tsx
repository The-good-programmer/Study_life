import React, { useState } from 'react';
import { BellRing, Check, Flame, Play, Snowflake } from 'lucide-react';
import type { UserStats } from '../../types';
import { StorageService } from '../../services/storageService';
import { soundEngine } from '../../services/soundEngine';
import { NotificationService } from '../../services/notificationService';
import { lifeSimService, STREAK_FREEZE_COST } from '../../services/lifeSimService';
import { cn } from '../../utils/cn';
import { UserAvatarBadge } from '../character/UserAvatarBadge';
import { Dialog, DialogFooter, DialogHeader, DialogPanel } from '../common/Dialog';
import { Badge, Button, ProgressBar, Toggle, Tokens } from '../ui/primitives';

interface StreakGuardianModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: UserStats;
  onLaunchStreakSaver?: () => void;
}

/** Your streak: whether today counts yet, a freeze for a missed day, and evening reminders. */
export const StreakGuardianModal: React.FC<StreakGuardianModalProps> = ({ isOpen, onClose, stats, onLaunchStreakSaver }) => {
  const [hasFreeze, setHasFreeze] = useState(() => StorageService.hasSynapticFreeze());
  const [wallet, setWallet] = useState(() => lifeSimService.getWalletBalance());
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const [remindersOn, setRemindersOn] = useState(
    () => NotificationService.getSettings().enabled && NotificationService.getPermission() === 'granted',
  );

  const todayCounts = stats.todayMinutes > 0;
  const goalPercent = stats.dailyGoalMinutes > 0 ? (stats.todayMinutes / stats.dailyGoalMinutes) * 100 : 0;

  const buyFreeze = () => {
    const result = lifeSimService.buyStreakFreeze();
    if (result.success) {
      setHasFreeze(true);
      setWallet(lifeSimService.getWalletBalance());
      soundEngine.playSuccess();
      setNotice({ text: 'Freeze ready. It covers the next day you miss.', ok: true });
    } else {
      setNotice({ text: result.error || 'Could not buy a freeze just now.', ok: false });
    }
  };

  const setReminders = async (on: boolean) => {
    if (!on) {
      NotificationService.saveSettings({ enabled: false });
      setRemindersOn(false);
      setNotice({ text: 'Reminders are off.', ok: true });
      return;
    }
    const granted = await NotificationService.requestPermission();
    setRemindersOn(granted);
    setNotice(
      granted
        ? { text: "Reminders are on. You'll get one at 7 pm on days you haven't studied yet.", ok: true }
        : { text: 'Your browser blocked notifications. Allow them for this site in its settings, then try again.', ok: false },
    );
  };

  const sendTest = async () => {
    const sent = await NotificationService.sendTestNotification();
    setNotice(
      sent ? { text: 'Test reminder sent.', ok: true } : { text: 'Could not send it. Check that notifications are allowed for this site.', ok: false },
    );
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} titleId="streak-title" className="max-w-md">
      <DialogPanel>
        <DialogHeader
          titleId="streak-title"
          title="Your streak"
          description="Study a little every day to keep it going. Any review counts."
          onClose={onClose}
        />

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 shrink-0">
              <UserAvatarBadge size="md" />
              <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface-solid bg-gold text-[#2a1d00]">
                <Flame className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
              </span>
            </div>
            <div className="min-w-0">
              <p className="flex items-baseline gap-1.5">
                <span className="text-[34px] font-semibold leading-none tracking-tight tabular-nums text-ink">{stats.currentStreak}</span>
                <span className="text-[15px] text-ink-muted">{stats.currentStreak === 1 ? 'day' : 'days'}</span>
              </p>
              <p className={cn('mt-1.5 text-[13px]', todayCounts ? 'text-success' : 'text-gold')}>
                {todayCounts ? 'Today counts. Your streak is safe.' : 'Today doesn’t count yet.'}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-canvas p-4">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-ink-muted">Today's goal</span>
              <span className="tabular-nums text-ink-subtle">
                <span className="font-medium text-ink">{stats.todayMinutes}</span> of {stats.dailyGoalMinutes} min
              </span>
            </div>
            <ProgressBar value={goalPercent} tone={goalPercent >= 100 ? 'success' : 'brand'} className="mt-2" label="Today's goal" />
          </div>

          {notice && (
            <p
              role="status"
              className={cn(
                'rounded-xl px-3.5 py-2.5 text-[13px] animate-fadeIn',
                notice.ok ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger',
              )}
            >
              {notice.text}
            </p>
          )}

          <div className="rounded-2xl border border-line bg-canvas p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-text">
                  <Snowflake className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-[14px] font-medium text-ink">Streak freeze</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-ink-muted">Covers one missed day, so your streak survives it.</p>
                </div>
              </div>
              {hasFreeze ? (
                <Badge tone="success">
                  <Check className="h-3 w-3" aria-hidden="true" />
                  Ready
                </Badge>
              ) : (
                <Button variant="gold" size="sm" onClick={buyFreeze} disabled={wallet < STREAK_FREEZE_COST} className="shrink-0">
                  Buy <Tokens amount={STREAK_FREEZE_COST} />
                </Button>
              )}
            </div>
            {!hasFreeze && wallet < STREAK_FREEZE_COST && (
              <p className="mt-2.5 text-xs text-ink-subtle">You need {STREAK_FREEZE_COST - wallet} more tokens.</p>
            )}
          </div>

          <div className="rounded-2xl border border-line bg-canvas p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-hover text-ink-muted">
                  <BellRing className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-[14px] font-medium text-ink">Evening reminder</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-ink-muted">At 7 pm, only on days you haven't studied yet.</p>
                </div>
              </div>
              <Toggle checked={remindersOn} onChange={on => void setReminders(on)} label="Remind me" className="-mr-2 shrink-0" />
            </div>
            {remindersOn && (
              <button
                type="button"
                onClick={() => void sendTest()}
                className="mt-2 text-xs font-medium text-brand-text hover:underline cursor-pointer"
              >
                Send a test reminder
              </button>
            )}
          </div>
        </div>

        <DialogFooter className="justify-end">
          {todayCounts || !onLaunchStreakSaver ? (
            <Button variant="primary" onClick={onClose}>
              Done
            </Button>
          ) : (
            <>
              <Button onClick={onClose}>Later</Button>
              <Button
                variant="primary"
                icon={Play}
                onClick={() => {
                  onClose();
                  onLaunchStreakSaver();
                }}
              >
                Study for 3 minutes
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogPanel>
    </Dialog>
  );
};
