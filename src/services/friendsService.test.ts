import { describe, expect, it } from 'vitest';
import { formatCode, friendStatus, inviteCodeFrom, leaderboard, sortFriends, studiedToday, type Friend } from './friendsService';

// Local times, so the tests mean the same in any time zone.
const NOW = new Date(2026, 10, 22, 18, 0);
const at = (day: number, hour: number) => new Date(2026, 10, day, hour, 0).toISOString();
const friend = (name: string, extra: Partial<Friend> = {}): Friend => ({
  id: name,
  name,
  avatar: '🧠',
  pictureUrl: null,
  streak: 0,
  lastStudiedAt: null,
  todayMinutes: 0,
  weekXp: 0,
  friendsSince: at(1, 9),
  ...extra,
});

describe('friends', () => {
  it('tells whether a friend studied today where the viewer is', () => {
    expect(studiedToday(friend('a', { lastStudiedAt: at(22, 0) }), NOW)).toBe(true);
    expect(studiedToday(friend('a', { lastStudiedAt: at(21, 23) }), NOW)).toBe(false);
    expect(studiedToday(friend('a'), NOW)).toBe(false);
  });

  it('says when a friend last studied', () => {
    expect(friendStatus(friend('a', { lastStudiedAt: at(22, 9), todayMinutes: 25 }), NOW)).toBe('Studied today · 25 min');
    expect(friendStatus(friend('a', { lastStudiedAt: at(22, 9) }), NOW)).toBe('Studied today');
    expect(friendStatus(friend('a', { lastStudiedAt: at(21, 22) }), NOW)).toBe('Last studied yesterday');
    expect(friendStatus(friend('a', { lastStudiedAt: at(19, 8) }), NOW)).toBe('Last studied 3 days ago');
    expect(friendStatus(friend('a'), NOW)).toBe("Hasn't studied yet");
  });

  it('lists friends who studied today first, then by streak', () => {
    const list = [
      friend('Cy', { streak: 9, lastStudiedAt: at(21, 9) }),
      friend('Ana', { streak: 2, lastStudiedAt: at(22, 9) }),
      friend('Ben', { streak: 5, lastStudiedAt: at(22, 8) }),
    ];
    expect(sortFriends(list, NOW).map(f => f.name)).toEqual(['Ben', 'Ana', 'Cy']);
  });

  it('reads codes from invite links and shows them in two halves', () => {
    expect(inviteCodeFrom('?friend=k7m2qx9p')).toBe('K7M2QX9P');
    expect(inviteCodeFrom('?friend=<script>')).toBeNull();
    expect(inviteCodeFrom('?view=focus')).toBeNull();
    expect(formatCode('K7M2QX9P')).toBe('K7M2-QX9P');
  });

  it('ranks you and your friends by XP this week', () => {
    const rows = leaderboard([friend('Ana', { weekXp: 120 }), friend('Ben', { weekXp: 300, streak: 1 }), friend('Cy', { weekXp: 120, streak: 4 })], { id: 'me', name: 'You', weekXp: 150, streak: 2 });
    expect(rows.map(r => [r.name, r.isYou])).toEqual([['Ben', false], ['You', true], ['Cy', false], ['Ana', false]]);
  });
});
