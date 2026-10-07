import React, { useState } from 'react';
import { 
  Play, 
  Star, 
  Sparkles, 
  Layers, 
  X, 
  Clock, 
  ShieldCheck, 
  Zap, 
  Headphones, 
  FileText, 
  Search, 
  Printer, 
  Download, 
  Edit3, 
  ArrowRight,
  Eye,
  ChevronDown,
  ChevronUp,
  Share2,
  FileJson
} from 'lucide-react';
import type { StudySession, RetrievalCard, SubjectFolder } from '../../types';
import { StorageService } from '../../services/storageService';
import { ExportService } from '../../services/exportService';
import { soundEngine } from '../../services/soundEngine';
import { MoveToFolderModal } from './MoveToFolderModal';
import { SubjectFolderModal } from './SubjectFolderModal';
import { FOLDER_COLORS } from './folderOptions';
import { fillCloze } from '../../utils/cloze';

interface DeckStationModalProps {
  isOpen: boolean;
  session: StudySession | null;
  onClose: () => void;
  onStartPilot: (session: StudySession) => void;
  onStartMatch: (session: StudySession) => void;
  onStartFlashcardsOnly: (session: StudySession) => void;
  onStartAudioBriefing: (session: StudySession) => void;
  onEditInStudio: (session: StudySession) => void;
}

function createStarredSession(session: StudySession, starredOnlyCards: RetrievalCard[]): StudySession {
  return {
    ...session,
    id: `${session.id}-starred-${Date.now()}`,
    title: `${session.title} (Starred Cards)`,
    concepts: [
      {
        id: 'starred-concept',
        order: 1,
        title: 'High-Priority Starred Drill',
        estimatedMinutes: Math.max(5, starredOnlyCards.length * 2),
        mentalModel: 'Focused active retrieval targeted specifically at bookmarked cards.',
        coreTakeaways: ['High-yield targeted practice on prior struggles.'],
        keyTerms: [],
        feynmanPrompt: 'Explain how focused repetition on starred cards cures memory interference.',
        sampleMasteryExplanation: 'Targeted retrieval on tagged items reduces error density.',
        retrievalCards: starredOnlyCards,
      }
    ]
  };
}

