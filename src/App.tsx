import { useState, useEffect, Suspense, lazy } from 'react';
import { WifiOff } from 'lucide-react';
import type { StudySession, UserStats, UserAccount } from './types';
import { StorageService } from './services/storageService';
import { AuthService } from './services/authService';
import { GoogleAuthService } from './services/googleAuthService';
import { usePwaInstall } from './hooks/usePwaInstall';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { MobileTabBar } from './components/layout/MobileTabBar';
import { NotificationService } from './services/notificationService';
import { WagePayoutBanner } from './components/lifesim/WagePayoutBanner';
import { ECONOMY_VISIBLE, WORLD_3D_ENABLED } from './services/features';
import { CalendarFeedService } from './services/calendarFeedService';
import { useFocusTimerAlerts } from './hooks/useFocusTimer';
import { FocusToast } from './components/focus/FocusToast';
import { InstallAppDialog } from './components/common/InstallAppDialog';
import { FriendsDialog } from './components/friends/FriendsDialog';
import { FriendsService, inviteCodeFrom } from './services/friendsService';
import { ApiConfig } from './services/apiConfig';
import { CloudSyncService } from './services/cloudSyncService';
import { buildDailyReviewSession } from './services/dailyReview';

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
// The 3D world (Campus and the avatar editor) is left out of the build unless its flag is on.
const StudyEstateCampus = WORLD_3D_ENABLED ? lazy(() => import('./components/mascot/AxolotlStudyHabitat').then(m => ({ default: m.StudyEstateCampus }))) : null;
const DailyMissionHome = lazy(() => import('./components/home/DailyMissionHome').then(m => ({ default: m.DailyMissionHome })));
const PlannerPage = lazy(() => import('./components/planner/PlannerPage').then(m => ({ default: m.PlannerPage })));
const FocusPage = lazy(() => import('./components/focus/FocusPage').then(m => ({ default: m.FocusPage })));
const FoldersPage = lazy(() => import('./components/folders/FoldersPage').then(m => ({ default: m.FoldersPage })));
const CharacterCustomizerModal = WORLD_3D_ENABLED ? lazy(() => import('./components/character/CharacterCustomizerModal').then(m => ({ default: m.CharacterCustomizerModal }))) : null;

const LazyLoadingFallback = () => (
  <div className="flex min-h-[350px] w-full flex-col items-center justify-center p-8 animate-fadeIn" role="status">
    <div className="h-8 w-8 rounded-full border-2 border-line-strong border-t-brand animate-spin" />
    <span className="sr-only">Loading</span>
  </div>
);

