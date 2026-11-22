import React, { useId, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { TimetableLesson } from '../../types';
import { StorageService } from '../../services/storageService';
import { TimetableService, WEEKDAY_SHORT, cleanLesson, type LessonDraft } from '../../services/timetableService';
import { cn } from '../../utils/cn';
import { Dialog, DialogFooter, DialogHeader, DialogPanel } from '../common/Dialog';
import { Button } from '../ui/primitives';
import { INPUT_CLASS } from '../planner/plannerUi';

const addMinutes = (time: string, minutes: number): string => {
  const [h, m] = time.split(':').map(Number);
  const total = Math.min(23 * 60 + 59, h * 60 + m + minutes);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

/**
 * Adds or edits a lesson. "Save and add another" keeps the day and starts the next lesson where this
 * one ended, so a whole week goes in quickly.
 */
export const LessonDialog: React.FC<{
  lesson?: TimetableLesson | null;
  weekday?: number;
  onClose: () => void;
}> = ({ lesson, weekday = 1, onClose }) => {
  const fieldId = useId();
  const folders = useMemo(() => StorageService.getFolders(), []);
  const knownSubjects = useMemo(
    () => [...new Set([...folders.map(f => f.name), ...TimetableService.getLessons().map(l => l.subject)])].sort(),
    [folders],
  );
  const [subject, setSubject] = useState(lesson?.subject ?? '');
  const [day, setDay] = useState(lesson?.weekday ?? weekday);
  const [start, setStart] = useState(lesson?.start ?? '09:00');
  const [end, setEnd] = useState(lesson?.end ?? '09:45');
  const [room, setRoom] = useState(lesson?.room ?? '');
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(0);

  const draft = (): LessonDraft => {
    const folder = folders.find(f => f.name.trim().toLowerCase() === subject.trim().toLowerCase());
    return { subject, weekday: day, start, end, room, folderId: folder?.id ?? lesson?.folderId };
  };

  const save = (another: boolean) => {
    const cleaned = cleanLesson(draft());
    if ('error' in cleaned) {
      setError(cleaned.error);
      return;
    }
    if (lesson) TimetableService.update(lesson.id, cleaned.lesson);
    else TimetableService.add(cleaned.lesson);
    if (!another) {
      onClose();
      return;
    }
    // Next lesson: same day, starting when this one ended, as long as this one was.
    const length = Math.max(15, (Number(end.slice(0, 2)) * 60 + Number(end.slice(3))) - (Number(start.slice(0, 2)) * 60 + Number(start.slice(3))));
    setStart(end);
    setEnd(addMinutes(end, length));
    setSubject('');
    setRoom('');
    setError(null);
    setAdded(n => n + 1);
  };

  const remove = () => {
    if (!lesson) return;
    TimetableService.remove(lesson.id);
    onClose();
  };

  return (
    <Dialog isOpen onClose={onClose} titleId={`${fieldId}-title`} className="max-w-md">
      <DialogPanel>
        <DialogHeader
          titleId={`${fieldId}-title`}
          title={lesson ? 'Edit lesson' : 'Add a lesson'}
          description={added > 0 ? `${added} added. Next one:` : 'It repeats every week.'}
          onClose={onClose}
        />
        <form
          className="space-y-4 px-5 py-5 sm:px-6"
          onSubmit={e => {
            e.preventDefault();
            save(false);
          }}
        >
          <div>
            <label htmlFor={`${fieldId}-subject`} className="text-[13px] font-medium text-ink">
              Subject
            </label>
            <input
              id={`${fieldId}-subject`}
              data-autofocus
              value={subject}
              onChange={e => setSubject(e.target.value)}
              list={`${fieldId}-subjects`}
              maxLength={60}
              placeholder="e.g. Biology"
              className={cn(INPUT_CLASS, 'mt-1.5')}
            />
            <datalist id={`${fieldId}-subjects`}>
              {knownSubjects.map(name => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>

          <div>
            <span className="text-[13px] font-medium text-ink">Day</span>
            <div role="radiogroup" aria-label="Day" className="mt-1.5 grid grid-cols-7 gap-1 rounded-xl border border-line bg-canvas p-1">
              {WEEKDAY_SHORT.map((name, i) => (
                <button
                  key={name}
                  type="button"
                  role="radio"
                  aria-checked={day === i + 1}
                  onClick={() => setDay(i + 1)}
                  className={cn(
                    'h-8 rounded-lg text-xs font-medium transition-colors cursor-pointer',
                    day === i + 1 ? 'bg-brand text-brand-ink' : 'text-ink-muted hover:text-ink',
                  )}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[13px] font-medium text-ink">Starts</span>
              <input type="time" value={start} onChange={e => setStart(e.target.value)} className={cn(INPUT_CLASS, 'mt-1.5')} />
            </label>
            <label className="block">
              <span className="text-[13px] font-medium text-ink">Ends</span>
              <input type="time" value={end} onChange={e => setEnd(e.target.value)} className={cn(INPUT_CLASS, 'mt-1.5')} />
            </label>
          </div>

          <label className="block">
            <span className="text-[13px] font-medium text-ink">
              Room <span className="font-normal text-ink-subtle">(optional)</span>
            </span>
            <input value={room} onChange={e => setRoom(e.target.value)} maxLength={40} placeholder="e.g. Lab 2" className={cn(INPUT_CLASS, 'mt-1.5')} />
          </label>

          {error && (
            <p role="alert" className="text-[13px] text-danger">
              {error}
            </p>
          )}
          <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
        </form>
        <DialogFooter className="flex-wrap justify-between">
          {lesson ? (
            <Button variant="ghost" icon={Trash2} onClick={remove}>
              Delete
            </Button>
          ) : (
            <Button variant="ghost" icon={Plus} onClick={() => save(true)}>
              Save and add another
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              {added > 0 ? 'Done' : 'Cancel'}
            </Button>
            <Button variant="primary" onClick={() => save(false)}>
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogPanel>
    </Dialog>
  );
};
