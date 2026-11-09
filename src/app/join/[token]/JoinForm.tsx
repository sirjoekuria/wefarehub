"use client";

import { useState } from "react";
import { IconArrow, IconX, IconWarn, IconCheck } from "@/components/icons";
import { ErrorNote } from "@/components/rh-ui";

type FieldDef = {
  id: number;
  label: string;
  type: string;
  required: boolean;
  options: string[] | null;
  helpText: string | null;
};

const MAX_FILE_BYTES = 3 * 1024 * 1024; // 3MB per image

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

function UploadField({
  label,
  badge,
  hint,
  value,
  onChange,
}: {
  label: string;
  badge: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [fileError, setFileError] = useState("");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFileError("");
    if (!file.type.startsWith("image/")) {
      setFileError("Please choose an image file (JPG, PNG or WEBP).");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setFileError("Image is too large — maximum 3MB.");
      return;
    }
    try {
      onChange(await fileToDataUrl(file));
    } catch {
      setFileError("Could not read that image — try another file.");
    }
  }

  return (
    <div className="rounded-xl border border-[var(--line)] p-4 bg-[var(--paper)] flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-[13px] font-bold text-[var(--ink)]">{label} *</div>
          {value ? (
            <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-800 border border-emerald-500/30 flex items-center gap-1">
              <IconCheck className="w-3 h-3" /> Attached
            </span>
          ) : (
            <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-900 border border-amber-500/30">
              Required
            </span>
          )}
        </div>
        {hint && <p className="text-[11.5px] text-[var(--ink-soft)] mb-3">{hint}</p>}
      </div>

      {value ? (
        <div className="relative group rounded-xl overflow-hidden border border-[var(--line)] bg-black/5 aspect-[4/3] max-h-48 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt={label} className="w-full h-full object-contain" />
          <button
            type="button"
            className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold flex items-center gap-1 shadow-md transition-all"
            onClick={() => onChange("")}
            aria-label={`Remove ${label}`}
          >
            <IconX className="w-3.5 h-3.5" /> Remove
          </button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--line-strong)] hover:border-[var(--pine)] bg-[var(--bg)] py-6 px-4 cursor-pointer transition-colors text-center">
          <span className="w-10 h-10 rounded-full bg-[var(--pine-soft)] text-[var(--pine-deep)] flex items-center justify-center shadow-sm">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </span>
          <div>
            <span className="text-[12.5px] font-bold text-[var(--pine-deep)] block">
              Take photo or upload {badge}
            </span>
            <span className="text-[11px] text-[var(--ink-faint)]">
              JPG, PNG, or WEBP (Max 3MB)
            </span>
          </div>
          <input type="file" accept="image/png,image/jpeg,image/webp" capture="environment" className="hidden" onChange={onFile} />
        </label>
      )}
      {fileError ? <div className="mt-2 text-[11.5px] font-bold text-[var(--danger)]">{fileError}</div> : null}
    </div>
  );
}

