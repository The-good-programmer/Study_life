import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Shuffle, 
  ArrowLeft, 
  RotateCw, 
  Brain, 
  Award, 
  CheckCircle2, 
  Sliders, 
  Flame, 
  BarChart3, 
  Timer,
  BookMarked,
  Zap,
  HelpCircle
} from 'lucide-react';
import type { 
  StudySession, 
  InterleavedCard, 
  InterleavingStrategy, 
  InterleavingSessionReport 
} from '../../types';
import { StorageService } from '../../services/storageService';
import { DEMO_STUDY_SESSIONS } from '../../data/demoDecks';
import { CURATED_STARTER_DECKS } from '../../data/curatedStarterCatalog';
import { FSRSService } from '../../services/fsrsService';
import { soundEngine } from '../../services/soundEngine';
import { lifeSimService } from '../../services/lifeSimService';
import { MathRenderer } from '../common/MathRenderer';
import { shuffle } from '../../utils/shuffle';

interface InterleavingArenaProps {
  onBack: () => void;
  onSessionComplete?: (report: InterleavingSessionReport) => void;
}

const DOMAIN_STYLES: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  'Neuroscience': { 
    bg: 'bg-purple-950/60', 
    text: 'text-purple-300', 
    border: 'border-purple-500/50', 
    glow: 'shadow-purple-500/20' 
  },
  'Physics': { 
    bg: 'bg-sky-950/60', 
    text: 'text-sky-300', 
    border: 'border-sky-500/50', 
    glow: 'shadow-sky-500/20' 
  },
  'Biochemistry': { 
    bg: 'bg-emerald-950/60', 
    text: 'text-emerald-300', 
    border: 'border-emerald-500/50', 
    glow: 'shadow-emerald-500/20' 
  },
  'Physiology': { 
    bg: 'bg-rose-950/60', 
    text: 'text-rose-300', 
    border: 'border-rose-500/50', 
    glow: 'shadow-rose-500/20' 
  },
  'Computer Science': { 
    bg: 'bg-amber-950/60', 
    text: 'text-amber-300', 
    border: 'border-amber-500/50', 
    glow: 'shadow-amber-500/20' 
  },
  'Economics': { 
    bg: 'bg-teal-950/60', 
    text: 'text-teal-300', 
    border: 'border-teal-500/50', 
    glow: 'shadow-teal-500/20' 
  },
};

const DEFAULT_STYLE = { 
  bg: 'bg-indigo-950/60', 
  text: 'text-indigo-300', 
  border: 'border-indigo-500/50', 
  glow: 'shadow-indigo-500/20' 
};

