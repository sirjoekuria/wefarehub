"use client";

import type { ReactNode } from "react";
import { IconX } from "./icons";

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2.5 py-10 justify-center text-[var(--ink-faint)] text-sm font-semibold">
      <span className="w-4 h-4 border-2 border-[var(--line-strong)] border-t-[var(--pine)] rounded-full animate-spin" />
      {label ?? "Loading…"}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "default" | "green" | "amber" | "red" | "blue";
}) {
  const tones: Record<string, string> = {
    default: "text-[var(--ink)]",
    green: "text-[var(--pine)]",
    amber: "text-[#8a6400]",
    red: "text-[var(--danger)]",
    blue: "text-[var(--info)]",
  };
  return (
    <div className="rh-card p-4">
      <div className="rh-label">{label}</div>
      <div className={`mt-1.5 font-display text-[28px] font-bold leading-none ${tones[tone]}`}>{value}</div>
      {sub ? <div className="mt-1.5 text-[12px] font-semibold text-[var(--ink-faint)]">{sub}</div> : null}
    </div>
  );
}

const STATUS_STYLE: Record<string, { bg: string; color: string; label?: string }> = {
  submitted: { bg: "var(--info-soft)", color: "var(--info)" },
  chairperson_review: { bg: "var(--info-soft)", color: "var(--info)", label: "Chair review" },
  recommended: { bg: "var(--pine-soft)", color: "var(--pine-deep)" },
  not_recommended: { bg: "var(--amber-soft)", color: "#8a6400", label: "Not recommended" },
  pending_final: { bg: "var(--amber-soft)", color: "#8a6400", label: "Pending final" },
  approved: { bg: "var(--pine-soft)", color: "var(--pine-deep)" },
  rejected: { bg: "var(--danger-soft)", color: "var(--danger)" },
  changes_requested: { bg: "var(--amber-soft)", color: "#8a6400", label: "Changes requested" },
  active: { bg: "var(--pine-soft)", color: "var(--pine-deep)" },
  pending: { bg: "var(--info-soft)", color: "var(--info)" },
  suspended: { bg: "var(--danger-soft)", color: "var(--danger)" },
  inactive: { bg: "#eef0ec", color: "var(--ink-soft)" },
  transferred: { bg: "var(--info-soft)", color: "var(--info)" },
  deceased: { bg: "#eef0ec", color: "var(--ink-faint)" },
  archived: { bg: "#eef0ec", color: "var(--ink-faint)" },
  verified: { bg: "var(--pine-soft)", color: "var(--pine-deep)" },
  pending_payment: { bg: "var(--amber-soft)", color: "#8a6400", label: "Pending payment" },
  renewal_due: { bg: "var(--amber-soft)", color: "#8a6400", label: "Renewal due" },
  past_due: { bg: "var(--amber-soft)", color: "#8a6400", label: "Past due" },
  grace_period: { bg: "var(--amber-soft)", color: "#8a6400", label: "Grace period" },
  cancelled: { bg: "#eef0ec", color: "var(--ink-soft)" },
  expired: { bg: "var(--danger-soft)", color: "var(--danger)" },
  failed: { bg: "var(--danger-soft)", color: "var(--danger)" },
};

export function StatusPill({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { bg: "#eef0ec", color: "var(--ink-soft)" };
  return (
    <span className="rh-pill" style={{ background: s.bg, color: s.color }}>
      <span className="dot" />
      {s.label ?? status.replace(/_/g, " ")}
    </span>
  );
}

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#10171266] p-4 pt-[6vh]" onMouseDown={onClose}>
      <div
        className={`rh-card w-full ${wide ? "max-w-3xl" : "max-w-lg"} shadow-2xl`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--line)]">
          <div className="font-display font-bold text-[15.5px]">{title}</div>
          <button className="rh-btn rh-btn-ghost rh-btn-sm !p-1.5" onClick={onClose} aria-label="Close">
            <IconX className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="rh-label mb-1.5">{label}</div>
      {children}
      {hint ? <div className="mt-1 text-[11.5px] text-[var(--ink-faint)]">{hint}</div> : null}
    </label>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="py-12 text-center">
      <div className="font-bold text-[15px] text-[var(--ink-soft)]">{title}</div>
      {body ? <div className="mt-1 text-[13px] text-[var(--ink-faint)] max-w-sm mx-auto">{body}</div> : null}
    </div>
  );
}

export function Avatar({ name, size = 30, photoUrl }: { name: string; size?: number; photoUrl?: string | null }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photoUrl} alt={name} className="rounded-full object-cover shrink-0 border border-[var(--line)]" style={{ width: size, height: size }} />;
  }
  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-[var(--pine-soft)] text-[var(--pine-deep)] font-bold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials || "?"}
    </span>
  );
}

export function ErrorNote({ msg }: { msg: string }) {
  return (
    <div className="mt-3 rounded-lg border border-[#ecc8c4] bg-[var(--danger-soft)] text-[var(--danger)] text-[13px] font-semibold px-3.5 py-2.5">
      {msg}
    </div>
  );
}

export function fmtDate(v: string | Date | null | undefined): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}

export function fmtDateTime(v: string | Date | null | undefined): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-KE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function fmtKes(n: number | null | undefined): string {
  if (n == null) return "—";
  return `KES ${n.toLocaleString("en-KE")}`;
}
