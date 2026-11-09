"use client";

import { useEffect, useState } from "react";
import type { Ctx } from "./ctx";
import { Spinner, StatusPill, EmptyState, ErrorNote, fmtDateTime } from "@/components/rh-ui";
import { IconDownload, IconBell, IconReport, IconTransfer } from "@/components/icons";

type Transfer = {
  id: number; memberName: string; membershipNumber: string | null;
  fromStation: string; toStation: string; reason: string; status: string; createdAt: string;
};

export function Reports({ org, isChair, isOfficer, stationFilter, refreshKey }: Ctx) {
  const [transfers, setTransfers] = useState<Transfer[] | null>(null);
  const [annTitle, setAnnTitle] = useState("");
  const [annBody, setAnnBody] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isChair) return;
    fetch(`/api/transfers?orgId=${org.id}`).then((r) => r.json()).then((d) => setTransfers(Array.isArray(d) ? d : [])).catch(() => setTransfers([]));
  }, [org.id, isChair, refreshKey]);

  const stationParam = !isChair && stationFilter !== "all" ? `&stationId=${stationFilter}` : "";
  const scope = isChair ? " (your station)" : stationFilter !== "all" ? " (selected station)" : "";

  async function publishAnnouncement() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: org.id, title: annTitle, body: annBody }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Publish failed");
      setAnnTitle("");
      setAnnBody("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <ExportCard
          title="Member register"
          body={`Full CSV of the current register${scope} — numbers, contact, station, status.`}
          href={`/api/reports/members?orgId=${org.id}${stationParam}`}
        />
        <ExportCard
          title="Applications"
          body={`Every application with the chairperson's recommendation and the final decision${scope}.`}
          href={`/api/reports/applications?orgId=${org.id}${stationParam}`}
        />
        <ExportCard
          title="Transfers"
          body="Station transfer log with reasons and approvals."
          href={`/api/reports/transfers?orgId=${org.id}`}
          disabled={isChair}
        />
      </div>

      {isChair ? null : (
        <div className="rh-card">
          <div className="px-5 pt-4 pb-2 flex items-center gap-2">
            <IconTransfer className="w-4 h-4 text-[var(--ink-faint)]" />
            <div className="font-display font-bold text-[15px]">Transfer log</div>
          </div>
          {!transfers ? (
            <Spinner />
          ) : transfers.length === 0 ? (
            <EmptyState title="No transfers yet" body="Transfers requested from the Members tab appear here with their approval state." />
          ) : (
            <div className="overflow-x-auto">
            <table className="rh-table min-w-[640px]">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Route</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <div className="font-bold">{t.memberName}</div>
                      <div className="font-mono text-[11px] text-[var(--ink-faint)]">{t.membershipNumber}</div>
                    </td>
                    <td className="text-[var(--ink-soft)]">
                      {t.fromStation} → <b>{t.toStation}</b>
                    </td>
                    <td className="text-[var(--ink-soft)] max-w-[200px]">{t.reason}</td>
                    <td><StatusPill status={t.status} /></td>
                    <td className="text-[12px] text-[var(--ink-soft)]">{fmtDateTime(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      )}

      <div className="rh-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <IconBell className="w-4 h-4 text-[var(--ink-faint)]" />
          <div className="font-display font-bold text-[15px]">Publish an announcement</div>
        </div>
        <div className="space-y-3">
          <input className="rh-input" placeholder="Title" value={annTitle} onChange={(e) => setAnnTitle(e.target.value)} />
          <textarea className="rh-input min-h-[80px]" placeholder="Message to members…" value={annBody} onChange={(e) => setAnnBody(e.target.value)} />
          <div className="flex items-center gap-3">
            <button className="rh-btn rh-btn-primary" disabled={busy || !annTitle.trim() || !annBody.trim()} onClick={publishAnnouncement}>
              Publish
            </button>
            {isChair ? (
              <span className="text-[11.5px] text-[var(--ink-faint)] font-semibold">
                As chairperson, announcements are scoped to your station automatically.
              </span>
            ) : null}
          </div>
          {error ? <ErrorNote msg={error} /> : null}
        </div>
      </div>
    </div>
  );
}

function ExportCard({ title, body, href, disabled }: { title: string; body: string; href: string; disabled?: boolean }) {
  return (
    <div className="rh-card p-5 flex flex-col">
      <div className="flex items-center gap-2">
        <IconReport className="w-4.5 h-4.5 text-[var(--pine)]" />
        <div className="font-bold text-[14px]">{title}</div>
      </div>
      <div className="mt-1.5 text-[12.5px] text-[var(--ink-soft)] leading-relaxed flex-1">{body}</div>
      {disabled ? (
        <span className="rh-btn rh-btn-outline mt-4 opacity-40 pointer-events-none">
          <IconDownload className="w-4 h-4" /> Not available for your role
        </span>
      ) : (
        <a className="rh-btn rh-btn-outline mt-4" href={href} download>
          <IconDownload className="w-4 h-4" /> Download CSV
        </a>
      )}
    </div>
  );
}
