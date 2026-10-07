export interface PasswordStrength {
  label: string;
  /** "<text-class> <bar-class>" */
  color: string;
  percent: number;
}

export const getPasswordStrength = (pass: string): PasswordStrength => {
  if (!pass) return { label: '', color: '', percent: 0 };
  if (pass.length < 6) return { label: 'Too short (min 6 chars)', color: 'text-rose-400 bg-rose-500', percent: 25 };
  const hasLetters = /[a-zA-Z]/.test(pass);
  const hasNumbers = /[0-9]/.test(pass);
  const hasSpecial = /[^a-zA-Z0-9]/.test(pass);
  const score = (pass.length >= 8 ? 1 : 0) + (hasLetters && hasNumbers ? 1 : 0) + (hasSpecial ? 1 : 0);
  if (score >= 2) return { label: 'Strong password', color: 'text-emerald-400 bg-emerald-500', percent: 100 };
  if (score === 1) return { label: 'Good password', color: 'text-indigo-400 bg-indigo-500', percent: 65 };
  return { label: 'Fair password', color: 'text-amber-400 bg-amber-500', percent: 45 };
};
