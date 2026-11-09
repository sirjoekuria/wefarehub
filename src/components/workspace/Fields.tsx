"use client";

import { useEffect, useState } from "react";
import type { Ctx } from "./ctx";
import { Spinner, EmptyState, Modal, Field, ErrorNote } from "@/components/rh-ui";
import { IconPlus, IconForm, IconChevron, IconX } from "@/components/icons";

type Def = {
  id: number; key: string; label: string; type: string; options: string[] | null;
  required: boolean; enabled: boolean; position: number; visibility: string; helpText: string | null;
};

const TYPES = ["text", "number", "date", "dropdown", "multi", "checkbox", "phone", "file"];

export function Fields({ org, refreshKey, refresh }: Ctx) {
  const [defs, setDefs] = useState<Def[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ label: "", type: "text", options: "", required: false, visibility: "registration" });

  const load = () => {
    fetch(`/api/fields?orgId=${org.id}`).then((r) => r.json()).then((d) => setDefs(Array.isArray(d) ? d : [])).catch(() => setDefs([]));
  };
  useEffect(load, [org.id, refreshKey]);

  async function patch(id: number, body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/fields/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: org.id, ...body }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Update failed");
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function move(id: number, index: number) {
    try {
      const res = await fetch(`/api/fields/${id}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: org.id, index }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Move failed");
      }
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Move failed");
    }
  }

  async function add() {
    setBusy(true);
    setError("");
    try {
      const options = form.options.split("\n").map((s) => s.trim()).filter(Boolean);
      const res = await fetch("/api/fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: org.id,
          label: form.label,
          type: form.type,
          options: form.type === "dropdown" || form.type === "multi" ? options : undefined,
          required: form.required,
          visibility: form.visibility,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Add failed");
      setAddOpen(false);
      setForm({ label: "", type: "text", options: "", required: false, visibility: "registration" });
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Add failed");
    } finally {
      setBusy(false);
    }
  }

  if (!defs) return <Spinner />;

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1 text-[13px] text-[var(--ink-soft)] font-semibold">
          Current form version <b>v{org.formVersion}</b>. Disabling a field never deletes answers already submitted —
          applications keep the form version they were filed under.
        </div>
        <button className="rh-btn rh-btn-primary" onClick={() => setAddOpen(true)}>
          <IconPlus className="w-4 h-4" /> Add field
        </button>
      </div>

      {defs.length === 0 ? (
        <div className="rh-card">
          <EmptyState title="No custom fields" body="Add association-specific fields beyond the standard member profile." />
        </div>
      ) : (
        <div className="rh-card divide-y divide-[var(--line)]">
          {defs.map((f, i) => (
            <div key={f.id} className={`p-4 ${f.enabled ? "" : "opacity-50"}`}>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex flex-col gap-1">
                  <button className="p-0.5 rounded hover:bg-[var(--paper)] disabled:opacity-30" disabled={i === 0} onClick={() => move(f.id, i - 1)} aria-label="Move up">
                    <IconChevron className="w-4 h-4 -rotate-90" />
                  </button>
                  <button className="p-0.5 rounded hover:bg-[var(--paper)] disabled:opacity-30" disabled={i === defs.length - 1} onClick={() => move(f.id, i + 1)} aria-label="Move down">
                    <IconChevron className="w-4 h-4 rotate-90" />
                  </button>
                </div>
                <div className="min-w-[160px]">
                  <div className="font-bold text-[14px]">
                    {f.label} {f.required ? <span className="text-[var(--danger)]">*</span> : null}
                  </div>
                  <div className="text-[11px] font-semibold text-[var(--ink-faint)]">
                    {f.type} · {f.visibility === "admin" ? "admin only" : "on registration form"}
                  </div>
                </div>
                <div className="flex-1" />
                <label className="flex items-center gap-1.5 text-[12px] font-bold text-[var(--ink-soft)] cursor-pointer">
                  <input type="checkbox" checked={f.required} onChange={(e) => patch(f.id, { required: e.target.checked })} className="accent-[var(--pine)]" />
                  Required
                </label>
                <label className="flex items-center gap-1.5 text-[12px] font-bold text-[var(--ink-soft)] cursor-pointer">
                  <input type="checkbox" checked={f.enabled} onChange={(e) => patch(f.id, { enabled: e.target.checked })} className="accent-[var(--pine)]" />
                  Enabled
                </label>
                {f.options ? (
                  <span className="text-[11.5px] text-[var(--ink-faint)] font-semibold max-w-[180px] truncate">
                    {f.options.join(" · ")}
                  </span>
                ) : null}
                {(f.type === "dropdown" || f.type === "multi") ? (
                  <EditOptionsBtn def={f} onPatch={(options) => patch(f.id, { options })} />
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {error ? <ErrorNote msg={error} /> : null}

      {addOpen ? (
        <Modal title="Add custom field" onClose={() => setAddOpen(false)}>
          <div className="space-y-3">
            <Field label="Field label">
              <input className="rh-input" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g. Insurance Expiry" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type">
                <select className="rh-input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  {TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="Visibility">
                <select className="rh-input" value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })}>
                  <option value="registration">Registration form</option>
                  <option value="admin">Admin only</option>
                </select>
              </Field>
            </div>
            {form.type === "dropdown" || form.type === "multi" ? (
              <Field label="Options (one per line)">
                <textarea className="rh-input min-h-[80px]" value={form.options} onChange={(e) => setForm({ ...form, options: e.target.value })} />
              </Field>
            ) : null}
            <label className="flex items-center gap-2 text-[13px] font-bold cursor-pointer">
              <input type="checkbox" checked={form.required} onChange={(e) => setForm({ ...form, required: e.target.checked })} className="accent-[var(--pine)]" />
              Required field
            </label>
            <div className="flex gap-2 pt-1">
              <button className="rh-btn rh-btn-primary" disabled={busy || !form.label.trim()} onClick={add}>
                Add field
              </button>
              <button className="rh-btn rh-btn-ghost" onClick={() => setAddOpen(false)}><IconX className="w-4 h-4" /> Cancel</button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function EditOptionsBtn({ def, onPatch }: { def: Def; onPatch: (opts: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState((def.options ?? []).join("\n"));
  return (
    <span>
      <button className="rh-btn rh-btn-ghost rh-btn-sm" onClick={() => { setOpts((def.options ?? []).join("\n")); setOpen(true); }}>
        Options
      </button>
      {open ? (
        <span className="fixed inset-0 z-50 bg-[#10171244] flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <span className="rh-card p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <span className="font-bold text-[14px] block mb-3">{def.label} — options</span>
            <textarea className="rh-input min-h-[120px]" value={opts} onChange={(e) => setOpts(e.target.value)} />
            <div className="flex gap-2 mt-3">
              <button
                className="rh-btn rh-btn-primary rh-btn-sm"
                onClick={() => {
                  const parsed = opts.split("\n").map((s) => s.trim()).filter(Boolean);
                  if (parsed.length === 0) return;
                  onPatch(parsed);
                  setOpen(false);
                }}
              >
                Save options
              </button>
              <button className="rh-btn rh-btn-ghost rh-btn-sm" onClick={() => setOpen(false)}>Cancel</button>
            </div>
          </span>
        </span>
      ) : null}
    </span>
  );
}
