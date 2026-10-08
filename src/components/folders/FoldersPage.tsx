import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronRight, Edit3, FolderInput, FolderMinus, FolderPlus, Layers, Play, Plus, Search, Shuffle, Trash2 } from 'lucide-react';
import type { StudySession, SubjectFolder } from '../../types';
import { StorageService } from '../../services/storageService';
import { soundEngine } from '../../services/soundEngine';
import { cn } from '../../utils/cn';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { Dialog, DialogFooter, DialogHeader, DialogPanel } from '../common/Dialog';
import { ActionMenu } from '../ui/ActionMenu';
import { Badge, Button } from '../ui/primitives';
import { SubjectFolderModal } from '../studio/SubjectFolderModal';
import { FOLDER_COLORS } from '../studio/folderOptions';
import { MoveToFolderModal } from '../studio/MoveToFolderModal';

interface FoldersPageProps {
  onBack?: () => void;
  onStartSession: (session: StudySession) => void;
  onOpenDeckStation: (session: StudySession) => void;
  onOpenDeckStudio: () => void;
  onStartMatch?: (session: StudySession) => void;
  onOpenInterleaving?: () => void;
}

const QUICK_PRESET_SUBJECTS = [
  { name: 'Biology', icon: '🧬', color: 'emerald', description: 'Cells, the human body and medicine' },
  { name: 'Psychology', icon: '🧠', color: 'purple', description: 'The mind, the brain and behaviour' },
  { name: 'Mathematics', icon: '📐', color: 'blue', description: 'Calculus, algebra, formulas and proofs' },
  { name: 'Computer science', icon: '💻', color: 'cyan', description: 'Data structures, algorithms and systems' },
  { name: 'History', icon: '🏛️', color: 'amber', description: 'Periods, civilisations and turning points' },
  { name: 'Physics and chemistry', icon: '⚛️', color: 'rose', description: 'Forces, energy and reactions' },
];

const cardCountOf = (session: StudySession) =>
  session.concepts?.reduce((sum, concept) => sum + (concept.retrievalCards?.length || 0), 0) || 0;

const colorOf = (folder: SubjectFolder) => FOLDER_COLORS.find(c => c.id === folder.color) || FOLDER_COLORS[0];

