import React, { useState } from 'react';
import type { StudentEducationProfile } from '../../types';
import { EducationCatalog } from '../../services/educationCatalog';
import { EducationFields } from '../auth/EducationFields';
import { createEducationDraft, resolveGrade, type EducationDraft } from '../auth/educationDraft';
import { Dialog, DialogFooter, DialogHeader, DialogPanel } from '../common/Dialog';
import { Button } from '../ui/primitives';

interface EducationProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialProfile?: StudentEducationProfile | null;
  onSave: (profile: StudentEducationProfile) => void;
  title?: string;
  description?: string;
  actionLabel?: string;
}

/** A saved profile as a form draft; a grade the country doesn't list becomes a typed one. */
const draftFrom = (profile?: StudentEducationProfile | null): EducationDraft => {
  if (!profile) return createEducationDraft();
  const listed = EducationCatalog.getCountry(profile.country).grades.some(g => g.label === profile.grade);
  return createEducationDraft({
    country: profile.country,
    age: profile.age,
    ...(listed ? { grade: profile.grade } : { isCustomGrade: true, customGrade: profile.grade }),
  });
};

/** Your country, grade and age, which set how deep and how simply decks are written. */
export const EducationProfileModal: React.FC<EducationProfileModalProps> = ({
  isOpen,
  onClose,
  initialProfile,
  onSave,
  title = 'Your level',
  description = 'Decks are written for your level: the right depth, words and examples.',
  actionLabel = 'Save',
}) => {
  const [draft, setDraft] = useState(() => draftFrom(initialProfile));

  // Start from the saved profile each time the dialog opens (adjusting state during render).
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) setDraft(draftFrom(initialProfile));
  }

  const grade = resolveGrade(draft);
  const country = EducationCatalog.getCountry(draft.country);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ country: draft.country, grade, age: draft.age });
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} titleId="education-title" className="max-w-lg">
      <DialogPanel>
        <DialogHeader titleId="education-title" title={title} description={description} onClose={onClose} />
        <form id="education-form" onSubmit={save} className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          <EducationFields value={draft} onChange={setDraft} framed={false} />
          <p className="rounded-2xl bg-surface-hover px-4 py-3 text-[13px] leading-relaxed text-ink-muted">
            New decks will be written for a <span className="font-medium text-ink">{draft.age}-year-old</span> in{' '}
            <span className="font-medium text-ink">{grade}</span>, {country.name}.
          </p>
        </form>
        <DialogFooter className="justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="education-form" variant="primary">
            {actionLabel}
          </Button>
        </DialogFooter>
      </DialogPanel>
    </Dialog>
  );
};
