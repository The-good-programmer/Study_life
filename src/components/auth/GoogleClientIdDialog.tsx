import React, { useState } from 'react';
import { Info, X } from 'lucide-react';
import { GoogleAuthService } from '../../services/googleAuthService';
import { ErrorBanner, GoogleIcon, PrimaryGradientButton } from './AuthParts';

interface GoogleClientIdDialogProps {
  error: string | null;
  isLoading: boolean;
  onError: (message: string | null) => void;
  onClose: () => void;
  /** Called after the client ID has been saved; should start the real sign-in. */
  onSaved: () => void;
}

/** Asks for a Google OAuth Web Client ID when none is configured. */
export const GoogleClientIdDialog: React.FC<GoogleClientIdDialogProps> = ({
  error,
  isLoading,
  onError,
  onClose,
  onSaved,
}) => {
  const [clientId, setClientId] = useState(() => GoogleAuthService.getClientId());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = clientId.trim();
    if (!clean || clean.length < 10) {
      onError('Please enter a valid Google Client ID ending in .apps.googleusercontent.com');
      return;
    }
    GoogleAuthService.setClientId(clean);
    onSaved();
  };

  return (
    <div
      className="fixed inset-0 z-60 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-[#0f1322] border border-white/[0.14] rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-md">
              <GoogleIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Connect Google Account</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  OAuth 2.0
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">Sign in with your real Google account via accounts.google.com</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 text-xs text-slate-300 space-y-2">
          <div className="flex items-center gap-1.5 font-bold text-indigo-300">
            <Info className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>Google OAuth 2.0 Setup</span>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-400">
            To open the real Google authentication popup, Google requires a Web Client ID from your Google Cloud
            Console:
          </p>
          <ol className="text-[11px] text-slate-300 space-y-1 list-decimal list-inside bg-black/30 p-2.5 rounded-xl border border-white/[0.06]">
            <li>
              Open{' '}
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noreferrer"
                className="text-indigo-400 underline hover:text-indigo-300 font-semibold"
              >
                Google Cloud Credentials
              </a>
            </li>
            <li>
              Click <strong>+ Create Credentials</strong> → <strong>OAuth client ID</strong> (Web application)
            </li>
            <li>
              Add Authorized JavaScript origin:{' '}
              <code className="px-1.5 py-0.5 rounded bg-slate-900 text-indigo-300 font-mono text-[11px] select-all">
                http://localhost:5173
              </code>
            </li>
          </ol>
        </div>

        <ErrorBanner message={error} />

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block">Paste your Google Client ID</label>
            <input
              type="text"
              required
              placeholder="e.g. 1234567890-abcdef.apps.googleusercontent.com"
              value={clientId}
              onChange={e => setClientId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/[0.12] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono"
            />
            <span className="text-[11px] text-slate-500 block">
              You can also save this permanently in <code className="text-slate-400">.env.local</code> as{' '}
              <code className="text-slate-400">VITE_GOOGLE_CLIENT_ID</code>.
            </span>
          </div>

          <div className="flex items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/[0.08] text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <PrimaryGradientButton
              loading={isLoading}
              size="sm"
              fullWidth={false}
              icon={<GoogleIcon className="w-4 h-4" />}
              className="flex-1"
            >
              Connect & Sign In
            </PrimaryGradientButton>
          </div>
        </form>
      </div>
    </div>
  );
};
