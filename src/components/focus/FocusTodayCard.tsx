import React from 'react';
import type { FocusSummary } from '../../services/focusService';
import { Card, SectionHeader } from '../ui/primitives';

/** "45 min", "2 h", "2 h 05 min". */
const formatMinutes = (minutes: number): string => {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')} min`;
};

const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;

const Figure: React.FC<{ label: string; value: string; detail: string }> = ({ label, value, detail }) => (
  <div className="min-w-0 rounded-xl border border-line bg-canvas px-4 py-3">
    <p className="text-xs font-medium text-ink-subtle">{label}</p>
    <p className="mt-1 truncate text-xl font-semibold tracking-tight text-ink tabular-nums">{value}</p>
    <p className="mt-0.5 truncate text-xs text-ink-subtle">{detail}</p>
  </div>
);

/** Focus time from finished sessions (including ones finished early). */
export const FocusTodayCard: React.FC<{ summary: FocusSummary }> = ({ summary }) => (
  <Card className="space-y-4">
    <SectionHeader title="Focus time" description="Sessions you finish also count toward your daily goal and streak." />
    <div className="grid grid-cols-2 gap-3">
      <Figure label="Today" value={formatMinutes(summary.todayMinutes)} detail={plural(summary.todaySessions, 'session')} />
      <Figure label="Last 7 days" value={formatMinutes(summary.weekMinutes)} detail={plural(summary.weekSessions, 'session')} />
    </div>
  </Card>
);
