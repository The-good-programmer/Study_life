import React, { useEffect, useState } from 'react';
import { ArrowRight, CalendarDays } from 'lucide-react';
import type { StudySession } from '../../types';
import { PlannerService, daysBetween, dayKey, relativeDay } from '../../services/plannerService';
import { StorageService } from '../../services/storageService';
import { Badge, Button, Card } from '../ui/primitives';
import { ExamPlanRow } from './ExamPlanRow';

/** Exams this close show on Today; later ones are in the planner. */
const EXAM_HORIZON_DAYS = 21;
/** Homework due within this many days shows on Today. */
const HOMEWORK_HORIZON_DAYS = 3;

export interface UpcomingPlanCardProps {
  onStartSession: (session: StudySession) => void;
  onOpenPlanner: () => void;
}

/** Today's share of each coming exam, and homework due soon. Invites adding exams when there are none. */
export const UpcomingPlanCard: React.FC<UpcomingPlanCardProps> = ({ onStartSession, onOpenPlanner }) => {
  const read = () => ({ plan: PlannerService.today(), hasItems: PlannerService.getItems().length > 0, folders: StorageService.getFolders() });
  const [{ plan, hasItems, folders }, setState] = useState(read);
  useEffect(() => PlannerService.subscribe(() => setState(read())), []);

  // The day the page opened on; a page left open past midnight keeps it until it is opened again.
  const [today] = useState(() => dayKey(new Date()));
  const exams = plan.exams.filter(e => e.daysLeft <= EXAM_HORIZON_DAYS).slice(0, 2);
  const homework = plan.dueSoon.filter(item => daysBetween(today, item.date) <= HOMEWORK_HORIZON_DAYS);

  if (!hasItems) {
    return (
      <Card className="flex items-center gap-3.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-text" aria-hidden="true">
          <CalendarDays className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium text-ink">Exams coming up?</p>
          <p className="text-[13px] text-ink-subtle">Add them, or read your syllabus, and get a plan for each day.</p>
        </div>
        <Button size="sm" trailingIcon={ArrowRight} onClick={onOpenPlanner}>
          Planner
        </Button>
      </Card>
    );
  }

  if (exams.length === 0 && homework.length === 0 && plan.overdue.length === 0) return null;

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold text-ink">Coming up</h2>
        <Button variant="ghost" size="sm" trailingIcon={ArrowRight} onClick={onOpenPlanner}>
          Planner
        </Button>
      </div>
      {exams.length > 0 && (
        <div className="grid gap-2 md:grid-cols-2">
          {exams.map(examPlan => (
            <ExamPlanRow
              key={examPlan.exam.id}
              plan={examPlan}
              folders={folders}
              compact
              onStart={deck => onStartSession(StorageService.deckWithLatestProgress(deck))}
            />
          ))}
        </div>
      )}
      {(homework.length > 0 || plan.overdue.length > 0) && (
        <ul className="space-y-1.5">
          {plan.overdue.length > 0 && (
            <li className="flex items-center justify-between gap-3 text-[13px]">
              <button type="button" onClick={onOpenPlanner} className="min-w-0 truncate text-left text-ink-muted hover:text-ink cursor-pointer">
                {plan.overdue.length === 1 ? plan.overdue[0].title : `${plan.overdue.length} things`} past due and not ticked off
              </button>
              <Badge tone="danger">Overdue</Badge>
            </li>
          )}
          {homework.map(item => (
            <li key={item.id} className="flex items-center gap-3 text-[13px]">
              <input
                type="checkbox"
                checked={false}
                onChange={() => PlannerService.update(item.id, { done: true })}
                aria-label={`Mark ${item.title} as done`}
                className="h-4 w-4 shrink-0 accent-[var(--brand)] cursor-pointer"
              />
              <span className="min-w-0 flex-1 truncate text-ink">{item.title}</span>
              <Badge tone={daysBetween(today, item.date) <= 1 ? 'due' : 'neutral'}>Due {relativeDay(daysBetween(today, item.date))}</Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};
