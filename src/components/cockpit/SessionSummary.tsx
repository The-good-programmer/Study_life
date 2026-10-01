import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Award, Clock, Flame, Layers, ArrowRight, RotateCcw } from 'lucide-react';
import type { StudySession } from '../../types';
import { StorageService } from '../../services/storageService';
import { soundEngine } from '../../services/soundEngine';

interface SessionSummaryProps {
  session: StudySession;
  onRestart: () => void;
  onHome: () => void;
  onOpenDashboard: () => void;
}

export const SessionSummary: React.FC<SessionSummaryProps> = ({
  session,
  onRestart,
  onHome,
  onOpenDashboard,
}) => {
  const minutes = Math.max(1, Math.round(session.elapsedSeconds / 60));
  const totalCards = session.concepts.reduce((acc, c) => acc + c.retrievalCards.length, 0);

  useEffect(() => {
    // Fire confetti celebration
    soundEngine.playCompletionChime();
    StorageService.recordCompletedSession();
    StorageService.recordStudyMinutes(minutes);

    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch {
      // confetti fallback
    }
  }, [minutes]);

  return (
    <div className="max-w-xl mx-auto space-y-6 text-center animate-fadeIn py-6">
      
      {/* Icon Badge */}
      <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-emerald-400 p-0.5 shadow-2xl shadow-indigo-500/30">
        <div className="w-full h-full bg-slate-950 rounded-[22px] flex items-center justify-center">
          <Award className="w-10 h-10 text-amber-400" />
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          Session Completed!
        </h2>
        <p className="text-sm text-slate-400">
          You finished the full cognitive study cycle for <span className="text-indigo-300 font-medium">"{session.title}"</span>.
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <Clock className="w-5 h-5 text-indigo-400 mx-auto mb-1" />
          <div className="text-lg font-bold text-white">{minutes}m</div>
          <div className="text-[11px] text-slate-400">Focus Time</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <Award className="w-5 h-5 text-purple-400 mx-auto mb-1" />
          <div className="text-lg font-bold text-white">{session.concepts.length}</div>
          <div className="text-[11px] text-slate-400">Concepts</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <Layers className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
          <div className="text-lg font-bold text-white">{totalCards}</div>
          <div className="text-[11px] text-slate-400">FSRS Cards</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <Flame className="w-5 h-5 text-amber-400 mx-auto mb-1" />
          <div className="text-lg font-bold text-white">+1</div>
          <div className="text-[11px] text-slate-400">Streak Day</div>
        </div>
      </div>

      {/* Spaced Repetition Advice */}
      <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-900/50 text-xs text-indigo-200 text-left space-y-1">
        <div className="font-semibold text-indigo-300 flex items-center gap-1.5">
          <span>🧠 Cognitive Science Tip</span>
        </div>
        <p className="text-slate-300">
          Your active recall responses have been indexed into the FSRS algorithm. The cards will automatically re-appear when their memory decay curve reaches optimal retrieval difficulty.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
        <button
          onClick={onRestart}
          className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 border border-slate-700 transition-all"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Re-Study This Material</span>
        </button>

        <button
          onClick={onOpenDashboard}
          className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 border border-slate-700 transition-all"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>View Review Queue</span>
        </button>

        <button
          onClick={onHome}
          className="w-full sm:w-auto px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 transition-all"
        >
          <span>Study Another Subject</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

    </div>
  );
};
