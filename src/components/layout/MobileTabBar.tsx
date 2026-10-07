import React from 'react';
import { Home, Layers, Award, LineChart, Building2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../utils/cn';

type View = 'home' | 'dashboard' | 'exam' | 'interleave' | 'sanctuary' | 'studio' | 'folders';

interface MobileTabBarProps {
  activeView: View;
  onNavigate: (view: View) => void;
  dueCardsCount: number;
}

const TABS: { view: View; label: string; icon: LucideIcon }[] = [
  { view: 'home', label: 'Today', icon: Home },
  { view: 'studio', label: 'Library', icon: Layers },
  { view: 'exam', label: 'Exam', icon: Award },
  { view: 'dashboard', label: 'Insights', icon: LineChart },
  { view: 'sanctuary', label: 'Campus', icon: Building2 },
];

/** Bottom tab bar for phones; the sidebar takes over from the md breakpoint. */
export const MobileTabBar: React.FC<MobileTabBarProps> = ({ activeView, onNavigate, dueCardsCount }) => (
  <nav
    aria-label="Primary"
    className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-canvas-raised/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
  >
    <div className="mx-auto grid max-w-md grid-cols-5">
      {TABS.map(({ view, label, icon: Icon }) => {
        const active = activeView === view || (view === 'studio' && activeView === 'folders');
        return (
          <button
            key={view}
            type="button"
            onClick={() => onNavigate(view)}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative flex h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors cursor-pointer',
              active ? 'text-brand-text' : 'text-ink-subtle hover:text-ink-muted',
            )}
          >
            <span className="relative">
              <Icon className="h-5 w-5" aria-hidden="true" />
              {view === 'home' && dueCardsCount > 0 && (
                <span className="absolute -right-2.5 -top-1.5 min-w-4 rounded-full bg-due px-1 text-center text-[10px] font-semibold leading-4 text-brand-ink tabular-nums">
                  {dueCardsCount > 99 ? '99+' : dueCardsCount}
                </span>
              )}
            </span>
            {label}
          </button>
        );
      })}
    </div>
  </nav>
);
