import React, { useState, useEffect, useCallback } from 'react';
import { 
  Home, 
  Star, 
  Sparkles, 
  Layers, 
  Award, 
  Shuffle, 
  Plus, 
  Play, 
  Settings, 
  X,
  VolumeX,
  WifiOff,
  BrainCircuit,
  User,
  PanelLeftClose,
  PanelLeftOpen,
  BookOpen,
  Folder,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import type { UserStats, UserAccount } from '../../types';
import { soundEngine } from '../../services/soundEngine';
import { StorageService } from '../../services/storageService';
import { lifeSimService } from '../../services/lifeSimService';
import { UserAvatarBadge } from '../character/UserAvatarBadge';

const EXTRAS_OPEN_STORAGE_KEY = 'studify_sidebar_extras_open';

interface SidebarProps {
  activeView: 'home' | 'dashboard' | 'exam' | 'interleave' | 'sanctuary' | 'studio' | 'folders';
  onNavigate: (view: 'home' | 'dashboard' | 'exam' | 'interleave' | 'sanctuary' | 'studio' | 'folders') => void;
  stats: UserStats;
  currentUser?: UserAccount | null;
  onOpenAuth?: (tab?: 'login' | 'register' | 'profile') => void;
  onOpenDeckStudio: () => void;
  onOpenStarterCatalog: () => void;
  onOpenSettings: () => void;
  onQuickStudy?: () => void;
  onOpenLibraryTab?: (tab: 'my-decks' | 'starred' | 'curated') => void;
  savedDecksCount: number;
  starredCardsCount: number;
  dueCardsCount: number;
  curatedCount?: number;
  isOnline?: boolean;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: (collapsed: boolean) => void;
  onOpenCharacterCustomizer?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onNavigate,
  stats: _stats,
  currentUser,
  onOpenAuth,
  onOpenDeckStudio,
  onOpenStarterCatalog,
  onOpenSettings,
  onQuickStudy,
  onOpenLibraryTab,
  savedDecksCount,
  starredCardsCount,
  dueCardsCount,
  curatedCount = 10,
  isOnline = true,
  isOpenMobile = false,
  onCloseMobile,
  isCollapsed: propIsCollapsed,
  onToggleCollapse,
  onOpenCharacterCustomizer,
}) => {
  // Local collapsed state fallback if not controlled from parent
  const [internalCollapsed, setInternalCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('axon_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const isCollapsed = propIsCollapsed !== undefined ? propIsCollapsed : internalCollapsed;

  const toggleCollapse = useCallback(() => {
    const next = !isCollapsed;
    if (onToggleCollapse) {
      onToggleCollapse(next);
    } else {
      setInternalCollapsed(next);
      try {
        localStorage.setItem('axon_sidebar_collapsed', String(next));
      } catch {
        // ignore
      }
    }
  }, [isCollapsed, onToggleCollapse]);

  // Keyboard shortcut Ctrl+[ or Cmd+[ to toggle sidebar collapse
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === '[' || e.key === 'b')) {
        e.preventDefault();
        toggleCollapse();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleCollapse]);

  const [foldersCount, setFoldersCount] = useState<number>(() => StorageService.getFolders().length);

  // Non-study extras (home designer, 3D avatar) live in a collapsible group, closed by default.
  const [isExtrasOpen, setIsExtrasOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(EXTRAS_OPEN_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const showExtras = isExtrasOpen || activeView === 'sanctuary';
  const toggleExtras = () => {
    const next = !isExtrasOpen;
    setIsExtrasOpen(next);
    try {
      localStorage.setItem(EXTRAS_OPEN_STORAGE_KEY, next ? '1' : '0');
    } catch {}
  };
  const [walletCoins, setWalletCoins] = useState<number>(() => lifeSimService.getWalletBalance());

  useEffect(() => {
    const unsub = StorageService.addMutationListener(() => {
      setFoldersCount(StorageService.getFolders().length);
    });
    const unsubLife = lifeSimService.subscribe(() => {
      setWalletCoins(lifeSimService.getWalletBalance());
    });
    return () => {
      unsub();
      unsubLife();
    };
  }, []);

  const currentSound = soundEngine.getCurrentSound();
  const isMuted = currentSound === 'off';

  const toggleSound = () => {
    if (isMuted) {
      soundEngine.play('binaural-40hz');
    } else {
      soundEngine.play('off');
    }
  };

  const renderNavContent = (isExpanded: boolean, isMobile: boolean = false) => (
    <div className="flex flex-col h-full justify-between select-none relative z-10">
      {/* Top Header & Main Navigation */}
      <div className="space-y-4 flex-1 overflow-y-auto overflow-x-hidden no-scrollbar pr-0.5">
        
        {/* Brand & Collapse Header */}
        <div className={`flex items-center min-h-[46px] shrink-0 ${isExpanded ? 'justify-between px-1' : 'justify-center'}`}>
          <div 
            onClick={() => {
              onNavigate('home');
              if (onCloseMobile) onCloseMobile();
            }}
            className={`flex items-center gap-3 cursor-pointer group select-none ${isExpanded ? 'min-w-0' : 'justify-center'}`}
            title="Studify • Daily Micro-Mastery"
          >
            <div className="relative w-9 h-9 rounded-xl p-[1.5px] bg-gradient-to-tr from-indigo-500 via-purple-500 to-cyan-400 shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-200 shrink-0 flex items-center justify-center">
              <UserAvatarBadge size="xs" />
            </div>

            {isExpanded && (
              <div className="flex flex-col min-w-0 overflow-hidden">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-[16px] text-white tracking-tight leading-none font-display">
                    Studify
                  </span>
                  <span className="text-[10px] font-bold tracking-wide uppercase px-1.5 py-0.5 rounded-full bg-gradient-to-r from-indigo-500/15 to-purple-500/15 text-indigo-300 border border-indigo-500/25 leading-none">
                    FSRS
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium tracking-tight mt-1 leading-none truncate">
                  Daily Micro-Mastery
                </p>
              </div>
            )}
          </div>

          {/* Desktop Toggle Button in Header */}
          {!isMobile && isExpanded && (
            <button
              onClick={toggleCollapse}
              aria-label="Collapse sidebar"
              title="Collapse sidebar [Ctrl+[]"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer shrink-0"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}

          {/* Mobile Close Button */}
          {isMobile && onCloseMobile && (
            <button
              onClick={onCloseMobile}
              aria-label="Close menu"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Primary CTAs (Quick Study & New Deck) */}
        <div className="space-y-2 shrink-0">
          {onQuickStudy && (
            <button
              onClick={() => {
                onQuickStudy();
                if (onCloseMobile) onCloseMobile();
              }}
              title="Quick Study (Review Due Cards)"
              aria-label="Quick Study"
              className={`w-full rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-md shadow-indigo-600/25 hover:shadow-indigo-600/40 border border-white/10 flex items-center transition-all duration-200 active:scale-[0.98] cursor-pointer group relative ${
                isExpanded ? 'h-10 px-3.5 justify-between' : 'h-10 justify-center px-0'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Play className="w-3.5 h-3.5 fill-white shrink-0 group-hover:scale-110 transition-transform" />
                {isExpanded && <span>Quick Study</span>}
              </div>

              {isExpanded && (
                dueCardsCount > 0 ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white backdrop-blur-sm shadow-sm">
                    {dueCardsCount} due
                  </span>
                ) : (
                  <span className="text-[10px] font-medium text-indigo-200/80">
                    Ready
                  </span>
                )
              )}

              {/* Pulsing indicator when collapsed and cards due */}
              {!isExpanded && dueCardsCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-pink-500 ring-2 ring-[#0b0d18] animate-pulse" />
              )}

              {/* Floating Tooltip in collapsed mode */}
              {!isExpanded && (
                <div className="absolute left-full ml-3 px-2.5 py-1 rounded-lg bg-[#141724] border border-white/10 text-white text-xs font-semibold whitespace-nowrap shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50">
                  Quick Study {dueCardsCount > 0 ? `(${dueCardsCount} due)` : ''}
                </div>
              )}
            </button>
          )}

          <button
            onClick={() => {
              onOpenDeckStudio();
              if (onCloseMobile) onCloseMobile();
            }}
            title="Create New Deck"
            aria-label="Create New Deck"
            className={`w-full rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] hover:border-white/[0.14] text-slate-300 hover:text-white font-medium text-xs flex items-center transition-all duration-200 cursor-pointer group relative ${
              isExpanded ? 'h-9 px-3 justify-center gap-2' : 'h-10 justify-center px-0'
            }`}
          >
            <Plus className="w-3.5 h-3.5 text-slate-400 group-hover:text-white shrink-0 transition-transform group-hover:rotate-90 duration-200" />
            {isExpanded && <span>New Deck</span>}

            {!isExpanded && (
              <div className="absolute left-full ml-3 px-2.5 py-1 rounded-lg bg-[#141724] border border-white/10 text-white text-xs font-semibold whitespace-nowrap shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50">
                New Deck
              </div>
            )}
          </button>
        </div>

        {/* Navigation Group 1: Core Daily Focus */}
        <div className="space-y-1">
          {isExpanded && (
            <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Core Navigation
            </div>
          )}

          {/* Today's Mission */}
          <button
            onClick={() => {
              onNavigate('home');
              if (onCloseMobile) onCloseMobile();
            }}
            title="Today's Mission"
            aria-label="Today's Mission"
            className={`w-full rounded-xl text-xs transition-all duration-150 cursor-pointer relative group flex items-center ${
              isExpanded ? 'h-10 px-3 justify-between' : 'h-10 justify-center px-0 mx-auto'
            } ${
              activeView === 'home'
                ? 'bg-white/[0.08] text-white border border-white/[0.12] shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent font-medium'
            }`}
          >
            {activeView === 'home' && (
              <div className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-indigo-500 shadow-sm shadow-indigo-500/50" />
            )}
            <div className={`flex items-center gap-3 min-w-0 ${!isExpanded ? 'justify-center' : ''}`}>
              <Home className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                activeView === 'home' ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-200'
              }`} />
              {isExpanded && <span className="truncate">Today's Mission</span>}
            </div>

            {isExpanded && dueCardsCount > 0 && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30 shrink-0">
                {dueCardsCount}
              </span>
            )}

            {!isExpanded && (
              <>
                {dueCardsCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-pink-500 ring-2 ring-[#0b0d18]" />
                )}
                <div className="absolute left-full ml-3 px-2.5 py-1 rounded-lg bg-[#141724] border border-white/10 text-white text-xs font-semibold whitespace-nowrap shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50">
                  Today's Mission {dueCardsCount > 0 ? `(${dueCardsCount})` : ''}
                </div>
              </>
            )}
          </button>

          {/* Decks & Studio */}
          <button
            onClick={() => {
              onNavigate('studio');
              if (onCloseMobile) onCloseMobile();
            }}
            title={`Decks & Studio (${savedDecksCount} decks)`}
            aria-label="Decks & Studio"
            className={`w-full rounded-xl text-xs transition-all duration-150 cursor-pointer relative group flex items-center ${
              isExpanded ? 'h-10 px-3 justify-between' : 'h-10 justify-center px-0 mx-auto'
            } ${
              activeView === 'studio'
                ? 'bg-white/[0.08] text-white border border-white/[0.12] shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent font-medium'
            }`}
          >
            {activeView === 'studio' && (
              <div className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-purple-500 shadow-sm shadow-purple-500/50" />
            )}
            <div className={`flex items-center gap-3 min-w-0 ${!isExpanded ? 'justify-center' : ''}`}>
              <Layers className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                activeView === 'studio' ? 'text-purple-400' : 'text-slate-400 group-hover:text-slate-200'
              }`} />
              {isExpanded && <span className="truncate">Decks & Studio</span>}
            </div>

            {isExpanded && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/[0.06] text-slate-400 border border-white/[0.06] shrink-0">
                {savedDecksCount}
              </span>
            )}

            {!isExpanded && (
              <div className="absolute left-full ml-3 px-2.5 py-1 rounded-lg bg-[#141724] border border-white/10 text-white text-xs font-semibold whitespace-nowrap shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50">
                Decks & Studio ({savedDecksCount})
              </div>
            )}
          </button>

          {/* Subject Folders */}
          <button
            onClick={() => {
              onNavigate('folders');
              if (onCloseMobile) onCloseMobile();
            }}
            title={`Subject Folders (${foldersCount})`}
            aria-label="Subject Folders"
            className={`w-full rounded-xl text-xs transition-all duration-150 cursor-pointer relative group flex items-center ${
              isExpanded ? 'h-10 px-3 justify-between' : 'h-10 justify-center px-0 mx-auto'
            } ${
              activeView === 'folders'
                ? 'bg-white/[0.08] text-white border border-white/[0.12] shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent font-medium'
            }`}
          >
            {activeView === 'folders' && (
              <div className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-indigo-500 shadow-sm shadow-indigo-500/50" />
            )}
            <div className={`flex items-center gap-3 min-w-0 ${!isExpanded ? 'justify-center' : ''}`}>
              <Folder className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                activeView === 'folders' ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-200'
              }`} />
              {isExpanded && <span className="truncate">Subject Folders</span>}
            </div>

            {isExpanded && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 shrink-0 font-mono">
                {foldersCount}
              </span>
            )}

            {!isExpanded && (
              <div className="absolute left-full ml-3 px-2.5 py-1 rounded-lg bg-[#141724] border border-white/10 text-white text-xs font-semibold whitespace-nowrap shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50">
                Subject Folders ({foldersCount})
              </div>
            )}
          </button>

          {/* Starred Focus (if cards starred) */}
          {starredCardsCount > 0 && (
            <button
              onClick={() => {
                if (onOpenLibraryTab) onOpenLibraryTab('starred');
                else onNavigate('studio');
                if (onCloseMobile) onCloseMobile();
              }}
              title={`Starred Focus (${starredCardsCount} cards)`}
              aria-label="Starred Focus"
              className={`w-full rounded-xl text-xs transition-all duration-150 cursor-pointer relative group flex items-center ${
                isExpanded ? 'h-10 px-3 justify-between' : 'h-10 justify-center px-0 mx-auto'
              } text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent font-medium`}
            >
              <div className={`flex items-center gap-3 min-w-0 ${!isExpanded ? 'justify-center' : ''}`}>
                <Star className="w-4 h-4 text-amber-400 shrink-0 transition-transform group-hover:scale-110" />
                {isExpanded && <span className="truncate">Starred Focus</span>}
              </div>

              {isExpanded && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/25 shrink-0">
                  {starredCardsCount}
                </span>
              )}

              {!isExpanded && (
                <div className="absolute left-full ml-3 px-2.5 py-1 rounded-lg bg-[#141724] border border-white/10 text-white text-xs font-semibold whitespace-nowrap shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50">
                  Starred Focus ({starredCardsCount})
                </div>
              )}
            </button>
          )}

          {/* FSRS Retention Review */}
          <button
            onClick={() => {
              onNavigate('dashboard');
              if (onCloseMobile) onCloseMobile();
            }}
            title="FSRS Retention Review"
            aria-label="FSRS Retention Review"
            className={`w-full rounded-xl text-xs transition-all duration-150 cursor-pointer relative group flex items-center ${
              isExpanded ? 'h-10 px-3 justify-between' : 'h-10 justify-center px-0 mx-auto'
            } ${
              activeView === 'dashboard'
                ? 'bg-white/[0.08] text-white border border-white/[0.12] shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent font-medium'
            }`}
          >
            {activeView === 'dashboard' && (
              <div className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
            )}
            <div className={`flex items-center gap-3 min-w-0 ${!isExpanded ? 'justify-center' : ''}`}>
              <BrainCircuit className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                activeView === 'dashboard' ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-200'
              }`} />
              {isExpanded && <span className="truncate">FSRS Review</span>}
            </div>

            {isExpanded && (
              dueCardsCount > 0 ? (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 shrink-0">
                  {dueCardsCount} due
                </span>
              ) : (
                <span className="text-[11px] font-medium text-slate-500 shrink-0">
                  Done
                </span>
              )
            )}

            {!isExpanded && (
              <div className="absolute left-full ml-3 px-2.5 py-1 rounded-lg bg-[#141724] border border-white/10 text-white text-xs font-semibold whitespace-nowrap shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50">
                FSRS Review {dueCardsCount > 0 ? `(${dueCardsCount} due)` : '(Done)'}
              </div>
            )}
          </button>
        </div>

        {/* Navigation Group 2: Practice Arenas */}
        <div className="space-y-1 pt-2 border-t border-white/[0.05]">
          {isExpanded && (
            <div className="px-3 pt-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Practice Arenas
            </div>
          )}

          {/* Timed Mock Exam */}
          <button
            onClick={() => {
              onNavigate('exam');
              if (onCloseMobile) onCloseMobile();
            }}
            title="Timed Mock Exam Simulator"
            aria-label="Timed Mock Exam Simulator"
            className={`w-full rounded-xl text-xs transition-all duration-150 cursor-pointer relative group flex items-center ${
              isExpanded ? 'h-10 px-3 justify-between' : 'h-10 justify-center px-0 mx-auto'
            } ${
              activeView === 'exam'
                ? 'bg-white/[0.08] text-white border border-white/[0.12] shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent font-medium'
            }`}
          >
            {activeView === 'exam' && (
              <div className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-indigo-500 shadow-sm shadow-indigo-500/50" />
            )}
            <div className={`flex items-center gap-3 min-w-0 ${!isExpanded ? 'justify-center' : ''}`}>
              <Award className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                activeView === 'exam' ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-200'
              }`} />
              {isExpanded && <span className="truncate">Mock Exam</span>}
            </div>

            {!isExpanded && (
              <div className="absolute left-full ml-3 px-2.5 py-1 rounded-lg bg-[#141724] border border-white/10 text-white text-xs font-semibold whitespace-nowrap shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50">
                Mock Exam (Timed)
              </div>
            )}
          </button>

          {/* Interleaving Decks */}
          <button
            onClick={() => {
              onNavigate('interleave');
              if (onCloseMobile) onCloseMobile();
            }}
            title="Interleaving Arena"
            aria-label="Interleaving Arena"
            className={`w-full rounded-xl text-xs transition-all duration-150 cursor-pointer relative group flex items-center ${
              isExpanded ? 'h-10 px-3 justify-between' : 'h-10 justify-center px-0 mx-auto'
            } ${
              activeView === 'interleave'
                ? 'bg-white/[0.08] text-white border border-white/[0.12] shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent font-medium'
            }`}
          >
            {activeView === 'interleave' && (
              <div className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-purple-500 shadow-sm shadow-purple-500/50" />
            )}
            <div className={`flex items-center gap-3 min-w-0 ${!isExpanded ? 'justify-center' : ''}`}>
              <Shuffle className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                activeView === 'interleave' ? 'text-purple-400' : 'text-slate-400 group-hover:text-slate-200'
              }`} />
              {isExpanded && <span className="truncate">Mix Decks</span>}
            </div>

            {!isExpanded && (
              <div className="absolute left-full ml-3 px-2.5 py-1 rounded-lg bg-[#141724] border border-white/10 text-white text-xs font-semibold whitespace-nowrap shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50">
                Mix Decks (Interleaving)
              </div>
            )}
          </button>

          {/* Public Curated Decks */}
          <button
            onClick={() => {
              onOpenStarterCatalog();
              if (onCloseMobile) onCloseMobile();
            }}
            title={`Public Decks (${curatedCount} catalogs)`}
            aria-label="Public Decks"
            className={`w-full rounded-xl text-xs transition-all duration-150 cursor-pointer relative group flex items-center ${
              isExpanded ? 'h-10 px-3 justify-between' : 'h-10 justify-center px-0 mx-auto'
            } text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent font-medium`}
          >
            <div className={`flex items-center gap-3 min-w-0 ${!isExpanded ? 'justify-center' : ''}`}>
              <BookOpen className="w-4 h-4 text-indigo-400/90 shrink-0 transition-transform group-hover:scale-110" />
              {isExpanded && <span className="truncate">Public Decks</span>}
            </div>

            {isExpanded && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/[0.06] text-slate-400 border border-white/[0.06] shrink-0">
                {curatedCount}
              </span>
            )}

            {!isExpanded && (
              <div className="absolute left-full ml-3 px-2.5 py-1 rounded-lg bg-[#141724] border border-white/10 text-white text-xs font-semibold whitespace-nowrap shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50">
                Public Decks ({curatedCount})
              </div>
            )}
          </button>
        </div>

        {/* Navigation Group 3: Extras (non-study, collapsed by default) */}
        <div className="space-y-1 pt-2 border-t border-white/[0.05]">
          <button
            onClick={toggleExtras}
            aria-expanded={showExtras}
            aria-label="Extras"
            title="Extras: home designer and 3D avatar"
            className={`w-full rounded-xl text-xs transition-all duration-150 cursor-pointer relative group flex items-center text-slate-500 hover:text-slate-300 hover:bg-white/[0.04] border border-transparent ${
              isExpanded ? 'h-8 px-3 justify-between' : 'h-10 justify-center px-0 mx-auto'
            }`}
          >
            {isExpanded ? (
              <>
                <span className="text-[10px] font-bold uppercase tracking-wider">Extras</span>
                {showExtras ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 shrink-0 text-slate-500 group-hover:text-slate-300" />
                <div className="absolute left-full ml-3 px-2.5 py-1 rounded-lg bg-[#141724] border border-white/10 text-white text-xs font-semibold whitespace-nowrap shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50">
                  Extras
                </div>
              </>
            )}
          </button>

          {showExtras && (
            <>
            {/* Student Campus Life & Living Loft */}
            <button
              onClick={() => {
                onNavigate('sanctuary');
                if (onCloseMobile) onCloseMobile();
              }}
              title="Home & Room Designer (Design Home)"
              aria-label="Home & Room Designer"
              className={`w-full rounded-xl text-xs transition-all duration-150 cursor-pointer relative group flex items-center ${
                isExpanded ? 'h-10 px-3 justify-between' : 'h-10 justify-center px-0 mx-auto'
              } ${
                activeView === 'sanctuary'
                  ? 'bg-gradient-to-r from-amber-500/20 via-indigo-500/20 to-transparent text-white border border-amber-500/40 shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent font-medium'
              }`}
            >
              {activeView === 'sanctuary' && (
                <div className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-amber-500 shadow-sm shadow-amber-500/50" />
              )}
              <div className={`flex items-center gap-3 min-w-0 ${!isExpanded ? 'justify-center' : ''}`}>
                <Sparkles className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                  activeView === 'sanctuary' ? 'text-amber-400' : 'text-amber-400/80 group-hover:text-amber-300'
                }`} />
                {isExpanded && <span className="truncate">Home &amp; Design</span>}
              </div>

              {isExpanded && (
                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0 font-mono">
                  DESIGN
                </span>
              )}

              {!isExpanded && (
                <div className="absolute left-full ml-3 px-2.5 py-1 rounded-lg bg-[#141724] border border-white/10 text-white text-xs font-semibold whitespace-nowrap shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50">
                  Home &amp; Design (Design Home)
                </div>
              )}
            </button>

            {/* 3D Character Studio */}
            {onOpenCharacterCustomizer && (
              <button
                onClick={() => {
                  onOpenCharacterCustomizer();
                  if (onCloseMobile) onCloseMobile();
                }}
                title="Customize 3D Character (Hair, Wardrobe, Gender, Style)"
                aria-label="Customize 3D Character"
                className={`w-full rounded-xl text-xs transition-all duration-150 cursor-pointer relative group flex items-center ${
                  isExpanded ? 'h-10 px-3 justify-between' : 'h-10 justify-center px-0 mx-auto'
                } text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent font-medium`}
              >
                <div className={`flex items-center gap-3 min-w-0 ${!isExpanded ? 'justify-center' : ''}`}>
                  <div className="w-5 h-5 rounded-lg overflow-hidden flex items-center justify-center shrink-0 p-0.5 bg-indigo-500/20 group-hover:scale-110 transition-transform">
                    <UserAvatarBadge size="xs" />
                  </div>
                  {isExpanded && <span className="truncate">Edit 3D Avatar</span>}
                </div>

                {isExpanded && (
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0 font-mono">
                    3D
                  </span>
                )}

                {!isExpanded && (
                  <div className="absolute left-full ml-3 px-2.5 py-1 rounded-lg bg-[#141724] border border-white/10 text-white text-xs font-semibold whitespace-nowrap shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50">
                    Edit 3D Avatar
                  </div>
                )}
              </button>
            )}
            </>
          )}
        </div>
      </div>

      {/* Bottom Dock: Audio, Account, Settings, & Collapse */}
      <div className="pt-3 border-t border-white/[0.06] space-y-1.5 shrink-0">
        
        {/* Offline indicator */}
        {!isOnline && (
          <div 
            title="Working Offline • All local decks and reviews available"
            className={`rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] font-semibold flex items-center overflow-hidden ${
              isExpanded ? 'px-3 py-1.5 gap-2' : 'h-9 justify-center px-0'
            }`}
          >
            <WifiOff className="w-3.5 h-3.5 shrink-0 text-amber-400" />
            {isExpanded && <span className="truncate">Working Offline</span>}
          </div>
        )}

        {/* Focus Audio Toggle */}
        <button
          onClick={toggleSound}
          aria-label={!isMuted ? 'Mute focus audio' : 'Play focus audio'}
          title={!isMuted ? 'Focus audio on (click to mute)' : 'Focus audio off (click to play)'}
          className={`w-full rounded-xl text-xs transition-all duration-150 cursor-pointer flex items-center relative group ${
            isExpanded ? 'justify-between px-3 py-2' : 'justify-center px-0 h-10'
          } ${
            !isMuted
              ? 'bg-indigo-600/15 border border-indigo-500/30 text-indigo-200'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {!isMuted ? (
              <div className="flex items-end gap-0.5 h-4 w-4 shrink-0 px-0.5">
                <span className="w-0.5 bg-indigo-400 animate-eq-1 rounded-full" />
                <span className="w-0.5 bg-indigo-400 animate-eq-2 rounded-full" />
                <span className="w-0.5 bg-indigo-400 animate-eq-3 rounded-full" />
                <span className="w-0.5 bg-indigo-400 animate-eq-4 rounded-full" />
              </div>
            ) : (
              <VolumeX className="w-4 h-4 text-slate-500 shrink-0" />
            )}
            {isExpanded && (
              <span className="truncate font-medium">
                {!isMuted ? 'Focus Audio On' : 'Focus Audio'}
              </span>
            )}
          </div>

          {isExpanded && (
            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
              !isMuted ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-500'
            }`}>
              {!isMuted ? 'ON' : 'OFF'}
            </span>
          )}

          {!isExpanded && (
            <div className="absolute left-full ml-3 px-2.5 py-1 rounded-lg bg-[#141724] border border-white/10 text-white text-xs font-semibold whitespace-nowrap shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50">
              Focus Audio: {!isMuted ? 'ON' : 'OFF'}
            </div>
          )}
        </button>

        {/* User Account / Profile Card */}
        <button
          onClick={() => {
            if (onOpenAuth) onOpenAuth(currentUser ? 'profile' : 'login');
            if (onCloseMobile) onCloseMobile();
          }}
          aria-label={currentUser ? `Profile for ${currentUser.name}` : 'Sign in or register'}
          title={currentUser ? `Logged in as ${currentUser.name}` : 'Log In or Create Account'}
          className={`w-full rounded-xl text-xs bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.07] hover:border-indigo-500/30 text-slate-300 hover:text-white transition-all duration-150 cursor-pointer flex items-center relative group ${
            isExpanded ? 'justify-between px-3 py-2' : 'justify-center px-0 h-10'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center text-indigo-300 text-xs shrink-0">
              {currentUser ? currentUser.avatar || <User className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
            </div>
            {isExpanded && (
              <div className="flex flex-col text-left min-w-0">
                <span className="font-semibold text-white truncate leading-tight">
                  {currentUser ? currentUser.name : 'Guest Student'}
                </span>
                <span className="text-[10px] text-slate-400 truncate leading-tight mt-0.5">
                  {currentUser ? `${currentUser.grade || 'Student'}` : 'Sign in to sync'}
                </span>
              </div>
            )}
          </div>

          {isExpanded && (
            <span className="text-[10px] font-semibold text-indigo-300 bg-indigo-500/15 border border-indigo-500/25 px-2 py-0.5 rounded-md shrink-0">
              {currentUser ? 'Profile' : 'Sign In'}
            </span>
          )}

          {!isExpanded && (
            <div className="absolute left-full ml-3 px-2.5 py-1 rounded-lg bg-[#141724] border border-white/10 text-white text-xs font-semibold whitespace-nowrap shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50">
              {currentUser ? currentUser.name : 'Sign In / Register'}
            </div>
          )}
        </button>

        {/* Settings Button */}
        <button
          onClick={() => {
            onOpenSettings();
            if (onCloseMobile) onCloseMobile();
          }}
          aria-label="Settings"
          title={`Settings • 🪙 ${walletCoins} Tokens`}
          className={`w-full rounded-xl text-xs text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] transition-all duration-150 cursor-pointer flex items-center relative group ${
            isExpanded ? 'justify-between px-3 py-2' : 'justify-center px-0 h-10'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Settings className="w-4 h-4 text-slate-400 group-hover:text-slate-200 shrink-0" />
            {isExpanded && <span className="font-medium">Settings</span>}
          </div>

          {isExpanded && (
            <span className="text-[10px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded font-mono">
              🪙 {walletCoins}
            </span>
          )}

          {!isExpanded && (
            <div className="absolute left-full ml-3 px-2.5 py-1 rounded-lg bg-[#141724] border border-white/10 text-white text-xs font-semibold whitespace-nowrap shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50">
              Settings (🪙 {walletCoins})
            </div>
          )}
        </button>

        {/* Desktop Collapse / Expand Dock Button */}
        {!isMobile && (
          <button
            onClick={toggleCollapse}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={isCollapsed ? "Expand sidebar [Ctrl+[]" : "Collapse sidebar [Ctrl+[]"}
            className={`w-full rounded-xl text-xs text-slate-500 hover:text-slate-300 hover:bg-white/[0.04] transition-all duration-150 cursor-pointer flex items-center relative group ${
              isExpanded ? 'justify-between px-3 py-2' : 'justify-center px-0 h-10'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {isCollapsed ? (
                <PanelLeftOpen className="w-4 h-4 text-indigo-400 shrink-0" />
              ) : (
                <PanelLeftClose className="w-4 h-4 text-slate-400 shrink-0" />
              )}
              {isExpanded && <span className="font-medium">Collapse</span>}
            </div>

            {isExpanded && (
              <kbd className="text-[10px] font-mono text-slate-500 bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/[0.06]">
                Ctrl+[
              </kbd>
            )}

            {!isExpanded && (
              <div className="absolute left-full ml-3 px-2.5 py-1 rounded-lg bg-[#141724] border border-white/10 text-white text-xs font-semibold whitespace-nowrap shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50">
                Expand Sidebar (Ctrl+[)
              </div>
            )}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside 
        className={`hidden md:block shrink-0 relative z-40 select-none transition-[width] duration-300 ease-in-out ${
          isCollapsed ? 'w-[68px]' : 'w-64'
        }`}
      >
        <div 
          className={`h-screen sticky top-0 flex flex-col border-r border-white/[0.07] bg-[#0b0d18]/95 backdrop-blur-2xl transition-[width] duration-300 ease-in-out overflow-hidden ${
            isCollapsed ? 'w-[68px] px-2 py-4' : 'w-64 p-3.5'
          }`}
        >
          {/* Subtle top ambient glow */}
          <div className="pointer-events-none absolute -top-20 -left-20 w-52 h-52 rounded-full bg-gradient-to-br from-indigo-600/15 via-purple-600/10 to-transparent blur-3xl" />
          
          {renderNavContent(!isCollapsed, false)}
        </div>
      </aside>

      {/* Mobile Drawer */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div 
            className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity" 
            onClick={onCloseMobile}
          />
          <aside className="relative w-72 max-w-[85vw] bg-[#0b0d18] border-r border-white/[0.08] h-full p-4 flex flex-col z-10 shadow-2xl">
            {renderNavContent(true, true)}
          </aside>
        </div>
      )}
    </>
  );
};
