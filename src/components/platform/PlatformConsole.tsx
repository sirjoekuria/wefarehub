"use client";

import { AdminApp } from "@/components/admin-app";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { IconBike, IconDash, IconForm, IconShield, IconLogout, IconChevron } from "@/components/icons";
import { StatCard, Spinner, StatusPill, Modal, ErrorNote, fmtDate, fmtDateTime, fmtKes } from "@/components/rh-ui";

type Overview = {
  stats: { orgs: number; activeSubs: number; renewalDue: number; totalMembers: number; totalStations: number; revenueKes: number; pendingPayments: number };
  orgs: {
    id: number; name: string; slug: string; code: string; email: string | null; status: string;
    planName: string | null; subStatus: string; periodEnd: string | null; billingCycle: string | null;
    members: number; stations: number;
  }[];
  plans: {
    id: number; code: string; name: string; description: string | null; monthlyPriceKes: number; annualPriceKes: number;
    maxStations: number; maxMembers: number; maxAdmins: number; storageMb: number; isActive: boolean; tenants?: string[];
  }[];
  pendingPayments: { id: number; orgName: string; method: string; mpesaRef: string | null; amountKes: number; notes: string | null; createdAt: string }[];
};
type Detail = {
  org: { name: string; slug: string; status: string };
  stations: { name: string; code: string }[];
  members: { firstName: string; surname: string; membershipNumber: string | null; status: string }[];
  applications: { fullName: string; status: string }[];
  admins: { name: string; role: string }[];
  officials: { station: string; role: string; name: string; status: string }[];
};
type AuditRow = { id: number; action: string; orgName: string | null; userName: string | null; details: Record<string, unknown> | null; createdAt: string };

