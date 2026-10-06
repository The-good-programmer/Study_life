import React, { useState, useEffect } from 'react';
import { 
  Flame, 
  Layers, 
  Volume2, 
  VolumeX, 
  Settings, 
  Sparkles, 
  CheckCircle2, 
  Search, 
  Award, 
  Shuffle, 
  WifiOff, 
  Download,
  Compass,
  Menu,
  User,
  PanelLeftOpen,
  Sun,
  Moon
} from 'lucide-react';
import { soundEngine } from '../../services/soundEngine';
import type { SoundType } from '../../services/soundEngine';
import type { UserStats, UserAccount } from '../../types';
import { StreakGuardianModal } from '../mascot/StreakGuardianModal';
import { CognitiveTourModal } from '../onboarding/CognitiveTourModal';
import { lifeSimService } from '../../services/lifeSimService';
import { UserAvatarBadge } from '../character/UserAvatarBadge';

interface NavbarProps {
  stats: UserStats;
  currentUser?: UserAccount | null;
  onOpenAuth?: (tab?: 'login' | 'register' | 'profile') => void;
  activeView?: 'home' | 'dashboard' | 'exam' | 'interleave' | 'sanctuary' | 'studio' | 'folders';
  onNavigate?: (view: 'home' | 'dashboard' | 'exam' | 'interleave' | 'sanctuary' | 'studio' | 'folders') => void;
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

export const Navbar: React.FC<NavbarProps> = ({ 
  stats, 
  currentUser,
  onOpenAuth,
  activeView = 'home',
  onNavigate,
  onOpenSettings, 
  onOpenDashboard, 
  onOpenCommandPalette, 
  onOpenExam,
  onOpenInterleaving,
  onOpenStarterCatalog,
  onOpenSanctuary,
  onOpenCharacterCustomizer,
  onLogoClick,
  onToggleMobileSidebar,
  isOnline = true,
  isInstallable = false,
  onPromptInstall,
  isSidebarCollapsed = false,
  onToggleSidebarCollapse,
}) => {
  const [currentSound, setCurrentSound] = useState<SoundType>(soundEngine.getCurrentSound());
  const [soundMenuOpen, setSoundMenuOpen] = useState(false);
  const [volume, setVolume] = useState(soundEngine.getVolume());
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
      return localStorage.getItem('axon_theme') === 'paper';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      if (isPaperTheme) {
        document.documentElement.setAttribute('data-theme', 'paper');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
    } catch {}
  }, [isPaperTheme]);

  const handleToggleTheme = () => {
    setIsPaperTheme(prev => {
      const next = !prev;
      try {
        localStorage.setItem('axon_theme', next ? 'paper' : 'dark');
        if (next) {
          document.documentElement.setAttribute('data-theme', 'paper');
        } else {
          document.documentElement.removeAttribute('data-theme');
        }
      } catch {}
      return next;
    });
  };

  // Listen to sound engine state changes
  useEffect(() => {
    const unsubscribe = soundEngine.subscribe((sound, vol) => {
      setCurrentSound(sound);
      setVolume(vol);
    });
    return unsubscribe;
  }, []);

  const handleSoundChange = (type: SoundType) => {
    soundEngine.play(type);
    setCurrentSound(type);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    soundEngine.setVolume(val);
  };

  // Daily goal calculation
  const dailyGoal = stats.dailyGoalMinutes || 25;
  const todayMinutes = stats.todayMinutes || 0;
  const goalPercent = Math.min(100, Math.round((todayMinutes / dailyGoal) * 100));
  const goalCompleted = goalPercent >= 100;

  // Student wallet balance
  const [walletCoins, setWalletCoins] = useState(() => lifeSimService.getWalletBalance());
  useEffect(() => {
    const unsub = lifeSimService.subscribe(() => {
      setWalletCoins(lifeSimService.getWalletBalance());
    });
    return unsub;
  }, []);

  const soundPresets: { id: SoundType; label: string; desc: string; icon: string }[] = [
    { id: 'off', label: 'Mute Audio', desc: 'Silence focus synthesizers', icon: '🔇' },
    { id: 'binaural-40hz', label: '40Hz Gamma Waves', desc: 'Focus soundscape & acoustic masking', icon: '🧠' },
    { id: 'binaural-alpha-10hz', label: '10Hz Alpha Waves', desc: 'Relaxed focus & anxiety reduction', icon: '🧘' },
    { id: 'brown-noise', label: 'Brownian Deep Noise', desc: 'Acoustic masking of speech & background', icon: '🌊' },
    { id: 'pink-noise', label: 'Spectral Pink Noise', desc: 'Balanced frequencies for memory stabilization', icon: '🌸' },
    { id: 'rain', label: 'Gentle Steady Rain', desc: 'Calming natural broadband soundscape', icon: '🌧️' },
    { id: 'ambient-drone', label: 'Solfeggio Meditative Drone', desc: 'Warm chord pad for deep immersion', icon: '🎵' },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-white/[0.08] bg-[#090a10]/85 backdrop-blur-xl transition-all">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-3">
        
        {/* Left: Mobile Drawer Trigger + Brand Identity */}
        <div className="flex items-center gap-3 shrink-0">
          {onToggleMobileSidebar && (
            <button
              onClick={onToggleMobileSidebar}
              className="md:hidden p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-slate-300 hover:text-white transition-all cursor-pointer"
              aria-label="Open Navigation"
              title="Open Navigation"
            >
              <Menu className="w-4 h-4" />
            </button>
          )}

          <div 
            onClick={onLogoClick}
            className="flex items-center gap-2.5 cursor-pointer group select-none md:hidden"
          >
            <div className="relative w-8 h-8 rounded-xl overflow-hidden p-0.5 bg-gradient-to-tr from-indigo-500 via-purple-500 to-cyan-400 shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-all flex items-center justify-center">
              <UserAvatarBadge size="xs" />
            </div>
            <span className="font-extrabold text-base text-white tracking-tight font-display">Studify</span>
          </div>

          {/* Desktop Sidebar Expand Toggle (visible when sidebar is collapsed) */}
          {onToggleSidebarCollapse && isSidebarCollapsed && (
            <button
              onClick={onToggleSidebarCollapse}
              className="hidden md:flex p-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-indigo-400 hover:text-indigo-300 transition-all cursor-pointer mr-1"
              aria-label="Expand Sidebar"
              title="Expand Sidebar [Ctrl+[]"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          )}

          <div className="hidden md:flex items-center gap-2.5 text-xs font-semibold text-slate-400">
            <span className="text-indigo-400">⚡</span>
            <span className="text-slate-300 capitalize">
              {activeView === 'home' ? 'Home & Decks' : activeView === 'dashboard' ? 'FSRS Retention' : activeView === 'exam' ? 'Mock Exam' : activeView === 'sanctuary' ? 'Home & Design' : activeView === 'studio' ? 'Document Studio' : 'Interleaving'}
            </span>
            
            <button
              onClick={() => setIsTourModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-400 hover:text-white transition-all cursor-pointer shadow-sm group"
              title="Interactive tour: How Studify's 4-Phase Cognitive Architecture Works"
            >
              <span className="text-[11px] font-semibold">How it Works</span>
            </button>
          </div>
        </div>

        {/* Center: Quizlet-style Wide Search Bar */}
        {onOpenCommandPalette && (
          <button
            onClick={onOpenCommandPalette}
            className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-slate-900/90 hover:bg-slate-850 border border-white/[0.1] hover:border-indigo-500/50 text-slate-400 hover:text-slate-200 text-xs transition-all shadow-sm flex-1 max-w-xs sm:max-w-md lg:max-w-lg mx-2 justify-between group cursor-pointer"
          >
            <div className="flex items-center gap-2.5 truncate">
              <Search className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 transition-colors shrink-0" />
              <span className="text-slate-400 group-hover:text-slate-200 truncate">Search flashcards, topics, decks...</span>
            </div>
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[11px] font-mono bg-white/[0.08] border border-white/[0.1] rounded text-slate-400 shrink-0">
              ⌘K
            </kbd>
          </button>
        )}

        {/* Right: Live Metrics & Controls */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          
          {/* Student Token Wallet Badge */}
          <button 
            type="button"
            onClick={() => onNavigate ? onNavigate('sanctuary') : onOpenSanctuary?.()}
            title={`Student Wallet: 🪙 ${walletCoins} Tokens — Click to visit Campus Life & Cafeteria`}
            className="hidden xl:flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-850 border border-amber-500/30 hover:border-amber-500/60 text-xs font-medium cursor-pointer transition-colors shadow-sm group"
          >
            <div className="w-5 h-5 rounded-md bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold text-xs">
              🪙
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-black text-amber-300 text-xs">
                {walletCoins}
              </span>
              <span className="text-[11px] text-slate-400 group-hover:text-amber-200 transition-colors">Tokens</span>
            </div>
          </button>

          {/* Daily Goal Radial Ring */}
          <div 
            title={`Daily Target: ${todayMinutes}m of ${dailyGoal}m completed (${goalPercent}%)`}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-900/80 border border-white/[0.08] text-xs font-medium cursor-help hover:border-indigo-500/40 transition-colors"
          >
            <div className="relative w-5 h-5 flex items-center justify-center">
              <svg className="w-5 h-5 transform -rotate-90">
                <circle
                  cx="10"
                  cy="10"
                  r={8}
                  stroke="#1e293b"
                  strokeWidth="2.2"
                  fill="transparent"
                />
                <circle
                  cx="10"
                  cy="10"
                  r={8}
                  stroke={goalCompleted ? '#10b981' : '#6366f1'}
                  strokeWidth="2.2"
                  strokeDasharray={2 * Math.PI * 8}
                  strokeDashoffset={2 * Math.PI * 8 - (goalPercent / 100) * (2 * Math.PI * 8)}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-500"
                />
              </svg>
              {goalCompleted ? (
                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 absolute" />
              ) : (
                <span className="text-[8px] font-bold text-slate-300 absolute">
                  {goalPercent}%
                </span>
              )}
            </div>
            <div className="hidden sm:block text-[11px]">
              <span className="text-slate-200 font-semibold">{todayMinutes}m</span>
              <span className="text-slate-500">/{dailyGoal}m</span>
            </div>
          </div>

          {/* Daily Streak */}
          <button 
            type="button"
            onClick={() => setIsStreakModalOpen(true)}
            title="Streak Guardian — Click to check streak status & freeze"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-850 border border-white/[0.08] hover:border-amber-500/50 text-amber-400 text-xs font-semibold shadow-sm transition-all cursor-pointer group hover:scale-105"
          >
            <Flame className="w-4 h-4 fill-amber-400 text-amber-500 animate-pulse group-hover:scale-110 transition-transform" />
            <span>{stats.currentStreak}d</span>
          </button>

          {/* Audio Engine with Real-Time Equalizer Bar Indicator */}
          <div className="relative">
            <button
              onClick={() => setSoundMenuOpen(!soundMenuOpen)}
              className={`px-2.5 py-1.5 rounded-xl border flex items-center gap-2 transition-all cursor-pointer ${
                currentSound !== 'off'
                  ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300 shadow-md shadow-indigo-500/15'
                  : 'bg-slate-900/80 border-white/[0.08] text-slate-400 hover:text-white'
              }`}
              title="Focus Soundscapes (40Hz Gamma, Alpha Waves, Noise, Rain)"
            >
              {currentSound !== 'off' ? (
                <div className="flex items-center gap-1.5">
                  <div className="flex items-end gap-0.5 h-3.5 w-3.5">
                    <span className="w-0.5 bg-indigo-400 rounded-full animate-eq-1" />
                    <span className="w-0.5 bg-indigo-300 rounded-full animate-eq-2" />
                    <span className="w-0.5 bg-indigo-400 rounded-full animate-eq-3" />
                  </div>
                  <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                </div>
              ) : (
                <VolumeX className="w-4 h-4" />
              )}
            </button>

            {/* Audio Dropdown Popover */}
            {soundMenuOpen && (
              <div className="absolute right-0 mt-2 w-72 p-3.5 rounded-2xl bg-[#0e111d] border border-white/[0.12] shadow-2xl z-50 text-xs text-slate-200 animate-fadeIn">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/[0.08]">
                  <span className="font-bold text-white flex items-center gap-1.5 font-display">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    Neuro-Focus Soundscapes
                  </span>
                  <span className="text-[11px] text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20 font-mono">
                    Zero Latency
                  </span>
                </div>

                <div className="space-y-1 mb-3 max-h-56 overflow-y-auto pr-1">
                  {soundPresets.map(sound => (
                    <button
                      key={sound.id}
                      onClick={() => handleSoundChange(sound.id)}
                      className={`w-full text-left px-2.5 py-2 rounded-xl flex items-start gap-2.5 transition-all cursor-pointer ${
                        currentSound === sound.id
                          ? 'bg-indigo-600 text-white font-medium shadow-md shadow-indigo-600/20'
                          : 'hover:bg-white/[0.05] text-slate-300'
                      }`}
                    >
                      <span className="text-sm mt-0.5">{sound.icon}</span>
                      <div className="min-w-0">
                        <div className="font-semibold text-xs leading-tight">{sound.label}</div>
                        <div className={`text-[11px] leading-tight mt-0.5 ${currentSound === sound.id ? 'text-indigo-100' : 'text-slate-400'}`}>
                          {sound.desc}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Volume Slider */}
                <div className="pt-2 border-t border-white/[0.08] flex items-center gap-2 text-slate-400">
                  <Volume2 className="w-3.5 h-3.5" />
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <span className="font-mono text-[11px] w-7 text-right">{Math.round(volume * 100)}%</span>
                </div>
              </div>
            )}
          </div>

          {/* Offline Mode Indicator */}
          {!isOnline && (
            <div 
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold shadow-sm"
              title="Studify is operating offline. All local decks and FSRS reviews work without internet."
            >
              <WifiOff className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Offline</span>
            </div>
          )}

          {/* PWA Install Button */}
          {isInstallable && onPromptInstall && (
            <button
              onClick={onPromptInstall}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold text-xs shadow-md shadow-indigo-600/30 transition-all cursor-pointer hover:scale-[1.02]"
              title="Install Studify Native App"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Install</span>
            </button>
          )}

          {/* 3D Scholar Avatar Customizer Trigger */}
          {onOpenCharacterCustomizer && (
            <button
              type="button"
              onClick={onOpenCharacterCustomizer}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-500/15 via-purple-500/15 to-pink-500/15 hover:from-indigo-500/25 hover:via-purple-500/25 hover:to-pink-500/25 border border-indigo-500/30 hover:border-indigo-400/60 text-slate-200 hover:text-white transition-all shadow-sm cursor-pointer group"
              title="Customize 3D Scholar Avatar (Hair, Sex, Wardrobe, Style)"
            >
              <div className="w-5 h-5 rounded-lg overflow-hidden flex items-center justify-center p-0.5 bg-indigo-500/20 group-hover:scale-110 transition-transform">
                <UserAvatarBadge size="xs" />
              </div>
              <span className="text-xs font-bold bg-gradient-to-r from-indigo-200 via-purple-200 to-pink-200 bg-clip-text text-transparent hidden sm:inline">
                Edit 3D Model
              </span>
            </button>
          )}

          {/* User Account / Profile Pill */}
          <button
            onClick={() => onOpenAuth ? onOpenAuth(currentUser ? 'profile' : 'login') : undefined}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-850 border border-white/[0.08] hover:border-indigo-500/50 text-slate-300 hover:text-white transition-all shadow-sm cursor-pointer group"
            title={currentUser ? `Logged in as ${currentUser.name} (${currentUser.email})` : 'Log In or Create Account'}
          >
            {currentUser ? (
              <>
                <span className="text-sm select-none">{currentUser.avatar}</span>
                <span className="text-xs font-bold text-white max-w-[85px] sm:max-w-[120px] truncate hidden sm:inline">
                  {currentUser.name}
                </span>
                <span className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hidden lg:inline truncate max-w-[120px]">
                  {currentUser.grade || 'Student'}
                </span>
              </>
            ) : (
              <>
                <div className="w-5 h-5 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                  <User className="w-3 h-3" />
                </div>
                <span className="text-xs font-semibold text-slate-300 group-hover:text-white">
                  Log In
                </span>
              </>
            )}
          </button>

          {/* Daylight Paper Study Theme Toggle */}
          <button
            type="button"
            onClick={handleToggleTheme}
            className="p-2 rounded-xl bg-slate-900/80 border border-white/[0.08] hover:border-amber-400/40 text-slate-400 hover:text-amber-300 transition-all shadow-sm cursor-pointer"
            aria-label={isPaperTheme ? "Switch to Dark Theme" : "Switch to Daylight Theme"}
            title={isPaperTheme ? "Switch to Dark Obsidian Theme" : "Switch to Daylight / Paper Study Theme"}
          >
            {isPaperTheme ? <Moon className="w-4 h-4 text-indigo-400" /> : <Sun className="w-4 h-4 text-amber-400" />}
          </button>

          {/* Settings Modal Button */}
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-xl bg-slate-900/80 border border-white/[0.08] hover:border-white/[0.2] text-slate-400 hover:text-white transition-all shadow-sm cursor-pointer"
            aria-label="Settings and Data Export"
            title="Settings & Data Export"
          >
            <Settings className="w-4 h-4" />
          </button>

        </div>

      </div>

      {/* Mobile Sub-Navigation Pill Bar */}
      <div className="lg:hidden border-t border-white/[0.06] bg-slate-950/80 px-3 py-1.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs">
        <button
          onClick={() => onNavigate ? onNavigate('home') : (onLogoClick && onLogoClick())}
          className={`px-3 py-1 rounded-xl font-semibold whitespace-nowrap flex items-center gap-1.5 ${
            activeView === 'home'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Compass className="w-3 h-3" />
          <span>Workspace</span>
        </button>

        <button
          onClick={() => onNavigate ? onNavigate('dashboard') : (onOpenDashboard && onOpenDashboard())}
          className={`px-3 py-1 rounded-xl font-semibold whitespace-nowrap flex items-center gap-1.5 ${
            activeView === 'dashboard'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Layers className="w-3 h-3" />
          <span>Retention</span>
          {stats.cardsDueCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[11px] bg-emerald-500/20 text-emerald-300">
              {stats.cardsDueCount}
            </span>
          )}
        </button>

        {onOpenStarterCatalog && (
          <button
            onClick={onOpenStarterCatalog}
            className="px-3 py-1 rounded-xl font-semibold whitespace-nowrap text-slate-400 hover:text-white flex items-center gap-1.5"
          >
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Catalog</span>
          </button>
        )}

        <button
          onClick={() => onNavigate ? onNavigate('exam') : (onOpenExam && onOpenExam())}
          className={`px-3 py-1 rounded-xl font-semibold whitespace-nowrap flex items-center gap-1.5 ${
            activeView === 'exam'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Award className="w-3 h-3 text-amber-400" />
          <span>Exam</span>
        </button>

        <button
          onClick={() => onNavigate ? onNavigate('interleave') : (onOpenInterleaving && onOpenInterleaving())}
          className={`px-3 py-1 rounded-xl font-semibold whitespace-nowrap flex items-center gap-1.5 ${
            activeView === 'interleave'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Shuffle className="w-3 h-3 text-purple-400" />
          <span>Interleave</span>
        </button>
      </div>
    </header>

    {/* Streak Guardian Modal */}
    <StreakGuardianModal
      isOpen={isStreakModalOpen}
      onClose={() => setIsStreakModalOpen(false)}
      stats={stats}
      onLaunchStreakSaver={onOpenDashboard}
    />

    {/* How AXON Works 4-Phase Cognitive Architecture Tour */}
    <CognitiveTourModal
      isOpen={isTourModalOpen}
      onClose={() => {
        setIsTourModalOpen(false);
        try {
          localStorage.setItem('axon_tour_seen', 'true');
        } catch {}
      }}
      onStartQuickSession={onOpenStarterCatalog}
    />
  </>
  );
};
