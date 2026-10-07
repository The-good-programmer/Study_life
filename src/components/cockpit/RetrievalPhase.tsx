import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  HelpCircle,
  Eye,
  CheckCircle2,
  Timer,
  Brain,
  ArrowRight,
  Check,
  FileText,
  X,
  Star,
  Keyboard,
  Lightbulb,
} from 'lucide-react';
import type { CardType, ConceptCheckpoint, FSRSRating, DiagnosticDistractor } from '../../types';
import { FSRSService } from '../../services/fsrsService';
import { StorageService } from '../../services/storageService';
import { grantReward } from '../../services/economy/rewardService';
import { soundEngine } from '../../services/soundEngine';
import { AIService } from '../../services/aiService';
import { MathRenderer } from '../common/MathRenderer';
import { gamepadService, type GamepadAction } from '../../services/gamepadService';
import confetti from 'canvas-confetti';
import { StudyHUD } from './StudyHUD';
import { ScienceExplainerModal } from '../common/ScienceExplainerModal';
import { haptics } from '../../services/hapticsService';
import { buildQuizOptions } from '../../utils/quizOptions';
import { Badge, Button, IconButton, Kbd, Toggle } from '../ui/primitives';
import {
  blendInterleavedCards,
  evaluateBlurting,
  getBlurtingTargets,
  getEffectiveCardType,
  isOptionCorrect,
} from './retrievalLogic';

interface RetrievalPhaseProps {
  concept: ConceptCheckpoint;
  onComplete: () => void;
  onInspectSource?: (pageNumber?: number, snippet?: string) => void;
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
  const { cards, interleaveMap } = useMemo(
    () => blendInterleavedCards(concept, allConcepts, conceptIndex, interleaveEnabled),
    [concept, allConcepts, conceptIndex, interleaveEnabled],
  );

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

  const effectiveType: CardType = getEffectiveCardType(currentCard);

  // Smart distractor generation: 4-choice quiz options for standard cards only
  const computedOptions = useMemo(() => {
    if (!currentCard) return [];
    if (currentCard.options && currentCard.options.length > 0) {
      return currentCard.options;
    }
    return buildQuizOptions(currentCard, cards, (concept.keyTerms || []).map(t => t.term));
  }, [currentCard, cards, concept.keyTerms]);

  // Generated options only make sense for plain Q/A cards. Image-occlusion and
  // cloze cards have their own interaction, and adding the quiz block would
  // print the question twice with distractors taken from unrelated cards.
  const hasInteractiveOptions = interactiveMode && effectiveType === 'standard' && computedOptions.length >= 4;

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
    grantReward({ kind: 'review', rating }, { weekly: true, label: 'Flashcard review' });

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
    
    const correct = isOptionCorrect(option, currentCard.answer);
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

  const blurtingTargets = useMemo<string[]>(() => getBlurtingTargets(concept), [concept]);

  const handleEvaluateBlurting = useCallback(() => {
    setIsBlurtingRunning(false);
    const result = evaluateBlurting(blurtingText, blurtingTargets);
    setBlurtingResult(result);

    soundEngine.playCompletionChime();
    grantReward(
      { kind: 'blurt', recalled: result.recalled.length, total: blurtingTargets.length },
      { weekly: true, label: 'Free-recall blurting' },
    );
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
      <div className="mx-auto max-w-md rounded-3xl border border-line bg-surface-solid p-8 text-center">
        <p className="text-[15px] text-ink-muted">This concept has no flashcards yet.</p>
        <Button variant="primary" className="mt-5" onClick={onComplete}>
          Continue
        </Button>
      </div>
    );
  }

  const intervals = currentCard ? FSRSService.previewIntervals(currentCard) : null;

  // Real-time recognition in Blurting
  const liveRecognizedTerms = blurtingTargets.filter(term =>
    blurtingText.toLowerCase().includes(term.toLowerCase())
  );

  const canMixEarlierTopics = Boolean(allConcepts && conceptIndex !== undefined && conceptIndex > 0);
  const isChoiceCard = effectiveType === 'multiple-choice' || hasInteractiveOptions;
  const cardSource = currentCard?.sourceAnchor || concept.sourceAnchor;