export function PlatformConsole({ role }: { role: string }) {
  const router = useRouter();
  const isSuper = role === "super_admin";
  const [tab, setTab] = useState<"overview" | "welfare" | "plans" | "audit">("overview");
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<{ name: string; d: Detail } | null>(null);
  const [planEdit, setPlanEdit] = useState<Overview["plans"][number] | null>(null);
  const [audit, setAudit] = useState<AuditRow[] | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/platform/overview", {
        cache: "no-store",
        credentials: "include",
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.error || !d.stats) {
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        setError(d.error ?? "Failed to load platform data.");
        setData(null);
        return;
      }
      setData(d);
      setError("");
    } catch (e: any) {
      setError(e.message || "Failed to load platform data.");
      setData(null);
    }
  }, [router]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (tab === "audit")
      fetch("/api/platform/audit").then((r) => r.json()).then((d) => setAudit(d ?? [])).catch(() => setAudit([]));
  }, [tab]);

  async function act(orgId: number, action: string, extra: Record<string, unknown> = {}) {
    setError("");
    try {
      const res = await fetch(`/api/platform/orgs/${orgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Action failed");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    }
  }

  async function verifyPayment(id: number, verdict: "verified" | "rejected") {
    try {
      const res = await fetch(`/api/platform/payments/${id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verdict }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  async function openDetail(o: Overview["orgs"][number]) {
    try {
      const res = await fetch(`/api/platform/orgs/${o.id}/detail`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed");
      setDetail({ name: o.name, d });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-[var(--paper)]">
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-[275px] bg-[#101b14] text-white flex flex-col shadow-xl z-20">
        <Link href="/" className="p-5 flex items-center gap-3 hover:opacity-90 transition-opacity">
          <span className="w-10 h-10 rounded-xl bg-[var(--amber)] text-[#101b14] flex items-center justify-center font-bold shadow-md shrink-0">
            <IconBike className="w-6 h-6" />
          </span>
          <div>
            <div className="font-display font-extrabold text-[15.5px] leading-tight">RiderHub 360</div>
            <div className="text-[10px] font-bold tracking-[0.16em] text-white/50 mt-0.5">PLATFORM ADMIN</div>
          </div>
        </Link>
        <nav className="mt-4 space-y-1.5 px-3 flex-1">
          {(
            [
              ["overview", "Overview", IconDash],
              ["welfare", "Welfare System", IconBike],
              ["plans", "Plans & pricing", IconForm],
              ["audit", "Platform audit", IconShield],
            ] as const
          ).map(([id, label, Icon]) => (
            <button key={id} className={`rh-nav-item !py-2.5 !px-3.5 !text-[14px] ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>
              <Icon className="w-5 h-5 shrink-0" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="p-5 border-t border-white/10 flex items-center justify-between">
          <div className="text-[12.5px] font-bold text-white/80">{isSuper ? "Super admin" : "Support officer"}</div>
          <button className="p-2 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors" onClick={logout} title="Sign out">
            <IconLogout className="w-4 h-4" />
          </button>
        </div>
      </aside>

      <div className="lg:pl-[275px]">
        <header className="h-[58px] bg-white border-b border-[var(--line)] sticky top-0 z-30 flex items-center gap-3 px-4 sm:px-5">
          <div className="font-display font-bold text-[15.5px] capitalize truncate">
            {tab === "overview" ? "Platform overview" : tab === "welfare" ? "Welfare Contribution Register" : tab === "plans" ? "Plans & pricing" : "Platform audit"}
          </div>
          <div className="flex-1" />
          {!isSuper ? (
            <span className="rh-pill hidden sm:inline-flex" style={{ background: "var(--amber-soft)", color: "#8a6400" }}>
              <span className="dot" /> Read-only · verify payments
            </span>
          ) : null}
        </header>

        {/* mobile section tabs (desktop uses the sidebar) */}
        <div className="lg:hidden bg-white border-b border-[var(--line)] px-3 py-2 flex gap-1.5 overflow-x-auto">
          {(
            [
              ["overview", "Overview"],
              ["welfare", "Welfare System"],
              ["plans", "Plans & pricing"],
              ["audit", "Platform audit"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              className={`rh-btn rh-btn-sm ${tab === id ? "rh-btn-primary" : "rh-btn-outline"} shrink-0`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <main className="p-4 sm:p-6 w-full space-y-6">
          {error ? <ErrorNote msg={error} /> : null}

          {tab === "overview" ? (
            !data || !data.stats ? (
              <div className="py-12 flex flex-col items-center justify-center">
                {error ? (
                  <div className="max-w-md w-full space-y-3 text-center">
                    <ErrorNote msg={error} />
                    <button className="rh-btn rh-btn-primary mx-auto" onClick={load}>
                      Retry
                    </button>
                  </div>
                ) : (
                  <Spinner />
                )}
              </div>
            ) : (
              <>
                
                {/* Welfare Contribution System Integration Banner */}
                <div className="rh-card p-5 bg-gradient-to-r from-[#17201a] to-[#124e8a] text-white">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/20 text-white mb-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Live Welfare System Connected
                      </span>
                      <h3 className="font-display text-lg font-bold">Stanriders — Welfare Contribution Register</h3>
                      <p className="text-white/80 text-xs mt-1 max-w-xl">
                        Manage pickup points, motorbike rider accounts, welfare cases, M-Pesa C2B / ROCPAY collections, and generate audit reports.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button className="rh-btn bg-white text-[#101b14] hover:bg-white/90 font-bold" onClick={() => setTab("welfare")}>
                        Open Inside Console
                      </button>
                      <a href="/welfare" target="_blank" rel="noreferrer" className="rh-btn bg-white/10 hover:bg-white/20 text-white font-bold">
                        Full Page ↗
                      </a>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
                  <StatCard label="Associations" value={data?.stats?.orgs ?? 0} />
                  <StatCard label="Active subscriptions" value={data?.stats?.activeSubs ?? 0} tone="green" sub={`${data?.stats?.renewalDue ?? 0} renewal due`} />
                  <StatCard label="Members · stations" value={`${data?.stats?.totalMembers ?? 0} · ${data?.stats?.totalStations ?? 0}`} />
                  <StatCard label="Verified revenue" value={fmtKes(data?.stats?.revenueKes ?? 0)} tone="blue" />
                </div>

                {(data.pendingPayments ?? []).length > 0 ? (
                  <div className="rh-card">
                    <div className="px-5 pt-4 pb-2 font-display font-bold text-[15px]">Payments awaiting verification</div>
                    <div className="overflow-x-auto">
                    <table className="rh-table min-w-[680px]">
                      <thead>
                        <tr>
                          <th>Association</th><th>Method</th><th>Reference</th><th>Amount</th><th>Received</th><th />
                        </tr>
                      </thead>
                      <tbody>
                        {(data.pendingPayments ?? []).map((p) => (
                          <tr key={p.id}>
                            <td className="font-bold">{p.orgName}</td>
                            <td className="text-[var(--ink-soft)]">{p.method.replace(/_/g, " ")}</td>
                            <td className="font-mono text-[12px]">{p.mpesaRef ?? "—"}</td>
                            <td className="font-bold">{fmtKes(p.amountKes)}</td>
                            <td className="text-[12.5px] text-[var(--ink-soft)]">{fmtDateTime(p.createdAt)}</td>
                            <td className="text-right whitespace-nowrap">
                              <button className="rh-btn rh-btn-primary rh-btn-sm" onClick={() => verifyPayment(p.id, "verified")}>Verify</button>
                              <button className="rh-btn rh-btn-danger rh-btn-sm ml-1.5" onClick={() => verifyPayment(p.id, "rejected")}>Reject</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                    <div className="px-5 pb-4 pt-2 text-[11.5px] text-[var(--ink-faint)] font-semibold">
                      Only verified payments renew or activate subscriptions. M-Pesa Daraja auto-reconciliation lands in phase 3b.
                    </div>
                  </div>
                ) : null}

                <div className="rh-card">
                  <div className="px-5 pt-4 pb-2 font-display font-bold text-[15px]">Associations</div>
                  <div className="overflow-x-auto">
                  <table className="rh-table min-w-[720px]">
                    <thead>
                      <tr>
                        <th>Association</th><th>Plan</th><th>Subscription</th><th>Period ends</th>
                        <th className="!text-right">Members</th><th className="!text-right">Stations</th><th />
                      </tr>
                    </thead>
                    <tbody>
                      {(data.orgs ?? []).map((o) => (
                        <tr key={o.id}>
                          <td>
                            <div className="font-bold">{o.name}</div>
                            <div className="text-[11px] text-[var(--ink-faint)] font-mono">/{o.slug}</div>
                          </td>
                          <td className="text-[var(--ink-soft)]">{o.planName ?? "—"}</td>
                          <td><StatusPill status={o.subStatus === "none" ? "pending_payment" : o.subStatus} /></td>
                          <td className="text-[12.5px] text-[var(--ink-soft)]">{fmtDate(o.periodEnd)}</td>
                          <td className="text-right font-bold">{o.members}</td>
                          <td className="text-right">{o.stations}</td>
                          <td className="text-right whitespace-nowrap">
                            <button className="rh-btn rh-btn-ghost rh-btn-sm" onClick={() => openDetail(o)}>
                              Inspect <IconChevron className="w-3.5 h-3.5" />
                            </button>
                            {isSuper ? (
                              o.status === "suspended" ? (
                                <button className="rh-btn rh-btn-outline rh-btn-sm" onClick={() => act(o.id, "reinstate", { reason: "Reinstated from console" })}>
                                  Reinstate
                                </button>
                              ) : (
                                <button className="rh-btn rh-btn-danger rh-btn-sm" onClick={() => act(o.id, "suspend", { reason: "Suspended from console" })}>
                                  Suspend
                                </button>
                              )
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                  <div className="px-5 pb-4 pt-2 text-[11.5px] text-[var(--ink-faint)] font-semibold">
                    “Inspect” is a privileged read and is written to the association's audit trail (platform.privileged_access).
                  </div>
                </div>
              </>
            )
          ) : null}

          {tab === "welfare" ? (
            <div className="space-y-4">
              <div className="rh-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
                <div>
                  <div className="font-display font-bold text-[16px] text-[var(--ink)]">
                    Stanriders Welfare Contribution Register
                  </div>
                  <div className="text-[12px] text-[var(--ink-soft)]">
                    Integrated super admin view with direct access to all welfare modules, members, and payment records.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href="/welfare"
                    target="_blank"
                    rel="noreferrer"
                    className="rh-btn rh-btn-outline rh-btn-sm inline-flex items-center gap-1.5"
                  >
                    Open Fullscreen View ↗
                  </a>
                </div>
              </div>
              <div className="rounded-2xl overflow-hidden border border-[var(--line)] shadow-sm bg-white min-h-[750px]">
                <AdminApp />
              </div>
            </div>
          ) : null}

          {tab === "plans" ? (
            !data ? (
              <Spinner />
            ) : !Array.isArray(data.plans) ? (
              <div className="rh-card p-6 text-[13.5px] text-[var(--ink-soft)] font-semibold">
                Couldn't load plans. Please reload the page.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.plans.map((p) => (
                  <div key={p.id} className="rh-card p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-display font-bold text-[17px]">{p.name}</div>
                        <div className="text-[11.5px] font-semibold text-[var(--ink-faint)]">{p.description}</div>
                      </div>
                      {isSuper ? (
                        <button className="rh-btn rh-btn-outline rh-btn-sm" onClick={() => setPlanEdit(p)}>Edit</button>
                      ) : null}
                    </div>
                    <div className="mt-3 flex items-baseline gap-3">
                      <div className="font-display font-bold text-[22px]">{fmtKes(p.monthlyPriceKes)}<span className="text-[12px] text-[var(--ink-faint)]">/mo</span></div>
                      <div className="text-[12.5px] font-bold text-[var(--ink-soft)]">{fmtKes(p.annualPriceKes)}/yr</div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <Limit label="Stations" v={p.maxStations} />
                      <Limit label="Members" v={p.maxMembers} />
                      <Limit label="Admins" v={p.maxAdmins} />
                    </div>
                    <div className="mt-3 text-[11.5px] text-[var(--ink-faint)] font-semibold">
                      Current tenants: {Array.isArray(p.tenants) && p.tenants.length > 0 ? p.tenants.join(", ") : "none yet"}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : null}

          {tab === "audit" ? (
            !audit ? (
              <Spinner />
            ) : (
              <div className="rh-card overflow-x-auto">
                <table className="rh-table min-w-[680px]">
                  <thead>
                    <tr><th>Time</th><th>Actor</th><th>Association</th><th>Action</th><th>Details</th></tr>
                  </thead>
                  <tbody>
                    {audit.slice(0, 60).map((a) => (
                      <tr key={a.id}>
                        <td className="text-[12px] text-[var(--ink-soft)] whitespace-nowrap">{fmtDateTime(a.createdAt)}</td>
                        <td className="font-bold">{a.userName ?? "System"}</td>
                        <td className="text-[var(--ink-soft)]">{a.orgName ?? "—"}</td>
                        <td><span className="font-mono text-[11.5px] font-bold">{a.action}</span></td>
                        <td className="text-[12px] text-[var(--ink-soft)] max-w-[260px] truncate">
                          {a.details ? Object.entries(a.details).map(([k, v]) => `${k}: ${String(v)}`).join(" · ") : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : null}
        </main>
      </div>

      {detail ? (
        <Modal wide title={`Privileged view · ${detail.name}`} onClose={() => setDetail(null)}>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <div className="rh-label mb-2">Stations ({detail.d.stations.length})</div>
              <div className="space-y-1.5">
                {detail.d.stations.map((s) => (
                  <div key={s.code} className="flex justify-between text-[13px]">
                    <span className="font-bold">{s.name}</span>
                    <span className="font-mono text-[11.5px] text-[var(--ink-faint)]">{s.code}</span>
                  </div>
                ))}
              </div>
              <div className="rh-label mb-2 mt-4">Officials</div>
              <div className="space-y-1">
                {detail.d.officials.map((o, i) => (
                  <div key={i} className="flex justify-between text-[12.5px]">
                    <span>{o.station} · <span className="text-[var(--ink-faint)]">{o.role}</span></span>
                    <span className="font-bold">{o.name}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="rh-label mb-2">Members ({detail.d.members.length}) — privileged data</div>
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {detail.d.members.map((m, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 text-[12.5px]">
                    <span className="font-bold truncate">{m.firstName} {m.surname}</span>
                    <span className="font-mono text-[11px] text-[var(--ink-faint)]">{m.membershipNumber}</span>
                    <StatusPill status={m.status} />
                  </div>
                ))}
              </div>
              <div className="rh-label mb-2 mt-4">Recent applications</div>
              <div className="space-y-1.5">
                {detail.d.applications.slice(0, 6).map((a, i) => (
                  <div key={i} className="flex items-center justify-between text-[12.5px]">
                    <span className="font-bold">{a.fullName}</span>
                    <StatusPill status={a.status} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      ) : null}

      {planEdit && data ? (
        <Modal title={`Edit plan · ${planEdit.name}`} onClose={() => setPlanEdit(null)}>
          <PlanEditor
            plan={data?.plans?.find((p) => p.id === planEdit.id) ?? planEdit}
            onSaved={() => { setPlanEdit(null); load(); }}
          />
        </Modal>
      ) : null}
    </div>
  );
}

function Limit({ label, v }: { label: string; v: number }) {
  return (
    <div className="rounded-lg border border-[var(--line)] py-2" style={{ background: "#fff" }}>
      <div className="font-bold text-[14px]">{v.toLocaleString()}</div>
      <div className="rh-label">{label}</div>
    </div>
  );
}

function PlanEditor({ plan, onSaved }: { plan: Overview["plans"][number]; onSaved: () => void }) {
  const [f, setF] = useState({
    monthlyPriceKes: String(plan.monthlyPriceKes),
    annualPriceKes: String(plan.annualPriceKes),
    maxStations: String(plan.maxStations),
    maxMembers: String(plan.maxMembers),
    maxAdmins: String(plan.maxAdmins),
    storageMb: String(plan.storageMb),
    isActive: plan.isActive,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/plans/${plan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthlyPriceKes: Number(f.monthlyPriceKes),
          annualPriceKes: Number(f.annualPriceKes),
          maxStations: Number(f.maxStations),
          maxMembers: Number(f.maxMembers),
          maxAdmins: Number(f.maxAdmins),
          storageMb: Number(f.storageMb),
          isActive: f.isActive,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Save failed");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {([
          ["monthlyPriceKes", "Monthly price (KES)"],
          ["annualPriceKes", "Annual price (KES)"],
          ["maxStations", "Max stations"],
          ["maxMembers", "Max members"],
          ["maxAdmins", "Max admins"],
          ["storageMb", "Storage (MB)"],
        ] as const).map(([k, label]) => (
          <label key={k} className="block">
            <div className="rh-label mb-1">{label}</div>
            <input className="rh-input" type="number" value={f[k] as string} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
          </label>
        ))}
      </div>
      <label className="flex items-center gap-2 text-[13px] font-bold cursor-pointer">
        <input type="checkbox" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} className="accent-[var(--pine)]" />
        Plan active (sellable)
      </label>
      {error ? <ErrorNote msg={error} /> : null}
      <div className="flex gap-2">
        <button className="rh-btn rh-btn-primary" disabled={busy} onClick={save}>Save plan</button>
        <button className="rh-btn rh-btn-ghost" onClick={onSaved}>Cancel</button>
      </div>
    </div>
  );
}
