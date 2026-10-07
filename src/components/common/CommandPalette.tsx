import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Award,
  BarChart3,
  BookMarked,
  Compass,
  CornerDownLeft,
  Headphones,
  Home,
  Image as ImageIcon,
  Layers,
  Network,
  Plus,
  Search,
  Settings,
  Shuffle,
  Sparkles,
  Target,
  Upload,
  User,
  Volume2,
  Zap,
} from 'lucide-react';
import type { StudySession } from '../../types';
import { StorageService } from '../../services/storageService';
import { CURATED_STARTER_DECKS } from '../../data/curatedStarterCatalog';
import { soundEngine } from '../../services/soundEngine';
import type { SoundType } from '../../services/soundEngine';
import { cn } from '../../utils/cn';
import { Dialog, DialogPanel } from './Dialog';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onStartSession: (session: StudySession) => void;
  onOpenDashboard: () => void;
  onOpenSettings: () => void;
  onOpenAuth?: (tab?: 'login' | 'register' | 'profile') => void;
  onOpenDeckStation?: (session: StudySession) => void;
  onStartMatch?: (session: StudySession) => void;
  onStartAudioBriefing?: (session: StudySession) => void;
  onOpenDeckStudio?: () => void;
  onOpenImageOcclusion?: () => void;
  onOpenExam?: () => void;
  onOpenInterleaving?: () => void;
  onOpenStarterCatalog?: () => void;
  onOpenSanctuary?: () => void;
  onOpenToday?: () => void;
  onOpenLibrary?: () => void;
  onOpenSubjects?: () => void;
}

type Group = 'Go to' | 'Your decks' | 'Starter decks' | 'Study a deck' | 'Focus sound';

interface PaletteItem {
  id: string;
  title: string;
  subtitle?: string;
  keywords?: string;
  icon: LucideIcon;
  group: Group;
  /** Only listed once the learner starts typing, so the empty list stays short. */
  searchOnly?: boolean;
  run: () => void;
}

const GROUP_ORDER: Group[] = ['Go to', 'Your decks', 'Study a deck', 'Starter decks', 'Focus sound'];

