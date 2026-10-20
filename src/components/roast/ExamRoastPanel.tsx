import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  Check,
  Copy,
  Flame,
  ListChecks,
  PenLine,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  X,
} from 'lucide-react';
import type { StudentEducationProfile, StudySession } from '../../types';
import { AIService } from '../../services/aiService';
import {
  MAX_EXAM_PAGES,
  MIN_SPICY_AGE,
  MISTAKE_KINDS,
  analyzeExam,
  buildMistakeDeck,
  buildOfflineMistakeDeck,
  resolveTone,
} from '../../services/examRoastService';
import type { ExamMistake, ExamPage, ExamRoast, MistakeKind, RoastTone } from '../../services/examRoastService';
import { Badge, Button, IconButton } from '../ui/primitives';
import { filesToExamPages } from './examPages';

interface ExamRoastPanelProps {
  profile: StudentEducationProfile | null;
  /** Called with the new deck; the caller saves it and starts studying. */
  onDeckBuilt: (session: StudySession) => void;
}

type Stage = 'upload' | 'reading' | 'review' | 'building';

const blankMistake = (n: number): ExamMistake => ({
  id: `m-own-${Date.now()}-${n}`,
  questionRef: String(n),
  question: '',
  studentAnswer: '',
  correctAnswer: '',
  kind: 'concept-gap',
  topic: '',
  whyWrong: '',
  roast: '',
  pointsLost: null,
  readConfidence: 'high',
});

const typedRoast = (): ExamRoast => ({
  isExam: true,
  examTitle: 'Your exam',
  subject: '',
  languageCode: 'en',
  scoreText: '',
  headline: '',
  verdict: '',
  strengths: [],
  patterns: [],
  mistakes: [blankMistake(1)],
});

const inputClass =
  'w-full rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-[13px] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink-subtle focus:border-brand focus:ring-2 focus:ring-brand/15';

