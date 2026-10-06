/**
 * Studify Community Deck Marketplace Client Service
 * Allows students to discover public decks and share their own decks.
 */

import { ApiConfig } from './apiConfig';
import type { StudySession } from '../types';

export interface PublicDeckSummary {
  id: string;
  slug: string;
  author_name: string;
  title: string;
  subject: string;
  description: string;
  card_count: number;
  likes: number;
  created_at: string;
}

export class CommunityService {
  /**
   * Fetches public shared decks with optional search and subject filters
   */
  public static async getPublicDecks(
    searchQuery = '',
    subject = 'all'
  ): Promise<{ success: boolean; decks: PublicDeckSummary[]; error?: string }> {
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      if (subject && subject !== 'all') params.set('subject', subject);

      const queryStr = params.toString() ? `?${params.toString()}` : '';
      const res = await ApiConfig.request<{ decks: PublicDeckSummary[] }>(`/decks/public${queryStr}`);

      if (res.ok && res.data?.decks) {
        return { success: true, decks: res.data.decks };
      }
      return { success: false, decks: [], error: res.error || 'Failed to fetch public decks' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error';
      return { success: false, decks: [], error: msg };
    }
  }

  /**
   * Publishes a user's local study session deck to the community marketplace
   */
  public static async publishDeck(
    session: StudySession,
    description = ''
  ): Promise<{ success: boolean; shareUrl?: string; slug?: string; error?: string }> {
    try {
      const res = await ApiConfig.request<{ shareUrl: string; slug: string }>('/decks/share', {
        method: 'POST',
        body: JSON.stringify({
          title: session.title,
          subject: session.category || 'General',
          description,
          session,
        }),
      });

      if (res.ok && res.data?.shareUrl) {
        return { success: true, shareUrl: res.data.shareUrl, slug: res.data.slug };
      }
      return { success: false, error: res.error || 'Failed to publish deck' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error';
      return { success: false, error: msg };
    }
  }

  /**
   * Fetches full deck session data for importing into the student's personal library
   */
  public static async getDeckDetails(
    idOrSlug: string
  ): Promise<{ success: boolean; session?: StudySession; error?: string }> {
    try {
      const res = await ApiConfig.request<{ deck: { session: StudySession } }>(`/decks/${encodeURIComponent(idOrSlug)}`);
      if (res.ok && res.data?.deck?.session) {
        return { success: true, session: res.data.deck.session };
      }
      return { success: false, error: res.error || 'Deck not found' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error';
      return { success: false, error: msg };
    }
  }
}
