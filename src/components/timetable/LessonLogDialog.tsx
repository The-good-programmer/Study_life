import React, { useId, useMemo, useState } from 'react';
import { Check, Layers, RefreshCw, Sparkles } from 'lucide-react';
import type { StudySession, TimetableLesson } from '../../types';
import { TimetableService } from '../../services/timetableService';
import { canMakeLessonCards, defaultHomeworkDue, makeLessonCards, saveLessonLog } from '../../services/lessonLog';
import type { GenerationStage } from '../ingestion/deckGenerator';
import { describeGenerationError } from '../ingestion/deckGenerator';
import { cn } from '../../utils/cn';
import { Dialog, DialogFooter, DialogHeader, DialogPanel } from '../common/Dialog';
import { Button } from '../ui/primitives';
import { INPUT_CLASS, formatDay } from '../planner/plannerUi';

type Outcome = { kind: 'saved' } | { kind: 'cards'; deck: StudySession; added: number } | { kind: 'cards-failed'; message: string };

/**
 * Right after a lesson: what was covered and any homework, in a few seconds. Homework goes into the
 * planner, due at the subject's next lesson; the topic can become flashcards in the subject's class
 * notes, so they come up in tonight's review.
 */
export const LessonLogDialog: React.FC<{
  lesson: TimetableLesson;
  day: string;
  onClose: () => void;
  onStudy?: (session: StudySession) => void;
  onOpenAuth?: () => void;
}> = ({ lesson, day, onClose, onStudy, onOpenAuth }) => {
  const fieldId = useId();
  const existing = useMemo(() => TimetableService.logFor(lesson.id, day), [lesson.id, day]);
  const suggestedDue = useMemo(() => defaultHomeworkDue(TimetableService.getLessons(), lesson, day), [lesson, day]);
  const cardsPossible = canMakeLessonCards();
  const [topic, setTopic] = useState(existing?.topic ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [homework, setHomework] = useState('');
  const [due, setDue] = useState(suggestedDue);
  const [makeCards, setMakeCards] = useState(cardsPossible && !existing?.cardCount);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<GenerationStage>('writing');
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const save = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!topic.trim() || busy) return;
    setError(null);
    let log;
    try {
      log = saveLessonLog(lesson, day, { topic, notes, homework, homeworkDue: due });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'It could not be saved.');
      return;
    }
    if (!makeCards) {
      onClose();
      return;
    }
    setBusy(true);
    try {
      const result = await makeLessonCards(lesson, log, setStage);
      setOutcome({ kind: 'cards', deck: result.deck, added: result.added });
    } catch (err) {
      setOutcome({ kind: 'cards-failed', message: describeGenerationError(err) });
    } finally {
      setBusy(false);
    }
  };

  const title = `${lesson.subject} · ${formatDay(day)}, ${lesson.start}–${lesson.end}`;

  return (
    <Dialog isOpen onClose={busy ? () => {} : onClose} titleId={`${fieldId}-title`} className="max-w-md">
      <DialogPanel className="max-h-[92dvh]">
        <DialogHeader
          titleId={`${fieldId}-title`}
          title={outcome ? 'Lesson logged' : existing ? 'Update this lesson' : 'What did you cover?'}
          description={title}
          onClose={busy ? undefined : onClose}
        />

        {outcome ? (
          <div className="space-y-3 px-5 py-5 sm:px-6">
            {outcome.kind === 'cards' ? (
              <p className="flex items-start gap-2.5 text-[14px] leading-relaxed text-ink-muted">
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
                <span>
                  <span className="font-medium text-ink">
                    {outcome.added} {outcome.added === 1 ? 'card' : 'cards'} added to {outcome.deck.title}.
                  </span>{' '}
                  They come up in today's review, and again just before you'd forget them.
                </span>
              </p>
            ) : (
              <p className="text-[14px] leading-relaxed text-ink-muted">
                <span className="font-medium text-ink">Your lesson is saved.</span>{' '}
                {outcome.kind === 'cards-failed' ? `The cards couldn't be made: ${outcome.message}` : null}
              </p>
            )}
          </div>
        ) : (
          <form id={`${fieldId}-form`} onSubmit={save} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
            <label className="block">
              <span className="text-[13px] font-medium text-ink">Topic</span>
              <input
                data-autofocus
                value={topic}
                onChange={e => setTopic(e.target.value)}
                maxLength={120}
                disabled={busy}
                placeholder="e.g. The Calvin cycle"
                className={cn(INPUT_CLASS, 'mt-1.5')}
              />
            </label>
            <label className="block">
              <span className="text-[13px] font-medium text-ink">
                Notes <span className="font-normal text-ink-subtle">(optional: from the board or your notes)</span>
              </span>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                maxLength={4000}
                disabled={busy}
                placeholder="Key points, definitions, examples. The more you add, the better the cards."
                className={cn(INPUT_CLASS, 'mt-1.5 h-auto resize-none py-2.5')}
              />
            </label>
            {!existing?.homeworkItemId && (
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px]">
                <label className="block">
                  <span className="text-[13px] font-medium text-ink">
                    Homework <span className="font-normal text-ink-subtle">(optional)</span>
                  </span>
                  <input
                    value={homework}
                    onChange={e => setHomework(e.target.value)}
                    maxLength={100}
                    disabled={busy}
                    placeholder="e.g. Worksheet 4, questions 1–6"
                    className={cn(INPUT_CLASS, 'mt-1.5')}
                  />
                </label>
                {homework.trim() && (
                  <label className="block">
                    <span className="text-[13px] font-medium text-ink">Due</span>
                    <input type="date" value={due} onChange={e => setDue(e.target.value)} disabled={busy} className={cn(INPUT_CLASS, 'mt-1.5')} />
                    {due === suggestedDue && <span className="mt-1 block text-xs text-ink-subtle">Next {lesson.subject} lesson</span>}
                  </label>
                )}
              </div>
            )}

            <label className={cn('flex items-start gap-2.5 text-[13px] leading-relaxed', cardsPossible ? 'cursor-pointer text-ink-muted' : 'text-ink-subtle')}>
              <input
                type="checkbox"
                checked={makeCards}
                onChange={e => setMakeCards(e.target.checked)}
                disabled={!cardsPossible || busy}
                className="mt-1 h-4 w-4 shrink-0 accent-[var(--brand)]"
              />
              <span>
                <span className="font-medium text-ink">Make flashcards from this lesson</span>
                <span className="block">
                  {cardsPossible ? (
                    `Added to ${lesson.subject}: class notes, so they come up in tonight's review.`
                  ) : (
                    <>
                      The AI needs a free account.{' '}
                      {onOpenAuth && (
                        <button type="button" onClick={onOpenAuth} className="font-medium text-brand-text hover:underline cursor-pointer">
                          Sign in
                        </button>
                      )}
                    </>
                  )}
                </span>
              </span>
            </label>

            {busy && (
              <p role="status" className="text-xs text-ink-subtle">
                {stage === 'checking' ? 'Checking every card is right…' : 'Writing your cards. This takes about 20 seconds.'}
              </p>
            )}
            {error && (
              <p role="alert" className="text-[13px] text-danger">
                {error}
              </p>
            )}
          </form>
        )}

        <DialogFooter className="justify-end">
          {outcome ? (
            <>
              {outcome.kind === 'cards' && onStudy && (
                <Button variant="secondary" icon={Layers} onClick={() => onStudy({ ...outcome.deck, currentPhase: 'retrieval', casualFlashcardMode: true })}>
                  Study them now
                </Button>
              )}
              <Button variant="primary" onClick={onClose}>
                Done
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button
                type="submit"
                form={`${fieldId}-form`}
                variant="primary"
                icon={busy ? RefreshCw : makeCards ? Sparkles : Check}
                disabled={!topic.trim() || busy}
                className={busy ? '[&>svg:first-child]:animate-spin' : ''}
              >
                {busy ? 'Making cards…' : makeCards ? 'Save and make cards' : 'Save'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogPanel>
    </Dialog>
  );
};
