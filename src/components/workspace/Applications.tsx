"use client";

import { useEffect, useState } from "react";
import type { Ctx } from "./ctx";
import { Spinner, StatusPill, EmptyState, Modal, Field, ErrorNote, fmtDateTime } from "@/components/rh-ui";
import { IconCheck, IconX, IconInbox, IconFlow } from "@/components/icons";

type App = {
  id: number; status: string; fullName: string; phone: string | null; email: string | null; area: string | null;
  data: Record<string, any>; chairNotes: string | null; recommendedAt: string | null;
  decisionAt: string | null; decisionNotes: string | null; rejectionReason: string | null;
  formVersion: number; stationId: number; stationName: string; createdAt: string;
};
type FieldDef = { id: number; key: string; label: string; type: string };

const chairActions = ["submitted", "chairperson_review", "changes_requested"];

export function Applications({ org, isChair, isOfficer, stationFilter, refreshKey, refresh, chairStationName }: Ctx) {
  const [apps, setApps] = useState<App[] | null>(null);
  const [defs, setDefs] = useState<FieldDef[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [open, setOpen] = useState<App | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState("");
  const [action, setAction] = useState<"" | "review" | "recommended" | "not_recommended" | "changes_requested" | "approved" | "rejected">("");

  const load = () => {
    const q = statusFilter !== "all" ? `&status=${statusFilter}` : "";
    fetch(`/api/applications?orgId=${org.id}${q}`)
      .then((r) => r.json())
      .then((d) => setApps(Array.isArray(d) ? d.filter((a: App) => (stationFilter === "all" ? true : a.stationId === stationFilter)) : []))
      .catch(() => setApps([]));
  };
  useEffect(load, [org.id, statusFilter, stationFilter, refreshKey]);
  useEffect(() => {
    fetch(`/api/fields?orgId=${org.id}`).then((r) => r.json()).then((d) => setDefs(d ?? [])).catch(() => {});
  }, [org.id]);

  async function act(decision: typeof action) {
    if (!open) return;
    setBusy(true);
    setError("");
    try {
      const path =
        decision === "review"
          ? `/api/applications/${open.id}/review`
          : decision === "approved" || decision === "rejected"
            ? `/api/applications/${open.id}/decide`
            : `/api/applications/${open.id}/recommend`;
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: org.id,
          decision,
          notes,
          rejectionReason: decision === "rejected" ? notes : undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Action failed");
      setOpen(null);
      setNotes("");
      setAction("");
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  if (!apps) return <Spinner />;
  const canChair = isChair;
  const canDecide = isOfficer;
  const defLabel = (v: any) => {
    if (v == null) return null;
    return String(v);
  };

  return (
    <div className="w-full space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {["all", "submitted", "chairperson_review", "recommended", "not_recommended", "changes_requested", "approved", "rejected"].map((s) => (
          <button
            key={s}
            className={`rh-btn rh-btn-sm ${statusFilter === s ? "rh-btn-primary" : "rh-btn-outline"}`}
            onClick={() => setStatusFilter(s)}
          >
            {s === "all" ? "All" : s.replace(/_/g, " ")}
          </button>
        ))}
        <div className="flex-1" />
        <span className="text-[12px] font-bold text-[var(--ink-faint)]">{apps.length} shown</span>
      </div>

      {apps.length === 0 ? (
        <div className="rh-card">
          <EmptyState
            title="No applications here"
            body="Applications appear here when someone submits through your station registration link."
          />
        </div>
      ) : (
        <div className="rh-card overflow-x-auto">
          <table className="rh-table min-w-[720px]">
            <thead>
              <tr>
                <th>Applicant</th>
                <th>Station</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Chair recommendation</th>
                <th>Submitted</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {apps.map((a) => (
                <tr key={a.id}>
                  <td>
                    <div className="font-bold">{a.fullName}</div>
                    <div className="text-[11.5px] text-[var(--ink-faint)] font-semibold">{a.area ?? ""}</div>
                  </td>
                  <td className="text-[var(--ink-soft)]">{a.stationName}</td>
                  <td className="font-mono text-[12px]">{a.phone ?? "—"}</td>
                  <td><StatusPill status={a.status} /></td>
                  <td className="text-[12.5px] text-[var(--ink-soft)] max-w-[220px]">
                    {a.status === "recommended" ? (
                      <span className="inline-flex items-center gap-1.5 font-bold text-[var(--pine-deep)]"><IconCheck className="w-4 h-4" /> Recommended</span>
                    ) : a.status === "not_recommended" ? (
                      <span className="inline-flex items-center gap-1.5 font-bold text-[var(--danger)]"><IconX className="w-4 h-4" /> Not recommended</span>
                    ) : a.chairNotes ? (
                      <span className="line-clamp-2">{a.chairNotes}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="text-[var(--ink-soft)] text-[12px]">{fmtDateTime(a.createdAt)}</td>
                  <td className="text-right">
                    <button className="rh-btn rh-btn-outline rh-btn-sm" onClick={() => { setOpen(a); setNotes(""); setAction(""); setError(""); }}>
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open ? (
        <Modal wide title={`Application · ${open.fullName}`} onClose={() => setOpen(null)}>
          <div className="grid md:grid-cols-[1fr_1.2fr] gap-5">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <StatusPill status={open.status} />
                <span className="text-[12px] font-bold text-[var(--ink-faint)]">{open.stationName} · form v{open.formVersion}</span>
              </div>
              {open.data?.photo || open.data?.idImage ? (
                <div className="rounded-lg border border-[var(--line)] p-3" style={{ background: "var(--paper)" }}>
                  <div className="rh-label mb-2">Photo & identity documents</div>
                  <div className="flex items-start gap-3">
                    {open.data?.photo ? (
                      <div>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={open.data.photo} alt="Passport photo" className="w-[72px] h-[72px] object-cover rounded-md border border-[var(--line)]" />
                        <div className="text-[9.5px] font-bold text-[var(--ink-faint)] mt-1 text-center">PASSPORT</div>
                      </div>
                    ) : null}
                    {open.data?.idImage ? (
                      <div>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={open.data.idImage} alt="ID document" className="w-[120px] h-[72px] object-cover rounded-md border border-[var(--line)]" />
                        <div className="text-[9.5px] font-bold text-[var(--ink-faint)] mt-1 text-center">
                          {String(open.data?.id?.type ?? "id").replace(/_/g, " ").toUpperCase()}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  {open.data?.id ? (
                    <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1 text-[11.5px]">
                      <IdLine k="ID number" v={open.data.id.number} />
                      <IdLine k="Name on ID" v={open.data.id.name} />
                      <IdLine k="DOB on ID" v={open.data.id.dob} />
                      <IdLine k="Gender" v={open.data.id.gender} />
                      {open.data.id.issuedAt ? <IdLine k="Issued" v={open.data.id.issuedAt} /> : null}
                      {open.data.id.expiryAt ? <IdLine k="Expires" v={open.data.id.expiryAt} /> : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <Detail label="Phone" value={open.phone} />
              <Detail label="Email" value={open.email} />
              <Detail label="Area" value={open.area} />
              <Detail label="Date of birth" value={open.data?.dob} />
              <Detail label="Gender" value={open.data?.gender} />
              <Detail label="National ID" value={open.data?.nationalId} />
              <Detail label="Bike" value={open.data?.bikeRegNo ? `${open.data.bikeRegNo}${open.data.bikeModel ? ` · ${open.data.bikeModel}` : ""}` : null} />
              <div className="pt-2 border-t border-[var(--line)]">
                <div className="rh-label mb-2">Association-specific fields</div>
                {defs.length === 0 ? (
                  <div className="text-[12px] text-[var(--ink-faint)] font-semibold">None configured.</div>
                ) : (
                  <div className="space-y-1.5">
                    {defs.map((d) => {
                      const v = open.data?.custom?.[d.id] ?? open.data?.custom?.[String(d.id)];
                      return (
                        <div key={d.id} className="flex justify-between gap-3 text-[12.5px]">
                          <span className="text-[var(--ink-faint)] font-semibold">{d.label}</span>
                          <span className="font-bold text-right">{defLabel(v) ?? "—"}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              {open.status === "recommended" || open.status === "not_recommended" ? (
                <div className="rounded-lg p-3.5 text-[13px] leading-relaxed" style={{ background: open.status === "recommended" ? "var(--pine-soft)" : "var(--danger-soft)" }}>
                  <div className="rh-label mb-1">Chair recommendation</div>
                  <b>{open.status === "recommended" ? "Recommended for approval" : "Not recommended"}</b>
                  {open.chairNotes ? <div className="mt-1 text-[var(--ink-soft)]">{open.chairNotes}</div> : null}
                  {open.recommendedAt ? <div className="mt-1 text-[11px] text-[var(--ink-faint)] font-bold">{fmtDateTime(open.recommendedAt)}</div> : null}
                </div>
              ) : open.chairNotes ? (
                <div className="rounded-lg p-3.5 text-[13px]" style={{ background: "var(--paper)" }}>
                  <div className="rh-label mb-1">Chair notes</div>
                  {open.chairNotes}
                </div>
              ) : null}

              {open.status === "rejected" ? (
                <div className="rounded-lg p-3.5 text-[13px]" style={{ background: "var(--danger-soft)" }}>
                  <div className="rh-label mb-1" style={{ color: "var(--danger)" }}>Rejected</div>
                  <b>Reason:</b> {open.rejectionReason}
                  {open.decisionNotes ? <div className="mt-1 text-[var(--ink-soft)]">{open.decisionNotes}</div> : null}
                  {open.decisionAt ? <div className="mt-1 text-[11px] text-[var(--ink-faint)] font-bold">{fmtDateTime(open.decisionAt)}</div> : null}
                </div>
              ) : open.status === "approved" ? (
                <div className="rounded-lg p-3.5 text-[13px]" style={{ background: "var(--pine-soft)" }}>
                  <b>Approved</b>
                  {open.decisionNotes ? <div className="mt-1 text-[var(--ink-soft)]">{open.decisionNotes}</div> : null}
                </div>
              ) : null}

              <div className="border-t border-[var(--line)] pt-4">
                <div className="flex items-center gap-2 mb-3 text-[13px] font-bold">
                  <IconFlow className="w-4 h-4" />
                  {canChair && chairActions.includes(open.status) ? "Chairperson decision (stage 1 of 2)" : canDecide && open.status !== "approved" ? "Final decision (stage 2 of 2)" : "No actions available for your role"}
                </div>

                {canChair && chairActions.includes(open.status) ? (
                  <div className="space-y-3">
                    {open.status === "submitted" ? (
                      <button className="rh-btn rh-btn-outline w-full justify-center" disabled={busy} onClick={() => act("review")}>
                        Start review
                      </button>
                    ) : null}
                    <Field label="Recommendation notes" hint="Required for recommend / not-recommend.">
                      <textarea className="rh-input min-h-[70px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. ID verified in person, dues receipt checked…" />
                    </Field>
                    <div className="grid grid-cols-3 gap-2">
                      <button className="rh-btn rh-btn-primary justify-center" disabled={busy || !notes.trim()} onClick={() => act("recommended")}>
                        <IconCheck className="w-4 h-4" /> Recommend
                      </button>
                      <button className="rh-btn rh-btn-outline justify-center" disabled={busy || !notes.trim()} onClick={() => act("not_recommended")}>
                        <IconX className="w-4 h-4" /> Not recommended
                      </button>
                      <button className="rh-btn rh-btn-outline justify-center" disabled={busy || !notes.trim()} onClick={() => act("changes_requested")}>
                        Request changes
                      </button>
                    </div>
                    <div className="text-[11.5px] text-[var(--ink-faint)] font-semibold">
                      Final approval is made by an association administrator.
                    </div>
                  </div>
                ) : canDecide && open.status !== "approved" && open.status !== "rejected" ? (
                  <div className="space-y-3">
                    <Field label={action === "rejected" ? "Rejection reason (required)" : "Decision notes"}>
                      <textarea className="rh-input min-h-[70px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
                    </Field>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        className="rh-btn justify-center"
                        style={{ background: "var(--pine)", color: "#fff" }}
                        disabled={busy}
                        onClick={() => act("approved")}
                      >
                        <IconCheck className="w-4 h-4" /> Approve & issue number
                      </button>
                      <button
                        className="rh-btn rh-btn-danger justify-center"
                        disabled={busy || !notes.trim()}
                        onClick={() => act("rejected")}
                      >
                        <IconX className="w-4 h-4" /> Reject
                      </button>
                    </div>
                    <div className="text-[11.5px] text-[var(--ink-faint)] font-semibold">
                      Approving creates the member record and issues a membership number in one transaction.
                    </div>
                  </div>
                ) : null}
              </div>
              {error ? <ErrorNote msg={error} /> : null}
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-3 text-[13px]">
      <span className="text-[var(--ink-faint)] font-semibold">{label}</span>
      <span className="font-bold text-right">{value ?? "—"}</span>
    </div>
  );
}

function IdLine({ k, v }: { k: string; v: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-2 min-w-0">
      <span className="text-[var(--ink-faint)] font-semibold shrink-0">{k}</span>
      <span className="font-bold truncate">{v || "—"}</span>
    </div>
  );
}
