import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  Check,
  Cloud,
  Copy,
  Database,
  Download,
  Eye,
  EyeOff,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  Upload,
  Volume2,
} from 'lucide-react';
import { StorageService } from '../../services/storageService';
import { ExportService } from '../../services/exportService';
import { CloudSyncService, type CloudSyncConfig } from '../../services/cloudSyncService';
import { NotificationService, type NotificationSettings } from '../../services/notificationService';
import { soundEngine } from '../../services/soundEngine';
import { haptics } from '../../services/hapticsService';
import { cn } from '../../utils/cn';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { Dialog, DialogHeader, DialogPanel } from '../common/Dialog';
import { Badge, Button, IconButton } from '../ui/primitives';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStatsReset: () => void;
}

type SectionId = 'study' | 'ai' | 'reminders' | 'sound' | 'sync' | 'data';

const SECTIONS: { id: SectionId; label: string; icon: LucideIcon }[] = [
  { id: 'study', label: 'Study', icon: Target },
  { id: 'ai', label: 'AI', icon: Sparkles },
  { id: 'reminders', label: 'Reminders', icon: Bell },
  { id: 'sound', label: 'Sound', icon: Volume2 },
  { id: 'sync', label: 'Sync', icon: Cloud },
  { id: 'data', label: 'Your data', icon: Database },
];

const DAILY_GOALS = [
  { value: 15, label: '15 min' },
  { value: 25, label: '25 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hour' },
];

const MEMORY_TARGETS = [
  { value: 0.85, label: 'Relaxed', hint: '85% · fewer reviews' },
  { value: 0.9, label: 'Balanced', hint: '90% · recommended' },
  { value: 0.95, label: 'Exam mode', hint: '95% · more reviews' },
];

const REMINDER_HOURS = [
  { value: 17, label: '5 PM' },
  { value: 18, label: '6 PM' },
  { value: 19, label: '7 PM' },
  { value: 20, label: '8 PM' },
  { value: 21, label: '9 PM' },
];

const INPUT_CLASS =
  'h-10 w-full min-w-0 rounded-xl border border-line-strong bg-canvas px-3 text-sm text-ink placeholder:text-ink-subtle transition-colors focus:border-brand focus:outline-none';

type Notice = { tone: 'success' | 'error' | 'info'; text: string };

/** A status line that clears itself, restarting the timer when a new one is shown. */
const useNotice = () => {
  const [notice, setNotice] = useState<Notice | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const show = useCallback((next: Notice, ms = 4000) => {
    clearTimeout(timer.current);
    setNotice(next);
    timer.current = setTimeout(() => setNotice(null), ms);
  }, []);
  return [notice, show] as const;
};

