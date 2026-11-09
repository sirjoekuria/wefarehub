import { and, eq, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { membershipApplications, pickupStations } from "@/db/rh-schema";
import { requireUser, requireAccess, assertEntitled, HttpError } from "@/lib/authz";
import { fail, csv, qnum } from "@/lib/rh-api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const orgId = qnum(req, "orgId");
    if (!orgId) throw new HttpError(400, "orgId is required.");
    const access = await requireAccess(user.id, orgId);
    await assertEntitled(orgId);

    const conds: SQL[] = [eq(membershipApplications.orgId, orgId)];
    if (access.orgRole === null && access.chairStationId !== null)
      conds.push(eq(membershipApplications.stationId, access.chairStationId!));

    const rows = await db
      .select({
        applicant: membershipApplications.fullName,
        phone: membershipApplications.phone,
        station: pickupStations.name,
        status: membershipApplications.status,
        chairNotes: membershipApplications.chairNotes,
        decision: membershipApplications.decisionNotes,
        rejection: membershipApplications.rejectionReason,
        memberId: membershipApplications.memberId,
        submitted: membershipApplications.createdAt,
      })
      .from(membershipApplications)
      .innerJoin(pickupStations, eq(membershipApplications.stationId, pickupStations.id))
      .where(and(...conds))
      .orderBy(membershipApplications.createdAt)
      .limit(2000);

    const csvText = csv(
      [
        { header: "Applicant", value: (r) => r.applicant },
        { header: "Phone", value: (r) => r.phone },
        { header: "Station", value: (r) => r.station },
        { header: "Status", value: (r) => r.status },
        { header: "Chair notes", value: (r) => r.chairNotes },
        { header: "Decision notes", value: (r) => r.decision },
        { header: "Rejection reason", value: (r) => r.rejection },
        { header: "Member ID", value: (r) => r.memberId },
        { header: "Submitted", value: (r) => r.submitted },
      ],
      rows as unknown as Record<string, unknown>[],
    );
    return new Response(csvText, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="applications-${orgId}.csv"`,
      },
    });
  } catch (e) {
    return fail(e);
  }
}
