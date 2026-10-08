import React, { useState, useEffect } from 'react';
import { X, Check, Maximize2, Minimize2, EyeOff, Volume2, VolumeX, PenTool, FileText } from 'lucide-react';
import type { StudyPhase, StudySession } from '../../types';
import { DiagnosticPhase } from './DiagnosticPhase';
import { PrimingPhase } from './PrimingPhase';
import { FeynmanPhase } from './FeynmanPhase';
import { RetrievalPhase } from './RetrievalPhase';
import { RestBreakPhase } from './RestBreakPhase';
import { SessionSummary } from './SessionSummary';
import { nextPass } from './sessionPass';
import { StorageService } from '../../services/storageService';
import { soundEngine } from '../../services/soundEngine';
import type { SoundType } from '../../services/soundEngine';
import { DualCodingWhiteboard } from '../canvas/DualCodingWhiteboard';
import { SplitSourceReader } from '../reader/SplitSourceReader';
import { PDFService } from '../../services/pdfService';
import { Badge, Button, IconButton } from '../ui/primitives';

interface StudyPilotProps {
  initialSession: StudySession;
  onExit: () => void;
  onOpenDashboard: () => void;
}

type AmbientTheme = 'obsidian' | 'library' | 'indigo-flow' | 'nordic-frost';

/**
 * What to save for a session. A finished one is saved as its next pass, so reopening the
 * deck starts studying again instead of showing (and paying for) the old summary.
 */
const toStored = (session: StudySession): StudySession => (session.currentPhase === 'summary' ? nextPass(session) : session);

/** When a pass finishes; it names the completion its summary pays for. */
const timestamp = () => new Date().toISOString();

