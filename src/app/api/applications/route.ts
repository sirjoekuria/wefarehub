import { and, desc, eq, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { membershipApplications, pickupStations } from "@/db/rh-schema";
import { requireUser, requireAccess, HttpError } from "@/lib/authz";
import { fail, ok, qnum, query } from "@/lib/rh-api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const orgId = qnum(req, "orgId");
    if (!orgId) throw new HttpError(400, "orgId is required.");
    const access = await requireAccess(user.id, orgId);

    const isChair = access.orgRole === null && access.chairStationId !== null;
    const conds: SQL[] = [eq(membershipApplications.orgId, orgId)];
    if (isChair) conds.push(eq(membershipApplications.stationId, access.chairStationId!));
    const status = query(req, "status");
    if (status)
      conds.push(
        eq(
          membershipApplications.status,
          status as "submitted" | "chairperson_review" | "recommended" | "not_recommended" | "pending_final" | "approved" | "rejected" | "changes_requested",
        ),
      );
    const stationId = qnum(req, "stationId");
    if (stationId && !isChair) conds.push(eq(membershipApplications.stationId, stationId));

    const rows = await db
      .select({
        id: membershipApplications.id,
        status: membershipApplications.status,
        fullName: membershipApplications.fullName,
        phone: membershipApplications.phone,
        email: membershipApplications.email,
        area: membershipApplications.area,
        data: membershipApplications.data,
        chairNotes: membershipApplications.chairNotes,
        recommendedAt: membershipApplications.recommendedAt,
        decisionAt: membershipApplications.decisionAt,
        decisionNotes: membershipApplications.decisionNotes,
        rejectionReason: membershipApplications.rejectionReason,
        memberId: membershipApplications.memberId,
        formVersion: membershipApplications.formVersion,
        stationId: pickupStations.id,
        stationName: pickupStations.name,
        createdAt: membershipApplications.createdAt,
      })
      .from(membershipApplications)
      .innerJoin(pickupStations, eq(membershipApplications.stationId, pickupStations.id))
      .where(and(...conds))
      .orderBy(desc(membershipApplications.createdAt))
      .limit(200);
    return ok(rows);
  } catch (e) {
    return fail(e);
  }
}
