import { describe, it, expect, beforeEach } from 'vitest';
import { CloudSyncService } from './cloudSyncService';

describe('CloudSyncService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

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

  it('includes 3D character and legacy state in createSyncPayload', () => {
    const mockCharacter = {
      name: 'Dr. Turing',
      hairStyle: 'quiff',
      hairColor: '#4b2e1e',
      gender: 'male',
      coins: 450,
    };
    localStorage.setItem('studify_user_character_v1', JSON.stringify(mockCharacter));

    const payload = CloudSyncService.createSyncPayload();
    expect(payload.characterState).toEqual(mockCharacter);
    expect(payload.version).toBe(2);
    expect(payload.checksum).toBeDefined();
  });

  it('restores axolotl sanctuary state and merges stats properly in mergeRemoteData', () => {
    const remotePayload = {
      version: 2,
      syncedAt: Date.now(),
      userId: 'test_user',
      checksum: 'abc123',
      sessions: [],
      stats: {
        totalStudyMinutes: 120,
        currentStreak: 7,
        longestStreak: 10,
        conceptsMastered: 15,
        sessionsCompleted: 12,
        xp: 950,
        todayMinutes: 20,
        lastStudyDate: new Date().toISOString(),
      },
      characterState: {
        name: 'Ada Lovelace',
        coins: 888,
        hairStyle: 'twin-braids',
      },
      axolotlState: {
        level: 8,
        xp: 750,
        decorations: ['golden_coral'],
      },
    };

    CloudSyncService.mergeRemoteData(remotePayload as any);

    const charStored = JSON.parse(localStorage.getItem('studify_user_character_v1') || '{}');
    expect(charStored.name).toBe('Ada Lovelace');
    expect(charStored.coins).toBe(888);

    const axolotlStored = JSON.parse(localStorage.getItem('studify_axolotl_sanctuary_v1') || '{}');
    expect(axolotlStored.level).toBe(8);
    expect(axolotlStored.decorations).toEqual(['golden_coral']);
  });
});
