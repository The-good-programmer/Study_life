import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';
import { IconButton } from '../ui/primitives';

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  titleId?: string;
  ariaLabel?: string;
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
}

/**
 * Accessible modal: Escape and backdrop click close it, Tab stays inside, and focus
 * returns to where it was. Put `data-autofocus` on the element that should get focus
 * first; otherwise the first focusable element does.
 */
export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  titleId,
  ariaLabel,
  children,
  className = '',
  containerClassName = '',
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Read through a ref so a new onClose each render does not re-run the effect below,
  // which would restore focus and then steal it again on every keystroke.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!isOpen) return;

    previousActiveElement.current = document.activeElement as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE);
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    const timer = setTimeout(() => {
      const root = dialogRef.current;
      if (!root || root.contains(document.activeElement)) return;
      const target = root.querySelector<HTMLElement>('[data-autofocus]') ?? root.querySelector<HTMLElement>(FOCUSABLE);
      (target ?? root).focus();
    }, 50);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
      if (previousActiveElement.current && typeof previousActiveElement.current.focus === 'function') {
        previousActiveElement.current.focus();
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm animate-fadeIn sm:p-6',
        containerClassName,
      )}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-label={!titleId ? (ariaLabel || 'Dialog') : undefined}
        tabIndex={-1}
        className={cn('relative flex max-h-[92dvh] w-full flex-col focus:outline-none', className)}
      >
        {children}
      </div>
    </div>
  );
};

/** The visible card of a dialog. Pair it with a scrolling body: `min-h-0 flex-1 overflow-y-auto`. */
export const DialogPanel: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...rest }) => (
  <div
    className={cn(
      'flex min-h-0 w-full flex-col overflow-hidden rounded-[22px] border border-line-strong bg-surface-solid text-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.05),0_32px_80px_-28px_rgb(0_0_0/0.8)] animate-rise',
      className,
    )}
    {...rest}
  >
    {children}
  </div>
);

interface DialogHeaderProps {
  title: React.ReactNode;
  titleId?: string;
  description?: React.ReactNode;
  onClose?: () => void;
  closeLabel?: string;
  /** Shown before the title, e.g. a back button or an icon tile. */
  leading?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

/** Title row with an optional description and close button; children render underneath. */
export const DialogHeader: React.FC<DialogHeaderProps> = ({
  title,
  titleId,
  description,
  onClose,
  closeLabel = 'Close',
  leading,
  className,
  children,
}) => (
  <div className={cn('shrink-0 border-b border-line px-5 pb-4 pt-5 sm:px-6', className)}>
    <div className="flex items-start gap-3">
      {leading}
      <div className="min-w-0 flex-1">
        <h2 id={titleId} className="text-[17px] font-semibold leading-snug text-ink">
          {title}
        </h2>
        {description && <p className="mt-1 text-[13px] leading-relaxed text-ink-subtle">{description}</p>}
      </div>
      {onClose && <IconButton icon={X} label={closeLabel} onClick={onClose} className="-mr-2 -mt-1.5 shrink-0" />}
    </div>
    {children}
  </div>
);

/** Action row pinned to the bottom of a dialog. */
export const DialogFooter: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => (
  <div className={cn('flex shrink-0 items-center gap-2 border-t border-line bg-canvas-raised px-5 py-3.5 sm:px-6', className)}>
    {children}
  </div>
);
