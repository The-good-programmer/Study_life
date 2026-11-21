import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CloudSyncService, type CloudSyncPayload } from './cloudSyncService';
import { characterService } from './characterService';
import { StorageService } from './storageService';
import { PlannerService } from './plannerService';
import { FocusService } from './focusService';
import { ApiConfig } from './apiConfig';
import { STARTING_COINS } from './economy/wallet';
import type { RetrievalCard, StudySession } from '../types';

const USER = 'usr_sync';

/**
 * Stands in for the Studify server's /api/sync routes, with the same rules: decks stored per id
 * (and deleted by id), one document per kind replaced on each push, and `since` on pull.
 */
class FakeServer {
  sessions = new Map<string, { data: StudySession; savedAt: number }>();
  documents: Record<string, unknown> = {};
  stats: unknown = null;
  character: unknown = null;
  clock = 1000;
  pushes: Record<string, unknown>[] = [];

  handle = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input), 'http://studify.test');
    if (url.pathname === '/api/sync/pull') {
      const serverTime = ++this.clock;
      const since = Number(url.searchParams.get('since')) || 0;
      const sessions = [...this.sessions.values()].filter(s => s.savedAt > since).map(s => s.data);
      return Response.json({ success: true, serverTime, sessions, stats: this.stats, characterState: this.character, documents: this.documents });
    }
    if (url.pathname === '/api/sync/push') {
      const body = JSON.parse(String(init?.body));
      this.pushes.push(body);
      const now = ++this.clock;
      for (const deck of body.sessions ?? []) this.sessions.set(deck.id, { data: deck, savedAt: now });
      for (const id of body.deletedSessionIds ?? []) this.sessions.delete(id);
      Object.assign(this.documents, body.documents ?? {});
      if (body.stats) this.stats = body.stats;
      if (body.characterState) this.character = body.characterState;
      return Response.json({ success: true });
    }
    return new Response('Not found', { status: 404 });
  };
}

/** One device's browser storage, kept while another device is in use. */
type Device = Map<string, string>;

const saveDevice = (): Device => {
  const device: Device = new Map();
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)!;
    device.set(key, localStorage.getItem(key)!);
  }
  return device;
};

const switchToDevice = (device: Device) => {
  localStorage.clear();
  device.forEach((value, key) => localStorage.setItem(key, value));
  StorageService.setActiveUserId(USER);
};

/** A device signed in to the account, with nothing on it yet. */
const newDevice = (): Device => {
  localStorage.clear();
  localStorage.setItem('studify_life_data_split_v1', '1');
  StorageService.setActiveUserId(USER);
  ApiConfig.setToken('test-token');
  return saveDevice();
};

/** Runs `work` on a device, then keeps what it changed. */
const onDevice = async (device: Device, work: () => void | Promise<void>): Promise<Device> => {
  switchToDevice(device);
  await work();
  return saveDevice();
};

const card = (id: string): RetrievalCard =>
  ({ id, question: `Q ${id}`, answer: `A ${id}`, stability: 0, difficulty: 5, reps: 0, lapses: 0 }) as unknown as RetrievalCard;

const deck = (id: string, cards: RetrievalCard[] = [card(`${id}-c1`)]): StudySession =>
  ({
    id,
    title: `Deck ${id}`,
    category: 'Biology',
    description: '',
    currentConceptIndex: 0,
    currentPhase: 'summary',
    elapsedSeconds: 0,
    createdAt: '2026-11-01T09:00:00.000Z',
    concepts: [{ id: `${id}-concept`, title: 'Cells', retrievalCards: cards }],
  }) as unknown as StudySession;

