import { afterEach, describe, expect, it, vi } from 'vitest';

describe('error reports', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  const load = async () => {
    vi.stubGlobal('window', { location: { pathname: '/study' } });
    vi.stubGlobal('document', { querySelector: () => ({ src: 'https://studify.example/assets/index-B2wS-QQG.js' }) });
    return import('./errorReporter');
  };

  it('sends the message, the top of the stack, the page and the build, nothing more', async () => {
    const { toReport } = await load();
    const err = new TypeError('cards is undefined');
    err.stack = ['TypeError: cards is undefined', ...Array.from({ length: 20 }, (_, i) => `    at f${i} (index.js:${i}:1)`)].join('\n');
    const report = toReport(err, 'error')!;
    expect(report).toMatchObject({ kind: 'error', message: 'TypeError: cards is undefined', path: '/study', build: 'B2wS-QQG' });
    expect(report.stack!.split('\n')).toHaveLength(8);
  });

  it("ignores errors that aren't Studify's", async () => {
    const { toReport } = await load();
    expect(toReport('ResizeObserver loop completed with undelivered notifications.', 'error')).toBeNull();
    expect(toReport('Script error.', 'error')).toBeNull();
    const fromExtension = new Error('boom');
    fromExtension.stack = 'Error: boom\n    at chrome-extension://abc/content.js:1:1';
    expect(toReport(fromExtension, 'error')).toBeNull();
    expect(toReport(new TypeError('Failed to fetch'), 'rejection')).toBeNull();
  });

  it('sends each kind of error once, and at most five per page', async () => {
    const { reportError } = await load();
    const { ApiConfig } = await import('./apiConfig');
    const send = vi.spyOn(ApiConfig, 'request').mockResolvedValue({ ok: true, status: 204 });
    reportError(new Error('same'), 'error');
    reportError(new Error('same'), 'error');
    for (let i = 0; i < 10; i++) reportError(new Error(`different ${i}`), 'error');
    expect(send).toHaveBeenCalledTimes(5);
  });
});
