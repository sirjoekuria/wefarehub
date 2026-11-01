'use client';
import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  CheckCircle2, 
  Eye, 
  EyeOff, 
  KeyRound, 
  LockKeyhole, 
  ShieldAlert, 
  ShieldCheck, 
  Sparkles,
  Link2
} from 'lucide-react';
import { isSupabase, supabase, updatePassword } from '@/lib/api';
import { errorMessage } from '@/lib/utils';
import { Brand } from '@/components/admin-shell';
import { InlineError, Spinner } from '@/components/ui';

function ResetPasswordContent() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [manualLink, setManualLink] = useState('');
  const [showManualPaste, setShowManualPaste] = useState(false);

  // Check for recovery tokens in URL on mount
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
          const { error: exchangeErr } = await client.auth.exchangeCodeForSession(code);
          if (exchangeErr) throw exchangeErr;
          if (mounted) {
            setSessionReady(true);
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
            const { error: sessionErr } = await client.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (sessionErr) throw sessionErr;
            if (mounted) {
              setSessionReady(true);
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
              setVerifying(false);
            }
          }
        });

        // Check current session
        const { data } = await client.auth.getSession();
        if (data.session && mounted) {
          setSessionReady(true);
          setVerifying(false);
          return;
        }

        // Wait a short moment in case Supabase parses hash automatically
        setTimeout(() => {
          if (mounted && verifying) {
            setVerifying(false);
            // If neither session nor error, let user paste localhost URL if needed
            setShowManualPaste(true);
          }
        }, 1800);

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

  // Handle parsing a localhost URL pasted by user
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
        const { error: codeErr } = await client.auth.exchangeCodeForSession(code);
        if (codeErr) throw codeErr;
        setSessionReady(true);
        setShowManualPaste(false);
        return;
      }

      if (accessToken && refreshToken) {
        const { error: sessErr } = await client.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (sessErr) throw sessErr;
        setSessionReady(true);
        setShowManualPaste(false);
        return;
      }

      throw new Error('Could not find recovery tokens in the pasted URL. Please make sure you copied the full address bar.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('The two passwords do not match. Please re-enter.');
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

  return (
    <div className="flex min-h-screen flex-col justify-center px-4 py-12 sm:px-6 lg:px-8">
      {/* Brand Header */}
      <div className="mb-8 flex justify-center">
        <Brand />
      </div>

      {/* Main Elevated Card */}
      <div className="mx-auto w-full max-w-[440px]">
        <div className="card p-7 sm:p-9 shadow-2xl">
          {verifying ? (
            <div className="py-10 text-center">
              <Spinner label="Verifying recovery authorization…" />
              <p className="mt-4 text-[13px] font-medium text-[#475569]">
                Connecting secure reset session…
              </p>
            </div>
          ) : success ? (
            <div className="py-4 text-center">
              <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-[#167653] shadow-xs">
                <CheckCircle2 size={30} strokeWidth={2.2} />
              </span>
              <h2 className="text-[24px] font-extrabold tracking-[-0.8px] text-[#0f172a]">
                Password Updated!
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#475569]">
                Your administrator password has been updated securely. You can now sign in with your new credentials.
              </p>

              <a
                href="/"
                className="btn btn-primary mt-8 w-full !py-3 font-bold"
              >
                Sign in to Admin Workspace
                <ArrowRight size={16} className="ml-auto" />
              </a>
            </div>
          ) : (
            <>
              <div className="mb-6 flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-[#167653] shadow-xs">
                  <KeyRound size={22} strokeWidth={2} />
                </span>
                <div>
                  <p className="eyebrow text-[10.5px] font-extrabold text-[#167653]">
                    SECURITY RECOVERY
                  </p>
                  <h1 className="text-[22px] font-extrabold tracking-tight text-[#0f172a]">
                    Set New Password
                  </h1>
                </div>
              </div>

              <InlineError message={error} />

              {/* Notice if not session ready & show manual paste option */}
              {!sessionReady && showManualPaste && (
                <div className="mb-6 rounded-xl border border-amber-200/90 bg-amber-50/80 p-4 text-[13px] text-[#92400e]">
                  <p className="font-bold">Did your email link open http://localhost?</p>
                  <p className="mt-1 leading-relaxed text-[12px] text-[#78350f]">
                    Copy the full address from that localhost tab and paste it below to authorize this session:
                  </p>
                  <form onSubmit={handleManualLinkParse} className="mt-3 space-y-2">
                    <input
                      type="url"
                      placeholder="Paste localhost link here (http://localhost:3000/#access_token=...)"
                      value={manualLink}
                      onChange={e => setManualLink(e.target.value)}
                      className="input !py-2 !text-[12px]"
                      required
                    />
                    <button type="submit" disabled={loading} className="btn btn-secondary w-full !min-h-9 !py-1.5 !text-[12px] font-bold">
                      <Link2 size={13} />
                      Authorize with pasted link
                    </button>
                  </form>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <label className="block">
                  <span className="field-label">New Password</span>
                  <span className="relative block">
                    <LockKeyhole size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748b]" />
                    <input
                      type={visible ? 'text' : 'password'}
                      className="input !py-3 !pl-10 !pr-10"
                      placeholder="At least 8 characters"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      minLength={8}
                      required
                      disabled={loading}
                      autoComplete="new-password"
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

                <label className="block">
                  <span className="field-label">Confirm New Password</span>
                  <span className="relative block">
                    <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748b]" />
                    <input
                      type={visible ? 'text' : 'password'}
                      className="input !py-3 !pl-10"
                      placeholder="Re-enter new password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      minLength={8}
                      required
                      disabled={loading}
                      autoComplete="new-password"
                    />
                  </span>
                </label>

                <div className="space-y-1 rounded-lg bg-slate-50 p-3 text-[12px] font-medium text-[#475569]">
                  <div className="flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${newPassword.length >= 8 ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    <span>Minimum 8 characters</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${newPassword && newPassword === confirmPassword ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    <span>Passwords match</span>
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary w-full !py-3 font-bold"
                  disabled={loading || newPassword.length < 8 || newPassword !== confirmPassword}
                >
                  {loading ? <Spinner label="Saving password…" /> : (
                    <>
                      Save New Password
                      <ArrowRight size={16} className="ml-auto" />
                    </>
                  )}
                </button>

                <a
                  href="/"
                  className="btn btn-ghost w-full !py-2.5 font-bold text-[#475569]"
                >
                  <ArrowLeft size={15} />
                  Back to Sign In
                </a>
              </form>
            </>
          )}
        </div>

        {/* Security Footer */}
        <div className="mt-6 flex items-center justify-center gap-2 text-[11px] font-semibold text-[#475569]">
          <ShieldCheck size={14} className="text-[#167653]" />
          Protected session. Changes are logged to the immutable audit trail.
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <Spinner label="Loading reset password…" />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
