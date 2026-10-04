/**
 * Studify Cloud Sync & Persistence Engine
 * Provides local-first cross-device sync, offline sync queues,
 * and automated backup between devices.
 */

import { StorageService } from './storageService';
import type { StudySession, UserStats } from '../types';

export interface CloudSyncConfig {
  enabled: boolean;
  cloudToken: string; // User's private cross-device sync key
  endpointUrl: string; // Optional custom endpoint / Supabase / Cloudflare Worker
  autoSyncOnReview: boolean;
  lastSyncAt: number | null;
  status: 'idle' | 'syncing' | 'synced' | 'queued' | 'error';
  errorMessage?: string;
}

export interface CloudSyncPayload {
  version: number;
  syncedAt: number;
  userId: string | null;
  stats: UserStats;
  sessions: StudySession[];
  axolotlState?: Record<string, unknown>;
  checksum: string;
}

const CONFIG_KEY = 'studify_cloud_sync_config_v1';
const PENDING_QUEUE_KEY = 'studify_cloud_sync_pending_queue';

export class CloudSyncService {
  private static listeners: Set<(config: CloudSyncConfig) => void> = new Set();

  /**
   * Generates a user-friendly, cryptographically random sync token
   * e.g. AXON-SYNC-A4B7-C9X2
   */
  public static generateSyncToken(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const randPart = (len: number) => {
      const bytes = new Uint8Array(len);
      crypto.getRandomValues(bytes);
      return Array.from(bytes, b => chars[b % chars.length]).join('');
    };
    return `LOTTI-SYNC-${randPart(4)}-${randPart(4)}`;
  }

  /**
   * Retrieves active Cloud Sync configuration
   */
  public static getConfig(): CloudSyncConfig {
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      if (raw) {
        return {
          enabled: false,
          cloudToken: '',
          endpointUrl: '',
          autoSyncOnReview: true,
          lastSyncAt: null,
          status: 'idle',
          ...JSON.parse(raw),
        };
      }
    } catch {}

