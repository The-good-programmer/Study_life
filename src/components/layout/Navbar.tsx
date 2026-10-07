import React, { useState, useEffect, useRef } from 'react';
import {
  Flame,
  Volume2,
  VolumeX,
  Search,
  WifiOff,
  Download,
  Menu,
  PanelLeftOpen,
  Sun,
  Moon,
  CircleHelp,
  Check,
} from 'lucide-react';
import { soundEngine } from '../../services/soundEngine';
import type { SoundType } from '../../services/soundEngine';
import type { UserStats, UserAccount } from '../../types';
import { StreakGuardianModal } from '../mascot/StreakGuardianModal';
import { CognitiveTourModal } from '../onboarding/CognitiveTourModal';
import { lifeSimService } from '../../services/lifeSimService';
import { BrandMark, CoinIcon, IconButton, Kbd } from '../ui/primitives';
import { cn } from '../../utils/cn';

type View = 'home' | 'dashboard' | 'exam' | 'interleave' | 'sanctuary' | 'studio' | 'folders';

interface NavbarProps {
  stats: UserStats;
  currentUser?: UserAccount | null;
  onOpenAuth?: (tab?: 'login' | 'register' | 'profile') => void;
  activeView?: View;
  onNavigate?: (view: View) => void;
  onOpenSettings: () => void;
  onOpenDashboard?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenExam?: () => void;
  onOpenInterleaving?: () => void;
  onOpenStarterCatalog?: () => void;
  onOpenSanctuary?: () => void;
  onLogoClick?: () => void;
  onToggleMobileSidebar?: () => void;
  isOnline?: boolean;
  isInstallable?: boolean;
  onPromptInstall?: () => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebarCollapse?: () => void;
  onOpenCharacterCustomizer?: () => void;
}

const VIEW_TITLES: Record<View, string> = {
  home: 'Today',
  studio: 'Library',
  folders: 'Subjects',
  dashboard: 'Insights',
  exam: 'Mock exam',
  interleave: 'Mix decks',
  sanctuary: 'Campus',
};

const SOUND_PRESETS: { id: SoundType; label: string; desc: string }[] = [
  { id: 'off', label: 'Off', desc: 'No background sound' },
  { id: 'binaural-40hz', label: '40 Hz tone', desc: 'Steady background tone' },
  { id: 'binaural-alpha-10hz', label: 'Alpha waves', desc: 'Calm, relaxed focus' },
  { id: 'brown-noise', label: 'Brown noise', desc: 'Masks speech and background noise' },
  { id: 'pink-noise', label: 'Pink noise', desc: 'Balanced, softer than white noise' },
  { id: 'rain', label: 'Rain', desc: 'Gentle, steady rainfall' },
  { id: 'ambient-drone', label: 'Ambient pad', desc: 'Warm, slow chord' },
];

const THEME_STORAGE_KEY = 'axon_theme';

