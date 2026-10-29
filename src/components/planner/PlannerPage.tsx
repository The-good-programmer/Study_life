import React, { useEffect, useMemo, useState } from 'react';
import { CalendarPlus, ChevronLeft, ChevronRight, Plus, ScanText } from 'lucide-react';
import type { PlannerItem, StudySession, SubjectFolder } from '../../types';
import { PlannerService, dayKey, daysBetween, relativeDay, type DayPlan } from '../../services/plannerService';
import { StorageService } from '../../services/storageService';
import { cn } from '../../utils/cn';
import { Badge, Button, Card, SectionHeader } from '../ui/primitives';
import { CalendarSyncDialog } from './CalendarSyncDialog';
import { ExamPlanRow } from './ExamPlanRow';
import { PlannerItemDialog } from './PlannerItemDialog';
import { SyllabusImportDialog } from './SyllabusImportDialog';
import { KIND_STYLES, formatDay, formatWhen } from './plannerUi';

export interface PlannerPageProps {
  onStartSession: (session: StudySession) => void;
  onOpenAuth?: () => void;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** The days shown for a month: whole weeks from the Monday on or before the 1st. */
const monthGrid = (year: number, month: number): Date[] => {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - ((first.getDay() + 6) % 7));
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks = Math.ceil((((first.getDay() + 6) % 7) + daysInMonth) / 7);
  return Array.from({ length: weeks * 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
};

const usePlanner = () => {
  const read = () => ({ items: PlannerService.getItems(), plan: PlannerService.today(), folders: StorageService.getFolders() });
  const [state, setState] = useState(read);
  useEffect(() => PlannerService.subscribe(() => setState(read())), []);
  return state;
};

const ItemRow: React.FC<{ item: PlannerItem; folders: SubjectFolder[]; onEdit: () => void; today: string }> = ({ item, folders, onEdit, today }) => {
  const style = KIND_STYLES[item.kind];
  const Icon = style.icon;
  const subject = folders.find(f => f.id === item.folderId);
  const days = daysBetween(today, item.date);
  const checkable = item.kind !== 'exam';
  return (
    <li className={cn('flex items-center gap-3 rounded-xl border border-line bg-canvas px-3 py-2.5', item.done && 'opacity-60')}>
      {checkable ? (
        <input
          type="checkbox"
          checked={Boolean(item.done)}
          onChange={e => PlannerService.update(item.id, { done: e.target.checked })}
          aria-label={item.done ? `Mark ${item.title} as not done` : `Mark ${item.title} as done`}
          className="h-4 w-4 shrink-0 accent-[var(--brand)] cursor-pointer"
        />
      ) : (
        <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-md', style.tile)} aria-hidden="true">
          <Icon className="h-3.5 w-3.5" />
        </span>
      )}
      <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left cursor-pointer">
        <span className={cn('block truncate text-[13px] font-medium text-ink', item.done && 'line-through')}>{item.title}</span>
        <span className="block truncate text-xs text-ink-subtle">
          {formatWhen(item)}
          {subject && ` · ${subject.name}`}
        </span>
      </button>
      {!item.done && days < 0 && <Badge tone="danger">Overdue</Badge>}
      {!item.done && days >= 0 && days <= 2 && <Badge tone="due">{relativeDay(days)}</Badge>}
    </li>
  );
};

/** Exams, homework and other dates on a month calendar, with each exam's plan worked back from its date. */
export const PlannerPage: React.FC<PlannerPageProps> = ({ onStartSession, onOpenAuth }) => {
  const { items, plan, folders } = usePlanner();
  // The day the page opened on; a page left open past midnight keeps it until it is opened again.
  const [today] = useState(() => dayKey(new Date()));
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selected, setSelected] = useState(today);
  const [editing, setEditing] = useState<PlannerItem | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [isSyllabusOpen, setIsSyllabusOpen] = useState(false);
  const [isSyncOpen, setIsSyncOpen] = useState(false);

  const byDay = useMemo(() => {
    const map = new Map<string, PlannerItem[]>();
    for (const item of items) map.set(item.date, [...(map.get(item.date) ?? []), item]);
    for (const list of map.values()) list.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
    return map;
  }, [items]);

  const days = monthGrid(month.year, month.month);
  const monthName = new Date(month.year, month.month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const shiftMonth = (by: number) => setMonth(m => {
    const d = new Date(m.year, m.month + by, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const goToday = () => {
    const now = new Date();
    setMonth({ year: now.getFullYear(), month: now.getMonth() });
    setSelected(today);
  };

  const selectedItems = byDay.get(selected) ?? [];
  const isEmpty = items.length === 0;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 animate-fadeIn">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[26px] font-semibold tracking-tight text-ink sm:text-[30px]">Planner</h1>
          <p className="mt-1 text-[15px] text-ink-muted">Your exams and deadlines, and what to study for them each day.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button icon={ScanText} onClick={() => setIsSyllabusOpen(true)}>
            Read a syllabus
          </Button>
          <Button icon={CalendarPlus} onClick={() => setIsSyncOpen(true)}>
            Add to calendar
          </Button>
          <Button variant="primary" icon={Plus} onClick={() => setAdding(selected >= today ? selected : today)}>
            Add
          </Button>
        </div>
      </header>

      {isEmpty && (
        <Card className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold text-ink">Start with your syllabus</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
              Paste it or take a photo, and Studify lists your exams and deadlines for you to check. For each exam it then plans what to learn each
              day, so you finish a couple of days early and spend the rest on review.
            </p>
          </div>
          <Button variant="primary" icon={ScanText} onClick={() => setIsSyllabusOpen(true)}>
            Read a syllabus
          </Button>
        </Card>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Month */}
        <Card padded={false} className="overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <h2 className="text-[15px] font-semibold text-ink" aria-live="polite">
              {monthName}
            </h2>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={goToday}>
                Today
              </Button>
              <Button size="sm" variant="ghost" icon={ChevronLeft} onClick={() => shiftMonth(-1)} aria-label="Previous month" className="w-8 px-0" />
              <Button size="sm" variant="ghost" icon={ChevronRight} onClick={() => shiftMonth(1)} aria-label="Next month" className="w-8 px-0" />
            </div>
          </div>
          <div className="grid grid-cols-7 border-b border-line text-center text-[11px] font-medium uppercase tracking-wide text-ink-subtle">
            {WEEKDAYS.map(day => (
              <div key={day} className="py-2">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map(date => {
              const key = dayKey(date);
              const inMonth = date.getMonth() === month.month;
              const dayItems = byDay.get(key) ?? [];
              const isToday = key === today;
              const isSelected = key === selected;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelected(key)}
                  onDoubleClick={() => setAdding(key)}
                  aria-pressed={isSelected}
                  aria-label={`${formatDay(key)}${dayItems.length ? `, ${dayItems.length} ${dayItems.length === 1 ? 'item' : 'items'}` : ''}`}
                  className={cn(
                    'flex min-h-[60px] flex-col items-stretch gap-1 border-b border-r border-line p-1.5 text-left transition-colors cursor-pointer sm:min-h-[84px] [&:nth-child(7n)]:border-r-0',
                    inMonth ? 'bg-transparent' : 'bg-canvas/60',
                    isSelected ? 'bg-brand-soft/60' : 'hover:bg-surface-hover',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-6 w-6 items-center justify-center self-start rounded-full text-xs tabular-nums',
                      isToday ? 'bg-brand font-semibold text-brand-ink' : inMonth ? 'text-ink' : 'text-ink-subtle',
                    )}
                  >
                    {date.getDate()}
                  </span>
                  {/* Dots on phones, names from the small breakpoint up. */}
                  <span className="flex flex-wrap gap-1 sm:hidden" aria-hidden="true">
                    {dayItems.slice(0, 4).map(item => (
                      <span key={item.id} className={cn('h-1.5 w-1.5 rounded-full', KIND_STYLES[item.kind].dot, item.done && 'opacity-40')} />
                    ))}
                  </span>
                  <span className="hidden min-w-0 flex-col gap-0.5 sm:flex" aria-hidden="true">
                    {dayItems.slice(0, 2).map(item => (
                      <span key={item.id} className={cn('flex min-w-0 items-center gap-1 text-[11px] leading-tight text-ink-muted', item.done && 'line-through opacity-50')}>
                        <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', KIND_STYLES[item.kind].dot)} />
                        <span className="truncate">{item.title}</span>
                      </span>
                    ))}
                    {dayItems.length > 2 && <span className="text-[11px] text-ink-subtle">+{dayItems.length - 2} more</span>}
                  </span>
                </button>
              );
            })}
          </div>

          {/* The selected day */}
          <div className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[14px] font-semibold text-ink">
                {formatDay(selected)}
                <span className="ml-2 text-xs font-normal text-ink-subtle">{relativeDay(daysBetween(today, selected))}</span>
              </h3>
              <Button size="sm" variant="ghost" icon={Plus} onClick={() => setAdding(selected)}>
                Add on this day
              </Button>
            </div>
            {selectedItems.length === 0 ? (
              <p className="text-[13px] text-ink-subtle">Nothing on this day.</p>
            ) : (
              <ul className="space-y-2">
                {selectedItems.map(item => (
                  <ItemRow key={item.id} item={item} folders={folders} onEdit={() => setEditing(item)} today={today} />
                ))}
              </ul>
            )}
          </div>
        </Card>

        {/* Plans */}
        <div className="space-y-6">
          <PlanColumn plan={plan} folders={folders} today={today} onStartSession={onStartSession} onEdit={setEditing} />
        </div>
      </div>

      <PlannerItemDialog
        isOpen={Boolean(editing) || adding !== null}
        onClose={() => {
          setEditing(null);
          setAdding(null);
        }}
        folders={folders}
        item={editing}
        initialDate={adding ?? undefined}
      />
      <SyllabusImportDialog isOpen={isSyllabusOpen} onClose={() => setIsSyllabusOpen(false)} folders={folders} />
      <CalendarSyncDialog isOpen={isSyncOpen} onClose={() => setIsSyncOpen(false)} onOpenAuth={onOpenAuth} />
    </div>
  );
};

const PlanColumn: React.FC<{
  plan: DayPlan;
  folders: SubjectFolder[];
  today: string;
  onStartSession: (session: StudySession) => void;
  onEdit: (item: PlannerItem) => void;
}> = ({ plan, folders, today, onStartSession, onEdit }) => (
  <>
    <section className="space-y-3">
      <SectionHeader title="Exam plans" description="Each plan finishes the new cards two days early and keeps the rest for review." />
      {plan.exams.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-5 text-center text-[13px] text-ink-subtle">No exams coming up.</p>
      ) : (
        <div className="space-y-2">
          {plan.exams.map(examPlan => (
            <ExamPlanRow
              key={examPlan.exam.id}
              plan={examPlan}
              folders={folders}
              onStart={deck => onStartSession(StorageService.deckWithLatestProgress(deck))}
              onEdit={() => onEdit(examPlan.exam)}
            />
          ))}
        </div>
      )}
    </section>

    {plan.overdue.length > 0 && (
      <section className="space-y-3">
        <SectionHeader title="Overdue" />
        <ul className="space-y-2">
          {plan.overdue.map(item => (
            <ItemRow key={item.id} item={item} folders={folders} onEdit={() => onEdit(item)} today={today} />
          ))}
        </ul>
      </section>
    )}

    <section className="space-y-3">
      <SectionHeader title="Due this week" />
      {plan.dueSoon.length === 0 ? (
        <p className="text-[13px] text-ink-subtle">Nothing due in the next seven days.</p>
      ) : (
        <ul className="space-y-2">
          {plan.dueSoon.map(item => (
            <ItemRow key={item.id} item={item} folders={folders} onEdit={() => onEdit(item)} today={today} />
          ))}
        </ul>
      )}
    </section>
  </>
);

export default PlannerPage;
