"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

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
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="5.5" cy="17.5" r="3.5" />
      <circle cx="18.5" cy="17.5" r="3.5" />
      <path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5-3-5h8l-2-6" />
      <path d="M5.5 17.5 9 12.5" />
    </svg>
  );
}

const KENYAN_COUNTIES = [
  "Nairobi", "Kiambu", "Machakos", "Nakuru", "Mombasa", "Kisumu", "Kajiado",
  "Uasin Gishu", "Meru", "Nyeri", "Murang'a", "Kilifi", "Bungoma", "Kakamega",
  "Embu", "Kericho", "Bomet", "Kisii", "Kitui", "Makueni", "Laikipia", "Other"
];

const PLANS = [
  {
    code: "starter",
    name: "Starter",
    price: "KES 1,500",
    period: "/month",
    description: "Ideal for young or single-ward boda-boda associations.",
    stations: "3 Stations",
    members: "Up to 150 Members",
    popular: false,
  },
  {
    code: "growth",
    name: "Growth",
    price: "KES 3,500",
    period: "/month",
    description: "Our most popular tier for growing constituency-level welfare groups.",
    stations: "8 Stations",
    members: "Up to 600 Members",
    popular: true,
  },
  {
    code: "professional",
    name: "Professional",
    price: "KES 7,500",
    period: "/month",
    description: "For established county federations and multi-stage networks.",
    stations: "20 Stations",
    members: "Up to 2,000 Members",
    popular: false,
  },
];

