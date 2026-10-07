import React, { useState, useEffect, useCallback } from 'react';
import {
  Home,
  Star,
  Layers,
  Award,
  Shuffle,
  Plus,
  Play,
  Settings,
  X,
  VolumeX,
  Volume2,
  WifiOff,
  LineChart,
  PanelLeftClose,
  PanelLeftOpen,
  Compass,
  Folder,
  Building2,
  ChevronRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { UserStats, UserAccount } from '../../types';
import { soundEngine } from '../../services/soundEngine';
import { StorageService } from '../../services/storageService';
import { lifeSimService } from '../../services/lifeSimService';
import { UserAvatarBadge } from '../character/UserAvatarBadge';
import { BrandMark, CoinIcon } from '../ui/primitives';
import { cn } from '../../utils/cn';

type View = 'home' | 'dashboard' | 'exam' | 'interleave' | 'sanctuary' | 'studio' | 'folders';

interface SidebarProps {
  activeView: View;
  onNavigate: (view: View) => void;
  stats: UserStats;
  currentUser?: UserAccount | null;
  onOpenAuth?: (tab?: 'login' | 'register' | 'profile') => void;
  onOpenDeckStudio: () => void;
  onOpenStarterCatalog: () => void;
  onOpenSettings: () => void;
  onQuickStudy?: () => void;
  onOpenLibraryTab?: (tab: 'my-decks' | 'starred' | 'curated') => void;
  savedDecksCount: number;
  starredCardsCount: number;
  dueCardsCount: number;
  curatedCount?: number;
  isOnline?: boolean;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: (collapsed: boolean) => void;
  onOpenCharacterCustomizer?: () => void;
}

interface NavItemProps {
  icon: LucideIcon;
  label: string;
  collapsed: boolean;
  active?: boolean;
  onClick: () => void;
  trailing?: React.ReactNode;
  /** Shown as a dot on the icon when the sidebar is collapsed. */
  attention?: boolean;
  tooltip?: string;
}

const NavItem: React.FC<NavItemProps> = ({ icon: Icon, label, collapsed, active, onClick, trailing, attention, tooltip }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    aria-current={active ? 'page' : undefined}
    className={cn(
      'group relative flex h-9 w-full items-center rounded-lg text-[13px] transition-colors duration-150 cursor-pointer',
      collapsed ? 'justify-center px-0' : 'gap-2.5 px-2.5',
      active ? 'bg-surface-hover text-ink font-medium' : 'text-ink-muted hover:text-ink hover:bg-surface',
    )}
  >
    {active && <span className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full bg-brand" aria-hidden="true" />}
    <span className="relative">
      <Icon className={cn('h-[18px] w-[18px] shrink-0', active ? 'text-brand-text' : 'text-ink-subtle group-hover:text-ink-muted')} aria-hidden="true" />
      {collapsed && attention && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-due ring-2 ring-canvas-raised" />}
    </span>
    {!collapsed && <span className="min-w-0 flex-1 truncate text-left">{label}</span>}
    {!collapsed && trailing}
    {collapsed && (
      <span className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-md border border-line-strong bg-surface-solid px-2 py-1 text-xs font-medium text-ink opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
        {tooltip ?? label}
      </span>
    )}
  </button>
);

const CountText: React.FC<{ value: number | string; tone?: 'muted' | 'due' | 'gold' }> = ({ value, tone = 'muted' }) => (
  <span
    className={cn(
      'shrink-0 text-xs tabular-nums',
      tone === 'due' ? 'rounded-md bg-due-soft px-1.5 py-0.5 font-semibold text-due' : tone === 'gold' ? 'font-medium text-gold' : 'text-ink-subtle',
    )}
  >
    {value}
  </span>
);

const GroupLabel: React.FC<{ collapsed: boolean; children: React.ReactNode }> = ({ collapsed, children }) =>
  collapsed ? <div className="mx-auto my-2 h-px w-6 bg-line" aria-hidden="true" /> : (
    <div className="px-2.5 pb-1 pt-4 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-subtle">{children}</div>
  );

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onNavigate,
  currentUser,
  onOpenAuth,
  onOpenDeckStudio,
  onOpenStarterCatalog,
  onOpenSettings,
  onQuickStudy,
  onOpenLibraryTab,
  savedDecksCount,
  starredCardsCount,
  dueCardsCount,
  curatedCount = 10,
  isOnline = true,
  isOpenMobile = false,
  onCloseMobile,
  isCollapsed: propIsCollapsed,
  onToggleCollapse,
  onOpenCharacterCustomizer,
}) => {
  // Local collapsed state fallback if not controlled from parent
  const [internalCollapsed, setInternalCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('axon_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const isCollapsed = propIsCollapsed !== undefined ? propIsCollapsed : internalCollapsed;

  const toggleCollapse = useCallback(() => {
    const next = !isCollapsed;
    if (onToggleCollapse) {
      onToggleCollapse(next);
    } else {
      setInternalCollapsed(next);
      try {
        localStorage.setItem('axon_sidebar_collapsed', String(next));
      } catch {
        // ignore
      }
    }
  }, [isCollapsed, onToggleCollapse]);

  // Keyboard shortcut Ctrl+[ or Cmd+[ (or Ctrl+B) to toggle sidebar collapse
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === '[' || e.key === 'b')) {
        e.preventDefault();
        toggleCollapse();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleCollapse]);

  const [foldersCount, setFoldersCount] = useState<number>(() => StorageService.getFolders().length);
  const [walletCoins, setWalletCoins] = useState<number>(() => lifeSimService.getWalletBalance());
  const [isSoundOn, setIsSoundOn] = useState(() => soundEngine.getCurrentSound() !== 'off');

  useEffect(() => {
    const unsubStorage = StorageService.addMutationListener(() => setFoldersCount(StorageService.getFolders().length));
    const unsubLife = lifeSimService.subscribe(() => setWalletCoins(lifeSimService.getWalletBalance()));
    const unsubSound = soundEngine.subscribe(sound => setIsSoundOn(sound !== 'off'));
    return () => {
      unsubStorage();
      unsubLife();
      unsubSound();
    };
  }, []);

  const toggleSound = () => soundEngine.play(isSoundOn ? 'off' : 'binaural-40hz');

  /** Runs an action and closes the mobile drawer. */
  const go = (action: () => void) => () => {
    action();
    onCloseMobile?.();
  };

  const renderNavContent = (collapsed: boolean, isMobile = false) => (
    <div className="relative z-10 flex h-full select-none flex-col">
      {/* Brand */}
      <div className={cn('flex h-12 shrink-0 items-center', collapsed ? 'justify-center' : 'justify-between pl-1.5 pr-0.5')}>
        <button
          type="button"
          onClick={go(() => onNavigate('home'))}
          className="flex min-w-0 items-center gap-2.5 rounded-lg cursor-pointer"
          aria-label="Studify home"
        >
          <BrandMark size={28} className="shrink-0" />
          {!collapsed && <span className="truncate text-[15px] font-semibold tracking-tight text-ink">Studify</span>}
        </button>
        {!collapsed && !isMobile && (
          <button
            type="button"
            onClick={toggleCollapse}
            aria-label="Collapse sidebar"
            title="Collapse sidebar (Ctrl+[)"
            className="rounded-md p-1.5 text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink cursor-pointer"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
        {isMobile && onCloseMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close menu"
            className="rounded-md p-1.5 text-ink-subtle hover:bg-surface-hover hover:text-ink cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Primary actions */}
      <div className={cn('mt-3 shrink-0 space-y-1.5', collapsed && 'flex flex-col items-center')}>
        {onQuickStudy && (
          <button
            type="button"
            onClick={go(onQuickStudy)}
            aria-label={dueCardsCount > 0 ? `Start review, ${dueCardsCount} due` : 'Start review'}
            title={collapsed ? (dueCardsCount > 0 ? `Start review (${dueCardsCount} due)` : 'Start review') : undefined}
            className={cn(
              'group relative flex h-9 items-center rounded-lg bg-brand text-[13px] font-medium text-brand-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_8px_20px_-12px_var(--brand)] transition-colors hover:bg-brand-hover cursor-pointer',
              collapsed ? 'w-9 justify-center' : 'w-full justify-between px-3',
            )}
          >
            <span className="flex items-center gap-2">
              <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
              {!collapsed && <span>Start review</span>}
            </span>
            {!collapsed && dueCardsCount > 0 && (
              <span className="rounded-md bg-white/20 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums">{dueCardsCount}</span>
            )}
            {collapsed && dueCardsCount > 0 && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-due ring-2 ring-canvas-raised" />}
          </button>
        )}
        <button
          type="button"
          onClick={go(onOpenDeckStudio)}
          aria-label="New deck"
          title={collapsed ? 'New deck' : undefined}
          className={cn(
            'flex h-9 items-center rounded-lg border border-line text-[13px] font-medium text-ink-muted transition-colors hover:border-line-strong hover:bg-surface hover:text-ink cursor-pointer',
            collapsed ? 'w-9 justify-center' : 'w-full gap-2 px-3',
          )}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {!collapsed && <span>New deck</span>}
        </button>
      </div>

      {/* Navigation */}
      <nav className="no-scrollbar mt-2 flex-1 overflow-y-auto overflow-x-hidden" aria-label="Main">
        <GroupLabel collapsed={collapsed}>Study</GroupLabel>
        <div className="space-y-0.5">
          <NavItem
            icon={Home}
            label="Today"
            collapsed={collapsed}
            active={activeView === 'home'}
            onClick={go(() => onNavigate('home'))}
            trailing={dueCardsCount > 0 ? <CountText value={dueCardsCount} tone="due" /> : undefined}
            attention={dueCardsCount > 0}
            tooltip={dueCardsCount > 0 ? `Today (${dueCardsCount} due)` : 'Today'}
          />
          <NavItem
            icon={Layers}
            label="Library"
            collapsed={collapsed}
            active={activeView === 'studio'}
            onClick={go(() => onNavigate('studio'))}
            trailing={<CountText value={savedDecksCount} />}
          />
          <NavItem
            icon={Folder}
            label="Subjects"
            collapsed={collapsed}
            active={activeView === 'folders'}
            onClick={go(() => onNavigate('folders'))}
            trailing={<CountText value={foldersCount} />}
          />
          {starredCardsCount > 0 && (
            <NavItem
              icon={Star}
              label="Starred"
              collapsed={collapsed}
              onClick={go(() => (onOpenLibraryTab ? onOpenLibraryTab('starred') : onNavigate('studio')))}
              trailing={<CountText value={starredCardsCount} />}
            />
          )}
          <NavItem
            icon={LineChart}
            label="Insights"
            collapsed={collapsed}
            active={activeView === 'dashboard'}
            onClick={go(() => onNavigate('dashboard'))}
          />
        </div>

        <GroupLabel collapsed={collapsed}>Practice</GroupLabel>
        <div className="space-y-0.5">
          <NavItem icon={Award} label="Mock exam" collapsed={collapsed} active={activeView === 'exam'} onClick={go(() => onNavigate('exam'))} />
          <NavItem icon={Shuffle} label="Mix decks" collapsed={collapsed} active={activeView === 'interleave'} onClick={go(() => onNavigate('interleave'))} />
          <NavItem icon={Compass} label="Explore decks" collapsed={collapsed} onClick={go(onOpenStarterCatalog)} trailing={<CountText value={curatedCount} />} />
        </div>

        <GroupLabel collapsed={collapsed}>Life</GroupLabel>
        <div className="space-y-0.5">
          <NavItem
            icon={Building2}
            label="Campus"
            collapsed={collapsed}
            active={activeView === 'sanctuary'}
            onClick={go(() => onNavigate('sanctuary'))}
            trailing={
              <span className="flex shrink-0 items-center gap-1 text-xs font-medium tabular-nums text-gold">
                <CoinIcon className="h-3.5 w-3.5" />
                {walletCoins.toLocaleString()}
              </span>
            }
            tooltip={`Campus (${walletCoins.toLocaleString()} tokens)`}
          />
          {onOpenCharacterCustomizer && (
            <button
              type="button"
              onClick={go(onOpenCharacterCustomizer)}
              aria-label="Avatar"
              className={cn(
                'group relative flex h-9 w-full items-center rounded-lg text-[13px] text-ink-muted transition-colors hover:bg-surface hover:text-ink cursor-pointer',
                collapsed ? 'justify-center' : 'gap-2.5 px-2.5',
              )}
            >
              <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center overflow-hidden rounded-[5px]">
                <UserAvatarBadge size="xs" showBorder={false} className="h-[22px]! w-[22px]!" />
              </span>
              {!collapsed && (
                <>
                  <span className="flex-1 truncate text-left">Avatar</span>
                  <ChevronRight className="h-3.5 w-3.5 text-ink-subtle opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                </>
              )}
              {collapsed && (
                <span className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-md border border-line-strong bg-surface-solid px-2 py-1 text-xs font-medium text-ink opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
                  Avatar
                </span>
              )}
            </button>
          )}
        </div>
      </nav>

      {/* Footer: status, account, settings */}
      <div className="shrink-0 space-y-1 border-t border-line pt-3">
        {!isOnline && (
          <div
            title="Working offline. Your decks and reviews still work."
            className={cn(
              'flex h-8 items-center rounded-lg bg-gold-soft text-xs font-medium text-gold',
              collapsed ? 'justify-center' : 'gap-2 px-2.5',
            )}
          >
            <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {!collapsed && <span>Working offline</span>}
          </div>
        )}

        <NavItem
          icon={isSoundOn ? Volume2 : VolumeX}
          label={isSoundOn ? 'Focus sound on' : 'Focus sound'}
          collapsed={collapsed}
          active={false}
          onClick={toggleSound}
          trailing={
            isSoundOn ? (
              <span className="flex h-3.5 items-end gap-[2px]" aria-hidden="true">
                <span className="w-[2px] rounded-full bg-brand-text animate-eq-1" />
                <span className="w-[2px] rounded-full bg-brand-text animate-eq-2" />
                <span className="w-[2px] rounded-full bg-brand-text animate-eq-3" />
              </span>
            ) : (
              <span className="text-xs text-ink-subtle">Off</span>
            )
          }
        />

        <div className={cn('flex items-center gap-1', collapsed && 'flex-col')}>
          <button
            type="button"
            onClick={go(() => onOpenAuth?.(currentUser ? 'profile' : 'login'))}
            aria-label={currentUser ? `Account: ${currentUser.name}` : 'Sign in or register'}
            title={collapsed ? (currentUser ? currentUser.name : 'Sign in') : undefined}
            className={cn(
              'flex min-w-0 items-center rounded-lg transition-colors hover:bg-surface-hover cursor-pointer',
              collapsed ? 'h-9 w-9 justify-center' : 'h-11 flex-1 gap-2.5 px-2',
            )}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-soft text-[13px] font-semibold text-brand-text">
              {currentUser ? currentUser.avatar || currentUser.name.charAt(0).toUpperCase() : 'G'}
            </span>
            {!collapsed && (
              <span className="flex min-w-0 flex-col text-left leading-tight">
                <span className="truncate text-[13px] font-medium text-ink">{currentUser ? currentUser.name : 'Guest'}</span>
                <span className="truncate text-[11px] text-ink-subtle">{currentUser ? currentUser.grade || 'Student' : 'Sign in to sync'}</span>
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={go(onOpenSettings)}
            aria-label="Settings"
            title="Settings"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink cursor-pointer"
          >
            <Settings className="h-[18px] w-[18px]" />
          </button>
          {!isMobile && collapsed && (
            <button
              type="button"
              onClick={toggleCollapse}
              aria-label="Expand sidebar"
              title="Expand sidebar (Ctrl+[)"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink cursor-pointer"
            >
              <PanelLeftOpen className="h-[18px] w-[18px]" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop persistent sidebar */}
      <aside
        className={cn(
          'relative z-40 hidden shrink-0 select-none transition-[width] duration-300 ease-in-out md:block',
          isCollapsed ? 'w-[64px]' : 'w-60',
        )}
      >
        <div
          className={cn(
            'sticky top-0 flex h-screen flex-col border-r border-line bg-canvas-raised transition-[width] duration-300 ease-in-out',
            isCollapsed ? 'w-[64px] px-2.5 py-3' : 'w-60 px-3 py-3',
          )}
        >
          {renderNavContent(isCollapsed)}
        </div>
      </aside>

      {/* Mobile drawer */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 flex md:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fadeIn" onClick={onCloseMobile} />
          <aside className="relative z-10 flex h-full w-72 max-w-[85vw] flex-col border-r border-line bg-canvas-raised px-3 py-3 shadow-2xl animate-fadeIn">
            {renderNavContent(false, true)}
          </aside>
        </div>
      )}
    </>
  );
};
