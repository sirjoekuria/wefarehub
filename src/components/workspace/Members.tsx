"use client";

import { useEffect, useMemo, useState } from "react";
import type { Ctx } from "./ctx";
import { Spinner, StatusPill, EmptyState, Modal, Field, ErrorNote, fmtDate, fmtDateTime, Avatar } from "@/components/rh-ui";
import { IconSearch, IconCard, IconTransfer, IconDownload, IconX, IconStages, IconPlus, IconLink, IconCheck } from "@/components/icons";

type Member = {
  id: number; firstName: string; middleName: string | null; surname: string; phone: string | null;
  email: string | null; area: string | null; dob: string | null; gender: string | null;
  nationalId: string | null; photoUrl: string | null;
  idImageUrl: string | null; idType: string | null; idNumber: string | null; idName: string | null;
  idDob: string | null; idGender: string | null; idIssuedAt: string | null; idExpiryAt: string | null;
  bikeRegNo: string | null; bikeModel: string | null;
  membershipNumber: string | null; existingQrId: string | null; status: string; source: string;
  registrationDate: string | null; approvedAt: string | null; stationId: number; stationName: string;
  customValues: Record<string, string>; transferCount: number;
};
type Transfer = {
  id: number; memberId: number; memberName: string; membershipNumber: string | null;
  fromStation: string; toStation: string; reason: string; status: string; decidedAt: string | null; createdAt: string;
};

