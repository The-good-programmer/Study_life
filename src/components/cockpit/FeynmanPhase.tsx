import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Brain,
  Check,
  Eye,
  Link2,
  MessageSquare,
  Mic,
  MicOff,
  PenLine,
  PenTool,
  RotateCcw,
  Send,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { ConceptCheckpoint, CrossDeckBridge, FeynmanEvaluation, SocraticTurn, VivaDefenseVerdict } from '../../types';
import { AIService } from '../../services/aiService';
import { soundEngine } from '../../services/soundEngine';
import { speechService } from '../../services/speechService';
import { StorageService } from '../../services/storageService';
import { grantReward } from '../../services/economy/rewardService';
import { FSRSService } from '../../services/fsrsService';
import { KnowledgeGraphService } from '../../services/knowledgeGraphService';
import { characterService } from '../../services/characterService';
import { cn } from '../../utils/cn';
import { MathRenderer } from '../common/MathRenderer';
import { DualCodingWhiteboard } from '../canvas/DualCodingWhiteboard';
import { ScienceExplainerModal } from '../common/ScienceExplainerModal';
import { UserAvatarBadge } from '../character/UserAvatarBadge';
import { Badge, Button, ProgressRing } from '../ui/primitives';
import { AudioWaveformVisualizer } from './AudioWaveformVisualizer';

interface FeynmanPhaseProps {
  concept: ConceptCheckpoint;
  onComplete: () => void;
  onInspectSource?: (pageNumber?: number, snippet?: string) => void;
  sessionId?: string;
}

interface IWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

type Mode = 'viva' | 'written';

const MODES: { id: Mode; label: string; icon: typeof MessageSquare }[] = [
  { id: 'viva', label: 'Talk it through', icon: MessageSquare },
  { id: 'written', label: 'Write it out', icon: PenLine },
];

const VIVA_ROUNDS = 3;
/** Below these scores, one gap must be closed before moving on (or the learner continues anyway). */
const VIVA_PASS_SCORE = 65;
const WRITTEN_PASS_SCORE = 70;

const VERDICT_LABELS: Record<VivaDefenseVerdict['overallGrade'], string> = {
  'Summa Cum Laude': 'Outstanding',
  'Pass with Distinction': 'Excellent',
  'Sound Defense': 'Good',
  'Conditional Pass': 'Almost there',
  'Incomplete Defense': 'Not yet',
};

const REACTIONS: Record<string, { label: string; tone: 'success' | 'danger' | 'brand' | 'gold' }> = {
  impressed: { label: 'Impressed', tone: 'success' },
  satisfied: { label: 'Satisfied', tone: 'brand' },
  skeptical: { label: 'Not convinced', tone: 'danger' },
  probing: { label: 'Digging deeper', tone: 'gold' },
};

const RELATIONSHIPS: Record<CrossDeckBridge['relationshipType'], string> = {
  prerequisite: 'Builds on',
  analogous: 'Similar to',
  contrast: 'Contrast with',
};

const PEDAGOGY_COPY = {
  scaffolding: 'This is still new to you, so your study partner will guide you step by step.',
  adversarial: 'You know this well, so expect tough follow-up questions.',
  dialectic: 'Your study partner will ask you to reason it through.',
} as const;

const AI_ERROR = 'Could not get feedback just now. Check your connection or AI key in Settings, then try again.';

const wordCount = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);

