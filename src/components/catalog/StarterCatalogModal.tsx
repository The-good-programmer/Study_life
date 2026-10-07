import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeft,
  Atom,
  Brain,
  Check,
  Clock,
  Dna,
  FileText,
  GraduationCap,
  Image as ImageIcon,
  Languages,
  Layers,
  Play,
  Plus,
  Search,
  Stethoscope,
  X,
} from 'lucide-react';
import type { StarterDeckMetadata, StudySession } from '../../types';
import { CURATED_STARTER_DECKS, isBoardExamDeck, rankStarterDecksForGrade } from '../../data/curatedStarterCatalog';
import { StorageService } from '../../services/storageService';
import { AuthService } from '../../services/authService';
import { soundEngine } from '../../services/soundEngine';
import { lifeSimService } from '../../services/lifeSimService';
import { estimateReward } from '../../services/economy/rewardService';
import { maskCloze } from '../../utils/cloze';
import { cn } from '../../utils/cn';
import { CARD_TYPE_LABELS, getEffectiveCardType } from '../cockpit/retrievalLogic';
import { Dialog, DialogFooter, DialogHeader, DialogPanel } from '../common/Dialog';
import { Badge, Button, IconButton, Tokens } from '../ui/primitives';

type Category = StarterDeckMetadata['category'];
type Level = StarterDeckMetadata['difficulty'];
type Tone = 'brand' | 'gold' | 'success' | 'danger' | 'due';

const CATEGORIES: { value: Category; label: string; icon: LucideIcon; tone: Tone }[] = [
  { value: 'Medical & Clinical', label: 'Medicine', icon: Stethoscope, tone: 'danger' },
  { value: 'STEM & Engineering', label: 'STEM', icon: Atom, tone: 'brand' },
  { value: 'Biochemistry & Life Sciences', label: 'Life sciences', icon: Dna, tone: 'success' },
  { value: 'Languages & Polyglot', label: 'Languages', icon: Languages, tone: 'gold' },
  { value: 'Cognitive & Behavioral Science', label: 'Mind & behavior', icon: Brain, tone: 'due' },
];

const categoryOf = (deck: StarterDeckMetadata) => CATEGORIES.find(c => c.value === deck.category) ?? CATEGORIES[1];

const TONE_TILES: Record<Tone, string> = {
  brand: 'bg-brand-soft text-brand-text',
  gold: 'bg-gold-soft text-gold',
  success: 'bg-success-soft text-success',
  danger: 'bg-danger-soft text-danger',
  due: 'bg-due-soft text-due',
};

const LEVEL_LABELS: Record<Level, string> = {
  Foundational: 'Beginner',
  Intermediate: 'Intermediate',
  'High-Yield Board Review': 'Advanced',
};

const LEVEL_OPTIONS: { value: Level | 'all'; label: string }[] = [
  { value: 'all', label: 'Any level' },
  { value: 'Foundational', label: 'Beginner' },
  { value: 'Intermediate', label: 'Intermediate' },
  { value: 'High-Yield Board Review', label: 'Advanced' },
];

const SAMPLE_CARD_COUNT = 3;

function createClonedSession(deck: StarterDeckMetadata): StudySession {
  return {
    ...deck.session,
    id: `${deck.id}-${Date.now()}`,
    createdAt: new Date().toISOString(),
    elapsedSeconds: 0,
    currentConceptIndex: 0,
    currentPhase: 'priming',
  };
}

/** The saved copy of a starter deck, if the learner already added it. */
const findSavedCopy = (deck: StarterDeckMetadata): StudySession | undefined =>
  StorageService.getSessions().find(
    s => s.id === deck.id || s.id.startsWith(`${deck.id}-`) || s.title === deck.session.title,
  );

const matchesQuery = (deck: StarterDeckMetadata, query: string): boolean => {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    deck.title.toLowerCase().includes(q) ||
    deck.summary.toLowerCase().includes(q) ||
    deck.tags.some(t => t.toLowerCase().includes(q)) ||
    deck.session.concepts.some(c => c.title.toLowerCase().includes(q))
  );
};

