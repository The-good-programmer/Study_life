import { ApiConfig } from './apiConfig';

export interface DigestStatus {
  enabled: boolean;
  /** The address it goes to. */
  email: string;
  /** False when the server has no email service set up. */
  available: boolean;
}

/** The weekly progress email (sent by the server on Sunday evening). */
export class DigestService {
  public static async status(): Promise<DigestStatus | null> {
    const res = await ApiConfig.request<DigestStatus>('/digest');
    return res.ok && res.data ? res.data : null;
  }

  /** Turns it on (in this browser's time zone) or off. Returns an error message, or null. */
  public static async setEnabled(enabled: boolean): Promise<string | null> {
    const res = await ApiConfig.request('/digest', {
      method: 'POST',
      body: JSON.stringify({ enabled, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
    });
    if (res.ok) return null;
    return res.status === 0 ? "Couldn't reach Studify. Check your connection." : res.error || 'Something went wrong.';
  }
}
