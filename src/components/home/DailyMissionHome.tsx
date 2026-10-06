import React, { useState, useMemo, useEffect } from 'react';
import { 
  Flame, 
  Zap, 
  Brain, 
  Play, 
  Sparkles, 
  ArrowRight, 
  Plus, 
  Layers, 
  Trophy, 
  BookOpen, 
  Headphones, 
  ChevronRight,
  Target,
  Award,
  Folder,
  FolderPlus,
  FolderInput,
  Edit3,
  Sliders
} from 'lucide-react';
import type { StudySession, UserStats, SubjectFolder } from '../../types';
import { StorageService } from '../../services/storageService';
import { characterService } from '../../services/characterService';
import { soundEngine } from '../../services/soundEngine';
import { CURATED_STARTER_DECKS } from '../../data/curatedStarterCatalog';
import confetti from 'canvas-confetti';
import { ScienceExplainerModal } from '../common/ScienceExplainerModal';
import { StreakGuardianModal } from '../mascot/StreakGuardianModal';
import { haptics } from '../../services/hapticsService';
import { UserAvatarBadge } from '../character/UserAvatarBadge';
import { CharacterCustomizerModal } from '../character/CharacterCustomizerModal';
import { SubjectFolderModal, FOLDER_COLORS } from '../studio/SubjectFolderModal';
import { MoveToFolderModal } from '../studio/MoveToFolderModal';
import { lifeSimService } from '../../services/lifeSimService';

interface DailyMissionHomeProps {
  onStartSession: (session: StudySession) => void;
  onOpenDeckStation: (session: StudySession) => void;
  onStartMatch: (session: StudySession) => void;
  onStartAudioBriefing?: (session: StudySession) => void;
  onOpenDeckStudio: () => void;
  onOpenStarterCatalog: () => void;
  onOpenDashboard: () => void;
  onOpenSanctuary: () => void;
  onOpenExam?: () => void;
  onOpenFolders?: () => void;
}