/** Subjects: decks grouped by class or exam, studied together. */
export const FoldersPage: React.FC<FoldersPageProps> = ({ onStartSession, onOpenDeckStation, onOpenDeckStudio, onOpenInterleaving }) => {
  const [folders, setFolders] = useState<SubjectFolder[]>(() => StorageService.getFolders());
  const [savedSessions, setSavedSessions] = useState<StudySession[]>(() => StorageService.getSessions());
  const [dueIds, setDueIds] = useState<Set<string>>(() => new Set(StorageService.getDueCards().map(card => card.id)));
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<SubjectFolder | null>(null);
  const [movingSession, setMovingSession] = useState<StudySession | null>(null);
  const [isAddDecksOpen, setIsAddDecksOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<SubjectFolder | null>(null);

  const refresh = () => {
    setFolders(StorageService.getFolders());
    setSavedSessions(StorageService.getSessions());
    setDueIds(new Set(StorageService.getDueCards().map(card => card.id)));
  };

  useEffect(() => StorageService.addMutationListener(refresh), []);

  const dueIn = (session: StudySession) =>
    session.concepts?.reduce((sum, concept) => sum + (concept.retrievalCards || []).filter(card => dueIds.has(card.id)).length, 0) || 0;

  const activeFolder = useMemo(() => folders.find(f => f.id === selectedFolderId) || null, [folders, selectedFolderId]);
  const decksIn = (folderId: string) => savedSessions.filter(s => s.folderId === folderId);
  const unfiled = savedSessions.filter(s => !s.folderId);

  const query = searchQuery.trim().toLowerCase();
  const visibleFolders = query
    ? folders.filter(
        f =>
          f.name.toLowerCase().includes(query) ||
          f.description?.toLowerCase().includes(query) ||
          decksIn(f.id).some(s => s.title.toLowerCase().includes(query)),
      )
    : folders;

  const openNewSubject = () => {
    setEditingFolder(null);
    setIsFolderModalOpen(true);
  };

  const openEditSubject = (folder: SubjectFolder) => {
    setEditingFolder(folder);
    setIsFolderModalOpen(true);
  };

  const handleCreatePreset = (preset: (typeof QUICK_PRESET_SUBJECTS)[number]) => {
    try {
      const folder = StorageService.createFolder(preset.name, preset.color, preset.icon, preset.description);
      soundEngine.playSuccess();
      refresh();
      setSelectedFolderId(folder.id);
    } catch {
      // A failed preset leaves the page as it was.
    }
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    StorageService.deleteFolder(pendingDelete.id);
    soundEngine.playAxolotlBubble();
    if (selectedFolderId === pendingDelete.id) setSelectedFolderId(null);
    setPendingDelete(null);
    refresh();
  };

  // Study the deck in this subject with the most cards due; with nothing due, the first deck.
  const handleStudySubject = (folderId: string) => {
    const decks = decksIn(folderId);
    if (decks.length === 0) return;
    const target = decks.reduce((best, deck) => (dueIn(deck) > dueIn(best) ? deck : best), decks[0]);
    soundEngine.playContextShiftSound();
    onStartSession(target);
  };

  const removeFromSubject = (session: StudySession) => {
    StorageService.setDeckFolder(session.id, null);
    soundEngine.playAxolotlBubble();
    refresh();
  };

  const modals = (
    <>
      <SubjectFolderModal
        isOpen={isFolderModalOpen}
        onClose={() => {
          setIsFolderModalOpen(false);
          setEditingFolder(null);
        }}
        initialFolder={editingFolder}
        onFolderSaved={(saved) => {
          refresh();
          setIsFolderModalOpen(false);
          setEditingFolder(null);
          if (!selectedFolderId) setSelectedFolderId(saved.id);
        }}
      />
      <MoveToFolderModal
        isOpen={!!movingSession}
        session={movingSession}
        onClose={() => setMovingSession(null)}
        onMoved={refresh}
        onOpenNewFolderModal={() => {
          setMovingSession(null);
          openNewSubject();
        }}
      />
      <ConfirmDialog
        isOpen={!!pendingDelete}
        title={`Delete "${pendingDelete?.name ?? ''}"?`}
        confirmLabel="Delete subject"
        tone="danger"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      >
        The subject is removed, but its decks stay in your library, unfiled.
      </ConfirmDialog>
      {activeFolder && (
        <AddDecksDialog
          isOpen={isAddDecksOpen}
          folder={activeFolder}
          folders={folders}
          sessions={savedSessions}
          onToggle={(session, add) => {
            StorageService.setDeckFolder(session.id, add ? activeFolder.id : null);
            soundEngine.playSuccess();
            refresh();
          }}
          onClose={() => setIsAddDecksOpen(false)}
        />
      )}
    </>
  );

  /* -------------------------- One subject -------------------------- */
  if (activeFolder) {
    const decks = decksIn(activeFolder.id);
    const cards = decks.reduce((sum, deck) => sum + cardCountOf(deck), 0);
    const due = decks.reduce((sum, deck) => sum + dueIn(deck), 0);
    const color = colorOf(activeFolder);

    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 animate-fadeIn">
        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => setSelectedFolderId(null)} className="-ml-2">
          All subjects
        </Button>

        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <span className={cn('flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-3xl', color.bg)} aria-hidden="true">
              {activeFolder.icon || '📁'}
            </span>
            <div className="min-w-0">
              <h1 className="text-[26px] font-semibold tracking-tight text-ink sm:text-[30px]">{activeFolder.name}</h1>
              <p className="mt-1 text-[15px] text-ink-muted">
                {decks.length} {decks.length === 1 ? 'deck' : 'decks'} · {cards} {cards === 1 ? 'card' : 'cards'}
                {due > 0 && <span className="font-medium text-due"> · {due} due</span>}
              </p>
              {activeFolder.description && <p className="mt-1 max-w-xl text-[13px] text-ink-subtle">{activeFolder.description}</p>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {decks.length > 0 && (
              <Button variant="primary" icon={Play} onClick={() => handleStudySubject(activeFolder.id)}>
                {due > 0 ? 'Study due cards' : 'Study'}
              </Button>
            )}
            {onOpenInterleaving && decks.length >= 2 && (
              <Button icon={Shuffle} onClick={onOpenInterleaving}>
                Mix decks
              </Button>
            )}
            <Button icon={Plus} onClick={() => setIsAddDecksOpen(true)}>
              Add decks
            </Button>
            <ActionMenu
              label={`More actions for ${activeFolder.name}`}
              items={[
                { label: 'Edit subject', icon: Edit3, onSelect: () => openEditSubject(activeFolder) },
                { label: 'Delete subject', icon: Trash2, tone: 'danger', onSelect: () => setPendingDelete(activeFolder) },
              ]}
            />
          </div>
        </header>

        {decks.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-line-strong px-6 py-14 text-center">
            <p className="text-[15px] font-semibold text-ink">No decks in this subject yet</p>
            <p className="mx-auto mt-1 max-w-sm text-[13px] text-ink-subtle">Add decks you already have, or make a new one.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button variant="primary" icon={Plus} onClick={() => setIsAddDecksOpen(true)}>
                Add decks
              </Button>
              <Button icon={FolderPlus} onClick={onOpenDeckStudio}>
                New deck
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {decks.map(deck => {
              const deckDue = dueIn(deck);
              return (
                <article
                  key={deck.id}
                  className="group flex flex-col rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-line-strong hover:bg-surface-hover"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <Badge>{deck.category || 'General'}</Badge>
                      {deckDue > 0 && <Badge tone="due">{deckDue} due</Badge>}
                    </div>
                    <ActionMenu
                      label={`More actions for ${deck.title}`}
                      items={[
                        { label: 'Move to another subject', icon: FolderInput, onSelect: () => setMovingSession(deck) },
                        { label: 'Remove from subject', icon: FolderMinus, onSelect: () => removeFromSubject(deck) },
                      ]}
                    />
                  </div>
                  <button type="button" onClick={() => onOpenDeckStation(deck)} className="mt-3 text-left cursor-pointer">
                    <h3 className="line-clamp-2 text-[15px] font-medium leading-snug text-ink group-hover:text-brand-text">{deck.title}</h3>
                    {deck.description && <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-ink-subtle">{deck.description}</p>}
                  </button>
                  <p className="mt-auto pt-4 text-[13px] text-ink-subtle">
                    {deck.concepts.length} {deck.concepts.length === 1 ? 'concept' : 'concepts'} · {cardCountOf(deck)} cards
                  </p>
                  <div className="mt-3 flex items-center gap-1">
                    <Button variant="primary" size="sm" icon={Play} onClick={() => onStartSession(deck)} className="flex-1">
                      Study
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onOpenDeckStation(deck)}>
                      Details
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {modals}
      </div>
    );
  }

  /* -------------------------- All subjects -------------------------- */
  const filedCount = savedSessions.length - unfiled.length;
  const totalDue = savedSessions.reduce((sum, deck) => sum + dueIn(deck), 0);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 animate-fadeIn">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[26px] font-semibold tracking-tight text-ink sm:text-[30px]">Subjects</h1>
          <p className="mt-1 text-[15px] text-ink-muted">Group your decks by class or exam, then study a whole subject at once.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button icon={Plus} onClick={onOpenDeckStudio}>
            New deck
          </Button>
          <Button variant="primary" icon={FolderPlus} onClick={openNewSubject}>
            New subject
          </Button>
        </div>
      </header>

      {folders.length > 0 && (
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Subjects" value={folders.length} />
          <Stat label="Decks filed" value={`${filedCount} of ${savedSessions.length}`} />
          <Stat label="Unfiled decks" value={unfiled.length} />
          <Stat label="Cards due" value={totalDue} tone={totalDue > 0 ? 'due' : undefined} />
        </dl>
      )}

      {folders.length === 0 ? (
        <section className="rounded-3xl border border-line bg-surface p-6 text-center sm:p-10">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-2xl" aria-hidden="true">
            📚
          </span>
          <h2 className="mt-4 text-lg font-semibold text-ink">No subjects yet</h2>
          <p className="mx-auto mt-1 max-w-md text-[13px] leading-relaxed text-ink-subtle">
            A subject holds the decks for one class or exam. Start with one of these, or make your own.
          </p>
          <div className="mx-auto mt-6 grid max-w-2xl gap-2 sm:grid-cols-2 md:grid-cols-3">
            {QUICK_PRESET_SUBJECTS.map(preset => (
              <button
                key={preset.name}
                type="button"
                onClick={() => handleCreatePreset(preset)}
                className="flex items-start gap-3 rounded-2xl border border-line bg-canvas p-3 text-left transition-colors hover:border-line-strong hover:bg-surface-hover cursor-pointer"
              >
                <span className="text-xl" aria-hidden="true">
                  {preset.icon}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium text-ink">{preset.name}</span>
                  <span className="block truncate text-xs text-ink-subtle">{preset.description}</span>
                </span>
              </button>
            ))}
          </div>
          <Button variant="primary" icon={FolderPlus} className="mt-6" onClick={openNewSubject}>
            Make your own subject
          </Button>
        </section>
      ) : (
        <section className="space-y-4">
          {folders.length > 3 && (
            <label className="relative block max-w-md">
              <span className="sr-only">Search subjects</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search subjects or decks"
                className="h-10 w-full rounded-xl border border-line-strong bg-canvas pl-9 pr-3 text-sm text-ink placeholder:text-ink-subtle transition-colors focus:border-brand focus:outline-none"
              />
            </label>
          )}

          {visibleFolders.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center text-[13px] text-ink-subtle">
              No subject matches “{searchQuery.trim()}”.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {visibleFolders.map(folder => {
                const decks = decksIn(folder.id);
                const cards = decks.reduce((sum, deck) => sum + cardCountOf(deck), 0);
                const due = decks.reduce((sum, deck) => sum + dueIn(deck), 0);
                return (
                  <article
                    key={folder.id}
                    className="group relative flex flex-col rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-line-strong hover:bg-surface-hover sm:p-5"
                  >
                    <div className="flex items-start gap-3">
                      <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl', colorOf(folder).bg)} aria-hidden="true">
                        {folder.icon || '📁'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate text-[15px] font-semibold text-ink">
                          <button
                            type="button"
                            onClick={() => setSelectedFolderId(folder.id)}
                            className="text-left after:absolute after:inset-0 after:rounded-2xl after:content-[''] cursor-pointer"
                          >
                            {folder.name}
                          </button>
                        </h2>
                        <p className="text-[13px] text-ink-subtle">
                          {decks.length} {decks.length === 1 ? 'deck' : 'decks'} · {cards} {cards === 1 ? 'card' : 'cards'}
                        </p>
                      </div>
                      <div className="relative z-10 flex items-center gap-1">
                        {due > 0 && <Badge tone="due">{due} due</Badge>}
                        <ActionMenu
                          label={`More actions for ${folder.name}`}
                          items={[
                            { label: 'Edit subject', icon: Edit3, onSelect: () => openEditSubject(folder) },
                            { label: 'Delete subject', icon: Trash2, tone: 'danger', onSelect: () => setPendingDelete(folder) },
                          ]}
                        />
                      </div>
                    </div>

                    {folder.description && <p className="mt-3 line-clamp-2 text-[13px] leading-relaxed text-ink-muted">{folder.description}</p>}

                    <ul className="mt-3 space-y-1">
                      {decks.slice(0, 3).map(deck => (
                        <li key={deck.id} className="flex items-center justify-between gap-2 text-[13px]">
                          <span className="truncate text-ink-muted">{deck.title}</span>
                          <span className="shrink-0 tabular-nums text-ink-subtle">{cardCountOf(deck)}</span>
                        </li>
                      ))}
                      {decks.length > 3 && <li className="text-xs text-ink-subtle">and {decks.length - 3} more</li>}
                      {decks.length === 0 && <li className="text-[13px] text-ink-subtle">No decks yet</li>}
                    </ul>

                    <div className="mt-auto flex items-center justify-between gap-2 pt-4 text-[13px] font-medium text-ink-muted group-hover:text-ink">
                      Open
                      <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {unfiled.length > 0 && folders.length > 0 && (
        <section>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-[15px] font-semibold text-ink">Unfiled decks</h2>
              <p className="mt-0.5 text-[13px] text-ink-subtle">Decks that are not in a subject yet.</p>
            </div>
          </div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {unfiled.map(deck => (
              <li key={deck.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{deck.title}</p>
                  <p className="truncate text-xs text-ink-subtle">
                    {deck.category || 'General'} · {cardCountOf(deck)} cards
                  </p>
                </div>
                <Button size="sm" icon={FolderInput} onClick={() => setMovingSession(deck)}>
                  File it
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {modals}
    </div>
  );
};

const Stat: React.FC<{ label: string; value: React.ReactNode; tone?: 'due' }> = ({ label, value, tone }) => (
  <div className="rounded-2xl border border-line bg-surface px-4 py-3">
    <dt className="text-xs text-ink-subtle">{label}</dt>
    <dd className={cn('mt-1 text-xl font-semibold tabular-nums', tone === 'due' ? 'text-due' : 'text-ink')}>{value}</dd>
  </div>
);

const AddDecksDialog: React.FC<{
  isOpen: boolean;
  folder: SubjectFolder;
  folders: SubjectFolder[];
  sessions: StudySession[];
  onToggle: (session: StudySession, add: boolean) => void;
  onClose: () => void;
}> = ({ isOpen, folder, folders, sessions, onToggle, onClose }) => (
  <Dialog isOpen={isOpen} onClose={onClose} titleId="add-decks-title" className="max-w-lg">
    <DialogPanel className="max-h-[min(640px,92dvh)]">
      <DialogHeader
        titleId="add-decks-title"
        title={`Add decks to ${folder.name}`}
        description="A deck belongs to one subject at a time."
        onClose={onClose}
      />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
        {sessions.length === 0 ? (
          <p className="px-3 py-10 text-center text-[13px] text-ink-subtle">Your library has no decks yet.</p>
        ) : (
          <ul className="space-y-0.5">
            {sessions.map(session => {
              const isHere = session.folderId === folder.id;
              const elsewhere = !isHere && session.folderId ? folders.find(f => f.id === session.folderId) : undefined;
              return (
                <li key={session.id} className={cn('flex items-center justify-between gap-3 rounded-xl px-3 py-2.5', isHere && 'bg-brand-soft')}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{session.title}</p>
                    <p className="truncate text-xs text-ink-subtle">
                      {cardCountOf(session)} cards
                      {elsewhere ? ` · now in ${elsewhere.name}` : isHere ? ' · in this subject' : ''}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={isHere ? 'ghost' : 'secondary'}
                    icon={isHere ? FolderMinus : Layers}
                    onClick={() => onToggle(session, !isHere)}
                  >
                    {isHere ? 'Remove' : elsewhere ? 'Move here' : 'Add'}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <DialogFooter className="justify-end">
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      </DialogFooter>
    </DialogPanel>
  </Dialog>
);

export default FoldersPage;
