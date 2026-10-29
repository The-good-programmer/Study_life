import React, { useId, useRef, useState } from 'react';
import { FileUp, Loader2, ScanText, Sparkles } from 'lucide-react';
import type { SubjectFolder } from '../../types';
import { AIService } from '../../services/aiService';
import { PlannerService, KIND_LABELS } from '../../services/plannerService';
import { readSyllabus, type SyllabusItem, type SyllabusSource } from '../../services/syllabusService';
import { StorageService } from '../../services/storageService';
import { soundEngine } from '../../services/soundEngine';
import { cn } from '../../utils/cn';
import { Dialog, DialogFooter, DialogHeader, DialogPanel } from '../common/Dialog';
import { Badge, Button } from '../ui/primitives';
import { INPUT_CLASS, KIND_STYLES } from './plannerUi';

export interface SyllabusImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  folders: SubjectFolder[];
  /** Called with how many items were added. */
  onAdded?: (count: number) => void;
}

/** Photos are scaled to this many pixels on the long side: enough to read, and under the AI's 4 MB limit. */
const MAX_PHOTO_SIDE = 2000;

/** A photo as a JPEG for the AI, whatever it was taken as (HEIC on iPhones, say). */
async function photoForAi(file: File): Promise<{ mimeType: string; data: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_PHOTO_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return { mimeType: 'image/jpeg', data: canvas.toDataURL('image/jpeg', 0.85).split(',')[1] };
}

/** A new subject to make when the items are added, named as the syllabus names it. */
const NEW_SUBJECT = 'new:';

type Row = SyllabusItem & { key: number; selected: boolean };

