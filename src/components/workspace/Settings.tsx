"use client";

import { useEffect, useState } from "react";
import type { Ctx } from "./ctx";
import { Spinner, ErrorNote, fmtDateTime } from "@/components/rh-ui";

const THEMES = [
  { name: "Pine", primary: "#177245", secondary: "#14201A", accent: "#F5B301" },
  { name: "Midnight", primary: "#2C5F8A", secondary: "#0D1B2A", accent: "#F5B301" },
  { name: "Graphite", primary: "#5A6472", secondary: "#16191D", accent: "#E8A33D" },
  { name: "Forest", primary: "#3A7D44", secondary: "#12291B", accent: "#E4C25B" },
  { name: "Ocean", primary: "#0E7490", secondary: "#083344", accent: "#FBBF24" },
  { name: "Wine", primary: "#8C2F39", secondary: "#2B1216", accent: "#E9B44C" },
  { name: "Indigo", primary: "#4F46E5", secondary: "#1E1B4B", accent: "#F59E0B" },
  { name: "Copper", primary: "#B45309", secondary: "#2A1A0F", accent: "#F2C14E" },
];

export function Settings({
  org,
  refreshKey,
  refresh,
  onOrgColors,
}: Ctx & {
  onOrgColors?: (c: { primaryColor: string; secondaryColor: string; accentColor: string }) => void;
}) {
  const [form, setForm] = useState({
    name: org.name,
    motto: org.motto ?? "",
    primaryColor: org.primaryColor,
    secondaryColor: org.secondaryColor,
    accentColor: org.accentColor,
    county: org.county ?? "",
    location: org.location ?? "",
    phone: org.phone ?? "",
    email: org.email ?? "",
    registrationNumber: org.registrationNumber ?? "",
    description: org.description ?? "",
    logoUrl: org.logoUrl,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [audit, setAudit] = useState<{ id: number; action: string; details: Record<string, unknown>; createdAt: string; userName: string | null }[] | null>(null);

  useEffect(() => {
    fetch(`/api/org/audit?orgId=${org.id}`).then((r) => r.json()).then((d) => setAudit(Array.isArray(d) ? d : [])).catch(() => setAudit([]));
  }, [org.id, refreshKey]);

  async function save() {
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/org/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: org.id, ...form, logoUrl: form.logoUrl ?? null }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Save failed");
      setSaved(true);
      onOrgColors?.({
        primaryColor: form.primaryColor,
        secondaryColor: form.secondaryColor,
        accentColor: form.accentColor,
      });
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 400_000) {
      setError("Logo must be under 400 KB (sandbox storage limit).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, logoUrl: String(reader.result) }));
    reader.readAsDataURL(file);
  }

  const [themeBusy, setThemeBusy] = useState(false);
  const norm = (s: string) => s.toLowerCase();
  const isCurrentTheme = (t: (typeof THEMES)[number]) =>
    norm(form.primaryColor) === norm(t.primary) &&
    norm(form.secondaryColor) === norm(t.secondary) &&
    norm(form.accentColor) === norm(t.accent);

  async function applyTheme(t: (typeof THEMES)[number]) {
    setThemeBusy(true);
    setError("");
    try {
      const res = await fetch("/api/org/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: org.id,
          primaryColor: t.primary,
          secondaryColor: t.secondary,
          accentColor: t.accent,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "Couldn't apply the theme.");
      setForm((f) => ({ ...f, primaryColor: t.primary, secondaryColor: t.secondary, accentColor: t.accent }));
      onOrgColors?.({ primaryColor: t.primary, secondaryColor: t.secondary, accentColor: t.accent });
      setSaved(true);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't apply the theme.");
    } finally {
      setThemeBusy(false);
    }
  }

  return (
    <div className="w-full space-y-6">
      <div className="rh-card p-5">
        <div className="font-display font-bold text-[16px]">Theme</div>
        <div className="mt-1 text-[12.5px] text-[var(--ink-soft)]">
          Choose a professional theme for this workspace — applied instantly to the sidebar, buttons,
          registration page and membership cards. Or fine-tune custom colours below.
        </div>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3.5">
          {THEMES.map((t) => {
            const current = isCurrentTheme(t);
            return (
              <button
                key={t.name}
                type="button"
                disabled={themeBusy}
                onClick={() => applyTheme(t)}
                className="rounded-xl border-2 p-1.5 text-left transition hover:shadow-md"
                style={{
                  borderColor: current ? t.primary : "var(--line)",
                  boxShadow: current ? `0 0 0 2px color-mix(in srgb, ${t.primary} 30%, transparent)` : undefined,
                }}
              >
                <div className="h-14 rounded-lg overflow-hidden flex" style={{ background: t.secondary }}>
                  <div className="w-2/5 border-r border-white/10" />
                  <div className="flex-1 p-2 space-y-1.5">
                    <div className="h-2 rounded-full" style={{ background: t.primary, width: "72%" }} />
                    <div className="h-2 rounded-full bg-white/25" style={{ width: "52%" }} />
                    <div className="h-2 rounded-full" style={{ background: t.accent, width: "36%" }} />
                  </div>
                </div>
                <div className={`mt-1.5 text-[11.5px] font-bold text-center ${current ? "" : "text-[var(--ink-soft)]"}`} style={current ? { color: t.primary } : undefined}>
                  {t.name}
                  {current ? " ✓" : ""}
                </div>
              </button>
            );
          })}
        </div>
        {error ? <div className="mt-3"><ErrorNote msg={error} /></div> : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      <div className="rh-card p-5 space-y-4 lg:col-span-7 xl:col-span-8">
        <div className="font-display font-bold text-[16px]">Branding & profile</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <L label="Organization name">
            <input className="rh-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </L>
          <L label="Motto">
            <input className="rh-input" value={form.motto} onChange={(e) => setForm({ ...form, motto: e.target.value })} />
          </L>
        </div>
        <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-3">
          {(["primaryColor", "secondaryColor", "accentColor"] as const).map((k) => (
            <L key={k} label={k === "primaryColor" ? "Primary" : k === "secondaryColor" ? "Secondary" : "Accent"}>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="w-9 h-9 rounded-md border border-[var(--line-strong)] cursor-pointer bg-white"
                  value={form[k]}
                  onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                />
                <span className="font-mono text-[11.5px] font-bold">{form[k]}</span>
              </div>
            </L>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <L label="County">
            <input className="rh-input" value={form.county} onChange={(e) => setForm({ ...form, county: e.target.value })} />
          </L>
          <L label="Location">
            <input className="rh-input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </L>
          <L label="Phone">
            <input className="rh-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </L>
          <L label="Email">
            <input className="rh-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </L>
        </div>
        <L label="Registration number">
          <input className="rh-input" value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} />
        </L>
        <L label="Description">
          <textarea className="rh-input min-h-[70px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </L>
        <L label="Logo" hint="PNG/JPG under 400 KB. Applied to the workspace, registration page and member cards.">
          <div className="flex items-center gap-3">
            {form.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.logoUrl} alt={org.name} className="w-20 h-20 rounded-xl object-cover border border-[var(--line)] shadow-sm" />
            ) : (
              <span className="w-20 h-20 rounded-xl flex items-center justify-center font-display font-bold text-white text-[24px] shadow-sm" style={{ background: "var(--org-primary)" }}>
                {org.code}
              </span>
            )}
            <input type="file" accept="image/png,image/jpeg" className="text-[12px]" onChange={onLogo} />
          </div>
        </L>
        {error ? <ErrorNote msg={error} /> : null}
        <div className="flex items-center gap-3">
          <button className="rh-btn rh-btn-primary" disabled={busy} onClick={save}>
            {busy ? "Saving…" : "Save changes"}
          </button>
          {saved ? <span className="text-[12.5px] font-bold text-[var(--pine-deep)]">Saved ✓</span> : null}
        </div>
      </div>

      <div className="rh-card min-w-0 lg:col-span-5 xl:col-span-4">
        <div className="px-5 pt-4 pb-2 font-display font-bold text-[16px]">Audit trail</div>
        <div className="max-h-[480px] overflow-y-auto">
          {!audit ? (
            <Spinner />
          ) : audit.length === 0 ? (
            <div className="p-5 text-[12.5px] text-[var(--ink-faint)] font-semibold">No recorded actions yet.</div>
          ) : (
            <div>
              {audit.map((a) => (
                <div key={a.id} className="px-5 py-3 border-t border-[var(--line)] first:border-0">
                  <div className="text-[12.5px] font-bold">{a.action}</div>
                  <div className="text-[11.5px] text-[var(--ink-faint)] font-semibold mt-0.5">
                    {a.userName ?? "System"} · {fmtDateTime(a.createdAt)}
                    {a.details?.reason ? ` · ${String(a.details.reason)}` : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

function L({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="rh-label mb-1.5">{label}</div>
      {children}
      {hint ? <div className="mt-1 text-[11px] text-[var(--ink-faint)]">{hint}</div> : null}
    </label>
  );
}
