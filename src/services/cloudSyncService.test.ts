import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { CloudSyncService, type CloudSyncPayload } from './cloudSyncService';
import { characterService } from './characterService';
import { StorageService } from './storageService';
import { STARTING_COINS } from './economy/wallet';
import type { StudySession, UserStats } from '../types';

describe('CloudSyncService', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('studify_life_data_split_v1', '1');
    // Reloads the guest's avatar and wallet from the now empty storage.
    StorageService.setActiveUserId(null);
  });
  afterEach(() => StorageService.setActiveUserId(null));

  it('generates a valid formatted cryptographic sync token', () => {
    const token = CloudSyncService.generateSyncToken();
    expect(token).toBeDefined();
    expect(token.startsWith('STUDIFY-SYNC-')).toBe(true);
    expect(token.length).toBeGreaterThan(15);
  });

  it('fails honestly when remote endpoint URL is not configured', async () => {
    CloudSyncService.saveConfig({
      enabled: true,
      cloudToken: 'STUDIFY-SYNC-TEST-1234',
      endpointUrl: '',
    });

    const result = await CloudSyncService.syncNow();
    expect(result.success).toBe(false);
    expect(result.message).toContain('Cloud sync requires a remote server URL');
  });

  it('saves and reads sync configuration accurately', () => {
    const saved = CloudSyncService.saveConfig({
      enabled: true,
      cloudToken: 'STUDIFY-SYNC-AAA-BBB',
      endpointUrl: 'https://example.com/sync',
      autoSyncOnReview: true,
    });

    expect(saved.enabled).toBe(true);
    expect(saved.cloudToken).toBe('STUDIFY-SYNC-AAA-BBB');
    expect(saved.endpointUrl).toBe('https://example.com/sync');

    const retrieved = CloudSyncService.getConfig();
    expect(retrieved.cloudToken).toBe('STUDIFY-SYNC-AAA-BBB');
    expect(retrieved.endpointUrl).toBe('https://example.com/sync');
  });

  it('sends how the avatar looks, but not the wallet or level', () => {
    characterService.updateCustomization({ name: 'Dr. Turing', hairColor: '#4b2e1e', hairStyle: 'side-part' });
    characterService.addCoins(300);

    const payload = CloudSyncService.createSyncPayload();
    expect(payload.characterState).toMatchObject({ name: 'Dr. Turing', hairColor: '#4b2e1e', hairStyle: 'side-part' });
    expect(payload.characterState).not.toHaveProperty('coins');
    expect(payload.characterState).not.toHaveProperty('level');
    expect(payload.version).toBe(2);
    expect(payload.checksum).toBeDefined();
  });

  it("sends the signed-in account's avatar", () => {
    StorageService.setActiveUserId('usr_sync');
    characterService.updateCustomization({ name: 'Grace' });
    expect(CloudSyncService.createSyncPayload().characterState).toMatchObject({ name: 'Grace' });
  });

  it('takes only the avatar look from the server, never tokens or level', () => {
    const remotePayload = {
      version: 2,
      syncedAt: Date.now(),
      userId: 'test_user',
      checksum: 'abc123',
      sessions: [],
      stats: {
        totalStudyMinutes: 120,
        currentStreak: 7,
        conceptsMastered: 15,
        sessionsCompleted: 12,
        xp: 950,
        todayMinutes: 20,
      },
      characterState: {
        name: 'Ada Lovelace',
        hairColor: '#123456',
        hairStyle: '<img src=x>',
        coins: 888888,
        level: 50,
        unlockedItems: ['crown'],
      },
    };

    CloudSyncService.mergeRemoteData(remotePayload as unknown as CloudSyncPayload);

    const character = characterService.getCharacter();
    expect(character.name).toBe('Ada Lovelace');
    expect(character.hairColor).toBe('#123456');
    expect(character.hairStyle).not.toBe('<img src=x>');
    expect(character.coins).toBe(STARTING_COINS);
    expect(character.level).toBe(1);
    expect(character.unlockedItems).not.toContain('crown');

    const stats = StorageService.getStats();
    expect(stats.xp).toBe(950);
    expect(stats.sessionsCompleted).toBe(12);
  });

  describe('auto-sync', () => {
    const deckFromOtherDevice: StudySession = {
      id: 'deck-from-laptop',
      title: 'Cell biology',
      category: 'Biology',
      description: '',
      concepts: [],
      currentConceptIndex: 0,
      currentPhase: 'summary',
      elapsedSeconds: 0,
      createdAt: '2026-10-01T09:00:00.000Z',
    };

    /** The server answers with its copy of the data: here, stats and a deck saved on another device. */
    const serverCopy = (): CloudSyncPayload => ({
      version: 2,
      syncedAt: Date.now(),
      userId: null,
      stats: { xp: 5 } as UserStats,
      sessions: [deckFromOtherDevice],
      checksum: 'server',
    });

    let fetchMock: Mock<typeof fetch>;
    let answerHeldRequest = () => {};

    /** Leaves the next request unanswered, like a slow server, until answerHeldRequest() is called. */
    const holdNextRequest = () => {
      fetchMock.mockImplementationOnce(
        () => new Promise<Response>(resolve => {
          answerHeldRequest = () => resolve(Response.json(serverCopy()));
        }),
      );
    };

    /** Several auto-sync delays: enough for a sync, and any syncs it sets off, to run. */
    const waitAWhile = () => vi.advanceTimersByTimeAsync(10_000);

    const xpSentIn = (request: number) => JSON.parse(fetchMock.mock.calls[request][1]?.body as string).stats.xp;

    beforeEach(() => {
      vi.useFakeTimers();
      vi.stubGlobal('navigator', { onLine: true }); // Node's navigator has no onLine, which reads as offline
      fetchMock = vi.fn<typeof fetch>(async () => Response.json(serverCopy()));
      vi.stubGlobal('fetch', fetchMock);
      CloudSyncService.saveConfig({
        enabled: true,
        cloudToken: 'STUDIFY-SYNC-TEST-1234',
        endpointUrl: 'https://sync.example.com/api',
      });
    });

    afterEach(async () => {
      // A request left unanswered would keep its sync running into the next test.
      answerHeldRequest();
      await vi.advanceTimersByTimeAsync(0);
      vi.useRealTimers();
      vi.unstubAllGlobals();
    });

    it('sends one request for one local change, though merging the reply writes to storage', async () => {
      StorageService.addXP(10);
      await waitAWhile();

      // The sync went through and merged the server's deck in...
      expect(CloudSyncService.getConfig().status).toBe('synced');
      expect(StorageService.getSessions().map(s => s.id)).toContain('deck-from-laptop');
      // ...and those writes didn't set off more syncs.
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('sends one request for several writes in a row', async () => {
      StorageService.addXP(10);
      StorageService.addXP(10);
      StorageService.addXP(10);
      await waitAWhile();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(xpSentIn(0)).toBe(30);
    });

    it('syncs once more for a change made while a request was out', async () => {
      holdNextRequest();
      StorageService.addXP(10);
      await vi.runOnlyPendingTimersAsync();
      expect(fetchMock).toHaveBeenCalledTimes(1);

      StorageService.addXP(10); // the user keeps studying while the server works
      answerHeldRequest();
      await waitAWhile();

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(xpSentIn(1)).toBe(20);
    });

    it('waits for a slow request before syncing what changed meanwhile, once', async () => {
      holdNextRequest();
      StorageService.addXP(10);
      await vi.runOnlyPendingTimersAsync();

      // Two changes whose auto-syncs come due while the first request is still out.
      StorageService.addXP(10);
      await vi.runOnlyPendingTimersAsync();
      StorageService.addXP(10);
      await vi.runOnlyPendingTimersAsync();
      expect(fetchMock).toHaveBeenCalledTimes(1);

      answerHeldRequest();
      await waitAWhile();

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(xpSentIn(1)).toBe(30);
    });
  });
});
