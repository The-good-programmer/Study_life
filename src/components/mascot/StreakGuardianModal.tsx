import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { 
  X, 
  Flame, 
  Sparkles, 
  Clock, 
  ArrowRight, 
  Zap, 
  Snowflake, 
  CheckCircle2, 
  AlertCircle,
  BellRing
} from 'lucide-react';
import type { UserStats } from '../../types';
import { StorageService } from '../../services/storageService';
import { soundEngine } from '../../services/soundEngine';
import { ExpressiveAxolotl } from './ExpressiveAxolotl';
import { NotificationService } from '../../services/notificationService';

interface StreakGuardianModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: UserStats;
  onLaunchStreakSaver?: () => void;
}

export const StreakGuardianModal: React.FC<StreakGuardianModalProps> = ({
  isOpen,
  onClose,
  stats,
  onLaunchStreakSaver
}) => {
  const [hasFreeze, setHasFreeze] = useState(() => StorageService.hasSynapticFreeze());
  const [notice, setNotice] = useState<string | null>(null);
  const [notifEnabled, setNotifEnabled] = useState(() => {
    return NotificationService.getSettings().enabled && NotificationService.getPermission() === 'granted';
  });

  if (!isOpen) return null;

  const isProtectedToday = stats.todayMinutes > 0;

  const handleToggleNotifications = async () => {
    if (notifEnabled) {
      NotificationService.saveSettings({ enabled: false });
      setNotifEnabled(false);
      setNotice("Streak reminders paused.");
      setTimeout(() => setNotice(null), 3000);
    } else {
      const granted = await NotificationService.requestPermission();
      if (granted) {
        setNotifEnabled(true);
        soundEngine.playSuccess();
        confetti({
          particleCount: 20,
          spread: 40,
          origin: { y: 0.7 },
          colors: ['#38bdf8', '#34d399']
        });
        setNotice("Streak protection active! Lottie will nudge you at 7:00 PM if your practice is pending.");
      } else {
        setNotice("Please enable notifications in your browser permissions to receive reminders.");
      }
      setTimeout(() => setNotice(null), 4000);
    }
  };

  const handleTestNotification = async () => {
    const sent = await NotificationService.sendTestNotification();
    if (sent) {
      setNotice("Test reminder sent! Check your notification center.");
    } else {
      setNotice("Could not send notification. Please check browser permission.");
    }
    setTimeout(() => setNotice(null), 3500);
  };

  const handleBuyFreeze = () => {
    if (stats.xp < 100) {
      setNotice("You need at least 100 XP to equip a Synaptic Freeze!");
      setTimeout(() => setNotice(null), 3000);
      return;
    }

    try {
      StorageService.addXP(-100);
      StorageService.setSynapticFreeze(true);
      setHasFreeze(true);
      soundEngine.playSuccess();
      confetti({
        particleCount: 30,
        spread: 50,
        origin: { y: 0.7 },
        colors: ['#38bdf8', '#a855f7']
      });
      setNotice("Synaptic Freeze equipped! Your streak is shielded for 1 missed day.");
      setTimeout(() => setNotice(null), 4000);
    } catch {
      // Storage error
    }
  };

  const handleSaveStreak = () => {
    onClose();
    if (onLaunchStreakSaver) onLaunchStreakSaver();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="max-w-md w-full rounded-3xl bg-[#0b0f19] border border-white/[0.12] shadow-2xl p-6 sm:p-7 space-y-6 relative overflow-hidden text-center">
        
        {/* Ambient Glows */}
        <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full bg-amber-500/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full bg-pink-500/15 blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] relative z-10 text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm font-extrabold text-white font-display">Lottie's Streak Guardian</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/[0.08] text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mascot + Streak Centerpiece */}
        <div className="relative py-2 z-10 space-y-3">
          <div className="relative w-24 h-24 mx-auto">
            <div className={`absolute -inset-3 rounded-full blur-xl animate-pulse ${
              isProtectedToday ? 'bg-gradient-to-tr from-amber-500/30 to-pink-500/30' : 'bg-gradient-to-tr from-rose-500/30 to-amber-500/30'
            }`} />
            <div className="relative w-full h-full rounded-3xl overflow-hidden bg-slate-950 p-1 border border-amber-500/30 shadow-2xl flex items-center justify-center">
              <ExpressiveAxolotl 
                mood={isProtectedToday ? 'celebrating' : 'thinking'} 
                size="md" 
              />
            </div>
            <div className="absolute -bottom-2 -right-1 p-1.5 rounded-full bg-slate-950 border border-amber-500/40 text-amber-400 shadow-lg">
              <Flame className="w-4 h-4 fill-amber-400 text-amber-400 animate-bounce" />
            </div>
          </div>

          <div>
            <div className="text-4xl sm:text-5xl font-black text-white font-mono tracking-tight flex items-center justify-center gap-1.5">
              <span>{stats.currentStreak}</span>
              <span className="text-xl sm:text-2xl font-display text-amber-400">Day Streak</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {isProtectedToday
                ? "Synaptic connectivity reinforced for today!"
                : "Streak at risk! No study activity logged yet today."}
            </p>
          </div>
        </div>

        {/* Notice alert */}
        {notice && (
          <div className="p-3 rounded-2xl bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 text-xs font-semibold animate-fadeIn">
            {notice}
          </div>
        )}

        {/* Lottie Dialogue */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/[0.08] text-left space-y-2 z-10 relative">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-pink-300">
            <Sparkles className="w-3.5 h-3.5 text-pink-400" />
            <span>Lottie says:</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium">
            {isProtectedToday
              ? `"Awesome work! Long-term potentiation requires daily rhythm. Your brain cells are thanking you right now!"`
              : `"Duo kidnaps families for a broken streak. I just don't want your prefrontal cortex to prune those memory nodes! Complete a quick 3-minute session to lock today in."`}
          </p>
        </div>

        {/* Synaptic Freeze & Stats Details */}
        <div className="grid grid-cols-2 gap-3 z-10 relative">
          <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.08] text-left space-y-1">
            <div className="text-[11px] text-slate-400 font-mono">Today's Focus</div>
            <div className="text-sm font-bold text-white flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span>{stats.todayMinutes}m / {stats.dailyGoalMinutes}m</span>
            </div>
            <div className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
              {isProtectedToday ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3 text-amber-400" />}
              <span>{isProtectedToday ? 'Goal Achieved' : 'Pending Review'}</span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.08] text-left space-y-1">
            <div className="text-[11px] text-slate-400 font-mono">Synaptic Freeze</div>
            <div className="text-sm font-bold text-white flex items-center gap-1.5">
              <Snowflake className="w-3.5 h-3.5 text-cyan-400" />
              <span>{hasFreeze ? 'Equipped' : 'Not Active'}</span>
            </div>
            {!hasFreeze ? (
              <button
                onClick={handleBuyFreeze}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 font-bold underline cursor-pointer"
              >
                Equip (100 XP)
              </button>
            ) : (
              <span className="text-[11px] text-cyan-300">Shields 1 Missed Day</span>
            )}
          </div>
        </div>

        {/* Habit Loop / Daily Web Push Notifications Card */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-indigo-950/60 via-purple-950/40 to-slate-900/60 border border-indigo-500/30 text-left space-y-2 z-10 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
                <BellRing className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">Streak Push Reminders</span>
                <span className="text-[11px] text-slate-400">Lottie nudges you at 7:00 PM</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleToggleNotifications}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                notifEnabled 
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30' 
                  : 'bg-white/[0.1] text-slate-300 hover:bg-white/[0.2]'
              }`}
            >
              {notifEnabled ? 'Active ✓' : 'Turn On'}
            </button>
          </div>

          {notifEnabled && (
            <div className="flex items-center justify-between pt-1 border-t border-white/[0.06] text-[11px]">
              <span className="text-emerald-400 font-medium">Daily alarm set for 19:00</span>
              <button
                type="button"
                onClick={handleTestNotification}
                className="text-indigo-300 hover:text-white underline cursor-pointer"
              >
                Test Alert
              </button>
            </div>
          )}
        </div>

        {/* CTA Actions */}
        <div className="space-y-2 pt-2 z-10 relative">
          {!isProtectedToday ? (
            <button
              onClick={handleSaveStreak}
              className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] cursor-pointer"
            >
              <Zap className="w-4 h-4 fill-slate-950" />
              <span>Save Streak with Quick 3-Min Session</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={onClose}
              className="w-full py-2.5 px-4 rounded-2xl bg-white/[0.08] hover:bg-white/[0.12] text-white font-bold text-xs transition-all cursor-pointer"
            >
              Close Guardian
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
