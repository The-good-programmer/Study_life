import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StorageService } from './storageService';
import { IndexedDbService } from './indexedDbService';
import type { RetrievalCard } from '../types';

describe('StorageService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initializes default stats correctly', () => {
    const stats = StorageService.getStats();
    expect(stats.level).toBe(1);
    expect(stats.levelTitle).toBe('Synapse Builder');
    expect(stats.xp).toBe(0);
    expect(stats.todayMinutes).toBe(0);
  });

  it('updates XP and recalculates level correctly', () => {
    const statsBefore = StorageService.getStats();
    expect(statsBefore.level).toBe(1);

    // 150 XP per level
    StorageService.addXP(350);

    const statsAfter = StorageService.getStats();
    expect(statsAfter.xp).toBe(350);
    expect(statsAfter.level).toBe(3); // floor(350 / 150) + 1 = 3
    expect(statsAfter.levelTitle).toBe('Active Retrievist');
  });

  it('tracks weekly XP correctly and maintains personal best', () => {
    StorageService.addWeeklyXP(120);
    let weekly = StorageService.getWeeklyXP();
    expect(weekly.current).toBe(120);
    expect(weekly.best).toBe(120);

    StorageService.addWeeklyXP(80);
    weekly = StorageService.getWeeklyXP();
    expect(weekly.current).toBe(200);
    expect(weekly.best).toBe(200);
  });

  it('toggles card bookmark star status correctly', () => {
    const cardId = 'card-test-starred-1';
    
    // First toggle: stars the card
    const isStarred1 = StorageService.toggleCardStar(cardId);
    expect(isStarred1).toBe(true);
    expect(StorageService.isCardStarred(cardId)).toBe(true);

    // Second toggle: unstars the card
    const isStarred2 = StorageService.toggleCardStar(cardId);
    expect(isStarred2).toBe(false);
    expect(StorageService.isCardStarred(cardId)).toBe(false);
  });

  it('stores and retrieves sound preferences safely', () => {
    expect(StorageService.getSoundPreference()).toBe('binaural-40hz');

    StorageService.setSoundPreference('rain');
    expect(StorageService.getSoundPreference()).toBe('rain');

    StorageService.setSoundPreference('off');
    expect(StorageService.getSoundPreference()).toBe('off');
  });

  it('automatically syncs cards from saved sessions into global cards queue', () => {
    expect(StorageService.getAllCards().length).toBe(0);

    const mockSession = {
      id: 'session-test-sync-1',
      title: 'Neurobiology of Memory',
      category: 'Neuroscience',
      description: 'Test session',
      currentConceptIndex: 0,
      currentPhase: 'priming' as const,
      elapsedSeconds: 0,
      createdAt: new Date().toISOString(),
      concepts: [
        {
          id: 'c-1',
          order: 1,
          title: 'Synaptic Plasticity',
          estimatedMinutes: 10,
          mentalModel: 'Synapses strengthen with use.',
          coreTakeaways: ['LTP strengthens synapses', 'LTD weakens them'],
          keyTerms: [{ term: 'LTP', definition: 'Long-term potentiation' }],
          feynmanPrompt: 'Explain LTP.',
          sampleMasteryExplanation: 'LTP explanation.',
          retrievalCards: [
            {
              id: 'rc-sync-1',
              conceptId: 'c-1',
              cardType: 'standard' as const,
              question: 'What is LTP?',
              answer: 'Long-term potentiation',
              stability: 1,
              difficulty: 5,
              reps: 0,
              lapses: 0,
            },
            {
              id: 'rc-sync-2',
              conceptId: 'c-1',
              cardType: 'cloze' as const,
              question: 'The process of {{LTP}} strengthens synapses.',
              answer: 'LTP',
              stability: 1,
              difficulty: 5,
              reps: 0,
              lapses: 0,
            }
          ]
        }
      ]
    };

    StorageService.saveSession(mockSession);

    // Cards should now be automatically discoverable in getAllCards()
    const allCards = StorageService.getAllCards();
    expect(allCards.length).toBe(2);
    expect(allCards.map(c => c.id)).toContain('rc-sync-1');
    expect(allCards.map(c => c.id)).toContain('rc-sync-2');

    // Deleting the session should clean up its cards
    StorageService.deleteSession('session-test-sync-1');
    expect(StorageService.getAllCards().length).toBe(0);
  });

  it('does not increment streak on day change without active study (no free lunch)', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const initialStats = {
      totalStudyMinutes: 20,
      sessionsCompleted: 1,
      conceptsMastered: 1,
      currentStreak: 3,
      lastActiveDate: yesterday,
      cardsDueCount: 0,
      xp: 100,
      level: 1,
      levelTitle: 'Synapse Builder',
      dailyGoalMinutes: 25,
      todayMinutes: 20,
    };
    localStorage.setItem('studify_stats_v1', JSON.stringify(initialStats));

    // Calling getStats on the new day should reset todayMinutes, but NOT increment currentStreak
    const stats = StorageService.getStats();
    expect(stats.currentStreak).toBe(3);
    expect(stats.todayMinutes).toBe(0);

    // Active study today should advance the streak
    StorageService.recordStudyMinutes(10);
    const updatedStats = StorageService.getStats();
    expect(updatedStats.currentStreak).toBe(4);
    expect(updatedStats.todayMinutes).toBe(10);
  });

  it('resets streak to 0 when a day is missed without synaptic freeze', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const initialStats = {
      totalStudyMinutes: 50,
      sessionsCompleted: 2,
      conceptsMastered: 2,
      currentStreak: 5,
      lastActiveDate: twoDaysAgo,
      cardsDueCount: 0,
      xp: 200,
      level: 2,
      levelTitle: 'Deep Worker',
      dailyGoalMinutes: 25,
      todayMinutes: 25,
    };
    localStorage.setItem('studify_stats_v1', JSON.stringify(initialStats));

    // User missed yesterday and has no freeze -> streak resets to 0
    const stats = StorageService.getStats();
    expect(stats.currentStreak).toBe(0);
    expect(stats.todayMinutes).toBe(0);
  });

  it('shields streak for 1 missed day and consumes synaptic freeze', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const initialStats = {
      totalStudyMinutes: 50,
      sessionsCompleted: 2,
      conceptsMastered: 2,
      currentStreak: 5,
      lastActiveDate: twoDaysAgo,
      cardsDueCount: 0,
      xp: 200,
      level: 2,
      levelTitle: 'Deep Worker',
      dailyGoalMinutes: 25,
      todayMinutes: 25,
    };
    localStorage.setItem('studify_stats_v1', JSON.stringify(initialStats));
    StorageService.setSynapticFreeze(true);
    expect(StorageService.hasSynapticFreeze()).toBe(true);

    // Missed 1 day with freeze equipped: streak preserved, freeze consumed
    const stats = StorageService.getStats();
    expect(stats.currentStreak).toBe(5);
    expect(StorageService.hasSynapticFreeze()).toBe(false);

    // Studying today should extend the streak from 5 to 6
    StorageService.recordCompletedSession();
    expect(StorageService.getStats().currentStreak).toBe(6);
  });

  it('returns exact count of cards reviewed today with getReviewedTodayCount', () => {
    expect(StorageService.getReviewedTodayCount()).toBe(0);

    const today = new Date().toISOString();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const card1 = {
      id: 'c-rev-1',
      conceptId: 'c-1',
      cardType: 'standard' as const,
      question: 'Q1',
      answer: 'A1',
      stability: 1,
      difficulty: 5,
      reps: 1,
      lapses: 0,
      lastReviewDate: today,
    };

    const card2 = {
      id: 'c-rev-2',
      conceptId: 'c-1',
      cardType: 'standard' as const,
      question: 'Q2',
      answer: 'A2',
      stability: 1,
      difficulty: 5,
      reps: 1,
      lapses: 0,
      lastReviewDate: yesterday,
    };

    StorageService.saveCard(card1);
    StorageService.saveCard(card2);

    expect(StorageService.getReviewedTodayCount()).toBe(1);
  });

  it('non-destructively merges guest sessions, cards, and stats to existing user account', () => {
    const userId = 'usr_target_123';

    // 1. Setup existing user account data
    const existingUserSessions = [
      {
        id: 'user-deck-1',
        title: 'User Existing Chemistry',
        subject: 'Science',
        concepts: [],
        createdAt: new Date().toISOString(),
      },
    ];
    localStorage.setItem(`studify_sessions_v1_${userId}`, JSON.stringify(existingUserSessions));

    const existingUserStats = {
      xp: 500,
      level: 4,
      levelTitle: 'Active Retrievist',
      currentStreak: 4,
      sessionsCompleted: 3,
      conceptsMastered: 6,
      totalStudyMinutes: 45,
      todayMinutes: 10,
      lastActiveDate: '2026-10-03',
      cardsDueCount: 0,
      dailyGoalMinutes: 20,
    };
    localStorage.setItem(`studify_stats_v1_${userId}`, JSON.stringify(existingUserStats));

    // 2. Setup guest data
    const guestSessions = [
      {
        id: 'guest-deck-1',
        title: 'Guest Biology Deck',
        subject: 'Biology',
        concepts: [
          {
            id: 'con-1',
            title: 'Cell Division',
            explanation: 'Mitosis vs Meiosis',
            retrievalCards: [
              {
                id: 'card-g-1',
                conceptId: 'con-1',
                cardType: 'standard' as const,
                question: 'What is Mitosis?',
                answer: 'Nuclear division',
                stability: 2,
                difficulty: 5,
                reps: 2,
                lapses: 0,
              },
            ],
          },
        ],
        createdAt: new Date().toISOString(),
      },
    ];
    localStorage.setItem('studify_sessions_v1', JSON.stringify(guestSessions));

    const guestStats = {
      xp: 250,
      level: 2,
      levelTitle: 'Deep Worker',
      currentStreak: 2,
      sessionsCompleted: 1,
      conceptsMastered: 2,
      totalStudyMinutes: 20,
      todayMinutes: 15,
      lastActiveDate: '2026-10-04',
      cardsDueCount: 0,
      dailyGoalMinutes: 20,
    };
    localStorage.setItem('studify_stats_v1', JSON.stringify(guestStats));

    // 3. Execute migration
    const result = StorageService.migrateGuestDataToUser(userId);
    expect(result.migratedDecks).toBe(1);
    expect(result.migratedXP).toBe(250);

    // 4. Verify existing user sessions were NOT erased, but merged
    const mergedUserSessionsRaw = localStorage.getItem(`studify_sessions_v1_${userId}`);
    const mergedUserSessions = JSON.parse(mergedUserSessionsRaw || '[]');
    expect(mergedUserSessions.length).toBe(2);
    expect(mergedUserSessions.some((s: any) => s.id === 'user-deck-1')).toBe(true);
    expect(mergedUserSessions.some((s: any) => s.id === 'guest-deck-1')).toBe(true);

    // 5. Verify stats were merged non-destructively (cumulative XP = 500 + 250 = 750)
    const mergedUserStatsRaw = localStorage.getItem(`studify_stats_v1_${userId}`);
    const mergedUserStats = JSON.parse(mergedUserStatsRaw || '{}');
    expect(mergedUserStats.xp).toBe(750);
    expect(mergedUserStats.totalStudyMinutes).toBe(65); // 45 + 20
    expect(mergedUserStats.sessionsCompleted).toBe(4);   // 3 + 1
    expect(mergedUserStats.currentStreak).toBe(4);       // max(4, 2)
    expect(mergedUserStats.lastActiveDate).toBe('2026-10-04');

    // 6. Verify cards were migrated to user's cards queue
    const mergedCardsRaw = localStorage.getItem(`studify_cards_v1_${userId}`);
    const mergedCards = JSON.parse(mergedCardsRaw || '[]');
    expect(mergedCards.some((c: any) => c.id === 'card-g-1')).toBe(true);

    // 7. Verify guest storage was cleared to prevent duplicate ghost data
    expect(localStorage.getItem('studify_sessions_v1')).toBeNull();
    expect(localStorage.getItem('studify_stats_v1')).toBeNull();
  });

  describe('Subject Folders', () => {
    it('creates, retrieves, and updates subject folders', () => {
      expect(StorageService.getFolders()).toEqual([]);

      const folder = StorageService.createFolder('Neuroscience 101', 'purple', '🧠', 'Brain anatomy & synapses');
      expect(folder.id).toBeDefined();
      expect(folder.name).toBe('Neuroscience 101');
      expect(folder.color).toBe('purple');
      expect(folder.icon).toBe('🧠');
      expect(folder.description).toBe('Brain anatomy & synapses');

      const all = StorageService.getFolders();
      expect(all.length).toBe(1);
      expect(all[0].name).toBe('Neuroscience 101');

      // Update folder
      const updated = StorageService.updateFolder(folder.id, { name: 'Advanced Neuroscience', color: 'indigo' });
      expect(updated?.name).toBe('Advanced Neuroscience');
      expect(updated?.color).toBe('indigo');
      expect(StorageService.getFolders()[0].name).toBe('Advanced Neuroscience');
    });

    it('assigns and removes decks from folders using setDeckFolder', () => {
      const folder = StorageService.createFolder('Biology', 'emerald', '🧬');
      const session: any = {
        id: 'test-session-bio-1',
        title: 'Cell Division',
        category: 'Science',
        concepts: [],
        currentConceptIndex: 0,
        currentPhase: 'priming',
        elapsedSeconds: 0,
        createdAt: new Date().toISOString(),
      };
      StorageService.saveSession(session);

      // Assign to folder
      StorageService.setDeckFolder('test-session-bio-1', folder.id);
      let loadedSession = StorageService.getSessions().find(s => s.id === 'test-session-bio-1');
      expect(loadedSession?.folderId).toBe(folder.id);

      // Remove from folder
      StorageService.setDeckFolder('test-session-bio-1', null);
      loadedSession = StorageService.getSessions().find(s => s.id === 'test-session-bio-1');
      expect(loadedSession?.folderId).toBeUndefined();
    });

    it('deleting a folder unassigns the folder from decks without deleting the decks', () => {
      const folder = StorageService.createFolder('Physics', 'sky', '⚛️');
      const session: any = {
        id: 'test-session-phys-1',
        title: 'Classical Mechanics',
        category: 'Physics',
        folderId: folder.id,
        concepts: [],
        currentConceptIndex: 0,
        currentPhase: 'priming',
        elapsedSeconds: 0,
        createdAt: new Date().toISOString(),
      };
      StorageService.saveSession(session);

      expect(StorageService.getFolders().length).toBe(1);
      expect(StorageService.getSessions().find(s => s.id === 'test-session-phys-1')?.folderId).toBe(folder.id);

      // Delete folder
      StorageService.deleteFolder(folder.id);

      expect(StorageService.getFolders().length).toBe(0);
      // The deck MUST still exist!
      const deckAfterDelete = StorageService.getSessions().find(s => s.id === 'test-session-phys-1');
      expect(deckAfterDelete).toBeDefined();
      expect(deckAfterDelete?.folderId).toBeUndefined();
    });

    it('exports and imports subject folders in JSON backup', () => {
      const folder = StorageService.createFolder('Chemistry', 'amber', '🧪');
      const session: any = {
        id: 'test-chem-1',
        title: 'Periodic Table',
        category: 'Chemistry',
        folderId: folder.id,
        concepts: [],
        currentConceptIndex: 0,
        currentPhase: 'priming',
        elapsedSeconds: 0,
        createdAt: new Date().toISOString(),
      };
      StorageService.saveSession(session);

      const json = StorageService.exportAllDataAsJSON();
      expect(json).toContain('"name": "Chemistry"');
      expect(json).toContain('"folderId": "' + folder.id + '"');

      // Clear storage
      localStorage.clear();
      expect(StorageService.getFolders().length).toBe(0);
      expect(StorageService.getSessions().length).toBe(0);

      // Restore
      const res = StorageService.importDataFromJSON(json);
      expect(res.success).toBe(true);
      expect(StorageService.getFolders().length).toBe(1);
      expect(StorageService.getFolders()[0].name).toBe('Chemistry');
      expect(StorageService.getSessions().find(s => s.id === 'test-chem-1')?.folderId).toBe(folder.id);
    });

    it('synthesizes longitudinal student cognitive memory profile correctly', () => {
      // Empty state
      const initialProfile = StorageService.getCognitiveMemoryProfile();
      expect(initialProfile.totalCards).toBe(0);
      expect(initialProfile.masteredCards).toBe(0);
      expect(initialProfile.strugglingCards).toBe(0);

      // Save a session with structured cards
      const testSession: any = {
        id: 'session-memory-test',
        title: 'Neurology & Synapses',
        category: 'Medical',
        description: 'Neurophysiology deck',
        currentConceptIndex: 0,
        currentPhase: 'retrieval',
        elapsedSeconds: 120,
        createdAt: new Date().toISOString(),
        concepts: [
          {
            id: 'c-1',
            order: 1,
            title: 'Synaptic Transmission',
            estimatedMinutes: 10,
            mentalModel: 'Electrical to chemical bridge',
            coreTakeaways: ['Action potential triggers calcium influx', 'Vesicle fusion releases neurotransmitter'],
            keyTerms: [{ term: 'SNARE', definition: 'Fusion protein complex' }],
            feynmanPrompt: 'Explain vesicle fusion simply',
            sampleMasteryExplanation: 'Action potential depolarizes terminal...',
            retrievalCards: [
              {
                id: 'card-mastered-1',
                conceptId: 'c-1',
                question: 'What ion triggers exocytosis?',
                answer: 'Calcium (Ca2+)',
                stability: 30,
                difficulty: 3,
                reps: 4,
                lapses: 0,
              },
              {
                id: 'card-struggling-1',
                conceptId: 'c-1',
                question: 'Which protein binds calcium during fusion?',
                answer: 'Synaptotagmin',
                stability: 1.5,
                difficulty: 8,
                reps: 5,
                lapses: 3,
                diagnosticDistractors: [
                  {
                    optionText: 'Synaptobrevin',
                    trapType: 'semantic-twin',
                    trapExplanation: 'Confused with v-SNARE',
                  },
                ],
              },
            ],
          },
        ],
      };

      StorageService.saveSession(testSession);

      const profile = StorageService.getCognitiveMemoryProfile();
      expect(profile.totalCards).toBe(2);
      expect(profile.masteredCards).toBe(1);
      expect(profile.strugglingCards).toBe(1);
      expect(profile.frequentLapseConcepts.length).toBeGreaterThan(0);
      expect(profile.vulnerableTrapTypes).toContain('semantic-twin');
      expect(profile.averageStabilityDays).toBeGreaterThan(0);
    });
  });
});


