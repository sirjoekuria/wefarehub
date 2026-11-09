import { and, eq, inArray, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { membershipTransfers, pickupStations, members } from "@/db/rh-schema";
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

    const conds: SQL[] = [eq(membershipTransfers.orgId, orgId)];
    if (access.orgRole === null && access.chairStationId !== null)
      conds.push(
        or(
          eq(membershipTransfers.fromStationId, access.chairStationId),
          eq(membershipTransfers.toStationId, access.chairStationId),
        ) as SQL,
      );

    const rows = await db
      .select({
        memberId: membershipTransfers.memberId,
        fromStation: membershipTransfers.fromStationId,
        toStation: pickupStations.name,
        toStationId: membershipTransfers.toStationId,
        reason: membershipTransfers.reason,
        status: membershipTransfers.status,
        requested: membershipTransfers.createdAt,
      })
      .from(membershipTransfers)
      .innerJoin(pickupStations, eq(membershipTransfers.toStationId, pickupStations.id))
      .where(and(...conds))
      .orderBy(membershipTransfers.createdAt);

    const memberIds = [...new Set(rows.map((r) => r.memberId))];
    const memberRows = memberIds.length
      ? await db.select().from(members).where(inArray(members.id, memberIds))
      : [];
    const mById = new Map(memberRows.map((m) => [m.id, m]));

    const csvText = csv(
      [
        {
          header: "Member",
          value: (r) => {
            const m = mById.get(Number(r.memberId));
            return m ? `${m.firstName} ${m.surname}` : String(r.memberId);
          },
        },
        { header: "Number", value: (r) => mById.get(Number(r.memberId))?.membershipNumber ?? "" },
        { header: "From station id", value: (r) => r.fromStation },
        { header: "To station", value: (r) => r.toStation },
        { header: "Reason", value: (r) => r.reason },
        { header: "Status", value: (r) => r.status },
        { header: "Requested", value: (r) => r.requested },
      ],
      rows as unknown as Record<string, unknown>[],
    );
    return new Response(csvText, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="transfers-${orgId}.csv"`,
      },
    });
  } catch (e) {
    return fail(e);
  }
}
