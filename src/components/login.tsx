'use client';
import { useState, type FormEvent } from 'react';
import { 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle2, 
  Eye, 
  EyeOff, 
  HeartHandshake, 
  KeyRound, 
  LockKeyhole, 
  Mail, 
  ShieldCheck, 
  UserPlus 
} from 'lucide-react';
import { enterDemo, isSupabase, resendConfirmationEmail, resetPassword, signIn } from '@/lib/api';
import { errorMessage } from '@/lib/utils';
import { Brand } from './admin-shell';
import { InlineError, Spinner } from './ui';
import { ThemeToggle } from './theme-toggle';

export function Login({ onSuccess, initialError = '' }: { onSuccess: () => void; initialError?: string }) {
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resentMsg, setResentMsg] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  const submitLogin = async (e: FormEvent) => { 
    e.preventDefault(); 
    setError(''); 
    setResentMsg(''); 
    setLoading(true); 
    try { 
      await signIn(email.trim(), password); 
      onSuccess(); 
    } catch (e) { 
      setError(errorMessage(e)); 
    } finally { 
      setLoading(false); 
    } 
  };

  const submitReset = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setResetSuccess(false);
    setLoading(true);
    try {
      await resetPassword(email.trim());
      setResetSuccess(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const demo = async () => { 
    setError(''); 
    setLoading(true); 
    try { 
      await enterDemo(); 
      onSuccess(); 
    } catch (e) { 
      setError(errorMessage(e)); 
    } finally { 
      setLoading(false); 
    } 
  };

  const handleResend = async () => {
    if (!email) return;
    setResending(true); 
    setError(''); 
    setResentMsg('');
    try {
      await resendConfirmationEmail(email.trim());
      setResentMsg('A fresh confirmation link has been sent to ' + email.trim() + '. Please check your inbox.');
    } catch (e) { 
      setError(errorMessage(e)); 
    } finally { 
      setResending(false); 
    }
  };

  return (
    <div className="grid min-h-screen bg-slate-50 dark:bg-slate-950 lg:grid-cols-[1fr_1.1fr]">
      {/* Brand Hero Art Side */}
      <section className="login-art hidden flex-col px-12 py-12 lg:flex xl:px-16">
        <div className="relative z-10">
          <Brand light />
        </div>
        <div className="relative z-10 mt-20 max-w-md">
          <span className="eyebrow mb-5 inline-flex items-center gap-2 text-[11px] text-[#bbf7d0]">
            <HeartHandshake size={15} />BUILT ON COMMUNITY
          </span>
          <h1 className="text-[46px] font-extrabold leading-[1.2] tracking-[-2px] text-[#f0f5e9] xl:text-[54px]">
            Standing together.<br />Moving forward.
          </h1>
          <p className="mt-5 max-w-[340px] text-[15px] leading-7 text-[#cbd5e1]">
            Behind every ride is a rider.<br />Behind every rider, a community that cares.
          </p>
        </div>
        <div className="relative -mx-12 mt-6 min-h-[260px] flex-1 xl:-mx-16">
          <img 
            className="login-photo absolute inset-0" 
            src="https://images.pexels.com/photos/33757408/pexels-photo-33757408.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200" 
            alt="A motorcycle taxi rider waiting at a street-side pickup point in Nairobi, Kenya" 
          />
          <div className="absolute inset-x-12 bottom-0 flex items-center gap-2 text-[11px] font-medium text-[#cbd5e1] xl:inset-x-16">
            <span className="h-1.5 w-1.5 rounded-full bg-[#16a34a]" />
            NAIROBI, KENYA · EVERY SHILLING COUNTS
          </div>
        </div>
      </section>

      {/* Form Side - Enlarged & High Contrast */}
      <section className="flex min-h-screen flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center justify-between">
          <div className="lg:hidden">
            <Brand />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-[495px] flex-1 flex-col justify-center py-8">
          <div className="card p-8 sm:p-11 shadow-2xl">
            <span className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200/90 bg-emerald-50 text-[#167653] dark:border-slate-700 dark:bg-emerald-950/60 dark:text-emerald-400">
              {mode === 'login' ? <ShieldCheck size={24} strokeWidth={2} /> : <KeyRound size={24} strokeWidth={2} />}
            </span>

          {mode === 'login' ? (
            <>
              <p className="eyebrow mb-2 text-[11.5px] font-extrabold text-[#167653] dark:text-emerald-400">ADMIN WORKSPACE</p>
              <h2 className="text-[34px] font-extrabold tracking-tight text-slate-900 dark:text-white">Welcome back.</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Sign in to manage your association’s contributions, pickup points, and audit trail.
              </p>

              <form onSubmit={submitLogin} className="mt-8 space-y-5">
                <InlineError message={error} />
                
                {resentMsg && (
                  <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                    {resentMsg}
                  </div>
                )}

                {error.includes('Email not confirmed') && (
                  <button 
                    type="button" 
                    onClick={handleResend} 
                    disabled={resending} 
                    className="text-sm font-bold text-[#167653] underline hover:text-[#065f46] dark:text-emerald-400"
                  >
                    {resending ? 'Sending…' : 'Resend confirmation email'}
                  </button>
                )}

                <label className="block">
                  <span className="field-label">Email address</span>
                  <span className="relative block">
                    <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                    <input 
                      type="email" 
                      className="input !py-3.5 !pl-11 !text-[15px]" 
                      placeholder="admin@yourassociation.co.ke" 
                      autoComplete="username" 
                      value={email} 
                      onChange={e => setEmail(e.target.value)} 
                      required 
                      disabled={loading} 
                    />
                  </span>
                </label>

                <label className="block">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="field-label !mb-0">Password</span>
                    <a 
                      href="/reset-password"
                      className="text-xs font-bold text-[#167653] hover:underline dark:text-emerald-400"
                    >
                      Forgot password?
                    </a>
                  </div>
                  <span className="relative block">
                    <LockKeyhole size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                    <input 
                      type={visible ? 'text' : 'password'} 
                      aria-label="Password" 
                      className="input !py-3.5 !pl-11 !pr-11 !text-[15px]" 
                      placeholder="Enter your password" 
                      autoComplete="current-password" 
                      value={password} 
                      onChange={e => setPassword(e.target.value)} 
                      maxLength={200} 
                      required 
                      disabled={loading} 
                    />
                    <button 
                      type="button" 
                      className="icon-button absolute right-1.5 top-1/2 -translate-y-1/2" 
                      onClick={() => setVisible(v => !v)} 
                      aria-label={visible ? 'Hide password' : 'Show password'}
                    >
                      {visible ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </span>
                </label>

                <button className="btn btn-primary w-full !py-3.5 !min-h-[50px] !text-[15.5px] font-bold" type="submit" disabled={loading}>
                  {loading ? <Spinner label="Signing in…" /> : (
                    <>
                      Sign in to workspace
                      <ArrowRight size={18} className="ml-auto" />
                    </>
                  )}
                </button>
              </form>

              {/* Dedicated Signup Link for Other Officials */}
              <div className="mt-6 border-t border-slate-200/90 pt-5 text-center dark:border-slate-800">
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  New official or welfare committee member?
                </p>
                <a
                  href="/signup"
                  className="mt-2.5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white/90 px-4 py-2.5 text-xs font-bold text-slate-800 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <UserPlus size={15} className="text-[#167653] dark:text-emerald-400" />
                  Register official account
                </a>
              </div>

              {!isSupabase && (
                <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-800/80">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                    <HeartHandshake size={15} />Get to know your workspace
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-400">
                    Explore with sample riders and contributions. This demo is not connected to M-Pesa.
                  </p>
                  <button 
                    onClick={demo} 
                    disabled={loading} 
                    className="mt-3 flex items-center gap-2 text-xs font-bold text-[#167653] hover:underline dark:text-emerald-400"
                  >
                    Explore demo workspace<ArrowRight size={13} />
                  </button>
                </div>
              )}
            </>
          ) : (
            /* Forgot Password Inline Fallback */
            <>
              <p className="eyebrow mb-2 text-[11px] font-bold text-[#167653] dark:text-emerald-400">ACCOUNT RECOVERY</p>
              <h2 className="text-[32px] font-extrabold tracking-tight text-slate-900 dark:text-white">Reset password</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Enter your administrator email address. We’ll send you a secure link and code to reset your password.
              </p>

              {resetSuccess ? (
                <div className="mt-8 space-y-6">
                  <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-5 dark:border-emerald-800 dark:bg-emerald-950/50">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 size={22} className="mt-0.5 shrink-0 text-emerald-700 dark:text-emerald-400" />
                      <div>
                        <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-300">Reset link sent!</h3>
                        <p className="mt-1 text-xs leading-relaxed text-emerald-800 dark:text-emerald-400">
                          We’ve sent instructions and a secure reset link to <strong className="text-slate-900 dark:text-white">{email}</strong>.
                        </p>
                      </div>
                    </div>
                  </div>

                  <a
                    href="/reset-password"
                    className="btn btn-primary w-full !py-3.5 font-bold"
                  >
                    Open dedicated reset password page
                    <ArrowRight size={16} className="ml-auto" />
                  </a>

                  <button
                    type="button"
                    onClick={() => { setMode('login'); setError(''); setResetSuccess(false); }}
                    className="btn btn-secondary w-full !py-3 font-bold"
                  >
                    <ArrowLeft size={16} />
                    Back to sign in
                  </button>
                </div>
              ) : (
                <form onSubmit={submitReset} className="mt-8 space-y-5">
                  <InlineError message={error} />

                  <label className="block">
                    <span className="field-label">Administrator email</span>
                    <span className="relative block">
                      <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                      <input 
                        type="email" 
                        className="input !py-3.5 !pl-11 !text-[15px]" 
                        placeholder="admin@yourassociation.co.ke" 
                        autoComplete="email" 
                        value={email} 
                        onChange={e => setEmail(e.target.value)} 
                        required 
                        disabled={loading} 
                      />
                    </span>
                  </label>

                  <button className="btn btn-primary w-full !py-3.5 !min-h-[50px] !text-[15px] font-bold" type="submit" disabled={loading}>
                    {loading ? <Spinner label="Sending link…" /> : (
                      <>
                        Send password reset link
                        <ArrowRight size={16} className="ml-auto" />
                      </>
                    )}
                  </button>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => { setMode('login'); setError(''); }}
                      className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                      disabled={loading}
                    >
                      <ArrowLeft size={14} />
                      Back to sign in
                    </button>
                    <a
                      href="/reset-password"
                      className="text-xs font-bold text-[#167653] hover:underline dark:text-emerald-400"
                    >
                      Dedicated Reset Page →
                    </a>
                  </div>
                </form>
              )}
            </>
          )}
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <ShieldCheck size={15} className="text-[#167653] dark:text-emerald-400" />
          Administrator access only. Protected with encrypted audit logs.
        </div>
      </section>
    </div>
  );
}
