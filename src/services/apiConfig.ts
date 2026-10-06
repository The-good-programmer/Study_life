/**
 * Studify Unified API Configuration & Client Gateway
 * Handles backend URL resolution, authentication token persistence,
 * server health detection, and authenticated HTTP requests.
 */

const AUTH_TOKEN_KEY = 'studify_auth_token_v1';

export class ApiConfig {
  private static cachedIsReachable: boolean | null = null;
  private static lastCheckTime: number = 0;

  /**
   * Resolves the API base URL. Defaults to relative '/api' which works
   * natively in production (reverse proxy/CDN) and in Vite dev mode (via proxy).
   */
  public static getBaseUrl(): string {
    const custom = import.meta.env.VITE_API_BASE_URL as string | undefined;
    if (custom && custom.trim()) {
      return custom.trim().replace(/\/+$/, '');
    }
    return '/api';
  }

  /**
   * Retrieves the stored JWT authentication token
   */
  public static getToken(): string | null {
    try {
      return localStorage.getItem(AUTH_TOKEN_KEY);
    } catch {
      return null;
    }
  }

  /**
   * Saves or clears the JWT authentication token
   */
  public static setToken(token: string | null): void {
    try {
      if (token) {
        localStorage.setItem(AUTH_TOKEN_KEY, token);
      } else {
        localStorage.removeItem(AUTH_TOKEN_KEY);
      }
    } catch {}
  }

  /**
   * Checks whether the backend server is reachable within a lightweight timeout
   */
  public static async isServerReachable(forceCheck = false): Promise<boolean> {
    const now = Date.now();
    // Cache positive/negative reachability for 15 seconds to prevent spamming
    if (!forceCheck && this.cachedIsReachable !== null && (now - this.lastCheckTime < 15000)) {
      return this.cachedIsReachable;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second fast timeout

      const res = await fetch(`${this.getBaseUrl()}/health`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const isOk = res.ok;
      this.cachedIsReachable = isOk;
      this.lastCheckTime = now;
      return isOk;
    } catch {
      this.cachedIsReachable = false;
      this.lastCheckTime = now;
      return false;
    }
  }

  /**
   * Synchronously returns whether the server is known to be up. Unknown counts as
   * unavailable; a background check is started so the next call has an answer.
   */
  public static isServerReachableSync(): boolean {
    if (this.cachedIsReachable === null) {
      void this.isServerReachable();
      return false;
    }
    return this.cachedIsReachable;
  }

  /**
   * The shared server AI proxy only serves signed-in users, so it is usable
   * when the server is reachable and we hold a login token.
   */
  public static async canUseServerAi(): Promise<boolean> {
    return Boolean(this.getToken()) && (await this.isServerReachable());
  }

  public static canUseServerAiSync(): boolean {
    return Boolean(this.getToken()) && this.isServerReachableSync();
  }

  /**
   * Authenticated HTTP request helper with automatic JSON serialization and token inclusion
   */
  public static async request<T = unknown>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
    const url = endpoint.startsWith('http')
      ? endpoint
      : `${this.getBaseUrl()}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    const headers = new Headers(options.headers || {});
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    const token = this.getToken();
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const contentType = response.headers.get('content-type') || '';
      let data: any = null;
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      if (!response.ok) {
        const errorMsg = (data && typeof data === 'object' && data.error) || response.statusText || 'Request failed';
        return { ok: false, status: response.status, error: errorMsg, data };
      }

      return { ok: true, status: response.status, data: data as T };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error connecting to Studify server';
      return { ok: false, status: 0, error: msg };
    }
  }

  /**
   * Opens an SSE streaming connection to the Studify AI server gateway
   */
  public static async streamRequest(
    endpoint: string,
    body: Record<string, any>,
    onChunk: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<{ ok: boolean; error?: string }> {
    const url = endpoint.startsWith('http')
      ? endpoint
      : `${this.getBaseUrl()}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    const headers = new Headers({
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    });

    const token = this.getToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        return { ok: false, error: `Stream failed with status ${response.status}: ${errText}` };
      }

      if (!response.body) {
        return { ok: false, error: 'Streaming response body is missing' };
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const rawJson = trimmed.slice(6).trim();
            if (!rawJson) continue;
            try {
              const parsed = JSON.parse(rawJson);
              if (parsed.chunk) {
                onChunk(parsed.chunk);
              }
              if (parsed.error) {
                return { ok: false, error: parsed.error };
              }
              if (parsed.done) {
                return { ok: true };
              }
            } catch {
              // Ignore non-json lines
            }
          }
        }
      }

      return { ok: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error reading stream from server';
      return { ok: false, error: msg };
    }
  }
}