export function JoinForm({
  token,
  orgId,
  formVersion,
  fields,
  stationName,
}: {
  token: string;
  orgId: number;
  formVersion: number;
  fields: FieldDef[];
  stationName: string;
}) {
  const [v, setV] = useState<Record<string, string>>({});
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [photo, setPhoto] = useState("");
  const [idImage, setIdImage] = useState("");
  const [id, setId] = useState({ type: "", number: "", name: "", dob: "", gender: "", issuedAt: "", expiryAt: "" });
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const set = (k: string, val: string) => setV((s) => ({ ...s, [k]: val }));

  const idMissing = !photo || !idImage || !id.type || !id.number.trim() || !id.name.trim() || !id.dob || !id.gender;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!photo || !idImage) {
      setError("Please attach your passport photo and a photo of your ID card or driving licence.");
      return;
    }
    if (!id.type || !id.number.trim() || !id.name.trim() || !id.dob || !id.gender) {
      setError("Please complete all the identity details (ID type, number, full name, date of birth and gender).");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/join/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: v.firstName,
          middleName: v.middleName,
          surname: v.surname,
          phone: v.phone,
          email: v.email,
          area: v.area,
          dob: v.dob,
          gender: v.gender,
          nationalId: id.type === "national_id" ? id.number : undefined,
          bikeRegNo: v.bikeRegNo,
          bikeModel: v.bikeModel,
          bikeOwnership: v.bikeOwnership,
          existingQrId: v.existingQrId,
          photo,
          idImage,
          id: {
            type: id.type,
            number: id.number.trim(),
            name: id.name.trim(),
            dob: id.dob,
            gender: id.gender,
            issuedAt: id.issuedAt || undefined,
            expiryAt: id.expiryAt || undefined,
          },
          consent,
          custom,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Submission failed");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="mt-5 rounded-xl p-6 text-center" style={{ background: "var(--pine-soft)" }}>
        <div className="mx-auto w-11 h-11 rounded-full flex items-center justify-center text-white" style={{ background: "var(--org-primary)" }}>
          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 12.5 4.5 4.5L19 7.5" />
          </svg>
        </div>
        <div className="mt-3 font-display font-bold text-[17px]">Application submitted</div>
        <p className="mt-1.5 text-[13px] text-[var(--ink-soft)] leading-relaxed">
          Your application for <b>{stationName}</b> — including your photo and identity documents — is
          now with the station chairperson for verification. The association administrator makes the
          final decision.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-6">
      {/* 1. MANDATORY PHOTO & DOCUMENT VERIFICATION */}
      <div className="rounded-2xl border-2 border-[var(--line-strong)] p-5 shadow-sm bg-[var(--paper)] space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-[var(--line)]">
          <span className="w-6 h-6 rounded-full bg-[var(--pine)] text-white text-[12px] font-bold flex items-center justify-center">1</span>
          <div>
            <div className="font-display font-bold text-[16px] text-[var(--ink)]">
              Passport Photo & Identity Documents
            </div>
            <div className="text-[12px] text-[var(--ink-soft)]">
              Both documents are mandatory for verification and digital membership card issuance
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UploadField
            label="Passport Photo (Rider Portrait)"
            badge="Passport Photo"
            hint="Clear, front-facing portrait. No sunglasses or hats."
            value={photo}
            onChange={setPhoto}
          />
          <UploadField
            label="Front of ID Card / Driving Licence"
            badge="Front of ID/DL"
            hint="Clear, readable photo of the front of your National ID or DL."
            value={idImage}
            onChange={setIdImage}
          />
        </div>

        <div className="pt-2">
          <div className="text-[12px] font-bold text-[var(--ink-soft)] uppercase tracking-wider mb-2">
            Details as shown on your identification document:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="ID type *"
              value={id.type}
              onChange={(s) => setId({ ...id, type: s })}
              options={["national_id", "driving_licence", "passport"]}
            />
            <Input label="ID / DL number *" value={id.number} onChange={(s) => setId({ ...id, number: s })} placeholder="As printed on document" />
            <Input label="Full name on ID *" value={id.name} onChange={(s) => setId({ ...id, name: s })} placeholder="Matching document exactly" />
            <Input label="Date of birth on ID *" type="date" value={id.dob} onChange={(s) => setId({ ...id, dob: s })} />
            <Select label="Gender on ID *" value={id.gender} onChange={(s) => setId({ ...id, gender: s })} options={["Female", "Male"]} />
            <Input label="Issue date (optional)" type="date" value={id.issuedAt} onChange={(s) => setId({ ...id, issuedAt: s })} />
          </div>
        </div>

        {idMissing ? (
          <div className="text-[12px] font-bold text-[#8a6400] bg-[var(--amber-soft)] rounded-xl p-3 border border-amber-500/20 flex items-center gap-2">
            <span>⚠️</span>
            <span>Passport photo, front of ID card/driving licence, and identity details are required to submit.</span>
          </div>
        ) : null}
      </div>

      {/* 2. RIDER PERSONAL DETAILS */}
      <div className="rounded-2xl border border-[var(--line)] p-5 bg-[var(--paper)] space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-[var(--line)]">
          <span className="w-6 h-6 rounded-full bg-[var(--ink-soft)] text-white text-[12px] font-bold flex items-center justify-center">2</span>
          <div className="font-display font-bold text-[16px] text-[var(--ink)]">Personal & Contact Details</div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="First name *" value={v.firstName ?? ""} onChange={(s) => set("firstName", s)} />
          <Input label="Middle name" value={v.middleName ?? ""} onChange={(s) => set("middleName", s)} />
          <Input label="Surname *" value={v.surname ?? ""} onChange={(s) => set("surname", s)} />
          <Input label="Phone Number *" type="tel" value={v.phone ?? ""} onChange={(s) => set("phone", s)} placeholder="07XX XXX XXX" />
          <Input label="Email address" type="email" value={v.email ?? ""} onChange={(s) => set("email", s)} />
          <Input label="Residential area / Estate" value={v.area ?? ""} onChange={(s) => set("area", s)} placeholder="e.g. Kahawa West, Githurai" />
          <Input label="Existing membership / QR number" value={v.existingQrId ?? ""} onChange={(s) => set("existingQrId", s)} placeholder="If migrating from physical card" />
        </div>
      </div>

      {/* 3. MOTORCYCLE DETAILS */}
      <div className="rounded-2xl border border-[var(--line)] p-5 bg-[var(--paper)] space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-[var(--line)]">
          <span className="w-6 h-6 rounded-full bg-[var(--ink-soft)] text-white text-[12px] font-bold flex items-center justify-center">3</span>
          <div className="font-display font-bold text-[16px] text-[var(--ink)]">Motorcycle Details (Optional)</div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input label="Registration number" value={v.bikeRegNo ?? ""} onChange={(s) => set("bikeRegNo", s)} placeholder="e.g. KMDX 101A" />
          <Input label="Make & model" value={v.bikeModel ?? ""} onChange={(s) => set("bikeModel", s)} placeholder="e.g. Boxer BM 150" />
          <Select label="Ownership status" value={v.bikeOwnership ?? ""} onChange={(s) => set("bikeOwnership", s)} options={["Owned", "Hired", "Financed"]} />
        </div>
      </div>

      {fields.length > 0 ? (
        <div>
          <div className="rh-label mb-2">Association-specific</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {fields.map((f) => (
              <FieldInput key={f.id} def={f} value={custom[f.id] ?? ""} onChange={(s) => setCustom((c) => ({ ...c, [f.id]: s }))} />
            ))}
          </div>
        </div>
      ) : null}

      <label className="flex items-start gap-2.5 text-[12.5px] text-[var(--ink-soft)] cursor-pointer rounded-lg border border-[var(--line)] p-3">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 accent-[var(--pine)]" />
        <span>
          I consent to my details, <b>photo and identity documents</b> being processed for{" "}
          <b>membership verification and administration</b> of this association, under the Kenya
          Data Protection Act (2019). *
        </span>
      </label>

      {error ? <ErrorNote msg={error} /> : null}

      <button type="submit" className="rh-btn rh-btn-primary w-full justify-center !py-3" disabled={busy || !consent}>
        {busy ? "Submitting…" : (
          <>
            Submit application <IconArrow className="w-4 h-4" />
          </>
        )}
      </button>
      <div className="text-[10.5px] text-[var(--ink-faint)] text-center -mt-1">Form version v{formVersion} · submitted via secure station link</div>
    </form>
  );
}