describe('account sync', () => {
  let server: FakeServer;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('studify_life_data_split_v1', '1');
    StorageService.setActiveUserId(null);
    ApiConfig.setToken(null);
    server = new FakeServer();
    vi.stubGlobal('fetch', vi.fn(server.handle));
    vi.stubGlobal('navigator', { onLine: true }); // Node's navigator has no onLine, which reads as offline
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    StorageService.setActiveUserId(null);
    ApiConfig.setToken(null);
  });

  it("doesn't sync guests", async () => {
    const result = await CloudSyncService.syncNow();
    expect(result.success).toBe(false);
    expect(result.message).toContain('Sign in');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('brings everything made on one device to another', async () => {
    let laptop = newDevice();
    let phone = newDevice();

    laptop = await onDevice(laptop, async () => {
      StorageService.saveSession(deck('bio'));
      StorageService.createFolder('Biology');
      PlannerService.add({ kind: 'exam', title: 'Biology midterm', date: '2026-12-01' });
      FocusService.addTask('Read chapter 4');
      FocusService.saveNotes('Ask about mitosis');
      expect((await CloudSyncService.syncNow()).success).toBe(true);
    });

    phone = await onDevice(phone, async () => {
      expect((await CloudSyncService.syncNow()).success).toBe(true);
      expect(StorageService.getSessions().map(d => d.id)).toEqual(['bio']);
      expect(StorageService.getFolders().map(f => f.name)).toEqual(['Biology']);
      expect(PlannerService.getItems().map(i => i.title)).toEqual(['Biology midterm']);
      expect(FocusService.getTasks().map(t => t.title)).toEqual(['Read chapter 4']);
      expect(FocusService.getNotes()).toBe('Ask about mitosis');
    });
    void laptop;
    void phone;
  });

  it('deletes on other devices what was deleted on one, for good', async () => {
    let laptop = newDevice();
    let phone = newDevice();
    let planId = '';

    laptop = await onDevice(laptop, async () => {
      StorageService.saveSession(deck('bio'));
      StorageService.saveSession(deck('chem'));
      planId = PlannerService.add({ kind: 'homework', title: 'Essay', date: '2026-11-25' }).id;
      await CloudSyncService.syncNow();
    });
    phone = await onDevice(phone, async () => {
      await CloudSyncService.syncNow();
      expect(StorageService.getSessions()).toHaveLength(2);
    });

    laptop = await onDevice(laptop, async () => {
      StorageService.deleteSession('chem');
      PlannerService.remove(planId);
      await CloudSyncService.syncNow();
    });
    expect([...server.sessions.keys()]).toEqual(['bio']);

    phone = await onDevice(phone, async () => {
      await CloudSyncService.syncNow();
      expect(StorageService.getSessions().map(d => d.id)).toEqual(['bio']);
      expect(PlannerService.getItems()).toEqual([]);
    });

    // The laptop syncs again: nothing comes back from the phone.
    await onDevice(laptop, async () => {
      await CloudSyncService.syncNow();
      expect(StorageService.getSessions().map(d => d.id)).toEqual(['bio']);
      expect(PlannerService.getItems()).toEqual([]);
    });
    void phone;
  });

  it('keeps the newer edit when both devices changed the same thing', async () => {
    let laptop = newDevice();
    let phone = newDevice();
    let taskId = '';
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-21T10:00:00Z'));

    laptop = await onDevice(laptop, async () => {
      taskId = FocusService.addTask('Essay')!.id;
      await CloudSyncService.syncNow();
    });
    phone = await onDevice(phone, () => CloudSyncService.syncNow().then(() => {}));

    vi.setSystemTime(new Date('2026-11-21T10:05:00Z'));
    laptop = await onDevice(laptop, () => void FocusService.updateTask(taskId, { title: 'Essay draft' }));
    vi.setSystemTime(new Date('2026-11-21T10:10:00Z'));
    phone = await onDevice(phone, async () => {
      FocusService.updateTask(taskId, { title: 'Essay final' });
      await CloudSyncService.syncNow();
    });

    await onDevice(laptop, async () => {
      await CloudSyncService.syncNow();
      expect(FocusService.getTasks().map(t => t.title)).toEqual(['Essay final']);
    });
    void phone;
  });

  it('keeps reviews done on either device', async () => {
    let laptop = newDevice();
    let phone = newDevice();
    const cards = [card('c1'), card('c2')];

    laptop = await onDevice(laptop, async () => {
      StorageService.saveSession(deck('bio', cards));
      await CloudSyncService.syncNow();
    });
    phone = await onDevice(phone, () => CloudSyncService.syncNow().then(() => {}));

    // c1 is reviewed on the laptop, c2 on the phone.
    laptop = await onDevice(laptop, async () => {
      StorageService.saveCard({ ...cards[0], reps: 1, stability: 3, lastReviewDate: '2026-11-20T10:00:00.000Z', nextReviewDate: '2026-11-23T10:00:00.000Z' });
      await CloudSyncService.syncNow();
    });
    phone = await onDevice(phone, async () => {
      StorageService.saveCard({ ...cards[1], reps: 2, stability: 5, lastReviewDate: '2026-11-21T10:00:00.000Z', nextReviewDate: '2026-11-26T10:00:00.000Z' });
      await CloudSyncService.syncNow();
      const progress = StorageService.getAllCards().map(c => [c.id, c.reps]);
      expect(progress).toEqual(expect.arrayContaining([['c1', 1], ['c2', 2]]));
    });
    await onDevice(laptop, async () => {
      await CloudSyncService.syncNow();
      const progress = StorageService.getAllCards().map(c => [c.id, c.reps]);
      expect(progress).toEqual(expect.arrayContaining([['c1', 1], ['c2', 2]]));
    });
    void phone;
  });

  it("doesn't send what hasn't changed", async () => {
    newDevice();
    StorageService.saveSession(deck('bio'));
    await CloudSyncService.syncNow();
    expect(server.pushes).toHaveLength(1);
    expect(server.pushes[0].sessions).toHaveLength(1);

    await CloudSyncService.syncNow();
    expect(server.pushes).toHaveLength(1);

    FocusService.addTask('New task');
    await CloudSyncService.syncNow();
    expect(server.pushes).toHaveLength(2);
    expect(server.pushes[1].sessions).toBeUndefined();
    expect(Object.keys(server.pushes[1].documents as object)).toEqual(['focus_tasks']);
  });

  it('waits for a connection instead of failing when the server is unreachable', async () => {
    newDevice();
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    const result = await CloudSyncService.syncNow();
    expect(result.success).toBe(false);
    expect(CloudSyncService.getConfig().status).toBe('queued');
  });

  it('syncs once, a few seconds after a burst of changes', async () => {
    newDevice();
    vi.useFakeTimers();
    StorageService.addXP(10);
    StorageService.addXP(10);
    StorageService.addXP(10);
    await vi.advanceTimersByTimeAsync(10_000);

    // One pull and one push, though merging the reply writes to storage.
    expect(vi.mocked(fetch).mock.calls.map(([url]) => String(url))).toEqual(['/api/sync/pull', '/api/sync/push']);
    expect((server.pushes[0].stats as { xp: number }).xp).toBe(30);
    expect(CloudSyncService.getConfig().status).toBe('synced');
  });
});