  const toggleStar = () => {
    if (!currentCard) return;
    const newStatus = StorageService.toggleCardStar(currentCard.id);
    setStarredCardIds(prev => {
      const next = new Set(prev);
      if (newStatus) next.add(currentCard.id);
      else next.delete(currentCard.id);
      return next;
    });
    soundEngine.playSuccess();
  };

  const swipeStamp = (() => {
    if (!touchOffset) return null;
    const { x, y } = touchOffset;
    if (Math.abs(x) > 30 && Math.abs(x) > Math.abs(y)) {
      return x > 0
        ? { text: isAnswerRevealed ? 'Good' : 'Show answer', tone: 'bg-brand', strength: (x - 20) / 45, position: 'left-6 top-6 -rotate-6' }
        : { text: isAnswerRevealed ? 'Again' : 'Show answer', tone: 'bg-danger', strength: (-x - 20) / 45, position: 'right-6 top-6 rotate-6' };
    }
    if (Math.abs(y) > 30 && Math.abs(y) > Math.abs(x)) {
      return y < 0
        ? { text: isAnswerRevealed ? 'Easy' : 'Show answer', tone: 'bg-success', strength: (-y - 20) / 45, position: 'inset-x-0 bottom-6 mx-auto w-fit' }
        : { text: isAnswerRevealed ? 'Hard' : 'Show answer', tone: 'bg-gold', strength: (y - 20) / 45, position: 'inset-x-0 top-6 mx-auto w-fit' };
    }
    return null;
  })();

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 py-2 animate-fadeIn">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="Practice mode" className="inline-flex rounded-xl border border-line bg-canvas p-1">
          {([
            { tab: 'cards', label: 'Cards' },
            { tab: 'blurting', label: 'Speed recall' },
          ] as const).map(({ tab, label }) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className={`inline-flex h-8 items-center rounded-lg px-3 text-[13px] font-medium transition-colors cursor-pointer ${
                activeTab === tab ? 'bg-surface-hover text-ink shadow-sm' : 'text-ink-subtle hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-0.5">
          {activeTab === 'cards' && (
            <Toggle checked={interactiveMode} onChange={setInteractiveMode} label="Multiple choice" />
          )}
          {canMixEarlierTopics && (
            <Toggle checked={interleaveEnabled} onChange={setInterleaveEnabled} label="Mix earlier topics" />
          )}
          <IconButton icon={Keyboard} label="Shortcuts and controller" onClick={() => setShowErgonomicsHelp(true)} />
          <IconButton icon={HelpCircle} label="Why recall works" onClick={() => setShowScienceModal(true)} />
        </div>
      </div>

      {/* Flashcards */}
      {activeTab === 'cards' && currentCard && intervals && (
        <div className="space-y-4">
          <StudyHUD
            currentIndex={currentIndex}
            totalCards={cards.length}
            lastRating={lastRating}
            combo={combo}
            isAnswerRevealed={isAnswerRevealed}
            isShowingChoiceResult={isAnswerRevealed && selectedOption !== null}
            gamepadConnected={gamepadConnected}
            gamepadName={gamepadName}
            onOpenShortcuts={() => setShowErgonomicsHelp(true)}
          />

          {(interleaveMap.has(currentCard.id) || lastGamepadAction || touchFeedback) && (
            <div className="flex flex-wrap items-center gap-1.5">
              {interleaveMap.has(currentCard.id) && (
                <Badge tone="gold">
                  <Brain className="h-3 w-3" aria-hidden="true" />
                  From an earlier topic: {interleaveMap.get(currentCard.id)}
                </Badge>
              )}
              {lastGamepadAction && <Badge tone="brand">Controller: {lastGamepadAction}</Badge>}
              {touchFeedback && <Badge tone="neutral">{touchFeedback}</Badge>}
            </div>
          )}

          {/* Card */}
          <div className="relative">
            <div className="pointer-events-none absolute inset-x-4 -bottom-2 h-full rounded-3xl border border-line bg-surface" aria-hidden="true" />
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
                transition: touchOffset ? 'none' : 'transform 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275), border-color 0.2s ease',
              }}
              className={`relative flex min-h-[360px] select-none flex-col rounded-3xl border bg-surface-solid p-6 shadow-[0_1px_0_rgb(255_255_255/0.04)_inset,0_24px_48px_-28px_rgb(0_0_0/0.6)] sm:p-8 ${
                isAnswerRevealed ? 'border-line-strong' : 'border-line'
              } ${effectiveType !== 'multiple-choice' && !isAnswerRevealed ? 'cursor-grab hover:border-line-strong active:cursor-grabbing' : ''}`}
            >
              {swipeStamp && (
                <div
                  className={`pointer-events-none absolute z-30 rounded-xl px-3 py-1.5 text-sm font-semibold text-brand-ink shadow-lg ${swipeStamp.tone} ${swipeStamp.position}`}
                  style={{ opacity: Math.min(1, Math.max(0, swipeStamp.strength)) }}
                >
                  {swipeStamp.text}
                </div>
              )}

              {/* Card header */}
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] font-medium text-ink-subtle">{CARD_TYPE_LABELS[effectiveType]}</span>
                <div className="flex items-center gap-1">
                  {cardSource && onInspectSource && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onInspectSource(cardSource.pageNumber, cardSource.snippet);
                      }}
                      className="inline-flex h-7 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink cursor-pointer"
                      title={`Open the source at page ${cardSource.pageNumber}`}
                    >
                      <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                      Page {cardSource.pageNumber}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleStar();
                    }}
                    aria-pressed={starredCardIds.has(currentCard.id)}
                    aria-label={starredCardIds.has(currentCard.id) ? 'Unstar card (S)' : 'Star card (S)'}
                    title={starredCardIds.has(currentCard.id) ? 'Unstar card (S)' : 'Star card for later (S)'}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-ink-subtle transition-colors hover:bg-surface-hover hover:text-gold cursor-pointer"
                  >
                    <Star className={`h-4 w-4 ${starredCardIds.has(currentCard.id) ? 'fill-gold text-gold' : ''}`} aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* Prompt */}
              <div className="mt-4 space-y-5">
                {effectiveType === 'cloze' && (() => {
                  const rawText = currentCard.clozeTemplate || currentCard.question;
                  if (rawText.includes('{{') && rawText.includes('}}')) {
                    const parts = rawText.split(/\{\{(.*?)\}\}/g);
                    return (
                      <p className="text-[22px] font-semibold leading-relaxed tracking-tight text-ink sm:text-[26px]">
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
                                aria-label="Reveal the missing word"
                                className="mx-1 inline-flex min-w-16 items-center justify-center rounded-lg border border-dashed border-brand/60 bg-brand-soft px-3 align-baseline text-[0.8em] font-medium text-brand-text cursor-pointer"
                              >
                                ?
                              </button>
                            ) : (
                              <span key={idx} className="mx-1 rounded-lg bg-success-soft px-2 text-success">
                                {segment}
                              </span>
                            );
                          }
                          return <span key={idx}><MathRenderer text={segment} /></span>;
                        })}
                      </p>
                    );
                  }
                  return (
                    <div className="space-y-4">
                      <h3 className="text-[22px] font-semibold leading-snug tracking-tight text-ink sm:text-[26px]">
                        <MathRenderer text={currentCard.question} />
                      </h3>
                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4">
                        <span className="text-[14px] text-ink-muted">Missing word</span>
                        {!isAnswerRevealed ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRevealAnswer();
                            }}
                          >
                            Reveal
                          </Button>
                        ) : (
                          <span className="rounded-lg bg-success-soft px-2.5 py-1 text-[15px] font-semibold text-success">{currentCard.answer}</span>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {isChoiceCard && (
                  <div className="space-y-5">
                    <h3 className="text-[22px] font-semibold leading-snug tracking-tight text-ink sm:text-[26px]">
                      <MathRenderer text={currentCard.question} />
                    </h3>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {activeOptions.map((opt, idx) => {
                        const letter = ['A', 'B', 'C', 'D'][idx] || String(idx + 1);
                        const isThisCorrect = isOptionCorrect(opt, currentCard.answer);
                        const isSelected = selectedOption === opt;
                        const state = !isAnswerRevealed
                          ? 'border-line bg-surface hover:border-brand/50 hover:bg-surface-hover'
                          : isThisCorrect
                            ? 'border-success bg-success-soft'
                            : isSelected
                              ? 'border-danger bg-danger-soft'
                              : 'border-line opacity-50';
                        const badge = isAnswerRevealed && isThisCorrect
                          ? 'bg-success text-brand-ink'
                          : isAnswerRevealed && isSelected
                            ? 'bg-danger text-brand-ink'
                            : 'bg-surface-hover text-ink-muted';
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
                            className={`flex items-start gap-3 rounded-2xl border p-3.5 text-left transition-colors disabled:cursor-default cursor-pointer ${state}`}
                          >
                            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${badge}`}>
                              {letter}
                            </span>
                            <span className="pt-0.5 text-[15px] leading-snug text-ink">
                              <MathRenderer text={opt} />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {effectiveType === 'image-occlusion' && currentCard.imageUrl && (
                  <div className="space-y-4">
                    <h3 className="text-[18px] font-semibold leading-snug text-ink">
                      <MathRenderer text={currentCard.question} />
                    </h3>
                    <div className="relative flex w-full select-none items-center justify-center overflow-hidden rounded-2xl border border-line bg-canvas p-2">
                      <img
                        src={currentCard.imageUrl}
                        alt="Diagram with hidden labels"
                        className="pointer-events-none h-auto max-h-[380px] w-full rounded-xl object-contain"
                      />
                      {(currentCard.masks || []).map((mask, idx) => {
                        const isTarget = mask.id === currentCard.activeMaskId;
                        const isRevealed = isTarget && isAnswerRevealed;
                        if (currentCard.occlusionMode === 'hide-one-reveal-one' && !isTarget) return null;
                        const box = { left: `${mask.x}%`, top: `${mask.y}%`, width: `${mask.width}%`, height: `${mask.height}%` };
                        if (isTarget) {
                          return (
                            <button
                              key={mask.id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleReveal();
                              }}
                              aria-label={isRevealed ? `Label: ${mask.label || currentCard.answer}` : `Reveal hidden label ${idx + 1}`}
                              className={`absolute flex items-center justify-center rounded-lg p-1 text-[11px] font-semibold shadow-lg transition-colors cursor-pointer ${
                                isRevealed ? 'bg-success text-brand-ink' : 'animate-pulse bg-gold text-[#2a1d00] ring-2 ring-gold/40'
                              }`}
                              style={box}
                            >
                              <span className="truncate px-1">{isRevealed ? mask.label || currentCard.answer : '?'}</span>
                            </button>
                          );
                        }
                        return <div key={mask.id} className="absolute rounded-lg border border-line-strong bg-surface-solid" style={box} />;
                      })}
                    </div>
                  </div>
                )}

                {effectiveType === 'standard' && !hasInteractiveOptions && (
                  <h3 className="text-[22px] font-semibold leading-snug tracking-tight text-ink sm:text-[26px]">
                    <MathRenderer text={currentCard.question} />
                  </h3>
                )}

                {/* Hints */}
                {!isAnswerRevealed && (
                  <div onClick={(e) => e.stopPropagation()} className="space-y-2.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Lightbulb}
                      onClick={() => {
                        haptics.light();
                        soundEngine.playTapPop();
                        setHintLevel(prev => (prev >= 3 ? 0 : prev + 1));
                      }}
                      className="-ml-2"
                    >
                      {hintLevel === 0 ? 'Show a hint' : hintLevel < 3 ? `Another hint (${hintLevel}/3)` : 'Hide hints'}
                      <Kbd className="ml-1">H</Kbd>
                    </Button>

                    {hintLevel > 0 && hintLadder && (
                      <ol className="space-y-3 rounded-2xl border border-gold/25 bg-gold-soft p-4 text-[14px] leading-relaxed text-ink animate-fadeIn">
                        {[hintLadder.level1Prompt, hintLadder.level2Analogy, hintLadder.level3Deconstruction]
                          .slice(0, hintLevel)
                          .map((hint, i) => (
                            <li key={i} className="flex gap-3">
                              <span className="mt-0.5 shrink-0 text-xs font-semibold uppercase tracking-wide text-gold">
                                {['Nudge', 'Analogy', 'Simplest'][i]}
                              </span>
                              <span><MathRenderer text={hint} /></span>
                            </li>
                          ))}
                      </ol>
                    )}
                  </div>
                )}
              </div>

              {/* Answer */}
              {isAnswerRevealed ? (
                (!isChoiceCard || currentCard.explanation || currentCard.diagramDataUrl || StorageService.getConceptDiagram(currentCard.conceptId)) && (
                  <div className="mt-6 space-y-4 border-t border-line pt-6 animate-fadeIn">
                    {!isChoiceCard && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-success">Answer</p>
                        <div className="mt-1.5 text-[17px] leading-relaxed text-ink">
                          <MathRenderer text={currentCard.answer} />
                        </div>
                      </div>
                    )}
                    {currentCard.explanation && (
                      <div className="rounded-2xl bg-surface-hover p-4 text-[14px] leading-relaxed text-ink-muted">
                        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-subtle">Why</span>
                        <MathRenderer text={currentCard.explanation} />
                      </div>
                    )}
                    {(() => {
                      const diagram = currentCard.diagramDataUrl || StorageService.getConceptDiagram(currentCard.conceptId);
                      if (!diagram) return null;
                      return (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Your sketch</p>
                          <div className="flex justify-center rounded-2xl border border-line bg-canvas p-2">
                            <img src={diagram} alt="Your diagram of this concept" className="max-h-56 rounded-lg object-contain" />
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )
              ) : !isChoiceCard ? (
                <div className="mt-auto flex flex-col items-center gap-2 pt-8">
                  <Button
                    variant="primary"
                    size="lg"
                    icon={Eye}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleReveal();
                    }}
                    className="w-full sm:w-auto sm:px-8"
                  >
                    Show answer
                    <kbd className="ml-1 hidden h-5 items-center rounded border border-white/25 bg-white/15 px-1.5 font-mono text-[10.5px] sm:inline-flex">Space</kbd>
                  </Button>
                  <span className="text-xs text-ink-subtle">Or tap the card. On a phone, swipe it.</span>
                </div>
              ) : null}

              {/* Rating */}
              {isAnswerRevealed && selectedOption === null && (
                <div onClick={(e) => e.stopPropagation()} className="mt-8 space-y-3 border-t border-line pt-6 animate-fadeIn">
                  <div className="flex items-center justify-between gap-2 text-[13px]">
                    <span className="font-medium text-ink">How well did you remember it?</span>
                    <span className="hidden text-ink-subtle sm:inline">Keys 1 to 4</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {RATING_BUTTONS.map(({ rating, label, key, className, labelClassName }) => (
                      <button
                        key={rating}
                        type="button"
                        onClick={() => handleRate(rating)}
                        className={`group flex flex-col items-start gap-1 rounded-xl border border-line bg-surface p-3 text-left transition-colors cursor-pointer ${className}`}
                      >
                        <span className="flex w-full items-center justify-between">
                          <span className={`text-[14px] font-semibold ${labelClassName}`}>{label}</span>
                          <Kbd>{key}</Kbd>
                        </span>
                        <span className="text-[13px] tabular-nums text-ink-muted">Back in {intervals[rating]}</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs leading-relaxed text-ink-subtle">
                    Every rating earns the same XP, so there is no reason to round up. Your rating only decides when the card comes back.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Speed recall */}
      {activeTab === 'blurting' && (
        <section className="space-y-5 rounded-3xl border border-line bg-surface-solid p-6 sm:p-8 animate-fadeIn">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-[17px] font-semibold text-ink">Speed recall</h3>
              <p className="mt-1 text-[14px] leading-relaxed text-ink-muted">
                Write down everything you remember about this concept in 60 seconds. Earns up to 40 XP, depending on how much you recall.
              </p>
            </div>
            <span
              className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 text-[15px] font-semibold tabular-nums ${
                blurtingSeconds <= 10 && isBlurtingRunning ? 'animate-pulse bg-danger-soft text-danger' : 'bg-surface-hover text-ink'
              }`}
              aria-live="polite"
            >
              <Timer className="h-4 w-4" aria-hidden="true" />
              {blurtingSeconds}s
            </span>
          </div>

          {!blurtingResult ? (
            <div className="space-y-4">
              <textarea
                rows={7}
                value={blurtingText}
                onChange={(e) => setBlurtingText(e.target.value)}
                placeholder={isBlurtingRunning ? 'Terms, mechanisms, examples: anything you remember.' : 'Press Start to begin the 60-second timer.'}
                disabled={!isBlurtingRunning}
                aria-label="Everything you remember"
                className="w-full resize-none rounded-2xl border border-line-strong bg-canvas p-4 text-[15px] leading-relaxed text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink-subtle focus:border-brand focus:ring-4 focus:ring-brand/15 disabled:opacity-60"
              />

              {isBlurtingRunning && (
                <div className="space-y-2">
                  <p className="text-[13px] text-ink-subtle">
                    Recognised {liveRecognizedTerms.length} of {blurtingTargets.length}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {blurtingTargets.map((term, idx) => {
                      const isFound = blurtingText.toLowerCase().includes(term.toLowerCase());
                      return (
                        <span
                          key={idx}
                          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[13px] transition-colors ${
                            isFound ? 'bg-success-soft font-medium text-success' : 'bg-surface-hover text-ink-subtle'
                          }`}
                        >
                          {isFound && <Check className="h-3 w-3" aria-hidden="true" />}
                          {isFound ? term : '•••'}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 pt-1">
                <span className="text-[13px] tabular-nums text-ink-subtle">
                  {blurtingText.trim().split(/\s+/).filter(Boolean).length} words
                </span>
                {!isBlurtingRunning ? (
                  <Button variant="primary" icon={Timer} onClick={handleStartBlurting}>
                    Start
                  </Button>
                ) : (
                  <Button variant="primary" icon={CheckCircle2} onClick={handleEvaluateBlurting}>
                    Finish
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-5 animate-fadeIn">
              <div className="flex items-baseline justify-between gap-3 border-b border-line pb-4">
                <p className="text-[15px] font-medium text-ink">You recalled</p>
                <p className="text-[22px] font-semibold tabular-nums text-ink">
                  {blurtingResult.recalled.length}
                  <span className="text-[15px] font-normal text-ink-subtle"> of {blurtingTargets.length}</span>
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-success">Remembered</p>
                  {blurtingResult.recalled.length === 0 ? (
                    <p className="text-[13px] text-ink-subtle">None of the key terms this time.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {blurtingResult.recalled.map((t, idx) => (
                        <span key={idx} className="rounded-lg bg-success-soft px-2.5 py-1 text-[13px] font-medium text-success">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gold">To review</p>
                  {blurtingResult.missed.length === 0 ? (
                    <p className="text-[13px] font-medium text-success">You got every key term.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {blurtingResult.missed.map((t, idx) => (
                        <span key={idx} className="rounded-lg bg-gold-soft px-2.5 py-1 text-[13px] text-ink">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setBlurtingText('');
                    setBlurtingResult(null);
                  }}
                >
                  Try again
                </Button>
                <Button variant="primary" trailingIcon={ArrowRight} onClick={() => setActiveTab('cards')}>
                  Back to cards
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Shortcuts and controller */}
      {showErgonomicsHelp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fadeIn"
          onClick={() => setShowErgonomicsHelp(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="shortcuts-title"
        >
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md space-y-5 rounded-3xl border border-line-strong bg-surface-solid p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 id="shortcuts-title" className="text-[17px] font-semibold text-ink">Shortcuts</h3>
              <IconButton icon={X} label="Close" onClick={() => setShowErgonomicsHelp(false)} />
            </div>

            <ShortcutGroup
              title="Keyboard"
              items={[
                ['Space', 'Show answer'],
                ['1 – 4', 'Again, Hard, Good, Easy'],
                ['A – D', 'Pick a choice'],
                ['H', 'Hint'],
                ['S', 'Star card'],
                ['Enter', 'Continue'],
              ]}
            />
            <ShortcutGroup
              title="Swipe on the card"
              items={[
                ['Left', 'Again'],
                ['Down', 'Hard'],
                ['Right', 'Good'],
                ['Up', 'Easy'],
              ]}
            />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Game controller</p>
                <Badge tone={gamepadConnected ? 'success' : 'neutral'}>{gamepadConnected ? gamepadName || 'Connected' : 'Not connected'}</Badge>
              </div>
              <p className="text-[13px] leading-relaxed text-ink-muted">
                Pair a Bluetooth controller and press any button. A flips and rates Good, B Again, X Hard, Y Easy, and the left bumper shows a hint.
              </p>
            </div>

            <Button variant="primary" className="w-full" onClick={() => setShowErgonomicsHelp(false)}>
              Done
            </Button>
          </div>
        </div>
      )}

      {/* Multiple-choice feedback */}
      {isAnswerRevealed && selectedOption !== null && currentCard && (
        <div
          role="status"
          className={`fixed inset-x-0 bottom-0 z-50 border-t-2 bg-canvas-raised/95 pb-[env(safe-area-inset-bottom)] shadow-2xl backdrop-blur-xl animate-slideUp ${
            isCorrect ? 'border-success' : 'border-danger'
          }`}
        >
          <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex items-start gap-3.5">
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-brand-ink ${isCorrect ? 'bg-success' : 'bg-danger'}`}
                aria-hidden="true"
              >
                {isCorrect ? <Check className="h-6 w-6" /> : <X className="h-6 w-6" />}
              </span>
              <div className="min-w-0 space-y-1">
                <p className="text-[17px] font-semibold text-ink">
                  {isCorrect ? (combo >= 3 ? `Correct, ${combo} in a row` : 'Correct') : 'Not quite'}
                </p>
                {!isCorrect && (
                  <p className="text-[14px] text-ink-muted">
                    The answer is <strong className="font-semibold text-ink">{currentCard.answer}</strong>
                  </p>
                )}
                {!isCorrect && misconception && (
                  <p className="max-w-xl rounded-xl border border-danger/25 bg-danger-soft px-3 py-2 text-[13px] leading-relaxed text-ink-muted">
                    <span className="font-medium text-ink">{misconception.trapTitle || 'Common mix-up'}: </span>
                    {misconception.trapExplanation}
                  </p>
                )}
              </div>
            </div>
            <Button
              variant={isCorrect ? 'primary' : 'secondary'}
              size="lg"
              onClick={() => handleRate(isCorrect ? 'good' : 'again')}
              className="w-full shrink-0 sm:w-auto"
            >
              Continue
              <kbd className="ml-1 hidden h-5 items-center rounded border border-current/25 px-1.5 font-mono text-[10.5px] opacity-80 sm:inline-flex">Enter</kbd>
            </Button>
          </div>
        </div>
      )}

      <ScienceExplainerModal isOpen={showScienceModal} onClose={() => setShowScienceModal(false)} initialTopic="retrieval" />
    </div>
  );
};

const CARD_TYPE_LABELS: Record<CardType, string> = {
  standard: 'Flashcard',
  cloze: 'Fill in the blank',
  'multiple-choice': 'Multiple choice',
  'image-occlusion': 'Label the diagram',
};

const RATING_BUTTONS: { rating: FSRSRating; label: string; key: string; className: string; labelClassName: string }[] = [
  { rating: 'again', label: 'Again', key: '1', className: 'hover:border-danger/50 hover:bg-danger-soft', labelClassName: 'text-danger' },
  { rating: 'hard', label: 'Hard', key: '2', className: 'hover:border-gold/50 hover:bg-gold-soft', labelClassName: 'text-gold' },
  { rating: 'good', label: 'Good', key: '3', className: 'hover:border-brand/50 hover:bg-brand-soft', labelClassName: 'text-brand-text' },
  { rating: 'easy', label: 'Easy', key: '4', className: 'hover:border-success/50 hover:bg-success-soft', labelClassName: 'text-success' },
];

const ShortcutGroup: React.FC<{ title: string; items: [string, string][] }> = ({ title, items }) => (
  <div className="space-y-2">
    <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">{title}</p>
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
      {items.map(([key, action]) => (
        <div key={key} className="flex items-center justify-between gap-2">
          <dt className="text-ink-muted">{action}</dt>
          <dd><Kbd>{key}</Kbd></dd>
        </div>
      ))}
    </dl>
  </div>
);