describe('StorageService localStorage overflow', () => {
  const idb = new Map<string, string>();

  beforeEach(() => {
    localStorage.clear();
    idb.clear();
    vi.restoreAllMocks();
    vi.spyOn(IndexedDbService, 'isSupported').mockReturnValue(true);
    vi.spyOn(IndexedDbService, 'setItem').mockImplementation(async (k, v) => { idb.set(k, v); return true; });
    vi.spyOn(IndexedDbService, 'getItem').mockImplementation(async (k) => idb.get(k) ?? null);
    vi.spyOn(IndexedDbService, 'removeItem').mockImplementation(async (k) => { idb.delete(k); return true; });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    StorageService.setActiveUserId(null); // resets in-memory overflow between tests
  });

  const fillQuota = () => {
    const real = localStorage.setItem.bind(localStorage);
    return vi.spyOn(localStorage, 'setItem').mockImplementation((k: string, v: string) => {
      if (k.startsWith('studify_cards_v1')) throw new DOMException('full', 'QuotaExceededError');
      real(k, v);
    });
  };

  const card = (id: string) => ({ id, front: 'q', back: 'a' }) as unknown as RetrievalCard;

  it('keeps cards written after localStorage fills up, and serves the newest copy', () => {
    StorageService.saveCards([card('old')]);
    const spy = fillQuota();
    StorageService.saveCards([card('old'), card('new')]);
    expect(StorageService.getAllCards().map(c => c.id)).toEqual(expect.arrayContaining(['old', 'new']));
    spy.mockRestore();
  });

  it('restores spilled cards from IndexedDB after a reload', async () => {
    const spy = fillQuota();
    StorageService.saveCards([card('spilled')]);
    await Promise.resolve();
    spy.mockRestore();

    // Simulate a fresh page load: in-memory overflow is gone, IndexedDB survives.
    StorageService.setActiveUserId(null);
    expect(idb.size).toBe(1);
    await StorageService.hydrateOverflow();
    expect(StorageService.getAllCards().map(c => c.id)).toEqual(['spilled']);
  });

  it('drops the spilled copy once a write fits again', async () => {
    const spy = fillQuota();
    StorageService.saveCards([card('a')]);
    spy.mockRestore();
    StorageService.saveCards([card('b')]);
    await Promise.resolve();
    expect(idb.size).toBe(0);
    expect(StorageService.getAllCards().map(c => c.id)).toEqual(expect.arrayContaining(['a', 'b']));
  });
});

