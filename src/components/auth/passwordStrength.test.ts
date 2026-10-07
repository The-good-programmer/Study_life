import { describe, it, expect } from 'vitest';
import { getPasswordStrength } from './passwordStrength';

describe('getPasswordStrength', () => {
  it('returns an empty result for no password', () => {
    expect(getPasswordStrength('')).toEqual({ label: '', color: '', percent: 0 });
  });

  it('flags passwords under 6 characters as too short', () => {
    expect(getPasswordStrength('ab1!').label).toMatch(/too short/i);
    expect(getPasswordStrength('ab1!').percent).toBe(25);
  });

  it('rates a short letters-only password as fair', () => {
    expect(getPasswordStrength('abcdef').label).toBe('Fair password');
  });

  it('rates one extra quality as good', () => {
    expect(getPasswordStrength('abcdefgh').label).toBe('Good password'); // length >= 8
    expect(getPasswordStrength('abc123').label).toBe('Good password'); // letters + numbers
  });

  it('rates two or more qualities as strong', () => {
    expect(getPasswordStrength('abcd1234').label).toBe('Strong password');
    expect(getPasswordStrength('abc12!').label).toBe('Strong password');
    expect(getPasswordStrength('abcd1234').percent).toBe(100);
  });
});