function Input({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="block">
      <div className="rh-label mb-1">{label.replace(" *", "")}{label.includes("*") ? " *" : ""}</div>
      <input className="rh-input" type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="block">
      <div className="rh-label mb-1">{label}</div>
      <select className="rh-input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select…</option>
        {options.map((o) => (
          <option key={o} value={o}>{o.replace(/_/g, " ")}</option>
        ))}
      </select>
    </label>
  );
}

function FieldInput({ def, value, onChange }: { def: FieldDef; value: string; onChange: (v: string) => void }) {
  const req = def.required ? " *" : "";
  if (def.type === "dropdown" && def.options)
    return (
      <label className="block">
        <div className="rh-label mb-1">{def.label}{req}</div>
        <select className="rh-input" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select…</option>
          {def.options.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
        {def.helpText ? <div className="mt-1 text-[11px] text-[var(--ink-faint)]">{def.helpText}</div> : null}
      </label>
    );
  if (def.type === "multi" && def.options)
    return (
      <div>
        <div className="rh-label mb-1">{def.label}{req}</div>
        <div className="space-y-1">
          {def.options.map((o) => (
            <label key={o} className="flex items-center gap-2 text-[13px] font-semibold cursor-pointer">
              <input
                type="checkbox"
                className="accent-[var(--pine)]"
                checked={value.split(",").includes(o)}
                onChange={(e) => {
                  const cur = value ? value.split(",") : [];
                  onChange(e.target.checked ? [...cur, o].join(",") : cur.filter((x) => x !== o).join(","));
                }}
              />
              {o}
            </label>
          ))}
        </div>
      </div>
    );
  return (
    <label className="block">
      <div className="rh-label mb-1">{def.label}{req}</div>
      <input
        className="rh-input"
        type={def.type === "number" ? "number" : def.type === "date" ? "date" : def.type === "phone" ? "tel" : "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {def.helpText ? <div className="mt-1 text-[11px] text-[var(--ink-faint)]">{def.helpText}</div> : null}
    </label>
  );
}
