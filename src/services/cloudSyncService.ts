/**
 * Account sync: keeps a signed-in student's study data the same on all their devices, through
 * the Studify server (`/api/sync/pull` and `/api/sync/push`).
 *
 * What syncs: decks with their review progress, subjects, the planner, Focus tasks, notes and
 * history, stats, and how the avatar looks. The wallet and the campus home never do (a server
 * must not be able to mint tokens).
 *
 * Each sync pulls what changed on the account since the last one, merges it in (see
 * syncMerge.ts: newer edits win, deletions are remembered), then pushes only what changed here.
 * Guests don't sync.
 */

import type { FocusLogEntry, FocusTask, PlannerItem, RetrievalCard, StudySession, SubjectFolder, UserStats } from '../types';
import { StorageService } from './storageService';
import { appearanceOf, characterService } from './characterService';
import { ApiConfig } from './apiConfig';
import { FocusService } from './focusService';
import { cleanDeletionLog, hashOf, mergeById, mergeDeletions, mergeLog, mergeText, type DeletionLog, type SyncedText } from './syncMerge';

export interface CloudSyncConfig {
  /** Sync this device with the account (on unless turned off in Settings). */
  enabled: boolean;
  lastSyncAt: number | null;
  status: 'idle' | 'syncing' | 'synced' | 'queued' | 'error';
  errorMessage?: string;
}

/** Synced data other than decks, one document per kind (as stored on the server). */
export interface SyncDocuments {
  folders?: { items: SubjectFolder[] };
  planner?: { items: PlannerItem[] };
  focus_tasks?: { items: FocusTask[] };
  focus_log?: { items: FocusLogEntry[] };
  focus_notes?: SyncedText;
  deletions?: DeletionLog;
}

/** Everything a sync sends or receives. */
export interface CloudSyncPayload {
  sessions: StudySession[];
  stats: UserStats | null;
  /** How the avatar looks (see appearanceOf). The wallet and level are never synced. */
  characterState?: Record<string, unknown> | null;
  documents?: SyncDocuments;
  /** Server time of a pull, for the next pull's `since`. */
  serverTime?: number;
}

/** What was last sent from this profile, and when it last pulled. */
interface SyncState {
  lastPulledAt: number;
  deckHashes: Record<string, string>;
  docHashes: Record<string, string>;
  statsHash?: string;
  characterHash?: string;
}

const CONFIG_KEY = 'studify_account_sync_config_v1';
/** How long auto-sync waits after the last local change before it syncs. */
const AUTO_SYNC_DELAY_MS = 5000;
/** Coming back to the tab pulls at most this often. */
const VISIBLE_SYNC_GAP_MS = 60_000;
/** Pushes are split to stay under the server's 5 MB request limit. */
const MAX_PUSH_BYTES = 3.5 * 1024 * 1024;

const DOCUMENT_KINDS = ['folders', 'planner', 'focus_tasks', 'focus_log', 'focus_notes', 'deletions'] as const;

const DEFAULT_CONFIG: CloudSyncConfig = { enabled: true, lastSyncAt: null, status: 'idle' };

class SyncError extends Error {
  /** A network failure (offline, server unreachable): try again later rather than report an error. */
  readonly offline: boolean;

  constructor(message: string, offline = false) {
    super(message);
    this.offline = offline;
  }
}

const cardsOf = (deck: StudySession): RetrievalCard[] => (deck.concepts || []).flatMap(c => c.retrievalCards || []);

const isDeck = (value: unknown): value is StudySession =>
  Boolean(value && typeof value === 'object' && typeof (value as StudySession).id === 'string' && (value as StudySession).id);

/** The latest moment a deck was made, finished or reviewed: the newer copy of a deck wins. */
const deckTime = (deck: StudySession): number => {
  let latest = 0;
  const consider = (iso?: string) => {
    const t = Date.parse(iso ?? '');
    if (Number.isFinite(t)) latest = Math.max(latest, t);
  };
  consider(deck.createdAt);
  consider(deck.completedAt);
  for (const card of cardsOf(deck)) {
    consider(card.lastReviewDate);
    // A card edited (or hidden) counts as a change to its deck.
    consider(card.updatedAt);
  }
  return latest;
};

