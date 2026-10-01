import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Zap, HelpCircle, Eye, CheckCircle2, RotateCw, Timer, Sparkles, Brain, ArrowRight } from 'lucide-react';
import type { ConceptCheckpoint, FSRSRating } from '../../types';
import { FSRSService } from '../../services/fsrsService';
import { StorageService } from '../../services/storageService';
import { soundEngine } from '../../services/soundEngine';
import { MathRenderer } from '../common/MathRenderer';

interface RetrievalPhaseProps {
  concept: ConceptCheckpoint;
  onComplete: () => void;
}

export const RetrievalPhase: React.FC<RetrievalPhaseProps> = ({ concept, onComplete }) => {
  const cards = concept.retrievalCards || [];
  const [activeTab, setActiveTab] = useState<'cards' | 'blurting'>('cards');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  const [showHint, setShowHint] = useState(false);

  // 60-Second Blurting Method State
  const [blurtingText, setBlurtingText] = useState('');
  const [blurtingSeconds, setBlurtingSeconds] = useState(60);
  const [isBlurtingRunning, setIsBlurtingRunning] = useState(false);
  const [blurtingResult, setBlurtingResult] = useState<{ recalled: string[]; missed: string[] } | null>(null);

  const currentCard = cards[currentIndex];

  const handleRate = useCallback((rating: FSRSRating) => {
    if (!currentCard) return;

    // Schedule through FSRS algorithm
    const { updatedCard } = FSRSService.schedule(currentCard, rating);
    StorageService.saveCard(updatedCard);

    // Reward XP for retrieval practice
    const xpGained = rating === 'easy' ? 15 : 10;
    StorageService.addXP(xpGained);

    if (currentIndex + 1 < cards.length) {
      setCurrentIndex(prev => prev + 1);
      setIsAnswerRevealed(false);
      setShowHint(false);
    } else {
      // Completed all cards for this concept!
      soundEngine.playCompletionChime();
      StorageService.recordMasteredConcept();
      onComplete();
    }
  }, [currentCard, currentIndex, cards.length, onComplete]);

  // Global Keyboard Shortcuts (Space to flip, 1-4 to rate)
  useEffect(() => {
    if (activeTab !== 'cards') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        setIsAnswerRevealed(prev => !prev);
      } else if (isAnswerRevealed) {
        if (e.key === '1') {
          e.preventDefault();
          handleRate('again');
        } else if (e.key === '2') {
          e.preventDefault();
          handleRate('hard');
        } else if (e.key === '3') {
          e.preventDefault();
          handleRate('good');
        } else if (e.key === '4') {
          e.preventDefault();
          handleRate('easy');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, isAnswerRevealed, handleRate]);

  const handleEvaluateBlurting = useCallback(() => {
    setIsBlurtingRunning(false);
    const lower = blurtingText.toLowerCase();

    const recalledTerms = concept.keyTerms
      .filter(k => lower.includes(k.term.toLowerCase()))
      .map(k => k.term);

    const missedTerms = concept.keyTerms
      .filter(k => !lower.includes(k.term.toLowerCase()))
      .map(k => k.term);

    setBlurtingResult({
      recalled: recalledTerms,
      missed: missedTerms,
    });

    soundEngine.playCompletionChime();
    StorageService.addXP(40); // Bonus +40 XP for active blurting
  }, [blurtingText, concept.keyTerms]);

  const evaluateRef = useRef(handleEvaluateBlurting);
  useEffect(() => {
    evaluateRef.current = handleEvaluateBlurting;
  }, [handleEvaluateBlurting]);

  const handleStartBlurting = () => {
    setIsBlurtingRunning(true);
    setBlurtingSeconds(60);
    setBlurtingResult(null);
  };

  // Blurting Countdown Timer
  useEffect(() => {
    if (!isBlurtingRunning) return;

    const timer = setInterval(() => {
      setBlurtingSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          evaluateRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [isBlurtingRunning]);

  if (!currentCard && activeTab === 'cards') {
    return (
      <div className="p-8 text-center text-slate-300">
        <p>No retrieval cards found for this concept.</p>
        <button
          onClick={onComplete}
          className="mt-4 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-medium"
        >
          Continue
        </button>
      </div>
    );
  }

  const intervals = currentCard ? FSRSService.previewIntervals(currentCard) : null;

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn">
      
      {/* Header & Mode Switcher */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-xl bg-amber-950/30 border border-amber-900/40">
        <div className="flex items-center gap-2.5 text-xs sm:text-sm text-amber-300">
          <Zap className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong>Phase 3: Active Retrieval Practice</strong> — The Testing Effect in action.
          </span>
        </div>

        {/* Mode Toggle: Flashcards vs Blurting */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('cards')}
            className={`px-3 py-1 rounded-md font-medium transition-all ${
              activeTab === 'cards'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            FSRS Flashcards
          </button>
          <button
            onClick={() => setActiveTab('blurting')}
            className={`px-3 py-1 rounded-md font-medium transition-all flex items-center gap-1 ${
              activeTab === 'blurting'
                ? 'bg-amber-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            <span>Blurting Mode</span>
          </button>
        </div>
      </div>

      {/* MODE 1: Flashcards */}
      {activeTab === 'cards' && currentCard && intervals && (
        <div 
          onClick={() => !isAnswerRevealed && setIsAnswerRevealed(true)}
          className={`min-h-[340px] rounded-3xl bg-slate-900 border shadow-2xl p-6 sm:p-8 flex flex-col justify-between transition-all duration-300 ${
            isAnswerRevealed 
              ? 'border-indigo-500/40 shadow-indigo-500/10' 
              : 'border-slate-800 hover:border-slate-700 cursor-pointer'
          }`}
        >
          {/* Question Side */}
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-400 uppercase tracking-wider font-semibold">
              <span>Card {currentIndex + 1} of {cards.length}</span>
              <span className="text-[11px] font-mono text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-900/60">
                {isAnswerRevealed ? 'Revealed' : 'Click or Press Space'}
              </span>
            </div>

            <h3 className="text-lg sm:text-xl font-semibold text-white leading-relaxed">
              <MathRenderer text={currentCard.question} />
            </h3>

            {/* Optional Hint */}
            {currentCard.hint && !isAnswerRevealed && (
              <div onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => setShowHint(!showHint)}
                  className="text-xs text-slate-400 hover:text-amber-400 flex items-center gap-1.5 transition-colors"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  {showHint ? 'Hide Hint' : 'Need a hint?'}
                </button>
                {showHint && (
                  <div className="mt-2 p-3 rounded-xl bg-amber-950/20 border border-amber-800/40 text-xs text-amber-200 animate-fadeIn">
                    💡 Hint: <MathRenderer text={currentCard.hint} />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Answer Revealed Section */}
          {isAnswerRevealed ? (
            <div className="mt-6 pt-6 border-t border-slate-800 space-y-4 animate-fadeIn">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4" />
                Verified Target Answer
              </div>
              
              <div className="text-base sm:text-lg font-medium text-slate-100 leading-relaxed">
                <MathRenderer text={currentCard.answer} />
              </div>

              {currentCard.explanation && (
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 leading-relaxed">
                  <span className="font-semibold text-slate-300">Scientific Context: </span>
                  <MathRenderer text={currentCard.explanation} />
                </div>
              )}
            </div>
          ) : (
            <div className="pt-8 flex flex-col items-center justify-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsAnswerRevealed(true);
                }}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm flex items-center justify-center gap-2.5 border border-slate-700 hover:border-slate-600 shadow-lg transition-all"
              >
                <Eye className="w-4 h-4 text-amber-400" />
                <span>Reveal Target Answer</span>
                <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] bg-slate-900 border border-slate-700 rounded text-slate-400">
                  Space
                </kbd>
              </button>
              <span className="text-[11px] text-slate-500">Tap card or press Space bar to flip</span>
            </div>
          )}

          {/* FSRS Rating Buttons */}
          {isAnswerRevealed && (
            <div 
              onClick={(e) => e.stopPropagation()} 
              className="mt-8 pt-6 border-t border-slate-800 space-y-3 animate-fadeIn"
            >
              <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                <span>Rate recall effort (feeds FSRS algorithm):</span>
                <span className="text-[11px] text-slate-500 hidden sm:inline">Press 1, 2, 3, or 4</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                
                {/* Again [1] */}
                <button
                  onClick={() => handleRate('again')}
                  className="p-3 rounded-2xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 text-rose-200 text-left transition-all group hover:scale-[1.02]"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-rose-300 mb-0.5">
                    <div className="flex items-center gap-1.5">
                      <span>Again</span>
                      <kbd className="px-1 py-0.2 text-[9px] bg-rose-900/80 rounded border border-rose-700 text-rose-300 font-mono">
                        1
                      </kbd>
                    </div>
                    <RotateCw className="w-3 h-3 group-hover:rotate-180 transition-transform" />
                  </div>
                  <div className="text-[11px] text-rose-400">{intervals.again}</div>
                  <div className="text-[10px] text-rose-500/80 mt-1">Struggled / Forgot</div>
                </button>

                {/* Hard [2] */}
                <button
                  onClick={() => handleRate('hard')}
                  className="p-3 rounded-2xl bg-amber-950/40 hover:bg-amber-900/60 border border-amber-800/50 text-amber-200 text-left transition-all hover:scale-[1.02]"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-amber-300 mb-0.5">
                    <span>Hard</span>
                    <kbd className="px-1 py-0.2 text-[9px] bg-amber-900/80 rounded border border-amber-700 text-amber-300 font-mono">
                      2
                    </kbd>
                  </div>
                  <div className="text-[11px] text-amber-400">{intervals.hard}</div>
                  <div className="text-[10px] text-amber-500/80 mt-1">Heavy effort</div>
                </button>

                {/* Good [3] */}
                <button
                  onClick={() => handleRate('good')}
                  className="p-3 rounded-2xl bg-blue-950/40 hover:bg-blue-900/60 border border-blue-800/50 text-blue-200 text-left transition-all hover:scale-[1.02]"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-blue-300 mb-0.5">
                    <span>Good</span>
                    <kbd className="px-1 py-0.2 text-[9px] bg-blue-900/80 rounded border border-blue-700 text-blue-300 font-mono">
                      3
                    </kbd>
                  </div>
                  <div className="text-[11px] text-blue-400">{intervals.good}</div>
                  <div className="text-[10px] text-blue-500/80 mt-1">Normal recall</div>
                </button>

                {/* Easy [4] */}
                <button
                  onClick={() => handleRate('easy')}
                  className="p-3 rounded-2xl bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-800/50 text-emerald-200 text-left transition-all hover:scale-[1.02]"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-300 mb-0.5">
                    <span>Easy</span>
                    <kbd className="px-1 py-0.2 text-[9px] bg-emerald-900/80 rounded border border-emerald-700 text-emerald-300 font-mono">
                      4
                    </kbd>
                  </div>
                  <div className="text-[11px] text-emerald-400">{intervals.easy}</div>
                  <div className="text-[10px] text-emerald-500/80 mt-1">Instant recall</div>
                </button>

              </div>
            </div>
          )}

        </div>
      )}

      {/* MODE 2: The 60-Second Blurting Method */}
      {activeTab === 'blurting' && (
        <div className="p-6 sm:p-8 rounded-3xl bg-slate-900 border border-amber-500/30 shadow-2xl space-y-6 animate-fadeIn">
          
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Brain className="w-5 h-5 text-amber-400" />
                <span>The 60-Second Blurting Method</span>
              </h3>
              <p className="text-xs text-slate-400">
                Speed brain-dump: Write every single keyword, formula, and mechanism you remember.
              </p>
            </div>

            {/* Timer countdown badge */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-amber-400 font-mono text-sm font-bold">
              <Timer className="w-4 h-4" />
              <span>{blurtingSeconds}s</span>
            </div>
          </div>

          {!blurtingResult ? (
            <div className="space-y-4">
              <textarea
                rows={6}
                value={blurtingText}
                onChange={(e) => setBlurtingText(e.target.value)}
                placeholder={isBlurtingRunning ? "Type fast! Brain-dump everything you recall about this concept..." : "Click 'Start 60s Blurting' to begin the countdown..."}
                disabled={!isBlurtingRunning}
                className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-700 focus:border-amber-500 text-white text-sm outline-none resize-none placeholder:text-slate-500 transition-all leading-relaxed"
              />

              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500">
                  {blurtingText.trim().split(/\s+/).filter(Boolean).length} words dumped
                </span>

                {!isBlurtingRunning ? (
                  <button
                    onClick={handleStartBlurting}
                    className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-amber-600/20 transition-all"
                  >
                    <Timer className="w-4 h-4" />
                    <span>Start 60s Blurting Challenge (+40 XP)</span>
                  </button>
                ) : (
                  <button
                    onClick={handleEvaluateBlurting}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-2 transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Done! Evaluate Blurting Now</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Blurting Results Analysis */
            <div className="space-y-5 animate-fadeIn">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="text-xs font-semibold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>Active Blurting Breakdown (+40 XP Awarded!)</span>
                  </div>
                  <span className="text-xs font-bold text-emerald-400">
                    {blurtingResult.recalled.length} / {concept.keyTerms.length} Key Terms Recalled
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  {/* Recalled */}
                  <div className="space-y-2">
                    <span className="font-semibold text-emerald-400 uppercase tracking-wide text-[11px] block">
                      Recalled From Memory
                    </span>
                    {blurtingResult.recalled.length === 0 ? (
                      <p className="text-slate-500 italic">No specific terminology was recognized in your dump.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {blurtingResult.recalled.map((t, idx) => (
                          <span key={idx} className="px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 font-medium">
                            ✓ {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Missed */}
                  <div className="space-y-2">
                    <span className="font-semibold text-amber-400 uppercase tracking-wide text-[11px] block">
                      Omitted / Faded Nuances
                    </span>
                    {blurtingResult.missed.length === 0 ? (
                      <p className="text-emerald-400 font-medium">Flawless recall! You captured all key concepts.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {blurtingResult.missed.map((t, idx) => (
                          <span key={idx} className="px-2.5 py-1 rounded-lg bg-amber-950/40 border border-amber-800/40 text-amber-300 font-medium">
                            ⚠ {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setBlurtingText('');
                    setBlurtingResult(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
                >
                  Retry Blurting
                </button>
                <button
                  onClick={() => setActiveTab('cards')}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/25 transition-all"
                >
                  <span>Proceed to FSRS Flashcards</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
};
