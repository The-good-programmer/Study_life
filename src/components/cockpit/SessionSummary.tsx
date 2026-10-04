import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { 
  Award, 
  Clock, 
  Flame, 
  Layers, 
  ArrowRight, 
  RotateCcw, 
  TrendingUp, 
  CheckCircle2, 
  Printer, 
  Download, 
  FileText,
  Sparkles,
  Zap,
  ShieldAlert,
  Check,
  Share2
} from 'lucide-react';
import type { StudySession, ConceptCheckpoint } from '../../types';
import { StorageService } from '../../services/storageService';
import { soundEngine } from '../../services/soundEngine';
import { ExportService } from '../../services/exportService';
import { LottieMascot } from '../mascot/LottieMascot';
import { SynapticFlexModal } from '../mascot/SynapticFlexModal';
import { axolotlService } from '../../services/axolotlService';
import { haptics } from '../../services/hapticsService';

interface SessionSummaryProps {
  session: StudySession;
  onRestart: () => void;
  onHome: () => void;
  onOpenDashboard: () => void;
  onStartSession?: (session: StudySession) => void;
}

function generateRescueSession(originalSession: StudySession): StudySession {
  const missedProbes = originalSession.diagnosticReport?.probes.filter(p => !p.isCorrect) || [];
  const missedConceptIds = new Set(missedProbes.map(p => p.conceptId));

  const conceptsForRescue: ConceptCheckpoint[] = [];

  originalSession.concepts.forEach(concept => {
    const isFragileConcept = missedConceptIds.has(concept.id);
    const cards = concept.retrievalCards || [];
    const lapsedCards = cards.filter(c => (c.lapses && c.lapses > 0) || (c.stability && c.stability <= 1.5));
    
    const selectedCards = lapsedCards.length > 0 
      ? lapsedCards 
      : isFragileConcept 
      ? cards.slice(0, 2) 
      : [];

    if (selectedCards.length > 0 || isFragileConcept) {
      conceptsForRescue.push({
        ...concept,
        id: `rescue-${concept.id}-${Date.now()}`,
        title: `[Remediation] ${concept.title}`,
        retrievalCards: selectedCards.length > 0 ? selectedCards : cards.slice(0, 2),
      });
    }
  });

  if (conceptsForRescue.length === 0) {
    const fallbackCards = originalSession.concepts.flatMap(c => c.retrievalCards || []).slice(0, 4);
    conceptsForRescue.push({
      ...originalSession.concepts[0],
      id: `consolidation-${Date.now()}`,
      title: `[Consolidation] ${originalSession.concepts[0].title}`,
      retrievalCards: fallbackCards,
    });
  }

  return {
    id: `rescue-${Date.now()}`,
    title: `🚨 ${originalSession.title} (Rescue Drill)`,
    category: originalSession.category,
    description: `Targeted 3-minute cognitive rescue deck addressing fragile concepts and lapsed items from "${originalSession.title}".`,
    concepts: conceptsForRescue,
    currentConceptIndex: 0,
    currentPhase: 'retrieval',
    elapsedSeconds: 0,
    createdAt: new Date().toISOString(),
    casualFlashcardMode: true,
  };
}

