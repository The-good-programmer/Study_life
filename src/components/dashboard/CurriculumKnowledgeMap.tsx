import React, { useState } from 'react';
import { ArrowLeft, Check, ChevronRight, Layers, Play, Route } from 'lucide-react';
import type { StudySession } from '../../types';
import { StorageService } from '../../services/storageService';
import { cardStatusOf, isCardDue } from '../../utils/cardProgress';
import { maskCloze } from '../../utils/cloze';
import { cn } from '../../utils/cn';
import { describeNextReview } from '../cockpit/sessionSchedule';
import { Dialog, DialogFooter, DialogHeader, DialogPanel } from '../common/Dialog';
import { MathRenderer } from '../common/MathRenderer';
import { Badge, Button } from '../ui/primitives';
import { buildDeckProgress, sessionFromConcept, type ConceptProgress, type ConceptStatus, type DeckProgress } from './knowledgeMap';

interface CurriculumKnowledgeMapProps {
  onBack: () => void;
  onStartSession: (session: StudySession) => void;
  onOpenDeckStation?: (session: StudySession) => void;
  onOpenHardCards?: () => void;
}

type BadgeTone = NonNullable<React.ComponentProps<typeof Badge>['tone']>;

const STATUS: Record<ConceptStatus, { label: string; tone: BadgeTone; dot: string; marker: string }> = {
  mastered: { label: 'Mastered', tone: 'success', dot: 'bg-success', marker: 'bg-success text-success-ink' },
  learning: { label: 'Learning', tone: 'brand', dot: 'bg-brand', marker: 'bg-brand-soft text-brand-text ring-1 ring-brand/40' },
  due: { label: 'Due', tone: 'due', dot: 'bg-due', marker: 'bg-due-soft text-due ring-1 ring-due/40' },
  new: { label: 'Not started', tone: 'neutral', dot: 'bg-line-strong', marker: 'border border-line-strong bg-canvas text-ink-subtle' },
};

const STATUS_ORDER: ConceptStatus[] = ['mastered', 'learning', 'due', 'new'];

/** Cards shown in a concept's dialog; Deck details lists the rest. */
const DIALOG_CARD_LIMIT = 8;

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

const minutesOf = (session: StudySession) => session.concepts.reduce((sum, concept) => sum + (concept.estimatedMinutes || 5), 0);