export const StudyPilot: React.FC<StudyPilotProps> = ({ initialSession, onExit, onOpenDashboard }) => {
  const [session, setSession] = useState<StudySession>(() => {
    // Decks saved before reviews were kept in them can hold older copies of their cards.
    const latest = StorageService.deckWithLatestProgress(initialSession);
    if (
      !latest.casualFlashcardMode &&
      !latest.diagnosticReport &&
      latest.currentConceptIndex === 0 &&
      latest.currentPhase === 'priming'
    ) {
      return { ...latest, currentPhase: 'diagnostic' };
    }
    return latest;
  });
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  const [distractionAlert, setDistractionAlert] = useState<string | null>(null);
  const [theme, setTheme] = useState<AmbientTheme>('obsidian');
  const [currentSound, setCurrentSound] = useState<SoundType>(soundEngine.getCurrentSound());
  const [soundMenuOpen, setSoundMenuOpen] = useState(false);
  const soundMenuRef = React.useRef<HTMLDivElement>(null);
  const [isGlobalWhiteboardOpen, setIsGlobalWhiteboardOpen] = useState(false);
  const [isSourceReaderOpen, setIsSourceReaderOpen] = useState(false);
  const [sourceTargetPage, setSourceTargetPage] = useState<number>(1);

  useEffect(() => {
    const unsub = soundEngine.subscribe((sound) => {
      setCurrentSound(sound);
    });
    return unsub;
  }, []);

  // Close the sound menu on outside click or Escape.
  useEffect(() => {
    if (!soundMenuOpen) return;
    const onPointer = (e: MouseEvent) => {
      if (soundMenuRef.current && !soundMenuRef.current.contains(e.target as Node)) setSoundMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSoundMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [soundMenuOpen]);

  const sessionRef = React.useRef<StudySession>(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  /**
   * Changes the session, its ref and its saved copy together. The timer's cleanup saves
   * from the ref, and would otherwise write the previous step over the one just saved.
   */
  const updateSession = (change: (prev: StudySession) => StudySession) => {
    setSession(prev => {
      const updated = change(prev);
      sessionRef.current = updated;
      StorageService.saveSession(toStored(updated));
      return updated;
    });
  };

  // Live session timer: update in-memory elapsedSeconds every 1s, and persist every 30s + on unmount
  useEffect(() => {
    // No clock on the summary, but leaving it still saves the session as its next pass.
    if (session.currentPhase === 'summary') return () => StorageService.saveSession(toStored(sessionRef.current));
    let tickCount = 0;
    const interval = setInterval(() => {
      tickCount += 1;
      setSession(prev => {
        const nextSeconds = prev.elapsedSeconds + 1;
        const updated = { ...prev, elapsedSeconds: nextSeconds };
        sessionRef.current = updated;
        if (tickCount % 30 === 0) {
          StorageService.saveSession(toStored(updated));
        }
        return updated;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
      StorageService.saveSession(toStored(sessionRef.current));
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
    updateSession(prev => ({ ...prev, currentPhase: phase }));
  };

  const handleNextConceptOrSummary = () => {
    if (session.currentConceptIndex + 1 < session.concepts.length) {
      updateSession(prev => ({
        ...prev,
        currentConceptIndex: prev.currentConceptIndex + 1,
        currentPhase: prev.casualFlashcardMode ? 'retrieval' : 'priming',
      }));
    } else {
      const completedAt = timestamp();
      updateSession(prev => ({ ...prev, currentPhase: 'summary', completedAt }));
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
            updateSession(prev => ({ ...prev, diagnosticReport: report, currentPhase: 'priming' }));
          }}
          onSkip={() => setPhase('priming')}
        />
      )}

      {session.currentPhase === 'priming' && (
        <PrimingPhase
          key={currentConcept.id}
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
          key={currentConcept.id}
          concept={currentConcept}
          onComplete={() => setPhase('retrieval')}
          onInspectSource={handleInspectSource}
          sessionId={session.id}
        />
      )}

      {session.currentPhase === 'retrieval' && (
        <RetrievalPhase
          key={currentConcept.id}
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
          onRestart={() =>
            updateSession(prev => ({ ...nextPass(prev), currentPhase: prev.casualFlashcardMode ? 'retrieval' : 'diagnostic' }))
          }
          onHome={onExit}
          onOpenDashboard={onOpenDashboard}
          onStartSession={(rescue) => updateSession(() => rescue)}
        />
      )}
    </>
  );

  const phases: { id: StudyPhase; label: string; description: string }[] = [
    { id: 'diagnostic', label: 'Warm-up', description: 'A quick check of what you already know' },
    { id: 'priming', label: 'Overview', description: 'The big picture and key terms' },
    { id: 'feynman', label: 'Explain', description: 'Explain it in your own words' },
    { id: 'retrieval', label: 'Recall', description: 'Flashcards from memory' },
    { id: 'rest', label: 'Rest', description: 'A short break before the next concept' },
  ];
  const activePhaseIndex = phases.findIndex(p => p.id === session.currentPhase);

  const themeClasses: Record<AmbientTheme, string> = {
    'obsidian': 'bg-canvas text-ink',
    'library': 'bg-[#120e0c] text-amber-50',
    'indigo-flow': 'bg-[#0c0e1e] text-indigo-50',
    'nordic-frost': 'bg-[#0a1017] text-cyan-50',
  };

  const ambientThemes: { id: AmbientTheme; label: string; swatch: string }[] = [
    { id: 'obsidian', label: 'Default', swatch: 'bg-canvas' },
    { id: 'library', label: 'Warm library', swatch: 'bg-[#3d271d]' },
    { id: 'indigo-flow', label: 'Indigo', swatch: 'bg-[#1e204a]' },
    { id: 'nordic-frost', label: 'Nordic', swatch: 'bg-[#132c3d]' },
  ];

  return (
    <div className={`flex min-h-screen flex-col bg-ambient-mesh transition-colors duration-500 ${themeClasses[theme]}`}>
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-3 sm:gap-3 sm:px-4">
          <IconButton icon={X} label="End session" onClick={() => setShowExitConfirm(true)} />

          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-ink-subtle">
              {session.title} · Concept {session.currentConceptIndex + 1} of {session.concepts.length}
            </p>
            <h1 className="truncate text-[15px] font-semibold leading-tight text-ink">{currentConcept.title}</h1>
          </div>

          {session.casualFlashcardMode ? (
            <Badge tone="brand" className="hidden md:inline-flex">
              Quick review
            </Badge>
          ) : (
            <nav aria-label="Session steps" className="hidden items-center gap-0.5 rounded-xl border border-line bg-canvas p-1 lg:flex">
              {phases.map((p, idx) => {
                const isActive = idx === activePhaseIndex;
                const isPassed = idx < activePhaseIndex;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPhase(p.id)}
                    aria-current={isActive ? 'step' : undefined}
                    title={p.description}
                    className={`inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors cursor-pointer ${
                      isActive ? 'bg-surface-hover text-ink shadow-sm' : isPassed ? 'text-ink-muted hover:text-ink' : 'text-ink-subtle hover:text-ink-muted'
                    }`}
                  >
                    {isPassed ? (
                      <Check className="h-3 w-3 text-success" aria-hidden="true" />
                    ) : (
                      <span className="tabular-nums opacity-70">{idx + 1}</span>
                    )}
                    {p.label}
                  </button>
                );
              })}
            </nav>
          )}

          <div className="flex shrink-0 items-center gap-0.5">
            {/* Focus sound */}
            <div className="relative" ref={soundMenuRef}>
              <IconButton
                icon={currentSound !== 'off' ? Volume2 : VolumeX}
                label="Focus sound"
                active={currentSound !== 'off'}
                aria-haspopup="menu"
                aria-expanded={soundMenuOpen}
                onClick={() => setSoundMenuOpen(open => !open)}
              />
              {soundMenuOpen && (
                <div role="menu" className="absolute right-0 top-11 z-50 w-56 rounded-xl border border-line-strong bg-surface-solid p-1.5 shadow-2xl animate-fadeIn">
                  <p className="px-2.5 pb-1.5 pt-1 text-xs font-medium text-ink-subtle">Focus sound</p>
                  {COCKPIT_SOUNDS.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={currentSound === s.id}
                      onClick={() => {
                        soundEngine.play(s.id);
                        setSoundMenuOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors cursor-pointer ${
                        currentSound === s.id ? 'bg-brand-soft text-brand-text' : 'text-ink-muted hover:bg-surface-hover hover:text-ink'
                      }`}
                    >
                      {s.label}
                      {currentSound === s.id && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                    </button>
                  ))}
                  <div className="mt-1.5 border-t border-line px-2.5 pb-1 pt-2.5">
                    <p className="mb-2 text-xs font-medium text-ink-subtle">Background</p>
                    <div className="flex items-center gap-2">
                      {ambientThemes.map(t => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setTheme(t.id)}
                          aria-label={`${t.label} background`}
                          aria-pressed={theme === t.id}
                          title={t.label}
                          className={`h-6 w-6 rounded-full border transition-shadow cursor-pointer ${t.swatch} ${
                            theme === t.id ? 'border-brand ring-2 ring-brand/40' : 'border-line-strong'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <IconButton
              icon={FileText}
              label={isSourceReaderOpen ? 'Close source' : 'Open source document'}
              active={isSourceReaderOpen}
              onClick={() => {
                if (!isSourceReaderOpen && currentConcept.sourceAnchor?.pageNumber) {
                  setSourceTargetPage(currentConcept.sourceAnchor.pageNumber);
                }
                setIsSourceReaderOpen(prev => !prev);
              }}
            />
            <div className="hidden sm:flex">
              <IconButton icon={PenTool} label="Whiteboard" onClick={() => setIsGlobalWhiteboardOpen(true)} />
              <IconButton icon={isFullscreen ? Minimize2 : Maximize2} label={isFullscreen ? 'Exit full screen' : 'Full screen'} onClick={toggleFullscreen} />
            </div>

            <span
              className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-lg bg-surface-hover px-2.5 font-mono text-[13px] font-medium tabular-nums text-ink"
              title="Time in this session"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
              {timeFormatted}
            </span>
          </div>
        </div>
      </header>

      {distractionAlert && (
        <div role="status" className="flex items-center justify-center gap-2 border-b border-line bg-gold-soft px-4 py-2.5 text-center text-[13px] text-ink animate-fadeIn">
          <EyeOff className="h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
          {distractionAlert}
        </div>
      )}

      <main
        className={`mx-auto flex w-full flex-1 flex-col justify-center p-4 transition-[max-width] sm:p-6 ${
          isSourceReaderOpen ? 'max-w-[1720px]' : 'max-w-5xl'
        }`}
      >
        {isSourceReaderOpen ? (
          <div className="grid min-h-[660px] flex-1 grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
            <div className="flex h-[620px] min-h-[580px] flex-col lg:col-span-5 lg:h-auto">
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
                  updateSession(prev => ({ ...prev, sourceDocument: updatedDoc }));
                }}
              />
            </div>
            <div className="flex flex-col justify-center lg:col-span-7">{renderActivePhase()}</div>
          </div>
        ) : (
          renderActivePhase()
        )}
      </main>

      {showExitConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-labelledby="end-session-title"
          onClick={() => setShowExitConfirm(false)}
        >
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-3xl border border-line-strong bg-surface-solid p-6 text-center shadow-2xl">
            <h3 id="end-session-title" className="text-[17px] font-semibold text-ink">End this session?</h3>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">
              Everything you have reviewed so far is saved. Ending now skips the session summary and its pay.
            </p>
            <div className="mt-6 flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setShowExitConfirm(false)}>
                Keep studying
              </Button>
              <Button variant="danger" className="flex-1" onClick={onExit}>
                End session
              </Button>
            </div>
          </div>
        </div>
      )}

      {isGlobalWhiteboardOpen && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 p-3 backdrop-blur-xl animate-fadeIn sm:p-6" role="dialog" aria-modal="true" aria-label="Whiteboard">
          <div className="relative flex h-[88vh] w-full max-w-5xl flex-col gap-2">
            <div className="flex items-center justify-between gap-3 px-1">
              <p className="flex min-w-0 items-center gap-2 text-[13px] font-medium text-ink">
                <PenTool className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
                <span className="truncate">Sketch: {currentConcept.title}</span>
              </p>
              <Button variant="secondary" size="sm" icon={X} onClick={() => setIsGlobalWhiteboardOpen(false)}>
                Close
              </Button>
            </div>
            <div className="flex-1 overflow-hidden">
              <DualCodingWhiteboard concept={currentConcept} isExpandedInitial={false} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const COCKPIT_SOUNDS: { id: SoundType; label: string }[] = [
  { id: 'off', label: 'Off' },
  { id: 'binaural-40hz', label: '40 Hz tone' },
  { id: 'binaural-alpha-10hz', label: 'Alpha waves' },
  { id: 'brown-noise', label: 'Brown noise' },
  { id: 'pink-noise', label: 'Pink noise' },
  { id: 'rain', label: 'Rain' },
  { id: 'ambient-drone', label: 'Ambient pad' },
];
