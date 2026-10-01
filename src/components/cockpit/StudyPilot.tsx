import React, { useState, useEffect } from 'react';
import { Sparkles, HelpCircle, Zap, Coffee, X, Clock, ChevronRight } from 'lucide-react';
import type { StudyPhase, StudySession } from '../../types';
import { PrimingPhase } from './PrimingPhase';
import { FeynmanPhase } from './FeynmanPhase';
import { RetrievalPhase } from './RetrievalPhase';
import { RestBreakPhase } from './RestBreakPhase';
import { SessionSummary } from './SessionSummary';
import { StorageService } from '../../services/storageService';

interface StudyPilotProps {
  initialSession: StudySession;
  onExit: () => void;
  onOpenDashboard: () => void;
}

export const StudyPilot: React.FC<StudyPilotProps> = ({ initialSession, onExit, onOpenDashboard }) => {
  const [session, setSession] = useState<StudySession>(initialSession);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Live session timer
  useEffect(() => {
    if (session.currentPhase === 'summary') return;
    const interval = setInterval(() => {
      setSession(prev => {
        const nextSeconds = prev.elapsedSeconds + 1;
        const updated = { ...prev, elapsedSeconds: nextSeconds };
        StorageService.saveSession(updated);
        return updated;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [session.currentPhase]);

  const currentConcept = session.concepts[session.currentConceptIndex] || session.concepts[0];

  const setPhase = (phase: StudyPhase) => {
    setSession(prev => {
      const updated = { ...prev, currentPhase: phase };
      StorageService.saveSession(updated);
      return updated;
    });
  };

  const handleNextConceptOrSummary = () => {
    if (session.currentConceptIndex + 1 < session.concepts.length) {
      setSession(prev => ({
        ...prev,
        currentConceptIndex: prev.currentConceptIndex + 1,
        currentPhase: 'priming',
      }));
    } else {
      setSession(prev => ({
        ...prev,
        currentPhase: 'summary',
        completedAt: new Date().toISOString(),
      }));
    }
  };

  const minutes = Math.floor(session.elapsedSeconds / 60);
  const seconds = session.elapsedSeconds % 60;
  const timeFormatted = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  const phases = [
    { id: 'priming', label: '1. Priming', icon: Sparkles },
    { id: 'feynman', label: '2. Feynman', icon: HelpCircle },
    { id: 'retrieval', label: '3. Recall', icon: Zap },
    { id: 'rest', label: '4. Rest', icon: Coffee },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      
      {/* Top Cockpit Header */}
      <div className="w-full border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-4 py-3 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          
          {/* Concept Progress Info */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => setShowExitConfirm(true)}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Exit Study Session"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs text-indigo-400 font-semibold uppercase tracking-wider">
                  Concept {session.currentConceptIndex + 1} of {session.concepts.length}
                </span>
                <span className="hidden sm:inline text-xs text-slate-600">•</span>
                <span className="hidden sm:inline text-xs text-slate-400 truncate max-w-[200px]">
                  {session.title}
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-bold text-white truncate max-w-[280px] sm:max-w-md">
                {currentConcept.title}
              </h2>
            </div>
          </div>

          {/* Stepper (Phases) */}
          <div className="hidden md:flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
            {phases.map((p, idx) => {
              const Icon = p.icon;
              const isActive = session.currentPhase === p.id;
              const isPassed = phases.findIndex(x => x.id === session.currentPhase) > idx;

              return (
                <div key={p.id} className="flex items-center">
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                        : isPassed
                        ? 'text-indigo-300 font-semibold'
                        : 'text-slate-500'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{p.label}</span>
                  </div>
                  {idx < phases.length - 1 && (
                    <ChevronRight className="w-3 h-3 text-slate-700 mx-0.5" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Live Session Clock */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 font-mono text-xs">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span>{timeFormatted}</span>
          </div>

        </div>
      </div>

      {/* Main Study Arena */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 flex flex-col justify-center">
        {session.currentPhase === 'priming' && (
          <PrimingPhase
            concept={currentConcept}
            onComplete={() => setPhase('feynman')}
          />
        )}

        {session.currentPhase === 'feynman' && (
          <FeynmanPhase
            concept={currentConcept}
            onComplete={() => setPhase('retrieval')}
          />
        )}

        {session.currentPhase === 'retrieval' && (
          <RetrievalPhase
            concept={currentConcept}
            onComplete={() => setPhase('rest')}
          />
        )}

        {session.currentPhase === 'rest' && (
          <RestBreakPhase
            onComplete={handleNextConceptOrSummary}
            onSkip={handleNextConceptOrSummary}
          />
        )}

        {session.currentPhase === 'summary' && (
          <SessionSummary
            session={session}
            onRestart={() => setSession(prev => ({ ...prev, currentConceptIndex: 0, currentPhase: 'priming' }))}
            onHome={onExit}
            onOpenDashboard={onOpenDashboard}
          />
        )}
      </main>

      {/* Exit Confirmation Dialog */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="max-w-sm w-full p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Clock className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">Leave Study Session?</h3>
              <p className="text-xs text-slate-400">
                Your completed concept flashcards and elapsed time have already been saved to your local study progress.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Resume Studying
              </button>
              <button
                onClick={onExit}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
              >
                End Session
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
