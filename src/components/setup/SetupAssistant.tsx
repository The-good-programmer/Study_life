import React, { useId, useMemo, useRef, useState } from 'react';
import { ArrowRight, CalendarDays, Camera, Check, CircleCheck, Layers, Loader2, Plus, ScanText, Sparkles, X } from 'lucide-react';
import type { StudySession } from '../../types';
import { AIService } from '../../services/aiService';
import { KIND_LABELS } from '../../services/plannerService';
import { StorageService } from '../../services/storageService';
import { readSyllabus, type SyllabusItem } from '../../services/syllabusService';
import { readTimetable } from '../../services/timetableImport';
import { TimetableService, WEEKDAY_SHORT, type LessonDraft } from '../../services/timetableService';
import { iconFor, makeStarterDeck, markSetupDone, saveSetup, subjectsFrom, type SetupSubject } from '../../services/setupAssistant';
import { describeGenerationError } from '../ingestion/deckGenerator';
import { cn } from '../../utils/cn';
import { photoForAi } from '../../utils/photoForAi';
import { Dialog, DialogFooter, DialogHeader, DialogPanel } from '../common/Dialog';
import { Button, IconMedallion } from '../ui/primitives';
import { INPUT_CLASS, formatDay } from '../planner/plannerUi';

type Step = 'intro' | 'timetable' | 'exams' | 'subjects' | 'working' | 'done';
type Source = { text: string } | { image: { mimeType: string; data: string } };
type Checked<T> = T & { key: number; selected: boolean };
type DeckJob = { subject: string; state: 'waiting' | 'making' | 'done' | 'failed'; deck?: StudySession; error?: string };

/** Starter decks made now (each is two AI requests); more can be made any time from the Library. */
const MAX_DECKS = 3;

const STEPS: { step: Step; label: string }[] = [
  { step: 'timetable', label: 'Timetable' },
  { step: 'exams', label: 'Exams' },
  { step: 'subjects', label: 'Subjects' },
];

/** A photo, a PDF or a text file, or pasted text, as something the AI can read. */
async function sourceOf(file: File | null, text: string): Promise<Source> {
  if (!file) return { text };
  if (file.type.startsWith('image/')) return { image: await photoForAi(file) };
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    const { PDFService } = await import('../../services/pdfService');
    return { text: (await PDFService.extractTextFromPDF(file)).text };
  }
  return { text: await file.text() };
}

/** Photo, file or pasted text, for a step to read. */
const SourcePicker: React.FC<{
  file: File | null;
  text: string;
  onFile: (file: File | null) => void;
  onText: (text: string) => void;
  hint: string;
  placeholder: string;
  acceptPdf?: boolean;
  disabled?: boolean;
}> = ({ file, text, onFile, onText, hint, placeholder, acceptPdf, disabled }) => {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-3">
      <input ref={ref} type="file" accept={acceptPdf ? 'image/*,application/pdf,.txt' : 'image/*'} className="hidden" onChange={e => onFile(e.target.files?.[0] ?? null)} />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={disabled}
        className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-line-strong px-4 py-4 text-left transition-colors hover:border-brand cursor-pointer disabled:opacity-50"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-text" aria-hidden="true">
          <Camera className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-medium text-ink">{file ? file.name : acceptPdf ? 'Take a photo or choose a file' : 'Take or choose a photo'}</span>
          <span className="block text-xs text-ink-subtle">{file ? 'Tap to choose another' : hint}</span>
        </span>
      </button>
      {!file && (
        <label className="block">
          <span className="text-[13px] font-medium text-ink">Or paste it</span>
          <textarea value={text} onChange={e => onText(e.target.value)} rows={3} disabled={disabled} placeholder={placeholder} className={cn(INPUT_CLASS, 'mt-1.5 h-auto resize-none py-2.5')} />
        </label>
      )}
    </div>
  );
};

/**
 * "Set up your school year": a photo of the timetable, then the syllabus or exam dates, then the
 * subjects and their starter decks. The AI reads; the student checks each step; nothing is saved
 * until the end, and every step can be skipped.
 */
