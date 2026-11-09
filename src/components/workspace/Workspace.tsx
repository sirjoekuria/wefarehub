"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  IconDash, IconUsers, IconInbox, IconStages, IconForm, IconReport, IconCog,
  IconBell, IconLogout, IconBike, IconCard, IconWarn, IconChevron, IconMenu, IconX, IconShield,
} from "@/components/icons";
import { StatusPill, fmtDate } from "@/components/rh-ui";
import type { Ctx } from "./ctx";
import { SuspendedCard, type SubInfo } from "./SuspendedCard";
import { Dashboard } from "./Dashboard";
import { Members } from "./Members";
import { Applications } from "./Applications";
import { Stations } from "./Stations";
import { Fields } from "./Fields";
import { Reports } from "./Reports";
import { Settings } from "./Settings";
import { VerifyTab } from "./VerifyTab";

export type OrgInit = {
  id: number; name: string; slug: string; code: string; motto: string | null; logoUrl: string | null;
  primaryColor: string; secondaryColor: string; accentColor: string; county: string | null;
  location: string | null; phone: string | null; email: string | null; registrationNumber: string | null;
  description: string | null; status: string; formVersion: number;
};
export type WorkspaceInitial = {
  user: { id: number; email: string; fullName: string; platformRole: string | null };
  org: OrgInit;
  role: "owner" | "admin" | "secretary" | "treasurer" | null;
  chairStationId: number | null;
  chairStationName: string | null;
};

type Tab = "dashboard" | "applications" | "members" | "stations" | "verify" | "fields" | "reports" | "settings";