export function App() {
  const [activeSession, setActiveSession] = useState<StudySession | null>(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('launch') === 'quick_sprint') {
        // Today's review across decks; with nothing left today, the first deck to practise ahead.
        const queue = StorageService.getDailyQueue();
        if (queue.cards.length > 0) return buildDailyReviewSession(queue);
        // Without a saved deck, fall through to the home screen's first-deck empty state.
        const primary = StorageService.getSessions()[0];
        if (primary) {
          return {
            ...primary,
            currentPhase: 'retrieval',
            casualFlashcardMode: true,
          };
        }
      }
    }
    return null;
  });
  const [matchSession, setMatchSession] = useState<StudySession | null>(null);
  const [audioSession, setAudioSession] = useState<StudySession | null>(null);
  const [stationSession, setStationSession] = useState<StudySession | null>(null);
  const [isStationOpen, setIsStationOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<StudySession | null>(null);
  // The Home Screen shortcut "Focus" opens /?view=focus.
  const [view, setView] = useState<'home' | 'dashboard' | 'exam' | 'interleave' | 'sanctuary' | 'studio' | 'folders' | 'planner' | 'focus'>(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('view') === 'focus' ? 'focus' : 'home',
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isDeckStudioOpen, setIsDeckStudioOpen] = useState(false);
  const [isStarterCatalogOpen, setIsStarterCatalogOpen] = useState(false);
  const [isCharacterCustomizerOpen, setIsCharacterCustomizerOpen] = useState(false);
  const [deckStudioTab, setDeckStudioTab] = useState<'create' | 'import' | 'occlusion'>('create');
  const [libraryTab, setLibraryTab] = useState<'my-decks' | 'starred' | 'curated'>('my-decks');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => AuthService.getCurrentUser());
  // A password reset link (/?reset=<token>) opens sign-in on "choose a new password".
  const [resetToken, setResetToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const token = new URLSearchParams(window.location.search).get('reset');
    if (token) {
      const url = new URL(window.location.href);
      url.searchParams.delete('reset');
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
    return token;
  });
  // A friend's invite link (/?friend=<code>) opens Friends with the code filled in. Signed out, sign-in
  // comes first, and the code waits in this tab until then.
  const [friendInvite, setFriendInvite] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const code = inviteCodeFrom(window.location.search);
    if (code) {
      const url = new URL(window.location.href);
      url.searchParams.delete('friend');
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
      FriendsService.savePendingInvite(code);
    }
    return code ?? FriendsService.pendingInvite();
  });
  const invitedWhileSignedOut = Boolean(friendInvite) && !AuthService.getCurrentUser();
  const [isAuthOpen, setIsAuthOpen] = useState(() => Boolean(resetToken) || invitedWhileSignedOut);
  const [authInitialTab, setAuthInitialTab] = useState<'login' | 'register' | 'profile'>(() => (invitedWhileSignedOut && !resetToken ? 'register' : 'login'));
  const [stats, setStats] = useState<UserStats>(StorageService.getStats());
  // Notes from Focus to make a deck from, opened in the Library (with a key to open it afresh).
  const [libraryNotes, setLibraryNotes] = useState<{ text: string; key: number } | null>(null);
  const { isOnline, isInstallable, isIos, promptInstall } = usePwaInstall();
  const [isInstallHelpOpen, setIsInstallHelpOpen] = useState(false);
  // Install: the browser's own prompt where there is one (Android, desktop); on iPhone and iPad, the steps.
  const installApp = isInstallable ? () => void promptInstall() : isIos ? () => setIsInstallHelpOpen(true) : undefined;
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

  // The focus timer runs on every page: it chimes and says so when a phase ends.
  const focusAlerts = useFocusTimerAlerts();

  // Start waking the server (it sleeps when idle) so it is ready by the time anyone signs in.
  useEffect(() => ApiConfig.warmUp(), []);

  // Account sync: keeps a signed-in student's data the same on all their devices.
  useEffect(() => CloudSyncService.start(), []);
  const currentUserId = currentUser?.id;
  useEffect(() => {
    if (currentUserId) CloudSyncService.requestSync();
  }, [currentUserId]);

  // Keep a subscribed calendar up to date with the planner.
  useEffect(() => CalendarFeedService.startAutoPublish(), []);

  // Keep user and stats synchronized with AuthService
  useEffect(() => {
    const unsubscribe = AuthService.subscribe((user) => {
      // Signing out stops this browser's reminders for that account.
      if (!user && NotificationService.getSettings().push) void NotificationService.disablePushReminders();
      setCurrentUser(user);
      setStats(StorageService.getStats());
    });
    return unsubscribe;
  }, []);

  // Reviews, deck edits and stats changes update what the shell shows (the sidebar's due
  // count is read during render). Deferred: storage can change while another component renders.
  const [, setDataVersion] = useState(0);
  useEffect(
    () =>
      StorageService.addMutationListener(() => {
        queueMicrotask(() => {
          setDataVersion(v => v + 1);
          setStats(StorageService.getStats());
        });
      }),
    [],
  );

  // Google One Tap automatic prompt / auto-login on startup
  useEffect(() => {
    if (!currentUser && GoogleAuthService.isGoogleConfigured()) {
      GoogleAuthService.initOneTapAutoLogin(async (payload) => {
        const res = await AuthService.signInWithGoogle(payload);
        if (res.success && res.user) {
          GoogleAuthService.cancelOneTap();
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

  // Initialize Web Push Streak Protection & daily notification checks
  useEffect(() => {
    NotificationService.scheduleStreakCheck();
    const statsData = StorageService.getStats();
    NotificationService.checkDailyReminder(statsData.todayMinutes, statsData.currentStreak);
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

  const handleNavigate = (targetView: 'home' | 'dashboard' | 'exam' | 'interleave' | 'sanctuary' | 'studio' | 'folders' | 'planner' | 'focus') => {
    setLibraryNotes(null);
    setView(targetView);
    setStats(StorageService.getStats());
  };
  const openCampus = WORLD_3D_ENABLED ? () => handleNavigate('sanctuary') : undefined;
  const focusToast = (
    <FocusToast
      message={focusAlerts.message}
      onDismiss={focusAlerts.dismiss}
      onOpen={!matchSession && !activeSession && view !== 'focus' ? () => handleNavigate('focus') : undefined}
    />
  );
  const openCharacterCustomizer = WORLD_3D_ENABLED ? () => setIsCharacterCustomizerOpen(true) : undefined;

  // If in an active match game arena, display full-screen Quizlet-style Match Arena
  if (matchSession) {
    return (
      <Suspense fallback={<LazyLoadingFallback />}>
        <div className="min-h-screen bg-canvas bg-ambient-mesh text-ink flex flex-col font-sans p-4 sm:p-8">
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
        {focusToast}
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
          onOpenFocus={() => {
            setActiveSession(null);
            handleNavigate('focus');
          }}
          onOpenDashboard={() => {
            setActiveSession(null);
            handleNavigate('dashboard');
          }}
        />
        {focusToast}
      </Suspense>
    );
  }

  const savedSessions = StorageService.getSessions();
  // Today's review across decks: what "Start review" studies and the count shown beside it.
  const dailyQueue = StorageService.getDailyQueue();
  const allCards = StorageService.getAllCards();
  const starredCardsCount = allCards.filter(c => c.isStarred).length;

  const handleQuickStudy = () => {
    if (dailyQueue.cards.length > 0) {
      handleStartSession(buildDailyReviewSession(dailyQueue));
    } else if (savedSessions[0]) {
      // Nothing left today: practise the first deck ahead.
      handleStartSession({ ...savedSessions[0], currentPhase: 'retrieval', casualFlashcardMode: true });
    } else {
      // New users pick a deck themselves rather than being dropped into a demo deck.
      setIsStarterCatalogOpen(true);
    }
  };

  const handleOpenAuth = (tab: 'login' | 'register' | 'profile' = 'login') => {
    setAuthInitialTab(tab);
    setIsAuthOpen(true);
  };

  return (
    <div className="relative flex min-h-screen bg-canvas bg-ambient-mesh font-sans text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[80] focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-brand-ink"
      >
        Skip to content
      </a>
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
        dueCardsCount={dailyQueue.cards.length}
        isOnline={isOnline}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebarCollapse}
        onOpenCharacterCustomizer={openCharacterCustomizer}
        onInstallApp={installApp}
      />

      {/* Main App Column */}
      <div className={`flex-1 flex flex-col min-w-0 ${view === 'sanctuary' ? 'h-screen overflow-hidden' : 'overflow-x-hidden'}`}>
        {/* Top Navbar - hidden in sanctuary 3D mode to give full screen height */}
        {view !== 'sanctuary' && (
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
            onOpenSanctuary={openCampus}
            onOpenCharacterCustomizer={openCharacterCustomizer}
            onLogoClick={() => handleNavigate('home')}
            onToggleMobileSidebar={() => setIsMobileSidebarOpen(prev => !prev)}
            isSidebarCollapsed={isSidebarCollapsed}
            onToggleSidebarCollapse={() => handleToggleSidebarCollapse()}
          />
        )}

        {/* Offline Mode Banner */}
        {!isOnline && view !== 'sanctuary' && (
          <div className="flex items-center justify-center gap-2 border-b border-line bg-gold-soft px-4 py-2 text-center text-xs font-medium text-gold">
            <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
            <span>You're offline. Your decks, reviews and image occlusions all keep working.</span>
          </div>
        )}

        {/* Main Content Area */}
        <main id="main" tabIndex={-1} className={`flex-1 w-full outline-none ${
          view === 'sanctuary'
            ? 'h-full max-w-none p-0 overflow-hidden flex flex-col'
            : 'max-w-7xl mx-auto px-4 pt-5 pb-24 sm:px-6 sm:pt-7 md:pb-10 lg:px-8'
        }`}>
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
                onOpenSanctuary={openCampus}
                onOpenExam={() => handleNavigate('exam')}
                onOpenFolders={() => handleNavigate('folders')}
                onOpenPlanner={() => handleNavigate('planner')}
                onOpenLibrary={() => handleNavigate('studio')}
                onOpenAuth={() => handleOpenAuth('login')}
              />
            )}
            {view === 'studio' && (
              <IngestionHub
                key={`${currentUser?.id || 'guest'}-${libraryNotes?.key ?? 0}`}
                initialLibraryTab={libraryTab}
                initialNotes={libraryNotes?.text}
                onOpenAuth={() => handleOpenAuth()}
                onStartDailyReview={handleQuickStudy}
                onStartSession={handleStartSession}
                onOpenDeckStation={handleOpenDeckStation}
                onStartMatch={handleStartMatch}
                onStartAudioBriefing={handleStartAudioBriefing}
                onOpenDashboard={() => handleNavigate('dashboard')}
                onOpenExam={() => handleNavigate('exam')}
                onOpenInterleaving={() => handleNavigate('interleave')}
                onOpenSanctuary={openCampus}
              />
            )}
            {view === 'dashboard' && (
              <RetentionDashboard
                stats={stats}
                onBack={() => setView('home')}
                onStartSession={handleStartSession}
                onStartDailyReview={handleQuickStudy}
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
            {view === 'sanctuary' && StudyEstateCampus && (
              <StudyEstateCampus
                onStartSession={handleStartSession}
                onOpenStarterCatalog={() => setIsStarterCatalogOpen(true)}
                onToggleMobileSidebar={() => setIsMobileSidebarOpen(prev => !prev)}
              />
            )}
            {view === 'focus' && (
              <FocusPage
                onStartSession={handleStartSession}
                onMakeFlashcards={text => {
                  setLibraryNotes({ text, key: Date.now() });
                  setView('studio');
                }}
              />
            )}
            {view === 'planner' && <PlannerPage onStartSession={handleStartSession} onOpenAuth={() => handleOpenAuth()} />}
            {view === 'folders' && (
              <FoldersPage
                onBack={() => handleNavigate('home')}
                onStartSession={handleStartSession}
                onOpenDeckStation={handleOpenDeckStation}
                onOpenDeckStudio={() => {
                  setEditingSession(null);
                  setDeckStudioTab('create');
                  setIsDeckStudioOpen(true);
                }}
                onStartMatch={handleStartMatch}
                onOpenInterleaving={() => handleNavigate('interleave')}
              />
            )}
          </Suspense>
        </main>

      </div>

      {view !== 'sanctuary' && (
        <MobileTabBar activeView={view} onNavigate={handleNavigate} dueCardsCount={dailyQueue.cards.length} />
      )}

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
            onOpenSanctuary={openCampus}
            onOpenToday={() => handleNavigate('home')}
            onOpenLibrary={() => handleNavigate('studio')}
            onOpenSubjects={() => handleNavigate('folders')}
            onOpenPlanner={() => handleNavigate('planner')}
            onOpenFocus={() => handleNavigate('focus')}
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
            onShowInstallHelp={isIos ? () => setIsInstallHelpOpen(true) : undefined}
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
            onSaveDeck={(savedDeck) => {
              // Show the saved deck's details, where the learner picks how to study it.
              setIsDeckStudioOpen(false);
              setEditingSession(null);
              handleOpenDeckStation(savedDeck);
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
            resetToken={resetToken}
            onClose={() => {
              setIsAuthOpen(false);
              setResetToken(null);
            }}
            onUserChanged={(user) => {
              setCurrentUser(user);
              setStats(StorageService.getStats());
            }}
          />
        </Suspense>
      )}

      {/* Global 3D Character Customizer Studio */}
      {isCharacterCustomizerOpen && CharacterCustomizerModal && (
        <Suspense fallback={null}>
          <CharacterCustomizerModal
            isOpen={isCharacterCustomizerOpen}
            onClose={() => setIsCharacterCustomizerOpen(false)}
          />
        </Suspense>
      )}

      {focusToast}

      <InstallAppDialog isOpen={isInstallHelpOpen} onClose={() => setIsInstallHelpOpen(false)} />

      {currentUser && friendInvite && (
        <FriendsDialog
          isOpen
          initialCode={friendInvite}
          onClose={() => {
            setFriendInvite(null);
            FriendsService.savePendingInvite(null);
          }}
        />
      )}

      {/* Global Study Wage Deposited Banner */}
      {ECONOMY_VISIBLE && <WagePayoutBanner />}
    </div>
  );
}

export default App;
