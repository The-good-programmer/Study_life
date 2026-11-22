import React, { useState, useMemo } from 'react';
import {
  Flame,
  Award,
  Play,
  Bug,
  Shuffle,
  BrainCircuit,
  ChevronRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { RetrievalCard, StudySession, UserStats } from '../../types';
import { StorageService } from '../../services/storageService';
import { FSRSService } from '../../services/fsrsService';
import { LeechHunterLab } from './LeechHunterLab';
import { CurriculumKnowledgeMap } from './CurriculumKnowledgeMap';
import { Badge, Button, Card } from '../ui/primitives';

interface RetentionDashboardProps {
  stats: UserStats;
  onBack: () => void;
  onStartSession: (session: StudySession) => void;
  onOpenDeckStation?: (session: StudySession) => void;
  onOpenExam?: () => void;
  onOpenInterleaving?: () => void;
  /** Starts today's review across decks (the same as Start review elsewhere). */
  onStartDailyReview?: () => void;
}

export const RetentionDashboard: React.FC<RetentionDashboardProps> = ({ 
  stats, 
  onStartSession, 
  onOpenDeckStation,
  onOpenExam,
  onOpenInterleaving,
  onStartDailyReview,
}) => {
  const [activeView, setActiveView] = useState<'overview' | 'curriculum' | 'leeches'>('overview');
  const [queue, setQueue] = useState(() => StorageService.getDailyQueue());
  const [allCards, setAllCards] = useState<RetrievalCard[]>(() => StorageService.getAllCards());
  const [targetRetention, setTargetRetention] = useState(() => StorageService.getTargetRetention());
  const [examReports] = useState(StorageService.getExamReports());
  const [interleavingReports] = useState(StorageService.getInterleavingReports());
  const sessions = StorageService.getSessions();

  const leeches = useMemo(() => FSRSService.findLeeches(allCards), [allCards]);

  // FSRS Power-Law Retrievability & Stability Metrics
  const avgStability = useMemo(() => {
    if (allCards.length === 0) return 7;
    const sum = allCards.reduce((acc, c) => acc + (c.stability || 1), 0);
    return Math.round((sum / allCards.length) * 10) / 10;
  }, [allCards]);

  const meanRetrievability = useMemo(() => {
    if (allCards.length === 0) return 90;
    const sum = allCards.reduce((acc, c) => acc + FSRSService.calculateRetrievability(c), 0);
    return Math.round(sum / allCards.length);
  }, [allCards]);

  const decayPoints = useMemo(() => {
    return FSRSService.generateDecayCurve(avgStability, 30);
  }, [avgStability]);

  // Card mastery stage buckets
  const learningCards = allCards.filter(c => (c.stability || 0) < 1).length;
  const youngCards = allCards.filter(c => (c.stability || 0) >= 1 && (c.stability || 0) < 7).length;
  const matureCards = allCards.filter(c => (c.stability || 0) >= 7 && (c.stability || 0) < 30).length;
  const masteredCards = allCards.filter(c => (c.stability || 0) >= 30).length;


  const activityHistory = useMemo(() => StorageService.getActivityHistory(), []);




  const [todayTimestamp] = useState(() => Date.now());

  // 35-day Heatmap activity matrix backed by persistent activity history
  const heatmapDays = useMemo(() => {
    const daysInMatrix = 35;
    const today = new Date(todayTimestamp);
    return Array.from({ length: daysInMatrix }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (daysInMatrix - 1 - i));
      const isToday = i === daysInMatrix - 1;
      const dateKey = d.toISOString().split('T')[0];
      const minutesOnDay = isToday ? (stats.todayMinutes || 0) : (activityHistory[dateKey] || 0);
      const hasStudy = minutesOnDay > 0;
      const intensity = minutesOnDay >= 30 ? 3 : minutesOnDay >= 15 ? 2 : minutesOnDay > 0 ? 1 : 0;
      
      return {
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        intensity,
        hasStudy,
      };
    });
  }, [stats.todayMinutes, todayTimestamp, activityHistory]);


  if (activeView === 'curriculum') {
    return (
      <CurriculumKnowledgeMap
        onBack={() => {
          setActiveView('overview');
          setAllCards(StorageService.getAllCards());
          setQueue(StorageService.getDailyQueue());
        }}
        onStartSession={onStartSession}
        onOpenDeckStation={onOpenDeckStation}
        onOpenHardCards={() => setActiveView('leeches')}
      />
    );
  }

  if (activeView === 'leeches') {
    return (
      <LeechHunterLab
        onBack={() => {
          setActiveView('overview');
          setAllCards(StorageService.getAllCards());
          setQueue(StorageService.getDailyQueue());
        }}
        onCardCured={() => {
          setAllCards(StorageService.getAllCards());
          setQueue(StorageService.getDailyQueue());
        }}
      />
    );
  }

  const hasCards = allCards.length > 0;
  const stageTotal = Math.max(1, allCards.length);
  const stages = [
    { label: 'New or shaky', detail: 'under a day', count: learningCards, bar: 'bg-danger' },
    { label: 'Building', detail: '1 to 7 days', count: youngCards, bar: 'bg-gold' },
    { label: 'Solid', detail: '1 to 4 weeks', count: matureCards, bar: 'bg-brand' },
    { label: 'Long-term', detail: 'over a month', count: masteredCards, bar: 'bg-success' },
  ];
  const latestExam = examReports[0];
  const latestMix = interleavingReports[0];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 animate-fadeIn">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[26px] font-semibold tracking-tight text-ink sm:text-[30px]">Insights</h1>
          <p className="mt-1 text-[15px] text-ink-muted">How well your memory is holding up, and what to do next.</p>
        </div>
        <div role="tablist" aria-label="Insights views" className="inline-flex rounded-xl border border-line bg-canvas p-1">
          {([
            { view: 'overview', label: 'Overview' },
            { view: 'curriculum', label: 'Knowledge map' },
            { view: 'leeches', label: `Hard cards${leeches.length ? ` (${leeches.length})` : ''}` },
          ] as const).map(({ view, label }) => (
            <button
              key={view}
              type="button"
              role="tab"
              aria-selected={activeView === view}
              onClick={() => setActiveView(view)}
              className={`inline-flex h-8 items-center rounded-lg px-3 text-[13px] font-medium transition-colors cursor-pointer ${
                activeView === view ? 'bg-surface-hover text-ink shadow-sm' : 'text-ink-subtle hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* Review queue */}
      <section className="relative flex flex-col gap-5 overflow-hidden rounded-3xl border border-line bg-surface p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand/15 blur-3xl" aria-hidden="true" />
        <div className="relative min-w-0">
          <p className="text-[13px] font-medium text-brand-text">Review queue</p>
          <h2 className="mt-1.5 text-[24px] font-semibold tracking-tight text-ink">
            {queue.cards.length > 0
              ? `${queue.dueCount} to review${queue.newCount > 0 ? `, ${queue.newCount} new` : ''}`
              : 'All done for today'}
          </h2>
          <p className="mt-1.5 max-w-lg text-[14px] leading-relaxed text-ink-muted">
            {queue.cards.length > 0
              ? 'Reviewing cards when they come due is what keeps them in long-term memory. New cards are spread out so reviews never pile up.'
              : hasCards
                ? 'You are up to date. Cards come back here as they near the point of being forgotten.'
                : 'Add a deck and start reviewing, and your schedule will build up here.'}
          </p>
        </div>
        {queue.cards.length > 0 && onStartDailyReview && (
          <Button variant="primary" size="lg" icon={Play} onClick={onStartDailyReview} className="relative w-full shrink-0 sm:w-auto">
            Start review
          </Button>
        )}
      </section>

      {/* At a glance */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <InsightStat label="Streak" value={stats.currentStreak.toLocaleString()} unit={stats.currentStreak === 1 ? 'day' : 'days'} />
        <InsightStat label="Study time" value={formatMinutes(stats.totalStudyMinutes)} />
        <InsightStat label="Cards" value={allCards.length.toLocaleString()} unit={`in ${sessions.length} ${sessions.length === 1 ? 'deck' : 'decks'}`} />
        <InsightStat label="Recall right now" value={hasCards ? `${meanRetrievability}%` : '—'} unit={hasCards ? 'average' : 'no cards yet'} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Memory health */}
        <Card className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold text-ink">Memory health</h2>
              <p className="mt-0.5 text-[13px] text-ink-subtle">How long each card is likely to stay with you.</p>
            </div>
            <div role="radiogroup" aria-label="Target recall" className="inline-flex rounded-lg border border-line bg-canvas p-0.5">
              {[
                { rate: 0.85, label: '85%', title: 'Relaxed: fewer reviews' },
                { rate: 0.9, label: '90%', title: 'Standard' },
                { rate: 0.95, label: '95%', title: 'Exam mode: more reviews' },
              ].map(item => {
                const selected = Math.abs(targetRetention - item.rate) < 0.01;
                return (
                  <button
                    key={item.rate}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    title={item.title}
                    onClick={() => {
                      setTargetRetention(item.rate);
                      StorageService.setTargetRetention(item.rate);
                    }}
                    className={`h-7 rounded-md px-2.5 text-xs font-medium tabular-nums transition-colors cursor-pointer ${
                      selected ? 'bg-surface-hover text-ink shadow-sm' : 'text-ink-subtle hover:text-ink'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {hasCards ? (
            <>
              <div className="space-y-3">
                <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-hover" aria-hidden="true">
                  {stages.map(stage =>
                    stage.count > 0 ? (
                      <div key={stage.label} className={stage.bar} style={{ width: `${(stage.count / stageTotal) * 100}%` }} />
                    ) : null,
                  )}
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-4">
                  {stages.map(stage => (
                    <div key={stage.label}>
                      <dt className="flex items-center gap-1.5 text-xs text-ink-subtle">
                        <span className={`h-2 w-2 rounded-full ${stage.bar}`} aria-hidden="true" />
                        {stage.label}
                      </dt>
                      <dd className="mt-0.5 text-[17px] font-semibold tabular-nums text-ink">
                        {stage.count}
                        <span className="ml-1 text-xs font-normal text-ink-subtle">{stage.detail}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="space-y-2 border-t border-line pt-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-[13px]">
                  <span className="text-ink-muted">If you stopped reviewing today</span>
                  <span className="text-ink-subtle">
                    Next review at {Math.round(targetRetention * 100)}%: about{' '}
                    <span className="font-medium tabular-nums text-ink">{FSRSService.calculateInterval(avgStability, targetRetention)} days</span>
                  </span>
                </div>
                <ForgettingCurve points={decayPoints} targetRetention={targetRetention} />
                <p className="text-xs text-ink-subtle">
                  Average card stability is {avgStability} days. Each successful review makes it longer.
                </p>
              </div>
            </>
          ) : (
            <p className="rounded-2xl border border-dashed border-line-strong px-4 py-8 text-center text-[13px] text-ink-subtle">
              Your memory health appears once you have reviewed some cards.
            </p>
          )}
        </Card>

        {/* Activity */}
        <Card className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold text-ink">Last five weeks</h2>
              <p className="mt-0.5 text-[13px] text-ink-subtle">Days you studied, darker for longer sessions.</p>
            </div>
            <Badge tone="gold">
              <Flame className="h-3 w-3 fill-current" aria-hidden="true" />
              {stats.currentStreak} {stats.currentStreak === 1 ? 'day' : 'days'}
            </Badge>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {heatmapDays.map((d, idx) => (
              <div
                key={idx}
                title={`${d.date}: ${d.hasStudy ? 'studied' : 'no study'}`}
                className={`flex h-9 items-center justify-center rounded-lg text-[11px] tabular-nums ${HEAT_CELLS[d.intensity]}`}
              >
                {d.date.split(' ')[1]}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between text-xs text-ink-subtle">
            <span>5 weeks ago</span>
            <span className="flex items-center gap-1.5">
              Less
              {HEAT_CELLS.map((cls, i) => (
                <span key={i} className={`h-3 w-3 rounded ${cls}`} aria-hidden="true" />
              ))}
              More
            </span>
            <span>Today</span>
          </div>
        </Card>
      </div>

      {/* Tools */}
      <section aria-labelledby="insight-tools" className="space-y-3">
        <h2 id="insight-tools" className="text-[15px] font-semibold text-ink">Go deeper</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ToolCard
            icon={Bug}
            title="Hard cards"
            description="Cards you keep forgetting, with fixes such as mnemonics or splitting them up."
            meta={leeches.length > 0 ? `${leeches.length} need attention` : 'None right now'}
            tone={leeches.length > 0 ? 'danger' : 'neutral'}
            onClick={() => setActiveView('leeches')}
          />
          <ToolCard
            icon={BrainCircuit}
            title="Knowledge map"
            description="How your topics build on each other, and what to learn next."
            meta={`${sessions.length} ${sessions.length === 1 ? 'deck' : 'decks'}`}
            onClick={() => setActiveView('curriculum')}
          />
          {onOpenExam && (
            <ToolCard
              icon={Award}
              title="Mock exam"
              description="Timed questions scored on accuracy and on how well your confidence matched."
              meta={latestExam ? `Last: ${latestExam.rawAccuracyPercent}% correct, ${latestExam.calibrationPercent}% calibrated` : 'Not taken yet'}
              onClick={onOpenExam}
            />
          )}
          {onOpenInterleaving && (
            <ToolCard
              icon={Shuffle}
              title="Mix decks"
              description="Practise switching between subjects, which helps you tell similar ideas apart."
              meta={latestMix ? `Last: ${latestMix.switchAccuracyPercent}% on switches` : 'Not tried yet'}
              onClick={onOpenInterleaving}
            />
          )}
        </div>
      </section>

      {/* Decks */}
      <section aria-labelledby="insight-decks" className="space-y-3">
        <h2 id="insight-decks" className="text-[15px] font-semibold text-ink">Your decks</h2>
        {sessions.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line-strong px-4 py-8 text-center text-[13px] text-ink-subtle">
            No decks yet.
          </p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {sessions.map(sess => (
              <li key={sess.id}>
                <button
                  type="button"
                  onClick={() => (onOpenDeckStation ? onOpenDeckStation(sess) : onStartSession(sess))}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-hover cursor-pointer"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-medium text-ink">{sess.title}</span>
                    <span className="block text-[13px] text-ink-subtle">
                      {sess.concepts.length} concepts · {formatMinutes(Math.max(1, Math.round(sess.elapsedSeconds / 60)))} studied
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

const HEAT_CELLS = [
  'bg-surface-hover text-ink-subtle',
  'bg-brand/25 text-ink-muted',
  'bg-brand/55 text-ink',
  'bg-brand text-brand-ink',
];

const formatMinutes = (minutes: number): string => {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
};

const InsightStat: React.FC<{ label: string; value: string; unit?: string }> = ({ label, value, unit }) => (
  <div className="rounded-2xl border border-line bg-surface p-4">
    <p className="text-[13px] text-ink-subtle">{label}</p>
    <p className="mt-2 flex min-w-0 items-baseline gap-1.5">
      <span className="text-[24px] font-semibold leading-none tracking-tight tabular-nums text-ink">{value}</span>
      {unit && <span className="truncate text-[13px] text-ink-subtle">{unit}</span>}
    </p>
  </div>
);

const ToolCard: React.FC<{
  icon: LucideIcon;
  title: string;
  description: string;
  meta: string;
  tone?: 'neutral' | 'danger';
  onClick: () => void;
}> = ({ icon: Icon, title, description, meta, tone = 'neutral', onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex flex-col items-start gap-3 rounded-2xl border border-line bg-surface p-4 text-left transition-colors hover:border-line-strong hover:bg-surface-hover cursor-pointer"
  >
    <span
      className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-brand-soft text-brand-text'}`}
    >
      <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
    </span>
    <span>
      <span className="block text-[15px] font-medium text-ink">{title}</span>
      <span className="mt-1 block text-[13px] leading-relaxed text-ink-subtle">{description}</span>
    </span>
    <span className={`mt-auto flex w-full items-center justify-between text-[13px] font-medium ${tone === 'danger' ? 'text-danger' : 'text-ink-muted group-hover:text-ink'}`}>
      {meta}
      <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </span>
  </button>
);

/** Recall probability over 30 days for an average card, with the target line. */
const ForgettingCurve: React.FC<{ points: { day: number; retrievability: number }[]; targetRetention: number }> = ({
  points,
  targetRetention,
}) => {
  const width = 600;
  const height = 150;
  const minR = 40;
  const toX = (day: number) => (day / 30) * (width - 20) + 10;
  const toY = (r: number) => height - ((Math.max(minR, r) - minR) / (100 - minR)) * (height - 10);
  const line = points.map(p => `${toX(p.day)},${toY(p.retrievability)}`).join(' L ');
  const targetY = toY(targetRetention * 100);
  return (
    <svg viewBox={`0 0 ${width} ${height + 18}`} className="h-40 w-full overflow-visible" role="img" aria-label="Forgetting curve for an average card over 30 days">
      <defs>
        <linearGradient id="insight-curve-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[100, 75, 50].map(level => (
        <g key={level}>
          <line x1="0" x2={width} y1={toY(level)} y2={toY(level)} stroke="var(--line)" strokeWidth="1" />
          <text x="4" y={toY(level) - 4} fill="var(--ink-subtle)" fontSize="10">
            {level}%
          </text>
        </g>
      ))}
      <line x1="0" x2={width} y1={targetY} y2={targetY} stroke="var(--success)" strokeWidth="1.5" strokeDasharray="5 5" />
      <text x={width - 4} y={targetY - 5} fill="var(--success)" fontSize="10" textAnchor="end">
        Target {Math.round(targetRetention * 100)}%
      </text>
      {points.length > 1 && (
        <>
          <path d={`M ${toX(0)},${height} L ${line} L ${toX(30)},${height} Z`} fill="url(#insight-curve-fill)" />
          <path d={`M ${line}`} fill="none" stroke="var(--brand)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {[0, 7, 14, 21, 30].map(day => (
        <text key={day} x={toX(day)} y={height + 14} fill="var(--ink-subtle)" fontSize="10" textAnchor="middle">
          {day === 0 ? 'Today' : `Day ${day}`}
        </text>
      ))}
    </svg>
  );
};
