import React, { useMemo } from 'react';
import { ArrowRight, Brain, Compass, Dna, FlaskConical, Languages, Stethoscope, Upload } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { StarterDeckMetadata, StudySession } from '../../types';
import { AuthService } from '../../services/authService';
import { soundEngine } from '../../services/soundEngine';
import { gentleStarterDecks, readyMadeSession } from '../onboarding/readyMadeDecks';
import { Button } from '../ui/primitives';
import { cn } from '../../utils/cn';

const DECKS_SHOWN = 3;

const CATEGORY_LOOK: Record<StarterDeckMetadata['category'], { icon: LucideIcon; tile: string }> = {
  'Medical & Clinical': { icon: Stethoscope, tile: 'bg-danger-soft text-danger' },
  'STEM & Engineering': { icon: FlaskConical, tile: 'bg-brand-soft text-brand-text' },
  'Biochemistry & Life Sciences': { icon: Dna, tile: 'bg-success-soft text-success' },
  'Languages & Polyglot': { icon: Languages, tile: 'bg-gold-soft text-gold' },
  'Cognitive & Behavioral Science': { icon: Brain, tile: 'bg-brand-soft text-brand-text' },
};

/**
 * The home page's start for a student with no decks: a few ready-made decks that open on their
 * flashcards in one tap, then the full catalog or their own notes. Loaded only while there are no
 * decks, so the catalog's data stays out of everyone else's download.
 */
export const FirstDeckStarter: React.FC<{
  onStartSession: (session: StudySession) => void;
  onOpenStarterCatalog: () => void;
  onOpenDeckStudio: () => void;
}> = ({ onStartSession, onOpenStarterCatalog, onOpenDeckStudio }) => {
  const decks = useMemo(() => gentleStarterDecks(DECKS_SHOWN, AuthService.getCurrentUser()?.grade), []);

  const start = (deck: StarterDeckMetadata) => {
    const session = readyMadeSession(deck);
    soundEngine.playStart();
    onStartSession(session);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-[13px] font-medium text-ink">
          Start with a ready-made deck <span className="font-normal text-ink-subtle">(no account needed)</span>
        </p>
        <ul className="grid gap-2 sm:grid-cols-3">
          {decks.map(deck => {
            const look = CATEGORY_LOOK[deck.category] ?? CATEGORY_LOOK['STEM & Engineering'];
            const Icon = look.icon;
            return (
              <li key={deck.id}>
                <button
                  type="button"
                  onClick={() => start(deck)}
                  className="group flex h-full w-full items-center gap-3 rounded-2xl border border-line bg-canvas/40 p-3.5 text-left transition-colors hover:border-brand/60 hover:bg-surface-hover cursor-pointer sm:flex-col sm:items-start sm:gap-3 sm:p-4"
                >
                  <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', look.tile)} aria-hidden="true">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="line-clamp-2 block text-[14px] font-medium leading-snug text-ink">{deck.title}</span>
                    <span className="block text-[12.5px] text-ink-subtle">
                      {deck.cardCount} cards · {deck.difficulty}
                    </span>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-brand-text sm:mt-auto">
                    Start
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <Button variant="secondary" icon={Upload} onClick={onOpenDeckStudio} className="w-full sm:w-auto">
          Use my notes or a PDF
        </Button>
        <Button variant="ghost" icon={Compass} onClick={onOpenStarterCatalog} className="w-full sm:w-auto">
          Browse all starter decks
        </Button>
      </div>
    </div>
  );
};