function RegisterContent() {
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get("email") ?? "";
  const initialName = searchParams.get("name") ?? "";

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Association Info
  const [orgName, setOrgName] = useState("");
  const [code, setCode] = useState("");
  const [county, setCounty] = useState("Nairobi");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [motto, setMotto] = useState("");

  // Step 2: Plan Selection
  const [selectedPlan, setSelectedPlan] = useState("growth");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");

  // Step 3: Admin Account
  const [adminName, setAdminName] = useState(initialName);
  const [adminEmail, setAdminEmail] = useState(initialEmail);
  const [adminPassword, setAdminPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Auto-generate code when orgName changes if code is untouched
  function handleOrgNameChange(val: string) {
    setOrgName(val);
    if (!code || code.length <= 4) {
      const generated = val
        .split(/\s+/)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 5);
      if (generated) setCode(generated);
    }
  }

  function validateStep1() {
    if (!orgName.trim() || orgName.trim().length < 3) {
      setError("Please enter your association's full official name.");
      return false;
    }
    if (!code.trim()) {
      setError("Please provide a short abbreviation/code (e.g., ROCS, GKA).");
      return false;
    }
    setError("");
    return true;
  }

  function validateStep2() {
    setError("");
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!adminName.trim()) {
      setError("Please enter the administrator's full name.");
      return;
    }
    if (!adminEmail.trim() || !adminEmail.includes("@")) {
      setError("Please enter a valid administrator email address.");
      return;
    }
    if (!adminPassword || adminPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const res = await fetch("/api/org/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgName,
          code,
          county,
          location,
          phone,
          registrationNumber,
          motto,
          planCode: selectedPlan,
          billingCycle,
          adminName,
          adminEmail,
          adminPassword,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Registration could not be completed.");
      }

      // Success: redirect to newly created association workspace
      if (data.redirectUrl) {
        window.location.assign(data.redirectUrl);
      } else {
        window.location.assign("/login");
      }
    } catch (err: any) {
      setError(err.message || "Failed to register association.");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 flex flex-col">
      {/* Top bar */}
      <header className="h-16 flex items-center px-6 border-b border-slate-100 bg-white/90 backdrop-blur-sm sticky top-0 z-30">
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
          <span className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center shadow-sm">
            <BikeIcon className="w-4.5 h-4.5 text-white" />
          </span>
          <span className="font-bold text-slate-800 text-[15px]">RiderHub 360</span>
        </Link>
        <div className="flex-1" />
        <div className="flex items-center gap-3">
          <span className="text-[13px] text-slate-500 hidden sm:inline">Already registered?</span>
          <Link
            href="/login"
            className="text-[13px] text-emerald-700 hover:text-emerald-800 font-semibold px-3.5 py-1.5 rounded-lg border border-emerald-200 hover:bg-emerald-50 transition-all"
          >
            Sign In →
          </Link>
        </div>
      </header>

      {/* Hero Header */}
      <div className="pt-8 pb-6 text-center px-4">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11.5px] font-bold bg-emerald-100 text-emerald-800 mb-3">
          Multi-Tenant SaaS Onboarding
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Register Your Boda-Boda Association
        </h1>
        <p className="text-sm text-slate-500 mt-1.5 max-w-lg mx-auto">
          Deploy a dedicated, branded welfare management workspace with pickup stations, digital IDs, and M-Pesa collections.
        </p>
      </div>

      {/* Progress Steps */}
      <div className="max-w-2xl mx-auto w-full px-4 mb-6">
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setStep(1)}
            className={`p-3 rounded-xl border text-left transition-all ${
              step === 1
                ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20"
                : step > 1
                ? "bg-white text-emerald-700 border-emerald-200"
                : "bg-white/60 text-slate-400 border-slate-200"
            }`}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">Step 1</div>
            <div className="text-xs sm:text-sm font-bold truncate">Association Profile</div>
          </button>

          <button
            type="button"
            onClick={() => validateStep1() && setStep(2)}
            className={`p-3 rounded-xl border text-left transition-all ${
              step === 2
                ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20"
                : step > 2
                ? "bg-white text-emerald-700 border-emerald-200"
                : "bg-white/60 text-slate-400 border-slate-200"
            }`}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">Step 2</div>
            <div className="text-xs sm:text-sm font-bold truncate">Plan & Capacity</div>
          </button>

          <button
            type="button"
            onClick={() => validateStep1() && validateStep2() && setStep(3)}
            className={`p-3 rounded-xl border text-left transition-all ${
              step === 3
                ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20"
                : "bg-white/60 text-slate-400 border-slate-200"
            }`}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">Step 3</div>
            <div className="text-xs sm:text-sm font-bold truncate">Admin & Launch</div>
          </button>
        </div>
      </div>

      {/* Form Card Container */}
      <main className="flex-1 flex justify-center px-4 pb-16">
        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl shadow-slate-200/80 border border-slate-100 p-6 sm:p-8">
          {error ? (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700 font-medium">
              {error}
            </div>
          ) : null}

          {/* STEP 1: ASSOCIATION DETAILS */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Association Details</h2>
                <p className="text-xs text-slate-500">Provide official details about your welfare group or union.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Association Official Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={orgName}
                    onChange={(e) => handleOrgNameChange(e.target.value)}
                    placeholder="e.g., Karen Boda-Boda Welfare Association"
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Short Code (Prefix) *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={8}
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      placeholder="e.g., KBWA"
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 font-mono uppercase bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
                    />
                    <span className="text-[11px] text-slate-400 mt-1 block">Used for member numbers (e.g. {code || "KBWA"}-0001)</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      County *
                    </label>
                    <select
                      value={county}
                      onChange={(e) => setCounty(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
                    >
                      {KENYAN_COUNTIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Base Sub-County / Location
                    </label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g., Langata / Karen Crossroads"
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Official Contact Phone
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0712 345 678"
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Registration / Certificate No. (Optional)
                    </label>
                    <input
                      type="text"
                      value={registrationNumber}
                      onChange={(e) => setRegistrationNumber(e.target.value)}
                      placeholder="e.g., SOC/12345/2026"
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Motto / Slogan
                    </label>
                    <input
                      type="text"
                      value={motto}
                      onChange={(e) => setMotto(e.target.value)}
                      placeholder="e.g., Unity, Security and Prosperity"
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    if (validateStep1()) setStep(2);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-sm transition-all"
                >
                  Continue to Plan Selection →
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: SELECT PLAN */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Choose Subscription Tier</h2>
                <p className="text-xs text-slate-500">Every new association receives a complimentary 14-day full access trial.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {PLANS.map((p) => {
                  const isSelected = selectedPlan === p.code;
                  return (
                    <div
                      key={p.code}
                      onClick={() => setSelectedPlan(p.code)}
                      className={`cursor-pointer rounded-2xl p-5 border-2 transition-all relative flex flex-col justify-between ${
                        isSelected
                          ? "border-emerald-600 bg-emerald-50/40 shadow-md shadow-emerald-600/10"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      {p.popular && (
                        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full shadow-sm">
                          Most Popular
                        </span>
                      )}

                      <div>
                        <div className="font-bold text-slate-900 text-base">{p.name}</div>
                        <div className="mt-2 flex items-baseline gap-1">
                          <span className="text-xl font-extrabold text-slate-900">{p.price}</span>
                          <span className="text-xs text-slate-500">{p.period}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-2">{p.description}</p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 text-xs font-semibold space-y-1.5 text-slate-700">
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                          <span>{p.stations}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                          <span>{p.members}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-800">Billing Cycle</div>
                  <div className="text-[11px] text-slate-500">Pay monthly or get 2 months free with annual billing</div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setBillingCycle("monthly")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      billingCycle === "monthly" ? "bg-white text-slate-900 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingCycle("annual")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      billingCycle === "annual" ? "bg-white text-slate-900 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    Annual (Save 17%)
                  </button>
                </div>
              </div>

              <div className="pt-2 flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800"
                >
                  ← Back to Details
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-sm transition-all"
                >
                  Continue to Admin Setup →
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: ADMIN ACCOUNT */}
          {step === 3 && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Administrator Credentials</h2>
                <p className="text-xs text-slate-500">
                  This user will have full ownership access to configure stages, officials, and digital IDs.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Administrator Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="e.g., John Kariuki Mwangi"
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Official Admin Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="chair@association.co.ke"
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    You will use this email or your linked Google account to sign in.
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Create Password *
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
                  />
                </div>
              </div>

              {/* Summary box */}
              <div className="rounded-xl bg-emerald-50/60 border border-emerald-100 p-4 text-xs text-emerald-950 space-y-1">
                <div className="font-bold text-emerald-900">Summary of New Workspace:</div>
                <div>• Association: <b>{orgName || "Not set"}</b> ({code || "---"})</div>
                <div>• Plan: <b>{PLANS.find((p) => p.code === selectedPlan)?.name}</b> (14-Day Free Trial)</div>
                <div>• County: <b>{county}</b></div>
              </div>

              <div className="pt-2 flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800"
                >
                  ← Back to Plans
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-7 py-3 rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2 disabled:opacity-50 text-sm"
                >
                  {busy ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Creating Workspace…
                    </>
                  ) : (
                    "Launch Association Workspace 🚀"
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </main>

      <footer className="text-center py-6 text-xs text-slate-400 border-t border-slate-100 bg-white">
        RiderHub 360 · Boda-Boda Welfare SaaS · Deployed at{" "}
        <a href="https://welfare-delta-nine.vercel.app/" className="text-emerald-700 hover:underline">
          welfare-delta-nine.vercel.app
        </a>
      </footer>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading…</div>}>
      <RegisterContent />
    </Suspense>
  );
}