/** Local calendar date for file names, e.g. 2026-10-07. */
const fileDate = () => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onStatsReset }) => {
  const [section, setSection] = useState<SectionId>('study');
  const idPrefix = useId();

  if (!isOpen) return null;

  return (
    <Dialog isOpen={isOpen} onClose={onClose} titleId="settings-modal-title" className="max-w-3xl">
      <DialogPanel className="h-[min(680px,92dvh)]">
        <DialogHeader titleId="settings-modal-title" title="Settings" onClose={onClose} closeLabel="Close settings" />
        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          <div
            role="tablist"
            aria-label="Settings sections"
            aria-orientation="vertical"
            className="flex shrink-0 gap-1 overflow-x-auto border-b border-line px-3 py-2 no-scrollbar sm:w-48 sm:flex-col sm:overflow-visible sm:border-b-0 sm:border-r sm:py-3"
          >
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`${idPrefix}-tab-${id}`}
                aria-selected={section === id}
                aria-controls={`${idPrefix}-panel`}
                onClick={() => setSection(id)}
                className={cn(
                  'inline-flex h-9 shrink-0 items-center gap-2.5 rounded-lg px-3 text-[13px] font-medium transition-colors cursor-pointer',
                  section === id ? 'bg-surface-hover text-ink' : 'text-ink-subtle hover:bg-surface-hover hover:text-ink',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>

          <div
            id={`${idPrefix}-panel`}
            role="tabpanel"
            aria-labelledby={`${idPrefix}-tab-${section}`}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7 sm:py-6"
          >
            {section === 'study' && <StudySection onStatsReset={onStatsReset} />}
            {section === 'ai' && <AiSection />}
            {section === 'reminders' && <RemindersSection />}
            {section === 'sound' && <SoundSection />}
            {section === 'sync' && <SyncSection onStatsReset={onStatsReset} />}
            {section === 'data' && <DataSection />}
          </div>
        </div>
      </DialogPanel>
    </Dialog>
  );
};

/* ------------------------------------------------------------------ */
/* Building blocks                                                     */
/* ------------------------------------------------------------------ */

const SettingGroup: React.FC<{
  title: string;
  description?: React.ReactNode;
  aside?: React.ReactNode;
  children?: React.ReactNode;
}> = ({ title, description, aside, children }) => (
  <section className="border-t border-line py-6 first:border-t-0 first:pt-0 last:pb-0">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {description && <p className="mt-1 text-[13px] leading-relaxed text-ink-subtle">{description}</p>}
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </div>
    {children && <div className="mt-4">{children}</div>}
  </section>
);

function OptionGrid<T extends string | number>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: { value: T; label: string; hint?: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('grid gap-2', className)}>
      {options.map(option => {
        const selected = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-xl border px-3 py-2.5 text-left transition-colors cursor-pointer',
              selected ? 'border-brand bg-brand-soft' : 'border-line hover:border-line-strong hover:bg-surface-hover',
            )}
          >
            <span className={cn('block text-sm font-medium', selected ? 'text-brand-text' : 'text-ink')}>{option.label}</span>
            {option.hint && <span className="mt-0.5 block text-xs text-ink-subtle">{option.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}

const Switch: React.FC<{ checked: boolean; onChange: (checked: boolean) => void; label: string; disabled?: boolean }> = ({
  checked,
  onChange,
  label,
  disabled,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={cn(
      'relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:opacity-50',
      checked ? 'bg-brand' : 'bg-line-strong',
    )}
  >
    <span
      className={cn(
        'absolute h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform',
        checked ? 'translate-x-[19px]' : 'translate-x-[3px]',
      )}
      aria-hidden="true"
    />
  </button>
);

const NoticeLine: React.FC<{ notice: Notice | null }> = ({ notice }) => (
  <p
    role="status"
    className={cn(
      'min-h-5 text-[13px]',
      notice?.tone === 'success' && 'text-success',
      notice?.tone === 'error' && 'text-danger',
      notice?.tone === 'info' && 'text-ink-muted',
    )}
  >
    {notice?.text}
  </p>
);

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

const StudySection: React.FC<{ onStatsReset: () => void }> = ({ onStatsReset }) => {
  const [dailyGoal, setDailyGoal] = useState(() => StorageService.getStats().dailyGoalMinutes || 25);
  const [targetRetention, setTargetRetention] = useState(() => StorageService.getTargetRetention());
  const memoryTarget = MEMORY_TARGETS.reduce((best, option) =>
    Math.abs(option.value - targetRetention) < Math.abs(best.value - targetRetention) ? option : best,
  ).value;

  return (
    <div>
      <SettingGroup title="Daily goal" description="How long you want to study each day. It sets your goal ring and keeps your streak going.">
        <OptionGrid
          label="Daily goal"
          options={DAILY_GOALS}
          value={dailyGoal}
          onChange={(minutes) => {
            setDailyGoal(minutes);
            StorageService.setDailyGoal(minutes);
            onStatsReset();
          }}
          className="grid-cols-2 sm:grid-cols-4"
        />
      </SettingGroup>

      <SettingGroup
        title="Memory target"
        description="How likely you want to be to remember a card when it comes back for review. A higher target means more reviews each day."
      >
        <OptionGrid
          label="Memory target"
          options={MEMORY_TARGETS}
          value={memoryTarget}
          onChange={(rate) => {
            setTargetRetention(rate);
            StorageService.setTargetRetention(rate);
            onStatsReset();
          }}
          className="sm:grid-cols-3"
        />
      </SettingGroup>
    </div>
  );
};

const AiSection: React.FC = () => {
  const [savedKey, setSavedKey] = useState(() => StorageService.getApiKey());
  const [draft, setDraft] = useState(savedKey);
  const [isVisible, setIsVisible] = useState(false);
  const [notice, showNotice] = useNotice();
  const inputId = useId();

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const key = draft.trim();
    StorageService.setApiKey(key);
    setSavedKey(key);
    setDraft(key);
    showNotice(key ? { tone: 'success', text: 'Key saved. AI features will use it from now on.' } : { tone: 'info', text: 'Key removed.' });
  };

  const remove = () => {
    StorageService.setApiKey('');
    setSavedKey('');
    setDraft('');
    showNotice({ tone: 'info', text: 'Key removed. Studify will use its built-in generator.' });
  };

  return (
    <div>
      <SettingGroup
        title="Gemini API key"
        description="Studify makes decks without a key. Add your own free Gemini key for unlimited decks from notes and PDFs, and AI feedback when you explain a concept."
        aside={savedKey ? <Badge tone="success">Key added</Badge> : <Badge>Not set</Badge>}
      >
        <form onSubmit={save} className="space-y-2">
          <label htmlFor={inputId} className="sr-only">
            Gemini API key
          </label>
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <input
                id={inputId}
                type={isVisible ? 'text' : 'password'}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Paste your key"
                autoComplete="off"
                spellCheck={false}
                className={cn(INPUT_CLASS, 'pr-10 font-mono')}
              />
              <IconButton
                icon={isVisible ? EyeOff : Eye}
                label={isVisible ? 'Hide key' : 'Show key'}
                onClick={() => setIsVisible(v => !v)}
                className="absolute right-0.5 top-1/2 h-8 w-8 -translate-y-1/2"
              />
            </div>
            <Button type="submit" variant="primary" disabled={draft.trim() === savedKey}>
              Save
            </Button>
          </div>
          <NoticeLine notice={notice} />
        </form>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-ink-subtle">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-success" aria-hidden="true" />
            Stored only in this browser.
          </span>
          <span className="flex items-center gap-3">
            {savedKey && (
              <button type="button" onClick={remove} className="font-medium text-danger hover:underline cursor-pointer">
                Remove key
              </button>
            )}
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-medium text-brand-text hover:underline"
            >
              Get a free key
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          </span>
        </div>
      </SettingGroup>
    </div>
  );
};

const RemindersSection: React.FC = () => {
  const [settings, setSettings] = useState<NotificationSettings>(() => NotificationService.getSettings());
  const [permission, setPermission] = useState<NotificationPermission>(() => NotificationService.getPermission());
  const [notice, showNotice] = useNotice();
  const isSupported = NotificationService.isSupported();
  const isOn = settings.enabled && permission === 'granted';

  const toggle = async () => {
    if (isOn) {
      setSettings(NotificationService.saveSettings({ enabled: false }));
      showNotice({ tone: 'info', text: 'Reminders are off.' });
      return;
    }
    const granted = await NotificationService.requestPermission();
    setPermission(NotificationService.getPermission());
    if (granted) {
      setSettings(NotificationService.getSettings());
      soundEngine.playSuccess();
      showNotice({ tone: 'success', text: 'Reminders are on.' });
    } else {
      showNotice({ tone: 'error', text: 'Your browser blocked notifications for Studify.' });
    }
  };

  const sendTest = async () => {
    const sent = await NotificationService.sendTestNotification();
    showNotice(
      sent
        ? { tone: 'success', text: 'Test reminder sent. Check your notifications.' }
        : { tone: 'error', text: 'Could not send a reminder. Check that notifications are allowed.' },
    );
  };

  return (
    <div>
      <SettingGroup
        title="Daily reminder"
        description="A nudge on this device when you have cards due, before your streak resets."
        aside={
          isOn ? <Badge tone="success">On</Badge> : permission === 'denied' ? <Badge tone="danger">Blocked</Badge> : <Badge>Off</Badge>
        }
      >
        {!isSupported ? (
          <p className="text-[13px] text-ink-muted">This browser does not support notifications.</p>
        ) : (
          <div className="space-y-3">
            {permission === 'denied' && (
              <p className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-[13px] text-ink-muted">
                Notifications are blocked for this site. Allow them in your browser's site settings, then turn reminders on.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button variant={isOn ? 'secondary' : 'primary'} onClick={toggle}>
                {isOn ? 'Turn off' : 'Turn on reminders'}
              </Button>
              {isOn && (
                <Button variant="ghost" onClick={sendTest}>
                  Send a test
                </Button>
              )}
            </div>
            <NoticeLine notice={notice} />
          </div>
        )}
      </SettingGroup>

      {isSupported && (
        <SettingGroup title="Reminder time" description="Studify checks for due cards at this time each day.">
          <OptionGrid
            label="Reminder time"
            options={REMINDER_HOURS}
            value={settings.reminderHour}
            onChange={(hour) => setSettings(NotificationService.saveSettings({ reminderHour: hour }))}
            className="grid-cols-3 sm:grid-cols-5"
          />
        </SettingGroup>
      )}
    </div>
  );
};

const SoundSection: React.FC = () => {
  const [sfxOn, setSfxOn] = useState(() => soundEngine.isSfxEnabled());
  const [hapticsOn, setHapticsOn] = useState(() => haptics.isEnabled());

  return (
    <div>
      <SettingGroup
        title="Sound effects"
        description="Short chimes when you answer, finish a session or get paid."
        aside={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => soundEngine.playCorrectChime()} disabled={!sfxOn}>
              Play
            </Button>
            <Switch
              label="Sound effects"
              checked={sfxOn}
              onChange={(next) => {
                soundEngine.setSfxEnabled(next);
                setSfxOn(next);
                if (next) soundEngine.playTapPop();
              }}
            />
          </div>
        }
      />
      <SettingGroup
        title="Vibration"
        description="A light tap when you press buttons and answer cards, on phones that support it."
        aside={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => haptics.success()} disabled={!hapticsOn}>
              Test
            </Button>
            <Switch
              label="Vibration"
              checked={hapticsOn}
              onChange={(next) => {
                haptics.setEnabled(next);
                setHapticsOn(next);
                if (next) haptics.pop();
              }}
            />
          </div>
        }
      />
    </div>
  );
};

const SYNC_STATUS: Record<CloudSyncConfig['status'], { label: string; tone: 'success' | 'brand' | 'gold' | 'danger' | 'neutral' }> = {
  synced: { label: 'Synced', tone: 'success' },
  syncing: { label: 'Syncing', tone: 'brand' },
  queued: { label: 'Waiting to sync', tone: 'gold' },
  error: { label: 'Sync failed', tone: 'danger' },
  idle: { label: 'Not synced yet', tone: 'neutral' },
};

const SyncSection: React.FC<{ onStatsReset: () => void }> = ({ onStatsReset }) => {
  const [config, setConfig] = useState<CloudSyncConfig>(() => CloudSyncService.getConfig());
  const [endpoint, setEndpoint] = useState(() => CloudSyncService.getConfig().endpointUrl || '');
  const [token, setToken] = useState(() => CloudSyncService.getConfig().cloudToken || '');
  const [isSyncing, setIsSyncing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notice, showNotice] = useNotice();
  const fieldId = useId();

  // Follow sync status changes made elsewhere (auto-sync after reviews).
  useEffect(
    () =>
      CloudSyncService.subscribe(next => {
        setConfig(next);
        setEndpoint(next.endpointUrl || '');
        setToken(next.cloudToken || '');
      }),
    [],
  );

  const canSync = config.enabled && !!config.endpointUrl && !!config.cloudToken;
  const status = config.enabled ? SYNC_STATUS[config.status] ?? SYNC_STATUS.idle : null;

  const handleEndpointChange = (value: string) => {
    setEndpoint(value);
    setConfig(CloudSyncService.saveConfig({ endpointUrl: value.trim() }));
  };

  const handleTokenChange = (value: string) => {
    setToken(value);
    setConfig(CloudSyncService.saveConfig({ cloudToken: value.trim() }));
  };

  const handleNewToken = () => {
    const next = CloudSyncService.generateSyncToken();
    setToken(next);
    setConfig(CloudSyncService.saveConfig({ cloudToken: next }));
    soundEngine.playSuccess();
  };

  const handleCopy = () => {
    if (!token || !navigator.clipboard) return;
    navigator.clipboard.writeText(token).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => showNotice({ tone: 'error', text: 'Could not copy. Select the code and copy it instead.' }),
    );
  };

  const handleToggle = (enabled: boolean) => {
    let nextToken = token;
    if (enabled && !nextToken) {
      nextToken = CloudSyncService.generateSyncToken();
      setToken(nextToken);
    }
    setConfig(CloudSyncService.saveConfig({ enabled, cloudToken: nextToken, endpointUrl: endpoint.trim() }));
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      const res = await CloudSyncService.syncNow();
      if (res.success) {
        soundEngine.playSuccess();
        onStatsReset();
      }
      showNotice({ tone: res.success ? 'success' : 'error', text: res.message });
    } catch {
      showNotice({ tone: 'error', text: 'Sync failed. Check the server URL and try again.' });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div>
      <SettingGroup
        title="Sync between devices"
        description="Your study data is saved in this browser. To use Studify on more than one device, connect a sync server you run, such as a Cloudflare Worker. Decks, reviews and your avatar's look sync; tokens and your campus home stay on each device."
        aside={
          <Switch label="Sync this device" checked={config.enabled} onChange={handleToggle} />
        }
      >
        <div className="space-y-4">
          <div>
            <label htmlFor={`${fieldId}-url`} className="text-[13px] font-medium text-ink">
              Server URL
            </label>
            <input
              id={`${fieldId}-url`}
              type="url"
              value={endpoint}
              onChange={(e) => handleEndpointChange(e.target.value)}
              placeholder="https://sync.example.com/api"
              spellCheck={false}
              className={cn(INPUT_CLASS, 'mt-1.5 font-mono')}
            />
          </div>
          <div>
            <label htmlFor={`${fieldId}-token`} className="text-[13px] font-medium text-ink">
              Pairing code
            </label>
            <p className="text-xs text-ink-subtle">Use the same code on each device you want to keep in sync.</p>
            <div className="mt-1.5 flex gap-2">
              <input
                id={`${fieldId}-token`}
                type="text"
                value={token}
                onChange={(e) => handleTokenChange(e.target.value)}
                placeholder="Paste a code or make a new one"
                spellCheck={false}
                autoComplete="off"
                className={cn(INPUT_CLASS, 'font-mono')}
              />
              {token && (
                <Button icon={copied ? Check : Copy} onClick={handleCopy}>
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              )}
              <Button onClick={handleNewToken}>New code</Button>
            </div>
          </div>
        </div>
      </SettingGroup>

      <SettingGroup
        title="Sync now"
        description={
          !config.enabled
            ? 'Turn on sync above first.'
            : !config.endpointUrl || !config.cloudToken
              ? 'Add a server URL and a pairing code first.'
              : config.lastSyncAt
                ? `Last synced ${new Date(config.lastSyncAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}. Syncs after each review too.`
                : 'Syncs after each review too.'
        }
        aside={status && <Badge tone={status.tone}>{status.label}</Badge>}
      >
        <div className="space-y-3">
          <Button icon={RefreshCw} onClick={handleSyncNow} disabled={!canSync || isSyncing} className={cn(isSyncing && '[&>svg]:animate-spin')}>
            {isSyncing ? 'Syncing…' : 'Sync now'}
          </Button>
          <NoticeLine notice={notice} />
        </div>
      </SettingGroup>
    </div>
  );
};

const DataSection: React.FC = () => {
  const [notice, showNotice] = useNotice();
  const [pendingRestore, setPendingRestore] = useState<{ name: string; content: string } | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleBackup = () => {
    try {
      const blob = new Blob([StorageService.exportAllDataAsJSON()], { type: 'application/json' });
      ExportService.download(blob, `studify-backup-${fileDate()}.json`);
      showNotice({ tone: 'success', text: 'Backup downloaded.' });
    } catch {
      showNotice({ tone: 'error', text: 'Could not make a backup.' });
    }
  };

  const handleAnkiExport = () => {
    try {
      const blob = new Blob([StorageService.exportCardsToAnkiCSV()], { type: 'text/tab-separated-values;charset=utf-8' });
      ExportService.download(blob, `studify-anki-${fileDate()}.txt`);
      showNotice({ tone: 'success', text: 'Cards exported. In Anki, choose File › Import and pick this file.' });
    } catch {
      showNotice({ tone: 'error', text: 'Could not export your cards.' });
    }
  };

  const handleFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPendingRestore({ name: file.name, content: String(reader.result ?? '') });
    reader.onerror = () => showNotice({ tone: 'error', text: 'Could not read that file.' });
    reader.readAsText(file);
  };

  const handleRestore = () => {
    if (!pendingRestore) return;
    const result = StorageService.importDataFromJSON(pendingRestore.content);
    setPendingRestore(null);
    if (!result.success) {
      showNotice({ tone: 'error', text: result.message }, 6000);
      return;
    }
    // Reload so every screen and service starts from the restored data.
    showNotice({ tone: 'success', text: `${result.message} Reloading…` }, 10000);
    setTimeout(() => window.location.reload(), 1200);
  };

  const handleDelete = async () => {
    setIsWorking(true);
    await StorageService.clearStudyData();
    window.location.reload();
  };

  return (
    <div>
      <SettingGroup
        title="Backup"
        description="Download your decks, cards, review history, subjects and stats as one file, or restore them from a backup."
      >
        <div className="flex flex-wrap gap-2">
          <Button icon={Download} onClick={handleBackup}>
            Download backup
          </Button>
          <Button icon={Upload} onClick={() => importInputRef.current?.click()}>
            Restore from backup
          </Button>
          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChosen}
            className="hidden"
            tabIndex={-1}
            aria-hidden="true"
          />
        </div>
      </SettingGroup>

      <SettingGroup title="Export to Anki" description="All your cards as a text file Anki can import, with answers and explanations.">
        <Button icon={Download} onClick={handleAnkiExport}>
          Export cards
        </Button>
      </SettingGroup>

      <NoticeLine notice={notice} />

      <section className="mt-4 rounded-2xl border border-danger/30 p-4">
        <h3 className="text-sm font-semibold text-ink">Delete study data</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-subtle">
          Removes this profile's decks, cards, review history, subjects and stats from this device. Your wallet, earnings, campus and avatar
          are kept.
        </p>
        <Button variant="danger" size="sm" icon={Trash2} className="mt-3" onClick={() => setIsConfirmingDelete(true)}>
          Delete study data
        </Button>
      </section>

      <ConfirmDialog
        isOpen={!!pendingRestore}
        title="Restore this backup?"
        confirmLabel="Restore"
        onConfirm={handleRestore}
        onCancel={() => setPendingRestore(null)}
      >
        Your current decks, subjects and stats will be replaced with the ones in{' '}
        <span className="font-medium text-ink">{pendingRestore?.name}</span>. Studify reloads when it is done.
      </ConfirmDialog>

      <ConfirmDialog
        isOpen={isConfirmingDelete}
        title="Delete all study data?"
        confirmLabel={isWorking ? 'Deleting…' : 'Delete study data'}
        tone="danger"
        busy={isWorking}
        onConfirm={handleDelete}
        onCancel={() => setIsConfirmingDelete(false)}
      >
        This removes every deck, card, review and stat for this profile on this device. You cannot undo it. Download a backup first if you
        might want them back.
      </ConfirmDialog>
    </div>
  );
};
