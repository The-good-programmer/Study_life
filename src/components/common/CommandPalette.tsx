import React, { useState, useEffect, useRef } from 'react';
import { Search, Brain, Volume2, Sparkles, BookMarked, Layers, Settings, X, ArrowRight, Compass, Plus, Award, Bug, Shuffle, Eye, Zap, Headphones, BrainCircuit, User } from 'lucide-react';
import type { StudySession } from '../../types';
import { StorageService } from '../../services/storageService';
import { CURATED_STARTER_DECKS } from '../../data/curatedStarterCatalog';
import { soundEngine } from '../../services/soundEngine';
import type { SoundType } from '../../services/soundEngine';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onStartSession: (session: StudySession) => void;
  onOpenDashboard: () => void;
  onOpenSettings: () => void;
  onOpenAuth?: (tab?: 'login' | 'register' | 'profile') => void;
  onOpenDeckStation?: (session: StudySession) => void;
  onStartMatch?: (session: StudySession) => void;
  onStartAudioBriefing?: (session: StudySession) => void;
  onOpenDeckStudio?: () => void;
  onOpenImageOcclusion?: () => void;
  onOpenExam?: () => void;
  onOpenInterleaving?: () => void;
  onOpenStarterCatalog?: () => void;
  onOpenSanctuary?: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onStartSession,
  onOpenDashboard,
  onOpenSettings,
  onOpenAuth,
  onOpenDeckStation,
  onStartMatch,
  onStartAudioBriefing,
  onOpenDeckStudio,
  onOpenImageOcclusion,
  onOpenExam,
  onOpenInterleaving,
  onOpenStarterCatalog,
  onOpenSanctuary,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const savedDecks = StorageService.getSessions();
  const allDecks: { title: string; category: string; session: StudySession; isCurated?: boolean }[] = [
    ...savedDecks.map(s => ({ title: s.title, category: s.category || 'My Library', session: s, isCurated: false })),
    ...CURATED_STARTER_DECKS.map(d => ({ title: d.title, category: d.category, session: d.session, isCurated: true })),
  ];

  const soundOptions: { id: SoundType; label: string; desc: string }[] = [
    { id: 'binaural-40hz', label: 'Play 40Hz Gamma Focus Audio', desc: 'Focus soundscape for intense study sessions' },
    { id: 'binaural-alpha-10hz', label: 'Play 10Hz Alpha Flow Wave', desc: 'Calm, relaxed concentration' },
    { id: 'brown-noise', label: 'Play Brownian Noise', desc: 'Masks distracting conversations' },
    { id: 'pink-noise', label: 'Play Pink Noise', desc: 'Clinically proven memory stabilization' },
    { id: 'rain', label: 'Play Gentle Rain', desc: 'Organic white noise' },
    { id: 'off', label: 'Mute Focus Audio', desc: 'Silence all audio generators' },
  ];

  // Action items
  interface ActionItem {
    id: string;
    title: string;
    subtitle: string;
    icon: React.ComponentType<{ className?: string }>;
    category: 'Decks' | 'Audio' | 'Navigation' | 'Extras';
    action: () => void;
  }

  const actions: ActionItem[] = [
    ...allDecks.map(d => ({
      id: `deck-${d.session.id}`,
      title: d.title,
      subtitle: `${d.category} • Deck Station Hub & Modes`,
      icon: d.isCurated ? Sparkles : BookMarked,
      category: 'Decks' as const,
      action: () => {
        if (onOpenDeckStation) {
          onOpenDeckStation(d.session);
        } else {
          onStartSession(d.session);
        }
        onClose();
      }
    })),
    ...allDecks.map(d => ({
      id: `match-${d.session.id}`,
      title: `Speed Match: ${d.title}`,
      subtitle: `60-Second Associative Pairing Arena • ${d.category}`,
      icon: Zap,
      category: 'Decks' as const,
      action: () => {
        if (onStartMatch) {
          onStartMatch(d.session);
        } else {
          onStartSession(d.session);
        }
        onClose();
      }
    })),
    ...allDecks.map(d => ({
      id: `audio-${d.session.id}`,
      title: `Audio Briefing: ${d.title}`,
      subtitle: `Narrated Conversational Overview • ${d.category}`,
      icon: Headphones,
      category: 'Decks' as const,
      action: () => {
        if (onStartAudioBriefing) {
          onStartAudioBriefing(d.session);
        } else {
          onStartSession(d.session);
        }
        onClose();
      }
    })),
    ...soundOptions.map(s => ({
      id: `sound-${s.id}`,
      title: s.label,
      subtitle: s.desc,
      icon: Volume2,
      category: 'Audio' as const,
      action: () => {
        soundEngine.play(s.id);
        onClose();
      }
    })),
    {
      id: 'nav-starter-catalog',
      title: 'Browse High-Yield Starter Catalog',
      subtitle: 'Ready-made decks: AP Biology, Spanish, CS, memory science, plus MCAT & USMLE',
      icon: Sparkles,
      category: 'Navigation' as const,
      action: () => {
        if (onOpenStarterCatalog) onOpenStarterCatalog();
        onClose();
      }
    },
    {
      id: 'nav-dashboard',
      title: 'Open Retention & FSRS Dashboard',
      subtitle: 'View memory decay curves, heatmaps & due cards',
      icon: Layers,
      category: 'Navigation' as const,
      action: () => {
        onOpenDashboard();
        onClose();
      }
    },
    {
      id: 'nav-knowledge-tree',
      title: 'Macro-Curriculum Knowledge Tree (KST)',
      subtitle: 'Prerequisite hierarchy mapping & Zone of Proximal Development',
      icon: BrainCircuit,
      category: 'Navigation' as const,
      action: () => {
        onOpenDashboard();
        onClose();
      }
    },
    {
      id: 'nav-leech-hunter',
      title: 'FSRS Leech Hunter & Mnemonic Rewiring Lab',
      subtitle: 'Identify and cure chronic memory lapses with root-cause autopsies',
      icon: Bug,
      category: 'Navigation' as const,
      action: () => {
        onOpenDashboard();
        onClose();
      }
    },
    {
      id: 'nav-deck-studio',
      title: 'Open Deck Studio & Card Architect',
      subtitle: 'Create custom cards (Standard, Cloze Deletion, Multiple Choice)',
      icon: Plus,
      category: 'Navigation' as const,
      action: () => {
        if (onOpenDeckStudio) onOpenDeckStudio();
        onClose();
      }
    },
    {
      id: 'nav-exam-simulator',
      title: 'Launch Mock Exam Simulator',
      subtitle: 'High-stakes testing with Confidence-Weighted Scoring & Blindspot detection',
      icon: Award,
      category: 'Navigation' as const,
      action: () => {
        if (onOpenExam) onOpenExam();
        onClose();
      }
    },
    {
      id: 'nav-interleaving-arena',
      title: 'Launch Cross-Deck Interleaving Arena',
      subtitle: 'Dynamic domain switching to build inductive categorization & agility',
      icon: Shuffle,
      category: 'Navigation' as const,
      action: () => {
        if (onOpenInterleaving) onOpenInterleaving();
        onClose();
      }
    },
    {
      id: 'nav-import-anki',
      title: 'Import Anki / Quizlet / CSV Deck',
      subtitle: '1-click import from .tsv or .csv files or clipboard',
      icon: BookMarked,
      category: 'Navigation' as const,
      action: () => {
        if (onOpenDeckStudio) onOpenDeckStudio();
        onClose();
      }
    },
    {
      id: 'nav-image-occlusion',
      title: 'Image Occlusion Architect & Visual Studio',
      subtitle: 'Draw draggable occlusion masks over anatomical, technical, or textbook diagrams',
      icon: Eye,
      category: 'Navigation' as const,
      action: () => {
        if (onOpenImageOcclusion) onOpenImageOcclusion();
        else if (onOpenDeckStudio) onOpenDeckStudio();
        onClose();
      }
    },
    {
      id: 'nav-account',
      title: 'Student Account & Profile / Log In',
      subtitle: 'Manage local-first accounts, switch profiles, change learning grade level',
      icon: User,
      category: 'Navigation' as const,
      action: () => {
        if (onOpenAuth) onOpenAuth();
        onClose();
      }
    },
    {
      id: 'nav-settings',
      title: 'Open Lotti Settings & Preferences',
      subtitle: 'Gemini API key, Anki exports, data backup',
      icon: Settings,
      category: 'Navigation' as const,
      action: () => {
        onOpenSettings();
        onClose();
      }
    },
    {
      id: 'nav-3d-sanctuary',
      title: 'Home & Room Designer',
      subtitle: 'Design your room and spend study tokens (optional extra)',
      icon: Sparkles,
      category: 'Extras' as const,
      action: () => {
        if (onOpenSanctuary) onOpenSanctuary();
        onClose();
      }
    }
  ];

  const filtered = actions.filter(a => {
    const q = query.toLowerCase().trim();
    if (!q) return true;
    return a.title.toLowerCase().includes(q) || a.subtitle.toLowerCase().includes(q) || a.category.toLowerCase().includes(q);
  });

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Keyboard navigation inside palette
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1 < filtered.length ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 >= 0 ? prev - 1 : filtered.length - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          filtered[selectedIndex].action();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filtered, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-start justify-center pt-16 sm:pt-24 p-4 animate-fadeIn">
      <div 
        className="max-w-2xl w-full rounded-2xl bg-[#0d101d] border border-white/[0.12] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.08] bg-slate-950/60">
          <Search className="w-5 h-5 text-indigo-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search decks, focus audio, shortcuts... (e.g. 'FSRS', '40Hz', 'Quantum')"
            className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-slate-500 font-medium"
          />
          {query && (
            <button 
              onClick={() => setQuery('')}
              className="p-1 rounded-md text-slate-500 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[11px] font-mono bg-white/[0.06] border border-white/[0.1] rounded text-slate-400">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="overflow-y-auto p-2 space-y-1 flex-1">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <Compass className="w-8 h-8 mx-auto text-slate-600" />
              <p className="text-xs">No matching commands or study decks found.</p>
            </div>
          ) : (
            filtered.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                      : 'text-slate-300 hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-1.5 rounded-lg shrink-0 ${isSelected ? 'bg-indigo-500 text-white' : 'bg-slate-900 border border-white/[0.08] text-slate-400'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate leading-snug">
                        {item.title}
                      </div>
                      <div className={`text-[11px] truncate ${isSelected ? 'text-indigo-100' : 'text-slate-500'}`}>
                        {item.subtitle}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[11px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${
                      isSelected ? 'bg-indigo-700/60 text-indigo-100' : 'bg-white/[0.05] text-slate-500 border border-white/[0.05]'
                    }`}>
                      {item.category}
                    </span>
                    {isSelected && (
                      <ArrowRight className="w-3.5 h-3.5 text-indigo-200" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts hint */}
        <div className="px-4 py-2 bg-slate-950/80 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-3">
            <span><kbd className="font-mono bg-white/[0.06] px-1 py-0.5 rounded text-slate-400">↑↓</kbd> Navigate</span>
            <span><kbd className="font-mono bg-white/[0.06] px-1 py-0.5 rounded text-slate-400">↵</kbd> Select</span>
          </div>
          <div className="flex items-center gap-1.5 text-indigo-400">
            <Brain className="w-3.5 h-3.5" />
            <span>Lotti Omnibar</span>
          </div>
        </div>

      </div>
    </div>
  );
};
