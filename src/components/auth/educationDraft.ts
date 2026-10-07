// Education profile draft shared by the auth forms (register, Google setup, edit profile).

export interface EducationDraft {
  country: string;
  grade: string;
  age: number;
  customGrade: string;
  isCustomGrade: boolean;
}

export const DEFAULT_GRADE = '9th Grade (High School Freshman)';

export const createEducationDraft = (overrides: Partial<EducationDraft> = {}): EducationDraft => ({
  country: 'United States',
  grade: DEFAULT_GRADE,
  age: 14,
  customGrade: '',
  isCustomGrade: false,
  ...overrides,
});

/** Education fields from an account; falls back to defaults when the account has none. */
export const educationFromUser = (
  user: { country?: string; grade?: string; age?: number } | null,
  withCustomReset = true,
): EducationDraft => {
  const base = createEducationDraft({
    country: user?.country || 'United States',
    grade: user?.grade || DEFAULT_GRADE,
    age: user?.age || 14,
  });
  if (withCustomReset) return base;
  // Syncing from the account must not wipe a custom grade the user is typing.
  const { customGrade: _c, isCustomGrade: _i, ...fields } = base;
  return fields as EducationDraft;
};

/** The grade label to persist: the typed custom level when chosen, otherwise the selected grade. */
export const resolveGrade = (draft: EducationDraft): string =>
  draft.isCustomGrade ? draft.customGrade.trim() || 'General Studies' : draft.grade;
