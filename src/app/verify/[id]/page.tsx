import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { members, organizations, pickupStations } from "@/db/rh-schema";
import { IconCheck, IconX, IconShield } from "@/components/icons";
import { normalizeMemberNumber } from "@/lib/memberNumber";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Public QR verification — minimal disclosure only. */
export default async function VerifyPage({ params }: Params) {
  // tolerant: "GKA 2", "gka-002", "GKA02" all resolve to GKA-0002
  const raw = normalizeMemberNumber((await params).id) ?? (await params).id.toUpperCase();
  const [code, seq] = [raw.split("-")[0] ?? "", raw.split("-")[1]];

  let member: {
    membershipNumber: string | null;
    firstName: string;
    surname: string;
    photoUrl: string | null;
    status: string;
    stationName: string;
    orgName: string;
    orgPrimary: string;
  } | null = null;
  if (code && seq) {
    const rows = await db
      .select({
        membershipNumber: members.membershipNumber,
        firstName: members.firstName,
        surname: members.surname,
        photoUrl: members.photoUrl,
        status: members.status,
        stationName: pickupStations.name,
        orgName: organizations.name,
        orgPrimary: organizations.primaryColor,
      })
      .from(members)
      .innerJoin(organizations, eq(members.orgId, organizations.id))
      .innerJoin(pickupStations, eq(members.stationId, pickupStations.id))
      .where(and(eq(members.membershipNumber, raw), eq(organizations.code, code)))
      .limit(1);
    member = rows[0] ?? null;
  }

  const valid = member?.status === "active";

  return (
    <div className="min-h-screen bg-[var(--paper)] flex flex-col items-center justify-center p-5">
      <div className="w-full max-w-sm">
        <div className="rh-card overflow-hidden">
          <div className="h-1.5" style={{ background: member?.orgPrimary ?? "var(--pine)" }} />
          <div className="p-6 text-center">
            <div
              className={`mx-auto w-14 h-14 rounded-full flex items-center justify-center ${valid ? "" : "grayscale"}`}
              style={{ background: valid ? "var(--pine-soft)" : "#eef0ec", color: valid ? "var(--pine-deep)" : "var(--ink-faint)" }}
            >
              {valid ? <IconCheck className="w-7 h-7" /> : member ? <IconX className="w-7 h-7" /> : <IconShield className="w-7 h-7" />}
            </div>
            <div className="mt-3 font-display font-bold text-[19px]">
              {member ? (valid ? "Active member" : "Member not active") : "Member not found"}
            </div>
            <div className="mt-1 text-[12.5px] text-[var(--ink-faint)] font-semibold">
              Verified {new Date().toLocaleString("en-KE")}
            </div>

            {member ? (
              <div className="mt-5">
                <div className="flex justify-center">
                  {member.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={member.photoUrl}
                      alt="Passport photo"
                      className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
                    />
                  ) : (
                    <span
                      className="w-24 h-24 rounded-full flex items-center justify-center text-white font-bold text-[26px] border-4 border-white shadow-lg"
                      style={{ background: member.orgPrimary }}
                    >
                      {member.firstName.charAt(0)}
                      {member.surname.charAt(0)}
                    </span>
                  )}
                </div>
                <div className="text-center text-[11px] font-bold text-[var(--ink-faint)] mt-2">PASSPORT PHOTO</div>
                <div className="mt-3 rounded-xl border border-[var(--line)] divide-y divide-[var(--line)] text-left">
                <Row k="Membership number" v={<span className="font-mono font-bold">{member.membershipNumber}</span>} />
                <Row k="Name" v={`${member.firstName} ${member.surname.charAt(0)}.`} />
                <Row k="Status" v={member.status} />
                <Row k="Pickup station" v={member.stationName} />
                <Row k="Association" v={member.orgName} />
                </div>
              </div>
            ) : (
              <p className="mt-5 text-[13px] text-[var(--ink-soft)] leading-relaxed">
                No membership with number <b className="font-mono">{raw || "—"}</b> exists in the public
                verification register. Check the number on the member's card.
              </p>
            )}

            <div className="mt-4 text-[10.5px] text-[var(--ink-faint)] leading-relaxed">
              Verification reveals only the minimum required to confirm a member. Contact details,
              national IDs and photographs are never exposed.
            </div>
          </div>
        </div>
        <div className="mt-4 text-center">
          <Link href="/" className="text-[12px] font-bold text-[var(--pine)] hover:underline">
            ← RiderHub 360
          </Link>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">{k}</span>
      <span className="text-[13.5px] font-bold">{v}</span>
    </div>
  );
}
