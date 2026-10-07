import React, { useState, useEffect } from 'react';
import { X, User, UserPlus, LogIn, RefreshCw, Edit3 } from 'lucide-react';
import type { UserAccount, GoogleProfilePayload } from '../../types';
import { AuthService } from '../../services/authService';
import { GoogleAuthService } from '../../services/googleAuthService';
import { StorageService } from '../../services/storageService';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { Dialog, DialogPanel } from '../common/Dialog';
import { IconButton } from '../ui/primitives';
import { GoogleIcon, TabButton } from './AuthParts';
import { LoginTab } from './LoginTab';
import type { LoginPrefill } from './LoginTab';
import { RegisterTab } from './RegisterTab';
import { GoogleSetupTab } from './GoogleSetupTab';
import { ProfileTab } from './ProfileTab';
import { EditProfileTab } from './EditProfileTab';
import { SwitchAccountTab } from './SwitchAccountTab';
import { GoogleClientIdDialog } from './GoogleClientIdDialog';

type AuthTab = 'login' | 'register' | 'profile' | 'switch' | 'edit' | 'google-setup';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'login' | 'register' | 'profile';
  onUserChanged?: (user: UserAccount | null) => void;
}

const defaultTab = (user: UserAccount | null, initialTab: AuthModalProps['initialTab']): AuthTab =>
  user ? 'profile' : initialTab === 'register' ? 'register' : 'login';

/**
 * Account modal shell. It owns navigation, the signed-in user and the shared Google
 * sign-in flow; each tab owns its own form state.
 */
