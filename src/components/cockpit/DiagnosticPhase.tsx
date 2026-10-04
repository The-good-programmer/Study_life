import React, { useState, useEffect, useCallback } from 'react';
import { 
  ArrowRight, 
  CheckCircle2, 
  XCircle, 
  SkipForward, 
  Zap, 
  BrainCircuit,
  Info
} from 'lucide-react';
import type { StudySession, DiagnosticProbe, DiagnosticReport, RetrievalCard } from '../../types';
import { MathRenderer } from '../common/MathRenderer';
import { soundEngine } from '../../services/soundEngine';
import { StorageService } from '../../services/storageService';

interface DiagnosticPhaseProps {
  session: StudySession;
  onComplete: (report: DiagnosticReport) => void;
  onSkip: () => void;
}

function generateProbes(session: StudySession): DiagnosticProbe[] {
  const allCards: RetrievalCard[] = session.concepts.flatMap(c => c.retrievalCards || []);
  const probes: DiagnosticProbe[] = [];

  session.concepts.forEach(concept => {
    const cards = concept.retrievalCards || [];
    // Prioritize multiple-choice cards if available
    const mcCard = cards.find(c => c.options && c.options.length >= 2);
    if (mcCard && mcCard.options) {
      probes.push({
        conceptId: concept.id,
        conceptTitle: concept.title,
        question: mcCard.question,
        options: mcCard.options,
        correctAnswer: mcCard.answer,
      });
      return;
    }

    // Otherwise find any valid standard card
    const standardCard = cards[0];
    if (standardCard) {
      const distractors = allCards
        .filter(c => c.id !== standardCard.id && c.answer.length < 120)
        .map(c => c.answer)
        .sort(() => 0.5 - Math.random())
        .slice(0, 3);

      const options = [standardCard.answer, ...distractors].sort(() => 0.5 - Math.random());

      probes.push({
        conceptId: concept.id,
        conceptTitle: concept.title,
        question: standardCard.question,
        options: options.length >= 2 ? options : [standardCard.answer, 'Mechanism is not applicable here'],
        correctAnswer: standardCard.answer,
      });
      return;
    }

    // Fallback to key term if no cards exist
    if (concept.keyTerms && concept.keyTerms.length > 0) {
      const targetTerm = concept.keyTerms[0];
      const otherTerms = session.concepts
        .flatMap(c => c.keyTerms || [])
        .filter(t => t.term !== targetTerm.term)
        .map(t => t.definition)
        .slice(0, 3);

      const options = [targetTerm.definition, ...otherTerms].sort(() => 0.5 - Math.random());

      probes.push({
        conceptId: concept.id,
        conceptTitle: concept.title,
        question: `Which statement best describes the fundamental role of "${targetTerm.term}"?`,
        options: options.length >= 2 ? options : [targetTerm.definition, 'An incidental byproduct with no regulatory role'],
        correctAnswer: targetTerm.definition,
      });
    }
  });

  return probes.slice(0, 4); // Max 4 rapid diagnostic probes
}

