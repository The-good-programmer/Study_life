import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ECONOMY_VISIBLE } from '../../services/features';
import confetti from 'canvas-confetti';
import {
  Layers,
  ArrowRight,
  RotateCcw,
  Printer,
  Download,
  FileText,
  Zap,
  Check,
  Share2,
  Flame,
  CalendarClock,
  Trophy,
} from 'lucide-react';
import type { StudySession, ConceptCheckpoint } from '../../types';
import { StorageService } from '../../services/storageService';
import { soundEngine } from '../../services/soundEngine';
import { ExportService } from '../../services/exportService';
import { SynapticFlexModal } from '../mascot/SynapticFlexModal';
import { lifeSimService } from '../../services/lifeSimService';
import { grantReward } from '../../services/economy/rewardService';
import { payableMinutes } from '../../services/economy/rewardRules';
import { haptics } from '../../services/hapticsService';
import { Button, Card, CoinIcon, IconMedallion } from '../ui/primitives';
import { groupNextReviews } from './sessionSchedule';
import { completionKey, estimatedMinutesOf, ratedInPass } from './sessionPass';
import type { ReviewGroup } from './sessionSchedule';

interface SessionSummaryProps {
  session: StudySession;
  onRestart: () => void;
  onHome: () => void;
  onOpenDashboard: () => void;
  onStartSession?: (session: StudySession) => void;
}

function generateRescueSession(originalSession: StudySession): StudySession {
  const missedProbes = originalSession.diagnosticReport?.probes.filter(p => !p.isCorrect) || [];
  const missedConceptIds = new Set(missedProbes.map(p => p.conceptId));

  const conceptsForRescue: ConceptCheckpoint[] = [];

  originalSession.concepts.forEach(concept => {
    const isFragileConcept = missedConceptIds.has(concept.id);
    const cards = concept.retrievalCards || [];
    const lapsedCards = cards.filter(c => (c.lapses && c.lapses > 0) || (c.stability && c.stability <= 1.5));
    
    const selectedCards = lapsedCards.length > 0 
      ? lapsedCards 
      : isFragileConcept 
      ? cards.slice(0, 2) 
      : [];

    if (selectedCards.length > 0 || isFragileConcept) {
      conceptsForRescue.push({
        ...concept,
        id: `rescue-${concept.id}-${Date.now()}`,
        title: `Review: ${concept.title}`,
        retrievalCards: selectedCards.length > 0 ? selectedCards : cards.slice(0, 2),
      });
    }
  });

  if (conceptsForRescue.length === 0) {
    const fallbackCards = originalSession.concepts.flatMap(c => c.retrievalCards || []).slice(0, 4);
    conceptsForRescue.push({
      ...originalSession.concepts[0],
      id: `consolidation-${Date.now()}`,
      title: `Review: ${originalSession.concepts[0].title}`,
      retrievalCards: fallbackCards,
    });
  }

  return {
    id: `rescue-${Date.now()}`,
    title: `${originalSession.title} (rescue drill)`,
    category: originalSession.category,
    description: `A short drill on the hardest cards from "${originalSession.title}".`,
    concepts: conceptsForRescue,
    currentConceptIndex: 0,
    currentPhase: 'retrieval',
    elapsedSeconds: 0,
    createdAt: new Date().toISOString(),
    casualFlashcardMode: true,
  };
}