    return {
      enabled: false,
      cloudToken: '',
      endpointUrl: '',
      autoSyncOnReview: true,
      lastSyncAt: null,
      status: 'idle',
    };
  }

  /**
   * Updates and persists Cloud Sync configuration
   */
  public static saveConfig(updates: Partial<CloudSyncConfig>): CloudSyncConfig {
    const current = this.getConfig();
    const updated = { ...current, ...updates };
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(updated));
    } catch {}
    this.notify(updated);
    return updated;
  }

  /**
   * Generates a complete sync payload of all current user data
   */
  public static createSyncPayload(): CloudSyncPayload {
    const stats = StorageService.getStats();
    const sessions = StorageService.getSessions();
    const activeUserId = StorageService.getActiveUserId();

    let axolotlState: Record<string, unknown> | undefined;
    try {
      const axRaw = localStorage.getItem('axon_axolotl_state');
      if (axRaw) axolotlState = JSON.parse(axRaw);
    } catch {}

    const payloadRaw = JSON.stringify({ stats, sessions, axolotlState });
    // Simple fast DJB2-based hash for checksum
    let hash = 5381;
    for (let i = 0; i < payloadRaw.length; i++) {
      hash = ((hash << 5) + hash) + payloadRaw.charCodeAt(i);
    }
    const checksum = (hash >>> 0).toString(16);

    return {
      version: 2,
      syncedAt: Date.now(),
      userId: activeUserId,
      stats,
      sessions,
      axolotlState,
      checksum,
    };
  }

  /**
   * Performs cloud synchronization (or simulates cloud handshake if no custom endpoint)
   */
  public static async syncNow(): Promise<{ success: boolean; message: string }> {
    const config = this.getConfig();
    if (!config.enabled) {
      return { success: false, message: 'Cloud sync is disabled. Enable it in Settings.' };
    }

    if (!config.cloudToken) {
      return { success: false, message: 'No cloud token configured. Please generate or paste a token.' };
    }

    if (!config.endpointUrl || !config.endpointUrl.startsWith('http')) {
      this.saveConfig({ status: 'idle', errorMessage: 'Remote endpoint URL required' });
      return {
        success: false,
        message: 'Cloud sync requires a remote server URL (e.g. self-hosted REST or Cloudflare Worker). Configure your endpoint in Settings, or use Library Export to backup your decks offline.'
      };
    }

    this.saveConfig({ status: 'syncing', errorMessage: undefined });

    try {
      const payload = this.createSyncPayload();

      const response = await fetch(config.endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.cloudToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Sync server responded with ${response.status}: ${response.statusText}`);
      }

      const remoteData = await response.json();
      if (remoteData && remoteData.sessions) {
        this.mergeRemoteData(remoteData);
      }

      // Clear pending queue
      try {
        localStorage.removeItem(PENDING_QUEUE_KEY);
      } catch {}

      const now = Date.now();
      this.saveConfig({
        status: 'synced',
        lastSyncAt: now,
        errorMessage: undefined,
      });

      return { success: true, message: `Successfully synchronized ${payload.sessions.length} decks with remote server!` };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network sync failed';
      this.saveConfig({
        status: 'error',
        errorMessage: msg,
      });

      // Mark as queued for when connection restores
      this.queuePendingChange('full_sync');

      return { success: false, message: msg };
    }
  }

  /**
   * Merge remote cloud data into local storage using timestamp-based Last-Write-Wins (LWW)
   */
  public static mergeRemoteData(remote: CloudSyncPayload): void {
    if (!remote || !Array.isArray(remote.sessions)) return;

    const localSessions = StorageService.getSessions();
    const sessionMap = new Map<string, StudySession>();

    // Index local sessions
    localSessions.forEach(s => sessionMap.set(s.id, s));

    const getLatestTimestamp = (s: StudySession): number => {
      let latest = 0;
      if (s.createdAt) {
        const t = new Date(s.createdAt).getTime();
        if (!isNaN(t)) latest = Math.max(latest, t);
      }
      if (s.completedAt) {
        const ct = new Date(s.completedAt).getTime();
        if (!isNaN(ct)) latest = Math.max(latest, ct);
      }
      (s.concepts || []).forEach(cp => {
        (cp.retrievalCards || []).forEach(card => {
          if (card.lastReviewDate) {
            const rt = new Date(card.lastReviewDate).getTime();
            if (!isNaN(rt)) latest = Math.max(latest, rt);
          }
        });
      });
      return latest;
    };

    // Merge or insert remote sessions with genuine timestamp comparison
    remote.sessions.forEach(remoteS => {
      const localS = sessionMap.get(remoteS.id);
      if (!localS) {
        sessionMap.set(remoteS.id, remoteS);
      } else {
        const localTime = getLatestTimestamp(localS);
        const remoteTime = getLatestTimestamp(remoteS);
        if (remoteTime >= localTime) {
          sessionMap.set(remoteS.id, remoteS);
        }
      }
    });

    const mergedSessions = Array.from(sessionMap.values());
    StorageService.saveSessions(mergedSessions);

    // Merge stats (take highest streak & highest XP)
    const localStats = StorageService.getStats();
    if (remote.stats) {
      const mergedStats: UserStats = {
        ...localStats,
        xp: Math.max(localStats.xp || 0, remote.stats.xp || 0),
        currentStreak: Math.max(localStats.currentStreak || 1, remote.stats.currentStreak || 1),
        conceptsMastered: Math.max(localStats.conceptsMastered || 0, remote.stats.conceptsMastered || 0),
        sessionsCompleted: Math.max(localStats.sessionsCompleted || 0, remote.stats.sessionsCompleted || 0),
        totalStudyMinutes: Math.max(localStats.totalStudyMinutes || 0, remote.stats.totalStudyMinutes || 0),
      };
      StorageService.saveStats(mergedStats);
    }
  }

  /**
   * Queue a change to be synced when internet returns
   */
  public static queuePendingChange(action: string): void {
    try {
      const queue = JSON.parse(localStorage.getItem(PENDING_QUEUE_KEY) || '[]');
      queue.push({ action, timestamp: Date.now() });
      localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(queue));
      this.saveConfig({ status: 'queued' });
    } catch {}
  }

  /**
   * Trigger auto-sync if enabled and user is online
   */
  public static triggerAutoSync(): void {
    const config = this.getConfig();
    if (!config.enabled || !config.autoSyncOnReview) return;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.queuePendingChange('review_complete');
      return;
    }

    // Debounced async sync
    setTimeout(() => {
      this.syncNow().catch(() => {});
    }, 1500);
  }

  /**
   * Subscribe to cloud sync config and status changes
   */
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
      } catch {}
    });
  }
}

// Auto-wire storage mutations to trigger cloud sync when enabled
StorageService.addMutationListener(() => {
  CloudSyncService.triggerAutoSync();
});
