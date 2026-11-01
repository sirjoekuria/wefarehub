'use client';
import { useState, type FormEvent } from 'react';
import { 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle2, 
  Eye, 
  EyeOff, 
  LockKeyhole, 
  Mail, 
  Phone, 
  ShieldCheck, 
  UserCheck, 
  UserRound 
} from 'lucide-react';
import { Brand } from '@/components/admin-shell';
import { InlineError, Spinner } from '@/components/ui';
import { ThemeToggle } from '@/components/theme-toggle';

const OFFICIAL_ROLES = [
  'Treasurer',
  'Chairman',
  'Vice Chairman',
  'Secretary',
  'Assistant Secretary',
  'Organizing Secretary',
  'Operations Officer',
  'Welfare Committee Official',
  'Administrator',
];

export default function SignupPage() {
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState(OFFICIAL_ROLES[0]);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [createdName, setCreatedName] = useState('');

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (fullName.trim().length < 2) {
      setError('Please provide your full legal name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please provide a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('The two passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim(),
          role,
          phone: phone.trim(),
          email: email.trim(),
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create official account.');
      }

      setCreatedName(fullName.trim());
      setSuccess(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center px-4 py-12 sm:px-6 lg:px-8">
      {/* Top Navigation */}
      <div className="mx-auto mb-6 flex w-full max-w-[520px] items-center justify-between">
        <Brand />
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <a
            href="/"
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-[#167653] dark:text-slate-300 dark:hover:text-emerald-400"
          >
            <ArrowLeft size={14} />
            Back to sign in
          </a>
        </div>
      </div>

      {/* Main Elevated Card */}
      <div className="mx-auto w-full max-w-[520px]">
        <div className="card p-8 sm:p-10 shadow-2xl">
          {success ? (
            /* SUCCESS STATE */
            <div className="py-6 text-center">
              <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-300 bg-emerald-50 text-[#167653] shadow-md dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                <CheckCircle2 size={36} strokeWidth={2.2} />
              </span>
              <h2 className="text-[26px] font-extrabold tracking-tight text-slate-900 dark:text-white">
                Account Created!
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Welcome to ROCS CREW, <strong>{createdName}</strong>. Your official administrator credentials are now active and pre-verified.
              </p>

              <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left text-xs dark:border-slate-700 dark:bg-slate-800">
                <p className="font-semibold text-slate-700 dark:text-slate-200">Registered Details:</p>
                <div className="mt-2 space-y-1 text-slate-600 dark:text-slate-400">
                  <p>Email: <strong className="text-slate-900 dark:text-white">{email}</strong></p>
                  <p>Official Role: <strong className="text-slate-900 dark:text-white">{role}</strong></p>
                </div>
              </div>

              <a
                href="/"
                className="btn btn-primary mt-8 w-full !py-3.5 font-bold !text-[15px]"
              >
                Sign In to Workspace
                <ArrowRight size={17} className="ml-auto" />
              </a>
            </div>
          ) : (
            /* SIGNUP FORM */
            <>
              <div className="mb-6 flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-300 bg-emerald-50 text-[#167653] shadow-xs dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  <UserCheck size={24} strokeWidth={2} />
                </span>
                <div>
                  <p className="eyebrow text-[11px] font-extrabold text-[#167653] dark:text-emerald-400">
                    ASSOCIATION OFFICIALS
                  </p>
                  <h1 className="text-[24px] font-extrabold tracking-tight text-slate-900 dark:text-white">
                    Register Official Account
                  </h1>
                </div>
              </div>

              <p className="mb-6 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                Create an administrator profile for welfare officials and executives to manage riders, pickup points, and verify payments.
              </p>

              <InlineError message={error} />

              <form onSubmit={handleSignup} className="space-y-4">
                <label className="block">
                  <span className="field-label">Official Full Name</span>
                  <span className="relative block">
                    <UserRound size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                    <input
                      type="text"
                      className="input !py-3 !pl-10"
                      placeholder="e.g. Peter Kamau Mwangi"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </span>
                </label>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="field-label">Official Role</span>
                    <select
                      className="input !py-3"
                      value={role}
                      onChange={e => setRole(e.target.value)}
                      disabled={loading}
                    >
                      {OFFICIAL_ROLES.map(r => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="field-label">Phone Number</span>
                    <span className="relative block">
                      <Phone size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                      <input
                        type="tel"
                        className="input !py-3 !pl-10"
                        placeholder="07xx xxx xxx"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        disabled={loading}
                      />
                    </span>
                  </label>
                </div>

                <label className="block">
                  <span className="field-label">Email Address</span>
                  <span className="relative block">
                    <Mail size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                    <input
                      type="email"
                      className="input !py-3 !pl-10"
                      placeholder="official@yourassociation.co.ke"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </span>
                </label>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="field-label">Password</span>
                    <span className="relative block">
                      <LockKeyhole size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                      <input
                        type={visible ? 'text' : 'password'}
                        className="input !py-3 !pl-10 !pr-10"
                        placeholder="Min 8 characters"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
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
                    <span className="field-label">Confirm Password</span>
                    <span className="relative block">
                      <LockKeyhole size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                      <input
                        type={visible ? 'text' : 'password'}
                        className="input !py-3 !pl-10"
                        placeholder="Re-enter password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        minLength={8}
                        required
                        disabled={loading}
                      />
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary mt-2 w-full !py-3.5 font-bold !text-[15px]"
                >
                  {loading ? <Spinner label="Creating official profile…" /> : (
                    <>
                      Register Official Account
                      <ArrowRight size={17} className="ml-auto" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 border-t border-slate-200/80 pt-4 text-center text-xs text-slate-600 dark:border-slate-700 dark:text-slate-400">
                Already registered as an official?{' '}
                <a href="/" className="font-bold text-[#167653] hover:underline dark:text-emerald-400">
                  Sign in here
                </a>
              </div>
            </>
          )}
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <ShieldCheck size={15} className="text-[#167653] dark:text-emerald-400" />
          Protected official registration. Activity logged to audit trail.
        </div>
      </div>
    </div>
  );
}
