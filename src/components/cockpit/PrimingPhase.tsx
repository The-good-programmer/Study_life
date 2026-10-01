import React, { useState } from 'react';
import { Lightbulb, CheckCircle2, BookOpen, ArrowRight, Eye, Sparkles } from 'lucide-react';
import type { ConceptCheckpoint } from '../../types';

interface PrimingPhaseProps {
  concept: ConceptCheckpoint;
  onComplete: () => void;
}

export const PrimingPhase: React.FC<PrimingPhaseProps> = ({ concept, onComplete }) => {
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn">
      
      {/* Phase Explanation Header */}
      <div className="flex items-center justify-between p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-900/50">
        <div className="flex items-center gap-2.5 text-xs sm:text-sm text-indigo-300">
          <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>
            <strong>Phase 1: Priming & Mental Models</strong> — Pre-wiring your neural circuits before deep engagement.
          </span>
        </div>
        <span className="text-[11px] px-2 py-0.5 rounded bg-indigo-900/60 text-indigo-200 border border-indigo-700/50">
          ~{Math.round(concept.estimatedMinutes * 0.25)} min
        </span>
      </div>

      {/* Mental Model Analogy Card */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 border border-indigo-500/30 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex items-center gap-2 text-indigo-400 font-semibold text-xs tracking-wider uppercase mb-3">
          <Lightbulb className="w-4 h-4" />
          Intuitive Mental Model
        </div>
        
        <p className="text-base sm:text-lg text-slate-100 font-medium leading-relaxed">
          "{concept.mentalModel}"
        </p>
      </div>

      {/* Core Takeaways */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          High-Yield Takeaways
        </div>

        <ul className="space-y-3">
          {concept.coreTakeaways.map((takeaway, idx) => (
            <li key={idx} className="flex items-start gap-3 text-sm text-slate-300">
              <span className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[11px] font-bold text-indigo-400 shrink-0 mt-0.5">
                {idx + 1}
              </span>
              <span className="leading-snug">{takeaway}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Interactive Key Terms */}
      {concept.keyTerms.length > 0 && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <BookOpen className="w-4 h-4 text-amber-400" />
              Key Concepts & Nomenclature
            </div>
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" /> Click term to inspect
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {concept.keyTerms.map((termObj, idx) => {
              const isSelected = selectedTerm === termObj.term;
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedTerm(isSelected ? null : termObj.term)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                      : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60'
                  }`}
                >
                  {termObj.term}
                </button>
              );
            })}
          </div>

          {/* Expanded definition card */}
          {selectedTerm && (
            <div className="p-3.5 rounded-xl bg-slate-950 border border-indigo-900/60 text-xs animate-fadeIn">
              <span className="font-semibold text-indigo-300">{selectedTerm}: </span>
              <span className="text-slate-300">
                {concept.keyTerms.find(t => t.term === selectedTerm)?.definition}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Action / Next Button */}
      <div className="pt-4 flex justify-end">
        <button
          onClick={onComplete}
          className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold text-sm shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 group transition-all"
        >
          <span>Mental Model Primed — Start Feynman Challenge</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

    </div>
  );
};
