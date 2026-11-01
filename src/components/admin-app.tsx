'use client';
import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Copy, Hash, Smartphone } from 'lucide-react';
import { getSession, isSupabase, list, signOut, supabase } from '@/lib/api';
import { errorMessage, PAYBILL } from '@/lib/utils';
import type { Payment, Screen, SessionUser } from '@/lib/types';
import { usePoints } from '@/lib/use-points';
import { AdminShell, Brand, screenNames } from './admin-shell';
import { Dashboard } from './dashboard';
import { PickupPoints } from './pickup-points';
import { Members } from './members';
import { Payments } from './payments';
import { Reports } from './reports';
import { Cases } from './cases';
import { AuditLogs } from './audit-logs';
import { Login } from './login';
import { InlineError, Modal, Spinner, Toast, useQuery } from './ui';
import { Eye, EyeOff, KeyRound, LockKeyhole } from 'lucide-react';
import { updatePassword } from '@/lib/api';

const screens = Object.keys(screenNames) as Screen[];
function hashScreen(): Screen {
  const hash = window.location.hash.replace(/^#\/?/, '');
  return screens.includes(hash as Screen) ? hash as Screen : 'dashboard';
}
export function AdminApp() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const [screen, setScreen] = useState<Screen>('dashboard');
  const [options, setOptions] = useState<{ status?: string; search?: string; point?: string }>({});
  const [guide, setGuide] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [toast, setToast] = useState<{ message: string; error?: boolean; id: number } | null>(null);
  const notify = useCallback((message: string, error = false) => setToast({ message, error, id: Date.now() }), []);
  const refreshSession = useCallback(() => {
    setChecking(true);
    getSession().then(async session => {
      if (isSupabase && session) {
        const { data } = await supabase().auth.getSession();
        if (!data.session) session = null;
      }
      setUser(session); setScreen(hashScreen()); setSessionError('');
    }).catch(e => setSessionError(errorMessage(e))).finally(() => setChecking(false));
  }, []);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.location.hash.includes('type=recovery') || window.location.search.includes('type=recovery') || window.location.hash.includes('reset')) {
        window.location.href = `/reset-password${window.location.search}${window.location.hash}`;
        return;
      }
    }
    refreshSession();
    const change = () => { setScreen(hashScreen()); setOptions({}); };
    const unauthorized = () => { if (isSupabase) setUser(null); else refreshSession(); };
    window.addEventListener('hashchange', change);
    window.addEventListener('rw:unauthorized', unauthorized);
    const subscription = isSupabase ? supabase().auth.onAuthStateChange((event, session) => { 
      if (event === 'PASSWORD_RECOVERY') {
        setRecovering(true);
      }
      if (!session) setUser(null); 
    }) : null;
    return () => {
      window.removeEventListener('hashchange', change);
      window.removeEventListener('rw:unauthorized', unauthorized);
      subscription?.data.subscription.unsubscribe();
    };
  }, [refreshSession]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5500);
    return () => clearTimeout(timer);
  }, [toast]);
  const { points, loading: pointsLoading, error: pointsError, refresh: refreshPoints } = usePoints(Boolean(user));
  const summary = useQuerySummary(Boolean(user));
  const navigate = (next: Screen, nextOptions: typeof options = {}) => {
    setScreen(next); setOptions(nextOptions);
    window.history.pushState({}, '', `#/${next}`);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const logout = async () => {
    try { await signOut(); setUser(null); setOptions({}); window.history.replaceState({}, '', '/'); }
    catch (e) { notify(errorMessage(e), true); }
  };
  return <>
    {checking ? <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[#f5f8f2]"><Brand /><div className="mt-3 flex items-center gap-2 text-[11px] text-[#718466]"><span className="live-dot" />Preparing your workspace…</div></div> : !user ? <Login onSuccess={refreshSession} initialError={sessionError} /> :
      <AdminShell screen={screen} navigate={navigate} user={user} unmatched={summary.total} onLogout={logout} onGuide={() => setGuide(true)}>
        {screen === 'dashboard' && <Dashboard navigate={navigate} onGuide={() => setGuide(true)} notify={notify} />}
        {screen === 'pickup-points' && <PickupPoints points={points} pointsLoading={pointsLoading} pointsError={pointsError} refreshPoints={() => { refreshPoints(); summary.refresh(); }} notify={notify} navigate={navigate} />}
        {screen === 'members' && <Members points={points} initialPoint={options.point} refreshPoints={refreshPoints} notify={notify} />}
        {screen === 'payments' && <Payments points={points} initialStatus={options.status || 'all'} initialSearch={options.search || ''} unmatched={summary.total} refreshSummary={summary.refresh} notify={notify} />}
        {screen === 'reports' && <Reports points={points} notify={notify} />}
        {screen === 'cases' && <Cases notify={notify} />}
        {screen === 'audit' && <AuditLogs notify={notify} />}
      </AdminShell>}
    {guide && <PaymentGuide onClose={() => setGuide(false)} notify={notify} demo={user?.demo} />}
    {recovering && <SetNewPasswordModal onClose={() => setRecovering(false)} onSuccess={() => { setRecovering(false); notify('Your password was successfully updated!'); refreshSession(); }} />}
    {toast && <Toast message={toast.message} error={toast.error} onClose={() => setToast(null)} />}
  </>;
}

function SetNewPasswordModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
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
      window.history.replaceState({}, '', '/');
      onSuccess();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Set New Administrator Password" subtitle="Choose a strong new password for your administrator account" onClose={onClose}>
      <form onSubmit={submit} className="space-y-5 p-6">
        <InlineError message={error} />

        <label className="block">
          <span className="field-label">New Password (minimum 8 characters)</span>
          <span className="relative block">
            <LockKeyhole size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748b]" />
            <input
              type={visible ? 'text' : 'password'}
              className="input !py-3 !pl-10 !pr-10"
              placeholder="Enter new strong password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              minLength={8}
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

        <label className="block">
          <span className="field-label">Confirm New Password</span>
          <span className="relative block">
            <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748b]" />
            <input
              type={visible ? 'text' : 'password'}
              className="input !py-3 !pl-10"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              minLength={8}
              required
              disabled={loading}
            />
          </span>
        </label>

        <div className="flex justify-end gap-2 border-t border-[#e2e8f0] pt-4">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <Spinner label="Updating password…" /> : 'Save New Password'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function useQuerySummary(enabled: boolean) {
  const { data, refresh } = useQuery(() => enabled ? list<Payment>('payments', { status: 'unmatched', pageSize: 5 }) : Promise.resolve({ total: 0, items: [], page: 1, pageSize: 5 }), enabled ? 'unmatched-summary' : 'signed-out');
  return { total: data?.total || 0, refresh };
}
function PaymentGuide({ onClose, notify, demo }: { onClose: () => void; notify: (message: string) => void; demo?: boolean }) {
  const copy = async () => {
    try { await navigator.clipboard.writeText(`Paybill: ${PAYBILL}\nAccount: KM001#001`); notify('Payment details copied.'); }
    catch { notify(`Paybill: ${PAYBILL} · Example account: KM001#001`); }
  };
  const steps = [
    { title: 'Enter the Paybill number', detail: `Use business number ${PAYBILL}.` },
    { title: 'Use the rider’s account reference', detail: 'Pickup code + # + QR number. Keep any leading zeros in the QR number.' },
    { title: 'Enter any contribution amount', detail: 'Enter the amount in KES, confirm the details, and complete payment with your M-Pesa PIN.' },
  ];
  return <Modal title="A simple way to contribute" subtitle="Every rider has a reference. Every contribution has a place." onClose={onClose}>
    <div className="space-y-5 p-6">
      <div className="flex items-center gap-3 rounded-xl border border-[#e1e9db] bg-[#f0f6e9] p-4"><Smartphone size={29} strokeWidth={1.4} className="text-[#718b58]" /><div><p className="text-xs font-semibold text-[#5e7846]">M-Pesa → Lipa na M-Pesa → Pay Bill</p><p className="mt-1 text-[10px] text-[#829271]">No app download or member account needed.</p></div></div>
      <ol className="space-y-5">{steps.map((step, i) => <li key={step.title} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#edf4e6] text-[10px] font-bold text-[#68854e]">{i + 1}</span><div><h3 className="text-xs font-semibold text-[#5f754c]">{step.title}</h3><p className="mt-1 text-[10px] leading-5 text-[#859575]">{step.detail}</p>{i === 1 && <button onClick={copy} className="mt-2 flex items-center gap-4 rounded-md border border-[#dfe8d5] bg-[#f9fbf6] px-3 py-2 text-xs font-bold tracking-wide text-[#628342]">KM001#001<Copy size={13} /></button>}</div></li>)}</ol>
      <div className="flex gap-2 rounded-lg bg-[#fff9ee] p-3"><Hash size={16} className="shrink-0 text-[#a28b55]" /><p className="text-[10px] leading-5 text-[#9b885e]">Wrong or missing reference? The payment is kept as unmatched. An administrator can find it under Payments → Unmatched and assign it to the right member.</p></div>
      {demo && <p className="text-[10px] leading-5 text-[#87967a]">You’re exploring sample data. Real payments require the Daraja integration described in the project README.</p>}
    </div>
    <div className="flex justify-end border-t border-[#edf0ee] p-5"><button className="btn btn-primary" onClick={onClose}><CheckCircle2 size={14} />Got it</button></div>
  </Modal>;
}
