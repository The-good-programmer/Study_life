import type { UserAccount, RegisterDTO, LoginDTO, AuthResponse, GoogleAuthDTO } from '../types';
import { StorageService } from './storageService';
import { ApiConfig } from './apiConfig';

const ACCOUNTS_STORAGE_KEY = 'studify_accounts_v1';
const ACTIVE_USER_STORAGE_KEY = 'studify_active_user_id';

export class AuthService {
  private static listeners: Set<(user: UserAccount | null) => void> = new Set();

  /**
   * Generates a 16-byte cryptographically secure random hexadecimal salt
   */
  public static generateSalt(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Hashes a password string using Web Crypto PBKDF2 (SHA-256, 100,000 iterations)
   */
  public static async hashPassword(password: string, salt: string): Promise<string> {
    const encoder = new TextEncoder();
    const saltBytes = encoder.encode(salt);
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBytes,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      256
    );
    const hashArray = Array.from(new Uint8Array(derivedBits));
    return 'pbkdf2$' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Legacy simple SHA-256 hashing for backward compatibility migration
   */
  public static async hashPasswordLegacy(password: string, salt: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(salt + password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Verifies password against stored hash, supporting both PBKDF2 and legacy SHA-256.
   * Returns { valid: boolean, needsRehash: boolean }
   */
  public static async verifyPassword(password: string, user: UserAccount): Promise<{ valid: boolean; needsRehash: boolean }> {
    if (!user.passwordHash || !user.passwordSalt) {
      return { valid: false, needsRehash: false };
    }

    if (user.passwordHash.startsWith('pbkdf2$')) {
      const computed = await this.hashPassword(password, user.passwordSalt);
      return { valid: computed === user.passwordHash, needsRehash: false };
    }

    // Legacy SHA-256 hash check
    const legacyComputed = await this.hashPasswordLegacy(password, user.passwordSalt);
    if (legacyComputed === user.passwordHash) {
      return { valid: true, needsRehash: true };
    }

    return { valid: false, needsRehash: false };
  }

  /**
   * Retrieves all registered accounts saved locally on this browser
   */
  public static getAllAccounts(): UserAccount[] {
    try {
      const raw = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Saves the entire accounts array to localStorage
   */
  private static saveAccounts(accounts: UserAccount[]): void {
    try {
      localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
    } catch (e) {
      console.error('[AuthService] Failed to save accounts to localStorage:', e);
    }
  }

  /**
   * Returns the currently active logged-in user, or null if in Guest mode
   */
  public static getCurrentUser(): UserAccount | null {
    try {
      const activeId = localStorage.getItem(ACTIVE_USER_STORAGE_KEY);
      if (!activeId) return null;
      const accounts = this.getAllAccounts();
      return accounts.find(a => a.id === activeId) || null;
    } catch {
      return null;
    }
  }

  /**
   * Registers a new student account
   */
  public static async register(dto: RegisterDTO): Promise<AuthResponse> {
    const name = dto.name.trim();
    const email = dto.email.trim().toLowerCase();
    const password = dto.password;

    if (!name || name.length < 2) {
      return { success: false, error: 'Full name must be at least 2 characters long.' };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { success: false, error: 'Please enter a valid email address.' };
    }

    if (!password || password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters long.' };
    }

    // Attempt remote server registration if backend is reachable
    try {
      if (await ApiConfig.isServerReachable()) {
        const res = await ApiConfig.request<{ user: UserAccount; token: string }>('/auth/register', {
          method: 'POST',
          body: JSON.stringify(dto),
        });
        if (res.ok && res.data?.user && res.data?.token) {
          ApiConfig.setToken(res.data.token);
          const serverUser = res.data.user;
          const accounts = this.getAllAccounts();
          const existingIdx = accounts.findIndex(a => a.email === serverUser.email);
          if (existingIdx >= 0) accounts[existingIdx] = serverUser;
          else accounts.push(serverUser);
          this.saveAccounts(accounts);
          localStorage.setItem(ACTIVE_USER_STORAGE_KEY, serverUser.id);
          StorageService.setActiveUserId(serverUser.id);
          this.notifySubscribers(serverUser);
          return { success: true, user: serverUser };
        } else if (res.error && res.status >= 400 && res.status < 500) {
          return { success: false, error: res.error };
        }
      }
    } catch (err) {
      console.warn('[AuthService] Server registration failed, falling back to local storage:', err);
    }

    const accounts = this.getAllAccounts();
    const existing = accounts.find(a => a.email === email);
    if (existing) {
      return { success: false, error: 'An account with this email address already exists. Please log in.' };
    }

    const salt = this.generateSalt();
    const passwordHash = await this.hashPassword(password, salt);
    const now = new Date().toISOString();

    const age = Math.max(5, Math.min(100, Number(dto.age) || 15));
    const country = (dto.country || 'United States').trim();
    const grade = (dto.grade || '9th Grade').trim();

    const newUser: UserAccount = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name,
      email,
      provider: 'password',
      passwordHash,
      passwordSalt: salt,
      age,
      country,
      grade,
      gradeLevel: dto.gradeLevel,
      avatar: dto.avatar || '🧠',
      institution: dto.institution?.trim() || undefined,
      createdAt: now,
      lastLoginAt: now,
    };

    accounts.push(newUser);
    this.saveAccounts(accounts);

    // If student opted to migrate existing guest data into this fresh account
    if (dto.migrateGuestData) {
      StorageService.migrateGuestDataToUser(newUser.id);
    }

    // Set active user session
    localStorage.setItem(ACTIVE_USER_STORAGE_KEY, newUser.id);
    StorageService.setActiveUserId(newUser.id);

    this.notifySubscribers(newUser);

    return {
      success: true,
      user: newUser,
    };
  }

  /**
   * Authenticates or registers a student using Google OAuth / Identity
   */
  public static async signInWithGoogle(dto: GoogleAuthDTO): Promise<AuthResponse> {
    const email = dto.email.trim().toLowerCase();
    const name = dto.name.trim();

    if (!email) {
      return { success: false, error: 'Google authentication did not provide an email address.' };
    }

    const accounts = this.getAllAccounts();
    const existingIndex = accounts.findIndex(a => a.email === email || (dto.googleId && a.googleId === dto.googleId));

    if (existingIndex >= 0) {
      const existing = accounts[existingIndex];
      existing.lastLoginAt = new Date().toISOString();
      if (!existing.googleId && dto.googleId) {
        existing.googleId = dto.googleId;
      }
      if (!existing.pictureUrl && dto.pictureUrl) {
        existing.pictureUrl = dto.pictureUrl;
      }
      existing.provider = 'google';

      accounts[existingIndex] = existing;
      this.saveAccounts(accounts);

      localStorage.setItem(ACTIVE_USER_STORAGE_KEY, existing.id);
      StorageService.setActiveUserId(existing.id);
      this.notifySubscribers(existing);

      return {
        success: true,
        user: existing,
      };
    }

    // It's a new Google user. Auto-provision with defaults so sign-in happens automatically!
    const country = (dto.country || 'United States').trim();
    const grade = (dto.grade || '9th Grade (High School Freshman)').trim();
    const age = Math.max(5, Math.min(100, Number(dto.age) || 15));

    // Create new Google-linked student account
    const now = new Date().toISOString();
    const newUser: UserAccount = {
      id: `usr_g_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: name || 'Google Student',
      email,
      provider: 'google',
      googleId: dto.googleId,
      pictureUrl: dto.pictureUrl,
      age,
      country,
      grade,
      avatar: dto.avatar || '🌐',
      institution: dto.institution?.trim() || undefined,
      createdAt: now,
      lastLoginAt: now,
    };

    accounts.push(newUser);
    this.saveAccounts(accounts);

    if (dto.migrateGuestData) {
      StorageService.migrateGuestDataToUser(newUser.id);
    }

    localStorage.setItem(ACTIVE_USER_STORAGE_KEY, newUser.id);
    StorageService.setActiveUserId(newUser.id);
    this.notifySubscribers(newUser);

    return {
      success: true,
      user: newUser,
    };
  }

  /**
   * Authenticates an existing student with email and password
   */
  public static async login(dto: LoginDTO): Promise<AuthResponse> {
    const email = dto.email.trim().toLowerCase();
    const password = dto.password;

    if (!email || !password) {
      return { success: false, error: 'Please provide both email and password.' };
    }

    // Attempt remote server login if backend is reachable
    try {
      if (await ApiConfig.isServerReachable()) {
        const res = await ApiConfig.request<{ user: UserAccount; token: string }>('/auth/login', {
          method: 'POST',
          body: JSON.stringify(dto),
        });
        if (res.ok && res.data?.user && res.data?.token) {
          ApiConfig.setToken(res.data.token);
          const serverUser = res.data.user;
          const accounts = this.getAllAccounts();
          const existingIdx = accounts.findIndex(a => a.email === serverUser.email);
          if (existingIdx >= 0) accounts[existingIdx] = serverUser;
          else accounts.push(serverUser);
          this.saveAccounts(accounts);
          localStorage.setItem(ACTIVE_USER_STORAGE_KEY, serverUser.id);
          StorageService.setActiveUserId(serverUser.id);
          this.notifySubscribers(serverUser);
          return { success: true, user: serverUser };
        } else if (res.error && res.status >= 400 && res.status < 500) {
          return { success: false, error: res.error };
        }
      }
    } catch (err) {
      console.warn('[AuthService] Server login failed, falling back to local credentials:', err);
    }

    const accounts = this.getAllAccounts();
    const user = accounts.find(a => a.email === email);

    if (!user) {
      return { success: false, error: 'No account found with this email. Please check spelling or register.' };
    }

    if (!user.passwordHash || !user.passwordSalt) {
      return {
        success: false,
        error: 'This account was created with Google. Please use "Continue with Google" to sign in.',
      };
    }

    const { valid, needsRehash } = await this.verifyPassword(password, user);
    if (!valid) {
      return { success: false, error: 'Incorrect password. Please verify and try again.' };
    }

    // Transparently upgrade legacy SHA-256 hash to PBKDF2
    if (needsRehash && user.passwordSalt) {
      user.passwordHash = await this.hashPassword(password, user.passwordSalt);
    }

    // Update lastLoginAt
    user.lastLoginAt = new Date().toISOString();
    this.saveAccounts(accounts);

    // Switch active session
    localStorage.setItem(ACTIVE_USER_STORAGE_KEY, user.id);
    StorageService.setActiveUserId(user.id);

    this.notifySubscribers(user);

    return {
      success: true,
      user,
    };
  }

  /**
   * Quick-switch to another registered account on this browser.
   * If the target account is password-protected, a valid password is required.
   */
  public static async switchAccount(
    userId: string,
    password?: string
  ): Promise<{ success: boolean; requiresPassword?: boolean; error?: string }> {
    const accounts = this.getAllAccounts();
    const target = accounts.find(a => a.id === userId);
    if (!target) return { success: false, error: 'Target account not found.' };

    if (target.provider === 'password' && target.passwordHash) {
      if (!password) {
        return { success: false, requiresPassword: true, error: 'Password required to switch to this account.' };
      }
      const { valid, needsRehash } = await this.verifyPassword(password, target);
      if (!valid) {
        return { success: false, requiresPassword: true, error: 'Incorrect password.' };
      }
      if (needsRehash && target.passwordSalt) {
        target.passwordHash = await this.hashPassword(password, target.passwordSalt);
      }
    }

    target.lastLoginAt = new Date().toISOString();
    this.saveAccounts(accounts);

    localStorage.setItem(ACTIVE_USER_STORAGE_KEY, target.id);
    StorageService.setActiveUserId(target.id);

    this.notifySubscribers(target);
    return { success: true };
  }

  /**
   * Logs out from current user into Guest mode
   */
  public static logout(): void {
    ApiConfig.setToken(null);
    localStorage.removeItem(ACTIVE_USER_STORAGE_KEY);
    StorageService.setActiveUserId(null);
    this.notifySubscribers(null);
  }

  /**
   * Updates user profile fields
   */
  public static updateProfile(
    userId: string,
    updates: Partial<Pick<UserAccount, 'name' | 'age' | 'country' | 'grade' | 'gradeLevel' | 'avatar' | 'bio' | 'institution'>>
  ): UserAccount | null {
    const accounts = this.getAllAccounts();
    const idx = accounts.findIndex(a => a.id === userId);
    if (idx === -1) return null;

    const current = accounts[idx];
    const updated: UserAccount = {
      ...current,
      ...updates,
      name: updates.name ? updates.name.trim() : current.name,
      country: updates.country ? updates.country.trim() : current.country,
      grade: updates.grade ? updates.grade.trim() : current.grade,
      age: updates.age !== undefined ? Math.max(5, Math.min(100, Number(updates.age) || current.age)) : current.age,
      institution: updates.institution !== undefined ? updates.institution.trim() || undefined : current.institution,
    };

    accounts[idx] = updated;
    this.saveAccounts(accounts);

    if (this.getCurrentUser()?.id === userId) {
      this.notifySubscribers(updated);
    }

    return updated;
  }

  /**
   * Deletes an account and purges associated decks
   */
  public static deleteAccount(userId: string): void {
    const accounts = this.getAllAccounts().filter(a => a.id !== userId);
    this.saveAccounts(accounts);

    StorageService.purgeUserData(userId);

    if (this.getCurrentUser()?.id === userId) {
      this.logout();
    }
  }

  /**
   * Subscribes a React component or service to authentication state changes
   */
  public static subscribe(listener: (user: UserAccount | null) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private static notifySubscribers(user: UserAccount | null): void {
    this.listeners.forEach(fn => {
      try {
        fn(user);
      } catch (err) {
        console.error('[AuthService] Error in subscriber callback:', err);
      }
    });
  }
}
