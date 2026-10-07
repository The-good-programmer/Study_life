import React, { useState } from 'react';
import { X } from 'lucide-react';
import { GoogleAuthService } from '../../services/googleAuthService';
import { Dialog, DialogFooter, DialogPanel } from '../common/Dialog';
import { Button, IconButton } from '../ui/primitives';
import { AUTH_INPUT, ErrorBanner, GoogleIcon, PrimaryGradientButton } from './AuthParts';

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

  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';

  return (
    <Dialog isOpen onClose={onClose} titleId="google-client-title" className="max-w-md">
      <DialogPanel>
        <div className="shrink-0 border-b border-line px-5 pb-4 pt-5 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-white">
              <GoogleIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="google-client-title" className="text-[17px] font-semibold text-ink">
                Connect Google sign-in
              </h2>
              <p className="mt-1 text-[13px] text-ink-subtle">Google needs a client ID for this site before its sign-in window can open.</p>
            </div>
            <IconButton icon={X} label="Close" onClick={onClose} className="-mr-2 -mt-1.5" />
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
          <ol className="list-decimal space-y-1.5 pl-5 text-[13px] leading-relaxed text-ink-muted marker:text-ink-subtle">
            <li>
              Open{' '}
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-brand-text hover:underline"
              >
                Google Cloud credentials
              </a>
              .
            </li>
            <li>
              Create an <strong className="font-medium text-ink">OAuth client ID</strong> for a web application.
            </li>
            <li>
              Add this authorised JavaScript origin:{' '}
              <code className="select-all rounded border border-line bg-canvas px-1.5 py-0.5 font-mono text-xs text-ink">{origin}</code>
            </li>
          </ol>

          <ErrorBanner message={error} />

          <form onSubmit={handleSubmit} className="space-y-3" id="google-client-form">
            <label className="block">
              <span className="text-[13px] font-medium text-ink">Client ID</span>
              <input
                type="text"
                required
                data-autofocus
                placeholder="1234567890-abc.apps.googleusercontent.com"
                value={clientId}
                onChange={e => setClientId(e.target.value)}
                spellCheck={false}
                className={`${AUTH_INPUT} mt-1.5 font-mono`}
              />
            </label>
            <p className="text-xs text-ink-subtle">
              To keep it, set <code className="font-mono">VITE_GOOGLE_CLIENT_ID</code> in <code className="font-mono">.env.local</code>.
            </p>
          </form>
        </div>

        <DialogFooter className="justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <PrimaryGradientButton
            loading={isLoading}
            size="sm"
            fullWidth={false}
            form="google-client-form"
            icon={<GoogleIcon className="h-4 w-4" />}
            className="h-10 px-4"
          >
            Connect and sign in
          </PrimaryGradientButton>
        </DialogFooter>
      </DialogPanel>
    </Dialog>
  );
};
