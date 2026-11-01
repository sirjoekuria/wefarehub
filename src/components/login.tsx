'use client';
import { useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, HeartHandshake, KeyRound, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { enterDemo, isSupabase, resendConfirmationEmail, resetPassword, signIn } from '@/lib/api';
import { errorMessage } from '@/lib/utils';
import { Brand } from './admin-shell';
import { InlineError, Spinner } from './ui';

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
    <div className="grid min-h-screen bg-white lg:grid-cols-[1fr_1fr]">
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
          <p className="mt-5 max-w-[330px] text-[14px] leading-7 text-[#cbd5e1]">
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

      {/* Form Side */}
      <section className="flex min-h-screen flex-col px-6 py-8 sm:px-12">
        <div className="lg:hidden">
          <Brand />
        </div>

        <div className="mx-auto flex w-full max-w-[380px] flex-1 flex-col justify-center py-14">
          <span className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl border border-[#cbd5e1] bg-[#f1f5f9] text-[#167653]">
            {mode === 'login' ? <ShieldCheck size={22} strokeWidth={2} /> : <KeyRound size={22} strokeWidth={2} />}
          </span>

          {mode === 'login' ? (
            <>
              <p className="eyebrow mb-2 text-[11px] font-bold text-[#167653]">ADMIN WORKSPACE</p>
              <h2 className="text-[32px] font-extrabold tracking-[-1.2px] text-[#0f172a]">Welcome back.</h2>
              <p className="mt-2 text-sm leading-6 text-[#475569]">
                Sign in to manage your association’s contributions, pickup points, and audit trail.
              </p>

              <form onSubmit={submitLogin} className="mt-8 space-y-5">
                <InlineError message={error} />
                
                {resentMsg && (
                  <div className="rounded-lg border border-[#86efac] bg-[#f0fdf4] p-3 text-sm font-semibold text-[#166534]">
                    {resentMsg}
                  </div>
                )}

                {error.includes('Email not confirmed') && (
                  <button 
                    type="button" 
                    onClick={handleResend} 
                    disabled={resending} 
                    className="text-sm font-bold text-[#167653] underline hover:text-[#065f46]"
                  >
                    {resending ? 'Sending…' : 'Resend confirmation email'}
                  </button>
                )}

                <label className="block">
                  <span className="field-label">Email address</span>
                  <span className="relative block">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748b]" />
                    <input 
                      type="email" 
                      className="input !py-3 !pl-10" 
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
                    <button 
                      type="button" 
                      onClick={() => { setMode('forgot'); setError(''); setResetSuccess(false); }}
                      className="text-[12.5px] font-bold text-[#167653] hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <span className="relative block">
                    <LockKeyhole size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748b]" />
                    <input 
                      type={visible ? 'text' : 'password'} 
                      aria-label="Password" 
                      className="input !py-3 !pl-10 !pr-10" 
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
                      {visible ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </span>
                </label>

                <button className="btn btn-primary w-full !py-3 font-bold" type="submit" disabled={loading}>
                  {loading ? <Spinner label="Signing in…" /> : (
                    <>
                      Sign in to workspace
                      <ArrowRight size={16} className="ml-auto" />
                    </>
                  )}
                </button>
              </form>

              {!isSupabase && (
                <div className="mt-7 rounded-xl border border-[#cbd5e1] bg-[#f8fafc] p-4">
                  <div className="flex items-center gap-2 text-[12px] font-bold text-[#0f172a]">
                    <HeartHandshake size={15} />Get to know your workspace
                  </div>
                  <p className="mt-1.5 text-[12px] leading-5 text-[#475569]">
                    Explore with sample riders and contributions. This demo is not connected to M-Pesa.
                  </p>
                  <button 
                    onClick={demo} 
                    disabled={loading} 
                    className="mt-3 flex items-center gap-2 text-[12px] font-bold text-[#167653] hover:underline"
                  >
                    Explore demo workspace<ArrowRight size={13} />
                  </button>
                </div>
              )}
            </>
          ) : (
            /* Forgot Password Mode */
            <>
              <p className="eyebrow mb-2 text-[11px] font-bold text-[#167653]">ACCOUNT RECOVERY</p>
              <h2 className="text-[30px] font-extrabold tracking-[-1.2px] text-[#0f172a]">Reset password</h2>
              <p className="mt-2 text-sm leading-6 text-[#475569]">
                Enter your administrator email address. We’ll send you a secure link to reset your password.
              </p>

              {resetSuccess ? (
                <div className="mt-8 space-y-6">
                  <div className="rounded-xl border border-[#86efac] bg-[#f0fdf4] p-5">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 size={22} className="mt-0.5 shrink-0 text-[#166534]" />
                      <div>
                        <h3 className="text-sm font-bold text-[#166534]">Reset link sent!</h3>
                        <p className="mt-1 text-xs leading-relaxed text-[#15803d]">
                          We’ve sent instructions and a secure reset link to <strong className="text-[#0f172a]">{email}</strong>. Please check your inbox and spam folder.
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => { setMode('login'); setError(''); setResetSuccess(false); }}
                    className="btn btn-primary w-full !py-3 font-bold"
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
                      <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748b]" />
                      <input 
                        type="email" 
                        className="input !py-3 !pl-10" 
                        placeholder="admin@yourassociation.co.ke" 
                        autoComplete="email" 
                        value={email} 
                        onChange={e => setEmail(e.target.value)} 
                        required 
                        disabled={loading} 
                      />
                    </span>
                  </label>

                  <button className="btn btn-primary w-full !py-3 font-bold" type="submit" disabled={loading}>
                    {loading ? <Spinner label="Sending link…" /> : (
                      <>
                        Send password reset link
                        <ArrowRight size={16} className="ml-auto" />
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setMode('login'); setError(''); }}
                    className="btn btn-ghost w-full !py-2.5 font-bold text-[#334155]"
                    disabled={loading}
                  >
                    <ArrowLeft size={15} />
                    Back to sign in
                  </button>
                </form>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-center gap-2 text-[11px] font-semibold text-[#64748b]">
          <ShieldCheck size={14} className="text-[#167653]" />
          Administrator access only. Protected with encrypted audit logs.
        </div>
      </section>
    </div>
  );
}
