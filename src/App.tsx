import { useState, useEffect, Suspense, lazy } from 'react';
import { WifiOff } from 'lucide-react';
import type { StudySession, UserStats, UserAccount } from './types';
import { StorageService } from './services/storageService';
import { AuthService } from './services/authService';
import { GoogleAuthService } from './services/googleAuthService';
import { usePwaInstall } from './hooks/usePwaInstall';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { CURATED_STARTER_DECKS } from './data/curatedStarterCatalog';
import { NotificationService } from './services/notificationService';

// Lazy-loaded heavy modules and modals for optimal initial bundle performance
const IngestionHub = lazy(() => import('./components/ingestion/IngestionHub').then(m => ({ default: m.IngestionHub })));
const StudyPilot = lazy(() => import('./components/cockpit/StudyPilot').then(m => ({ default: m.StudyPilot })));
const RetentionDashboard = lazy(() => import('./components/dashboard/RetentionDashboard').then(m => ({ default: m.RetentionDashboard })));
const SettingsModal = lazy(() => import('./components/settings/SettingsModal').then(m => ({ default: m.SettingsModal })));
const CommandPalette = lazy(() => import('./components/common/CommandPalette').then(m => ({ default: m.CommandPalette })));
const DeckStudioModal = lazy(() => import('./components/studio/DeckStudioModal').then(m => ({ default: m.DeckStudioModal })));
const StarterCatalogModal = lazy(() => import('./components/catalog/StarterCatalogModal').then(m => ({ default: m.StarterCatalogModal })));
const ExamSimulator = lazy(() => import('./components/exam/ExamSimulator').then(m => ({ default: m.ExamSimulator })));
const InterleavingArena = lazy(() => import('./components/interleaving/InterleavingArena').then(m => ({ default: m.InterleavingArena })));
const MatchArena = lazy(() => import('./components/game/MatchArena').then(m => ({ default: m.MatchArena })));
const AudioBriefingBar = lazy(() => import('./components/audio/AudioBriefingBar').then(m => ({ default: m.AudioBriefingBar })));
const DeckStationModal = lazy(() => import('./components/studio/DeckStationModal').then(m => ({ default: m.DeckStationModal })));
const AuthModal = lazy(() => import('./components/auth/AuthModal').then(m => ({ default: m.AuthModal })));
const AxolotlStudyHabitat = lazy(() => import('./components/mascot/AxolotlStudyHabitat').then(m => ({ default: m.AxolotlStudyHabitat })));
const DailyMissionHome = lazy(() => import('./components/home/DailyMissionHome').then(m => ({ default: m.DailyMissionHome })));

const LazyLoadingFallback = () => (
  <div className="flex flex-col items-center justify-center min-h-[350px] w-full p-8 animate-fadeIn">
    <div className="w-10 h-10 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin mb-3" />
    <span className="text-xs font-mono text-slate-400">Loading module...</span>
  </div>
);

