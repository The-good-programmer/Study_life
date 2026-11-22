import { ApiConfig } from './apiConfig';

/**
 * Tells the server about errors students run into, so they show up in the server's log instead of
 * only in someone's browser. Sends the message, the top of the stack, the page path and which build
 * it is: nothing about the student. At most a few reports per page load, each kind once.
 */

const MAX_REPORTS = 5;
const MAX_STACK_LINES = 8;
let sent = 0;
const seen = new Set<string>();

/** Errors that aren't Studify's: browser extensions, cross-origin scripts, harmless browser notices. */
const IGNORED = [/ResizeObserver loop/i, /^Script error\.?$/i, /chrome-extension:|moz-extension:|safari-extension:/i, /Load failed|Failed to fetch|NetworkError/i];

export interface ErrorReport {
  kind: 'error' | 'rejection' | 'boundary';
  message: string;
  stack?: string;
  path: string;
  build: string;
}

/** The build's id: the hash in the main script's file name. */
const buildId = (): string => {
  const src = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]')?.src ?? '';
  return /index-([\w-]+)\.js/.exec(src)?.[1] ?? 'dev';
};

/** The report for an error, or null when it isn't worth sending. */
export function toReport(error: unknown, kind: ErrorReport['kind'], path = window.location.pathname): ErrorReport | null {
  const err = error instanceof Error ? error : null;
  const message = (err ? `${err.name}: ${err.message}` : typeof error === 'string' ? error : JSON.stringify(error ?? 'Unknown error')).slice(0, 500);
  const stack = err?.stack?.split('\n').slice(0, MAX_STACK_LINES).join('\n').slice(0, 2000);
  if (IGNORED.some(pattern => pattern.test(message) || (stack && pattern.test(stack)))) return null;
  return { kind, message, stack, path, build: buildId() };
}

export function reportError(error: unknown, kind: ErrorReport['kind']): void {
  try {
    const report = toReport(error, kind);
    if (!report || sent >= MAX_REPORTS) return;
    const key = `${report.message}|${report.stack?.split('\n')[1] ?? ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    sent++;
    void ApiConfig.request('/client-errors', { method: 'POST', body: JSON.stringify(report), keepalive: true }).catch(() => {});
  } catch {
    // Reporting must never cause an error of its own.
  }
}

/** Starts reporting uncaught errors and unhandled promise failures. */
export function startErrorReporting(): void {
  window.addEventListener('error', event => reportError(event.error ?? event.message, 'error'));
  window.addEventListener('unhandledrejection', event => reportError(event.reason, 'rejection'));
}
