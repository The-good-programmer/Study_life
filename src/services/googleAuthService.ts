import type { GoogleProfilePayload } from '../types';

export interface GoogleIdTokenPayload {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
  email_verified?: boolean;
}

export interface GoogleUserInfo {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
  email_verified?: boolean;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string; select_by?: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          prompt: (notification?: (notification: {
            isNotDisplayed: () => boolean;
            isSkippedMoment: () => boolean;
            getNotDisplayedReason: () => string;
            getSkippedReason: () => string;
          }) => void) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: 'standard' | 'icon';
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              text?: 'signin_with' | 'signup_with' | 'continue_with';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              logo_alignment?: 'left' | 'center';
              width?: string | number;
            }
          ) => void;
          revoke: (hint: string, done: () => void) => void;
        };
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (tokenResponse: {
              access_token?: string;
              error?: string;
              error_description?: string;
              error_uri?: string;
              expires_in?: number;
            }) => void;
            error_callback?: (error: { type: string; message: string }) => void;
            prompt?: string;
          }) => {
            requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
          };
        };
      };
    };
  }
}

const CLIENT_ID_STORAGE_KEY = 'studify_google_client_id';

export class GoogleAuthService {
  private static isScriptLoaded = false;
  private static loadPromise: Promise<boolean> | null = null;

  /**
   * Retrieves the Google OAuth Client ID from Vite environment or localStorage
   */
  public static getClientId(): string {
    const envId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) || '';
    if (envId.trim()) return envId.trim();
    const storedId = typeof window !== 'undefined' ? localStorage.getItem(CLIENT_ID_STORAGE_KEY) || '' : '';
    return storedId.trim();
  }

  /**
   * Saves or clears the Google OAuth Client ID in browser storage
   */
  public static setClientId(id: string): void {
    const clean = id.trim();
    if (clean) {
      localStorage.setItem(CLIENT_ID_STORAGE_KEY, clean);
    } else {
      localStorage.removeItem(CLIENT_ID_STORAGE_KEY);
    }
  }

  /**
   * Returns true if a Google Client ID is configured
   */
  public static isGoogleConfigured(): boolean {
    const id = this.getClientId();
    return id.length > 8 && id.includes('.apps.googleusercontent.com');
  }

  /**
   * Dynamically loads the official Google Identity Services (GIS) client library
   */
  public static loadGoogleSDK(): Promise<boolean> {
    if (typeof window === 'undefined') return Promise.resolve(false);
    if (this.isScriptLoaded && window.google?.accounts?.oauth2) {
      return Promise.resolve(true);
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = new Promise<boolean>((resolve) => {
      // Check if already injected in DOM
      if (document.querySelector('script[src*="accounts.google.com/gsi/client"]')) {
        const checkInterval = setInterval(() => {
          if (window.google?.accounts?.oauth2) {
            clearInterval(checkInterval);
            this.isScriptLoaded = true;
            resolve(true);
          }
        }, 100);
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve(!!window.google?.accounts?.oauth2);
        }, 3000);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        this.isScriptLoaded = true;
        resolve(true);
      };
      script.onerror = () => {
        console.warn('[GoogleAuthService] Failed to load Google Identity Services script.');
        resolve(false);
      };
      document.head.appendChild(script);
    });

    return this.loadPromise;
  }

  /**
   * Opens the real Google OAuth 2.0 popup (accounts.google.com) to log into a real Google account
   */
  public static async launchRealGoogleSignIn(
    onSuccess: (payload: GoogleProfilePayload) => void,
    onError: (errorMsg: string) => void
  ): Promise<void> {
    const clientId = this.getClientId();
    if (!clientId) {
      onError('Google Client ID is missing. Please configure your Google OAuth Client ID.');
      return;
    }

    const loaded = await this.loadGoogleSDK();
    if (!loaded || !window.google?.accounts?.oauth2) {
      onError('Could not load Google Identity Services. Please verify your connection to accounts.google.com.');
      return;
    }

    try {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'openid email profile',
        callback: async (tokenResponse) => {
          if (tokenResponse.error) {
            onError(tokenResponse.error_description || tokenResponse.error || 'Google sign-in was cancelled.');
            return;
          }

          if (!tokenResponse.access_token) {
            onError('Google did not return an access token.');
            return;
          }

          try {
            // Fetch the authentic user profile from Google's userinfo endpoint
            const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: {
                Authorization: `Bearer ${tokenResponse.access_token}`,
              },
            });

            if (!res.ok) {
              throw new Error(`Failed to load Google profile (HTTP ${res.status})`);
            }

            const profile = (await res.json()) as GoogleUserInfo;
            if (!profile.email) {
              onError('Google did not provide a verified email address.');
              return;
            }

            onSuccess({
              googleId: profile.sub,
              email: profile.email.toLowerCase(),
              name: profile.name || profile.email.split('@')[0],
              pictureUrl: profile.picture,
            });
          } catch (fetchErr) {
            const msg = fetchErr instanceof Error ? fetchErr.message : 'Error fetching Google user details';
            onError(msg);
          }
        },
        error_callback: (err) => {
          onError(err.message || 'Google authentication popup encountered an error.');
        },
      });

      // Triggers the official Google OAuth 2.0 popup window
      tokenClient.requestAccessToken({ prompt: 'select_account' });
    } catch (err) {
      console.error('[GoogleAuthService] Launch error:', err);
      onError(err instanceof Error ? err.message : 'Failed to launch Google Sign-In.');
    }
  }

  /**
   * Decodes a JWT ID token if used via One Tap or standard credential
   */
  public static parseJwtPayload(token: string): GoogleIdTokenPayload | null {
    if (!token) return null;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const base64Url = parts[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload) as GoogleIdTokenPayload;
    } catch (err) {
      console.error('[GoogleAuthService] Failed to parse JWT payload:', err);
      return null;
    }
  }

  /**
   * Initializes Google One Tap for instant seamless auto-login when opening the app
   */
  public static async initOneTapAutoLogin(
    onSuccess: (payload: GoogleProfilePayload) => void
  ): Promise<void> {
    const clientId = this.getClientId();
    if (!clientId) return;

    const loaded = await this.loadGoogleSDK();
    if (!loaded || !window.google?.accounts?.id) return;

    try {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (!response.credential) return;
          const decoded = this.parseJwtPayload(response.credential);
          if (!decoded || !decoded.email) return;
          onSuccess({
            googleId: decoded.sub,
            email: decoded.email.toLowerCase(),
            name: decoded.name || decoded.email.split('@')[0],
            pictureUrl: decoded.picture,
          });
        },
        auto_select: true, // Seamlessly sign in users without clicking when eligible!
        cancel_on_tap_outside: true,
      });

      // Display Google One Tap prompt
      window.google.accounts.id.prompt();
    } catch (e) {
      console.warn('[GoogleAuthService] One Tap auto-login initialization skipped:', e);
    }
  }
}
