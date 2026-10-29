import React, { useId, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { PlannerItem, PlannerItemKind, SubjectFolder } from '../../types';
import { KIND_LABELS, PlannerService, cleanDraft } from '../../services/plannerService';
import { soundEngine } from '../../services/soundEngine';
import { cn } from '../../utils/cn';
import { Dialog, DialogFooter, DialogHeader, DialogPanel } from '../common/Dialog';
import { Button } from '../ui/primitives';
import { INPUT_CLASS, KIND_STYLES } from './plannerUi';

export interface PlannerItemDialogProps {
  isOpen: boolean;
  onClose: () => void;
  folders: SubjectFolder[];
  /** The item to edit; without it the dialog adds a new one. */
  item?: PlannerItem | null;
  /** The day a new item starts on. */
  initialDate?: string;
}

const KINDS: PlannerItemKind[] = ['exam', 'homework', 'other'];

const PLACEHOLDERS: Record<PlannerItemKind, string> = {
  exam: 'e.g. Biology midterm',
  homework: 'e.g. Lab report 3',
  other: 'e.g. Study group',
};

/** Adds or edits one exam, piece of homework or other dated item. */
export const PlannerItemDialog: React.FC<PlannerItemDialogProps> = ({ isOpen, onClose, folders, item, initialDate }) => {
  const fieldId = useId();
  const [kind, setKind] = useState<PlannerItemKind>('exam');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [folderId, setFolderId] = useState('');
  const [topics, setTopics] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Fill the form each time it opens (adjusting state during render, rather than in an effect).
  const [formFor, setFormFor] = useState<{ isOpen: boolean; item?: PlannerItem | null }>({ isOpen: false });
  if (formFor.isOpen !== isOpen || formFor.item !== item) {
    setFormFor({ isOpen, item });
    if (isOpen) {
      setKind(item?.kind ?? 'exam');
      setTitle(item?.title ?? '');
      setDate(item?.date ?? initialDate ?? '');
      setTime(item?.time ?? '');
      setFolderId(item?.folderId ?? '');
      setTopics(item?.topics?.join(', ') ?? '');
      setNotes(item?.notes ?? '');
      setError(null);
    }
  }

  if (!isOpen) return null;

  const titleId = `${fieldId}-title`;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const draft = {
      kind,
      title,
      date,
      time: time || undefined,
      folderId: folderId || undefined,
      topics: topics.split(','),
      notes,
    };
    const cleaned = cleanDraft(draft);
    if ('error' in cleaned) {
      setError(cleaned.error);
      return;
    }
    if (item) PlannerService.update(item.id, cleaned.item);
    else PlannerService.add(cleaned.item);
    soundEngine.playSuccess();
    onClose();
  };

  const remove = () => {
    if (!item) return;
    PlannerService.remove(item.id);
    onClose();
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} titleId={titleId} className="max-w-md">
      <DialogPanel>
        <form onSubmit={save} className="flex min-h-0 flex-1 flex-col" noValidate>
          <DialogHeader titleId={titleId} title={item ? `Edit ${KIND_LABELS[kind].toLowerCase()}` : 'Add to planner'} onClose={onClose} />

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
            <div role="radiogroup" aria-label="Type" className="grid grid-cols-3 gap-1 rounded-xl border border-line-strong bg-canvas p-1">
              {KINDS.map(option => {
                const Icon = KIND_STYLES[option].icon;
                return (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={kind === option}
                    onClick={() => setKind(option)}
                    className={cn(
                      'flex h-8 items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer',
                      kind === option ? 'bg-surface-hover text-ink' : 'text-ink-muted hover:text-ink',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {KIND_LABELS[option]}
                  </button>
                );
              })}
            </div>

            <div>
              <label htmlFor={`${fieldId}-name`} className="text-[13px] font-medium text-ink">
                Name
              </label>
              <input
                id={`${fieldId}-name`}
                data-autofocus
                value={title}
                onChange={e => {
                  setTitle(e.target.value);
                  setError(null);
                }}
                placeholder={PLACEHOLDERS[kind]}
                maxLength={120}
                className={cn(INPUT_CLASS, 'mt-1.5')}
              />
            </div>

            <div className="grid grid-cols-[1fr_auto] gap-3">
              <div>
                <label htmlFor={`${fieldId}-date`} className="text-[13px] font-medium text-ink">
                  {kind === 'homework' ? 'Due' : 'Date'}
                </label>
                <input
                  id={`${fieldId}-date`}
                  type="date"
                  value={date}
                  onChange={e => {
                    setDate(e.target.value);
                    setError(null);
                  }}
                  className={cn(INPUT_CLASS, 'mt-1.5')}
                />
              </div>
              <div>
                <label htmlFor={`${fieldId}-time`} className="flex items-baseline justify-between gap-2 text-[13px] font-medium text-ink">
                  Time
                  <span className="text-xs font-normal text-ink-subtle">Optional</span>
                </label>
                <input id={`${fieldId}-time`} type="time" value={time} onChange={e => setTime(e.target.value)} className={cn(INPUT_CLASS, 'mt-1.5 w-32')} />
              </div>
            </div>

            <div>
              <label htmlFor={`${fieldId}-subject`} className="text-[13px] font-medium text-ink">
                Subject
              </label>
              <select id={`${fieldId}-subject`} value={folderId} onChange={e => setFolderId(e.target.value)} className={cn(INPUT_CLASS, 'mt-1.5')}>
                <option value="">No subject</option>
                {folders.map(folder => (
                  <option key={folder.id} value={folder.id}>
                    {folder.icon ? `${folder.icon} ` : ''}
                    {folder.name}
                  </option>
                ))}
              </select>
              {kind === 'exam' && (
                <p className="mt-1.5 text-xs leading-relaxed text-ink-subtle">
                  {folders.length === 0
                    ? 'Make a subject and put your decks in it, and the plan works out what to study each day.'
                    : 'The plan studies the decks in this subject.'}
                </p>
              )}
            </div>

            <div>
              <label htmlFor={`${fieldId}-topics`} className="flex items-baseline justify-between text-[13px] font-medium text-ink">
                What it covers
                <span className="text-xs font-normal text-ink-subtle">Optional, separate with commas</span>
              </label>
              <input
                id={`${fieldId}-topics`}
                value={topics}
                onChange={e => setTopics(e.target.value)}
                placeholder="e.g. Chapters 1-4, cell transport"
                className={cn(INPUT_CLASS, 'mt-1.5')}
              />
            </div>

            <div>
              <label htmlFor={`${fieldId}-notes`} className="flex items-baseline justify-between text-[13px] font-medium text-ink">
                Notes
                <span className="text-xs font-normal text-ink-subtle">Optional</span>
              </label>
              <textarea
                id={`${fieldId}-notes`}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                maxLength={1000}
                className={cn(INPUT_CLASS, 'mt-1.5 h-auto py-2.5')}
              />
            </div>

            {error && (
              <p className="text-xs font-medium text-danger" role="alert">
                {error}
              </p>
            )}
          </div>

          <DialogFooter>
            {item && (
              <Button variant="ghost" icon={Trash2} onClick={remove} className="-ml-2 text-danger hover:text-danger">
                Delete
              </Button>
            )}
            <div className="flex-1" />
            <Button onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary">
              {item ? 'Save' : 'Add'}
            </Button>
          </DialogFooter>
        </form>
      </DialogPanel>
    </Dialog>
  );
};
