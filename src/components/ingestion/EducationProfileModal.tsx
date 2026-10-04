import React, { useState } from 'react';
import { X, GraduationCap, Globe, Sparkles, Check, ChevronDown } from 'lucide-react';
import type { StudentEducationProfile } from '../../types';
import { EDUCATION_COUNTRIES, EducationCatalog } from '../../services/educationCatalog';

interface EducationProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialProfile?: StudentEducationProfile | null;
  onSave: (profile: StudentEducationProfile) => void;
  title?: string;
  description?: string;
  actionLabel?: string;
}

export const EducationProfileModal: React.FC<EducationProfileModalProps> = ({
  isOpen,
  onClose,
  initialProfile,
  onSave,
  title = 'Tailor Your Study Program',
  description = 'Tell Gemini your educational details so explanations, formulas, and flashcards perfectly match your grade and national curriculum.',
  actionLabel = 'Save & Generate Plan ✨',
}) => {
  const [selectedCountryName, setSelectedCountryName] = useState<string>(initialProfile?.country || 'United States');
  const [selectedGrade, setSelectedGrade] = useState<string>(initialProfile?.grade || '9th Grade (High School Freshman)');
  const [customGrade, setCustomGrade] = useState<string>('');
  const [isCustomGrade, setIsCustomGrade] = useState(false);
  const [age, setAge] = useState<number>(initialProfile?.age || 14);
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);

  const countryConfig = EducationCatalog.getCountry(selectedCountryName);
  const availableGrades = countryConfig.grades;

  // Sync state when modal opens or initialProfile changes
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [prevInitialProfile, setPrevInitialProfile] = useState(initialProfile);

  if (isOpen !== prevIsOpen || initialProfile !== prevInitialProfile) {
    setPrevIsOpen(isOpen);
    setPrevInitialProfile(initialProfile);
    if (isOpen && initialProfile) {
      setSelectedCountryName(initialProfile.country);
      setAge(initialProfile.age);

      const conf = EducationCatalog.getCountry(initialProfile.country);
      const existsInPredefined = conf.grades.some(g => g.label === initialProfile.grade);
      if (existsInPredefined) {
        setSelectedGrade(initialProfile.grade);
        setIsCustomGrade(false);
      } else {
        setSelectedGrade('custom');
        setCustomGrade(initialProfile.grade);
        setIsCustomGrade(true);
      }
    }
  }

  if (!isOpen) return null;

  const handleCountrySelect = (cName: string) => {
    setSelectedCountryName(cName);
    setIsCountryDropdownOpen(false);

    // Pick first secondary / middle grade of that country as default
    const newCountry = EducationCatalog.getCountry(cName);
    const defaultGrade = newCountry.grades[Math.min(6, newCountry.grades.length - 1)];
    if (defaultGrade) {
      setSelectedGrade(defaultGrade.label);
      setAge(defaultGrade.typicalAge);
      setIsCustomGrade(false);
    }
  };

  const handleGradeSelect = (gradeLabel: string, typicalAge: number) => {
    setSelectedGrade(gradeLabel);
    setIsCustomGrade(false);
    setAge(typicalAge);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalGrade = isCustomGrade ? (customGrade.trim() || 'Secondary School') : selectedGrade;
    onSave({
      country: selectedCountryName,
      grade: finalGrade,
      age: Math.max(5, Math.min(100, age)),
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div 
        className="relative w-full max-w-lg bg-[#0e111d] border border-indigo-500/30 rounded-3xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-display flex items-center gap-2">
                {title}
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                  AI Calibrated
                </span>
              </h2>
              <p className="text-xs text-slate-400 line-clamp-1">{description}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* 1. Country Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-indigo-400" />
                Country & Educational System
              </span>
              <span className="text-[10px] text-slate-400">{countryConfig.systemName}</span>
            </label>

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsCountryDropdownOpen(!isCountryDropdownOpen)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-850 border border-white/[0.12] text-sm text-white flex items-center justify-between transition-all cursor-pointer shadow-sm"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">{countryConfig.flag}</span>
                  <span className="font-semibold">{countryConfig.name}</span>
                  <span className="text-[10px] text-slate-500 font-mono">({countryConfig.systemName})</span>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>

              {isCountryDropdownOpen && (
                <div className="absolute left-0 right-0 mt-2 p-2 rounded-2xl bg-slate-900 border border-indigo-500/40 shadow-2xl z-50 backdrop-blur-xl max-h-56 overflow-y-auto space-y-1">
                  {EDUCATION_COUNTRIES.map(c => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => handleCountrySelect(c.name)}
                      className={`w-full p-2.5 rounded-xl text-left flex items-center justify-between text-xs transition-colors cursor-pointer ${
                        selectedCountryName === c.name
                          ? 'bg-indigo-600 text-white font-semibold'
                          : 'text-slate-300 hover:bg-white/[0.06]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">{c.flag}</span>
                        <div>
                          <span className="font-semibold text-xs block">{c.name}</span>
                          <span className={`text-[10px] ${selectedCountryName === c.name ? 'text-indigo-200' : 'text-slate-500'}`}>
                            {c.systemName}
                          </span>
                        </div>
                      </div>
                      {selectedCountryName === c.name && <Check className="w-4 h-4 text-white" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 2. Grade in Selected Country */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-indigo-400" />
                Select Your Grade in {countryConfig.name}
              </span>
              <span className="text-[10px] text-indigo-300">Sets difficulty & curriculum</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {availableGrades.map(g => {
                const isSelected = !isCustomGrade && selectedGrade === g.label;
                return (
                  <button
                    key={g.label}
                    type="button"
                    onClick={() => handleGradeSelect(g.label, g.typicalAge)}
                    className={`text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600/25 border-indigo-500/60 ring-1 ring-indigo-500/40 text-white shadow-sm'
                        : 'bg-slate-900/60 border-white/[0.06] text-slate-300 hover:text-white hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-100">{g.label}</span>
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-white/[0.08] text-slate-400">
                        ~{g.typicalAge} yrs
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-0.5">{g.stage}</span>
                  </button>
                );
              })}

              {/* Custom Grade Option */}
              <button
                type="button"
                onClick={() => setIsCustomGrade(true)}
                className={`text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                  isCustomGrade
                    ? 'bg-indigo-600/25 border-indigo-500/60 ring-1 ring-indigo-500/40 text-white'
                    : 'bg-slate-900/60 border-white/[0.06] text-slate-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200">Other / Custom Grade</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-white/[0.08] text-slate-400">
                    Type own
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 block mt-0.5">Custom academic level</span>
              </button>
            </div>

            {/* Custom Grade Input (if custom selected) */}
            {isCustomGrade && (
              <div className="pt-2">
                <input
                  type="text"
                  required
                  placeholder="e.g. 4th Grade, GCSE Physics Student, or Medical Resident"
                  value={customGrade}
                  onChange={e => setCustomGrade(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900/90 border border-indigo-500/50 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  autoFocus
                />
              </div>
            )}
          </div>

          {/* 3. Student Age */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">
                Your Age (Years Old)
              </label>
              <span className="text-xs font-bold font-mono text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                {age} years old
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setAge(prev => Math.max(5, prev - 1))}
                className="w-10 h-10 rounded-xl bg-slate-900 border border-white/[0.1] hover:bg-slate-800 text-white font-bold text-base flex items-center justify-center cursor-pointer"
              >
                -
              </button>
              <input
                type="range"
                min={6}
                max={50}
                value={age}
                onChange={e => setAge(Number(e.target.value))}
                className="flex-1 accent-indigo-500 cursor-pointer"
              />
              <button
                type="button"
                onClick={() => setAge(prev => Math.min(99, prev + 1))}
                className="w-10 h-10 rounded-xl bg-slate-900 border border-white/[0.1] hover:bg-slate-800 text-white font-bold text-base flex items-center justify-center cursor-pointer"
              >
                +
              </button>
            </div>
            <p className="text-[10px] text-slate-500">
              Gemini adjusts sentence structures, vocabulary, and relatable analogies directly to a {age}-year-old mind.
            </p>
          </div>

          {/* Educational Calibration Summary Callout */}
          <div className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <div className="text-xs text-indigo-200">
              <span className="font-bold text-white block">Adaptive Gemini Prompt Instruction:</span>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                "Calibrate all explanations, cognitive depth, and question difficulty for a <strong className="text-white">{age}-year-old</strong> student studying in <strong className="text-white">{isCustomGrade ? customGrade : selectedGrade}</strong> under the <strong className="text-white">{countryConfig.name}</strong> educational curriculum."
              </p>
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-2 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 rounded-xl bg-slate-900 text-slate-400 hover:text-white border border-white/[0.08] text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="py-2.5 px-6 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all cursor-pointer flex items-center gap-2"
            >
              <Sparkles className="w-3.5 h-3.5 text-white" />
              <span>{actionLabel}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