export function App() {
  const [activeSession, setActiveSession] = useState<StudySession | null>(null);
  const [matchSession, setMatchSession] = useState<StudySession | null>(null);
  const [audioSession, setAudioSession] = useState<StudySession | null>(null);
  const [stationSession, setStationSession] = useState<StudySession | null>(null);
  const [isStationOpen, setIsStationOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<StudySession | null>(null);
  const [view, setView] = useState<'home' | 'dashboard' | 'exam' | 'interleave' | 'sanctuary' | 'studio'>('home');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isDeckStudioOpen, setIsDeckStudioOpen] = useState(false);
  const [isStarterCatalogOpen, setIsStarterCatalogOpen] = useState(false);
  const [deckStudioTab, setDeckStudioTab] = useState<'create' | 'import' | 'occlusion'>('create');
  const [libraryTab, setLibraryTab] = useState<'my-decks' | 'starred' | 'curated'>('my-decks');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => AuthService.getCurrentUser());
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authInitialTab, setAuthInitialTab] = useState<'login' | 'register' | 'profile'>('login');
  const [stats, setStats] = useState<UserStats>(StorageService.getStats());
  const { isOnline, isInstallable, promptInstall } = usePwaInstall();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('axon_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleSidebarCollapse = (collapsed?: boolean) => {
    setIsSidebarCollapsed(prev => {
      const next = collapsed !== undefined ? collapsed : !prev;
      try {
        localStorage.setItem('axon_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  // Keep user and stats synchronized with AuthService
  useEffect(() => {
    const unsubscribe = AuthService.subscribe((user) => {
      setCurrentUser(user);
      setStats(StorageService.getStats());
    });
    return unsubscribe;
  }, []);

  // Google One Tap automatic prompt / auto-login on startup
  useEffect(() => {
    if (!currentUser && GoogleAuthService.isGoogleConfigured()) {
      GoogleAuthService.initOneTapAutoLogin(async (payload) => {
        const res = await AuthService.signInWithGoogle(payload);
        if (res.success && res.user) {
          setCurrentUser(res.user);
        }
      });
    }
  }, [currentUser]);

  // Global keyboard shortcut for Command Palette (⌘K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Initialize Web Push Streak Protection & URL launcher
  useEffect(() => {
    NotificationService.scheduleStreakCheck();
    const statsData = StorageService.getStats();
    NotificationService.checkDailyReminder(statsData.todayMinutes, statsData.currentStreak);

    // Deep link: auto-launch quick sprint from notification
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('launch') === 'quick_sprint') {
      const saved = StorageService.getSessions();
      const primary = saved[0] || CURATED_STARTER_DECKS[0]?.session;
      if (primary) {
        setActiveSession({
          ...primary,
          currentPhase: 'retrieval',
          casualFlashcardMode: true,
        });
      }
    }
  }, []);

  const handleStartSession = (session: StudySession) => {
    setActiveSession(session);
  };

  const handleOpenDeckStation = (session: StudySession) => {
    setStationSession(session);
    setIsStationOpen(true);
  };

  const handleStartMatch = (session: StudySession) => {
    setMatchSession(session);
  };

  const handleStartAudioBriefing = (session: StudySession) => {
    setAudioSession(session);
  };

  const handleExitSession = () => {
    setActiveSession(null);
    setStats(StorageService.getStats());
  };

  const handleResetStats = () => {
    setStats(StorageService.getStats());
  };

  const handleNavigate = (targetView: 'home' | 'dashboard' | 'exam' | 'interleave' | 'sanctuary' | 'studio') => {
    setView(targetView);
    setStats(StorageService.getStats());
  };

  // If in an active match game arena, display full-screen Quizlet-style Match Arena
  if (matchSession) {
    return (
      <Suspense fallback={<LazyLoadingFallback />}>
        <div className="min-h-screen bg-[#090a10] bg-ambient-mesh text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white p-4 sm:p-8">
          <MatchArena
            session={matchSession}
            onBack={() => {
              setMatchSession(null);
              setStats(StorageService.getStats());
            }}
            onLaunchStudy={() => {
              const s = matchSession;
              setMatchSession(null);
              handleStartSession(s);
            }}
          />
        </div>
      </Suspense>
    );
  }

  // If in an active study session, display the distraction-free Study Pilot Cockpit
  if (activeSession) {
    return (
      <Suspense fallback={<LazyLoadingFallback />}>
        <StudyPilot
          initialSession={activeSession}
          onExit={handleExitSession}
          onOpenDashboard={() => {
            setActiveSession(null);
            handleNavigate('dashboard');
          }}
        />
      </Suspense>
    );
  }

  const savedSessions = StorageService.getSessions();
  const dueCards = StorageService.getDueCards();
  const allCards = StorageService.getAllCards();
  const starredCardsCount = allCards.filter(c => c.isStarred).length;

  const handleQuickStudy = () => {
    const firstSession = savedSessions[0] || CURATED_STARTER_DECKS[0]?.session;
    if (firstSession) {
      handleStartSession(firstSession);
    }
  };

  const handleOpenAuth = (tab: 'login' | 'register' | 'profile' = 'login') => {
    setAuthInitialTab(tab);
    setIsAuthOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#090a10] bg-ambient-mesh text-slate-100 flex font-sans selection:bg-indigo-500 selection:text-white relative">
      {/* Desktop Sidebar & Mobile Drawer */}
      <Sidebar
        activeView={view}
        onNavigate={handleNavigate}
        stats={stats}
        currentUser={currentUser}
        onOpenAuth={handleOpenAuth}
        onOpenDeckStudio={() => {
          setEditingSession(null);
          setDeckStudioTab('create');
          setIsDeckStudioOpen(true);
        }}
        onOpenStarterCatalog={() => setIsStarterCatalogOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onQuickStudy={handleQuickStudy}
        onOpenLibraryTab={(tab) => {
          setView('home');
          setLibraryTab(tab);
        }}
        savedDecksCount={savedSessions.length}
        starredCardsCount={starredCardsCount}
        dueCardsCount={dueCards.length}
        isOnline={isOnline}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebarCollapse}
      />

      {/* Main App Column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* Top Navbar */}
        <Navbar
          stats={stats}
          currentUser={currentUser}
          onOpenAuth={handleOpenAuth}
          activeView={view}
          onNavigate={handleNavigate}
          isOnline={isOnline}
          isInstallable={isInstallable}
          onPromptInstall={promptInstall}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenDashboard={() => handleNavigate('dashboard')}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onOpenStarterCatalog={() => setIsStarterCatalogOpen(true)}
          onOpenExam={() => handleNavigate('exam')}
          onOpenInterleaving={() => handleNavigate('interleave')}
          onOpenSanctuary={() => handleNavigate('sanctuary')}
          onLogoClick={() => handleNavigate('home')}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(prev => !prev)}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebarCollapse={() => handleToggleSidebarCollapse()}
        />

        {/* Offline Mode Banner */}
        {!isOnline && (
          <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 text-center text-xs font-semibold text-amber-300 flex items-center justify-center gap-2">
            <WifiOff className="w-4 h-4 text-amber-400" />
            <span>Offline Mode Active • All local decks, image occlusions, and FSRS reviews work 100% offline.</span>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 lg:p-8">
          <Suspense fallback={<LazyLoadingFallback />}>
            {view === 'home' && (
              <DailyMissionHome
                onStartSession={handleStartSession}
                onOpenDeckStation={handleOpenDeckStation}
                onStartMatch={handleStartMatch}
                onStartAudioBriefing={handleStartAudioBriefing}
                onOpenDeckStudio={() => {
                  setEditingSession(null);
                  setDeckStudioTab('create');
                  setIsDeckStudioOpen(true);
                }}
                onOpenStarterCatalog={() => setIsStarterCatalogOpen(true)}
                onOpenDashboard={() => handleNavigate('dashboard')}
                onOpenSanctuary={() => handleNavigate('sanctuary')}
                onOpenExam={() => handleNavigate('exam')}
              />
            )}
            {view === 'studio' && (
              <IngestionHub
                key={currentUser?.id || 'guest'}
                initialLibraryTab={libraryTab}
                onStartSession={handleStartSession}
                onOpenDeckStation={handleOpenDeckStation}
                onStartMatch={handleStartMatch}
                onStartAudioBriefing={handleStartAudioBriefing}
                onOpenDashboard={() => handleNavigate('dashboard')}
                onOpenExam={() => handleNavigate('exam')}
                onOpenInterleaving={() => handleNavigate('interleave')}
                onOpenSanctuary={() => handleNavigate('sanctuary')}
              />
            )}
            {view === 'dashboard' && (
              <RetentionDashboard
                stats={stats}
                onBack={() => setView('home')}
                onStartSession={handleStartSession}
                onOpenDeckStation={handleOpenDeckStation}
                onOpenExam={() => setView('exam')}
                onOpenInterleaving={() => handleNavigate('interleave')}
              />
            )}
            {view === 'exam' && (
              <ExamSimulator
                onBack={() => setView('home')}
                onStartRemediationSession={(session) => {
                  handleStartSession(session);
                }}
              />
            )}
            {view === 'interleave' && (
              <InterleavingArena
                onBack={() => setView('home')}
                onSessionComplete={() => {
                  setStats(StorageService.getStats());
                }}
              />
            )}
            {view === 'sanctuary' && (
              <AxolotlStudyHabitat
                onStartSession={handleStartSession}
                onOpenDeckStation={handleOpenDeckStation}
                onStartMatch={handleStartMatch}
                onStartAudioBriefing={handleStartAudioBriefing}
                onOpenExam={() => handleNavigate('exam')}
                onOpenInterleaving={() => handleNavigate('interleave')}
                onOpenDeckStudio={() => {
                  setEditingSession(null);
                  setDeckStudioTab('create');
                  setIsDeckStudioOpen(true);
                }}
                onOpenStarterCatalog={() => setIsStarterCatalogOpen(true)}
                onOpenDashboard={() => handleNavigate('dashboard')}
              />
            )}
          </Suspense>
        </main>

        {/* Footer */}
        <footer className="w-full border-t border-white/[0.08] bg-slate-950/80 backdrop-blur-md py-6 px-4 text-center text-xs text-slate-500">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-200 font-display text-sm tracking-tight">Lotti</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400">Micro-Mastery & Spaced Recall with Lottie the Axolotl</span>
            </div>
            <div className="flex items-center gap-4 text-[12px] text-slate-400">
              <button 
                type="button" 
                onClick={() => setIsSettingsOpen(true)}
                className="hover:text-indigo-400 transition-colors cursor-pointer"
              >
                Settings
              </button>
              <button 
                type="button" 
                onClick={() => handleNavigate('sanctuary')}
                className="hover:text-pink-400 transition-colors cursor-pointer"
              >
                Lottie Sanctuary
              </button>
              <button 
                type="button" 
                onClick={() => setIsStarterCatalogOpen(true)}
                className="hover:text-indigo-400 transition-colors cursor-pointer"
              >
                Explore Decks
              </button>
            </div>
          </div>
        </footer>
      </div>

      {/* Floating NotebookLM-style Audio Briefing Bar */}
      {audioSession && (
        <Suspense fallback={null}>
          <AudioBriefingBar
            session={audioSession}
            onClose={() => setAudioSession(null)}
          />
        </Suspense>
      )}

      {/* Deck Station Modal (RemNote / Anki / Quizlet Multi-Mode Hub & Card Syllabus) */}
      {isStationOpen && (
        <Suspense fallback={null}>
          <DeckStationModal
            key={stationSession?.id || 'none'}
            isOpen={isStationOpen}
            session={stationSession}
            onClose={() => {
              setIsStationOpen(false);
              setStationSession(null);
            }}
            onStartPilot={(s) => {
              setIsStationOpen(false);
              setStationSession(null);
              handleStartSession(s);
            }}
            onStartMatch={(s) => {
              setIsStationOpen(false);
              setStationSession(null);
              handleStartMatch(s);
            }}
            onStartFlashcardsOnly={(s) => {
              setIsStationOpen(false);
              setStationSession(null);
              handleStartSession({
                ...s,
                currentPhase: 'retrieval',
                casualFlashcardMode: true,
              });
            }}
            onStartAudioBriefing={(s) => {
              setIsStationOpen(false);
              setStationSession(null);
              handleStartAudioBriefing(s);
            }}
            onEditInStudio={(s) => {
              setIsStationOpen(false);
              setStationSession(null);
              setEditingSession(s);
              setDeckStudioTab('create');
              setIsDeckStudioOpen(true);
            }}
          />
        </Suspense>
      )}

      {/* Command Palette (⌘K) */}
      {isCommandPaletteOpen && (
        <Suspense fallback={null}>
          <CommandPalette
            isOpen={isCommandPaletteOpen}
            onClose={() => setIsCommandPaletteOpen(false)}
            onStartSession={handleStartSession}
            onOpenDeckStation={handleOpenDeckStation}
            onStartMatch={handleStartMatch}
            onStartAudioBriefing={handleStartAudioBriefing}
            onOpenDashboard={() => handleNavigate('dashboard')}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenAuth={handleOpenAuth}
            onOpenStarterCatalog={() => setIsStarterCatalogOpen(true)}
            onOpenDeckStudio={() => {
              setEditingSession(null);
              setDeckStudioTab('create');
              setIsDeckStudioOpen(true);
            }}
            onOpenImageOcclusion={() => {
              setEditingSession(null);
              setDeckStudioTab('occlusion');
              setIsDeckStudioOpen(true);
            }}
            onOpenExam={() => handleNavigate('exam')}
            onOpenInterleaving={() => handleNavigate('interleave')}
            onOpenSanctuary={() => handleNavigate('sanctuary')}
          />
        </Suspense>
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <Suspense fallback={null}>
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            onStatsReset={handleResetStats}
          />
        </Suspense>
      )}

      {/* Deck Studio Modal (Global) */}
      {isDeckStudioOpen && (
        <Suspense fallback={null}>
          <DeckStudioModal
            key={editingSession?.id || 'new-deck'}
            isOpen={isDeckStudioOpen}
            initialSession={editingSession}
            initialTab={deckStudioTab}
            onClose={() => {
              setIsDeckStudioOpen(false);
              setEditingSession(null);
            }}
            onSaveDeck={(newSession) => {
              setEditingSession(null);
              handleStartSession(newSession);
            }}
          />
        </Suspense>
      )}

      {/* Starter Catalog Modal (Global) */}
      {isStarterCatalogOpen && (
        <Suspense fallback={null}>
          <StarterCatalogModal
            isOpen={isStarterCatalogOpen}
            onClose={() => setIsStarterCatalogOpen(false)}
            onStartSession={handleStartSession}
            onOpenDeckStation={(s) => {
              setIsStarterCatalogOpen(false);
              handleOpenDeckStation(s);
            }}
            onDeckImported={() => setStats(StorageService.getStats())}
          />
        </Suspense>
      )}

      {/* Auth & Account Management Modal */}
      {isAuthOpen && (
        <Suspense fallback={null}>
          <AuthModal
            isOpen={isAuthOpen}
            initialTab={authInitialTab}
            onClose={() => setIsAuthOpen(false)}
            onUserChanged={(user) => {
              setCurrentUser(user);
              setStats(StorageService.getStats());
            }}
          />
        </Suspense>
      )}
    </div>
  );
}

export default App;