describe('StorageService deck edits', () => {
  beforeEach(() => {
    localStorage.clear();
    StorageService.setActiveUserId(null);
  });

  const card = (id: string) => ({ id, conceptId: 'k', question: `Q ${id}`, answer: `A ${id}`, stability: 1, difficulty: 5, reps: 0, lapses: 0 }) as RetrievalCard;
  const deckWith = (id: string, ids: string[]) =>
    ({ id, title: id, concepts: [{ id: 'k', title: 'K', retrievalCards: ids.map(card) }] }) as never;
  const queueIds = () => StorageService.getAllCards().map(c => c.id).sort();

  it('takes cards removed from a deck out of the review queue', () => {
    StorageService.saveSession(deckWith('deck', ['a', 'b', 'c']));
    expect(queueIds()).toEqual(['a', 'b', 'c']);
    StorageService.saveSession(deckWith('deck', ['a', 'c']));
    expect(queueIds()).toEqual(['a', 'c']);
  });

  it('replaces a card inside its deck, so the new cards are studied and the old one is gone', () => {
    StorageService.saveSession(deckWith('deck', ['a', 'hard', 'c']));
    StorageService.replaceCard('hard', [card('hard-1'), card('hard-2')]);
    const deck = StorageService.getSessions().find(s => s.id === 'deck')!;
    expect(deck.concepts[0].retrievalCards.map(c => c.id)).toEqual(['a', 'hard-1', 'hard-2', 'c']);
    expect(queueIds()).toEqual(['a', 'c', 'hard-1', 'hard-2']);
  });

  it('keeps a card that another deck still uses', () => {
    StorageService.saveSession(deckWith('one', ['a', 'shared']));
    StorageService.saveSession(deckWith('two', ['shared']));
    StorageService.saveSession(deckWith('one', ['a']));
    expect(queueIds()).toEqual(['a', 'shared']);
    StorageService.deleteSession('two');
    expect(queueIds()).toEqual(['a']);
  });
});