export const DailyMissionHome: React.FC<DailyMissionHomeProps> = ({
  onStartSession,
  onOpenDeckStation,
  onStartMatch,
  onStartAudioBriefing,
  onOpenDeckStudio,
  onOpenStarterCatalog,
  onOpenDashboard,
  onOpenSanctuary,
  onOpenExam,
  onOpenFolders,
}) => {
  const [stats, setStats] = useState<UserStats>(() => StorageService.getStats());
  const [character, setCharacter] = useState(() => characterService.getCharacter());
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [showScienceModal, setShowScienceModal] = useState(false);
  const [isStreakModalOpen, setIsStreakModalOpen] = useState(false);

  useEffect(() => {
    return characterService.subscribe((c) => setCharacter(c));
  }, []);
  const [hasSynapticFreeze, setHasSynapticFreeze] = useState(() => StorageService.hasSynapticFreeze());
  const [reviewedToday, setReviewedToday] = useState(() => StorageService.getReviewedTodayCount());
  const [savedSessions, setSavedSessions] = useState<StudySession[]>(() => StorageService.getSessions());
  const [folders, setFolders] = useState<SubjectFolder[]>(() => StorageService.getFolders());
  const [selectedFolderId, setSelectedFolderId] = useState<string>('all');
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<SubjectFolder | null>(null);
  const [movingSession, setMovingSession] = useState<StudySession | null>(null);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [dailyLedger, setDailyLedger] = useState(() => lifeSimService.getDailyLedger());

  useEffect(() => {
    const unsub = StorageService.addMutationListener(() => {
      setStats(StorageService.getStats());
      setReviewedToday(StorageService.getReviewedTodayCount());
      setHasSynapticFreeze(StorageService.hasSynapticFreeze());
      setSavedSessions(StorageService.getSessions());
      setFolders(StorageService.getFolders());
    });
    const unsubLife = lifeSimService.subscribe(() => {
      setDailyLedger(lifeSimService.getDailyLedger());
    });
    return () => {
      unsub();
      unsubLife();
    };
  }, []);

  const weeklyStats = useMemo(() => {
    if (stats.xp < 0) return { current: 0, best: 0 };
    return StorageService.getWeeklyXP();
  }, [stats.xp]);
  const dueCards = useMemo(() => StorageService.getDueCards(), []);

  const displayedSessions = useMemo(() => {
    if (selectedFolderId === 'all') return savedSessions;
    if (selectedFolderId === 'uncategorized') return savedSessions.filter(s => !s.folderId);
    return savedSessions.filter(s => s.folderId === selectedFolderId);
  }, [savedSessions, selectedFolderId]);

  // Primary active deck or fallback starter deck
  const primarySession = useMemo(() => {
    if (savedSessions.length === 0) return CURATED_STARTER_DECKS[0]?.session || null;
    // Prioritize deck containing due cards
    if (dueCards.length > 0) {
      const match = savedSessions.find(s => 
        s.concepts.some(cp => (cp.retrievalCards || []).some(rc => dueCards.some(dc => dc.id === rc.id)))
      );
      if (match) return match;
    }
    return savedSessions[0];
  }, [savedSessions, dueCards]);

  // Daily target goal calculation (e.g. 15 cards/day)
  const dailyGoal = 15;
  const progressPercent = Math.min(100, Math.round((reviewedToday / dailyGoal) * 100));

  // Quick launch for Quick Sprint (Flashcard drill directly)
  const handleLaunchQuickSprint = () => {
    if (!primarySession) {
      onOpenStarterCatalog();
      return;
    }
    soundEngine.playCorrectChime();
    onStartSession({
      ...primarySession,
      currentPhase: 'retrieval',
      casualFlashcardMode: true,
    });
  };

  // Launch Deep Master Pilot (Full 5-Phase pipeline)
  const handleLaunchDeepPilot = () => {
    if (!primarySession) {
      onOpenStarterCatalog();
      return;
    }
    soundEngine.playContextShiftSound();
    onStartSession({
      ...primarySession,
      currentPhase: 'priming',
      casualFlashcardMode: false,
    });
  };

  const handleMascotNudge = () => {
    try {
      soundEngine.playSuccess();
      confetti({
        particleCount: 25,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#6366f1', '#a855f7', '#38bdf8']
      });
    } catch {}
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 sm:space-y-8 animate-fadeIn pb-16">
      
      {/* --- TOP DUOLINGO-GRADE HUD BAR --- */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Streak Pill with Guardian & Freeze Shield */}
        <div 
          onClick={() => {
            soundEngine.playTapPop();
            haptics.light();
            setIsStreakModalOpen(true);
          }}
          className="p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-amber-500/40 backdrop-blur-xl flex items-center gap-3 shadow-sm cursor-pointer transition-all group"
          title="Click to view Streak Guardian & Synaptic Freeze shield"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Flame className="w-6 h-6 text-amber-400 fill-amber-400 animate-pulse" />
          </div>
          <div>
            <div className="text-base sm:text-lg font-black text-white font-display leading-tight flex items-center gap-1.5">
              <span>{stats.currentStreak}</span>
              <span className="text-xs text-amber-300 font-bold uppercase tracking-wider">Days</span>
              {hasSynapticFreeze && (
                <span className="px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 text-[11px] font-mono border border-cyan-500/30" title="Protected by Synaptic Freeze">
                  ❄️
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 font-medium">
              {hasSynapticFreeze ? 'Shield Active ❄️' : 'Daily Streak'}
            </p>
          </div>
        </div>

        {/* Due Cards Pill */}
        <div 
          onClick={handleLaunchQuickSprint}
          className="p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.08] hover:border-indigo-500/40 backdrop-blur-xl flex items-center gap-3 shadow-sm cursor-pointer transition-all"
        >
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <div className="text-base sm:text-lg font-black text-white font-display leading-tight flex items-center gap-1">
              <span>{dueCards.length}</span>
              <span className="text-xs text-indigo-300 font-bold uppercase tracking-wider">Due</span>
            </div>
            <p className="text-xs text-slate-400 font-medium">Spaced Recall</p>
          </div>
        </div>

        {/* Study Tokens Wallet */}
        <div 
          onClick={onOpenSanctuary}
          className="p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.08] backdrop-blur-xl flex items-center gap-3 shadow-sm cursor-pointer transition-all"
          title="Tokens earned through active recall • Click to visit Sanctuary & Cafeteria"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-xl shrink-0">
            🪙
          </div>
          <div>
            <div className="text-base sm:text-lg font-black text-amber-300 font-display leading-tight font-mono">
              {character.coins ?? 45}
            </div>
            <p className="text-xs text-slate-400 font-medium">Study Tokens</p>
          </div>
        </div>

        {/* Daily Student Ledger / Habitat Shortcut */}
        <div 
          onClick={onOpenSanctuary}
          className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/10 to-indigo-500/10 hover:from-amber-500/20 hover:to-indigo-500/20 border border-amber-500/30 backdrop-blur-xl flex items-center gap-3 shadow-sm cursor-pointer transition-all group"
          title="Daily Living Ledger & Sanctuary"
        >
          <div className="relative w-10 h-10 rounded-xl overflow-hidden p-0.5 bg-gradient-to-tr from-amber-500 to-pink-500 shrink-0 group-hover:scale-105 transition-transform flex items-center justify-center">
            <UserAvatarBadge size="xs" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-black text-amber-200 font-display truncate flex items-center gap-1">
              <span>Daily Net</span>
              <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-mono font-bold ${dailyLedger.netBalance >= 0 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'}`}>
                {dailyLedger.netBalance >= 0 ? `+${dailyLedger.netBalance}` : dailyLedger.netBalance} 🪙
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium truncate flex items-center gap-0.5">
              <span>Campus Life</span>
              <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </p>
          </div>
        </div>
      </div>

      {/* --- HERO PRIMARY ACTION BANNER (Sub-3-Second Time-to-Value) --- */}
      <div className="relative rounded-3xl overflow-hidden border border-indigo-500/30 bg-gradient-to-br from-[#12162d] via-[#0d1020] to-[#090a12] p-6 sm:p-8 shadow-2xl">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          
          {/* Left Column: Mission status & context */}
          <div className="space-y-3 max-w-xl">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                <span>Today's High-Yield Mission</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playTapPop();
                  setShowScienceModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.12] text-indigo-200 hover:text-white text-xs font-semibold transition-all cursor-pointer shadow-sm hover:scale-105"
                title="Discover the empirical cognitive neuroscience behind Studify"
              >
                <Brain className="w-3.5 h-3.5 text-indigo-400" />
                <span>Why this works (The Science)</span>
              </button>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white font-display tracking-tight leading-tight">
              {dueCards.length > 0 
                ? `You have ${dueCards.length} cards ready for today's review`
                : 'All caught up for today! 🎉'}
            </h1>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-normal">
              {dueCards.length > 0 
                ? `Just 3 minutes on "${primarySession?.title || 'Active Deck'}" to lock these concepts into long-term memory.`
                : 'Great job! Keep your momentum alive with Speed Match or explore a new topic.'}
            </p>

            {/* Daily Goal Bar */}
            <div className="pt-2 space-y-1.5 max-w-sm">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <Target className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Daily Goal</span>
                </span>
                <span className="font-mono text-indigo-300">{reviewedToday}/{dailyGoal} cards ({progressPercent}%)</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-900 border border-white/[0.08] overflow-hidden p-0.5">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-indigo-500 to-pink-500 transition-all duration-500 animate-shimmer"
                  style={{ width: `${Math.max(5, progressPercent)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Right Column: Tactile Dual-Speed Action Buttons */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0 sm:w-auto lg:w-72">
            {/* Primary Action Button (Tactile 3D Bevel) */}
            <button
              type="button"
              onClick={handleLaunchQuickSprint}
              className="btn-tactile btn-tactile-primary w-full py-4 px-6 rounded-2xl font-black text-sm sm:text-base flex items-center justify-center gap-3 cursor-pointer group shadow-lg shadow-indigo-500/25"
            >
              <Zap className="w-5 h-5 fill-white group-hover:scale-110 transition-transform" />
              <span>Start 3-Min Daily Practice ({dueCards.length > 0 ? dueCards.length : 10} Cards)</span>
            </button>

            {/* Secondary Deep Master Action Button */}
            <button
              type="button"
              onClick={handleLaunchDeepPilot}
              className="btn-tactile btn-tactile-slate w-full py-3 px-5 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Brain className="w-4 h-4 text-purple-400" />
              <span>Deep Socratic Pilot (Full Guided)</span>
            </button>

            {/* Practice Modes Quick Links */}
            <div className="flex items-center gap-2">
              {primarySession && (
                <button
                  type="button"
                  onClick={() => onStartMatch(primarySession)}
                  className="flex-1 py-2 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-amber-300 hover:text-amber-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Speed Match</span>
                </button>
              )}

              {onOpenExam && (
                <button
                  type="button"
                  onClick={onOpenExam}
                  className="flex-1 py-2 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-purple-300 hover:text-purple-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>Mock Exam</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Ambient background glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* --- TWO-COLUMN BODY: LEARNING PATH & DAILY QUESTS --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        
        {/* Left 2 Cols: Learning Path & Deck Syllabus Queue */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-bold text-white font-display">Your Study Decks</h2>
            </div>
            <button
              type="button"
              onClick={onOpenDeckStudio}
              className="py-1.5 px-3 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create or Import</span>
            </button>
          </div>

          {/* Subject Folders Header & Filter Chips */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Folder className="w-4 h-4 text-indigo-400" />
                <h3 className="text-xs font-bold text-white font-display uppercase tracking-wider">
                  Subject Folders
                </h3>
                <span className="text-[11px] font-mono text-slate-400">
                  ({folders.length})
                </span>
              </div>

              <div className="flex items-center gap-2">
                {onOpenFolders && (
                  <button
                    type="button"
                    onClick={onOpenFolders}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 font-bold transition-colors cursor-pointer flex items-center gap-0.5 hover:underline"
                    title="Open dedicated Subject Folders page"
                  >
                    <span>View All</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setEditingFolder(null);
                    setIsFolderModalOpen(true);
                  }}
                  className="px-2.5 py-1 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer hover:scale-105"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>+ New Subject</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
              <button
                type="button"
                onClick={() => setSelectedFolderId('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedFolderId === 'all'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white/[0.04] text-slate-400 hover:text-white border border-white/[0.06]'
                }`}
              >
                <span>📚</span>
                <span>All Decks</span>
                <span className="text-[10px] font-mono opacity-80">({savedSessions.length})</span>
              </button>

              {folders.map(f => {
                const isSel = selectedFolderId === f.id;
                const count = savedSessions.filter(s => s.folderId === f.id).length;
                const colDef = FOLDER_COLORS.find(c => c.id === f.color) || FOLDER_COLORS[0];
                return (
                  <div key={f.id} className="relative group/folder flex items-center shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedFolderId(isSel ? 'all' : f.id)}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 border ${
                        isSel
                          ? `${colDef.bg} ${colDef.text} ${colDef.border} shadow-sm ring-1 ring-white/20`
                          : 'bg-white/[0.03] text-slate-400 hover:text-slate-200 border-white/[0.06]'
                      }`}
                    >
                      <span>{f.icon || '📁'}</span>
                      <span>{f.name}</span>
                      <span className="text-[10px] opacity-75 font-mono">({count})</span>
                    </button>
                    {/* Quick Edit */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingFolder(f);
                        setIsFolderModalOpen(true);
                      }}
                      className="hidden group-hover/folder:flex p-1 ml-1 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-white/[0.08]"
                      title="Edit Subject"
                    >
                      <Edit3 className="w-2.5 h-2.5" />
                    </button>
                  </div>
                );
              })}

              {folders.length === 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingFolder(null);
                    setIsFolderModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium text-indigo-300 hover:text-indigo-200 bg-indigo-500/10 hover:bg-indigo-500/20 border border-dashed border-indigo-500/30 flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>Create your first subject folder (e.g. Biology, Math, History)</span>
                </button>
              )}
            </div>
          </div>

          {savedSessions.length === 0 ? (
            <div className="p-8 rounded-3xl bg-white/[0.02] border border-dashed border-white/[0.1] text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">No active study decks yet</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                  Choose from our verified scientific starter catalog or generate a deck from your lecture notes or PDF.
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={onOpenStarterCatalog}
                  className="btn-tactile btn-tactile-primary py-2.5 px-5 rounded-xl font-bold text-xs"
                >
                  Explore Public Decks
                </button>
                <button
                  type="button"
                  onClick={onOpenDeckStudio}
                  className="py-2.5 px-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white font-semibold text-xs transition-colors"
                >
                  Upload PDF
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {displayedSessions.slice(0, 6).map((session) => {
                const totalCards = session.concepts.reduce((acc, c) => acc + (c.retrievalCards?.length || 0), 0);
                const deckDueCount = session.concepts.flatMap(c => c.retrievalCards || []).filter(rc => dueCards.some(dc => dc.id === rc.id)).length;
                const isPrimary = session.id === primarySession?.id;
                const assignedFolder = folders.find(f => f.id === session.folderId);
                const folderColorDef = assignedFolder ? (FOLDER_COLORS.find(c => c.id === assignedFolder.color) || FOLDER_COLORS[0]) : null;

                return (
                  <div
                    key={session.id}
                    className={`p-4 sm:p-5 rounded-2xl border transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      isPrimary 
                        ? 'bg-indigo-950/30 border-indigo-500/40 shadow-lg shadow-indigo-950/30' 
                        : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.08]'
                    }`}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
                        <h3 className="text-sm sm:text-base font-bold text-white font-display truncate">
                          {session.title}
                        </h3>
                        {assignedFolder && folderColorDef ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMovingSession(session);
                              setIsMoveModalOpen(true);
                            }}
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${folderColorDef.bg} ${folderColorDef.text} border ${folderColorDef.border} flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity`}
                            title="Click to move or reassign subject folder"
                          >
                            <span>{assignedFolder.icon || '📁'}</span>
                            <span>{assignedFolder.name}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMovingSession(session);
                              setIsMoveModalOpen(true);
                            }}
                            className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-slate-200 border border-white/[0.08] flex items-center gap-1 cursor-pointer transition-colors"
                            title="Assign this deck to a subject folder"
                          >
                            <FolderInput className="w-3 h-3 text-slate-500" />
                            <span>+ Subject</span>
                          </button>
                        )}
                        {deckDueCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-pink-500/20 text-pink-300 border border-pink-500/30 font-mono">
                            {deckDueCount} due
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 font-medium">
                        {session.concepts.length} Concept Units • {totalCards} Flashcards • {session.category || 'General'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onStartSession(session)}
                        className="btn-tactile btn-tactile-primary py-2 px-4 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" />
                        <span>Study</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenDeckStation(session)}
                        className="py-2 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 hover:text-white font-semibold text-xs transition-colors cursor-pointer"
                      >
                        Details
                      </button>

                      {onStartAudioBriefing && (
                        <button
                          type="button"
                          onClick={() => onStartAudioBriefing(session)}
                          className="p-2 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 hover:text-indigo-200 transition-colors cursor-pointer"
                          title="Audio Briefing"
                        >
                          <Headphones className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {savedSessions.length > 4 && (
                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={onOpenDashboard}
                    className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center justify-center gap-1 mx-auto"
                  >
                    <span>View all {savedSessions.length} decks in library</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Col: Duolingo Daily Quests & 3D Character Companion */}
        <div className="space-y-6">
          
          {/* 3D Student Character Motivation Card */}
          <div className="p-5 rounded-3xl bg-gradient-to-b from-indigo-500/10 via-purple-500/10 to-transparent border border-indigo-500/30 relative overflow-hidden">
            <div className="flex items-start gap-3.5">
              <div 
                onClick={handleMascotNudge}
                className="relative w-14 h-14 rounded-2xl overflow-hidden p-0.5 bg-gradient-to-tr from-indigo-500 via-purple-500 to-cyan-400 shrink-0 cursor-pointer hover:scale-105 transition-transform shadow-md shadow-indigo-500/20 flex items-center justify-center"
                title="Tap Character!"
              >
                <UserAvatarBadge size="md" />
              </div>
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-indigo-300 font-display">{character.name} says:</span>
                  <span className="text-[11px] text-cyan-300 font-mono">Lv.{character.level} {character.studyTitle}</span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed font-medium">
                  "Hey friend! Ready for a quick 3-minute win? Let's knock out your {dueCards.length > 0 ? `${dueCards.length} review cards` : 'practice goal'} and keep that streak blazing!"
                </p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/[0.08] flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => setIsCustomizerOpen(true)}
                className="text-indigo-300 hover:text-indigo-200 font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Customize 3D Model</span>
              </button>
              <button
                type="button"
                onClick={onOpenSanctuary}
                className="text-slate-300 hover:text-white font-bold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>3D Campus Life</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Daily Quests Box */}
          <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/[0.08] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white font-display">Daily Quests</h3>
              </div>
              <span className="text-[11px] font-mono text-slate-400">Resets in 9h</span>
            </div>

            <div className="space-y-3">
              {/* Quest 1 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">Review 10 flashcards</span>
                  <span className="font-mono text-amber-300 font-bold">+15 🪙</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-900 border border-white/[0.06] overflow-hidden">
                  <div 
                    className="h-full bg-amber-400 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (reviewedToday / 10) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Quest 2 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">Achieve a 5-card combo</span>
                  <span className="font-mono text-pink-300 font-bold">+25 🪙</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-900 border border-white/[0.06] overflow-hidden">
                  <div 
                    className="h-full bg-pink-500 rounded-full transition-all"
                    style={{ width: stats.sessionsCompleted >= 1 || stats.todayMinutes >= 5 ? '100%' : '35%' }}
                  />
                </div>
              </div>

              {/* Quest 3 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">Explain 1 concept in Feynman</span>
                  <span className="font-mono text-purple-300 font-bold">+50 🪙</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-900 border border-white/[0.06] overflow-hidden">
                  <div 
                    className="h-full bg-purple-500 rounded-full transition-all"
                    style={{ width: stats.conceptsMastered > 0 ? '100%' : '0%' }}
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={onOpenDashboard}
                className="w-full py-2 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>View FSRS Analytics & Leeches</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Personal Weekly Study Record Widget */}
          <div 
            onClick={() => {
              soundEngine.playTapPop();
              haptics.light();
              onOpenDashboard();
            }}
            className="p-5 rounded-3xl bg-gradient-to-br from-indigo-950/40 via-purple-950/20 to-slate-900 border border-indigo-500/30 space-y-3 cursor-pointer hover:border-indigo-500/60 transition-all group shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">📈</span>
                <div>
                  <h3 className="text-sm font-bold text-white font-display flex items-center gap-1.5">
                    <span>Weekly Study Earnings</span>
                    <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Tokens Earned
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {weeklyStats.current >= 300 ? '🔥 Great momentum this week!' : 'Build consistency with daily sprints'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 text-xs font-bold text-indigo-300 group-hover:text-white transition-colors">
                <span>Analytics</span>
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-white/[0.06] flex flex-col">
                <span className="text-slate-400 text-[11px]">This Week</span>
                <span className="text-amber-300 font-bold text-sm">+{weeklyStats.current} 🪙</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-white/[0.06] flex flex-col">
                <span className="text-slate-400 text-[11px]">Personal Best</span>
                <span className="text-purple-300 font-bold text-sm">+{weeklyStats.best} 🪙</span>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Cognitive Science Explainer Modal */}
      <ScienceExplainerModal
        isOpen={showScienceModal}
        onClose={() => setShowScienceModal(false)}
        initialTopic="fsrs"
      />

      {/* Streak Guardian & Synaptic Freeze Modal */}
      <StreakGuardianModal
        isOpen={isStreakModalOpen}
        onClose={() => {
          setIsStreakModalOpen(false);
          setHasSynapticFreeze(StorageService.hasSynapticFreeze());
          setStats(StorageService.getStats());
        }}
        stats={stats}
        onLaunchStreakSaver={handleLaunchQuickSprint}
      />

      {/* Subject Folder Modal */}
      <SubjectFolderModal
        isOpen={isFolderModalOpen}
        onClose={() => {
          setIsFolderModalOpen(false);
          setEditingFolder(null);
        }}
        initialFolder={editingFolder}
        onFolderSaved={() => {
          setFolders(StorageService.getFolders());
          setSavedSessions(StorageService.getSessions());
          setIsFolderModalOpen(false);
          setEditingFolder(null);
        }}
      />

      {/* Move Deck to Folder Modal */}
      <MoveToFolderModal
        isOpen={isMoveModalOpen}
        session={movingSession}
        onClose={() => {
          setIsMoveModalOpen(false);
          setMovingSession(null);
        }}
        onMoved={() => {
          setSavedSessions(StorageService.getSessions());
          setFolders(StorageService.getFolders());
        }}
        onOpenNewFolderModal={() => {
          setIsMoveModalOpen(false);
          setEditingFolder(null);
          setIsFolderModalOpen(true);
        }}
      />

      {/* 3D Character Customizer Studio */}
      <CharacterCustomizerModal
        isOpen={isCustomizerOpen}
        onClose={() => setIsCustomizerOpen(false)}
      />

    </div>
  );
};

export default DailyMissionHome;