/** Reads the exams and deadlines in a syllabus (pasted, a PDF or a photo) for the student to check and add. */
export const SyllabusImportDialog: React.FC<SyllabusImportDialogProps> = ({ isOpen, onClose, folders, onAdded }) => {
  const fieldId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [folderId, setFolderId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);

  const [wasOpen, setWasOpen] = useState(isOpen);
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setText('');
      setFile(null);
      setFolderId('');
      setBusy(false);
      setError(null);
      setRows(null);
    }
  }

  if (!isOpen) return null;

  const titleId = `${fieldId}-title`;
  const canRead = Boolean(file || text.trim());

  const read = async () => {
    if (!AIService.isAvailable()) {
      setError('Reading a syllabus needs the AI: sign in, or add your own Gemini API key in Settings.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let source: SyllabusSource;
      if (file && file.type.startsWith('image/')) {
        source = { image: await photoForAi(file) };
      } else if (file && (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))) {
        const { PDFService } = await import('../../services/pdfService');
        source = { text: (await PDFService.extractTextFromPDF(file)).text };
      } else if (file) {
        source = { text: await file.text() };
      } else {
        source = { text };
      }
      if ('text' in source && !source.text.trim()) {
        throw new Error('There is no text in that file. If it is a scan, take a photo of it instead.');
      }
      const found = await readSyllabus(source, { folders, folderId: folderId || undefined });
      setRows(
        found.map((item, key) => ({
          ...item,
          folderId: item.folderId ?? (item.subjectName ? `${NEW_SUBJECT}${item.subjectName}` : undefined),
          key,
          selected: true,
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const update = (key: number, changes: Partial<Row>) => setRows(prev => prev?.map(row => (row.key === key ? { ...row, ...changes } : row)) ?? null);

  const chosen = rows?.filter(row => row.selected) ?? [];

  const add = () => {
    // Subjects the syllabus named that the student doesn't have yet, made once each.
    const made = new Map<string, string>();
    const drafts = chosen.map(({ key: _key, selected: _selected, subjectName: _name, ...row }) => {
      let id = row.folderId;
      if (id?.startsWith(NEW_SUBJECT)) {
        const name = id.slice(NEW_SUBJECT.length);
        if (!made.has(name)) made.set(name, StorageService.createFolder(name).id);
        id = made.get(name);
      }
      return { ...row, folderId: id };
    });
    const added = PlannerService.addMany(drafts);
    soundEngine.playSuccess();
    onAdded?.(added.length);
    onClose();
  };

  // Subject choices for a row: the student's subjects, plus the one the syllabus named if it is new.
  const subjectOptions = (row: Row) => (
    <>
      <option value="">No subject</option>
      {row.folderId?.startsWith(NEW_SUBJECT) && <option value={row.folderId}>New subject: {row.folderId.slice(NEW_SUBJECT.length)}</option>}
      {folders.map(folder => (
        <option key={folder.id} value={folder.id}>
          {folder.name}
        </option>
      ))}
    </>
  );

  return (
    <Dialog isOpen={isOpen} onClose={onClose} titleId={titleId} className="max-w-xl">
      <DialogPanel className="max-h-[90dvh]">
        <DialogHeader
          titleId={titleId}
          title={rows ? 'Check what was found' : 'Read a syllabus'}
          description={
            rows
              ? 'Untick anything that is wrong, and fix dates or subjects before adding.'
              : 'Paste your syllabus or course schedule, or pick a PDF or a photo of it. The AI lists the exams and deadlines for you to check.'
          }
          onClose={onClose}
        />

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          {!rows && (
            <>
              <div>
                <label htmlFor={`${fieldId}-text`} className="text-[13px] font-medium text-ink">
                  Syllabus text
                </label>
                <textarea
                  id={`${fieldId}-text`}
                  data-autofocus
                  value={text}
                  onChange={e => {
                    setText(e.target.value);
                    setFile(null);
                  }}
                  rows={7}
                  placeholder={'e.g.\nWeek 6 - Midterm exam (Ch. 1-5), Thursday Nov 12\nProblem set 4 due Nov 19, 11:59pm'}
                  className={cn(INPUT_CLASS, 'mt-1.5 h-auto py-2.5 leading-relaxed')}
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf,image/*,.txt,.md"
                  className="sr-only"
                  aria-label="Syllabus file or photo"
                  onChange={e => {
                    const picked = e.target.files?.[0] ?? null;
                    setFile(picked);
                    if (picked) setText('');
                    e.target.value = '';
                  }}
                />
                <Button icon={FileUp} onClick={() => fileRef.current?.click()}>
                  Pick a PDF or photo
                </Button>
                {file && <span className="min-w-0 truncate text-[13px] text-ink-muted">{file.name}</span>}
              </div>

              <div>
                <label htmlFor={`${fieldId}-subject`} className="flex items-baseline justify-between text-[13px] font-medium text-ink">
                  Subject
                  <span className="text-xs font-normal text-ink-subtle">Optional</span>
                </label>
                <select id={`${fieldId}-subject`} value={folderId} onChange={e => setFolderId(e.target.value)} className={cn(INPUT_CLASS, 'mt-1.5')}>
                  <option value="">Work it out from the syllabus</option>
                  {folders.map(folder => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {rows && rows.length === 0 && (
            <p className="rounded-xl border border-line bg-canvas px-4 py-6 text-center text-[13px] text-ink-muted">
              No dated exams or deadlines were found. If the dates are in a table or a scan, try a photo of that page.
            </p>
          )}

          {rows && rows.length > 0 && (
            <ul className="space-y-2">
              {rows.map(row => {
                const style = KIND_STYLES[row.kind];
                const Icon = style.icon;
                return (
                  <li key={row.key} className={cn('rounded-xl border border-line bg-canvas p-3 transition-opacity', !row.selected && 'opacity-50')}>
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={row.selected}
                        onChange={e => update(row.key, { selected: e.target.checked })}
                        aria-label={`Add ${row.title}`}
                        className="mt-1 h-4 w-4 shrink-0 accent-[var(--brand)] cursor-pointer"
                      />
                      <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', style.tile)} aria-hidden="true">
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[13px] font-medium text-ink">{row.title}</p>
                          <Badge>{KIND_LABELS[row.kind]}</Badge>
                        </div>
                        {row.topics && <p className="text-xs text-ink-subtle">{row.topics.join(', ')}</p>}
                        <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
                          <input
                            type="date"
                            value={row.date}
                            onChange={e => update(row.key, { date: e.target.value })}
                            aria-label={`Date of ${row.title}`}
                            className={cn(INPUT_CLASS, 'h-8 text-xs')}
                          />
                          <select
                            value={row.folderId ?? ''}
                            onChange={e => update(row.key, { folderId: e.target.value || undefined })}
                            aria-label={`Subject of ${row.title}`}
                            className={cn(INPUT_CLASS, 'h-8 text-xs')}
                          >
                            {subjectOptions(row)}
                          </select>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {error && (
            <p className="text-xs font-medium text-danger" role="alert">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          {rows ? (
            <>
              <Button variant="ghost" onClick={() => setRows(null)} className="-ml-2">
                Back
              </Button>
              <div className="flex-1" />
              <Button variant="primary" onClick={add} disabled={chosen.length === 0}>
                Add {chosen.length} {chosen.length === 1 ? 'item' : 'items'}
              </Button>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1.5 text-xs text-ink-subtle">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                You check everything before it is added
              </span>
              <div className="flex-1" />
              <Button variant="primary" icon={busy ? Loader2 : ScanText} onClick={read} disabled={!canRead || busy} className={busy ? '[&>svg]:animate-spin' : undefined}>
                {busy ? 'Reading…' : 'Read syllabus'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogPanel>
    </Dialog>
  );
};
