import { IconWarn, IconX, IconCheck } from "@/components/icons";
import { StatusPill, fmtDate } from "@/components/rh-ui";

export type SubInfo = {
  status: string;
  planName: string;
  planCode: string;
  billingCycle: string | null;
  currentPeriodEnd: string | null;
  maxStations: number | null;
  maxMembers: number | null;
};

const LOCKED = [
  "New member registration & applications",
  "Membership approvals, statuses and transfers",
  "Station management & registration links",
  "Reports and exports",
];

/**
 * Hard operational gate: when the association's subscription is
 * suspended / cancelled / expired, the entire workspace is replaced by
 * this card — browsing the operational tabs is impossible, not just
  limited. The backend independently returns 402 on every operational
 * write, so the UI gate is backed by server-side enforcement.
 */
export function SuspendedCard({
  orgName,
  sub,
  onRetry,
}: {
  orgName: string;
  sub: SubInfo;
  onRetry: () => void;
}) {
  const reason =
    sub.status === "suspended"
      ? "The RiderHub 360 platform has suspended this association's workspace."
      : sub.status === "cancelled"
        ? "The subscription for this association has been cancelled."
        : "The subscription for this association has expired.";

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="w-full max-w-xl rh-card overflow-hidden shadow-xl">
        <div className="h-1.5" style={{ background: "var(--danger)" }} />
        <div className="p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <span
              className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
            >
              <IconWarn className="w-7 h-7" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display font-bold text-[20px] sm:text-[22px]">Operational access blocked</h1>
                <StatusPill status={sub.status} />
              </div>
              <p className="mt-1.5 text-[13.5px] text-[var(--ink-soft)] leading-relaxed">
                {reason} <b>{orgName}</b> can no longer operate on RiderHub 360 until the suspension is
                lifted. Your data is safe and will be fully restored.
              </p>
            </div>
          </div>

          <div className="mt-6 grid sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-[var(--line)] p-4" style={{ background: "var(--paper)" }}>
              <div className="rh-label mb-2.5">Locked right now</div>
              <ul className="space-y-2">
                {LOCKED.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-[12.5px] font-semibold text-[var(--ink-soft)]">
                    <IconX className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[var(--danger)]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border p-4" style={{ borderColor: "#e8d48a", background: "var(--amber-soft)" }}>
              <div className="rh-label mb-2.5" style={{ color: "#8a6400" }}>
                How to restore access
              </div>
              <ol className="space-y-2 text-[12.5px] font-semibold text-[#6b5100] list-decimal list-inside">
                <li>
                  Pay the outstanding amount to renew your <b>{sub.planName}</b>{" "}
                  {sub.billingCycle ? `(${sub.billingCycle})` : ""} plan
                  {sub.currentPeriodEnd ? ` — period ended ${fmtDate(sub.currentPeriodEnd)}` : ""}.
                </li>
                <li>Contact the RiderHub 360 platform administrator to verify payment and unsuspend the workspace.</li>
              </ol>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2.5">
            <a
              className="rh-btn rh-btn-primary"
              href={`mailto:support@riderhub360.co.ke?subject=${encodeURIComponent(
                `Reinstate subscription — ${orgName}`,
              )}&body=${encodeURIComponent(
                `Hello RiderHub 360 team,\n\nOur association (${orgName}) workspace is ${sub.status}. We have renewed / wish to renew our ${sub.planName} plan.\n\nPayment reference: \nContact person: \n\nThank you.`,
              )}`}
            >
              Contact platform support
            </a>
            <button className="rh-btn rh-btn-outline" onClick={onRetry}>
              <IconCheck className="w-4 h-4" /> Recheck status
            </button>
          </div>

          <div className="mt-5 text-[11.5px] text-[var(--ink-faint)] font-semibold leading-relaxed">
            Enforcement is server-side: every operational request is rejected with HTTP 402 while the
            suspension is in effect — it cannot be bypassed from the interface.
          </div>
        </div>
      </div>
    </div>
  );
}
