import React, { useState, useEffect, useRef } from 'react';
import { 
  HelpCircle, 
  Send, 
  CheckCircle, 
  AlertTriangle, 
  ArrowRight, 
  Eye, 
  RefreshCw, 
  Award, 
  Mic, 
  MicOff, 
  MessageSquare, 
  Sparkles,
  Volume2,
  VolumeX,
  GraduationCap,
  Scale,
  ShieldCheck,
  User,
  RotateCcw,
  PenTool,
  BookOpen,
  Brain
} from 'lucide-react';
import type { ConceptCheckpoint, FeynmanEvaluation, SocraticTurn, VivaDefenseVerdict } from '../../types';
import { AIService } from '../../services/aiService';
import { soundEngine } from '../../services/soundEngine';
import { speechService } from '../../services/speechService';
import { StorageService } from '../../services/storageService';
import { MathRenderer } from '../common/MathRenderer';
import { DualCodingWhiteboard } from '../canvas/DualCodingWhiteboard';
import { ScienceExplainerModal } from '../common/ScienceExplainerModal';

interface FeynmanPhaseProps {
  concept: ConceptCheckpoint;
  onComplete: () => void;
  onInspectSource?: (pageNumber?: number) => void;
}

interface IWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

export const FeynmanPhase: React.FC<FeynmanPhaseProps> = ({ 
  concept, 
  onComplete,
  onInspectSource,
}) => {
  // Mode selection: Oral Viva Voce (Socratic Board) vs Written Rubric
  const [feynmanMode, setFeynmanMode] = useState<'viva' | 'written'>('viva');
  const [showWhiteboard, setShowWhiteboard] = useState<boolean>(false);
  const [showScienceModal, setShowScienceModal] = useState(false);

  // Shared Speech Recognition & Synthesis State
  const [isListening, setIsListening] = useState(false);
  const [isSpeakingTutor, setIsSpeakingTutor] = useState(false);
  const [speakingTurnId, setSpeakingTurnId] = useState<string | null>(null);
  const [speechSupported] = useState(() => {
    if (typeof window === 'undefined') return false;
    const win = window as unknown as IWindow;
    return !!(win.SpeechRecognition || win.webkitSpeechRecognition);
  });

  // --- Viva Voce Oral Defense State ---
  const [vivaRounds, setVivaRounds] = useState<number>(1);
  const [vivaTurns, setVivaTurns] = useState<SocraticTurn[]>(() => [
    {
      id: `turn-init-${concept.id}`,
      role: 'examiner',
      text: `Welcome to your oral defense on "${concept.title}"! I am Lottie, your Socratic Examiner. ${concept.feynmanPrompt} Defend this mechanism clearly in your own words—no jargon crutches!`,
      timestamp: Date.now(),
      turnType: 'initial-prompt',
      reaction: 'probing',
      reactionNote: 'Opening oral interrogation on core causality.',
    }
  ]);
  const [candidateSpeech, setCandidateSpeech] = useState<string>('');
  const [isVivaThinking, setIsVivaThinking] = useState<boolean>(false);
  const [vivaVerdict, setVivaVerdict] = useState<VivaDefenseVerdict | null>(null);
  const [autoSpeakExaminer, setAutoSpeakExaminer] = useState<boolean>(false);
  const vivaEndRef = useRef<HTMLDivElement>(null);
  const hasSpokenInitialRef = useRef<string | null>(null);

  // --- Written Feynman State ---
  const [explanation, setExplanation] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<FeynmanEvaluation | null>(null);
  const [showSample, setShowSample] = useState(false);
  const [socraticQuestion, setSocraticQuestion] = useState('');
  const [socraticAnswer, setSocraticAnswer] = useState<string | null>(null);
  const [isAskingSocratic, setIsAskingSocratic] = useState(false);

  // Adaptive Mastery Gating & Remediation State
  const [writtenRemediationAnswer, setWrittenRemediationAnswer] = useState('');
  const [isWrittenGateCleared, setIsWrittenGateCleared] = useState(false);
  const [vivaRemediationAnswer, setVivaRemediationAnswer] = useState('');
  const [isVivaGateCleared, setIsVivaGateCleared] = useState(false);

  const recognitionRef = useRef<any>(null);

  // Subscribe to speech synthesis state
  useEffect(() => {
    const unsub = speechService.subscribe(setIsSpeakingTutor);
    return () => {
      unsub();
      speechService.stop();
    };
  }, []);

  // Auto-speak initial examiner turn if enabled
  useEffect(() => {
    if (autoSpeakExaminer && hasSpokenInitialRef.current !== concept.id && vivaTurns[0]) {
      hasSpokenInitialRef.current = concept.id;
      const initialTurn = vivaTurns[0];
      speechService.speak(initialTurn.text, () => setSpeakingTurnId(null));
      setSpeakingTurnId(initialTurn.id);
    }
  }, [concept.id, autoSpeakExaminer, vivaTurns]);

  // Scroll to bottom of Viva transcript smoothly
  useEffect(() => {
    if (feynmanMode === 'viva') {
      vivaEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [vivaTurns, isVivaThinking, feynmanMode]);

  // Setup Web Speech Recognition
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
          let fullTranscript = '';
          for (let i = 0; i < event.results.length; i++) {
            fullTranscript += event.results[i][0].transcript + ' ';
          }
          const text = fullTranscript.trim();
          if (text) {
            if (feynmanMode === 'viva') {
              setCandidateSpeech(text);
            } else {
              setExplanation(text);
            }
          }
        };

        recognition.onerror = (event: any) => {
          console.warn('Speech recognition error:', event.error);
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      } catch (e) {
        console.warn('Failed to initialize speech recognition:', e);
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, [feynmanMode]);

  const toggleVoiceDictation = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error('Error starting speech recognition:', err);
      }
    }
  };

  // --- Viva Voce Handlers ---
  const handleSendVivaTurn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanInput = candidateSpeech.trim();
    if (cleanInput.length < 6 || isVivaThinking) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    // Stop ongoing speech
    speechService.stop();
    setSpeakingTurnId(null);

    const studentTurn: SocraticTurn = {
      id: `turn-student-${Date.now()}`,
      role: 'student',
      text: cleanInput,
      timestamp: Date.now(),
    };

    const currentHistory = [...vivaTurns, studentTurn];
    setVivaTurns(currentHistory);
    setCandidateSpeech('');
    setIsVivaThinking(true);

    try {
      const response = await AIService.conductVivaVoceTurn(
        concept,
        currentHistory,
        cleanInput,
        vivaRounds
      );

      setVivaTurns([...currentHistory, response.nextTurn]);

      if (response.verdict) {
        setVivaVerdict(response.verdict);
        soundEngine.playVerdictGavel();
        StorageService.addXP(100);
      } else {
        setVivaRounds(prev => prev + 1);
        soundEngine.playSocraticChallengeChime();
        StorageService.addXP(25);
      }

      if (autoSpeakExaminer) {
        speechService.speak(response.nextTurn.text, () => {
          setSpeakingTurnId(null);
        });
        setSpeakingTurnId(response.nextTurn.id);
      }
    } catch (err) {
      console.error('Viva Voce evaluation failed:', err);
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
    const openingTurn: SocraticTurn = {
      id: `turn-init-${Date.now()}`,
      role: 'examiner',
      text: `Let us re-examine "${concept.title}". ${concept.feynmanPrompt} Defend this mechanism clearly in your own words.`,
      timestamp: Date.now(),
      turnType: 'initial-prompt',
      reaction: 'probing',
      reactionNote: 'Restarting oral interrogation.',
    };
    setVivaTurns([openingTurn]);
    if (autoSpeakExaminer) {
      speechService.speak(openingTurn.text, () => setSpeakingTurnId(null));
      setSpeakingTurnId(openingTurn.id);
    }
  };

  // --- Written Feynman Handlers ---
  const handleWrittenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const wordCount = explanation.trim() ? explanation.trim().split(/\s+/).length : 0;
    if (wordCount < 4) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    setIsEvaluating(true);
    try {
      const result = await AIService.evaluateFeynmanExplanation(concept, explanation);
      setEvaluation(result);
      soundEngine.playCompletionChime();
      StorageService.addXP(50);
    } catch (err) {
      console.error(err);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleSpeakWrittenCritique = () => {
    if (isSpeakingTutor) {
      speechService.stop();
    } else if (evaluation) {
      const speechText = `Evaluation result: ${evaluation.grade}. Points well articulated: ${evaluation.masteredPoints.join(', ')}. Key nuances to remember: ${evaluation.missingNuances.join(', ')}. Actionable feedback: ${evaluation.actionableFeedback}`;
      speechService.speak(speechText);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn py-2">
      
      {/* Top Phase Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-3xl bg-purple-950/40 border border-purple-500/25 backdrop-blur-md">
        <div className="flex items-center gap-3 text-xs sm:text-sm text-purple-300">
          <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0 shadow-lg shadow-purple-500/10">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-white font-display flex items-center gap-2">
              <span>Phase 2: Socratic Feynman Defense</span>
              <span className="text-[11px] uppercase font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Cognitive Elaboration
              </span>
            </div>
            <div className="text-[11px] text-purple-300/80">
              "If you cannot explain it to a novice simply, you do not truly understand it yet."
            </div>
          </div>
        </div>

        {/* Mode Switcher Tabs & The Science */}
        <div className="flex items-center gap-2 flex-wrap shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              soundEngine.playAxolotlBubble();
              setShowScienceModal(true);
            }}
            className="px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 hover:text-purple-200 border border-purple-500/30 shadow-sm cursor-pointer"
            title="Discover why Elaborative Rehearsal and Dual Coding outperform rote memorization"
          >
            <Brain className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">The Science</span>
          </button>

          <div className="flex items-center bg-slate-950/80 p-1 rounded-2xl border border-white/[0.08] shrink-0">
            <button
              onClick={() => setFeynmanMode('viva')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                feynmanMode === 'viva'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Viva Voce (Oral)</span>
            </button>
            <button
              onClick={() => setFeynmanMode('written')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                feynmanMode === 'written'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Written Rubric</span>
            </button>
          </div>
        </div>
      </div>

      {/* Challenge Prompt Box */}
      <div className="p-6 sm:p-7 rounded-3xl glass-panel relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-bold uppercase tracking-wider text-purple-400 font-display flex items-center gap-2">
            <span>Concept Checkpoint:</span>
            <span className="text-white">{concept.title}</span>
          </div>
          <span className="text-[11px] text-slate-500 uppercase tracking-widest font-mono">
            {feynmanMode === 'viva' ? 'Oxford Tutorial Defense' : 'Elaborative Interrogation'}
          </span>
        </div>

        <h3 className="text-base sm:text-xl font-bold text-white leading-relaxed font-display">
          <MathRenderer text={concept.feynmanPrompt} />
        </h3>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-white/[0.06] mt-3">
          <p className="text-xs text-slate-400 leading-relaxed font-sans">
            Pedagogical Rule: Avoid textbook jargon. Speak or write directly as though teaching an intelligent beginner.
          </p>
          <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
            {concept.sourceAnchor && onInspectSource && (
              <button
                type="button"
                onClick={() => onInspectSource(concept.sourceAnchor?.pageNumber)}
                className="px-3 py-1.5 rounded-xl border border-indigo-500/30 bg-slate-900/90 hover:bg-indigo-950/80 text-indigo-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                title={`Jump to Page ${concept.sourceAnchor.pageNumber} in original source`}
              >
                <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                <span>Source: p.{concept.sourceAnchor.pageNumber}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowWhiteboard(!showWhiteboard)}
              className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
                showWhiteboard
                  ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/30'
                  : 'bg-slate-900/90 text-purple-300 border-purple-500/30 hover:bg-slate-800'
              }`}
              title="Toggle Dual-Coding Diagram Whiteboard"
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>{showWhiteboard ? 'Close Whiteboard' : '🎨 Dual-Coding Whiteboard'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Dual-Coding Whiteboard Canvas Drawer */}
      {showWhiteboard && (
        <div className="animate-fadeIn">
          <DualCodingWhiteboard concept={concept} />
        </div>
      )}

      {/* ================= MODE 1: VIVA VOCE ORAL DEFENSE ================= */}
      {feynmanMode === 'viva' && (
        <div className="space-y-5 animate-fadeIn">
          
          {/* Viva Arena Panel */}
          <div className="p-5 sm:p-7 rounded-3xl glass-panel space-y-5 relative">
            
            {/* Top Toolbar: Round Tracker & Voice Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-bold text-slate-200 font-display">
                  Socratic Board Session
                </span>
                <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[11px] font-mono font-bold">
                  {vivaVerdict ? 'Verdict Delivered' : `Round ${vivaRounds} of 3`}
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                {/* Auto-Speak Examiner Toggle */}
                <button
                  onClick={() => setAutoSpeakExaminer(!autoSpeakExaminer)}
                  className={`text-[11px] px-2.5 py-1 rounded-xl border flex items-center gap-1.5 transition-all font-medium ${
                    autoSpeakExaminer
                      ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40'
                      : 'bg-slate-900 text-slate-400 border-white/[0.08] hover:text-white'
                  }`}
                  title="Automatically speak out examiner challenges aloud"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Auto-Voice: {autoSpeakExaminer ? 'On' : 'Off'}</span>
                </button>

                <button
                  onClick={handleResetViva}
                  className="text-[11px] px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-white/[0.08] flex items-center gap-1 transition-all"
                  title="Reset oral defense session"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Restart Viva</span>
                </button>
              </div>
            </div>

            {/* Conversation Transcript Feed */}
            <div className="space-y-4 max-h-[460px] overflow-y-auto pr-1 sm:pr-2">
              {vivaTurns.map((turn) => {
                const isExaminer = turn.role === 'examiner';
                const isSpeakingThis = speakingTurnId === turn.id && isSpeakingTutor;

                return (
                  <div
                    key={turn.id}
                    className={`flex items-start gap-3 animate-fadeIn ${
                      isExaminer ? 'justify-start' : 'justify-end'
                    }`}
                  >
                    {isExaminer && (
                      <div className="relative w-9 h-9 rounded-2xl overflow-hidden p-0.5 bg-gradient-to-tr from-pink-500 via-purple-500 to-cyan-400 border border-pink-400/40 flex items-center justify-center shrink-0 shadow-lg shadow-pink-500/20 mt-1">
                        <img src="/lottie.png" alt="Lottie Socratic Examiner" className="w-full h-full object-cover rounded-[14px]" />
                      </div>
                    )}

                    <div
                      className={`max-w-[85%] rounded-3xl p-4 sm:p-5 space-y-2 border text-xs sm:text-sm leading-relaxed ${
                        isExaminer
                          ? 'bg-slate-900/90 border-pink-500/25 text-slate-100 shadow-xl'
                          : 'bg-indigo-950/60 border-indigo-500/40 text-indigo-50 shadow-xl'
                      }`}
                    >
                      {/* Message Header */}
                      <div className="flex items-center justify-between gap-3 text-[11px] pb-1 border-b border-white/[0.06]">
                        <div className="flex items-center gap-1.5 font-bold font-display">
                          {isExaminer ? (
                            <span className="text-pink-300 flex items-center gap-1.5">
                              <span>Lottie</span>
                              <span className="text-[11px] font-mono text-cyan-400 font-normal px-1.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20">
                                {AIService.isAvailable() ? 'AI Socratic Examiner' : 'Offline Guided Review'}
                              </span>
                            </span>
                          ) : (
                            <span className="text-indigo-300 flex items-center gap-1">
                              <User className="w-3 h-3" /> Candidate Defense
                            </span>
                          )}
                        </div>

                        {/* Examiner Badges & Speech Button */}
                        {isExaminer && (
                          <div className="flex items-center gap-2">
                            {turn.reaction && (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[11px] font-mono uppercase font-bold border ${
                                  turn.reaction === 'impressed'
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                    : turn.reaction === 'skeptical'
                                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                    : turn.reaction === 'satisfied'
                                    ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                }`}
                              >
                                {turn.reaction}
                              </span>
                            )}

                            <button
                              onClick={() => handleToggleSpeakTurn(turn)}
                              className={`p-1.5 rounded-lg border transition-all ${
                                isSpeakingThis
                                  ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/30 animate-pulse'
                                  : 'bg-slate-800 text-slate-400 border-white/[0.08] hover:text-white'
                              }`}
                              title={isSpeakingThis ? 'Stop audio' : 'Listen to challenge spoken aloud'}
                            >
                              <Volume2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Turn Content */}
                      <div className="font-sans leading-relaxed">
                        <MathRenderer text={turn.text} />
                      </div>

                      {/* Reaction Note if present */}
                      {turn.reactionNote && (
                        <div className="text-[11px] text-purple-300/80 italic pt-1 font-mono">
                          Note: {turn.reactionNote}
                        </div>
                      )}

                      {/* Jargon detected warning tag */}
                      {turn.jargonDetected && turn.jargonDetected.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
                          <span className="text-[11px] text-amber-400 font-mono flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Unpacked Jargon:
                          </span>
                          {turn.jargonDetected.map((j, i) => (
                            <span
                              key={i}
                              className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-mono"
                            >
                              {j}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {!isExaminer && (
                      <div className="w-9 h-9 rounded-2xl bg-indigo-600/40 border border-indigo-400/40 flex items-center justify-center text-indigo-200 shrink-0 shadow-lg shadow-indigo-500/20 mt-1">
                        <User className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Socratic Thinking Indicator */}
              {isVivaThinking && (
                <div className="flex items-center gap-3 animate-fadeIn">
                  <div className="w-9 h-9 rounded-2xl bg-purple-600/30 border border-purple-400/30 flex items-center justify-center text-purple-300 shrink-0">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-purple-500/30 text-xs text-purple-300 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
                    <span>The Socratic Examiner is evaluating conceptual nuances and formulating a challenge...</span>
                  </div>
                </div>
              )}

              <div ref={vivaEndRef} />
            </div>

            {/* Candidate Oral Input Arena (Active if Verdict not yet delivered) */}
            {!vivaVerdict ? (
              <form onSubmit={handleSendVivaTurn} className="pt-3 border-t border-white/[0.08] space-y-3">
                <div className="relative">
                  <textarea
                    rows={3}
                    value={candidateSpeech}
                    onChange={(e) => setCandidateSpeech(e.target.value)}
                    placeholder="Speak aloud into the microphone or type your defense here..."
                    className={`w-full p-4 rounded-2xl glass-panel text-slate-100 text-xs sm:text-sm leading-relaxed placeholder:text-slate-500 outline-none resize-none transition-all font-sans ${
                      isListening
                        ? 'border-rose-500 ring-4 ring-rose-500/20 shadow-2xl shadow-rose-500/20'
                        : 'focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20'
                    }`}
                  />

                  {/* Pulsing microphone waveform badge */}
                  {isListening && (
                    <div className="absolute top-3 right-3 flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-semibold animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                      <div className="flex items-end gap-0.5 h-3">
                        <span className="w-0.5 bg-rose-400 rounded-full animate-eq-1" />
                        <span className="w-0.5 bg-rose-300 rounded-full animate-eq-2" />
                        <span className="w-0.5 bg-rose-400 rounded-full animate-eq-3" />
                        <span className="w-0.5 bg-rose-200 rounded-full animate-eq-4" />
                      </div>
                      <span>Listening...</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 w-full sm:w-auto">
                    {/* Microphone Dictation Button */}
                    {speechSupported && (
                      <button
                        type="button"
                        onClick={toggleVoiceDictation}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all ${
                          isListening
                            ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-500 shadow-xl shadow-rose-600/30 animate-pulse'
                            : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-white/[0.1] hover:border-rose-400/50'
                        }`}
                        title={isListening ? 'Stop microphone dictation' : 'Dictate your response aloud'}
                      >
                        {isListening ? (
                          <>
                            <MicOff className="w-4 h-4 text-white" />
                            <span>Stop Mic</span>
                          </>
                        ) : (
                          <>
                            <Mic className="w-4 h-4 text-rose-400" />
                            <span>Speak Response</span>
                          </>
                        )}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setCandidateSpeech(concept.sampleMasteryExplanation)}
                      className="text-xs text-slate-400 hover:text-purple-300 underline underline-offset-4 transition-colors font-mono"
                    >
                      [Fill Demo Defense]
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={isVivaThinking || candidateSpeech.trim().length < 5}
                    className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-xl transition-all ${
                      isVivaThinking || candidateSpeech.trim().length < 5
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                        : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-600/30 hover:scale-105'
                    }`}
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit Oral Defense (Round {vivaRounds}/3)</span>
                  </button>
                </div>
              </form>
            ) : (
              /* Oral Defense Final Verdict Display */
              <div className="pt-4 border-t border-white/[0.08] space-y-5 animate-fadeIn">
                <div className="p-6 rounded-3xl bg-gradient-to-br from-purple-950/50 via-slate-900/90 to-amber-950/40 border border-purple-500/40 shadow-2xl space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-xl shadow-amber-500/20">
                        <Scale className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="text-[11px] font-mono uppercase tracking-wider text-amber-300 font-bold">
                          Official Socratic Board Decision
                        </div>
                        <h4 className="text-xl font-black text-white font-display flex items-center gap-2">
                          <span>{vivaVerdict.overallGrade}</span>
                        </h4>
                      </div>
                    </div>

                    <div className="px-3.5 py-1.5 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300 font-mono text-xs font-bold text-center">
                      +100 XP Honors Awarded
                    </div>
                  </div>

                  {/* 3 Metric Scores */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 rounded-2xl bg-slate-950/70 border border-white/[0.06] text-center space-y-1">
                      <span className="text-[11px] text-indigo-300 font-mono uppercase font-bold">Mechanical Depth</span>
                      <div className="text-2xl font-black text-white font-mono">{vivaVerdict.depthScore}%</div>
                      <p className="text-[11px] text-slate-400">Causal step-by-step reasoning</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-950/70 border border-white/[0.06] text-center space-y-1">
                      <span className="text-[11px] text-purple-300 font-mono uppercase font-bold">Analogy Integrity</span>
                      <div className="text-2xl font-black text-white font-mono">{vivaVerdict.analogyIntegrity}%</div>
                      <p className="text-[11px] text-slate-400">Intuitive mental mapping</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-950/70 border border-white/[0.06] text-center space-y-1">
                      <span className="text-[11px] text-emerald-300 font-mono uppercase font-bold">Jargon-Free Lucidity</span>
                      <div className="text-2xl font-black text-white font-mono">{vivaVerdict.jargonFreeScore}%</div>
                      <p className="text-[11px] text-slate-400">Absence of jargon crutches</p>
                    </div>
                  </div>

                  {/* Strengths & Vulnerable Blindspots */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 space-y-1.5">
                      <div className="text-emerald-300 font-bold flex items-center gap-1.5 font-display">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <span>Demonstrated Strengths</span>
                      </div>
                      <ul className="list-disc pl-4 space-y-1 text-slate-300">
                        {vivaVerdict.keyStrengths.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/30 space-y-1.5">
                      <div className="text-amber-300 font-bold flex items-center gap-1.5 font-display">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        <span>Refinement Nuances</span>
                      </div>
                      <ul className="list-disc pl-4 space-y-1 text-slate-300">
                        {vivaVerdict.vulnerableBlindspots.map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Verdict Remarks */}
                  <p className="text-xs text-slate-300 italic border-l-2 border-purple-500 pl-3">
                    "{vivaVerdict.verdictSummary}"
                  </p>
                </div>

                {/* Adaptive Mastery Gate for Oral Defense */}
                {(() => {
                  const avgVivaScore = Math.round((vivaVerdict.depthScore + vivaVerdict.analogyIntegrity + vivaVerdict.jargonFreeScore) / 3);
                  const isVivaQualified = avgVivaScore >= 65 || isVivaGateCleared;

                  if (!isVivaQualified) {
                    return (
                      <div className="p-5 sm:p-6 rounded-3xl bg-amber-950/40 border border-amber-500/40 space-y-4 animate-fadeIn">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-amber-300 font-bold font-display text-sm">
                            <AlertTriangle className="w-4 h-4 text-amber-400" />
                            <span>Mastery Gate: Oral Defense Rating Under Threshold ({avgVivaScore}% / 65% required)</span>
                          </div>
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-200 border border-amber-500/30">
                            Remediation Active
                          </span>
                        </div>

                        <p className="text-xs text-slate-300 leading-relaxed">
                          The Socratic Examiner detected conceptual vulnerabilities: <strong className="text-amber-200">{vivaVerdict.vulnerableBlindspots[0] || 'incomplete step-by-step mechanism'}</strong>. Clear this nuance below to unlock retrieval practice.
                        </p>

                        <div className="space-y-2 pt-1">
                          <label className="text-[11px] font-semibold text-slate-300 block">
                            State your concise counter-defense addressing this blindspot:
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={vivaRemediationAnswer}
                              onChange={(e) => setVivaRemediationAnswer(e.target.value)}
                              placeholder="e.g. The mechanism requires ATP hydrolysis to reset the conformation..."
                              className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950/90 border border-white/[0.1] text-xs text-white outline-none focus:border-amber-400 font-medium"
                            />
                            <button
                              type="button"
                              disabled={vivaRemediationAnswer.trim().length < 8}
                              onClick={() => {
                                setIsVivaGateCleared(true);
                                soundEngine.playCorrectChime();
                                StorageService.addXP(25);
                              }}
                              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                                vivaRemediationAnswer.trim().length >= 8
                                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md font-bold'
                                  : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                              }`}
                            >
                              Clear Gate
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] text-[11px]">
                          <button
                            type="button"
                            onClick={() => {
                              setVivaVerdict(null);
                              setVivaRounds(1);
                            }}
                            className="text-purple-300 hover:text-white flex items-center gap-1 font-medium transition-colors cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Restart Oral Defense</span>
                          </button>

                          <button
                            type="button"
                            onClick={onComplete}
                            className="text-slate-500 hover:text-slate-300 underline transition-colors cursor-pointer"
                          >
                            Proceed with caution (Marks concept as 'Fragile')
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="flex justify-end pt-2">
                      <button
                        onClick={onComplete}
                        className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 group transition-all hover:scale-105 cursor-pointer"
                      >
                        <span>Defense Cleared ({isVivaGateCleared ? 'Remediated' : `${avgVivaScore}%`}) — Advance to Active Recall</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </button>
                    </div>
                  );
                })()}
              </div>
            )}

          </div>

        </div>
      )}

      {/* ================= MODE 2: WRITTEN FEYNMAN RUBRIC ================= */}
      {feynmanMode === 'written' && (
        <div className="space-y-6 animate-fadeIn">
          {!evaluation ? (
            <form onSubmit={handleWrittenSubmit} className="space-y-4">
              <div className="relative">
                <textarea
                  rows={8}
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="Explain the mechanism step-by-step in your own words, or tap the microphone to dictate aloud..."
                  className={`w-full p-5 rounded-3xl glass-panel text-slate-100 text-sm leading-relaxed placeholder:text-slate-500 outline-none resize-none transition-all font-sans ${
                    isListening
                      ? 'border-rose-500 ring-4 ring-rose-500/20 shadow-2xl shadow-rose-500/15'
                      : 'focus:border-purple-500/80 focus:ring-4 focus:ring-purple-500/15'
                  }`}
                />

                {isListening && (
                  <div className="absolute top-4 right-4 flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-semibold animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                    <span>Listening aloud...</span>
                  </div>
                )}

                <div className="absolute bottom-4 right-4 flex items-center gap-3 text-xs text-slate-400 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-white/[0.08] backdrop-blur-md">
                  <span className="font-mono font-semibold text-slate-300">
                    {explanation.trim() ? explanation.trim().split(/\s+/).length : 0} words
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  {speechSupported && (
                    <button
                      type="button"
                      onClick={toggleVoiceDictation}
                      className={`px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 border transition-all ${
                        isListening
                          ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-500 shadow-xl shadow-rose-600/30 animate-pulse'
                          : 'bg-slate-900/90 hover:bg-slate-800 text-slate-200 border-white/[0.1] hover:border-rose-400/50'
                      }`}
                    >
                      {isListening ? (
                        <>
                          <MicOff className="w-4 h-4 text-white" />
                          <span>Stop Dictation</span>
                        </>
                      ) : (
                        <>
                          <Mic className="w-4 h-4 text-rose-400" />
                          <span>Speak Aloud</span>
                        </>
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setExplanation(concept.sampleMasteryExplanation)}
                    className="text-xs text-slate-400 hover:text-purple-300 underline underline-offset-4 transition-colors font-mono"
                  >
                    [Demo Sample]
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isEvaluating || !explanation.trim()}
                  className={`w-full sm:w-auto px-7 py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-xl transition-all ${
                    isEvaluating || !explanation.trim()
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                      : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-600/30 hover:scale-[1.02]'
                  }`}
                >
                  {isEvaluating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Evaluating Conceptual Nuances...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Submit for Socratic Evaluation</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6 animate-fadeIn">
              <div className="p-6 sm:p-8 rounded-3xl glass-panel space-y-6">
                
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600/20 to-indigo-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shadow-lg shadow-purple-500/15">
                      <Award className="w-7 h-7" />
                    </div>
                    <div>
                      {evaluation.isOfflineSelfCheck ? (
                        <>
                          <div className="text-xs text-amber-300 uppercase tracking-wider font-bold font-display flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-400" />
                            <span>Offline Self-Check (No AI Key)</span>
                          </div>
                          <div className="text-xl font-black text-white flex items-center gap-2 font-display">
                            <span>Concept Checklist</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-xs text-slate-400 uppercase tracking-wider font-bold font-display">
                            Socratic Comprehension Analysis
                          </div>
                          <div className="text-xl font-black text-white flex items-center gap-2 font-display">
                            <span>{evaluation.grade}</span>
                            <span className="text-sm font-semibold text-purple-300 font-mono">
                              ({evaluation.score}% Score)
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={handleSpeakWrittenCritique}
                      className={`text-xs px-3.5 py-2 rounded-xl border flex items-center gap-1.5 transition-all font-semibold ${
                        isSpeakingTutor
                          ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/30 animate-pulse'
                          : 'bg-slate-900/80 hover:bg-slate-800 text-purple-300 border-white/[0.08] hover:border-purple-500/40'
                      }`}
                    >
                      {isSpeakingTutor ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                      <span>{isSpeakingTutor ? 'Stop Voice' : 'Hear Oral Critique'}</span>
                    </button>

                    <button
                      onClick={() => setEvaluation(null)}
                      className="text-xs px-3.5 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-white/[0.08] flex items-center gap-1.5 transition-all font-semibold"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Refine Explanation</span>
                    </button>
                  </div>
                </div>

                {/* Mastered Nuances */}
                <div className="p-5 rounded-2xl bg-emerald-950/20 border border-emerald-500/25 space-y-2">
                  <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wide font-display">
                    <CheckCircle className="w-4 h-4" />
                    <span>Points You Articulated Masterfully</span>
                  </div>
                  <ul className="space-y-1.5 pl-5 list-disc text-sm text-slate-200 marker:text-emerald-400 font-sans">
                    {evaluation.masteredPoints.map((point, i) => (
                      <li key={i}>{point}</li>
                    ))}
                  </ul>
                </div>

                {/* Missing Nuances */}
                {evaluation.missingNuances.length > 0 && (
                  <div className="p-5 rounded-2xl bg-amber-950/20 border border-amber-500/25 space-y-2">
                    <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5 uppercase tracking-wide font-display">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Nuances to Strengthen in Memory</span>
                    </div>
                    <ul className="space-y-1.5 pl-5 list-disc text-sm text-slate-200 marker:text-amber-400 font-sans">
                      {evaluation.missingNuances.map((gap, i) => (
                        <li key={i}>{gap}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Actionable Feedback */}
                <div className="p-5 rounded-2xl bg-purple-950/30 border border-purple-500/30 text-xs sm:text-sm text-purple-200 leading-relaxed font-sans">
                  <span className="font-bold text-purple-300 block mb-1 font-display">Actionable Cognitive Synthesis:</span>
                  {evaluation.actionableFeedback}
                </div>

                {/* Reference Model Accordion */}
                <div className="pt-1">
                  <button
                    onClick={() => setShowSample(!showSample)}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors font-medium"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    {showSample ? 'Hide' : 'Inspect'} Expert Reference Explanation
                  </button>
                  {showSample && (
                    <div className="mt-3 p-4 rounded-2xl bg-slate-950/80 border border-white/[0.08] text-xs text-slate-300 italic leading-relaxed animate-fadeIn">
                      "{concept.sampleMasteryExplanation}"
                    </div>
                  )}
                </div>

                {/* Socratic Coach Interactive Inquiry */}
                <div className="pt-5 border-t border-white/[0.08] space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 font-display">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    <span>Ask Socratic AI Coach</span>
                  </div>

                  <form 
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!socraticQuestion.trim()) return;
                      setIsAskingSocratic(true);
                      try {
                        const ans = await AIService.askSocraticFollowUp(concept, explanation, socraticQuestion);
                        setSocraticAnswer(ans);
                        StorageService.addXP(15);
                      } catch (err) {
                        console.error(err);
                      } finally {
                        setIsAskingSocratic(false);
                      }
                    }}
                    className="space-y-2"
                  >
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={socraticQuestion}
                        onChange={(e) => setSocraticQuestion(e.target.value)}
                        placeholder="e.g. Why is this reaction irreversible? What happens if temperature increases?"
                        className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950/80 border border-white/[0.1] text-white text-xs outline-none focus:border-indigo-500 font-medium"
                      />
                      <button
                        type="submit"
                        disabled={isAskingSocratic || !socraticQuestion.trim()}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 ${
                          isAskingSocratic || !socraticQuestion.trim()
                            ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30'
                        }`}
                      >
                        {isAskingSocratic ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Thinking...</span>
                          </>
                        ) : (
                          <>
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Ask Coach</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>

                  {socraticAnswer && (
                    <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 text-xs text-indigo-200 leading-relaxed space-y-1 animate-fadeIn font-sans">
                      <div className="font-bold text-indigo-300 flex items-center gap-1.5 font-display">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Socratic Clarification:</span>
                      </div>
                      <p className="text-slate-100">{socraticAnswer}</p>
                    </div>
                  )}
                </div>

              </div>

              {/* Adaptive Mastery Gate for Written Rubric */}
              {(() => {
                if (evaluation.isOfflineSelfCheck) {
                  return (
                    <div className="p-5 sm:p-6 rounded-3xl bg-purple-950/30 border border-purple-500/30 space-y-4 animate-fadeIn">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-purple-300 font-bold font-display text-sm">
                          <CheckCircle className="w-4 h-4 text-purple-400" />
                          <span>Self-Assessment Checklist Complete</span>
                        </div>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-200 border border-purple-500/30">
                          Offline Mode
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Compare your written thoughts with the reference model and key takeaways above. When you feel ready, proceed to active recall practice.
                      </p>
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-white/[0.06]">
                        <button
                          type="button"
                          onClick={() => setEvaluation(null)}
                          className="text-xs text-purple-300 hover:text-white flex items-center gap-1 font-medium transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Revise Explanation</span>
                        </button>
                        <button
                          type="button"
                          onClick={onComplete}
                          className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-600/20 flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <span>I Understand This Concept — Proceed to Recall</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                }

                const isWrittenQualified = evaluation.score >= 70 || isWrittenGateCleared;

                if (!isWrittenQualified) {
                  return (
                    <div className="p-5 sm:p-6 rounded-3xl bg-amber-950/40 border border-amber-500/40 space-y-4 animate-fadeIn">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-amber-300 font-bold font-display text-sm">
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                          <span>Mastery Gate: Comprehension Threshold Not Met ({evaluation.score}% / 70% required)</span>
                        </div>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-200 border border-amber-500/30">
                          Remediation Active
                        </span>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed">
                        To build durable memory, cognitive science requires resolving conceptual gaps before flashcard testing. Critical missing nuance: <strong className="text-amber-200">{evaluation.missingNuances[0] || 'core causal mechanism'}</strong>.
                      </p>

                      <div className="space-y-2 pt-1">
                        <label className="text-[11px] font-semibold text-slate-300 block">
                          In 1 sentence, explain or address this missing nuance to clear the mastery gate:
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={writtenRemediationAnswer}
                            onChange={(e) => setWrittenRemediationAnswer(e.target.value)}
                            placeholder="e.g. This happens because ATP binding causes a conformational change..."
                            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950/90 border border-white/[0.1] text-xs text-white outline-none focus:border-amber-400 font-medium"
                          />
                          <button
                            type="button"
                            disabled={writtenRemediationAnswer.trim().length < 8}
                            onClick={() => {
                              setIsWrittenGateCleared(true);
                              soundEngine.playCorrectChime();
                              StorageService.addXP(25);
                            }}
                            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                              writtenRemediationAnswer.trim().length >= 8
                                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md font-bold'
                                : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                            }`}
                          >
                            Clear Gate
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] text-[11px]">
                        <button
                          type="button"
                          onClick={() => setEvaluation(null)}
                          className="text-purple-300 hover:text-white flex items-center gap-1 font-medium transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Revise Full Explanation</span>
                        </button>

                        <button
                          type="button"
                          onClick={onComplete}
                          className="text-slate-500 hover:text-slate-300 underline transition-colors cursor-pointer"
                        >
                          Proceed with caution (Marks concept as 'Fragile')
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={onComplete}
                      className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 group transition-all hover:scale-[1.02] cursor-pointer"
                    >
                      <span>Mastery Cleared ({isWrittenGateCleared ? 'Remediated' : `${evaluation.score}%`}) — Proceed to Active Recall</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* Cognitive Science Explainer Modal */}
      <ScienceExplainerModal
        isOpen={showScienceModal}
        onClose={() => setShowScienceModal(false)}
        initialTopic="feynman"
      />

    </div>
  );
};
