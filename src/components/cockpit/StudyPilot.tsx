import React, { useState, useEffect } from 'react';
import { Sparkles, HelpCircle, Zap, Coffee, X, Clock, ChevronRight, Maximize2, Minimize2, EyeOff, Volume2, VolumeX, PenTool, FileText, BrainCircuit } from 'lucide-react';
import type { StudyPhase, StudySession } from '../../types';
import { DiagnosticPhase } from './DiagnosticPhase';
import { PrimingPhase } from './PrimingPhase';
import { FeynmanPhase } from './FeynmanPhase';
import { RetrievalPhase } from './RetrievalPhase';
import { RestBreakPhase } from './RestBreakPhase';
import { SessionSummary } from './SessionSummary';
import { StorageService } from '../../services/storageService';
import { soundEngine } from '../../services/soundEngine';
import type { SoundType } from '../../services/soundEngine';
import { DualCodingWhiteboard } from '../canvas/DualCodingWhiteboard';
import { SplitSourceReader } from '../reader/SplitSourceReader';
import { PDFService } from '../../services/pdfService';

interface StudyPilotProps {
  initialSession: StudySession;
  onExit: () => void;
  onOpenDashboard: () => void;
}

type AmbientTheme = 'obsidian' | 'library' | 'indigo-flow' | 'nordic-frost';

