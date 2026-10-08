import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CloudSyncService, type CloudSyncPayload } from './cloudSyncService';
import { characterService } from './characterService';
import { StorageService } from './storageService';
import { STARTING_COINS } from './economy/wallet';

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
});
