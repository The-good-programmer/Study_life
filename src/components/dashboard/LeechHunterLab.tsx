import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Check, 
  Split, 
  RotateCw, 
  ArrowLeft, 
  Wand2, 
  CheckCircle2,
  Bug
} from 'lucide-react';
import type { LeechAnalysis, MnemonicRewiringOption, RetrievalCard } from '../../types';
import { FSRSService } from '../../services/fsrsService';
import { StorageService } from '../../services/storageService';
import { AIService } from '../../services/aiService';
import { soundEngine } from '../../services/soundEngine';
import { MathRenderer } from '../common/MathRenderer';

interface LeechHunterLabProps {
  onBack: () => void;
  onCardCured?: () => void;
}

export const LeechHunterLab: React.FC<LeechHunterLabProps> = ({ onBack, onCardCured }) => {
  const [allCards, setAllCards] = useState<RetrievalCard[]>(() => StorageService.getAllCards());
  const [selectedCardId, setSelectedCardId] = useState<string | null>(() => {
    const initialCards = StorageService.getAllCards();
    const initialLeeches = FSRSService.findLeeches(initialCards);
    return initialLeeches[0]?.id || null;
  });
  const [analysis, setAnalysis] = useState<LeechAnalysis | null>(null);
  const [curedNotice, setCuredNotice] = useState<string | null>(null);

  // Compute leeches based on FSRS lapse / difficulty criteria
  const leeches = FSRSService.findLeeches(allCards);
  const selectedCard = leeches.find(c => c.id === selectedCardId) || leeches[0] || null;

  // Purely derived analyzing state avoids cascading effect renders
  const isAnalyzing = Boolean(selectedCard && (!analysis || analysis.cardId !== selectedCard.id));

  // Run diagnosis whenever selected card changes
  useEffect(() => {
    if (!selectedCard) return;

    let isMounted = true;
    AIService.diagnoseAndRewireLeech(selectedCard)
      .then(res => {
        if (isMounted) {
          setAnalysis(res);
        }
      })
      .catch(err => {
        console.error('Leech diagnosis failed:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedCard]);

  // Apply Mnemonic Anchor (Strategy 1 or 2)
  const handleApplyMnemonic = (option: MnemonicRewiringOption) => {
    if (!selectedCard) return;

    const curedCard = FSRSService.rewireCard(selectedCard, `${option.strategyTitle}: ${option.mnemonicText}`);
    StorageService.saveCard(curedCard);

    // Refresh cards
    const updatedCards = StorageService.getAllCards();
    setAllCards(updatedCards);
    StorageService.addXP(40);
    soundEngine.playCompletionChime();

    setCuredNotice(`Cured! Mnemonic anchor attached. Synaptic stability restored.`);
    setTimeout(() => setCuredNotice(null), 3500);

    if (onCardCured) onCardCured();
  };

  // Decompose into Atomic Cloze Cards (Strategy 3)
  const handleDecomposeAtomic = (option: MnemonicRewiringOption) => {
    if (!selectedCard || !option.atomicCards || option.atomicCards.length === 0) return;

    // Create new atomic cards
    const newCards: RetrievalCard[] = option.atomicCards.map((ac, idx) => ({
      id: `atomic-${Date.now()}-${idx}`,
      conceptId: selectedCard.conceptId,
      cardType: 'cloze',
      question: ac.question,
      answer: ac.answer,
      clozeTemplate: ac.clozeTemplate,
      stability: 3.0,
      difficulty: 4.0,
      reps: 0,
      lapses: 0,
      hint: `Derived from atomic decomposition of complex concept.`,
    }));

    // Permanently remove original leech card and persist new atomic cards
    StorageService.deleteCard(selectedCard.id);
    StorageService.saveCards(newCards);
    const updatedCards = StorageService.getAllCards();
    setAllCards(updatedCards);

    StorageService.addXP(60);
    soundEngine.playCompletionChime();

    setCuredNotice(`Decomposed into ${newCards.length} atomic cloze cards! Minimum Information Principle applied.`);
    setTimeout(() => setCuredNotice(null), 3500);

    if (onCardCured) onCardCured();
  };

  // Simulate High-Yield Leech Bottleneck for demo/testing
  const handleSimulateLeech = () => {
    const testLeech: RetrievalCard = {
      id: `sim-leech-${Date.now()}`,
      conceptId: 'sim-concept',
      cardType: 'standard',
      question: 'Which arteriole carries blood into the renal glomerulus, and which one carries blood away?',
      answer: 'Afferent arteriole carries blood in; Efferent arteriole carries blood out.',
      explanation: 'Afferent arrives (A = Arrive), Efferent exits (E = Exit). Pressure gradient regulates glomerular filtration rate.',
      stability: 0.9,
      difficulty: 8.8,
      reps: 7,
      lapses: 5,
    };

    StorageService.saveCard(testLeech);
    const updated = StorageService.getAllCards();
    setAllCards(updated);
    setSelectedCardId(testLeech.id);
    soundEngine.playSocraticChallengeChime();
    setCuredNotice('Simulated high-lapse renal physiology leech generated!');
    setTimeout(() => setCuredNotice(null), 3000);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-4 animate-fadeIn">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/[0.08] transition-all"
            title="Return to Retention Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight font-display">
                FSRS Leech Hunter & Mnemonic Rewiring Lab
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-mono uppercase font-bold">
                Synaptic Bottlenecks
              </span>
            </div>
            <p className="text-xs text-slate-400 font-sans">
              Algorithmic diagnosis of chronic card failure (SuperMemo / FSRS Leech Theory).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {leeches.length === 0 && (
            <button
              onClick={handleSimulateLeech}
              className="px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
              title="Generate a sample medical leech card to test the rewiring lab"
            >
              <Bug className="w-3.5 h-3.5" />
              <span>Simulate Sample Leech</span>
            </button>
          )}

          <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-white/[0.08] text-xs font-mono font-bold text-slate-300">
            {leeches.length} {leeches.length === 1 ? 'Leech' : 'Leeches'} Detected
          </div>
        </div>
      </div>

      {/* Cured Notice Alert */}
      {curedNotice && (
        <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fadeIn shadow-lg shadow-emerald-900/20">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{curedNotice}</span>
        </div>
      )}

      {/* Main Grid: Leech Queue & Rewiring Studio */}
      {leeches.length === 0 ? (
        <div className="p-10 text-center rounded-3xl glass-panel space-y-4 max-w-lg mx-auto border border-emerald-500/20">
          <div className="relative w-20 h-20 mx-auto">
            <div className="absolute -inset-2 rounded-3xl bg-emerald-500/20 blur-md animate-pulse" />
            <div className="relative w-full h-full rounded-2xl overflow-hidden border border-emerald-500/30 p-0.5 bg-slate-950">
              <img src="/lottie.png" alt="Lottie Detective" className="w-full h-full object-cover rounded-[14px]" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white font-display">
              Zero Synaptic Leeches Detected!
            </h3>
            <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
              Lottie inspected your memory stability graph. Every flashcard demonstrates healthy retention—no memory bottlenecks!
            </p>
          </div>
          <button
            onClick={handleSimulateLeech}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-600/30 transition-all hover:scale-105 cursor-pointer"
          >
            Spawn Sample High-Yield Leech to Test Rewiring
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Leech Roster */}
          <div className="lg:col-span-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider font-display px-1">
              <span>Unstable Flashcards</span>
              <span className="text-[10px] font-mono text-rose-400 font-bold">{leeches.length} Critical</span>
            </div>

            <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
              {leeches.map((card) => {
                const isSelected = card.id === selectedCard?.id;
                return (
                  <div
                    key={card.id}
                    onClick={() => {
                      if (card.id !== selectedCardId) {
                        setSelectedCardId(card.id);
                        setAnalysis(null);
                      }
                    }}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-2 text-left ${
                      isSelected
                        ? 'bg-rose-950/40 border-rose-500/60 shadow-xl shadow-rose-950/30 ring-2 ring-rose-500/20'
                        : 'bg-slate-900/70 border-white/[0.08] hover:border-white/[0.2] hover:bg-slate-850'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-rose-400 font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {card.lapses} Lapses
                      </span>
                      <span className="text-slate-400">
                        Stab: {card.stability}d
                      </span>
                    </div>

                    <div className="text-xs text-white font-medium line-clamp-2 leading-snug">
                      <MathRenderer text={card.question} />
                    </div>

                    <div className="text-[11px] text-slate-400 truncate">
                      Ans: <span className="text-slate-300 font-semibold">{card.answer}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Diagnostic Autopsy & Mnemonic Rewiring Studio */}
          <div className="lg:col-span-8 space-y-5">
            {selectedCard && (
              <div className="p-6 sm:p-7 rounded-3xl glass-panel space-y-6 border-rose-500/30">
                
                {/* Selected Card Overview */}
                <div className="space-y-2 pb-5 border-b border-white/[0.08]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-rose-300 font-bold bg-rose-500/20 px-2.5 py-0.5 rounded-full border border-rose-500/30">
                      Cognitive Autopsy in Progress
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      Difficulty: {selectedCard.difficulty}/10 • Reps: {selectedCard.reps}
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg font-bold text-white leading-relaxed font-display">
                    <MathRenderer text={selectedCard.question} />
                  </h3>

                  <div className="p-3 rounded-xl bg-slate-950/70 border border-white/[0.06] text-xs text-slate-300 flex items-start gap-2">
                    <span className="text-emerald-400 font-bold font-mono shrink-0">Answer:</span>
                    <span><MathRenderer text={selectedCard.answer} /></span>
                  </div>
                </div>

                {/* Cognitive Diagnosis */}
                {isAnalyzing ? (
                  <div className="p-8 text-center space-y-3">
                    <RotateCw className="w-6 h-6 animate-spin text-purple-400 mx-auto" />
                    <p className="text-xs text-slate-400 font-mono">
                      Running root-cause cognitive diagnostic & generating sensory mnemonics...
                    </p>
                  </div>
                ) : analysis ? (
                  <div className="space-y-5 animate-fadeIn">
                    
                    {/* Root Cause Banner */}
                    <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/30 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-300 font-display flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                          <span>Diagnosis: {analysis.diagnosisTitle}</span>
                        </span>
                        <span className="text-[10px] font-mono text-amber-400 uppercase font-bold">
                          {analysis.rootCause}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed font-sans">
                        {analysis.diagnosticExplanation}
                      </p>
                    </div>

                    {/* Rewiring Solutions Header */}
                    <div className="flex items-center gap-2 pt-1">
                      <Wand2 className="w-4 h-4 text-indigo-400" />
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider font-display">
                        Cognitive Rewiring Remedies
                      </h4>
                    </div>

                    {/* 3 Remedy Options */}
                    <div className="grid grid-cols-1 gap-4">
                      {analysis.rewiringOptions.map((opt) => (
                        <div
                          key={opt.id}
                          className="p-5 rounded-2xl bg-slate-900/80 border border-white/[0.08] hover:border-indigo-500/40 transition-all space-y-3"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-white/[0.06]">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white font-display">
                                {opt.strategyTitle}
                              </span>
                              <span className="text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                {opt.badge}
                              </span>
                            </div>

                            {opt.strategy === 'atomic-split' ? (
                              <button
                                onClick={() => handleDecomposeAtomic(opt)}
                                className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-purple-600/25 shrink-0 self-start sm:self-auto"
                              >
                                <Split className="w-3.5 h-3.5" />
                                <span>Decompose into 2 Cards (+60 XP)</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleApplyMnemonic(opt)}
                                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/25 shrink-0 self-start sm:self-auto"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Apply Mnemonic Cure (+40 XP)</span>
                              </button>
                            )}
                          </div>

                          {/* Mnemonic Details */}
                          <div className="space-y-2 text-xs">
                            <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-indigo-200 font-sans leading-relaxed">
                              <strong className="text-indigo-300 block mb-0.5 font-display">Anchor:</strong>
                              {opt.mnemonicText}
                            </div>

                            <div className="text-slate-400 italic">
                              <strong className="text-slate-300 not-italic">Visual Imagery:</strong> "{opt.visualImagery}"
                            </div>

                            {/* Preview Atomic Cards if strategy is atomic-split */}
                            {opt.atomicCards && opt.atomicCards.length > 0 && (
                              <div className="space-y-1.5 pt-2">
                                <span className="text-[11px] font-bold text-purple-300 uppercase tracking-wide block">
                                  Atomic Decomposition Preview:
                                </span>
                                {opt.atomicCards.map((ac, idx) => (
                                  <div key={idx} className="p-2.5 rounded-xl bg-slate-950/70 border border-white/[0.06] text-[11px] space-y-0.5">
                                    <div className="text-slate-200 font-medium">Card {idx + 1}: {ac.question}</div>
                                    <div className="text-emerald-400 font-mono">Answer: {ac.answer}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                  </div>
                ) : null}

              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
};
