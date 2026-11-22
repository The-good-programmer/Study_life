import type { RetrievalCard } from '../types';

/**
 * How account sync merges this device's data with the account's copy. Pure functions only.
 *
 * Every device keeps its own copy and syncs now and then, so both sides can have changed.
 * Items are merged one by one (the newer edit wins), and deletions are kept as records, so a
 * deleted item doesn't come back from a device that still had it.
 */

/** When each item was deleted (ISO time), by id. */
export type Deletions = Record<string, string>;

export const DELETION_KINDS = ['decks', 'folders', 'planner', 'focus_tasks', 'timetable', 'lesson_logs'] as const;
export type DeletionKind = (typeof DELETION_KINDS)[number];
export type DeletionLog = Record<DeletionKind, Deletions>;

/** Deletion records older than this are dropped: every device will have synced by then. */
export const DELETION_RETENTION_DAYS = 90;

const DAY_MS = 86_400_000;

export const emptyDeletionLog = (): DeletionLog => ({ decks: {}, folders: {}, planner: {}, focus_tasks: {}, timetable: {}, lesson_logs: {} });

const timeOf = (iso: string | undefined): number => {
  const t = Date.parse(iso ?? '');
  return Number.isFinite(t) ? t : 0;
};

/** A deletion log as saved or received, with anything malformed left out. */
export function cleanDeletionLog(raw: unknown): DeletionLog {
  const log = emptyDeletionLog();
  if (!raw || typeof raw !== 'object') return log;
  for (const kind of DELETION_KINDS) {
    const entries = (raw as Record<string, unknown>)[kind];
    if (!entries || typeof entries !== 'object') continue;
    for (const [id, at] of Object.entries(entries as Record<string, unknown>)) {
      if (typeof at === 'string' && timeOf(at) > 0) log[kind][id] = at;
    }
  }
  return log;
}

/** Both logs together (the later time for an id), without records past the retention time. */
export function mergeDeletions(a: DeletionLog, b: DeletionLog, now: number = Date.now()): DeletionLog {
  const cutoff = now - DELETION_RETENTION_DAYS * DAY_MS;
  const merged = emptyDeletionLog();
  for (const kind of DELETION_KINDS) {
    for (const source of [a[kind], b[kind]]) {
      for (const [id, at] of Object.entries(source)) {
        if (timeOf(at) < cutoff) continue;
        if (!merged[kind][id] || timeOf(at) > timeOf(merged[kind][id])) merged[kind][id] = at;
      }
    }
  }
  return merged;
}

interface Versioned {
  id: string;
  updatedAt?: string;
  createdAt?: string;
}

const versionOf = (item: Versioned): number => timeOf(item.updatedAt ?? item.createdAt);

/**
 * Items from both sides, one per id: the more recently edited copy (this device's on a tie).
 * An item deleted at or after its last edit is left out. This device's order is kept, with
 * items new from the other side after them.
 */
export function mergeById<T extends Versioned>(local: readonly T[], remote: readonly T[], deleted: Deletions = {}): T[] {
  const byId = new Map<string, T>();
  for (const item of local) if (item && typeof item.id === 'string') byId.set(item.id, item);
  for (const item of remote) {
    if (!item || typeof item.id !== 'string') continue;
    const mine = byId.get(item.id);
    if (!mine || versionOf(item) > versionOf(mine)) byId.set(item.id, item);
  }
  return [...byId.values()].filter(item => !(item.id in deleted) || timeOf(deleted[item.id]) < versionOf(item));
}

/** An append-only log from both sides, one entry per id, oldest first by `endedAt`. */
export function mergeLog<T extends { id: string; endedAt?: string }>(local: readonly T[], remote: readonly T[]): T[] {
  const byId = new Map<string, T>();
  for (const entry of [...local, ...remote]) if (entry && typeof entry.id === 'string' && !byId.has(entry.id)) byId.set(entry.id, entry);
  return [...byId.values()].sort((a, b) => timeOf(a.endedAt) - timeOf(b.endedAt));
}

export interface SyncedText {
  text: string;
  /** Epoch ms of the last edit. */
  updatedAt: number;
}

/** The more recently edited text (this device's on a tie). */
export const mergeText = (local: SyncedText, remote: SyncedText | null | undefined): SyncedText =>
  remote && typeof remote.text === 'string' && Number(remote.updatedAt) > local.updatedAt ? { text: remote.text, updatedAt: Number(remote.updatedAt) } : local;

/** The review fields of a card, which only change when it is studied. */
const PROGRESS_FIELDS = ['stability', 'difficulty', 'reps', 'lapses', 'lastReviewDate', 'nextReviewDate'] as const;

/**
 * A card's progress from whichever copy was reviewed more recently, so reviews done on either
 * device are kept even when the other device's copy of the deck wins.
 */
export function newerProgress(local: RetrievalCard | undefined, remote: RetrievalCard): RetrievalCard | null {
  if (!local) return remote;
  if (timeOf(remote.lastReviewDate) <= timeOf(local.lastReviewDate)) return null;
  const updated: RetrievalCard = { ...local };
  for (const field of PROGRESS_FIELDS) {
    (updated as unknown as Record<string, unknown>)[field] = remote[field];
  }
  return updated;
}

/** A short hash of a value's JSON, to tell whether it changed since it was last sent. */
export function hashOf(value: unknown): string {
  const json = JSON.stringify(value) ?? '';
  let hash = 5381;
  for (let i = 0; i < json.length; i++) hash = ((hash << 5) + hash + json.charCodeAt(i)) | 0;
  return `${(hash >>> 0).toString(36)}:${json.length}`;
}
