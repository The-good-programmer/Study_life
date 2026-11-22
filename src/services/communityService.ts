/**
 * Decks students share with each other: browse, share, add, report and unshare.
 * The server's side is server/src/routes/deckRoutes.js; what is shared is decided in deckSharing.ts.
 */

import { ApiConfig } from './apiConfig';
import { StorageService } from './storageService';
import { ownCopyOf, shareableDeck } from './deckSharing';
import type { StudySession } from '../types';

export interface PublicDeckSummary {
  id: string;
  slug: string;
  /** As shown: first name and initial, or "a Studify student". */
  author_name: string;
  title: string;
  subject: string;
  description: string;
  card_count: number;
  likes: number;
  created_at: string;
}

export interface MySharedDeck {
  id: string;
  slug: string;
  title: string;
  subject: string;
  card_count: number;
  likes: number;
  created_at: string;
  /** Hidden after reports: no longer listed. */
  hidden: boolean;
  shareUrl: string;
}

type Result<T> = ({ success: true } & T) | { success: false; error: string };

/** Shared decks already added here (slug → the local copy's id), so a link opened twice adds it once. */
const COPIES_KEY = 'studify_shared_copies_v1';
const readCopies = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(COPIES_KEY) || '{}') as Record<string, string>;
  } catch {
    return {};
  }
};
const rememberCopy = (slug: string, sessionId: string) => {
  try {
    localStorage.setItem(COPIES_KEY, JSON.stringify({ ...readCopies(), [slug]: sessionId }));
  } catch {
    // Private mode: a second visit adds a second copy.
  }
};

const failed = (error: string | undefined, fallback: string) => ({ success: false as const, error: error || fallback });

/** A share link, made absolute for copying. */
export const absoluteShareUrl = (shareUrl: string): string => new URL(shareUrl, window.location.origin).href;

export class CommunityService {
  public static async getPublicDecks(searchQuery = '', subject = 'all'): Promise<Result<{ decks: PublicDeckSummary[] }>> {
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set('q', searchQuery.trim());
    if (subject && subject !== 'all') params.set('subject', subject);
    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await ApiConfig.request<{ decks: PublicDeckSummary[] }>(`/decks/public${query}`);
    return res.ok && res.data?.decks ? { success: true, decks: res.data.decks } : failed(res.error, "Shared decks couldn't be loaded.");
  }

  /** Shares a deck: only its cards and teaching content (see shareableDeck), never review history. */
  public static async shareDeck(input: {
    session: StudySession;
    title: string;
    subject: string;
    description: string;
    rightsConfirmed: boolean;
  }): Promise<Result<{ shareUrl: string; slug: string; authorName: string }>> {
    const res = await ApiConfig.request<{ shareUrl: string; slug: string; authorName: string }>('/decks/share', {
      method: 'POST',
      body: JSON.stringify({
        title: input.title,
        subject: input.subject,
        description: input.description,
        session: shareableDeck(input.session),
        rightsConfirmed: input.rightsConfirmed,
      }),
    });
    return res.ok && res.data?.shareUrl
      ? { success: true, shareUrl: res.data.shareUrl, slug: res.data.slug, authorName: res.data.authorName }
      : failed(res.error, "Your deck couldn't be shared. Try again in a moment.");
  }

  public static async getMyDecks(): Promise<Result<{ decks: MySharedDeck[] }>> {
    const res = await ApiConfig.request<{ decks: MySharedDeck[] }>('/decks/mine');
    return res.ok && res.data?.decks ? { success: true, decks: res.data.decks } : failed(res.error, "Your shared decks couldn't be loaded.");
  }

  public static async unshareDeck(slug: string): Promise<Result<object>> {
    const res = await ApiConfig.request(`/decks/${encodeURIComponent(slug)}`, { method: 'DELETE' });
    return res.ok ? { success: true } : failed(res.error, "The deck couldn't be unshared.");
  }

  public static async reportDeck(slug: string, reason: string): Promise<Result<object>> {
    const res = await ApiConfig.request(`/decks/${encodeURIComponent(slug)}/report`, { method: 'POST', body: JSON.stringify({ reason }) });
    return res.ok ? { success: true } : failed(res.error, "The report couldn't be sent.");
  }

  /** Adds a shared deck to the student's library as their own copy, with every card new to them. */
  public static async addToLibrary(slug: string): Promise<Result<{ session: StudySession }>> {
    const existing = StorageService.getSessions().find(s => s.id === readCopies()[slug]);
    if (existing) return { success: true, session: existing };
    const res = await ApiConfig.request<{ deck: { session: StudySession; title: string; subject: string; description: string } }>(
      `/decks/${encodeURIComponent(slug)}`,
    );
    const deck = res.data?.deck;
    if (!res.ok || !deck?.session || !Array.isArray(deck.session.concepts)) return failed(res.error, 'That shared deck was not found.');
    const copy = ownCopyOf({
      ...deck.session,
      title: deck.title || deck.session.title,
      category: deck.subject || deck.session.category,
      description: deck.description || deck.session.description || '',
    });
    StorageService.saveSession(copy);
    StorageService.saveCards(copy.concepts.flatMap(c => c.retrievalCards));
    rememberCopy(slug, copy.id);
    return { success: true, session: copy };
  }
}
