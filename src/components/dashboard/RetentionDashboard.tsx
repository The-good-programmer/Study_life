import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  ArrowLeft, 
  Clock, 
  Flame, 
  Award, 
  Layers, 
  Play, 
  Calendar, 
  RotateCw, 
  BarChart3, 
  Bug, 
  AlertTriangle,
  Shuffle,
  BrainCircuit,
  Sparkles
} from 'lucide-react';
import type { RetrievalCard, StudySession, UserStats } from '../../types';
import { StorageService } from '../../services/storageService';
import { FSRSService } from '../../services/fsrsService';
import { soundEngine } from '../../services/soundEngine';
import { MathRenderer } from '../common/MathRenderer';
import { LeechHunterLab } from './LeechHunterLab';
import { CurriculumKnowledgeMap } from './CurriculumKnowledgeMap';

import { gamepadService, type GamepadAction } from '../../services/gamepadService';

interface RetentionDashboardProps {
  stats: UserStats;
  onBack: () => void;
  onStartSession: (session: StudySession) => void;
  onOpenDeckStation?: (session: StudySession) => void;
  onOpenExam?: () => void;
  onOpenInterleaving?: () => void;
}

export const RetentionDashboard: React.FC<RetentionDashboardProps> = ({ 
  stats, 
  onBack, 
  onStartSession, 
  onOpenDeckStation,
  onOpenExam,
  onOpenInterleaving 
}) => {
  const [activeView, setActiveView] = useState<'overview' | 'curriculum' | 'leeches'>('overview');
  const [dueCards, setDueCards] = useState<RetrievalCard[]>(() => StorageService.getDueCards());
  const [allCards, setAllCards] = useState<RetrievalCard[]>(() => StorageService.getAllCards());
  const [activeReviewCardIndex, setActiveReviewCardIndex] = useState<number | null>(null);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  const [targetRetention, setTargetRetention] = useState(() => StorageService.getTargetRetention());
  const [examReports] = useState(StorageService.getExamReports());
  const [interleavingReports] = useState(StorageService.getInterleavingReports());
  const sessions = StorageService.getSessions();

  const leeches = useMemo(() => FSRSService.findLeeches(allCards), [allCards]);

  // FSRS Power-Law Retrievability & Stability Metrics
  const avgStability = useMemo(() => {
    if (allCards.length === 0) return 7;
    const sum = allCards.reduce((acc, c) => acc + (c.stability || 1), 0);
    return Math.round((sum / allCards.length) * 10) / 10;
  }, [allCards]);

  const meanRetrievability = useMemo(() => {
    if (allCards.length === 0) return 90;
    const sum = allCards.reduce((acc, c) => acc + FSRSService.calculateRetrievability(c), 0);
    return Math.round(sum / allCards.length);
  }, [allCards]);

  const decayPoints = useMemo(() => {
    return FSRSService.generateDecayCurve(avgStability, 30);
  }, [avgStability]);

  // Card mastery stage buckets
  const learningCards = allCards.filter(c => (c.stability || 0) < 1).length;
  const youngCards = allCards.filter(c => (c.stability || 0) >= 1 && (c.stability || 0) < 7).length;
  const matureCards = allCards.filter(c => (c.stability || 0) >= 7 && (c.stability || 0) < 30).length;
  const masteredCards = allCards.filter(c => (c.stability || 0) >= 30).length;

  const handleStartDueReview = () => {
    if (dueCards.length === 0) return;
    setActiveReviewCardIndex(0);
    setIsAnswerRevealed(false);
  };

  const activityHistory = useMemo(() => StorageService.getActivityHistory(), []);

  const handleRateReviewCard = useCallback((rating: 'again' | 'hard' | 'good' | 'easy') => {
    if (activeReviewCardIndex === null) return;
    const currentCard = dueCards[activeReviewCardIndex];
    const { updatedCard } = FSRSService.schedule(currentCard, rating, targetRetention);
    StorageService.saveCard(updatedCard);

    if (activeReviewCardIndex + 1 < dueCards.length) {
      setActiveReviewCardIndex(activeReviewCardIndex + 1);
      setIsAnswerRevealed(false);
    } else {
      soundEngine.playCompletionChime();
      setActiveReviewCardIndex(null);
      setDueCards(StorageService.getDueCards());
    }
  }, [activeReviewCardIndex, dueCards, targetRetention]);

  // Keyboard navigation for due card reviews
  useEffect(() => {
    if (activeReviewCardIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        setActiveReviewCardIndex(null);
      } else if (e.code === 'Space') {
        e.preventDefault();
        setIsAnswerRevealed(prev => !prev);
      } else if (isAnswerRevealed) {
        if (e.key === '1') {
          e.preventDefault();
          handleRateReviewCard('again');
        } else if (e.key === '2') {
          e.preventDefault();
          handleRateReviewCard('hard');
        } else if (e.key === '3') {
          e.preventDefault();
          handleRateReviewCard('good');
        } else if (e.key === '4') {
          e.preventDefault();
          handleRateReviewCard('easy');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeReviewCardIndex, isAnswerRevealed, handleRateReviewCard]);

  // Gamepad action controller support for due card reviews
  useEffect(() => {
    if (activeReviewCardIndex === null) return;

    const unsubAction = gamepadService.subscribeAction((action: GamepadAction) => {
      switch (action) {
        case 'flip':
          setIsAnswerRevealed(prev => !prev);
          break;
        case 'again':
          if (isAnswerRevealed) handleRateReviewCard('again');
          else setIsAnswerRevealed(true);
          break;
        case 'hard':
          if (isAnswerRevealed) handleRateReviewCard('hard');
          else setIsAnswerRevealed(true);
          break;
        case 'good':
          if (isAnswerRevealed) handleRateReviewCard('good');
          else setIsAnswerRevealed(true);
          break;
        case 'easy':
          if (isAnswerRevealed) handleRateReviewCard('easy');
          else setIsAnswerRevealed(true);
          break;
        default:
          break;
      }
    });

    return () => unsubAction();
  }, [activeReviewCardIndex, isAnswerRevealed, handleRateReviewCard]);

  const [todayTimestamp] = useState(() => Date.now());

  // 35-day Heatmap activity matrix backed by persistent activity history
  const heatmapDays = useMemo(() => {
    const daysInMatrix = 35;
    const today = new Date(todayTimestamp);
    return Array.from({ length: daysInMatrix }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (daysInMatrix - 1 - i));
      const isToday = i === daysInMatrix - 1;
      const dateKey = d.toISOString().split('T')[0];
      const minutesOnDay = isToday ? (stats.todayMinutes || 0) : (activityHistory[dateKey] || 0);
      const hasStudy = minutesOnDay > 0;
      const intensity = minutesOnDay >= 30 ? 3 : minutesOnDay >= 15 ? 2 : minutesOnDay > 0 ? 1 : 0;
      
      return {
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        intensity,
        hasStudy,
      };
    });
  }, [stats.todayMinutes, todayTimestamp, activityHistory]);

  // If reviewing due cards in active modal arena
  if (activeReviewCardIndex !== null && dueCards[activeReviewCardIndex]) {
    const card = dueCards[activeReviewCardIndex];
    const intervals = FSRSService.previewIntervals(card, targetRetention);
    const cardRetrievability = FSRSService.calculateRetrievability(card);

    return (
      <div className="max-w-2xl mx-auto space-y-6 py-8 px-4 animate-fadeIn">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setActiveReviewCardIndex(null)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Cancel Review</span>
          </button>
          <span className="text-xs text-emerald-400 font-bold px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/40 font-mono">
            Due Card {activeReviewCardIndex + 1} of {dueCards.length}
          </span>
        </div>

        <div className="min-h-[340px] rounded-3xl glass-panel p-6 sm:p-8 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-400 uppercase tracking-wider font-bold font-display">
              <div className="flex items-center gap-2">
                <span>FSRS Scheduled Recall</span>
                <span className="text-[11px] text-cyan-300 font-mono bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded-full">
                  R: {cardRetrievability}%
                </span>
                <span className="text-[11px] text-indigo-300 font-mono bg-indigo-950/60 border border-indigo-800/60 px-2 py-0.5 rounded-full">
                  S: {card.stability ? `${card.stability.toFixed(1)}d` : '1.0d'}
                </span>
              </div>
              <span className="text-[11px] text-indigo-400 font-mono">Target: {Math.round(targetRetention * 100)}%</span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-white leading-relaxed font-display">
              <MathRenderer text={card.question} />
            </h3>
            {card.hint && !isAnswerRevealed && (
              <p className="text-xs text-amber-300 bg-amber-950/30 p-3 rounded-2xl border border-amber-500/30">
                💡 Hint: <MathRenderer text={card.hint} />
              </p>
            )}
          </div>

          {isAnswerRevealed ? (
            <div className="mt-6 pt-6 border-t border-white/[0.08] space-y-4 animate-fadeIn">
              <div className="text-base font-semibold text-slate-100 font-sans">
                <MathRenderer text={card.answer} />
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
                <button
                  onClick={() => handleRateReviewCard('again')}
                  className="p-3 rounded-2xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs font-bold hover:scale-[1.02] transition-transform text-left"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <span>Again</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-rose-900/50 border border-rose-700/50 text-[11px] font-mono">1</kbd>
                    </span>
                    <RotateCw className="w-3 h-3 text-rose-400" />
                  </div>
                  <div className="text-xs text-rose-400 font-mono mt-0.5">{intervals.again}</div>
                </button>
                <button
                  onClick={() => handleRateReviewCard('hard')}
                  className="p-3 rounded-2xl bg-amber-950/40 border border-amber-800/60 text-amber-300 text-xs font-bold hover:scale-[1.02] transition-transform text-left"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <span>Hard</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-amber-900/50 border border-amber-700/50 text-[11px] font-mono">2</kbd>
                    </span>
                  </div>
                  <div className="text-xs text-amber-400 font-mono mt-0.5">{intervals.hard}</div>
                </button>
                <button
                  onClick={() => handleRateReviewCard('good')}
                  className="p-3 rounded-2xl bg-blue-950/40 border border-blue-800/60 text-blue-300 text-xs font-bold hover:scale-[1.02] transition-transform text-left"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <span>Good</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-blue-900/50 border border-blue-700/50 text-[11px] font-mono">3</kbd>
                    </span>
                  </div>
                  <div className="text-xs text-blue-400 font-mono mt-0.5">{intervals.good}</div>
                </button>
                <button
                  onClick={() => handleRateReviewCard('easy')}
                  className="p-3 rounded-2xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs font-bold hover:scale-[1.02] transition-transform text-left"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <span>Easy</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-emerald-900/50 border border-emerald-700/50 text-[11px] font-mono">4</kbd>
                    </span>
                  </div>
                  <div className="text-xs text-emerald-400 font-mono mt-0.5">{intervals.easy}</div>
                </button>
              </div>
            </div>
          ) : (
            <div className="pt-6 flex justify-center">
              <button
                onClick={() => setIsAnswerRevealed(true)}
                className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/25 transition-all hover:scale-105 flex items-center gap-2"
              >
                <span>Reveal Target Answer</span>
                <kbd className="px-2 py-0.5 rounded bg-white/20 text-[11px] font-mono uppercase">Space</kbd>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (activeView === 'curriculum') {
    return (
      <CurriculumKnowledgeMap
        onBack={() => {
          setActiveView('overview');
          setAllCards(StorageService.getAllCards());
          setDueCards(StorageService.getDueCards());
        }}
        onStartSession={onStartSession}
        onOpenDeckStation={onOpenDeckStation}
      />
    );
  }

  if (activeView === 'leeches') {
    return (
      <LeechHunterLab
        onBack={() => {
          setActiveView('overview');
          setAllCards(StorageService.getAllCards());
          setDueCards(StorageService.getDueCards());
        }}
        onCardCured={() => {
          setAllCards(StorageService.getAllCards());
          setDueCards(StorageService.getDueCards());
        }}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-8 px-2 sm:px-4 animate-fadeIn">
      
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Ingestion Hub</span>
        </button>
        <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20">
          FSRS Spaced Repetition Engine
        </span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight font-display">
            Retention & Memory Dynamics
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 font-sans">
            Quantified synaptic stability tracking powered by the Free Spaced Repetition Scheduler.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-slate-950/80 border border-white/[0.08] shrink-0">
          <button
            onClick={() => setActiveView('overview')}
            className="px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>FSRS Stability</span>
          </button>

          <button
            onClick={() => setActiveView('curriculum')}
            className="px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 text-slate-400 hover:text-white"
          >
            <BrainCircuit className="w-3.5 h-3.5 text-indigo-400" />
            <span>Knowledge Tree</span>
          </button>

          <button
            onClick={() => setActiveView('leeches')}
            className="px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 text-slate-400 hover:text-white"
          >
            <Bug className="w-3.5 h-3.5 text-purple-400" />
            <span>Leeches ({leeches.length})</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-5 rounded-3xl glass-panel space-y-1">
          <Flame className="w-5 h-5 text-amber-400 mb-1" />
          <div className="text-2xl font-black text-white font-mono">{stats.currentStreak} Days</div>
          <div className="text-xs text-slate-400 font-medium">Daily Streak</div>
        </div>

        <div className="p-5 rounded-3xl glass-panel space-y-1">
          <Clock className="w-5 h-5 text-indigo-400 mb-1" />
          <div className="text-2xl font-black text-white font-mono">{stats.totalStudyMinutes}m</div>
          <div className="text-xs text-slate-400 font-medium">Total Focus Time</div>
        </div>

        <div className="p-5 rounded-3xl glass-panel space-y-1">
          <Award className="w-5 h-5 text-purple-400 mb-1" />
          <div className="text-2xl font-black text-white font-mono">{stats.conceptsMastered}</div>
          <div className="text-xs text-slate-400 font-medium">Concepts Mastered</div>
        </div>

        <div className="p-5 rounded-3xl glass-panel space-y-1">
          <Layers className="w-5 h-5 text-emerald-400 mb-1" />
          <div className="text-2xl font-black text-white font-mono">{dueCards.length}</div>
          <div className="text-xs text-slate-400 font-medium">Cards Due Today</div>
        </div>
      </div>

      {/* Daily Review Queue Action Banner with Lottie Guardian */}
      <div className="p-6 sm:p-7 rounded-3xl bg-gradient-to-r from-slate-900/90 via-indigo-950/40 to-slate-900/90 border border-indigo-500/30 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-5">
        <div className="flex items-center gap-3.5 text-center sm:text-left">
          <div className="relative w-12 h-12 rounded-2xl overflow-hidden p-0.5 bg-gradient-to-tr from-pink-500 via-purple-500 to-cyan-400 shrink-0 shadow-lg hidden sm:block">
            <img src="/lottie.png" alt="Lottie Guardian" className="w-full h-full object-cover rounded-[14px]" />
            {dueCards.length > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-slate-950 animate-ping" />
            )}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 justify-center sm:justify-start">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <h3 className="text-base font-bold text-white font-display">Daily Memory Reinforcement Queue</h3>
            </div>
            <p className="text-xs text-slate-300">
              <span className="text-pink-300 font-semibold font-display">Lottie:</span> {dueCards.length > 0
                ? `"You have ${dueCards.length} flashcard(s) due today. Clearing them today doubles their biological stability!"`
                : '"All memory traces consolidated! Your neocortex is in peak shape today."'}
            </p>
          </div>
        </div>

        {dueCards.length > 0 && (
          <button
            onClick={handleStartDueReview}
            className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xl shadow-emerald-600/30 transition-all hover:scale-105 shrink-0 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>Review {dueCards.length} Due Cards Now</span>
          </button>
        )}
      </div>

      {/* Mock Exam Arena Card */}
      {onOpenExam && (
        <div className="p-6 sm:p-7 rounded-3xl bg-gradient-to-r from-amber-950/40 via-slate-900/90 to-purple-950/40 border border-amber-500/30 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-5">
          <div className="space-y-1.5 text-center sm:text-left">
            <div className="flex items-center gap-2 justify-center sm:justify-start">
              <Award className="w-4 h-4 text-amber-400" />
              <h3 className="text-base font-bold text-white font-display">
                Mock Exam Arena & Diagnostic Matrix
              </h3>
              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-mono uppercase font-bold">
                Metacognitive
              </span>
            </div>
            <p className="text-xs text-slate-300 max-w-xl">
              Simulate high-stakes exams with Confidence-Weighted scoring (Bushman/Bruno formula). Separate true mastery from dangerous blindspots.
            </p>
            {examReports.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-400 font-mono">
                <span>Latest Exam: <strong className="text-amber-300">{examReports[0].deckTitle}</strong></span>
                <span>•</span>
                <span>Accuracy: <strong className="text-emerald-400">{examReports[0].rawAccuracyPercent}%</strong></span>
                <span>•</span>
                <span>Calibration: <strong className="text-indigo-300">{examReports[0].calibrationPercent}%</strong></span>
                <span>•</span>
                <span>Blindspots: <strong className="text-rose-400">{examReports[0].blindspotCount}</strong></span>
              </div>
            )}
          </div>

          <button
            onClick={onOpenExam}
            className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs flex items-center gap-2 shadow-xl shadow-amber-500/20 transition-all hover:scale-105 shrink-0"
          >
            <Award className="w-4 h-4 text-slate-950" />
            <span>Launch Mock Exam</span>
          </button>
        </div>
      )}

      {/* Macro-Curriculum Knowledge Tree Card Banner */}
      <div className="p-6 sm:p-7 rounded-3xl bg-gradient-to-r from-indigo-950/40 via-slate-900/90 to-purple-950/40 border border-indigo-500/30 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-5">
        <div className="space-y-1.5 text-center sm:text-left">
          <div className="flex items-center gap-2 justify-center sm:justify-start">
            <BrainCircuit className="w-4 h-4 text-indigo-400" />
            <h3 className="text-base font-bold text-white font-display">
              Macro-Curriculum Knowledge Tree
            </h3>
            <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[11px] font-mono uppercase font-bold">
              Knowledge Space Theory
            </span>
          </div>
          <p className="text-xs text-slate-300 max-w-xl">
            Inspect the cognitive prerequisite sequence across your entire academic library. Track synaptic consolidation node-by-node and identify your active Learning Frontier (ZPD).
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-400 font-mono">
            <span>Syllabi: <strong className="text-slate-200">{sessions.length}</strong></span>
            <span>•</span>
            <span>Mastery Metric: <strong className="text-emerald-400">Prerequisite Gating</strong></span>
            <span>•</span>
            <span>Framework: <strong className="text-indigo-300">Doignon &amp; Falmagne</strong></span>
          </div>
        </div>

        <button
          onClick={() => setActiveView('curriculum')}
          className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-xs flex items-center gap-2 shadow-xl shadow-indigo-600/30 transition-all hover:scale-105 shrink-0"
        >
          <BrainCircuit className="w-4 h-4 text-white" />
          <span>Explore Knowledge Tree</span>
        </button>
      </div>

      {/* FSRS Leech Hunter & Mnemonic Rewiring Lab Card */}
      <div className={`p-6 sm:p-7 rounded-3xl border shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-5 transition-all ${
        leeches.length > 0
          ? 'bg-gradient-to-r from-rose-950/40 via-slate-900/90 to-purple-950/40 border-rose-500/40 shadow-rose-950/20'
          : 'bg-gradient-to-r from-purple-950/30 via-slate-900/90 to-slate-900/90 border-purple-500/20'
      }`}>
        <div className="space-y-1.5 text-center sm:text-left">
          <div className="flex items-center gap-2 justify-center sm:justify-start">
            <Bug className={`w-4 h-4 ${leeches.length > 0 ? 'text-rose-400' : 'text-purple-400'}`} />
            <h3 className="text-base font-bold text-white font-display">
              FSRS Leech Hunter & Mnemonic Rewiring Lab
            </h3>
            <span className={`px-2 py-0.5 rounded-md border text-[11px] font-mono uppercase font-bold ${
              leeches.length > 0 
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' 
                : 'bg-purple-500/20 text-purple-300 border-purple-500/30'
            }`}>
              {leeches.length > 0 ? `${leeches.length} Leech Alert` : 'Zero Bottlenecks'}
            </span>
          </div>
          <p className="text-xs text-slate-300 max-w-xl">
            {leeches.length > 0
              ? `Detected ${leeches.length} cards with recurring memory lapses. Perform algorithmic autopsies and rewire them with sensory mnemonics or atomic cloze splits.`
              : 'Algorithmic diagnosis of chronic card failure (FSRS Leech Theory). Automatically identifies interference, cognitive overload, or missing retrieval anchors.'}
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-400 font-mono">
            <span>Threshold: <strong className="text-slate-200">≥3 Lapses / High Difficulty</strong></span>
            <span>•</span>
            <span>Remedies: <strong className="text-purple-300">Sensory Story, Phonetic Pegs, Atomic Cloze</strong></span>
          </div>
        </div>

        <button
          onClick={() => setActiveView('leeches')}
          className={`px-6 py-3.5 rounded-2xl font-black text-xs flex items-center gap-2 shadow-xl transition-all hover:scale-105 shrink-0 ${
            leeches.length > 0
              ? 'bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white shadow-rose-600/30'
              : 'bg-slate-900 hover:bg-slate-800 text-purple-300 border border-purple-500/30 shadow-purple-900/20'
          }`}
        >
          {leeches.length > 0 ? (
            <AlertTriangle className="w-4 h-4 text-white" />
          ) : (
            <Bug className="w-4 h-4 text-purple-400" />
          )}
          <span>{leeches.length > 0 ? `Cure ${leeches.length} Leeches Now` : 'Open Leech Hunter Lab'}</span>
        </button>
      </div>

      {/* Cross-Deck Interleaving Arena Banner */}
      {onOpenInterleaving && (
        <div className="p-6 sm:p-7 rounded-3xl bg-gradient-to-r from-purple-950/40 via-slate-900/90 to-sky-950/40 border border-purple-500/30 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-5">
          <div className="space-y-1.5 text-center sm:text-left">
            <div className="flex items-center gap-2 justify-center sm:justify-start">
              <Shuffle className="w-4 h-4 text-purple-400" />
              <h3 className="text-base font-bold text-white font-display">
                Cross-Deck Interleaving Arena
              </h3>
              <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[11px] font-mono uppercase font-bold">
                Inductive Transfer
              </span>
            </div>
            <p className="text-xs text-slate-300 max-w-xl">
              Break blocked study habits. Intermix flashcards dynamically across unrelated academic disciplines to train cognitive discrimination (Kornell &amp; Bjork, 2008).
            </p>
            {interleavingReports.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-400 font-mono">
                <span>Latest Agility: <strong className="text-emerald-400">{interleavingReports[0].agilityIndex}/100</strong></span>
                <span>•</span>
                <span>Context Shifts: <strong className="text-purple-300">{interleavingReports[0].contextShiftsCount}</strong></span>
                <span>•</span>
                <span>Switch Accuracy: <strong className="text-amber-300">{interleavingReports[0].switchAccuracyPercent}%</strong></span>
              </div>
            )}
          </div>

          <button
            onClick={onOpenInterleaving}
            className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-black text-xs flex items-center gap-2 shadow-xl shadow-purple-600/25 transition-all hover:scale-105 shrink-0"
          >
            <Shuffle className="w-4 h-4 text-white" />
            <span>Enter Interleaving Arena</span>
          </button>
        </div>
      )}

      {/* 35-Day Consistency Heatmap Matrix */}
      <div className="p-6 rounded-3xl glass-panel space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider font-display">
            <Calendar className="w-4 h-4 text-indigo-400" />
            <span>35-Day Cognitive Study Consistency Matrix</span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">Streak: {stats.currentStreak}d</span>
        </div>

        {/* Heatmap Grid */}
        <div className="pt-2">
          <div className="grid grid-cols-7 sm:grid-cols-7 gap-2">
            {heatmapDays.map((d, idx) => {
              const bgColors = [
                'bg-slate-950/80 border-white/[0.05]',
                'bg-indigo-950/60 border-indigo-800/40',
                'bg-indigo-700/60 border-indigo-500/50',
                'bg-indigo-500 border-indigo-400 shadow-md shadow-indigo-500/20'
              ];
              return (
                <div
                  key={idx}
                  title={`${d.date}: ${d.hasStudy ? 'Active Study Session' : 'Rest day'}`}
                  className={`h-9 rounded-xl border flex flex-col items-center justify-center cursor-help transition-all ${bgColors[d.intensity]}`}
                >
                  <span className="text-[11px] text-slate-300 font-mono">{d.date.split(' ')[1]}</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 font-mono">
            <span>35 days ago</span>
            <div className="flex items-center gap-1.5">
              <span>Less</span>
              <span className="w-2.5 h-2.5 rounded bg-slate-950 border border-white/[0.08]" />
              <span className="w-2.5 h-2.5 rounded bg-indigo-950 border border-indigo-800" />
              <span className="w-2.5 h-2.5 rounded bg-indigo-700" />
              <span className="w-2.5 h-2.5 rounded bg-indigo-500" />
              <span>More</span>
            </div>
            <span>Today</span>
          </div>
        </div>
      </div>

      {/* Interactive FSRS Synaptic Forgetting Curve & Target Retention Hub */}
      <div className="p-6 sm:p-7 rounded-3xl glass-panel space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-display">
                FSRS Power-Law Synaptic Forgetting Curve R(t, S)
              </h3>
              <span className="px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-[11px] font-mono font-bold uppercase">
                Mathematical Model
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Live probability of recall modeled over 30 days based on your average synaptic stability ({avgStability}d).
            </p>
          </div>

          {/* Quick Target Retention Switcher */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-950/80 border border-white/[0.08] shrink-0">
            {[
              { rate: 0.85, label: '85% Casual' },
              { rate: 0.90, label: '90% Standard' },
              { rate: 0.95, label: '95% Exam' },
            ].map(item => (
              <button
                key={item.rate}
                onClick={() => {
                  setTargetRetention(item.rate);
                  StorageService.setTargetRetention(item.rate);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  Math.abs(targetRetention - item.rate) < 0.01
                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Real-Time Synaptic Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-white/[0.06] space-y-0.5 text-center">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Mean Retrievability</span>
            <div className="text-lg font-black text-cyan-300 font-mono">{meanRetrievability}%</div>
            <span className="text-[11px] text-slate-500">Across {allCards.length} cards</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-white/[0.06] space-y-0.5 text-center">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Average Stability</span>
            <div className="text-lg font-black text-indigo-300 font-mono">{avgStability} Days</div>
            <span className="text-[11px] text-slate-500">Synaptic half-life (S)</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-white/[0.06] space-y-0.5 text-center">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Target Threshold</span>
            <div className="text-lg font-black text-emerald-300 font-mono">{Math.round(targetRetention * 100)}%</div>
            <span className="text-[11px] text-slate-500">R_target boundary</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-white/[0.06] space-y-0.5 text-center">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Next Spaced Interval</span>
            <div className="text-lg font-black text-purple-300 font-mono">
              {FSRSService.calculateInterval(avgStability, targetRetention)} Days
            </div>
            <span className="text-[11px] text-slate-500">At current target</span>
          </div>
        </div>

        {/* Visual SVG Forgetting Curve Chart */}
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/[0.08] space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>R(t) = (1 + 19/81 • t / {avgStability})^-0.5</span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-cyan-400 inline-block" /> FSRS Curve
              <span className="w-2.5 h-0.5 bg-emerald-400 border-b border-dashed inline-block ml-2" /> Target {Math.round(targetRetention * 100)}%
            </span>
          </div>

          <div className="relative h-44 w-full pt-2">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 600 160" preserveAspectRatio="none">
              <defs>
                <linearGradient id="decayGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              {[100, 90, 75, 50].map((level) => {
                const y = 160 - ((level - 40) / 60) * 150;
                return (
                  <g key={level}>
                    <line 
                      x1="0" 
                      y1={y} 
                      x2="600" 
                      y2={y} 
                      stroke={level === Math.round(targetRetention * 100) ? "#10b981" : "rgba(255,255,255,0.08)"} 
                      strokeDasharray={level === Math.round(targetRetention * 100) ? "4,4" : undefined} 
                      strokeWidth={level === Math.round(targetRetention * 100) ? 1.5 : 1} 
                    />
                    <text x="8" y={y - 4} fill="rgba(148,163,184,0.6)" fontSize="9" fontFamily="monospace">{level}%</text>
                  </g>
                );
              })}

              {/* Day Markers */}
              {[0, 7, 14, 21, 30].map(day => {
                const x = (day / 30) * 580 + 10;
                return (
                  <g key={day}>
                    <line x1={x} y1="0" x2={x} y2="160" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                    <text x={x - 8} y="156" fill="rgba(148,163,184,0.5)" fontSize="9" fontFamily="monospace">Day {day}</text>
                  </g>
                );
              })}

              {/* Decay Area & Curve Line */}
              {(() => {
                const points = decayPoints.map(p => {
                  const x = (p.day / 30) * 580 + 10;
                  const y = 160 - ((Math.max(40, p.retrievability) - 40) / 60) * 150;
                  return `${x},${y}`;
                });
                const pathD = `M ${points.join(' L ')}`;
                const areaD = `M 10,160 L ${points.join(' L ')} L 590,160 Z`;

                return (
                  <>
                    <path d={areaD} fill="url(#decayGradient)" />
                    <path d={pathD} fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeLinecap="round" />
                  </>
                );
              })()}
            </svg>
          </div>
        </div>
      </div>

      {/* Memory Stability Pipeline Breakdown */}
      <div className="p-6 rounded-3xl glass-panel space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider font-display">
          <BarChart3 className="w-4 h-4 text-purple-400" />
          <span>Card Memory Stability Pipeline (FSRS Stages)</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/[0.06] text-center">
            <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider">Learning</span>
            <div className="text-xl font-black text-white font-mono mt-1">{learningCards}</div>
            <span className="text-[11px] text-slate-500">&lt; 1 day stability</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/[0.06] text-center">
            <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">Young</span>
            <div className="text-xl font-black text-white font-mono mt-1">{youngCards}</div>
            <span className="text-[11px] text-slate-500">1 - 7 days stability</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/[0.06] text-center">
            <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider">Mature</span>
            <div className="text-xl font-black text-white font-mono mt-1">{matureCards}</div>
            <span className="text-[11px] text-slate-500">7 - 30 days stability</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/[0.06] text-center">
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Mastered</span>
            <div className="text-xl font-black text-white font-mono mt-1">{masteredCards}</div>
            <span className="text-[11px] text-slate-500">&gt; 30 days stability</span>
          </div>
        </div>
      </div>

      {/* Recent Sessions Library */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 font-display">Recent Study Sessions</h3>
        {sessions.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 glass-panel rounded-3xl">
            No study sessions recorded yet. Launch your first Study Pilot to build your retention portfolio!
          </div>
        ) : (
          <div className="space-y-2.5">
            {sessions.map((sess) => (
              <div
                key={sess.id}
                onClick={() => {
                  if (onOpenDeckStation) {
                    onOpenDeckStation(sess);
                  } else {
                    onStartSession(sess);
                  }
                }}
                className="p-4 sm:p-5 rounded-2xl glass-panel-interactive flex items-center justify-between cursor-pointer group"
              >
                <div>
                  <div className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors font-display">{sess.title}</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {sess.concepts.length} concepts • {Math.max(1, Math.round(sess.elapsedSeconds / 60))} minutes focus time
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onOpenDeckStation) {
                      onOpenDeckStation(sess);
                    } else {
                      onStartSession(sess);
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-indigo-600 text-xs text-indigo-300 hover:text-white font-bold transition-all border border-white/[0.08]"
                >
                  Deck Station
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
