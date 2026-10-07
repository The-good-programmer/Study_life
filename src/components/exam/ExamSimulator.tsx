import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Clock,
  RotateCcw,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Sparkles,
  X,
  Play,
  Check,
  ChevronDown,
  ChevronUp,
  Share2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { 
  CardType, 
  ConfidenceLevel, 
  ExamQuestionResult, 
  ExamReport, 
  RetrievalCard, 
  StudySession 
} from '../../types';
import { StorageService } from '../../services/storageService';
import { grantReward } from '../../services/economy/rewardService';
import { soundEngine } from '../../services/soundEngine';
import { DEMO_STUDY_SESSIONS } from '../../data/demoDecks';
import { CURATED_STARTER_DECKS } from '../../data/curatedStarterCatalog';
import { MathRenderer } from '../common/MathRenderer';

import { evaluateTextAnswer } from './examEvaluator';
import {
  CALIBRATED_THRESHOLD,
  buildExamReport,
  scoreAnswer,
} from './examScoring';
import { getEffectiveCardType, isOptionCorrect } from '../cockpit/retrievalLogic';
import { Badge, Button, Card, CoinIcon, IconButton, Kbd, ProgressBar } from '../ui/primitives';
import { shuffle } from '../../utils/shuffle';
import { fillCloze, maskCloze } from '../../utils/cloze';

interface ExamSimulatorProps {
  onBack: () => void;
  onStartRemediationSession: (session: StudySession) => void;
  initialDeckId?: string;
}

interface ExamQuestionItem {
  card: RetrievalCard;
  conceptTitle: string;
  deckTitle: string;
  deckId: string;
}

