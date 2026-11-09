import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { members, organizations, pickupStations, membershipCards } from "@/db/rh-schema";
import { getSessionUser, getAccess } from "@/lib/authz";
import { IconBike } from "@/components/icons";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ memberId: string }> };

/** Print-ready membership card (PDF via browser print). Requires workspace access. */
export default async function CardPage({ params }: Params) {
  const { memberId } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const id = Number(memberId);
  const rows = await db
    .select({
      member: {
        id: members.id,
        orgId: members.orgId,
        stationId: members.stationId,
        firstName: members.firstName,
        middleName: members.middleName,
        surname: members.surname,
        status: members.status,
        registrationDate: members.registrationDate,
        membershipNumber: members.membershipNumber,
        photoUrl: members.photoUrl,
      },
      stationName: pickupStations.name,
      orgName: organizations.name,
      orgMotto: organizations.motto,
      orgPrimary: organizations.primaryColor,
      orgSecondary: organizations.secondaryColor,
      orgAccent: organizations.accentColor,
      logoUrl: organizations.logoUrl,
    })
    .from(members)
    .innerJoin(organizations, eq(members.orgId, organizations.id))
    .innerJoin(pickupStations, eq(members.stationId, pickupStations.id))
    .where(eq(members.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) redirect("/login");

  const access = await getAccess(user.id, row.member.orgId);
  const allowed =
    access.orgRole !== null ||
    (access.chairStationId !== null && access.chairStationId === row.member.stationId);
  if (!allowed) redirect("/login");

  const cardRows = await db
    .select()
    .from(membershipCards)
    .where(and(eq(membershipCards.orgId, row.member.orgId), eq(membershipCards.memberId, row.member.id)))
    .limit(1);
  const qrPayload =
    cardRows[0]?.qrPayload ?? (row.member.membershipNumber ? `RH360:${row.member.membershipNumber}` : `RH360:member-${row.member.id}`);
  const verifyUrl = row.member.membershipNumber ? `/verify/${row.member.membershipNumber}` : "/verify/";
  const qrDataUrl = await QRCode.toDataURL(qrPayload, { width: 220, margin: 1, color: { dark: "#17201a", light: "#ffffff" } }).catch(() => null);

  return (
    <div className="min-h-screen bg-[var(--paper)] flex flex-col items-center p-6">
      <div className="no-print w-full max-w-[380px] flex items-center justify-between mb-5">
        <div className="text-[12.5px] font-bold text-[var(--ink-faint)]">
          Membership card · {row.orgName}
        </div>
        <PrintButton />
      </div>

      <div
        className="print-frame rh-member-card"
        style={{
          ["--mc-primary" as never]: row.orgPrimary,
          ["--mc-secondary" as never]: row.orgSecondary,
          ["--mc-accent" as never]: row.orgAccent,
        }}
      >
        <div className="mc-band" style={{ minHeight: 84 }}>
          <div className="h-full px-5 pt-4 pb-3 flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              {row.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={row.logoUrl} alt="" className="w-9 h-9 rounded-lg object-cover bg-white/90" />
              ) : null}
              <div>
                <div className="flex items-center gap-1.5 text-white">
                  <IconBike className="w-4 h-4" />
                  <span className="font-display font-bold text-[13px]">{row.orgName}</span>
                </div>
                {row.orgMotto ? <div className="text-[10px] text-white/70 mt-0.5">“{row.orgMotto}”</div> : null}
              </div>
            </div>
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt="QR" className="w-[60px] h-[60px] rounded-md bg-white p-1 shrink-0" />
            ) : null}
          </div>
        </div>
        <div className="mc-body">
          <div className="flex items-center justify-between">
            <div>
              <div className="rh-label">Membership number</div>
              <div className="font-display font-bold text-[24px] tracking-tight" style={{ color: row.orgSecondary }}>
                {row.member.membershipNumber ?? "—"}
              </div>
            </div>
            <span
              className="rh-pill"
              style={{
                background: row.member.status === "active" ? "var(--pine-soft)" : "var(--amber-soft)",
                color: row.member.status === "active" ? "var(--pine-deep)" : "#8a6400",
              }}
            >
              <span className="dot" /> {row.member.status}
            </span>
          </div>
          <div className="mt-4 border-t border-[var(--line)] pt-3 flex items-center gap-3">
            {row.member.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={row.member.photoUrl} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-white shadow" />
            ) : (
              <span
                className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-white text-[16px]"
                style={{ background: row.orgPrimary }}
              >
                {row.member.firstName?.[0]}
                {row.member.surname?.[0]}
              </span>
            )}
            <div className="min-w-0">
              <div className="font-bold text-[15.5px] truncate">
                {row.member.firstName} {row.member.middleName ? `${row.member.middleName} ` : ""}
                {row.member.surname}
              </div>
              <div className="text-[12px] text-[var(--ink-soft)] mt-0.5">
                {row.stationName} · member since {row.member.registrationDate}
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-[9.5px] text-[var(--ink-faint)] font-semibold">
            <span>Verify: riderhub360{verifyUrl.startsWith("/") ? verifyUrl : ""}</span>
            <span>RIDERHUB 360</span>
          </div>
        </div>
      </div>

      <div className="no-print mt-4 text-[11.5px] text-[var(--ink-faint)] font-semibold">
        Tip: in the print dialog choose “Save as PDF” for a shareable digital card.
      </div>
    </div>
  );
}
