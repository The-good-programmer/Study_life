import React, { useState } from 'react';
import { X, Key, Smartphone, Trash2, Check, ExternalLink, ShieldCheck } from 'lucide-react';
import { StorageService } from '../../services/storageService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStatsReset: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onStatsReset }) => {
  const [apiKey, setApiKey] = useState(StorageService.getApiKey());
  const [isSaved, setIsSaved] = useState(false);

  if (!isOpen) return null;

  const handleSaveKey = (e: React.FormEvent) => {
    e.preventDefault();
    StorageService.setApiKey(apiKey);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
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

        {/* Mobile App & PWA Section */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-white">
            <Smartphone className="w-4 h-4 text-purple-400" />
            <span>Mobile App Readiness (PWA & Capacitor)</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            You can use Studify as a mobile app on your iPhone or Android phone right now:
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