export const ExamSimulator: React.FC<ExamSimulatorProps> = ({
  onBack,
  onStartRemediationSession,
  initialDeckId,
}) => {
  const [stage, setStage] = useState<'setup' | 'active' | 'report'>('setup');
  const [setupError, setSetupError] = useState<string | null>(null);

  // Available decks (user saved, curated starter decks, demo sessions)
  const savedDecks = useMemo(() => StorageService.getSessions(), []);
  const allDecks = useMemo(() => {
    const combined: StudySession[] = [...savedDecks];
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
  }, [savedDecks]);

  // Setup Options
  const [selectedDeckId, setSelectedDeckId] = useState<string>(initialDeckId || 'all');
  const [questionCountLimit, setQuestionCountLimit] = useState<number>(10);
  const [timeLimitPerQuestion, setTimeLimitPerQuestion] = useState<number>(45); // 0 = untimed, 45, 90
  const [examMode, setExamMode] = useState<'board' | 'training'>('board'); // board = grade at end, training = instant feedback

  // Active Exam State
  const [examQuestions, setExamQuestions] = useState<ExamQuestionItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [selectedConfidence, setSelectedConfidence] = useState<ConfidenceLevel | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [results, setResults] = useState<ExamQuestionResult[]>([]);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(45);
  const [isTimerActive, setIsTimerActive] = useState(false);
  // Wall-clock start of the exam, so time spent is right for untimed and training exams too
  const examStartedAtRef = useRef(0);

  // Report state
  const [finalReport, setFinalReport] = useState<ExamReport | null>(null);
  const [expandedResultIdx, setExpandedResultIdx] = useState<number | null>(null);
  const [copiedShare, setCopiedShare] = useState(false);
  const [isExitConfirmOpen, setIsExitConfirmOpen] = useState(false);
  const [examPay, setExamPay] = useState<{ tokens: number; capped: boolean } | null>(null);

  // Pool questions based on configuration
  const handleStartExam = () => {
    let pool: ExamQuestionItem[] = [];

    const targetDecks = selectedDeckId === 'all' 
      ? allDecks 
      : allDecks.filter(d => d.id === selectedDeckId);

    targetDecks.forEach(deck => {
      deck.concepts.forEach(concept => {
        concept.retrievalCards.forEach(card => {
          pool.push({
            card,
            conceptTitle: concept.title,
            deckTitle: deck.title,
            deckId: deck.id,
          });
        });
      });
    });

    if (pool.length === 0) {
      setSetupError('No flashcards found in the selected deck. Please select another deck.');
      return;
    }
    setSetupError(null);

    // Shuffle pool
    pool = shuffle(pool);

    // Limit count
    if (questionCountLimit > 0 && pool.length > questionCountLimit) {
      pool = pool.slice(0, questionCountLimit);
    }

    setExamQuestions(pool);
    setCurrentIndex(0);
    setResults([]);
    setSelectedAnswer('');
    setSelectedConfidence(null);
    setIsAnswerSubmitted(false);
    setSecondsRemaining(timeLimitPerQuestion);
    setIsTimerActive(timeLimitPerQuestion > 0);
    examStartedAtRef.current = Date.now();
    setStage('active');
  };

  const currentItem = examQuestions[currentIndex];

  const effectiveCardType: CardType = getEffectiveCardType(currentItem?.card);

  const hasOptions = !!(currentItem?.card?.options && currentItem.card.options.length > 0);

  // Evaluate single question
  const evaluateAnswer = useCallback((userAns: string, conf: ConfidenceLevel): ExamQuestionResult => {
    if (!currentItem) {
      throw new Error('No active question');
    }

    // Check correctness
    const isCorrect = hasOptions
      ? isOptionCorrect(userAns, currentItem.card.answer)
      : evaluateTextAnswer(userAns, currentItem.card.answer);

    // Determine Quadrant & Points
    const { quadrant, points } = scoreAnswer(isCorrect, conf);

    return {
      card: currentItem.card,
      conceptTitle: currentItem.conceptTitle,
      deckTitle: currentItem.deckTitle,
      userAnswer: userAns,
      isCorrect,
      confidence: conf,
      pointsEarned: points,
      quadrant,
      explanation: currentItem.card.explanation,
    };
  }, [currentItem, hasOptions]);

  // Advance or Complete Exam
  const advanceQuestion = useCallback((newResults: ExamQuestionResult[]) => {
    if (currentIndex + 1 < examQuestions.length) {
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswer('');
      setSelectedConfidence(null);
      setIsAnswerSubmitted(false);
      if (timeLimitPerQuestion > 0) {
        setSecondsRemaining(timeLimitPerQuestion);
        setIsTimerActive(true);
      }
    } else {
      // Exam Finished! Compile Report
      setIsTimerActive(false);
      const report = buildExamReport({
        results: newResults,
        deckTitle:
          selectedDeckId === 'all'
            ? 'All decks'
            : allDecks.find(d => d.id === selectedDeckId)?.title || 'Custom Exam',
        timeSpentSeconds: Math.round((Date.now() - examStartedAtRef.current) / 1000),
        now: new Date(),
      });

      StorageService.saveExamReport(report);
      const pay = grantReward(
        { kind: 'exam', weightedScore: report.confidenceWeightedScore },
        { label: `Mock exam: ${report.deckTitle.slice(0, 20)} (${report.rawAccuracyPercent}%)` },
      );
      setExamPay({ tokens: pay.wage?.totalAmount ?? 0, capped: pay.capped });
      soundEngine.playCompletionChime();

      try {
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 }
        });
      } catch {
        // ignore
      }

      setFinalReport(report);
      setStage('report');
    }
  }, [currentIndex, examQuestions.length, timeLimitPerQuestion, selectedDeckId, allDecks]);

  // Handle Question Submission
  const handleSubmitCurrentAnswer = useCallback(() => {
    if (!currentItem || !selectedConfidence) return;

    const evaluation = evaluateAnswer(selectedAnswer || '(No answer provided)', selectedConfidence);
    const updatedResults = [...results, evaluation];
    setResults(updatedResults);

    if (evaluation.isCorrect) {
      soundEngine.playCorrectChime();
    } else {
      soundEngine.playIncorrectChime();
    }

    if (examMode === 'training') {
      setIsAnswerSubmitted(true);
      setIsTimerActive(false);
    } else {
      advanceQuestion(updatedResults);
    }
  }, [currentItem, selectedConfidence, evaluateAnswer, selectedAnswer, results, examMode, advanceQuestion]);

  const submitRef = useRef(handleSubmitCurrentAnswer);
  useEffect(() => {
    submitRef.current = handleSubmitCurrentAnswer;
  }, [handleSubmitCurrentAnswer]);

  // Question Countdown Timer
  useEffect(() => {
    if (!isTimerActive || timeLimitPerQuestion === 0) return;

    const interval = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          // Time expired! Auto-submit as Low confidence
          setSelectedConfidence(prevConf => prevConf || 'low');
          setTimeout(() => {
            submitRef.current();
          }, 50);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isTimerActive, timeLimitPerQuestion]);

  // Keyboard shortcuts (1-4 / A-D for options, L / M / H for confidence, Enter to submit)
  useEffect(() => {
    if (stage !== 'active' || !currentItem || isExitConfirmOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      const key = e.key.toUpperCase();

      // Confidence keys: L = low, M = medium, H = high. (C used to set high
      // confidence, which clashed with picking option C.)
      if (!isAnswerSubmitted) {
        if (key === 'L') {
          e.preventDefault();
          setSelectedConfidence('low');
        } else if (key === 'M') {
          e.preventDefault();
          setSelectedConfidence('medium');
        } else if (key === 'H') {
          e.preventDefault();
          setSelectedConfidence('high');
        }
      }

      // MCQ Choice Keys: A, B, C, D or 1, 2, 3, 4 (only before submit)
      if (!isAnswerSubmitted && hasOptions && currentItem.card.options) {
        let pickIdx = -1;
        if (key === 'A' || key === '1') pickIdx = 0;
        else if (key === 'B' || key === '2') pickIdx = 1;
        else if (key === 'C' || key === '3') pickIdx = 2;
        else if (key === 'D' || key === '4') pickIdx = 3;

        if (pickIdx >= 0 && pickIdx < currentItem.card.options.length) {
          e.preventDefault();
          setSelectedAnswer(currentItem.card.options[pickIdx]);
        }
      }

      // Enter to submit or advance
      if (e.key === 'Enter') {
        e.preventDefault();
        if (isAnswerSubmitted) {
          advanceQuestion(results);
        } else if (selectedConfidence) {
          handleSubmitCurrentAnswer();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [stage, currentItem, isAnswerSubmitted, effectiveCardType, hasOptions, selectedConfidence, handleSubmitCurrentAnswer, advanceQuestion, results, isExitConfirmOpen]);

  // Launch Remediation Session
  const handleLaunchRemediation = () => {
    if (!finalReport) return;

    // Filter cards from blindspots and lucky guesses
    const remediationItems = finalReport.questionResults.filter(
      r => r.quadrant === 'blindspot' || r.quadrant === 'lucky-guess' || r.quadrant === 'known-unknown'
    );

    if (remediationItems.length === 0) return;

    const sessionId = `remediation-${Date.now()}`;
    const cards = remediationItems.map(item => item.card);

    const remediationSession: StudySession = {
      id: sessionId,
      title: `Exam review: ${finalReport.deckTitle.slice(0, 40)}`,
      category: 'Exam review',
      description: `The ${cards.length} questions you missed, guessed or were wrongly sure about.`,
      currentConceptIndex: 0,
      currentPhase: 'priming',
      elapsedSeconds: 0,
      createdAt: new Date().toISOString(),
      concepts: [
        {
          id: `c-${sessionId}-1`,
          order: 1,
          title: 'Questions to review',
          estimatedMinutes: Math.max(6, Math.round(cards.length * 1.2)),
          mentalModel: 'Go back over the questions where you were wrong, unsure, or wrongly confident, and fix the understanding behind each one.',
          coreTakeaways: [
            `${finalReport.blindspotCount} blind spots: you were sure but wrong.`,
            `${finalReport.luckyGuessCount} lucky guesses: right, but not sure.`,
            `${finalReport.knownUnknownCount} honest gaps: wrong, and you knew you were unsure.`,
          ],
          keyTerms: cards.slice(0, 4).map(c => ({ term: c.question.slice(0, 25), definition: c.answer.slice(0, 50) })),
          feynmanPrompt: `Explain why your first answer was wrong on these questions, and what the correct idea is.`,
          sampleMasteryExplanation: `A plain explanation of each correct answer and why the mistaken one was tempting.`,
          retrievalCards: cards,
        }
      ]
    };

    StorageService.saveSession(remediationSession);
    onStartRemediationSession(remediationSession);
  };

  // -------------------------------------------------------------
  // RENDER STAGE 1: SETUP
  // -------------------------------------------------------------
  if (stage === 'setup') {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-6 animate-fadeIn">
        <header>
          <h1 className="text-[26px] font-semibold tracking-tight text-ink sm:text-[30px]">Mock exam</h1>
          <p className="mt-1 text-[15px] leading-relaxed text-ink-muted">
            Answer under exam conditions and say how sure you are. Being confidently wrong costs points, so the score shows what you really know.
          </p>
        </header>

        <section className="space-y-6 rounded-3xl border border-line bg-surface p-5 sm:p-6">
          {setupError && (
            <p role="alert" className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger-soft px-3.5 py-2.5 text-[13px] text-danger">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {setupError}
            </p>
          )}

          <SetupField label="Deck">
            <select
              value={selectedDeckId}
              onChange={(e) => setSelectedDeckId(e.target.value)}
              className="h-11 w-full rounded-xl border border-line-strong bg-canvas px-3 text-[14px] text-ink outline-none focus:border-brand"
            >
              <option value="all">All decks</option>
              {allDecks.map(deck => (
                <option key={deck.id} value={deck.id}>
                  {deck.title}
                </option>
              ))}
            </select>
          </SetupField>

          <SetupField label="Questions">
            <Segmented
              options={[5, 10, 15, 25].map(count => ({ value: count, label: String(count) }))}
              value={questionCountLimit}
              onChange={setQuestionCountLimit}
              label="Number of questions"
            />
          </SetupField>

          <SetupField label="Time per question">
            <Segmented
              options={[
                { value: 0, label: 'Untimed' },
                { value: 90, label: '90 seconds' },
                { value: 45, label: '45 seconds' },
              ]}
              value={timeLimitPerQuestion}
              onChange={setTimeLimitPerQuestion}
              label="Time per question"
            />
          </SetupField>

          <SetupField label="Feedback">
            <div className="grid gap-2 sm:grid-cols-2">
              {([
                { mode: 'board', title: 'Exam', text: 'See your results at the end, like the real thing.' },
                { mode: 'training', title: 'Practice', text: 'See the answer and explanation after each question.' },
              ] as const).map(option => (
                <button
                  key={option.mode}
                  type="button"
                  aria-pressed={examMode === option.mode}
                  onClick={() => setExamMode(option.mode)}
                  className={`rounded-xl border p-3.5 text-left transition-colors cursor-pointer ${
                    examMode === option.mode ? 'border-brand bg-brand-soft' : 'border-line hover:border-line-strong hover:bg-surface-hover'
                  }`}
                >
                  <span className="block text-[14px] font-medium text-ink">{option.title}</span>
                  <span className="mt-0.5 block text-[13px] text-ink-subtle">{option.text}</span>
                </button>
              ))}
            </div>
          </SetupField>

          <div className="rounded-2xl bg-surface-hover p-4">
            <p className="text-[13px] font-medium text-ink">How scoring works</p>
            <dl className="mt-2.5 grid grid-cols-2 gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-3">
              {CONFIDENCE_OPTIONS.map(option => (
                <div key={option.level} className="space-y-0.5">
                  <dt className="text-ink-muted">{option.label}</dt>
                  <dd className="tabular-nums text-ink-subtle">
                    <span className="text-success">{option.right}</span> right · <span className={option.wrongTone}>{option.wrong}</span> wrong
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 border-t border-line pt-3 text-xs text-ink-subtle">Your score is paid out in tokens, up to a daily limit.</p>
          </div>

          <div className="flex items-center justify-between gap-3">
            <Button variant="ghost" onClick={onBack}>
              Cancel
            </Button>
            <Button variant="primary" size="lg" icon={Play} onClick={handleStartExam}>
              Start exam
            </Button>
          </div>
        </section>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER STAGE 2: ACTIVE EXAM
  // -------------------------------------------------------------
  if (stage === 'active' && currentItem) {
    const lastResult = results[results.length - 1];
    const options = currentItem.card.options || [];

    return (
      <div className="mx-auto w-full max-w-2xl space-y-4 animate-fadeIn">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <IconButton icon={X} label="Leave exam" onClick={() => setIsExitConfirmOpen(true)} />
            <div className="min-w-0">
              <p className="text-[14px] font-medium tabular-nums text-ink">
                Question {currentIndex + 1} of {examQuestions.length}
              </p>
              <p className="truncate text-xs text-ink-subtle">{currentItem.deckTitle}</p>
            </div>
          </div>
          {timeLimitPerQuestion > 0 && (
            <span
              className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 font-mono text-[13px] font-medium tabular-nums ${
                secondsRemaining <= 10 ? 'animate-pulse bg-danger-soft text-danger' : 'bg-surface-hover text-ink'
              }`}
              aria-live="polite"
            >
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {secondsRemaining}s
            </span>
          )}
        </div>
        <ProgressBar value={(currentIndex / examQuestions.length) * 100} label="Exam progress" />

        <div className="space-y-6 rounded-3xl border border-line bg-surface-solid p-6 sm:p-8">
          <div className="flex items-center justify-between gap-3 text-[13px]">
            <span className="truncate text-ink-subtle">{currentItem.conceptTitle}</span>
            <span className="shrink-0 text-ink-subtle">
              {effectiveCardType === 'image-occlusion' ? 'Label the diagram' : hasOptions ? 'Multiple choice' : effectiveCardType === 'cloze' ? 'Fill in the blank' : 'Short answer'}
            </span>
          </div>

          <h3 className="text-[22px] font-semibold leading-snug tracking-tight text-ink sm:text-[26px]">
            <MathRenderer text={isAnswerSubmitted ? fillCloze(currentItem.card.question) : maskCloze(currentItem.card.question)} />
          </h3>

          {effectiveCardType === 'image-occlusion' && currentItem.card.imageUrl && (
            <div className="relative flex w-full select-none items-center justify-center overflow-hidden rounded-2xl border border-line bg-canvas p-2">
              <img
                src={currentItem.card.imageUrl}
                alt="Diagram with hidden labels"
                className="pointer-events-none h-auto max-h-[360px] w-full rounded-xl object-contain"
              />
              {(currentItem.card.masks || []).map((mask) => {
                const isTarget = mask.id === currentItem.card.activeMaskId;
                const isRevealed = isTarget && isAnswerSubmitted;
                if (currentItem.card.occlusionMode === 'hide-one-reveal-one' && !isTarget) return null;
                const box = { left: `${mask.x}%`, top: `${mask.y}%`, width: `${mask.width}%`, height: `${mask.height}%` };
                return isTarget ? (
                  <div
                    key={mask.id}
                    className={`absolute flex items-center justify-center rounded-lg p-1 text-[11px] font-semibold shadow-lg ${
                      isRevealed ? 'bg-success text-success-ink' : 'animate-pulse bg-gold text-[#2a1d00] ring-2 ring-gold/40'
                    }`}
                    style={box}
                  >
                    <span className="truncate px-1">{isRevealed ? mask.label || currentItem.card.answer : '?'}</span>
                  </div>
                ) : (
                  <div key={mask.id} className="pointer-events-none absolute rounded-lg border border-line-strong bg-surface-solid" style={box} />
                );
              })}
            </div>
          )}

          {hasOptions && (
            <div className="grid gap-2 sm:grid-cols-2">
              {options.map((opt, idx) => {
                const letter = ['A', 'B', 'C', 'D'][idx] || String(idx + 1);
                const isSelected = selectedAnswer === opt;
                const isRight = isOptionCorrect(opt, currentItem.card.answer);
                const state = isAnswerSubmitted
                  ? isRight
                    ? 'border-success bg-success-soft'
                    : isSelected
                      ? 'border-danger bg-danger-soft'
                      : 'border-line opacity-50'
                  : isSelected
                    ? 'border-brand bg-brand-soft'
                    : 'border-line bg-surface hover:border-brand/50 hover:bg-surface-hover';
                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={isAnswerSubmitted}
                    aria-pressed={isSelected}
                    onClick={() => setSelectedAnswer(opt)}
                    className={`flex items-start gap-3 rounded-2xl border p-3.5 text-left transition-colors disabled:cursor-default cursor-pointer ${state}`}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${
                        isSelected && !isAnswerSubmitted ? 'bg-brand text-brand-ink' : 'bg-surface-hover text-ink-muted'
                      }`}
                    >
                      {letter}
                    </span>
                    <span className="pt-0.5 text-[15px] leading-snug text-ink">
                      <MathRenderer text={opt} />
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {!hasOptions && !isAnswerSubmitted && (
            <div className="space-y-2">
              <label htmlFor="exam-answer" className="text-[13px] text-ink-subtle">
                Your answer
              </label>
              <input
                id="exam-answer"
                type="text"
                value={selectedAnswer}
                onChange={(e) => setSelectedAnswer(e.target.value)}
                placeholder="Type your answer"
                autoComplete="off"
                className="h-12 w-full rounded-xl border border-line-strong bg-canvas px-4 text-[15px] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink-subtle focus:border-brand focus:ring-4 focus:ring-brand/15"
              />
            </div>
          )}

          {isAnswerSubmitted && lastResult && (
            <div className="space-y-3 rounded-2xl border border-line bg-surface p-4 animate-fadeIn">
              <div className="flex items-center justify-between gap-3">
                <span className={`flex items-center gap-1.5 text-[15px] font-semibold ${lastResult.isCorrect ? 'text-success' : 'text-danger'}`}>
                  {lastResult.isCorrect ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <X className="h-4 w-4" aria-hidden="true" />}
                  {lastResult.isCorrect ? 'Correct' : 'Not quite'}
                  <span className="text-[13px] font-normal text-ink-subtle">· {QUADRANT_COPY[lastResult.quadrant].label}</span>
                </span>
                <span className={`text-[14px] font-semibold tabular-nums ${lastResult.pointsEarned > 0 ? 'text-success' : lastResult.pointsEarned < 0 ? 'text-danger' : 'text-ink-subtle'}`}>
                  {formatPoints(lastResult.pointsEarned)}
                </span>
              </div>
              <p className="text-[14px] text-ink-muted">
                Answer: <span className="font-medium text-ink">{currentItem.card.answer}</span>
              </p>
              {currentItem.card.explanation && (
                <p className="border-t border-line pt-3 text-[13px] leading-relaxed text-ink-muted">{currentItem.card.explanation}</p>
              )}
            </div>
          )}

          {!isAnswerSubmitted && (
            <div className="space-y-3 border-t border-line pt-5">
              <div className="flex items-center justify-between gap-2 text-[13px]">
                <span className="font-medium text-ink">How sure are you?</span>
                <span className="hidden text-ink-subtle sm:inline">Keys L, M, H</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {CONFIDENCE_OPTIONS.map(option => {
                  const isSelected = selectedConfidence === option.level;
                  return (
                    <button
                      key={option.level}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setSelectedConfidence(option.level)}
                      className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors cursor-pointer ${
                        isSelected ? 'border-brand bg-brand-soft' : 'border-line bg-surface hover:border-line-strong hover:bg-surface-hover'
                      }`}
                    >
                      <span className="flex w-full items-center justify-between gap-2">
                        <span className="text-[14px] font-semibold text-ink">{option.label}</span>
                        <Kbd>{option.key}</Kbd>
                      </span>
                      <span className="text-xs tabular-nums text-ink-subtle">
                        {option.right} / {option.wrong}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            {!isAnswerSubmitted ? (
              <Button variant="primary" size="lg" trailingIcon={ArrowRight} onClick={handleSubmitCurrentAnswer} disabled={!selectedConfidence} className="w-full sm:w-auto">
                Submit answer
              </Button>
            ) : (
              <Button variant="primary" size="lg" trailingIcon={ArrowRight} onClick={() => advanceQuestion(results)} className="w-full sm:w-auto">
                {currentIndex + 1 < examQuestions.length ? 'Next question' : 'See results'}
              </Button>
            )}
          </div>
        </div>

        {isExitConfirmOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fadeIn"
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-exam-title"
            onClick={() => setIsExitConfirmOpen(false)}
          >
            <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-3xl border border-line-strong bg-surface-solid p-6 text-center shadow-2xl">
              <h3 id="leave-exam-title" className="text-[17px] font-semibold text-ink">Leave this exam?</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">Your answers so far will not be scored or saved, and nothing is paid.</p>
              <div className="mt-6 flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => setIsExitConfirmOpen(false)}>
                  Keep going
                </Button>
                <Button
                  variant="danger"
                  className="flex-1"
                  onClick={() => {
                    setIsExitConfirmOpen(false);
                    setIsTimerActive(false);
                    setStage('setup');
                  }}
                >
                  Leave exam
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER STAGE 3: RESULTS
  // -------------------------------------------------------------
  if (stage === 'report' && finalReport) {
    const grade = gradeFor(finalReport.rawAccuracyPercent);
    const reviewCount = finalReport.blindspotCount + finalReport.luckyGuessCount + finalReport.knownUnknownCount;
    const isCalibrated = finalReport.calibrationPercent >= CALIBRATED_THRESHOLD;

    return (
      <div className="mx-auto w-full max-w-3xl space-y-5 animate-fadeIn">
        <header>
          <p className="text-[13px] font-medium text-brand-text">Exam results</p>
          <h1 className="mt-1 text-[26px] font-semibold tracking-tight text-ink sm:text-[30px]">{finalReport.deckTitle}</h1>
          <p className="mt-1 text-[14px] text-ink-subtle">
            {finalReport.totalQuestions} questions · {Math.max(1, Math.round(finalReport.timeSpentSeconds / 60))} min
          </p>
        </header>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ResultStat label="Correct" value={`${finalReport.rawAccuracyPercent}%`} />
          <ResultStat label="Score" value={`${finalReport.confidenceWeightedScore}`} suffix={`/ ${finalReport.maxPossibleScore}`} />
          <ResultStat label="Calibration" value={`${finalReport.calibrationPercent}%`} hint="How well your confidence predicted whether you were right" />
          <ResultStat label="Grade" value={grade} />
        </div>

        <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[15px] font-semibold text-ink">{isCalibrated ? 'Your confidence was well judged' : 'Your confidence needs tuning'}</h2>
              <Badge tone={isCalibrated ? 'success' : 'gold'}>{isCalibrated ? 'Calibrated' : 'Keep practising'}</Badge>
            </div>
            <p className="mt-1 text-[14px] leading-relaxed text-ink-muted">
              {finalReport.blindspotCount > 0
                ? `You were sure but wrong on ${finalReport.blindspotCount} ${finalReport.blindspotCount === 1 ? 'question' : 'questions'}. Those are the riskiest in a real exam, so review them first.`
                : isCalibrated
                  ? 'You knew what you knew, and no answer was confidently wrong.'
                  : 'Turn your guesses and gaps into answers you are sure of before the real exam.'}
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-[13px] text-ink-subtle">
              <CoinIcon className="h-4 w-4" />
              {examPay && examPay.tokens > 0
                ? <>You earned <span className="font-medium tabular-nums text-gold">{examPay.tokens}</span> tokens{examPay.capped ? ' (daily limit applied)' : ''}.</>
                : finalReport.confidenceWeightedScore <= 0
                  ? 'No tokens this time: pay starts once your score is above zero.'
                  : 'No tokens: you have reached today’s exam pay limit.'}
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon={copiedShare ? Check : Share2}
            className="shrink-0"
            onClick={() => {
              const shareText = `Studify mock exam: ${finalReport.deckTitle}\nScore ${finalReport.confidenceWeightedScore}/${finalReport.maxPossibleScore}, ${finalReport.rawAccuracyPercent}% correct, ${finalReport.calibrationPercent}% calibrated (grade ${grade}).`;
              navigator.clipboard.writeText(shareText);
              setCopiedShare(true);
              soundEngine.playSuccess();
              setTimeout(() => setCopiedShare(false), 2500);
            }}
          >
            {copiedShare ? 'Copied' : 'Copy result'}
          </Button>
        </Card>

        <section aria-labelledby="quadrants-title" className="space-y-3">
          <h2 id="quadrants-title" className="text-[15px] font-semibold text-ink">How sure you were, and whether you were right</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {(['mastery', 'lucky-guess', 'known-unknown', 'blindspot'] as const).map(quadrant => {
              const count =
                quadrant === 'mastery'
                  ? finalReport.masteryCount
                  : quadrant === 'lucky-guess'
                    ? finalReport.luckyGuessCount
                    : quadrant === 'known-unknown'
                      ? finalReport.knownUnknownCount
                      : finalReport.blindspotCount;
              const copy = QUADRANT_COPY[quadrant];
              return (
                <div key={quadrant} className={`rounded-2xl border p-4 ${quadrant === 'blindspot' && count > 0 ? 'border-danger/40 bg-danger-soft' : 'border-line bg-surface'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className={`flex items-center gap-2 text-[14px] font-semibold ${copy.tone}`}>
                      <span className={`h-2 w-2 rounded-full ${copy.dot}`} aria-hidden="true" />
                      {copy.label}
                    </span>
                    <span className="text-[20px] font-semibold tabular-nums text-ink">{count}</span>
                  </div>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{copy.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Review what you missed</h2>
            <p className="mt-1 text-[14px] text-ink-muted">
              {reviewCount > 0
                ? `A guided session on the ${reviewCount} ${reviewCount === 1 ? 'question' : 'questions'} you missed, guessed or were wrongly sure about.`
                : 'Nothing to review: every answer was right and you were sure of it.'}
            </p>
          </div>
          <Button variant="primary" icon={Sparkles} onClick={handleLaunchRemediation} disabled={reviewCount === 0} className="shrink-0">
            Start review
          </Button>
        </Card>

        <section aria-labelledby="answers-title" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 id="answers-title" className="text-[15px] font-semibold text-ink">Every question</h2>
            <Button variant="ghost" size="sm" icon={Printer} onClick={() => window.print()}>
              Print
            </Button>
          </div>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {finalReport.questionResults.map((result, idx) => {
              const isExpanded = expandedResultIdx === idx;
              return (
                <li key={idx}>
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    onClick={() => setExpandedResultIdx(isExpanded ? null : idx)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-hover cursor-pointer"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${result.isCorrect ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'}`}
                        aria-label={result.isCorrect ? 'Correct' : 'Incorrect'}
                      >
                        {result.isCorrect ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] text-ink">{fillCloze(result.card.question)}</span>
                        <span className="block text-xs text-ink-subtle">
                          {CONFIDENCE_OPTIONS.find(o => o.level === result.confidence)?.label} · {QUADRANT_COPY[result.quadrant].label}
                        </span>
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className={`text-[13px] font-semibold tabular-nums ${result.pointsEarned > 0 ? 'text-success' : result.pointsEarned < 0 ? 'text-danger' : 'text-ink-subtle'}`}>
                        {formatPoints(result.pointsEarned)}
                      </span>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-ink-subtle" aria-hidden="true" /> : <ChevronDown className="h-4 w-4 text-ink-subtle" aria-hidden="true" />}
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="space-y-2 border-t border-line bg-canvas/40 px-4 py-3.5 text-[13px]">
                      <p>
                        <span className="text-ink-subtle">Your answer: </span>
                        <span className={result.isCorrect ? 'text-success' : 'text-danger'}>{result.userAnswer}</span>
                      </p>
                      <p>
                        <span className="text-ink-subtle">Correct answer: </span>
                        <span className="font-medium text-ink">{result.card.answer}</span>
                      </p>
                      {result.card.explanation && <p className="leading-relaxed text-ink-muted">{result.card.explanation}</p>}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onBack}>
            Done
          </Button>
          <Button variant="secondary" icon={RotateCcw} onClick={() => setStage('setup')}>
            Take another exam
          </Button>
        </div>
      </div>
    );
  }

  return null;
};

const CONFIDENCE_OPTIONS: { level: ConfidenceLevel; label: string; key: string; right: string; wrong: string; wrongTone: string }[] = [
  { level: 'low', label: 'Guessing', key: 'L', right: '+5', wrong: '0', wrongTone: 'text-ink-subtle' },
  { level: 'medium', label: 'Fairly sure', key: 'M', right: '+14', wrong: '−5', wrongTone: 'text-danger' },
  { level: 'high', label: 'Certain', key: 'H', right: '+20', wrong: '−15', wrongTone: 'text-danger' },
];

const QUADRANT_COPY: Record<'mastery' | 'lucky-guess' | 'known-unknown' | 'blindspot', { label: string; description: string; tone: string; dot: string }> = {
  mastery: {
    label: 'Knew it',
    description: 'Right, and you were sure. This knowledge is solid.',
    tone: 'text-success',
    dot: 'bg-success',
  },
  'lucky-guess': {
    label: 'Lucky guesses',
    description: 'Right, but you were not sure. Review these so the knowledge sticks.',
    tone: 'text-gold',
    dot: 'bg-gold',
  },
  'known-unknown': {
    label: 'Honest gaps',
    description: 'Wrong, and you knew you were unsure. These are straightforward to fix by studying.',
    tone: 'text-ink-muted',
    dot: 'bg-ink-subtle',
  },
  blindspot: {
    label: 'Blind spots',
    description: 'Wrong, but you were sure. The riskiest kind of mistake, so review these first.',
    tone: 'text-danger',
    dot: 'bg-danger',
  },
};

const gradeFor = (accuracy: number): string => {
  if (accuracy >= 90) return 'A';
  if (accuracy >= 80) return 'B';
  if (accuracy >= 70) return 'C';
  if (accuracy >= 60) return 'D';
  return 'Not yet';
};

const formatPoints = (points: number): string => (points > 0 ? `+${points}` : points < 0 ? `−${Math.abs(points)}` : '0');

const SetupField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-2">
    <p className="text-[13px] font-medium text-ink">{label}</p>
    {children}
  </div>
);

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl border border-line bg-canvas p-1">
      {options.map(option => {
        const selected = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`h-9 rounded-lg px-2 text-[13px] font-medium tabular-nums transition-colors cursor-pointer ${
              selected ? 'bg-surface-hover text-ink shadow-sm' : 'text-ink-subtle hover:text-ink'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

const ResultStat: React.FC<{ label: string; value: string; suffix?: string; hint?: string }> = ({ label, value, suffix, hint }) => (
  <div className="rounded-2xl border border-line bg-surface p-4" title={hint}>
    <p className="text-[13px] text-ink-subtle">{label}</p>
    <p className="mt-1.5 flex items-baseline gap-1">
      <span className="text-[24px] font-semibold leading-none tracking-tight tabular-nums text-ink">{value}</span>
      {suffix && <span className="text-[13px] tabular-nums text-ink-subtle">{suffix}</span>}
    </p>
  </div>
);
