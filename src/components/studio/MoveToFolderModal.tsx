import React from 'react';
import { X, Check, Plus, FolderInput, FolderMinus } from 'lucide-react';
import type { StudySession } from '../../types';
import { StorageService } from '../../services/storageService';
import { soundEngine } from '../../services/soundEngine';
import { FOLDER_COLORS } from './SubjectFolderModal';

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
  const currentFolder = folders.find(f => f.id === currentFolderId);

  const handleSelectFolder = (folderId: string | null) => {
    StorageService.setDeckFolder(session.id, folderId);
    soundEngine.playSuccess();
    const updated = {
      ...session,
      folderId: folderId || undefined,
    };
    onMoved(updated);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-sm rounded-3xl bg-slate-900 border border-white/[0.1] shadow-2xl overflow-hidden p-5 space-y-4 animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <FolderInput className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white font-display">
                Organize into Subject
              </h3>
              <p className="text-[11px] text-slate-400 truncate max-w-[200px]">
                "{session.title}"
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Status Pill */}
        <div className="px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between text-xs">
          <span className="text-slate-400">Current Folder:</span>
          {currentFolder ? (
            <span className="font-bold text-indigo-300 flex items-center gap-1">
              <span>{currentFolder.icon || '📁'}</span>
              <span>{currentFolder.name}</span>
            </span>
          ) : (
            <span className="text-slate-500 font-medium italic">Uncategorized</span>
          )}
        </div>

        {/* Folders List */}
        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
          {/* Option: Uncategorized / None */}
          <button
            type="button"
            onClick={() => handleSelectFolder(null)}
            className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
              !currentFolderId
                ? 'bg-slate-800 border-indigo-500/50 text-white shadow-sm'
                : 'bg-white/[0.02] hover:bg-white/[0.05] border-white/[0.06] text-slate-300'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-slate-800 border border-white/[0.08] flex items-center justify-center text-slate-400">
                <FolderMinus className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-xs font-semibold block">None (Uncategorized)</span>
                <span className="text-[10px] text-slate-500">Root library level</span>
              </div>
            </div>
            {!currentFolderId && <Check className="w-4 h-4 text-indigo-400" />}
          </button>

          {/* Subject Folders */}
          {folders.map((folder) => {
            const isSelected = currentFolderId === folder.id;
            const colorDef = FOLDER_COLORS.find(c => c.id === folder.color) || FOLDER_COLORS[0];
            return (
              <button
                key={folder.id}
                type="button"
                onClick={() => handleSelectFolder(folder.id)}
                className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                  isSelected
                    ? `${colorDef.bg} ${colorDef.border} text-white shadow-sm ring-1 ring-white/20`
                    : 'bg-white/[0.02] hover:bg-white/[0.05] border-white/[0.06] text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-7 h-7 rounded-lg ${colorDef.bg} border ${colorDef.border} flex items-center justify-center text-sm shadow-sm`}>
                    <span>{folder.icon || '📁'}</span>
                  </div>
                  <div>
                    <span className="text-xs font-semibold block">{folder.name}</span>
                    {folder.description && (
                      <span className="text-[10px] text-slate-400 line-clamp-1">{folder.description}</span>
                    )}
                  </div>
                </div>
                {isSelected && <Check className={`w-4 h-4 ${colorDef.text}`} />}
              </button>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenNewFolderModal();
            }}
            className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create New Subject</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-semibold text-slate-300 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