/** "Roast my exam": photos of a marked paper in, a roast and a deck on your mistakes out. */
export const ExamRoastPanel: React.FC<ExamRoastPanelProps> = ({ profile, onDeckBuilt }) => {
  const [stage, setStage] = useState<Stage>('upload');
  const [pages, setPages] = useState<ExamPage[]>([]);
  const [note, setNote] = useState('');
  const [tone, setTone] = useState<RoastTone>('spicy');
  const [roast, setRoast] = useState<ExamRoast | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [deckError, setDeckError] = useState<string | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const aiReady = AIService.isAvailable();
  const spicyLocked = resolveTone('spicy', profile?.age) === 'gentle';
  const effectiveTone = resolveTone(tone, profile?.age);
  const room = MAX_EXAM_PAGES - pages.length;

  const addFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setError(null);
    if (room <= 0) {
      setError(`Up to ${MAX_EXAM_PAGES} pages per exam.`);
      return;
    }
    setIsPreparing(true);
    try {
      const added = await filesToExamPages(files, room);
      setPages(prev => [...prev, ...added]);
      if (files.length > added.length && added.length === room) setError(`Only the first ${MAX_EXAM_PAGES} pages are used.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that file.');
    } finally {
      setIsPreparing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRoast = async () => {
    setError(null);
    setStage('reading');
    try {
      const result = await analyzeExam(pages, { tone: effectiveTone, note, profile });
      setRoast(result);
      setExcluded(new Set());
      setStage('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read the exam.');
      setStage('upload');
    }
  };

  const startTyping = () => {
    setRoast(typedRoast());
    setExcluded(new Set());
    setError(null);
    setStage('review');
  };

  const reset = () => {
    setStage('upload');
    setRoast(null);
    setPages([]);
    setNote('');
    setError(null);
    setDeckError(null);
  };

  const updateMistake = (id: string, patch: Partial<ExamMistake>) =>
    setRoast(r => (r ? { ...r, mistakes: r.mistakes.map(m => (m.id === id ? { ...m, ...patch } : m)) } : r));

  const removeMistake = (id: string) =>
    setRoast(r => (r ? { ...r, mistakes: r.mistakes.filter(m => m.id !== id) } : r));

  const addMistake = () =>
    setRoast(r => (r ? { ...r, mistakes: [...r.mistakes, blankMistake(r.mistakes.length + 1)] } : r));

  const toggleIncluded = (id: string) =>
    setExcluded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const chosen = (roast?.mistakes || []).filter(m => !excluded.has(m.id) && m.question.trim() && m.correctAnswer.trim());

  const handleBuild = async (offline = false) => {
    if (!roast || chosen.length === 0) return;
    setDeckError(null);
    setStage('building');
    try {
      const session = offline ? buildOfflineMistakeDeck(roast, chosen, profile) : await buildMistakeDeck(roast, chosen, profile);
      onDeckBuilt(session);
    } catch (err) {
      setDeckError(err instanceof Error ? err.message : 'Could not build the deck.');
      setStage('review');
    }
  };

  const copyRoast = async () => {
    if (!roast) return;
    const lines = [roast.headline, ...roast.mistakes.filter(m => m.roast).map(m => `Q${m.questionRef}: ${m.roast}`), '— roasted by Studify'];
    try {
      await navigator.clipboard.writeText(lines.filter(Boolean).join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  // Reading or building
  if (stage === 'reading' || stage === 'building') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-line bg-canvas px-6 py-12 text-center animate-fadeIn" aria-live="polite">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand-text">
          {stage === 'reading' ? <Flame className="h-6 w-6 animate-pulse" aria-hidden="true" /> : <RefreshCw className="h-6 w-6 animate-spin" aria-hidden="true" />}
        </span>
        <p className="text-[15px] font-medium text-ink">
          {stage === 'reading' ? 'Reading your paper and sharpening the jokes' : `Building cards from ${chosen.length} ${chosen.length === 1 ? 'mistake' : 'mistakes'}`}
        </p>
        <p className="text-[13px] text-ink-subtle">This usually takes 15 to 40 seconds.</p>
      </div>
    );
  }

  // Review
  if (stage === 'review' && roast) {
    const isTyped = !roast.headline && !roast.verdict;
    return (
      <div className="space-y-4 animate-fadeIn">
        {!roast.isExam ? (
          <div className="rounded-2xl border border-line bg-canvas p-5">
            <p className="text-[15px] font-medium text-ink">{roast.headline || "That doesn't look like an exam paper."}</p>
            <p className="mt-1 text-[13px] text-ink-muted">Try clear photos of a marked test, quiz or homework.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" icon={RotateCcw} onClick={reset}>Try other photos</Button>
              <Button variant="ghost" icon={PenLine} onClick={startTyping}>Type my mistakes instead</Button>
            </div>
          </div>
        ) : (
          !isTyped && (
            <section aria-label="The roast" className="rounded-2xl border border-gold/30 bg-gold-soft/40 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-gold">
                    <Flame className="h-3.5 w-3.5" aria-hidden="true" /> {roast.examTitle}
                  </p>
                  <p className="mt-1.5 text-[18px] font-semibold leading-snug text-ink">{roast.headline}</p>
                </div>
                <div className="flex items-center gap-2">
                  {roast.scoreText && <Badge tone="gold" className="text-[13px]">{roast.scoreText}</Badge>}
                  <Button variant="ghost" size="sm" icon={copied ? Check : Copy} onClick={copyRoast}>
                    {copied ? 'Copied' : 'Copy roast'}
                  </Button>
                </div>
              </div>
              {roast.verdict && <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">{roast.verdict}</p>}
              {(roast.patterns.length > 0 || roast.strengths.length > 0) && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {roast.patterns.length > 0 && (
                    <div>
                      <p className="text-[12px] font-semibold text-ink">Habits that cost you</p>
                      <ul className="mt-1 space-y-1 text-[13px] text-ink-muted">
                        {roast.patterns.map(p => <li key={p}>• {p}</li>)}
                      </ul>
                    </div>
                  )}
                  {roast.strengths.length > 0 && (
                    <div>
                      <p className="text-[12px] font-semibold text-ink">What you got right</p>
                      <ul className="mt-1 space-y-1 text-[13px] text-ink-muted">
                        {roast.strengths.map(s => <li key={s}>• {s}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </section>
          )
        )}

        {roast.isExam && (
          <section aria-labelledby="roast-mistakes-title" className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 id="roast-mistakes-title" className="flex items-center gap-1.5 text-[15px] font-semibold text-ink">
                  <ListChecks className="h-4 w-4 text-ink-subtle" aria-hidden="true" />
                  {isTyped ? 'Your mistakes' : `${roast.mistakes.length} ${roast.mistakes.length === 1 ? 'mistake' : 'mistakes'} found`}
                </h3>
                <p className="mt-0.5 text-[13px] text-ink-subtle">
                  {isTyped
                    ? 'Add each question you lost marks on and the right answer.'
                    : 'Check what the AI read before building the deck. Fix anything it got wrong, untick what you don’t want.'}
                </p>
              </div>
            </div>

            {roast.mistakes.length === 0 && (
              <p className="rounded-2xl border border-line bg-canvas p-4 text-[13px] text-ink-muted">
                No lost marks found. Either you aced it or the photos were hard to read. Add one by hand if the AI missed something.
              </p>
            )}

            <ul className="space-y-3">
              {roast.mistakes.map(m => (
                <MistakeCard
                  key={m.id}
                  mistake={m}
                  included={!excluded.has(m.id)}
                  onToggle={() => toggleIncluded(m.id)}
                  onChange={patch => updateMistake(m.id, patch)}
                  onRemove={() => removeMistake(m.id)}
                />
              ))}
            </ul>

            <Button variant="ghost" size="sm" icon={Plus} onClick={addMistake}>Add a mistake</Button>
          </section>
        )}

        {deckError && (
          <div role="alert" className="flex flex-col gap-2 rounded-2xl border border-danger/30 bg-danger-soft p-3.5 text-[13px] text-danger sm:flex-row sm:items-center">
            <span className="flex flex-1 items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {deckError}
            </span>
            <Button variant="secondary" size="sm" onClick={() => handleBuild(true)}>Build a simple deck without AI</Button>
          </div>
        )}

        {roast.isExam && (
          <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="ghost" icon={RotateCcw} onClick={reset}>Start over</Button>
            <Button variant="primary" icon={Sparkles} onClick={() => handleBuild(false)} disabled={chosen.length === 0}>
              {chosen.length === 0 ? 'Pick a mistake to fix' : `Build my deck from ${chosen.length} ${chosen.length === 1 ? 'mistake' : 'mistakes'}`}
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Upload
  return (
    <div className="space-y-4 animate-fadeIn">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        className="hidden"
        onChange={e => void addFiles(Array.from(e.target.files || []))}
      />

      {pages.length === 0 ? (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault();
            void addFiles(Array.from(e.dataTransfer.files));
          }}
          disabled={isPreparing}
          className="flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line-strong bg-canvas px-6 py-10 text-center transition-colors hover:border-brand/60 cursor-pointer disabled:opacity-60"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand-text">
            {isPreparing ? <RefreshCw className="h-6 w-6 animate-spin" aria-hidden="true" /> : <Camera className="h-6 w-6" aria-hidden="true" />}
          </span>
          <span className="mt-3 text-[15px] font-medium text-ink">Snap or drop your marked exam</span>
          <span className="mt-1 max-w-md text-[13px] text-ink-subtle">
            Photos or a PDF, up to {MAX_EXAM_PAGES} pages. The AI finds where you lost marks, roasts the mistakes and builds a deck that fixes them.
          </span>
        </button>
      ) : (
        <div className="flex flex-wrap gap-2">
          {pages.map((page, i) => (
            <figure key={page.id} className="relative h-28 w-20 overflow-hidden rounded-lg border border-line bg-canvas">
              <img src={page.previewUrl} alt={`Page ${i + 1}: ${page.name}`} className="h-full w-full object-cover" />
              <figcaption className="absolute bottom-0 left-0 right-0 bg-black/55 px-1 py-0.5 text-center text-[11px] text-white">{i + 1}</figcaption>
              <IconButton
                icon={X}
                label={`Remove page ${i + 1}`}
                onClick={() => setPages(prev => prev.filter(p => p.id !== page.id))}
                className="absolute right-0.5 top-0.5 h-6 w-6 bg-black/55 text-white hover:bg-black/75 hover:text-white"
              />
            </figure>
          ))}
          {room > 0 && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isPreparing}
              className="flex h-28 w-20 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-line-strong text-[12px] text-ink-subtle transition-colors hover:border-brand/60 hover:text-ink cursor-pointer disabled:opacity-60"
            >
              {isPreparing ? <RefreshCw className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Plus className="h-5 w-5" aria-hidden="true" />}
              Add page
            </button>
          )}
        </div>
      )}

      <textarea
        rows={2}
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Anything the AI should know? e.g. “Physics, chapter 4. I lost marks on 2 and 5.”"
        aria-label="Note about the exam"
        className="w-full resize-y rounded-2xl border border-line-strong bg-canvas p-3.5 text-[14px] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink-subtle focus:border-brand focus:ring-4 focus:ring-brand/15"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="radiogroup" aria-label="Roast strength" className="inline-flex rounded-xl border border-line bg-canvas p-1">
          {(['gentle', 'spicy'] as RoastTone[]).map(option => {
            const disabled = option === 'spicy' && spicyLocked;
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={effectiveTone === option}
                disabled={disabled}
                title={disabled ? `Spicy roasts are for ages ${MIN_SPICY_AGE} and up.` : undefined}
                onClick={() => setTone(option)}
                className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${
                  effectiveTone === option ? 'bg-surface-hover text-ink shadow-sm' : 'text-ink-subtle hover:text-ink'
                }`}
              >
                {option === 'spicy' && <Flame className="h-3.5 w-3.5" aria-hidden="true" />}
                {option === 'gentle' ? 'Gentle' : 'Spicy'}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" icon={PenLine} onClick={startTyping}>Type mistakes instead</Button>
          <Button variant="primary" icon={Flame} onClick={handleRoast} disabled={pages.length === 0 || isPreparing || !aiReady}>
            Roast my exam
          </Button>
        </div>
      </div>

      {!aiReady && (
        <p className="flex items-start gap-2 rounded-xl border border-line bg-canvas p-3 text-[13px] text-ink-muted">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
          Reading a paper needs the AI: sign in, or add your Gemini API key in Settings. You can still type your mistakes in and get a deck.
        </p>
      )}

      <p className="flex items-start gap-2 text-[12px] text-ink-subtle">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Pages are sent to Google Gemini to be read and are not stored by Studify. Cover your name or student number first if you'd rather not share them.
      </p>

      {error && (
        <p role="alert" className="flex items-center gap-2 text-[13px] text-danger">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
};

interface MistakeCardProps {
  mistake: ExamMistake;
  included: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<ExamMistake>) => void;
  onRemove: () => void;
}

const MistakeCard: React.FC<MistakeCardProps> = ({ mistake: m, included, onToggle, onChange, onRemove }) => {
  const kind = MISTAKE_KINDS[m.kind];
  return (
    <li className={`rounded-2xl border bg-canvas p-4 transition-opacity ${included ? 'border-line' : 'border-line opacity-55'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink cursor-pointer">
          <input type="checkbox" checked={included} onChange={onToggle} aria-label={`Use question ${m.questionRef} in the deck`} className="h-4 w-4 accent-[var(--brand)]" />
          Q{m.questionRef}
        </label>
        <select
          value={m.kind}
          onChange={e => onChange({ kind: e.target.value as MistakeKind })}
          aria-label="Kind of mistake"
          title={kind.advice}
          className="rounded-md border border-line bg-surface px-1.5 py-0.5 text-[12px] text-ink-muted outline-none focus:border-brand cursor-pointer"
        >
          {(Object.keys(MISTAKE_KINDS) as MistakeKind[]).map(k => (
            <option key={k} value={k}>{MISTAKE_KINDS[k].label}</option>
          ))}
        </select>
        {m.pointsLost !== null && m.pointsLost > 0 && <Badge tone="danger">−{m.pointsLost}</Badge>}
        {m.readConfidence === 'low' && (
          <Badge tone="gold">
            <TriangleAlert className="h-3 w-3" aria-hidden="true" /> Check this: the AI wasn't sure
          </Badge>
        )}
        <IconButton icon={X} label={`Remove question ${m.questionRef}`} onClick={onRemove} className="ml-auto h-7 w-7" />
      </div>

      {m.roast && <p className="mt-2 text-[14px] italic text-ink">“{m.roast}”</p>}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="space-y-1 sm:col-span-2">
          <span className="text-[12px] font-medium text-ink-subtle">Question</span>
          <textarea rows={2} value={m.question} onChange={e => onChange({ question: e.target.value })} aria-label={`Question ${m.questionRef}`} className={`${inputClass} resize-y`} />
        </label>
        <label className="space-y-1">
          <span className="text-[12px] font-medium text-ink-subtle">Your answer</span>
          <input value={m.studentAnswer} onChange={e => onChange({ studentAnswer: e.target.value })} aria-label={`Your answer to question ${m.questionRef}`} className={inputClass} />
        </label>
        <label className="space-y-1">
          <span className="text-[12px] font-medium text-ink-subtle">Right answer</span>
          <input value={m.correctAnswer} onChange={e => onChange({ correctAnswer: e.target.value })} aria-label={`Right answer to question ${m.questionRef}`} className={inputClass} />
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className="text-[12px] font-medium text-ink-subtle">Why it was wrong</span>
          <textarea rows={2} value={m.whyWrong} onChange={e => onChange({ whyWrong: e.target.value })} aria-label={`Why question ${m.questionRef} was wrong`} className={`${inputClass} resize-y`} placeholder={kind.advice} />
        </label>
      </div>
    </li>
  );
};