export const SetupAssistant: React.FC<{
  onClose: () => void;
  onOpenPlanner?: () => void;
  onStartSession?: (session: StudySession) => void;
  onOpenAuth?: () => void;
}> = ({ onClose, onOpenPlanner, onStartSession, onOpenAuth }) => {
  const titleId = useId();
  const [step, setStep] = useState<Step>('intro');
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lessons, setLessons] = useState<Checked<LessonDraft>[] | null>(null);
  const [items, setItems] = useState<Checked<SyllabusItem>[] | null>(null);
  const [extraSubjects, setExtraSubjects] = useState<string[]>([]);
  const [newSubject, setNewSubject] = useState('');
  const [deckFor, setDeckFor] = useState<Record<string, boolean>>({});
  const [jobs, setJobs] = useState<DeckJob[]>([]);
  const [summary, setSummary] = useState<{ lessons: number; items: number; subjects: number } | null>(null);
  const aiReady = !AIService.needsSignIn();
  const folders = useMemo(() => StorageService.getFolders(), []);

  const chosenLessons = useMemo(() => (lessons ?? []).filter(l => l.selected), [lessons]);
  const chosenItems = useMemo(() => (items ?? []).filter(i => i.selected), [items]);
  const subjects: SetupSubject[] = useMemo(() => {
    const found = subjectsFrom(chosenLessons, chosenItems, folders);
    for (const name of extraSubjects) {
      if (!found.some(s => s.name.toLowerCase() === name.toLowerCase())) found.push({ name, folderId: folders.find(f => f.name.toLowerCase() === name.toLowerCase())?.id, topics: [], lessons: 0, exams: 0 });
    }
    return found;
  }, [chosenLessons, chosenItems, extraSubjects, folders]);
  // Starter decks: the first few subjects (most exams first) unless the student says otherwise.
  const wantsDeck = (subject: SetupSubject, index: number) => deckFor[subject.name] ?? index < MAX_DECKS;
  const deckCount = subjects.filter(wantsDeck).length;

  const resetSource = () => {
    setFile(null);
    setText('');
    setError(null);
  };
  const go = (next: Step) => {
    resetSource();
    setStep(next);
  };

  const readStep = async () => {
    setBusy(true);
    setError(null);
    try {
      const source = await sourceOf(file, text);
      if ('text' in source && !source.text.trim()) throw new Error('There is no text in that. Take a photo instead.');
      if (step === 'timetable') {
        const found = await readTimetable(source, folders, TimetableService.getLessons());
        if (found.length === 0) throw new Error('No lessons could be read. Try a sharper photo, or skip and add them later.');
        setLessons(found.map((lesson, key) => ({ ...lesson, key, selected: true })));
      } else {
        const found = await readSyllabus(source, { folders });
        if (found.length === 0) throw new Error('No dated exams or deadlines were found in that. Try another page, or skip.');
        setItems(found.map((item, key) => ({ ...item, key, selected: true })));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    setStep('working');
    const saved = saveSetup(chosenLessons, chosenItems, subjects);
    setSummary({ lessons: saved.lessons, items: saved.items, subjects: subjects.length });
    const wanted = subjects.filter(wantsDeck);
    const queue: DeckJob[] = wanted.map(s => ({ subject: s.name, state: 'waiting' }));
    setJobs(queue);
    for (let i = 0; i < wanted.length; i++) {
      setJobs(prev => prev.map((job, j) => (j === i ? { ...job, state: 'making' } : job)));
      try {
        const deck = await makeStarterDeck(wanted[i], saved.folderIds.get(wanted[i].name.trim().toLowerCase()));
        setJobs(prev => prev.map((job, j) => (j === i ? { ...job, state: 'done', deck } : job)));
      } catch (err) {
        setJobs(prev => prev.map((job, j) => (j === i ? { ...job, state: 'failed', error: describeGenerationError(err) } : job)));
      }
    }
    markSetupDone();
    setStep('done');
  };

  const close = () => {
    if (step === 'intro') markSetupDone();
    onClose();
  };

  const stepIndex = STEPS.findIndex(s => s.step === step);
  const header =
    step === 'intro'
      ? { title: 'Set up your school year', description: 'Two minutes with your phone camera, and Studify is ready.' }
      : step === 'timetable'
        ? { title: lessons ? 'Check your lessons' : 'Your timetable', description: lessons ? `${lessons.length} found. Untick any that are wrong.` : 'A photo of your weekly timetable, or paste it.' }
        : step === 'exams'
          ? { title: items ? 'Check your exams and deadlines' : 'Exams and deadlines', description: items ? `${items.length} found. Each exam gets a day-by-day study plan.` : 'A syllabus, a course outline or a list of exam dates: photo, PDF or pasted.' }
          : step === 'subjects'
            ? { title: 'Your subjects', description: `Starter decks give you something to study tonight (up to ${MAX_DECKS} now; make more any time).` }
            : step === 'working'
              ? { title: 'Setting things up…', description: 'Making your starter decks. This takes about 20 seconds each.' }
              : { title: "You're set up", description: 'Everything is in the Planner and your Library, linked by subject.' };

  return (
    <Dialog isOpen onClose={busy || step === 'working' ? () => {} : close} titleId={titleId} className="max-w-lg">
      <DialogPanel className="max-h-[92dvh]">
        <DialogHeader titleId={titleId} title={header.title} description={header.description} onClose={busy || step === 'working' ? undefined : close}>
          {stepIndex >= 0 && (
            <ol className="mt-3 flex gap-1.5" aria-label="Steps">
              {STEPS.map((s, i) => (
                <li key={s.step} className={cn('h-1.5 flex-1 rounded-full', i <= stepIndex ? 'bg-brand' : 'bg-line-strong')} aria-current={i === stepIndex ? 'step' : undefined}>
                  <span className="sr-only">{s.label}</span>
                </li>
              ))}
            </ol>
          )}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {step === 'intro' &&
            (aiReady ? (
              <div className="space-y-4">
                <IconMedallion icon={Sparkles} className="mx-auto" />
                <ol className="space-y-2.5">
                  {[
                    [CalendarDays, 'Snap your timetable', 'Your lessons, every week, with a nudge after each one.'],
                    [ScanText, 'Snap your syllabus or exam dates', 'Every exam gets a plan for each day until it.'],
                    [Layers, 'Pick your subjects', 'A starter deck for each, ready for tonight.'],
                  ].map(([Icon, title, body], i) => {
                    const I = Icon as typeof CalendarDays;
                    return (
                      <li key={i} className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-3.5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-text" aria-hidden="true">
                          <I className="h-[18px] w-[18px]" />
                        </span>
                        <span>
                          <span className="block text-[14px] font-medium text-ink">{title as string}</span>
                          <span className="block text-[13px] text-ink-muted">{body as string}</span>
                        </span>
                      </li>
                    );
                  })}
                </ol>
                <p className="text-xs text-ink-subtle">You check everything before it's saved, and any step can be skipped.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-[14px] leading-relaxed text-ink-muted">The set-up assistant uses the AI, which needs a free account (or your own Gemini key in Settings → AI).</p>
                {onOpenAuth && (
                  <Button variant="primary" onClick={onOpenAuth}>
                    Sign up free
                  </Button>
                )}
              </div>
            ))}

          {(step === 'timetable' || step === 'exams') &&
            ((step === 'timetable' ? lessons : items) ? (
              <ul className="divide-y divide-line">
                {step === 'timetable'
                  ? lessons!.map(row => (
                      <li key={row.key}>
                        <label className="flex cursor-pointer items-center gap-3 py-2.5">
                          <input type="checkbox" checked={row.selected} onChange={e => setLessons(prev => prev!.map(r => (r.key === row.key ? { ...r, selected: e.target.checked } : r)))} className="h-4 w-4 shrink-0 accent-[var(--brand)]" />
                          <span className="w-9 shrink-0 text-[13px] font-medium text-ink-subtle">{WEEKDAY_SHORT[row.weekday - 1]}</span>
                          <span className="w-[92px] shrink-0 text-[13px] tabular-nums text-ink-muted">
                            {row.start}–{row.end}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[14px] text-ink">
                            {row.subject}
                            {row.room && <span className="text-ink-subtle"> · {row.room}</span>}
                          </span>
                        </label>
                      </li>
                    ))
                  : items!.map(row => (
                      <li key={row.key}>
                        <label className="flex cursor-pointer items-center gap-3 py-2.5">
                          <input type="checkbox" checked={row.selected} onChange={e => setItems(prev => prev!.map(r => (r.key === row.key ? { ...r, selected: e.target.checked } : r)))} className="h-4 w-4 shrink-0 accent-[var(--brand)]" />
                          <span className="w-[86px] shrink-0 text-[13px] text-ink-muted">{formatDay(row.date)}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14px] text-ink">{row.title}</span>
                            <span className="block truncate text-xs text-ink-subtle">
                              {KIND_LABELS[row.kind]}
                              {(row.subjectName || folders.find(f => f.id === row.folderId)?.name) && ` · ${row.subjectName ?? folders.find(f => f.id === row.folderId)?.name}`}
                            </span>
                          </span>
                        </label>
                      </li>
                    ))}
              </ul>
            ) : (
              <SourcePicker
                file={file}
                text={text}
                onFile={setFile}
                onText={setText}
                disabled={busy}
                acceptPdf={step === 'exams'}
                hint={step === 'timetable' ? 'The whole week, straight on and in focus.' : 'A page with dates on it: a syllabus, an exam timetable…'}
                placeholder={step === 'timetable' ? 'e.g. Monday 08:30–09:15 Biology (Lab 2), 09:20 Maths…' : 'e.g. Biology unit test 3 Dec (cells); Maths mock 12 Jan…'}
              />
            ))}

          {step === 'subjects' && (
            <div className="space-y-3">
              {subjects.length > 0 ? (
                <ul className="space-y-2">
                  {subjects.map((subject, i) => (
                    <li key={subject.name} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-hover text-lg" aria-hidden="true">
                        {iconFor(subject.name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium text-ink">{subject.name}</span>
                        <span className="block truncate text-xs text-ink-subtle">
                          {[subject.lessons && `${subject.lessons} ${subject.lessons === 1 ? 'lesson' : 'lessons'} a week`, subject.exams && `${subject.exams} ${subject.exams === 1 ? 'exam' : 'exams'}`].filter(Boolean).join(' · ') || 'Added by you'}
                        </span>
                      </span>
                      <label className="flex shrink-0 cursor-pointer items-center gap-2 text-[13px] text-ink-muted">
                        <input
                          type="checkbox"
                          checked={wantsDeck(subject, i)}
                          disabled={!wantsDeck(subject, i) && deckCount >= MAX_DECKS}
                          onChange={e => setDeckFor(prev => ({ ...prev, [subject.name]: e.target.checked }))}
                          className="h-4 w-4 accent-[var(--brand)]"
                        />
                        Starter deck
                      </label>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[14px] text-ink-muted">Which subjects are you studying? Add them, and Studify makes a starter deck for each.</p>
              )}
              <form
                className="flex gap-2"
                onSubmit={e => {
                  e.preventDefault();
                  const name = newSubject.trim().slice(0, 60);
                  if (name) setExtraSubjects(prev => [...prev, name]);
                  setNewSubject('');
                }}
              >
                <input value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="Add a subject, e.g. Chemistry" maxLength={60} aria-label="Add a subject" className={cn(INPUT_CLASS, 'min-w-0 flex-1')} />
                <Button type="submit" icon={Plus} disabled={!newSubject.trim()}>
                  Add
                </Button>
              </form>
            </div>
          )}

          {(step === 'working' || step === 'done') && (
            <div className="space-y-4">
              {step === 'done' && <IconMedallion icon={CircleCheck} tone="success" className="mx-auto" />}
              {summary && (
                <ul className="space-y-1.5 text-[14px] text-ink-muted">
                  {summary.lessons > 0 && <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success" aria-hidden="true" />{summary.lessons} {summary.lessons === 1 ? 'lesson' : 'lessons'} in your timetable</li>}
                  {summary.items > 0 && <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success" aria-hidden="true" />{summary.items} {summary.items === 1 ? 'exam or deadline' : 'exams and deadlines'} in the Planner</li>}
                  {summary.subjects > 0 && <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success" aria-hidden="true" />{summary.subjects} {summary.subjects === 1 ? 'subject' : 'subjects'}</li>}
                </ul>
              )}
              {jobs.length > 0 && (
                <ul className="space-y-1.5 text-[14px]" aria-label="Starter decks">
                  {jobs.map(job => (
                    <li key={job.subject} className="flex items-center gap-2">
                      {job.state === 'making' ? (
                        <Loader2 className="h-4 w-4 animate-spin text-brand-text" aria-hidden="true" />
                      ) : job.state === 'done' ? (
                        <Check className="h-4 w-4 text-success" aria-hidden="true" />
                      ) : job.state === 'failed' ? (
                        <X className="h-4 w-4 text-danger" aria-hidden="true" />
                      ) : (
                        <span className="h-4 w-4 rounded-full border border-line-strong" aria-hidden="true" />
                      )}
                      <span className={job.state === 'failed' ? 'text-ink-muted' : 'text-ink'}>
                        {job.state === 'done' && job.deck ? `${job.deck.title}` : `${job.subject} starter deck`}
                        {job.state === 'failed' && <span className="block text-xs text-danger">{job.error}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {error && (
            <p role="alert" className="mt-3 text-[13px] text-danger">
              {error}
            </p>
          )}
          {busy && (
            <p role="status" className="mt-3 flex items-center gap-2 text-xs text-ink-subtle">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              Reading it…
            </p>
          )}
        </div>

        <DialogFooter className="justify-between">
          {step === 'intro' ? (
            <>
              <Button variant="ghost" onClick={close}>
                Not now
              </Button>
              {aiReady && (
                <Button variant="primary" trailingIcon={ArrowRight} onClick={() => go('timetable')}>
                  Start
                </Button>
              )}
            </>
          ) : step === 'timetable' || step === 'exams' ? (
            <>
              <Button variant="ghost" onClick={() => go(step === 'timetable' ? 'exams' : 'subjects')} disabled={busy}>
                {(step === 'timetable' ? lessons : items) ? 'Skip these' : 'Skip'}
              </Button>
              {(step === 'timetable' ? lessons : items) ? (
                <Button variant="primary" trailingIcon={ArrowRight} onClick={() => go(step === 'timetable' ? 'exams' : 'subjects')}>
                  Next
                </Button>
              ) : (
                <Button variant="primary" icon={ScanText} onClick={readStep} disabled={busy || (!file && !text.trim())}>
                  Read it
                </Button>
              )}
            </>
          ) : step === 'subjects' ? (
            <>
              <Button variant="ghost" onClick={() => go('exams')}>
                Back
              </Button>
              <Button variant="primary" icon={Sparkles} onClick={finish} disabled={subjects.length === 0 && chosenLessons.length === 0 && chosenItems.length === 0}>
                {deckCount > 0 ? `Finish and make ${deckCount} ${deckCount === 1 ? 'deck' : 'decks'}` : 'Finish'}
              </Button>
            </>
          ) : step === 'done' ? (
            <>
              {onOpenPlanner ? (
                <Button
                  variant="secondary"
                  icon={CalendarDays}
                  onClick={() => {
                    onClose();
                    onOpenPlanner();
                  }}
                >
                  See the Planner
                </Button>
              ) : (
                <span />
              )}
              {(() => {
                const first = jobs.find(job => job.deck)?.deck;
                return first && onStartSession ? (
                  <Button
                    variant="primary"
                    icon={Layers}
                    onClick={() => {
                      onClose();
                      onStartSession({ ...first, currentPhase: 'retrieval', casualFlashcardMode: true });
                    }}
                  >
                    Start studying
                  </Button>
                ) : (
                  <Button variant="primary" onClick={onClose}>
                    Done
                  </Button>
                );
              })()}
            </>
          ) : (
            <span />
          )}
        </DialogFooter>
      </DialogPanel>
    </Dialog>
  );
};
