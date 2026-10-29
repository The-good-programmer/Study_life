import React from 'react';
import { Play } from 'lucide-react';
import type { StudySession, SubjectFolder } from '../../types';
import { relativeDay, type ExamPace, type ExamPlan } from '../../services/plannerService';
import { cn } from '../../utils/cn';
import { Badge, Button, ProgressBar } from '../ui/primitives';
import { KIND_STYLES, todayLine } from './plannerUi';

const PACE: Record<ExamPace, { label: string; tone: 'success' | 'gold' | 'danger' }> = {
  'on-track': { label: 'On track', tone: 'success' },
  tight: { label: 'Tight', tone: 'gold' },
  behind: { label: 'Behind', tone: 'danger' },
};

export interface ExamPlanRowProps {
  plan: ExamPlan;
  folders: SubjectFolder[];
  onStart?: (deck: StudySession) => void;
  onEdit?: () => void;
  compact?: boolean;
}

/** One exam with its countdown, today's share of the work and a button to start it. */
export const ExamPlanRow: React.FC<ExamPlanRowProps> = ({ plan, folders, onStart, onEdit, compact }) => {
  const subject = folders.find(f => f.id === plan.exam.folderId);
  const Icon = KIND_STYLES.exam.icon;
  const learned = plan.totalCards > 0 ? ((plan.totalCards - plan.newCards) / plan.totalCards) * 100 : 0;
  const canStart = !plan.coveredBy && plan.nextDeck && plan.phase !== 'no-decks' && (plan.newToday > 0 || plan.dueCards > 0);
  const pace = !plan.coveredBy && (plan.phase === 'learn' || (plan.phase === 'review' && plan.newCards > 0)) ? PACE[plan.pace] : null;

  return (
    <div className={cn('rounded-xl border border-line bg-canvas', compact ? 'p-3' : 'p-3.5')}>
      <div className="flex items-start gap-3">
        <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', KIND_STYLES.exam.tile)} aria-hidden="true">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              onClick={onEdit}
              disabled={!onEdit}
              className="min-w-0 text-left text-[14px] font-medium text-ink enabled:hover:underline enabled:cursor-pointer"
            >
              <span className="line-clamp-2">{plan.exam.title}</span>
            </button>
            <Badge tone={plan.daysLeft <= 3 ? 'danger' : 'neutral'}>{relativeDay(plan.daysLeft)}</Badge>
          </div>
          {subject && <p className="mt-0.5 truncate text-xs text-ink-subtle">{subject.name}</p>}
          <p className="mt-2 text-[13px] leading-snug text-ink-muted">{todayLine(plan, subject)}</p>
          {plan.totalCards > 0 && (
            <div className="mt-2.5 flex items-center gap-2.5">
              <ProgressBar value={learned} tone={plan.pace === 'behind' ? 'gold' : 'brand'} label={`${Math.round(learned)}% of cards learned`} className="flex-1" />
              <span className="shrink-0 text-xs tabular-nums text-ink-subtle">
                {plan.totalCards - plan.newCards}/{plan.totalCards}
              </span>
            </div>
          )}
          {(pace || (canStart && onStart)) && (
            <div className="mt-3 flex items-center justify-between gap-2">
              {pace ? <Badge tone={pace.tone}>{pace.label}</Badge> : <span />}
              {canStart && onStart && plan.nextDeck && (
                <Button size="sm" variant={compact ? 'secondary' : 'primary'} icon={Play} onClick={() => onStart(plan.nextDeck!)}>
                  Start
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
