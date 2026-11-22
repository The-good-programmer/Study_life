import React, { useMemo } from 'react';
import { Award, Brain, ChevronRight, Compass, Layers, Shuffle, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { StudySession } from '../../types';
import { StorageService } from '../../services/storageService';
import { soundEngine } from '../../services/soundEngine';
import { buildMatchTiles } from '../game/matchTiles';

/**
 * Every way to study the same cards, in one place (the sidebar's "Practice"). Switching between them
 * helps: recall, timed tests and mixing subjects each train memory a little differently.
 */
export const PracticePage: React.FC<{
  onStartDailyReview: () => void;
  onStartSession: (session: StudySession) => void;
  onStartMatch: (session: StudySession) => void;
  onOpenExam: () => void;
  onOpenInterleaving: () => void;
  onOpenStarterCatalog: () => void;
}> = ({ onStartDailyReview, onStartSession, onStartMatch, onOpenExam, onOpenInterleaving, onOpenStarterCatalog }) => {
  const [decks] = React.useState(() => StorageService.getSessions());
  const [todayCount] = React.useState(() => StorageService.getDailyQueue().cards.length);
  const firstDeck = decks[0];
  const matchDeck = useMemo(() => decks.find(deck => buildMatchTiles(deck).length >= 4), [decks]);

  const startGuided = firstDeck
    ? () => {
        soundEngine.playContextShiftSound();
        onStartSession({ ...firstDeck, currentPhase: 'priming', casualFlashcardMode: false });
      }
    : undefined;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 animate-fadeIn">
      <header>
        <h1 className="text-[26px] font-semibold tracking-tight text-ink sm:text-[30px]">Practice</h1>
        <p className="mt-1 max-w-2xl text-[15px] text-ink-muted">
          Different ways to study the same cards. Switching between them helps: each one trains your memory a little differently.
        </p>
      </header>

      <section aria-labelledby="practice-daily" className="space-y-3">
        <h2 id="practice-daily" className="text-[15px] font-semibold text-ink">Every day</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <StudyModeCard
            icon={Layers}
            title="Today's review"
            description="Spaced repetition picks what you are about to forget, from all your decks."
            meta={todayCount > 0 ? `${todayCount} today` : 'Practise ahead'}
            onClick={onStartDailyReview}
          />
          <StudyModeCard
            icon={Brain}
            title="Guided session"
            description="Prime the big idea, explain it in your own words, then recall it, with a short break."
            meta={firstDeck ? firstDeck.title : 'Needs a deck'}
            onClick={startGuided}
          />
        </div>
      </section>

      <section aria-labelledby="practice-more" className="space-y-3">
        <h2 id="practice-more" className="text-[15px] font-semibold text-ink">Test yourself</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <StudyModeCard
            icon={Zap}
            title="Speed match"
            description="Pair terms with definitions against the clock."
            meta={matchDeck ? '60 seconds' : 'Needs a deck with 4 cards'}
            onClick={matchDeck ? () => onStartMatch(matchDeck) : undefined}
          />
          <StudyModeCard
            icon={Award}
            title="Mock exam"
            description="Timed questions scored on accuracy and confidence, like the real thing."
            meta="Timed"
            onClick={onOpenExam}
          />
          <StudyModeCard
            icon={Shuffle}
            title="Mix decks"
            description="Shuffle subjects together, so you learn to tell problem types apart."
            meta={decks.length >= 2 ? 'Interleaving' : 'Best with 2 or more decks'}
            onClick={onOpenInterleaving}
          />
        </div>
      </section>

      <section aria-labelledby="practice-new" className="space-y-3">
        <h2 id="practice-new" className="text-[15px] font-semibold text-ink">Something new</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <StudyModeCard
            icon={Compass}
            title="Find a new deck"
            description="Ready-made decks checked for accuracy, ranked for your level."
            meta="Starter decks"
            onClick={onOpenStarterCatalog}
          />
        </div>
      </section>
    </div>
  );
};

interface StudyModeCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  meta: string;
  onClick?: () => void;
}

const StudyModeCard: React.FC<StudyModeCardProps> = ({ icon: Icon, title, description, meta, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={!onClick}
    className="group flex flex-col items-start gap-3 rounded-2xl border border-line bg-surface p-4 text-left transition-colors hover:border-line-strong hover:bg-surface-hover disabled:opacity-50 disabled:hover:bg-surface cursor-pointer"
  >
    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand-text">
      <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
    </span>
    <span>
      <span className="block text-[15px] font-medium text-ink">{title}</span>
      <span className="mt-1 block text-[13px] leading-relaxed text-ink-subtle">{description}</span>
    </span>
    <span className="mt-auto flex w-full items-center justify-between text-[13px] font-medium text-ink-muted group-hover:text-ink">
      {meta}
      <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </span>
  </button>
);