/** Step 3 of the guided session: explain the concept in your own words (the Feynman technique). */
export const FeynmanPhase: React.FC<FeynmanPhaseProps> = ({ concept, onComplete, onInspectSource, sessionId }) => {
  // StudyPilot remounts this step for each concept, so these are computed once.
  const [mode, setMode] = useState<Mode>('viva');
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [showScienceModal, setShowScienceModal] = useState(false);
  const [showBridges, setShowBridges] = useState(false);
  const [pedState] = useState(() => FSRSService.getConceptPedagogicalState(concept.retrievalCards || []));
  const [bridges] = useState<CrossDeckBridge[]>(() =>
    sessionId ? KnowledgeGraphService.findCrossDeckBridges(concept, sessionId, 4) : [],
  );
  const [examinerName] = useState(() => characterService.getCharacter().name || 'Your study partner');
  const [isAiAvailable] = useState(() => AIService.isAvailable());

  // Speech
  const [isListening, setIsListening] = useState(false);
  const [isSpeakingTutor, setIsSpeakingTutor] = useState(false);
  const [speakingTurnId, setSpeakingTurnId] = useState<string | null>(null);
  const [speechSupported] = useState(() => {
    if (typeof window === 'undefined') return false;
    const win = window as unknown as IWindow;
    return !!(win.SpeechRecognition || win.webkitSpeechRecognition);
  });
  const recognitionRef = useRef<any>(null);

  // Talk it through (viva)
  const [vivaRounds, setVivaRounds] = useState(1);
  const [vivaTurns, setVivaTurns] = useState<SocraticTurn[]>(() => [
    {
      id: `turn-init-${concept.id}`,
      role: 'examiner',
      text: `${concept.feynmanPrompt} Explain it in your own words, as simply as you can.`,
      timestamp: Date.now(),
      turnType: 'initial-prompt',
      reaction: 'probing',
    },
  ]);
  const [candidateSpeech, setCandidateSpeech] = useState('');
  const [isVivaThinking, setIsVivaThinking] = useState(false);
  const [vivaVerdict, setVivaVerdict] = useState<VivaDefenseVerdict | null>(null);
  const [verdictXp, setVerdictXp] = useState(0);
  const [autoSpeakExaminer, setAutoSpeakExaminer] = useState(false);
  const [vivaError, setVivaError] = useState<string | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const hasSpokenInitialRef = useRef<string | null>(null);

  // Write it out
  const [explanation, setExplanation] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<FeynmanEvaluation | null>(null);
  const [explainXp, setExplainXp] = useState(0);
  const [writtenError, setWrittenError] = useState<string | null>(null);
  const [showSample, setShowSample] = useState(false);
  const [followUpQuestion, setFollowUpQuestion] = useState('');
  const [followUpAnswer, setFollowUpAnswer] = useState<string | null>(null);
  const [isAskingFollowUp, setIsAskingFollowUp] = useState(false);
  const hasPaidExplainRef = useRef(false);

  // Closing a gap before moving on
  const [writtenGapAnswer, setWrittenGapAnswer] = useState('');
  const [isWrittenGapClosed, setIsWrittenGapClosed] = useState(false);
  const [vivaGapAnswer, setVivaGapAnswer] = useState('');
  const [isVivaGapClosed, setIsVivaGapClosed] = useState(false);

  useEffect(() => {
    const unsubscribe = speechService.subscribe(setIsSpeakingTutor);
    return () => {
      unsubscribe();
      speechService.stop();
    };
  }, []);

  // Read the opening question aloud once, if the learner turned that on.
  useEffect(() => {
    if (autoSpeakExaminer && hasSpokenInitialRef.current !== concept.id && vivaTurns[0]) {
      hasSpokenInitialRef.current = concept.id;
      const initialTurn = vivaTurns[0];
      speechService.speak(initialTurn.text, () => setSpeakingTurnId(null));
      setSpeakingTurnId(initialTurn.id);
    }
  }, [concept.id, autoSpeakExaminer, vivaTurns]);

  // Keep the newest message in view inside the transcript, without scrolling the page.
  useEffect(() => {
    const box = transcriptRef.current;
    if (box) box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
  }, [vivaTurns, isVivaThinking]);

  // Dictation, written into whichever box the current mode uses.
  useEffect(() => {
    const win = window as unknown as IWindow;
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        recognition.onresult = (event: any) => {
          let transcript = '';
          for (let i = 0; i < event.results.length; i++) transcript += event.results[i][0].transcript + ' ';
          const text = transcript.trim();
          if (!text) return;
          if (mode === 'viva') setCandidateSpeech(text);
          else setExplanation(text);
        };
        recognition.onerror = (event: any) => {
          console.warn('Speech recognition error:', event.error);
          setIsListening(false);
        };
        recognition.onend = () => setIsListening(false);
        recognitionRef.current = recognition;
      } catch (e) {
        console.warn('Failed to initialize speech recognition:', e);
      }
    }
    return () => {
      try {
        recognitionRef.current?.abort();
      } catch {
        // ignore
      }
    };
  }, [mode]);

  const stopListening = () => {
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const toggleDictation = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      stopListening();
      return;
    }
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch (err) {
      console.error('Error starting speech recognition:', err);
    }
  };

  /* -------------------------- Talk it through -------------------------- */

  const handleSendVivaTurn = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const input = candidateSpeech.trim();
    if (input.length < 6 || isVivaThinking) return;

    stopListening();
    speechService.stop();
    setSpeakingTurnId(null);
    setVivaError(null);

    const studentTurn: SocraticTurn = { id: `turn-student-${Date.now()}`, role: 'student', text: input, timestamp: Date.now() };
    const history = [...vivaTurns, studentTurn];
    const streamingTurnId = `turn-examiner-${Date.now()}`;
    setVivaTurns([
      ...history,
      {
        id: streamingTurnId,
        role: 'examiner',
        text: '',
        timestamp: Date.now(),
        turnType: vivaRounds >= VIVA_ROUNDS ? 'verdict' : 'mechanism-probe',
        reaction: 'probing',
      },
    ]);
    setCandidateSpeech('');
    setIsVivaThinking(true);

    try {
      let streamed = '';
      const response = await AIService.streamVivaVoceTurn(
        concept,
        history,
        input,
        vivaRounds,
        (chunk) => {
          streamed += chunk;
          setVivaTurns(prev => prev.map(t => (t.id === streamingTurnId ? { ...t, text: streamed } : t)));
        },
        undefined,
        sessionId,
      );

      setVivaTurns(prev => prev.map(t => (t.id === streamingTurnId ? { ...response.nextTurn, id: streamingTurnId } : t)));

      if (response.verdict) {
        setVivaVerdict(response.verdict);
        soundEngine.playVerdictGavel();
        setVerdictXp(grantReward({ kind: 'viva-verdict' }, { label: 'Oral explanation' }).xp);
      } else {
        setVivaRounds(prev => prev + 1);
        soundEngine.playSocraticChallengeChime();
        grantReward({ kind: 'viva-round' }, { label: 'Oral explanation round' });
      }

      if (autoSpeakExaminer) {
        speechService.speak(response.nextTurn.text, () => setSpeakingTurnId(null));
        setSpeakingTurnId(streamingTurnId);
      }
    } catch (err) {
      console.error('Viva turn failed:', err);
      // Take the unanswered turn back so the learner can send it again.
      setVivaTurns(prev => prev.filter(t => t.id !== streamingTurnId && t.id !== studentTurn.id));
      setCandidateSpeech(input);
      setVivaError(AI_ERROR);
    } finally {
      setIsVivaThinking(false);
    }
  };

  const handleToggleSpeakTurn = (turn: SocraticTurn) => {
    if (speakingTurnId === turn.id && isSpeakingTutor) {
      speechService.stop();
      setSpeakingTurnId(null);
    } else {
      speechService.speak(turn.text, () => setSpeakingTurnId(null));
      setSpeakingTurnId(turn.id);
    }
  };

  const handleResetViva = () => {
    speechService.stop();
    setSpeakingTurnId(null);
    setVivaVerdict(null);
    setVivaRounds(1);
    setVivaError(null);
    setVivaGapAnswer('');
    setIsVivaGapClosed(false);
    const openingTurn: SocraticTurn = {
      id: `turn-init-${Date.now()}`,
      role: 'examiner',
      text: `Let's try "${concept.title}" again. ${concept.feynmanPrompt}`,
      timestamp: Date.now(),
      turnType: 'initial-prompt',
      reaction: 'probing',
    };
    setVivaTurns([openingTurn]);
    if (autoSpeakExaminer) {
      speechService.speak(openingTurn.text, () => setSpeakingTurnId(null));
      setSpeakingTurnId(openingTurn.id);
    }
  };

  /* ---------------------------- Write it out ---------------------------- */

  const handleWrittenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (wordCount(explanation) < 4 || isEvaluating) return;
    stopListening();
    setIsEvaluating(true);
    setWrittenError(null);
    try {
      const diagramDataUrl = StorageService.getConceptDiagram(concept.id) || concept.diagramDataUrl;
      const result = await AIService.evaluateFeynmanExplanation(concept, explanation, diagramDataUrl || undefined, sessionId);
      setEvaluation(result);
      setIsWrittenGapClosed(false);
      setWrittenGapAnswer('');
      soundEngine.playCompletionChime();
      // The first explanation of a concept pays; revisions are for learning, not for pay.
      if (!hasPaidExplainRef.current) {
        hasPaidExplainRef.current = true;
        setExplainXp(grantReward({ kind: 'explain' }, { label: 'Written explanation' }).xp);
      }
    } catch (err) {
      console.error(err);
      setWrittenError(AI_ERROR);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleAskFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const question = followUpQuestion.trim();
    if (!question || isAskingFollowUp) return;
    setIsAskingFollowUp(true);
    try {
      setFollowUpAnswer(await AIService.askSocraticFollowUp(concept, explanation, question));
    } catch (err) {
      console.error(err);
      setFollowUpAnswer(AI_ERROR);
    } finally {
      setIsAskingFollowUp(false);
    }
  };

  const handleSpeakFeedback = () => {
    if (isSpeakingTutor) {
      speechService.stop();
    } else if (evaluation) {
      speechService.speak(
        `${evaluation.grade}. What you explained well: ${evaluation.masteredPoints.join(', ')}. What to add: ${evaluation.missingNuances.join(', ')}. ${evaluation.actionableFeedback}`,
      );
    }
  };

  const vivaAverage = vivaVerdict
    ? Math.round((vivaVerdict.depthScore + vivaVerdict.analogyIntegrity + vivaVerdict.jargonFreeScore) / 3)
    : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-5 animate-fadeIn">
      {/* Prompt */}
      <section className="relative overflow-hidden rounded-3xl border border-line-strong bg-surface p-6 sm:p-8">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(560px_240px_at_100%_0%,var(--brand-soft),transparent_70%)]"
          aria-hidden="true"
        />
        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-text">
              <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
              Explain it in your own words
            </p>
            <div className="-mr-2 flex flex-wrap items-center gap-0.5">
              {concept.sourceAnchor && onInspectSource && (
                <Button
                  size="sm"
                  variant="ghost"
                  icon={BookOpen}
                  onClick={() => onInspectSource(concept.sourceAnchor?.pageNumber, concept.sourceAnchor?.snippet)}
                >
                  Source, p. {concept.sourceAnchor.pageNumber}
                </Button>
              )}
              <Button size="sm" variant="ghost" icon={PenTool} aria-pressed={showWhiteboard} onClick={() => setShowWhiteboard(v => !v)}>
                {showWhiteboard ? 'Hide sketch' : 'Sketch'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon={Brain}
                onClick={() => {
                  soundEngine.playCompanionBubble();
                  setShowScienceModal(true);
                }}
              >
                Why this works
              </Button>
            </div>
          </div>
          <h2 className="mt-3 text-[19px] font-medium leading-relaxed text-ink sm:text-[22px]">
            <MathRenderer text={concept.feynmanPrompt} />
          </h2>
          <p className="mt-3 text-[13px] leading-relaxed text-ink-subtle">
            Teach it the way you would to a friend who is new to the topic. If you need a technical word, explain it too.
          </p>
        </div>
      </section>

      {showWhiteboard && (
        <div className="animate-fadeIn">
          <DualCodingWhiteboard concept={concept} />
        </div>
      )}

      {/* Mode and context */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="How to explain" className="inline-flex rounded-xl border border-line bg-canvas p-1">
          {MODES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              onClick={() => setMode(id)}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-colors cursor-pointer',
                mode === id ? 'bg-surface-hover text-ink shadow-sm' : 'text-ink-subtle hover:text-ink',
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
        {bridges.length > 0 && (
          <Button size="sm" variant="ghost" icon={Link2} aria-expanded={showBridges} onClick={() => setShowBridges(v => !v)}>
            Linked to {bridges.length} {bridges.length === 1 ? 'concept' : 'concepts'} in your other decks
          </Button>
        )}
      </div>

      {showBridges && bridges.length > 0 && (
        <ul className="grid gap-2 animate-fadeIn sm:grid-cols-2">
          {bridges.map(bridge => (
            <li key={bridge.targetConceptId} className="rounded-2xl border border-line bg-surface px-4 py-3">
              <p className="text-xs text-ink-subtle">
                {RELATIONSHIPS[bridge.relationshipType]} · {bridge.targetDeckTitle}
              </p>
              <p className="mt-0.5 truncate text-sm font-medium text-ink">{bridge.targetConceptTitle}</p>
              {bridge.sharedTerms.length > 0 && (
                <p className="mt-1 truncate text-xs text-ink-subtle">Shared: {bridge.sharedTerms.slice(0, 3).join(', ')}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* ---------------- Talk it through ---------------- */}
      {mode === 'viva' && (
        <section className="overflow-hidden rounded-3xl border border-line bg-surface animate-fadeIn">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5 sm:px-5">
            <div className="min-w-0">
              <p className="text-[13px] font-medium tabular-nums text-ink">
                {vivaVerdict ? 'Finished' : `Round ${Math.min(vivaRounds, VIVA_ROUNDS)} of ${VIVA_ROUNDS}`}
              </p>
              <p className="text-xs text-ink-subtle">{PEDAGOGY_COPY[pedState.mode] ?? PEDAGOGY_COPY.dialectic}</p>
            </div>
            <div className="-mr-2 flex items-center gap-0.5">
              <Button
                size="sm"
                variant="ghost"
                icon={autoSpeakExaminer ? Volume2 : VolumeX}
                aria-pressed={autoSpeakExaminer}
                onClick={() => setAutoSpeakExaminer(v => !v)}
              >
                Read aloud {autoSpeakExaminer ? 'on' : 'off'}
              </Button>
              <Button size="sm" variant="ghost" icon={RotateCcw} onClick={handleResetViva}>
                Start over
              </Button>
            </div>
          </div>

          <div ref={transcriptRef} className="max-h-[480px] space-y-5 overflow-y-auto px-4 py-5 sm:px-6" aria-live="polite">
            {vivaTurns.map(turn => (
              <TurnBubble
                key={turn.id}
                turn={turn}
                examinerName={examinerName}
                isAiAvailable={isAiAvailable}
                isSpeaking={speakingTurnId === turn.id && isSpeakingTutor}
                onToggleSpeak={() => handleToggleSpeakTurn(turn)}
              />
            ))}
            {isVivaThinking && vivaTurns[vivaTurns.length - 1]?.text === '' && (
              <p className="flex items-center gap-2 pl-11 text-[13px] text-ink-subtle">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" aria-hidden="true" />
                {examinerName} is thinking…
              </p>
            )}
          </div>

          {!vivaVerdict ? (
            <form onSubmit={handleSendVivaTurn} className="border-t border-line p-4 sm:p-5">
              <label htmlFor={`viva-input-${concept.id}`} className="sr-only">
                Your explanation
              </label>
              <textarea
                id={`viva-input-${concept.id}`}
                rows={3}
                value={candidateSpeech}
                onChange={(e) => setCandidateSpeech(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSendVivaTurn();
                }}
                placeholder={speechSupported ? 'Type your answer, or press Speak and say it' : 'Type your answer'}
                className={cn(
                  'w-full resize-none rounded-2xl border bg-canvas px-4 py-3 text-[15px] leading-relaxed text-ink placeholder:text-ink-subtle transition-colors focus:outline-none',
                  isListening ? 'border-success' : 'border-line-strong focus:border-brand',
                )}
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {speechSupported && (
                    <Button variant={isListening ? 'danger' : 'secondary'} icon={isListening ? MicOff : Mic} onClick={toggleDictation}>
                      {isListening ? 'Stop' : 'Speak'}
                    </Button>
                  )}
                  {isSpeakingTutor && speakingTurnId && (
                    <Button
                      variant="ghost"
                      icon={VolumeX}
                      onClick={() => {
                        speechService.stop();
                        setSpeakingTurnId(null);
                        if (speechSupported && !isListening) toggleDictation();
                      }}
                    >
                      Stop and answer
                    </Button>
                  )}
                  {(isListening || (speakingTurnId && isSpeakingTutor)) && (
                    <AudioWaveformVisualizer isActive mode={isListening ? 'candidate' : 'examiner'} barCount={14} />
                  )}
                </div>
                <Button type="submit" variant="primary" icon={Send} disabled={isVivaThinking || candidateSpeech.trim().length < 6}>
                  Send
                </Button>
              </div>
              {vivaError && (
                <p role="alert" className="mt-2 text-[13px] text-danger">
                  {vivaError}
                </p>
              )}
            </form>
          ) : (
            <div className="space-y-4 border-t border-line p-4 sm:p-6">
              <ScoreSummary
                eyebrow="Your explanation"
                title={VERDICT_LABELS[vivaVerdict.overallGrade] ?? vivaVerdict.overallGrade}
                score={vivaAverage}
                xp={verdictXp}
                metrics={[
                  { label: 'Depth', hint: 'Step-by-step reasoning', value: vivaVerdict.depthScore },
                  { label: 'Comparison', hint: 'How well your analogy fits', value: vivaVerdict.analogyIntegrity },
                  { label: 'Plain words', hint: 'No unexplained jargon', value: vivaVerdict.jargonFreeScore },
                ]}
                strengths={vivaVerdict.keyStrengths}
                gaps={vivaVerdict.vulnerableBlindspots}
                summary={vivaVerdict.verdictSummary}
              />
              {vivaAverage >= VIVA_PASS_SCORE || isVivaGapClosed ? (
                <ContinueRow onContinue={onComplete} note={isVivaGapClosed ? 'Gap closed.' : undefined} />
              ) : (
                <GapCheck
                  score={vivaAverage}
                  passScore={VIVA_PASS_SCORE}
                  gap={vivaVerdict.vulnerableBlindspots[0] || 'the step-by-step mechanism'}
                  answer={vivaGapAnswer}
                  onAnswerChange={setVivaGapAnswer}
                  onClose={() => {
                    setIsVivaGapClosed(true);
                    soundEngine.playCorrectChime();
                  }}
                  onRetry={handleResetViva}
                  retryLabel="Talk it through again"
                  onContinueAnyway={onComplete}
                />
              )}
            </div>
          )}
        </section>
      )}

      {/* ---------------- Write it out ---------------- */}
      {mode === 'written' && (
        <div className="space-y-4 animate-fadeIn">
          {!evaluation ? (
            <form onSubmit={handleWrittenSubmit} className="rounded-3xl border border-line bg-surface p-4 sm:p-5">
              <label htmlFor={`written-input-${concept.id}`} className="sr-only">
                Your explanation
              </label>
              <textarea
                id={`written-input-${concept.id}`}
                rows={8}
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder="Explain how it works, step by step, in your own words."
                className={cn(
                  'w-full resize-none rounded-2xl border bg-canvas px-4 py-3 text-[15px] leading-relaxed text-ink placeholder:text-ink-subtle transition-colors focus:outline-none',
                  isListening ? 'border-success' : 'border-line-strong focus:border-brand',
                )}
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {speechSupported && (
                    <Button variant={isListening ? 'danger' : 'secondary'} icon={isListening ? MicOff : Mic} onClick={toggleDictation}>
                      {isListening ? 'Stop' : 'Dictate'}
                    </Button>
                  )}
                  <span className="text-xs tabular-nums text-ink-subtle">{wordCount(explanation)} words</span>
                </div>
                <Button type="submit" variant="primary" icon={isEvaluating ? undefined : Send} disabled={isEvaluating || wordCount(explanation) < 4}>
                  {isEvaluating ? 'Checking…' : 'Get feedback'}
                </Button>
              </div>
              {writtenError && (
                <p role="alert" className="mt-2 text-[13px] text-danger">
                  {writtenError}
                </p>
              )}
            </form>
          ) : (
            <section className="space-y-4 rounded-3xl border border-line bg-surface p-4 animate-fadeIn sm:p-6">
              <ScoreSummary
                eyebrow={evaluation.isOfflineSelfCheck ? 'Check it yourself' : 'Feedback on your explanation'}
                title={evaluation.isOfflineSelfCheck ? 'Compare with the key points' : evaluation.grade}
                score={evaluation.isOfflineSelfCheck ? null : evaluation.score}
                xp={explainXp}
                strengths={evaluation.masteredPoints}
                gaps={evaluation.missingNuances}
                summary={evaluation.actionableFeedback}
                actions={
                  <>
                    {!evaluation.isOfflineSelfCheck && (
                      <Button size="sm" variant="ghost" icon={isSpeakingTutor ? VolumeX : Volume2} onClick={handleSpeakFeedback}>
                        {isSpeakingTutor ? 'Stop' : 'Listen'}
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => setEvaluation(null)}>
                      Revise
                    </Button>
                  </>
                }
              />

              {evaluation.diagramAnalysis && (
                <div className="rounded-2xl border border-line px-4 py-3">
                  <p className="flex items-center justify-between gap-2 text-sm font-medium text-ink">
                    <span className="inline-flex items-center gap-1.5">
                      <PenTool className="h-4 w-4 text-ink-subtle" aria-hidden="true" />
                      Your sketch
                    </span>
                    <span className="text-xs tabular-nums text-ink-subtle">Matches the idea: {evaluation.diagramAnalysis.alignmentScore}%</span>
                  </p>
                  <div className="mt-2 grid gap-2 text-[13px] leading-relaxed sm:grid-cols-2">
                    {evaluation.diagramAnalysis.visualStrengths && (
                      <p className="text-ink-muted">
                        <span className="font-medium text-success">Works: </span>
                        {evaluation.diagramAnalysis.visualStrengths}
                      </p>
                    )}
                    {evaluation.diagramAnalysis.visualFlawsOrGaps && (
                      <p className="text-ink-muted">
                        <span className="font-medium text-due">Missing: </span>
                        {evaluation.diagramAnalysis.visualFlawsOrGaps}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div>
                <Button size="sm" variant="ghost" icon={Eye} aria-expanded={showSample} onClick={() => setShowSample(v => !v)} className="-ml-2">
                  {showSample ? 'Hide the example explanation' : 'See an example explanation'}
                </Button>
                {showSample && (
                  <p className="mt-2 rounded-2xl bg-surface-hover px-4 py-3 text-[13px] leading-relaxed text-ink-muted animate-fadeIn">
                    <MathRenderer text={concept.sampleMasteryExplanation} />
                  </p>
                )}
              </div>

              <form onSubmit={handleAskFollowUp} className="border-t border-line pt-4">
                <label htmlFor={`follow-up-${concept.id}`} className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
                  <Sparkles className="h-3.5 w-3.5 text-brand-text" aria-hidden="true" />
                  Still unsure? Ask a question
                </label>
                <div className="mt-2 flex gap-2">
                  <input
                    id={`follow-up-${concept.id}`}
                    type="text"
                    value={followUpQuestion}
                    onChange={(e) => setFollowUpQuestion(e.target.value)}
                    placeholder="e.g. Why does this only go one way?"
                    className="h-10 min-w-0 flex-1 rounded-xl border border-line-strong bg-canvas px-3 text-sm text-ink placeholder:text-ink-subtle transition-colors focus:border-brand focus:outline-none"
                  />
                  <Button type="submit" disabled={isAskingFollowUp || !followUpQuestion.trim()}>
                    {isAskingFollowUp ? 'Thinking…' : 'Ask'}
                  </Button>
                </div>
                {followUpAnswer && (
                  <p className="mt-3 rounded-2xl bg-brand-soft px-4 py-3 text-[13px] leading-relaxed text-ink animate-fadeIn" aria-live="polite">
                    {followUpAnswer}
                  </p>
                )}
              </form>

              {evaluation.isOfflineSelfCheck || evaluation.score >= WRITTEN_PASS_SCORE || isWrittenGapClosed ? (
                <ContinueRow onContinue={onComplete} note={isWrittenGapClosed ? 'Gap closed.' : undefined} />
              ) : (
                <GapCheck
                  score={evaluation.score}
                  passScore={WRITTEN_PASS_SCORE}
                  gap={evaluation.missingNuances[0] || 'the core cause and effect'}
                  answer={writtenGapAnswer}
                  onAnswerChange={setWrittenGapAnswer}
                  onClose={() => {
                    setIsWrittenGapClosed(true);
                    soundEngine.playCorrectChime();
                  }}
                  onRetry={() => setEvaluation(null)}
                  retryLabel="Revise the whole explanation"
                  onContinueAnyway={onComplete}
                />
              )}
            </section>
          )}
        </div>
      )}

      <ScienceExplainerModal isOpen={showScienceModal} onClose={() => setShowScienceModal(false)} initialTopic="feynman" />
    </div>
  );
};

/* ------------------------------------------------------------------ */

const TurnBubble: React.FC<{
  turn: SocraticTurn;
  examinerName: string;
  isAiAvailable: boolean;
  isSpeaking: boolean;
  onToggleSpeak: () => void;
}> = ({ turn, examinerName, isAiAvailable, isSpeaking, onToggleSpeak }) => {
  const isExaminer = turn.role === 'examiner';
  if (isExaminer && !turn.text) return null;
  const reaction = turn.reaction && turn.turnType !== 'initial-prompt' ? REACTIONS[turn.reaction] : undefined;

  if (!isExaminer) {
    return (
      <div className="flex justify-end animate-fadeIn">
        <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-brand-soft px-4 py-3 text-[15px] leading-relaxed text-ink">
          <MathRenderer text={turn.text} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 animate-fadeIn">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-hover">
        <UserAvatarBadge size="xs" showBorder={false} />
      </span>
      <div className="min-w-0 max-w-[85%]">
        <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-xs font-medium text-ink">{examinerName}</span>
          <span className="text-xs text-ink-subtle">{isAiAvailable ? 'AI' : 'Practice mode'}</span>
          {reaction && <Badge tone={reaction.tone}>{reaction.label}</Badge>}
          <button
            type="button"
            onClick={onToggleSpeak}
            aria-label={isSpeaking ? 'Stop reading aloud' : 'Read aloud'}
            title={isSpeaking ? 'Stop reading aloud' : 'Read aloud'}
            className={cn(
              'inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors cursor-pointer',
              isSpeaking ? 'bg-brand-soft text-brand-text' : 'text-ink-subtle hover:bg-surface-hover hover:text-ink',
            )}
          >
            <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
        <div className="rounded-2xl rounded-tl-md bg-surface-hover px-4 py-3 text-[15px] leading-relaxed text-ink">
          <MathRenderer text={turn.text} />
        </div>
        {turn.jargonDetected && turn.jargonDetected.length > 0 && (
          <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-subtle">
            <AlertTriangle className="h-3 w-3 text-gold" aria-hidden="true" />
            Explain these words too:
            {turn.jargonDetected.map(word => (
              <Badge key={word} tone="gold">
                {word}
              </Badge>
            ))}
          </p>
        )}
      </div>
    </div>
  );
};

const ScoreSummary: React.FC<{
  eyebrow: string;
  title: string;
  score: number | null;
  xp: number;
  metrics?: { label: string; hint: string; value: number }[];
  strengths: string[];
  gaps: string[];
  summary?: string;
  actions?: React.ReactNode;
}> = ({ eyebrow, title, score, xp, metrics, strengths, gaps, summary, actions }) => (
  <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-4">
      {score !== null && (
        <ProgressRing value={score} size={64} stroke={6} tone={score >= 70 ? 'success' : 'brand'}>
          <span className="text-[15px] font-semibold tabular-nums text-ink">{score}</span>
        </ProgressRing>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs text-ink-subtle">{eyebrow}</p>
        <p className="text-lg font-semibold text-ink">{title}</p>
        {xp > 0 && <p className="text-xs tabular-nums text-success">+{xp} XP</p>}
      </div>
      {actions && <div className="flex items-center gap-0.5">{actions}</div>}
    </div>

    {metrics && (
      <dl className="grid grid-cols-3 gap-2">
        {metrics.map(metric => (
          <div key={metric.label} className="rounded-xl border border-line px-3 py-2.5" title={metric.hint}>
            <dt className="text-xs text-ink-subtle">{metric.label}</dt>
            <dd className="mt-0.5 text-[15px] font-semibold tabular-nums text-ink">{metric.value}%</dd>
          </div>
        ))}
      </dl>
    )}

    <div className="grid gap-3 sm:grid-cols-2">
      {strengths.length > 0 && (
        <div>
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-success">
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            What you explained well
          </p>
          <ul className="mt-1.5 space-y-1 text-[13px] leading-relaxed text-ink-muted">
            {strengths.map((point, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-success" aria-hidden="true" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {gaps.length > 0 && (
        <div>
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-due">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            What to add
          </p>
          <ul className="mt-1.5 space-y-1 text-[13px] leading-relaxed text-ink-muted">
            {gaps.map((point, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-due" aria-hidden="true" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>

    {summary && <p className="rounded-2xl bg-surface-hover px-4 py-3 text-[13px] leading-relaxed text-ink-muted">{summary}</p>}
  </div>
);

const GapCheck: React.FC<{
  score: number;
  passScore: number;
  gap: string;
  answer: string;
  onAnswerChange: (value: string) => void;
  onClose: () => void;
  onRetry: () => void;
  retryLabel: string;
  onContinueAnyway: () => void;
}> = ({ score, passScore, gap, answer, onAnswerChange, onClose, onRetry, retryLabel, onContinueAnyway }) => (
  <div className="rounded-2xl border border-due/30 bg-due-soft p-4 sm:p-5">
    <p className="text-sm font-semibold text-ink">Close one gap before the flashcards</p>
    <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
      You scored {score}% (aim for {passScore}%). The biggest gap: <span className="font-medium text-ink">{gap}</span>. Write one sentence
      that fills it.
    </p>
    <form
      className="mt-3 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (answer.trim().length >= 8) onClose();
      }}
    >
      <label className="sr-only" htmlFor="gap-answer">
        Your sentence
      </label>
      <input
        id="gap-answer"
        type="text"
        value={answer}
        onChange={(e) => onAnswerChange(e.target.value)}
        placeholder="It happens because…"
        className="h-10 min-w-0 flex-1 rounded-xl border border-line-strong bg-canvas px-3 text-sm text-ink placeholder:text-ink-subtle transition-colors focus:border-brand focus:outline-none"
      />
      <Button type="submit" variant="primary" disabled={answer.trim().length < 8}>
        Done
      </Button>
    </form>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
      <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 font-medium text-ink-muted hover:text-ink cursor-pointer">
        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
        {retryLabel}
      </button>
      <button type="button" onClick={onContinueAnyway} className="text-ink-subtle underline-offset-2 hover:text-ink hover:underline cursor-pointer">
        Continue anyway
      </button>
    </div>
  </div>
);

const ContinueRow: React.FC<{ onContinue: () => void; note?: string }> = ({ onContinue, note }) => (
  <div className="flex flex-col-reverse gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
    <p className="text-center text-xs text-ink-subtle sm:text-left">{note ?? 'Nice work. Now lock it in with flashcards.'}</p>
    <Button variant="primary" size="lg" trailingIcon={ArrowRight} onClick={onContinue}>
      Next: recall
    </Button>
  </div>
);