export const DeckStationModal: React.FC<DeckStationModalProps> = ({
  isOpen,
  session,
  onClose,
  onStartPilot,
  onStartMatch,
  onStartFlashcardsOnly,
  onStartAudioBriefing,
  onEditInStudio,
}) => {
  const [activeTab, setActiveTab] = useState<'modes' | 'cards'>('modes');
  const [cardSearch, setCardSearch] = useState('');
  const [cardFilter, setCardFilter] = useState<'all' | 'starred' | 'image-occlusion' | 'cloze'>('all');
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(session?.folderId);
  const [folders, setFolders] = useState<SubjectFolder[]>(() => StorageService.getFolders());
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);

  // Re-sync folder state when a different deck is opened (adjusting state during render).
  const [folderStateFor, setFolderStateFor] = useState(session);
  if (folderStateFor !== session) {
    setFolderStateFor(session);
    setCurrentFolderId(session?.folderId);
    setFolders(StorageService.getFolders());
  }
  const [starredCardIds, setStarredCardIds] = useState<Set<string>>(() => {
    if (!session) return new Set();
    const starred = session.concepts.flatMap(c => c.retrievalCards).filter(rc => rc.isStarred).map(rc => rc.id);
    return new Set(starred);
  });

  if (!isOpen || !session) return null;

  const allCards: RetrievalCard[] = session.concepts.flatMap(c => c.retrievalCards);
  const starredCount = starredCardIds.size;
  const masteredCount = allCards.filter(c => c.stability >= 21).length;
  const learningCount = allCards.filter(c => c.stability < 21 && c.reps > 0).length;
  const newCount = allCards.filter(c => c.reps === 0).length;

  const handleToggleStar = (cardId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = StorageService.toggleCardStar(cardId);
    setStarredCardIds(prev => {
      const next = new Set(prev);
      if (newStatus) next.add(cardId);
      else next.delete(cardId);
      return next;
    });
    soundEngine.playSuccess();
  };

  const filteredCards = allCards.filter(card => {
    const matchesSearch = 
      card.question.toLowerCase().includes(cardSearch.toLowerCase()) ||
      card.answer.toLowerCase().includes(cardSearch.toLowerCase());

    const isStarred = starredCardIds.has(card.id);
    if (cardFilter === 'starred' && !isStarred) return false;
    if (cardFilter === 'image-occlusion' && card.cardType !== 'image-occlusion') return false;
    if (cardFilter === 'cloze' && card.cardType !== 'cloze') return false;

    return matchesSearch;
  });

  const handleLaunchStarredOnly = () => {
    const starredOnlyCards = allCards.filter(c => starredCardIds.has(c.id));
    if (starredOnlyCards.length === 0) return;

    const starredSession = createStarredSession(session, starredOnlyCards);
    onClose();
    onStartPilot(starredSession);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-fade-in text-slate-100">
      <div 
        className="w-full max-w-4xl max-h-[92vh] bg-slate-900 border border-white/[0.12] rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Hero Banner */}
        <div className="p-6 border-b border-white/[0.08] bg-slate-950/70 shrink-0 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase tracking-wider">
                  {session.category || 'General Curriculum'}
                </span>

                {/* Subject Folder Badge */}
                {(() => {
                  const folder = folders.find(f => f.id === currentFolderId);
                  if (folder) {
                    const colDef = FOLDER_COLORS.find(c => c.id === folder.color) || FOLDER_COLORS[0];
                    return (
                      <button
                        type="button"
                        onClick={() => setIsMoveModalOpen(true)}
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${colDef.bg} ${colDef.text} border ${colDef.border} flex items-center gap-1 hover:scale-105 transition-transform cursor-pointer`}
                        title="Subject Folder — Click to change or reassign"
                      >
                        <span>{folder.icon || '📁'}</span>
                        <span>{folder.name}</span>
                      </button>
                    );
                  }
                  return (
                    <button
                      type="button"
                      onClick={() => setIsMoveModalOpen(true)}
                      className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-slate-400 hover:text-slate-200 border border-white/[0.08] flex items-center gap-1 transition-colors cursor-pointer"
                      title="Organize deck into a Subject Folder"
                    >
                      <span>📁</span>
                      <span>+ Subject Folder</span>
                    </button>
                  );
                })()}

                {session.sourceDocument && (
                  <span className="text-[11px] font-semibold flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30">
                    <FileText className="w-3 h-3 text-sky-400" />
                    <span>PDF Grounded</span>
                  </span>
                )}
                {starredCount > 0 && (
                  <span className="text-[11px] font-semibold flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    <span>{starredCount} Starred</span>
                  </span>
                )}
              </div>

              <h2 className="text-xl font-bold text-white font-display">
                {session.title}
              </h2>

              <p className="text-xs text-slate-400 line-clamp-2 max-w-2xl leading-relaxed">
                {session.description}
              </p>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Stats Bar (Anki & Quizlet Style) */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/[0.06] text-xs text-slate-400">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                <strong className="text-white">{session.concepts.length}</strong> Concepts
              </span>
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <strong className="text-white">{allCards.length}</strong> Cards
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                ~{session.concepts.reduce((a, b) => a + (b.estimatedMinutes || 10), 0)}m
              </span>
            </div>

            {/* FSRS Mastery Status Pills */}
            <div className="flex items-center gap-1.5 font-mono text-[11px]">
              <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" title="Stability >= 21 days">
                {masteredCount} Mastered
              </span>
              <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30" title="Actively being learned">
                {learningCount} Learning
              </span>
              <span className="px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30" title="Unreviewed cards">
                {newCount} New
              </span>
            </div>
          </div>
        </div>

        {/* Tab Switcher (Study Modes vs Card Syllabus) */}
        <div className="px-6 py-2 border-b border-white/[0.06] bg-slate-950/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('modes')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'modes'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              Study Launchpad
            </button>
            <button
              onClick={() => setActiveTab('cards')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'cards'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              Card Syllabus ({allCards.length})
            </button>
          </div>

          <div className="flex items-center gap-1 text-xs">
            <button
              onClick={() => ExportService.printStudySheet(session)}
              className="p-1.5 rounded-lg hover:bg-white/[0.08] text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Print High-Yield Study Sheet"
            >
              <Printer className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => ExportService.downloadMarkdown(session)}
              className="p-1.5 rounded-lg hover:bg-white/[0.08] text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Export to Markdown (.md)"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => ExportService.downloadAnkiTSV(session)}
              className="p-1.5 rounded-lg hover:bg-white/[0.08] text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer"
              title="Export to Anki / Quizlet (.tsv)"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => ExportService.downloadJSON(session)}
              className="p-1.5 rounded-lg hover:bg-white/[0.08] text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
              title="Export Full Deck Backup (.json)"
            >
              <FileJson className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                onClose();
                onEditInStudio(session);
              }}
              className="p-1.5 rounded-lg hover:bg-white/[0.08] text-slate-400 hover:text-sky-300 transition-colors cursor-pointer"
              title="Edit in Deck Studio"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Tab 1: Study Modes Launchpad */}
        {activeTab === 'modes' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Mode 1: Frontier Study Pilot (4-Phase Cognitive Cycle) */}
              <div 
                onClick={() => {
                  onClose();
                  onStartPilot(session);
                }}
                className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-slate-950/60 to-purple-950/40 border border-indigo-500/30 hover:border-indigo-400 transition-all cursor-pointer group shadow-lg shadow-indigo-950/20 hover:scale-[1.01]"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 group-hover:scale-105 transition-transform">
                    <Play className="w-5 h-5 fill-white ml-0.5" />
                  </div>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase">
                    Recommended
                  </span>
                </div>

                <h3 className="text-base font-bold text-white group-hover:text-indigo-200 transition-colors font-display">
                  Full Cognitive Study Pilot
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  The complete 4-phase science-backed loop: Schema Priming, Socratic Oral Viva, Active Retrieval, and Rest Break.
                </p>

                <div className="pt-4 border-t border-white/[0.06] mt-4 flex items-center justify-between text-xs font-semibold text-indigo-400">
                  <span>Start 4-Phase Cycle</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              {/* Mode 2: Speed Match Challenge (Quizlet Style) */}
              <div 
                onClick={() => {
                  onClose();
                  onStartMatch(session);
                }}
                className="p-5 rounded-2xl bg-slate-950/60 border border-white/[0.08] hover:border-amber-500/40 hover:bg-slate-950/80 transition-all cursor-pointer group hover:scale-[1.01]"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-orange-500 text-white flex items-center justify-center shadow-lg shadow-amber-600/30 group-hover:scale-105 transition-transform">
                    <Zap className="w-5 h-5 fill-white" />
                  </div>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 uppercase">
                    Gamified Speed
                  </span>
                </div>

                <h3 className="text-base font-bold text-white group-hover:text-amber-200 transition-colors font-display">
                  Speed Match Arena
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Fast-paced 60-second association game: Match terms with definitions against the stopwatch for quick retrieval warm-up.
                </p>

                <div className="pt-4 border-t border-white/[0.06] mt-4 flex items-center justify-between text-xs font-semibold text-amber-400">
                  <span>Enter Match Arena</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              {/* Mode 3: Rapid Casual Flashcards (Anki Style) */}
              <div 
                onClick={() => {
                  onClose();
                  onStartFlashcardsOnly(session);
                }}
                className="p-5 rounded-2xl bg-slate-950/60 border border-white/[0.08] hover:border-purple-500/40 hover:bg-slate-950/80 transition-all cursor-pointer group hover:scale-[1.01]"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-lg shadow-purple-600/30 group-hover:scale-105 transition-transform">
                    <Layers className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30 uppercase">
                    Anki Style
                  </span>
                </div>

                <h3 className="text-base font-bold text-white group-hover:text-purple-200 transition-colors font-display">
                  Casual Flashcard Runner
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Straight-to-the-point card review: 3D Flip with Spacebar, 1-4 FSRS rating buttons, and Gamepad / Mobile swipe support.
                </p>

                <div className="pt-4 border-t border-white/[0.06] mt-4 flex items-center justify-between text-xs font-semibold text-purple-400">
                  <span>Start Card Review</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              {/* Mode 4: Audio Overview Briefing (NotebookLM Style) */}
              <div 
                onClick={() => {
                  onClose();
                  onStartAudioBriefing(session);
                }}
                className="p-5 rounded-2xl bg-slate-950/60 border border-white/[0.08] hover:border-sky-500/40 hover:bg-slate-950/80 transition-all cursor-pointer group hover:scale-[1.01]"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-lg shadow-sky-600/30 group-hover:scale-105 transition-transform">
                    <Headphones className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30 uppercase">
                    NotebookLM Style
                  </span>
                </div>

                <h3 className="text-base font-bold text-white group-hover:text-sky-200 transition-colors font-display">
                  Narrated Audio Overview
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Listen to a spoken podcast-style overview of concepts, key takeaways, and mental models with chapter scrubbing.
                </p>

                <div className="pt-4 border-t border-white/[0.06] mt-4 flex items-center justify-between text-xs font-semibold text-sky-400">
                  <span>Listen to Briefing</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

            </div>

            {/* High-Priority Starred Drill Banner */}
            {starredCount > 0 && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                    <Star className="w-5 h-5 fill-amber-400" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Targeted Practice: {starredCount} Bookmarked Cards</h4>
                    <p className="text-[11px] text-amber-200/80">Drill only the tricky cards you flagged during previous reviews.</p>
                  </div>
                </div>

                <button
                  onClick={handleLaunchStarredOnly}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <span>Drill Starred Cards</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Card Syllabus & Starred Inspection */}
        {activeTab === 'cards' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Filter & Search Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between pb-3 border-b border-white/[0.06]">
              <div className="relative w-full sm:w-72">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={cardSearch}
                  onChange={(e) => setCardSearch(e.target.value)}
                  placeholder="Search cards in this deck..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-950/80 border border-white/[0.08] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto text-xs">
                <button
                  onClick={() => setCardFilter('all')}
                  className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                    cardFilter === 'all'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 bg-white/[0.04] hover:text-white'
                  }`}
                >
                  All ({allCards.length})
                </button>
                <button
                  onClick={() => setCardFilter('starred')}
                  className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
                    cardFilter === 'starred'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'text-slate-400 bg-white/[0.04] hover:text-white'
                  }`}
                >
                  <Star className="w-3 h-3 fill-amber-400" />
                  <span>Starred ({starredCount})</span>
                </button>
                <button
                  onClick={() => setCardFilter('image-occlusion')}
                  className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                    cardFilter === 'image-occlusion'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 bg-white/[0.04] hover:text-white'
                  }`}
                >
                  Occlusion
                </button>
                <button
                  onClick={() => setCardFilter('cloze')}
                  className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                    cardFilter === 'cloze'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 bg-white/[0.04] hover:text-white'
                  }`}
                >
                  Cloze
                </button>
              </div>
            </div>

            {/* Cards List */}
            <div className="space-y-2.5">
              {filteredCards.length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-500">
                  No flashcards match your current filter.
                </div>
              ) : (
                filteredCards.map((card, idx) => {
                  const isStarred = starredCardIds.has(card.id);
                  const isExpanded = expandedCardId === card.id;

                  return (
                    <div
                      key={card.id}
                      onClick={() => setExpandedCardId(isExpanded ? null : card.id)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer select-none space-y-2 ${
                        isExpanded
                          ? 'bg-slate-950/90 border-indigo-500/40'
                          : 'bg-slate-950/50 border-white/[0.06] hover:bg-slate-950/80 hover:border-white/[0.12]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono text-slate-500">
                            #{idx + 1}
                          </span>
                          <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded bg-white/[0.06] text-slate-300">
                            {card.cardType || 'standard'}
                          </span>
                          {card.cardType === 'image-occlusion' && (
                            <span className="text-[11px] font-bold flex items-center gap-1 text-amber-400">
                              <Eye className="w-3 h-3" />
                              <span>{card.masks?.length} Masks</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => handleToggleStar(card.id, e)}
                            className="p-1 rounded-lg hover:bg-white/[0.1] text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
                            title={isStarred ? 'Unstar card' : 'Star card for priority review'}
                          >
                            <Star className={`w-4 h-4 ${isStarred ? 'fill-amber-400 text-amber-400' : ''}`} />
                          </button>

                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </div>

                      <div className="text-xs font-semibold text-white">
                        {fillCloze(card.question)}
                      </div>

                      {isExpanded && (
                        <div className="pt-2 border-t border-white/[0.06] space-y-2 text-xs animate-fadeIn">
                          <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-emerald-200">
                            <span className="text-[11px] uppercase font-bold text-emerald-400 block mb-0.5">Answer</span>
                            {card.answer}
                          </div>

                          {card.explanation && (
                            <div className="text-[11px] text-slate-400 bg-white/[0.02] p-2.5 rounded-lg border border-white/[0.04]">
                              <strong>Rationale:</strong> {card.explanation}
                            </div>
                          )}

                          <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-1">
                            <span>Stability: {card.stability.toFixed(1)}d</span>
                            <span>Difficulty: {card.difficulty.toFixed(1)}/10</span>
                            <span>Reps: {card.reps} ({card.lapses} lapses)</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="p-4 px-6 border-t border-white/[0.08] bg-slate-950/80 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Empirical FSRS scheduling &amp; local-first privacy.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={() => {
                onClose();
                onStartPilot(session);
              }}
              className="px-5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>Study Now</span>
              <Play className="w-3.5 h-3.5 fill-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Move to Folder Modal */}
      {isMoveModalOpen && (
        <MoveToFolderModal
          isOpen={isMoveModalOpen}
          session={{ ...session, folderId: currentFolderId }}
          onClose={() => setIsMoveModalOpen(false)}
          onMoved={(updated) => {
            setCurrentFolderId(updated.folderId);
          }}
          onOpenNewFolderModal={() => {
            setIsMoveModalOpen(false);
            setIsFolderModalOpen(true);
          }}
        />
      )}

      {/* Subject Folder Creation Modal */}
      {isFolderModalOpen && (
        <SubjectFolderModal
          isOpen={isFolderModalOpen}
          onClose={() => setIsFolderModalOpen(false)}
          onFolderSaved={(newFolder) => {
            setFolders(StorageService.getFolders());
            StorageService.setDeckFolder(session.id, newFolder.id);
            setCurrentFolderId(newFolder.id);
          }}
        />
      )}
    </div>
  );
};
