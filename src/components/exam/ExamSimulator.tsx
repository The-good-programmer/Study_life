import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  Award, 
  Clock, 
  HelpCircle, 
  RotateCcw, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle, 
  Brain, 
  Zap, 
  Printer, 
  Sparkles, 
  X,
  Play,
  Check,
  ChevronDown,
  ChevronUp,
  Share2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { 
  CardType, 
  ConfidenceLevel, 
  ExamQuadrant, 
  ExamQuestionResult, 
  ExamReport, 
  RetrievalCard, 
  StudySession 
} from '../../types';
import { StorageService } from '../../services/storageService';
import { soundEngine } from '../../services/soundEngine';
import { lifeSimService } from '../../services/lifeSimService';
import { DEMO_STUDY_SESSIONS } from '../../data/demoDecks';
import { CURATED_STARTER_DECKS } from '../../data/curatedStarterCatalog';
import { MathRenderer } from '../common/MathRenderer';

import { evaluateTextAnswer } from './examEvaluator';
import { UserAvatarBadge } from '../character/UserAvatarBadge';
import { shuffle } from '../../utils/shuffle';

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
  const [elapsedTotalSeconds, setElapsedTotalSeconds] = useState(0);

  // Report state
  const [finalReport, setFinalReport] = useState<ExamReport | null>(null);
  const [expandedResultIdx, setExpandedResultIdx] = useState<number | null>(null);
  const [copiedShare, setCopiedShare] = useState(false);

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
    setElapsedTotalSeconds(0);
    setStage('active');
  };

  const currentItem = examQuestions[currentIndex];

  const effectiveCardType: CardType = currentItem?.card
    ? (currentItem.card.cardType || (
        currentItem.card.clozeTemplate || currentItem.card.question.includes('{{')
          ? 'cloze'
          : (currentItem.card.options && currentItem.card.options.length > 0 ? 'multiple-choice' : 'standard')
      ))
    : 'standard';

  const hasOptions = !!(currentItem?.card?.options && currentItem.card.options.length > 0);

  // Evaluate single question
  const evaluateAnswer = useCallback((userAns: string, conf: ConfidenceLevel): ExamQuestionResult => {
    if (!currentItem) {
      throw new Error('No active question');
    }

    const targetAnswer = currentItem.card.answer.trim().toLowerCase();
    const cleanUserAns = userAns.trim().toLowerCase();

    // Check correctness
    let isCorrect = false;
    if (hasOptions) {
      const strippedUser = cleanUserAns.replace(/^[a-d1-4][).\s-]+\s*/i, '').trim();
      const strippedTarget = targetAnswer.replace(/^[a-d1-4][).\s-]+\s*/i, '').trim();
      isCorrect = cleanUserAns === targetAnswer || strippedUser === strippedTarget || strippedUser === targetAnswer || cleanUserAns === strippedTarget;
    } else {
      isCorrect = evaluateTextAnswer(userAns, currentItem.card.answer);
    }

    // Determine Quadrant & Points
    let quadrant: ExamQuadrant;
    let points = 0;

    if (isCorrect) {
      if (conf === 'high') {
        quadrant = 'mastery';
        points = 20; // Calibrated Mastery
      } else if (conf === 'medium') {
        quadrant = 'mastery';
        points = 14;
      } else {
        quadrant = 'lucky-guess';
        points = 5; // Lucky Guess
      }
    } else {
      if (conf === 'high') {
        quadrant = 'blindspot';
        points = -15; // Dangerous Misconception / Illusion
      } else if (conf === 'medium') {
        quadrant = 'known-unknown';
        points = -5;
      } else {
        quadrant = 'known-unknown';
        points = 0; // Acknowledged Gap
      }
    }

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
      const totalQ = examQuestions.length;
      const correctCount = newResults.filter(r => r.isCorrect).length;
      const rawAccuracy = Math.round((correctCount / totalQ) * 100);
      const totalPoints = newResults.reduce((acc, r) => acc + r.pointsEarned, 0);
      const maxPossible = totalQ * 20;

      const blindspots = newResults.filter(r => r.quadrant === 'blindspot').length;
      const luckyGuesses = newResults.filter(r => r.quadrant === 'lucky-guess').length;
      const knownUnknowns = newResults.filter(r => r.quadrant === 'known-unknown').length;
      const mastery = newResults.filter(r => r.quadrant === 'mastery').length;

      // Calibration accuracy: percentage of answers where confidence matched correctness
      // High confidence matches correct; Low confidence matches incorrect
      const calibratedItems = newResults.filter(r => 
        (r.confidence === 'high' && r.isCorrect) || 
        (r.confidence === 'low' && !r.isCorrect) ||
        (r.confidence === 'medium')
      ).length;
      const calibrationPercent = Math.round((calibratedItems / totalQ) * 100);

      const report: ExamReport = {
        id: `exam-${Date.now()}`,
        date: new Date().toISOString(),
        deckTitle: selectedDeckId === 'all' ? 'All Decks (Interleaved Comprehensive)' : (allDecks.find(d => d.id === selectedDeckId)?.title || 'Custom Exam'),
        totalQuestions: totalQ,
        correctCount,
        rawAccuracyPercent: rawAccuracy,
        confidenceWeightedScore: totalPoints,
        maxPossibleScore: maxPossible,
        calibrationPercent,
        blindspotCount: blindspots,
        luckyGuessCount: luckyGuesses,
        knownUnknownCount: knownUnknowns,
        masteryCount: mastery,
        timeSpentSeconds: elapsedTotalSeconds,
        questionResults: newResults,
      };

      StorageService.saveExamReport(report);
      StorageService.addXP(Math.max(10, Math.round(totalPoints / 2)));
      lifeSimService.awardStudyWage(
        `Mock Exam: ${report.deckTitle.slice(0, 20)} (${report.rawAccuracyPercent}%)`,
        Math.max(30, Math.round(totalPoints))
      );
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
  }, [currentIndex, examQuestions.length, timeLimitPerQuestion, selectedDeckId, allDecks, elapsedTotalSeconds]);

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
      setElapsedTotalSeconds(t => t + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isTimerActive, timeLimitPerQuestion]);

  // Keyboard Shortcuts (1-4 / A-D for options, Z / X / C for confidence, Enter to submit)
  useEffect(() => {
    if (stage !== 'active' || !currentItem) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      const key = e.key.toUpperCase();

      // Confidence Keys: Z = Low, X = Medium, C = High
      if (key === 'Z') {
        e.preventDefault();
        setSelectedConfidence('low');
      } else if (key === 'X') {
        e.preventDefault();
        setSelectedConfidence('medium');
      } else if (key === 'C') {
        e.preventDefault();
        setSelectedConfidence('high');
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
  }, [stage, currentItem, isAnswerSubmitted, effectiveCardType, hasOptions, selectedConfidence, handleSubmitCurrentAnswer, advanceQuestion, results]);

  // Launch Remediation Session
  const handleLaunchRemediation = () => {
    if (!finalReport) return;

    // Filter cards from blindspots and lucky guesses
    const remediationItems = finalReport.questionResults.filter(
      r => r.quadrant === 'blindspot' || r.quadrant === 'lucky-guess' || r.quadrant === 'known-unknown'
    );

    if (remediationItems.length === 0) {
      alert('Outstanding! You have zero blindspots or gaps to remediate.');
      return;
    }

    const sessionId = `remediation-${Date.now()}`;
    const cards = remediationItems.map(item => item.card);

    const remediationSession: StudySession = {
      id: sessionId,
      title: `Remediation Pilot: ${finalReport.deckTitle.slice(0, 35)}`,
      category: 'Diagnostic Remediation',
      description: `Targeted cognitive intervention repairing ${cards.length} identified blindspots and fragile traces.`,
      currentConceptIndex: 0,
      currentPhase: 'priming',
      elapsedSeconds: 0,
      createdAt: new Date().toISOString(),
      concepts: [
        {
          id: `c-${sessionId}-1`,
          order: 1,
          title: 'Targeted Remediation Queue',
          estimatedMinutes: Math.max(6, Math.round(cards.length * 1.2)),
          mentalModel: 'Focused neural repair: Re-wire the mental models behind questions where overconfidence led to errors or guesses masked gaps.',
          coreTakeaways: [
            `Diagnosed ${finalReport.blindspotCount} cognitive blindspots.`,
            `Diagnosed ${finalReport.luckyGuessCount} lucky guesses requiring stabilization.`
          ],
          keyTerms: cards.slice(0, 4).map(c => ({ term: c.question.slice(0, 25), definition: c.answer.slice(0, 50) })),
          feynmanPrompt: `Explain why your initial assumption failed on these concepts and articulate the correct mechanism.`,
          sampleMasteryExplanation: `A targeted cognitive breakdown reconciling misconceptions with empirical facts.`,
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
      <div className="max-w-2xl mx-auto space-y-6 py-6 animate-fadeIn">
        
        {/* Header with AI Proctor */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-3.5">
            <div className="relative w-12 h-12 rounded-2xl overflow-hidden p-0.5 bg-gradient-to-tr from-amber-500 via-indigo-500 to-cyan-500 shadow-xl shadow-amber-500/20 shrink-0">
              <UserAvatarBadge size="sm" showBorder={false} />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-slate-950 animate-ping" />
            </div>
            <div className="text-left">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-semibold">
                <Award className="w-3 h-3 text-amber-400" />
                <span>Studify High-Stakes Simulator</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight font-display">
                Mock Exam Simulator
              </h1>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto">
            Test yourself under genuine exam conditions with <strong>Confidence-Weighted Scoring</strong>. Your customized study partner proctors your session to eliminate illusions of competence before exam day.
          </p>
        </div>

        {/* Configuration Panel */}
        <div className="p-6 sm:p-8 rounded-3xl glass-panel space-y-6 border-white/[0.1]">
          {setupError && (
            <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2.5 animate-fadeIn">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{setupError}</span>
            </div>
          )}
          
          {/* Deck Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 font-display">
              Select Deck / Subject Area
            </label>
            <select
              value={selectedDeckId}
              onChange={(e) => setSelectedDeckId(e.target.value)}
              className="w-full p-3 rounded-2xl bg-slate-950/80 border border-white/[0.1] text-white text-xs font-semibold outline-none focus:border-indigo-500"
            >
              <option value="all">⚡ All Decks (Comprehensive Interleaved Exam)</option>
              {allDecks.map(deck => (
                <option key={deck.id} value={deck.id}>
                  {deck.title} ({deck.category})
                </option>
              ))}
            </select>
          </div>

          {/* Question Pool Size */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 font-display">
              Number of Questions
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[5, 10, 15, 25].map(cnt => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => setQuestionCountLimit(cnt)}
                  className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${
                    questionCountLimit === cnt
                      ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/30'
                      : 'bg-slate-950/60 text-slate-400 border-white/[0.08] hover:text-white'
                  }`}
                >
                  {cnt} Qs
                </button>
              ))}
            </div>
          </div>

          {/* Time Pressure Mode */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 font-display">
              Time Pressure / Pace
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { sec: 45, label: 'Sprint (45s/Q)' },
                { sec: 90, label: 'Board (90s/Q)' },
                { sec: 0, label: 'Untimed' },
              ].map(item => (
                <button
                  key={item.sec}
                  type="button"
                  onClick={() => setTimeLimitPerQuestion(item.sec)}
                  className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${
                    timeLimitPerQuestion === item.sec
                      ? 'bg-amber-600 text-white border-amber-400 shadow-md shadow-amber-600/30'
                      : 'bg-slate-950/60 text-slate-400 border-white/[0.08] hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Feedback Mode */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 font-display">
              Feedback Style
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setExamMode('board')}
                className={`p-3 rounded-2xl text-left border transition-all ${
                  examMode === 'board'
                    ? 'bg-indigo-950/60 border-indigo-500 text-white'
                    : 'bg-slate-950/60 border-white/[0.08] text-slate-400'
                }`}
              >
                <div className="text-xs font-bold text-white mb-0.5">Board Exam Mode</div>
                <div className="text-[11px] text-slate-400">Scores, calibration & blindspots revealed at the end.</div>
              </button>

              <button
                type="button"
                onClick={() => setExamMode('training')}
                className={`p-3 rounded-2xl text-left border transition-all ${
                  examMode === 'training'
                    ? 'bg-indigo-950/60 border-indigo-500 text-white'
                    : 'bg-slate-950/60 border-white/[0.08] text-slate-400'
                }`}
              >
                <div className="text-xs font-bold text-white mb-0.5">Training Mode</div>
                <div className="text-[11px] text-slate-400">Instant feedback & explanation after every question.</div>
              </button>
            </div>
          </div>

          {/* Scientific Scoring Callout */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/[0.08] text-xs text-slate-300 space-y-2">
            <div className="font-bold text-white flex items-center gap-1.5 font-display">
              <Brain className="w-4 h-4 text-amber-400" />
              <span>Confidence-Weighted Scoring (Bruno/Bushman Heuristic):</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="text-emerald-400">✓ Right + High Conf: <span className="font-bold">+20 pts</span> (Mastery)</div>
              <div className="text-rose-400">✗ Wrong + High Conf: <span className="font-bold">-15 pts</span> (Blindspot!)</div>
              <div className="text-amber-400">✓ Right + Low Conf: <span className="font-bold">+5 pts</span> (Guess)</div>
              <div className="text-slate-400">✗ Wrong + Low Conf: <span className="font-bold">0 pts</span> (Known Gap)</div>
            </div>
          </div>

          {/* Launch Buttons */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={onBack}
              className="px-5 py-3 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleStartExam}
              className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber-600 via-indigo-600 to-purple-600 hover:from-amber-500 hover:to-purple-500 text-white font-bold text-xs flex items-center gap-2 shadow-xl shadow-indigo-600/30 transition-all hover:scale-[1.02]"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Begin Examination</span>
            </button>
          </div>

        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER STAGE 2: ACTIVE EXAM ARENA
  // -------------------------------------------------------------
  if (stage === 'active' && currentItem) {
    const progressPercent = Math.round(((currentIndex) / examQuestions.length) * 100);

    return (
      <div className="max-w-2xl mx-auto space-y-6 py-4 animate-fadeIn">
        
        {/* Top HUD Scrubber & Timer */}
        <div className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-slate-950/80 border border-white/[0.08]">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (window.confirm('Exit exam? Progress will not be saved.')) {
                  setStage('setup');
                }
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
              title="Exit Exam"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <div className="text-xs font-bold text-white font-display">
                Question {currentIndex + 1} of {examQuestions.length}
              </div>
              <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                {currentItem.deckTitle}
              </div>
            </div>
          </div>

          {/* Progress Bar & Countdown Timer */}
          <div className="flex items-center gap-3">
            {timeLimitPerQuestion > 0 && (
              <div className={`px-3 py-1 rounded-xl font-mono text-xs font-bold border flex items-center gap-1.5 ${
                secondsRemaining <= 10
                  ? 'bg-rose-950/70 border-rose-500 text-rose-300 animate-pulse'
                  : 'bg-slate-900 border-white/[0.08] text-amber-400'
              }`}>
                <Clock className="w-3.5 h-3.5" />
                <span>{secondsRemaining}s</span>
              </div>
            )}

            <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-amber-500 to-indigo-500 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Question Card */}
        <div className="p-6 sm:p-8 rounded-3xl glass-panel space-y-6 border-white/[0.1]">
          
          <div className="flex items-center justify-between text-xs text-slate-400 uppercase tracking-wider font-bold">
            <span className="text-indigo-400">{currentItem.conceptTitle}</span>
            <span className="font-mono text-[11px] text-slate-500">
              {effectiveCardType === 'image-occlusion' ? 'Image Occlusion' : hasOptions ? 'Multiple Choice' : effectiveCardType === 'cloze' ? 'Cloze Deletion' : 'Concept Recall'}
            </span>
          </div>

          <h3 className="text-xl sm:text-2xl font-bold text-white leading-relaxed font-display">
            <MathRenderer text={currentItem.card.question} />
          </h3>

          {/* Image Occlusion Card View */}
          {effectiveCardType === 'image-occlusion' && currentItem.card.imageUrl && (
            <div className="relative w-full rounded-2xl overflow-hidden bg-slate-950/80 border border-white/[0.08] flex items-center justify-center p-2 shadow-inner select-none my-3">
              <img
                src={currentItem.card.imageUrl}
                alt="Technical or Anatomical Diagram"
                className="w-full h-auto object-contain max-h-[360px] pointer-events-none rounded-xl"
              />

              {/* Overlaid Occlusion Masks */}
              {(currentItem.card.masks || []).map((mask, idx) => {
                const isTarget = mask.id === currentItem.card.activeMaskId;
                const isRevealed = isTarget && isAnswerSubmitted;

                if (currentItem.card.occlusionMode === 'hide-one-reveal-one' && !isTarget) {
                  return null;
                }

                if (isTarget) {
                  return (
                    <div
                      key={mask.id}
                      className={`absolute rounded-lg flex items-center justify-center p-1 transition-all shadow-xl ${
                        isRevealed
                          ? 'bg-emerald-950/95 border-2 border-emerald-400 text-emerald-200 ring-2 ring-emerald-500/40'
                          : 'bg-amber-950/95 border-2 border-amber-400 text-amber-200 animate-pulse ring-2 ring-amber-500/40'
                      }`}
                      style={{
                        left: `${mask.x}%`,
                        top: `${mask.y}%`,
                        width: `${mask.width}%`,
                        height: `${mask.height}%`,
                      }}
                    >
                      <span className="text-[11px] font-bold font-mono truncate px-1">
                        {isRevealed ? (mask.label || currentItem.card.answer) : `? [Mask #${idx + 1}]`}
                      </span>
                    </div>
                  );
                }

                return (
                  <div
                    key={mask.id}
                    className="absolute rounded-lg bg-slate-900/95 border border-slate-700/80 flex items-center justify-center p-1 shadow-md select-none pointer-events-none"
                    style={{
                      left: `${mask.x}%`,
                      top: `${mask.y}%`,
                      width: `${mask.width}%`,
                      height: `${mask.height}%`,
                    }}
                  >
                    <span className="text-[10px] font-mono text-slate-500 font-bold">
                      [Mask #{idx + 1}]
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Multiple Choice Options */}
          {hasOptions && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
              {(currentItem.card.options && currentItem.card.options.length > 0
                ? currentItem.card.options
                : [currentItem.card.answer, 'Option B', 'Option C', 'Option D']
              ).map((opt, idx) => {
                const letter = ['A', 'B', 'C', 'D'][idx] || String(idx + 1);
                const isSelected = selectedAnswer === opt;

                let optStyle = 'bg-slate-900/80 hover:bg-slate-800 border-white/[0.08] text-slate-200';
                if (isSelected) {
                  optStyle = 'bg-indigo-600/30 border-indigo-500 text-white shadow-lg shadow-indigo-600/20';
                }

                if (isAnswerSubmitted) {
                  const isCorrect = opt.trim().toLowerCase() === currentItem.card.answer.trim().toLowerCase();
                  if (isCorrect) {
                    optStyle = 'bg-emerald-950/70 border-emerald-500 text-emerald-200 font-bold';
                  } else if (isSelected) {
                    optStyle = 'bg-rose-950/70 border-rose-500 text-rose-200';
                  }
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={isAnswerSubmitted}
                    onClick={() => setSelectedAnswer(opt)}
                    className={`p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3 ${optStyle}`}
                  >
                    <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold font-mono shrink-0 ${
                      isSelected ? 'bg-indigo-500 text-white' : 'bg-white/[0.08] text-slate-400'
                    }`}>
                      {letter}
                    </span>
                    <span className="text-xs font-medium pt-0.5 leading-snug">
                      <MathRenderer text={opt} />
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Cloze / Standard Free-Text Input */}
          {!hasOptions && !isAnswerSubmitted && (
            <div className="space-y-2 pt-2">
              <label className="text-[11px] font-semibold text-slate-400">
                Type your answer or target keyphrase:
              </label>
              <input
                type="text"
                value={selectedAnswer}
                onChange={(e) => setSelectedAnswer(e.target.value)}
                placeholder="Type your answer..."
                className="w-full p-3.5 rounded-2xl bg-slate-950/80 border border-white/[0.1] focus:border-indigo-500 text-white text-sm outline-none"
              />
            </div>
          )}

          {/* Training Mode Feedback Banner */}
          {isAnswerSubmitted && results[results.length - 1] && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-white/[0.08] space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  {results[results.length - 1].isCorrect ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Correct Retrieval
                    </span>
                  ) : (
                    <span className="text-rose-400 font-bold flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4" /> Misconception Detected
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-white/[0.06] text-slate-300">
                    Quadrant: {results[results.length - 1].quadrant}
                  </span>
                </div>
                <span className={`font-mono font-bold ${
                  results[results.length - 1].pointsEarned > 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {results[results.length - 1].pointsEarned > 0 ? `+${results[results.length - 1].pointsEarned}` : results[results.length - 1].pointsEarned} pts
                </span>
              </div>

              <div className="text-xs text-slate-200">
                <strong className="text-slate-400 block mb-0.5">Target Answer:</strong>
                {currentItem.card.answer}
              </div>

              {currentItem.card.explanation && (
                <div className="text-[11px] text-slate-400 border-t border-white/[0.06] pt-2 leading-relaxed">
                  {currentItem.card.explanation}
                </div>
              )}
            </div>
          )}

          {/* Metacognitive Confidence Selector */}
          {!isAnswerSubmitted && (
            <div className="pt-4 border-t border-white/[0.08] space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-300 flex items-center gap-1.5 font-display">
                  <span>Rate Your Subjective Confidence:</span>
                  <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
                </span>
                <span className="text-[11px] font-mono text-slate-500">Press Z, X, or C</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                
                {/* Low Confidence */}
                <button
                  type="button"
                  onClick={() => setSelectedConfidence('low')}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    selectedConfidence === 'low'
                      ? 'bg-slate-800 border-slate-400 text-white shadow-md'
                      : 'bg-slate-950/60 border-white/[0.08] text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold mb-1">
                    <span>Low (Guess)</span>
                    <kbd className="px-1.5 py-0.5 text-[11px] bg-slate-900 rounded border border-white/[0.1] font-mono">Z</kbd>
                  </div>
                  <div className="text-[11px] text-slate-400 leading-tight">+5 if right • 0 if wrong</div>
                </button>

                {/* Medium Confidence */}
                <button
                  type="button"
                  onClick={() => setSelectedConfidence('medium')}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    selectedConfidence === 'medium'
                      ? 'bg-amber-950/60 border-amber-500 text-white shadow-md'
                      : 'bg-slate-950/60 border-white/[0.08] text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold mb-1 text-amber-300">
                    <span>Medium</span>
                    <kbd className="px-1.5 py-0.5 text-[11px] bg-amber-950 rounded border border-amber-700 font-mono text-amber-300">X</kbd>
                  </div>
                  <div className="text-[11px] text-amber-400/80 leading-tight">+14 if right • -5 if wrong</div>
                </button>

                {/* High Confidence */}
                <button
                  type="button"
                  onClick={() => setSelectedConfidence('high')}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    selectedConfidence === 'high'
                      ? 'bg-indigo-950/60 border-indigo-400 text-white shadow-md'
                      : 'bg-slate-950/60 border-white/[0.08] text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold mb-1 text-indigo-300">
                    <span>High (Certain)</span>
                    <kbd className="px-1.5 py-0.5 text-[11px] bg-indigo-950 rounded border border-indigo-700 font-mono text-indigo-300">C</kbd>
                  </div>
                  <div className="text-[11px] text-indigo-300/80 leading-tight">+20 if right • -15 if wrong!</div>
                </button>

              </div>
            </div>
          )}

          {/* Submit / Advance Button */}
          <div className="pt-2 flex justify-end">
            {!isAnswerSubmitted ? (
              <button
                type="button"
                onClick={handleSubmitCurrentAnswer}
                disabled={!selectedConfidence}
                className={`px-8 py-3.5 rounded-2xl font-bold text-xs flex items-center gap-2 shadow-xl transition-all ${
                  !selectedConfidence
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/[0.04]'
                    : 'bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-white shadow-indigo-600/30 hover:scale-[1.02]'
                }`}
              >
                <span>Submit & Confirm Confidence</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => advanceQuestion(results)}
                className="px-8 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-xl shadow-indigo-600/30 transition-all hover:scale-[1.02]"
              >
                <span>{currentIndex + 1 < examQuestions.length ? 'Next Question' : 'View Exam Diagnostics'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>

        </div>

      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER STAGE 3: POST-EXAM DIAGNOSTIC REPORT
  // -------------------------------------------------------------
  if (stage === 'report' && finalReport) {
    const grade = finalReport.rawAccuracyPercent >= 90 ? 'A+ Mastered' 
      : finalReport.rawAccuracyPercent >= 80 ? 'A Solid'
      : finalReport.rawAccuracyPercent >= 70 ? 'B Competent'
      : finalReport.rawAccuracyPercent >= 60 ? 'C Developing'
      : 'Remediation Required';

    return (
      <div className="max-w-3xl mx-auto space-y-6 py-6 animate-fadeIn">
        
        {/* Report Header Card */}
        <div className="p-6 sm:p-8 rounded-3xl glass-panel space-y-6 border-amber-500/30 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold">
            <Award className="w-3.5 h-3.5 text-amber-400" />
            <span>Official Exam Diagnostic Scorecard</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight font-display">
            {finalReport.deckTitle}
          </h2>

          {/* High-Level Score Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            
            {/* Raw Accuracy */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/[0.08] space-y-1">
              <div className="text-2xl font-black text-white font-mono">{finalReport.rawAccuracyPercent}%</div>
              <div className="text-[11px] text-slate-400">Raw Accuracy</div>
            </div>

            {/* Confidence Weighted Score */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/[0.08] space-y-1">
              <div className="text-2xl font-black text-amber-400 font-mono">
                {finalReport.confidenceWeightedScore}
                <span className="text-xs text-slate-500 font-normal"> / {finalReport.maxPossibleScore}</span>
              </div>
              <div className="text-[11px] text-slate-400">Weighted Score</div>
            </div>

            {/* Metacognitive Calibration */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/[0.08] space-y-1">
              <div className="text-2xl font-black text-indigo-300 font-mono">{finalReport.calibrationPercent}%</div>
              <div className="text-[11px] text-slate-400">Self-Calibration</div>
            </div>

            {/* Calibrated Grade */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/[0.08] space-y-1">
              <div className="text-sm font-bold text-emerald-400 truncate pt-1">{grade}</div>
              <div className="text-[11px] text-slate-400">Mastery Grade</div>
            </div>

          </div>

          {/* Metacognitive Assessment */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-950 via-indigo-950/40 to-slate-950 border border-white/[0.08] flex flex-col sm:flex-row items-center gap-3.5 text-left">
            <div className="relative w-12 h-12 rounded-2xl overflow-hidden p-0.5 bg-gradient-to-tr from-indigo-500 via-purple-500 to-cyan-400 shrink-0 shadow-md">
              <UserAvatarBadge size="sm" showBorder={false} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-indigo-300 font-display">Metacognitive Assessment</span>
                <span className={`px-2 py-0.2 rounded-full text-[11px] font-mono font-bold ${
                  finalReport.calibrationPercent >= 80 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  {finalReport.calibrationPercent >= 80 ? 'Calibrated Mind' : 'Calibration Work Needed'}
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium leading-relaxed mt-0.5">
                {finalReport.blindspotCount > 0
                  ? `You encountered ${finalReport.blindspotCount} dangerous blindspot(s) where high confidence met wrong answers. Launch a Remediation Pilot below to repair them!`
                  : finalReport.calibrationPercent >= 80
                  ? "Flawless calibration! Your metacognitive awareness accurately reflects your memory strength. Zero dangerous blindspots detected."
                  : "Good effort! Turn those lucky guesses and known unknowns into calibrated mastery before test day."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const shareText = `🎓 Studify Mock Exam Scorecard\nDeck: ${finalReport.deckTitle}\nWeighted Score: ${finalReport.confidenceWeightedScore}/${finalReport.maxPossibleScore} (${finalReport.rawAccuracyPercent}% Raw Accuracy)\nMetacognitive Calibration: ${finalReport.calibrationPercent}%\nMastery Grade: ${grade}\n🎯 Calibrated Mastery: ${finalReport.masteryCount} | ⚠️ Blindspots: ${finalReport.blindspotCount}\n\nPowered by Studify 3D Study Platform 🎓✨`;
                navigator.clipboard.writeText(shareText);
                setCopiedShare(true);
                soundEngine.playSuccess();
                setTimeout(() => setCopiedShare(false), 2500);
              }}
              className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs font-bold text-white border border-white/[0.1] flex items-center justify-center gap-1.5 transition-all shrink-0 cursor-pointer shadow-sm"
              title="Copy scorecard to clipboard"
            >
              {copiedShare ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-indigo-400" />}
              <span>{copiedShare ? 'Copied to Clipboard!' : 'Share Score'}</span>
            </button>
          </div>
        </div>

        {/* 4-Quadrant Metacognitive Matrix Breakdown */}
        <div className="p-6 rounded-3xl glass-panel space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 font-display">
              <Brain className="w-4 h-4 text-indigo-400" />
              <span>Bruno/Bushman 4-Quadrant Metacognitive Matrix</span>
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              {finalReport.totalQuestions} Questions Analyzed
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            
            {/* Quadrant 1: Calibrated Mastery */}
            <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 space-y-1.5">
              <div className="flex items-center justify-between text-emerald-300 font-bold">
                <span>🎯 Calibrated Mastery</span>
                <span className="font-mono text-sm">{finalReport.masteryCount}</span>
              </div>
              <p className="text-[11px] text-emerald-400/80 leading-relaxed">
                Correct with High Confidence. Neural memory traces are structurally consolidated into long-term storage.
              </p>
            </div>

            {/* Quadrant 2: Lucky Guesses */}
            <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/40 space-y-1.5">
              <div className="flex items-center justify-between text-amber-300 font-bold">
                <span>🎲 Lucky Guesses</span>
                <span className="font-mono text-sm">{finalReport.luckyGuessCount}</span>
              </div>
              <p className="text-[11px] text-amber-400/80 leading-relaxed">
                Correct with Low Confidence. You guessed accurately, but lack conviction. Fragile synaptic trace.
              </p>
            </div>

            {/* Quadrant 3: Known Unknowns */}
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/[0.08] space-y-1.5">
              <div className="flex items-center justify-between text-slate-300 font-bold">
                <span>🔍 Known Unknowns</span>
                <span className="font-mono text-sm">{finalReport.knownUnknownCount}</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Incorrect with Low Confidence. Honest self-awareness of an unlearned concept. Ready for immediate encoding.
              </p>
            </div>

            {/* Quadrant 4: Dangerous Blindspots */}
            <div className={`p-4 rounded-2xl border space-y-1.5 ${
              finalReport.blindspotCount > 0 
                ? 'bg-rose-950/40 border-rose-500/60 shadow-lg shadow-rose-950/20' 
                : 'bg-slate-900/40 border-white/[0.06]'
            }`}>
              <div className="flex items-center justify-between text-rose-300 font-bold">
                <span>⚠️ Cognitive Blindspots</span>
                <span className="font-mono text-sm font-extrabold">{finalReport.blindspotCount}</span>
              </div>
              <p className="text-[11px] text-rose-300/80 leading-relaxed">
                Incorrect with High Confidence! Illusions of competence that ruin actual test performance. Priority remediation needed.
              </p>
            </div>

          </div>
        </div>

        {/* 1-Click Remediation Deck Launcher */}
        <div className="p-6 rounded-3xl glass-panel border-indigo-500/30 bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-indigo-950/40 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <h4 className="text-sm font-bold text-white flex items-center justify-center sm:justify-start gap-2 font-display">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Launch Targeted Remediation Pilot</span>
            </h4>
            <p className="text-xs text-slate-300 max-w-md leading-relaxed">
              Auto-generates a tailored study session containing only your <strong>{finalReport.blindspotCount + finalReport.luckyGuessCount}</strong> blindspots & lucky guesses to eliminate errors.
            </p>
          </div>

          <button
            type="button"
            onClick={handleLaunchRemediation}
            className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs flex items-center gap-2 shadow-xl shadow-indigo-600/30 transition-all hover:scale-105 shrink-0"
          >
            <Sparkles className="w-4 h-4" />
            <span>Remediate Blindspots</span>
          </button>
        </div>

        {/* Question-by-Question Diagnostic Review Ledger */}
        <div className="p-6 rounded-3xl glass-panel space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white font-display">
              Question-by-Question Metacognitive Ledger
            </h3>
            <button
              onClick={() => window.print()}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Report</span>
            </button>
          </div>

          <div className="space-y-2">
            {finalReport.questionResults.map((result, idx) => {
              const isExpanded = expandedResultIdx === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-white/[0.06] bg-slate-950/60 overflow-hidden transition-all text-xs"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedResultIdx(isExpanded ? null : idx)}
                    className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-white/[0.02]"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                        result.isCorrect 
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' 
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                      }`}>
                        {result.isCorrect ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                      </span>
                      <div>
                        <div className="font-bold text-white line-clamp-1">{result.card.question}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          Confidence: <span className="uppercase text-slate-300 font-bold">{result.confidence}</span> • {result.quadrant}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`font-mono font-bold ${
                        result.pointsEarned > 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {result.pointsEarned > 0 ? `+${result.pointsEarned}` : result.pointsEarned} pts
                      </span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="p-4 pt-1 border-t border-white/[0.06] space-y-2 bg-slate-900/40 text-xs">
                      <div>
                        <span className="font-semibold text-slate-400 block text-[11px]">Your Answer:</span>
                        <span className={result.isCorrect ? 'text-emerald-300' : 'text-rose-300'}>{result.userAnswer}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-400 block text-[11px]">Target Answer:</span>
                        <span className="text-white font-medium">{result.card.answer}</span>
                      </div>
                      {result.card.explanation && (
                        <div className="p-3 rounded-xl bg-slate-950 border border-white/[0.06] text-slate-300 text-[11px] leading-relaxed">
                          <strong>Nuance:</strong> {result.card.explanation}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={onBack}
            className="px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-all"
          >
            Back to Dashboard
          </button>

          <button
            type="button"
            onClick={() => setStage('setup')}
            className="px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-2 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retake Another Exam</span>
          </button>
        </div>

      </div>
    );
  }

  return null;
};
