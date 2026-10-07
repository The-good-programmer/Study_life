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
  Brain,
  Flame,
  SlidersHorizontal,
  ChevronRight,
  Globe,
  Compass,
  GraduationCap,
  ChevronDown,
  Folder,
  FolderPlus,
  FolderInput
} from 'lucide-react';
import type { StudySession, StarterDeckMetadata, RetrievalCard, DepthTier, SubjectFolder } from '../../types';
import { CURATED_STARTER_DECKS } from '../../data/curatedStarterCatalog';
import { PDFService } from '../../services/pdfService';
import type { ExtractedPDF } from '../../services/pdfService';
import { StorageService } from '../../services/storageService';
import { ExportService } from '../../services/exportService';
import { soundEngine } from '../../services/soundEngine';
import { lifeSimService } from '../../services/lifeSimService';
import { CharacterCompanion } from '../character/CharacterCompanion';
import { CognitiveTourModal } from '../onboarding/CognitiveTourModal';
import { DepthEstimationService, SUPPORTED_LANGUAGES } from '../../services/depthEstimationService';
import { EducationProfileModal } from './EducationProfileModal';
import { useDeckGeneration } from './useDeckGeneration';
import { EducationCatalog } from '../../services/educationCatalog';
import { SubjectFolderModal } from '../studio/SubjectFolderModal';
import { FOLDER_COLORS } from '../studio/folderOptions';
import { MoveToFolderModal } from '../studio/MoveToFolderModal';

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
  onOpenSanctuary,
  initialLibraryTab,
}) => {
  // Ingestion studio mode: pdf | topic | notes | occlusion
  const [ingestMode, setIngestMode] = useState<'pdf' | 'topic' | 'notes' | 'occlusion'>('pdf');
  const [topicInput, setTopicInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [isStarterCatalogModalOpen, setIsStarterCatalogModalOpen] = useState(false);
  const [justImportedId, setJustImportedId] = useState<string | null>(null);
  const [isTourModalOpen, setIsTourModalOpen] = useState(false);


  // Multilingual State
  const [selectedLanguageCode, setSelectedLanguageCode] = useState<string>('auto');
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);

  // LifeSim Token Wallet State  // LifeSim Token Wallet State
  const [walletCoins, setWalletCoins] = useState(() => lifeSimService.getWalletBalance());
  useEffect(() => {
    const unsub = lifeSimService.subscribe(() => {
      setWalletCoins(lifeSimService.getWalletBalance());
    });
    return unsub;
  }, []);

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

  const stats = StorageService.getStats();
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
    const json = JSON.stringify(session, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `axon-deck-${session.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
    <div className="space-y-6 sm:space-y-8 py-2 sm:py-4 animate-fadeIn">
      
      {/* 3D Character Companion & Daily Neuro-Priming Hero */}
      <CharacterCompanion 
        variant="hero" 
        size="lg" 
        onExploreTour={() => setIsTourModalOpen(true)} 
        onOpenSanctuary={onOpenSanctuary} 
      />

      {/* 1. Student Hero Greeting & Central Ingestion Dock */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-pink-500/15 text-pink-300 border border-pink-500/30 flex items-center gap-1.5">
                <Brain className="w-3 h-3 text-pink-400" />
                <span>Studify Study Autopilot</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                <Flame className="w-3 h-3 fill-amber-400 text-amber-400" />
                <span>{stats.currentStreak} Day Streak</span>
              </span>
              <button
                onClick={onOpenSanctuary}
                className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 hover:bg-emerald-500/25 transition-all cursor-pointer font-mono"
                title="Student Habitat & Cafeteria"
              >
                <span>🪙 {walletCoins} Tokens</span>
              </button>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight font-display">
              What shall we <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-300 to-cyan-400">Master Today?</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Type any subject, drop a lecture PDF, or paste notes. Studify turns it into delightful 3-minute micro-practice.
            </p>
          </div>

          {/* Daily Due Cards Quick Action */}
          <div className="flex items-center gap-3 p-2.5 sm:p-3 rounded-2xl bg-slate-950/80 border border-white/[0.08] shadow-inner shrink-0 self-start sm:self-auto">
            <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <Layers className="w-4 h-4" />
            </div>
            <div className="space-y-0.5 pr-2">
              <div className="text-xs font-bold text-white font-display">
                {dueCards.length > 0 ? `${dueCards.length} Cards Due` : 'Daily Review Clear'}
              </div>
              <div className="text-[11px] text-slate-400">
                {dueCards.length > 0 ? 'FSRS spaced queue' : '100% memory stability'}
              </div>
            </div>
            {dueCards.length > 0 && (
              <button
                onClick={onOpenDashboard}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 flex items-center gap-1 transition-all hover:scale-105 cursor-pointer shrink-0"
              >
                <span>Review</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {generation.error && (
          <div role="alert" className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="flex-1">{generation.error}</span>
            <button
              type="button"
              onClick={generation.dismissError}
              aria-label="Dismiss error"
              className="text-rose-300/70 hover:text-rose-200 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Central Ingestion Input Card (Gizmo Style) */}
        <div className="p-5 sm:p-6 rounded-3xl glass-panel-elevated space-y-4 border border-indigo-500/20 shadow-2xl">
          <form 
            onSubmit={(e) => { e.preventDefault(); handleGenerateTopic(); }}
            className="relative flex items-center w-full"
          >
            <Search className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400 absolute left-4" />
            <input
              type="text"
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              placeholder="I want to study... (e.g. Photosynthesis, Supply & Demand, Machine Learning)"
              className="w-full pl-11 sm:pl-12 pr-28 sm:pr-32 py-3.5 sm:py-4 rounded-2xl bg-slate-950/90 border border-white/[0.12] focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-white text-xs sm:text-sm outline-none placeholder:text-slate-500 transition-all shadow-inner font-medium"
            />
            <button
              type="submit"
              disabled={isLoading || !topicInput.trim()}
              className="absolute right-2 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
            >
              {isLoading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <span>Start</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Active Educational Profile & Language Calibration Dock */}
          {topicInput.trim().length > 1 && (
            <div className="p-3.5 sm:p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/20 space-y-3 animate-fadeIn">
              {/* Profile Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center text-lg shadow-md shadow-indigo-500/25 shrink-0">
                    {effectiveProfile ? EducationCatalog.getCountry(effectiveProfile.country).flag : '🎓'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-white font-display flex items-center gap-1.5">
                        <GraduationCap className="w-3.5 h-3.5 text-indigo-400" />
                        {effectiveProfile ? effectiveProfile.grade : 'Adaptive Educational Profile'}
                      </span>
                      {effectiveProfile && (
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          Age {effectiveProfile.age}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {effectiveProfile
                        ? `Curriculum: ${effectiveProfile.country} (${EducationCatalog.getCountry(effectiveProfile.country).systemName})`
                        : 'Calibrates vocabulary, formulas, and cognitive depth'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Language Selector Dropdown Pill */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-white/[0.12] text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                    >
                      <Globe className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{effectiveLanguage.flag} {effectiveLanguage.nativeName}</span>
                      {selectedLanguageCode === 'auto' && (
                        <span className="text-[11px] text-slate-400 font-mono">(Auto)</span>
                      )}
                      <ChevronDown className="w-3 h-3 text-slate-400" />
                    </button>

                    {isLangDropdownOpen && (
                      <div className="absolute right-0 mt-1.5 w-52 p-1.5 rounded-2xl bg-slate-900 border border-indigo-500/30 shadow-2xl z-50 backdrop-blur-xl animate-fadeIn space-y-0.5 max-h-60 overflow-y-auto">
                        <button
                          type="button"
                          onClick={() => { setSelectedLanguageCode('auto'); setIsLangDropdownOpen(false); }}
                          className={`w-full px-2.5 py-1.5 rounded-xl text-left text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                            selectedLanguageCode === 'auto' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <span>✨ Auto-Detect ({detectedLanguage.nativeName})</span>
                          {selectedLanguageCode === 'auto' && <Check className="w-3 h-3" />}
                        </button>
                        <div className="h-px bg-white/[0.06] my-1" />
                        {SUPPORTED_LANGUAGES.map(lang => (
                          <button
                            key={lang.code}
                            type="button"
                            onClick={() => { setSelectedLanguageCode(lang.code); setIsLangDropdownOpen(false); }}
                            className={`w-full px-2.5 py-1.5 rounded-xl text-left text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                              selectedLanguageCode === lang.code ? 'bg-indigo-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'
                            }`}
                          >
                            <span>{lang.flag} {lang.nativeName} ({lang.name})</span>
                            {selectedLanguageCode === lang.code && <Check className="w-3 h-3" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Profile Change / Set Button */}
                  <button
                    type="button"
                    onClick={profileModal.open}
                    className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs font-semibold text-white flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{effectiveProfile ? 'Change Profile' : 'Set Profile'}</span>
                  </button>
                </div>
              </div>

              {/* Dynamic Pedagogical Feedback Sub-bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/[0.06] text-[11px] text-slate-400">
                <div className="flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="text-slate-300 font-medium">
                    {effectiveProfile
                      ? `Gemini will calibrate cognitive depth & mental models for ${effectiveProfile.country} ${effectiveProfile.grade} (Age ${effectiveProfile.age}).`
                      : depthEstimate.reasoning}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-slate-400 font-mono text-[11px]">
                  <span>Checkpoints: <strong className="text-white">{depthEstimate.recommendedCheckpoints}</strong></span>
                  <span>Est. Focus: <strong className="text-indigo-300">~{depthEstimate.estimatedMinutes}m</strong></span>
                </div>
              </div>
            </div>
          )}

          {/* 4 Instant Action Pills (Gizmo Source Selectors) */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/[0.06]">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIngestMode(ingestMode === 'pdf' ? 'topic' : 'pdf')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  ingestMode === 'pdf'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-white/[0.08]'
                }`}
              >
                <FileUp className="w-3.5 h-3.5 text-indigo-400" />
                <span>Upload PDF</span>
              </button>

              <button
                type="button"
                onClick={() => setIngestMode(ingestMode === 'notes' ? 'topic' : 'notes')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  ingestMode === 'notes'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-white/[0.08]'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-purple-400" />
                <span>Paste Notes</span>
              </button>

              <button
                type="button"
                onClick={() => setIngestMode(ingestMode === 'topic' ? 'pdf' : 'topic')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  ingestMode === 'topic'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-white/[0.08]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Topic Ideas</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditingSession(null);
                  setDeckStudioTab('occlusion');
                  setIsDeckStudioOpen(true);
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-slate-900/80 hover:bg-slate-800 text-emerald-400 border border-emerald-500/20 hover:border-emerald-500/40 transition-all cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Image Occlusion</span>
              </button>
            </div>

            <button
              onClick={() => {
                setEditingSession(null);
                setDeckStudioTab('create');
                setIsDeckStudioOpen(true);
              }}
              className="text-xs text-slate-400 hover:text-white font-medium flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Custom Deck Studio</span>
            </button>
          </div>

          {/* Panel 1: PDF Dropzone */}
          {ingestMode === 'pdf' && (
            <div className="space-y-4 pt-3 border-t border-white/[0.06] animate-fadeIn">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="application/pdf"
                className="hidden"
              />

              {!extractedPdf ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-8 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center cursor-pointer group ${
                    isDragOver
                      ? 'border-indigo-500 bg-indigo-500/10 scale-[1.01]'
                      : 'border-white/[0.12] hover:border-indigo-500/50 bg-slate-950/40 hover:bg-slate-950/60'
                  }`}
                >
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 mb-2 group-hover:scale-110 transition-transform">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-white font-display mb-1">
                    Drag and drop your lecture PDF or chapter here
                  </h3>
                  <p className="text-xs text-slate-400 max-w-md mb-2">
                    Studify extracts structured knowledge anchors with PDF.js and links each flashcard to its source page.
                  </p>
                  <span className="px-3 py-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-xs font-semibold text-slate-200 transition-all">
                    Browse Files (.pdf)
                  </span>
                </div>
              ) : (
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/80 border border-emerald-500/40 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white font-display truncate max-w-sm sm:max-w-md">
                        {extractedPdf.fileName}
                      </div>
                      <div className="text-xs text-slate-400">
                        {extractedPdf.numPages} pages extracted • Ground truth source attached
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => {
                        setExtractedPdf(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-semibold text-slate-300"
                    >
                      Change PDF
                    </button>
                    <button
                      onClick={handleLaunchPDFSession}
                      disabled={isLoading}
                      className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isLoading ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Synthesizing...</span>
                        </>
                      ) : (
                        <>
                          <span>Synthesize Deck</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {isParsingPDF && pdfProgress && (
                <div className="space-y-1.5 p-3 rounded-xl bg-indigo-950/30 border border-indigo-500/20 text-xs">
                  <div className="flex justify-between text-indigo-300 font-mono text-[11px]">
                    <span>Extracting page {pdfProgress.page} of {pdfProgress.total}...</span>
                    <span>{pdfProgress.percent}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-200" 
                      style={{ width: `${pdfProgress.percent}%` }}
                    />
                  </div>
                </div>
              )}

              {pdfError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{pdfError}</span>
                </div>
              )}
            </div>
          )}

          {/* Panel 2: AI Topic Ideas */}
          {ingestMode === 'topic' && (
            <div className="space-y-3 pt-3 border-t border-white/[0.06] animate-fadeIn">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Instant Starters (Click to generate):
              </span>
              <div className="flex flex-wrap gap-2">
                {curatedTopicsByDomain.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setTopicInput(item.topic);
                      handleGenerateTopic(item.topic);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-950/80 hover:bg-slate-850 border border-white/[0.08] hover:border-indigo-500/40 text-xs text-slate-300 hover:text-white transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <span className="text-[11px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-white/[0.06] text-indigo-300">
                      {item.domain}
                    </span>
                    <span>{item.topic}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Panel 3: Lecture Notes */}
          {ingestMode === 'notes' && (
            <div className="space-y-4 pt-3 border-t border-white/[0.06] animate-fadeIn">
              <div className="relative">
                <textarea
                  rows={5}
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  placeholder="Paste lecture notes, slide bullet points, textbook paragraphs, or syllabus outline here..."
                  className="w-full p-4 rounded-2xl bg-slate-950/80 border border-white/[0.12] focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-white text-xs sm:text-sm outline-none resize-none placeholder:text-slate-500 transition-all leading-relaxed"
                />
                <div className="absolute bottom-3 right-3 text-[11px] font-mono text-slate-500 bg-slate-900/80 px-2 py-0.5 rounded border border-white/[0.08]">
                  {notesInput.trim() ? notesInput.trim().split(/\s+/).length : 0} words
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleDecomposeNotes}
                  disabled={isLoading || !notesInput.trim()}
                  className={`w-full sm:w-auto px-7 py-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xl transition-all cursor-pointer ${
                    isLoading || !notesInput.trim()
                      ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                      : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-600/30 hover:scale-[1.02]'
                  }`}
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Synthesizing Study Cycle...</span>
                    </>
                  ) : (
                    <>
                      <span>Decompose Notes &amp; Launch Pilot</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. Jump back in (Quizlet Style Prominent Card) */}
      {defaultQuickSession && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold text-white font-display flex items-center gap-2">
              <Play className="w-4 h-4 text-indigo-400 fill-indigo-400" />
              <span>Jump back in</span>
            </h2>
            <button
              onClick={() => setActiveLibraryTab('my-decks')}
              className="text-xs text-slate-400 hover:text-indigo-300 transition-colors font-medium cursor-pointer"
            >
              All decks ({savedSessions.length})
            </button>
          </div>

          {/* Quizlet Hero Continue Card */}
          <div className="p-5 sm:p-6 rounded-3xl glass-panel-elevated relative overflow-hidden border border-indigo-500/20 hover:border-indigo-500/40 transition-all group">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2.5 max-w-xl">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {defaultQuickSession.category}
                  </span>
                  <span className="text-xs text-slate-500">•</span>
                  <span className="text-xs text-slate-400 font-medium">
                    {defaultQuickSession.concepts.reduce((acc, c) => acc + c.retrievalCards.length, 0)} cards • ~{defaultQuickSession.concepts.reduce((acc, c) => acc + (c.estimatedMinutes || 5), 0)}m
                  </span>
                </div>

                <h3 className="text-xl sm:text-2xl font-bold text-white font-display group-hover:text-indigo-200 transition-colors">
                  {defaultQuickSession.title}
                </h3>

                {/* Progress bar */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Memory retention &amp; mastery</span>
                    <span className="font-bold text-emerald-400">Active</span>
                  </div>
                  <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-white/[0.06]">
                    <div className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-500 rounded-full w-3/4" />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <button
                  onClick={() => {
                    if (onOpenDeckStation) onOpenDeckStation(defaultQuickSession);
                    else onStartSession(defaultQuickSession);
                  }}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 flex items-center gap-2 transition-all hover:scale-105 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Continue</span>
                </button>

                {onStartMatch && (
                  <button
                    onClick={() => onStartMatch(defaultQuickSession)}
                    className="px-4 py-3 rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-bold text-sm flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <Zap className="w-4 h-4 fill-amber-400 text-amber-400" />
                    <span>60s Match</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Study Modes (Quizlet Start Here / Games) */}
      <div className="space-y-3">
        <h2 className="text-base sm:text-lg font-bold text-white font-display">
          Study Modes
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Speed Match Arena (Quizlet) */}
          <div 
            onClick={() => {
              if (defaultQuickSession && onStartMatch) {
                onStartMatch(defaultQuickSession);
              }
            }}
            className="p-5 rounded-2xl glass-panel-interactive flex flex-col justify-between group cursor-pointer border-amber-500/20 hover:border-amber-500/50 hover:shadow-amber-500/10 space-y-3"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-sm">
                  <Zap className="w-5 h-5 fill-amber-400 text-amber-400" />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  60s Match
                </span>
              </div>
              <h3 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors font-display">
                Speed Match Arena
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Quizlet-style fast associative pairing under millisecond stopwatch pressure with combo multipliers.
              </p>
            </div>

            <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-xs text-amber-400 font-semibold group-hover:translate-x-0.5 transition-transform">
              <span>Play Match Arena</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>

          {/* FSRS Spaced Repetition (Anki) */}
          <div 
            onClick={onOpenDashboard}
            className="p-5 rounded-2xl glass-panel-interactive flex flex-col justify-between group cursor-pointer border-emerald-500/20 hover:border-emerald-500/50 hover:shadow-emerald-500/10 space-y-3"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-sm">
                  <Layers className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  FSRS Queue
                </span>
              </div>
              <h3 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors font-display">
                Daily Memory Review
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Mathematical memory scheduling with predictive stability chips (&lt;10m, +1.4d, +4.2d, +9.0d).
              </p>
            </div>

            <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-xs text-emerald-400 font-semibold group-hover:translate-x-0.5 transition-transform">
              <span>{dueCards.length} Cards Due</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>

          {/* Mock Exam Simulator (Metacognitive) */}
          <div 
            onClick={onOpenExam}
            className="p-5 rounded-2xl glass-panel-interactive flex flex-col justify-between group cursor-pointer border-indigo-500/20 hover:border-indigo-500/50 hover:shadow-indigo-500/10 space-y-3"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-sm">
                  <Award className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Diagnostic
                </span>
              </div>
              <h3 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors font-display">
                Mock Exam Arena
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Confidence-Weighted scoring (Bushman/Bruno formula). Uncover dangerous metacognitive blindspots.
              </p>
            </div>

            <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-xs text-indigo-400 font-semibold group-hover:translate-x-0.5 transition-transform">
              <span>Simulate Exam</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>

          {/* Cross-Deck Interleaving Arena (Dunlosky) */}
          <div 
            onClick={onOpenInterleaving}
            className="p-5 rounded-2xl glass-panel-interactive flex flex-col justify-between group cursor-pointer border-purple-500/20 hover:border-purple-500/50 hover:shadow-purple-500/10 space-y-3"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-sm">
                  <Shuffle className="w-5 h-5 text-purple-400" />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Dunlosky
                </span>
              </div>
              <h3 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors font-display">
                Interleaving Arena
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Cross-deck category mixing. Forces working memory to distinguish problem categories without habituation.
              </p>
            </div>

            <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-xs text-purple-400 font-semibold group-hover:translate-x-0.5 transition-transform">
              <span>Mix Decks</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* 4. Decks & Benchmarks Workspace */}
      <div className="space-y-5">
        
        {/* Workspace Sub-Header & Navigation Switcher */}
        <div className="p-4 sm:p-5 rounded-3xl glass-panel flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Segmented Tab Switcher */}
          <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-2xl border border-white/[0.08] text-xs self-start md:self-auto overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveLibraryTab('my-decks')}
              className={`px-3.5 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeLibraryTab === 'my-decks'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BookMarked className="w-3.5 h-3.5" />
              <span>My Decks ({savedSessions.length})</span>
            </button>

            <button
              onClick={() => setActiveLibraryTab('starred')}
              className={`px-3.5 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeLibraryTab === 'starred'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Star className="w-3.5 h-3.5 text-amber-400" />
              <span>Starred Focus ({starredCards.length})</span>
            </button>

            <button
              onClick={() => setActiveLibraryTab('curated')}
              className={`px-3.5 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeLibraryTab === 'curated'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Curated Benchmarks (6)</span>
            </button>
          </div>

          {/* Search & Studio Action Controls */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={deckSearch}
                onChange={(e) => setDeckSearch(e.target.value)}
                placeholder="Filter decks by title or tag..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-950/80 border border-white/[0.1] text-white text-xs outline-none focus:border-indigo-500"
              />
            </div>

            {/* Deck Studio Launcher */}
            <button
              onClick={() => {
                setEditingSession(null);
                setDeckStudioTab('create');
                setIsDeckStudioOpen(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-xs font-bold text-slate-200 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Deck</span>
            </button>

            {/* Open Fullscreen Catalog Modal */}
            <button
              onClick={() => setIsStarterCatalogModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Maximize2 className="w-3 h-3" />
              <span>Inspect All</span>
            </button>
          </div>
        </div>

        {/* Subject Folders Bar */}
        <div className="p-3.5 sm:p-4 rounded-3xl glass-panel space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Folder className="w-4 h-4 text-indigo-400" />
              <h3 className="text-xs font-bold text-white font-display uppercase tracking-wider">
                Subject Folders
              </h3>
              <span className="text-[11px] font-mono text-slate-400">
                ({folders.length})
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                setEditingFolder(null);
                setIsFolderModalOpen(true);
              }}
              className="px-2.5 py-1 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer hover:scale-105"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>New Subject</span>
            </button>
          </div>

          {/* Folder Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
            {/* All Decks chip */}
            <button
              type="button"
              onClick={() => setSelectedFolderId('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedFolderId === 'all'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-white/[0.06]'
              }`}
            >
              <span>📚</span>
              <span>All Decks</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/20 font-mono">
                {savedSessions.length}
              </span>
            </button>

            {/* Folders */}
            {folders.map((folder) => {
              const isSelected = selectedFolderId === folder.id;
              const folderDeckCount = savedSessions.filter(s => s.folderId === folder.id).length;
              const colDef = FOLDER_COLORS.find(c => c.id === folder.color) || FOLDER_COLORS[0];

              return (
                <div key={folder.id} className="relative group/folder flex items-center shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedFolderId(isSelected ? 'all' : folder.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 border ${
                      isSelected
                        ? `${colDef.bg} ${colDef.text} ${colDef.border} shadow-md ${colDef.glow} ring-1 ring-white/20`
                        : 'bg-slate-900/60 text-slate-300 hover:text-white hover:bg-slate-900 border-white/[0.06]'
                    }`}
                  >
                    <span>{folder.icon || '📁'}</span>
                    <span>{folder.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isSelected ? 'bg-black/30' : 'bg-white/[0.08] text-slate-400'
                    }`}>
                      {folderDeckCount}
                    </span>
                  </button>

                  {/* Quick Edit/Delete on Hover */}
                  <div className="opacity-0 group-hover/folder:opacity-100 transition-opacity flex items-center gap-0.5 ml-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingFolder(folder);
                        setIsFolderModalOpen(true);
                      }}
                      className="p-1 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-white/[0.08] transition-colors cursor-pointer"
                      title="Edit Subject Name / Theme"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete subject folder "${folder.name}"? Decks will remain safe in Uncategorized.`)) {
                          StorageService.deleteFolder(folder.id);
                          if (selectedFolderId === folder.id) setSelectedFolderId('all');
                          setFolders(StorageService.getFolders());
                          setSavedSessions(StorageService.getSessions());
                          soundEngine.playCompanionBubble();
                        }
                      }}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-white/[0.08] transition-colors cursor-pointer"
                      title="Delete Subject Folder"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Unassigned Pill */}
            {folders.length > 0 && (() => {
              const uncatCount = savedSessions.filter(s => !s.folderId).length;
              if (uncatCount === 0) return null;
              return (
                <button
                  type="button"
                  onClick={() => setSelectedFolderId(selectedFolderId === 'uncategorized' ? 'all' : 'uncategorized')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 border shrink-0 ${
                    selectedFolderId === 'uncategorized'
                      ? 'bg-slate-700 text-white border-white/20 shadow-md'
                      : 'bg-slate-900/60 text-slate-400 hover:text-slate-300 hover:bg-slate-900 border-white/[0.06]'
                  }`}
                >
                  <span>📂</span>
                  <span>Unassigned</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/[0.06] text-slate-400 font-mono">
                    {uncatCount}
                  </span>
                </button>
              );
            })()}
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 shrink-0 pl-1">
            <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
            <span>Category:</span>
          </div>
          {availableCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-indigo-600/30 text-indigo-200 border border-indigo-500/40 shadow-sm'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-white/[0.06]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Tab 1: My Decks Grid */}
        {activeLibraryTab === 'my-decks' && (
          <div>
            {filteredMyDecks.length === 0 ? (
              <div className="p-12 text-center rounded-3xl glass-panel space-y-3">
                <BookMarked className="w-10 h-10 text-slate-600 mx-auto" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-300 font-display">
                    {deckSearch 
                      ? 'No decks match your search query.' 
                      : selectedFolderId !== 'all' 
                        ? 'No decks in this subject folder yet.' 
                        : 'No custom study decks saved yet.'}
                  </p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    {selectedFolderId !== 'all' 
                      ? 'Use "Move to Subject" on any deck to organize it into this subject!' 
                      : 'Drop a lecture PDF above or explore one of the pre-calibrated Curated Benchmarks to start your learning portfolio!'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredMyDecks.map((deck) => {
                  const totalCards = deck.concepts.reduce((acc, c) => acc + c.retrievalCards.length, 0);
                  const totalMins = deck.concepts.reduce((acc, c) => acc + (c.estimatedMinutes || 5), 0);
                  const assignedFolder = folders.find(f => f.id === deck.folderId);
                  const folderColorDef = assignedFolder ? (FOLDER_COLORS.find(c => c.id === assignedFolder.color) || FOLDER_COLORS[0]) : null;

                  return (
                    <div
                      key={deck.id}
                      onClick={() => {
                        if (onOpenDeckStation) onOpenDeckStation(deck);
                        else onStartSession(deck);
                      }}
                      className="p-5 rounded-3xl glass-panel-interactive flex flex-col justify-between group space-y-4 cursor-pointer"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 uppercase tracking-wider truncate">
                              {deck.category}
                            </span>

                            {/* Subject Folder Chip on Deck Card */}
                            {assignedFolder && folderColorDef ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMoveToFolderSession(deck);
                                }}
                                className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${folderColorDef.bg} ${folderColorDef.text} border ${folderColorDef.border} flex items-center gap-1 hover:scale-105 transition-transform cursor-pointer truncate max-w-[140px]`}
                                title={`Subject: ${assignedFolder.name} — Click to move`}
                              >
                                <span>{assignedFolder.icon || '📁'}</span>
                                <span className="truncate">{assignedFolder.name}</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMoveToFolderSession(deck);
                                }}
                                className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-slate-200 border border-white/[0.06] flex items-center gap-1 transition-colors cursor-pointer"
                                title="Assign to Subject Folder"
                              >
                                <span>📁</span>
                                <span>+ Subject</span>
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMoveToFolderSession(deck);
                              }}
                              className="p-1.5 rounded-lg hover:bg-white/[0.08] text-slate-400 hover:text-indigo-300 transition-colors"
                              title="Organize into Subject Folder"
                            >
                              <FolderInput className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                ExportService.printStudySheet(deck);
                              }}
                              className="p-1.5 rounded-lg hover:bg-white/[0.08] text-slate-400 hover:text-indigo-300 transition-colors"
                              title="Print High-Yield Study Sheet"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                ExportService.downloadMarkdown(deck);
                              }}
                              className="p-1.5 rounded-lg hover:bg-white/[0.08] text-slate-400 hover:text-purple-300 transition-colors"
                              title="Export to Markdown"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingSession(deck);
                                setDeckStudioTab('create');
                                setIsDeckStudioOpen(true);
                              }}
                              className="p-1.5 rounded-lg hover:bg-white/[0.08] text-slate-400 hover:text-sky-300 transition-colors"
                              title="Edit in Deck Studio"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => handleExportSingleDeck(deck, e)}
                              className="p-1.5 rounded-lg hover:bg-white/[0.08] text-slate-400 hover:text-emerald-300 transition-colors"
                              title="Export to JSON"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => handleDeleteDeck(deck.id, e)}
                              className="p-1.5 rounded-lg hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 transition-colors"
                              title="Delete deck from library"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <h4 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-1 font-display">
                          {deck.title}
                        </h4>
                        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                          {deck.description}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-white/[0.06] space-y-3">
                        <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                          <span>{deck.concepts.length} Concepts • {totalCards} Cards</span>
                          <span className="flex items-center gap-1 text-slate-500 font-mono text-[11px]">
                            <Clock className="w-3 h-3" />
                            <span>~{totalMins}m</span>
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 pt-1">
                          {onStartMatch && totalCards >= 2 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onStartMatch(deck);
                              }}
                              className="p-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 text-xs font-semibold flex items-center justify-center transition-all cursor-pointer"
                              title="Speed Match Arena"
                            >
                              <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                            </button>
                          )}

                          {onStartAudioBriefing && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onStartAudioBriefing(deck);
                              }}
                              className="p-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 text-xs font-semibold flex items-center justify-center transition-all cursor-pointer"
                              title="AI Audio Briefing Overview"
                            >
                              <Headphones className="w-3.5 h-3.5 text-purple-400" />
                            </button>
                          )}

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onOpenDeckStation) onOpenDeckStation(deck);
                              else onStartSession(deck);
                            }}
                            className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-bold shadow-md shadow-indigo-600/30 flex items-center justify-center gap-1.5 transition-all group-hover:scale-[1.02] cursor-pointer"
                          >
                            <span>Study Modes</span>
                            <Play className="w-3 h-3 fill-white" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Starred Cards Focus */}
        {activeLibraryTab === 'starred' && (
          <div className="space-y-4">
            <div className="p-6 rounded-3xl glass-panel flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-center sm:text-left">
                <div className="flex items-center gap-2 justify-center sm:justify-start">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <h3 className="text-sm font-bold text-white font-display">
                    High-Priority Starred Drill ({starredCards.length} Cards)
                  </h3>
                </div>
                <p className="text-xs text-slate-400">
                  Cards you bookmarked during retrieval sessions for focused delibrate practice.
                </p>
              </div>

              {starredCards.length > 0 && (
                <button
                  onClick={handleLaunchAllStarred}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs shadow-lg shadow-amber-600/30 flex items-center gap-2 transition-all hover:scale-105 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Drill All Starred Cards Now</span>
                </button>
              )}
            </div>

            {starredCards.length === 0 ? (
              <div className="p-12 text-center rounded-3xl glass-panel space-y-2">
                <Star className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-sm font-bold text-slate-300">No starred cards yet.</p>
                <p className="text-xs text-slate-500">
                  Press &apos;S&apos; or tap the star icon during any active recall session to bookmark struggling cards here!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {starredCards.map((card) => (
                  <div key={card.id} className="p-4 rounded-2xl bg-slate-950/60 border border-white/[0.08] space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-amber-400 font-semibold uppercase">
                      <span>★ Bookmarked Item</span>
                      <span className="font-mono text-slate-500">{card.cardType || 'standard'}</span>
                    </div>
                    <div className="text-xs font-semibold text-white leading-relaxed">{card.question}</div>
                    <div className="text-xs text-slate-400 bg-white/[0.02] p-2 rounded-xl border border-white/[0.04]">
                      Answer: {card.answer}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Curated Benchmarks Grid */}
        {activeLibraryTab === 'curated' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredCuratedDecks.map((deck) => {
              const isImported = savedSessions.some(s => s.title === deck.title);
              const isJustImported = justImportedId === deck.id;

              return (
                <div
                  key={deck.id}
                  onClick={() => {
                    if (onOpenDeckStation) onOpenDeckStation(deck.session);
                    else onStartSession(deck.session);
                  }}
                  className="p-5 rounded-3xl glass-panel-interactive flex flex-col justify-between group space-y-4 cursor-pointer"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 bg-indigo-500/15 px-2.5 py-0.5 rounded-full border border-indigo-500/30">
                        {deck.category}
                      </span>

                      <div className="flex items-center gap-1">
                        {deck.hasImageOcclusion && (
                          <span className="text-[11px] font-semibold flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30" title="Image Occlusion Ready">
                            <Eye className="w-2.5 h-2.5" />
                            <span>Occlusion</span>
                          </span>
                        )}
                        {deck.hasSourcePdf && (
                          <span className="text-[11px] font-semibold flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30" title="PDF Grounded">
                            <FileText className="w-2.5 h-2.5" />
                            <span>Source</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <h4 className="text-sm font-bold text-white group-hover:text-indigo-200 transition-colors font-display line-clamp-2">
                      {deck.title}
                    </h4>

                    <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                      {deck.summary}
                    </p>

                    <div className="flex items-center gap-1 text-[11px] text-slate-500 pt-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span className="truncate">{deck.verifiedBy}</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/[0.06] space-y-2.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>{deck.conceptCount} Concepts • {deck.cardCount} Cards</span>
                      <span className="flex items-center gap-1 text-slate-500 font-medium">
                        <Clock className="w-3 h-3" />
                        <span>~{deck.estimatedMinutes}m</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const cloned = createClonedStarterSession(deck);
                          StorageService.saveSession(cloned);
                          StorageService.saveCards(cloned.concepts.flatMap(c => c.retrievalCards));
                          soundEngine.playSuccess();
                          setSavedSessions(StorageService.getSessions());
                          setJustImportedId(deck.id);
                          setTimeout(() => setJustImportedId(null), 3000);
                        }}
                        className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          isJustImported
                            ? 'bg-emerald-600 text-white'
                            : isImported
                            ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-950'
                            : 'bg-white/[0.06] hover:bg-white/[0.1] text-slate-300'
                        }`}
                      >
                        {isJustImported ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Imported</span>
                          </>
                        ) : isImported ? (
                          <>
                            <BookmarkCheck className="w-3.5 h-3.5" />
                            <span>In Library</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-3.5 h-3.5" />
                            <span>Import</span>
                          </>
                        )}
                      </button>

                      {onStartMatch && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onStartMatch(deck.session);
                          }}
                          className="p-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 text-xs font-semibold flex items-center justify-center transition-all cursor-pointer"
                          title="Speed Match Arena"
                        >
                          <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                        </button>
                      )}

                      {onStartAudioBriefing && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onStartAudioBriefing(deck.session);
                          }}
                          className="p-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 text-xs font-semibold flex items-center justify-center transition-all cursor-pointer"
                          title="AI Audio Briefing Overview"
                        >
                          <Headphones className="w-3.5 h-3.5 text-purple-400" />
                        </button>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onOpenDeckStation) onOpenDeckStation(deck.session);
                          else onStartSession(deck.session);
                        }}
                        className="flex-1 py-2 px-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-bold shadow-md shadow-indigo-600/30 flex items-center justify-center gap-1.5 transition-all group-hover:scale-[1.02] cursor-pointer"
                      >
                        <span>Study</span>
                        <Play className="w-3 h-3 fill-white" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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

export default IngestionHub;
