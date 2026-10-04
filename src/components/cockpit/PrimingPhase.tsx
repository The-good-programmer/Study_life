import React, { useState, useEffect, useCallback } from 'react';
import { Lightbulb, CheckCircle2, BookOpen, ArrowRight, Eye, Layers, PenTool, GitFork, Zap, Brain } from 'lucide-react';
import type { ConceptCheckpoint } from '../../types';
import { MathRenderer } from '../common/MathRenderer';
import { StorageService } from '../../services/storageService';
import { soundEngine } from '../../services/soundEngine';

import { ConceptGraph } from './ConceptGraph';
import { DualCodingWhiteboard } from '../canvas/DualCodingWhiteboard';
import { ScienceExplainerModal } from '../common/ScienceExplainerModal';

interface PrimingPhaseProps {
  concept: ConceptCheckpoint;
  onComplete: () => void;
  onInspectSource?: (pageNumber?: number) => void;
  diagnosticMissed?: boolean;
}

export const PrimingPhase: React.FC<PrimingPhaseProps> = ({ 
  concept, 
  onComplete, 
  onInspectSource,
  diagnosticMissed,
}) => {
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
  const [visualMode, setVisualMode] = useState<'graph' | 'whiteboard'>('graph');
  const [showScienceModal, setShowScienceModal] = useState(false);

  const handleFinishPriming = useCallback(() => {
    StorageService.addXP(20);
    soundEngine.playSocraticChallengeChime();
    onComplete();
  }, [onComplete]);

  // Keyboard shortcut: Enter proceeds to Feynman
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.key === 'Enter') {
        e.preventDefault();
        handleFinishPriming();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleFinishPriming]);

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn py-2">
      
      {/* Phase 1: Lottie Co-Pilot Priming Briefing */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-3xl bg-gradient-to-r from-indigo-950/60 via-slate-900/70 to-purple-950/50 border border-indigo-500/25 backdrop-blur-xl shadow-lg">
        <div className="flex items-center gap-3 text-xs sm:text-sm text-indigo-300">
          <div className="relative w-9 h-9 rounded-2xl overflow-hidden p-0.5 bg-gradient-to-tr from-pink-500 via-purple-500 to-cyan-400 shrink-0 shadow-md">
            <img 
              src="/lottie.png" 
              alt="Lottie Co-Pilot" 
              className="w-full h-full object-cover rounded-[14px]"
            />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-cyan-400 ring-2 ring-slate-950 animate-ping" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white font-display">Step 1: Quick Overview</span>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playAxolotlBubble();
                  setShowScienceModal(true);
                }}
                className="px-2 py-0.5 rounded-full bg-indigo-500/20 hover:bg-indigo-500/35 text-indigo-300 hover:text-white border border-indigo-500/30 text-[11px] font-mono flex items-center gap-1 cursor-pointer transition-all shadow-sm"
                title="Learn why schema priming accelerates learning"
              >
                <Brain className="w-3 h-3 text-indigo-400" />
                <span>Why this works</span>
              </button>
            </div>
            <div className="text-[11px] text-slate-300">
              <span className="text-pink-300 font-semibold font-display">Lottie:</span> "Get the big picture in 30 seconds before you test your recall!"
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {concept.sourceAnchor && onInspectSource && (
            <button
              type="button"
              onClick={() => onInspectSource(concept.sourceAnchor?.pageNumber)}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 hover:text-white border border-indigo-500/30 flex items-center gap-1.5 transition-all shadow-sm"
              title={`Jump to page ${concept.sourceAnchor.pageNumber} in source document`}
            >
              <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
              <span>Source: p.{concept.sourceAnchor.pageNumber}</span>
            </button>
          )}
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shrink-0 font-mono">
            +20 XP
          </span>
        </div>
      </div>

      {/* Pre-Test Attention Priming Alert */}
      {diagnosticMissed && (
        <div className="p-4 rounded-2xl bg-cyan-950/40 border border-cyan-500/40 text-xs text-cyan-200 flex items-start gap-3 animate-fadeIn shadow-lg shadow-cyan-500/10">
          <div className="w-6 h-6 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300 shrink-0 mt-0.5">
            <Zap className="w-3.5 h-3.5" />
          </div>
          <div className="space-y-0.5">
            <span className="font-bold text-cyan-300 font-display block">High Priority Focus:</span>
            <span className="text-slate-300 leading-relaxed">
              You had trouble with this concept in the quick check. Take a quick look at the intuition below and test yourself!
            </span>
          </div>
        </div>
      )}

      {/* Mental Model Analogy Blueprint Card */}
      <div className="p-6 sm:p-8 rounded-3xl glass-panel relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none group-hover:bg-indigo-500/20 transition-all duration-700" />
        
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs tracking-wider uppercase font-display">
            <Lightbulb className="w-4 h-4" />
            <span>Key Intuition & Analogy</span>
          </div>
          <span className="text-[11px] text-slate-500 uppercase tracking-widest font-mono">Big Picture</span>
        </div>
        
        <div className="text-lg sm:text-xl text-slate-100 font-medium leading-relaxed font-sans">
          "<MathRenderer text={concept.mentalModel} />"
        </div>
      </div>

      {/* Visual Spatial Schema: Mind Map vs Dual-Coding Whiteboard */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider font-display">
              Spatial Mental Blueprint
            </span>
          </div>

          <div className="flex items-center bg-slate-900/90 p-1 rounded-2xl border border-white/[0.08] shadow-inner">
            <button
              onClick={() => setVisualMode('graph')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                visualMode === 'graph'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <GitFork className="w-3.5 h-3.5" />
              <span>Concept Graph</span>
            </button>
            <button
              onClick={() => setVisualMode('whiteboard')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                visualMode === 'whiteboard'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>Dual-Coding Whiteboard</span>
            </button>
          </div>
        </div>

        {visualMode === 'graph' ? (
          <ConceptGraph concept={concept} />
        ) : (
          <DualCodingWhiteboard concept={concept} />
        )}
      </div>

      {/* High-Yield Core Takeaways */}
      <div className="p-6 sm:p-7 rounded-3xl glass-panel space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300 font-display">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>High-Yield Core Takeaways</span>
        </div>

        <ul className="space-y-3">
          {concept.coreTakeaways.map((takeaway, idx) => (
            <li 
              key={idx} 
              className="flex items-start gap-3.5 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04] hover:border-indigo-500/30 transition-all"
            >
              <span className="w-6 h-6 rounded-xl bg-slate-800/90 border border-white/[0.08] flex items-center justify-center text-xs font-bold text-indigo-400 shrink-0 mt-0.5 shadow-sm font-mono">
                {idx + 1}
              </span>
              <span className="text-sm text-slate-200 leading-relaxed font-sans">
                <MathRenderer text={takeaway} />
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Interactive Key Terms & Nomenclature */}
      {concept.keyTerms.length > 0 && (
        <div className="p-6 sm:p-7 rounded-3xl glass-panel space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300 font-display">
              <BookOpen className="w-4 h-4 text-amber-400" />
              <span>Nomenclature & Key Vocabulary</span>
            </div>
            <span className="text-xs text-slate-400 flex items-center gap-1 font-medium">
              <Eye className="w-3.5 h-3.5" /> Tap any term to inspect definition
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {concept.keyTerms.map((termObj, idx) => {
              const isSelected = selectedTerm === termObj.term;
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedTerm(isSelected ? null : termObj.term)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-600/30 scale-[1.03]'
                      : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-white/[0.08] hover:border-indigo-500/40'
                  }`}
                >
                  <MathRenderer text={termObj.term} />
                </button>
              );
            })}
          </div>

          {/* Expanded definition drawer */}
          {selectedTerm && (
            <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/30 text-xs animate-fadeIn space-y-1">
              <div className="font-bold text-indigo-300 text-sm font-display flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-indigo-400" />
                <MathRenderer text={selectedTerm} />
              </div>
              <div className="text-slate-200 leading-relaxed text-xs font-sans">
                <MathRenderer text={concept.keyTerms.find(t => t.term === selectedTerm)?.definition || ''} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action / Next Button */}
      <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
        <span className="text-xs text-slate-500 hidden sm:inline">
          Tip: Press <kbd className="px-1.5 py-0.5 rounded bg-white/[0.08] text-slate-300 font-mono text-[11px]">Enter ↵</kbd> to proceed
        </span>
        <button
          onClick={handleFinishPriming}
          className="w-full sm:w-auto px-7 py-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-indigo-600 to-indigo-500 hover:from-emerald-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 group transition-all hover:scale-[1.02] cursor-pointer"
        >
          <span>Ready! Start Practice Questions</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      {/* Cognitive Science Explainer Modal */}
      <ScienceExplainerModal
        isOpen={showScienceModal}
        onClose={() => setShowScienceModal(false)}
        initialTopic="priming"
      />

    </div>
  );
};
