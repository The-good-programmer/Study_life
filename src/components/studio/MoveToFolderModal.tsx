import React from 'react';
import { Check, FolderMinus, Plus } from 'lucide-react';
import type { StudySession } from '../../types';
import { StorageService } from '../../services/storageService';
import { soundEngine } from '../../services/soundEngine';
import { cn } from '../../utils/cn';
import { Dialog, DialogFooter, DialogHeader, DialogPanel } from '../common/Dialog';
import { Button } from '../ui/primitives';
import { FOLDER_COLORS } from './folderOptions';

export interface MoveToFolderModalProps {
  isOpen: boolean;
  session: StudySession | null;
  onClose: () => void;
  onMoved: (updatedSession: StudySession) => void;
  onOpenNewFolderModal: () => void;
}

export const MoveToFolderModal: React.FC<MoveToFolderModalProps> = ({
  isOpen,
  session,
  onClose,
  onMoved,
  onOpenNewFolderModal,
}) => {
  if (!isOpen || !session) return null;

  const folders = StorageService.getFolders();
  const currentFolderId = session.folderId;

  const handleSelectFolder = (folderId: string | null) => {
    StorageService.setDeckFolder(session.id, folderId);
    soundEngine.playSuccess();
    onMoved({ ...session, folderId: folderId || undefined });
    onClose();
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} titleId="move-to-subject-title" className="max-w-sm">
      <DialogPanel>
        <DialogHeader
          titleId="move-to-subject-title"
          title="Move to subject"
          description={<span className="line-clamp-1">{session.title}</span>}
          onClose={onClose}
        />

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
          <ul className="space-y-0.5">
            <li>
              <FolderOption
                label="No subject"
                hint="Keep it in the main library"
                isSelected={!currentFolderId}
                marker={
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-hover text-ink-subtle">
                    <FolderMinus className="h-4 w-4" aria-hidden="true" />
                  </span>
                }
                onSelect={() => handleSelectFolder(null)}
              />
            </li>
            {folders.map(folder => {
              const color = FOLDER_COLORS.find(c => c.id === folder.color) || FOLDER_COLORS[0];
              return (
                <li key={folder.id}>
                  <FolderOption
                    label={folder.name}
                    hint={folder.description}
                    isSelected={currentFolderId === folder.id}
                    marker={
                      <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg text-base', color.bg)}>
                        {folder.icon || '📁'}
                      </span>
                    }
                    onSelect={() => handleSelectFolder(folder.id)}
                  />
                </li>
              );
            })}
          </ul>
          {folders.length === 0 && (
            <p className="px-3 pb-2 pt-3 text-[13px] text-ink-subtle">
              You have no subjects yet. Create one to group decks for a class or an exam.
            </p>
          )}
        </div>

        <DialogFooter className="justify-between">
          <Button
            size="sm"
            variant="ghost"
            icon={Plus}
            onClick={() => {
              onClose();
              onOpenNewFolderModal();
            }}
          >
            New subject
          </Button>
          <Button size="sm" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogPanel>
    </Dialog>
  );
};

const FolderOption: React.FC<{
  label: string;
  hint?: string;
  isSelected: boolean;
  marker: React.ReactNode;
  onSelect: () => void;
}> = ({ label, hint, isSelected, marker, onSelect }) => (
  <button
    type="button"
    onClick={onSelect}
    aria-pressed={isSelected}
    data-autofocus={isSelected || undefined}
    className={cn(
      'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors cursor-pointer',
      isSelected ? 'bg-brand-soft' : 'hover:bg-surface-hover',
    )}
  >
    {marker}
    <span className="min-w-0 flex-1">
      <span className="block truncate text-sm font-medium text-ink">{label}</span>
      {hint && <span className="block truncate text-xs text-ink-subtle">{hint}</span>}
    </span>
    {isSelected && <Check className="h-4 w-4 shrink-0 text-brand-text" aria-hidden="true" />}
  </button>
);
