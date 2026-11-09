"use client";

import { useState } from "react";
import Link from "next/link";
import {
  KeyRound,
  Mail,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Copy,
  Check,
  ShieldCheck,
} from "lucide-react";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
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
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function BikeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="5.5" cy="17.5" r="3.5" />
      <circle cx="18.5" cy="17.5" r="3.5" />
      <path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5-3-5h8l-2-6" />
      <path d="M5.5 17.5 9 12.5" />
    </svg>
  );
}

export function LoginForm() {
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Forgot password state
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetOtp, setResetOtp] = useState<string | null>(null);
  const [copiedOtp, setCopiedOtp] = useState(false);

  // Google Modal state
  const [googleModal, setGoogleModal] = useState(false);
  const [googleEmail, setGoogleEmail] = useState("");
  const [googleName, setGoogleName] = useState("");
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleNotFound, setGoogleNotFound] = useState(false);
  const [googleError, setGoogleError] = useState("");

  function go(target: string) {
    window.location.assign(target);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Invalid credentials. Please check your email and password.");
        setBusy(false);
        return;
      }

      if (data.redirectUrl) {
        go(data.redirectUrl);
      } else if (data.user?.platformRole === "super_admin") {
        go("/platform");
      } else if (data.orgs?.length) {
        go(`/w/${data.orgs[0].slug}`);
      } else if (data.chairStations?.length) {
        go(`/w/${data.chairStations[0].orgSlug}`);
      } else {
        go("/platform");
      }
    } catch {
      setError("Network timeout. Please check your internet connection.");
      setBusy(false);
    }
  }

  async function submitReset(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setResetError("Please enter your administrator email address.");
      return;
    }

    setResetBusy(true);
    setResetError("");
    setResetSuccess(false);
    setResetOtp(null);

    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "request",
          email: email.trim(),
          origin,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to send password reset link.");
      }

      setResetSuccess(true);
      if (data.emailOtp) {
        setResetOtp(data.emailOtp);
      }
    } catch (err: any) {
      setResetError(err.message || "Failed to send reset instructions.");
    } finally {
      setResetBusy(false);
    }
  }

  function handleCopyOtp(code: string) {
    navigator.clipboard.writeText(code);
    setCopiedOtp(true);
    setTimeout(() => setCopiedOtp(false), 2500);
  }

  async function handleGoogleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGoogleBusy(true);
    setGoogleError("");
    setGoogleNotFound(false);

    try {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: googleEmail, fullName: googleName }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setGoogleError(data.error ?? "Google authentication failed.");
        setGoogleBusy(false);
        return;
      }

      if (data.notFound) {
        setGoogleNotFound(true);
        setGoogleBusy(false);
        return;
      }

      if (data.redirectUrl) {
        go(data.redirectUrl);
      } else {
        go("/platform");
      }
    } catch {
      setGoogleError("Unable to reach authentication server.");
      setGoogleBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 flex flex-col justify-between">
      {/* Top Header */}
      <header className="h-16 flex items-center px-6 border-b border-slate-100 bg-white/90 backdrop-blur-sm sticky top-0 z-20">
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
          <span className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center shadow-sm">
            <BikeIcon className="w-4.5 h-4.5 text-white" />
          </span>
          <span className="font-bold text-slate-800 text-[15px]">RiderHub 360</span>
        </Link>
        <div className="flex-1" />
        <Link
          href="/register"
          className="text-[13px] text-emerald-700 hover:text-emerald-800 font-semibold px-3.5 py-1.5 rounded-lg border border-emerald-200 hover:bg-emerald-50 transition-all"
        >
          Register Association →
        </Link>
      </header>

      {/* Main Login Card */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-[420px]">
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/80 border border-slate-100 p-8">
            {mode === "login" ? (
              <>
                {/* Header */}
                <div className="text-center mb-7">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 mb-3.5">
                    <BikeIcon className="w-7 h-7 text-emerald-600" />
                  </div>
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Sign In</h1>
                  <p className="text-xs text-slate-500 mt-1">
                    Access your association workspace or system console
                  </p>
                </div>

                {/* Google Sign In Button */}
                <button
                  type="button"
                  onClick={() => {
                    setGoogleModal(true);
                    setGoogleError("");
                    setGoogleNotFound(false);
                  }}
                  className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 font-semibold text-sm shadow-sm transition-all mb-5"
                >
                  <GoogleIcon className="w-4.5 h-4.5 shrink-0" />
                  <span>Continue with Google</span>
                </button>

                {/* Divider */}
                <div className="relative flex items-center gap-3 mb-5">
                  <div className="flex-1 h-px bg-slate-100" />
                  <span className="text-[11.5px] uppercase tracking-wider text-slate-400 font-bold">
                    Or with email
                  </span>
                  <div className="flex-1 h-px bg-slate-100" />
                </div>

                {/* Form */}
                <form onSubmit={submit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 bg-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 transition-all"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Password
                      </label>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="text-xs text-slate-400 hover:text-slate-600 font-medium transition-colors"
                        >
                          {showPassword ? "Hide" : "Show"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMode("forgot");
                            setError("");
                            setResetError("");
                            setResetSuccess(false);
                          }}
                          className="text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:underline transition-colors"
                        >
                          Forgot password?
                        </button>
                      </div>
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••"
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 bg-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 transition-all"
                    />
                  </div>

                  {error ? (
                    <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-xs text-red-700 font-medium">
                      {error}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-sm shadow-emerald-200 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                  >
                    {busy ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        Authenticating…
                      </>
                    ) : (
                      "Sign In to Workspace →"
                    )}
                  </button>
                </form>
              </>
            ) : (
              /* Forgot Password Flow (matches welfare page) */
              <>
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 mb-3 text-emerald-600 shadow-xs">
                    <KeyRound className="w-7 h-7" />
                  </div>
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700">
                    Account Recovery
                  </p>
                  <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
                    Reset password
                  </h1>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                    Enter your administrator email address. We’ll send you a secure link and code to reset your password.
                  </p>
                </div>

                {resetSuccess ? (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-left">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <h3 className="text-xs font-bold text-emerald-900">Reset link sent!</h3>
                          <p className="mt-1 text-xs leading-relaxed text-emerald-800">
                            We’ve sent instructions and a secure reset link to{" "}
                            <strong className="text-slate-900 font-semibold">{email}</strong>.
                          </p>
                        </div>
                      </div>
                    </div>

                    {resetOtp && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-center">
                        <div className="text-[10.5px] uppercase font-bold text-slate-500 tracking-wider mb-1">
                          Your Verification Code
                        </div>
                        <div className="font-mono text-xl font-extrabold text-slate-900 tracking-widest my-1">
                          {resetOtp}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyOtp(resetOtp)}
                          className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800"
                        >
                          {copiedOtp ? (
                            <>
                              <Check className="w-3.5 h-3.5" /> Copied to clipboard!
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" /> Copy Code
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    <Link
                      href={`/reset-password?email=${encodeURIComponent(email)}`}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-sm shadow-emerald-200 transition-all flex items-center justify-center gap-2 text-sm"
                    >
                      <span>Open Dedicated Reset Password Page</span>
                      <ArrowRight className="w-4 h-4 ml-auto" />
                    </Link>

                    <button
                      type="button"
                      onClick={() => {
                        setMode("login");
                        setResetSuccess(false);
                        setResetError("");
                      }}
                      className="w-full border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 text-xs"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back to sign in
                    </button>
                  </div>
                ) : (
                  <form onSubmit={submitReset} className="space-y-4">
                    {resetError ? (
                      <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-xs text-red-700 font-medium">
                        {resetError}
                      </div>
                    ) : null}

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Administrator Email
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="email"
                          required
                          autoComplete="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="admin@yourassociation.co.ke"
                          className="w-full border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-900 bg-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 transition-all"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={resetBusy}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-sm shadow-emerald-200 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                    >
                      {resetBusy ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                          Sending link…
                        </>
                      ) : (
                        <>
                          <span>Send password reset link</span>
                          <ArrowRight className="w-4 h-4 ml-auto" />
                        </>
                      )}
                    </button>

                    <div className="flex items-center justify-between pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setMode("login");
                          setResetError("");
                        }}
                        className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        Back to sign in
                      </button>

                      <Link
                        href={`/reset-password${email ? `?email=${encodeURIComponent(email)}` : ""}`}
                        className="text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:underline"
                      >
                        Dedicated Reset Page →
                      </Link>
                    </div>
                  </form>
                )}

                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-slate-400">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Administrator access only · Protected logs
                </div>
              </>
            )}
          </div>

          {/* Bottom Card */}
          <div className="mt-6 text-center space-y-2">
            <p className="text-xs text-slate-600">
              Need to register a new welfare group?{" "}
              <Link
                href="/register"
                className="text-emerald-700 font-bold hover:underline"
              >
                Register Association
              </Link>
            </p>
          </div>
        </div>
      </main>

      {/* Google Sign In Modal */}
      {googleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 sm:p-7 relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setGoogleModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
              aria-label="Close"
            >
              ✕
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shadow-sm">
                <GoogleIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Sign In with Google</h3>
                <p className="text-xs text-slate-500">Fast sign-in & automatic association lookup</p>
              </div>
            </div>

            {googleNotFound ? (
              <div className="space-y-4 pt-2">
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
                  <div className="font-bold text-amber-950">No Association Account Found</div>
                  <p>
                    There is currently no registered association workspace linked to <b>{googleEmail}</b>.
                  </p>
                  <p className="text-amber-800">
                    You can onboard your new boda-boda association now in just 2 minutes!
                  </p>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setGoogleNotFound(false)}
                    className="flex-1 px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Try Another Email
                  </button>
                  <Link
                    href={`/register?email=${encodeURIComponent(googleEmail)}&name=${encodeURIComponent(googleName)}`}
                    className="flex-1 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold text-center shadow-sm"
                  >
                    Register Association →
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleGoogleSubmit} className="space-y-4 pt-2">
                {/* One click chip for super admin */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                    Quick Select: Super Admin
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setGoogleEmail("kuriajoe85@gmail.com");
                      setGoogleName("Joseph Kuria");
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg bg-white border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/30 text-xs transition-all flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-slate-900">kuriajoe85@gmail.com</div>
                      <div className="text-[11px] text-emerald-700 font-semibold">Super Admin (Joseph Kuria)</div>
                    </div>
                    <span className="text-emerald-600 text-xs font-bold">Select →</span>
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Google Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={googleEmail}
                    onChange={(e) => setGoogleEmail(e.target.value)}
                    placeholder="yourname@gmail.com"
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Your Full Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={googleName}
                    onChange={(e) => setGoogleName(e.target.value)}
                    placeholder="e.g., Joseph Kuria"
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
                  />
                </div>

                {googleError ? (
                  <div className="rounded-xl bg-red-50 border border-red-100 p-2.5 text-xs text-red-700 font-medium">
                    {googleError}
                  </div>
                ) : null}

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setGoogleModal(false)}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={googleBusy}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {googleBusy ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        Verifying…
                      </>
                    ) : (
                      "Continue with Google"
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="text-center py-6 text-xs text-slate-400 border-t border-slate-100 bg-white/70">
        RiderHub 360 · Boda-Boda Welfare SaaS ·{" "}
        <a href="https://welfare-delta-nine.vercel.app/" className="text-emerald-700 hover:underline">
          welfare-delta-nine.vercel.app
        </a>
      </footer>
    </div>
  );
}
