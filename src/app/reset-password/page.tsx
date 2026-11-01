'use client';
import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle2, 
  Eye, 
  EyeOff, 
  HelpCircle,
  KeyRound, 
  LockKeyhole, 
  Mail, 
  ShieldCheck, 
  Sparkles,
  Link2,
  Copy,
  Check,
  AlertCircle
} from 'lucide-react';
import { isSupabase, supabase, updatePassword } from '@/lib/api';
import { errorMessage } from '@/lib/utils';
import { Brand } from '@/components/admin-shell';
import { InlineError, Spinner } from '@/components/ui';
import { ThemeToggle } from '@/components/theme-toggle';

function ResetPasswordContent() {
  const [activeTab, setActiveTab] = useState<'request' | 'verify_otp' | 'paste_url'>('request');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
  const [manualLink, setManualLink] = useState('');
  const [showLocalhostHelp, setShowLocalhostHelp] = useState(false);
  const [copiedOtp, setCopiedOtp] = useState(false);

  // Check URL for recovery tokens or session on mount
  useEffect(() => {
    let mounted = true;

    async function initRecovery() {
      if (!isSupabase) {
        setSessionReady(true);
        setVerifying(false);
        return;
      }

      try {
        const client = supabase();
        const hash = typeof window !== 'undefined' ? window.location.hash : '';
        const search = typeof window !== 'undefined' ? window.location.search : '';

        // Check for error in hash or search
        if (hash.includes('error=') || search.includes('error=')) {
          const params = new URLSearchParams(hash.replace(/^#/, '') || search.replace(/^\?/, ''));
          const desc = params.get('error_description') || 'This password reset link is invalid or has expired.';
          if (mounted) {
            setError(decodeURIComponent(desc.replace(/\+/g, ' ')));
            setVerifying(false);
          }
          return;
        }

        // Check for PKCE flow code in search query
        const searchParams = new URLSearchParams(search);
        const code = searchParams.get('code');
        if (code) {
          const { data, error: exchangeErr } = await client.auth.exchangeCodeForSession(code);
          if (exchangeErr) throw exchangeErr;
          if (mounted) {
            setSessionReady(true);
            setUserEmail(data.user?.email || '');
            setVerifying(false);
          }
          return;
        }

        // Check for hash parameters (access_token & refresh_token)
        if (hash.includes('access_token=') && hash.includes('type=recovery')) {
          const hashParams = new URLSearchParams(hash.replace(/^#/, ''));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');

          if (accessToken && refreshToken) {
            const { data, error: sessionErr } = await client.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (sessionErr) throw sessionErr;
            if (mounted) {
              setSessionReady(true);
              setUserEmail(data.user?.email || '');
              setVerifying(false);
            }
            return;
          }
        }

        // Listen for Supabase recovery auth event
        const { data: authListener } = client.auth.onAuthStateChange(async (event, session) => {
          if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
            if (mounted) {
              setSessionReady(true);
              setUserEmail(session?.user?.email || '');
              setVerifying(false);
            }
          }
        });

        // Check current session
        const { data } = await client.auth.getSession();
        if (data.session && mounted) {
          setSessionReady(true);
          setUserEmail(data.session.user?.email || '');
          setVerifying(false);
          return;
        }

        // Finish verifying after 800ms
        setTimeout(() => {
          if (mounted && verifying) {
            setVerifying(false);
          }
        }, 800);

        return () => {
          authListener.subscription.unsubscribe();
        };
      } catch (err) {
        if (mounted) {
          setError(errorMessage(err));
          setVerifying(false);
        }
      }
    }

    initRecovery();

    return () => {
      mounted = false;
    };
  }, []);

  // Handle requesting a reset link & OTP code
  const handleRequestReset = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError('');
    setLoading(true);
    setRequestSent(false);
    setGeneratedOtp(null);

    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request', email: email.trim(), origin }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to request reset link.');

      setRequestSent(true);
      if (data.emailOtp) {
        setGeneratedOtp(data.emailOtp);
        setOtpCode(data.emailOtp);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Handle verifying OTP and setting password directly
  const handleVerifyOtpAndReset = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Please provide your official email address.');
      return;
    }
    if (!otpCode.trim()) {
      setError('Please enter the 6 or 8-digit verification code.');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify-and-update',
          email: email.trim(),
          otp: otpCode.trim(),
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update password.');

      setSuccess(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Handle parsing pasted localhost address
  const handleManualLinkParse = async (e: FormEvent) => {
    e.preventDefault();
    if (!manualLink.trim()) return;
    setError('');
    setLoading(true);

    try {
      const urlStr = manualLink.trim();
      const hashPart = urlStr.includes('#') ? urlStr.split('#')[1] : '';
      const queryPart = urlStr.includes('?') ? urlStr.split('?')[1]?.split('#')[0] : '';

      const hashParams = new URLSearchParams(hashPart);
      const queryParams = new URLSearchParams(queryPart);

      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const code = queryParams.get('code');

      const client = supabase();

      if (code) {
        const { data, error: codeErr } = await client.auth.exchangeCodeForSession(code);
        if (codeErr) throw codeErr;
        setSessionReady(true);
        setUserEmail(data.user?.email || '');
        return;
      }

      if (accessToken && refreshToken) {
        const { data, error: sessErr } = await client.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (sessErr) throw sessErr;
        setSessionReady(true);
        setUserEmail(data.user?.email || '');
        return;
      }

      throw new Error('Could not find recovery tokens in the pasted address. Please make sure you copied the full URL from the browser bar.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Handle submitting new password with authenticated session
  const handleSessionResetSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);

    try {
      await updatePassword(newPassword);
      setSuccess(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedOtp(true);
    setTimeout(() => setCopiedOtp(false), 2500);
  };

  return (
    <div className="flex min-h-screen flex-col justify-center px-4 py-12 sm:px-6 lg:px-8">
      {/* Top Controls */}
      <div className="mx-auto mb-6 flex w-full max-w-[500px] items-center justify-between">
        <Brand />
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <a
            href="/"
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-[#167653] dark:text-slate-300 dark:hover:text-emerald-400"
          >
            <ArrowLeft size={14} />
            Back to login
          </a>
        </div>
      </div>

      {/* Main Elevated Card */}
      <div className="mx-auto w-full max-w-[500px]">
        <div className="card p-8 sm:p-10 shadow-2xl">
          {verifying ? (
            <div className="py-12 text-center">
              <Spinner label="Verifying recovery authorization…" />
              <p className="mt-4 text-xs font-medium text-slate-500 dark:text-slate-400">
                Checking secure reset credentials…
              </p>
            </div>
          ) : success ? (
            /* SUCCESS STATE */
            <div className="py-6 text-center">
              <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-300 bg-emerald-50 text-[#167653] shadow-md dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                <CheckCircle2 size={36} strokeWidth={2.2} />
              </span>
              <h2 className="text-[26px] font-extrabold tracking-tight text-slate-900 dark:text-white">
                Password Updated!
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Your administrator password has been updated securely. You can now log into your workspace with your new password.
              </p>

              <a
                href="/"
                className="btn btn-primary mt-8 w-full !py-3.5 font-bold !text-[15px]"
              >
                Sign in to Admin Workspace
                <ArrowRight size={17} className="ml-auto" />
              </a>
            </div>
          ) : sessionReady ? (
            /* SESSION READY: DIRECT NEW PASSWORD FORM */
            <div>
              <div className="mb-6 flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-300 bg-emerald-50 text-[#167653] shadow-xs dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  <KeyRound size={24} strokeWidth={2} />
                </span>
                <div>
                  <p className="eyebrow text-[11px] font-extrabold text-[#167653] dark:text-emerald-400">
                    AUTHORIZED SESSION
                  </p>
                  <h1 className="text-[23px] font-extrabold tracking-tight text-slate-900 dark:text-white">
                    Set New Password
                  </h1>
                </div>
              </div>

              {userEmail && (
                <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300">
                  Updating password for account: <strong className="text-slate-900 dark:text-white">{userEmail}</strong>
                </div>
              )}

              <InlineError message={error} />

              <form onSubmit={handleSessionResetSubmit} className="mt-5 space-y-5">
                <label className="block">
                  <span className="field-label">New Password</span>
                  <span className="relative block">
                    <LockKeyhole size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                    <input
                      type={visible ? 'text' : 'password'}
                      className="input !py-3 !pl-10 !pr-10"
                      placeholder="At least 8 characters"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      minLength={8}
                      required
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setVisible(v => !v)}
                      className="icon-button absolute right-1.5 top-1/2 -translate-y-1/2"
                      aria-label={visible ? 'Hide password' : 'Show password'}
                    >
                      {visible ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </span>
                </label>

                <label className="block">
                  <span className="field-label">Confirm New Password</span>
                  <span className="relative block">
                    <LockKeyhole size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                    <input
                      type={visible ? 'text' : 'password'}
                      className="input !py-3 !pl-10"
                      placeholder="Re-enter your new password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      minLength={8}
                      required
                      disabled={loading}
                    />
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary w-full !py-3.5 font-bold !text-[15px]"
                >
                  {loading ? <Spinner label="Updating password…" /> : (
                    <>
                      Save New Password
                      <ArrowRight size={17} className="ml-auto" />
                    </>
                  )}
                </button>
              </form>
            </div>
          ) : (
            /* TABBED RECOVERY MODES */
            <div>
              <div className="mb-6 flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-300 bg-emerald-50 text-[#167653] shadow-xs dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  <KeyRound size={24} strokeWidth={2} />
                </span>
                <div>
                  <p className="eyebrow text-[11px] font-extrabold text-[#167653] dark:text-emerald-400">
                    ACCOUNT RECOVERY PORTAL
                  </p>
                  <h1 className="text-[24px] font-extrabold tracking-tight text-slate-900 dark:text-white">
                    Reset Admin Password
                  </h1>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="mb-6 grid grid-cols-2 rounded-xl border border-slate-200/90 bg-slate-100/90 p-1 dark:border-slate-700 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => { setActiveTab('request'); setError(''); }}
                  className={`rounded-lg py-2 text-xs font-bold transition-all ${
                    activeTab === 'request'
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  1. Request Reset
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveTab('verify_otp'); setError(''); }}
                  className={`rounded-lg py-2 text-xs font-bold transition-all ${
                    activeTab === 'verify_otp' || activeTab === 'paste_url'
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  2. Enter Code / Link
                </button>
              </div>

              <InlineError message={error} />

              {/* TAB 1: REQUEST RESET LINK & CODE */}
              {activeTab === 'request' && (
                <div>
                  {requestSent ? (
                    <div className="space-y-5">
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 p-5 dark:border-emerald-800 dark:bg-emerald-950/40">
                        <div className="flex items-start gap-3">
                          <CheckCircle2 size={22} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          <div>
                            <h3 className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                              Reset Code & Link Dispatched!
                            </h3>
                            <p className="mt-1 text-xs leading-relaxed text-emerald-700 dark:text-emerald-400">
                              Instructions have been sent to <strong className="text-slate-900 dark:text-white">{email}</strong>.
                            </p>

                            {generatedOtp && (
                              <div className="mt-3.5 rounded-lg border border-emerald-300 bg-white p-3 dark:border-emerald-700 dark:bg-slate-900">
                                <span className="block text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                  Your direct verification OTP code:
                                </span>
                                <div className="mt-1 flex items-center justify-between">
                                  <span className="font-mono text-xl font-extrabold tracking-widest text-[#167653] dark:text-emerald-400">
                                    {generatedOtp}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => copyCode(generatedOtp)}
                                    className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                  >
                                    {copiedOtp ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                                    {copiedOtp ? 'Copied' : 'Copy'}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('verify_otp');
                          setError('');
                        }}
                        className="btn btn-primary w-full !py-3.5 font-bold"
                      >
                        Proceed to enter code & set new password
                        <ArrowRight size={16} className="ml-auto" />
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleRequestReset} className="space-y-5">
                      <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                        Enter your administrator email address below to receive an instant verification code and password reset instructions.
                      </p>

                      <label className="block">
                        <span className="field-label">Administrator Email</span>
                        <span className="relative block">
                          <Mail size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                          <input
                            type="email"
                            className="input !py-3.5 !pl-10 !text-[15px]"
                            placeholder="e.g. kuriajoe85@gmail.com"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                            disabled={loading}
                          />
                        </span>
                      </label>

                      <button
                        type="submit"
                        disabled={loading}
                        className="btn btn-primary w-full !py-3.5 font-bold !text-[15px]"
                      >
                        {loading ? <Spinner label="Sending reset request…" /> : (
                          <>
                            Send Reset Code & Link
                            <ArrowRight size={17} className="ml-auto" />
                          </>
                        )}
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* TAB 2: VERIFY CODE OR PASTE LOCALHOST LINK */}
              {(activeTab === 'verify_otp' || activeTab === 'paste_url') && (
                <div className="space-y-6">
                  {/* Sub-toggle */}
                  <div className="flex gap-2 border-b border-slate-200 pb-2 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setActiveTab('verify_otp')}
                      className={`text-xs font-bold ${
                        activeTab === 'verify_otp'
                          ? 'text-[#167653] underline dark:text-emerald-400'
                          : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                      }`}
                    >
                      Option A: Enter 8-digit Code
                    </button>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('paste_url')}
                      className={`text-xs font-bold ${
                        activeTab === 'paste_url'
                          ? 'text-[#167653] underline dark:text-emerald-400'
                          : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                      }`}
                    >
                      Option B: Paste Localhost Link
                    </button>
                  </div>

                  {activeTab === 'verify_otp' ? (
                    /* VERIFY CODE FORM */
                    <form onSubmit={handleVerifyOtpAndReset} className="space-y-4">
                      <label className="block">
                        <span className="field-label">Administrator Email</span>
                        <input
                          type="email"
                          className="input !py-2.5"
                          placeholder="admin@yourassociation.co.ke"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          required
                          disabled={loading}
                        />
                      </label>

                      <label className="block">
                        <span className="field-label">Verification Code (OTP)</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          className="input font-mono !py-2.5 tracking-wider text-base"
                          placeholder="e.g. 86226492"
                          value={otpCode}
                          onChange={e => setOtpCode(e.target.value)}
                          required
                          disabled={loading}
                        />
                      </label>

                      <label className="block">
                        <span className="field-label">New Password</span>
                        <span className="relative block">
                          <input
                            type={visible ? 'text' : 'password'}
                            className="input !py-2.5 !pr-10"
                            placeholder="At least 8 characters"
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            minLength={8}
                            required
                            disabled={loading}
                          />
                          <button
                            type="button"
                            onClick={() => setVisible(v => !v)}
                            className="icon-button absolute right-1.5 top-1/2 -translate-y-1/2"
                            aria-label={visible ? 'Hide password' : 'Show password'}
                          >
                            {visible ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </span>
                      </label>

                      <label className="block">
                        <span className="field-label">Confirm New Password</span>
                        <input
                          type={visible ? 'text' : 'password'}
                          className="input !py-2.5"
                          placeholder="Re-enter new password"
                          value={confirmPassword}
                          onChange={e => setConfirmPassword(e.target.value)}
                          minLength={8}
                          required
                          disabled={loading}
                        />
                      </label>

                      <button
                        type="submit"
                        disabled={loading}
                        className="btn btn-primary w-full !py-3.5 font-bold !text-[15px]"
                      >
                        {loading ? <Spinner label="Verifying & updating…" /> : (
                          <>
                            Verify & Set New Password
                            <ArrowRight size={16} className="ml-auto" />
                          </>
                        )}
                      </button>
                    </form>
                  ) : (
                    /* PASTE LOCALHOST LINK FORM */
                    <form onSubmit={handleManualLinkParse} className="space-y-4">
                      <div className="rounded-xl border border-amber-200/90 bg-amber-50/80 p-4 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                        <div className="flex gap-2">
                          <AlertCircle size={16} className="shrink-0 text-amber-600 dark:text-amber-400" />
                          <p className="leading-relaxed">
                            Did your password reset email open a blank <strong>http://localhost:3000</strong> tab?
                            Copy the full address URL from that tab and paste it here:
                          </p>
                        </div>
                      </div>

                      <label className="block">
                        <span className="field-label">Pasted Address Bar URL</span>
                        <input
                          type="url"
                          className="input font-mono !py-2.5 !text-xs"
                          placeholder="http://localhost:3000/#access_token=...&type=recovery"
                          value={manualLink}
                          onChange={e => setManualLink(e.target.value)}
                          required
                          disabled={loading}
                        />
                      </label>

                      <button
                        type="submit"
                        disabled={loading}
                        className="btn btn-secondary w-full !py-3 font-bold"
                      >
                        {loading ? <Spinner label="Authorizing link…" /> : (
                          <>
                            <Link2 size={16} />
                            Authorize Session from Link
                          </>
                        )}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Collapsible Supabase Site URL Configuration Guide */}
          <div className="mt-8 border-t border-slate-200/80 pt-5 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowLocalhostHelp(h => !h)}
              className="flex w-full items-center justify-between text-left text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            >
              <span className="flex items-center gap-1.5">
                <HelpCircle size={14} className="text-[#167653] dark:text-emerald-400" />
                Why does Supabase email open localhost? (Quick fix)
              </span>
              <span>{showLocalhostHelp ? '−' : '+'}</span>
            </button>

            {showLocalhostHelp && (
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300">
                <p className="font-semibold text-slate-800 dark:text-slate-100">
                  To make emails open your live production site automatically:
                </p>
                <ol className="mt-2 list-decimal space-y-1 pl-4">
                  <li>Open your <strong>Supabase Dashboard</strong> (<code className="rounded bg-slate-200 px-1 py-0.5 text-[11px] dark:bg-slate-700">zqadbcgwlxqiibnvdxis</code>).</li>
                  <li>Navigate to <strong>Authentication</strong> → <strong>URL Configuration</strong>.</li>
                  <li>Set <strong>Site URL</strong> to: <code className="rounded bg-slate-200 px-1 py-0.5 text-[11px] font-bold text-[#167653] dark:bg-slate-700 dark:text-emerald-400">https://welfare-delta-nine.vercel.app</code></li>
                  <li>In <strong>Redirect URLs</strong>, add: <code className="rounded bg-slate-200 px-1 py-0.5 text-[11px] dark:bg-slate-700">https://welfare-delta-nine.vercel.app/**</code></li>
                  <li>Click <strong>Save</strong>. Future password reset emails will open directly on your live site!</li>
                </ol>
              </div>
            )}
          </div>
        </div>

        {/* Security badge footer */}
        <div className="mt-6 flex items-center justify-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <ShieldCheck size={15} className="text-[#167653] dark:text-emerald-400" />
          End-to-end encrypted password recovery with immutable audit logs.
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <Spinner label="Loading reset portal…" />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