interface StarterCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartSession: (session: StudySession) => void;
  onDeckImported?: () => void;
  onOpenDeckStation?: (session: StudySession) => void;
}

export const StarterCatalogModal: React.FC<StarterCatalogModalProps> = ({
  isOpen,
  onClose,
  onStartSession,
  onDeckImported,
  onOpenDeckStation,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | 'all'>('all');
  const [selectedLevel, setSelectedLevel] = useState<Level | 'all'>('all');
  const [previewDeck, setPreviewDeck] = useState<StarterDeckMetadata | null>(null);
  const [addedDeckIds, setAddedDeckIds] = useState<Set<string>>(
    () => new Set(CURATED_STARTER_DECKS.filter(deck => findSavedCopy(deck)).map(deck => deck.id)),
  );
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const justAddedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (justAddedTimer.current) clearTimeout(justAddedTimer.current);
  }, []);

  // Coming back from a preview, return focus to the card it was opened from.
  const lastPreviewedId = useRef<string | null>(null);
  useEffect(() => {
    if (previewDeck) {
      lastPreviewedId.current = previewDeck.id;
      return;
    }
    if (!lastPreviewedId.current) return;
    document.querySelector<HTMLElement>(`[data-preview-trigger="${lastPreviewedId.current}"]`)?.focus();
    lastPreviewedId.current = null;
  }, [previewDeck]);

  // Focusing the search box would pop up the keyboard on phones, so only do it with a mouse.
  const [autofocusSearch] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches);

  const rankedDecks = useMemo(
    () => rankStarterDecksForGrade(CURATED_STARTER_DECKS, AuthService.getCurrentUser()?.grade),
    [],
  );

  // What one full session of each deck pays today, after daily caps and the housing bonus.
  const payByDeck = useMemo(() => {
    const multiplier = lifeSimService.getActiveMultiplier();
    return new Map(
      CURATED_STARTER_DECKS.map(deck => [
        deck.id,
        Math.round(
          estimateReward({ kind: 'sprint', cards: deck.cardCount, minutes: deck.estimatedMinutes }).tokens * multiplier,
        ),
      ]),
    );
  }, []);

  const query = searchQuery.trim();
  const filteredDecks = rankedDecks.filter(
    deck =>
      matchesQuery(deck, query) &&
      (selectedCategory === 'all' || deck.category === selectedCategory) &&
      (selectedLevel === 'all' || deck.difficulty === selectedLevel),
  );
  const visibleCategories = CATEGORIES.filter(c => rankedDecks.some(deck => deck.category === c.value));
  const hasFilters = query !== '' || selectedCategory !== 'all' || selectedLevel !== 'all';

  if (!isOpen) return null;

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedLevel('all');
  };

  const handleAddDeck = (deck: StarterDeckMetadata): StudySession => {
    const clonedSession = createClonedSession(deck);
    StorageService.saveSession(clonedSession);
    StorageService.saveCards(clonedSession.concepts.flatMap(c => c.retrievalCards));

    soundEngine.playSuccess();
    setAddedDeckIds(prev => new Set(prev).add(deck.id));
    setJustAddedId(deck.id);
    if (justAddedTimer.current) clearTimeout(justAddedTimer.current);
    justAddedTimer.current = setTimeout(() => setJustAddedId(null), 2500);

    onDeckImported?.();
    return clonedSession;
  };

  const handleStudy = (deck: StarterDeckMetadata) => {
    // Studying adds the deck first, so its progress is saved like any other deck.
    const sessionToLaunch = findSavedCopy(deck) ?? handleAddDeck(deck);

    soundEngine.playStart();
    onClose();
    if (onOpenDeckStation) {
      onOpenDeckStation(sessionToLaunch);
    } else {
      onStartSession(sessionToLaunch);
    }
  };

  // Escape or a backdrop click steps back from a preview before closing the catalog.
  const handleDismiss = () => {
    if (previewDeck) setPreviewDeck(null);
    else onClose();
  };

  return (
    <Dialog isOpen={isOpen} onClose={handleDismiss} titleId="starter-catalog-title" className="max-w-5xl">
      <DialogPanel className="h-[min(860px,92dvh)]">
        {previewDeck ? (
          <DeckPreview
            deck={previewDeck}
            pay={payByDeck.get(previewDeck.id) ?? 0}
            isAdded={addedDeckIds.has(previewDeck.id)}
            isJustAdded={justAddedId === previewDeck.id}
            onBack={() => setPreviewDeck(null)}
            onClose={onClose}
            onAdd={() => handleAddDeck(previewDeck)}
            onStudy={() => handleStudy(previewDeck)}
          />
        ) : (
          <>
            <DialogHeader
              titleId="starter-catalog-title"
              title="Starter decks"
              description="Ready-made decks you can study right away. Add one to your library, or start it now."
              onClose={onClose}
              closeLabel="Close starter decks"
            >
              <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
                <label className="relative min-w-0 flex-1">
                  <span className="sr-only">Search starter decks</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
                  <input
                    type="search"
                    data-autofocus={autofocusSearch || undefined}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by subject, exam or topic"
                    className="h-10 w-full rounded-xl border border-line-strong bg-canvas pl-9 pr-9 text-sm text-ink placeholder:text-ink-subtle transition-colors focus:border-brand focus:outline-none [&::-webkit-search-cancel-button]:hidden"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      aria-label="Clear search"
                      className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </label>
                <label className="shrink-0">
                  <span className="sr-only">Level</span>
                  <select
                    value={selectedLevel}
                    onChange={(e) => setSelectedLevel(e.target.value as Level | 'all')}
                    className="h-10 w-full rounded-xl border border-line-strong bg-canvas px-3 text-sm text-ink transition-colors focus:border-brand focus:outline-none sm:w-40 cursor-pointer"
                  >
                    {LEVEL_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-0.5 no-scrollbar" role="group" aria-label="Subject">
                <CategoryChip
                  label="All"
                  count={rankedDecks.length}
                  active={selectedCategory === 'all'}
                  onClick={() => setSelectedCategory('all')}
                />
                {visibleCategories.map(category => (
                  <CategoryChip
                    key={category.value}
                    label={category.label}
                    count={rankedDecks.filter(deck => deck.category === category.value).length}
                    active={selectedCategory === category.value}
                    onClick={() => setSelectedCategory(category.value)}
                  />
                ))}
              </div>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
              <p className="sr-only" aria-live="polite">
                {filteredDecks.length} {filteredDecks.length === 1 ? 'deck' : 'decks'} shown
              </p>
              {filteredDecks.length === 0 ? (
                <div className="flex flex-col items-center px-4 py-16 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-hover text-ink-subtle">
                    <Layers className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <p className="mt-4 text-[15px] font-semibold text-ink">No decks match</p>
                  <p className="mt-1 text-[13px] text-ink-subtle">Try another word, or clear the filters.</p>
                  {hasFilters && (
                    <Button size="sm" className="mt-4" onClick={resetFilters}>
                      Clear filters
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {filteredDecks.map(deck => (
                    <DeckCard
                      key={deck.id}
                      deck={deck}
                      pay={payByDeck.get(deck.id) ?? 0}
                      isAdded={addedDeckIds.has(deck.id)}
                      isJustAdded={justAddedId === deck.id}
                      onPreview={() => setPreviewDeck(deck)}
                      onAdd={() => handleAddDeck(deck)}
                      onStudy={() => handleStudy(deck)}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </DialogPanel>
    </Dialog>
  );
};

const CategoryChip: React.FC<{ label: string; count: number; active: boolean; onClick: () => void }> = ({
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
      'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-colors cursor-pointer',
      active ? 'bg-ink text-canvas' : 'text-ink-muted hover:bg-surface-hover hover:text-ink',
    )}
  >
    {label}
    <span className={cn('text-xs tabular-nums', active ? 'opacity-60' : 'text-ink-subtle')}>{count}</span>
  </button>
);

const DeckFeatures: React.FC<{ deck: StarterDeckMetadata }> = ({ deck }) => {
  const isBoardExam = isBoardExamDeck(deck);
  if (!isBoardExam && !deck.hasImageOcclusion && !deck.hasSourcePdf) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {isBoardExam && (
        <Badge tone="due">
          <GraduationCap className="h-3 w-3" aria-hidden="true" />
          Board exam
        </Badge>
      )}
      {deck.hasImageOcclusion && (
        <Badge>
          <ImageIcon className="h-3 w-3" aria-hidden="true" />
          Diagrams
        </Badge>
      )}
      {deck.hasSourcePdf && (
        <Badge>
          <FileText className="h-3 w-3" aria-hidden="true" />
          Source PDF
        </Badge>
      )}
    </div>
  );
};

const AddButton: React.FC<{ isAdded: boolean; isJustAdded: boolean; onAdd: () => void; size?: 'sm' | 'md' }> = ({
  isAdded,
  isJustAdded,
  onAdd,
  size = 'sm',
}) =>
  isAdded ? (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium text-success',
        size === 'sm' ? 'h-8 px-2 text-xs' : 'h-10 px-2 text-sm',
      )}
      role="status"
    >
      <Check className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden="true" />
      {isJustAdded ? 'Added to library' : 'In your library'}
    </span>
  ) : (
    <Button size={size} icon={Plus} onClick={onAdd}>
      Add to library
    </Button>
  );

interface DeckCardProps {
  deck: StarterDeckMetadata;
  pay: number;
  isAdded: boolean;
  isJustAdded: boolean;
  onPreview: () => void;
  onAdd: () => void;
  onStudy: () => void;
}

const DeckCard: React.FC<DeckCardProps> = ({ deck, pay, isAdded, isJustAdded, onPreview, onAdd, onStudy }) => {
  const category = categoryOf(deck);
  const Icon = category.icon;
  return (
    <article className="flex flex-col rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-line-strong sm:p-5">
      <div className="flex items-start gap-3">
        <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', TONE_TILES[category.tone])}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-ink-subtle">
            {category.label} · {LEVEL_LABELS[deck.difficulty]}
          </p>
          <h3 className="mt-0.5 text-[15px] font-semibold leading-snug text-ink">
            <button
              type="button"
              onClick={onPreview}
              className="text-left transition-colors hover:text-brand-text focus-visible:outline-none focus-visible:underline cursor-pointer"
            >
              {deck.title}
            </button>
          </h3>
        </div>
      </div>

      <p className="mt-3 line-clamp-2 text-[13px] leading-relaxed text-ink-muted">{deck.summary}</p>

      <div className="mt-3">
        <DeckFeatures deck={deck} />
      </div>

      <div className="mt-auto pt-4">
        <div className="flex items-center gap-x-3 border-t border-line pt-3 text-xs text-ink-subtle tabular-nums">
          <span>{deck.conceptCount} concepts</span>
          <span>{deck.cardCount} cards</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />~{deck.estimatedMinutes} min
          </span>
          {pay > 0 && (
            <span className="ml-auto text-ink-muted" title="About what one full session pays today">
              <Tokens amount={pay} />
            </span>
          )}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={onPreview} aria-label={`Preview ${deck.title}`} data-preview-trigger={deck.id}>
            Preview
          </Button>
          <AddButton isAdded={isAdded} isJustAdded={isJustAdded} onAdd={onAdd} />
          <Button size="sm" variant="primary" icon={Play} className="ml-auto" onClick={onStudy}>
            Study
          </Button>
        </div>
      </div>
    </article>
  );
};

interface DeckPreviewProps {
  deck: StarterDeckMetadata;
  pay: number;
  isAdded: boolean;
  isJustAdded: boolean;
  onBack: () => void;
  onClose: () => void;
  onAdd: () => void;
  onStudy: () => void;
}

const DeckPreview: React.FC<DeckPreviewProps> = ({ deck, pay, isAdded, isJustAdded, onBack, onClose, onAdd, onStudy }) => {
  const category = categoryOf(deck);
  const Icon = category.icon;
  const sampleCards = deck.session.concepts.flatMap(c => c.retrievalCards).slice(0, SAMPLE_CARD_COUNT);

  // The list view unmounts when the preview opens, so move focus into the preview.
  const topBarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    topBarRef.current?.querySelector<HTMLElement>('button')?.focus();
  }, []);

  return (
    <>
      <div ref={topBarRef} className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-3 py-2 sm:px-4">
        <Button size="sm" variant="ghost" icon={ArrowLeft} onClick={onBack}>
          All starter decks
        </Button>
        <IconButton icon={X} label="Close starter decks" onClick={onClose} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-3xl px-5 py-6 sm:px-8 sm:py-8">
          <div className="flex items-start gap-4">
            <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl', TONE_TILES[category.tone])}>
              <Icon className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-ink-subtle">
                {category.label} · {LEVEL_LABELS[deck.difficulty]}
              </p>
              <h2 id="starter-catalog-title" className="mt-1 text-xl font-semibold leading-snug text-ink sm:text-2xl">
                {deck.title}
              </h2>
            </div>
          </div>

          <p className="mt-4 text-[15px] leading-relaxed text-ink-muted">{deck.summary}</p>
          <p className="mt-2 text-[13px] text-ink-subtle">
            <span className="font-medium text-ink-muted">Good for:</span> {deck.targetAudience}
          </p>

          <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <PreviewStat label="Concepts" value={deck.conceptCount} />
            <PreviewStat label="Cards" value={deck.cardCount} />
            <PreviewStat label="Session" value={`~${deck.estimatedMinutes} min`} />
            <PreviewStat label="Pays about" value={<Tokens amount={pay} iconClassName="h-4 w-4" />} />
          </dl>

          <div className="mt-4">
            <DeckFeatures deck={deck} />
          </div>

          <section className="mt-8">
            <h3 className="text-[15px] font-semibold text-ink">What you will learn</h3>
            <ol className="mt-3 space-y-2.5">
              {deck.session.concepts.map((concept, index) => (
                <li key={concept.id} className="rounded-2xl border border-line bg-surface p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-hover text-xs font-semibold tabular-nums text-ink-muted">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                        <h4 className="text-sm font-semibold text-ink">{concept.title}</h4>
                        <span className="text-xs tabular-nums text-ink-subtle">
                          {concept.retrievalCards.length} {concept.retrievalCards.length === 1 ? 'card' : 'cards'} · ~{concept.estimatedMinutes} min
                        </span>
                      </div>
                      {concept.mentalModel && (
                        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{concept.mentalModel}</p>
                      )}
                      {concept.coreTakeaways.length > 0 && (
                        <ul className="mt-2.5 space-y-1">
                          {concept.coreTakeaways.map((takeaway, takeawayIndex) => (
                            <li key={takeawayIndex} className="flex gap-2 text-[13px] leading-relaxed text-ink-subtle">
                              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-ink-subtle" aria-hidden="true" />
                              <span>{takeaway}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {concept.sourceAnchor && (
                        <p className="mt-2.5 inline-flex items-center gap-1.5 text-xs text-ink-subtle">
                          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                          From {concept.sourceAnchor.sourceName}, page {concept.sourceAnchor.pageNumber}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {sampleCards.length > 0 && (
            <section className="mt-8">
              <h3 className="text-[15px] font-semibold text-ink">Sample cards</h3>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {sampleCards.map(card => (
                  <div key={card.id} className="flex flex-col rounded-2xl border border-line bg-canvas-raised p-4">
                    <span className="text-xs font-medium text-ink-subtle">{CARD_TYPE_LABELS[getEffectiveCardType(card)]}</span>
                    <p className="mt-1.5 text-sm font-medium leading-relaxed text-ink">{maskCloze(card.question)}</p>
                    <p className="mt-3 border-t border-line pt-2.5 text-[13px] leading-relaxed text-ink-muted">
                      <span className="text-ink-subtle">Answer: </span>
                      {card.answer}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      <DialogFooter className="justify-end">
        <AddButton isAdded={isAdded} isJustAdded={isJustAdded} onAdd={onAdd} size="md" />
        <Button variant="primary" icon={Play} onClick={onStudy}>
          Study this deck
        </Button>
      </DialogFooter>
    </>
  );
};

const PreviewStat: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="rounded-xl border border-line bg-surface px-3 py-2.5">
    <dt className="text-xs text-ink-subtle">{label}</dt>
    <dd className="mt-0.5 text-[15px] font-semibold tabular-nums text-ink">{value}</dd>
  </div>
);
