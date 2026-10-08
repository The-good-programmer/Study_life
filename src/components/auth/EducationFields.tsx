import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, GraduationCap, Minus, Plus } from 'lucide-react';
import { EDUCATION_COUNTRIES, EducationCatalog } from '../../services/educationCatalog';
import { cn } from '../../utils/cn';
import type { EducationDraft } from './educationDraft';

interface EducationFieldsProps {
  value: EducationDraft;
  onChange: (next: EducationDraft) => void;
  customGradePlaceholder?: string;
  title?: string;
  /** Draws the fields in their own card, with a title. Off when a dialog already frames them. */
  framed?: boolean;
}

const MIN_AGE = 5;
const MAX_AGE = 99;
const clampAge = (age: number) => Math.max(MIN_AGE, Math.min(MAX_AGE, Math.round(age) || MIN_AGE));

/**
 * Educational profile picker (country, grade, age) shared by the register, Google setup,
 * edit-profile and Library forms. It sets how deep and how simply the AI writes decks.
 */
export const EducationFields: React.FC<EducationFieldsProps> = ({
  value,
  onChange,
  customGradePlaceholder = 'e.g. 4th grade, medical resident, or AP student',
  title = 'Country, grade and age',
  framed = true,
}) => {
  const id = useId();
  const countryConfig = EducationCatalog.getCountry(value.country);
  const gradesRef = useRef<HTMLDivElement>(null);

  // Bring the chosen grade into view in the scrolling list, on open and when the country changes.
  useEffect(() => {
    const list = gradesRef.current;
    const selected = list?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (list && selected) list.scrollTop = Math.max(0, selected.offsetTop - 8);
  }, [countryConfig.name]);

  const selectCountry = (name: string) => {
    const next = EducationCatalog.getCountry(name);
    const defaultGrade = next.grades[Math.min(6, next.grades.length - 1)];
    onChange(
      defaultGrade
        ? { ...value, country: name, grade: defaultGrade.label, age: defaultGrade.typicalAge, isCustomGrade: false }
        : { ...value, country: name },
    );
  };

  const fields = (
    <div className="space-y-4">
      <div>
        <label htmlFor={`${id}-country`} className="flex items-baseline justify-between text-[13px] font-medium text-ink">
          Country
          <span className="text-xs font-normal text-ink-subtle">{countryConfig.systemName}</span>
        </label>
        <div className="relative mt-1.5">
          <select
            id={`${id}-country`}
            value={countryConfig.name}
            onChange={e => selectCountry(e.target.value)}
            className="h-10 w-full cursor-pointer appearance-none rounded-xl border border-line-strong bg-canvas pl-3 pr-9 text-sm text-ink transition-colors focus:border-brand focus:outline-none"
          >
            {EDUCATION_COUNTRIES.map(c => (
              <option key={c.code} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
        </div>
      </div>

      <div>
        <p id={`${id}-grade`} className="text-[13px] font-medium text-ink">
          Grade
        </p>
        <div
          ref={gradesRef}
          role="radiogroup"
          aria-labelledby={`${id}-grade`}
          className="relative mt-1.5 grid max-h-44 grid-cols-1 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2"
        >
          {countryConfig.grades.map(g => {
            const isSelected = !value.isCustomGrade && value.grade === g.label;
            return (
              <button
                key={g.label}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => onChange({ ...value, grade: g.label, age: g.typicalAge, isCustomGrade: false })}
                className={cn(
                  'rounded-xl border px-3 py-2 text-left transition-colors cursor-pointer',
                  isSelected ? 'border-brand bg-brand-soft' : 'border-line bg-canvas hover:border-line-strong',
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-medium text-ink">{g.label}</span>
                  <span className="shrink-0 text-xs tabular-nums text-ink-subtle">~{g.typicalAge}</span>
                </span>
                <span className="block truncate text-xs text-ink-subtle">{g.stage}</span>
              </button>
            );
          })}
          <button
            type="button"
            role="radio"
            aria-checked={value.isCustomGrade}
            onClick={() => onChange({ ...value, isCustomGrade: true })}
            className={cn(
              'rounded-xl border px-3 py-2 text-left transition-colors cursor-pointer',
              value.isCustomGrade ? 'border-brand bg-brand-soft' : 'border-line bg-canvas hover:border-line-strong',
            )}
          >
            <span className="block text-[13px] font-medium text-ink">Something else</span>
            <span className="block text-xs text-ink-subtle">Type your own level</span>
          </button>
        </div>
        {value.isCustomGrade && (
          <input
            type="text"
            aria-label="Your level"
            autoFocus
            placeholder={customGradePlaceholder}
            value={value.customGrade}
            onChange={e => onChange({ ...value, customGrade: e.target.value })}
            className="mt-2 h-10 w-full rounded-xl border border-line-strong bg-canvas px-3 text-sm text-ink placeholder:text-ink-subtle transition-colors focus:border-brand focus:outline-none"
          />
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <label htmlFor={`${id}-age`} className="text-[13px] font-medium text-ink">
          Age
        </label>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Younger"
            onClick={() => onChange({ ...value, age: clampAge(value.age - 1) })}
            disabled={value.age <= MIN_AGE}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-line-strong bg-canvas text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink disabled:opacity-40 cursor-pointer"
          >
            <Minus className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <AgeInput id={`${id}-age`} value={value.age} onChange={age => onChange({ ...value, age })} />
          <button
            type="button"
            aria-label="Older"
            onClick={() => onChange({ ...value, age: clampAge(value.age + 1) })}
            disabled={value.age >= MAX_AGE}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-line-strong bg-canvas text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink disabled:opacity-40 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );

  if (!framed) return fields;

  return (
    <div className="space-y-3.5 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
          <GraduationCap className="h-4 w-4 text-ink-subtle" aria-hidden="true" />
          {title}
        </span>
        <span className="text-xs text-ink-subtle">Sets how deep your decks go</span>
      </div>
      {fields}
    </div>
  );
};

/** Lets you type an age freely; keeps the last valid one, and fixes the rest when you leave the field. */
const AgeInput: React.FC<{ id: string; value: number; onChange: (age: number) => void }> = ({ id, value, onChange }) => {
  const [text, setText] = useState(String(value));
  const [shown, setShown] = useState(value);
  // The +/− buttons change the age from outside; show it (adjusting state during render).
  if (shown !== value) {
    setShown(value);
    setText(String(value));
  }
  return (
    <input
      id={id}
      type="number"
      inputMode="numeric"
      min={MIN_AGE}
      max={MAX_AGE}
      value={text}
      onChange={e => {
        setText(e.target.value);
        const age = Number(e.target.value);
        if (Number.isInteger(age) && age >= MIN_AGE && age <= MAX_AGE) onChange(age);
      }}
      onBlur={() => {
        const age = clampAge(Number(text));
        setText(String(age));
        onChange(age);
      }}
      className="h-9 w-16 rounded-lg border border-line-strong bg-canvas text-center text-sm tabular-nums text-ink focus:border-brand focus:outline-none"
    />
  );
};
