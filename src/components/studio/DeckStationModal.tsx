import React, { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  ChevronDown,
  Clock,
  Edit3,
  FileJson,
  FileText,
  FolderInput,
  Headphones,
  Layers,
  Play,
  Printer,
  Search,
  Share2,
  Star,
  X,
  Zap,
} from 'lucide-react';
import type { CardType, RetrievalCard, StudySession, SubjectFolder } from '../../types';
import { StorageService } from '../../services/storageService';
import { ExportService } from '../../services/exportService';
import { soundEngine } from '../../services/soundEngine';
import { lifeSimService } from '../../services/lifeSimService';
import { estimateReward } from '../../services/economy/rewardService';
import { cardStatusOf, deckCardIds, isCardDue, type CardStatus } from '../../utils/cardProgress';
import { maskCloze } from '../../utils/cloze';
import { cn } from '../../utils/cn';
import { CARD_TYPE_LABELS, getEffectiveCardType } from '../cockpit/retrievalLogic';
import { describeNextReview } from '../cockpit/sessionSchedule';
import { Dialog, DialogPanel } from '../common/Dialog';
import { ActionMenu } from '../ui/ActionMenu';
import { Badge, Button, IconButton, Tokens } from '../ui/primitives';
import { MoveToFolderModal } from './MoveToFolderModal';
import { SubjectFolderModal } from './SubjectFolderModal';
import { FOLDER_COLORS } from './folderOptions';

interface DeckStationModalProps {
  isOpen: boolean;
  session: StudySession | null;
  onClose: () => void;
  onStartPilot: (session: StudySession) => void;
  onStartMatch: (session: StudySession) => void;
  onStartFlashcardsOnly: (session: StudySession) => void;
  onStartAudioBriefing: (session: StudySession) => void;
  onEditInStudio: (session: StudySession) => void;
}

const STATUS_STYLES: Record<CardStatus, { label: string; dot: string }> = {
  mastered: { label: 'Mastered', dot: 'bg-success' },
  learning: { label: 'Learning', dot: 'bg-brand' },
  new: { label: 'New', dot: 'bg-ink-subtle' },
};

const GUIDED_STEPS = ['Warm-up', 'Overview', 'Explain', 'Recall', 'Rest'];

/** FSRS stability, in words: roughly how long the card stays remembered. */
const formatMemory = (days: number): string => {
  if (days < 1) return 'less than a day';
  const rounded = Math.round(days);
  if (rounded < 60) return `about ${rounded} ${rounded === 1 ? 'day' : 'days'}`;
  return `about ${Math.round(days / 30)} months`;
};

type CardFilter = 'all' | 'starred' | CardType;

/** The deck's cards with their saved progress. */
const cardsOf = (session: StudySession): RetrievalCard[] =>
  StorageService.deckWithLatestProgress(session).concepts.flatMap(concept => concept.retrievalCards);

const totalMinutesOf = (session: StudySession): number =>
  session.concepts.reduce((sum, concept) => sum + (concept.estimatedMinutes || 5), 0);

function createStarredSession(session: StudySession, starredOnlyCards: RetrievalCard[]): StudySession {
  return {
    ...session,
    id: `${session.id}-starred-${Date.now()}`,
    title: `${session.title} (Starred Cards)`,
    concepts: [
      {
        id: 'starred-concept',
        order: 1,
        title: 'Starred cards',
        estimatedMinutes: Math.max(5, starredOnlyCards.length * 2),
        mentalModel: 'A focused pass over the cards you bookmarked.',
        coreTakeaways: ['Practise the cards you found hardest.'],
        keyTerms: [],
        feynmanPrompt: 'Explain the idea behind the cards you starred, in your own words.',
        sampleMasteryExplanation: 'Going back to the hardest cards closes the gaps fastest.',
        retrievalCards: starredOnlyCards,
      },
    ],
  };
}