export const StudyPilot: React.FC<StudyPilotProps> = ({ initialSession, onExit, onOpenDashboard }) => {
  const [session, setSession] = useState<StudySession>(() => {
    if (
      !initialSession.casualFlashcardMode &&
      !initialSession.diagnosticReport &&
      initialSession.currentConceptIndex === 0 &&
      initialSession.currentPhase === 'priming'
    ) {
      return { ...initialSession, currentPhase: 'diagnostic' };
    }
    return initialSession;
  });
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  const [distractionAlert, setDistractionAlert] = useState<string | null>(null);
  const [theme, setTheme] = useState<AmbientTheme>('obsidian');
  const [currentSound, setCurrentSound] = useState<SoundType>(soundEngine.getCurrentSound());
  const [soundMenuOpen, setSoundMenuOpen] = useState(false);
  const [isGlobalWhiteboardOpen, setIsGlobalWhiteboardOpen] = useState(false);
  const [isSourceReaderOpen, setIsSourceReaderOpen] = useState(false);
  const [sourceTargetPage, setSourceTargetPage] = useState<number>(1);

  useEffect(() => {
    const unsub = soundEngine.subscribe((sound) => {
      setCurrentSound(sound);
    });
    return unsub;
  }, []);

  const sessionRef = React.useRef<StudySession>(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // Live session timer: update in-memory elapsedSeconds every 1s, and persist every 30s + on unmount
  useEffect(() => {
    if (session.currentPhase === 'summary') return;
    let tickCount = 0;
    const interval = setInterval(() => {
      tickCount += 1;
      setSession(prev => {
        const nextSeconds = prev.elapsedSeconds + 1;
        const updated = { ...prev, elapsedSeconds: nextSeconds };
        sessionRef.current = updated;
        if (tickCount % 30 === 0) {
          StorageService.saveSession(updated);
        }
        return updated;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
      if (sessionRef.current) {
        StorageService.saveSession(sessionRef.current);
      }
    };
  }, [session.currentPhase]);

  // Anti-distraction visibility tracker
  useEffect(() => {
    let leaveTimestamp: number | null = null;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        leaveTimestamp = Date.now();
      } else if (document.visibilityState === 'visible' && leaveTimestamp) {
        const secondsAway = Math.round((Date.now() - leaveTimestamp) / 1000);
        if (secondsAway >= 5) {
          setDistractionAlert(`Focus Guard: Tab switch detected (${secondsAway}s). Gently pulling working memory back into flow.`);
          setTimeout(() => setDistractionAlert(null), 6000);
        }
        leaveTimestamp = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const currentConcept = session.concepts[session.currentConceptIndex] || session.concepts[0];

  const setPhase = (phase: StudyPhase) => {
    setSession(prev => {
      const updated = { ...prev, currentPhase: phase };
      StorageService.saveSession(updated);
      return updated;
    });
  };

  const handleNextConceptOrSummary = () => {
    if (session.currentConceptIndex + 1 < session.concepts.length) {
      setSession(prev => {
        const updated: StudySession = {
          ...prev,
          currentConceptIndex: prev.currentConceptIndex + 1,
          currentPhase: prev.casualFlashcardMode ? 'retrieval' : 'priming',
        };
        StorageService.saveSession(updated);
        return updated;
      });
    } else {
      setSession(prev => {
        const updated: StudySession = {
          ...prev,
          currentPhase: 'summary',
          completedAt: new Date().toISOString(),
        };
        StorageService.saveSession(updated);
        return updated;
      });
    }
  };

  const [activeSourceSnippet, setActiveSourceSnippet] = useState<string | undefined>(() => currentConcept.sourceAnchor?.snippet);

  // Reset the active snippet when the concept advances (adjusting state during render).
  const [snippetConcept, setSnippetConcept] = useState(currentConcept);
  if (snippetConcept !== currentConcept) {
    setSnippetConcept(currentConcept);
    setActiveSourceSnippet(currentConcept.sourceAnchor?.snippet);
  }

  const handleInspectSource = (pageNumber?: number, snippet?: string) => {
    if (pageNumber) {
      setSourceTargetPage(pageNumber);
    } else if (currentConcept.sourceAnchor?.pageNumber) {
      setSourceTargetPage(currentConcept.sourceAnchor.pageNumber);
    }
    const resolvedSnippet = snippet || (pageNumber && pageNumber === currentConcept.sourceAnchor?.pageNumber ? currentConcept.sourceAnchor.snippet : currentConcept.sourceAnchor?.snippet);
    setActiveSourceSnippet(resolvedSnippet);
    setIsSourceReaderOpen(true);
  };

  const minutes = Math.floor(session.elapsedSeconds / 60);
  const seconds = session.elapsedSeconds % 60;
  const timeFormatted = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  const renderActivePhase = () => (
    <>
      {session.currentPhase === 'diagnostic' && (
        <DiagnosticPhase
          session={session}
          onComplete={(report) => {
            setSession(prev => {
              const updated: StudySession = {
                ...prev,
                diagnosticReport: report,
                currentPhase: 'priming' as StudyPhase,
              };
              StorageService.saveSession(updated);
              return updated;
            });
          }}
          onSkip={() => setPhase('priming')}
        />
      )}

      {session.currentPhase === 'priming' && (
        <PrimingPhase
          concept={currentConcept}
          isCasualMode={session.casualFlashcardMode}
          onComplete={() => setPhase(session.casualFlashcardMode ? 'retrieval' : 'feynman')}
          onInspectSource={handleInspectSource}
          diagnosticMissed={
            session.diagnosticReport?.probes.find(p => p.conceptId === currentConcept.id)?.isCorrect === false
          }
        />
      )}

      {session.currentPhase === 'feynman' && (
        <FeynmanPhase
          concept={currentConcept}
          onComplete={() => setPhase('retrieval')}
          onInspectSource={handleInspectSource}
          sessionId={session.id}
        />
      )}

      {session.currentPhase === 'retrieval' && (
        <RetrievalPhase
          concept={currentConcept}
          allConcepts={session.concepts}
          conceptIndex={session.currentConceptIndex}
          onComplete={() => {
            if (session.casualFlashcardMode) {
              handleNextConceptOrSummary();
            } else {
              setPhase('rest');
            }
          }}
          onInspectSource={handleInspectSource}
        />
      )}

      {session.currentPhase === 'rest' && (
        <RestBreakPhase
          onComplete={handleNextConceptOrSummary}
          onSkip={handleNextConceptOrSummary}
        />
      )}

      {session.currentPhase === 'summary' && (
        <SessionSummary
          session={session}
          onRestart={() => setSession(prev => ({
            ...prev,
            currentConceptIndex: 0,
            currentPhase: prev.casualFlashcardMode ? 'retrieval' : 'diagnostic'
          }))}
          onHome={onExit}
          onOpenDashboard={onOpenDashboard}
          onStartSession={(rescue) => setSession(rescue)}
        />
      )}
    </>
  );

  const phases = [
    { id: 'diagnostic', label: '0. Pre-Test', icon: BrainCircuit },
    { id: 'priming', label: '1. Priming', icon: Sparkles },
    { id: 'feynman', label: '2. Feynman', icon: HelpCircle },
    { id: 'retrieval', label: '3. Recall', icon: Zap },
    { id: 'rest', label: '4. Rest', icon: Coffee },
  ];

  const themeClasses: Record<AmbientTheme, string> = {
    'obsidian': 'bg-[#090a10] text-slate-100',
    'library': 'bg-[#120e0c] text-amber-50',
    'indigo-flow': 'bg-[#0c0e1e] text-indigo-50',
    'nordic-frost': 'bg-[#0a1017] text-cyan-50',
  };

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-500 bg-ambient-mesh ${themeClasses[theme]}`}>
      
      {/* Top Cockpit HUD */}
      <div className="w-full border-b border-white/[0.08] bg-slate-950/85 backdrop-blur-xl px-4 py-3 sticky top-0 z-30 shadow-md">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          
          {/* Concept Progress Info */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => setShowExitConfirm(true)}
              className="p-1.5 rounded-xl hover:bg-white/[0.08] text-slate-400 hover:text-white transition-colors"
              title="Exit Study Pilot"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-indigo-400 font-bold uppercase tracking-wider">
                  Concept {session.currentConceptIndex + 1} of {session.concepts.length}
                </span>
                <span className="hidden sm:inline text-xs text-slate-600">•</span>
                <span className="hidden sm:inline text-xs text-slate-400 truncate max-w-[180px]">
                  {session.title}
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-bold text-white truncate max-w-[220px] sm:max-w-md font-display">
                {currentConcept.title}
              </h2>
            </div>
          </div>

          {/* Stepper (Phases) */}
          {session.casualFlashcardMode ? (
            <div className="hidden md:flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-2xl text-amber-300 text-xs font-semibold shadow-inner">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Casual Flashcard Drill</span>
              <span className="text-amber-500/60">•</span>
              <span className="text-slate-300">FSRS Review</span>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-1 bg-slate-900/90 p-1 rounded-2xl border border-white/[0.08] shadow-inner">
              {phases.map((p, idx) => {
                const Icon = p.icon;
                const isActive = session.currentPhase === p.id;
                const isPassed = phases.findIndex(x => x.id === session.currentPhase) > idx;

                return (
                  <div key={p.id} className="flex items-center">
                    <button
                      type="button"
                      onClick={() => setPhase(p.id as StudyPhase)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-600/30'
                          : isPassed
                          ? 'text-indigo-300 hover:text-white hover:bg-white/[0.06] font-semibold'
                          : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'
                      }`}
                      title={`Jump to Phase: ${p.label}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{p.label}</span>
                    </button>
                    {idx < phases.length - 1 && (
                      <ChevronRight className="w-3 h-3 text-slate-700 mx-0.5" />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Focus Controls */}
          <div className="flex items-center gap-2 shrink-0">
            
            {/* Quick Audio Pill */}
            <div className="relative">
              <button
                onClick={() => setSoundMenuOpen(!soundMenuOpen)}
                className={`p-2 rounded-xl border transition-all ${
                  currentSound !== 'off'
                    ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300'
                    : 'bg-slate-900/80 border-white/[0.08] text-slate-400 hover:text-white'
                }`}
                title="Toggle Focus Soundscape"
              >
                {currentSound !== 'off' ? <Volume2 className="w-4 h-4 text-indigo-400" /> : <VolumeX className="w-4 h-4" />}
              </button>

              {soundMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 p-3 rounded-2xl bg-[#0d101e] border border-white/[0.12] shadow-2xl z-50 text-xs text-slate-200 animate-fadeIn">
                  <div className="font-bold text-white mb-2 pb-1.5 border-b border-white/[0.08] font-display flex items-center justify-between">
                    <span>Focus Audio</span>
                    <span className="text-[11px] text-indigo-300">Active</span>
                  </div>
                  <div className="space-y-1">
                    {[
                      { id: 'off', label: 'Mute' },
                      { id: 'binaural-40hz', label: '🧠 40Hz Gamma Focus' },
                      { id: 'binaural-alpha-10hz', label: '🧘 10Hz Alpha Waves' },
                      { id: 'brown-noise', label: '🌊 Brownian Deep Noise' },
                      { id: 'pink-noise', label: '🌸 Pink Noise (Memory)' },
                      { id: 'rain', label: '🌧️ Gentle Rain' },
                      { id: 'ambient-drone', label: '🎵 Deep Drone Pad' },
                    ].map(s => (
                      <button
                        key={s.id}
                        onClick={() => {
                          soundEngine.play(s.id as SoundType);
                          setSoundMenuOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg transition-colors ${
                          currentSound === s.id ? 'bg-indigo-600 text-white font-semibold' : 'hover:bg-white/[0.06] text-slate-300'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Ambient Theme Selector */}
            <div className="hidden sm:flex items-center gap-1.5 bg-slate-900/90 border border-white/[0.08] p-1.5 rounded-xl">
              <button
                onClick={() => setTheme('obsidian')}
                className={`w-3.5 h-3.5 rounded-full bg-slate-900 border ${theme === 'obsidian' ? 'border-indigo-400 ring-2 ring-indigo-400/40' : 'border-slate-700'}`}
                title="Obsidian Dark Theme"
              />
              <button
                onClick={() => setTheme('library')}
                className={`w-3.5 h-3.5 rounded-full bg-[#3d271d] border ${theme === 'library' ? 'border-amber-400 ring-2 ring-amber-400/40' : 'border-slate-700'}`}
                title="Warm Library Theme"
              />
              <button
                onClick={() => setTheme('indigo-flow')}
                className={`w-3.5 h-3.5 rounded-full bg-[#1e204a] border ${theme === 'indigo-flow' ? 'border-indigo-400 ring-2 ring-indigo-400/40' : 'border-slate-700'}`}
                title="Indigo Flow Theme"
              />
              <button
                onClick={() => setTheme('nordic-frost')}
                className={`w-3.5 h-3.5 rounded-full bg-[#132c3d] border ${theme === 'nordic-frost' ? 'border-cyan-400 ring-2 ring-cyan-400/40' : 'border-slate-700'}`}
                title="Nordic Frost Theme"
              />
            </div>

            {/* Split-Screen Source Grounding Reader Toggle */}
            <button
              onClick={() => {
                if (!isSourceReaderOpen && currentConcept.sourceAnchor?.pageNumber) {
                  setSourceTargetPage(currentConcept.sourceAnchor.pageNumber);
                }
                setIsSourceReaderOpen(prev => !prev);
              }}
              className={`px-2.5 py-1.5 rounded-xl border transition-all shadow-sm flex items-center gap-1.5 text-xs font-bold ${
                isSourceReaderOpen
                  ? 'bg-indigo-600/30 border-indigo-400 text-indigo-200 ring-2 ring-indigo-500/20'
                  : 'bg-slate-900/80 hover:bg-slate-800 border-white/[0.08] hover:border-indigo-500/40 text-indigo-300 hover:text-white'
              }`}
              title="Toggle Split-Screen PDF & Source Grounding Reader"
            >
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden md:inline">Source Reader</span>
              {currentConcept.sourceAnchor && (
                <span className="text-[11px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                  p.{currentConcept.sourceAnchor.pageNumber}
                </span>
              )}
            </button>

            {/* Dual-Coding Whiteboard Global Shortcut */}
            <button
              onClick={() => setIsGlobalWhiteboardOpen(true)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-white/[0.08] hover:border-purple-500/40 text-purple-300 hover:text-white transition-all shadow-sm flex items-center gap-1.5 text-xs font-bold"
              title="Open Dual-Coding Diagram Whiteboard"
            >
              <PenTool className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden md:inline">Whiteboard</span>
            </button>

            {/* Fullscreen Focus Toggle */}
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-white/[0.08] text-slate-400 hover:text-white transition-colors"
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen Focus'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Live Session Clock */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-white/[0.1] text-slate-200 font-mono text-xs font-semibold shadow-inner">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span>{timeFormatted}</span>
            </div>

          </div>

        </div>
      </div>

      {/* Anti-distraction Focus Guard Banner */}
      {distractionAlert && (
        <div className="w-full bg-amber-500/20 border-b border-amber-500/30 px-4 py-2.5 text-center text-xs text-amber-200 animate-fadeIn flex items-center justify-center gap-2 font-medium">
          <EyeOff className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{distractionAlert}</span>
        </div>
      )}

      {/* Main Study Arena with Split-Screen Support */}
      <main className={`flex-1 w-full mx-auto p-4 sm:p-6 flex flex-col justify-center transition-all ${
        isSourceReaderOpen ? 'max-w-[1720px]' : 'max-w-5xl'
      }`}>
        {isSourceReaderOpen ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch flex-1 min-h-[660px]">
            {/* Left Column: Split-Screen Source Grounding Reader */}
            <div className="lg:col-span-5 h-[620px] lg:h-auto min-h-[580px] flex flex-col">
              <SplitSourceReader
                sourceDocument={session.sourceDocument}
                targetPage={sourceTargetPage}
                highlightTerms={[
                  currentConcept.title,
                  ...currentConcept.coreTakeaways,
                  ...currentConcept.keyTerms.map(k => k.term),
                ]}
                activeAnchorSnippet={activeSourceSnippet || currentConcept.sourceAnchor?.snippet}
                onClose={() => setIsSourceReaderOpen(false)}
                onPageChange={(page) => setSourceTargetPage(page)}
                onAttachSource={async (file) => {
                  const extracted = await PDFService.extractTextFromPDF(file);
                  const updatedDoc = {
                    name: extracted.fileName,
                    totalPages: extracted.numPages,
                    pages: extracted.pages,
                    pdfDataUrl: extracted.pdfDataUrl,
                  };
                  setSession(prev => {
                    const next = { ...prev, sourceDocument: updatedDoc };
                    StorageService.saveSession(next);
                    return next;
                  });
                }}
              />
            </div>

            {/* Right Column: Active Study Phase */}
            <div className="lg:col-span-7 flex flex-col justify-center">
              {renderActivePhase()}
            </div>
          </div>
        ) : (
          renderActivePhase()
        )}
      </main>

      {/* Exit Confirmation Dialog */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="max-w-sm w-full p-6 rounded-3xl bg-[#0d101e] border border-white/[0.12] shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Clock className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white font-display">Pause or End Session?</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                All reviewed flashcard intervals and elapsed focus time have already been preserved in your local retention database.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
              >
                Resume Flow
              </button>
              <button
                onClick={onExit}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/30 transition-colors"
              >
                End Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Dual-Coding Whiteboard Modal */}
      {isGlobalWhiteboardOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl p-3 sm:p-6 flex flex-col justify-center items-center animate-fadeIn">
          <div className="w-full max-w-5xl h-[88vh] flex flex-col relative space-y-2">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2 text-xs font-bold text-white font-display">
                <PenTool className="w-4 h-4 text-purple-400" />
                <span>Dual-Coding Drafting Studio — {currentConcept.title}</span>
              </div>
              <button
                onClick={() => setIsGlobalWhiteboardOpen(false)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/[0.1] text-xs font-bold transition-all"
              >
                ✕ Close Canvas
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <DualCodingWhiteboard
                concept={currentConcept}
                isExpandedInitial={false}
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
