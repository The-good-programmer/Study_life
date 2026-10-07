import { describe, it, expect } from 'vitest';
import { shouldIgnoreShortcut } from './keyboard';

const element = (tagName: string, { editable = false, insideControl = false } = {}) =>
  ({
    tagName,
    isContentEditable: editable,
    closest: (selector: string) => (insideControl && selector.includes('button') ? {} : null),
  }) as unknown as EventTarget;

const press = (key: string, target: EventTarget | null = element('BODY'), extra: Partial<KeyboardEvent> = {}) => ({
  key,
  target,
  defaultPrevented: false,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  ...extra,
});

const noDialog = { querySelector: () => null };
const withDialog = { querySelector: () => ({}) as Element };

describe('shouldIgnoreShortcut', () => {
  it('lets shortcuts through on the page itself', () => {
    expect(shouldIgnoreShortcut(press('Enter'), { root: noDialog })).toBe(false);
    expect(shouldIgnoreShortcut(press('3'), { root: noDialog })).toBe(false);
  });

  it('stands down while the learner is typing', () => {
    expect(shouldIgnoreShortcut(press('Enter', element('INPUT')), { root: noDialog })).toBe(true);
    expect(shouldIgnoreShortcut(press('a', element('TEXTAREA')), { root: noDialog })).toBe(true);
    expect(shouldIgnoreShortcut(press('a', element('DIV', { editable: true })), { root: noDialog })).toBe(true);
  });

  it('leaves Enter and Space to a focused button', () => {
    const button = element('BUTTON', { insideControl: true });
    expect(shouldIgnoreShortcut(press('Enter', button), { root: noDialog })).toBe(true);
    expect(shouldIgnoreShortcut(press(' ', button), { root: noDialog })).toBe(true);
    expect(shouldIgnoreShortcut(press('3', button), { root: noDialog })).toBe(false);
    expect(shouldIgnoreShortcut(press('Enter', button), { root: noDialog, deferToFocusedControls: false })).toBe(false);
  });

  it('stands down while a dialog is open or a modifier is held', () => {
    expect(shouldIgnoreShortcut(press('Enter'), { root: withDialog })).toBe(true);
    expect(shouldIgnoreShortcut(press('s', element('BODY'), { ctrlKey: true }), { root: noDialog })).toBe(true);
    expect(shouldIgnoreShortcut(press('Enter', element('BODY'), { defaultPrevented: true }), { root: noDialog })).toBe(true);
  });
});
