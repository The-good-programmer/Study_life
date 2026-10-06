import React, { useState, useEffect, useMemo } from 'react';
import { 
  Folder, 
  FolderPlus, 
  ArrowLeft, 
  Search, 
  Play, 
  Edit3, 
  Trash2, 
  Plus, 
  BookOpen, 
  Layers, 
  Shuffle, 
  FolderInput,
  FolderMinus,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import type { StudySession, SubjectFolder } from '../../types';
import { StorageService } from '../../services/storageService';
import { soundEngine } from '../../services/soundEngine';
import { SubjectFolderModal, FOLDER_COLORS } from '../studio/SubjectFolderModal';
import { MoveToFolderModal } from '../studio/MoveToFolderModal';

interface FoldersPageProps {
  onBack?: () => void;
  onStartSession: (session: StudySession) => void;
  onOpenDeckStation: (session: StudySession) => void;
  onOpenDeckStudio: () => void;
  onStartMatch?: (session: StudySession) => void;
  onOpenInterleaving?: () => void;
}

const QUICK_PRESET_SUBJECTS = [
  { name: 'Biology & Medicine', icon: '🧬', color: 'emerald', description: 'Cellular biology, human physiology, and medical sciences' },
  { name: 'Psychology & Neuroscience', icon: '🧠', color: 'purple', description: 'Cognitive science, neural pathways, and behavioral models' },
  { name: 'Calculus & Mathematics', icon: '📐', color: 'blue', description: 'Calculus, linear algebra, formulas, and proofs' },
  { name: 'Computer Science', icon: '💻', color: 'cyan', description: 'Data structures, algorithms, and system design' },
  { name: 'World History', icon: '🏛️', color: 'amber', description: 'Historical epochs, civilizations, and critical treaties' },
  { name: 'Physics & Chemistry', icon: '⚛️', color: 'rose', description: 'Thermodynamics, quantum mechanics, and chemical reactions' },
];

export const FoldersPage: React.FC<FoldersPageProps> = ({
  onBack,
  onStartSession,
  onOpenDeckStation,
  onOpenDeckStudio,
  onOpenInterleaving,
}) => {
  const [folders, setFolders] = useState<SubjectFolder[]>(() => StorageService.getFolders());
  const [savedSessions, setSavedSessions] = useState<StudySession[]>(() => StorageService.getSessions());
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<SubjectFolder | null>(null);
  const [movingSession, setMovingSession] = useState<StudySession | null>(null);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [isAddDecksDrawerOpen, setIsAddDecksDrawerOpen] = useState(false);

  useEffect(() => {
    const unsub = StorageService.addMutationListener(() => {
      setFolders(StorageService.getFolders());
      setSavedSessions(StorageService.getSessions());
    });
    return unsub;
  }, []);

  const dueCards = useMemo(() => StorageService.getDueCards(), [savedSessions]);

  // Derived metrics
  const organizedDecksCount = useMemo(() => {
    return savedSessions.filter(s => Boolean(s.folderId)).length;
  }, [savedSessions]);

  const unassignedSessions = useMemo(() => {
    return savedSessions.filter(s => !s.folderId);
  }, [savedSessions]);

  const totalCardsInFolders = useMemo(() => {
    return savedSessions
      .filter(s => Boolean(s.folderId))
      .reduce((acc, s) => acc + (s.concepts?.reduce((cAcc, c) => cAcc + (c.retrievalCards?.length || 0), 0) || 0), 0);
  }, [savedSessions]);

  // Selected folder object
  const activeFolder = useMemo(() => {
    if (!selectedFolderId) return null;
    return folders.find(f => f.id === selectedFolderId) || null;
  }, [selectedFolderId, folders]);

  // Decks inside active folder
  const activeFolderDecks = useMemo(() => {
    if (!activeFolder) return [];
    return savedSessions.filter(s => s.folderId === activeFolder.id);
  }, [activeFolder, savedSessions]);

  // Filtered folders for grid view
  const filteredFolders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return folders;
    return folders.filter(f => {
      const matchName = f.name.toLowerCase().includes(q);
      const matchDesc = f.description?.toLowerCase().includes(q);
      const matchDeck = savedSessions.some(s => s.folderId === f.id && s.title.toLowerCase().includes(q));
      return matchName || matchDesc || matchDeck;
    });
  }, [folders, searchQuery, savedSessions]);

  // Quick preset creator
  const handleCreatePresetFolder = (preset: typeof QUICK_PRESET_SUBJECTS[0]) => {
    try {
      StorageService.createFolder(preset.name, preset.color, preset.icon, preset.description);
      soundEngine.playSuccess();
      setFolders(StorageService.getFolders());
    } catch {
      // ignore
    }
  };

  const handleDeleteFolder = (folderId: string, folderName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (window.confirm(`Delete subject folder "${folderName}"? All decks inside will remain safe in your library.`)) {
      StorageService.deleteFolder(folderId);
      soundEngine.playAxolotlBubble();
      if (selectedFolderId === folderId) {
        setSelectedFolderId(null);
      }
      setFolders(StorageService.getFolders());
      setSavedSessions(StorageService.getSessions());
    }
  };

  const handleStudyFolder = (folderId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const folderDecks = savedSessions.filter(s => s.folderId === folderId);
    if (folderDecks.length === 0) return;
    
    // Pick the deck with the most due cards, or first deck
    const withDue = folderDecks.find(s => 
      s.concepts?.some(c => c.retrievalCards?.some(rc => dueCards.some(dc => dc.id === rc.id)))
    );
    const targetSession = withDue || folderDecks[0];
    soundEngine.playContextShiftSound();
    onStartSession(targetSession);
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 sm:space-y-8 animate-fadeIn pb-16">
      
      {/* --- TOP NAVIGATION & HEADER --- */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {onBack && (
              <button
                type="button"
                onClick={() => {
                  if (selectedFolderId) {
                    setSelectedFolderId(null);
                  } else {
                    onBack();
                  }
                }}
                className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-white border border-white/[0.08] transition-colors cursor-pointer"
                title={selectedFolderId ? "Back to All Subjects" : "Back to Home"}
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xl">📁</span>
                <h1 className="text-xl sm:text-2xl font-black text-white font-display tracking-tight">
                  {activeFolder ? activeFolder.name : 'Subject Folders'}
                </h1>
                {activeFolder && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono font-bold border border-indigo-500/30">
                    Subject View
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                {activeFolder
                  ? (activeFolder.description || 'All study decks gathered under this subject curriculum.')
                  : 'Organize your decks by academic subject, track curriculum coverage, and study related topics together.'}
              </p>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-2 shrink-0">
            {activeFolder ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsAddDecksDrawerOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 text-xs font-bold border border-white/[0.08] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Decks</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingFolder(activeFolder);
                    setIsFolderModalOpen(true);
                  }}
                  className="px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-slate-300 hover:text-white text-xs font-semibold border border-white/[0.08] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Subject</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onOpenDeckStudio}
                  className="px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-slate-300 hover:text-white text-xs font-semibold border border-white/[0.08] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Deck</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingFolder(null);
                    setIsFolderModalOpen(true);
                  }}
                  className="btn-tactile btn-tactile-primary px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/25"
                >
                  <FolderPlus className="w-4 h-4" />
                  <span>+ New Subject</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* --- STATS HUD STRIP --- */}
        {!activeFolder && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.07] backdrop-blur-xl space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5 text-indigo-400" />
                Subjects
              </span>
              <div className="text-xl sm:text-2xl font-black text-white font-display">
                {folders.length}
              </div>
              <p className="text-[11px] text-slate-500 font-mono">Total folders</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.07] backdrop-blur-xl space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                Organized
              </span>
              <div className="text-xl sm:text-2xl font-black text-emerald-400 font-display">
                {organizedDecksCount} <span className="text-xs text-slate-400 font-normal">/ {savedSessions.length}</span>
              </div>
              <p className="text-[11px] text-slate-500 font-mono">Decks in subjects</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.07] backdrop-blur-xl space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                Total Cards
              </span>
              <div className="text-xl sm:text-2xl font-black text-purple-300 font-display">
                {totalCardsInFolders}
              </div>
              <p className="text-[11px] text-slate-500 font-mono">Subject flashcards</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.07] backdrop-blur-xl space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <FolderMinus className="w-3.5 h-3.5 text-amber-400" />
                Unassigned
              </span>
              <div className="text-xl sm:text-2xl font-black text-amber-300 font-display">
                {unassignedSessions.length}
              </div>
              <p className="text-[11px] text-slate-500 font-mono">Decks without subject</p>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODE 1: SINGLE SUBJECT DETAIL DRILL-DOWN VIEW                             */}
      {/* ========================================================================= */}
      {activeFolder ? (
        <div className="space-y-6">
          {/* Active Folder Hero Banner */}
          {(() => {
            const colDef = FOLDER_COLORS.find(c => c.id === activeFolder.color) || FOLDER_COLORS[0];
            const totalSubjectCards = activeFolderDecks.reduce((acc, s) => 
              acc + (s.concepts?.reduce((cAcc, c) => cAcc + (c.retrievalCards?.length || 0), 0) || 0), 0
            );
            const totalDueInSubject = activeFolderDecks.reduce((acc, s) => {
              const deckDue = s.concepts?.flatMap(c => c.retrievalCards || []).filter(rc => dueCards.some(dc => dc.id === rc.id)).length || 0;
              return acc + deckDue;
            }, 0);

            return (
              <div className={`p-6 sm:p-8 rounded-3xl border ${colDef.bg} ${colDef.border} shadow-xl relative overflow-hidden backdrop-blur-xl space-y-5`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-black/30 border border-white/10 flex items-center justify-center text-3xl shadow-inner shrink-0">
                      {activeFolder.icon || '📁'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h2 className="text-2xl sm:text-3xl font-black text-white font-display">
                          {activeFolder.name}
                        </h2>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${colDef.text} bg-black/20 border border-white/10`}>
                          {activeFolderDecks.length} {activeFolderDecks.length === 1 ? 'Deck' : 'Decks'}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
                        {activeFolder.description || 'Subject folder gathering related decks for unified study and retention.'}
                      </p>
                    </div>
                  </div>

                  {/* Primary Study Trigger */}
                  {activeFolderDecks.length > 0 && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStudyFolder(activeFolder.id)}
                        className="btn-tactile btn-tactile-primary px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer shadow-xl shadow-indigo-600/30"
                      >
                        <Play className="w-4 h-4 fill-white" />
                        <span>Study Subject Decks</span>
                      </button>

                      {onOpenInterleaving && activeFolderDecks.length >= 2 && (
                        <button
                          type="button"
                          onClick={onOpenInterleaving}
                          className="px-4 py-3 rounded-2xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                          title="Practice mixed retrieval across this subject's decks"
                        >
                          <Shuffle className="w-4 h-4" />
                          <span>Mix Decks</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Subject Quick Stats Bar */}
                <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-white/[0.08] text-xs font-mono text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">Total Cards:</span>
                    <span className="font-bold text-white">{totalSubjectCards}</span>
                  </div>
                  <span>•</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">Cards Due:</span>
                    <span className={totalDueInSubject > 0 ? "font-bold text-pink-400" : "font-bold text-emerald-400"}>
                      {totalDueInSubject}
                    </span>
                  </div>
                  <span>•</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">Created:</span>
                    <span>{new Date(activeFolder.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Decks in this Subject */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white font-display flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                <span>Decks in this Subject ({activeFolderDecks.length})</span>
              </h3>
              
              <button
                type="button"
                onClick={() => setIsAddDecksDrawerOpen(true)}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add another deck</span>
              </button>
            </div>

            {activeFolderDecks.length === 0 ? (
              <div className="p-10 rounded-3xl bg-white/[0.02] border border-dashed border-white/[0.1] text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center mx-auto text-xl">
                  {activeFolder.icon || '📁'}
                </div>
                <div>
                  <h4 className="text-base font-bold text-white">This subject folder is currently empty</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                    Add existing decks from your library into this subject, or create a brand new deck directly inside it.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddDecksDrawerOpen(true)}
                    className="btn-tactile btn-tactile-primary py-2.5 px-5 rounded-xl font-bold text-xs cursor-pointer"
                  >
                    Add Existing Decks
                  </button>
                  <button
                    type="button"
                    onClick={onOpenDeckStudio}
                    className="py-2.5 px-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white font-semibold text-xs transition-colors cursor-pointer"
                  >
                    Create New Deck
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeFolderDecks.map(session => {
                  const totalCards = session.concepts?.reduce((acc, c) => acc + (c.retrievalCards?.length || 0), 0) || 0;
                  const deckDueCount = session.concepts?.flatMap(c => c.retrievalCards || []).filter(rc => dueCards.some(dc => dc.id === rc.id)).length || 0;

                  return (
                    <div 
                      key={session.id}
                      className="p-5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] hover:border-indigo-500/40 transition-all flex flex-col justify-between space-y-4 group"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/[0.06] text-slate-300 border border-white/[0.06]">
                            {session.category || 'General'}
                          </span>
                          {deckDueCount > 0 ? (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30 font-mono">
                              {deckDueCount} due
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                              ✓ Up to date
                            </span>
                          )}
                        </div>

                        <h4 className="text-base font-bold text-white group-hover:text-indigo-200 transition-colors line-clamp-1">
                          {session.title}
                        </h4>
                        
                        <p className="text-xs text-slate-400">
                          {session.concepts?.length || 0} Concept Units • {totalCards} Flashcards
                        </p>
                      </div>

                      <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onStartSession(session)}
                            className="btn-tactile btn-tactile-primary py-1.5 px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5 fill-white" />
                            <span>Study</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenDeckStation(session)}
                            className="py-1.5 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
                          >
                            Details
                          </button>
                        </div>

                        {/* Move / Remove from folder */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setMovingSession(session);
                              setIsMoveModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-white/[0.08] transition-colors cursor-pointer"
                            title="Move to another Subject"
                          >
                            <FolderInput className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Remove "${session.title}" from ${activeFolder.name}? The deck will remain safe in Unassigned.`)) {
                                StorageService.setDeckFolder(session.id, null);
                                soundEngine.playAxolotlBubble();
                                setSavedSessions(StorageService.getSessions());
                              }
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-white/[0.08] transition-colors cursor-pointer"
                            title="Remove from Subject"
                          >
                            <FolderMinus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* MODE 2: ALL SUBJECT FOLDERS GRID VIEW                                     */
        /* ========================================================================= */
        <div className="space-y-8">
          
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search subject folders or decks..."
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] focus:border-indigo-500 text-white text-xs sm:text-sm outline-none placeholder:text-slate-500 transition-all"
              />
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
              <span>Showing {filteredFolders.length} {filteredFolders.length === 1 ? 'subject' : 'subjects'}</span>
            </div>
          </div>

          {/* Subject Folders Grid */}
          {folders.length === 0 ? (
            /* --- EMPTY STATE WITH 1-CLICK SUBJECT PRESETS --- */
            <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-br from-indigo-950/20 via-slate-900/60 to-purple-950/20 border border-white/[0.08] text-center space-y-6">
              <div className="w-16 h-16 rounded-3xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-3xl mx-auto shadow-xl">
                📚
              </div>
              <div className="max-w-md mx-auto space-y-2">
                <h3 className="text-lg sm:text-xl font-black text-white font-display">
                  No Subject Folders Yet
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                  Subject folders help you organize your study library into distinct academic disciplines. Create one from scratch or tap a preset below to get started in 1 click!
                </p>
              </div>

              {/* 1-Click Instant Presets */}
              <div className="space-y-3 pt-2 max-w-2xl mx-auto">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Popular Academic Disciplines (Tap to create):</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {QUICK_PRESET_SUBJECTS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleCreatePresetFolder(preset)}
                      className="p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-indigo-500/40 text-left transition-all cursor-pointer group flex items-start gap-2.5"
                    >
                      <span className="text-xl shrink-0 group-hover:scale-110 transition-transform">
                        {preset.icon}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors truncate">
                          {preset.name}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate mt-0.5">
                          {preset.description}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingFolder(null);
                    setIsFolderModalOpen(true);
                  }}
                  className="btn-tactile btn-tactile-primary px-6 py-3 rounded-2xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer shadow-xl shadow-indigo-600/30"
                >
                  <FolderPlus className="w-4 h-4" />
                  <span>Custom Subject Folder</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredFolders.map((folder) => {
                const colDef = FOLDER_COLORS.find(c => c.id === folder.color) || FOLDER_COLORS[0];
                const folderDecks = savedSessions.filter(s => s.folderId === folder.id);
                const totalCards = folderDecks.reduce((acc, s) => 
                  acc + (s.concepts?.reduce((cAcc, c) => cAcc + (c.retrievalCards?.length || 0), 0) || 0), 0
                );
                const dueInFolder = folderDecks.reduce((acc, s) => {
                  return acc + (s.concepts?.flatMap(c => c.retrievalCards || []).filter(rc => dueCards.some(dc => dc.id === rc.id)).length || 0);
                }, 0);

                return (
                  <div
                    key={folder.id}
                    onClick={() => setSelectedFolderId(folder.id)}
                    className={`p-5 sm:p-6 rounded-3xl border ${colDef.bg} ${colDef.border} hover:border-white/30 backdrop-blur-xl shadow-lg transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-4 group hover:scale-[1.01]`}
                  >
                    <div className="space-y-3">
                      {/* Top Bar: Icon, Name & Controls */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-12 rounded-2xl bg-black/30 border border-white/10 flex items-center justify-center text-2xl shadow-inner shrink-0 group-hover:scale-105 transition-transform">
                            {folder.icon || '📁'}
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-base sm:text-lg font-bold text-white font-display truncate group-hover:text-indigo-200 transition-colors">
                              {folder.name}
                            </h3>
                            <span className={`text-[11px] font-mono font-semibold ${colDef.text}`}>
                              {folderDecks.length} {folderDecks.length === 1 ? 'deck' : 'decks'} • {totalCards} cards
                            </span>
                          </div>
                        </div>

                        {/* Hover Edit/Delete Action Icons */}
                        <div className="flex items-center gap-1 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingFolder(folder);
                              setIsFolderModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.1] transition-colors cursor-pointer"
                            title="Edit Subject Name / Theme"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteFolder(folder.id, folder.name, e)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-white/[0.1] transition-colors cursor-pointer"
                            title="Delete Subject Folder"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Description */}
                      {folder.description && (
                        <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                          {folder.description}
                        </p>
                      )}

                      {/* Preview Decks Chips */}
                      {folderDecks.length > 0 ? (
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Decks Preview:
                          </span>
                          <div className="space-y-1">
                            {folderDecks.slice(0, 3).map(deck => (
                              <div 
                                key={deck.id}
                                className="px-2.5 py-1.5 rounded-xl bg-black/20 border border-white/[0.06] text-xs text-slate-200 flex items-center justify-between gap-2"
                              >
                                <span className="truncate">{deck.title}</span>
                                <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                                  {deck.concepts?.reduce((acc, c) => acc + (c.retrievalCards?.length || 0), 0) || 0}c
                                </span>
                              </div>
                            ))}
                            {folderDecks.length > 3 && (
                              <div className="text-[11px] text-slate-400 pl-1 font-mono">
                                + {folderDecks.length - 3} more decks...
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 rounded-xl bg-black/15 border border-dashed border-white/10 text-center">
                          <span className="text-xs text-slate-400">Empty folder — click to add decks</span>
                        </div>
                      )}
                    </div>

                    {/* Card Footer Actions */}
                    <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
                        <span>Open Subject</span>
                        <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                      </div>

                      {dueInFolder > 0 && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30 font-mono">
                          {dueInFolder} due
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ========================================================================= */}
          {/* UNASSIGNED DECKS SHELF                                                    */}
          {/* ========================================================================= */}
          {unassignedSessions.length > 0 && (
            <div className="p-5 sm:p-6 rounded-3xl bg-white/[0.02] border border-white/[0.06] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FolderMinus className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm sm:text-base font-bold text-white font-display">
                    Unassigned Study Decks ({unassignedSessions.length})
                  </h3>
                </div>
                <p className="text-xs text-slate-400">
                  These decks are not filed into any subject yet. Tap "+ Subject" to organize them.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {unassignedSessions.map(session => {
                  const cardCount = session.concepts?.reduce((acc, c) => acc + (c.retrievalCards?.length || 0), 0) || 0;

                  return (
                    <div
                      key={session.id}
                      className="p-3.5 rounded-2xl bg-slate-950/60 border border-white/[0.08] hover:border-white/[0.15] flex items-center justify-between gap-3 transition-colors"
                    >
                      <div className="min-w-0">
                        <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                          {session.title}
                        </h4>
                        <p className="text-[11px] text-slate-400 truncate">
                          {session.category || 'General'} • {cardCount} cards
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setMovingSession(session);
                          setIsMoveModalOpen(true);
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-[11px] font-bold flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                        title="Assign to Subject Folder"
                      >
                        <FolderInput className="w-3 h-3" />
                        <span>+ Subject</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* DRAWER: ADD EXISTING DECKS TO ACTIVE FOLDER                               */}
      {/* ========================================================================= */}
      {isAddDecksDrawerOpen && activeFolder && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn"
          onClick={() => setIsAddDecksDrawerOpen(false)}
        >
          <div 
            className="relative w-full max-w-lg rounded-3xl bg-slate-900 border border-white/[0.1] shadow-2xl p-6 space-y-4 animate-scaleUp max-h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xl">{activeFolder.icon || '📁'}</span>
                <div>
                  <h3 className="text-base font-bold text-white font-display">
                    Add Decks to {activeFolder.name}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Select decks from your library to file into this subject.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddDecksDrawerOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08]"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto space-y-2 flex-1 pr-1">
              {savedSessions.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">No study decks in library.</p>
              ) : (
                savedSessions.map(session => {
                  const isInThis = session.folderId === activeFolder.id;
                  const currentFolder = folders.find(f => f.id === session.folderId);
                  const cardCount = session.concepts?.reduce((acc, c) => acc + (c.retrievalCards?.length || 0), 0) || 0;

                  return (
                    <div
                      key={session.id}
                      className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                        isInThis
                          ? 'bg-indigo-950/40 border-indigo-500/40'
                          : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                            {session.title}
                          </h4>
                          {isInThis && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-bold">
                              In Folder
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {cardCount} cards • {currentFolder ? `Currently in: ${currentFolder.name}` : 'Unassigned'}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (isInThis) {
                            StorageService.setDeckFolder(session.id, null);
                          } else {
                            StorageService.setDeckFolder(session.id, activeFolder.id);
                          }
                          soundEngine.playSuccess();
                          setSavedSessions(StorageService.getSessions());
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isInThis
                            ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30'
                        }`}
                      >
                        {isInThis ? 'Remove' : '+ Add'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-2 border-t border-white/[0.08] flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setIsAddDecksDrawerOpen(false)}
                className="btn-tactile btn-tactile-primary px-5 py-2 rounded-xl text-xs font-bold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- SUBJECT FOLDER MODAL (CREATE / EDIT) --- */}
      <SubjectFolderModal
        isOpen={isFolderModalOpen}
        onClose={() => {
          setIsFolderModalOpen(false);
          setEditingFolder(null);
        }}
        initialFolder={editingFolder}
        onFolderSaved={(saved) => {
          setFolders(StorageService.getFolders());
          setSavedSessions(StorageService.getSessions());
          setIsFolderModalOpen(false);
          setEditingFolder(null);
          if (!selectedFolderId) {
            setSelectedFolderId(saved.id);
          }
        }}
      />

      {/* --- MOVE DECK TO FOLDER MODAL --- */}
      <MoveToFolderModal
        isOpen={isMoveModalOpen}
        session={movingSession}
        onClose={() => {
          setIsMoveModalOpen(false);
          setMovingSession(null);
        }}
        onMoved={() => {
          setSavedSessions(StorageService.getSessions());
          setFolders(StorageService.getFolders());
        }}
        onOpenNewFolderModal={() => {
          setIsMoveModalOpen(false);
          setEditingFolder(null);
          setIsFolderModalOpen(true);
        }}
      />

    </div>
  );
};

export default FoldersPage;
