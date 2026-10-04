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
  Volume2,
  VolumeX,
  WifiOff,
  BrainCircuit,
  User,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import type { UserStats, UserAccount } from '../../types';
import { soundEngine } from '../../services/soundEngine';

interface SidebarProps {
  activeView: 'home' | 'dashboard' | 'exam' | 'interleave' | 'sanctuary' | 'studio';
  onNavigate: (view: 'home' | 'dashboard' | 'exam' | 'interleave' | 'sanctuary' | 'studio') => void;
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
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onNavigate,
  stats,
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
  const [isHovered, setIsHovered] = useState(false);

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

  const currentSound = soundEngine.getCurrentSound();
  const isMuted = currentSound === 'off';

  const toggleSound = () => {
    if (isMuted) {
      soundEngine.play('binaural-40hz');
    } else {
      soundEngine.play('off');
    }
  };

  // Effective expanded state for desktop:
  // Expanded if NOT collapsed, OR if collapsed but currently hovered
  const isEffectiveExpanded = !isCollapsed || isHovered;

  const renderNavContent = (isExpanded: boolean, isMobile: boolean = false) => (
    <div className="flex flex-col h-full justify-between gap-4">
      {/* Top Header & Navigation Links */}
      <div className="space-y-5 flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-white/10 pr-0.5">
        {/* Brand & Collapse Control */}
        <div className="flex items-center justify-between min-h-[42px] relative">
          <div 
            onClick={() => {
              onNavigate('home');
              if (onCloseMobile) onCloseMobile();
            }}
            className={`flex items-center cursor-pointer group select-none min-w-0 ${
              isExpanded ? 'gap-2.5' : 'justify-center w-full'
            }`}
            title="Lotti • Daily Micro-Mastery"
          >
            <div className="relative w-9 h-9 rounded-xl overflow-hidden p-0.5 bg-gradient-to-tr from-pink-500 via-purple-500 to-cyan-400 shadow-lg shadow-pink-500/25 group-hover:scale-105 transition-all shrink-0">
              <img src="/lottie.png" alt="Lotti" className="w-full h-full object-cover rounded-[10px]" />
            </div>
            <div className={`transition-all duration-300 overflow-hidden whitespace-nowrap min-w-0 ${
              isExpanded ? 'opacity-100 max-w-[150px]' : 'opacity-0 max-w-0 pointer-events-none'
            }`}>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base text-white tracking-tight font-display">Lotti</span>
                <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded-full bg-gradient-to-r from-pink-500/20 to-cyan-500/20 text-pink-300 border border-pink-500/30">
                  RECALL
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium truncate">Daily Micro-Mastery</p>
            </div>
          </div>

          {/* Desktop Toggle Button in Header */}
          {!isMobile && isExpanded && (
            <button
              onClick={toggleCollapse}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer shrink-0"
              title={isCollapsed ? "Pin sidebar open" : "Shrink sidebar (only icons) [Ctrl+[]"}
            >
              {isCollapsed ? (
                <PanelLeftOpen className="w-4 h-4 text-cyan-400 hover:text-cyan-300" />
              ) : (
                <PanelLeftClose className="w-4 h-4 text-slate-400 hover:text-slate-200" />
              )}
            </button>
          )}

          {/* Mobile Close Button */}
          {isMobile && onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Primary CTA Buttons (Study & Create) */}
        <div className="space-y-2">
          {onQuickStudy && (
            <button
              onClick={() => {
                onQuickStudy();
                if (onCloseMobile) onCloseMobile();
              }}
              title="Quick Study (Review Due Cards)"
              className={`w-full h-10 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center transition-all duration-300 hover:scale-[1.02] cursor-pointer overflow-hidden relative group ${
                isExpanded ? 'px-3 justify-center gap-2' : 'px-0 justify-center'
              }`}
            >
              <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                <Play className="w-3.5 h-3.5 fill-white" />
              </div>
              <span className={`transition-all duration-300 overflow-hidden whitespace-nowrap ${
                isExpanded ? 'opacity-100 max-w-[120px]' : 'opacity-0 max-w-0 pointer-events-none'
              }`}>
                Quick Study
              </span>
              {/* Pulsing indicator when due cards exist in collapsed mode */}
              {!isExpanded && dueCardsCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-cyan-400 ring-2 ring-[#090a10] animate-pulse" />
              )}
            </button>
          )}

          <button
            onClick={() => {
              onOpenDeckStudio();
              if (onCloseMobile) onCloseMobile();
            }}
            title="Create New Deck"
            className={`w-full h-9 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-slate-200 hover:text-white font-semibold text-xs flex items-center transition-all duration-300 cursor-pointer overflow-hidden ${
              isExpanded ? 'px-3 justify-center gap-2' : 'px-0 justify-center'
            }`}
          >
            <div className="w-5 h-5 shrink-0 flex items-center justify-center">
              <Plus className="w-3.5 h-3.5" />
            </div>
            <span className={`transition-all duration-300 overflow-hidden whitespace-nowrap ${
              isExpanded ? 'opacity-100 max-w-[120px]' : 'opacity-0 max-w-0 pointer-events-none'
            }`}>
              New Deck
            </span>
          </button>
        </div>

        {/* Navigation Group 1: Core Study Pillars */}
        <div className="space-y-1">
          <div className={`transition-all duration-300 overflow-hidden whitespace-nowrap text-[11px] font-bold uppercase tracking-wider text-slate-500 ${
            isExpanded ? 'opacity-100 max-h-6 px-3 py-1' : 'opacity-0 max-h-0 p-0 pointer-events-none'
          }`}>
            Core Navigation
          </div>

          {/* Today's Mission (Home) */}
          <button
            onClick={() => {
              onNavigate('home');
              if (onCloseMobile) onCloseMobile();
            }}
            title="Today's Mission (Daily Queue)"
            className={`w-full h-10 flex items-center rounded-xl text-xs font-semibold transition-all duration-300 cursor-pointer overflow-hidden relative group ${
              isExpanded ? 'px-3 justify-between' : 'px-0 justify-center'
            } ${
              activeView === 'home'
                ? 'bg-indigo-600/25 text-indigo-200 border border-indigo-500/30 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            {activeView === 'home' && !isExpanded && (
              <div className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-indigo-500 shadow-sm shadow-indigo-500" />
            )}
            <div className={`flex items-center gap-2.5 min-w-0 ${!isExpanded ? 'justify-center w-full' : ''}`}>
              <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                <Home className="w-4 h-4 text-indigo-400 transition-transform group-hover:scale-110" />
              </div>
              <span className={`transition-all duration-300 overflow-hidden whitespace-nowrap text-left truncate ${
                isExpanded ? 'opacity-100 max-w-[130px]' : 'opacity-0 max-w-0 pointer-events-none'
              }`}>
                Today's Mission
              </span>
            </div>
            {dueCardsCount > 0 && (
              <div className={`transition-all duration-300 overflow-hidden whitespace-nowrap shrink-0 ${
                isExpanded ? 'opacity-100 max-w-[50px]' : 'opacity-0 max-w-0 pointer-events-none'
              }`}>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30">
                  {dueCardsCount}
                </span>
              </div>
            )}
          </button>

          {/* Decks & Studio */}
          <button
            onClick={() => {
              onNavigate('studio');
              if (onCloseMobile) onCloseMobile();
            }}
            title={`Decks & Studio (${savedDecksCount} decks)`}
            className={`w-full h-10 flex items-center rounded-xl text-xs font-semibold transition-all duration-300 cursor-pointer overflow-hidden relative group ${
              isExpanded ? 'px-3 justify-between' : 'px-0 justify-center'
            } ${
              activeView === 'studio'
                ? 'bg-indigo-600/25 text-indigo-200 border border-indigo-500/30 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            {activeView === 'studio' && !isExpanded && (
              <div className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-indigo-500 shadow-sm shadow-indigo-500" />
            )}
            <div className={`flex items-center gap-2.5 min-w-0 ${!isExpanded ? 'justify-center w-full' : ''}`}>
              <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                <Layers className="w-4 h-4 text-purple-400 transition-transform group-hover:scale-110" />
              </div>
              <span className={`transition-all duration-300 overflow-hidden whitespace-nowrap text-left truncate ${
                isExpanded ? 'opacity-100 max-w-[130px]' : 'opacity-0 max-w-0 pointer-events-none'
              }`}>
                Decks & Studio
              </span>
            </div>
            <div className={`transition-all duration-300 overflow-hidden whitespace-nowrap shrink-0 ${
              isExpanded ? 'opacity-100 max-w-[50px]' : 'opacity-0 max-w-0 pointer-events-none'
            }`}>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400">
                {savedDecksCount}
              </span>
            </div>
          </button>

          {/* Starred Focus */}
          {starredCardsCount > 0 && (
            <button
              onClick={() => {
                if (onOpenLibraryTab) onOpenLibraryTab('starred');
                else onNavigate('studio');
                if (onCloseMobile) onCloseMobile();
              }}
              title={`Starred Focus (${starredCardsCount} cards)`}
              className={`w-full h-10 flex items-center rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/[0.04] transition-all duration-300 cursor-pointer overflow-hidden relative group ${
                isExpanded ? 'px-3 justify-between' : 'px-0 justify-center'
              }`}
            >
              <div className={`flex items-center gap-2.5 min-w-0 ${!isExpanded ? 'justify-center w-full' : ''}`}>
                <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                  <Star className="w-4 h-4 text-amber-400 transition-transform group-hover:scale-110" />
                </div>
                <span className={`transition-all duration-300 overflow-hidden whitespace-nowrap text-left truncate ${
                  isExpanded ? 'opacity-100 max-w-[130px]' : 'opacity-0 max-w-0 pointer-events-none'
                }`}>
                  Starred Focus
                </span>
              </div>
              <div className={`transition-all duration-300 overflow-hidden whitespace-nowrap shrink-0 ${
                isExpanded ? 'opacity-100 max-w-[50px]' : 'opacity-0 max-w-0 pointer-events-none'
              }`}>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {starredCardsCount}
                </span>
              </div>
            </button>
          )}

          {/* Daily Review & Analytics */}
          <button
            onClick={() => {
              onNavigate('dashboard');
              if (onCloseMobile) onCloseMobile();
            }}
            title={`Daily Review & Retention (${dueCardsCount} due)`}
            className={`w-full h-10 flex items-center rounded-xl text-xs font-semibold transition-all duration-300 cursor-pointer overflow-hidden relative group ${
              isExpanded ? 'px-3 justify-between' : 'px-0 justify-center'
            } ${
              activeView === 'dashboard'
                ? 'bg-emerald-600/25 text-emerald-200 border border-emerald-500/30 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            {activeView === 'dashboard' && !isExpanded && (
              <div className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-emerald-500 shadow-sm shadow-emerald-500" />
            )}
            <div className={`flex items-center gap-2.5 min-w-0 ${!isExpanded ? 'justify-center w-full' : ''}`}>
              <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                <BrainCircuit className="w-4 h-4 text-emerald-400 transition-transform group-hover:scale-110" />
              </div>
              <span className={`transition-all duration-300 overflow-hidden whitespace-nowrap text-left truncate ${
                isExpanded ? 'opacity-100 max-w-[130px]' : 'opacity-0 max-w-0 pointer-events-none'
              }`}>
                FSRS Review
              </span>
            </div>
            <div className={`transition-all duration-300 overflow-hidden whitespace-nowrap shrink-0 ${
              isExpanded ? 'opacity-100 max-w-[65px]' : 'opacity-0 max-w-0 pointer-events-none'
            }`}>
              {dueCardsCount > 0 ? (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {dueCardsCount} due
                </span>
              ) : (
                <span className="text-[10px] font-medium text-slate-500">Done</span>
              )}
            </div>
          </button>

          {/* 3D Axolotl Sanctuary */}
          <button
            onClick={() => {
              onNavigate('sanctuary');
              if (onCloseMobile) onCloseMobile();
            }}
            title="3D Axolotl Sanctuary & Habitat"
            className={`w-full h-10 flex items-center rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer overflow-hidden relative group ${
              isExpanded ? 'px-3 justify-between' : 'px-0 justify-center'
            } ${
              activeView === 'sanctuary'
                ? 'bg-gradient-to-r from-pink-600/30 to-purple-600/30 text-pink-200 border border-pink-500/40 shadow-sm'
                : 'text-pink-300 hover:text-white hover:bg-pink-500/10'
            }`}
          >
            {activeView === 'sanctuary' && !isExpanded && (
              <div className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-pink-500 shadow-sm shadow-pink-500" />
            )}
            <div className={`flex items-center gap-2.5 min-w-0 ${!isExpanded ? 'justify-center w-full' : ''}`}>
              <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-pink-400 animate-pulse transition-transform group-hover:scale-110" />
              </div>
              <span className={`transition-all duration-300 overflow-hidden whitespace-nowrap text-left truncate ${
                isExpanded ? 'opacity-100 max-w-[130px]' : 'opacity-0 max-w-0 pointer-events-none'
              }`}>
                3D Sanctuary
              </span>
            </div>
            <div className={`transition-all duration-300 overflow-hidden whitespace-nowrap shrink-0 ${
              isExpanded ? 'opacity-100 max-w-[40px]' : 'opacity-0 max-w-0 pointer-events-none'
            }`}>
              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-gradient-to-r from-pink-500/30 to-purple-500/30 text-pink-300 border border-pink-500/30 font-mono">
                3D
              </span>
            </div>
          </button>
        </div>

        {/* Navigation Group 2: Practice Modes */}
        <div className="space-y-1 pt-2 border-t border-white/[0.06]">
          <div className={`transition-all duration-300 overflow-hidden whitespace-nowrap text-[11px] font-bold uppercase tracking-wider text-slate-500 ${
            isExpanded ? 'opacity-100 max-h-6 px-3 py-1' : 'opacity-0 max-h-0 p-0 pointer-events-none'
          }`}>
            Practice Arenas
          </div>

          {/* Mock Exam */}
          <button
            onClick={() => {
              onNavigate('exam');
              if (onCloseMobile) onCloseMobile();
            }}
            title="Timed Mock Exam Simulator"
            className={`w-full h-10 flex items-center rounded-xl text-xs font-semibold transition-all duration-300 cursor-pointer overflow-hidden relative group ${
              isExpanded ? 'px-3 justify-between' : 'px-0 justify-center'
            } ${
              activeView === 'exam'
                ? 'bg-indigo-600/25 text-indigo-200 border border-indigo-500/30 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            {activeView === 'exam' && !isExpanded && (
              <div className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-indigo-500 shadow-sm shadow-indigo-500" />
            )}
            <div className={`flex items-center gap-2.5 min-w-0 ${!isExpanded ? 'justify-center w-full' : ''}`}>
              <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                <Award className="w-4 h-4 text-indigo-400 transition-transform group-hover:scale-110" />
              </div>
              <span className={`transition-all duration-300 overflow-hidden whitespace-nowrap text-left truncate ${
                isExpanded ? 'opacity-100 max-w-[130px]' : 'opacity-0 max-w-0 pointer-events-none'
              }`}>
                Mock Exam
              </span>
            </div>
          </button>

          {/* Mix Decks */}
          <button
            onClick={() => {
              onNavigate('interleave');
              if (onCloseMobile) onCloseMobile();
            }}
            title="Interleaving Arena (Mix diverse subjects)"
            className={`w-full h-10 flex items-center rounded-xl text-xs font-semibold transition-all duration-300 cursor-pointer overflow-hidden relative group ${
              isExpanded ? 'px-3 justify-between' : 'px-0 justify-center'
            } ${
              activeView === 'interleave'
                ? 'bg-purple-600/25 text-purple-200 border border-purple-500/30 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            {activeView === 'interleave' && !isExpanded && (
              <div className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-purple-500 shadow-sm shadow-purple-500" />
            )}
            <div className={`flex items-center gap-2.5 min-w-0 ${!isExpanded ? 'justify-center w-full' : ''}`}>
              <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                <Shuffle className="w-4 h-4 text-purple-400 transition-transform group-hover:scale-110" />
              </div>
              <span className={`transition-all duration-300 overflow-hidden whitespace-nowrap text-left truncate ${
                isExpanded ? 'opacity-100 max-w-[130px]' : 'opacity-0 max-w-0 pointer-events-none'
              }`}>
                Mix Decks
              </span>
            </div>
          </button>

          {/* Public Starter Catalog */}
          <button
            onClick={() => {
              onOpenStarterCatalog();
              if (onCloseMobile) onCloseMobile();
            }}
            title={`Public Decks (${curatedCount} catalogs)`}
            className={`w-full h-10 flex items-center rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/[0.04] transition-all duration-300 cursor-pointer overflow-hidden relative group ${
              isExpanded ? 'px-3 justify-between' : 'px-0 justify-center'
            }`}
          >
            <div className={`flex items-center gap-2.5 min-w-0 ${!isExpanded ? 'justify-center w-full' : ''}`}>
              <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-amber-400 transition-transform group-hover:scale-110" />
              </div>
              <span className={`transition-all duration-300 overflow-hidden whitespace-nowrap text-left truncate ${
                isExpanded ? 'opacity-100 max-w-[130px]' : 'opacity-0 max-w-0 pointer-events-none'
              }`}>
                Public Decks
              </span>
            </div>
            <div className={`transition-all duration-300 overflow-hidden whitespace-nowrap shrink-0 ${
              isExpanded ? 'opacity-100 max-w-[50px]' : 'opacity-0 max-w-0 pointer-events-none'
            }`}>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {curatedCount}
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Bottom User HUD & Quick Preferences */}
      <div className="pt-3 border-t border-white/[0.06] space-y-2 shrink-0">
        {/* Offline Badge */}
        {!isOnline && (
          <div 
            title="Working Offline • All local decks and reviews available"
            className={`rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-semibold flex items-center transition-all duration-300 overflow-hidden ${
              isExpanded ? 'px-3 py-1.5 gap-2' : 'h-10 justify-center px-0'
            }`}
          >
            <div className="w-5 h-5 shrink-0 flex items-center justify-center">
              <WifiOff className="w-3.5 h-3.5" />
            </div>
            <span className={`transition-all duration-300 overflow-hidden whitespace-nowrap truncate ${
              isExpanded ? 'opacity-100 max-w-[130px]' : 'opacity-0 max-w-0 pointer-events-none'
            }`}>
              Working Offline
            </span>
          </div>
        )}

        {/* 40Hz Audio Toggle */}
        <button
          onClick={toggleSound}
          title={!isMuted ? '40Hz Focus Active (Click to mute)' : 'Soundscape Muted (Click to play)'}
          className={`w-full flex items-center rounded-xl text-xs font-semibold transition-all duration-300 cursor-pointer overflow-hidden ${
            isExpanded ? 'justify-between px-3 py-2' : 'justify-center px-0 h-10'
          } ${
            !isMuted
              ? 'bg-indigo-600/20 border border-indigo-500/30 text-indigo-300'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-5 h-5 shrink-0 flex items-center justify-center">
              {!isMuted ? <Volume2 className="w-4 h-4 text-indigo-400 animate-pulse" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
            </div>
            <span className={`transition-all duration-300 overflow-hidden whitespace-nowrap truncate ${
              isExpanded ? 'opacity-100 max-w-[110px]' : 'opacity-0 max-w-0 pointer-events-none'
            }`}>
              {!isMuted ? '40Hz Active' : 'Muted'}
            </span>
          </div>
          <span className={`transition-all duration-300 overflow-hidden whitespace-nowrap text-[10px] text-slate-500 uppercase ${
            isExpanded ? 'opacity-100 max-w-[30px]' : 'opacity-0 max-w-0 pointer-events-none'
          }`}>
            {!isMuted ? 'ON' : 'OFF'}
          </span>
        </button>

        {/* Account / User HUD button */}
        <button
          onClick={() => {
            if (onOpenAuth) onOpenAuth(currentUser ? 'profile' : 'login');
            if (onCloseMobile) onCloseMobile();
          }}
          className={`w-full flex items-center rounded-xl text-xs font-semibold bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] hover:border-indigo-500/40 text-slate-300 hover:text-white transition-all duration-300 cursor-pointer group overflow-hidden ${
            isExpanded ? 'justify-between px-3 py-2' : 'justify-center px-0 h-10'
          }`}
          title={currentUser ? `Logged in as ${currentUser.name}` : 'Log In or Create Account'}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-5 h-5 shrink-0 flex items-center justify-center">
              {currentUser ? (
                <span className="text-base select-none">{currentUser.avatar}</span>
              ) : (
                <div className="w-5 h-5 rounded-md bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <User className="w-3 h-3" />
                </div>
              )}
            </div>
            <div className={`transition-all duration-300 overflow-hidden whitespace-nowrap truncate text-left ${
              isExpanded ? 'opacity-100 max-w-[110px]' : 'opacity-0 max-w-0 pointer-events-none'
            }`}>
              <div className="text-xs font-bold text-white truncate">
                {currentUser ? currentUser.name : 'Guest Student'}
              </div>
              <div className="text-[10px] text-indigo-300 truncate">
                {currentUser ? `${currentUser.grade} • ${currentUser.country}` : 'Log In / Register'}
              </div>
            </div>
          </div>
          <span className={`transition-all duration-300 overflow-hidden whitespace-nowrap text-[10px] text-slate-500 group-hover:text-indigo-400 shrink-0 font-mono ${
            isExpanded ? 'opacity-100 max-w-[45px]' : 'opacity-0 max-w-0 pointer-events-none'
          }`}>
            {currentUser ? 'Profile' : 'Sign In'}
          </span>
        </button>

        {/* Settings Button */}
        <button
          onClick={() => {
            onOpenSettings();
            if (onCloseMobile) onCloseMobile();
          }}
          title={`Settings (Level ${stats.level})`}
          className={`w-full flex items-center rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/[0.04] transition-all duration-300 cursor-pointer overflow-hidden ${
            isExpanded ? 'justify-between px-3 py-2' : 'justify-center px-0 h-10'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-5 h-5 shrink-0 flex items-center justify-center">
              <Settings className="w-4 h-4" />
            </div>
            <span className={`transition-all duration-300 overflow-hidden whitespace-nowrap ${
              isExpanded ? 'opacity-100 max-w-[100px]' : 'opacity-0 max-w-0 pointer-events-none'
            }`}>
              Settings
            </span>
          </div>
          <span className={`transition-all duration-300 overflow-hidden whitespace-nowrap text-[10px] text-slate-500 ${
            isExpanded ? 'opacity-100 max-w-[40px]' : 'opacity-0 max-w-0 pointer-events-none'
          }`}>
            Lvl {stats.level}
          </span>
        </button>

        {/* Dedicated Desktop Collapse / Expand Button */}
        {!isMobile && (
          <button
            onClick={toggleCollapse}
            title={isCollapsed ? "Pin sidebar open [Ctrl+[]" : "Shrink sidebar (leave only icons) [Ctrl+[]"}
            className={`w-full flex items-center rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-200 hover:bg-white/[0.06] transition-all duration-300 cursor-pointer overflow-hidden border border-transparent hover:border-white/[0.08] ${
              isExpanded ? 'justify-between px-3 py-2' : 'justify-center px-0 h-10'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                {isCollapsed ? (
                  <PanelLeftOpen className="w-4 h-4 text-indigo-400" />
                ) : (
                  <PanelLeftClose className="w-4 h-4 text-slate-400" />
                )}
              </div>
              <span className={`transition-all duration-300 overflow-hidden whitespace-nowrap ${
                isExpanded ? 'opacity-100 max-w-[120px]' : 'opacity-0 max-w-0 pointer-events-none'
              }`}>
                {isCollapsed ? 'Pin Sidebar' : 'Shrink Sidebar'}
              </span>
            </div>
            <span className={`transition-all duration-300 overflow-hidden whitespace-nowrap text-[9px] font-mono text-slate-500 bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/[0.05] ${
              isExpanded ? 'opacity-100 max-w-[45px]' : 'opacity-0 max-w-0 pointer-events-none'
            }`}>
              Ctrl+[
            </span>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar Container (Spacer) */}
      <aside 
        className={`hidden md:block shrink-0 relative z-30 select-none transition-[width] duration-300 ease-in-out ${
          isCollapsed ? 'w-[72px]' : 'w-60 xl:w-64'
        }`}
      >
        {/* Floating / Sliding Visual Sidebar Panel */}
        <div 
          onMouseEnter={() => {
            if (isCollapsed) setIsHovered(true);
          }}
          onMouseLeave={() => {
            if (isCollapsed) setIsHovered(false);
          }}
          className={`h-screen sticky top-0 flex flex-col border-r border-white/[0.08] bg-[#090a10]/95 backdrop-blur-xl transition-[width,box-shadow,border-color,background-color] duration-300 ease-in-out overflow-x-hidden ${
            isEffectiveExpanded 
              ? 'w-60 xl:w-64 ' + (isCollapsed && isHovered ? 'shadow-2xl shadow-indigo-950/70 bg-[#090a10]/98 border-r border-indigo-500/40 z-50' : '')
              : 'w-[72px]'
          } ${isEffectiveExpanded ? 'p-4' : 'px-3 py-4'}`}
        >
          {renderNavContent(isEffectiveExpanded, false)}
        </div>
      </aside>

      {/* Mobile Drawer */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" 
            onClick={onCloseMobile}
          />
          <aside className="relative w-72 max-w-[80vw] bg-[#090a10] border-r border-white/[0.1] h-full p-4 flex flex-col z-10 shadow-2xl">
            {renderNavContent(true, true)}
          </aside>
        </div>
      )}
    </>
  );
};
