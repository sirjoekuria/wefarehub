import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { members, organizations, pickupStations } from "@/db/rh-schema";
import { fail, ok } from "@/lib/rh-api";
import { normalizeMemberNumber } from "@/lib/memberNumber";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ membershipNo: string }> };

/**
 * Public QR verification. Minimal disclosure only: masked name, status,
 * station, association. Never phone, national id, photo or email.
 */
export async function GET(_req: Request, { params }: Params) {
  try {
    // tolerant: "GKA 2", "gka-002", "GKA02" all resolve to GKA-0002
    const membershipNo = normalizeMemberNumber((await params).membershipNo) ?? (await params).membershipNo.toUpperCase();
    const [code, seq] = [membershipNo.split("-")[0] ?? "", membershipNo.split("-")[1]];
    const checkedAt = new Date().toISOString();
    if (!code || !seq)
      return ok({ found: false, membershipNumber: membershipNo, checkedAt });

    const [member] = await db
      .select({
        firstName: members.firstName,
        surname: members.surname,
        status: members.status,
        membershipNumber: members.membershipNumber,
        photoUrl: members.photoUrl,
        stationName: pickupStations.name,
        orgName: organizations.name,
      })
      .from(members)
      .innerJoin(organizations, eq(members.orgId, organizations.id))
      .innerJoin(pickupStations, eq(members.stationId, pickupStations.id))
      .where(and(eq(members.membershipNumber, membershipNo), eq(organizations.code, code)))
      .limit(1);
    if (!member) return ok({ found: false, membershipNumber: membershipNo, checkedAt });

    const last = member.surname;
    return ok({
      found: true,
      valid: member.status === "active",
      membershipNumber: member.membershipNumber,
      nameMasked: `${member.firstName} ${last.charAt(0)}.`,
      photoUrl: member.photoUrl,
      status: member.status,
      station: member.stationName,
      association: member.orgName,
      checkedAt,
    });
  } catch (e) {
    return fail(e);
  }
}
