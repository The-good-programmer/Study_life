import React, { useState } from 'react';
import { Zap, HelpCircle, Eye, CheckCircle2, RotateCw } from 'lucide-react';
import type { ConceptCheckpoint, FSRSRating } from '../../types';
import { FSRSService } from '../../services/fsrsService';
import { StorageService } from '../../services/storageService';
import { soundEngine } from '../../services/soundEngine';

interface RetrievalPhaseProps {
  concept: ConceptCheckpoint;
  onComplete: () => void;
}

export const RetrievalPhase: React.FC<RetrievalPhaseProps> = ({ concept, onComplete }) => {
  const cards = concept.retrievalCards || [];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const currentCard = cards[currentIndex];

  if (!currentCard) {
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

  const intervals = FSRSService.previewIntervals(currentCard);

  const handleRate = (rating: FSRSRating) => {
    // Schedule through FSRS algorithm
    const { updatedCard } = FSRSService.schedule(currentCard, rating);
    StorageService.saveCard(updatedCard);

    if (currentIndex + 1 < cards.length) {
      setCurrentIndex(currentIndex + 1);
      setIsAnswerRevealed(false);
      setShowHint(false);
    } else {
      // Completed all cards for this concept!
      soundEngine.playCompletionChime();
      StorageService.recordMasteredConcept();
      onComplete();
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn">
      
      {/* Header */}
      <div className="flex items-center justify-between p-3.5 rounded-xl bg-amber-950/30 border border-amber-900/40">
        <div className="flex items-center gap-2.5 text-xs sm:text-sm text-amber-300">
          <Zap className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong>Phase 3: Active Retrieval Practice</strong> — Test memory before it decays.
          </span>
        </div>
        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-900/60 text-amber-200 border border-amber-700/50">
          Card {currentIndex + 1} of {cards.length}
        </span>
      </div>

      {/* Main Flashcard Container */}
      <div className="min-h-[320px] rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden transition-all">
        
        {/* Question Side */}
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 uppercase tracking-wider font-semibold">
            <span>Retrieval Challenge</span>
            <span>Target: Active Recall</span>
          </div>

          <h3 className="text-lg sm:text-xl font-semibold text-white leading-relaxed">
            {currentCard.question}
          </h3>

          {/* Optional Hint */}
          {currentCard.hint && !isAnswerRevealed && (
            <div>
              <button
                type="button"
                onClick={() => setShowHint(!showHint)}
                className="text-xs text-slate-400 hover:text-amber-400 flex items-center gap-1.5 transition-colors"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                {showHint ? 'Hide Hint' : 'Need a hint?'}
              </button>
              {showHint && (
                <div className="mt-2 p-3 rounded-lg bg-amber-950/20 border border-amber-800/40 text-xs text-amber-200 animate-fadeIn">
                  💡 Hint: {currentCard.hint}
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
              Verified Core Answer
            </div>
            
            <p className="text-base sm:text-lg font-medium text-slate-100 leading-relaxed">
              {currentCard.answer}
            </p>

            {currentCard.explanation && (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 leading-relaxed">
                <span className="font-semibold text-slate-300">Context: </span>
                {currentCard.explanation}
              </div>
            )}
          </div>
        ) : (
          <div className="pt-8 flex justify-center">
            <button
              onClick={() => setIsAnswerRevealed(true)}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm flex items-center justify-center gap-2 border border-slate-700 hover:border-slate-600 shadow-lg transition-all"
            >
              <Eye className="w-4 h-4 text-amber-400" />
              <span>Reveal Target Answer</span>
            </button>
          </div>
        )}

        {/* FSRS Rating Buttons (Visible only once answer is revealed) */}
        {isAnswerRevealed && (
          <div className="mt-8 pt-6 border-t border-slate-800 space-y-3 animate-fadeIn">
            <div className="text-center text-xs text-slate-400 font-medium">
              Rate your recall effort to schedule optimal FSRS spaced intervals:
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              
              {/* Again */}
              <button
                onClick={() => handleRate('again')}
                className="p-3 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 text-rose-200 text-left transition-all group hover:scale-[1.02]"
              >
                <div className="flex items-center justify-between text-xs font-bold text-rose-300 mb-0.5">
                  <span>Again</span>
                  <RotateCw className="w-3 h-3 group-hover:rotate-180 transition-transform" />
                </div>
                <div className="text-[11px] text-rose-400">{intervals.again}</div>
                <div className="text-[10px] text-rose-500/80 mt-1">Struggled/Forgot</div>
              </button>

              {/* Hard */}
              <button
                onClick={() => handleRate('hard')}
                className="p-3 rounded-xl bg-amber-950/40 hover:bg-amber-900/60 border border-amber-800/50 text-amber-200 text-left transition-all hover:scale-[1.02]"
              >
                <div className="text-xs font-bold text-amber-300 mb-0.5">Hard</div>
                <div className="text-[11px] text-amber-400">{intervals.hard}</div>
                <div className="text-[10px] text-amber-500/80 mt-1">Significant effort</div>
              </button>

              {/* Good */}
              <button
                onClick={() => handleRate('good')}
                className="p-3 rounded-xl bg-blue-950/40 hover:bg-blue-900/60 border border-blue-800/50 text-blue-200 text-left transition-all hover:scale-[1.02]"
              >
                <div className="text-xs font-bold text-blue-300 mb-0.5">Good</div>
                <div className="text-[11px] text-blue-400">{intervals.good}</div>
                <div className="text-[10px] text-blue-500/80 mt-1">Recalled correctly</div>
              </button>

              {/* Easy */}
              <button
                onClick={() => handleRate('easy')}
                className="p-3 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-800/50 text-emerald-200 text-left transition-all hover:scale-[1.02]"
              >
                <div className="text-xs font-bold text-emerald-300 mb-0.5">Easy</div>
                <div className="text-[11px] text-emerald-400">{intervals.easy}</div>
                <div className="text-[10px] text-emerald-500/80 mt-1">Instant recall</div>
              </button>

            </div>
          </div>
        )}

      </div>

    </div>
  );
};
