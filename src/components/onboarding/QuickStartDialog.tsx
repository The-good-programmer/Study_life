import React, { useId, useMemo, useState } from 'react';
import { ArrowRight, Camera, FileText, RefreshCw, Sparkles } from 'lucide-react';
import type { StudySession } from '../../types';
import { AuthService } from '../../services/authService';
import { AIService } from '../../services/aiService';
import { soundEngine } from '../../services/soundEngine';
import { gentleStarterDecks, readyMadeSession } from './readyMadeDecks';
import { useDeckGeneration } from '../ingestion/useDeckGeneration';
import { EducationProfileModal } from '../ingestion/EducationProfileModal';
import { Dialog, DialogFooter, DialogHeader, DialogPanel } from '../common/Dialog';
import { Button } from '../ui/primitives';
import { QUICK_START_TOPIC_KEY } from './quickStart';

const EXAMPLES = ['Photosynthesis', 'The French Revolution', 'Quadratic equations', 'The water cycle'];
/** Ready-made decks offered, best for the student's level first. */
const READY_MADE = 3;

/**
 * The first thing a new student sees: type a topic (the AI writes the deck), bring notes or photos,
 * or start a ready-made deck at once. Instead of a tour, so they are studying within a minute.
 */
export const QuickStartDialog: React.FC<{
  onClose: () => void;
  onStartSession: (session: StudySession) => void;
  onOpenNotes: () => void;
  onOpenAuth: () => void;
  initialTopic?: string | null;
}> = ({ onClose, onStartSession, onOpenNotes, onOpenAuth, initialTopic }) => {
  const titleId = useId();
  const inputId = useId();
  const [topic, setTopic] = useState(initialTopic ?? '');
  const generation = useDeckGeneration({ onSessionReady: onStartSession });
  const { isLoading, stage, error, effectiveProfile, profileModal } = generation;
  const needsSignIn = AIService.needsSignIn();
  // Ranked for the student's level, the gentlest first: a first deck should feel doable.
  const readyMade = useMemo(() => gentleStarterDecks(READY_MADE, AuthService.getCurrentUser()?.grade), []);

  const make = (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = topic.trim();
    if (!text || isLoading) return;
    if (needsSignIn) {
      // The free AI needs an account: sign up, then come straight back here with the topic.
      try {
        sessionStorage.setItem(QUICK_START_TOPIC_KEY, text);
      } catch {
        // Private mode: they type it again.
      }
      onOpenAuth();
      return;
    }
    soundEngine.playStart();
    generation.generate({ kind: 'topic', text });
  };

  const startReadyMade = (index: number) => {
    const session = readyMadeSession(readyMade[index]);
    soundEngine.playStart();
    // Straight into the flashcards: studying in seconds.
    onStartSession(session);
  };

  return (
    <>
      <Dialog isOpen onClose={isLoading ? () => {} : onClose} titleId={titleId} className="max-w-lg">
        <DialogPanel className="max-h-[92dvh]">
          <DialogHeader
            titleId={titleId}
            title="What do you want to study?"
            description="Make your first deck in about a minute. Studify then brings each card back just before you'd forget it."
            onClose={isLoading ? undefined : onClose}
          />
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
            <form onSubmit={make} className="space-y-2.5">
              <label htmlFor={inputId} className="text-[13px] font-medium text-ink">
                Type a topic
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id={inputId}
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  placeholder="e.g. Photosynthesis"
                  maxLength={200}
                  autoComplete="off"
                  autoFocus
                  disabled={isLoading}
                  className="h-11 min-w-0 flex-1 rounded-xl border border-line-strong bg-canvas px-3.5 text-[15px] text-ink placeholder:text-ink-subtle transition-colors focus:border-brand focus:outline-none"
                />
                <Button type="submit" variant="primary" icon={isLoading ? RefreshCw : Sparkles} disabled={!topic.trim() || isLoading} className={isLoading ? '[&>svg:first-child]:animate-spin' : ''}>
                  {isLoading ? (stage === 'checking' ? 'Checking the cards' : 'Writing your cards') : needsSignIn ? 'Sign up free to make it' : 'Make my deck'}
                </Button>
              </div>
              {isLoading ? (
                <p className="text-xs text-ink-subtle" role="status">
                  {stage === 'checking' ? 'A second check makes sure every card is right.' : 'The AI is writing cards for your level. This takes about 20 seconds.'}
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {EXAMPLES.map(example => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => setTopic(example)}
                      className="rounded-full border border-line-strong px-2.5 py-1 text-xs text-ink-muted transition-colors hover:border-brand/60 hover:text-ink cursor-pointer"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              )}
              {error && (
                <p role="alert" className="text-[13px] text-danger">
                  {error}
                </p>
              )}
            </form>

            <div className="space-y-2">
              <p className="text-[13px] font-medium text-ink">Or use your own notes</p>
              <button
                type="button"
                onClick={onOpenNotes}
                disabled={isLoading}
                className="flex w-full items-center gap-3 rounded-xl border border-line px-3.5 py-3 text-left transition-colors hover:border-brand/60 disabled:opacity-50 cursor-pointer"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-text" aria-hidden="true">
                  <Camera className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium text-ink">Photos, notes, a lecture or a video</span>
                  <span className="block text-xs text-ink-subtle">Snap your notes, paste text, record a class or paste a YouTube link.</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-[13px] font-medium text-ink">
                Or try a ready-made deck <span className="font-normal text-ink-subtle">(no account needed)</span>
              </p>
              <ul className="space-y-2">
                {readyMade.map((deck, i) => (
                  <li key={deck.id}>
                    <button
                      type="button"
                      onClick={() => startReadyMade(i)}
                      disabled={isLoading}
                      className="flex w-full items-center gap-3 rounded-xl border border-line px-3.5 py-2.5 text-left transition-colors hover:border-brand/60 disabled:opacity-50 cursor-pointer"
                    >
                      <FileText className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate text-[14px] text-ink">{deck.title}</span>
                      <span className="shrink-0 text-xs font-medium text-brand-text">Start</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <DialogFooter className="justify-end">
            <Button variant="ghost" onClick={onClose} disabled={isLoading}>
              Skip, I'll look around
            </Button>
          </DialogFooter>
        </DialogPanel>
      </Dialog>
      {profileModal.isOpen && (
        <EducationProfileModal
          isOpen={profileModal.isOpen}
          initialProfile={effectiveProfile}
          onClose={profileModal.close}
          onSave={profileModal.save}
          title="Your level"
          description="Cards are written for your level: the right depth, words and examples for your grade and country."
          actionLabel="Save and make the deck"
        />
      )}
    </>
  );
};
