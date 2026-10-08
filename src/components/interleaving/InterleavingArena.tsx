import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Shuffle, X, Flame, Timer, Lightbulb, Eye, Check, ArrowRight, RotateCcw } from 'lucide-react';
import type {
  StudySession,
  InterleavedCard,
  InterleavingStrategy,
  InterleavingSessionReport
} from '../../types';
import { StorageService } from '../../services/storageService';
import { grantReward } from '../../services/economy/rewardService';
import { DEMO_STUDY_SESSIONS } from '../../data/demoDecks';
import { CURATED_STARTER_DECKS } from '../../data/curatedStarterCatalog';
import { FSRSService } from '../../services/fsrsService';
import { soundEngine } from '../../services/soundEngine';
import { MathRenderer } from '../common/MathRenderer';
import { shuffle } from '../../utils/shuffle';
import { fillCloze, maskCloze } from '../../utils/cloze';
import { Badge, Button, Card, CoinIcon, IconButton, Kbd, ProgressBar } from '../ui/primitives';

interface InterleavingArenaProps {
  onBack: () => void;
  onSessionComplete?: (report: InterleavingSessionReport) => void;
}

type Rating = 'again' | 'hard' | 'good' | 'easy';

/** Stable colour dot per subject, so the same subject always looks the same. */
const SUBJECT_DOTS = ['bg-brand', 'bg-success', 'bg-gold', 'bg-due', 'bg-sky-400', 'bg-teal-400', 'bg-purple-400', 'bg-danger'];
const subjectDot = (domain: string): string => {
  let hash = 0;
  for (let i = 0; i < domain.length; i++) hash = (hash * 31 + domain.charCodeAt(i)) >>> 0;
  return SUBJECT_DOTS[hash % SUBJECT_DOTS.length];
};

const ORDER_OPTIONS: { value: InterleavingStrategy; title: string; text: string }[] = [
  { value: 'cognitive-entropy', title: 'Most variety', text: 'Never the same subject twice in a row.' },
  { value: 'round-robin', title: 'Take turns', text: 'One card from each subject in turn.' },
  { value: 'adaptive-difficulty', title: 'Random', text: 'A different subject each card, picked at random.' },
];

