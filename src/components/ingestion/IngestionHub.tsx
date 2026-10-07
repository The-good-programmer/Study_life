import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X,
  Sparkles, 
  FileText, 
  ArrowRight, 
  Play, 
  RefreshCw, 
  Layers, 
  UploadCloud, 
  CheckCircle2, 
  AlertCircle, 
  FileUp, 
  BookMarked, 
  Search, 
  Trash2, 
  Download, 
  Zap, 
  ShieldCheck, 
  Clock, 
  BookmarkCheck, 
  Check, 
  Maximize2,
  Headphones,
  Award,
  Shuffle,
  Plus,
  Printer,
  Edit3,
  Eye,
  Star,
  ChevronRight,
  Globe,
  GraduationCap,
  ChevronDown,
  FolderPlus,
  FolderInput
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { StudySession, StarterDeckMetadata, RetrievalCard, DepthTier, SubjectFolder } from '../../types';
import { CURATED_STARTER_DECKS } from '../../data/curatedStarterCatalog';
import { PDFService } from '../../services/pdfService';
import type { ExtractedPDF } from '../../services/pdfService';
import { StorageService } from '../../services/storageService';
import { ExportService } from '../../services/exportService';
import { soundEngine } from '../../services/soundEngine';
import { CognitiveTourModal } from '../onboarding/CognitiveTourModal';
import { DepthEstimationService, SUPPORTED_LANGUAGES } from '../../services/depthEstimationService';
import { EducationProfileModal } from './EducationProfileModal';
import { useDeckGeneration } from './useDeckGeneration';
import { Badge, Button, IconButton, ProgressBar } from '../ui/primitives';
import { ActionMenu } from '../ui/ActionMenu';
import { EducationCatalog } from '../../services/educationCatalog';
import { SubjectFolderModal } from '../studio/SubjectFolderModal';
import { FOLDER_COLORS } from '../studio/folderOptions';
import { MoveToFolderModal } from '../studio/MoveToFolderModal';
import { fillCloze } from '../../utils/cloze';

const StarterCatalogModal = React.lazy(() => import('../catalog/StarterCatalogModal').then(m => ({ default: m.StarterCatalogModal })));
const DeckStudioModal = React.lazy(() => import('../studio/DeckStudioModal').then(m => ({ default: m.DeckStudioModal })));

function createClonedStarterSession(deck: StarterDeckMetadata): StudySession {
  return {
    ...deck.session,
    id: `${deck.id}-${Date.now()}`,
    createdAt: new Date().toISOString(),
    elapsedSeconds: 0,
    currentConceptIndex: 0,
    currentPhase: 'priming',
  };
}

function createAllStarredSession(starredCards: RetrievalCard[]): StudySession {
  return {
    id: `starred-all-${Date.now()}`,
    title: 'High-Yield Starred Cards Drill',
    category: 'Targeted Review',
    description: 'Custom active recall session focused exclusively on your bookmarked flashcards.',
    currentConceptIndex: 0,
    currentPhase: 'retrieval',
    elapsedSeconds: 0,
    createdAt: new Date().toISOString(),
    casualFlashcardMode: true,
    concepts: [
      {
        id: 'starred-concept-all',
        order: 1,
        title: 'Bookmarked Cards Mastery',
        estimatedMinutes: Math.max(5, Math.round(starredCards.length * 1.5)),
        mentalModel: 'Focused active retrieval targeted specifically at bookmarked cards.',
        coreTakeaways: ['High-yield deliberate practice targeting prior struggles.'],
        keyTerms: [],
        feynmanPrompt: 'Explain how focused repetition on starred cards cures memory interference.',
        sampleMasteryExplanation: 'Targeted retrieval on tagged items reduces error density.',
        retrievalCards: starredCards,
      }
    ]
  };
}

interface IngestionHubProps {
  onStartSession: (session: StudySession) => void;
  onOpenDashboard: () => void;
  onOpenDeckStation?: (session: StudySession) => void;
  onStartMatch?: (session: StudySession) => void;
  onStartAudioBriefing?: (session: StudySession) => void;
  onOpenExam?: () => void;
  onOpenInterleaving?: () => void;
  onOpenSanctuary?: () => void;
  initialLibraryTab?: 'my-decks' | 'starred' | 'curated';
}