export function Workspace({ initial }: { initial: WorkspaceInitial }) {
  const router = useRouter();
  // org held in state so theme/branding changes re-skin the shell instantly
  const [org, setOrg] = useState<OrgInit>(initial.org);
  const { role, user, chairStationId, chairStationName } = initial;
  const isChair = role === null;
  const isOfficer = role === "owner" || role === "admin";

  const [tab, setTab] = useState<Tab>("dashboard");
  const [stations, setStations] = useState<{ id: number; name: string }[]>([]);
  const [stationFilter, setStationFilter] = useState<number | "all">("all");
  const [me, setMe] = useState<{ orgs: { orgId: number; name: string; slug: string; role: string }[]; chairStations: { orgSlug: string; orgName: string; stationName: string }[] } | null>(null);
  const [bellOpen, setBellOpen] = useState(false);
  const [notifs, setNotifs] = useState<{ id: number; title: string; body: string | null; readAt: string | null }[]>([]);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [sub, setSub] = useState<SubInfo | null>(null);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  // subscription state drives the hard suspension gate
  useEffect(() => {
    fetch(`/api/org/dashboard?orgId=${org.id}`)
      .then((r) => r.json())
      .then((d) => setSub(d?.subscription ?? null))
      .catch(() => setSub(null));
  }, [org.id, refreshKey]);

  const suspended = !!sub && ["suspended", "cancelled", "expired"].includes(sub.status);

  useEffect(() => {
    fetch(`/api/me`).then((r) => r.json()).then((d) => setMe({ orgs: d.orgs ?? [], chairStations: d.chairStations ?? [] })).catch(() => {});
    if (!isChair)
      fetch(`/api/stations?orgId=${org.id}`)
        .then((r) => r.json())
        .then((d: unknown) => setStations(d as { id: number; name: string }[]))
        .catch(() => {});
  }, [org.id, isChair]);

  useEffect(() => {
    fetch("/api/notifications").then((r) => r.json()).then((d) => setNotifs(d)).catch(() => {});
  }, [tab, refreshKey]);

  const unread = notifs.filter((n) => !n.readAt).length;

  const nav: { id: Tab; label: string; icon: (p: { className?: string }) => React.ReactElement; show: boolean }[] = useMemo(
    () => [
      { id: "dashboard", label: isChair ? `My station — ${chairStationName ?? ""}` : "Dashboard", icon: IconDash, show: true },
      { id: "applications", label: "Applications", icon: IconInbox, show: true },
      { id: "members", label: "Members", icon: IconUsers, show: true },
      { id: "stations", label: "Stations", icon: IconStages, show: !isChair },
      { id: "verify", label: "Verify", icon: IconShield, show: true },
      { id: "fields", label: "Member form", icon: IconForm, show: isOfficer },
      { id: "reports", label: "Reports", icon: IconReport, show: true },
      { id: "settings", label: "Settings", icon: IconCog, show: isOfficer },
    ],
    [isChair, isOfficer, chairStationName],
  );

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const ctx: Ctx = {
    org,
    role,
    user,
    chairStationId,
    chairStationName,
    stationFilter,
    setStationFilter,
    refreshKey,
    refresh,
    isChair,
    isOfficer,
  };

  function pickTab(t: Tab) {
    setTab(t);
    setMenuOpen(false);
    setSwitchOpen(false);
    setBellOpen(false);
  }

  const sidebarContent = (
    <>
      <div className="p-5">
        <div className="flex items-center gap-3.5 px-1">
          {org.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logoUrl} alt={org.name} className="w-14 h-14 rounded-2xl object-cover ring-1 ring-white/25 shadow-lg shrink-0" />
          ) : (
            <span
              className="w-14 h-14 rounded-2xl flex items-center justify-center font-display font-extrabold text-[18px] ring-1 ring-white/25 shadow-lg shrink-0"
              style={{ background: org.primaryColor, color: "#fff" }}
            >
              {org.code}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="font-display font-extrabold text-[15.5px] leading-snug truncate">{org.name}</div>
            <div className="text-[11.5px] opacity-75 leading-tight truncate mt-0.5">{org.motto}</div>
          </div>
        </div>

        <nav className="mt-6 space-y-1.5">
          {user.platformRole === "super_admin" ? (
            <Link
              href="/platform"
              className="rh-btn rh-btn-sm w-full mb-3 bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center gap-1.5 border border-white/20 text-[12px]"
            >
              <IconShield className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span>Super Admin Console</span>
            </Link>
          ) : null}
          {nav.filter((n) => n.show).map((n) => (
            <button key={n.id} className={`rh-nav-item !py-2.5 !px-3.5 !text-[14px] ${tab === n.id ? "active" : ""}`} onClick={() => pickTab(n.id)}>
              <n.icon className="w-5 h-5 shrink-0" />
              <span className="truncate">{n.label}</span>
            </button>
          ))}
        </nav>

        {isChair ? (
          <div className="mt-6 rounded-xl p-3.5 text-[12px] leading-relaxed" style={{ background: "rgba(255,255,255,0.07)" }}>
            <div className="font-bold flex items-center gap-1.5" style={{ color: org.accentColor }}>
              <IconBike className="w-4 h-4" /> Station chairperson
            </div>
            <div className="mt-1 opacity-70">
              Your access is limited to <b>{chairStationName}</b>. Final approvals belong to association
              administrators.
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-auto border-t border-white/10 p-5">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-[12.5px] font-extrabold shrink-0 ring-1 ring-white/20">
            {user.fullName.split(" ").map((s) => s[0]).slice(0, 2).join("")}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-bold truncate">{user.fullName}</div>
            <div className="text-[11px] opacity-65 truncate font-medium">
              {isChair ? `Chair · ${chairStationName}` : (role ?? "").toUpperCase()}
            </div>
          </div>
          <button className="p-2 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors" onClick={logout} title="Sign out" aria-label="Sign out">
            <IconLogout className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div
      className="min-h-screen grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[290px_minmax(0,1fr)]"
      style={{
        ["--org-primary" as never]: org.primaryColor,
        ["--org-secondary" as never]: org.secondaryColor,
        ["--org-accent" as never]: org.accentColor,
      }}
    >
      {/* desktop sidebar */}
      <aside
        className="hidden lg:flex relative flex-col min-h-screen sticky top-0 h-screen text-white shadow-xl z-20"
        style={{ background: org.secondaryColor }}
      >
        {sidebarContent}
      </aside>

      {/* mobile drawer */}
      {menuOpen ? (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/55" onClick={() => setMenuOpen(false)} />
          <aside
            className="absolute inset-y-0 left-0 w-[300px] max-w-[85vw] text-white flex flex-col shadow-2xl"
            style={{ background: org.secondaryColor }}
          >
            <div className="flex justify-end px-3 pt-3">
              <button className="p-1.5 rounded-md hover:bg-white/10" onClick={() => setMenuOpen(false)} aria-label="Close menu">
                <IconX className="w-4 h-4" />
              </button>
            </div>
            {sidebarContent}
          </aside>
        </div>
      ) : null}

      {/* main */}
      <div className="min-w-0 flex flex-col">
        <header className="h-[58px] border-b border-[var(--line)] bg-white sticky top-0 z-30 flex items-center gap-2 sm:gap-3 px-3 sm:px-5">
          <button
            className="lg:hidden p-2 -ml-1 rounded-lg hover:bg-[var(--paper)] text-[var(--ink-soft)]"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
          >
            <IconMenu className="w-5 h-5" />
          </button>
          <div className="font-display font-bold text-[15px] truncate max-w-[34vw] sm:max-w-none hidden xs:block sm:block">
            {nav.find((n) => n.id === tab)?.label}
          </div>

          {!isChair ? (
            <select
              className="rh-input !py-1.5 !text-[12.5px] font-semibold !w-[112px] sm:!w-auto"
              value={stationFilter}
              onChange={(e) => setStationFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
              aria-label="Station filter"
            >
              <option value="all">All stations</option>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          ) : (
            <div className="rh-pill hidden sm:inline-flex" style={{ background: "var(--pine-soft)", color: "var(--pine-deep)" }}>
              <span className="dot" /> {chairStationName}
            </div>
          )}

          <div className="flex-1" />

          <span className="hidden sm:block">
            <SubBadge sub={sub} />
          </span>

          {/* notifications */}
          <div className="relative">
            <button
              className="relative p-2 rounded-lg hover:bg-[var(--paper)] text-[var(--ink-soft)]"
              onClick={() => {
                setBellOpen((v) => !v);
                setSwitchOpen(false);
              }}
              aria-label="Notifications"
            >
              <IconBell className="w-5 h-5" />
              {unread > 0 ? (
                <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] rounded-full bg-[var(--danger)] text-white text-[10px] font-bold flex items-center justify-center px-1">
                  {unread}
                </span>
              ) : null}
            </button>
            {bellOpen ? (
              <div className="absolute right-0 top-11 w-[85vw] max-w-80 rh-card shadow-xl z-40">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--line)]">
                  <div className="font-bold text-[13px]">Notifications</div>
                  <button
                    className="text-[11.5px] font-bold text-[var(--pine)] hover:underline"
                    onClick={async () => {
                      await fetch("/api/notifications", { method: "POST" });
                      setNotifs((n) => n.map((x) => ({ ...x, readAt: new Date().toISOString() })));
                    }}
                  >
                    Mark all read
                  </button>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifs.length === 0 ? (
                    <div className="p-5 text-[12.5px] text-[var(--ink-faint)] font-semibold">Nothing yet.</div>
                  ) : (
                    notifs.slice(0, 12).map((n) => (
                      <div key={n.id} className={`px-4 py-3 border-b border-[var(--line)] last:border-0 ${n.readAt ? "opacity-55" : ""}`}>
                        <div className="text-[12.5px] font-bold">{n.title}</div>
                        {n.body ? <div className="text-[12px] text-[var(--ink-soft)] mt-0.5">{n.body}</div> : null}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {/* workspace switcher */}
          <div className="relative">
            <button
              className="rh-btn rh-btn-outline rh-btn-sm !px-2.5 sm:!px-3"
              onClick={() => {
                setSwitchOpen((v) => !v);
                setBellOpen(false);
              }}
              aria-label="Switch workspace"
            >
              {org.code} <IconChevron className="w-3.5 h-3.5 rotate-90" />
            </button>
            {switchOpen ? (
              <div className="absolute right-0 top-10 w-[78vw] max-w-64 rh-card shadow-xl z-40 p-1.5">
                {me?.orgs.map((o) => (
                  <button key={o.orgId} className="rh-nav-item w-full" onClick={() => router.push(`/w/${o.slug}`)}>
                    <span className="w-9 h-9 rounded-lg bg-[var(--pine-soft)] text-[var(--pine-deep)] text-[12px] font-bold flex items-center justify-center shrink-0">
                      {o.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="flex-1 min-w-0 text-left">
                      <span className="block text-[12.5px] font-bold truncate text-[var(--ink)]">{o.name}</span>
                      <span className="block text-[10.5px] uppercase tracking-wide">{o.role}</span>
                    </span>
                  </button>
                ))}
                {me?.chairStations.filter((c) => c.orgSlug !== org.slug).map((c) => (
                  <button key={c.orgSlug + c.stationName} className="rh-nav-item w-full" onClick={() => router.push(`/w/${c.orgSlug}`)}>
                    <IconStages className="w-4 h-4" />
                    <span className="flex-1 min-w-0 text-left">
                      <span className="block text-[12.5px] font-bold truncate text-[var(--ink)]">{c.stationName}</span>
                      <span className="block text-[10.5px]">Chair · {c.orgName}</span>
                    </span>
                  </button>
                ))}
                {user.platformRole ? (
                  <button className="rh-nav-item w-full" onClick={() => router.push("/platform")}>
                    <IconCog className="w-4 h-4" />
                    <span className="text-[12.5px] font-bold text-[var(--ink)]">Platform admin</span>
                  </button>
                ) : null}
                <div className="border-t border-[var(--line)] mt-1 pt-1">
                  <Link href="/" className="rh-nav-item w-full">
                    <IconCard className="w-4 h-4" />
                    <span className="text-[12.5px] font-bold text-[var(--ink)]">RiderHub home</span>
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        </header>

        <main className="p-4 sm:p-6 w-full" onClick={() => {
          if (bellOpen) setBellOpen(false);
          if (switchOpen) setSwitchOpen(false);
        }}>
          {suspended && sub ? (
            <SuspendedCard orgName={org.name} sub={sub} onRetry={refresh} />
          ) : (
            <>
              {tab === "dashboard" ? (
                <Dashboard {...ctx} onStationClick={(id) => { setStationFilter(id); setTab("members"); }} />
              ) : null}
              {tab === "applications" ? <Applications {...ctx} /> : null}
              {tab === "members" ? <Members {...ctx} /> : null}
              {tab === "stations" ? <Stations {...ctx} /> : null}
              {tab === "verify" ? <VerifyTab {...ctx} /> : null}
              {tab === "fields" ? <Fields {...ctx} /> : null}
              {tab === "reports" ? <Reports {...ctx} /> : null}
              {tab === "settings" ? (
                <Settings {...ctx} onOrgColors={(c) => setOrg((o) => ({ ...o, ...c }))} />
              ) : null}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function SubBadge({ sub }: { sub: SubInfo | null }) {
  if (!sub) return null;
  const warn = sub.status !== "active";
  return (
    <span
      className="rh-pill"
      style={
        warn
          ? { background: "var(--amber-soft)", color: "#8a6400" }
          : { background: "var(--pine-soft)", color: "var(--pine-deep)" }
      }
      title={sub.currentPeriodEnd ? `Renews ${fmtDate(sub.currentPeriodEnd)}` : ""}
    >
      <span className="dot" />
      {sub.planName ?? "No plan"} · {sub.status.replace(/_/g, " ")}
      {warn ? <IconWarn className="w-3.5 h-3.5" /> : null}
    </span>
  );
}
