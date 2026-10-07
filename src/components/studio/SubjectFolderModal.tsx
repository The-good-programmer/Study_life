import React, { useId, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import type { SubjectFolder } from '../../types';
import { StorageService } from '../../services/storageService';
import { soundEngine } from '../../services/soundEngine';
import { cn } from '../../utils/cn';
import { Dialog, DialogFooter, DialogHeader, DialogPanel } from '../common/Dialog';
import { Button } from '../ui/primitives';
import { FOLDER_COLORS, FOLDER_ICONS, SUBJECT_PRESETS } from './folderOptions';

export interface SubjectFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFolderSaved: (folder: SubjectFolder) => void;
  initialFolder?: SubjectFolder | null;
}

const INPUT_CLASS =
  'h-10 w-full rounded-xl border border-line-strong bg-canvas px-3 text-sm text-ink placeholder:text-ink-subtle transition-colors focus:border-brand focus:outline-none';

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
  const fieldId = useId();

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

  if (!isOpen) return null;

  const activeColor = FOLDER_COLORS.find(c => c.id === color) || FOLDER_COLORS[0];
  const titleId = `${fieldId}-title`;
  const nameId = `${fieldId}-name`;
  const errorId = `${fieldId}-error`;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Give the subject a name.');
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
      setError(err instanceof Error ? err.message : 'Could not save this subject.');
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} titleId={titleId} className="max-w-md">
      <DialogPanel>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col" noValidate>
          <DialogHeader
            titleId={titleId}
            title={initialFolder ? 'Edit subject' : 'New subject'}
            description="Group related decks, like a class or an exam."
            onClose={onClose}
            leading={
              <span
                className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl', activeColor.bg)}
                aria-hidden="true"
              >
                {icon}
              </span>
            }
          />

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
            <div>
              <label htmlFor={nameId} className="text-[13px] font-medium text-ink">
                Name
              </label>
              <input
                ref={inputRef}
                id={nameId}
                type="text"
                data-autofocus
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="e.g. AP Biology, Calculus II"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                maxLength={60}
                className={cn(INPUT_CLASS, 'mt-1.5', error && 'border-danger')}
              />
              {error && (
                <p id={errorId} className="mt-1.5 text-xs font-medium text-danger">
                  {error}
                </p>
              )}
              {!initialFolder && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {SUBJECT_PRESETS.slice(0, 6).map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setName(preset);
                        if (error) setError(null);
                      }}
                      className="inline-flex h-7 items-center rounded-lg border border-line px-2.5 text-xs text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink cursor-pointer"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <fieldset>
              <legend className="text-[13px] font-medium text-ink">Icon</legend>
              <div className="mt-1.5 grid grid-cols-8 gap-1">
                {FOLDER_ICONS.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setIcon(emoji)}
                    aria-pressed={icon === emoji}
                    aria-label={`Icon ${emoji}`}
                    className={cn(
                      'flex aspect-square items-center justify-center rounded-lg text-lg transition-colors cursor-pointer',
                      icon === emoji ? 'bg-brand-soft ring-1 ring-brand' : 'hover:bg-surface-hover',
                    )}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-[13px] font-medium text-ink">Color</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {FOLDER_COLORS.map(option => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setColor(option.id)}
                    aria-pressed={color === option.id}
                    aria-label={option.name}
                    title={option.name}
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full transition-transform cursor-pointer hover:scale-105',
                      option.dot,
                      color === option.id && 'ring-2 ring-ink ring-offset-2 ring-offset-surface-solid',
                    )}
                  >
                    {color === option.id && <Check className="h-4 w-4 text-brand-ink" aria-hidden="true" />}
                  </button>
                ))}
              </div>
            </fieldset>

            <div>
              <label htmlFor={`${fieldId}-description`} className="flex items-baseline justify-between text-[13px] font-medium text-ink">
                Description
                <span className="text-xs font-normal text-ink-subtle">Optional</span>
              </label>
              <input
                id={`${fieldId}-description`}
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Final exam on 12 December"
                maxLength={120}
                className={cn(INPUT_CLASS, 'mt-1.5')}
              />
            </div>
          </div>

          <DialogFooter className="justify-end">
            <Button onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary">
              {initialFolder ? 'Save changes' : 'Create subject'}
            </Button>
          </DialogFooter>
        </form>
      </DialogPanel>
    </Dialog>
  );
};