export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'login',
  onUserChanged,
}) => {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => AuthService.getCurrentUser());
  const [allAccounts, setAllAccounts] = useState<UserAccount[]>(() => AuthService.getAllAccounts());
  const [tab, setTab] = useState<AuthTab>(() => defaultTab(AuthService.getCurrentUser(), initialTab));
  const [loginPrefill, setLoginPrefill] = useState<LoginPrefill | null>(null);

  // Google sign-in is shared by the login and register tabs
  const [googleProfilePending, setGoogleProfilePending] = useState<GoogleProfilePayload | null>(null);
  const [isClientIdDialogOpen, setIsClientIdDialogOpen] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Reset when the modal opens (adjusting state during render)
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      const user = AuthService.getCurrentUser();
      setCurrentUser(user);
      setAllAccounts(AuthService.getAllAccounts());
      setLoginPrefill(null);
      setGoogleError(null);
      setTab(defaultTab(user, initialTab));
    }
  }

  // Keep auth state synced with AuthService subscription
  useEffect(() => {
    return AuthService.subscribe(user => {
      setCurrentUser(user);
      setAllAccounts(AuthService.getAllAccounts());
    });
  }, []);

  if (!isOpen) return null;

  const guestSummary = StorageService.getGuestDataSummary();
  const guest = {
    hasData: StorageService.hasGuestData(),
    deckCount: guestSummary.deckCount,
    cardCount: guestSummary.cardCount,
  };

  const finish = (user: UserAccount | null) => {
    onUserChanged?.(user);
    onClose();
  };

  const goTo = (next: AuthTab) => {
    setGoogleError(null);
    setTab(next);
  };

  const handleGoogleSuccess = async (payload: GoogleProfilePayload) => {
    setIsGoogleLoading(true);
    setGoogleError(null);
    try {
      const res = await AuthService.signInWithGoogle(payload);
      if (res.success && res.user) {
        setIsGoogleLoading(false);
        setIsClientIdDialogOpen(false);
        finish(res.user);
        return;
      }

      if (res.requiresProfileSetup && res.partialProfile) {
        setIsGoogleLoading(false);
        setIsClientIdDialogOpen(false);
        setGoogleProfilePending(res.partialProfile);
        setTab('google-setup');
        return;
      }

      setGoogleError(res.error || 'Google sign in failed.');
      setIsGoogleLoading(false);
    } catch (err: unknown) {
      setIsGoogleLoading(false);
      setGoogleError(err instanceof Error ? err.message : 'Google authentication error');
    }
  };

  const startRealGoogleOAuth = async () => {
    setIsGoogleLoading(true);
    setGoogleError(null);
    await GoogleAuthService.launchRealGoogleSignIn(
      payload => {
        void handleGoogleSuccess(payload);
      },
      errorMsg => {
        setIsGoogleLoading(false);
        setGoogleError(errorMsg);
      },
    );
  };

  const handleGoogleSignInClick = async () => {
    setGoogleError(null);
    if (GoogleAuthService.isGoogleConfigured()) {
      await startRealGoogleOAuth();
    } else {
      setIsClientIdDialogOpen(true);
    }
  };

  const handleSwitchAccount = async (target: UserAccount) => {
    if (target.provider === 'password' && target.passwordHash) {
      setLoginPrefill({ email: target.email, error: `Please enter password for ${target.name} to switch.` });
      goTo('login');
      return;
    }

    const res = await AuthService.switchAccount(target.id);
    if (res.success) finish(AuthService.getCurrentUser());
  };

  const handleLogout = () => {
    AuthService.logout();
    finish(null);
  };

  const handleDeleteAccount = (userId: string) => setPendingDeleteId(userId);

  const confirmDeleteAccount = () => {
    if (!pendingDeleteId) return;
    AuthService.deleteAccount(pendingDeleteId);
    setPendingDeleteId(null);
    onUserChanged?.(null);
    setTab('login');
  };

  const title = currentUser
    ? 'Your account'
    : tab === 'google-setup'
    ? 'Finish setting up'
    : tab === 'register'
    ? 'Create an account'
    : 'Welcome back';

  const subtitle = currentUser
    ? `Signed in as ${currentUser.name}`
    : tab === 'google-setup'
    ? 'Tell us your level so Studify can pitch your decks at the right difficulty.'
    : 'Your account and study data are saved in this browser.';

  return (
    <Dialog isOpen={isOpen} onClose={onClose} titleId="auth-modal-title" className="max-w-lg">
      <DialogPanel>
        <div className="shrink-0 border-b border-line px-5 pt-5 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h2 id="auth-modal-title" className="text-[17px] font-semibold text-ink">
                {title}
              </h2>
              <p className="mt-1 text-[13px] text-ink-subtle">{subtitle}</p>
            </div>
            <IconButton icon={X} label="Close" onClick={onClose} className="-mr-2 -mt-1.5" />
          </div>

          <div role="tablist" aria-label="Account" className="-mb-px mt-4 flex gap-5 overflow-x-auto no-scrollbar">
            {!currentUser ? (
              tab === 'google-setup' ? (
                <span className="inline-flex items-center gap-1.5 border-b-2 border-ink pb-2.5 text-[13px] font-medium text-ink">
                  <GoogleIcon className="h-3.5 w-3.5" />
                  Google account
                </span>
              ) : (
                <>
                  <TabButton active={tab === 'login'} onClick={() => goTo('login')} icon={<LogIn className="h-3.5 w-3.5" aria-hidden="true" />}>
                    Log in
                  </TabButton>
                  <TabButton
                    active={tab === 'register'}
                    onClick={() => goTo('register')}
                    icon={<UserPlus className="h-3.5 w-3.5" aria-hidden="true" />}
                  >
                    Create account
                  </TabButton>
                </>
              )
            ) : (
              <>
                <TabButton active={tab === 'profile'} onClick={() => setTab('profile')} icon={<User className="h-3.5 w-3.5" aria-hidden="true" />}>
                  Overview
                </TabButton>
                <TabButton active={tab === 'edit'} onClick={() => setTab('edit')} icon={<Edit3 className="h-3.5 w-3.5" aria-hidden="true" />}>
                  Edit profile
                </TabButton>
                {allAccounts.length > 1 && (
                  <TabButton
                    active={tab === 'switch'}
                    onClick={() => setTab('switch')}
                    icon={<RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
                  >
                    Switch account
                    <span className="tabular-nums text-ink-subtle">{allAccounts.length}</span>
                  </TabButton>
                )}
              </>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          {tab === 'login' && !currentUser && (
            <LoginTab
              key={loginPrefill?.email ?? 'login'}
              accounts={allAccounts}
              googleError={googleError}
              isGoogleLoading={isGoogleLoading}
              prefill={loginPrefill}
              onGoogleClick={handleGoogleSignInClick}
              onGoogleAccount={payload => void handleGoogleSuccess(payload)}
              onGotoRegister={() => goTo('register')}
              onSuccess={finish}
            />
          )}

          {tab === 'register' && !currentUser && (
            <RegisterTab
              googleError={googleError}
              isGoogleLoading={isGoogleLoading}
              guest={guest}
              onGoogleClick={handleGoogleSignInClick}
              onGotoLogin={() => goTo('login')}
              onSuccess={finish}
            />
          )}

          {tab === 'google-setup' && googleProfilePending && (
            <GoogleSetupTab
              profile={googleProfilePending}
              guest={guest}
              onCancel={() => {
                setGoogleProfilePending(null);
                setTab('login');
              }}
              onSuccess={user => {
                setGoogleProfilePending(null);
                finish(user);
              }}
            />
          )}

          {tab === 'profile' && currentUser && (
            <ProfileTab
              user={currentUser}
              canSwitchAccount={allAccounts.length > 1}
              onEdit={() => setTab('edit')}
              onSwitch={() => setTab('switch')}
              onLogout={handleLogout}
            />
          )}

          {tab === 'edit' && currentUser && (
            <EditProfileTab
              user={currentUser}
              onCancel={() => setTab('profile')}
              onSaved={updated => onUserChanged?.(updated)}
              onDone={() => setTab('profile')}
              onDelete={handleDeleteAccount}
            />
          )}

          {tab === 'switch' && (
            <SwitchAccountTab
              accounts={allAccounts}
              currentUserId={currentUser?.id}
              onSwitch={handleSwitchAccount}
              onAddAccount={() => goTo('register')}
              onBack={() => setTab('profile')}
              onLogout={handleLogout}
            />
          )}
        </div>
      </DialogPanel>

      <ConfirmDialog
        isOpen={!!pendingDeleteId}
        title="Delete this account?"
        confirmLabel="Delete account"
        tone="danger"
        onConfirm={confirmDeleteAccount}
        onCancel={() => setPendingDeleteId(null)}
      >
        This removes the account and all of its decks, cards, review history and stats from this browser. You cannot undo it.
      </ConfirmDialog>

      {isClientIdDialogOpen && (
        <GoogleClientIdDialog
          error={googleError}
          isLoading={isGoogleLoading}
          onError={setGoogleError}
          onClose={() => setIsClientIdDialogOpen(false)}
          onSaved={() => {
            setIsClientIdDialogOpen(false);
            void startRealGoogleOAuth();
          }}
        />
      )}
    </Dialog>
  );
};