export const Navbar: React.FC<NavbarProps> = ({
  stats,
  currentUser,
  onOpenAuth,
  activeView = 'home',
  onNavigate,
  onOpenDashboard,
  onOpenCommandPalette,
  onOpenStarterCatalog,
  onOpenSanctuary,
  onLogoClick,
  onToggleMobileSidebar,
  isOnline = true,
  isInstallable = false,
  onPromptInstall,
  isSidebarCollapsed = false,
  onToggleSidebarCollapse,
}) => {
  const [currentSound, setCurrentSound] = useState<SoundType>(soundEngine.getCurrentSound());
  const [volume, setVolume] = useState(soundEngine.getVolume());
  const [isSoundMenuOpen, setIsSoundMenuOpen] = useState(false);
  const soundMenuRef = useRef<HTMLDivElement>(null);
  const [isStreakModalOpen, setIsStreakModalOpen] = useState(false);
  const [isTourModalOpen, setIsTourModalOpen] = useState(() => {
    try {
      return localStorage.getItem('axon_tour_seen') !== 'true';
    } catch {
      return false;
    }
  });
  const [isPaperTheme, setIsPaperTheme] = useState(() => {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY) === 'paper';
    } catch {
      return false;
    }
  });
  const [walletCoins, setWalletCoins] = useState(() => lifeSimService.getWalletBalance());

  useEffect(() => {
    // Switch instantly: without this, every element with a color transition fades between themes.
    const root = document.documentElement;
    root.classList.add('theme-switching');
    if (isPaperTheme) root.setAttribute('data-theme', 'paper');
    else root.removeAttribute('data-theme');
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-switching')));
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isPaperTheme ? '#f6f6f3' : '#0a0a0f');
    return () => {
      cancelAnimationFrame(frame);
      root.classList.remove('theme-switching');
    };
  }, [isPaperTheme]);

  useEffect(() => {
    const unsubSound = soundEngine.subscribe((sound, vol) => {
      setCurrentSound(sound);
      setVolume(vol);
    });
    const unsubLife = lifeSimService.subscribe(() => setWalletCoins(lifeSimService.getWalletBalance()));
    return () => {
      unsubSound();
      unsubLife();
    };
  }, []);

  // Close the sound menu on outside click or Escape.
  useEffect(() => {
    if (!isSoundMenuOpen) return;
    const onPointer = (e: MouseEvent) => {
      if (soundMenuRef.current && !soundMenuRef.current.contains(e.target as Node)) setIsSoundMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsSoundMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [isSoundMenuOpen]);

  const toggleTheme = () => {
    setIsPaperTheme(prev => {
      const next = !prev;
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next ? 'paper' : 'dark');
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setVolume(value);
    soundEngine.setVolume(value);
  };

  const dailyGoal = stats.dailyGoalMinutes || 25;
  const todayMinutes = stats.todayMinutes || 0;
  const goalPercent = Math.min(100, Math.round((todayMinutes / dailyGoal) * 100));
  const goalDone = goalPercent >= 100;
  const ringRadius = 7;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const isSoundOn = currentSound !== 'off';

  return (
    <>
      <header className="sticky top-0 z-30 w-full border-b border-line bg-canvas/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-1.5 px-3 sm:gap-2 sm:px-6">
          {onToggleMobileSidebar && (
            <div className="flex md:hidden">
              <IconButton icon={Menu} label="Open navigation" onClick={onToggleMobileSidebar} />
            </div>
          )}
          <button type="button" onClick={onLogoClick} className="mr-1 md:hidden cursor-pointer" aria-label="Studify home">
            <BrandMark size={26} />
          </button>
          {onToggleSidebarCollapse && isSidebarCollapsed && (
            <div className="hidden md:flex">
              <IconButton icon={PanelLeftOpen} label="Expand sidebar" onClick={onToggleSidebarCollapse} />
            </div>
          )}

          <h1 className="hidden shrink-0 text-[15px] font-semibold tracking-tight text-ink sm:block">
            {VIEW_TITLES[activeView]}
          </h1>

          <div className="flex-1" />

          {onOpenCommandPalette && (
            <>
              <button
                type="button"
                onClick={onOpenCommandPalette}
                className="hidden h-9 w-64 min-w-0 shrink items-center gap-2 rounded-lg border border-line bg-surface px-3 text-[13px] text-ink-subtle transition-colors hover:border-line-strong hover:text-ink-muted lg:flex cursor-pointer"
              >
                <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="flex-1 truncate text-left">Search decks and cards</span>
                <Kbd>⌘K</Kbd>
              </button>
              <div className="flex lg:hidden">
                <IconButton icon={Search} label="Search" onClick={onOpenCommandPalette} />
              </div>
            </>
          )}

          <div className="mx-1 hidden h-5 w-px bg-line sm:block" aria-hidden="true" />

          {/* Daily goal */}
          <div
            title={`Daily goal: ${todayMinutes} of ${dailyGoal} minutes`}
            className="hidden h-9 items-center gap-2 rounded-lg px-2 text-[13px] sm:flex"
          >
            <svg width="18" height="18" className="-rotate-90" aria-hidden="true">
              <circle cx="9" cy="9" r={ringRadius} fill="none" stroke="var(--surface-hover)" strokeWidth="2.5" />
              <circle
                cx="9"
                cy="9"
                r={ringRadius}
                fill="none"
                stroke={goalDone ? 'var(--success)' : 'var(--brand)'}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={ringCircumference}
                strokeDashoffset={ringCircumference * (1 - goalPercent / 100)}
                className="transition-[stroke-dashoffset] duration-500"
              />
            </svg>
            <span className="tabular-nums text-ink">
              {todayMinutes}
              <span className="text-ink-subtle">/{dailyGoal}m</span>
            </span>
            {goalDone && <Check className="h-3.5 w-3.5 text-success" aria-label="Goal complete" />}
          </div>

          {/* Streak */}
          <button
            type="button"
            onClick={() => setIsStreakModalOpen(true)}
            title="Streak"
            aria-label={`${stats.currentStreak} day streak`}
            className="flex h-9 items-center gap-1.5 rounded-lg px-2 text-[13px] font-medium tabular-nums text-ink transition-colors hover:bg-surface-hover cursor-pointer"
          >
            <Flame className={cn('h-4 w-4', stats.currentStreak > 0 ? 'fill-gold text-gold' : 'text-ink-subtle')} aria-hidden="true" />
            {stats.currentStreak}
          </button>

          {/* Wallet */}
          <button
            type="button"
            onClick={() => (onNavigate ? onNavigate('sanctuary') : onOpenSanctuary?.())}
            title="Wallet: open Campus"
            aria-label={`${walletCoins} tokens, open Campus`}
            className="flex h-9 items-center gap-1.5 rounded-lg px-2 text-[13px] font-semibold tabular-nums text-gold transition-colors hover:bg-gold-soft cursor-pointer"
          >
            <CoinIcon className="h-4 w-4" />
            {walletCoins.toLocaleString()}
          </button>

          <div className="mx-1 hidden h-5 w-px bg-line sm:block" aria-hidden="true" />

          {!isOnline && (
            <span
              title="You're offline. Decks and reviews still work."
              className="hidden h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-gold sm:flex"
            >
              <WifiOff className="h-4 w-4" aria-hidden="true" />
              Offline
            </span>
          )}

          {isInstallable && onPromptInstall && (
            <div className="hidden sm:flex">
              <IconButton icon={Download} label="Install app" onClick={onPromptInstall} />
            </div>
          )}

          {/* Focus sound */}
          <div className="relative hidden sm:block" ref={soundMenuRef}>
            <IconButton
              icon={isSoundOn ? Volume2 : VolumeX}
              label="Focus sound"
              active={isSoundOn}
              aria-expanded={isSoundMenuOpen}
              aria-haspopup="menu"
              onClick={() => setIsSoundMenuOpen(open => !open)}
            />
            {isSoundMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-11 z-50 w-72 rounded-xl border border-line-strong bg-surface-solid p-1.5 shadow-2xl animate-fadeIn"
              >
                <div className="px-2.5 pb-1.5 pt-1 text-xs font-medium text-ink-subtle">Focus sound</div>
                <div className="max-h-64 space-y-0.5 overflow-y-auto">
                  {SOUND_PRESETS.map(sound => {
                    const selected = currentSound === sound.id;
                    return (
                      <button
                        key={sound.id}
                        type="button"
                        role="menuitemradio"
                        aria-checked={selected}
                        onClick={() => soundEngine.play(sound.id)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors cursor-pointer',
                          selected ? 'bg-brand-soft' : 'hover:bg-surface-hover',
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className={cn('block text-[13px] font-medium', selected ? 'text-brand-text' : 'text-ink')}>{sound.label}</span>
                          <span className="block truncate text-xs text-ink-subtle">{sound.desc}</span>
                        </span>
                        {selected && <Check className="h-4 w-4 shrink-0 text-brand-text" aria-hidden="true" />}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-1.5 flex items-center gap-2.5 border-t border-line px-2.5 pb-1 pt-2.5">
                  <Volume2 className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={volume}
                    onChange={handleVolumeChange}
                    aria-label="Volume"
                    className="h-1.5 w-full cursor-pointer accent-[var(--brand)]"
                  />
                  <span className="w-8 text-right text-xs tabular-nums text-ink-subtle">{Math.round(volume * 100)}%</span>
                </div>
              </div>
            )}
          </div>

          <div className="hidden items-center sm:flex">
            <IconButton
              icon={isPaperTheme ? Moon : Sun}
              label={isPaperTheme ? 'Switch to dark theme' : 'Switch to light theme'}
              onClick={toggleTheme}
            />
            <IconButton icon={CircleHelp} label="How Studify works" onClick={() => setIsTourModalOpen(true)} />
          </div>

          {/* Account */}
          <button
            type="button"
            onClick={() => onOpenAuth?.(currentUser ? 'profile' : 'login')}
            aria-label={currentUser ? `Account: ${currentUser.name}` : 'Log in'}
            title={currentUser ? `${currentUser.name} (${currentUser.email})` : 'Log in or create an account'}
            className="ml-0.5 flex h-9 items-center gap-2 rounded-full pl-0.5 pr-0.5 transition-colors hover:bg-surface-hover sm:pr-3 cursor-pointer"
          >
            <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-brand-soft text-sm font-semibold text-brand-text">
              {currentUser ? currentUser.avatar || currentUser.name.charAt(0).toUpperCase() : 'G'}
            </span>
            <span className="hidden max-w-[120px] truncate text-[13px] font-medium text-ink sm:inline">
              {currentUser ? currentUser.name.split(' ')[0] : 'Log in'}
            </span>
          </button>
        </div>
      </header>

      <StreakGuardianModal
        isOpen={isStreakModalOpen}
        onClose={() => setIsStreakModalOpen(false)}
        stats={stats}
        onLaunchStreakSaver={onOpenDashboard}
      />

      <CognitiveTourModal
        isOpen={isTourModalOpen}
        onClose={() => {
          setIsTourModalOpen(false);
          try {
            localStorage.setItem('axon_tour_seen', 'true');
          } catch {
            // ignore
          }
        }}
        onStartQuickSession={onOpenStarterCatalog}
      />
    </>
  );
};