export const InterleavingArena: React.FC<InterleavingArenaProps> = ({ onBack, onSessionComplete }) => {
  // Aggregate available decks (user saved, curated starter catalog, demo decks)
  const availableDecks = useMemo(() => {
    const userDecks = StorageService.getSessions();
    const combined: StudySession[] = [...userDecks];
    CURATED_STARTER_DECKS.forEach(curated => {
      if (!combined.some(d => d.id === curated.id || d.title === curated.title)) {
        combined.push(curated.session);
      }
    });
    DEMO_STUDY_SESSIONS.forEach(demo => {
      if (!combined.some(d => d.id === demo.id || d.title === demo.title)) {
        combined.push(demo);
      }
    });
    return combined;
  }, []);

  // Setup state
  const [selectedDeckIds, setSelectedDeckIds] = useState<string[]>(() => {
    // Default to first 3 decks to provide multi-domain contrast
    return availableDecks.slice(0, 3).map(d => d.id);
  });
  const [sessionCardCount, setSessionCardCount] = useState<number>(15);
  const [strategy, setStrategy] = useState<InterleavingStrategy>('cognitive-entropy');
  const [arenaPhase, setArenaPhase] = useState<'setup' | 'playing' | 'scorecard'>('setup');

  // Active workout state
  const [interleavedDeck, setInterleavedDeck] = useState<InterleavedCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isRevealed, setIsRevealed] = useState<boolean>(false);
  const [showHint, setShowHint] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [contextShiftStreak, setContextShiftStreak] = useState<number>(0);

  // Performance tracking
  interface TrialResult {
    card: InterleavedCard;
    isShift: boolean;
    rating: 'again' | 'hard' | 'good' | 'easy';
    isCorrect: boolean;
    latencySeconds: number;
  }
  const [results, setResults] = useState<TrialResult[]>([]);
  const [finalReport, setFinalReport] = useState<InterleavingSessionReport | null>(null);

  // Live timer tick during card presentation
  useEffect(() => {
    if (arenaPhase !== 'playing') return;
    const interval = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [arenaPhase, currentIndex]);

  // Generate interleaved card sequence
  const generateInterleavedCards = useCallback((
    deckIds: string[], 
    count: number, 
    strat: InterleavingStrategy
  ): InterleavedCard[] => {
    const decks = availableDecks.filter(d => deckIds.includes(d.id));
    
    // Extract cards with rich domain metadata
    const poolByDomain: Record<string, InterleavedCard[]> = {};
    decks.forEach(deck => {
      const domain = deck.category || 'General';
      if (!poolByDomain[domain]) poolByDomain[domain] = [];

      deck.concepts.forEach(concept => {
        concept.retrievalCards.forEach(card => {
          poolByDomain[domain].push({
            ...card,
            deckId: deck.id,
            deckTitle: deck.title,
            domain,
            domainColor: domain
          });
        });
      });
    });

    const domains = Object.keys(poolByDomain);
    if (domains.length === 0) return [];

    // Shuffle cards within each domain
    domains.forEach(d => {
      poolByDomain[d] = shuffle(poolByDomain[d]);
    });

    const interleaved: InterleavedCard[] = [];

    if (strat === 'round-robin') {
      // Perfectly cyclical interleaving across domains: A -> B -> C -> A
      let domainIdx = 0;
      let attempts = 0;
      while (interleaved.length < count && attempts < count * 4) {
        attempts++;
        const targetDomain = domains[domainIdx % domains.length];
        const card = poolByDomain[targetDomain]?.pop();
        if (card) {
          interleaved.push(card);
        }
        domainIdx++;
        // If domain exhausted, skip or cycle
        if (domains.every(d => (poolByDomain[d]?.length || 0) === 0)) break;
      }
    } else if (strat === 'adaptive-difficulty') {
      // Alternate high-difficulty card with moderate card across different domains
      let lastDomain = '';
      while (interleaved.length < count) {
        const eligibleDomains = domains.filter(d => d !== lastDomain && (poolByDomain[d]?.length || 0) > 0);
        const pickDomain = eligibleDomains.length > 0 ? eligibleDomains[Math.floor(Math.random() * eligibleDomains.length)] : domains[0];
        const card = poolByDomain[pickDomain]?.pop();
        if (!card) break;
        interleaved.push(card);
        lastDomain = pickDomain;
      }
    } else {
      // Cognitive Entropy: Maximum jitter, greedy avoidance of consecutive identical domains
      let lastDomain = '';
      while (interleaved.length < count) {
        // Find domains that differ from previous card and have cards left
        const candidates = domains
          .filter(d => d !== lastDomain && (poolByDomain[d]?.length || 0) > 0)
          .sort((a, b) => (poolByDomain[b]?.length || 0) - (poolByDomain[a]?.length || 0));

        const chosenDomain = candidates[0] || domains.find(d => (poolByDomain[d]?.length || 0) > 0);
        if (!chosenDomain) break;

        const card = poolByDomain[chosenDomain].pop();
        if (!card) break;

        interleaved.push(card);
        lastDomain = chosenDomain;
      }
    }

    return interleaved.slice(0, count);
  }, [availableDecks]);

  // Start the workout
  const handleStartArena = () => {
    const cards = generateInterleavedCards(selectedDeckIds, sessionCardCount, strategy);
    if (cards.length === 0) return;

    setInterleavedDeck(cards);
    setCurrentIndex(0);
    setIsRevealed(false);
    setShowHint(false);
    setResults([]);
    setElapsedSeconds(0);
    setContextShiftStreak(0);
    setArenaPhase('playing');
    soundEngine.playSocraticChallengeChime();
  };

  const currentCard = interleavedDeck[currentIndex] || null;
  const previousCard = currentIndex > 0 ? interleavedDeck[currentIndex - 1] : null;
  const isContextShift = Boolean(previousCard && previousCard.domain !== currentCard?.domain);

  // Play audio on context shift when card changes
  useEffect(() => {
    if (arenaPhase === 'playing' && isContextShift) {
      soundEngine.playContextShiftSound();
    }
  }, [currentIndex, arenaPhase, isContextShift]);

  // Answer rating handler
  const handleRateCard = (rating: 'again' | 'hard' | 'good' | 'easy') => {
    if (!currentCard) return;

    const latency = Math.max(1, elapsedSeconds);
    const isCorrect = rating === 'good' || rating === 'easy';

    // FSRS stability update
    const { updatedCard } = FSRSService.schedule(currentCard, rating);
    StorageService.saveCard(updatedCard);

    // Audio and Study Wage
    if (isCorrect) {
      soundEngine.playCorrectChime();
      const baseWage = isContextShift ? 25 : 15; // Context switch resilience bonus
      StorageService.addXP(baseWage);
      lifeSimService.awardStudyWage('Interleaving Shift Drill', baseWage);
      if (isContextShift) setContextShiftStreak(prev => prev + 1);
    } else {
      soundEngine.playIncorrectChime();
      setContextShiftStreak(0);
    }

    const trial: TrialResult = {
      card: currentCard,
      isShift: isContextShift,
      rating,
      isCorrect,
      latencySeconds: latency,
    };

    const nextResults = [...results, trial];
    setResults(nextResults);

    // Advance to next card or complete session
    if (currentIndex + 1 < interleavedDeck.length) {
      setCurrentIndex(currentIndex + 1);
      setIsRevealed(false);
      setShowHint(false);
      setElapsedSeconds(0);
    } else {
      // Calculate comprehensive cognitive scorecard
      finishSession(nextResults);
    }
  };

  // Build final cognitive discrimination report
  const finishSession = (allTrials: TrialResult[]) => {
    const total = allTrials.length;
    const correctCount = allTrials.filter(t => t.isCorrect).length;
    const overallAcc = Math.round((correctCount / total) * 100);

    const shiftTrials = allTrials.filter(t => t.isShift);
    const stableTrials = allTrials.filter(t => !t.isShift);

    const shiftAcc = shiftTrials.length > 0 
      ? Math.round((shiftTrials.filter(t => t.isCorrect).length / shiftTrials.length) * 100) 
      : overallAcc;

    const stableAcc = stableTrials.length > 0
      ? Math.round((stableTrials.filter(t => t.isCorrect).length / stableTrials.length) * 100)
      : overallAcc;

    // Agility index weights resilience to category jumps
    const agilityIndex = Math.round((shiftAcc * 0.7) + (overallAcc * 0.3));

    // Group performance by domain
    const domainMap: Record<string, { total: number; correct: number }> = {};
    allTrials.forEach(t => {
      const d = t.card.domain;
      if (!domainMap[d]) domainMap[d] = { total: 0, correct: 0 };
      domainMap[d].total++;
      if (t.isCorrect) domainMap[d].correct++;
    });

    const domainBreakdown = Object.entries(domainMap).map(([domain, data]) => ({
      domain,
      total: data.total,
      correct: data.correct,
      accuracyPercent: Math.round((data.correct / data.total) * 100),
      color: domain,
    }));

    const totalXP = 60 + (correctCount * 10) + (shiftTrials.length * 5);
    StorageService.addXP(totalXP);
    lifeSimService.awardStudyWage(
      `Interleaving Shift (${shiftTrials.length} context shifts)`,
      Math.max(25, Math.round(totalXP / 2))
    );

    const report: InterleavingSessionReport = {
      id: `interleave-rpt-${Math.random().toString(36).slice(2, 9)}`,
      timestamp: new Date().toISOString(),
      totalCards: total,
      contextShiftsCount: shiftTrials.length,
      strategy,
      overallAccuracyPercent: overallAcc,
      switchAccuracyPercent: shiftAcc,
      stableAccuracyPercent: stableAcc,
      agilityIndex,
      domainBreakdown,
      xpEarned: totalXP,
    };

    StorageService.saveInterleavingReport(report);
    setFinalReport(report);
    setArenaPhase('scorecard');
    soundEngine.playCompletionChime();

    if (onSessionComplete) onSessionComplete(report);
  };

  // Keyboard shortcut support
  const handleRateCardRef = useRef(handleRateCard);
  useEffect(() => {
    handleRateCardRef.current = handleRateCard;
  });

  useEffect(() => {
    if (arenaPhase !== 'playing') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsRevealed(prev => !prev);
      } else if (isRevealed) {
        if (e.key === '1') handleRateCardRef.current('again');
        if (e.key === '2') handleRateCardRef.current('hard');
        if (e.key === '3') handleRateCardRef.current('good');
        if (e.key === '4') handleRateCardRef.current('easy');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [arenaPhase, isRevealed]);

  // Deck multi-select toggle
  const toggleDeck = (id: string) => {
    setSelectedDeckIds(prev => 
      prev.includes(id) 
        ? (prev.length > 1 ? prev.filter(x => x !== id) : prev) 
        : [...prev, id]
    );
  };

  const currentStyle = (currentCard && DOMAIN_STYLES[currentCard.domain]) || DEFAULT_STYLE;

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-4 animate-fadeIn">

      {/* ========================================================= */}
      {/* 1. SETUP / CONFIGURATION PHASE                            */}
      {/* ========================================================= */}
      {arenaPhase === 'setup' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/[0.08] transition-all"
                title="Return to Study Dashboard"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight font-display">
                    Cross-Deck Interleaving Arena
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[11px] font-mono uppercase font-bold">
                    Kornell &amp; Bjork (2008)
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-sans">
                  Train cognitive discrimination by rapidly switching between unrelated subject disciplines.
                </p>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-white/[0.08] text-xs font-mono text-indigo-300">
              <Shuffle className="w-3.5 h-3.5" />
              <span>Inductive Categorization</span>
            </div>
          </div>

          {/* Scientific Context Banner */}
          <div className="p-5 rounded-3xl bg-gradient-to-r from-indigo-950/50 via-slate-900 to-purple-950/40 border border-indigo-500/30 shadow-xl space-y-2">
            <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs uppercase tracking-wider font-display">
              <Brain className="w-4 h-4" />
              <span>Why Interleaving Outperforms Blocked Practice</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Studying one topic in a block creates a false illusion of fluency because your brain never has to ask: <em>&ldquo;Which category rule applies here?&rdquo;</em> 
              Interleaved practice forces dynamic context shifting, doubling long-term inductive transfer and high-stakes problem-solving agility.
            </p>
          </div>

          {/* Configuration Card */}
          <div className="p-6 rounded-3xl glass-panel space-y-6">
            
            {/* Step 1: Select Decks */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-white uppercase tracking-wider font-display flex items-center gap-2">
                  <BookMarked className="w-4 h-4 text-indigo-400" />
                  <span>Select Subject Disciplines to Interleave</span>
                </label>
                <span className="text-[11px] font-mono text-slate-400">
                  {selectedDeckIds.length} Selected (Min 2 recommended)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {availableDecks.map(deck => {
                  const isSelected = selectedDeckIds.includes(deck.id);
                  const style = DOMAIN_STYLES[deck.category || ''] || DEFAULT_STYLE;
                  const cardCount = deck.concepts.reduce((acc, c) => acc + c.retrievalCards.length, 0);

                  return (
                    <div
                      key={deck.id}
                      onClick={() => toggleDeck(deck.id)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-2 select-none ${
                        isSelected 
                          ? `${style.bg} ${style.border} shadow-lg ${style.glow} ring-2 ring-indigo-500/30`
                          : 'bg-slate-900/60 border-white/[0.08] hover:border-white/[0.2] opacity-70'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-[11px] font-mono uppercase font-bold px-2 py-0.5 rounded-full ${style.text} bg-white/[0.05]`}>
                          {deck.category || 'General'}
                        </span>
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center border text-[11px] ${
                          isSelected ? 'bg-indigo-600 border-indigo-400 text-white' : 'border-white/20'
                        }`}>
                          {isSelected && '✓'}
                        </div>
                      </div>
                      <div className="text-sm font-bold text-white line-clamp-1">{deck.title}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {deck.concepts.length} Concepts • {cardCount} Cards
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Mixing Strategy */}
            <div className="space-y-3 pt-2">
              <label className="text-xs font-bold text-white uppercase tracking-wider font-display flex items-center gap-2">
                <Sliders className="w-4 h-4 text-purple-400" />
                <span>Interleaving Algorithm Strategy</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setStrategy('cognitive-entropy')}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    strategy === 'cognitive-entropy'
                      ? 'bg-purple-950/50 border-purple-500/60 shadow-lg shadow-purple-900/20 ring-2 ring-purple-500/20'
                      : 'bg-slate-900/70 border-white/[0.08] hover:border-white/[0.2]'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-bold text-white">Cognitive Entropy</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Greedy jitter avoiding consecutive identical domains. Maximizes contextual surprise.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setStrategy('round-robin')}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    strategy === 'round-robin'
                      ? 'bg-indigo-950/50 border-indigo-500/60 shadow-lg shadow-indigo-900/20 ring-2 ring-indigo-500/20'
                      : 'bg-slate-900/70 border-white/[0.08] hover:border-white/[0.2]'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Shuffle className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-bold text-white">Round Robin</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Balanced cyclic sequence: Subject A &rarr; B &rarr; C &rarr; A. Equal distributed practice.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setStrategy('adaptive-difficulty')}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    strategy === 'adaptive-difficulty'
                      ? 'bg-emerald-950/50 border-emerald-500/60 shadow-lg shadow-emerald-900/20 ring-2 ring-emerald-500/20'
                      : 'bg-slate-900/70 border-white/[0.08] hover:border-white/[0.2]'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Flame className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white">Adaptive Difficulty</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Alternates difficult concepts from one domain with foundational concepts from another.
                  </p>
                </button>
              </div>
            </div>

            {/* Step 3: Card Count Selector */}
            <div className="space-y-3 pt-2">
              <label className="text-xs font-bold text-white uppercase tracking-wider font-display flex items-center gap-2">
                <Timer className="w-4 h-4 text-amber-400" />
                <span>Workout Card Volume</span>
              </label>

              <div className="flex flex-wrap gap-2.5">
                {[10, 15, 20, 30].map(count => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setSessionCardCount(count)}
                    className={`px-5 py-2.5 rounded-xl text-xs font-bold font-mono transition-all ${
                      sessionCardCount === count
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 scale-105'
                        : 'bg-slate-900 text-slate-400 border border-white/[0.08] hover:border-white/[0.2]'
                    }`}
                  >
                    {count} Cards
                  </button>
                ))}
              </div>
            </div>

            {/* Launch Action */}
            <div className="pt-4 border-t border-white/[0.08] flex items-center justify-between">
              <div className="text-xs text-slate-400">
                Ready for high-frequency synaptic switching across {selectedDeckIds.length} disciplines.
              </div>

              <button
                onClick={handleStartArena}
                disabled={selectedDeckIds.length === 0}
                className="px-7 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-black text-xs shadow-xl shadow-purple-600/30 transition-all hover:scale-105 flex items-center gap-2 disabled:opacity-50"
              >
                <Shuffle className="w-4 h-4" />
                <span>Launch Interleaving Arena</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. ACTIVE INTERLEAVING WORKOUT PHASE                      */}
      {/* ========================================================= */}
      {arenaPhase === 'playing' && currentCard && (
        <div className="space-y-5 animate-fadeIn">
          
          {/* Top Workout Status Bar */}
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setArenaPhase('setup')}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-medium"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Exit Arena</span>
              </button>
              <div className="h-4 w-px bg-white/10" />
              <span className="text-xs font-mono font-bold text-slate-300">
                Card {currentIndex + 1} of {interleavedDeck.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {contextShiftStreak > 0 && (
                <div className="px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-mono font-bold flex items-center gap-1">
                  <Flame className="w-3 h-3 text-amber-400 animate-pulse" />
                  <span>{contextShiftStreak}x Shift Streak</span>
                </div>
              )}
              <div className="px-3 py-1 rounded-xl bg-slate-900 border border-white/[0.08] text-xs font-mono text-slate-400 flex items-center gap-1.5">
                <Timer className="w-3.5 h-3.5 text-indigo-400" />
                <span>{elapsedSeconds}s</span>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-white/[0.05]">
            <div 
              className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / interleavedDeck.length) * 100}%` }}
            />
          </div>

          {/* Context Shift Announcement Banner */}
          {isContextShift && previousCard && (
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-950/60 via-purple-950/50 to-indigo-950/60 border border-amber-500/40 shadow-lg flex items-center justify-between text-xs animate-pulse">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="font-bold text-amber-200">
                  CONTEXT SHIFT DETECTED:
                </span>
                <span className="text-slate-300 font-mono">
                  {previousCard.domain} &rarr; <strong className="text-white">{currentCard.domain}</strong>
                </span>
              </div>
              <span className="text-[11px] font-mono uppercase bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded border border-amber-400/30 font-bold hidden sm:inline">
                +10 🪙 Context Shift Bonus
              </span>
            </div>
          )}

          {/* Current Discipline Tag & Parent Deck */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-xl font-bold font-mono text-xs border ${currentStyle.bg} ${currentStyle.text} ${currentStyle.border}`}>
                {currentCard.domain}
              </span>
              <span className="text-xs text-slate-400 truncate max-w-xs font-medium">
                Deck: {currentCard.deckTitle}
              </span>
            </div>

            <div className="text-[11px] text-slate-500 font-mono">
              FSRS Stability: {currentCard.stability || 1}d
            </div>
          </div>

          {/* Main Flashcard Card Body */}
          <div className="p-7 sm:p-9 rounded-3xl glass-panel relative overflow-hidden border border-white/[0.12] shadow-2xl space-y-6">
            
            {/* Question Text */}
            <div className="space-y-3">
              <span className="text-[11px] font-mono uppercase tracking-widest text-slate-400 font-bold">
                Retrieval Prompt
              </span>
              <div className="text-lg sm:text-xl font-bold text-white leading-relaxed font-sans">
                <MathRenderer text={currentCard.question} />
              </div>
            </div>

            {/* Hint Box (Optional toggle) */}
            {currentCard.hint && (
              <div>
                {!showHint ? (
                  <button
                    onClick={() => setShowHint(true)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Need a cognitive nudge? Show hint</span>
                  </button>
                ) : (
                  <div className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 text-indigo-200 text-xs font-medium animate-fadeIn">
                    <strong>Hint:</strong> {currentCard.hint}
                  </div>
                )}
              </div>
            )}

            {/* Revealed Answer Section */}
            {isRevealed ? (
              <div className="space-y-5 pt-6 border-t border-white/[0.08] animate-fadeIn">
                <div className="space-y-2">
                  <span className="text-[11px] font-mono uppercase tracking-widest text-emerald-400 font-bold">
                    Target Answer
                  </span>
                  <div className="text-base sm:text-lg font-semibold text-slate-100 leading-relaxed font-sans">
                    <MathRenderer text={currentCard.answer} />
                  </div>
                  {currentCard.explanation && (
                    <div className="text-xs text-slate-400 pt-1 leading-relaxed border-t border-white/[0.04]">
                      <MathRenderer text={currentCard.explanation} />
                    </div>
                  )}
                </div>

                {/* Rating Button Matrix */}
                <div className="space-y-2 pt-2">
                  <div className="text-[11px] text-slate-400 font-mono text-center">
                    Rate retrieval accuracy under cross-domain context switching:
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <button
                      onClick={() => handleRateCard('again')}
                      className="p-3.5 rounded-2xl bg-rose-950/50 hover:bg-rose-950/70 border border-rose-500/40 text-rose-300 text-xs font-bold hover:scale-[1.02] transition-all text-left"
                    >
                      <div className="flex items-center justify-between">
                        <span>Again</span>
                        <RotateCw className="w-3 h-3 text-rose-400" />
                      </div>
                      <div className="text-[11px] text-rose-400/80 font-mono mt-0.5">Key &lsquo;1&rsquo; • Lapsed</div>
                    </button>

                    <button
                      onClick={() => handleRateCard('hard')}
                      className="p-3.5 rounded-2xl bg-amber-950/50 hover:bg-amber-950/70 border border-amber-500/40 text-amber-300 text-xs font-bold hover:scale-[1.02] transition-all text-left"
                    >
                      <div>Hard</div>
                      <div className="text-[11px] text-amber-400/80 font-mono mt-0.5">Key &lsquo;2&rsquo; • High Friction</div>
                    </button>

                    <button
                      onClick={() => handleRateCard('good')}
                      className="p-3.5 rounded-2xl bg-blue-950/50 hover:bg-blue-950/70 border border-blue-500/40 text-blue-300 text-xs font-bold hover:scale-[1.02] transition-all text-left"
                    >
                      <div>Good</div>
                      <div className="text-[11px] text-blue-400/80 font-mono mt-0.5">Key &lsquo;3&rsquo; • Accurate</div>
                    </button>

                    <button
                      onClick={() => handleRateCard('easy')}
                      className="p-3.5 rounded-2xl bg-emerald-950/50 hover:bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-xs font-bold hover:scale-[1.02] transition-all text-left"
                    >
                      <div>Easy</div>
                      <div className="text-[11px] text-emerald-400/80 font-mono mt-0.5">Key &lsquo;4&rsquo; • Rapid Recall</div>
                    </button>
                  </div>
                </div>

              </div>
            ) : (
              <div className="pt-4 flex flex-col items-center justify-center gap-2">
                <button
                  onClick={() => setIsRevealed(true)}
                  className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-bold text-xs shadow-xl shadow-purple-600/30 transition-all hover:scale-105"
                >
                  Reveal Solution (Spacebar)
                </button>
                <span className="text-[11px] text-slate-500 font-mono">
                  Discriminate category &rarr; Retrieve mental model
                </span>
              </div>
            )}

          </div>

        </div>
      )}

      {/* ========================================================= */}
      {/* 3. POST-SESSION COGNITIVE SCORECARD                       */}
      {/* ========================================================= */}
      {arenaPhase === 'scorecard' && finalReport && (
        <div className="space-y-6 animate-fadeIn">
          
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight font-display">
                  Cognitive Discrimination Scorecard
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-mono uppercase font-bold">
                  Interleaving Complete
                </span>
              </div>
              <p className="text-xs text-slate-400 font-sans">
                Evaluation of inductive transfer &amp; category discrimination under high context shifts.
              </p>
            </div>

            <div className="px-3.5 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold flex items-center gap-1.5 shadow-sm">
              <span className="text-amber-400">🪙</span>
              <span>+{finalReport.xpEarned} Wages Earned</span>
            </div>
          </div>

          {/* Metric Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            
            <div className="p-5 rounded-3xl glass-panel space-y-1">
              <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                Overall Accuracy
              </div>
              <div className="text-3xl font-black text-white font-mono">
                {finalReport.overallAccuracyPercent}%
              </div>
              <div className="text-[11px] text-slate-400">
                {finalReport.totalCards} cards tested
              </div>
            </div>

            <div className="p-5 rounded-3xl glass-panel space-y-1">
              <div className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-bold">
                Context Shifts
              </div>
              <div className="text-3xl font-black text-amber-300 font-mono">
                {finalReport.contextShiftsCount}
              </div>
              <div className="text-[11px] text-slate-400">
                Discipline boundaries
              </div>
            </div>

            <div className="p-5 rounded-3xl glass-panel space-y-1">
              <div className="text-[11px] font-mono uppercase tracking-wider text-purple-400 font-bold">
                Switch Resilience
              </div>
              <div className="text-3xl font-black text-purple-300 font-mono">
                {finalReport.switchAccuracyPercent}%
              </div>
              <div className="text-[11px] text-slate-400">
                Accuracy post-shift
              </div>
            </div>

            <div className="p-5 rounded-3xl glass-panel space-y-1">
              <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-bold">
                Agility Index
              </div>
              <div className="text-3xl font-black text-emerald-300 font-mono">
                {finalReport.agilityIndex}
                <span className="text-xs text-slate-400 font-sans font-normal ml-1">/100</span>
              </div>
              <div className="text-[11px] text-emerald-400 font-medium">
                {finalReport.agilityIndex >= 80 ? 'Elite Elasticity' : finalReport.agilityIndex >= 65 ? 'Calibrated Agility' : 'Context Sensitive'}
              </div>
            </div>

          </div>

          {/* Per-Domain Performance Breakdown */}
          <div className="p-6 rounded-3xl glass-panel space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider font-display">
                <BarChart3 className="w-4 h-4 text-indigo-400" />
                <span>Domain Discrimination Breakdown</span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">Inductive Categorization</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {finalReport.domainBreakdown.map((item, idx) => {
                const style = DOMAIN_STYLES[item.domain] || DEFAULT_STYLE;
                return (
                  <div 
                    key={idx}
                    className={`p-4 rounded-2xl border ${style.bg} ${style.border} space-y-2`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold font-mono ${style.text}`}>
                        {item.domain}
                      </span>
                      <span className="text-xs font-mono font-black text-white">
                        {item.accuracyPercent}%
                      </span>
                    </div>

                    <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-indigo-400 to-emerald-400 transition-all duration-500"
                        style={{ width: `${item.accuracyPercent}%` }}
                      />
                    </div>

                    <div className="text-[11px] text-slate-400 font-mono">
                      {item.correct} correct of {item.total} trials
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Scientific Cognitive Debrief */}
          <div className="p-5 rounded-3xl bg-slate-900/90 border border-white/[0.08] space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200 uppercase tracking-wider font-display">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Cognitive Architecture Feedback</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Your Switch Resilience score ({finalReport.switchAccuracyPercent}%) indicates how effectively your working memory sheds the mental model of the previous subject and activates the principles of the new subject.
              Continuous interleaving prevents rote pattern-matching and cements knowledge in long-term inductive storage.
            </p>
          </div>

          {/* Action Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <button
              onClick={() => setArenaPhase('setup')}
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold border border-white/[0.08] transition-all w-full sm:w-auto"
            >
              Configure Another Interleaving Workout
            </button>

            <button
              onClick={onBack}
              className="px-7 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-xl shadow-indigo-600/30 transition-all hover:scale-105 flex items-center gap-2 w-full sm:w-auto justify-center"
            >
              <Award className="w-4 h-4" />
              <span>Complete &amp; Return to Dashboard</span>
            </button>
          </div>

        </div>
      )}

    </div>
  );
};
