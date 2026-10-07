import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  LogOut,
  UserPlus,
  LogIn,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  Layers,
  Flame,
  School,
  RefreshCw,
  Trash2,
  Edit3,
  Clock,
  ArrowRight,
  Globe,
  Info,
  Coins
} from 'lucide-react';
import type { UserAccount, GoogleProfilePayload } from '../../types';
import { AuthService } from '../../services/authService';
import { GoogleAuthService } from '../../services/googleAuthService';
import { StorageService } from '../../services/storageService';
import { lifeSimService } from '../../services/lifeSimService';
import { EducationCatalog } from '../../services/educationCatalog';
import { EducationFields } from './EducationFields';
import { createEducationDraft, educationFromUser, resolveGrade } from './educationDraft';
import type { EducationDraft } from './educationDraft';
import { Dialog } from '../common/Dialog';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'login' | 'register' | 'profile';
  onUserChanged?: (user: UserAccount | null) => void;
}

export const GoogleIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

const AVATAR_OPTIONS = ['🧠', '🚀', '🦉', '🎓', '⚡', '🔬', '🪐', '🎨', '💡', '🧬', '🏆', '💎', '📚', '🌟'];

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'login',
  onUserChanged,
}) => {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => AuthService.getCurrentUser());
  const [allAccounts, setAllAccounts] = useState<UserAccount[]>(() => AuthService.getAllAccounts());
  const [tab, setTab] = useState<'login' | 'register' | 'profile' | 'switch' | 'edit' | 'google-setup'>(() => {
    const user = AuthService.getCurrentUser();
    return user ? 'profile' : (initialTab === 'register' ? 'register' : 'login');
  });

  // Google Auth state
  const [googleProfilePending, setGoogleProfilePending] = useState<GoogleProfilePayload | null>(null);
  const [isGoogleClientIdModalOpen, setIsGoogleClientIdModalOpen] = useState(false);
  const [customClientIdInput, setCustomClientIdInput] = useState(() => GoogleAuthService.getClientId());
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  // Google Profile Setup Form State
  const [googleEdu, setGoogleEdu] = useState<EducationDraft>(() => createEducationDraft({ age: 15 }));
  const [googleMigrateGuestData, setGoogleMigrateGuestData] = useState(true);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regEdu, setRegEdu] = useState<EducationDraft>(() => createEducationDraft());
  const [regAvatar, setRegAvatar] = useState('🧠');
  const [regInstitution, setRegInstitution] = useState('');
  const [migrateGuestData, setMigrateGuestData] = useState(true);
  const [regError, setRegError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  // Edit profile form state
  const [editName, setEditName] = useState(() => AuthService.getCurrentUser()?.name || '');
  const [editEdu, setEditEdu] = useState<EducationDraft>(() => educationFromUser(AuthService.getCurrentUser()));
  const [editAvatar, setEditAvatar] = useState(() => AuthService.getCurrentUser()?.avatar || '🧠');
  const [editInstitution, setEditInstitution] = useState(() => AuthService.getCurrentUser()?.institution || '');
  const [editSuccessMsg, setEditSuccessMsg] = useState<string | null>(null);

  // Guest data check
  const guestSummary = StorageService.getGuestDataSummary();
  const hasGuestData = StorageService.hasGuestData();

  // Reset tab when modal opens or user auth status changes (Adjusting state during render)
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      const user = AuthService.getCurrentUser();
      setCurrentUser(user);
      setAllAccounts(AuthService.getAllAccounts());
      setLoginError(null);
      setRegError(null);
      setEditSuccessMsg(null);
      setTab(user ? 'profile' : (initialTab === 'register' ? 'register' : 'login'));
      if (user) {
        setEditName(user.name);
        setEditEdu(prev => ({ ...prev, ...educationFromUser(user, false) }));
        setEditAvatar(user.avatar);
        setEditInstitution(user.institution || '');
      }
    }
  }

  // Keep auth state synced with AuthService subscription
  useEffect(() => {
    const unsubscribe = AuthService.subscribe((user) => {
      setCurrentUser(user);
      setAllAccounts(AuthService.getAllAccounts());
      if (user) {
        setEditName(user.name);
        setEditEdu(prev => ({ ...prev, ...educationFromUser(user, false) }));
        setEditAvatar(user.avatar);
        setEditInstitution(user.institution || '');
      }
    });
    return unsubscribe;
  }, []);

  if (!isOpen) return null;

  // Password strength calculation
  const getPasswordStrength = (pass: string): { label: string; color: string; percent: number } => {
    if (!pass) return { label: '', color: '', percent: 0 };
    if (pass.length < 6) return { label: 'Too short (min 6 chars)', color: 'text-rose-400 bg-rose-500', percent: 25 };
    const hasLetters = /[a-zA-Z]/.test(pass);
    const hasNumbers = /[0-9]/.test(pass);
    const hasSpecial = /[^a-zA-Z0-9]/.test(pass);
    const score = (pass.length >= 8 ? 1 : 0) + (hasLetters && hasNumbers ? 1 : 0) + (hasSpecial ? 1 : 0);
    if (score >= 2) return { label: 'Strong password', color: 'text-emerald-400 bg-emerald-500', percent: 100 };
    if (score === 1) return { label: 'Good password', color: 'text-indigo-400 bg-indigo-500', percent: 65 };
    return { label: 'Fair password', color: 'text-amber-400 bg-amber-500', percent: 45 };
  };

  const regStrength = getPasswordStrength(regPassword);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);

    try {
      const res = await AuthService.login({ email: loginEmail, password: loginPassword });
      if (!res.success) {
        setLoginError(res.error || 'Failed to log in. Please check credentials.');
        setIsLoggingIn(false);
        return;
      }

      setIsLoggingIn(false);
      if (onUserChanged) onUserChanged(res.user || null);
      onClose();
    } catch (err: unknown) {
      setIsLoggingIn(false);
      const msg = err instanceof Error ? err.message : 'Unknown login error';
      setLoginError(msg);
    }
  };

  const handleGoogleSuccess = async (payload: GoogleProfilePayload) => {
    setIsGoogleLoading(true);
    setGoogleError(null);
    try {
      const res = await AuthService.signInWithGoogle(payload);
      if (res.success && res.user) {
        setIsGoogleLoading(false);
        setIsGoogleClientIdModalOpen(false);
        if (onUserChanged) onUserChanged(res.user);
        onClose();
        return;
      }

      if (res.requiresProfileSetup && res.partialProfile) {
        setIsGoogleLoading(false);
        setIsGoogleClientIdModalOpen(false);
        setGoogleProfilePending(res.partialProfile);
        setGoogleEdu(createEducationDraft({ age: 15 }));
        setTab('google-setup');
        return;
      }

      setGoogleError(res.error || 'Google sign in failed.');
      setIsGoogleLoading(false);
    } catch (err: unknown) {
      setIsGoogleLoading(false);
      const msg = err instanceof Error ? err.message : 'Google authentication error';
      setGoogleError(msg);
    }
  };

  const startRealGoogleOAuth = async () => {
    setIsGoogleLoading(true);
    setGoogleError(null);
    await GoogleAuthService.launchRealGoogleSignIn(
      (payload) => {
        handleGoogleSuccess(payload);
      },
      (errorMsg) => {
        setIsGoogleLoading(false);
        setGoogleError(errorMsg);
      }
    );
  };

  const handleGoogleSignInClick = async () => {
    setGoogleError(null);
    if (GoogleAuthService.isGoogleConfigured()) {
      await startRealGoogleOAuth();
    } else {
      setIsGoogleClientIdModalOpen(true);
    }
  };

  const handleSaveClientIdAndSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = customClientIdInput.trim();
    if (!cleanId || cleanId.length < 10) {
      setGoogleError('Please enter a valid Google Client ID ending in .apps.googleusercontent.com');
      return;
    }
    GoogleAuthService.setClientId(cleanId);
    setIsGoogleClientIdModalOpen(false);
    await startRealGoogleOAuth();
  };

  const handleCompleteGoogleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleProfilePending) return;

    setIsGoogleLoading(true);
    setGoogleError(null);

    try {
      const finalGrade = resolveGrade(googleEdu);
      const res = await AuthService.signInWithGoogle({
        googleId: googleProfilePending.googleId,
        email: googleProfilePending.email,
        name: googleProfilePending.name,
        pictureUrl: googleProfilePending.pictureUrl,
        age: googleEdu.age,
        country: googleEdu.country,
        grade: finalGrade,
        avatar: '🌐',
        migrateGuestData: googleMigrateGuestData,
      });

      if (!res.success || !res.user) {
        setGoogleError(res.error || 'Failed to complete profile registration.');
        setIsGoogleLoading(false);
        return;
      }

      setIsGoogleLoading(false);
      setGoogleProfilePending(null);
      if (onUserChanged) onUserChanged(res.user);
      onClose();
    } catch (err: unknown) {
      setIsGoogleLoading(false);
      const msg = err instanceof Error ? err.message : 'Profile completion error';
      setGoogleError(msg);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    setIsRegistering(true);

    try {
      const finalGrade = resolveGrade(regEdu);
      const res = await AuthService.register({
        name: regName,
        email: regEmail,
        password: regPassword,
        age: regEdu.age,
        country: regEdu.country,
        grade: finalGrade,
        avatar: regAvatar,
        institution: regInstitution,
        migrateGuestData,
      });

      if (!res.success) {
        setRegError(res.error || 'Registration failed. Please check your inputs.');
        setIsRegistering(false);
        return;
      }

      setIsRegistering(false);
      if (onUserChanged) onUserChanged(res.user || null);
      onClose();
    } catch (err: unknown) {
      setIsRegistering(false);
      const msg = err instanceof Error ? err.message : 'Unknown registration error';
      setRegError(msg);
    }
  };

  const handleSwitchAccount = async (targetAccount: UserAccount) => {
    if (targetAccount.provider === 'password' && targetAccount.passwordHash) {
      setLoginEmail(targetAccount.email);
      setLoginPassword('');
      setLoginError(`Please enter password for ${targetAccount.name} to switch.`);
      setTab('login');
      return;
    }

    const res = await AuthService.switchAccount(targetAccount.id);
    if (res.success) {
      const updated = AuthService.getCurrentUser();
      if (onUserChanged) onUserChanged(updated);
      onClose();
    }
  };

  const handleLogout = () => {
    AuthService.logout();
    if (onUserChanged) onUserChanged(null);
    onClose();
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!editName.trim() || editName.trim().length < 2) {
      setRegError('Name must be at least 2 characters.');
      return;
    }

    const finalEditGrade = resolveGrade(editEdu);
    const updated = AuthService.updateProfile(currentUser.id, {
      name: editName,
      age: editEdu.age,
      country: editEdu.country,
      grade: finalEditGrade,
      avatar: editAvatar,
      institution: editInstitution,
    });

    if (updated) {
      setEditSuccessMsg('Profile updated successfully!');
      if (onUserChanged) onUserChanged(updated);
      setTimeout(() => {
        setTab('profile');
        setEditSuccessMsg(null);
      }, 900);
    }
  };

  const handleDeleteAccount = (userId: string) => {
    if (window.confirm('Are you sure you want to permanently delete this account and all its isolated study data? This cannot be undone.')) {
      AuthService.deleteAccount(userId);
      if (onUserChanged) onUserChanged(null);
      setTab('login');
    }
  };

  const currentStats = StorageService.getStats();

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      titleId="auth-modal-title"
      className="max-w-lg"
    >
      <div 
        className="relative w-full bg-[#0e111d] border border-white/[0.12] rounded-3xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 id="auth-modal-title" className="text-base font-bold text-white font-display flex items-center gap-2">
                {currentUser
                  ? 'Student Account'
                  : tab === 'google-setup'
                  ? 'Complete Profile'
                  : tab === 'register'
                  ? 'Create Account'
                  : 'Welcome Back'}
                <span className="text-[11px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  100% Offline
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {currentUser
                  ? `Logged in as ${currentUser.name}`
                  : tab === 'google-setup'
                  ? 'Set up your educational grade for Gemini AI personalization'
                  : 'Local-first private account encrypted on your device'}
              </p>
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

        {/* Tab Switcher */}
        <div className="flex border-b border-white/[0.06] bg-slate-950/40 px-6 pt-2 gap-2 text-xs font-semibold">
          {!currentUser ? (
            tab === 'google-setup' ? (
              <div className="pb-2.5 px-3 border-b-2 border-indigo-500 text-white font-bold flex items-center gap-2">
                <GoogleIcon className="w-3.5 h-3.5" />
                <span>Complete Google Setup</span>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => { setTab('login'); setLoginError(null); setGoogleError(null); }}
                  className={`pb-2.5 px-3 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
                    tab === 'login'
                      ? 'border-indigo-500 text-white font-bold'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Log In</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setTab('register'); setRegError(null); setGoogleError(null); }}
                  className={`pb-2.5 px-3 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
                    tab === 'register'
                      ? 'border-indigo-500 text-white font-bold'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Create Account</span>
                </button>
              </>
            )
          ) : (
            <>
              <button
                type="button"
                onClick={() => setTab('profile')}
                className={`pb-2.5 px-3 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
                  tab === 'profile'
                    ? 'border-indigo-500 text-white font-bold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Overview</span>
              </button>
              <button
                type="button"
                onClick={() => setTab('edit')}
                className={`pb-2.5 px-3 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
                  tab === 'edit'
                    ? 'border-indigo-500 text-white font-bold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </button>
              {allAccounts.length > 1 && (
                <button
                  type="button"
                  onClick={() => setTab('switch')}
                  className={`pb-2.5 px-3 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
                    tab === 'switch'
                      ? 'border-indigo-500 text-white font-bold'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Switch Account ({allAccounts.length})</span>
                </button>
              )}
            </>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Local-First Architecture Notice */}
          <div className="p-2.5 rounded-xl bg-indigo-950/30 border border-indigo-500/20 text-[11px] text-indigo-200/90 flex items-center gap-2">
            <span className="text-sm">🔒</span>
            <span>Local profile: accounts and study history are stored privately in this browser.</span>
          </div>

          {/* TAB 1: LOG IN */}
          {tab === 'login' && !currentUser && (
            <div className="space-y-4">
              {loginError && (
                <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5 animate-shake">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              {googleError && (
                <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5 animate-shake">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{googleError}</span>
                </div>
              )}

              {/* Google Sign-In Button */}
              <button
                type="button"
                onClick={handleGoogleSignInClick}
                disabled={isGoogleLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-xs transition-all flex items-center justify-center gap-2.5 shadow-sm border border-slate-200 cursor-pointer disabled:opacity-60"
              >
                {isGoogleLoading ? (
                  <div className="w-4 h-4 border-2 border-slate-400 border-t-slate-900 rounded-full animate-spin" />
                ) : (
                  <>
                    <GoogleIcon className="w-4 h-4" />
                    <span>Continue with Google</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-3 my-1">
                <div className="flex-1 h-px bg-white/[0.08]" />
                <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">or sign in with email</span>
                <div className="flex-1 h-px bg-white/[0.08]" />
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                {/* Email */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-indigo-400" />
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="student@school.edu"
                    value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-white/[0.1] text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-indigo-400" />
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={e => setLoginPassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-white/[0.1] text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Existing accounts on device quick-login */}
                {allAccounts.length > 0 && (
                  <div className="pt-2">
                    <span className="text-[11px] font-semibold text-slate-400 block mb-2">
                      Or select an account saved on this browser:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {allAccounts.map(acc => (
                        <button
                          key={acc.id}
                          type="button"
                          onClick={() => {
                            if (acc.provider === 'google') {
                              handleGoogleSuccess({
                                googleId: acc.googleId || `google-${acc.id}`,
                                email: acc.email,
                                name: acc.name,
                                pictureUrl: acc.pictureUrl
                              });
                            } else {
                              setLoginEmail(acc.email);
                            }
                          }}
                          className="text-left p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] flex items-center gap-2.5 transition-all cursor-pointer"
                        >
                          <div className="w-8 h-8 rounded-lg bg-indigo-600/20 flex items-center justify-center text-base shrink-0 overflow-hidden">
                            {acc.pictureUrl ? (
                              <img src={acc.pictureUrl} alt={acc.name} className="w-full h-full object-cover" />
                            ) : (
                              acc.avatar
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                              <span>{acc.name}</span>
                              {acc.provider === 'google' && <GoogleIcon className="w-2.5 h-2.5 shrink-0" />}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate">{acc.email}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoggingIn ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Log In to Account</span>
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => { setTab('register'); setRegError(null); setGoogleError(null); }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
                >
                  Don't have an account? Sign up here →
                </button>
              </div>
            </form>
          </div>
        )}

          {/* TAB 2: REGISTER */}
          {tab === 'register' && !currentUser && (
            <div className="space-y-4">
              {regError && (
                <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5 animate-shake">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{regError}</span>
                </div>
              )}

              {googleError && (
                <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5 animate-shake">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{googleError}</span>
                </div>
              )}

              {/* Google Sign-Up Button */}
              <button
                type="button"
                onClick={handleGoogleSignInClick}
                disabled={isGoogleLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-xs transition-all flex items-center justify-center gap-2.5 shadow-sm border border-slate-200 cursor-pointer disabled:opacity-60"
              >
                {isGoogleLoading ? (
                  <div className="w-4 h-4 border-2 border-slate-400 border-t-slate-900 rounded-full animate-spin" />
                ) : (
                  <>
                    <GoogleIcon className="w-4 h-4" />
                    <span>Sign up with Google</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-3 my-1">
                <div className="flex-1 h-px bg-white/[0.08]" />
                <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">or register with email</span>
                <div className="flex-1 h-px bg-white/[0.08]" />
              </div>

              <form onSubmit={handleRegister} className="space-y-4">

              {/* Avatar selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Choose Profile Avatar</span>
                  <span className="text-[11px] text-slate-500">Selected: {regAvatar}</span>
                </label>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {AVATAR_OPTIONS.map(av => (
                    <button
                      key={av}
                      type="button"
                      onClick={() => setRegAvatar(av)}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-all shrink-0 cursor-pointer ${
                        regAvatar === av
                          ? 'bg-indigo-600 ring-2 ring-indigo-400 scale-110 shadow-md'
                          : 'bg-slate-900 border border-white/[0.08] hover:bg-white/[0.08]'
                      }`}
                    >
                      {av}
                    </button>
                  ))}
                </div>
              </div>

              {/* Name & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-indigo-400" />
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Alex Rivera"
                    value={regName}
                    onChange={e => setRegName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900/80 border border-white/[0.1] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-indigo-400" />
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="alex@school.edu"
                    value={regEmail}
                    onChange={e => setRegEmail(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900/80 border border-white/[0.1] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-indigo-400" />
                    Create Password
                  </span>
                  {regPassword && (
                    <span className={`text-[11px] font-semibold ${regStrength.color.split(' ')[0]}`}>
                      {regStrength.label}
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="At least 6 characters"
                    value={regPassword}
                    onChange={e => setRegPassword(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900/80 border border-white/[0.1] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {regPassword && (
                  <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mt-1">
                    <div 
                      className={`h-full transition-all duration-300 ${regStrength.color.split(' ')[1]}`} 
                      style={{ width: `${regStrength.percent}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Educational Profile: Country, Grade, Age */}
              <EducationFields value={regEdu} onChange={setRegEdu} />

              {/* Institution (optional) */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <School className="w-3.5 h-3.5 text-indigo-400" />
                  School or University (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Stanford University, Lincoln High, or Self-Taught"
                  value={regInstitution}
                  onChange={e => setRegInstitution(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900/80 border border-white/[0.1] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Guest Data Migration Toggle */}
              {hasGuestData && (
                <div className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                      Guest Study Progress Detected
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      {guestSummary.deckCount} decks • {guestSummary.cardCount} cards
                    </span>
                  </div>
                  <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={migrateGuestData}
                      onChange={e => setMigrateGuestData(e.target.checked)}
                      className="mt-0.5 rounded border-indigo-500/50 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span>
                      Import my current guest flashcards, decks, and FSRS memory stats into this new account
                    </span>
                  </label>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isRegistering}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isRegistering ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Create Free Private Account</span>
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => { setTab('login'); setLoginError(null); setGoogleError(null); }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
                >
                  Already have an account? Log in here →
                </button>
              </div>
            </form>
          </div>
        )}

          {/* TAB GOOGLE SETUP: FIRST TIME GOOGLE ONBOARDING */}
          {tab === 'google-setup' && googleProfilePending && (
            <form onSubmit={handleCompleteGoogleSetup} className="space-y-4">
              {googleError && (
                <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5 animate-shake">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{googleError}</span>
                </div>
              )}

              {/* Verified Google Account Banner */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-purple-950/30 border border-blue-500/30 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-white/[0.08] border border-white/[0.12] flex items-center justify-center text-xl shrink-0 overflow-hidden">
                    {googleProfilePending.pictureUrl ? (
                      <img src={googleProfilePending.pictureUrl} alt={googleProfilePending.name} className="w-full h-full object-cover" />
                    ) : (
                      <GoogleIcon className="w-6 h-6" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                      <span>{googleProfilePending.name}</span>
                      <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1 font-mono">
                        <CheckCircle2 className="w-2.5 h-2.5 text-blue-400" />
                        Verified Google
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">{googleProfilePending.email}</div>
                  </div>
                </div>
              </div>

              {/* Contextual Notice */}
              <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.08] text-xs text-slate-300 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed text-slate-400 text-[11px]">
                  One last step! Gemini AI customizes flashcard depth, vocabulary, and exam topics based on your country and grade curriculum.
                </span>
              </div>

              {/* Educational Level Selection */}
              <EducationFields value={googleEdu} onChange={setGoogleEdu} title="Target Grade & Educational System"
                customGradePlaceholder="e.g. 4th Grade, University Sophomore, or AP Scholar" />

              {/* Guest Data Migration Toggle */}
              {hasGuestData && (
                <div className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                      Guest Study Progress Detected
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      {guestSummary.deckCount} decks • {guestSummary.cardCount} cards
                    </span>
                  </div>
                  <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={googleMigrateGuestData}
                      onChange={e => setGoogleMigrateGuestData(e.target.checked)}
                      className="mt-0.5 rounded border-indigo-500/50 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span>
                      Import my current guest flashcards, decks, and FSRS memory stats into this Google account
                    </span>
                  </label>
                </div>
              )}

              {/* Submit & Cancel Buttons */}
              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setGoogleProfilePending(null);
                    setTab('login');
                  }}
                  className="py-3 px-4 rounded-xl bg-slate-900 text-slate-300 hover:text-white border border-white/[0.08] text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isGoogleLoading}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isGoogleLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Complete & Start Studying ✨</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: USER PROFILE & STATS */}
          {tab === 'profile' && currentUser && (
            <div className="space-y-5">
              {/* Profile Card Header */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-purple-950/30 to-slate-900 border border-indigo-500/30 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-3xl shadow-inner overflow-hidden">
                    {currentUser.pictureUrl ? (
                      <img src={currentUser.pictureUrl} alt={currentUser.name} className="w-full h-full object-cover" />
                    ) : (
                      currentUser.avatar
                    )}
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white flex items-center gap-2 flex-wrap">
                      <span>{currentUser.name}</span>
                      {currentUser.provider === 'google' && (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-white text-slate-900 flex items-center gap-1 shadow-sm">
                          <GoogleIcon className="w-3 h-3" />
                          <span>Google</span>
                        </span>
                      )}
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5">
                        <span>{EducationCatalog.getCountry(currentUser.country).flag}</span>
                        <span>{currentUser.grade} • Age {currentUser.age}</span>
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">{currentUser.email}</p>
                    <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <Globe className="w-3 h-3 text-indigo-400 shrink-0" />
                      <span>{currentUser.country} ({EducationCatalog.getCountry(currentUser.country).systemName})</span>
                    </p>
                    {currentUser.institution && (
                      <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <School className="w-3 h-3 text-slate-500" />
                        {currentUser.institution}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setTab('edit')}
                  className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-slate-300 hover:text-white transition-all text-xs flex items-center gap-1.5 cursor-pointer"
                  title="Edit Profile"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Edit</span>
                </button>
              </div>

              {/* Study Stats Matrix */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-2xl bg-slate-900/80 border border-white/[0.08] space-y-1">
                  <div className="flex items-center gap-1.5 text-amber-400 text-xs font-semibold">
                    <Coins className="w-3.5 h-3.5" />
                    <span>Study Wallet</span>
                  </div>
                  <div className="text-sm font-bold text-white truncate">🪙 {lifeSimService.getWalletBalance()} Tokens</div>
                  <div className="text-[11px] text-slate-500">Study wage balance</div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-900/80 border border-white/[0.08] space-y-1">
                  <div className="flex items-center gap-1.5 text-amber-400 text-xs font-semibold">
                    <Flame className="w-3.5 h-3.5 fill-amber-400" />
                    <span>Streak</span>
                  </div>
                  <div className="text-sm font-bold text-white">{currentStats.currentStreak} Days</div>
                  <div className="text-[11px] text-slate-500">Active consistency</div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-900/80 border border-white/[0.08] space-y-1">
                  <div className="flex items-center gap-1.5 text-indigo-400 text-xs font-semibold">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Total Time</span>
                  </div>
                  <div className="text-sm font-bold text-white">{currentStats.totalStudyMinutes}m</div>
                  <div className="text-[11px] text-slate-500">Deep study focus</div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-900/80 border border-white/[0.08] space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
                    <Layers className="w-3.5 h-3.5" />
                    <span>Retention</span>
                  </div>
                  <div className="text-sm font-bold text-white">{Math.round((currentStats.targetRetention || 0.90) * 100)}%</div>
                  <div className="text-[11px] text-slate-500">FSRS Target rate</div>
                </div>
              </div>

              {/* Data & Security Assurance */}
              <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-xs text-slate-400 space-y-1.5">
                <div className="flex items-center gap-2 text-slate-300 font-semibold">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Client-Side Cryptographic Security</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-500">
                  Your account password is salt-hashed with Web Crypto SHA-256. All decks, cards, and study stats are isolated in your personal browser storage space.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                <button
                  onClick={handleLogout}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/[0.1] text-slate-300 hover:text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5 text-slate-400" />
                  <span>Log Out (Switch to Guest)</span>
                </button>

                {allAccounts.length > 1 && (
                  <button
                    onClick={() => setTab('switch')}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Switch Account</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: EDIT PROFILE */}
          {tab === 'edit' && currentUser && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              {editSuccessMsg && (
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{editSuccessMsg}</span>
                </div>
              )}

              {/* Avatar selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Profile Avatar</span>
                  <span className="text-[11px] text-slate-500">Selected: {editAvatar}</span>
                </label>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {AVATAR_OPTIONS.map(av => (
                    <button
                      key={av}
                      type="button"
                      onClick={() => setEditAvatar(av)}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-all shrink-0 cursor-pointer ${
                        editAvatar === av
                          ? 'bg-indigo-600 ring-2 ring-indigo-400 scale-110 shadow-md'
                          : 'bg-slate-900 border border-white/[0.08] hover:bg-white/[0.08]'
                      }`}
                    >
                      {av}
                    </button>
                  ))}
                </div>
              </div>

              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-400" />
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900/80 border border-white/[0.1] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Educational Profile: Country, Grade, Age */}
              <EducationFields value={editEdu} onChange={setEditEdu} title="Target Grade & Educational System" />

              {/* School / Institution */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <School className="w-3.5 h-3.5 text-indigo-400" />
                  School or Institution
                </label>
                <input
                  type="text"
                  placeholder="e.g. Harvard University"
                  value={editInstitution}
                  onChange={e => setEditInstitution(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900/80 border border-white/[0.1] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setTab('profile')}
                  className="py-2.5 px-4 rounded-xl bg-slate-900 text-slate-300 hover:text-white border border-white/[0.08] text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDeleteAccount(currentUser.id)}
                    className="p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    title="Delete Account"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Delete</span>
                  </button>

                  <button
                    type="submit"
                    className="py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* TAB 5: SWITCH ACCOUNT */}
          {tab === 'switch' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">
                  Switch to Another Profile
                </span>
                <button
                  onClick={() => {
                    setTab('register');
                    setRegError(null);
                  }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add another account</span>
                </button>
              </div>

              <div className="space-y-2">
                {allAccounts.map(acc => {
                  const isCurrent = currentUser?.id === acc.id;
                  return (
                    <div
                      key={acc.id}
                      className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition-all ${
                        isCurrent
                          ? 'bg-indigo-950/40 border-indigo-500/50 ring-1 ring-indigo-500/30'
                          : 'bg-slate-900/60 border-white/[0.08] hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-xl shrink-0 overflow-hidden">
                          {acc.pictureUrl ? (
                            <img src={acc.pictureUrl} alt={acc.name} className="w-full h-full object-cover" />
                          ) : (
                            acc.avatar
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate flex items-center gap-2">
                            {acc.name}
                            {acc.provider === 'google' && (
                              <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-white text-slate-900 font-medium flex items-center gap-1 shadow-sm">
                                <GoogleIcon className="w-2.5 h-2.5" />
                                Google
                              </span>
                            )}
                            {isCurrent && (
                              <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 font-mono">
                                Active
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">{acc.email}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {!isCurrent && (
                          <button
                            onClick={() => handleSwitchAccount(acc)}
                            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                          >
                            <span>Switch</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between">
                <button
                  onClick={() => setTab('profile')}
                  className="text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  ← Back to Profile
                </button>
                <button
                  onClick={handleLogout}
                  className="text-xs text-rose-400 hover:text-rose-300 font-semibold cursor-pointer"
                >
                  Log Out to Guest Mode
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Real Google OAuth Client ID Setup Modal */}
      {isGoogleClientIdModalOpen && (
        <div 
          className="fixed inset-0 z-60 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
          onClick={() => setIsGoogleClientIdModalOpen(false)}
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
                  <p className="text-[11px] text-slate-400">
                    Sign in with your real Google account via accounts.google.com
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsGoogleClientIdModalOpen(false)}
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
                To open the real Google authentication popup, Google requires a Web Client ID from your Google Cloud Console:
              </p>
              <ol className="text-[11px] text-slate-300 space-y-1 list-decimal list-inside bg-black/30 p-2.5 rounded-xl border border-white/[0.06]">
                <li>
                  Open <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="text-indigo-400 underline hover:text-indigo-300 font-semibold">Google Cloud Credentials</a>
                </li>
                <li>Click <strong>+ Create Credentials</strong> → <strong>OAuth client ID</strong> (Web application)</li>
                <li>
                  Add Authorized JavaScript origin: <code className="px-1.5 py-0.5 rounded bg-slate-900 text-indigo-300 font-mono text-[11px] select-all">http://localhost:5173</code>
                </li>
              </ol>
            </div>

            {googleError && (
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5 animate-shake">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{googleError}</span>
              </div>
            )}

            <form onSubmit={handleSaveClientIdAndSignIn} className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 block">
                  Paste your Google Client ID
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 1234567890-abcdef.apps.googleusercontent.com"
                  value={customClientIdInput}
                  onChange={e => setCustomClientIdInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/[0.12] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono"
                />
                <span className="text-[11px] text-slate-500 block">
                  You can also save this permanently in <code className="text-slate-400">.env.local</code> as <code className="text-slate-400">VITE_GOOGLE_CLIENT_ID</code>.
                </span>
              </div>

              <div className="flex items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setIsGoogleClientIdModalOpen(false)}
                  className="py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/[0.08] text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isGoogleLoading}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isGoogleLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <GoogleIcon className="w-4 h-4" />
                      <span>Connect & Sign In</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Dialog>
  );
};