/** Knowledge map: every deck concept by concept, in teaching order, with where to go next. */
export const CurriculumKnowledgeMap: React.FC<CurriculumKnowledgeMapProps> = ({
  onBack,
  onStartSession,
  onOpenDeckStation,
  onOpenHardCards,
}) => {
  const [now] = useState(() => new Date());
  const [decks] = useState<DeckProgress[]>(() => {
    const saved = new Map(StorageService.getAllCards().map(card => [card.id, card]));
    return StorageService.getSessions()
      .filter(session => session.concepts?.length > 0)
      .map(session => buildDeckProgress(session, saved, now));
  });
  const [selectedId, setSelectedId] = useState(() => decks[0]?.session.id ?? null);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const deck = decks.find(d => d.session.id === selectedId) ?? decks[0];
  const openConcept = deck && openIndex !== null ? deck.concepts[openIndex] : null;
  const conceptTotal = decks.reduce((sum, d) => sum + d.concepts.length, 0);
  const masteredTotal = decks.reduce((sum, d) => sum + d.counts.mastered, 0);

  const study = (index: number) => {
    if (!deck) return;
    setOpenIndex(null);
    onStartSession(sessionFromConcept(deck.session, index));
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 animate-fadeIn">
      <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={onBack} className="-ml-2">
        Insights
      </Button>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[26px] font-semibold tracking-tight text-ink sm:text-[30px]">Knowledge map</h1>
          <p className="mt-1 max-w-2xl text-[15px] text-ink-muted">
            Each deck, concept by concept in the order it teaches them: what you have mastered, what is due, and where to go next.
          </p>
        </div>
        {conceptTotal > 0 && (
          <Badge tone="success">
            {masteredTotal} of {plural(conceptTotal, 'concept')} mastered
          </Badge>
        )}
      </header>

      {!deck ? (
        <section className="rounded-3xl border border-line bg-surface px-6 py-14 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand-text">
            <Route className="h-6 w-6" aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-ink">No decks to map yet</h2>
          <p className="mx-auto mt-1 max-w-md text-[13px] leading-relaxed text-ink-subtle">
            Add a deck from the starter catalog or make your own. Its concepts appear here, and fill in as you study them.
          </p>
          <Button className="mt-5" icon={ArrowLeft} onClick={onBack}>
            Back to Insights
          </Button>
        </section>
      ) : (
        <div className={cn('grid items-start gap-5', decks.length > 1 && 'xl:grid-cols-[300px_minmax(0,1fr)]')}>
          {decks.length > 1 && (
            <nav aria-label="Decks" className="min-w-0 xl:sticky xl:top-20">
              <ul className="flex gap-2 overflow-x-auto pb-1 no-scrollbar xl:flex-col xl:gap-1.5 xl:overflow-visible xl:pb-0">
                {decks.map(item => {
                  const isSelected = item.session.id === deck.session.id;
                  return (
                    <li key={item.session.id} className="w-64 shrink-0 xl:w-auto">
                      <button
                        type="button"
                        onClick={() => setSelectedId(item.session.id)}
                        aria-pressed={isSelected}
                        className={cn(
                          'w-full rounded-2xl border px-4 py-3 text-left transition-colors cursor-pointer',
                          isSelected ? 'border-brand bg-brand-soft' : 'border-line bg-surface hover:border-line-strong hover:bg-surface-hover',
                        )}
                      >
                        <span className="block truncate text-[14px] font-medium text-ink">{item.session.title}</span>
                        <span className="mt-0.5 block text-xs text-ink-subtle">
                          {item.counts.mastered} of {item.concepts.length} mastered
                          {item.counts.due > 0 && <span className="text-due"> · {item.counts.due} due</span>}
                        </span>
                        <StatusBar counts={item.counts} className="mt-2.5 h-1.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
          )}

          <DeckPanel deck={deck} onStudy={study} onOpenConcept={setOpenIndex} onOpenDeckStation={onOpenDeckStation} />
        </div>
      )}

      {deck && openConcept && (
        <ConceptDialog
          deck={deck}
          progress={openConcept}
          now={now}
          onClose={() => setOpenIndex(null)}
          onStudy={() => study(openConcept.index)}
          onOpenDeckStation={
            onOpenDeckStation
              ? () => {
                  setOpenIndex(null);
                  onOpenDeckStation(deck.session);
                }
              : undefined
          }
          onOpenHardCards={onOpenHardCards}
        />
      )}
    </div>
  );
};

/** Concepts per status as one segmented bar. */
const StatusBar: React.FC<{ counts: Record<ConceptStatus, number>; className?: string }> = ({ counts, className }) => {
  const total = STATUS_ORDER.reduce((sum, status) => sum + counts[status], 0);
  return (
    <div className={cn('flex w-full gap-0.5 overflow-hidden rounded-full bg-surface-hover', className)} aria-hidden="true">
      {total > 0 &&
        STATUS_ORDER.map(status =>
          counts[status] > 0 ? (
            <div key={status} className={STATUS[status].dot} style={{ width: `${(counts[status] / total) * 100}%` }} />
          ) : null,
        )}
    </div>
  );
};

const DeckPanel: React.FC<{
  deck: DeckProgress;
  onStudy: (index: number) => void;
  onOpenConcept: (index: number) => void;
  onOpenDeckStation?: (session: StudySession) => void;
}> = ({ deck, onStudy, onOpenConcept, onOpenDeckStation }) => {
  const { session, concepts, counts } = deck;
  const next = deck.nextIndex !== null ? concepts[deck.nextIndex] : null;
  const allMastered = counts.mastered === concepts.length;

  return (
    <section aria-labelledby="map-deck-title" className="min-w-0 space-y-5 rounded-3xl border border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {session.category && <p className="text-xs font-medium text-brand-text">{session.category}</p>}
          <h2 id="map-deck-title" className="mt-1 text-lg font-semibold leading-snug text-ink">
            {session.title}
          </h2>
          <p className="mt-0.5 text-[13px] text-ink-subtle">
            {plural(concepts.length, 'concept')} · {plural(deck.cardCount, 'card')} · about {minutesOf(session)} min
          </p>
        </div>
        {onOpenDeckStation && (
          <Button size="sm" icon={Layers} onClick={() => onOpenDeckStation(session)}>
            Deck details
          </Button>
        )}
      </div>

      <div className="space-y-2.5">
        <StatusBar counts={counts} className="h-2" />
        <dl className="flex flex-wrap gap-x-5 gap-y-1.5 text-[13px]">
          {STATUS_ORDER.map(status => (
            <div key={status} className="flex items-center gap-1.5">
              <dt className="flex items-center gap-1.5 text-ink-subtle">
                <span className={cn('h-2 w-2 rounded-full', STATUS[status].dot)} aria-hidden="true" />
                {STATUS[status].label}
              </dt>
              <dd className="font-medium tabular-nums text-ink">{counts[status]}</dd>
            </div>
          ))}
        </dl>
      </div>

      {next ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-brand/30 bg-brand-soft p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium text-brand-text">Up next · concept {next.index + 1}</p>
            <p className="mt-0.5 text-[15px] font-semibold leading-snug text-ink">{next.concept.title}</p>
          </div>
          <Button variant="primary" icon={Play} onClick={() => onStudy(next.index)} className="shrink-0">
            Study it
          </Button>
        </div>
      ) : (
        <p className="rounded-2xl border border-line bg-canvas px-4 py-3 text-[13px] leading-relaxed text-ink-muted">
          {allMastered
            ? 'Every concept here is mastered. Reviews as they come due will keep it that way.'
            : 'You have started every concept. Keep up with reviews as they come due, and each one moves to mastered.'}
        </p>
      )}

      <ol aria-label="Concepts in teaching order" className="space-y-2">
        {concepts.map((progress, position) => (
          <ConceptRow
            key={progress.concept.id}
            progress={progress}
            isNext={progress.index === deck.nextIndex}
            isLast={position === concepts.length - 1}
            onOpen={() => onOpenConcept(progress.index)}
          />
        ))}
      </ol>
    </section>
  );
};

/** One line under the concept's title: what its cards say about it. */
const summaryOf = (progress: ConceptProgress): string => {
  const total = progress.cards.length;
  const parts: string[] = [];
  if (total === 0) return 'No cards yet';
  if (progress.status === 'new') parts.push(plural(total, 'card'));
  else if (progress.status === 'due') parts.push(`${progress.dueCount} of ${plural(total, 'card')} due`);
  else if (progress.status === 'learning') parts.push(`${progress.masteredCount} of ${plural(total, 'card')} mastered`);
  else parts.push(`${plural(total, 'card')} mastered`);
  if (progress.recallChance !== null) parts.push(`${progress.recallChance}% recall now`);
  if (progress.hardCount > 0) parts.push(plural(progress.hardCount, 'hard card'));
  if (progress.status === 'new' && progress.warmup?.isCorrect === false) parts.push('missed in the warm-up');
  return parts.join(' · ');
};

const ConceptRow: React.FC<{
  progress: ConceptProgress;
  isNext: boolean;
  isLast: boolean;
  onOpen: () => void;
}> = ({ progress, isNext, isLast, onOpen }) => {
  const style = STATUS[progress.status];
  return (
    <li className="relative flex gap-3">
      {!isLast && <span className="absolute bottom-[-8px] left-[15px] top-[42px] w-px bg-line" aria-hidden="true" />}
      <span
        className={cn(
          'relative mt-[11px] flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums',
          isNext ? 'bg-brand text-brand-ink ring-4 ring-brand/20' : style.marker,
        )}
        aria-hidden="true"
      >
        {progress.status === 'mastered' ? <Check className="h-4 w-4" /> : progress.index + 1}
      </span>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'group min-w-0 flex-1 rounded-2xl border px-4 py-3 text-left transition-colors cursor-pointer',
          isNext ? 'border-brand/40 bg-canvas hover:bg-surface-hover' : 'border-line bg-canvas hover:border-line-strong hover:bg-surface-hover',
        )}
      >
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="sr-only">
              Concept {progress.index + 1}
              {isNext ? ', up next' : ''}:{' '}
            </span>
            <span className="block text-[14px] font-medium leading-snug text-ink">{progress.concept.title}</span>
            <span className="mt-0.5 block text-xs text-ink-subtle">{summaryOf(progress)}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5 pt-0.5">
            <Badge tone={style.tone}>{style.label}</Badge>
            <ChevronRight className="h-4 w-4 text-ink-subtle transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </span>
        </span>
      </button>
    </li>
  );
};

/** What the concept's status means, in a sentence. */
const statusSentence = (progress: ConceptProgress): string => {
  const total = progress.cards.length;
  switch (progress.status) {
    case 'new':
      return total === 0 ? 'This concept has no cards to review yet.' : `None of its ${plural(total, 'card')} has been reviewed yet.`;
    case 'due':
      return `${progress.dueCount === 1 ? '1 card is' : `${progress.dueCount} cards are`} due for review. Reviewing near the point of forgetting is what makes memories last.`;
    case 'learning':
      return `${progress.reviewedCount} of ${plural(total, 'card')} reviewed, ${progress.masteredCount} mastered. A card counts as mastered once it should stay with you for three weeks.`;
    case 'mastered':
      return 'Every card should stay with you for at least three weeks. Reviews as they come due keep it that way.';
  }
};

const ConceptDialog: React.FC<{
  deck: DeckProgress;
  progress: ConceptProgress;
  now: Date;
  onClose: () => void;
  onStudy: () => void;
  onOpenDeckStation?: () => void;
  onOpenHardCards?: () => void;
}> = ({ deck, progress, now, onClose, onStudy, onOpenDeckStation, onOpenHardCards }) => {
  const { concept, warmup } = progress;
  const style = STATUS[progress.status];
  const shownCards = progress.cards.slice(0, DIALOG_CARD_LIMIT);
  const hiddenCount = progress.cards.length - shownCards.length;

  return (
    <Dialog isOpen onClose={onClose} titleId="map-concept-title" className="max-w-2xl">
      <DialogPanel>
        <DialogHeader
          titleId="map-concept-title"
          title={concept.title}
          description={`Concept ${progress.index + 1} of ${deck.concepts.length} in ${deck.session.title} · about ${concept.estimatedMinutes || 5} min`}
          onClose={onClose}
        />

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={style.tone}>{style.label}</Badge>
              {progress.index === deck.nextIndex && <Badge tone="brand">Up next</Badge>}
            </div>
            <p className="text-[14px] leading-relaxed text-ink-muted">{statusSentence(progress)}</p>
            <dl className="grid grid-cols-3 gap-2">
              <Stat label="Reviewed" value={`${progress.reviewedCount} / ${progress.cards.length}`} />
              <Stat label="Recall now" value={progress.recallChance === null ? '—' : `${progress.recallChance}%`} />
              <Stat label="Hard cards" value={String(progress.hardCount)} tone={progress.hardCount > 0 ? 'danger' : undefined} />
            </dl>
            {progress.hardCount > 0 && onOpenHardCards && (
              <p className="text-[13px] text-ink-muted">
                Hard cards keep slipping.{' '}
                <button type="button" onClick={onOpenHardCards} className="font-medium text-brand-text hover:underline cursor-pointer">
                  Fix them in Hard cards
                </button>
              </p>
            )}
          </section>

          {warmup && (
            <section className="rounded-2xl border border-line bg-canvas px-4 py-3.5">
              <h3 className="text-xs font-medium text-ink-subtle">Warm-up, before you studied it</h3>
              <p className="mt-1 text-[13px] font-medium leading-relaxed text-ink">
                <MathRenderer text={warmup.question} />
              </p>
              {warmup.isCorrect ? (
                <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-success">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  You got it right.
                </p>
              ) : (
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
                  {warmup.userAnswer ? <>You chose “{warmup.userAnswer}”; the answer is “{warmup.correctAnswer}”.</> : <>The answer is “{warmup.correctAnswer}”.</>}{' '}
                  Missing it before studying is normal, and trying first tends to help it stick.
                </p>
              )}
            </section>
          )}

          {concept.mentalModel && (
            <section>
              <h3 className="text-[13px] font-semibold text-ink">The big idea</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-ink-muted">
                <MathRenderer text={concept.mentalModel} />
              </p>
            </section>
          )}

          {concept.coreTakeaways?.length > 0 && (
            <section>
              <h3 className="text-[13px] font-semibold text-ink">Key points</h3>
              <ul className="mt-1.5 space-y-1.5">
                {concept.coreTakeaways.map((point, i) => (
                  <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed text-ink-muted">
                    <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-ink-subtle" aria-hidden="true" />
                    <span>
                      <MathRenderer text={point} />
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {progress.cards.length > 0 && (
            <section>
              <h3 className="text-[13px] font-semibold text-ink">Cards</h3>
              <ul className="mt-2 space-y-1.5">
                {shownCards.map(card => {
                  const due = isCardDue(card, now);
                  const status = cardStatusOf(card);
                  const next = !due && card.reps > 0 ? describeNextReview(card, now) : null;
                  return (
                    <li key={card.id} className="flex items-start justify-between gap-3 rounded-xl border border-line bg-canvas px-3.5 py-2.5">
                      <span className="min-w-0 text-[13px] leading-snug text-ink">
                        <MathRenderer text={maskCloze(card.question)} />
                      </span>
                      <span className="shrink-0 text-right text-xs">
                        <span className={cn('flex items-center justify-end gap-1.5', due ? 'text-due' : 'text-ink-muted')}>
                          <span
                            className={cn('h-1.5 w-1.5 rounded-full', due ? 'bg-due' : status === 'mastered' ? 'bg-success' : status === 'learning' ? 'bg-brand' : 'bg-line-strong')}
                            aria-hidden="true"
                          />
                          {due ? 'Due' : status === 'mastered' ? 'Mastered' : status === 'learning' ? 'Learning' : 'New'}
                        </span>
                        {next && <span className="mt-0.5 block text-ink-subtle">Back {next.toLowerCase()}</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {hiddenCount > 0 && (
                <p className="mt-2 text-xs text-ink-subtle">
                  {plural(hiddenCount, 'more card')} in Deck details.
                </p>
              )}
            </section>
          )}
        </div>

        <DialogFooter className="justify-end">
          {onOpenDeckStation && (
            <Button icon={Layers} onClick={onOpenDeckStation}>
              Deck details
            </Button>
          )}
          <Button variant="primary" icon={Play} onClick={onStudy} data-autofocus>
            {progress.status === 'new' ? 'Study it' : 'Study it again'}
          </Button>
        </DialogFooter>
      </DialogPanel>
    </Dialog>
  );
};

const Stat: React.FC<{ label: string; value: string; tone?: 'danger' }> = ({ label, value, tone }) => (
  <div className="rounded-xl border border-line bg-canvas px-3 py-2.5">
    <dt className="text-xs text-ink-subtle">{label}</dt>
    <dd className={cn('mt-0.5 text-[17px] font-semibold tabular-nums', tone === 'danger' ? 'text-danger' : 'text-ink')}>{value}</dd>
  </div>
);