const RATINGS: { rating: Rating; label: string; key: string; className: string; labelClassName: string }[] = [
  { rating: 'again', label: 'Again', key: '1', className: 'hover:border-danger/50 hover:bg-danger-soft', labelClassName: 'text-danger' },
  { rating: 'hard', label: 'Hard', key: '2', className: 'hover:border-gold/50 hover:bg-gold-soft', labelClassName: 'text-gold' },
  { rating: 'good', label: 'Good', key: '3', className: 'hover:border-brand/50 hover:bg-brand-soft', labelClassName: 'text-brand-text' },
  { rating: 'easy', label: 'Easy', key: '4', className: 'hover:border-success/50 hover:bg-success-soft', labelClassName: 'text-success' },
];

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
    // Default to the first three decks for a mix of subjects
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
    rating: Rating;
    isCorrect: boolean;
    latencySeconds: number;
  }
  const [results, setResults] = useState<TrialResult[]>([]);
  const [finalReport, setFinalReport] = useState<InterleavingSessionReport | null>(null);
  const [sessionPay, setSessionPay] = useState<{ tokens: number; xp: number; capped: boolean; repeats: number } | null>(null);

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
      // A different domain each card where possible, picked at random
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
      // Most variety: greedy avoidance of consecutive identical domains
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
    setSessionPay(null);
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
  const handleRateCard = (rating: Rating) => {
    if (!currentCard) return;

    const latency = Math.max(1, elapsedSeconds);
    const isCorrect = rating === 'good' || rating === 'easy';

    // Schedule from the saved progress; the deck's own copy of the card can be older.
    const { updatedCard } = FSRSService.schedule(StorageService.withLatestProgress(currentCard), rating);
    StorageService.saveCard(updatedCard);

    // Self-graded, so every rating earns the same flat review XP.
    grantReward({ kind: 'review', rating }, { weekly: true, label: 'Flashcard review' });

    if (isCorrect) {
      soundEngine.playCorrectChime();
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
      finishSession(nextResults);
    }
  };

  // Build the session report
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

    // Weighted towards how well cards were remembered right after a switch
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

    const sessionReward = grantReward(
      { kind: 'interleave-session', cardIds: allTrials.map(t => t.card.id), shifts: shiftTrials.length },
      { label: `Mixed decks (${total} cards)` },
    );
    setSessionPay({
      tokens: sessionReward.wage?.totalAmount ?? 0,
      xp: sessionReward.xp,
      capped: sessionReward.capped,
      repeats: sessionReward.repeatCards,
    });

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
      xpEarned: sessionReward.xp,
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

  // Deck multi-select toggle (at least one deck stays selected)
  const toggleDeck = (id: string) => {
    setSelectedDeckIds(prev =>
      prev.includes(id)
        ? (prev.length > 1 ? prev.filter(x => x !== id) : prev)
        : [...prev, id]
    );
  };

  const selectedCardTotal = availableDecks
    .filter(d => selectedDeckIds.includes(d.id))
    .reduce((sum, d) => sum + d.concepts.reduce((acc, c) => acc + c.retrievalCards.length, 0), 0);
  const selectedSubjects = new Set(availableDecks.filter(d => selectedDeckIds.includes(d.id)).map(d => d.category || 'General')).size;

  // -------------------------------------------------------------
  // SETUP
  // -------------------------------------------------------------
  if (arenaPhase === 'setup') {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-6 animate-fadeIn">
        <header>
          <h1 className="text-[26px] font-semibold tracking-tight text-ink sm:text-[30px]">Mix decks</h1>
          <p className="mt-1 max-w-2xl text-[15px] leading-relaxed text-ink-muted">
            Practise several subjects in one shuffled session. Switching is harder than studying one subject at a time, and that effort is what helps you tell similar ideas apart.
          </p>
        </header>

        <section className="space-y-6 rounded-3xl border border-line bg-surface p-5 sm:p-6">
          <div className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[13px] font-medium text-ink">Decks</p>
              <p className="text-[13px] text-ink-subtle">
                {selectedDeckIds.length} selected · {selectedSubjects} {selectedSubjects === 1 ? 'subject' : 'subjects'}
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {availableDecks.map(deck => {
                const isSelected = selectedDeckIds.includes(deck.id);
                const cardCount = deck.concepts.reduce((acc, c) => acc + c.retrievalCards.length, 0);
                const domain = deck.category || 'General';
                return (
                  <button
                    key={deck.id}
                    type="button"
                    role="checkbox"
                    aria-checked={isSelected}
                    onClick={() => toggleDeck(deck.id)}
                    className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors cursor-pointer ${
                      isSelected ? 'border-brand bg-brand-soft' : 'border-line hover:border-line-strong hover:bg-surface-hover'
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        isSelected ? 'border-brand bg-brand text-brand-ink' : 'border-line-strong'
                      }`}
                      aria-hidden="true"
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-medium text-ink">{deck.title}</span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-subtle">
                        <span className={`h-1.5 w-1.5 rounded-full ${subjectDot(domain)}`} aria-hidden="true" />
                        <span className="truncate">{domain}</span>
                        <span className="shrink-0 whitespace-nowrap">· {cardCount} cards</span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-[13px] font-medium text-ink">Order</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {ORDER_OPTIONS.map(option => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={strategy === option.value}
                  onClick={() => setStrategy(option.value)}
                  className={`rounded-xl border p-3.5 text-left transition-colors cursor-pointer ${
                    strategy === option.value ? 'border-brand bg-brand-soft' : 'border-line hover:border-line-strong hover:bg-surface-hover'
                  }`}
                >
                  <span className="block text-[14px] font-medium text-ink">{option.title}</span>
                  <span className="mt-0.5 block text-[13px] text-ink-subtle">{option.text}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-[13px] font-medium text-ink">Cards</p>
            <div role="radiogroup" aria-label="Number of cards" className="grid grid-cols-4 gap-1 rounded-xl border border-line bg-canvas p-1 sm:max-w-sm">
              {[10, 15, 20, 30].map(count => (
                <button
                  key={count}
                  type="button"
                  role="radio"
                  aria-checked={sessionCardCount === count}
                  onClick={() => setSessionCardCount(count)}
                  className={`h-9 rounded-lg text-[13px] font-medium tabular-nums transition-colors cursor-pointer ${
                    sessionCardCount === count ? 'bg-surface-hover text-ink shadow-sm' : 'text-ink-subtle hover:text-ink'
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[13px] text-ink-subtle">
              Every card earns XP, and finishing pays a token bonus.
              {selectedSubjects < 2 && ' Pick decks from two or more subjects to get real switching.'}
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onBack}>
                Cancel
              </Button>
              <Button variant="primary" size="lg" icon={Shuffle} onClick={handleStartArena} disabled={selectedCardTotal === 0}>
                Start
              </Button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  // -------------------------------------------------------------
  // PLAYING
  // -------------------------------------------------------------
  if (arenaPhase === 'playing' && currentCard) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4 animate-fadeIn">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <IconButton icon={X} label="Leave session" onClick={() => setArenaPhase('setup')} />
            <p className="text-[14px] font-medium tabular-nums text-ink">
              Card {currentIndex + 1} of {interleavedDeck.length}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {contextShiftStreak > 1 && (
              <Badge tone="gold">
                <Flame className="h-3 w-3 fill-current" aria-hidden="true" />
                {contextShiftStreak} switches in a row
              </Badge>
            )}
            <span className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-surface-hover px-2.5 font-mono text-[13px] tabular-nums text-ink" title="Time on this card">
              <Timer className="h-3.5 w-3.5 text-ink-subtle" aria-hidden="true" />
              {elapsedSeconds}s
            </span>
          </div>
        </div>
        <ProgressBar value={(currentIndex / interleavedDeck.length) * 100} label="Session progress" />

        {isContextShift && previousCard && (
          <p className="flex items-center gap-2 rounded-xl border border-brand/25 bg-brand-soft px-3.5 py-2.5 text-[13px] text-ink animate-fadeIn">
            <Shuffle className="h-4 w-4 shrink-0 text-brand-text" aria-hidden="true" />
            New subject: <span className="text-ink-muted">{previousCard.domain}</span> → <span className="font-medium">{currentCard.domain}</span>
          </p>
        )}

        <div className="space-y-6 rounded-3xl border border-line bg-surface-solid p-6 sm:p-8">
          <div className="flex items-center justify-between gap-3 text-[13px]">
            <span className="flex min-w-0 items-center gap-2 font-medium text-ink">
              <span className={`h-2 w-2 shrink-0 rounded-full ${subjectDot(currentCard.domain)}`} aria-hidden="true" />
              <span className="truncate">{currentCard.domain}</span>
            </span>
            <span className="truncate text-ink-subtle">{currentCard.deckTitle}</span>
          </div>

          <h3 className="text-[22px] font-semibold leading-snug tracking-tight text-ink sm:text-[26px]">
            <MathRenderer text={isRevealed ? fillCloze(currentCard.question) : maskCloze(currentCard.question)} />
          </h3>

          {currentCard.hint && !isRevealed && (
            showHint ? (
              <p className="rounded-2xl border border-gold/25 bg-gold-soft p-3.5 text-[14px] text-ink animate-fadeIn">
                <span className="mr-1.5 text-xs font-semibold uppercase tracking-wide text-gold">Hint</span>
                {currentCard.hint}
              </p>
            ) : (
              <Button variant="ghost" size="sm" icon={Lightbulb} onClick={() => setShowHint(true)} className="-ml-2">
                Show a hint
              </Button>
            )
          )}

          {isRevealed ? (
            <div className="space-y-5 border-t border-line pt-6 animate-fadeIn">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-success">Answer</p>
                <div className="mt-1.5 text-[17px] leading-relaxed text-ink">
                  <MathRenderer text={currentCard.answer} />
                </div>
                {currentCard.explanation && (
                  <div className="mt-3 rounded-2xl bg-surface-hover p-4 text-[14px] leading-relaxed text-ink-muted">
                    <MathRenderer text={currentCard.explanation} />
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <p className="text-[13px] font-medium text-ink">How well did you remember it?</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {RATINGS.map(({ rating, label, key, className, labelClassName }) => (
                    <button
                      key={rating}
                      type="button"
                      onClick={() => handleRateCard(rating)}
                      className={`flex items-center justify-between rounded-xl border border-line bg-surface p-3 text-left transition-colors cursor-pointer ${className}`}
                    >
                      <span className={`text-[14px] font-semibold ${labelClassName}`}>{label}</span>
                      <Kbd>{key}</Kbd>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-ink-subtle">Every rating earns the same XP. Your rating only decides when the card comes back.</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 pt-2">
              <Button variant="primary" size="lg" icon={Eye} onClick={() => setIsRevealed(true)} className="w-full sm:w-auto sm:px-8">
                Show answer
              </Button>
              <span className="text-xs text-ink-subtle">First decide which subject this is, then recall the answer.</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RESULTS
  // -------------------------------------------------------------
  if (arenaPhase === 'scorecard' && finalReport) {
    const switchDelta = finalReport.switchAccuracyPercent - finalReport.stableAccuracyPercent;
    return (
      <div className="mx-auto w-full max-w-3xl space-y-5 animate-fadeIn">
        <header>
          <p className="text-[13px] font-medium text-brand-text">Mix decks results</p>
          <h1 className="mt-1 text-[26px] font-semibold tracking-tight text-ink sm:text-[30px]">
            {finalReport.totalCards} cards across {finalReport.domainBreakdown.length} {finalReport.domainBreakdown.length === 1 ? 'subject' : 'subjects'}
          </h1>
        </header>

        {sessionPay && (
          <Card className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[13px] text-ink-subtle">Session bonus</p>
              <p className="mt-1 flex items-center gap-2 text-[28px] font-semibold leading-none tabular-nums text-ink">
                <CoinIcon className="h-7 w-7" />+{sessionPay.tokens}
              </p>
            </div>
            <p className="text-right text-[13px] text-ink-subtle">
              +{sessionPay.xp} XP{sessionPay.capped ? ', daily limit applied' : ''}
              <br />
              {sessionPay.repeats > 0
                ? `${sessionPay.repeats} ${sessionPay.repeats === 1 ? 'card was' : 'cards were'} already paid today`
                : 'plus XP for every card'}
            </p>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ResultTile label="Remembered" value={`${finalReport.overallAccuracyPercent}%`} />
          <ResultTile label="Subject switches" value={`${finalReport.contextShiftsCount}`} />
          <ResultTile label="Right after a switch" value={`${finalReport.switchAccuracyPercent}%`} />
          <ResultTile label="Same subject" value={`${finalReport.stableAccuracyPercent}%`} />
        </div>

        <Card className="space-y-2">
          <h2 className="text-[15px] font-semibold text-ink">What this means</h2>
          <p className="text-[14px] leading-relaxed text-ink-muted">
            {finalReport.contextShiftsCount === 0
              ? 'There were no subject switches this time. Pick decks from different subjects to practise switching.'
              : switchDelta < -10
                ? `You remembered ${Math.abs(switchDelta)} points less right after switching subjects. That gap is what mixed practice trains: it should shrink as you do more of it.`
                : 'You remembered about as well right after switching subjects as when the subject stayed the same. Good sign that you can tell these topics apart.'}
          </p>
          <p className="text-xs text-ink-subtle">These figures come from your own ratings (Good or Easy count as remembered).</p>
        </Card>

        <section aria-labelledby="by-subject" className="space-y-3">
          <h2 id="by-subject" className="text-[15px] font-semibold text-ink">By subject</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {finalReport.domainBreakdown.map(item => (
              <li key={item.domain} className="space-y-2 px-4 py-3.5">
                <div className="flex items-center justify-between gap-3 text-[14px]">
                  <span className="flex min-w-0 items-center gap-2 font-medium text-ink">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${subjectDot(item.domain)}`} aria-hidden="true" />
                    <span className="truncate">{item.domain}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-ink-muted">
                    {item.correct} of {item.total} · <span className="font-medium text-ink">{item.accuracyPercent}%</span>
                  </span>
                </div>
                <ProgressBar value={item.accuracyPercent} label={`${item.domain} remembered`} />
              </li>
            ))}
          </ul>
        </section>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" icon={RotateCcw} onClick={() => setArenaPhase('setup')}>
            Mix again
          </Button>
          <Button variant="primary" trailingIcon={ArrowRight} onClick={onBack}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  return null;
};

const ResultTile: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-2xl border border-line bg-surface p-4">
    <p className="text-[13px] text-ink-subtle">{label}</p>
    <p className="mt-1.5 text-[24px] font-semibold leading-none tracking-tight tabular-nums text-ink">{value}</p>
  </div>
);
