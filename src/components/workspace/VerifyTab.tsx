"use client";

import { useState } from "react";
import type { Ctx } from "./ctx";
import { StatusPill, ErrorNote, fmtDate, Avatar } from "@/components/rh-ui";
import { IconShield, IconSearch, IconLink, IconCheck } from "@/components/icons";
import { normalizeMemberNumber, sameMemberNumber } from "@/lib/memberNumber";

type Found = {
  id: number;
  firstName: string;
  middleName: string | null;
  surname: string;
  membershipNumber: string | null;
  photoUrl: string | null;
  stationName: string;
  status: string;
  registrationDate: string | null;
};

export function VerifyTab({ org }: Ctx) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Found | null>(null);
  const [searched, setSearched] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    const num = q.trim().toUpperCase();
    if (!num || busy) return;
    setBusy(true);
    setError("");
    setResult(null);
    setSearched(null);
    try {
      // tolerant match: "GKA 2", "gka-002", "GKA02" all resolve to GKA-0002
      const normalized = normalizeMemberNumber(num);
      const searchQ = normalized ?? num.replace(/[^A-Za-z0-9]/g, "");
      const res = await fetch(`/api/members?orgId=${org.id}&q=${encodeURIComponent(searchQ)}`);
      const rows: Found[] = res.ok ? await res.json() : [];
      const hit = Array.isArray(rows) ? rows.find((m) => sameMemberNumber(m.membershipNumber, num)) : null;
      setResult(hit ?? null);
      setSearched(num);
    } catch {
      setError("Lookup failed — please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copyShare() {
    if (!result?.membershipNumber) return;
    const url = `${window.location.origin}/verify/${result.membershipNumber}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("Copy this verification link:", url);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const shareUrl = result?.membershipNumber ? `/verify/${result.membershipNumber}` : "";

  return (
    <div className="max-w-xl mx-auto">
      <div className="rh-card overflow-hidden shadow-lg">
        <div className="px-6 pt-5 pb-4 flex items-center gap-3" style={{ background: "var(--org-secondary)" }}>
          <span
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.12)", color: org.accentColor }}
          >
            <IconShield className="w-5 h-5" />
          </span>
          <div>
            <div className="font-display font-bold text-[16px] text-white">Member verification</div>
            <div className="text-[11.5px] text-white/60 font-semibold">
              Confirm a member's identity — minimal details only
            </div>
          </div>
        </div>

        <div className="p-6">
          <form onSubmit={lookup} className="flex gap-2">
            <div className="relative flex-1">
              <IconSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-faint)]" />
              <input
                className="rh-input !pl-9"
                placeholder="Membership number, e.g. GKA-0001"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <button type="submit" className="rh-btn rh-btn-primary" disabled={busy || !q.trim()}>
              {busy ? "Searching…" : "Look up"}
            </button>
          </form>

          {error ? <div className="mt-4"><ErrorNote msg={error} /></div> : null}

          {searched && !result ? (
            <div className="mt-5 rounded-xl border border-[var(--line)] p-5 text-center" style={{ background: "var(--paper)" }}>
              <div className="font-bold text-[14.5px]">No member found</div>
              <div className="mt-1 text-[12.5px] text-[var(--ink-soft)]">
                Number <b className="font-mono">{searched}</b> is not in the {org.name} register. Check the
                number on the member's card and try again.
              </div>
            </div>
          ) : null}

          {result ? (
            <div className="mt-5">
              <div className="rounded-xl border border-[var(--line)] overflow-hidden">
                <div className="p-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <Avatar
                      name={`${result.firstName} ${result.surname}`}
                      size={56}
                      photoUrl={result.photoUrl}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-display font-bold text-[17px] truncate">
                        {result.firstName} {result.middleName ? `${result.middleName} ` : ""}{result.surname}
                      </div>
                      <div className="text-[11.5px] text-[var(--ink-faint)] font-semibold mt-0.5">
                        Passport photo on file
                      </div>
                    </div>
                    <StatusPill status={result.status} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
                    <div>
                      <div className="rh-label !text-[10px]">Membership number</div>
                      <div className="font-mono font-bold mt-0.5">{result.membershipNumber}</div>
                    </div>
                    <div>
                      <div className="rh-label !text-[10px]">Pickup station</div>
                      <div className="font-bold mt-0.5">{result.stationName}</div>
                    </div>
                    <div>
                      <div className="rh-label !text-[10px]">Member since</div>
                      <div className="font-bold mt-0.5">{fmtDate(result.registrationDate)}</div>
                    </div>
                    <div>
                      <div className="rh-label !text-[10px]">Association</div>
                      <div className="font-bold mt-0.5">{org.name}</div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-[var(--line)] p-5" style={{ background: "var(--paper)" }}>
                  <div className="font-bold text-[13px]">Share with authorities</div>
                  <p className="mt-1 text-[12px] text-[var(--ink-soft)] leading-relaxed">
                    Send this public verification link to police, station officers or any authority that
                    needs to confirm this person. It shows only the minimum: name, number, station and
                    status — <b>never phone, ID documents or photos</b>.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <code className="text-[11.5px] font-bold bg-white border border-[var(--line)] rounded-md px-2.5 py-1.5 max-w-[220px] truncate">
                      {shareUrl}
                    </code>
                    <button className="rh-btn rh-btn-outline rh-btn-sm" onClick={copyShare}>
                      {copied ? <IconCheck className="w-3.5 h-3.5 text-[var(--pine)]" /> : <IconLink className="w-3.5 h-3.5" />}
                      {copied ? "Copied!" : "Copy link"}
                    </button>
                    <a className="rh-btn rh-btn-outline rh-btn-sm" href={shareUrl} target="_blank" rel="noreferrer">
                      Open
                    </a>
                  </div>
                </div>
              </div>

              <div className="mt-3 text-[11px] text-[var(--ink-faint)] font-semibold leading-relaxed">
                Sensitive details (phone, national ID, ID documents, photo) are available only in the
                Members admin panel to association administrators.
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