export function Members({ org, isChair, isOfficer, stationFilter, setStationFilter, refreshKey, refresh }: Ctx) {
  const [rows, setRows] = useState<Member[] | null>(null);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState<Member | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"" | "status" | "transfer">("");
  const [newStatus, setNewStatus] = useState("active");
  const [toStation, setToStation] = useState<number>(0);
  const [transferReason, setTransferReason] = useState("");
  const [stations, setStations] = useState<{ id: number; name: string; code: string; isArchived: boolean; memberCount: number }[]>([]);
  const [stationQuery, setStationQuery] = useState("");
  const [stationOpen, setStationOpen] = useState(false);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [selectedStationId, setSelectedStationId] = useState<number>(0);
  const [copiedLink, setCopiedLink] = useState(false);

  const load = () => {
    const qs = new URLSearchParams({ orgId: String(org.id) });
    if (q.trim()) qs.set("q", q.trim());
    if (status !== "all") qs.set("status", status);
    if (!isChair && stationFilter !== "all") qs.set("stationId", String(stationFilter));
    fetch(`/api/members?${qs}`).then((r) => r.json()).then((d) => setRows(Array.isArray(d) ? d : [])).catch(() => setRows([]));
    if (!isChair)
      fetch(`/api/transfers?orgId=${org.id}`).then((r) => r.json()).then((d) => setTransfers(Array.isArray(d) ? d : [])).catch(() => {});
  };
  useEffect(load, [org.id, q, status, stationFilter, refreshKey]);
  useEffect(() => {
    if (isChair) return;
    fetch(`/api/stations?orgId=${org.id}`)
      .then((r) => r.json())
      .then((d) => setStations((d ?? []) as { id: number; name: string; code: string; isArchived: boolean; memberCount: number }[]))
      .catch(() => {});
  }, [org.id, isChair]);

  const stationMatches = useMemo(
    () =>
      stations
        .filter((s) => !s.isArchived)
        .filter(
          (s) =>
            s.name.toLowerCase().includes(stationQuery.toLowerCase()) ||
            s.code.toLowerCase().includes(stationQuery.toLowerCase()),
        ),
    [stations, stationQuery],
  );
  const activeStation = stationFilter === "all" ? null : stations.find((s) => s.id === stationFilter) ?? null;

  const filtered = useMemo(() => rows ?? [], [rows]);

  async function saveStatus() {
    if (!open) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/members/${open.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: org.id, status: newStatus }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Update failed");
      setOpen(null);
      setMode("");
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function requestTransfer() {
    if (!open) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/members/${open.id}/transfers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: org.id, toStationId: toStation, reason: transferReason }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Transfer request failed");
      setMode("");
      setOpen(null);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transfer request failed");
    } finally {
      setBusy(false);
    }
  }

  const memberTransfers = transfers.filter((t) => open && t.memberId === open.id);

  return (
    <div className="w-full space-y-5">
      <div className="flex flex-wrap gap-2 items-center">
        {!isChair ? (
          <div className="relative w-full sm:w-72">
            <IconStages className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-faint)]" />
            <input
              className="rh-input !pl-9"
              placeholder="Search pickup station…"
              value={stationQuery}
              onChange={(e) => {
                setStationQuery(e.target.value);
                setStationOpen(true);
              }}
              onFocus={() => setStationOpen(true)}
              onBlur={() => setTimeout(() => setStationOpen(false), 150)}
            />
            {stationOpen && stationMatches.length > 0 ? (
              <div className="absolute z-30 top-full mt-1 w-full rh-card shadow-lg max-h-64 overflow-y-auto">
                {stationMatches.map((s) => (
                  <button
                    key={s.id}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-[var(--paper)] flex items-center justify-between gap-3"
                    onClick={() => {
                      setStationFilter(s.id);
                      setStationQuery("");
                      setStationOpen(false);
                    }}
                  >
                    <span className="min-w-0">
                      <span className="block font-bold text-[13px] truncate">{s.name}</span>
                      <span className="block text-[11px] text-[var(--ink-faint)] font-semibold">{s.code}</span>
                    </span>
                    <span className="text-[11.5px] font-bold text-[var(--ink-soft)] shrink-0">{s.memberCount} members</span>
                  </button>
                ))}
              </div>
            ) : stationOpen && stationQuery.trim() ? (
              <div className="absolute z-30 top-full mt-1 w-full rh-card shadow-lg px-3.5 py-3 text-[12.5px] text-[var(--ink-faint)] font-semibold">
                No stations match “{stationQuery}”.
              </div>
            ) : null}
          </div>
        ) : null}

        {activeStation ? (
          <span className="rh-pill" style={{ background: "var(--pine-soft)", color: "var(--pine-deep)" }}>
            <span className="dot" /> {activeStation.name}
            <button
              className="ml-0.5 hover:opacity-70"
              onClick={() => setStationFilter("all")}
              aria-label="Clear station filter"
            >
              <IconX className="w-3 h-3" />
            </button>
          </span>
        ) : null}

        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <a
            className="rh-btn rh-btn-outline"
            href={`/api/reports/members?orgId=${org.id}${!isChair && stationFilter !== "all" ? `&stationId=${stationFilter}` : ""}`}
            download
          >
            <IconDownload className="w-4 h-4" /> CSV register
          </a>
          <button
            className="rh-btn rh-btn-primary flex items-center gap-1.5 font-bold shadow-sm"
            onClick={() => {
              const initialSt = stations[0]?.id ?? (typeof stationFilter === "number" ? stationFilter : 0);
              setSelectedStationId(initialSt);
              setRegisterModalOpen(true);
            }}
          >
            <IconPlus className="w-4 h-4" />
            <span>Register New Member</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <IconSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-faint)]" />
          <input
            className="rh-input !w-full sm:!w-64 !pl-9"
            placeholder="Search member name, number, phone…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select className="rh-input !w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          {["all", "active", "pending", "suspended", "inactive", "transferred", "deceased", "archived"].map((s) => (
            <option key={s} value={s}>
              {s === "all" ? "All statuses" : s}
            </option>
          ))}
        </select>
        {activeStation ? (
          <span className="text-[12px] font-bold text-[var(--ink-faint)]">
            Showing {activeStation.name} members
          </span>
        ) : null}
      </div>

      {!rows ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <div className="rh-card">
          <EmptyState title="No members match" body="Try a different search or filter — or approve an application to add a member." />
        </div>
      ) : (
        <div className="rh-card overflow-x-auto">
          <table className="rh-table min-w-[640px]">
            <thead>
              <tr>
                <th>Member</th>
                {!isChair ? <th>Station</th> : null}
                <th>Phone</th>
                <th>Status</th>
                <th>Registered</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id} className="cursor-pointer" onClick={() => { setOpen(m); setMode(""); setError(""); }}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={`${m.firstName} ${m.surname}`} />
                      <div>
                        <button
                          className="font-bold text-left hover:underline"
                          style={{ color: "var(--org-primary)" }}
                          title="Open member details"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpen(m);
                            setMode("");
                            setError("");
                          }}
                        >
                          {m.firstName} {m.middleName ? `${m.middleName} ` : ""}{m.surname}
                        </button>
                        <div className="font-mono text-[11.5px] text-[var(--ink-faint)]">{m.membershipNumber ?? "no number yet"}</div>
                      </div>
                    </div>
                  </td>
                  {!isChair ? <td className="text-[var(--ink-soft)]">{m.stationName}</td> : null}
                  <td className="font-mono text-[12px]">{m.phone ?? "—"}</td>
                  <td><StatusPill status={m.status} /></td>
                  <td className="text-[var(--ink-soft)] text-[12.5px]">{fmtDate(m.registrationDate)}</td>
                  <td className="text-right whitespace-nowrap">
                    <button className="rh-btn rh-btn-ghost rh-btn-sm" title="Membership card">
                      <IconCard className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open ? (
        <Modal wide title={`Member · ${open.firstName} ${open.surname}`} onClose={() => setOpen(null)}>
          <div className="grid md:grid-cols-[1fr_1.15fr] gap-5">
            <div className="space-y-2.5">
              <div className="flex items-center gap-3">
                <Avatar name={`${open.firstName} ${open.surname}`} size={48} photoUrl={open.photoUrl} />
                <div>
                  <div className="font-display font-bold text-[16px]">
                    {open.firstName} {open.middleName ? `${open.middleName} ` : ""}{open.surname}
                  </div>
                  <div className="font-mono text-[12.5px] text-[var(--ink-faint)]">{open.membershipNumber ?? "—"}</div>
                </div>
                <div className="ml-auto"><StatusPill status={open.status} /></div>
              </div>
              {open.photoUrl || open.idImageUrl ? (
                <div className="rounded-lg border border-[var(--line)] p-3" style={{ background: "var(--paper)" }}>
                  <div className="rh-label mb-2">Verification documents</div>
                  <div className="flex items-start gap-3">
                    {open.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={open.photoUrl} alt="Passport photo" className="w-16 h-16 object-cover rounded-md border border-[var(--line)]" />
                    ) : null}
                    {open.idImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={open.idImageUrl} alt="ID document" className="w-24 h-16 object-cover rounded-md border border-[var(--line)]" />
                    ) : null}
                  </div>
                  {open.idType ? (
                    <div className="mt-2 text-[11px] font-semibold text-[var(--ink-faint)]">
                      {open.idType.replace(/_/g, " ")} · {open.idNumber}
                      {open.idExpiryAt ? ` · expires ${open.idExpiryAt}` : ""}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2 border-t border-[var(--line)] text-[13px]">
                <KV k="Station" v={open.stationName} />
                <KV k="Registered" v={fmtDate(open.registrationDate)} />
                <KV k="Phone" v={open.phone ?? "—"} />
                <KV k="Alt phone" v={open.email ? open.email : "—"} />
                <KV k="Area" v={open.area ?? "—"} />
                <KV k="DOB" v={open.dob ?? "—"} />
                <KV k="Bike" v={open.bikeRegNo ? `${open.bikeRegNo}${open.bikeModel ? ` · ${open.bikeModel}` : ""}` : "—"} />
                <KV k="Source" v={open.source} />
              </div>
              {Object.keys(open.customValues).length > 0 ? (
                <div className="pt-2 border-t border-[var(--line)]">
                  <div className="rh-label mb-2">Association fields</div>
                  <div className="space-y-1.5">
                    {Object.entries(open.customValues).map(([k, v]) => (
                      <div key={k} className="flex justify-between text-[12.5px] gap-3">
                        <span className="text-[var(--ink-faint)] font-semibold">{k}</span>
                        <span className="font-bold text-right">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {memberTransfers.length > 0 ? (
                <div className="pt-2 border-t border-[var(--line)]">
                  <div className="rh-label mb-2">Transfer history</div>
                  <div className="space-y-1.5">
                    {memberTransfers.map((t) => (
                      <div key={t.id} className="text-[12.5px] flex items-center gap-2">
                        <IconTransfer className="w-3.5 h-3.5 text-[var(--ink-faint)]" />
                        <span>
                          {t.fromStation} → <b>{t.toStation}</b> · <StatusPill status={t.status} />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-[var(--line)] p-4" style={{ background: "var(--paper)" }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="font-bold text-[13.5px]">Digital membership card</div>
                  <a href={`/card/${open.id}?orgId=${org.id}`} target="_blank" rel="noreferrer" className="rh-btn rh-btn-primary rh-btn-sm">
                    <IconCard className="w-4 h-4" /> View / print PDF
                  </a>
                </div>
                <CardPreview member={open} orgCode={org.code} orgName={org.name} motto={org.motto} primary={org.primaryColor} secondary={org.secondaryColor} accent={org.accentColor} />
              </div>

              {isOfficer ? (
                <div className="border-t border-[var(--line)] pt-4">
                  {mode === "" ? (
                    <div className="flex flex-wrap gap-2">
                      <button className="rh-btn rh-btn-outline rh-btn-sm" onClick={() => { setMode("status"); setNewStatus(open.status); }}>
                        Change status
                      </button>
                      <button className="rh-btn rh-btn-outline rh-btn-sm" onClick={() => { setMode("transfer"); setToStation(stations.find((s) => !s.isArchived)?.id ?? 0); setTransferReason(""); }}>
                        <IconTransfer className="w-4 h-4" /> Request transfer
                      </button>
                    </div>
                  ) : mode === "status" ? (
                    <div className="space-y-2.5">
                      <Field label="New status">
                        <select className="rh-input" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                          {["active", "suspended", "inactive", "deceased", "archived"].map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </Field>
                      <div className="flex gap-2">
                        <button className="rh-btn rh-btn-primary rh-btn-sm" disabled={busy} onClick={saveStatus}>Save</button>
                        <button className="rh-btn rh-btn-ghost rh-btn-sm" onClick={() => setMode("")}><IconX className="w-3.5 h-3.5" /> Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <Field label="Destination station">
                        <select className="rh-input" value={toStation} onChange={(e) => setToStation(Number(e.target.value))}>
                          <option value={0}>Select…</option>
                          {stations.filter((s) => !s.isArchived && s.id !== open.stationId).map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Reason (required)">
                        <textarea className="rh-input min-h-[60px]" value={transferReason} onChange={(e) => setTransferReason(e.target.value)} />
                      </Field>
                      <div className="flex gap-2">
                        <button className="rh-btn rh-btn-primary rh-btn-sm" disabled={busy || !toStation || !transferReason.trim()} onClick={requestTransfer}>
                          Submit transfer request
                        </button>
                        <button className="rh-btn rh-btn-ghost rh-btn-sm" onClick={() => setMode("")}>Cancel</button>
                      </div>
                      <div className="text-[11px] text-[var(--ink-faint)] font-semibold">
                        Transfers are approved separately; the member keeps their number, registration date and history.
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-[12px] text-[var(--ink-faint)] font-semibold border-t border-[var(--line)] pt-3">
                  Status changes and transfers are handled by association administrators.
                </div>
              )}
              {error ? <ErrorNote msg={error} /> : null}
            </div>
          </div>
        </Modal>
      ) : null}

      {registerModalOpen ? (
        <Modal title="Register New Member · Station Link" onClose={() => setRegisterModalOpen(false)}>
          <div className="space-y-4">
            <p className="text-[13px] text-[var(--ink-soft)] leading-relaxed">
              Every rider application is tied to a specific pickup station. Select the stage below to get its unique short registration link or open the form directly.
            </p>

            <Field label="Choose Pickup Station">
              <select
                className="rh-input font-medium"
                value={selectedStationId}
                onChange={(e) => setSelectedStationId(Number(e.target.value))}
              >
                {stations.filter((s) => !s.isArchived).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code}) — {s.memberCount} members
                  </option>
                ))}
              </select>
            </Field>

            {(() => {
              const currentSt = stations.find((s) => s.id === selectedStationId) ?? stations[0];
              if (!currentSt) return null;
              const shortSlug = currentSt.code.toLowerCase();
              const fullUrl = `https://welfare-delta-nine.vercel.app/join/${shortSlug}`;

              return (
                <div className="rounded-2xl border-2 border-[var(--line-strong)] p-4 bg-[var(--paper)] space-y-3">
                  <div>
                    <div className="text-[11px] font-bold text-[var(--ink-faint)] uppercase tracking-wider">
                      Unique Short Registration Link for {currentSt.name}
                    </div>
                    <div className="font-mono text-[13.5px] font-bold text-[var(--pine-deep)] mt-1 break-all bg-[var(--bg)] p-2.5 rounded-lg border border-[var(--line)]">
                      {fullUrl}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      className="rh-btn rh-btn-primary flex-1 justify-center font-bold shadow-sm"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(fullUrl);
                          setCopiedLink(true);
                          setTimeout(() => setCopiedLink(false), 2000);
                        } catch {
                          window.prompt("Copy link:", fullUrl);
                        }
                      }}
                    >
                      {copiedLink ? (
                        <>
                          <IconCheck className="w-4 h-4" /> Copied to Clipboard!
                        </>
                      ) : (
                        <>
                          <IconLink className="w-4 h-4" /> Copy Short Link
                        </>
                      )}
                    </button>
                    <a
                      className="rh-btn rh-btn-outline font-bold flex-1 justify-center"
                      href={`/join/${shortSlug}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open Form Now ↗
                    </a>
                  </div>

                  <div className="text-[11.5px] text-[var(--ink-soft)] bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 space-y-1">
                    <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                      <span>✓</span> Two-Stage Approval Workflow:
                    </div>
                    <div>1. Rider submits passport photo, ID/DL photo, and motorcycle info.</div>
                    <div>2. Station chairperson reviews & recommends.</div>
                    <div>3. Association admin grants final approval and issues digital card.</div>
                  </div>
                </div>
              );
            })()}

            <div className="flex justify-end pt-2">
              <button className="rh-btn rh-btn-ghost" onClick={() => setRegisterModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="rh-label !text-[10px]">{k}</div>
      <div className="font-bold mt-0.5">{v}</div>
    </div>
  );
}

function CardPreview({
  member, orgCode, orgName, motto, primary, secondary, accent,
}: {
  member: Member; orgCode: string; orgName: string; motto: string | null;
  primary: string; secondary: string; accent: string;
}) {
  return (
    <div
      className="rh-member-card !w-full max-w-[340px] mx-auto"
      style={{ ["--mc-primary" as never]: primary, ["--mc-secondary" as never]: secondary, ["--mc-accent" as never]: accent }}
    >
      <div className="mc-band" />
      <div className="mc-body">
        <div className="flex items-center justify-between">
          <div>
            <div className="rh-label">Membership</div>
            <div className="font-display font-bold text-[21px] tracking-tight" style={{ color: secondary }}>
              {member.membershipNumber ?? "—"}
            </div>
          </div>
          <div className="w-[84px] h-[84px] rounded-lg bg-white border border-[var(--line)] flex items-center justify-center text-[8.5px] font-bold text-[var(--ink-faint)] text-center px-1 leading-tight">
            QR
            <br />
            RIDERHUB
          </div>
        </div>
        <div className="mt-4 border-t border-[var(--line)] pt-3">
          <div className="font-bold text-[14.5px]">
            {member.firstName} {member.middleName ? `${member.middleName} ` : ""}{member.surname}
          </div>
          <div className="text-[12px] text-[var(--ink-soft)] mt-0.5">
            {member.stationName} · {member.status} member
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="text-[10.5px] font-bold" style={{ color: primary }}>{orgName}</div>
          <div className="text-[9.5px] text-[var(--ink-faint)]">{motto}</div>
        </div>
      </div>
    </div>
  );
}
