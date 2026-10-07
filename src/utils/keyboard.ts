const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

type ShortcutTarget = Pick<HTMLElement, 'tagName' | 'isContentEditable' | 'closest'>;

interface ShortcutEvent {
  key: string;
  defaultPrevented: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  target: EventTarget | null;
}

interface ShortcutOptions {
  /** Leave Enter and Space to a focused button or link, which acts on them itself. Default true. */
  deferToFocusedControls?: boolean;
  /** Where to look for an open modal dialog. Defaults to `document`. */
  root?: Pick<Document, 'querySelector'>;
}

/**
 * Whether a page-level keyboard shortcut should stand down for this key press:
 * something already handled it, a modifier is held, the learner is typing, a modal
 * dialog is open over the page, or a focused button will handle Enter / Space itself
 * (otherwise one press would do two things, e.g. pick a term and leave the step).
 */
export const shouldIgnoreShortcut = (e: ShortcutEvent, options: ShortcutOptions = {}): boolean => {
  const { deferToFocusedControls = true, root = typeof document === 'undefined' ? undefined : document } = options;
  if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return true;

  const target = e.target as ShortcutTarget | null;
  if (target && typeof target.tagName === 'string') {
    if (TYPING_TAGS.has(target.tagName) || target.isContentEditable) return true;
    if (
      deferToFocusedControls &&
      (e.key === 'Enter' || e.key === ' ') &&
      typeof target.closest === 'function' &&
      target.closest('button, a[href], [role="button"], summary')
    ) {
      return true;
    }
  }

  return !!root?.querySelector('[aria-modal="true"]');
};
