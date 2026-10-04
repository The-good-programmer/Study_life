import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  Zap, 
  HelpCircle, 
  Eye, 
  CheckCircle2, 
  RotateCw, 
  Timer, 
  Sparkles, 
  Brain, 
  ArrowRight,
  Check,
  FileText,
  Gamepad2,
  X,
  Star
} from 'lucide-react';
import type { CardType, ConceptCheckpoint, FSRSRating, RetrievalCard, DiagnosticDistractor } from '../../types';
import { FSRSService } from '../../services/fsrsService';
import { StorageService } from '../../services/storageService';
import { soundEngine } from '../../services/soundEngine';
import { AIService } from '../../services/aiService';
import { MathRenderer } from '../common/MathRenderer';
import { gamepadService, type GamepadAction } from '../../services/gamepadService';
import confetti from 'canvas-confetti';
import { StudyHUD } from './StudyHUD';
import { ScienceExplainerModal } from '../common/ScienceExplainerModal';
import { haptics } from '../../services/hapticsService';

interface RetrievalPhaseProps {
  concept: ConceptCheckpoint;
  onComplete: () => void;
  onInspectSource?: (pageNumber?: number) => void;
  allConcepts?: ConceptCheckpoint[];
  conceptIndex?: number;
}

export const RetrievalPhase: React.FC<RetrievalPhaseProps> = ({ 
  concept, 
  onComplete,
  onInspectSource,
  allConcepts,
  conceptIndex,
}) => {
  const [interleaveEnabled, setInterleaveEnabled] = useState(true);

  // In-Flight Interleaving: Blends 1-2 flashcards from prior checkpoints in the session
  const { cards, interleaveMap } = useMemo(() => {
    const currentCards = concept.retrievalCards || [];
    if (!allConcepts || conceptIndex === undefined || conceptIndex === 0 || !interleaveEnabled) {
      return { cards: currentCards, interleaveMap: new Map<string, string>() };
    }

    const priorCardsWithOrigin: { card: RetrievalCard; originTitle: string }[] = [];
    allConcepts.slice(0, conceptIndex).forEach(pc => {
      (pc.retrievalCards || []).forEach(rc => {
        priorCardsWithOrigin.push({ card: rc, originTitle: pc.title });
      });
    });

    if (priorCardsWithOrigin.length === 0) {
      return { cards: currentCards, interleaveMap: new Map<string, string>() };
    }

    const countToPick = Math.min(2, Math.max(1, Math.round(currentCards.length * 0.4)));
    const picked = [...priorCardsWithOrigin]
      .sort((a, b) => {
        const hashA = (a.card.id.charCodeAt(0) * 31 + concept.id.charCodeAt(0)) % 17;
        const hashB = (b.card.id.charCodeAt(0) * 31 + concept.id.charCodeAt(0)) % 17;
        return hashA - hashB;
      })
      .slice(0, countToPick);

    const map = new Map<string, string>();
    picked.forEach(p => map.set(p.card.id, p.originTitle));

    const combined = [...currentCards];
    picked.forEach((p, idx) => {
      const targetPos = Math.min(combined.length, 1 + idx * 2);
      combined.splice(targetPos, 0, p.card);
    });

    return { cards: combined, interleaveMap: map };
  }, [concept, allConcepts, conceptIndex, interleaveEnabled]);

  const [activeTab, setActiveTab] = useState<'cards' | 'blurting'>('cards');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  // Gamepad Controller & Mobile Ergonomics State
  const [gamepadConnected, setGamepadConnected] = useState(false);
  const [gamepadName, setGamepadName] = useState<string | null>(null);
  const [lastGamepadAction, setLastGamepadAction] = useState<string | null>(null);
  const [showErgonomicsHelp, setShowErgonomicsHelp] = useState(false);
  const [touchFeedback, setTouchFeedback] = useState<string | null>(null);
  const [starredCardIds, setStarredCardIds] = useState<Set<string>>(() => {
    return new Set((concept.retrievalCards || []).filter(c => c.isStarred).map(c => c.id));
  });
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const [touchOffset, setTouchOffset] = useState<{ x: number; y: number } | null>(null);
  const [isSwipingActive, setIsSwipingActive] = useState(false);
  const mouseStartX = useRef<number | null>(null);
  const mouseStartY = useRef<number | null>(null);
  const isMouseDown = useRef<boolean>(false);
  const [showScienceModal, setShowScienceModal] = useState(false);

  // Dynamic Mascot & Combo Feedback State
  const [combo, setCombo] = useState<number>(0);
  const [lastRating, setLastRating] = useState<FSRSRating | null>(null);

  const handleRevealAnswer = useCallback(() => {
    setIsAnswerRevealed(true);
    haptics.medium();
    soundEngine.playContextShiftSound();
  }, []);

  const handleToggleReveal = useCallback(() => {
    setIsAnswerRevealed(prev => {
      const next = !prev;
      if (next) {
        haptics.medium();
        soundEngine.playContextShiftSound();
      }
      return next;
    });
  }, []);

  // 60-Second Blurting Method State
  const [blurtingText, setBlurtingText] = useState('');
  const [blurtingSeconds, setBlurtingSeconds] = useState(60);
  const [isBlurtingRunning, setIsBlurtingRunning] = useState(false);
  const [blurtingResult, setBlurtingResult] = useState<{ recalled: string[]; missed: string[] } | null>(null);

  const currentCard = cards[currentIndex];
  const [misconception, setMisconception] = useState<DiagnosticDistractor | null>(null);
  const [hintLevel, setHintLevel] = useState<number>(0);

  const hintLadder = useMemo(() => {
    if (!currentCard) return null;
    return AIService.getSocraticHintLadder(currentCard, concept);
  }, [currentCard, concept]);

  const [interactiveMode, setInteractiveMode] = useState<boolean>(true);

  const effectiveType: CardType = currentCard
    ? (currentCard.cardType || (
        currentCard.imageUrl && currentCard.masks && currentCard.masks.length > 0
          ? 'image-occlusion'
          : currentCard.clozeTemplate || currentCard.question.includes('{{')
          ? 'cloze'
          : (currentCard.options && currentCard.options.length > 0 ? 'multiple-choice' : 'standard')
      ))
    : 'standard';

  // Smart distractor generation: dynamically creates 4-choice interactive quiz options for standard cards
  const computedOptions = useMemo(() => {
    if (!currentCard) return [];
    if (currentCard.options && currentCard.options.length > 0) {
      return currentCard.options;
    }
    // Gather candidate answers from other cards in this deck or concept
    const otherAnswers = cards
      .filter(c => c.id !== currentCard.id && c.answer && c.answer.trim().toLowerCase() !== currentCard.answer.trim().toLowerCase())
      .map(c => c.answer.trim());
    
    // Also gather key terms if available
    const keyTerms = (concept.keyTerms || [])
      .map(t => t.term.trim())
      .filter(t => t.toLowerCase() !== currentCard.answer.trim().toLowerCase());

    const pool = Array.from(new Set([...otherAnswers, ...keyTerms]));
    if (pool.length < 2) {
      return [];
    }

    // Deterministic seeded Fisher-Yates shuffle based on card ID to ensure stable options across renders
    let seed = 0;
    for (let i = 0; i < currentCard.id.length; i++) {
      seed = (seed * 31 + currentCard.id.charCodeAt(i)) >>> 0;
    }
    const pseudoRandom = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    const shuffledPool = [...pool];
    for (let i = shuffledPool.length - 1; i > 0; i--) {
      const j = Math.floor(pseudoRandom() * (i + 1));
      [shuffledPool[i], shuffledPool[j]] = [shuffledPool[j], shuffledPool[i]];
    }
    const selectedDistractors = shuffledPool.slice(0, 3);

    const allOpts = [currentCard.answer, ...selectedDistractors];
    for (let i = allOpts.length - 1; i > 0; i--) {
      const j = Math.floor(pseudoRandom() * (i + 1));
      [allOpts[i], allOpts[j]] = [allOpts[j], allOpts[i]];
    }
    return allOpts;
  }, [currentCard, cards, concept.keyTerms]);

  const hasInteractiveOptions = interactiveMode && (
    (currentCard?.options && currentCard.options.length > 0) ||
    computedOptions.length >= 3
  );

  const activeOptions = useMemo(() => {
    if (currentCard?.options && currentCard.options.length > 0) {
      return currentCard.options;
    }
    return computedOptions;
  }, [currentCard, computedOptions]);

  const handleRate = useCallback((rating: FSRSRating) => {
    if (!currentCard) return;

    // Schedule through FSRS algorithm
    const { updatedCard } = FSRSService.schedule(currentCard, rating);
    StorageService.saveCard(updatedCard);

    // Reward XP
    const xpGained = rating === 'easy' ? 15 : 10;
    StorageService.addWeeklyXP(xpGained);

    setLastRating(rating);

    // Audio, haptics & combo feedback
    if (rating === 'again') {
      setCombo(0);
      haptics.warning();
      soundEngine.playIncorrectChime();
    } else {
      haptics.success();
      setCombo(prev => {
        const nextCombo = prev + 1;
        if (nextCombo === 3 || nextCombo === 5 || nextCombo === 10) {
          confetti({
            particleCount: 25,
            spread: 55,
            origin: { y: 0.8 },
            colors: ['#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b']
          });
        }
        soundEngine.playComboChime(rating === 'easy' ? nextCombo + 1 : nextCombo);
        return nextCombo;
      });
    }

    if (currentIndex + 1 < cards.length) {
      setCurrentIndex(prev => prev + 1);
      setIsAnswerRevealed(false);
      setHintLevel(0);
      setSelectedOption(null);
      setIsCorrect(null);
      setMisconception(null);
    } else {
      soundEngine.playCompletionChime();
      StorageService.recordMasteredConcept();
      onComplete();
    }
  }, [currentCard, currentIndex, cards.length, onComplete]);

  const handleSelectOption = useCallback((option: string) => {
    if (selectedOption !== null || !currentCard) return;
    setSelectedOption(option);
    
    // Resilient matching: handle "A) Option", "1. Option", or exact text
    const cleanOpt = option.replace(/^[a-d1-4][).\s-]+\s*/i, '').trim().toLowerCase();
    const cleanAns = currentCard.answer.replace(/^[a-d1-4][).\s-]+\s*/i, '').trim().toLowerCase();
    const rawOpt = option.trim().toLowerCase();
    const rawAns = currentCard.answer.trim().toLowerCase();

    const correct = rawOpt === rawAns || cleanOpt === cleanAns || cleanOpt === rawAns || rawOpt === cleanAns;
    setIsCorrect(correct);
    handleRevealAnswer();
    if (correct) {
      setMisconception(null);
      setCombo(prev => {
        const nextCombo = prev + 1;
        haptics.combo(nextCombo);
        soundEngine.playComboChime(nextCombo);
        if (nextCombo === 3 || nextCombo === 5 || nextCombo === 10) {
          confetti({
            particleCount: 25,
            spread: 55,
            origin: { y: 0.8 },
            colors: ['#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b']
          });
        }
        return nextCombo;
      });
    } else {
      const diag = AIService.diagnoseMisconception(currentCard, option, concept);
      setMisconception(diag);
      haptics.warning();
      soundEngine.playIncorrectChime();
      setCombo(0);
    }
  }, [selectedOption, currentCard, concept, handleRevealAnswer]);

  // Global Keyboard Shortcuts (Space to flip, 1-4 to rate / pick options)
  useEffect(() => {
    if (activeTab !== 'cards' || !currentCard) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // If bottom feedback banner is showing, Enter advances to next card immediately
      if (e.key === 'Enter' && isAnswerRevealed && selectedOption !== null) {
        e.preventDefault();
        handleRate(isCorrect ? 'good' : 'again');
        return;
      }

      // If interactive options and not revealed yet, allow A, B, C, D or 1, 2, 3, 4 to pick option
      if ((effectiveType === 'multiple-choice' || hasInteractiveOptions) && !isAnswerRevealed && activeOptions.length > 0) {
        const key = e.key.toUpperCase();
        let pickIdx = -1;
        if (key === 'A' || key === '1') pickIdx = 0;
        else if (key === 'B' || key === '2') pickIdx = 1;
        else if (key === 'C' || key === '3') pickIdx = 2;
        else if (key === 'D' || key === '4') pickIdx = 3;

        if (pickIdx >= 0 && pickIdx < activeOptions.length) {
          e.preventDefault();
          handleSelectOption(activeOptions[pickIdx]);
          return;
        }
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleToggleReveal();
      } else if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        setHintLevel(prev => (prev >= 3 ? 0 : prev + 1));
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        if (currentCard) {
          const newStatus = StorageService.toggleCardStar(currentCard.id);
          setStarredCardIds(prev => {
            const next = new Set(prev);
            if (newStatus) next.add(currentCard.id);
            else next.delete(currentCard.id);
            return next;
          });
          soundEngine.playSuccess();
        }
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
  }, [activeTab, isAnswerRevealed, handleRate, effectiveType, currentCard, handleSelectOption, handleToggleReveal, hasInteractiveOptions, isCorrect, selectedOption, activeOptions]);

  // Web Gamepad Controller Integration (8BitDo, Joy-Cons, Xbox, PlayStation)
  useEffect(() => {
    const unsubStatus = gamepadService.subscribeStatus((status) => {
      setGamepadConnected(status.connected);
      setGamepadName(status.name);
      if (status.connected) {
        soundEngine.playSocraticChallengeChime();
      }
    });

    const unsubAction = gamepadService.subscribeAction((action: GamepadAction) => {
      if (activeTab !== 'cards' || !currentCard) return;

      setLastGamepadAction(action);
      setTimeout(() => setLastGamepadAction(null), 1200);

      switch (action) {
        case 'flip':
          if (!isAnswerRevealed) {
            handleRevealAnswer();
          } else {
            handleRate('good');
          }
          break;
        case 'again':
          if (isAnswerRevealed) handleRate('again');
          else handleRevealAnswer();
          break;
        case 'hard':
          if (isAnswerRevealed) handleRate('hard');
          else handleRevealAnswer();
          break;
        case 'good':
          if (isAnswerRevealed) handleRate('good');
          else handleRevealAnswer();
          break;
        case 'easy':
          if (isAnswerRevealed) handleRate('easy');
          else handleRevealAnswer();
          break;
        case 'hint':
          setHintLevel(prev => (prev >= 3 ? 0 : prev + 1));
          break;
        default:
          break;
      }
    });

    return () => {
      unsubStatus();
      unsubAction();
    };
  }, [activeTab, currentCard, isAnswerRevealed, handleRate, handleRevealAnswer]);

  // Live Tactile Gestures (Swipe Left: Again, Right: Good, Up: Easy, Down: Hard)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches && e.touches.length > 0) {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      setIsSwipingActive(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null || !e.touches || e.touches.length === 0) return;
    const deltaX = e.touches[0].clientX - touchStartX.current;
    const deltaY = e.touches[0].clientY - touchStartY.current;
    if (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6) {
      setTouchOffset({ x: deltaX, y: deltaY });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) {
      setTouchOffset(null);
      setIsSwipingActive(false);
      return;
    }

    const clientX = e.changedTouches && e.changedTouches.length > 0
      ? e.changedTouches[0].clientX
      : (touchOffset ? touchStartX.current + touchOffset.x : touchStartX.current);
    const clientY = e.changedTouches && e.changedTouches.length > 0
      ? e.changedTouches[0].clientY
      : (touchOffset ? touchStartY.current + touchOffset.y : touchStartY.current);

    const deltaX = clientX - touchStartX.current;
    const deltaY = clientY - touchStartY.current;

    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (absX > 60 && absX > absY) {
      // Horizontal swipe
      if (deltaX > 0) {
        setTouchFeedback('Swipe Right: Good');
        setTimeout(() => setTouchFeedback(null), 1000);
        if (isAnswerRevealed) handleRate('good');
        else handleRevealAnswer();
      } else {
        setTouchFeedback('Swipe Left: Again');
        setTimeout(() => setTouchFeedback(null), 1000);
        if (isAnswerRevealed) handleRate('again');
        else handleRevealAnswer();
      }
    } else if (absY > 60 && absY > absX) {
      // Vertical swipe
      if (deltaY < 0) {
        setTouchFeedback('Swipe Up: Easy');
        setTimeout(() => setTouchFeedback(null), 1000);
        if (isAnswerRevealed) handleRate('easy');
        else handleRevealAnswer();
      } else {
        setTouchFeedback('Swipe Down: Hard');
        setTimeout(() => setTouchFeedback(null), 1000);
        if (isAnswerRevealed) handleRate('hard');
        else handleRevealAnswer();
      }
    }

    touchStartX.current = null;
    touchStartY.current = null;
    setTouchOffset(null);
    setIsSwipingActive(false);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('textarea') || target.closest('a')) {
      return;
    }
    mouseStartX.current = e.clientX;
    mouseStartY.current = e.clientY;
    isMouseDown.current = true;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDown.current || mouseStartX.current === null || mouseStartY.current === null) return;
    const deltaX = e.clientX - mouseStartX.current;
    const deltaY = e.clientY - mouseStartY.current;
    if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
      setTouchOffset({ x: deltaX, y: deltaY });
      setIsSwipingActive(true);
    }
  };

  const handleMouseUp = () => {
    if (!isMouseDown.current) return;
    if (touchOffset) {
      const absX = Math.abs(touchOffset.x);
      const absY = Math.abs(touchOffset.y);
      if (absX > 60 && absX > absY) {
        if (touchOffset.x > 0) {
          if (isAnswerRevealed) handleRate('good');
          else handleRevealAnswer();
        } else {
          if (isAnswerRevealed) handleRate('again');
          else handleRevealAnswer();
        }
      } else if (absY > 60 && absY > absX) {
        if (touchOffset.y < 0) {
          if (isAnswerRevealed) handleRate('easy');
          else handleRevealAnswer();
        } else {
          if (isAnswerRevealed) handleRate('hard');
          else handleRevealAnswer();
        }
      }
    }
    isMouseDown.current = false;
    mouseStartX.current = null;
    mouseStartY.current = null;
    setTouchOffset(null);
    setIsSwipingActive(false);
  };

  const blurtingTargets = useMemo<string[]>(() => {
    if (concept.keyTerms && concept.keyTerms.length > 0) {
      return concept.keyTerms.map(k => k.term);
    }
    if (concept.coreTakeaways && concept.coreTakeaways.length > 0) {
      return concept.coreTakeaways;
    }
    return (concept.retrievalCards || []).map(c => c.answer);
  }, [concept.keyTerms, concept.coreTakeaways, concept.retrievalCards]);

  const handleEvaluateBlurting = useCallback(() => {
    setIsBlurtingRunning(false);
    const lower = blurtingText.toLowerCase();

    const recalledTerms = blurtingTargets
      .filter(term => lower.includes(term.toLowerCase()));

    const missedTerms = blurtingTargets
      .filter(term => !lower.includes(term.toLowerCase()));

    setBlurtingResult({
      recalled: recalledTerms,
      missed: missedTerms,
    });

    soundEngine.playCompletionChime();
    StorageService.addWeeklyXP(40);
  }, [blurtingText, blurtingTargets]);

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

    return () => clearInterval(timer);
  }, [isBlurtingRunning]);

  if (!currentCard && activeTab === 'cards') {
    return (
      <div className="p-8 text-center text-slate-300 glass-panel rounded-3xl">
        <p>No retrieval cards found for this concept.</p>
        <button
          onClick={onComplete}
          className="mt-4 px-6 py-3 rounded-2xl bg-indigo-600 text-white font-semibold text-xs"
        >
          Continue
        </button>
      </div>
    );
  }

  const intervals = currentCard ? FSRSService.previewIntervals(currentCard) : null;
  const progressPercent = cards.length > 0 ? Math.round(((currentIndex) / cards.length) * 100) : 0;

  // Real-time recognition in Blurting
  const liveRecognizedTerms = blurtingTargets.filter(term => 
    blurtingText.toLowerCase().includes(term.toLowerCase())
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn py-2">
      
      {/* Header & Mode Switcher */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-amber-950/40 border border-amber-500/25 backdrop-blur-md">
        <div className="flex items-center gap-3 text-xs sm:text-sm text-amber-300">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-white font-display">Step 2: Interactive Practice</div>
            <div className="text-[11px] text-amber-300/80">
              Keep your streak going! Tap the correct answer to build your combo.
            </div>
          </div>
        </div>

        {/* Mode Toggle: Quiz vs Flip vs Blurting vs Interleaving */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {allConcepts && conceptIndex !== undefined && conceptIndex > 0 && (
            <button
              type="button"
              onClick={() => setInterleaveEnabled(prev => !prev)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border ${
                interleaveEnabled
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                  : 'bg-slate-950/80 text-slate-400 border-white/[0.08] hover:text-white'
              }`}
              title="Mix in questions from earlier topics to strengthen retention"
            >
              <Brain className="w-3.5 h-3.5 text-amber-400" />
              <span>Mix: {interleaveEnabled ? 'ON' : 'OFF'}</span>
            </button>
          )}

          <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-white/[0.08] text-xs font-semibold shrink-0">
            <button
              type="button"
              onClick={() => setInteractiveMode(prev => !prev)}
              className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                interactiveMode
                  ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-white font-bold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Toggle interactive multiple-choice quiz vs classic flip cards"
            >
              <Zap className="w-3 h-3" />
              <span>{interactiveMode ? 'Quiz' : 'Flip'}</span>
            </button>
            <button
              onClick={() => setActiveTab('cards')}
              className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'cards'
                  ? 'bg-indigo-600 text-white shadow font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Cards
            </button>
            <button
              onClick={() => setActiveTab('blurting')}
              className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                activeTab === 'blurting'
                  ? 'bg-purple-600 text-white shadow font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Brain className="w-3 h-3" />
              <span>Speed Recall</span>
            </button>
          </div>
        </div>
      </div>

      {/* MODE 1: Flashcards Arena */}
      {activeTab === 'cards' && currentCard && intervals && (
        <div className="space-y-4">
          
          {/* Study HUD & Dynamic Combo Counter */}
          <StudyHUD
            currentIndex={currentIndex}
            totalCards={cards.length}
            lastRating={lastRating}
            combo={combo}
            isAnswerRevealed={isAnswerRevealed}
            gamepadConnected={gamepadConnected}
            gamepadName={gamepadName}
            onOpenShortcuts={() => setShowErgonomicsHelp(true)}
          />

          {/* Card progress scrubber & Ergonomic Hardware / Touch HUD */}
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono px-1">
            <div className="flex items-center gap-2">
              {interleaveMap.has(currentCard.id) && (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-mono font-bold flex items-center gap-1.5 shadow-sm">
                  <Brain className="w-3 h-3 text-amber-400" />
                  <span>Delayed Recall • {interleaveMap.get(currentCard.id)}</span>
                </span>
              )}
              
              {lastGamepadAction && (
                <span className="px-1.5 py-0.5 rounded bg-indigo-500/30 text-indigo-200 border border-indigo-500/40 text-[11px] font-mono animate-bounce">
                  Pad: {lastGamepadAction.toUpperCase()}
                </span>
              )}

              {touchFeedback && (
                <span className="px-1.5 py-0.5 rounded bg-purple-500/30 text-purple-200 border border-purple-500/40 text-[11px] font-mono animate-fadeIn">
                  {touchFeedback}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="w-24 sm:w-32 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-[11px] font-bold text-slate-400 font-mono">{progressPercent}%</span>
            </div>
          </div>

          {/* Realistic Card Deck Container with stacked card silhouette */}
          <div className="relative group">
            {/* Background stacked shadow layer */}
            <div className="absolute -inset-1.5 rounded-[28px] bg-indigo-500/10 blur-sm pointer-events-none" />
            <div className="absolute top-2 inset-x-2 h-full rounded-3xl bg-slate-900/60 border border-white/[0.04] pointer-events-none transform translate-y-1" />

            {/* Main Interactive Card */}
            <div 
              onClick={() => {
                if (!isSwipingActive && !touchOffset && !isAnswerRevealed && effectiveType !== 'multiple-choice') {
                  handleRevealAnswer();
                }
              }}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{
                touchAction: 'pan-y',
                transform: touchOffset 
                  ? `translate3d(${touchOffset.x}px, ${touchOffset.y * 0.4}px, 0) rotate(${touchOffset.x * 0.05}deg)` 
                  : undefined,
                transition: touchOffset ? 'none' : 'transform 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.3s ease, border-color 0.3s ease',
              }}
              className={`relative min-h-[380px] rounded-3xl glass-panel p-6 sm:p-8 flex flex-col justify-between select-none ${
                effectiveType !== 'multiple-choice' && !isAnswerRevealed ? 'cursor-grab active:cursor-grabbing hover:border-indigo-500/40 hover:shadow-xl' : ''
              } ${
                isAnswerRevealed 
                  ? 'border-indigo-500/50 shadow-2xl shadow-indigo-500/15' 
                  : ''
              }`}
            >
              {/* Dynamic Tactile Swipe Direction Stamps */}
              {touchOffset && touchOffset.x > 30 && Math.abs(touchOffset.x) > Math.abs(touchOffset.y) && (
                <div 
                  className="absolute top-6 left-6 z-30 pointer-events-none px-4 py-2 rounded-2xl bg-emerald-500/95 text-white font-black text-sm uppercase tracking-wider border-2 border-emerald-300 shadow-xl rotate-[-10deg] flex items-center gap-1.5 animate-pulse"
                  style={{ opacity: Math.min(1, (touchOffset.x - 20) / 45) }}
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>{isAnswerRevealed ? 'GOOD' : 'REVEAL'}</span>
                </div>
              )}

              {touchOffset && touchOffset.x < -30 && Math.abs(touchOffset.x) > Math.abs(touchOffset.y) && (
                <div 
                  className="absolute top-6 right-6 z-30 pointer-events-none px-4 py-2 rounded-2xl bg-rose-500/95 text-white font-black text-sm uppercase tracking-wider border-2 border-rose-300 shadow-xl rotate-[10deg] flex items-center gap-1.5 animate-pulse"
                  style={{ opacity: Math.min(1, (-touchOffset.x - 20) / 45) }}
                >
                  <X className="w-4 h-4 stroke-[3]" />
                  <span>{isAnswerRevealed ? 'AGAIN' : 'REVEAL'}</span>
                </div>
              )}

              {touchOffset && touchOffset.y < -30 && Math.abs(touchOffset.y) > Math.abs(touchOffset.x) && (
                <div 
                  className="absolute bottom-6 inset-x-0 mx-auto w-fit z-30 pointer-events-none px-4 py-2 rounded-2xl bg-cyan-500/95 text-white font-black text-sm uppercase tracking-wider border-2 border-cyan-300 shadow-xl flex items-center gap-1.5 animate-pulse"
                  style={{ opacity: Math.min(1, (-touchOffset.y - 20) / 45) }}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isAnswerRevealed ? 'EASY' : 'REVEAL'}</span>
                </div>
              )}

              {touchOffset && touchOffset.y > 30 && Math.abs(touchOffset.y) > Math.abs(touchOffset.x) && (
                <div 
                  className="absolute top-6 inset-x-0 mx-auto w-fit z-30 pointer-events-none px-4 py-2 rounded-2xl bg-amber-500/95 text-white font-black text-sm uppercase tracking-wider border-2 border-amber-300 shadow-xl flex items-center gap-1.5 animate-pulse"
                  style={{ opacity: Math.min(1, (touchOffset.y - 20) / 45) }}
                >
                  <Timer className="w-4 h-4" />
                  <span>{isAnswerRevealed ? 'HARD' : 'REVEAL'}</span>
                </div>
              )}

              {/* Question & Interaction Area */}
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-slate-400 uppercase tracking-wider font-bold font-display">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      effectiveType === 'image-occlusion'
                        ? 'bg-emerald-400'
                        : effectiveType === 'cloze' 
                        ? 'bg-purple-400' 
                        : effectiveType === 'multiple-choice' 
                        ? 'bg-sky-400' 
                        : 'bg-indigo-400'
                    }`} />
                    <span>
                      {effectiveType === 'image-occlusion'
                        ? 'Image Occlusion Recall'
                        : effectiveType === 'cloze' 
                        ? 'Cloze Deletion Recall' 
                        : effectiveType === 'multiple-choice' 
                        ? 'Multiple Choice Diagnostic' 
                        : 'Target Concept Recall'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {currentCard && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const newStatus = StorageService.toggleCardStar(currentCard.id);
                          setStarredCardIds(prev => {
                            const next = new Set(prev);
                            if (newStatus) next.add(currentCard.id);
                            else next.delete(currentCard.id);
                            return next;
                          });
                          soundEngine.playSuccess();
                        }}
                        className="p-1 rounded-lg hover:bg-white/[0.1] text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
                        title={starredCardIds.has(currentCard.id) ? 'Unstar card (Press S)' : 'Star card for priority drill (Press S)'}
                      >
                        <Star className={`w-3.5 h-3.5 ${starredCardIds.has(currentCard.id) ? 'fill-amber-400 text-amber-400' : ''}`} />
                      </button>
                    )}

                    {(currentCard?.sourceAnchor || concept.sourceAnchor) && onInspectSource && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const target = currentCard?.sourceAnchor?.pageNumber || concept.sourceAnchor?.pageNumber;
                          onInspectSource(target);
                        }}
                        className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-900/90 hover:bg-indigo-950/80 text-indigo-300 hover:text-indigo-200 border border-indigo-500/30 flex items-center gap-1 transition-all hover:scale-105 shadow-sm"
                        title={`Inspect Ground Truth on Page ${(currentCard?.sourceAnchor || concept.sourceAnchor)?.pageNumber}`}
                      >
                        <FileText className="w-3 h-3 text-indigo-400" />
                        <span>Source: p.{(currentCard?.sourceAnchor || concept.sourceAnchor)?.pageNumber}</span>
                      </button>
                    )}

                    <span className={`text-[11px] font-mono px-2.5 py-0.5 rounded-full border ${
                      effectiveType === 'image-occlusion'
                        ? (isAnswerRevealed ? 'text-emerald-300 bg-emerald-950/80 border-emerald-500/30' : 'text-amber-300 bg-amber-950/80 border-amber-500/30')
                        : effectiveType === 'cloze'
                        ? 'text-purple-300 bg-purple-950/80 border-purple-500/30'
                        : effectiveType === 'multiple-choice'
                        ? (isAnswerRevealed ? (isCorrect ? 'text-emerald-300 bg-emerald-950/80 border-emerald-500/30' : 'text-rose-300 bg-rose-950/80 border-rose-500/30') : 'text-sky-300 bg-sky-950/80 border-sky-500/30')
                        : 'text-indigo-300 bg-indigo-950/80 border-indigo-500/30'
                    }`}>
                      {isAnswerRevealed 
                        ? (effectiveType === 'multiple-choice' ? (isCorrect ? '✓ Correct' : '✗ Review Answer') : 'Revealed') 
                        : (effectiveType === 'multiple-choice' ? 'Select Option [A-D / 1-4]' : 'Tap Card or Press Space')}
                    </span>
                  </div>
                </div>

                {/* Cloze Deletion Content */}
                {effectiveType === 'cloze' && (
                  <div className="pt-2">
                    {(() => {
                      const rawText = currentCard.clozeTemplate || currentCard.question;
                      if (rawText.includes('{{') && rawText.includes('}}')) {
                        const parts = rawText.split(/\{\{(.*?)\}\}/g);
                        return (
                          <div className="text-xl sm:text-2xl font-bold text-white leading-relaxed font-display">
                            {parts.map((segment, idx) => {
                              if (idx % 2 === 1) {
                                return !isAnswerRevealed ? (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRevealAnswer();
                                    }}
                                    className="inline-flex items-center gap-1 px-3 py-1 mx-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/35 border border-purple-500/50 text-purple-300 font-bold text-sm tracking-wide shadow-md transition-all animate-pulse align-middle"
                                  >
                                    <span>[ ? ]</span>
                                    <span className="text-[11px] font-normal opacity-80">Reveal</span>
                                  </button>
                                ) : (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center px-3 py-1 mx-1.5 rounded-xl bg-emerald-500/20 border border-emerald-400/60 text-emerald-300 font-extrabold text-sm tracking-wide shadow-inner animate-fadeIn align-middle"
                                  >
                                    {segment}
                                  </span>
                                );
                              }
                              return <span key={idx}><MathRenderer text={segment} /></span>;
                            })}
                          </div>
                        );
                      }
                      return (
                        <div className="space-y-4">
                          <h3 className="text-xl sm:text-2xl font-bold text-white leading-relaxed font-display">
                            <MathRenderer text={currentCard.question} />
                          </h3>
                          <div className="p-4 rounded-2xl bg-purple-950/30 border border-purple-500/30 flex items-center justify-between">
                            <span className="text-sm text-purple-200">Missing Key Term:</span>
                            {!isAnswerRevealed ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRevealAnswer();
                                }}
                                className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md transition-all"
                              >
                                Reveal Blank [ ? ]
                              </button>
                            ) : (
                              <span className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 font-extrabold text-sm font-mono">
                                {currentCard.answer}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Multiple Choice & Interactive Quiz Content */}
                {(effectiveType === 'multiple-choice' || hasInteractiveOptions) && (
                  <div className="space-y-4 pt-1">
                    <h3 className="text-xl sm:text-2xl font-bold text-white leading-relaxed font-display">
                      <MathRenderer text={currentCard.question} />
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                      {activeOptions.map((opt, idx) => {
                        const letter = ['A', 'B', 'C', 'D'][idx] || String(idx + 1);
                        const isThisCorrect = opt.trim().toLowerCase() === currentCard.answer.trim().toLowerCase();
                        const isSelected = selectedOption === opt;

                        let buttonStyle = 'bg-slate-900/80 hover:bg-slate-800 border-white/[0.08] hover:border-indigo-500/50 text-slate-200 hover:scale-[1.01]';
                        if (isAnswerRevealed) {
                          if (isThisCorrect) {
                            buttonStyle = 'bg-emerald-950/70 border-emerald-500 text-emerald-200 shadow-lg shadow-emerald-500/20 scale-[1.01]';
                          } else if (isSelected) {
                            buttonStyle = 'bg-rose-950/70 border-rose-500 text-rose-200';
                          } else {
                            buttonStyle = 'bg-slate-950/40 border-white/[0.04] text-slate-500 opacity-60';
                          }
                        }

                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              soundEngine.playTapPop();
                              haptics.pop();
                              handleSelectOption(opt);
                            }}
                            disabled={isAnswerRevealed}
                            className={`p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3 relative cursor-pointer ${buttonStyle}`}
                          >
                            <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold font-mono shrink-0 ${
                              isAnswerRevealed && isThisCorrect
                                ? 'bg-emerald-500 text-slate-950'
                                : isAnswerRevealed && isSelected
                                ? 'bg-rose-500 text-white'
                                : 'bg-white/[0.08] text-slate-300'
                            }`}>
                              {letter}
                            </span>
                            <div className="text-sm font-medium leading-snug pt-0.5 font-sans">
                              <MathRenderer text={opt} />
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {isAnswerRevealed && (
                      <div className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between animate-fadeIn ${
                        isCorrect 
                          ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300' 
                          : 'bg-rose-950/60 border-rose-500/50 text-rose-200'
                      }`}>
                        <div className="flex items-center gap-2">
                          {isCorrect ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <RotateCw className="w-4 h-4 text-rose-400" />}
                          <span className="font-bold">
                            {isCorrect ? 'Accurate recall! Synaptic trace reinforced.' : `Target Answer: ${currentCard.answer}`}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-xs">{isCorrect ? '+10 XP' : 'FSRS Grading Below'}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Image Occlusion Card Content */}
                {effectiveType === 'image-occlusion' && currentCard.imageUrl && (
                  <div className="space-y-4 pt-1">
                    <h3 className="text-base sm:text-lg font-bold text-white leading-relaxed font-display">
                      <MathRenderer text={currentCard.question} />
                    </h3>

                    <div className="relative w-full rounded-2xl overflow-hidden bg-slate-950/80 border border-white/[0.08] flex items-center justify-center p-2 shadow-inner select-none">
                      <img
                        src={currentCard.imageUrl}
                        alt="Anatomical or Technical Diagram"
                        className="w-full h-auto object-contain max-h-[380px] pointer-events-none rounded-xl"
                      />

                      {/* Overlaid Occlusion Masks */}
                      {(currentCard.masks || []).map((mask, idx) => {
                        const isTarget = mask.id === currentCard.activeMaskId;
                        const isRevealed = isTarget && isAnswerRevealed;

                        if (currentCard.occlusionMode === 'hide-one-reveal-one' && !isTarget) {
                          return null; // surrounding labels remain visible
                        }

                        if (isTarget) {
                          return (
                            <div
                              key={mask.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleReveal();
                              }}
                              className={`absolute rounded-lg flex items-center justify-center p-1 transition-all cursor-pointer shadow-xl ${
                                isRevealed
                                  ? 'bg-emerald-950/95 border-2 border-emerald-400 text-emerald-200 ring-2 ring-emerald-500/40'
                                  : 'bg-amber-950/95 border-2 border-amber-400 text-amber-200 animate-pulse ring-2 ring-amber-500/40 hover:scale-[1.02]'
                              }`}
                              style={{
                                left: `${mask.x}%`,
                                top: `${mask.y}%`,
                                width: `${mask.width}%`,
                                height: `${mask.height}%`,
                              }}
                            >
                              <span className="text-[11px] font-bold font-mono truncate px-1">
                                {isRevealed ? (mask.label || currentCard.answer) : `? [Mask #${idx + 1}]`}
                              </span>
                            </div>
                          );
                        }

                        // Non-target masks in Hide-All mode: solid opaque block
                        return (
                          <div
                            key={mask.id}
                            className="absolute rounded-lg bg-slate-900/95 border border-white/20 shadow-md"
                            style={{
                              left: `${mask.x}%`,
                              top: `${mask.y}%`,
                              width: `${mask.width}%`,
                              height: `${mask.height}%`,
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Standard Card Content (When interactive options not active) */}
                {effectiveType === 'standard' && !hasInteractiveOptions && (
                  <h3 className="text-xl sm:text-2xl font-bold text-white leading-relaxed font-display">
                    <MathRenderer text={currentCard.question} />
                  </h3>
                )}

                {/* 3-Tier Socratic Hint Ladder */}
                {!isAnswerRevealed && (
                  <div onClick={(e) => e.stopPropagation()} className="pt-2 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          haptics.light();
                          soundEngine.playTapPop();
                          setHintLevel(prev => (prev >= 3 ? 0 : prev + 1));
                        }}
                        className={`text-xs px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all font-semibold cursor-pointer ${
                          hintLevel > 0 
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm' 
                            : 'bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-amber-400 border-white/[0.08]'
                        }`}
                        title="Climb the 3-tier Socratic Hint Ladder"
                      >
                        <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                        <span>
                          {hintLevel === 0 && (currentCard.hint ? 'Need a hint? [H]' : 'Socratic Hint [H]')}
                          {hintLevel === 1 && '💡 Clue 1/3: Socratic Nudge'}
                          {hintLevel === 2 && '🌊 Clue 2/3: Physical Analogy'}
                          {hintLevel === 3 && '🔍 Clue 3/3: Core Simplification'}
                        </span>
                      </button>

                      {hintLevel > 0 && (
                        <button
                          type="button"
                          onClick={() => setHintLevel(0)}
                          className="text-[11px] text-slate-500 hover:text-slate-300 underline cursor-pointer"
                        >
                          Hide hints
                        </button>
                      )}
                    </div>

                    {hintLevel > 0 && hintLadder && (
                      <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-950/30 border border-amber-500/30 text-xs text-amber-200 animate-fadeIn space-y-2.5 font-sans">
                        {hintLevel >= 1 && (
                          <div className="flex items-start gap-2">
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[11px] uppercase font-bold shrink-0 mt-0.5">
                              1. Socratic Nudge
                            </span>
                            <span className="text-slate-200 leading-relaxed font-medium">
                              <MathRenderer text={hintLadder.level1Prompt} />
                            </span>
                          </div>
                        )}
                        {hintLevel >= 2 && (
                          <div className="flex items-start gap-2 pt-2 border-t border-amber-500/20">
                            <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[11px] uppercase font-bold shrink-0 mt-0.5">
                              2. Analogy Anchor
                            </span>
                            <span className="text-slate-200 leading-relaxed font-medium">
                              <MathRenderer text={hintLadder.level2Analogy} />
                            </span>
                          </div>
                        )}
                        {hintLevel >= 3 && (
                          <div className="flex items-start gap-2 pt-2 border-t border-amber-500/20">
                            <span className="px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-300 font-mono text-[11px] uppercase font-bold shrink-0 mt-0.5">
                              3. Core Deconstruction
                            </span>
                            <span className="text-slate-200 leading-relaxed font-medium">
                              <MathRenderer text={hintLadder.level3Deconstruction} />
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Target Answer Revealed */}
              {isAnswerRevealed ? (
                <div className="mt-6 pt-6 border-t border-white/[0.08] space-y-4 animate-fadeIn">
                  {effectiveType !== 'multiple-choice' && !hasInteractiveOptions && (
                    <>
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider font-display">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Target Recall Answer</span>
                      </div>
                      
                      <div className="text-base sm:text-lg font-medium text-slate-100 leading-relaxed font-sans">
                        <MathRenderer text={currentCard.answer} />
                      </div>
                    </>
                  )}

                  {currentCard.explanation && (
                    <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/[0.08] text-xs text-slate-300 leading-relaxed font-sans">
                      <span className="font-bold text-indigo-300 block mb-0.5 font-display">Cognitive Detail:</span>
                      <MathRenderer text={currentCard.explanation} />
                    </div>
                  )}

                  {(() => {
                    const diagram = currentCard.diagramDataUrl || StorageService.getConceptDiagram(currentCard.conceptId);
                    if (!diagram) return null;
                    return (
                      <div className="p-3.5 rounded-2xl bg-purple-950/20 border border-purple-500/30 space-y-2 animate-fadeIn">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-purple-300 font-display">
                          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                          <span>Dual-Coding Mental Model Diagram</span>
                        </div>
                        <div className="rounded-xl overflow-hidden bg-slate-950/90 border border-white/[0.06] p-2 flex justify-center">
                          <img
                            src={diagram}
                            alt="Hand-drawn conceptual diagram"
                            className="max-h-56 object-contain rounded-lg"
                          />
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (effectiveType !== 'multiple-choice' && !hasInteractiveOptions) ? (
                <div className="pt-8 flex flex-col items-center justify-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleReveal();
                    }}
                    className="btn-tactile btn-tactile-primary w-full sm:w-auto px-8 py-4 rounded-2xl text-white font-black text-sm sm:text-base flex items-center justify-center gap-3 cursor-pointer group"
                  >
                    <Eye className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
                    <span>Reveal Target Answer</span>
                    <kbd className="hidden sm:inline-block px-2 py-0.5 text-xs bg-black/30 border border-white/20 rounded text-white font-mono">
                      Space
                    </kbd>
                  </button>
                  <span className="text-xs text-slate-400 font-medium">Tap anywhere or press Space • Swipe left/right on mobile</span>
                </div>
              ) : null}

              {/* FSRS Rating Buttons (Shown for classic flip cards) */}
              {isAnswerRevealed && selectedOption === null && (
                <div 
                  onClick={(e) => e.stopPropagation()} 
                  className="mt-8 pt-6 border-t border-white/[0.08] space-y-3 animate-fadeIn"
                >
                  <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                    <span>Rate retrieval difficulty (FSRS scheduling):</span>
                    <span className="text-[11px] text-slate-500 hidden sm:inline font-mono">Press 1, 2, 3, or 4</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    
                    {/* Again [1] */}
                    <button
                      onClick={() => handleRate('again')}
                      className="btn-tactile btn-tactile-rose p-3.5 rounded-2xl text-left transition-all group"
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-white mb-1">
                        <div className="flex items-center gap-1.5">
                          <span>Again</span>
                          <kbd className="px-1.5 py-0.5 text-[11px] bg-black/30 rounded border border-white/20 text-white font-mono">
                            1
                          </kbd>
                        </div>
                        <RotateCw className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform" />
                      </div>
                      <div className="text-xs font-bold text-rose-100 font-mono">{intervals?.again || '1m'}</div>
                      <div className="text-[11px] text-rose-200 font-medium mt-0.5">Forgot / Repeat</div>
                    </button>

                    {/* Hard [2] */}
                    <button
                      onClick={() => handleRate('hard')}
                      className="btn-tactile btn-tactile-amber p-3.5 rounded-2xl text-left transition-all"
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-white mb-1">
                        <span>Hard</span>
                        <kbd className="px-1.5 py-0.5 text-[11px] bg-black/30 rounded border border-white/20 text-white font-mono">
                          2
                        </kbd>
                      </div>
                      <div className="text-xs font-bold text-amber-100 font-mono">{intervals?.hard || '1d'}</div>
                      <div className="text-[11px] text-amber-200 font-medium mt-0.5">Heavy effort</div>
                    </button>

                    {/* Good [3] */}
                    <button
                      onClick={() => handleRate('good')}
                      className="btn-tactile btn-tactile-primary p-3.5 rounded-2xl text-left transition-all"
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-white mb-1">
                        <span>Good</span>
                        <kbd className="px-1.5 py-0.5 text-[11px] bg-black/30 rounded border border-white/20 text-white font-mono">
                          3
                        </kbd>
                      </div>
                      <div className="text-xs font-bold text-indigo-100 font-mono">{intervals?.good || '3d'}</div>
                      <div className="text-[11px] text-indigo-200 font-medium mt-0.5">Correct recall</div>
                    </button>

                    {/* Easy [4] */}
                    <button
                      onClick={() => handleRate('easy')}
                      className="btn-tactile btn-tactile-emerald p-3.5 rounded-2xl text-left transition-all"
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-white mb-1">
                        <span>Easy</span>
                        <kbd className="px-1.5 py-0.5 text-[11px] bg-black/30 rounded border border-white/20 text-white font-mono">
                          4
                        </kbd>
                      </div>
                      <div className="text-xs font-bold text-emerald-100 font-mono">{intervals?.easy || '7d'}</div>
                      <div className="text-[11px] text-emerald-200 font-medium mt-0.5">Instant recall</div>
                    </button>

                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* MODE 2: The 60-Second Blurting Method */}
      {activeTab === 'blurting' && (
        <div className="p-6 sm:p-8 rounded-3xl glass-panel space-y-6 animate-fadeIn">
          
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white flex items-center gap-2 font-display">
                <Brain className="w-5 h-5 text-amber-400" />
                <span>The 60-Second Blurting Arena</span>
              </h3>
              <p className="text-xs text-slate-400">
                Speed brain-dump: Write every keyword, formula, and nuance you recall before the timer elapses.
              </p>
            </div>

            {/* Circular Timer countdown badge */}
            <div className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border font-mono text-sm font-bold ${
              blurtingSeconds <= 10 && isBlurtingRunning
                ? 'bg-rose-950/60 border-rose-500 text-rose-300 animate-pulse'
                : 'bg-slate-950 border-white/[0.1] text-amber-400'
            }`}>
              <Timer className="w-4 h-4" />
              <span>{blurtingSeconds}s</span>
            </div>
          </div>

          {!blurtingResult ? (
            <div className="space-y-4">
              <textarea
                rows={7}
                value={blurtingText}
                onChange={(e) => setBlurtingText(e.target.value)}
                placeholder={isBlurtingRunning ? "Type rapidly! Dump all terminology, mechanisms, and takeaways you recall..." : "Click 'Start 60s Blurting Challenge' to begin..."}
                disabled={!isBlurtingRunning}
                className="w-full p-4 rounded-2xl bg-slate-950/80 border border-white/[0.12] focus:border-amber-500 text-white text-sm outline-none resize-none placeholder:text-slate-500 transition-all leading-relaxed font-sans"
              />

              {/* Live recognition chips while typing */}
              {isBlurtingRunning && (
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider font-display">
                    Real-Time Concept Recognition ({liveRecognizedTerms.length}/{blurtingTargets.length}):
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {blurtingTargets.map((term, idx) => {
                      const isFound = blurtingText.toLowerCase().includes(term.toLowerCase());
                      return (
                        <span 
                          key={idx} 
                          className={`text-xs px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                            isFound 
                              ? 'bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 font-semibold' 
                              : 'bg-slate-900/60 border border-white/[0.06] text-slate-500'
                          }`}
                        >
                          {isFound ? <Check className="w-3 h-3 text-emerald-400" /> : null}
                          <span>{term}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center pt-2">
                <span className="text-xs text-slate-400 font-mono">
                  {blurtingText.trim().split(/\s+/).filter(Boolean).length} words dumped
                </span>

                {!isBlurtingRunning ? (
                  <button
                    onClick={handleStartBlurting}
                    className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-600/25 transition-all hover:scale-[1.02]"
                  >
                    <Timer className="w-4 h-4" />
                    <span>Start 60s Blurting Challenge (+40 XP)</span>
                  </button>
                ) : (
                  <button
                    onClick={handleEvaluateBlurting}
                    className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/25 transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Evaluate Blurting Now</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Blurting Results Analysis */
            <div className="space-y-5 animate-fadeIn">
              <div className="p-5 rounded-2xl bg-slate-950/80 border border-white/[0.08] space-y-4">
                <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                  <div className="text-xs font-bold text-white flex items-center gap-2 font-display">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>Active Blurting Mastery Breakdown (+40 XP)</span>
                  </div>
                  <span className="text-xs font-bold text-emerald-400 font-mono">
                    {blurtingResult.recalled.length} / {concept.keyTerms.length} Key Terms Recalled
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  {/* Recalled */}
                  <div className="space-y-2">
                    <span className="font-bold text-emerald-400 uppercase tracking-wide text-[11px] block font-display">
                      Recalled From Long-Term Memory
                    </span>
                    {blurtingResult.recalled.length === 0 ? (
                      <p className="text-slate-500 italic">No specific nomenclature terms were captured in this run.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {blurtingResult.recalled.map((t, idx) => (
                          <span key={idx} className="px-2.5 py-1 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 font-semibold flex items-center gap-1">
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span>{t}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Missed */}
                  <div className="space-y-2">
                    <span className="font-bold text-amber-400 uppercase tracking-wide text-[11px] block font-display">
                      Omitted / Faded Concepts
                    </span>
                    {blurtingResult.missed.length === 0 ? (
                      <p className="text-emerald-400 font-semibold">Flawless cognitive recall! You captured every single key term.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {blurtingResult.missed.map((t, idx) => (
                          <span key={idx} className="px-2.5 py-1 rounded-xl bg-amber-950/40 border border-amber-800/40 text-amber-300 font-medium">
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
                  className="px-4 py-2.5 rounded-xl bg-slate-900 text-slate-300 text-xs font-semibold hover:bg-slate-800 border border-white/[0.08]"
                >
                  Retry Blurting
                </button>
                <button
                  onClick={() => setActiveTab('cards')}
                  className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/25 transition-all"
                >
                  <span>Proceed to FSRS Flashcards</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Ergonomic Hardware & Gesture Mapping Modal */}
      {showErgonomicsHelp && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="max-w-md w-full p-6 rounded-3xl bg-[#0d101e] border border-white/[0.12] shadow-2xl space-y-5 text-slate-200">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Gamepad2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white font-display">Ergonomic Review Navigation</h3>
                  <p className="text-[11px] text-slate-400">High-speed active recall with zero wrist fatigue</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowErgonomicsHelp(false)}
                className="p-1.5 rounded-xl hover:bg-white/[0.08] text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Controller status banner */}
            <div className={`p-3 rounded-2xl border text-xs flex items-center justify-between ${
              gamepadConnected 
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300' 
                : 'bg-slate-900/60 border-white/[0.06] text-slate-400'
            }`}>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${gamepadConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                <span className="font-semibold">{gamepadConnected ? (gamepadName || 'Connected') : 'No Gamepad Detected'}</span>
              </div>
              <span className="text-[11px] font-mono text-slate-500">
                {gamepadConnected ? 'Ready (W3C API)' : 'Plug or pair Bluetooth'}
              </span>
            </div>

            {/* Mappings */}
            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-2xl bg-slate-950 border border-white/[0.06] space-y-2">
                <div className="font-bold text-indigo-300 flex items-center gap-1.5 font-display">
                  <Gamepad2 className="w-3.5 h-3.5" />
                  <span>Gamepad / 8BitDo / Joy-Con Mappings</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div><kbd className="px-1.5 py-0.5 rounded bg-white/[0.08] text-white">A / Cross</kbd> Flip / Good (3)</div>
                  <div><kbd className="px-1.5 py-0.5 rounded bg-white/[0.08] text-white">B / Circle</kbd> Rate Again (1)</div>
                  <div><kbd className="px-1.5 py-0.5 rounded bg-white/[0.08] text-white">X / Square</kbd> Rate Hard (2)</div>
                  <div><kbd className="px-1.5 py-0.5 rounded bg-white/[0.08] text-white">Y / Tri</kbd> Rate Easy (4)</div>
                  <div><kbd className="px-1.5 py-0.5 rounded bg-white/[0.08] text-white">L1 / LB</kbd> Toggle Hint</div>
                  <div><kbd className="px-1.5 py-0.5 rounded bg-white/[0.08] text-white">D-Pad</kbd> &larr;Again &rarr;Good &uarr;Easy &darr;Hard</div>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950 border border-white/[0.06] space-y-2">
                <div className="font-bold text-purple-300 flex items-center gap-1.5 font-display">
                  <Zap className="w-3.5 h-3.5" />
                  <span>Mobile Touch Swipes (On Card)</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div><span className="text-slate-400">Swipe Left:</span> <span className="text-rose-300 font-bold">Again (1)</span></div>
                  <div><span className="text-slate-400">Swipe Right:</span> <span className="text-emerald-300 font-bold">Good (3)</span></div>
                  <div><span className="text-slate-400">Swipe Up:</span> <span className="text-sky-300 font-bold">Easy (4)</span></div>
                  <div><span className="text-slate-400">Swipe Down:</span> <span className="text-amber-300 font-bold">Hard (2)</span></div>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950 border border-white/[0.06] space-y-2">
                <div className="font-bold text-slate-300 flex items-center gap-1.5 font-display">
                  <span>⌨️ Keyboard Fast-Row</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div><kbd className="px-1.5 py-0.5 rounded bg-white/[0.08] text-white">Space</kbd> Flip / Reveal</div>
                  <div><kbd className="px-1.5 py-0.5 rounded bg-white/[0.08] text-white">1 - 4</kbd> Again to Easy</div>
                  <div><kbd className="px-1.5 py-0.5 rounded bg-white/[0.08] text-white">H</kbd> Hint Toggle</div>
                  <div><kbd className="px-1.5 py-0.5 rounded bg-white/[0.08] text-white">A-D</kbd> Pick MCQ Option</div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowErgonomicsHelp(false)}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all shadow-lg shadow-indigo-600/30"
            >
              Got It
            </button>
          </div>
        </div>
      )}

      {/* Duolingo-style Bottom Feedback Banner */}
      {isAnswerRevealed && selectedOption !== null && currentCard && (
        <div className={`fixed bottom-0 inset-x-0 z-50 p-4 sm:p-6 border-t shadow-2xl backdrop-blur-2xl animate-slideUp transition-all duration-300 ${
          isCorrect 
            ? 'bg-[#081f14]/95 border-emerald-500/40 text-emerald-100' 
            : 'bg-[#260c13]/95 border-rose-500/40 text-rose-100'
        }`}>
          <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 w-full sm:w-auto">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-xl font-black shadow-lg ${
                isCorrect 
                  ? 'bg-emerald-500 text-slate-950 ring-4 ring-emerald-500/20' 
                  : 'bg-rose-500 text-white ring-4 ring-rose-500/20'
              }`}>
                {isCorrect ? '✓' : '✕'}
              </div>
              <div className="space-y-0.5">
                <div className="text-base sm:text-lg font-black font-display flex items-center gap-2">
                  <span>{isCorrect ? (combo >= 3 ? `Brilliant! Combo x${combo} 🔥` : 'Nicely done!') : 'Incorrect'}</span>
                  {isCorrect && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                      +10 XP
                    </span>
                  )}
                </div>
                <div className="text-xs sm:text-sm text-slate-200">
                  {isCorrect ? (
                    <span className="text-emerald-300 font-medium">Memory trace locked in!</span>
                  ) : (
                    <div className="space-y-1.5">
                      <div>Correct answer: <strong className="text-white font-bold">{currentCard.answer}</strong></div>
                      {misconception && (
                        <div className="p-2 sm:p-2.5 rounded-xl bg-black/40 border border-rose-500/30 text-xs text-rose-200 flex items-start gap-2 max-w-xl animate-fadeIn">
                          <span className="text-sm shrink-0">💡</span>
                          <div className="space-y-0.5">
                            <div className="font-bold text-rose-300 flex items-center gap-1.5">
                              <span>Lotti's Diagnostic ({misconception.trapTitle || misconception.trapType}):</span>
                            </div>
                            <p className="text-[12px] text-slate-200 leading-relaxed font-sans font-normal">
                              {misconception.trapExplanation}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleRate(isCorrect ? 'good' : 'again')}
              className={`w-full sm:w-auto px-8 py-3.5 rounded-2xl font-black text-sm tracking-wide shadow-xl flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] ${
                isCorrect 
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/30' 
                  : 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/30'
              }`}
            >
              <span>{isCorrect ? 'CONTINUE' : 'GOT IT'}</span>
              <span className="text-[11px] opacity-75 font-mono hidden sm:inline">[Enter ↵]</span>
            </button>
          </div>
        </div>
      )}

      {/* Cognitive Neuroscience Explainer Modal */}
      <ScienceExplainerModal
        isOpen={showScienceModal}
        onClose={() => setShowScienceModal(false)}
        initialTopic="retrieval"
      />

    </div>
  );
};