export const IngestionHub: React.FC<IngestionHubProps> = ({ 
  onStartSession, 
  onOpenDashboard,
  onOpenDeckStation,
  onStartMatch,
  onStartAudioBriefing,
  onOpenExam,
  onOpenInterleaving,
  initialLibraryTab,
}) => {
  // Ingestion studio mode: pdf | topic | notes | occlusion
  const [ingestMode, setIngestMode] = useState<'pdf' | 'topic' | 'notes' | 'occlusion'>('topic');
  const [topicInput, setTopicInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [isStarterCatalogModalOpen, setIsStarterCatalogModalOpen] = useState(false);
  const [justImportedId, setJustImportedId] = useState<string | null>(null);
  const [isTourModalOpen, setIsTourModalOpen] = useState(false);


  // Multilingual State
  const [selectedLanguageCode, setSelectedLanguageCode] = useState<string>('auto');
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);

  // Real-time language detection
  const detectedLanguage = useMemo(() => {
    return DepthEstimationService.detectLanguage(topicInput);
  }, [topicInput]);

  const effectiveLanguage = useMemo(() => {
    if (selectedLanguageCode === 'auto') return detectedLanguage;
    return SUPPORTED_LANGUAGES.find(l => l.code === selectedLanguageCode) || detectedLanguage;
  }, [selectedLanguageCode, detectedLanguage]);

  // Real-time concept depth estimation
  const depthEstimate = useMemo(() => {
    return DepthEstimationService.estimateConceptDepth(topicInput, effectiveLanguage.code);
  }, [topicInput, effectiveLanguage]);

  const effectiveTier: DepthTier = depthEstimate.tier;
  
  // PDF state
  const [isParsingPDF, setIsParsingPDF] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<{ percent: number; page: number; total: number } | null>(null);
  const [extractedPdf, setExtractedPdf] = useState<ExtractedPDF | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Library & Decks state
  const [savedSessions, setSavedSessions] = useState<StudySession[]>(() => StorageService.getSessions());
  const [selectedLibraryTab, setSelectedLibraryTab] = useState<'my-decks' | 'starred' | 'curated' | null>(null);
  const [prevInitialTab, setPrevInitialTab] = useState(initialLibraryTab);

  if (initialLibraryTab !== prevInitialTab) {
    setPrevInitialTab(initialLibraryTab);
    setSelectedLibraryTab(null);
  }

  const activeLibraryTab = selectedLibraryTab ?? initialLibraryTab ?? 'my-decks';
  const setActiveLibraryTab = (tab: 'my-decks' | 'starred' | 'curated') => setSelectedLibraryTab(tab);
  const [deckSearch, setDeckSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isDeckStudioOpen, setIsDeckStudioOpen] = useState(false);
  const [deckStudioTab, setDeckStudioTab] = useState<'create' | 'import' | 'occlusion'>('create');
  const [editingSession, setEditingSession] = useState<StudySession | null>(null);

  // Subject Folders state
  const [folders, setFolders] = useState<SubjectFolder[]>(() => StorageService.getFolders());
  const [selectedFolderId, setSelectedFolderId] = useState<string>('all');
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<SubjectFolder | null>(null);
  const [moveToFolderSession, setMoveToFolderSession] = useState<StudySession | null>(null);

  // Sync folders and sessions with storage mutations
  useEffect(() => {
    const unsub = StorageService.addMutationListener(() => {
      setFolders(StorageService.getFolders());
      setSavedSessions(StorageService.getSessions());
    });
    return unsub;
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const generation = useDeckGeneration({
    onSessionReady: onStartSession,
    onSessionSaved: () => setSavedSessions(StorageService.getSessions()),
  });
  const { isLoading, effectiveProfile, profileModal } = generation;

  const dueCards = StorageService.getDueCards();
  const allCards = StorageService.getAllCards();
  const starredCards = useMemo(() => allCards.filter(c => c.isStarred), [allCards]);

  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    savedSessions.forEach(s => { if (s.category) cats.add(s.category); });
    CURATED_STARTER_DECKS.forEach(d => { if (d.category) cats.add(d.category); });
    return ['All', ...Array.from(cats).sort()];
  }, [savedSessions]);

  const curatedTopicsByDomain = [
    { domain: 'Neuroscience', topic: 'Neuroplasticity & Synaptic Pruning' },
    { domain: 'Physics', topic: 'Quantum Superposition & Qubits' },
    { domain: 'Biochemistry', topic: 'Cellular DNA Replication Forks' },
    { domain: 'Economics', topic: 'Microeconomics: Price Elasticity of Demand' },
    { domain: 'AI & CS', topic: 'Machine Learning: Gradient Descent & Loss Landscapes' }
  ];

  const handleProcessPDFFile = async (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setPdfError('Please drop a valid PDF document (.pdf).');
      return;
    }

    setPdfError(null);
    setIsParsingPDF(true);
    setPdfProgress({ percent: 0, page: 0, total: 0 });

    try {
      const extracted = await PDFService.extractTextFromPDF(file, (percent, page, total) => {
        setPdfProgress({ percent, page, total });
      });

      if (!extracted.text.trim()) {
        setPdfError('Could not find readable text in this PDF. It may be a scanned image without OCR.');
        setExtractedPdf(null);
      } else {
        setExtractedPdf(extracted);
      }
    } catch (err) {
      console.error(err);
      setPdfError('Failed to parse PDF. Please verify the file is not corrupted or password-protected.');
    } finally {
      setIsParsingPDF(false);
      setPdfProgress(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleProcessPDFFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleProcessPDFFile(e.target.files[0]);
    }
  };

  const handleLaunchPDFSession = () => {
    if (extractedPdf) generation.generate({ kind: 'pdf', pdf: extractedPdf });
  };

  const handleGenerateTopic = (topicToUse?: string) => {
    generation.generate({
      kind: 'topic',
      text: topicToUse || topicInput,
      depthTier: effectiveTier,
      languageCode: effectiveLanguage.code,
    });
  };

  const handleDecomposeNotes = () => {
    generation.generate({ kind: 'notes', text: notesInput });
  };

  const handleDeleteDeck = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Delete this study deck from your local library?')) {
      StorageService.deleteSession(id);
      setSavedSessions(StorageService.getSessions());
    }
  };

  const handleExportSingleDeck = (session: StudySession, e: React.MouseEvent) => {
    e.stopPropagation();
    ExportService.downloadJSON(session);
  };

  // Filtered decks for My Decks tab
  const filteredMyDecks = savedSessions.filter(s => {
    const matchesSearch = 
      s.title.toLowerCase().includes(deckSearch.toLowerCase()) || 
      s.category.toLowerCase().includes(deckSearch.toLowerCase());
    const matchesCat = selectedCategory === 'All' || s.category === selectedCategory;
    const matchesFolder = 
      selectedFolderId === 'all' || 
      (selectedFolderId === 'uncategorized' ? !s.folderId : s.folderId === selectedFolderId);
    return matchesSearch && matchesCat && matchesFolder;
  });

  // Filtered curated decks
  const filteredCuratedDecks = CURATED_STARTER_DECKS.filter(d => {
    const matchesSearch = 
      d.title.toLowerCase().includes(deckSearch.toLowerCase()) || 
      d.summary.toLowerCase().includes(deckSearch.toLowerCase()) ||
      d.category.toLowerCase().includes(deckSearch.toLowerCase());
    const matchesCat = selectedCategory === 'All' || d.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  // First available session for quick launch widgets
  const defaultQuickSession = savedSessions[0] || CURATED_STARTER_DECKS[0]?.session;

  const handleLaunchAllStarred = () => {
    if (starredCards.length === 0) return;
    const session = createAllStarredSession(starredCards);
    onStartSession(session);
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 animate-fadeIn">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[26px] font-semibold tracking-tight text-ink sm:text-[30px]">Library</h1>
          <p className="mt-1 text-[15px] text-ink-muted">Turn any topic, notes or PDF into a deck, then study it your way.</p>
        </div>
        {dueCards.length > 0 && (
          <Button variant="secondary" size="sm" icon={Layers} onClick={onOpenDashboard}>
            {dueCards.length} due for review
          </Button>
        )}
      </header>

      {generation.error && (
        <div role="alert" className="flex items-start gap-2.5 rounded-2xl border border-danger/30 bg-danger-soft p-3.5 text-[13px] text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="flex-1">{generation.error}</span>
          <button
            type="button"
            onClick={generation.dismissError}
            aria-label="Dismiss error"
            className="rounded-md p-0.5 opacity-80 hover:opacity-100 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Create a deck */}
      <section aria-labelledby="create-deck-title" className="space-y-5 rounded-3xl border border-line bg-surface p-5 shadow-[inset_0_1px_0_rgb(255_255_255/0.035)] sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="create-deck-title" className="text-[15px] font-semibold text-ink">Create a deck</h2>
            <p className="mt-0.5 text-[13px] text-ink-subtle">The AI writes the cards and pitches them at your level.</p>
          </div>
          <div role="tablist" aria-label="Source" className="inline-flex shrink-0 self-start rounded-xl border border-line bg-canvas p-1">
            {SOURCE_TABS.map(({ mode, label, icon: Icon }) => (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={ingestMode === mode}
                onClick={() => setIngestMode(mode)}
                className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-colors cursor-pointer ${
                  ingestMode === mode ? 'bg-surface-hover text-ink shadow-sm' : 'text-ink-subtle hover:text-ink'
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Topic */}
        {ingestMode === 'topic' && (
          <div className="space-y-4 animate-fadeIn">
            <form
              onSubmit={(e) => { e.preventDefault(); handleGenerateTopic(); }}
              className="relative flex items-center"
            >
              <Search className="pointer-events-none absolute left-4 h-[18px] w-[18px] text-ink-subtle" aria-hidden="true" />
              <input
                type="text"
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                placeholder="What do you want to learn?"
                aria-label="Topic to study"
                className="h-14 w-full rounded-2xl border border-line-strong bg-canvas pl-11 pr-32 text-[15px] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink-subtle focus:border-brand focus:ring-4 focus:ring-brand/15"
              />
              <Button
                type="submit"
                variant="primary"
                disabled={isLoading || !topicInput.trim()}
                icon={isLoading ? RefreshCw : undefined}
                trailingIcon={isLoading ? undefined : ArrowRight}
                className={`absolute right-2 ${isLoading ? '[&>svg:first-child]:animate-spin' : ''}`}
              >
                {isLoading ? 'Building' : 'Create'}
              </Button>
            </form>

            {topicInput.trim().length > 1 && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-canvas px-3.5 py-2.5 text-[13px] text-ink-muted animate-fadeIn">
                <span className="flex min-w-0 items-center gap-2">
                  <GraduationCap className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
                  {effectiveProfile ? (
                    <span className="truncate">
                      {EducationCatalog.getCountry(effectiveProfile.country).flag} {effectiveProfile.grade}, age {effectiveProfile.age}
                    </span>
                  ) : (
                    <span className="truncate">No grade set yet</span>
                  )}
                  <button type="button" onClick={profileModal.open} className="font-medium text-brand-text hover:underline cursor-pointer">
                    {effectiveProfile ? 'Change' : 'Set grade'}
                  </button>
                </span>

                <span className="relative">
                  <button
                    type="button"
                    onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
                    aria-haspopup="listbox"
                    aria-expanded={isLangDropdownOpen}
                    className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 hover:bg-surface-hover hover:text-ink cursor-pointer"
                  >
                    <Globe className="h-4 w-4 text-ink-subtle" aria-hidden="true" />
                    {effectiveLanguage.flag} {effectiveLanguage.nativeName}
                    {selectedLanguageCode === 'auto' && <span className="text-ink-subtle">(auto)</span>}
                    <ChevronDown className="h-3.5 w-3.5 text-ink-subtle" aria-hidden="true" />
                  </button>
                  {isLangDropdownOpen && (
                    <div role="listbox" className="absolute left-0 top-8 z-50 max-h-64 w-56 space-y-0.5 overflow-y-auto rounded-xl border border-line-strong bg-surface-solid p-1.5 shadow-2xl animate-fadeIn">
                      <button
                        type="button"
                        role="option"
                        aria-selected={selectedLanguageCode === 'auto'}
                        onClick={() => { setSelectedLanguageCode('auto'); setIsLangDropdownOpen(false); }}
                        className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[13px] cursor-pointer ${
                          selectedLanguageCode === 'auto' ? 'bg-brand-soft text-brand-text' : 'text-ink-muted hover:bg-surface-hover hover:text-ink'
                        }`}
                      >
                        <span>Auto-detect ({detectedLanguage.nativeName})</span>
                        {selectedLanguageCode === 'auto' && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                      </button>
                      <div className="my-1 h-px bg-line" />
                      {SUPPORTED_LANGUAGES.map(lang => (
                        <button
                          key={lang.code}
                          type="button"
                          role="option"
                          aria-selected={selectedLanguageCode === lang.code}
                          onClick={() => { setSelectedLanguageCode(lang.code); setIsLangDropdownOpen(false); }}
                          className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[13px] cursor-pointer ${
                            selectedLanguageCode === lang.code ? 'bg-brand-soft text-brand-text' : 'text-ink-muted hover:bg-surface-hover hover:text-ink'
                          }`}
                        >
                          <span>{lang.flag} {lang.nativeName}</span>
                          {selectedLanguageCode === lang.code && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                        </button>
                      ))}
                    </div>
                  )}
                </span>

                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-ink-subtle" aria-hidden="true" />
                  {depthEstimate.recommendedCheckpoints} concepts · about {depthEstimate.estimatedMinutes} min
                </span>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] text-ink-subtle">Try</span>
              {curatedTopicsByDomain.map(item => (
                <button
                  key={item.topic}
                  type="button"
                  onClick={() => {
                    setTopicInput(item.topic);
                    handleGenerateTopic(item.topic);
                  }}
                  disabled={isLoading}
                  className="inline-flex min-h-8 items-center rounded-full border border-line px-3 py-1 text-left text-[13px] text-ink-muted transition-colors hover:border-line-strong hover:bg-surface-hover hover:text-ink disabled:opacity-50 cursor-pointer"
                >
                  {item.topic}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {ingestMode === 'notes' && (
          <div className="space-y-3 animate-fadeIn">
            <div className="relative">
              <textarea
                rows={7}
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                placeholder="Paste lecture notes, slide bullet points, a textbook passage or a syllabus outline."
                aria-label="Your notes"
                className="w-full resize-y rounded-2xl border border-line-strong bg-canvas p-4 text-[15px] leading-relaxed text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink-subtle focus:border-brand focus:ring-4 focus:ring-brand/15"
              />
              <span className="pointer-events-none absolute bottom-3 right-3 text-xs tabular-nums text-ink-subtle">
                {notesInput.trim() ? notesInput.trim().split(/\s+/).length : 0} words
              </span>
            </div>
            <div className="flex justify-end">
              <Button
                variant="primary"
                onClick={handleDecomposeNotes}
                disabled={isLoading || !notesInput.trim()}
                icon={isLoading ? RefreshCw : Sparkles}
                className={`w-full sm:w-auto ${isLoading ? '[&>svg:first-child]:animate-spin' : ''}`}
              >
                {isLoading ? 'Building your deck' : 'Create deck from notes'}
              </Button>
            </div>
          </div>
        )}

        {/* PDF */}
        {ingestMode === 'pdf' && (
          <div className="space-y-3 animate-fadeIn">
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="application/pdf" className="hidden" />

            {!extractedPdf ? (
              <button
                type="button"
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors cursor-pointer ${
                  isDragOver ? 'border-brand bg-brand-soft' : 'border-line-strong bg-canvas hover:border-brand/60'
                }`}
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand-text">
                  <UploadCloud className="h-6 w-6" aria-hidden="true" />
                </span>
                <span className="mt-3 text-[15px] font-medium text-ink">Drop a lecture PDF here, or click to choose one</span>
                <span className="mt-1 max-w-md text-[13px] text-ink-subtle">
                  Each card links back to the page it came from, so you can check the source while you study.
                </span>
              </button>
            ) : (
              <div className="flex flex-col gap-4 rounded-2xl border border-success/30 bg-success-soft p-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-medium text-ink">{extractedPdf.fileName}</p>
                    <p className="text-[13px] text-ink-muted">{extractedPdf.numPages} pages read</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setExtractedPdf(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                  >
                    Change PDF
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleLaunchPDFSession}
                    disabled={isLoading}
                    icon={isLoading ? RefreshCw : Sparkles}
                    className={isLoading ? '[&>svg:first-child]:animate-spin' : ''}
                  >
                    {isLoading ? 'Building your deck' : 'Create deck'}
                  </Button>
                </div>
              </div>
            )}

            {isParsingPDF && pdfProgress && (
              <div className="space-y-1.5" aria-live="polite">
                <div className="flex justify-between text-[13px] text-ink-muted">
                  <span>Reading page {pdfProgress.page} of {pdfProgress.total}</span>
                  <span className="tabular-nums">{pdfProgress.percent}%</span>
                </div>
                <ProgressBar value={pdfProgress.percent} label="PDF reading progress" />
              </div>
            )}

            {pdfError && (
              <p role="alert" className="flex items-center gap-2 text-[13px] text-danger">
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                {pdfError}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1 border-t border-line pt-4 text-[13px]">
          <span className="mr-1 text-ink-subtle">Or</span>
          <Button
            variant="ghost"
            size="sm"
            icon={Eye}
            onClick={() => {
              setEditingSession(null);
              setDeckStudioTab('occlusion');
              setIsDeckStudioOpen(true);
            }}
          >
            Image occlusion
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={Plus}
            onClick={() => {
              setEditingSession(null);
              setDeckStudioTab('create');
              setIsDeckStudioOpen(true);
            }}
          >
            Write cards yourself
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={FileUp}
            onClick={() => {
              setEditingSession(null);
              setDeckStudioTab('import');
              setIsDeckStudioOpen(true);
            }}
          >
            Import Anki, Quizlet or CSV
          </Button>
        </div>
      </section>

      {/* Ways to study */}
      <section aria-labelledby="study-modes-title" className="space-y-3">
        <h2 id="study-modes-title" className="text-[15px] font-semibold text-ink">Ways to study</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StudyModeCard
            icon={Layers}
            title="Review due cards"
            description="Spaced repetition picks what you are about to forget."
            meta={dueCards.length > 0 ? `${dueCards.length} due` : 'Nothing due'}
            onClick={onOpenDashboard}
          />
          <StudyModeCard
            icon={Zap}
            title="Speed match"
            description="Pair terms with definitions against the clock."
            meta="60 seconds"
            onClick={defaultQuickSession && onStartMatch ? () => onStartMatch(defaultQuickSession) : undefined}
          />
          <StudyModeCard
            icon={Award}
            title="Mock exam"
            description="Timed questions scored on accuracy and confidence."
            meta="Pays for correct answers"
            onClick={onOpenExam}
          />
          <StudyModeCard
            icon={Shuffle}
            title="Mix decks"
            description="Shuffle subjects together to learn to tell them apart."
            meta="Interleaving"
            onClick={onOpenInterleaving}
          />
        </div>
      </section>

      {/* Decks workspace */}
      <section aria-label="Your decks" className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div role="tablist" aria-label="Deck collections" className="no-scrollbar inline-flex max-w-full self-start overflow-x-auto rounded-xl border border-line bg-canvas p-1">
            {([
              { tab: 'my-decks', label: 'My decks', count: savedSessions.length },
              { tab: 'starred', label: 'Starred', count: starredCards.length },
              { tab: 'curated', label: 'Starter decks', count: CURATED_STARTER_DECKS.length },
            ] as const).map(({ tab, label, count }) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeLibraryTab === tab}
                onClick={() => setActiveLibraryTab(tab)}
                className={`inline-flex h-8 shrink-0 items-center gap-2 rounded-lg px-3 text-[13px] font-medium transition-colors cursor-pointer ${
                  activeLibraryTab === tab ? 'bg-surface-hover text-ink shadow-sm' : 'text-ink-subtle hover:text-ink'
                }`}
              >
                {label}
                <span className="tabular-nums text-ink-subtle">{count}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1 md:w-60 md:flex-none">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
              <input
                type="search"
                value={deckSearch}
                onChange={(e) => setDeckSearch(e.target.value)}
                placeholder="Filter decks"
                aria-label="Filter decks"
                className="h-9 w-full rounded-lg border border-line bg-canvas pl-9 pr-3 text-[13px] text-ink outline-none transition-colors placeholder:text-ink-subtle focus:border-brand"
              />
            </div>
            <Button variant="secondary" size="sm" icon={Maximize2} onClick={() => setIsStarterCatalogModalOpen(true)} className="h-9">
              Catalog
            </Button>
          </div>
        </div>

        {activeLibraryTab !== 'starred' && (
          <div className="space-y-2.5">
            {activeLibraryTab === 'my-decks' && (
              <div className="no-scrollbar -mx-1 flex items-center gap-1.5 overflow-x-auto px-1 py-0.5">
                <span className="mr-1 shrink-0 text-[13px] text-ink-subtle">Subject</span>
                <LibraryChip active={selectedFolderId === 'all'} onClick={() => setSelectedFolderId('all')} count={savedSessions.length}>
                  All
                </LibraryChip>
                {folders.map(folder => {
                  const isSelected = selectedFolderId === folder.id;
                  const color = FOLDER_COLORS.find(c => c.id === folder.color) || FOLDER_COLORS[0];
                  return (
                    <div key={folder.id} className="group/folder flex shrink-0 items-center">
                      <LibraryChip
                        active={isSelected}
                        onClick={() => setSelectedFolderId(isSelected ? 'all' : folder.id)}
                        count={savedSessions.filter(s => s.folderId === folder.id).length}
                        dotClassName={color.dot}
                      >
                        {folder.name}
                      </LibraryChip>
                      <span className="ml-0.5 hidden items-center group-hover/folder:flex">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingFolder(folder);
                            setIsFolderModalOpen(true);
                          }}
                          aria-label={`Edit ${folder.name}`}
                          className="rounded-md p-1 text-ink-subtle hover:bg-surface-hover hover:text-ink cursor-pointer"
                        >
                          <Edit3 className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Delete the subject "${folder.name}"? Its decks stay in your library, unassigned.`)) {
                              StorageService.deleteFolder(folder.id);
                              if (selectedFolderId === folder.id) setSelectedFolderId('all');
                              setFolders(StorageService.getFolders());
                              setSavedSessions(StorageService.getSessions());
                              soundEngine.playCompanionBubble();
                            }
                          }}
                          aria-label={`Delete ${folder.name}`}
                          className="rounded-md p-1 text-ink-subtle hover:bg-danger-soft hover:text-danger cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </span>
                    </div>
                  );
                })}
                {folders.length > 0 && savedSessions.some(s => !s.folderId) && (
                  <LibraryChip
                    active={selectedFolderId === 'uncategorized'}
                    onClick={() => setSelectedFolderId(selectedFolderId === 'uncategorized' ? 'all' : 'uncategorized')}
                    count={savedSessions.filter(s => !s.folderId).length}
                  >
                    Unassigned
                  </LibraryChip>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setEditingFolder(null);
                    setIsFolderModalOpen(true);
                  }}
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-dashed border-line-strong px-3 text-[13px] text-ink-subtle transition-colors hover:border-brand hover:text-brand-text cursor-pointer"
                >
                  <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />
                  New subject
                </button>
              </div>
            )}

            <div className="no-scrollbar -mx-1 flex items-center gap-1.5 overflow-x-auto px-1 py-0.5">
              <span className="mr-1 shrink-0 text-[13px] text-ink-subtle">Category</span>
              {availableCategories.map(cat => (
                <LibraryChip key={cat} active={selectedCategory === cat} onClick={() => setSelectedCategory(cat)}>
                  {cat}
                </LibraryChip>
              ))}
            </div>
          </div>
        )}

        {/* My decks */}
        {activeLibraryTab === 'my-decks' && (
          filteredMyDecks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line-strong px-6 py-12 text-center">
              <BookMarked className="mx-auto h-8 w-8 text-ink-subtle" aria-hidden="true" />
              <p className="mt-3 text-[15px] font-medium text-ink">
                {deckSearch
                  ? 'No decks match your filter'
                  : selectedFolderId !== 'all'
                    ? 'No decks in this subject yet'
                    : 'No decks yet'}
              </p>
              <p className="mx-auto mt-1 max-w-sm text-[13px] text-ink-subtle">
                {selectedFolderId !== 'all'
                  ? 'Use "Move to subject" in a deck menu to file it here.'
                  : 'Create one above, or add a starter deck from the catalog.'}
              </p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filteredMyDecks.map(deck => {
                const totalCards = deck.concepts.reduce((acc, c) => acc + c.retrievalCards.length, 0);
                const totalMins = deck.concepts.reduce((acc, c) => acc + (c.estimatedMinutes || 5), 0);
                const folder = folders.find(f => f.id === deck.folderId);
                const color = folder ? FOLDER_COLORS.find(c => c.id === folder.color) || FOLDER_COLORS[0] : null;
                return (
                  <article
                    key={deck.id}
                    className="group flex flex-col rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-line-strong hover:bg-surface-hover"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <Badge>{deck.category || 'General'}</Badge>
                        <button
                          type="button"
                          onClick={() => setMoveToFolderSession(deck)}
                          className="inline-flex max-w-[150px] items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink cursor-pointer"
                          title={folder ? `Subject: ${folder.name}. Click to move.` : 'Add to a subject'}
                        >
                          {color ? <span className={`h-2 w-2 shrink-0 rounded-full ${color.dot}`} aria-hidden="true" /> : <FolderInput className="h-3 w-3" aria-hidden="true" />}
                          <span className="truncate">{folder ? folder.name : 'Add to subject'}</span>
                        </button>
                      </div>
                      <ActionMenu
                        label={`More actions for ${deck.title}`}
                        items={[
                          {
                            label: 'Edit cards',
                            icon: Edit3,
                            onSelect: () => {
                              setEditingSession(deck);
                              setDeckStudioTab('create');
                              setIsDeckStudioOpen(true);
                            },
                          },
                          { label: 'Move to subject', icon: FolderInput, onSelect: () => setMoveToFolderSession(deck) },
                          { label: 'Print study sheet', icon: Printer, onSelect: () => ExportService.printStudySheet(deck) },
                          { label: 'Export as Markdown', icon: FileText, onSelect: () => ExportService.downloadMarkdown(deck) },
                          { label: 'Export as JSON', icon: Download, onSelect: (e) => handleExportSingleDeck(deck, e) },
                          { label: 'Delete deck', icon: Trash2, tone: 'danger', onSelect: (e) => handleDeleteDeck(deck.id, e) },
                        ]}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => (onOpenDeckStation ? onOpenDeckStation(deck) : onStartSession(deck))}
                      className="mt-3 text-left cursor-pointer"
                    >
                      <h3 className="line-clamp-2 text-[15px] font-medium leading-snug text-ink group-hover:text-brand-text">{deck.title}</h3>
                      {deck.description && <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-ink-subtle">{deck.description}</p>}
                    </button>

                    <div className="mt-auto flex items-center justify-between pt-4 text-[13px] text-ink-subtle">
                      <span>
                        {deck.concepts.length} concepts · {totalCards} cards
                      </span>
                      <span className="flex items-center gap-1 tabular-nums">
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />~{totalMins} min
                      </span>
                    </div>

                    <div className="mt-3 flex items-center gap-1">
                      <Button variant="primary" size="sm" icon={Play} onClick={() => onStartSession(deck)} className="flex-1">
                        Study
                      </Button>
                      {onStartMatch && totalCards >= 2 && (
                        <IconButton icon={Zap} label="Speed match" onClick={() => onStartMatch(deck)} />
                      )}
                      {onStartAudioBriefing && (
                        <IconButton icon={Headphones} label="Audio briefing" onClick={() => onStartAudioBriefing(deck)} />
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )
        )}

        {/* Starred */}
        {activeLibraryTab === 'starred' && (
          <div className="space-y-3">
            <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                  <Star className="h-4 w-4 fill-gold text-gold" aria-hidden="true" />
                  Starred cards
                </h3>
                <p className="mt-1 text-[13px] text-ink-subtle">Cards you bookmarked while reviewing. Press S during a review to star a card.</p>
              </div>
              {starredCards.length > 0 && (
                <Button variant="primary" icon={Play} onClick={handleLaunchAllStarred}>
                  Drill {starredCards.length} starred {starredCards.length === 1 ? 'card' : 'cards'}
                </Button>
              )}
            </div>
            {starredCards.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line-strong px-6 py-12 text-center text-[13px] text-ink-subtle">
                No starred cards yet.
              </div>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {starredCards.map(card => (
                  <li key={card.id} className="space-y-2 rounded-2xl border border-line bg-surface p-4">
                    <p className="text-[15px] leading-relaxed text-ink">{fillCloze(card.question)}</p>
                    <p className="rounded-lg bg-surface-hover px-3 py-2 text-[13px] text-ink-muted">{card.answer}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Starter decks */}
        {activeLibraryTab === 'curated' && (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredCuratedDecks.map(deck => {
              const isImported = savedSessions.some(s => s.title === deck.title);
              const isJustImported = justImportedId === deck.id;
              return (
                <article
                  key={deck.id}
                  className="group flex flex-col rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-line-strong hover:bg-surface-hover"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge>{deck.category}</Badge>
                    {deck.hasImageOcclusion && (
                      <Badge tone="brand">
                        <Eye className="h-3 w-3" aria-hidden="true" />
                        Occlusion
                      </Badge>
                    )}
                    {deck.hasSourcePdf && (
                      <Badge tone="brand">
                        <FileText className="h-3 w-3" aria-hidden="true" />
                        PDF source
                      </Badge>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => (onOpenDeckStation ? onOpenDeckStation(deck.session) : onStartSession(deck.session))}
                    className="mt-3 text-left cursor-pointer"
                  >
                    <h3 className="line-clamp-2 text-[15px] font-medium leading-snug text-ink group-hover:text-brand-text">{deck.title}</h3>
                    <p className="mt-1 line-clamp-3 text-[13px] leading-relaxed text-ink-subtle">{deck.summary}</p>
                  </button>

                  <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-subtle">
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
                    <span className="truncate">{deck.verifiedBy}</span>
                  </p>

                  <div className="mt-auto flex items-center justify-between pt-4 text-[13px] text-ink-subtle">
                    <span>
                      {deck.conceptCount} concepts · {deck.cardCount} cards
                    </span>
                    <span className="flex items-center gap-1 tabular-nums">
                      <Clock className="h-3.5 w-3.5" aria-hidden="true" />~{deck.estimatedMinutes} min
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-1">
                    <Button
                      variant={isImported || isJustImported ? 'ghost' : 'secondary'}
                      size="sm"
                      icon={isJustImported ? Check : isImported ? BookmarkCheck : Download}
                      disabled={isImported && !isJustImported}
                      onClick={() => {
                        const cloned = createClonedStarterSession(deck);
                        StorageService.saveSession(cloned);
                        StorageService.saveCards(cloned.concepts.flatMap(c => c.retrievalCards));
                        soundEngine.playSuccess();
                        setSavedSessions(StorageService.getSessions());
                        setJustImportedId(deck.id);
                        setTimeout(() => setJustImportedId(null), 3000);
                      }}
                    >
                      {isJustImported ? 'Added' : isImported ? 'In library' : 'Add'}
                    </Button>
                    <Button variant="primary" size="sm" icon={Play} onClick={() => onStartSession(deck.session)} className="flex-1">
                      Study
                    </Button>
                    {onStartMatch && <IconButton icon={Zap} label="Speed match" onClick={() => onStartMatch(deck.session)} />}
                    {onStartAudioBriefing && (
                      <IconButton icon={Headphones} label="Audio briefing" onClick={() => onStartAudioBriefing(deck.session)} />
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Deck Studio Modal */}
      {isDeckStudioOpen && (
        <React.Suspense fallback={null}>
          <DeckStudioModal
            key={editingSession?.id || 'new-deck'}
            isOpen={isDeckStudioOpen}
            initialTab={deckStudioTab}
            initialSession={editingSession}
            onClose={() => {
              setIsDeckStudioOpen(false);
              setEditingSession(null);
            }}
            onSaveDeck={(newSession) => {
              setEditingSession(null);
              setSavedSessions(StorageService.getSessions());
              onStartSession(newSession);
            }}
          />
        </React.Suspense>
      )}

      {/* Starter Catalog Modal */}
      {isStarterCatalogModalOpen && (
        <React.Suspense fallback={null}>
          <StarterCatalogModal
            isOpen={isStarterCatalogModalOpen}
            onClose={() => setIsStarterCatalogModalOpen(false)}
            onStartSession={onStartSession}
            onOpenDeckStation={onOpenDeckStation}
            onDeckImported={() => setSavedSessions(StorageService.getSessions())}
          />
        </React.Suspense>
      )}

      {/* Educational Profile Calibration Modal */}
      {profileModal.isOpen && (
        <EducationProfileModal
          isOpen={profileModal.isOpen}
          initialProfile={effectiveProfile}
          onClose={profileModal.close}
          onSave={profileModal.save}
          title={effectiveProfile ? "Update Educational Calibration" : "Calibrate Your Grade & Curriculum"}
          description={effectiveProfile ? "Modify your grade, country, or age so Gemini adjusts studying complexity accordingly." : "Tell Gemini your country and grade so the study plan, mental models, and flashcards perfectly match your curriculum."}
          actionLabel={profileModal.willGenerate ? "Save & Generate Study Plan ✨" : "Save Learning Profile"}
        />
      )}

      {/* Subject Folder Creation & Editing Modal */}
      {isFolderModalOpen && (
        <SubjectFolderModal
          isOpen={isFolderModalOpen}
          initialFolder={editingFolder}
          onClose={() => {
            setIsFolderModalOpen(false);
            setEditingFolder(null);
          }}
          onFolderSaved={(savedFolder) => {
            setFolders(StorageService.getFolders());
            setSelectedFolderId(savedFolder.id);
          }}
        />
      )}

      {/* Move Deck to Subject Folder Modal */}
      {moveToFolderSession && (
        <MoveToFolderModal
          isOpen={!!moveToFolderSession}
          session={moveToFolderSession}
          onClose={() => setMoveToFolderSession(null)}
          onMoved={(_updated) => {
            setSavedSessions(StorageService.getSessions());
            setMoveToFolderSession(null);
          }}
          onOpenNewFolderModal={() => {
            setEditingFolder(null);
            setIsFolderModalOpen(true);
          }}
        />
      )}

      {/* 4-Phase Cognitive Architecture Tour Modal */}
      <CognitiveTourModal
        isOpen={isTourModalOpen}
        onClose={() => setIsTourModalOpen(false)}
        onStartQuickSession={() => setIsStarterCatalogModalOpen(true)}
      />

    </div>
  );
};

const SOURCE_TABS: { mode: 'topic' | 'notes' | 'pdf'; label: string; icon: LucideIcon }[] = [
  { mode: 'topic', label: 'Topic', icon: Sparkles },
  { mode: 'notes', label: 'Notes', icon: FileText },
  { mode: 'pdf', label: 'PDF', icon: FileUp },
];

interface StudyModeCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  meta: string;
  onClick?: () => void;
}

const StudyModeCard: React.FC<StudyModeCardProps> = ({ icon: Icon, title, description, meta, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={!onClick}
    className="group flex flex-col items-start gap-3 rounded-2xl border border-line bg-surface p-4 text-left transition-colors hover:border-line-strong hover:bg-surface-hover disabled:opacity-50 disabled:hover:bg-surface cursor-pointer"
  >
    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand-text">
      <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
    </span>
    <span>
      <span className="block text-[15px] font-medium text-ink">{title}</span>
      <span className="mt-1 block text-[13px] leading-relaxed text-ink-subtle">{description}</span>
    </span>
    <span className="mt-auto flex w-full items-center justify-between text-[13px] font-medium text-ink-muted group-hover:text-ink">
      {meta}
      <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </span>
  </button>
);

const LibraryChip: React.FC<{
  active: boolean;
  onClick: () => void;
  count?: number;
  dotClassName?: string;
  children: React.ReactNode;
}> = ({ active, onClick, count, dotClassName, children }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`inline-flex h-8 shrink-0 items-center gap-2 rounded-full border px-3 text-[13px] transition-colors cursor-pointer ${
      active ? 'border-transparent bg-ink text-canvas' : 'border-line text-ink-muted hover:border-line-strong hover:text-ink'
    }`}
  >
    {dotClassName && <span className={`h-2 w-2 rounded-full ${dotClassName}`} aria-hidden="true" />}
    <span className="max-w-[180px] truncate">{children}</span>
    {count !== undefined && <span className={`tabular-nums ${active ? 'opacity-70' : 'text-ink-subtle'}`}>{count}</span>}
  </button>
);

export default IngestionHub;