export const SessionSummary: React.FC<SessionSummaryProps> = ({
  session,
  onRestart,
  onHome,
  onOpenDashboard,
  onStartSession,
}) => {
  const minutes = Math.max(1, Math.round(session.elapsedSeconds / 60));
  // What the session pays for: the cards rated in this pass, and its time up to 1.5x the deck's estimate.
  const ratedCardIds = useMemo(() => ratedInPass(session), [session]);
  const paidMinutes = payableMinutes(minutes, estimatedMinutesOf(session));
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);
  const [rescueSaved, setRescueSaved] = useState(false);
  const [isFlexModalOpen, setIsFlexModalOpen] = useState(false);

  const missedProbes = session.diagnosticReport?.probes.filter(p => !p.isCorrect) || [];

  const handleSaveRescueDeck = () => {
    const rescueSession = generateRescueSession(session);
    StorageService.saveSession(rescueSession);
    soundEngine.playSuccess();
    setRescueSaved(true);
    setTimeout(() => setRescueSaved(false), 4000);
  };

  const handleStartRescueDrill = () => {
    const rescueSession = generateRescueSession(session);
    StorageService.saveSession(rescueSession);
    soundEngine.playStart();
    if (onStartSession) {
      onStartSession(rescueSession);
    }
  };

  const [wageEarned, setWageEarned] = useState<{
    rawAmount: number;
    buffBonus: number;
    totalAmount: number;
    activity: string;
    walletBalance: number;
  } | null>(null);
  /** Why the session paid nothing, or how many of its cards were already paid for today. */
  const [payNote, setPayNote] = useState<{ reason: 'capped' | 'repeated' | 'no-cards' | null; repeatCards: number }>({
    reason: null,
    repeatCards: 0,
  });
  const [streak, setStreak] = useState(() => StorageService.getStats().currentStreak);
  const [nextReviews, setNextReviews] = useState<ReviewGroup[]>([]);

  // Celebration effects (cosmetic).
  useEffect(() => {
    soundEngine.playCompletionChime();
    haptics.celebrate();
    const coinTimer = setTimeout(() => {
      if (!ECONOMY_VISIBLE) return;
      soundEngine.playCoinCascade();
      haptics.coin();
    }, 650);

    try {
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 },
        disableForReducedMotion: true,
      });
    } catch {
      // confetti fallback
    }

    return () => clearTimeout(coinTimer);
  }, []);

  // Record the session and pay the study wage exactly once per finished pass. The claim
  // stops a reopened summary from paying again; the ref guard covers StrictMode's double-run.
  const recordedRef = useRef(false);
  const completion = completionKey(session);
  useEffect(() => {
    if (recordedRef.current) return;
    recordedRef.current = true;

    if (StorageService.claimCompletion(completion)) {
      StorageService.recordCompletedSession();
      StorageService.recordStudyMinutes(minutes);

      const grant = grantReward(
        { kind: 'sprint', cardIds: ratedCardIds, minutes: paidMinutes },
        { label: `Sprint: ${session.title ? session.title.slice(0, 24) : 'Active Recall'}` },
      );
      // Displays the result of the one-time award above; it cannot be derived during render.
      // oxlint-disable-next-line react/set-state-in-effect
      setWageEarned(grant.wage ? { ...grant.wage, walletBalance: lifeSimService.getWalletBalance() } : null);
      const reason = grant.wage
        ? null
        : ratedCardIds.length === 0
          ? 'no-cards'
          : grant.repeatCards === ratedCardIds.length
            ? 'repeated'
            : grant.capped
              ? 'capped'
              : null;
      setPayNote({ reason, repeatCards: grant.repeatCards });
    }
    setStreak(StorageService.getStats().currentStreak);

    // When the scheduler will bring this session's cards back.
    const sessionCardIds = new Set(session.concepts.flatMap(c => c.retrievalCards.map(card => card.id)));
    setNextReviews(groupNextReviews(StorageService.getAllCards().filter(card => sessionCardIds.has(card.id))));
  }, [completion, minutes, paidMinutes, ratedCardIds, session.title, session.concepts]);

  const handlePrint = () => {
    ExportService.printStudySheet(session);
  };

  const handleDownloadMD = () => {
    ExportService.downloadMarkdown(session);
    setDownloadNotice('Downloaded your notes as Markdown.');
    setTimeout(() => setDownloadNotice(null), 3000);
  };

  const handleDownloadAnki = () => {
    ExportService.downloadAnkiTSV(session);
    setDownloadNotice('Downloaded a TSV file for Anki or Quizlet.');
    setTimeout(() => setDownloadNotice(null), 3000);
  };

  const isReview = Boolean(session.casualFlashcardMode);
  const rated = ratedCardIds.length;
  const headline = streak >= 2 ? `${streak} days in a row!` : isReview ? 'Review complete' : 'Session complete';
  const nextUp = nextReviews[0];

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 py-6 animate-fadeIn">
      {/* The moment worth a screenshot: what was done, the streak, and when the cards come back. */}
      <header className="relative overflow-hidden rounded-3xl border border-brand/25 bg-gradient-to-b from-brand-soft to-surface-solid px-5 pb-6 pt-7 text-center sm:px-8 animate-rise">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-brand/25 blur-3xl" aria-hidden="true" />
        <IconMedallion icon={Trophy} size="lg" className="relative mx-auto" />
        <h1 className="relative mt-3 text-[28px] font-semibold tracking-tight text-ink sm:text-[32px]">{headline}</h1>
        <p className="relative mx-auto mt-1 max-w-md text-[15px] text-ink-muted">
          {rated > 0 ? `${rated} ${rated === 1 ? 'card' : 'cards'} in ${minutes} min · ` : ''}
          {session.title}
        </p>

        <dl className="relative mx-auto mt-5 grid max-w-md grid-cols-3 divide-x divide-line rounded-2xl border border-line bg-surface-solid/70 py-3">
          <div>
            <dt className="text-xs text-ink-subtle">Cards</dt>
            <dd className="mt-0.5 text-[22px] font-semibold tabular-nums text-ink">{rated.toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-subtle">Minutes</dt>
            <dd className="mt-0.5 text-[22px] font-semibold tabular-nums text-ink">{minutes}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-subtle">Streak</dt>
            <dd className="mt-0.5 flex items-center justify-center gap-1 text-[22px] font-semibold tabular-nums text-ink">
              <Flame className="h-5 w-5 text-gold" aria-hidden="true" />
              {streak}
            </dd>
          </div>
        </dl>

        {nextUp && (
          <p className="relative mt-3 inline-flex items-center gap-1.5 text-[13px] text-ink-muted">
            <CalendarClock className="h-4 w-4 text-brand-text" aria-hidden="true" />
            Next up: {nextUp.count} {nextUp.count === 1 ? 'card' : 'cards'} {nextUp.label.charAt(0).toLowerCase() + nextUp.label.slice(1)}
          </p>
        )}

        <div className="relative mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button variant="primary" size="lg" trailingIcon={ArrowRight} onClick={onHome}>
            Done
          </Button>
          <Button variant="secondary" size="lg" icon={Share2} onClick={() => setIsFlexModalOpen(true)}>
            Share
          </Button>
        </div>
      </header>

      {!ECONOMY_VISIBLE ? null : wageEarned ? (
        <Card className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[13px] text-ink-subtle">You earned</p>
              <p className="mt-1 flex items-center gap-2.5 text-[34px] font-semibold leading-none tracking-tight tabular-nums text-ink">
                <CoinIcon className="h-8 w-8" />+{wageEarned.totalAmount}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[13px] text-ink-subtle">Wallet</p>
              <p className="mt-1 text-[20px] font-semibold tabular-nums text-gold">{wageEarned.walletBalance.toLocaleString()}</p>
            </div>
          </div>
          {wageEarned.buffBonus > 0 && (
            <p className="text-[13px] text-ink-muted">
              Includes <span className="font-medium text-success">+{wageEarned.buffBonus}</span> from your meal bonus.
            </p>
          )}
          {payNote.repeatCards > 0 && (
            <p className="text-[13px] text-ink-muted">
              {payNote.repeatCards} {payNote.repeatCards === 1 ? 'card was' : 'cards were'} already paid for today, so only the
              others count. Each card pays once a day.
            </p>
          )}
          <p className="border-t border-line pt-3 text-[13px] text-ink-subtle">Spend it on meals and rent on campus, or save toward a bigger room.</p>
        </Card>
      ) : payNote.reason === 'capped' ? (
        <Card className="text-[14px] leading-relaxed text-ink-muted">
          You have reached today's limit for session pay. Your reviews still count toward your memory and XP, and the limit resets tomorrow.
        </Card>
      ) : payNote.reason === 'repeated' ? (
        <Card className="text-[14px] leading-relaxed text-ink-muted">
          These cards were already paid for today. Going over them again still strengthens your memory, and they pay again tomorrow.
        </Card>
      ) : payNote.reason === 'no-cards' ? (
        <Card className="text-[14px] leading-relaxed text-ink-muted">
          Session pay comes from the flashcards you rate, and none were rated this time.
        </Card>
      ) : null}

      {nextReviews.length > 0 && (
        <Card className="space-y-3">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">When these cards come back</h2>
            <p className="mt-0.5 text-[13px] text-ink-subtle">Each card returns just before you would be likely to forget it.</p>
          </div>
          <ul className="divide-y divide-line">
            {nextReviews.map(group => (
              <li key={group.label} className="flex items-center justify-between py-2 text-[14px]">
                <span className="text-ink-muted">{group.label}</span>
                <span className="font-medium tabular-nums text-ink">
                  {group.count} {group.count === 1 ? 'card' : 'cards'}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="space-y-4">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Shore up weak spots</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
            {missedProbes.length > 0
              ? `Your warm-up showed gaps in ${missedProbes.map(p => p.conceptTitle).join(', ')}. A short drill on those cards helps them stick.`
              : 'Turn the cards you found hardest into a short drill, now or for tomorrow.'}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {onStartSession && (
            <Button variant="primary" icon={Zap} onClick={handleStartRescueDrill}>
              Start a 3-minute drill
            </Button>
          )}
          <Button variant="secondary" icon={rescueSaved ? Check : Download} onClick={handleSaveRescueDeck}>
            {rescueSaved ? 'Saved to your library' : 'Save it for later'}
          </Button>
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-[15px] font-semibold text-ink">Take it with you</h2>
        <div className="grid grid-cols-3 gap-2">
          <Button variant="secondary" size="sm" icon={Printer} onClick={handlePrint}>
            Study sheet
          </Button>
          <Button variant="secondary" size="sm" icon={FileText} onClick={handleDownloadMD}>
            Markdown
          </Button>
          <Button variant="secondary" size="sm" icon={Download} onClick={handleDownloadAnki}>
            Anki / Quizlet
          </Button>
        </div>
        {downloadNotice && (
          <p role="status" className="text-[13px] text-success">
            {downloadNotice}
          </p>
        )}
      </Card>

      {/* "Done" is in the summary card at the top; these are the other ways on. */}
      <div className="grid grid-cols-2 gap-2 pt-1 sm:flex sm:justify-end">
        <Button variant="ghost" icon={RotateCcw} onClick={onRestart}>
          Study again
        </Button>
        <Button variant="secondary" icon={Layers} onClick={onOpenDashboard}>
          See what is due
        </Button>
      </div>

      <SynapticFlexModal
        isOpen={isFlexModalOpen}
        onClose={() => setIsFlexModalOpen(false)}
        session={session}
        stats={StorageService.getStats()}
      />
    </div>
  );
};
