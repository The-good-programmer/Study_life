import React, { useState, useEffect, useRef } from 'react';
import { X, Check, FolderPlus } from 'lucide-react';
import type { SubjectFolder } from '../../types';
import { StorageService } from '../../services/storageService';
import { soundEngine } from '../../services/soundEngine';
import { FOLDER_COLORS, FOLDER_ICONS, SUBJECT_PRESETS } from './folderOptions';

export interface SubjectFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFolderSaved: (folder: SubjectFolder) => void;
  initialFolder?: SubjectFolder | null;
}

export const SubjectFolderModal: React.FC<SubjectFolderModalProps> = ({
  isOpen,
  onClose,
  onFolderSaved,
  initialFolder,
}) => {
  const [name, setName] = useState(initialFolder?.name || '');
  const [color, setColor] = useState(initialFolder?.color || 'indigo');
  const [icon, setIcon] = useState(initialFolder?.icon || '📚');
  const [description, setDescription] = useState(initialFolder?.description || '');
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Reset the form each time the modal opens or targets a different folder
  // (adjusting state during render, rather than in an effect).
  const [formFor, setFormFor] = useState({ isOpen, initialFolder });
  if (formFor.isOpen !== isOpen || formFor.initialFolder !== initialFolder) {
    setFormFor({ isOpen, initialFolder });
    if (isOpen) {
      setName(initialFolder?.name || '');
      setColor(initialFolder?.color || 'indigo');
      setIcon(initialFolder?.icon || '📚');
      setDescription(initialFolder?.description || '');
      setError(null);
    }
  }

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(timer);
  }, [isOpen, initialFolder]);

  if (!isOpen) return null;

  const activeColorDef = FOLDER_COLORS.find(c => c.id === color) || FOLDER_COLORS[0];

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter a subject name.');
      inputRef.current?.focus();
      return;
    }

    try {
      let saved: SubjectFolder;
      if (initialFolder) {
        const res = StorageService.updateFolder(initialFolder.id, {
          name: trimmed,
          color,
          icon,
          description: description.trim(),
        });
        saved = res || { ...initialFolder, name: trimmed, color, icon, description: description.trim() };
      } else {
        saved = StorageService.createFolder(trimmed, color, icon, description.trim());
      }

      soundEngine.playSuccess();
      onFolderSaved(saved);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not save subject folder';
      setError(msg);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-md rounded-3xl bg-slate-900 border border-white/[0.1] shadow-2xl overflow-hidden p-6 space-y-5 animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl ${activeColorDef.bg} border ${activeColorDef.border} flex items-center justify-center text-lg shadow-sm`}>
              <span>{icon}</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white font-display">
                {initialFolder ? 'Edit Subject Folder' : 'New Subject Folder'}
              </h3>
              <p className="text-[11px] text-slate-400">
                Organize and gather your study decks into subjects
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Subject Name Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Subject Name</span>
              <span className="text-[11px] text-slate-500 font-normal">Required</span>
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="e.g. Neuroscience 101, Calculus BC, AP Biology"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-white/[0.1] text-white text-xs placeholder:text-slate-500 outline-none focus:border-indigo-500/80 transition-colors"
              />
            </div>
            {error && (
              <p className="text-[11px] font-semibold text-rose-400">{error}</p>
            )}

            {/* Quick Preset Chips */}
            {!initialFolder && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold self-center pr-1">Ideas:</span>
                {SUBJECT_PRESETS.slice(0, 5).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setName(preset);
                      if (error) setError(null);
                    }}
                    className="px-2 py-0.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[11px] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Icon / Emoji Picker */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Subject Icon
            </label>
            <div className="grid grid-cols-8 gap-1.5 p-2 rounded-2xl bg-slate-950/80 border border-white/[0.08]">
              {FOLDER_ICONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setIcon(emoji)}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-transform cursor-pointer ${
                    icon === emoji 
                      ? 'bg-white/[0.15] scale-110 shadow-sm ring-1 ring-white/30' 
                      : 'hover:bg-white/[0.06] hover:scale-105'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Color Swatch Picker */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Folder Color Theme
            </label>
            <div className="grid grid-cols-7 gap-2 p-2 rounded-2xl bg-slate-950/80 border border-white/[0.08]">
              {FOLDER_COLORS.map((col) => (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => setColor(col.id)}
                  title={col.name}
                  className={`h-9 rounded-xl ${col.bg} border ${col.border} flex items-center justify-center transition-all cursor-pointer ${
                    color === col.id ? 'ring-2 ring-white scale-105 shadow-md ' + col.glow : 'hover:scale-105 opacity-80 hover:opacity-100'
                  }`}
                >
                  <div className={`w-3.5 h-3.5 rounded-full ${col.dot} flex items-center justify-center`}>
                    {color === col.id && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Description (Optional) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Description</span>
              <span className="text-[11px] text-slate-500 font-normal">Optional</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Fall Semester final exam preparation"
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border border-white/[0.1] text-white text-xs placeholder:text-slate-500 outline-none focus:border-indigo-500/80 transition-colors"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-white/[0.08] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-tactile btn-tactile-primary px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/30"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>{initialFolder ? 'Update Subject' : 'Create Subject'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
