import React, { useState, useEffect } from 'react';
import { X, User, UserPlus, LogIn, ShieldCheck, RefreshCw, Edit3 } from 'lucide-react';
import type { UserAccount, GoogleProfilePayload } from '../../types';
import { AuthService } from '../../services/authService';
import { GoogleAuthService } from '../../services/googleAuthService';
import { StorageService } from '../../services/storageService';
import { Dialog } from '../common/Dialog';
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

  const handleDeleteAccount = (userId: string) => {
    if (
      window.confirm(
        'Are you sure you want to permanently delete this account and all its isolated study data? This cannot be undone.',
      )
    ) {
      AuthService.deleteAccount(userId);
      onUserChanged?.(null);
      setTab('login');
    }
  };

  const title = currentUser
    ? 'Student Account'
    : tab === 'google-setup'
    ? 'Complete Profile'
    : tab === 'register'
    ? 'Create Account'
    : 'Welcome Back';

  const subtitle = currentUser
    ? `Logged in as ${currentUser.name}`
    : tab === 'google-setup'
    ? 'Set up your educational grade for Gemini AI personalization'
    : 'Local-first private account encrypted on your device';

  return (
    <Dialog isOpen={isOpen} onClose={onClose} titleId="auth-modal-title" className="max-w-lg">
      <div className="relative w-full bg-[#0e111d] border border-white/[0.12] rounded-3xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 id="auth-modal-title" className="text-base font-bold text-white font-display flex items-center gap-2">
                {title}
                <span className="text-[11px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  100% Offline
                </span>
              </h2>
              <p className="text-xs text-slate-400">{subtitle}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close student account"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex border-b border-white/[0.06] bg-slate-950/40 px-6 pt-2 gap-2 text-xs font-semibold">
          {!currentUser ? (
            tab === 'google-setup' ? (
              <div className="pb-2.5 px-3 border-b-2 border-indigo-500 text-white font-bold flex items-center gap-2">
                <GoogleIcon className="w-3.5 h-3.5" />
                <span>Complete Google Setup</span>
              </div>
            ) : (
              <>
                <TabButton
                  active={tab === 'login'}
                  onClick={() => goTo('login')}
                  icon={<LogIn className="w-3.5 h-3.5" />}
                >
                  Log In
                </TabButton>
                <TabButton
                  active={tab === 'register'}
                  onClick={() => goTo('register')}
                  icon={<UserPlus className="w-3.5 h-3.5" />}
                >
                  Create Account
                </TabButton>
              </>
            )
          ) : (
            <>
              <TabButton active={tab === 'profile'} onClick={() => setTab('profile')} icon={<User className="w-3.5 h-3.5" />}>
                Overview
              </TabButton>
              <TabButton active={tab === 'edit'} onClick={() => setTab('edit')} icon={<Edit3 className="w-3.5 h-3.5" />}>
                Edit Profile
              </TabButton>
              {allAccounts.length > 1 && (
                <TabButton
                  active={tab === 'switch'}
                  onClick={() => setTab('switch')}
                  icon={<RefreshCw className="w-3.5 h-3.5" />}
                >
                  Switch Account ({allAccounts.length})
                </TabButton>
              )}
            </>
          )}
        </div>

        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          <div className="p-2.5 rounded-xl bg-indigo-950/30 border border-indigo-500/20 text-[11px] text-indigo-200/90 flex items-center gap-2">
            <span className="text-sm">🔒</span>
            <span>Local profile: accounts and study history are stored privately in this browser.</span>
          </div>

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
      </div>

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