export const SessionSummary: React.FC<SessionSummaryProps> = ({
  session,
  onRestart,
  onHome,
  onOpenDashboard,
  onStartSession,
}) => {
  const minutes = Math.max(1, Math.round(session.elapsedSeconds / 60));
  const totalCards = session.concepts.reduce((acc, c) => acc + c.retrievalCards.length, 0);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);
  const [rescueSaved, setRescueSaved] = useState(false);
  const [isFlexModalOpen, setIsFlexModalOpen] = useState(false);

  const missedProbes = session.diagnosticReport?.probes.filter(p => !p.isCorrect) || [];

  const handleSaveRescueDeck = () => {
    const rescueSession = generateRescueSession(session);
    StorageService.saveSession(rescueSession);
    soundEngine.playSuccess();
    setRescueSaved(true);
    setTimeout(() => setRescueSaved(false), 4000);
  };

  const handleStartRescueDrill = () => {
    const rescueSession = generateRescueSession(session);
    StorageService.saveSession(rescueSession);
    soundEngine.playStart();
    if (onStartSession) {
      onStartSession(rescueSession);
    }
  };

  const [rewards, setRewards] = useState<{
    treatsEarned: Record<string, number>;
    coinsEarned: number;
    friendshipXPEarned: number;
    leveledUp: boolean;
  } | null>(null);

  useEffect(() => {
    soundEngine.playCompletionChime();
    haptics.celebrate();
    const coinTimer = setTimeout(() => {
      soundEngine.playCoinCascade();
      haptics.coin();
    }, 650);

    StorageService.recordCompletedSession();
    StorageService.recordStudyMinutes(minutes);

    const r = axolotlService.awardStudySessionRewards(totalCards, minutes, 0.9);
    setRewards(r);

    try {
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 }
      });
    } catch {
      // confetti fallback
    }

    return () => clearTimeout(coinTimer);
  }, [minutes, totalCards]);

  const handlePrint = () => {
    ExportService.printStudySheet(session);
  };

  const handleDownloadMD = () => {
    ExportService.downloadMarkdown(session);
    setDownloadNotice('Downloaded Markdown notes!');
    setTimeout(() => setDownloadNotice(null), 3000);
  };

  const handleDownloadAnki = () => {
    ExportService.downloadAnkiTSV(session);
    setDownloadNotice('Downloaded Anki/Quizlet TSV file!');
    setTimeout(() => setDownloadNotice(null), 3000);
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 text-center animate-fadeIn py-6">
      
      {/* Lottie Mascot Celebrating Badge */}
      <div className="relative w-28 h-28 mx-auto group">
        <div className="absolute -inset-3 rounded-full bg-gradient-to-tr from-pink-500/40 via-purple-500/20 to-cyan-400/40 blur-xl animate-pulse" />
        <div className="relative w-full h-full rounded-3xl overflow-hidden bg-slate-950 border border-pink-500/40 shadow-2xl p-1">
          <img 
            src="/lottie.png" 
            alt="Lottie Celebrating" 
            className="w-full h-full object-cover rounded-2xl"
          />
        </div>
        <div className="absolute -bottom-2 -right-1 px-2.5 py-0.5 rounded-full bg-slate-950 border border-pink-500/40 text-[10px] font-bold text-pink-300 flex items-center gap-1 shadow-lg">
          <Sparkles className="w-3 h-3 text-pink-400" />
          <span>Neurogenesis!</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Full Cognitive Study Pilot Complete</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-display">
          Session Accomplished!
        </h2>
        <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed font-sans">
          You conquered the complete cognitive sequence for <span className="text-pink-300 font-semibold">"{session.title}"</span>.
        </p>
      </div>

      {/* Mascot Praise */}
      <LottieMascot 
        variant="card" 
        size="sm" 
        speech="Incredible focus! Your synapses just underwent long-term potentiation. Rest up and let the offline consolidation do its magic." 
        className="max-w-md mx-auto !bg-slate-900/60 !border-pink-500/25"
      />

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl glass-panel text-center space-y-1">
          <Clock className="w-5 h-5 text-indigo-400 mx-auto mb-1" />
          <div className="text-xl font-black text-white font-mono">{minutes}m</div>
          <div className="text-[11px] text-slate-400 font-medium">Deep Focus</div>
        </div>

        <div className="p-4 rounded-2xl glass-panel text-center space-y-1">
          <Award className="w-5 h-5 text-purple-400 mx-auto mb-1" />
          <div className="text-xl font-black text-white font-mono">{session.concepts.length}</div>
          <div className="text-[11px] text-slate-400 font-medium">Concepts Primed</div>
        </div>

        <div className="p-4 rounded-2xl glass-panel text-center space-y-1">
          <Layers className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
          <div className="text-xl font-black text-white font-mono">{totalCards}</div>
          <div className="text-[11px] text-slate-400 font-medium">FSRS Cards</div>
        </div>

        <div className="p-4 rounded-2xl glass-panel text-center space-y-1">
          <Flame className="w-5 h-5 text-amber-400 mx-auto mb-1" />
          <div className="text-xl font-black text-white font-mono">+1</div>
          <div className="text-[11px] text-slate-400 font-medium">Streak Day</div>
        </div>
      </div>

      {/* Axolotl Care Rewards Card */}
      {rewards && (
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-pink-950/40 via-purple-950/40 to-slate-900/90 border border-pink-500/30 text-left space-y-3 shadow-xl backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-pink-400" />
              <h4 className="text-xs font-bold text-white font-display">Lottie's Care Rewards Earned!</h4>
            </div>
            {rewards.leveledUp && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-500/30 text-pink-300 border border-pink-500/50 animate-bounce">
                🎉 Friendship Leveled Up!
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
            <div className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.08]">
              <span className="text-lg">🦐</span>
              <div className="text-xs font-bold text-white mt-0.5">+{rewards.treatsEarned.shrimp || 0}</div>
              <div className="text-[9px] text-slate-400">Shrimp</div>
            </div>
            <div className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.08]">
              <span className="text-lg">🍓</span>
              <div className="text-xs font-bold text-white mt-0.5">+{rewards.treatsEarned.berry || 0}</div>
              <div className="text-[9px] text-slate-400">Berries</div>
            </div>
            <div className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.08]">
              <span className="text-lg">🫘</span>
              <div className="text-xs font-bold text-white mt-0.5">+{rewards.treatsEarned.bean || 0}</div>
              <div className="text-[9px] text-slate-400">Beans</div>
            </div>
            <div className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.08]">
              <span className="text-lg">✨</span>
              <div className="text-xs font-bold text-white mt-0.5">+{rewards.treatsEarned.pearl || 0}</div>
              <div className="text-[9px] text-slate-400">Pellets</div>
            </div>
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <span className="text-lg">🪙</span>
              <div className="text-xs font-bold text-amber-300 mt-0.5">+{rewards.coinsEarned}</div>
              <div className="text-[9px] text-amber-400/80">Coins</div>
            </div>
            <div className="p-2 rounded-xl bg-pink-500/10 border border-pink-500/20">
              <span className="text-lg">💖</span>
              <div className="text-xs font-bold text-pink-300 mt-0.5">+{rewards.friendshipXPEarned}</div>
              <div className="text-[9px] text-pink-400/80">Friendship XP</div>
            </div>
          </div>
        </div>
      )}

      {/* Visual Memory Consolidation Forecast Chart */}
      <div className="p-5 rounded-3xl glass-panel text-left space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-300 font-display">
            <TrendingUp className="w-4 h-4 text-indigo-400" />
            <span>FSRS Memory Consolidation Forecast</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">Ebbinghaus Countered</span>
        </div>

        {/* Forecast SVG Chart */}
        <div className="h-20 w-full relative pt-2">
          <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 40">
            {/* Standard Passive Forgetting Curve (Steep drop) */}
            <path
              d="M 0,5 Q 15,35 100,38"
              fill="none"
              stroke="#ef4444"
              strokeWidth="2"
              strokeDasharray="3,3"
              opacity="0.4"
            />
            {/* FSRS Spaced Repetition Curve (Flat retention plateau) */}
            <path
              d="M 0,5 Q 30,8 100,12"
              fill="none"
              stroke="#10b981"
              strokeWidth="2.5"
            />
          </svg>
          <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mt-1">
            <span>Day 0 (Now)</span>
            <span className="text-emerald-400 font-bold">FSRS Retrievability (~92%)</span>
            <span>Day 30</span>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed font-sans pt-1">
          All active retrieval items have been registered with the Free Spaced Repetition Scheduler. They will automatically resurface right when your synaptic retention requires reinforcement.
        </p>
      </div>

      {/* Curriculum Mastery Matrix */}
      <div className="p-5 rounded-3xl glass-panel text-left space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-white font-display">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Curriculum Mastery & Diagnostic Breakdown</span>
          </div>
          <span className="text-[10px] text-emerald-300 font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40">
            {session.concepts.length} Checkpoints Cleared
          </span>
        </div>

        <div className="space-y-2">
          {session.concepts.map((concept, index) => (
            <div
              key={concept.id}
              className="p-3.5 rounded-2xl bg-slate-950/70 border border-white/[0.06] flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-5 h-5 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 flex items-center justify-center font-mono font-bold text-[10px] shrink-0">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <div className="font-bold text-white truncate font-display">{concept.title}</div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {concept.retrievalCards.length} FSRS cards scheduled • Dual-coding mental model validated
                  </div>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 font-mono text-[10px] font-semibold">
                  Mastered
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Atomic Memory Rescue Deck Card */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-amber-950/30 via-slate-950/80 to-rose-950/20 border border-amber-500/35 text-left space-y-4 shadow-xl shadow-amber-500/5 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white font-display flex items-center gap-2">
                <span>Atomic Memory Rescue Deck</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                  Targeted Micro-Remediation
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                Error-driven spaced reinforcement prevents fragile memory traces from decaying.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-amber-300">
            {missedProbes.length > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30">
                {missedProbes.length} Pre-Test Gaps
              </span>
            )}
            <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 border border-indigo-500/30 text-indigo-300">
              ~3 Min Drill
            </span>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed font-sans">
          {missedProbes.length > 0 
            ? `Your pre-test registered attention gaps in ${missedProbes.map(p => p.conceptTitle).join(', ')}. Lotti can isolate these exact items into a hyper-focused 3-minute rescue session.`
            : `All diagnostic probes were mastered. You can still generate an instant rapid consolidation deck for quick review before your exam.`}
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
          {onStartSession && (
            <button
              onClick={handleStartRescueDrill}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02] cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 fill-slate-950" />
              <span>Start 3-Minute Rescue Drill Now</span>
            </button>
          )}

          <button
            onClick={handleSaveRescueDeck}
            className={`w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
              rescueSaved
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-900/90 hover:bg-slate-800 text-slate-200 border-white/[0.08]'
            }`}
          >
            {rescueSaved ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Rescue Deck Saved to Library</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5 text-amber-400" />
                <span>Save Rescue Deck for Morning Review</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* High-Yield Study Sheet & Export Ribbon */}
      <div className="p-5 rounded-3xl glass-panel text-left space-y-3 border-indigo-500/30 bg-indigo-950/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-white font-display">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span>High-Yield Study Sheet & Deck Export</span>
          </div>
          <span className="text-[10px] text-indigo-300 font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/40">
            Cornell + Anki Ready
          </span>
        </div>

        <p className="text-xs text-slate-300">
          Print a clean physical revision guide with Cornell nomenclature and active retrieval cue columns, or export to Notion/Anki.
        </p>

        {/* Viral Share Synaptic Flex Trophy Button */}
        <button
          onClick={() => setIsFlexModalOpen(true)}
          className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 hover:from-pink-400 hover:to-cyan-400 text-white font-extrabold text-xs shadow-lg shadow-pink-500/25 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] cursor-pointer"
        >
          <Share2 className="w-4 h-4" />
          <span>Share Synaptic Flex Card (Trophy & Socials)</span>
        </button>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
          <button
            onClick={handlePrint}
            className="p-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02]"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Study Sheet</span>
          </button>

          <button
            onClick={handleDownloadMD}
            className="p-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 border border-white/[0.08] transition-all hover:scale-[1.02]"
          >
            <FileText className="w-3.5 h-3.5 text-purple-400" />
            <span>Export Markdown</span>
          </button>

          <button
            onClick={handleDownloadAnki}
            className="p-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 border border-white/[0.08] transition-all hover:scale-[1.02]"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Anki/Quizlet TSV</span>
          </button>
        </div>

        {downloadNotice && (
          <div className="text-xs text-emerald-400 font-semibold text-center animate-fadeIn">
            ✓ {downloadNotice}
          </div>
        )}
      </div>

      {/* Action Navigation Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
        <button
          onClick={onRestart}
          className="w-full sm:w-auto px-5 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 border border-white/[0.08] transition-all hover:scale-105"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Re-Study Material</span>
        </button>

        <button
          onClick={onOpenDashboard}
          className="w-full sm:w-auto px-5 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 border border-white/[0.08] transition-all hover:scale-105"
        >
          <Layers className="w-3.5 h-3.5 text-emerald-400" />
          <span>View Due Queue</span>
        </button>

        <button
          onClick={onHome}
          className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/30 transition-all hover:scale-105"
        >
          <span>Study Another Subject</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Share Synaptic Flex Trophy Modal */}
      <SynapticFlexModal
        isOpen={isFlexModalOpen}
        onClose={() => setIsFlexModalOpen(false)}
        session={session}
        stats={StorageService.getStats()}
      />

    </div>
  );
};