const SOUND_OPTIONS: { id: SoundType; label: string; desc: string }[] = [
  { id: 'brown-noise', label: 'Brown noise', desc: 'Deep, steady noise that masks conversation' },
  { id: 'pink-noise', label: 'Pink noise', desc: 'Softer than white noise' },
  { id: 'rain', label: 'Rain', desc: 'Gentle, natural background sound' },
  { id: 'binaural-40hz', label: '40 Hz tone', desc: 'A steady low tone' },
  { id: 'binaural-alpha-10hz', label: '10 Hz tone', desc: 'A calm, slow tone' },
  { id: 'off', label: 'Turn focus sound off', desc: 'Silence' },
];

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onStartSession,
  onOpenDashboard,
  onOpenSettings,
  onOpenAuth,
  onOpenDeckStation,
  onStartMatch,
  onStartAudioBriefing,
  onOpenDeckStudio,
  onOpenImageOcclusion,
  onOpenExam,
  onOpenInterleaving,
  onOpenStarterCatalog,
  onOpenSanctuary,
  onOpenToday,
  onOpenLibrary,
  onOpenSubjects,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const items = useMemo<PaletteItem[]>(() => {
    const run = (fn?: () => void) => () => {
      fn?.();
      onClose();
    };
    const openDeck = (session: StudySession) => run(() => (onOpenDeckStation ? onOpenDeckStation(session) : onStartSession(session)));
    const saved = StorageService.getSessions();
    const savedTitles = new Set(saved.map(s => s.title));

    const goTo: PaletteItem[] = [
      { id: 'go-today', title: 'Today', subtitle: 'Your session and due cards', keywords: 'home', icon: Home, group: 'Go to', run: run(onOpenToday) },
      { id: 'go-library', title: 'Library', subtitle: 'All your decks', keywords: 'decks', icon: BookMarked, group: 'Go to', run: run(onOpenLibrary) },
      { id: 'go-subjects', title: 'Subjects', subtitle: 'Decks grouped by class or exam', keywords: 'folders', icon: Layers, group: 'Go to', run: run(onOpenSubjects) },
      { id: 'go-insights', title: 'Insights', subtitle: 'Memory, streaks and due reviews', keywords: 'dashboard stats retention', icon: BarChart3, group: 'Go to', run: run(onOpenDashboard) },
      { id: 'go-knowledge-map', title: 'Knowledge map', subtitle: 'In Insights', keywords: 'prerequisites tree curriculum', icon: Network, group: 'Go to', run: run(onOpenDashboard) },
      { id: 'go-hard-cards', title: 'Hard cards', subtitle: 'In Insights: cards you keep forgetting', keywords: 'leech lapses', icon: Target, group: 'Go to', run: run(onOpenDashboard) },
      { id: 'go-exam', title: 'Mock exam', subtitle: 'A timed test with confidence scoring', keywords: 'test quiz', icon: Award, group: 'Go to', run: run(onOpenExam) },
      { id: 'go-mix', title: 'Mix decks', subtitle: 'Practise several decks at once', keywords: 'interleaving shuffle', icon: Shuffle, group: 'Go to', run: run(onOpenInterleaving) },
      { id: 'go-starter', title: 'Starter decks', subtitle: 'Ready-made decks to study now', keywords: 'catalog explore', icon: Compass, group: 'Go to', run: run(onOpenStarterCatalog) },
      { id: 'go-new-deck', title: 'New deck', subtitle: 'Write cards or generate them', keywords: 'create studio', icon: Plus, group: 'Go to', run: run(onOpenDeckStudio) },
      { id: 'go-import', title: 'Import cards', subtitle: 'From Anki, Quizlet or a CSV file', keywords: 'anki quizlet csv tsv', icon: Upload, group: 'Go to', searchOnly: true, run: run(onOpenDeckStudio) },
      { id: 'go-diagram', title: 'Diagram cards', subtitle: 'Hide labels on an image and quiz yourself', keywords: 'image occlusion', icon: ImageIcon, group: 'Go to', searchOnly: true, run: run(onOpenImageOcclusion ?? onOpenDeckStudio) },
      { id: 'go-campus', title: 'Campus', subtitle: 'Your home, wallet and room', keywords: 'room home life', icon: Sparkles, group: 'Go to', run: run(onOpenSanctuary) },
      { id: 'go-account', title: 'Account', subtitle: 'Sign in, switch profile or change your level', keywords: 'login profile', icon: User, group: 'Go to', run: run(() => onOpenAuth?.()) },
      { id: 'go-settings', title: 'Settings', subtitle: 'Goal, AI key, reminders and backups', keywords: 'preferences api key', icon: Settings, group: 'Go to', run: run(onOpenSettings) },
    ];

    const decks: PaletteItem[] = saved.flatMap(session => [
      { id: `deck-${session.id}`, title: session.title, subtitle: session.category || 'Your deck', icon: BookMarked, group: 'Your decks' as const, run: openDeck(session) },
      { id: `match-${session.id}`, title: `Speed match: ${session.title}`, icon: Zap, group: 'Study a deck' as const, searchOnly: true, run: run(() => (onStartMatch ? onStartMatch(session) : onStartSession(session))) },
      { id: `audio-${session.id}`, title: `Audio briefing: ${session.title}`, icon: Headphones, group: 'Study a deck' as const, searchOnly: true, run: run(() => (onStartAudioBriefing ? onStartAudioBriefing(session) : onStartSession(session))) },
    ]);

    const starters: PaletteItem[] = CURATED_STARTER_DECKS.filter(d => !savedTitles.has(d.session.title)).map(deck => ({
      id: `starter-${deck.id}`,
      title: deck.title,
      subtitle: deck.category,
      keywords: deck.tags.join(' '),
      icon: Sparkles,
      group: 'Starter decks' as const,
      searchOnly: true,
      run: openDeck(deck.session),
    }));

    const sounds: PaletteItem[] = SOUND_OPTIONS.map(sound => ({
      id: `sound-${sound.id}`,
      title: sound.label,
      subtitle: sound.desc,
      keywords: 'focus sound music noise',
      icon: Volume2,
      group: 'Focus sound' as const,
      searchOnly: true,
      run: run(() => soundEngine.play(sound.id)),
    }));

    return [...goTo, ...decks, ...starters, ...sounds];
  }, [
    onClose,
    onStartSession,
    onOpenDashboard,
    onOpenSettings,
    onOpenAuth,
    onOpenDeckStation,
    onStartMatch,
    onStartAudioBriefing,
    onOpenDeckStudio,
    onOpenImageOcclusion,
    onOpenExam,
    onOpenInterleaving,
    onOpenStarterCatalog,
    onOpenSanctuary,
    onOpenToday,
    onOpenLibrary,
    onOpenSubjects,
  ]);

  const q = query.trim().toLowerCase();
  const results = items
    .filter(item => (q ? `${item.title} ${item.subtitle ?? ''} ${item.keywords ?? ''}`.toLowerCase().includes(q) : !item.searchOnly))
    .sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group));
  const activeIndex = Math.min(selectedIndex, Math.max(0, results.length - 1));
  const activeId = results[activeIndex] ? `palette-${results[activeIndex].id}` : undefined;

  // Keep the highlighted result in view while moving with the arrow keys.
  useEffect(() => {
    if (!activeId) return;
    listRef.current?.querySelector<HTMLElement>(`[id="${activeId}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [activeId]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(results.length ? (activeIndex + 1) % results.length : 0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(results.length ? (activeIndex - 1 + results.length) % results.length : 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      results[activeIndex]?.run();
    }
  };

  let lastGroup: Group | null = null;

  return (
    <Dialog isOpen={isOpen} onClose={onClose} ariaLabel="Search" className="max-w-xl" containerClassName="items-start! pt-[12dvh]!">
      <DialogPanel className="max-h-[min(560px,76dvh)]">
        <div className="flex shrink-0 items-center gap-3 border-b border-line px-4">
          <Search className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
          <input
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-results"
            aria-activedescendant={activeId}
            aria-label="Search decks, pages and focus sounds"
            data-autofocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search decks, pages and focus sounds"
            className="h-12 min-w-0 flex-1 bg-transparent text-[15px] text-ink placeholder:text-ink-subtle outline-none"
          />
          <kbd className="hidden h-5 items-center rounded border border-line bg-surface-hover px-1.5 font-mono text-[10.5px] text-ink-subtle sm:inline-flex">
            Esc
          </kbd>
        </div>

        <div ref={listRef} id="palette-results" role="listbox" aria-label="Results" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
          {results.length === 0 ? (
            <p className="px-3 py-10 text-center text-[13px] text-ink-subtle">Nothing matches “{query.trim()}”.</p>
          ) : (
            results.map((item, idx) => {
              const Icon = item.icon;
              const isActive = idx === activeIndex;
              const showHeading = item.group !== lastGroup;
              lastGroup = item.group;
              return (
                <React.Fragment key={item.id}>
                  {showHeading && <p className="px-2.5 pb-1 pt-3 text-xs font-medium text-ink-subtle first:pt-1">{item.group}</p>}
                  <div
                    id={`palette-${item.id}`}
                    role="option"
                    aria-selected={isActive}
                    onClick={item.run}
                    onMouseMove={() => idx !== activeIndex && setSelectedIndex(idx)}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 transition-colors',
                      isActive ? 'bg-surface-hover' : '',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border',
                        isActive ? 'border-brand/40 bg-brand-soft text-brand-text' : 'border-line text-ink-subtle',
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-ink">{item.title}</span>
                      {item.subtitle && <span className="block truncate text-xs text-ink-subtle">{item.subtitle}</span>}
                    </span>
                    {isActive && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-ink-subtle" aria-hidden="true" />}
                  </div>
                </React.Fragment>
              );
            })
          )}
        </div>

        <div className="flex shrink-0 items-center gap-4 border-t border-line px-4 py-2 text-xs text-ink-subtle">
          <span>
            <kbd className="font-mono">↑↓</kbd> to move
          </span>
          <span>
            <kbd className="font-mono">Enter</kbd> to open
          </span>
          {!q && <span className="ml-auto hidden sm:inline">Type to search starter decks and focus sounds too</span>}
        </div>
      </DialogPanel>
    </Dialog>
  );
};