const emptyState = (): SyncState => ({ lastPulledAt: 0, deckHashes: {}, docHashes: {} });

/** This profile's documents as they are now. */
function localDocuments(): Required<SyncDocuments> {
  return {
    folders: { items: StorageService.getFolders() },
    planner: { items: StorageService.getPlannerItems() },
    focus_tasks: { items: StorageService.getFocusTasks() },
    focus_log: { items: StorageService.getFocusLog() },
    focus_notes: { text: StorageService.getFocusNotes(), updatedAt: StorageService.getFocusNotesUpdatedAt() },
    deletions: StorageService.getDeletions(),
  };
}

const itemsOf = <T>(doc: { items?: unknown } | undefined): T[] => (doc && Array.isArray(doc.items) ? (doc.items as T[]) : []);

export class CloudSyncService {
  private static listeners: Set<(config: CloudSyncConfig) => void> = new Set();
  /** The scheduled auto-sync. Each local change pushes it back. */
  private static autoSyncTimer: ReturnType<typeof setTimeout> | null = null;
  /** Syncs run one at a time; this is set while one is out. */
  private static autoSyncInFlight = false;
  /** A sync came due while another was out, so one more runs when that finishes. */
  private static changedDuringAutoSync = false;
  /** Set while mergeRemoteData writes the server's data to storage. */
  private static mergingRemoteData = false;
  private static lastAttemptAt = 0;
  private static started = false;

