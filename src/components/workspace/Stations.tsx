"use client";

import { useEffect, useState } from "react";
import type { Ctx } from "./ctx";
import { Spinner, EmptyState, Modal, Field, ErrorNote, StatusPill } from "@/components/rh-ui";
import { IconPlus, IconLink, IconStages, IconX, IconCheck } from "@/components/icons";

type Station = {
  id: number; name: string; code: string; location: string | null; description: string | null;
  isArchived: boolean; memberCount: number; activeMemberCount: number; pendingApplications: number;
  chairperson: string | null; secretary: string | null; deputy: string | null;
};
type Candidate = { id: number; memberId: number; fullName: string; phone: string; membershipNumber: string };
type Invitation = { id: number; token: string; isRevoked: boolean; expiresAt: string; usesCount: number; maxUses: number };

export function Stations({ org, refreshKey, refresh, isOfficer }: Ctx) {
  const [rows, setRows] = useState<Station[] | null>(null);
  const [invites, setInvites] = useState<Record<number, Invitation>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [edit, setEdit] = useState<Station | null>(null);
  const [form, setForm] = useState({ name: "", code: "", location: "", description: "" });
  const [officials, setOfficials] = useState({ chairpersonUserId: 0, secretaryUserId: 0, deputyUserId: 0 });
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  const load = () => {
    fetch(`/api/stations?orgId=${org.id}`)
      .then((r) => r.json())
      .then((d) => {
        setRows(Array.isArray(d) ? d : []);
        const map: Record<number, Invitation> = {};
        (Array.isArray(d) ? d : []).forEach((s: any) => {
          if (s.invitation) map[s.id] = s.invitation;
        });
        setInvites(map);
      })
      .catch(() => setRows([]));
  };
  useEffect(load, [org.id, refreshKey]);

  async function loadInvites(stationId: number) {
    // invitations are exposed via the create/revoke responses; list through same endpoint pattern
    const res = await fetch(`/api/stations/${stationId}/invitation`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orgId: org.id, action: "list" }) });
    if (res.ok) {
      const d = await res.json();
      if (d.active) setInvites((m) => ({ ...m, [stationId]: d.active }));
      else setInvites((m) => ({ ...m, [stationId]: undefined as never }));
    }
  }
  useEffect(() => {
    if (rows) rows.filter((r) => !r.isArchived).forEach((r) => loadInvites(r.id).catch(() => {}));
  }, [rows]);

  useEffect(() => {
    if (edit && isOfficer) {
      setCandidates([]);
      fetch(`/api/org/candidates?orgId=${org.id}&stationId=${edit.id}`)
        .then((r) => r.json())
        .then((d) => setCandidates(Array.isArray(d) ? d : []))
        .catch(() => setCandidates([]));
    }
  }, [edit?.id, org.id, isOfficer]);

  async function createStation() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/stations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: org.id, ...form }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Create failed");
      setCreateOpen(false);
      setForm({ name: "", code: "", location: "", description: "" });
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    if (!edit) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/stations/${edit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: org.id,
          name: form.name,
          code: form.code,
          location: form.location,
          description: form.description,
          chairpersonUserId: officials.chairpersonUserId || null,
          secretaryUserId: officials.secretaryUserId || null,
          deputyUserId: officials.deputyUserId || null,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Save failed");
      setEdit(null);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function invite(stationId: number, action: "create" | "revoke") {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/stations/${stationId}/invitation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: org.id, action }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Action failed");
      if (action === "create") setInvites((m) => ({ ...m, [stationId]: d as Invitation }));
      else setInvites((m) => ({ ...m, [stationId]: undefined as never }));
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  if (!rows) return <Spinner />;

  return (
    <div className="w-full space-y-5">
      <div className="flex items-center">
        <div className="text-[13px] text-[var(--ink-soft)] font-semibold">
          Every station belongs to this association only. A station can have at most <b>one active chairperson</b> (enforced in the database).
        </div>
        <div className="flex-1" />
        {isOfficer ? (
          <button className="rh-btn rh-btn-primary" onClick={() => { setCreateOpen(true); setError(""); }}>
            <IconPlus className="w-4 h-4" /> New station
          </button>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <div className="rh-card"><EmptyState title="No stations yet" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {rows.map((s) => {
            const inv = invites[s.id];
            const active = inv && !inv.isRevoked && new Date(inv.expiresAt) > new Date();
            return (
              <div key={s.id} className="rh-card p-5 flex flex-col gap-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-lg flex items-center justify-center text-white" style={{ background: "var(--org-primary)" }}>
                      <IconStages className="w-5 h-5" />
                    </span>
                    <div>
                      <div className="font-display font-bold text-[15.5px]">{s.name}</div>
                      <div className="text-[11.5px] font-semibold text-[var(--ink-faint)]">
                        {s.code} · {s.location ?? "no location"} {s.isArchived ? "· archived" : ""}
                      </div>
                    </div>
                  </div>
                  {isOfficer ? (
                    <button
                      className="rh-btn rh-btn-outline rh-btn-sm"
                      onClick={() => {
                        setEdit(s);
                        setForm({ name: s.name, code: s.code, location: s.location ?? "", description: s.description ?? "" });
                        setOfficials({ chairpersonUserId: 0, secretaryUserId: 0, deputyUserId: 0 });
                        setError("");
                      }}
                    >
                      Manage
                    </button>
                  ) : null}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <MiniStat label="Members" value={s.memberCount} />
                  <MiniStat label="Active" value={s.activeMemberCount} />
                  <MiniStat label="Pending" value={s.pendingApplications} />
                </div>

                <div className="text-[12.5px] space-y-1">
                  <OfficialRow label="Chairperson" value={s.chairperson} />
                  <OfficialRow label="Secretary" value={s.secretary} />
                  <OfficialRow label="Deputy" value={s.deputy} />
                </div>

                <InviteBox
                  stationId={s.id}
                  stationCode={s.code}
                  stationName={s.name}
                  invite={inv}
                  active={!!active}
                  isOfficer={isOfficer}
                  busy={busy}
                  onAction={(a) => invite(s.id, a)}
                />
              </div>
            );
          })}
        </div>
      )}

      {error ? <ErrorNote msg={error} /> : null}

      {createOpen ? (
        <Modal title="New pickup station" onClose={() => setCreateOpen(false)}>
          <div className="space-y-3">
            <Field label="Station name">
              <input className="rh-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Kimwi Stage" />
            </Field>
            <Field label="Station code" hint="Unique within this association, e.g. GKA-NEW">
              <input className="rh-input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
            </Field>
            <Field label="Location">
              <input className="rh-input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </Field>
            <Field label="Description">
              <textarea className="rh-input min-h-[60px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <div className="flex gap-2 pt-1">
              <button className="rh-btn rh-btn-primary" disabled={busy || !form.name.trim() || !form.code.trim()} onClick={createStation}>
                Create station
              </button>
              <button className="rh-btn rh-btn-ghost" onClick={() => setCreateOpen(false)}>Cancel</button>
            </div>
          </div>
        </Modal>
      ) : null}

      {edit ? (
        <Modal title={`Manage · ${edit.name}`} onClose={() => setEdit(null)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Name">
                <input className="rh-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="Code">
                <input className="rh-input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
              </Field>
            </div>
            <Field label="Location">
              <input className="rh-input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </Field>
            <Field label="Description">
              <textarea className="rh-input min-h-[60px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>

            <div className="pt-2 border-t border-[var(--line)]">
              <div className="flex items-center justify-between mb-1">
                <div className="rh-label font-bold text-[13px]">Station Officials ({edit.name})</div>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[var(--pine-soft)] text-[var(--pine-deep)]">
                  {candidates.length} registered member{candidates.length === 1 ? "" : "s"} at this stage
                </span>
              </div>
              <p className="text-[11.5px] text-[var(--ink-soft)] mb-3 leading-relaxed">
                Per association rules, only registered members of <b>{edit.name}</b> can be appointed to leadership roles for this station.
              </p>

              {candidates.length === 0 ? (
                <div className="rounded-xl p-3.5 bg-amber-500/10 border border-amber-500/25 text-amber-900 text-[12px] space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <span>⚠️</span> No registered members at this station yet
                  </div>
                  <div className="text-[11.5px] text-amber-800">
                    Use the unique registration link <b>/join/{edit.code}</b> to register members to <b>{edit.name}</b> first. Once members are approved, they will appear here as available candidates.
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {(["chairperson", "secretary", "deputy"] as const).map((r) => (
                    <div key={r} className="flex items-center gap-2.5">
                      <div className="w-28 text-[12px] font-bold text-[var(--ink-soft)] capitalize">
                        {r.replace("_", " ")}
                      </div>
                      <select
                        className="rh-input !w-auto flex-1 font-medium text-xs"
                        value={officials[`${r}UserId` as keyof typeof officials] as number}
                        onChange={(e) =>
                          setOfficials({ ...officials, [`${r}UserId`]: Number(e.target.value) })
                        }
                      >
                        <option value={0}>Unassigned</option>
                        {candidates.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.fullName} — {c.membershipNumber} ({c.phone})
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-2.5 text-[11px] text-[var(--ink-faint)] font-semibold">
                Note: A member can only serve as the active chairperson of one station at a time.
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button className="rh-btn rh-btn-primary" disabled={busy} onClick={saveEdit}>Save changes</button>
              <button className="rh-btn rh-btn-ghost" onClick={() => setEdit(null)}><IconX className="w-4 h-4" /> Cancel</button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function InviteBox({
  stationId,
  stationCode,
  stationName,
  invite,
  active,
  isOfficer,
  busy,
  onAction,
}: {
  stationId: number;
  stationCode: string;
  stationName: string;
  invite?: { token: string };
  active: boolean;
  isOfficer: boolean;
  busy: boolean;
  onAction: (a: "create" | "revoke") => void;
}) {
  const [copied, setCopied] = useState(false);
  const shortSlug = stationCode.toLowerCase();
  const BASE_URL = "https://welfare-delta-nine.vercel.app";
  const url = `${BASE_URL}/join/${shortSlug}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy registration link:", url);
    }
  }

  return (
    <div className="mt-auto rounded-xl border border-[var(--line)] p-3.5 bg-[var(--paper)] space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-bold text-[var(--ink-faint)] uppercase tracking-wider flex items-center gap-1.5">
            <span>🔗 Registration Link</span>
          </div>
          <div className="font-mono text-[13px] font-bold text-[var(--pine-deep)] flex items-center gap-1.5 mt-0.5">
            <span>/join/{shortSlug}</span>
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-700">
              {stationCode}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            className="rh-btn rh-btn-primary rh-btn-sm font-bold shadow-sm"
            onClick={copy}
            title={`Copy ${url} to share with riders`}
          >
            {copied ? (
              <>
                <IconCheck className="w-3.5 h-3.5" /> Copied!
              </>
            ) : (
              <>
                <IconLink className="w-3.5 h-3.5" /> Copy Link
              </>
            )}
          </button>
          <a
            className="rh-btn rh-btn-outline rh-btn-sm font-bold"
            href={`/join/${shortSlug}`}
            target="_blank"
            rel="noreferrer"
            title="Open registration page for this station"
          >
            Open ↗
          </a>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--line)] py-2" style={{ background: "#fff" }}>
      <div className="font-display font-bold text-[19px] leading-none">{value}</div>
      <div className="rh-label mt-1">{label}</div>
    </div>
  );
}

function OfficialRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between">
      <span className="text-[var(--ink-faint)] font-semibold">{label}</span>
      <span className={`font-bold ${value ? "" : "text-[#8a6400]"}`}>{value ?? "unassigned"}</span>
    </div>
  );
}