describe('what syncs of the avatar', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('studify_life_data_split_v1', '1');
    // Reloads the guest's avatar and wallet from the now empty storage.
    StorageService.setActiveUserId(null);
  });
  afterEach(() => StorageService.setActiveUserId(null));

  it('sends how the avatar looks, but not the wallet or level', () => {
    characterService.updateCustomization({ name: 'Dr. Turing', hairColor: '#4b2e1e', hairStyle: 'side-part' });
    characterService.addCoins(300);

    const payload = CloudSyncService.createSyncPayload();
    expect(payload.characterState).toMatchObject({ name: 'Dr. Turing', hairColor: '#4b2e1e', hairStyle: 'side-part' });
    expect(payload.characterState).not.toHaveProperty('coins');
    expect(payload.characterState).not.toHaveProperty('level');
  });

  it("sends the signed-in account's avatar", () => {
    StorageService.setActiveUserId(USER);
    characterService.updateCustomization({ name: 'Grace' });
    expect(CloudSyncService.createSyncPayload().characterState).toMatchObject({ name: 'Grace' });
  });

  it('takes only the avatar look from the server, never tokens or level', () => {
    const remote = {
      sessions: [],
      stats: { totalStudyMinutes: 120, currentStreak: 7, conceptsMastered: 15, sessionsCompleted: 12, xp: 950, todayMinutes: 20 },
      characterState: { name: 'Ada Lovelace', hairColor: '#123456', hairStyle: '<img src=x>', coins: 888888, level: 50, unlockedItems: ['crown'] },
    };

    CloudSyncService.mergeRemoteData(remote as unknown as CloudSyncPayload);

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
