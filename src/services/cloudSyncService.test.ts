import { describe, it, expect, beforeEach } from 'vitest';
import { CloudSyncService } from './cloudSyncService';

describe('CloudSyncService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('generates a valid formatted cryptographic sync token', () => {
    const token = CloudSyncService.generateSyncToken();
    expect(token).toBeDefined();
    expect(token.startsWith('LOTTI-SYNC-')).toBe(true);
    expect(token.length).toBeGreaterThan(15);
  });

  it('fails honestly when remote endpoint URL is not configured', async () => {
    CloudSyncService.saveConfig({
      enabled: true,
      cloudToken: 'LOTTI-SYNC-TEST-1234',
      endpointUrl: '',
    });

    const result = await CloudSyncService.syncNow();
    expect(result.success).toBe(false);
    expect(result.message).toContain('Cloud sync requires a remote server URL');
  });

  it('saves and reads sync configuration accurately', () => {
    const saved = CloudSyncService.saveConfig({
      enabled: true,
      cloudToken: 'LOTTI-SYNC-AAA-BBB',
      endpointUrl: 'https://example.com/sync',
      autoSyncOnReview: true,
    });

    expect(saved.enabled).toBe(true);
    expect(saved.cloudToken).toBe('LOTTI-SYNC-AAA-BBB');
    expect(saved.endpointUrl).toBe('https://example.com/sync');

    const retrieved = CloudSyncService.getConfig();
    expect(retrieved.cloudToken).toBe('LOTTI-SYNC-AAA-BBB');
    expect(retrieved.endpointUrl).toBe('https://example.com/sync');
  });
});
