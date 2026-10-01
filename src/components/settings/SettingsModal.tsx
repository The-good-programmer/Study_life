import React, { useState, useRef } from 'react';
import { X, Key, Smartphone, Trash2, Check, ExternalLink, ShieldCheck, Download, Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from 'lucide-react';
import { StorageService } from '../../services/storageService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStatsReset: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onStatsReset }) => {
  const [apiKey, setApiKey] = useState(StorageService.getApiKey());
  const [isSaved, setIsSaved] = useState(false);
  const [backupMsg, setBackupMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const importInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleSaveKey = (e: React.FormEvent) => {
    e.preventDefault();
    StorageService.setApiKey(apiKey);
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
      a.download = `studify-backup-${new Date().toISOString().split('T')[0]}.json`;
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
      a.download = `studify-anki-export-${new Date().toISOString().split('T')[0]}.txt`;
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

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="max-w-lg w-full rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-6 relative max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-white">Studify Preferences</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Gemini API Key Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Key className="w-4 h-4 text-indigo-400" />
            <span>Google Gemini API Key (Optional)</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Studify already includes intelligent local cognitive synthesis for testing. For dynamic parsing of unlimited custom materials and high-precision Feynman evaluations, enter your free Gemini API key.
          </p>

          <form onSubmit={handleSaveKey} className="space-y-2">
            <div className="flex gap-2">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-indigo-500 font-mono"
              />
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
              >
                {isSaved ? <Check className="w-3.5 h-3.5" /> : null}
                <span>{isSaved ? 'Saved!' : 'Save Key'}</span>
              </button>
            </div>
          </form>

          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
            <div className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Keys are stored strictly in your browser's local storage.</span>
            </div>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 underline underline-offset-2"
            >
              <span>Get Free Key</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Data Portability & Backup Section */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white flex items-center gap-2">
              <Download className="w-4 h-4 text-emerald-400" />
              Data Backup & Portability
            </span>
            <span className="text-[10px] text-slate-500">Local-First</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Export your entire study history, streaks, and FSRS memory schedules, or take your flashcards to Anki.
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
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 border border-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-indigo-400" />
              <span>Backup JSON</span>
            </button>

            <button
              onClick={handleExportAnki}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 border border-slate-700 transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Anki Export</span>
            </button>

            <button
              onClick={() => importInputRef.current?.click()}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 border border-slate-700 transition-colors"
            >
              <Upload className="w-3.5 h-3.5 text-purple-400" />
              <span>Restore Backup</span>
            </button>
          </div>

          {backupMsg && (
            <div className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
              backupMsg.type === 'success' ? 'bg-emerald-950/40 border border-emerald-800 text-emerald-300' : 'bg-rose-950/40 border border-rose-800 text-rose-300'
            }`}>
              {backupMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{backupMsg.text}</span>
            </div>
          )}
        </div>

        {/* Mobile App & PWA Section */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-white">
            <Smartphone className="w-4 h-4 text-purple-400" />
            <span>Mobile App Readiness (PWA & Capacitor)</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            You can install Studify on your phone right now without app store downloads:
          </p>
          <ul className="text-xs text-slate-300 space-y-1 list-disc pl-5">
            <li><strong>iPhone (Safari):</strong> Tap <em>Share</em> $\rightarrow$ <em>Add to Home Screen</em>.</li>
            <li><strong>Android (Chrome):</strong> Tap <em>More</em> $\rightarrow$ <em>Install App</em>.</li>
          </ul>
        </div>

        {/* Danger Zone */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-rose-400">Reset Local Progress</div>
            <div className="text-[11px] text-slate-500">Clears streak, decks, and cached stats.</div>
          </div>
          <button
            onClick={handleClearAll}
            className="px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800 text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Storage</span>
          </button>
        </div>

      </div>
    </div>
  );
};
