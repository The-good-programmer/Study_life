import React, { useEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface ActionMenuItem {
  label: string;
  icon?: LucideIcon;
  onSelect: (event: React.MouseEvent) => void;
  tone?: 'default' | 'danger';
}

interface ActionMenuProps {
  /** Accessible name for the trigger, e.g. "More actions for Biology". */
  label: string;
  items: ActionMenuItem[];
  className?: string;
}

/** A "more actions" overflow menu. Closes on selection, outside click or Escape. */
export const ActionMenu: React.FC<ActionMenuProps> = ({ label, items, className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    // Escape closes only the menu: preventDefault tells an enclosing Dialog to stay open.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointer);
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(open => !open);
        }}
        className={cn(
          'inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors cursor-pointer',
          isOpen ? 'bg-surface-hover text-ink' : 'text-ink-subtle hover:bg-surface-hover hover:text-ink',
        )}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </button>
      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 top-9 z-40 min-w-48 rounded-xl border border-line-strong bg-surface-solid p-1 shadow-2xl animate-fadeIn"
        >
          {items.map(({ label: itemLabel, icon: Icon, onSelect, tone }) => (
            <button
              key={itemLabel}
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
                onSelect(e);
              }}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors cursor-pointer',
                tone === 'danger' ? 'text-danger hover:bg-danger-soft' : 'text-ink-muted hover:bg-surface-hover hover:text-ink',
              )}
            >
              {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
              {itemLabel}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