describe('StorageService review progress', () => {
  beforeEach(() => {
    localStorage.clear();
    StorageService.setActiveUserId(null);
  });

  const card = (id: string) => ({ id, conceptId: 'k', question: `Q ${id}`, answer: `A ${id}`, stability: 1, difficulty: 5, reps: 0, lapses: 0 }) as RetrievalCard;
  const deckWith = (id: string, ids: string[]) =>
    ({ id, title: id, concepts: [{ id: 'k', title: 'K', retrievalCards: ids.map(card) }] }) as never;
  const reviewed = (id: string) => ({ ...card(id), reps: 3, lapses: 1, stability: 12, nextReviewDate: '2026-10-19T09:00:00.000Z' });

  it('keeps reviews made while a study session held the deck in memory', () => {
    StorageService.saveSession(deckWith('deck', ['a', 'b']));
    const inMemory = StorageService.getSessions().find(s => s.id === 'deck')!;
    // A review saves its card on its own; the session then saves the deck it loaded earlier.
    StorageService.saveCard(reviewed('a'));
    StorageService.saveSession({ ...inMemory, currentConceptIndex: 1 });

    const stored = StorageService.getSessions().find(s => s.id === 'deck')!;
    expect(stored.currentConceptIndex).toBe(1);
    expect(stored.concepts[0].retrievalCards[0]).toMatchObject({ reps: 3, lapses: 1, stability: 12 });
    expect(StorageService.getAllCards().find(c => c.id === 'a')).toMatchObject({ reps: 3, stability: 12 });
  });

  it('tells listeners when a review is saved, so due counts elsewhere can refresh', () => {
    StorageService.saveSession(deckWith('deck', ['a']));
    const listener = vi.fn();
    const unsubscribe = StorageService.addMutationListener(listener);
    StorageService.saveCard(reviewed('a'));
    StorageService.toggleCardStar('a');
    unsubscribe();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('gives an older copy of a card, or of a deck, the saved progress and keeps its content', () => {
    StorageService.saveSession(deckWith('deck', ['a', 'b']));
    const olderDeck = StorageService.getSessions().find(s => s.id === 'deck')!;
    StorageService.saveCard(reviewed('a'));

    expect(StorageService.withLatestProgress({ ...card('a'), question: 'Edited' })).toMatchObject({
      question: 'Edited',
      reps: 3,
      lapses: 1,
      stability: 12,
    });
    const [a, b] = StorageService.deckWithLatestProgress(olderDeck).concepts[0].retrievalCards;
    expect(a).toMatchObject({ reps: 3, nextReviewDate: '2026-10-19T09:00:00.000Z' });
    expect(b).toMatchObject({ reps: 0 });
  });
});

describe('StorageService profile data', () => {
  const idb = new Map<string, string>();

  beforeEach(() => {
    localStorage.clear();
    idb.clear();
    vi.restoreAllMocks();
    vi.spyOn(IndexedDbService, 'isSupported').mockReturnValue(true);
    vi.spyOn(IndexedDbService, 'setItem').mockImplementation(async (k, v) => { idb.set(k, v); return true; });
    vi.spyOn(IndexedDbService, 'getItem').mockImplementation(async (k) => idb.get(k) ?? null);
    vi.spyOn(IndexedDbService, 'removeItem').mockImplementation(async (k) => { idb.delete(k); return true; });
    StorageService.setActiveUserId(null);
  });

  const folder = (id: string, name: string) => ({ id, name, color: 'indigo', icon: '📚', description: '', createdAt: '2026-10-01T00:00:00.000Z' });
  const earning = (id: string) => ({ id, at: '2026-10-07T09:00:00.000Z', day: '2026-10-07', kind: 'exam', rawXp: 10, rawTokens: 20, paidXp: 10, paidTokens: 20 });

  it("carries guest subjects and today's earnings into the account on sign-in", () => {
    const userId = 'usr_1';
    localStorage.setItem('studify_folders_v1', JSON.stringify([folder('f-guest', 'Biology')]));
    localStorage.setItem('studify_earnings_v1', JSON.stringify([earning('e-guest')]));
    localStorage.setItem(`studify_folders_v1_${userId}`, JSON.stringify([folder('f-user', 'History')]));

    StorageService.migrateGuestDataToUser(userId);

    const folders = JSON.parse(localStorage.getItem(`studify_folders_v1_${userId}`) || '[]');
    expect(folders.map((f: { id: string }) => f.id).sort()).toEqual(['f-guest', 'f-user']);
    const earnings = JSON.parse(localStorage.getItem(`studify_earnings_v1_${userId}`) || '[]');
    expect(earnings.map((e: { id: string }) => e.id)).toEqual(['e-guest']);
    expect(localStorage.getItem('studify_folders_v1')).toBeNull();
    expect(localStorage.getItem('studify_earnings_v1')).toBeNull();
  });

  it("resets only the active profile's study data, keeping preferences and other profiles", async () => {
    StorageService.setActiveUserId('usr_a');
    StorageService.saveSession({ id: 'deck-a', title: 'A', concepts: [] } as never);
    StorageService.saveFolders([folder('f-a', 'Chemistry')]);
    StorageService.setApiKey('key-123');
    StorageService.saveEarnings([earning('e-a')]);
    localStorage.setItem('studify_sessions_v1_usr_b', '[{"id":"deck-b"}]');
    idb.set('overflow:studify_cards_v1_usr_a', '[]');

    await StorageService.clearStudyData();

    expect(StorageService.getSessions()).toEqual([]);
    expect(StorageService.getFolders()).toEqual([]);
    expect(idb.has('overflow:studify_cards_v1_usr_a')).toBe(false);
    expect(StorageService.getApiKey()).toBe('key-123');
    // Today's pay caps still count what was earned before the reset.
    expect(StorageService.getEarnings().map(e => e.id)).toEqual(['e-a']);
    expect(localStorage.getItem('studify_sessions_v1_usr_b')).toBe('[{"id":"deck-b"}]');
  });

  it("removes a deleted account's subjects too", () => {
    localStorage.setItem('studify_folders_v1_usr_gone', JSON.stringify([folder('f-1', 'Physics')]));
    StorageService.purgeUserData('usr_gone');
    expect(localStorage.getItem('studify_folders_v1_usr_gone')).toBeNull();
  });
});
