import { ApiConfig } from './apiConfig';
import { AIService } from './aiService';

const USED_KEY = 'studify_free_ai_deck_used';

/**
 * A guest's one free AI deck: "type a topic, get a deck" before signing up. The server hands out a short
 * pass for the requests one deck takes (see server/src/guestAi.js); this remembers when it has been used.
 */
export const GuestDeck = {
  /** A guest (no account, no key of their own) who hasn't made their free deck yet. */
  isAvailable(): boolean {
    return AIService.needsSignIn() && !this.wasUsed();
  },

  wasUsed(): boolean {
    try {
      return localStorage.getItem(USED_KEY) === 'true';
    } catch {
      return false;
    }
  },

  /** Runs `make` with a guest pass, and counts the free deck as used once it succeeds. */
  async run<T>(make: () => Promise<T>): Promise<T> {
    const res = await ApiConfig.request<{ pass: string }>('/ai/guest-pass', { method: 'POST' });
    if (!res.ok || !res.data?.pass) {
      throw new Error(res.error && res.status !== 0 ? res.error : 'The free AI could not be reached. Sign up free to make a deck with AI.');
    }
    ApiConfig.setGuestPass(res.data.pass);
    try {
      const result = await make();
      try {
        localStorage.setItem(USED_KEY, 'true');
      } catch {
        // Private mode: the server's limits still hold.
      }
      return result;
    } finally {
      ApiConfig.setGuestPass(null);
    }
  },
};
