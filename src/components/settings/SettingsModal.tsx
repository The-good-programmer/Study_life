import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Key, 
  Trash2, 
  Check, 
  ExternalLink, 
  ShieldCheck, 
  Download, 
  Upload, 
  Target,
  Sparkles,
  Cloud,
  BellRing,
  RefreshCw,
  Copy,
  Volume2
} from 'lucide-react';
import { StorageService } from '../../services/storageService';
import { CloudSyncService, type CloudSyncConfig } from '../../services/cloudSyncService';
import { NotificationService, type NotificationSettings } from '../../services/notificationService';
import { soundEngine } from '../../services/soundEngine';
import { haptics } from '../../services/hapticsService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStatsReset: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onStatsReset }) => {
  const [apiKey, setApiKey] = useState(StorageService.getApiKey());
  const [dailyGoal, setDailyGoal] = useState(() => StorageService.getStats().dailyGoalMinutes || 25);
  const [targetRetention, setTargetRetention] = useState(() => StorageService.getTargetRetention());
  const [isSaved, setIsSaved] = useState(false);
  const [backupMsg, setBackupMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Cloud Sync state
  const [syncConfig, setSyncConfig] = useState<CloudSyncConfig>(() => CloudSyncService.getConfig());
  const [syncEndpoint, setSyncEndpoint] = useState(() => CloudSyncService.getConfig().endpointUrl || '');
  const [syncToken, setSyncToken] = useState(() => CloudSyncService.getConfig().cloudToken || '');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  // Habit loop notification state
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(() => NotificationService.getSettings());
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>(() => NotificationService.getPermission());
  const [notifMsg, setNotifMsg] = useState<string | null>(null);

  // Audio and Haptics state
  const [sfxOn, setSfxOn] = useState(() => soundEngine.isSfxEnabled());
  const [hapticsOn, setHapticsOn] = useState(() => haptics.isEnabled());

  const importInputRef = useRef<HTMLInputElement>(null);

  // Subscribe to live cloud sync status changes
  useEffect(() => {
    return CloudSyncService.subscribe(config => {
      setSyncConfig(config);
      setSyncEndpoint(config.endpointUrl || '');
      setSyncToken(config.cloudToken || '');
    });
  }, []);

  if (!isOpen) return null;

  const handleSaveKey = (e: React.FormEvent) => {
    e.preventDefault();
    StorageService.setApiKey(apiKey);
    StorageService.setDailyGoal(dailyGoal);
    StorageService.setTargetRetention(targetRetention);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleExportJSON = () => {
    try {
      const json = StorageService.exportAllDataAsJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `axon-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setBackupMsg({ type: 'success', text: 'Backup downloaded successfully!' });
      setTimeout(() => setBackupMsg(null), 3000);
    } catch {
      setBackupMsg({ type: 'error', text: 'Failed to export backup.' });
    }
  };

  const handleExportAnki = () => {
    try {
      const csv = StorageService.exportCardsToAnkiCSV();
      const blob = new Blob([csv], { type: 'text/tab-separated-values;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `axon-anki-export-${new Date().toISOString().split('T')[0]}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      setBackupMsg({ type: 'success', text: 'Anki TSV exported! Import directly into Anki.' });
      setTimeout(() => setBackupMsg(null), 3000);
    } catch {
      setBackupMsg({ type: 'error', text: 'Failed to export to Anki format.' });
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const res = StorageService.importDataFromJSON(content);
      if (res.success) {
        setBackupMsg({ type: 'success', text: res.message });
        onStatsReset();
        setTimeout(() => setBackupMsg(null), 3500);
      } else {
        setBackupMsg({ type: 'error', text: res.message });
      }
    };
    reader.readAsText(file);
    if (importInputRef.current) importInputRef.current.value = '';
  };

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to reset all local study statistics, flashcards, and session history?')) {
      localStorage.clear();
      onStatsReset();
      onClose();
    }
  };

  const handleGenerateToken = () => {
    const token = CloudSyncService.generateSyncToken();
    const updated = CloudSyncService.saveConfig({ cloudToken: token, enabled: true });
    setSyncConfig(updated);
    setSyncToken(token);
    soundEngine.playSuccess();
  };

  const handleCopyToken = () => {
    if (syncToken) {
      navigator.clipboard.writeText(syncToken);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  const handleEndpointChange = (val: string) => {
    setSyncEndpoint(val);
    const updated = CloudSyncService.saveConfig({ endpointUrl: val.trim() });
    setSyncConfig(updated);
  };

  const handleTokenChange = (val: string) => {
    setSyncToken(val);
    const updated = CloudSyncService.saveConfig({ cloudToken: val.trim() });
    setSyncConfig(updated);
  };

  const handleToggleCloudSync = () => {
    const next = !syncConfig.enabled;
    let token = syncToken;
    if (next && !token) {
      token = CloudSyncService.generateSyncToken();
      setSyncToken(token);
    }
    const updated = CloudSyncService.saveConfig({ enabled: next, cloudToken: token, endpointUrl: syncEndpoint });
    setSyncConfig(updated);
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    setSyncMsg(null);
    try {
      const res = await CloudSyncService.syncNow();
      if (res.success) {
        soundEngine.playSuccess();
        setSyncMsg({ type: 'success', text: res.message });
        onStatsReset();
      } else {
        setSyncMsg({ type: 'error', text: res.message });
      }
    } catch {
      setSyncMsg({ type: 'error', text: 'Sync encountered an error.' });
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMsg(null), 4000);
    }
  };

  const handleTogglePushNotifications = async () => {
    if (notifSettings.enabled) {
      const updated = NotificationService.saveSettings({ enabled: false });
      setNotifSettings(updated);
      setNotifMsg('Daily habit reminders disabled.');
      setTimeout(() => setNotifMsg(null), 3000);
    } else {
      const granted = await NotificationService.requestPermission();
      setNotifPerm(NotificationService.getPermission());
      if (granted) {
        setNotifSettings(NotificationService.getSettings());
        soundEngine.playSuccess();
        setNotifMsg('Daily habit reminders enabled! Set your preferred time below.');
      } else {
        setNotifMsg('Notification permission denied by browser.');
      }
      setTimeout(() => setNotifMsg(null), 4000);
    }
  };

  const handleSetReminderHour = (hour: number) => {
    const updated = NotificationService.saveSettings({ reminderHour: hour });
    setNotifSettings(updated);
  };

  const handleTestNotification = async () => {
    const sent = await NotificationService.sendTestNotification();
    if (sent) {
      setNotifMsg('Test alert sent! Check your notifications.');
    } else {
      setNotifMsg('Could not send notification. Ensure permissions are granted.');
    }
    setTimeout(() => setNotifMsg(null), 3500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="max-w-lg w-full rounded-3xl bg-[#0d101e] border border-white/[0.12] shadow-2xl p-6 sm:p-7 space-y-6 relative max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-white font-display">Lotti Preferences</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/[0.08] text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Daily Study Target */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-2 font-display">
              <Target className="w-4 h-4 text-emerald-400" />
              <span>Daily Study Habit Target</span>
            </span>
            <span className="text-xs font-mono font-bold text-emerald-400">{dailyGoal} Minutes / Day</span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {[15, 25, 45, 60].map(mins => (
              <button
                key={mins}
                type="button"
                onClick={() => {
                  setDailyGoal(mins);
                  StorageService.setDailyGoal(mins);
                  onStatsReset();
                }}
                className={`py-2 rounded-xl text-xs font-semibold transition-all border ${
                  dailyGoal === mins
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/30'
                    : 'bg-slate-900/80 text-slate-300 border-white/[0.08] hover:border-white/[0.2]'
                }`}
              >
                {mins} mins
              </button>
            ))}
          </div>
        </div>

        {/* FSRS Target Retention Rate */}
        <div className="space-y-3 pt-2 border-t border-white/[0.08]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-2 font-display">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>FSRS Target Retention Rate</span>
            </span>
            <span className="text-xs font-mono font-bold text-indigo-300">
              {Math.round(targetRetention * 100)}% Retention
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
            Calibrate the Free Spaced Repetition Scheduler interval multiplier. Lower retention reduces daily repetition workload; higher retention maximizes recall fidelity before high-stakes exams.
          </p>

          <div className="grid grid-cols-3 gap-2">
            {[
              { rate: 0.85, label: '85% Casual', desc: '~40% fewer reviews' },
              { rate: 0.90, label: '90% Standard', desc: 'FSRS default' },
              { rate: 0.95, label: '95% Mastery', desc: 'Exam ready' }
            ].map(item => (
              <button
                key={item.rate}
                type="button"
                onClick={() => {
                  setTargetRetention(item.rate);
                  StorageService.setTargetRetention(item.rate);
                  onStatsReset();
                }}
                className={`p-2.5 rounded-xl text-xs font-semibold transition-all border text-left ${
                  Math.abs(targetRetention - item.rate) < 0.01
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30'
                    : 'bg-slate-900/80 text-slate-300 border-white/[0.08] hover:border-white/[0.2]'
                }`}
              >
                <div className="font-bold">{item.label}</div>
                <div className="text-[10px] opacity-75 font-mono mt-0.5">{item.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Gemini API Key Section */}
        <div className="space-y-3 pt-2 border-t border-white/[0.08]">
          <div className="flex items-center gap-2 text-xs font-bold text-white font-display">
            <Key className="w-4 h-4 text-indigo-400" />
            <span>Google Gemini API Key (Optional)</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed font-sans">
            Lotti includes intelligent local cognitive heuristics by default. For unlimited custom PDF parsing and high-precision Socratic evaluations, enter your free Gemini API key.
          </p>

          <form onSubmit={handleSaveKey} className="space-y-2">
            <div className="flex gap-2">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950/80 border border-white/[0.1] text-white text-xs outline-none focus:border-indigo-500 font-mono"
              />
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0 shadow-md shadow-indigo-600/25"
              >
                {isSaved ? <Check className="w-3.5 h-3.5" /> : null}
                <span>{isSaved ? 'Saved!' : 'Save Key'}</span>
              </button>
            </div>
          </form>

          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
            <div className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Keys are stored strictly in your local browser sandbox.</span>
            </div>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 underline underline-offset-2 font-medium"
            >
              <span>Get Free Key</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Cloud Sync & Cross-Device Persistence */}
        <div className="p-4 rounded-2xl bg-slate-950/70 border border-white/[0.08] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-2 font-display">
              <Cloud className="w-4 h-4 text-cyan-400" />
              <span>Cloud Sync & Cross-Device Pairing</span>
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
              syncConfig.status === 'synced'
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                : syncConfig.status === 'syncing'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 animate-pulse'
                : syncConfig.status === 'queued'
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                : 'bg-slate-800 text-slate-400 border border-white/[0.08]'
            }`}>
              {syncConfig.status === 'synced' ? 'Synced ☁️' : syncConfig.status === 'syncing' ? 'Syncing...' : syncConfig.status === 'queued' ? 'Queued Offline ⏳' : 'Disabled'}
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed font-sans">
            Synchronize your decks, FSRS review intervals, and streak progress across devices using your own remote endpoint or worker.
          </p>

          {/* Local-First Architecture Notice */}
          <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-800/30 text-[11px] text-cyan-200/90 leading-relaxed font-sans">
            🔒 <strong className="text-cyan-100">Private by default:</strong> Your study progress is saved locally in this browser. To sync across your devices, specify a remote sync server endpoint URL below. If left blank, sync is disabled and you can use <em>Export Local Data</em> for instant offline backups.
          </div>

          {/* Sync Endpoint URL */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase font-mono font-bold text-slate-400">Remote Sync Endpoint URL</label>
              <span className="text-[10px] text-slate-500 font-sans">Cloudflare Worker / Custom API</span>
            </div>
            <input 
              type="url"
              value={syncEndpoint}
              onChange={e => handleEndpointChange(e.target.value)}
              placeholder="https://sync.example.com/api/lotti"
              className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-white/[0.1] text-cyan-300 font-mono text-xs outline-none focus:border-cyan-500/50 transition-colors"
            />
          </div>

          {/* Sync Token Input & Generator */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase font-mono font-bold text-slate-400">Device Pairing Token</label>
              <span className="text-[10px] text-slate-500 font-sans">Shared secret between devices</span>
            </div>
            <div className="flex gap-2">
              <input 
                type="text"
                value={syncToken}
                onChange={e => handleTokenChange(e.target.value)}
                placeholder="Enter or generate pairing token"
                className="flex-1 px-3.5 py-2 rounded-xl bg-slate-900 border border-white/[0.1] text-cyan-300 font-mono text-xs outline-none focus:border-cyan-500/50 transition-colors"
              />
              {syncToken ? (
                <button
                  type="button"
                  onClick={handleCopyToken}
                  className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-850 border border-white/[0.1] text-xs font-semibold text-slate-200 flex items-center gap-1 transition-colors cursor-pointer"
                  title="Copy Pairing Token"
                >
                  {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                  <span>{copiedToken ? 'Copied' : 'Copy'}</span>
                </button>
              ) : null}
              <button
                type="button"
                onClick={handleGenerateToken}
                className="px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-colors cursor-pointer shadow-md shadow-cyan-600/20"
              >
                Generate
              </button>
            </div>
          </div>

          {/* Sync Actions Bar */}
          <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={syncConfig.enabled}
                onChange={handleToggleCloudSync}
                className="w-4 h-4 rounded text-cyan-500 bg-slate-900 border-white/[0.2] focus:ring-0 cursor-pointer"
              />
              <span className="text-xs text-slate-300 font-medium">Auto-sync on review</span>
            </label>

            <button
              type="button"
              disabled={isSyncing || !syncConfig.enabled || !syncConfig.endpointUrl || !syncConfig.cloudToken}
              onClick={handleSyncNow}
              title={!syncConfig.endpointUrl ? 'Endpoint URL required to sync' : undefined}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                isSyncing || !syncConfig.enabled || !syncConfig.endpointUrl || !syncConfig.cloudToken
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-600/25'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync to Cloud Now'}</span>
            </button>
          </div>

          {syncMsg && (
            <div className={`p-2.5 rounded-xl text-xs font-medium ${
              syncMsg.type === 'success' 
                ? 'bg-emerald-950/40 border border-emerald-800/60 text-emerald-300' 
                : 'bg-rose-950/40 border border-rose-800/60 text-rose-300'
            }`}>
              {syncMsg.text}
            </div>
          )}
        </div>

        {/* Habit Loop & Web Push Streak Notifications */}
        <div className="p-4 rounded-2xl bg-slate-950/70 border border-white/[0.08] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-2 font-display">
              <BellRing className="w-4 h-4 text-amber-400" />
              <span>Daily Habit Loop Notifications</span>
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
              notifSettings.enabled && notifPerm === 'granted'
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                : notifPerm === 'denied'
                ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                : 'bg-slate-800 text-slate-400 border border-white/[0.08]'
            }`}>
              {notifSettings.enabled && notifPerm === 'granted' ? 'Active 🔔' : notifPerm === 'denied' ? 'Blocked' : 'Off'}
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed font-sans">
            Get a warm nudge before your streak resets. Lottie checks if you have pending review cards and alerts your device.
          </p>

          <div className="space-y-1.5 pt-1">
            <label className="text-[10px] uppercase font-mono font-bold text-slate-400">Preferred Daily Reminder Time</label>
            <div className="grid grid-cols-5 gap-1.5">
              {[
                { hour: 17, label: '5 PM' },
                { hour: 18, label: '6 PM' },
                { hour: 19, label: '7 PM' },
                { hour: 20, label: '8 PM' },
                { hour: 21, label: '9 PM' },
              ].map(slot => (
                <button
                  key={slot.hour}
                  type="button"
                  onClick={() => handleSetReminderHour(slot.hour)}
                  className={`py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    notifSettings.reminderHour === slot.hour
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                      : 'bg-slate-900 text-slate-400 border-white/[0.06] hover:border-white/[0.15]'
                  }`}
                >
                  {slot.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={handleTogglePushNotifications}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                notifSettings.enabled && notifPerm === 'granted'
                  ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-md shadow-amber-500/25'
              }`}
            >
              {notifSettings.enabled && notifPerm === 'granted' ? 'Disable Reminders' : 'Enable Daily Push'}
            </button>

            {notifSettings.enabled && (
              <button
                type="button"
                onClick={handleTestNotification}
                className="text-xs text-amber-300 hover:text-amber-200 underline font-semibold cursor-pointer"
              >
                Send Test Alert
              </button>
            )}
          </div>

          {notifMsg && (
            <div className="p-2.5 rounded-xl text-xs font-medium bg-amber-950/40 border border-amber-800/60 text-amber-300">
              {notifMsg}
            </div>
          )}
        </div>

        {/* Tactile Audio & Haptics Feedback */}
        <div className="p-4 rounded-2xl bg-slate-950/70 border border-white/[0.08] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-2 font-display">
              <Volume2 className="w-4 h-4 text-pink-400" />
              <span>Audio Chimes & Tactile Micro-Haptics</span>
            </span>
            <span className="text-[10px] text-pink-300 font-mono">Sensory Polish</span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed font-sans">
            Crisp marimba chords, tactile option clicks, dynamic combo escalation, and subtle mobile vibration pulses.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* SFX Switch */}
            <div className="p-3 rounded-xl bg-slate-900/80 border border-white/[0.06] flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-white block">Sound Effects</span>
                <span className="text-[10px] text-slate-400">Marimba & chime feedback</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => soundEngine.playCorrectChime()}
                  className="text-[10px] text-indigo-300 hover:text-white underline cursor-pointer"
                >
                  Test
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = !sfxOn;
                    soundEngine.setSfxEnabled(next);
                    setSfxOn(next);
                    if (next) soundEngine.playTapPop();
                  }}
                  className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${
                    sfxOn ? 'bg-pink-500' : 'bg-slate-800'
                  }`}
                >
                  <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                    sfxOn ? 'translate-x-5' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            </div>

            {/* Haptics Switch */}
            <div className="p-3 rounded-xl bg-slate-900/80 border border-white/[0.06] flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-white block">Micro-Haptics</span>
                <span className="text-[10px] text-slate-400">Tactile vibration on tap</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => haptics.success()}
                  className="text-[10px] text-pink-300 hover:text-white underline cursor-pointer"
                >
                  Test
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = !hapticsOn;
                    haptics.setEnabled(next);
                    setHapticsOn(next);
                    if (next) haptics.pop();
                  }}
                  className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${
                    hapticsOn ? 'bg-pink-500' : 'bg-slate-800'
                  }`}
                >
                  <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                    hapticsOn ? 'translate-x-5' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Data Portability & Anki Export */}
        <div className="p-4 rounded-2xl bg-slate-950/70 border border-white/[0.08] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-2 font-display">
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Data Portability & Anki Sync</span>
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Local-First</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed font-sans">
            Export your entire study history, streaks, and FSRS schedules, or export your flashcards directly to Anki.
          </p>

          <input
            type="file"
            ref={importInputRef}
            onChange={handleImportFile}
            accept=".json"
            className="hidden"
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
            <button
              onClick={handleExportJSON}
              className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 border border-white/[0.08] transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-indigo-400" />
              <span>Backup JSON</span>
            </button>

            <button
              onClick={handleExportAnki}
              className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 border border-white/[0.08] transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Export to Anki</span>
            </button>

            <button
              onClick={() => importInputRef.current?.click()}
              className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 border border-white/[0.08] transition-colors"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-400" />
              <span>Restore JSON</span>
            </button>
          </div>

          {backupMsg && (
            <div className={`p-2.5 rounded-xl text-xs font-medium ${
              backupMsg.type === 'success' 
                ? 'bg-emerald-950/40 border border-emerald-800/60 text-emerald-300' 
                : 'bg-rose-950/40 border border-rose-800/60 text-rose-300'
            }`}>
              {backupMsg.text}
            </div>
          )}
        </div>

        {/* Danger Zone */}
        <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between">
          <div className="text-xs text-slate-400 font-sans">
            Reset all local decks and habit statistics
          </div>
          <button
            onClick={handleClearAll}
            className="px-3 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Reset Data</span>
          </button>
        </div>

      </div>
    </div>
  );
};
