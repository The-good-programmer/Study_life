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
    <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-3.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
          <GraduationCap className="w-3.5 h-3.5 text-indigo-400" />
          {title}
        </span>
        <span className="text-[11px] text-slate-400">Calibrates AI study depth</span>
      </div>

      {/* Country Dropdown */}
      <div className="space-y-1">
        <label className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Globe className="w-3 h-3 text-indigo-400" />
            Country & System
          </span>
          <span className="text-[11px] text-slate-500">{countryConfig.systemName}</span>
        </label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsCountryOpen(open => !open)}
            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/[0.1] text-xs text-white flex items-center justify-between cursor-pointer hover:bg-slate-850"
          >
            <div className="flex items-center gap-2">
              <span className="text-base">{countryConfig.flag}</span>
              <span className="font-semibold">{countryConfig.name}</span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {isCountryOpen && (
            <div className="absolute left-0 right-0 mt-1.5 p-1.5 rounded-xl bg-slate-900 border border-indigo-500/40 shadow-2xl z-50 max-h-48 overflow-y-auto space-y-0.5">
              {EDUCATION_COUNTRIES.map(c => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => selectCountry(c.name)}
                  className={`w-full p-2 rounded-lg text-left flex items-center justify-between text-xs cursor-pointer ${
                    value.country === c.name
                      ? 'bg-indigo-600 text-white font-semibold'
                      : 'text-slate-300 hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{c.flag}</span>
                    <span className="truncate">{c.name}</span>
                  </div>
                  {value.country === c.name && <Check className="w-3.5 h-3.5 text-white" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Grade in Country */}
      <div className="space-y-1">
        <label className="text-[11px] font-semibold text-slate-400">Grade in {countryConfig.name}</label>
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
                    ? 'bg-indigo-600/25 border-indigo-500/60 ring-1 ring-indigo-500/40 text-white'
                    : 'bg-slate-900/60 border-white/[0.06] text-slate-300 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold truncate">{g.label}</span>
                  <span className="text-[11px] font-mono text-slate-400 shrink-0">~{g.typicalAge}y</span>
                </div>
                <span className="text-[11px] text-slate-500 block truncate">{g.stage}</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => onChange({ ...value, isCustomGrade: true })}
            className={`text-left p-2 rounded-xl border text-xs transition-all cursor-pointer ${
              value.isCustomGrade
                ? 'bg-indigo-600/25 border-indigo-500/60 ring-1 ring-indigo-500/40 text-white'
                : 'bg-slate-900/60 border-white/[0.06] text-slate-400 hover:text-white'
            }`}
          >
            <div className="font-semibold">Other / Custom Grade</div>
            <span className="text-[11px] text-slate-500 block">Type custom level</span>
          </button>
        </div>

        {value.isCustomGrade && (
          <input
            type="text"
            placeholder={customGradePlaceholder}
            value={value.customGrade}
            onChange={e => onChange({ ...value, customGrade: e.target.value })}
            className="w-full mt-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-indigo-500/40 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        )}
      </div>

      {/* Age Stepper */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
          <span>Student Age</span>
          <span className="text-indigo-300 font-mono font-bold">{value.age} years old</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChange({ ...value, age: Math.max(5, value.age - 1) })}
            className="w-8 h-8 rounded-lg bg-slate-900 border border-white/[0.1] hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center cursor-pointer"
          >
            -
          </button>
          <input
            type="range"
            min={6}
            max={50}
            value={value.age}
            onChange={e => onChange({ ...value, age: Number(e.target.value) })}
            className="flex-1 accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
          />
          <button
            type="button"
            onClick={() => onChange({ ...value, age: Math.min(99, value.age + 1) })}
            className="w-8 h-8 rounded-lg bg-slate-900 border border-white/[0.1] hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center cursor-pointer"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
};
