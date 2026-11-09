"use client";

import { useEffect, useState } from "react";
import type { Ctx } from "./ctx";
import { StatCard, Spinner, StatusPill, EmptyState, ErrorNote, fmtDate, fmtDateTime } from "@/components/rh-ui";
import { IconWarn, IconBell } from "@/components/icons";

type Dash = {
  scope: string;
  stationId: number | null;
  stats: { totalMembers: number; activeMembers: number; suspended: number; pendingApplications: number };
  stations: { id: number; name: string; code: string; members: number; active: number; pending: number; chairperson: string | null }[];
  recent: { id: number; name: string; number: string | null; status: string; date: string | null }[];
  growth: { month: string; n: number }[];
  announcements: { id: number; title: string; stationId: number | null; createdAt: string; author: string | null }[];
  subscription: { status: string; planName: string; currentPeriodEnd: string | null; maxMembers: number } | null;
};

export function Dashboard({ org, isChair, chairStationName, stationFilter, refreshKey, onStationClick }: Ctx & { onStationClick?: (id: number) => void }) {
  const [data, setData] = useState<Dash | null>(null);
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    setLoadError("");
    fetch(`/api/org/dashboard?orgId=${org.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d && d.error) setLoadError(String(d.error));
        else setData(d);
      })
      .catch(() => setLoadError("Couldn't load the dashboard. Try again in a moment."));
  }, [org.id, refreshKey]);

  if (loadError)
    return (
      <div className="max-w-3xl space-y-3">
        <ErrorNote msg={`Dashboard failed to load — ${loadError.slice(0, 220)}`} />
        <button className="rh-btn rh-btn-outline" onClick={() => refreshKey === refreshKey && window.location.reload()}>
          Reload workspace
        </button>
      </div>
    );
  if (!data) return <Spinner />;
  const maxGrowth = Math.max(1, ...data.growth.map((g) => g.n));

  return (
    <div className="space-y-6 w-full">
      {data.subscription && data.subscription.status !== "active" ? (
        <div className="rh-card flex items-start gap-3 p-4" style={{ borderColor: "#e8d48a", background: "var(--amber-soft)" }}>
          <IconWarn className="w-5 h-5 mt-0.5 text-[#8a6400]" />
          <div className="text-[13px] text-[#6b5100]">
            <b>Subscription {data.subscription.status.replace(/_/g, " ")}.</b> Operational actions may be limited.
            {data.subscription.currentPeriodEnd ? ` Period ends ${fmtDate(data.subscription.currentPeriodEnd)}.` : ""}
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        <StatCard label="Total members" value={data.stats.totalMembers} sub={isChair ? `at ${chairStationName}` : "across stations"} />
        <StatCard label="Active members" value={data.stats.activeMembers} tone="green" />
        <StatCard label="Pending applications" value={data.stats.pendingApplications} tone={data.stats.pendingApplications > 0 ? "amber" : "default"} />
        <StatCard label="Suspended" value={data.stats.suspended} tone={data.stats.suspended > 0 ? "red" : "default"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="rh-card min-w-0 lg:col-span-7 xl:col-span-7 2xl:col-span-8">
          <div className="px-5 pt-4 pb-2 flex items-center justify-between">
            <div className="font-display font-bold text-[15px]">Stations</div>
            <div className="rh-label">{isChair ? "your station" : `${data.stations.length} total`}</div>
          </div>
          {data.stations.length === 0 ? (
            <EmptyState title="No stations yet" body="Create your first pickup station from the Stations tab." />
          ) : (
            <div className="overflow-x-auto">
            <table className="rh-table min-w-[520px]">
              <thead>
                <tr>
                  <th>Station</th>
                  <th>Chairperson</th>
                  <th className="!text-right">Members</th>
                  <th className="!text-right">Active</th>
                  <th className="!text-right">Pending</th>
                </tr>
              </thead>
              <tbody>
                {data.stations
                  .filter((s) => (stationFilter === "all" || isChair ? true : s.id === stationFilter))
                  .map((s) => (
                    <tr
                      key={s.id}
                      className={onStationClick ? "cursor-pointer" : ""}
                      title={onStationClick ? "View members of this station" : undefined}
                      onClick={() => onStationClick?.(s.id)}
                    >
                      <td>
                        <div className="font-bold" style={{ color: "var(--org-primary)" }}>{s.name}</div>
                        <div className="text-[11px] text-[var(--ink-faint)] font-semibold">{s.code}</div>
                      </td>
                      <td className="text-[var(--ink-soft)]">{s.chairperson ?? <span className="text-[var(--amber)] font-bold">unassigned</span>}</td>
                      <td className="text-right font-bold">{s.members}</td>
                      <td className="text-right">{s.active}</td>
                      <td className="text-right">{s.pending > 0 ? <span className="font-bold text-[#8a6400]">{s.pending}</span> : "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            </div>
          )}
        </div>

        <div className="space-y-5 min-w-0 lg:col-span-5 xl:col-span-5 2xl:col-span-4">
          <div className="rh-card p-5">
            <div className="rh-label mb-4">Membership growth · last 6 months</div>
            {data.growth.length === 0 ? (
              <div className="text-[12.5px] text-[var(--ink-faint)] font-semibold">No registrations yet.</div>
            ) : (
              <div className="flex items-end gap-2 h-28">
                {[...data.growth].reverse().map((g) => (
                  <div key={g.month} className="flex-1 flex flex-col items-center gap-1.5">
                    <div className="text-[10.5px] font-bold text-[var(--ink-soft)]">{g.n}</div>
                    <div
                      className="w-full rounded-t-md"
                      style={{ height: `${Math.max(6, (g.n / maxGrowth) * 80)}px`, background: "var(--org-primary)" }}
                    />
                    <div className="text-[9.5px] font-bold text-[var(--ink-faint)]">
                      {(g.month ?? "????").slice(5)}/{(g.month ?? "????").slice(2, 4)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rh-card">
            <div className="px-5 pt-4 pb-2 flex items-center gap-2">
              <IconBell className="w-4 h-4 text-[var(--ink-faint)]" />
              <div className="font-display font-bold text-[15px]">Announcements</div>
            </div>
            {data.announcements.length === 0 ? (
              <div className="px-5 pb-5 text-[12.5px] text-[var(--ink-faint)] font-semibold">No announcements published.</div>
            ) : (
              <div>
                {data.announcements.map((a) => (
                  <div key={a.id} className="px-5 py-3 border-t border-[var(--line)] first:border-0">
                    <div className="text-[13px] font-bold">{a.title}</div>
                    <div className="text-[11px] text-[var(--ink-faint)] font-semibold mt-0.5">
                      {a.author} · {fmtDateTime(a.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rh-card">
        <div className="px-5 pt-4 pb-2">
          <div className="font-display font-bold text-[15px]">Recent registrations</div>
        </div>
        {data.recent.length === 0 ? (
          <EmptyState title="No members yet" body="Share your station registration link to start building the register." />
        ) : (
          <div className="overflow-x-auto">
          <table className="rh-table min-w-[480px]">
            <thead>
              <tr>
                <th>Member</th>
                <th>Number</th>
                <th>Status</th>
                <th>Registered</th>
              </tr>
            </thead>
            <tbody>
              {data.recent.map((m) => (
                <tr key={m.id}>
                  <td className="font-bold">{m.name}</td>
                  <td className="font-mono text-[12.5px]">{m.number ?? "—"}</td>
                  <td>
                    <StatusPill status={m.status} />
                  </td>
                  <td className="text-[var(--ink-soft)]">{fmtDate(m.date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
