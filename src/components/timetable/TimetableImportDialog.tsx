import React, { useId, useRef, useState } from 'react';
import { Camera, Loader2, ScanText } from 'lucide-react';
import { AIService } from '../../services/aiService';
import { StorageService } from '../../services/storageService';
import { readTimetable, type TimetableSource } from '../../services/timetableImport';
import { TimetableService, WEEKDAY_SHORT, type LessonDraft } from '../../services/timetableService';
import { cn } from '../../utils/cn';
import { photoForAi } from '../../utils/photoForAi';
import { Dialog, DialogFooter, DialogHeader, DialogPanel } from '../common/Dialog';
import { Button } from '../ui/primitives';
import { INPUT_CLASS } from '../planner/plannerUi';

type Row = LessonDraft & { key: number; selected: boolean };

/**
 * Fills the timetable from a photo of it (or its text): the AI lists the lessons, the student ticks
 * the ones to add. Lessons already in the timetable are left out.
 */
export const TimetableImportDialog: React.FC<{ onClose: () => void; onOpenAuth?: () => void }> = ({ onClose, onOpenAuth }) => {
  const fieldId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const aiReady = !AIService.needsSignIn();

  const read = async () => {
    setBusy(true);
    setError(null);
    try {
      const source: TimetableSource = file ? { image: await photoForAi(file) } : { text };
      const found = await readTimetable(source, StorageService.getFolders(), TimetableService.getLessons());
      if (found.length === 0) throw new Error("No lessons could be read. Try a sharper photo, or type them in.");
      setRows(found.map((lesson, key) => ({ ...lesson, key, selected: true })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const chosen = rows?.filter(row => row.selected) ?? [];
  const add = () => {
    for (const { key: _key, selected: _selected, ...lesson } of chosen) TimetableService.add(lesson);
    onClose();
  };

  return (
    <Dialog isOpen onClose={busy ? () => {} : onClose} titleId={`${fieldId}-title`} className="max-w-lg">
      <DialogPanel className="max-h-[92dvh]">
        <DialogHeader
          titleId={`${fieldId}-title`}
          title={rows ? 'Check your lessons' : 'Add your timetable from a photo'}
          description={rows ? `${rows.length} found. Untick any that are wrong; you can edit them later.` : 'Take a photo of your printed or on-screen timetable, or paste it.'}
          onClose={busy ? undefined : onClose}
        />

        {!aiReady ? (
          <div className="space-y-3 px-5 py-5 sm:px-6">
            <p className="text-[14px] leading-relaxed text-ink-muted">Reading a timetable needs the AI: sign in (free), or add your own Gemini key in Settings → AI.</p>
            {onOpenAuth && (
              <Button variant="primary" onClick={onOpenAuth}>
                Sign in
              </Button>
            )}
          </div>
        ) : rows ? (
          <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto px-5 py-2 sm:px-6">
            {rows.map(row => (
              <li key={row.key}>
                <label className="flex cursor-pointer items-center gap-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={row.selected}
                    onChange={e => setRows(prev => prev?.map(r => (r.key === row.key ? { ...r, selected: e.target.checked } : r)) ?? null)}
                    className="h-4 w-4 shrink-0 accent-[var(--brand)]"
                  />
                  <span className="w-10 shrink-0 text-[13px] font-medium text-ink-subtle">{WEEKDAY_SHORT[row.weekday - 1]}</span>
                  <span className="w-[92px] shrink-0 text-[13px] tabular-nums text-ink-muted">
                    {row.start}–{row.end}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[14px] text-ink">
                    {row.subject}
                    {row.room && <span className="text-ink-subtle"> · {row.room}</span>}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <div className="space-y-4 px-5 py-5 sm:px-6">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={e => {
                setFile(e.target.files?.[0] ?? null);
                setError(null);
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-line-strong px-4 py-5 text-left transition-colors hover:border-brand cursor-pointer disabled:opacity-50"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-text" aria-hidden="true">
                <Camera className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-medium text-ink">{file ? file.name : 'Take or choose a photo'}</span>
                <span className="block text-xs text-ink-subtle">{file ? 'Tap to choose another' : 'The whole week, straight on and in focus.'}</span>
              </span>
            </button>
            {!file && (
              <label className="block">
                <span className="text-[13px] font-medium text-ink">Or paste it</span>
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  rows={4}
                  disabled={busy}
                  placeholder={'e.g. Monday 08:30–09:15 Biology (Lab 2), 09:20 Maths…'}
                  className={cn(INPUT_CLASS, 'mt-1.5 h-auto resize-none py-2.5')}
                />
              </label>
            )}
            {busy && (
              <p role="status" className="flex items-center gap-2 text-xs text-ink-subtle">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                Reading your timetable…
              </p>
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="px-5 pb-3 text-[13px] text-danger sm:px-6">
            {error}
          </p>
        )}

        {aiReady && (
          <DialogFooter className="justify-end">
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            {rows ? (
              <Button variant="primary" onClick={add} disabled={chosen.length === 0}>
                Add {chosen.length} {chosen.length === 1 ? 'lesson' : 'lessons'}
              </Button>
            ) : (
              <Button variant="primary" icon={ScanText} onClick={read} disabled={busy || (!file && !text.trim())}>
                Read it
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogPanel>
    </Dialog>
  );
};