  public static getConfig(): CloudSyncConfig {
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    } catch {
      // Unreadable: the defaults.
    }
    return { ...DEFAULT_CONFIG };
  }

  public static saveConfig(updates: Partial<CloudSyncConfig>): CloudSyncConfig {
    const updated = { ...this.getConfig(), ...updates };
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(updated));
    } catch {
      // Storage full or blocked: the status still shows for this page.
    }
    this.notify(updated);
    return updated;
  }

  /** Whether this device can sync now: signed in, with sync turned on. */
  public static canSync(): boolean {
    return this.getConfig().enabled && Boolean(ApiConfig.getToken()) && Boolean(StorageService.getActiveUserId());
  }

  /** Everything this profile would send: decks with their latest review progress, stats, avatar look and documents. */
  public static createSyncPayload(): CloudSyncPayload & { documents: Required<SyncDocuments> } {
    return {
      sessions: StorageService.getSessions().map(deck => StorageService.deckWithLatestProgress(deck)),
      stats: StorageService.getStats(),
      characterState: appearanceOf(characterService.getCharacter()),
      documents: localDocuments(),
    };
  }

  /** Pulls, merges, and pushes what changed. Resolves with a message to show. */
  public static async syncNow(): Promise<{ success: boolean; message: string }> {
    const config = this.getConfig();
    if (!config.enabled) return { success: false, message: 'Sync is turned off for this device.' };
    if (!this.canSync()) return { success: false, message: 'Sign in to sync your study data between devices.' };

    this.lastAttemptAt = Date.now();
    this.saveConfig({ status: 'syncing', errorMessage: undefined });
    const userId = StorageService.getActiveUserId();
    try {
      const state = { ...emptyState(), ...(StorageService.getSyncState<SyncState>() ?? {}) };
      const since = state.lastPulledAt > 0 ? `?since=${state.lastPulledAt}` : '';
      const remote = await this.request<CloudSyncPayload>(`/sync/pull${since}`, { method: 'GET' });
      // A sign-out or account switch while the request was out: don't write into another profile.
      if (StorageService.getActiveUserId() !== userId) return { success: false, message: 'The account changed during sync.' };

      this.mergeRemoteData(remote);
      const skipped = await this.pushChanges(state);
      if (typeof remote.serverTime === 'number') state.lastPulledAt = remote.serverTime;
      StorageService.saveSyncState(state);

      if (skipped.length > 0) {
        const message = `Couldn't sync ${skipped.map(t => `"${t}"`).join(', ')}: too big to send. Everything else is synced.`;
        this.saveConfig({ status: 'error', lastSyncAt: Date.now(), errorMessage: message });
        return { success: false, message };
      }
      this.saveConfig({ status: 'synced', lastSyncAt: Date.now(), errorMessage: undefined });
      return { success: true, message: 'Your study data is up to date on this device.' };
    } catch (err) {
      const offline = err instanceof SyncError ? err.offline : true;
      const message = err instanceof Error && err.message ? err.message : 'Sync failed.';
      this.saveConfig(offline ? { status: 'queued', errorMessage: undefined } : { status: 'error', errorMessage: message });
      return { success: false, message: offline ? "Couldn't reach the server. It will sync when you're back online." : message };
    }
  }

  /** Sends what changed since the last push, in requests small enough for the server. Returns titles of decks too big to send. */
  private static async pushChanges(state: SyncState): Promise<string[]> {
    const local = this.createSyncPayload();

    // Forget decks that are gone, so a deck made again with the same id is sent.
    const ids = new Set(local.sessions.map(d => d.id));
    for (const id of Object.keys(state.deckHashes)) if (!ids.has(id)) delete state.deckHashes[id];

    const deckHashes = new Map(local.sessions.map(d => [d.id, hashOf(d)]));
    const changedDecks = local.sessions.filter(d => state.deckHashes[d.id] !== deckHashes.get(d.id));
    const docHashes = Object.fromEntries(DOCUMENT_KINDS.map(kind => [kind, hashOf(local.documents[kind])]));
    const changedDocs = DOCUMENT_KINDS.filter(kind => state.docHashes[kind] !== docHashes[kind]);
    const statsHash = hashOf(local.stats);
    const characterHash = hashOf(local.characterState);

    const first: Record<string, unknown> = {};
    if (changedDocs.length > 0) {
      first.documents = Object.fromEntries(changedDocs.map(kind => [kind, local.documents[kind]]));
      if (changedDocs.includes('deletions')) {
        const deleted = Object.keys(local.documents.deletions.decks);
        if (deleted.length > 0) first.deletedSessionIds = deleted.slice(-2000);
      }
    }
    if (statsHash !== state.statsHash) first.stats = local.stats;
    if (characterHash !== state.characterHash) first.characterState = local.characterState;

    // Decks go in batches under the size limit; the first batch also carries everything else.
    const skipped: string[] = [];
    const batches: StudySession[][] = [[]];
    let batchBytes = JSON.stringify(first).length;
    for (const deck of changedDecks) {
      const bytes = JSON.stringify(deck).length;
      if (bytes > MAX_PUSH_BYTES) {
        skipped.push(deck.title || 'Untitled deck');
        continue;
      }
      if (batchBytes + bytes > MAX_PUSH_BYTES && batches[batches.length - 1].length > 0) {
        batches.push([]);
        batchBytes = 0;
      }
      batches[batches.length - 1].push(deck);
      batchBytes += bytes;
    }

    for (const [index, decks] of batches.entries()) {
      const body: Record<string, unknown> = index === 0 ? { ...first } : {};
      if (decks.length > 0) body.sessions = decks;
      if (Object.keys(body).length === 0) continue;
      await this.request('/sync/push', { method: 'POST', body: JSON.stringify(body) });
      // Remember what was sent only once the server has it.
      for (const deck of decks) state.deckHashes[deck.id] = deckHashes.get(deck.id)!;
      if (index === 0) {
        for (const kind of changedDocs) state.docHashes[kind] = docHashes[kind];
        state.statsHash = statsHash;
        state.characterHash = characterHash;
      }
    }
    return skipped;
  }

  private static async request<T>(path: string, init: RequestInit): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${ApiConfig.getBaseUrl()}${path}`, {
        ...init,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ApiConfig.getToken()}` },
      });
    } catch {
      throw new SyncError("Couldn't reach the server.", true);
    }
    if (res.status === 401) throw new SyncError('Your sign-in has expired. Sign in again to keep syncing.');
    if (!res.ok) {
      let message = '';
      try {
        message = ((await res.json()) as { error?: string }).error ?? '';
      } catch {
        // Not JSON.
      }
      if (res.status >= 500 || res.status === 0) throw new SyncError(message || 'The server is having trouble.', true);
      throw new SyncError(message || `Sync failed (${res.status}).`);
    }
    return (await res.json()) as T;
  }

  /**
   * Merges the account's data into this profile. Decks: the newer copy of each, with each card's
   * most recent review from either side. Documents: item by item, newer edits winning, deletions
   * applied. Stats: the higher of each count. The avatar: its look only.
   */
  public static mergeRemoteData(remote: Partial<CloudSyncPayload> | null | undefined): void {
    if (!remote) return;
    // These writes bring the server's data in, so they must not count as local changes:
    // auto-syncing them would merge another reply, which would auto-sync again, and so on.
    this.mergingRemoteData = true;
    try {
      const docs: SyncDocuments = remote.documents && typeof remote.documents === 'object' ? remote.documents : {};
      const deletions = mergeDeletions(StorageService.getDeletions(), cleanDeletionLog(docs.deletions));
      StorageService.saveDeletions(deletions);

      this.mergeDecks(Array.isArray(remote.sessions) ? remote.sessions.filter(isDeck) : [], deletions);

      if (remote.stats && typeof remote.stats === 'object') {
        const localStats = StorageService.getStats();
        StorageService.saveStats({
          ...localStats,
          xp: Math.max(localStats.xp || 0, remote.stats.xp || 0),
          currentStreak: Math.max(localStats.currentStreak || 0, remote.stats.currentStreak || 0),
          conceptsMastered: Math.max(localStats.conceptsMastered || 0, remote.stats.conceptsMastered || 0),
          sessionsCompleted: Math.max(localStats.sessionsCompleted || 0, remote.stats.sessionsCompleted || 0),
          totalStudyMinutes: Math.max(localStats.totalStudyMinutes || 0, remote.stats.totalStudyMinutes || 0),
        });
      }

      // Only the avatar's look comes from the server; anything that moves tokens (coins, level,
      // XP) from there would let a server mint them.
      if (remote.characterState && typeof remote.characterState === 'object') {
        const look = appearanceOf(remote.characterState);
        if (Object.keys(look).length > 0) characterService.updateCustomization(look);
      }

      const replaceIfChanged = <T>(current: T, merged: T, save: (value: T) => void): boolean => {
        if (hashOf(current) === hashOf(merged)) return false;
        save(merged);
        return true;
      };

      const folders = StorageService.getFolders();
      replaceIfChanged(folders, mergeById(folders, itemsOf<SubjectFolder>(docs.folders), deletions.folders), v => StorageService.saveFolders(v));
      const planner = StorageService.getPlannerItems();
      replaceIfChanged(planner, mergeById(planner, itemsOf<PlannerItem>(docs.planner), deletions.planner), v => StorageService.savePlannerItems(v));

      let focusChanged = false;
      const tasks = StorageService.getFocusTasks();
      focusChanged =
        replaceIfChanged(tasks, mergeById(tasks, itemsOf<FocusTask>(docs.focus_tasks), deletions.focus_tasks), v => StorageService.saveFocusTasks(v)) ||
        focusChanged;
      const log = StorageService.getFocusLog();
      focusChanged = replaceIfChanged(log, mergeLog(log, itemsOf<FocusLogEntry>(docs.focus_log)), v => StorageService.saveFocusLog(v)) || focusChanged;
      const notes: SyncedText = { text: StorageService.getFocusNotes(), updatedAt: StorageService.getFocusNotesUpdatedAt() };
      focusChanged = replaceIfChanged(notes, mergeText(notes, docs.focus_notes), v => StorageService.saveFocusNotes(v.text, v.updatedAt)) || focusChanged;
      if (focusChanged) FocusService.notifyChanged();
    } finally {
      this.mergingRemoteData = false;
    }
  }

  private static mergeDecks(remoteDecks: StudySession[], deletions: DeletionLog): void {
    const deleted = deletions.decks;
    const localDecks = StorageService.getSessions();
    const goneHere = localDecks.some(d => d.id in deleted);
    if (remoteDecks.length === 0 && !goneHere) return;

    // Reviews from both devices count: the newer progress of each card is kept, whichever deck copy wins.
    StorageService.mergeCardProgress(remoteDecks.flatMap(cardsOf));

    const byId = new Map(localDecks.map(d => [d.id, d]));
    for (const remoteDeck of remoteDecks) {
      if (remoteDeck.id in deleted) continue;
      const mine = byId.get(remoteDeck.id);
      if (!mine || deckTime(remoteDeck) > deckTime(StorageService.deckWithLatestProgress(mine))) byId.set(remoteDeck.id, remoteDeck);
    }
    StorageService.saveSessions([...byId.values()].filter(d => !(d.id in deleted)));
  }

  /**
   * Starts listening for reasons to sync: local changes (also in Focus), coming back to the tab,
   * and getting back online. Call once when the app starts; it syncs straight away if it can.
   */
  public static start(): () => void {
    if (this.started || typeof window === 'undefined') return () => {};
    this.started = true;
    const onChange = () => this.triggerAutoSync();
    const unsubFocus = FocusService.subscribe(onChange);
    const unsubNotes = FocusService.onNotesSaved(onChange);
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - this.lastAttemptAt > VISIBLE_SYNC_GAP_MS) this.requestSync();
    };
    const onOnline = () => this.requestSync();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    this.requestSync();
    return () => {
      this.started = false;
      unsubFocus();
      unsubNotes();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }

  /** Syncs as soon as possible (after any sync already out). */
  public static requestSync(): void {
    if (!this.canSync()) return;
    if (this.autoSyncTimer !== null) {
      clearTimeout(this.autoSyncTimer);
      this.autoSyncTimer = null;
    }
    this.runAutoSync();
  }

  /**
   * Syncs a while after a local change. Changes less than AUTO_SYNC_DELAY_MS apart share one
   * sync, which runs once they stop.
   */
  public static triggerAutoSync(): void {
    // Merging a sync's reply writes to storage, but that's the server's data, not a local change.
    if (this.mergingRemoteData) return;
    if (!this.canSync()) return;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.saveConfig({ status: 'queued' });
      return;
    }

    if (this.autoSyncTimer !== null) clearTimeout(this.autoSyncTimer);
    this.autoSyncTimer = setTimeout(() => {
      this.autoSyncTimer = null;
      this.runAutoSync();
    }, AUTO_SYNC_DELAY_MS);
  }

  /** Starts a sync, or if one is still out, has one more follow it. */
  private static runAutoSync(): void {
    if (this.autoSyncInFlight) {
      // The sync that's out may have read the data before this change.
      this.changedDuringAutoSync = true;
      return;
    }

    this.autoSyncInFlight = true;
    this.syncNow()
      .catch(() => {})
      .finally(() => {
        this.autoSyncInFlight = false;
        if (this.changedDuringAutoSync) {
          this.changedDuringAutoSync = false;
          this.triggerAutoSync();
        }
      });
  }

  /** Subscribe to sync status changes. */
  public static subscribe(listener: (config: CloudSyncConfig) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private static notify(config: CloudSyncConfig): void {
    this.listeners.forEach(fn => {
      try {
        fn(config);
      } catch {
        // A broken listener mustn't stop the others.
      }
    });
  }
}

// Local changes to study data sync a few seconds later, when signed in.
StorageService.addMutationListener(() => {
  CloudSyncService.triggerAutoSync();
});
