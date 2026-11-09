import Link from "next/link";
import {
  IconBike,
  IconShield,
  IconStages,
  IconIdCard,
  IconFlow,
  IconBell,
  IconArrow,
} from "@/components/icons";
import { DEPLOY_TAG } from "@/lib/identity";

const steps = [
  {
    icon: IconFlow,
    title: "Apply at their station",
    body: "Each pickup station has its own secure registration link with the association's own form.",
  },
  {
    icon: IconBike,
    title: "Chairperson recommends",
    body: "The assigned station chairperson verifies the applicant and records a recommendation — never a final approval.",
  },
  {
    icon: IconShield,
    title: "Association finalises",
    body: "An association administrator makes the final decision. Approved riders receive their membership number and card.",
  },
];

const features = [
  { icon: IconStages, title: "Stations & officials", body: "Create pickup stations, appoint one active chairperson each, generate station registration links." },
  { icon: IconIdCard, title: "Membership cards & QR", body: "Branded digital cards with verifiable QR — public verification reveals only the minimum." },
  { icon: IconBell, title: "Configurable member forms", body: "Standard fields plus association-specific fields: dropdowns, dates, uploads — versioned, never data-destroying." },
  { icon: IconShield, title: "Tenant-isolated & audited", body: "Strict organisation and station scoping enforced in the backend, with an append-only audit trail." },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-[var(--paper)] overflow-x-hidden">
      <header className="border-b border-[var(--line)] bg-white/85 backdrop-blur sticky top-0 z-40">
        <div className="mx-auto max-w-6xl px-4 sm:px-5 h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-10 h-10 rounded-xl bg-[var(--pine-deep)] text-[var(--amber)] flex items-center justify-center shrink-0">
              <IconBike className="w-6 h-6" />
            </span>
            <div className="leading-none min-w-0">
              <div className="font-display font-700 font-bold text-[17px] tracking-tight truncate">RiderHub 360</div>
              <div className="text-[10px] sm:text-[10.5px] font-semibold tracking-[0.14em] uppercase text-[var(--ink-faint)] truncate">
                Bodaboda association SaaS
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/welfare" className="rh-btn rh-btn-ghost hidden md:inline-flex text-[13px]">
              Welfare Register
            </Link>
            <Link href="/platform" className="rh-btn rh-btn-ghost hidden sm:inline-flex text-[13px]">
              Super Admin
            </Link>
            <Link href="/register" className="rh-btn rh-btn-ghost hidden lg:inline-flex text-[13px] text-emerald-800 font-bold">
              Register Association
            </Link>
            <Link href="/login" className="rh-btn rh-btn-primary">
              Sign In <IconArrow className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="mx-auto max-w-6xl px-4 sm:px-5 pt-10 sm:pt-16 pb-10 sm:pb-14 grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-10 sm:gap-12 items-center">
        <div>
          <div className="inline-flex flex-wrap items-center gap-2 rh-pill mb-5 !whitespace-normal max-w-full" style={{ background: "var(--pine-soft)", color: "var(--pine-deep)" }}>
            <span className="dot shrink-0" /> Kenya · Multi-tenant Platform · 2-in-1 Operating System
          </div>
          <h1 className="font-display text-[32px] sm:text-[44px] leading-[1.08] sm:leading-[1.06] font-bold tracking-tight text-[var(--ink)]">
            One register.
            <br />
            Every station.
            <br />
            <span className="text-[var(--pine)]">Zero paper.</span>
          </h1>
          <p className="mt-5 text-[15.5px] text-[var(--ink-soft)] max-w-lg leading-relaxed">
            RiderHub 360 gives bodaboda associations a secure workspace for stations, membership,
            two-stage approval and digital member cards — now integrated with the Stanriders Welfare Contribution Register inside the Super Admin panel.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/register" className="rh-btn rh-btn-primary text-[14.5px]">
              Register Your Association <IconArrow className="w-4 h-4" />
            </Link>
            <Link href="/login" className="rh-btn rh-btn-outline text-[14.5px]">
              Sign In to Workspace
            </Link>
            <Link href="/welfare" className="rh-btn rh-btn-ghost text-[14.5px]">
              Welfare Contribution Register
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap gap-2 overflow-hidden">
            {["Githurai Kimwi Association", "ROCS CREW"].map((o) => (
              <span key={o} className="rh-pill !whitespace-normal bg-white border-[var(--line-strong)] text-[var(--ink-soft)]">
                <span className="dot shrink-0" style={{ background: "var(--amber)" }} /> Pilot · {o}
              </span>
            ))}
            <span className="rh-pill !whitespace-normal bg-emerald-50 border-emerald-200 text-emerald-800">
              <span className="dot shrink-0" style={{ background: "#10b981" }} /> Stanriders Welfare Hub
            </span>
          </div>
        </div>

        {/* card preview */}
        <div className="relative mt-2 lg:mt-0 overflow-hidden rounded-[28px]">
          <div
            className="absolute -inset-8 rounded-[28px] opacity-60"
            style={{ background: "radial-gradient(60% 60% at 30% 20%, #dcebe0 0%, transparent 70%)" }}
          />
          <div className="rh-member-card relative mx-auto rotate-[-2deg] hover:rotate-0 transition-transform duration-300" style={{ ["--mc-primary" as never]: "#177245", ["--mc-secondary" as never]: "#14201a", ["--mc-accent" as never]: "#F5B301" }}>
            <div className="mc-band" />
            <div className="mc-body">
              <div className="flex items-center justify-between">
                <div>
                  <div className="rh-label">Membership</div>
                  <div className="font-display font-bold text-[22px] tracking-tight text-[var(--pine-deep)]">GKA-0001</div>
                </div>
                <div className="w-[88px] h-[88px] rounded-lg bg-white border border-[var(--line)] flex items-center justify-center text-[9px] font-bold text-[var(--ink-faint)] text-center px-1">
                  QR
                  <br />
                  RIDERHUB
                </div>
              </div>
              <div className="mt-4 border-t border-[var(--line)] pt-3">
                <div className="font-bold text-[15px]">Daniel Mwangi Kamau</div>
                <div className="text-[12.5px] text-[var(--ink-soft)] mt-0.5">Kimwi Stage · Active member</div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="text-[11px] font-bold text-[var(--pine)]">Githurai Kimwi Association</div>
                <div className="text-[10px] text-[var(--ink-faint)]">Umoja Unaenza Nguvu</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2-Systems-in-1 Showcase Card */}
      <section className="mx-auto max-w-6xl px-4 sm:px-5 py-6">
        <div className="rh-card p-6 sm:p-8 bg-gradient-to-br from-[#101b14] via-[#14291e] to-[#0e3b23] text-white">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <span className="rh-pill !whitespace-normal bg-white/20 text-white font-bold text-[11px]">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" /> Unified Super Admin Architecture
              </span>
              <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight break-words">
                2 Systems in 1: RiderHub 360 + Welfare Register
              </h2>
              <p className="text-white/80 text-sm leading-relaxed break-words">
                RiderHub 360 manages multi-tenant associations, station registrations, two-stage applications, and digital QR cards. The Stanriders Welfare Contribution Register manages live M-Pesa collections, pickup points, welfare cases, and CSV/PDF reports — accessible right inside the Super Admin panel.
              </p>
            </div>
            <div className="flex flex-wrap sm:flex-nowrap gap-3 shrink-0">
              <Link href="/platform" className="rh-btn bg-[var(--amber)] text-[#101b14] hover:bg-[var(--amber)]/90 font-bold">
                Super Admin Console
              </Link>
              <Link href="/welfare" className="rh-btn bg-white/10 hover:bg-white/20 text-white font-bold border border-white/20">
                Welfare Register Direct
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[var(--line)] bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-5 py-8 sm:py-12">
          <div className="rh-label mb-6">How approval works</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {steps.map((s, i) => (
              <div key={s.title} className="rh-card p-5">
                <div className="flex items-center justify-between">
                  <span className="w-9 h-9 rounded-lg bg-[var(--pine-soft)] text-[var(--pine-deep)] flex items-center justify-center">
                    <s.icon className="w-5 h-5" />
                  </span>
                  <span className="font-display text-[26px] font-bold text-[var(--line-strong)]">0{i + 1}</span>
                </div>
                <div className="mt-3 font-bold text-[15px]">{s.title}</div>
                <div className="mt-1.5 text-[13.5px] text-[var(--ink-soft)] leading-relaxed">{s.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-5 py-10 sm:py-14">
        <div className="rh-label mb-6">Built for the whole association</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {features.map((f) => (
            <div key={f.title} className="rh-card p-5 flex gap-4 min-w-0">
              <span className="w-10 h-10 rounded-lg shrink-0 bg-[var(--amber-soft)] text-[#8a6400] flex items-center justify-center">
                <f.icon className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <div className="font-bold text-[15px]">{f.title}</div>
                <div className="mt-1 text-[13.5px] text-[var(--ink-soft)] leading-relaxed break-words">{f.body}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-[var(--line)] bg-[var(--pine-deep)] text-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-5 py-6 sm:py-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <div className="font-display font-bold text-[15px]">RiderHub 360 & Stanriders Welfare Hub</div>
            <div className="text-[12px] opacity-70 break-words">
              Multi-tenant bodaboda association management · Integrated 2-in-1 Platform
            </div>
          </div>
          <div className="text-[12px] opacity-70 break-words">
            Pilot tenants: Githurai Kimwi Association · ROCS CREW — build {DEPLOY_TAG}
          </div>
        </div>
      </footer>
    </div>
  );
}
