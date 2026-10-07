import React, { useState } from 'react';
import { GraduationCap, Globe, ChevronDown, Check } from 'lucide-react';
import { EDUCATION_COUNTRIES, EducationCatalog } from '../../services/educationCatalog';
import type { EducationDraft } from './educationDraft';

interface EducationFieldsProps {
  value: EducationDraft;
  onChange: (next: EducationDraft) => void;
  customGradePlaceholder?: string;
  title?: string;
}

/**
 * Educational profile picker (country, grade, age) shared by the register, Google
 * setup and edit-profile forms. It calibrates how deep and how simple the AI explains.
 */
export const EducationFields: React.FC<EducationFieldsProps> = ({
  value,
  onChange,
  customGradePlaceholder = 'e.g. 4th Grade, Medical Resident, or AP Scholar',
  title = 'Educational System & Grade',
}) => {
  const [isCountryOpen, setIsCountryOpen] = useState(false);
  const countryConfig = EducationCatalog.getCountry(value.country);

  const selectCountry = (name: string) => {
    setIsCountryOpen(false);
    const next = EducationCatalog.getCountry(name);
    const defaultGrade = next.grades[Math.min(6, next.grades.length - 1)];
    onChange(
      defaultGrade
        ? { ...value, country: name, grade: defaultGrade.label, age: defaultGrade.typicalAge, isCustomGrade: false }
        : { ...value, country: name },
    );
  };

  return (
    <div className="p-3.5 rounded-2xl bg-surface border border-line space-y-3.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-brand-text flex items-center gap-1.5">
          <GraduationCap className="h-3.5 w-3.5 text-ink-subtle" />
          {title}
        </span>
        <span className="text-[11px] text-ink-subtle">Sets how deep your decks go</span>
      </div>

      {/* Country Dropdown */}
      <div className="space-y-1">
        <label className="text-[11px] font-semibold text-ink-subtle flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Globe className="w-3 h-3 text-brand-text" />
            Country
          </span>
          <span className="text-[11px] text-ink-subtle">{countryConfig.systemName}</span>
        </label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsCountryOpen(open => !open)}
            className="w-full px-3 py-2 rounded-xl bg-canvas border border-line-strong text-xs text-ink flex items-center justify-between cursor-pointer hover:bg-surface-hover"
          >
            <div className="flex items-center gap-2">
              <span className="text-base">{countryConfig.flag}</span>
              <span className="font-semibold">{countryConfig.name}</span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-ink-subtle" />
          </button>

          {isCountryOpen && (
            <div className="absolute left-0 right-0 mt-1.5 p-1.5 rounded-xl bg-canvas border border-brand/40 shadow-2xl z-50 max-h-48 overflow-y-auto space-y-0.5">
              {EDUCATION_COUNTRIES.map(c => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => selectCountry(c.name)}
                  className={`w-full p-2 rounded-lg text-left flex items-center justify-between text-xs cursor-pointer ${
                    value.country === c.name
                      ? 'bg-brand text-brand-ink font-semibold'
                      : 'text-ink-muted hover:bg-surface-hover'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{c.flag}</span>
                    <span className="truncate">{c.name}</span>
                  </div>
                  {value.country === c.name && <Check className="w-3.5 h-3.5 text-ink" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Grade in Country */}
      <div className="space-y-1">
        <label className="text-[11px] font-semibold text-ink-subtle">Grade in {countryConfig.name}</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
          {countryConfig.grades.map(g => {
            const isSelected = !value.isCustomGrade && value.grade === g.label;
            return (
              <button
                key={g.label}
                type="button"
                onClick={() => onChange({ ...value, grade: g.label, age: g.typicalAge, isCustomGrade: false })}
                className={`text-left p-2 rounded-xl border text-xs transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-brand-soft border-brand text-ink'
                    : 'bg-surface border-line text-ink-muted hover:text-ink hover:bg-surface-hover'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold truncate">{g.label}</span>
                  <span className="text-[11px] font-mono text-ink-subtle shrink-0">~{g.typicalAge}y</span>
                </div>
                <span className="text-[11px] text-ink-subtle block truncate">{g.stage}</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => onChange({ ...value, isCustomGrade: true })}
            className={`text-left p-2 rounded-xl border text-xs transition-all cursor-pointer ${
              value.isCustomGrade
                ? 'bg-brand-soft border-brand text-ink'
                : 'bg-surface border-line text-ink-subtle hover:text-ink'
            }`}
          >
            <div className="font-semibold">Other</div>
            <span className="text-[11px] text-ink-subtle block">Type your own</span>
          </button>
        </div>

        {value.isCustomGrade && (
          <input
            type="text"
            placeholder={customGradePlaceholder}
            value={value.customGrade}
            onChange={e => onChange({ ...value, customGrade: e.target.value })}
            className="w-full mt-1.5 px-3 py-1.5 rounded-lg bg-canvas border border-brand/40 text-xs text-ink placeholder:text-ink-subtle focus:outline-none"
          />
        )}
      </div>

      {/* Age Stepper */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] font-semibold text-ink-subtle">
          <span>Age</span>
          <span className="text-brand-text font-mono font-semibold">{value.age} years old</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChange({ ...value, age: Math.max(5, value.age - 1) })}
            className="w-8 h-8 rounded-lg bg-canvas border border-line-strong hover:bg-surface-hover text-ink font-semibold text-xs flex items-center justify-center cursor-pointer"
          >
            -
          </button>
          <input
            type="range"
            min={6}
            max={50}
            value={value.age}
            onChange={e => onChange({ ...value, age: Number(e.target.value) })}
            className="flex-1 accent-brand cursor-pointer h-1.5 bg-surface-hover rounded-lg"
          />
          <button
            type="button"
            onClick={() => onChange({ ...value, age: Math.min(99, value.age + 1) })}
            className="w-8 h-8 rounded-lg bg-canvas border border-line-strong hover:bg-surface-hover text-ink font-semibold text-xs flex items-center justify-center cursor-pointer"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
};