export const DiagnosticPhase: React.FC<DiagnosticPhaseProps> = ({ session, onComplete, onSkip }) => {
  const [probes] = useState<DiagnosticProbe[]>(() => generateProbes(session));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  const [answers, setAnswers] = useState<Record<number, { userAnswer: string; isCorrect: boolean }>>({});
  const [isFinished, setIsFinished] = useState(false);

  const currentProbe = probes[currentIndex];

  const handleSelectOption = useCallback((option: string) => {
    if (isAnswerRevealed || !currentProbe) return;

    setSelectedOption(option);
    setIsAnswerRevealed(true);

    const cleanOpt = option.replace(/^[a-d1-4][).\s-]+\s*/i, '').trim().toLowerCase();
    const cleanAns = currentProbe.correctAnswer.replace(/^[a-d1-4][).\s-]+\s*/i, '').trim().toLowerCase();
    const isCorrect = cleanOpt === cleanAns || option.trim().toLowerCase() === currentProbe.correctAnswer.trim().toLowerCase();

    if (isCorrect) {
      soundEngine.playCorrectChime();
    } else {
      soundEngine.playIncorrectChime();
    }

    setAnswers(prev => ({
      ...prev,
      [currentIndex]: { userAnswer: option, isCorrect }
    }));
  }, [isAnswerRevealed, currentProbe, currentIndex]);

  const handleNext = useCallback(() => {
    if (currentIndex + 1 < probes.length) {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null);
      setIsAnswerRevealed(false);
    } else {
      setIsFinished(true);
      soundEngine.playSuccess();
      StorageService.addXP(30);
    }
  }, [currentIndex, probes.length]);

  // Keyboard navigation: 1-4 to select options, Space/Enter to advance
  useEffect(() => {
    if (isFinished || !currentProbe) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (!isAnswerRevealed) {
        const digit = parseInt(e.key, 10);
        if (!isNaN(digit) && digit >= 1 && digit <= currentProbe.options.length) {
          e.preventDefault();
          handleSelectOption(currentProbe.options[digit - 1]);
        }
      } else if (e.key === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFinished, isAnswerRevealed, currentProbe, handleSelectOption, handleNext]);

  const handleFinishAndAdvance = () => {
    const totalCorrect = Object.values(answers).filter(a => a.isCorrect).length;
    const scorePercent = Math.round((totalCorrect / probes.length) * 100);

    const report: DiagnosticReport = {
      probes: probes.map((p, idx) => ({
        ...p,
        userAnswer: answers[idx]?.userAnswer,
        isCorrect: answers[idx]?.isCorrect || false,
      })),
      score: scorePercent,
      completedAt: new Date().toISOString(),
    };
    onComplete(report);
  };

  if (probes.length === 0) {
    return (
      <div className="max-w-xl mx-auto p-8 rounded-3xl glass-panel text-center space-y-4 animate-fadeIn">
        <h3 className="text-lg font-bold text-white">Diagnostic Probes Unavailable</h3>
        <p className="text-xs text-slate-400">This deck has no questions to probe. Proceeding straight to Priming.</p>
        <button onClick={onSkip} className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold">
          Start Priming
        </button>
      </div>
    );
  }

  // Summary Debrief Screen
  if (isFinished) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 text-center animate-fadeIn py-4">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center mx-auto text-white shadow-xl shadow-cyan-500/20">
          <BrainCircuit className="w-8 h-8" />
        </div>

        <div className="space-y-1.5">
          <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-400 font-bold px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30">
            Phase 0 Diagnostic Complete
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white font-display">
            Neural Attention Schemas Activated
          </h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            By attempting these questions prior to studying, your brain has established semantic anchors that increase encoding efficiency by up to 40%.
          </p>
        </div>

        {/* Diagnostic Results Breakdown */}
        <div className="space-y-3 text-left">
          {probes.map((probe, idx) => {
            const result = answers[idx];
            const isCorrect = result?.isCorrect;

            return (
              <div 
                key={probe.conceptId}
                className={`p-4 rounded-2xl border transition-all ${
                  isCorrect
                    ? 'bg-emerald-950/20 border-emerald-500/30'
                    : 'bg-amber-950/25 border-amber-500/35'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {isCorrect ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                    )}
                    <span className="font-bold text-white text-xs font-display">
                      {probe.conceptTitle}
                    </span>
                  </div>
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                    isCorrect
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  }`}>
                    {isCorrect ? 'Prior Schema Active' : '⚡ Prime Focus Target'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1 pl-6">
                  {isCorrect ? (
                    <span>You already possess baseline familiarity with this mechanism. Focus on edge cases.</span>
                  ) : (
                    <span>Attention Anchor: Watch closely for the causal mechanism in Phase 1 (Priming) and Phase 2 (Feynman).</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-center pt-2">
          <button
            onClick={handleFinishAndAdvance}
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-cyan-600 via-indigo-600 to-purple-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-cyan-600/25 flex items-center justify-center gap-2 group transition-all hover:scale-105 cursor-pointer"
          >
            <span>Proceed to Phase 1: Priming & Mental Models</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    );
  }

  // Active Quiz View
  return (
    <div className="max-w-2xl mx-auto space-y-5 animate-fadeIn py-2 text-slate-100">
      
      {/* Top Banner */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-cyan-950/40 border border-cyan-500/25 backdrop-blur-md">
        <div className="flex items-center gap-3 text-xs sm:text-sm text-cyan-300">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-white font-display flex items-center gap-2">
              <span>Phase 0: Pre-Flight Diagnostic Probe</span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                Pre-Testing Effect
              </span>
            </div>
            <div className="text-[11px] text-cyan-300/80">
              Richland et al. (2009): Attempting questions before studying boosts subsequent encoding by 40%.
            </div>
          </div>
        </div>

        <button
          onClick={onSkip}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-xl hover:bg-white/[0.08] transition-colors cursor-pointer shrink-0 font-medium"
          title="Skip pre-flight diagnostic and jump directly to Priming"
        >
          <span>Skip</span>
          <SkipForward className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Diagnostic Card */}
      <div className="p-6 sm:p-8 rounded-3xl glass-panel space-y-6">
        <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
          <span className="text-cyan-400 font-bold uppercase tracking-wider">
            Targeting Checkpoint: {currentProbe.conceptTitle}
          </span>
          <span>
            Probe {currentIndex + 1} of {probes.length}
          </span>
        </div>

        <h3 className="text-base sm:text-lg font-bold text-white leading-relaxed font-display">
          <MathRenderer text={currentProbe.question} />
        </h3>

        {/* Options Grid */}
        <div className="space-y-2.5">
          {currentProbe.options.map((option, idx) => {
            const isSelected = selectedOption === option;
            const isCorrectOption = option.trim().toLowerCase() === currentProbe.correctAnswer.trim().toLowerCase();

            let optionStyle = 'bg-slate-950/60 border-white/[0.08] hover:border-cyan-500/40 text-slate-200 hover:bg-slate-900/80';
            if (isAnswerRevealed) {
              if (isCorrectOption) {
                optionStyle = 'bg-emerald-950/60 border-emerald-500 text-emerald-200 font-semibold shadow-lg shadow-emerald-500/10';
              } else if (isSelected) {
                optionStyle = 'bg-rose-950/60 border-rose-500 text-rose-200';
              } else {
                optionStyle = 'bg-slate-950/40 border-white/[0.04] text-slate-500 opacity-60';
              }
            }

            return (
              <button
                key={idx}
                disabled={isAnswerRevealed}
                onClick={() => handleSelectOption(option)}
                className={`w-full p-4 rounded-2xl border text-left text-xs sm:text-sm transition-all flex items-center justify-between gap-3 cursor-pointer ${optionStyle}`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-lg bg-white/[0.08] text-slate-400 flex items-center justify-center font-mono text-[11px] shrink-0 font-bold">
                    {idx + 1}
                  </span>
                  <span><MathRenderer text={option} /></span>
                </div>

                {isAnswerRevealed && (
                  <div className="shrink-0">
                    {isCorrectOption ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : isSelected ? (
                      <XCircle className="w-4 h-4 text-rose-400" />
                    ) : null}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Post-Choice Action Area */}
        {isAnswerRevealed && (
          <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between animate-fadeIn">
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-cyan-400" />
              <span>
                {answers[currentIndex]?.isCorrect
                  ? 'Strong intuitive schema. You will validate this in Priming.'
                  : 'Gap registered. Your attention will latch onto this in Priming.'}
              </span>
            </div>

            <button
              onClick={handleNext}
              className="px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-cyan-600/30 cursor-pointer"
            >
              <span>{currentIndex + 1 < probes.length ? 'Next Probe' : 'View Attention Map'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

    </div>
  );
};
