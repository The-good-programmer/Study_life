import React, { useState, useMemo, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { 
  X, 
  Trophy, 
  TrendingUp, 
  TrendingDown, 
  Flame, 
  Clock, 
  Zap,
  Users,
  UserPlus,
  Sparkles,
  Gift,
  CheckCircle2
} from 'lucide-react';
import { 
  leagueService, 
  type LeagueStatus, 
  type FriendQuest, 
  type StudyBuddy 
} from '../../services/leagueService';
import { soundEngine } from '../../services/soundEngine';
import { haptics } from '../../services/hapticsService';

interface WeeklyStudyLeagueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartStudy?: () => void;
  initialTab?: 'league' | 'friends';
}

export const WeeklyStudyLeagueModal: React.FC<WeeklyStudyLeagueModalProps> = ({
  isOpen,
  onClose,
  onStartStudy,
  initialTab = 'league',
}) => {
  const [activeTab, setActiveTab] = useState<'league' | 'friends'>(initialTab);
  const [friendQuest, setFriendQuest] = useState<FriendQuest>(() => leagueService.getFriendQuest());
  const [buddies, setBuddies] = useState<StudyBuddy[]>(() => leagueService.getStudyBuddies());
  const [newBuddyName, setNewBuddyName] = useState('');
  const [isAddingBuddy, setIsAddingBuddy] = useState(false);
  const [claimNotice, setClaimNotice] = useState<string | null>(null);

  const status: LeagueStatus | null = useMemo(() => {
    if (!isOpen) return null;
    return leagueService.getLeagueStatus();
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      soundEngine.playAxolotlBubble();
      haptics.light();
      setFriendQuest(leagueService.getFriendQuest());
      setBuddies(leagueService.getStudyBuddies());
    }
  }, [isOpen, initialTab]);

  if (!isOpen || !status) return null;

  const handleClaimQuest = () => {
    const res = leagueService.claimFriendQuestReward();
    if (res) {
      soundEngine.playCoinCascade();
      haptics.celebrate();
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#f59e0b', '#ec4899', '#3b82f6']
      });
      setFriendQuest(leagueService.getFriendQuest());
      setClaimNotice(`Claimed +${res.coins} Coins and +${res.xp} XP! 🪙`);
      setTimeout(() => setClaimNotice(null), 3500);
    }
  };

  const handleAddBuddy = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBuddyName.trim()) return;
    const added = leagueService.addStudyBuddy(newBuddyName);
    setBuddies(prev => [...prev, added]);
    setNewBuddyName('');
    setIsAddingBuddy(false);
    soundEngine.playSuccess();
    haptics.pop();
  };

  const totalQuestProgress = friendQuest.userProgress + friendQuest.partnerProgress;
  const questPercent = Math.min(100, Math.round((totalQuestProgress / friendQuest.targetCount) * 100));

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-fadeIn">
      <div 
        className="relative w-full max-w-lg bg-slate-900 border border-indigo-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{
          boxShadow: '0 25px 60px -15px rgba(99, 102, 241, 0.3)'
        }}
      >
        {/* Header with League Tier Glow */}
        <div className="relative p-6 border-b border-white/[0.08] bg-gradient-to-b from-indigo-950/80 via-slate-900 to-slate-900 overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-indigo-500/20 to-transparent rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500/30 to-indigo-500/30 border border-white/[0.1] flex items-center justify-center text-2xl shadow-lg">
                {status.tierIcon}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-white font-display">{status.tierName}</h2>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Cohort Live
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5 font-medium">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{status.daysLeft}d {status.hoursLeft}h left</span>
                  </span>
                  <span>•</span>
                  <span className="text-indigo-300 font-semibold font-mono">Rank #{status.userRank}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                haptics.light();
                onClose();
              }}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tab Selector: Weekly League vs Friends & Quests */}
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-slate-950/80 border border-white/[0.06] mt-4 relative z-10">
            <button
              type="button"
              onClick={() => {
                setActiveTab('league');
                soundEngine.playTapPop();
                haptics.pop();
              }}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'league'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>Weekly League</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('friends');
                soundEngine.playTapPop();
                haptics.pop();
              }}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'friends'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Study Buddies & Quest</span>
            </button>
          </div>

          {/* League Promotion Status Banner (in league tab) */}
          {activeTab === 'league' && (
            <div className="mt-3 p-3 rounded-2xl bg-slate-950/70 border border-white/[0.06] flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                {status.isPromotionZone ? (
                  <>
                    <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <span className="text-emerald-300 font-semibold">Promotion Zone! Top 3 advance next week.</span>
                  </>
                ) : status.isDemotionZone ? (
                  <>
                    <div className="w-6 h-6 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center">
                      <TrendingDown className="w-4 h-4" />
                    </div>
                    <span className="text-rose-300 font-semibold">Demotion Warning! Earn XP to climb safe.</span>
                  </>
                ) : (
                  <>
                    <div className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                      <Trophy className="w-4 h-4" />
                    </div>
                    <span className="text-slate-300 font-semibold">
                      Safe Zone. {status.competitors[2]?.weeklyXP ? `${Math.max(1, status.competitors[2].weeklyXP - status.userWeeklyXP)} XP to Top 3!` : 'Keep reviewing!'}
                    </span>
                  </>
                )}
              </div>
              <span className="font-mono text-indigo-300 font-bold">{status.userWeeklyXP} XP</span>
            </div>
          )}
        </div>

        {/* Tab 1: League Leaderboard Table */}
        {activeTab === 'league' && (
          <div className="p-4 sm:p-5 overflow-y-auto space-y-2 flex-1">
            {status.competitors.map((c, index) => {
              const rank = index + 1;
              const isTop3 = rank <= 3;
              const isBottom2 = rank >= status.competitors.length - 1;

              return (
                <div
                  key={c.id}
                  className={`p-3 rounded-2xl flex items-center justify-between gap-3 transition-all ${
                    c.isUser
                      ? 'bg-gradient-to-r from-indigo-950/90 via-purple-950/60 to-slate-900 border-2 border-indigo-500/60 shadow-lg shadow-indigo-500/15 scale-[1.01]'
                      : isTop3
                      ? 'bg-emerald-950/20 border border-emerald-500/20'
                      : isBottom2
                      ? 'bg-rose-950/15 border border-rose-500/20 opacity-80'
                      : 'bg-slate-800/40 border border-white/[0.05]'
                  }`}
                >
                  {/* Left: Rank & Competitor Profile */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-7 text-center font-mono font-black text-sm shrink-0 ${
                      rank === 1 ? 'text-amber-400' : rank === 2 ? 'text-slate-300' : rank === 3 ? 'text-amber-600' : 'text-slate-500'
                    }`}>
                      {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}
                    </div>

                    <div className="w-8 h-8 rounded-xl bg-white/[0.06] flex items-center justify-center text-base shrink-0">
                      {c.avatar}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs sm:text-sm font-bold truncate ${c.isUser ? 'text-indigo-200' : 'text-white'}`}>
                          {c.name}
                        </span>
                        {c.isUser && (
                          <span className="px-1.5 py-0.2 rounded-full bg-indigo-500/30 text-indigo-300 text-[10px] font-mono font-bold">
                            YOU
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate flex items-center gap-2">
                        <span>{c.subject}</span>
                        <span>•</span>
                        <span className="flex items-center gap-0.5 text-amber-400 font-mono">
                          <Flame className="w-3 h-3 fill-amber-400" />
                          <span>{c.streak}d</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: XP Score */}
                  <div className="text-right shrink-0">
                    <span className={`text-xs sm:text-sm font-black font-mono ${c.isUser ? 'text-indigo-300' : 'text-slate-300'}`}>
                      {c.weeklyXP.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono ml-1">XP</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 2: Study Buddies & Friend Quest */}
        {activeTab === 'friends' && (
          <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
            
            {/* Friend Quest Card */}
            <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-amber-500/10 via-purple-500/10 to-transparent border border-amber-500/30 relative overflow-hidden space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-xl bg-amber-500/20 text-amber-400">
                    <Gift className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-amber-300 font-display">Weekly Friend Quest</h3>
                    <p className="text-[11px] text-slate-300 font-medium">Paired with {friendQuest.partnerName}</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {friendQuest.expiresInDays}d left
                </span>
              </div>

              <p className="text-xs text-slate-200 leading-relaxed font-semibold">
                "{friendQuest.goalDescription}"
              </p>

              {/* Dual Co-op Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-300">
                    You: <strong className="text-indigo-300">{friendQuest.userProgress}</strong> | {friendQuest.partnerName.split(' ')[0]}: <strong className="text-purple-300">{friendQuest.partnerProgress}</strong>
                  </span>
                  <span className="font-mono text-amber-300">{totalQuestProgress}/{friendQuest.targetCount} ({questPercent}%)</span>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-950 border border-white/[0.08] overflow-hidden p-0.5">
                  <div 
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-amber-400 transition-all duration-500"
                    style={{ width: `${questPercent}%` }}
                  />
                </div>
              </div>

              {/* Claim or Status Button */}
              {friendQuest.completed && !friendQuest.rewardClaimed ? (
                <button
                  type="button"
                  onClick={handleClaimQuest}
                  className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.02]"
                >
                  <Sparkles className="w-4 h-4 fill-slate-950" />
                  <span>Claim Quest Reward (+60 Coins & 100 XP)</span>
                </button>
              ) : friendQuest.completed && friendQuest.rewardClaimed ? (
                <div className="p-2 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs font-bold text-center flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Quest Completed & Reward Claimed! 🎉</span>
                </div>
              ) : (
                <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
                  <span>Reward: 🪙 60 Coins + 100 XP</span>
                  <span className="text-amber-400 font-mono font-bold">In Progress</span>
                </div>
              )}

              {claimNotice && (
                <div className="p-2 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs font-semibold text-center animate-fadeIn">
                  {claimNotice}
                </div>
              )}
            </div>

            {/* Study Buddies List */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5 font-display">
                  <Users className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Your Study Buddies ({buddies.length})</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsAddingBuddy(prev => !prev)}
                  className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add Buddy</span>
                </button>
              </div>

              {isAddingBuddy && (
                <form onSubmit={handleAddBuddy} className="p-3 rounded-2xl bg-slate-950 border border-white/[0.1] space-y-2 animate-fadeIn">
                  <input
                    type="text"
                    value={newBuddyName}
                    onChange={(e) => setNewBuddyName(e.target.value)}
                    placeholder="Enter friend's name or handle..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/[0.1] text-white text-xs outline-none focus:border-indigo-500"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingBuddy(false)}
                      className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow"
                    >
                      Add
                    </button>
                  </div>
                </form>
              )}

              {buddies.map(buddy => (
                <div 
                  key={buddy.id}
                  className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative w-8 h-8 rounded-xl bg-white/[0.06] flex items-center justify-center text-base shrink-0">
                      {buddy.avatar}
                      {buddy.isOnline && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-900" title="Studying now" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">{buddy.name}</div>
                      <div className="text-[10px] text-slate-400 truncate">{buddy.subject}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="flex items-center gap-0.5 text-xs text-amber-400 font-mono font-bold">
                      <Flame className="w-3.5 h-3.5 fill-amber-400" />
                      <span>{buddy.streak}d</span>
                    </span>
                    <span className="text-xs font-mono text-indigo-300 font-bold">
                      {buddy.weeklyXP} XP
                    </span>
                  </div>
                </div>
              ))}
            </div>

          </div>
        )}

        {/* Footer with Call to Action */}
        <div className="p-4 sm:p-5 border-t border-white/[0.08] bg-slate-950/70 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-400 hidden sm:block">
            Top 3 win <span className="text-amber-300 font-bold">100 Study Coins</span> on Sunday!
          </div>

          <button
            type="button"
            onClick={() => {
              haptics.success();
              soundEngine.playStart();
              onClose();
              if (onStartStudy) onStartStudy();
            }}
            className="w-full sm:w-auto btn-tactile btn-tactile-primary px-6 py-2.5 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/30"
          >
            <Zap className="w-3.5 h-3.5 fill-white" />
            <span>Study to Earn XP & Climb</span>
          </button>
        </div>
      </div>
    </div>
  );
};