export const DeckStationModal: React.FC<DeckStationModalProps> = ({
  isOpen,
  session,
  onClose,
  onStartPilot,
  onStartMatch,
  onStartFlashcardsOnly,
  onStartAudioBriefing,
  onEditInStudio,
}) => {
  // App remounts this modal per deck (key = deck id), so state is initialised from `session` once.
  const [activeTab, setActiveTab] = useState<'study' | 'cards'>('study');
  const [cardSearch, setCardSearch] = useState('');
  const [cardFilter, setCardFilter] = useState<CardFilter>('all');
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(session?.folderId);
  const [folders, setFolders] = useState<SubjectFolder[]>(() => StorageService.getFolders());
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [cards, setCards] = useState<RetrievalCard[]>(() => (session ? cardsOf(session) : []));
  const [now] = useState(() => new Date());
  // What a full guided session pays today, after daily caps and the housing bonus.
  const [guidedPay] = useState(() => {
    if (!session) return 0;
    const { tokens } = estimateReward({ kind: 'sprint', cardIds: deckCardIds(session), minutes: totalMinutesOf(session) });
    return Math.round(tokens * lifeSimService.getActiveMultiplier());
  });

  if (!isOpen || !session) return null;

  const totalMinutes = totalMinutesOf(session);
  const counts = { mastered: 0, learning: 0, new: 0 };
  cards.forEach(card => {
    counts[cardStatusOf(card)] += 1;
  });
  const dueCount = cards.filter(card => isCardDue(card, now)).length;
  const masteredPercent = cards.length ? Math.round((counts.mastered / cards.length) * 100) : 0;
  const starredCards = cards.filter(card => card.isStarred);

  const folder = folders.find(f => f.id === currentFolderId);
  const folderColor = folder ? FOLDER_COLORS.find(c => c.id === folder.color) || FOLDER_COLORS[0] : null;

  const typeCounts = new Map<CardType, number>();
  cards.forEach(card => {
    const type = getEffectiveCardType(card);
    typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
  });

  const cardNumbers = new Map(cards.map((card, index) => [card.id, index + 1]));
  const query = cardSearch.trim().toLowerCase();
  const filteredCards = cards.filter(card => {
    if (cardFilter === 'starred' && !card.isStarred) return false;
    if (cardFilter !== 'all' && cardFilter !== 'starred' && getEffectiveCardType(card) !== cardFilter) return false;
    if (!query) return true;
    return card.question.toLowerCase().includes(query) || card.answer.toLowerCase().includes(query);
  });

  const launch = (start: (s: StudySession) => void, target: StudySession = session) => {
    onClose();
    start(target);
  };

  const handleToggleStar = (cardId: string) => {
    const isStarred = StorageService.toggleCardStar(cardId);
    setCards(prev => prev.map(card => (card.id === cardId ? { ...card, isStarred } : card)));
    soundEngine.playSuccess();
  };

  const handleLaunchStarredOnly = () => {
    if (starredCards.length === 0) return;
    launch(onStartPilot, createStarredSession(session, starredCards));
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} titleId="deck-details-title" className="max-w-3xl">
      <DialogPanel className="h-[min(820px,92dvh)]">
        {/* Header */}
        <div className="shrink-0 border-b border-line px-5 pt-5 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge>{session.category || 'General'}</Badge>
                <button
                  type="button"
                  onClick={() => setIsMoveModalOpen(true)}
                  className="inline-flex max-w-[180px] items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink cursor-pointer"
                  title={folder ? `Subject: ${folder.name}. Click to move.` : 'Add to a subject'}
                >
                  {folderColor ? (
                    <span className={cn('h-2 w-2 shrink-0 rounded-full', folderColor.dot)} aria-hidden="true" />
                  ) : (
                    <FolderInput className="h-3 w-3" aria-hidden="true" />
                  )}
                  <span className="truncate">{folder ? folder.name : 'Add to subject'}</span>
                </button>
                {session.sourceDocument && (
                  <Badge>
                    <FileText className="h-3 w-3" aria-hidden="true" />
                    Source PDF
                  </Badge>
                )}
              </div>
              <h2 id="deck-details-title" className="mt-2 text-xl font-semibold leading-snug text-ink">
                {session.title}
              </h2>
              {session.description && (
                <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-ink-subtle">{session.description}</p>
              )}
            </div>
            <div className="-mr-2 -mt-1.5 flex shrink-0 items-center">
              <ActionMenu
                label="More actions for this deck"
                items={[
                  { label: 'Edit cards', icon: Edit3, onSelect: () => launch(onEditInStudio) },
                  { label: 'Move to subject', icon: FolderInput, onSelect: () => setIsMoveModalOpen(true) },
                  { label: 'Print study sheet', icon: Printer, onSelect: () => ExportService.printStudySheet(session) },
                  { label: 'Export as Markdown', icon: FileText, onSelect: () => ExportService.downloadMarkdown(session) },
                  { label: 'Export for Anki', icon: Share2, onSelect: () => ExportService.downloadAnkiTSV(session) },
                  { label: 'Export as JSON', icon: FileJson, onSelect: () => ExportService.downloadJSON(session) },
                ]}
              />
              <IconButton icon={X} label="Close" onClick={onClose} />
            </div>
          </div>

          {/* Progress */}
          <div className="mt-5">
            <div className="flex items-center justify-between gap-3 text-xs text-ink-subtle">
              <span className="tabular-nums">
                {session.concepts.length} {session.concepts.length === 1 ? 'concept' : 'concepts'} · {cards.length}{' '}
                {cards.length === 1 ? 'card' : 'cards'} · ~{totalMinutes} min
              </span>
              <span className="tabular-nums">{masteredPercent}% mastered</span>
            </div>
            <div
              className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-surface-hover"
              role="img"
              aria-label={`${counts.mastered} mastered, ${counts.learning} learning, ${counts.new} new`}
            >
              <div className="bg-success transition-[width] duration-500" style={{ width: `${(counts.mastered / Math.max(1, cards.length)) * 100}%` }} />
              <div className="bg-brand transition-[width] duration-500" style={{ width: `${(counts.learning / Math.max(1, cards.length)) * 100}%` }} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
              {(Object.keys(STATUS_STYLES) as CardStatus[]).map(status => (
                <span key={status} className="inline-flex items-center gap-1.5 tabular-nums">
                  <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_STYLES[status].dot)} aria-hidden="true" />
                  {counts[status]} {STATUS_STYLES[status].label.toLowerCase()}
                </span>
              ))}
              {dueCount > 0 && (
                <span className="inline-flex items-center gap-1.5 font-medium text-due tabular-nums">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  {dueCount} due now
                </span>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div role="tablist" aria-label="Deck" className="-mb-px mt-4 flex gap-5">
            {([
              { tab: 'study', label: 'Study' },
              { tab: 'cards', label: 'Cards', count: cards.length },
            ] as const).map(item => (
              <button
                key={item.tab}
                type="button"
                role="tab"
                id={`deck-tab-${item.tab}`}
                aria-selected={activeTab === item.tab}
                aria-controls={`deck-panel-${item.tab}`}
                onClick={() => setActiveTab(item.tab)}
                className={cn(
                  'inline-flex items-center gap-1.5 border-b-2 pb-2.5 text-[13px] font-medium transition-colors cursor-pointer',
                  activeTab === item.tab ? 'border-ink text-ink' : 'border-transparent text-ink-subtle hover:text-ink',
                )}
              >
                {item.label}
                {'count' in item && <span className="tabular-nums text-ink-subtle">{item.count}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Study */}
        {activeTab === 'study' && (
          <div
            id="deck-panel-study"
            role="tabpanel"
            aria-labelledby="deck-tab-study"
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6"
          >
            <section className="relative overflow-hidden rounded-2xl border border-line-strong bg-surface p-5 sm:p-6">
              <div
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(520px_220px_at_100%_0%,var(--brand-soft),transparent_70%)]"
                aria-hidden="true"
              />
              <div className="relative">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[17px] font-semibold text-ink">Guided session</h3>
                      <Badge tone="brand">Recommended</Badge>
                    </div>
                    <p className="mt-1 max-w-md text-[13px] leading-relaxed text-ink-muted">
                      Learn each concept step by step, then lock it in with flashcards. The best way to study a new deck.
                    </p>
                  </div>
                  {guidedPay > 0 && (
                    <div className="sm:text-right">
                      <p className="text-xs text-ink-subtle">Pays about</p>
                      <Tokens amount={guidedPay} className="text-[15px] font-semibold text-ink" iconClassName="h-4 w-4" />
                    </div>
                  )}
                </div>

                <ol className="mt-4 flex flex-wrap items-center gap-x-1 gap-y-2" aria-label="Steps for each concept">
                  {GUIDED_STEPS.map((step, index) => (
                    <li key={step} className="flex items-center gap-1">
                      <span className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-surface-hover px-2.5 text-xs font-medium text-ink-muted">
                        <span className="tabular-nums text-ink-subtle">{index + 1}</span>
                        {step}
                      </span>
                      {index < GUIDED_STEPS.length - 1 && (
                        <ArrowRight className="h-3 w-3 text-ink-subtle" aria-hidden="true" />
                      )}
                    </li>
                  ))}
                </ol>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <Button variant="primary" size="lg" icon={Play} onClick={() => launch(onStartPilot)} data-autofocus>
                    Start guided session
                  </Button>
                  <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-subtle">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    About {totalMinutes} min
                  </span>
                </div>
              </div>
            </section>

            <h3 className="mt-6 text-[13px] font-medium text-ink-subtle">Other ways to study</h3>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <StudyOption
                icon={Layers}
                title="Quick review"
                text="Just the flashcards. Rate how well you remembered each one."
                onClick={() => launch(onStartFlashcardsOnly)}
                disabled={cards.length === 0}
              />
              <StudyOption
                icon={Zap}
                title="Speed match"
                text="Match each term to its answer against the clock."
                onClick={() => launch(onStartMatch)}
                disabled={cards.length < 2}
              />
              <StudyOption
                icon={Headphones}
                title="Audio briefing"
                text="Listen to a spoken overview of the deck."
                onClick={() => launch(onStartAudioBriefing)}
              />
            </div>

            {starredCards.length > 0 && (
              <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold-soft text-gold">
                    <Star className="h-4 w-4 fill-current" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-ink">Practise your starred cards</p>
                    <p className="text-xs text-ink-subtle">
                      {starredCards.length} {starredCards.length === 1 ? 'card' : 'cards'} you bookmarked as tricky
                    </p>
                  </div>
                </div>
                <Button size="sm" trailingIcon={ArrowRight} onClick={handleLaunchStarredOnly}>
                  Practise {starredCards.length}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Cards */}
        {activeTab === 'cards' && (
          <div
            id="deck-panel-cards"
            role="tabpanel"
            aria-labelledby="deck-tab-cards"
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          >
            <div className="sticky top-0 z-10 space-y-2.5 border-b border-line bg-surface-solid px-5 py-3 sm:px-6">
              <label className="relative block">
                <span className="sr-only">Search cards</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
                <input
                  type="search"
                  value={cardSearch}
                  onChange={(e) => setCardSearch(e.target.value)}
                  placeholder="Search questions and answers"
                  className="h-9 w-full rounded-xl border border-line-strong bg-canvas pl-9 pr-3 text-sm text-ink placeholder:text-ink-subtle transition-colors focus:border-brand focus:outline-none"
                />
              </label>
              <div className="-mx-1 flex gap-1 overflow-x-auto px-1 no-scrollbar" role="group" aria-label="Show">
                <FilterChip label="All" count={cards.length} active={cardFilter === 'all'} onClick={() => setCardFilter('all')} />
                {starredCards.length > 0 && (
                  <FilterChip
                    label="Starred"
                    count={starredCards.length}
                    active={cardFilter === 'starred'}
                    onClick={() => setCardFilter('starred')}
                  />
                )}
                {typeCounts.size > 1 &&
                  [...typeCounts.entries()].map(([type, count]) => (
                    <FilterChip
                      key={type}
                      label={CARD_TYPE_LABELS[type]}
                      count={count}
                      active={cardFilter === type}
                      onClick={() => setCardFilter(type)}
                    />
                  ))}
              </div>
            </div>

            {cards.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <p className="text-[15px] font-semibold text-ink">No cards yet</p>
                <p className="mt-1 text-[13px] text-ink-subtle">Add some in the editor, or generate them from your notes.</p>
                <Button size="sm" icon={Edit3} className="mt-4" onClick={() => launch(onEditInStudio)}>
                  Edit cards
                </Button>
              </div>
            ) : filteredCards.length === 0 ? (
              <p className="px-6 py-14 text-center text-[13px] text-ink-subtle">No cards match. Try another word or filter.</p>
            ) : (
              <ul className="divide-y divide-line px-2 py-1 sm:px-3">
                {filteredCards.map(card => (
                  <CardRow
                    key={card.id}
                    card={card}
                    number={cardNumbers.get(card.id) ?? 0}
                    now={now}
                    isExpanded={expandedCardId === card.id}
                    onToggleExpand={() => setExpandedCardId(id => (id === card.id ? null : card.id))}
                    onToggleStar={() => handleToggleStar(card.id)}
                  />
                ))}
              </ul>
            )}
          </div>
        )}
      </DialogPanel>

      {isMoveModalOpen && (
        <MoveToFolderModal
          isOpen={isMoveModalOpen}
          session={{ ...session, folderId: currentFolderId }}
          onClose={() => setIsMoveModalOpen(false)}
          onMoved={(updated) => setCurrentFolderId(updated.folderId)}
          onOpenNewFolderModal={() => {
            setIsMoveModalOpen(false);
            setIsFolderModalOpen(true);
          }}
        />
      )}

      {isFolderModalOpen && (
        <SubjectFolderModal
          isOpen={isFolderModalOpen}
          onClose={() => setIsFolderModalOpen(false)}
          onFolderSaved={(newFolder) => {
            setFolders(StorageService.getFolders());
            StorageService.setDeckFolder(session.id, newFolder.id);
            setCurrentFolderId(newFolder.id);
          }}
        />
      )}
    </Dialog>
  );
};

const StudyOption: React.FC<{
  icon: LucideIcon;
  title: string;
  text: string;
  onClick: () => void;
  disabled?: boolean;
}> = ({ icon: Icon, title, text, onClick, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="group flex flex-col items-start rounded-2xl border border-line bg-surface p-4 text-left transition-colors hover:border-line-strong hover:bg-surface-hover disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
  >
    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-hover text-ink-muted transition-colors group-hover:text-ink">
      <Icon className="h-4 w-4" aria-hidden="true" />
    </span>
    <span className="mt-3 text-sm font-medium text-ink">{title}</span>
    <span className="mt-0.5 text-xs leading-relaxed text-ink-subtle">{text}</span>
  </button>
);

const FilterChip: React.FC<{ label: string; count: number; active: boolean; onClick: () => void }> = ({
  label,
  count,
  active,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={cn(
      'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors cursor-pointer',
      active ? 'bg-ink text-canvas' : 'text-ink-muted hover:bg-surface-hover hover:text-ink',
    )}
  >
    {label}
    <span className={cn('tabular-nums', active ? 'opacity-60' : 'text-ink-subtle')}>{count}</span>
  </button>
);

const CardRow: React.FC<{
  card: RetrievalCard;
  number: number;
  now: Date;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onToggleStar: () => void;
}> = ({ card, number, now, isExpanded, onToggleExpand, onToggleStar }) => {
  const status = cardStatusOf(card);
  const nextReview = describeNextReview(card, now);
  const detailsId = `card-details-${card.id}`;

  return (
    <li className="py-1">
      <div className="flex items-start gap-1">
        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={isExpanded}
          aria-controls={detailsId}
          className="flex min-w-0 flex-1 items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-hover cursor-pointer"
        >
          <span className="w-5 shrink-0 pt-px text-xs tabular-nums text-ink-subtle">{number}</span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 text-xs text-ink-subtle">
              <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_STYLES[status].dot)} aria-hidden="true" />
              {CARD_TYPE_LABELS[getEffectiveCardType(card)]}
            </span>
            <span className="mt-1 block text-sm leading-relaxed text-ink">{maskCloze(card.question)}</span>
          </span>
          <ChevronDown
            className={cn('mt-1 h-4 w-4 shrink-0 text-ink-subtle transition-transform', isExpanded && 'rotate-180')}
            aria-hidden="true"
          />
        </button>
        <button
          type="button"
          onClick={onToggleStar}
          aria-pressed={!!card.isStarred}
          aria-label={card.isStarred ? 'Unstar card' : 'Star card'}
          title={card.isStarred ? 'Unstar card' : 'Star this card to practise it separately'}
          className={cn(
            'mt-1.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors cursor-pointer',
            card.isStarred ? 'text-gold hover:bg-gold-soft' : 'text-ink-subtle hover:bg-surface-hover hover:text-ink',
          )}
        >
          <Star className={cn('h-4 w-4', card.isStarred && 'fill-current')} aria-hidden="true" />
        </button>
      </div>

      {isExpanded && (
        <div id={detailsId} className="mb-2 ml-11 mr-10 space-y-3 animate-fadeIn">
          <div className="rounded-xl bg-success-soft px-3.5 py-2.5">
            <p className="text-xs font-medium text-success">Answer</p>
            <p className="mt-0.5 text-sm leading-relaxed text-ink">{card.answer}</p>
          </div>
          {card.explanation && <p className="text-[13px] leading-relaxed text-ink-muted">{card.explanation}</p>}
          <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
            <div className="flex gap-1.5">
              <dt className="text-ink-subtle">Status</dt>
              <dd className="text-ink-muted">{STATUS_STYLES[status].label}</dd>
            </div>
            {card.reps > 0 && (
              <>
                <div className="flex gap-1.5">
                  <dt className="text-ink-subtle">Memory lasts</dt>
                  <dd className="tabular-nums text-ink-muted">{formatMemory(card.stability)}</dd>
                </div>
                <div className="flex gap-1.5">
                  <dt className="text-ink-subtle">Reviews</dt>
                  <dd className="tabular-nums text-ink-muted">
                    {card.reps}
                    {card.lapses > 0 && ` (${card.lapses} forgotten)`}
                  </dd>
                </div>
                {nextReview && (
                  <div className="flex gap-1.5">
                    <dt className="text-ink-subtle">Next review</dt>
                    <dd className={cn(nextReview === 'Due now' ? 'font-medium text-due' : 'text-ink-muted')}>{nextReview}</dd>
                  </div>
                )}
              </>
            )}
          </dl>
        </div>
      )}
    </li>
  );
};
