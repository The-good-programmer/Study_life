import { ApiConfig } from './apiConfig';

/** What the app shows of a friend (the server sends nothing more). */
export interface Friend {
  id: string;
  name: string;
  avatar: string;
  pictureUrl: string | null;
  streak: number;
  lastStudiedAt: string | null;
  todayMinutes: number;
  /** XP earned this week (0 if none yet). */
  weekXp: number;
  friendsSince: string;
}

/** One row of the weekly leaderboard: a friend, or you. */
export interface LeaderboardRow {
  id: string;
  name: string;
  weekXp: number;
  streak: number;
  isYou: boolean;
  friend?: Friend;
}

export interface FriendsData {
  code: string;
  friends: Friend[];
}

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

/** An invite code from a link, kept while the visitor signs in. */
const PENDING_INVITE_KEY = 'studify_friend_invite';

const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());

const DAY_MS = 86_400_000;
const localMidnight = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** Whether the friend studied today, in the viewer's time zone. */
export const studiedToday = (friend: Pick<Friend, 'lastStudiedAt'>, now: Date = new Date()): boolean => {
  const last = Date.parse(friend.lastStudiedAt ?? '');
  return Number.isFinite(last) && last >= localMidnight(now);
};

/** "Studied today · 25 min", "Last studied yesterday", "Last studied 3 days ago" or "Hasn't studied yet". */
export const friendStatus = (friend: Friend, now: Date = new Date()): string => {
  const last = Date.parse(friend.lastStudiedAt ?? '');
  if (!Number.isFinite(last)) return "Hasn't studied yet";
  if (studiedToday(friend, now)) return friend.todayMinutes > 0 ? `Studied today · ${friend.todayMinutes} min` : 'Studied today';
  const days = Math.round((localMidnight(now) - localMidnight(new Date(last))) / DAY_MS);
  return days <= 1 ? 'Last studied yesterday' : `Last studied ${days} days ago`;
};

/** Friends who studied today first, then by streak, then by name. */
export const sortFriends = (friends: readonly Friend[], now: Date = new Date()): Friend[] =>
  [...friends].sort(
    (a, b) =>
      Number(studiedToday(b, now)) - Number(studiedToday(a, now)) ||
      b.streak - a.streak ||
      a.name.localeCompare(b.name),
  );

/** You and your friends by this week's XP, then streak, then name. */
export const leaderboard = (friends: readonly Friend[], you: { id: string; name: string; weekXp: number; streak: number }): LeaderboardRow[] =>
  [
    { id: you.id, name: you.name, weekXp: you.weekXp, streak: you.streak, isYou: true },
    ...friends.map(friend => ({ id: friend.id, name: friend.name, weekXp: friend.weekXp ?? 0, streak: friend.streak, isYou: false, friend })),
  ].sort((a, b) => b.weekXp - a.weekXp || b.streak - a.streak || a.name.localeCompare(b.name));

/** A code shown in two halves, K7M2-QX9P, so it is easy to read out. */
export const formatCode = (code: string): string => (code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code);

/** The code in an invite link (/?friend=K7M2QX9P), or null. */
export const inviteCodeFrom = (search: string): string | null => {
  const code = new URLSearchParams(search).get('friend');
  return code && /^[A-Za-z0-9-]{6,12}$/.test(code) ? code.toUpperCase() : null;
};

export class FriendsService {
  /** Your code and your friends. */
  public static async load(): Promise<Result<FriendsData>> {
    const res = await ApiConfig.request<FriendsData>('/friends');
    if (!res.ok || !res.data) return { ok: false, error: res.status === 0 ? "Couldn't reach Studify. Check your connection." : res.error || 'Something went wrong.' };
    return { ok: true, data: res.data };
  }

  /** Adds the friend with this code (you become each other's friends). */
  public static async add(code: string): Promise<Result<{ friend: Friend; alreadyFriends: boolean }>> {
    const res = await ApiConfig.request<{ friend: Friend; alreadyFriends: boolean }>('/friends/add', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
    if (!res.ok || !res.data) return { ok: false, error: res.status === 0 ? "Couldn't reach Studify. Check your connection." : res.error || 'Something went wrong.' };
    notify();
    return { ok: true, data: res.data };
  }

  public static async remove(friendId: string): Promise<Result<null>> {
    const res = await ApiConfig.request('/friends/remove', { method: 'POST', body: JSON.stringify({ friendId }) });
    if (!res.ok) return { ok: false, error: res.error || 'Something went wrong.' };
    notify();
    return { ok: true, data: null };
  }

  /** The link that opens Studify ready to add you. */
  public static inviteLink(code: string): string {
    return `${window.location.origin}/?friend=${code}`;
  }

  /** Called whenever friends are added or removed. */
  public static subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  public static savePendingInvite(code: string | null): void {
    try {
      if (code) sessionStorage.setItem(PENDING_INVITE_KEY, code);
      else sessionStorage.removeItem(PENDING_INVITE_KEY);
    } catch {
      // Private mode: the link just has to be opened again after signing in.
    }
  }

  public static pendingInvite(): string | null {
    try {
      return sessionStorage.getItem(PENDING_INVITE_KEY);
    } catch {
      return null;
    }
  }
}
