import React, { useState } from 'react';
import { UserAccountProfile } from '../types/game';
import {
  UNIFIED_PROJECT_NAME,
  CREATOR_NAME,
  emailSignUp,
  emailSignIn,
  isClientAdminEmail,
} from '../lib/firebase';
import {
  X,
  UserPlus,
  LogIn,
  ShieldCheck,
  Mail,
  Lock,
  User as UserIcon,
  LogOut,
  CloudUpload,
  CheckCircle2,
} from 'lucide-react';

interface AuthModalProps {
  onClose: () => void;
  accountProfile: UserAccountProfile | null;
  onAuthSuccess: (profile: UserAccountProfile) => void;
  onGoogleSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onSaveToCloud: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  onClose,
  accountProfile,
  onAuthSuccess,
  onGoogleSignIn,
  onSignOut,
  onSaveToCloud,
}) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'signup') {
        const profile = await emailSignUp(
          email.trim(),
          password,
          displayName.trim() || email.split('@')[0]
        );
        onAuthSuccess(profile);
      } else {
        const profile = await emailSignIn(email.trim(), password);
        onAuthSuccess(profile);
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isAdmin =
    accountProfile?.role === 'admin' ||
    isClientAdminEmail(accountProfile?.email);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl text-neutral-100">
        {/* Header */}
        <div className="px-5 py-4 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 block">
              {UNIFIED_PROJECT_NAME} · Survivor Network
            </span>
            <h2 className="text-base font-extrabold text-white">
              {accountProfile
                ? 'Survivor Account Profile'
                : mode === 'signup'
                ? 'Create Survivor Account (Sign Up)'
                : 'Survivor Account Log In'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {accountProfile ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-full bg-amber-600/20 border border-amber-500/50 flex items-center justify-center text-amber-300 font-bold text-lg shrink-0">
                  {(accountProfile.displayName || accountProfile.email)[0]?.toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white truncate">
                      {accountProfile.displayName}
                    </h3>
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                        isAdmin
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                          : 'bg-amber-950/60 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {isAdmin ? 'PROJECT ADMIN' : 'SURVIVOR'}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-neutral-400 truncate mt-0.5">
                    {accountProfile.email}
                  </p>
                  <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 mt-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>
                      Connected via{' '}
                      {accountProfile.authProvider === 'google'
                        ? 'Google OAuth & Firebase'
                        : 'Aetheria Cloud SQL Account'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  onClick={() => {
                    onSaveToCloud();
                    onClose();
                  }}
                  className="py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition"
                >
                  <CloudUpload className="w-4 h-4" />
                  <span>Sync Cloud Save Now</span>
                </button>
                <button
                  onClick={async () => {
                    await onSignOut();
                  }}
                  className="py-2.5 px-3 rounded-xl bg-neutral-800 hover:bg-rose-950/60 border border-neutral-700 hover:border-rose-500/40 text-rose-300 font-bold text-xs flex items-center justify-center gap-1.5 transition"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Mode Switch Tabs: Log In vs Sign Up */}
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-neutral-950 rounded-xl border border-neutral-800">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                  }}
                  className={`py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                    mode === 'login'
                      ? 'bg-amber-600 text-white shadow'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Log In</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setError(null);
                  }}
                  className={`py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                    mode === 'signup'
                      ? 'bg-amber-600 text-white shadow'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Sign Up</span>
                </button>
              </div>

              {error && (
                <div className="p-2.5 rounded-lg bg-rose-950/60 border border-rose-500/50 text-xs text-rose-200">
                  {error}
                </div>
              )}

              {/* Email & Password Form */}
              <form onSubmit={handleSubmit} className="space-y-3">
                {mode === 'signup' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                      Survivor Callsign / Display Name
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="e.g., Warden Kaelen"
                        className="w-full pl-9 pr-3 py-2 bg-neutral-950 border border-neutral-700 focus:border-amber-500 rounded-xl text-xs text-white outline-none"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="survivor@aetheria.org"
                      className="w-full pl-9 pr-3 py-2 bg-neutral-950 border border-neutral-700 focus:border-amber-500 rounded-xl text-xs text-white outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                    Password (min. 6 characters)
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-3 py-2 bg-neutral-950 border border-neutral-700 focus:border-amber-500 rounded-xl text-xs text-white outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-lg transition cursor-pointer"
                >
                  {mode === 'signup' ? (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>
                        {isSubmitting
                          ? 'Creating Account...'
                          : 'Create Survivor Account'}
                      </span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>
                        {isSubmitting ? 'Signing In...' : 'Log In to Aetheria'}
                      </span>
                    </>
                  )}
                </button>
              </form>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-neutral-800"></div>
                <span className="flex-shrink mx-3 text-[10px] font-mono uppercase text-neutral-500">
                  Or OAuth Single Sign-On
                </span>
                <div className="flex-grow border-t border-neutral-800"></div>
              </div>

              <button
                type="button"
                onClick={async () => {
                  await onGoogleSignIn();
                  onClose();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-neutral-100 text-neutral-900 font-bold text-xs flex items-center justify-center gap-2 shadow transition cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 48 48">
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  />
                </svg>
                <span>Continue with Google (Docs &amp; Gmail Sync)</span>
              </button>
            </>
          )}
        </div>

        {/* Footer Credit */}
        <div className="px-5 py-2.5 bg-neutral-950 border-t border-neutral-800/80 flex items-center justify-between text-[10px] text-neutral-400">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Cloud SQL + Firestore Encrypted</span>
          </span>
          <span>
            Created by <strong className="text-amber-400">{CREATOR_NAME}</strong>
          </span>
        </div>
      </div>
    </div>
  );
};
