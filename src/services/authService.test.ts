import { describe, it, expect, beforeEach } from 'vitest';
import { AuthService } from './authService';

describe('AuthService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('hashes password with PBKDF2 returning pbkdf2$ prefix', async () => {
    const salt = AuthService.generateSalt();
    const hash = await AuthService.hashPassword('SecretPass123!', salt);
    expect(hash.startsWith('pbkdf2$')).toBe(true);
    expect(hash.length).toBeGreaterThan(20);
  });

  it('verifies PBKDF2 passwords correctly', async () => {
    const salt = AuthService.generateSalt();
    const hash = await AuthService.hashPassword('MySecurePassword', salt);
    const mockUser: any = {
      id: 'usr_test',
      email: 'test@example.com',
      passwordHash: hash,
      passwordSalt: salt,
      provider: 'password'
    };

    const validCheck = await AuthService.verifyPassword('MySecurePassword', mockUser);
    expect(validCheck.valid).toBe(true);
    expect(validCheck.needsRehash).toBe(false);

    const invalidCheck = await AuthService.verifyPassword('WrongPassword', mockUser);
    expect(invalidCheck.valid).toBe(false);
  });

  it('supports transparent migration from legacy SHA-256 hash', async () => {
    const salt = AuthService.generateSalt();
    const legacyHash = await AuthService.hashPasswordLegacy('LegacyPassword123', salt);
    const mockUser: any = {
      id: 'usr_legacy',
      email: 'legacy@example.com',
      passwordHash: legacyHash,
      passwordSalt: salt,
      provider: 'password'
    };

    const check = await AuthService.verifyPassword('LegacyPassword123', mockUser);
    expect(check.valid).toBe(true);
    expect(check.needsRehash).toBe(true);
  });

  it('requires password when switching to a password-protected account', async () => {
    const regRes = await AuthService.register({
      name: 'Alice Scholar',
      email: 'alice@example.com',
      password: 'AlicePassword123!',
      age: 18,
      country: 'United States',
      grade: 'College'
    });
    expect(regRes.success).toBe(true);

    const user = regRes.user!;

    // Attempting to switch without password should fail
    const switchWithoutPw = await AuthService.switchAccount(user.id);
    expect(switchWithoutPw.success).toBe(false);
    expect(switchWithoutPw.requiresPassword).toBe(true);

    // Attempting to switch with incorrect password should fail
    const switchWithWrongPw = await AuthService.switchAccount(user.id, 'WrongPass');
    expect(switchWithWrongPw.success).toBe(false);

    // Attempting to switch with correct password should succeed
    const switchWithCorrectPw = await AuthService.switchAccount(user.id, 'AlicePassword123!');
    expect(switchWithCorrectPw.success).toBe(true);
  });
});
