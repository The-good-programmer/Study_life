import React, { useState, useMemo, useEffect, useCallback, Suspense, lazy } from 'react';
import {
  Play,
  Plus,
  Headphones,
  Compass,
  FolderPlus,
  FolderInput,
  Pencil,
  Brain,
  Zap,
  Award,
  Flame,
  Layers,
  TrendingUp,
  GraduationCap,
  Clock,
  ArrowRight,
  Building2,
  Upload,
  Snowflake,
  Check,
  Sparkles,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { StudySession, UserStats, SubjectFolder, UserAccount } from '../../types';
import type { DailyLedger } from '../../types/lifeSim';
import { StorageService } from '../../services/storageService';
import { AuthService } from '../../services/authService';
import { characterService } from '../../services/characterService';
import { lifeSimService, ACADEMIC_ROLES } from '../../services/lifeSimService';
import { soundEngine } from '../../services/soundEngine';
import { haptics } from '../../services/hapticsService';
import { estimateReward, earningsForDay } from '../../services/economy/rewardService';
import { buildMatchTiles } from '../game/matchTiles';
import { formatBonus } from '../lifesim/campusFormat';
import type { EarningsByKind } from '../../services/economy/rewardService';
import { REWARD_LABELS } from '../../services/economy/rewardLabels';
import { ScienceExplainerModal } from '../common/ScienceExplainerModal';
import { StreakGuardianModal } from '../mascot/StreakGuardianModal';
import { UserAvatarBadge } from '../character/UserAvatarBadge';
import { SubjectFolderModal } from '../studio/SubjectFolderModal';
import { FOLDER_COLORS } from '../studio/folderOptions';
import { MoveToFolderModal } from '../studio/MoveToFolderModal';
import { Badge, Button, Card, CoinIcon, IconButton, ProgressBar, ProgressRing, SectionHeader, Tokens } from '../ui/primitives';
import { cn } from '../../utils/cn';

// The customizer pulls in three.js; load it only when the user opens it.
const CharacterCustomizerModal = lazy(() =>
  import('../character/CharacterCustomizerModal').then(m => ({ default: m.CharacterCustomizerModal })),
);

/** Reviews per day that count as hitting the daily goal. */
const DAILY_REVIEW_GOAL = 15;
/** Rough time per flashcard, for session length estimates. */
const SECONDS_PER_CARD = 20;
/** Decks shown on Today before linking to the full library. */
const DECKS_ON_HOME = 5;
/** XP per level (matches StorageService). */
const XP_PER_LEVEL = 150;

interface DailyMissionHomeProps {
  onStartSession: (session: StudySession) => void;
  onOpenDeckStation: (session: StudySession) => void;
  onStartMatch: (session: StudySession) => void;
  onStartAudioBriefing?: (session: StudySession) => void;
  onOpenDeckStudio: () => void;
  onOpenStarterCatalog: () => void;
  onOpenDashboard: () => void;
  onOpenSanctuary: () => void;
  onOpenExam?: () => void;
  onOpenFolders?: () => void;
  onOpenLibrary?: () => void;
}

const greetingFor = (date: Date): string => {
  const hour = date.getHours();
  if (hour < 5) return 'Up late';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

/** Lifetime flashcard reviews, which decide the academic role. */
const countReviews = (): number => StorageService.getAllCards().reduce((sum, card) => sum + (card.reps || 0), 0);

const cardCount = (session: StudySession): number =>
  session.concepts.reduce((sum, concept) => sum + (concept.retrievalCards?.length || 0), 0);

export const DailyMissionHome: React.FC<DailyMissionHomeProps> = ({
  onStartSession,
  onOpenDeckStation,
  onStartMatch,
  onStartAudioBriefing,
  onOpenDeckStudio,
  onOpenStarterCatalog,
  onOpenDashboard,
  onOpenSanctuary,
  onOpenExam,
  onOpenFolders,
  onOpenLibrary,
}) => {
  const [stats, setStats] = useState<UserStats>(() => StorageService.getStats());
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => AuthService.getCurrentUser());
  const [character, setCharacter] = useState(() => characterService.getCharacter());
  const [hasFreeze, setHasFreeze] = useState(() => StorageService.hasSynapticFreeze());
  const [reviewedToday, setReviewedToday] = useState(() => StorageService.getReviewedTodayCount());
  const [savedSessions, setSavedSessions] = useState<StudySession[]>(() => StorageService.getSessions());
  const [dueCards, setDueCards] = useState(() => StorageService.getDueCards());
  const [folders, setFolders] = useState<SubjectFolder[]>(() => StorageService.getFolders());
  const [ledger, setLedger] = useState<DailyLedger>(() => lifeSimService.getDailyLedger());
  const [wallet, setWallet] = useState(() => lifeSimService.getWalletBalance());
  const [earnings, setEarnings] = useState<EarningsByKind[]>(() => earningsForDay());
  const [rentError, setRentError] = useState<string | null>(null);
  const [weekly, setWeekly] = useState(() => StorageService.getWeeklyXP());
  const [totalReviews, setTotalReviews] = useState(() => countReviews());
  const [now] = useState(() => new Date());

  const [selectedFolderId, setSelectedFolderId] = useState<string>('all');
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [showScienceModal, setShowScienceModal] = useState(false);
  const [isStreakModalOpen, setIsStreakModalOpen] = useState(false);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<SubjectFolder | null>(null);
  const [movingSession, setMovingSession] = useState<StudySession | null>(null);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);

  const refreshStudy = useCallback(() => {
    setStats(StorageService.getStats());
    setReviewedToday(StorageService.getReviewedTodayCount());
    setHasFreeze(StorageService.hasSynapticFreeze());
    setSavedSessions(StorageService.getSessions());
    setDueCards(StorageService.getDueCards());
    setFolders(StorageService.getFolders());
    setEarnings(earningsForDay());
    setWeekly(StorageService.getWeeklyXP());
    setTotalReviews(countReviews());
  }, []);

  const refreshLife = useCallback(() => {
    setLedger(lifeSimService.getDailyLedger());
    setWallet(lifeSimService.getWalletBalance());
    setEarnings(earningsForDay());
  }, []);

  useEffect(() => {
    const unsubStorage = StorageService.addMutationListener(refreshStudy);
    const unsubLife = lifeSimService.subscribe(refreshLife);
    const unsubCharacter = characterService.subscribe(setCharacter);
    const unsubAuth = AuthService.subscribe(setCurrentUser);
    return () => {
      unsubStorage();
      unsubLife();
      unsubCharacter();
      unsubAuth();
    };
  }, [refreshStudy, refreshLife]);

  const firstName = currentUser?.name.split(' ')[0];
  const dateLabel = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(now);
  const hasDecks = savedSessions.length > 0;

  const dueIds = useMemo(() => new Set(dueCards.map(card => card.id)), [dueCards]);
  const dueInSession = useCallback(
    (session: StudySession) =>
      session.concepts.reduce((sum, concept) => sum + (concept.retrievalCards || []).filter(card => dueIds.has(card.id)).length, 0),
    [dueIds],
  );

  // The deck to study first: the one with the most due cards, else the most recent.
  const primarySession = useMemo(() => {
    if (savedSessions.length === 0) return null;
    let best = savedSessions[0];
    let bestDue = dueInSession(best);
    for (const session of savedSessions) {
      const due = dueInSession(session);
      if (due > bestDue) {
        best = session;
        bestDue = due;
      }
    }
    return best;
  }, [savedSessions, dueInSession]);

  // Speed match needs question-and-answer cards: prefer today's deck, else any deck that has two pairs.
  const matchSession = useMemo(() => {
    const playable = (session: StudySession) => buildMatchTiles(session).length >= 4;
    if (primarySession && playable(primarySession)) return primarySession;
    return savedSessions.find(playable) ?? null;
  }, [primarySession, savedSessions]);

  const primaryCards = primarySession ? cardCount(primarySession) : 0;
  const estimatedMinutes = Math.max(1, Math.round((primaryCards * SECONDS_PER_CARD) / 60));
  const multiplier = lifeSimService.getActiveMultiplier();
  const estimatedTokens = primarySession
    ? Math.round(estimateReward({ kind: 'sprint', cards: primaryCards, minutes: estimatedMinutes }).tokens * multiplier)
    : 0;

  const goalPercent = Math.min(100, Math.round((reviewedToday / DAILY_REVIEW_GOAL) * 100));
  const goalDone = reviewedToday >= DAILY_REVIEW_GOAL;

  const displayedSessions = useMemo(() => {
    if (selectedFolderId === 'all') return savedSessions;
    if (selectedFolderId === 'uncategorized') return savedSessions.filter(s => !s.folderId);
    return savedSessions.filter(s => s.folderId === selectedFolderId);
  }, [savedSessions, selectedFolderId]);
  const totalCards = useMemo(() => savedSessions.reduce((sum, s) => sum + cardCount(s), 0), [savedSessions]);

  const housing = lifeSimService.getHousing();
  const homeBonus = housing.wageMultiplier - 1;
  const rentPaid = Boolean(ledger.rentPaidToday);
  const canPayRent = wallet >= housing.rentPerDay;

  const roleIndex = ACADEMIC_ROLES.reduce((found, role, index) => (totalReviews >= role.minCardsReviewed ? index : found), 0);
  const role = ACADEMIC_ROLES[roleIndex];
  const nextRole = ACADEMIC_ROLES[roleIndex + 1];

  const startQuickReview = () => {
    if (!primarySession) {
      onOpenStarterCatalog();
      return;
    }
    soundEngine.playCorrectChime();
    onStartSession({ ...primarySession, currentPhase: 'retrieval', casualFlashcardMode: true });
  };

  const startGuidedSession = () => {
    if (!primarySession) {
      onOpenStarterCatalog();
      return;
    }
    soundEngine.playContextShiftSound();
    onStartSession({ ...primarySession, currentPhase: 'priming', casualFlashcardMode: false });
  };

  const payRent = () => {
    const result = lifeSimService.payDailyRent();
    if (result.success) {
      setRentError(null);
      haptics.success();
    } else {
      setRentError(result.error || 'Could not pay rent.');
    }
    refreshLife();
  };

  const openFolderEditor = (folder: SubjectFolder | null) => {
    setEditingFolder(folder);
    setIsFolderModalOpen(true);
  };

  const sessionTitle = !hasDecks
    ? 'Build your first deck'
    : dueCards.length > 0
      ? `${dueCards.length} ${dueCards.length === 1 ? 'card is' : 'cards are'} due`
      : "You're all caught up";

  const sessionBody = !hasDecks
    ? 'Pick a starter deck for your level, or turn your notes or a PDF into flashcards in about a minute. Every review you do pays.'
    : dueCards.length > 0
      ? `Review them now while they are on the edge of forgetting. That is when recall does the most for long-term memory.`
      : 'Nothing is due right now. Practise ahead, try a mock exam, or come back when your next reviews are scheduled.';

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 animate-fadeIn">
      {/* Greeting */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] text-ink-subtle">{dateLabel}</p>
          <h1 className="mt-1 text-[26px] font-semibold tracking-tight text-ink sm:text-[30px]">
            {greetingFor(now)}
            {firstName ? `, ${firstName}` : ''}
          </h1>
        </div>
        <Button variant="ghost" size="sm" icon={Sparkles} onClick={() => setShowScienceModal(true)}>
          Why this works
        </Button>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_336px]">
        {/* Main column */}
        <div className="min-w-0 space-y-6">
          {/* Today's session */}
          <section
            aria-labelledby="today-session-title"
            className="relative overflow-hidden rounded-3xl border border-line bg-surface p-6 shadow-[inset_0_1px_0_rgb(255_255_255/0.04)] sm:p-7 animate-rise"
          >
            <div className="pointer-events-none absolute -right-28 -top-28 h-80 w-80 rounded-full bg-brand/20 blur-3xl" aria-hidden="true" />
            <div className="relative flex flex-col gap-7 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1 space-y-5">
                <div className="flex items-center gap-2 text-[13px] font-medium text-brand-text">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden="true" />
                  Today's session
                </div>
                <div>
                  <h2 id="today-session-title" className="text-[26px] font-semibold leading-tight tracking-tight text-ink sm:text-[30px]">
                    {sessionTitle}
                  </h2>
                  <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-ink-muted">{sessionBody}</p>
                </div>

                {primarySession && (
                  <dl className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-ink-muted">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <dt className="sr-only">Deck</dt>
                      <Layers className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
                      <dd className="max-w-[220px] truncate">{primarySession.title}</dd>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <dt className="sr-only">Time</dt>
                      <Clock className="h-4 w-4 text-ink-subtle" aria-hidden="true" />
                      <dd>About {estimatedMinutes} min</dd>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <dt className="sr-only">Pay</dt>
                      <CoinIcon className="h-4 w-4" />
                      <dd>
                        {estimatedTokens > 0 ? (
                          <>
                            Earns about <span className="font-semibold tabular-nums text-gold">{estimatedTokens}</span>
                          </>
                        ) : (
                          "Today's session pay is used up"
                        )}
                      </dd>
                    </div>
                  </dl>
                )}

                <div className="flex flex-wrap items-center gap-2.5">
                  {hasDecks ? (
                    <>
                      <Button variant="primary" size="lg" icon={Play} onClick={startQuickReview} className="w-full sm:w-auto">
                        {dueCards.length > 0 ? 'Start review' : 'Practise ahead'}
                      </Button>
                      <Button variant="secondary" size="lg" icon={Brain} onClick={startGuidedSession} className="w-full sm:w-auto">
                        Guided session
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="primary" size="lg" icon={Compass} onClick={onOpenStarterCatalog} className="w-full sm:w-auto">
                        Pick a starter deck
                      </Button>
                      <Button variant="secondary" size="lg" icon={Upload} onClick={onOpenDeckStudio} className="w-full sm:w-auto">
                        Import notes or PDF
                      </Button>
                    </>
                  )}
                </div>

                {primarySession && (
                  <div className="flex flex-wrap items-center gap-1 text-[13px]">
                    <span className="mr-1 text-ink-subtle">Or try</span>
                    {matchSession && (
                      <Button variant="ghost" size="sm" icon={Zap} onClick={() => onStartMatch(matchSession)}>
                        Speed match
                      </Button>
                    )}
                    {onOpenExam && (
                      <Button variant="ghost" size="sm" icon={Award} onClick={onOpenExam}>
                        Mock exam
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {hasDecks && (
                <div className="space-y-1.5 sm:hidden">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-ink-subtle">Daily goal</span>
                    <span className="tabular-nums text-ink-muted">
                      {Math.min(reviewedToday, DAILY_REVIEW_GOAL)} of {DAILY_REVIEW_GOAL} reviews
                    </span>
                  </div>
                  <ProgressBar value={goalPercent} tone={goalDone ? 'success' : 'brand'} label="Daily goal" />
                </div>
              )}

              {hasDecks && (
                <div className="hidden shrink-0 items-center gap-4 sm:flex sm:flex-col sm:gap-3">
                  <ProgressRing value={goalPercent} size={136} stroke={10} tone={goalDone ? 'success' : 'brand'}>
                    {goalDone ? (
                      <Check className="h-8 w-8 text-success" aria-hidden="true" />
                    ) : (
                      <span className="text-[30px] font-semibold leading-none tabular-nums text-ink">{reviewedToday}</span>
                    )}
                    <span className="mt-1.5 text-xs text-ink-subtle">
                      {goalDone ? 'Goal met' : `of ${DAILY_REVIEW_GOAL} reviews`}
                    </span>
                  </ProgressRing>
                  <span className="text-xs font-medium text-ink-subtle">Daily goal</span>
                </div>
              )}
            </div>
          </section>

          {/* At a glance */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile
              icon={Flame}
              label="Streak"
              value={stats.currentStreak}
              unit={stats.currentStreak === 1 ? 'day' : 'days'}
              tone="gold"
              note={hasFreeze ? 'Freeze active' : undefined}
              noteIcon={hasFreeze ? Snowflake : undefined}
              onClick={() => setIsStreakModalOpen(true)}
            />
            <StatTile icon={Layers} label="Due now" value={dueCards.length} unit="cards" onClick={startQuickReview} />
            <StatTile
              icon={TrendingUp}
              label="This week"
              value={weekly.current}
              unit="XP"
              note={weekly.best > 0 ? `Best ${weekly.best}` : undefined}
              onClick={onOpenDashboard}
            />
            <StatTile
              icon={GraduationCap}
              label="Level"
              value={stats.level}
              unit={stats.levelTitle}
              progress={((stats.xp % XP_PER_LEVEL) / XP_PER_LEVEL) * 100}
              onClick={onOpenDashboard}
            />
          </div>

          {/* Decks */}
          <section aria-labelledby="decks-title" className="space-y-3">
            <SectionHeader
              title="Your decks"
              description={hasDecks ? `${savedSessions.length} ${savedSessions.length === 1 ? 'deck' : 'decks'} · ${totalCards} cards` : undefined}
              action={
                <div className="flex items-center gap-1.5">
                  <Button variant="ghost" size="sm" icon={Compass} onClick={onOpenStarterCatalog}>
                    Explore
                  </Button>
                  <Button variant="secondary" size="sm" icon={Plus} onClick={onOpenDeckStudio}>
                    New deck
                  </Button>
                </div>
              }
            />
            <h2 id="decks-title" className="sr-only">
              Your decks
            </h2>

            {hasDecks && (
              <div className="no-scrollbar -mx-1 flex items-center gap-1.5 overflow-x-auto px-1 py-0.5">
                <FilterChip active={selectedFolderId === 'all'} onClick={() => setSelectedFolderId('all')} count={savedSessions.length}>
                  All
                </FilterChip>
                {folders.map(folder => {
                  const color = FOLDER_COLORS.find(c => c.id === folder.color) || FOLDER_COLORS[0];
                  const active = selectedFolderId === folder.id;
                  return (
                    <div key={folder.id} className="group/chip relative flex shrink-0 items-center">
                      <FilterChip
                        active={active}
                        onClick={() => setSelectedFolderId(active ? 'all' : folder.id)}
                        count={savedSessions.filter(s => s.folderId === folder.id).length}
                        dotClassName={color.dot}
                      >
                        {folder.name}
                      </FilterChip>
                      <button
                        type="button"
                        onClick={() => openFolderEditor(folder)}
                        aria-label={`Edit ${folder.name}`}
                        className="ml-0.5 hidden rounded-md p-1 text-ink-subtle hover:bg-surface-hover hover:text-ink group-hover/chip:inline-flex cursor-pointer"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={() => openFolderEditor(null)}
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-dashed border-line-strong px-3 text-[13px] text-ink-subtle transition-colors hover:border-brand hover:text-brand-text cursor-pointer"
                >
                  <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />
                  New subject
                </button>
                {onOpenFolders && folders.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={onOpenFolders} className="shrink-0">
                    Manage
                  </Button>
                )}
              </div>
            )}

            {!hasDecks ? (
              <Card className="flex flex-col items-center px-6 py-10 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand-text">
                  <Layers className="h-6 w-6" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-[15px] font-semibold text-ink">No decks yet</h3>
                <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-ink-muted">
                  Start from a verified starter deck, or let the AI turn your lecture notes or a PDF into a deck.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <Button variant="primary" icon={Compass} onClick={onOpenStarterCatalog}>
                    Explore starter decks
                  </Button>
                  <Button variant="secondary" icon={Upload} onClick={onOpenDeckStudio}>
                    Import notes or PDF
                  </Button>
                </div>
              </Card>
            ) : displayedSessions.length === 0 ? (
              <Card className="py-8 text-center text-[13px] text-ink-muted">No decks in this subject yet.</Card>
            ) : (
              <ul className="space-y-2">
                {displayedSessions.slice(0, DECKS_ON_HOME).map(session => {
                  const folder = folders.find(f => f.id === session.folderId);
                  const color = folder ? FOLDER_COLORS.find(c => c.id === folder.color) || FOLDER_COLORS[0] : null;
                  const due = dueInSession(session);
                  return (
                    <li
                      key={session.id}
                      className="group flex flex-col gap-3 rounded-2xl border border-line bg-surface p-3.5 pl-4 transition-colors hover:border-line-strong hover:bg-surface-hover sm:flex-row sm:items-center"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3.5">
                        <div
                          className={cn(
                            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-semibold',
                            color ? `${color.bg} ${color.text}` : 'bg-brand-soft text-brand-text',
                          )}
                          aria-hidden="true"
                        >
                          {folder?.icon || session.title.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-2">
                            <h3 className="truncate text-[15px] font-medium text-ink">{session.title}</h3>
                            {due > 0 && <Badge tone="due">{due} due</Badge>}
                          </div>
                          <p className="mt-0.5 truncate text-[13px] text-ink-subtle">
                            {session.concepts.length} {session.concepts.length === 1 ? 'concept' : 'concepts'} · {cardCount(session)} cards
                            {folder ? ` · ${folder.name}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button variant="primary" size="sm" icon={Play} onClick={() => onStartSession(session)}>
                          Study
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => onOpenDeckStation(session)}>
                          Details
                        </Button>
                        {onStartAudioBriefing && (
                          <IconButton icon={Headphones} label="Audio briefing" onClick={() => onStartAudioBriefing(session)} />
                        )}
                        <IconButton
                          icon={FolderInput}
                          label={folder ? 'Change subject' : 'Add to a subject'}
                          onClick={() => {
                            setMovingSession(session);
                            setIsMoveModalOpen(true);
                          }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {displayedSessions.length > DECKS_ON_HOME && onOpenLibrary && (
              <button
                type="button"
                onClick={onOpenLibrary}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-medium text-brand-text transition-colors hover:bg-surface cursor-pointer"
              >
                See all {displayedSessions.length} decks in the library
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </section>
        </div>

        {/* Side column: life and money */}
        <aside className="grid content-start gap-6 md:grid-cols-2 xl:grid-cols-1" aria-label="Wallet and progress">
          <Card className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-ink">Wallet</h2>
              <Button variant="ghost" size="sm" trailingIcon={ArrowRight} onClick={onOpenSanctuary}>
                Campus
              </Button>
            </div>

            <div>
              <div className="flex items-center gap-2.5">
                <CoinIcon className="h-7 w-7" />
                <span className="text-[34px] font-semibold leading-none tracking-tight tabular-nums text-ink">{wallet.toLocaleString()}</span>
              </div>
              <p className="mt-2 text-[13px] text-ink-subtle">
                Today <span className="font-medium tabular-nums text-success">+{ledger.totalEarnings.toLocaleString()}</span>
                {' · '}
                <span className="font-medium tabular-nums text-ink-muted">−{ledger.totalExpenses.toLocaleString()}</span> spent
                {multiplier !== 1 && (
                  <>
                    {' · '}
                    <span className="font-medium text-ink-muted">×{multiplier} pay</span>
                  </>
                )}
              </p>
            </div>

            <div className="rounded-xl border border-line bg-surface p-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-hover text-ink-muted">
                  <Building2 className="h-[18px] w-[18px]" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-ink">{housing.name}</p>
                  <p className="text-xs text-ink-subtle">
                    {homeBonus > 0 ? (
                      <>
                        Rent <Tokens amount={housing.rentPerDay} iconClassName="h-3 w-3" className="text-ink-muted" /> a day ·{' '}
                        {formatBonus(homeBonus)} pay on days it's paid
                      </>
                    ) : (
                      'No rent, and no pay bonus'
                    )}
                  </p>
                </div>
                {homeBonus > 0 &&
                  (rentPaid ? (
                    <Badge tone="success">
                      <Check className="h-3 w-3" aria-hidden="true" />
                      Paid
                    </Badge>
                  ) : (
                    <Button variant="gold" size="sm" onClick={payRent} disabled={!canPayRent}>
                      Pay rent
                    </Button>
                  ))}
              </div>
              {homeBonus > 0 && !rentPaid && !canPayRent && (
                <p className="mt-2.5 text-xs leading-relaxed text-ink-muted">
                  You need {housing.rentPerDay - wallet} more tokens to turn on today's bonus. A short review session covers it.
                </p>
              )}
              {homeBonus === 0 && (
                <p className="mt-2.5 text-xs leading-relaxed text-ink-subtle">
                  Bigger homes raise your pay on days you pay their rent. Upgrade yours in Campus.
                </p>
              )}
              {rentError && canPayRent && <p className="mt-2.5 text-xs text-danger">{rentError}</p>}
            </div>
          </Card>

          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-ink">Today's earnings</h2>
              {earnings.length > 0 && (
                <span className="text-xs tabular-nums text-ink-subtle">
                  {earnings.reduce((sum, e) => sum + e.paidXp, 0)} XP
                </span>
              )}
            </div>
            {earnings.length === 0 ? (
              <p className="text-[13px] leading-relaxed text-ink-muted">
                Nothing yet today. Your first review pays, and correct answers in mock exams pay the most.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {earnings.slice(0, 5).map(entry => {
                  const capped = entry.paidTokens < entry.rawTokens || entry.paidXp < entry.rawXp;
                  return (
                    <li key={entry.kind} className="flex items-center justify-between gap-3 text-[13px]">
                      <span className="flex min-w-0 items-center gap-2 text-ink-muted">
                        <span className="truncate">{REWARD_LABELS[entry.kind] ?? entry.kind}</span>
                        {capped && <Badge tone="neutral">Daily limit</Badge>}
                      </span>
                      <span className="flex shrink-0 items-center gap-3 tabular-nums">
                        {entry.paidTokens > 0 && <Tokens amount={entry.paidTokens} signed className="text-gold" />}
                        <span className="w-14 text-right text-ink-subtle">+{entry.paidXp} XP</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="border-t border-line pt-3 text-xs leading-relaxed text-ink-subtle">
              Pay follows learning: every review pays the same, exams pay for correct answers, and each activity has a daily limit.
            </p>
          </Card>

          <Card className="space-y-4">
            <div className="flex items-center gap-3.5">
              <button
                type="button"
                onClick={() => setIsCustomizerOpen(true)}
                aria-label="Customize avatar"
                className="shrink-0 rounded-2xl transition-transform hover:scale-[1.03] cursor-pointer"
              >
                <UserAvatarBadge size="sm" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-ink">{character.name}</p>
                <p className="truncate text-[13px] text-ink-subtle">{role.title}</p>
              </div>
            </div>
            {nextRole ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-ink-subtle">Next role: {nextRole.title}</span>
                  <span className="tabular-nums text-ink-muted">
                    {totalReviews}/{nextRole.minCardsReviewed}
                  </span>
                </div>
                <ProgressBar
                  value={((totalReviews - role.minCardsReviewed) / (nextRole.minCardsReviewed - role.minCardsReviewed)) * 100}
                  label={`Progress to ${nextRole.title}`}
                />
                <p className="text-xs text-ink-subtle">Higher roles earn a bigger base wage.</p>
              </div>
            ) : (
              <p className="text-xs text-ink-subtle">You hold the top academic role.</p>
            )}
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" className="flex-1" onClick={() => setIsCustomizerOpen(true)}>
                Edit avatar
              </Button>
              <Button variant="secondary" size="sm" className="flex-1" onClick={onOpenSanctuary}>
                Visit campus
              </Button>
            </div>
          </Card>
        </aside>
      </div>

      <ScienceExplainerModal isOpen={showScienceModal} onClose={() => setShowScienceModal(false)} initialTopic="fsrs" />

      <StreakGuardianModal
        isOpen={isStreakModalOpen}
        onClose={() => {
          setIsStreakModalOpen(false);
          refreshStudy();
        }}
        stats={stats}
        onLaunchStreakSaver={startQuickReview}
      />

      <SubjectFolderModal
        isOpen={isFolderModalOpen}
        onClose={() => {
          setIsFolderModalOpen(false);
          setEditingFolder(null);
        }}
        initialFolder={editingFolder}
        onFolderSaved={() => {
          refreshStudy();
          setIsFolderModalOpen(false);
          setEditingFolder(null);
        }}
      />

      <MoveToFolderModal
        isOpen={isMoveModalOpen}
        session={movingSession}
        onClose={() => {
          setIsMoveModalOpen(false);
          setMovingSession(null);
        }}
        onMoved={refreshStudy}
        onOpenNewFolderModal={() => {
          setIsMoveModalOpen(false);
          openFolderEditor(null);
        }}
      />

      {isCustomizerOpen && (
        <Suspense fallback={null}>
          <CharacterCustomizerModal isOpen={isCustomizerOpen} onClose={() => setIsCustomizerOpen(false)} />
        </Suspense>
      )}
    </div>
  );
};

interface StatTileProps {
  icon: LucideIcon;
  label: string;
  value: number;
  unit: string;
  tone?: 'brand' | 'gold';
  note?: string;
  noteIcon?: LucideIcon;
  progress?: number;
  onClick?: () => void;
}

const StatTile: React.FC<StatTileProps> = ({ icon: Icon, label, value, unit, tone = 'brand', note, noteIcon: NoteIcon, progress, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-surface p-4 text-left transition-colors hover:border-line-strong hover:bg-surface-hover cursor-pointer"
  >
    <span className="flex items-center justify-between gap-2 text-[13px] text-ink-subtle">
      {label}
      <Icon className={cn('h-4 w-4', tone === 'gold' ? 'text-gold' : 'text-ink-subtle group-hover:text-brand-text')} aria-hidden="true" />
    </span>
    <span className="flex min-w-0 items-baseline gap-1.5">
      <span className="text-[26px] font-semibold leading-none tracking-tight tabular-nums text-ink">{value.toLocaleString()}</span>
      <span className="truncate text-[13px] text-ink-subtle">{unit}</span>
    </span>
    {progress !== undefined ? (
      <ProgressBar value={progress} label={`${label} progress`} />
    ) : (
      <span className="flex h-4 items-center gap-1 text-xs text-ink-subtle">
        {NoteIcon && <NoteIcon className="h-3 w-3 text-brand-text" aria-hidden="true" />}
        {note}
      </span>
    )}
  </button>
);

const FilterChip: React.FC<{
  active: boolean;
  onClick: () => void;
  count: number;
  dotClassName?: string;
  children: React.ReactNode;
}> = ({ active, onClick, count, dotClassName, children }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={cn(
      'inline-flex h-8 shrink-0 items-center gap-2 rounded-full border px-3 text-[13px] transition-colors cursor-pointer',
      active ? 'border-transparent bg-ink text-canvas' : 'border-line text-ink-muted hover:border-line-strong hover:text-ink',
    )}
  >
    {dotClassName && <span className={cn('h-2 w-2 rounded-full', dotClassName)} aria-hidden="true" />}
    <span className="max-w-[160px] truncate">{children}</span>
    <span className={cn('tabular-nums', active ? 'opacity-70' : 'text-ink-subtle')}>{count}</span>
  </button>
);

export default DailyMissionHome;
