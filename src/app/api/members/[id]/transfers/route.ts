import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { members, pickupStations, membershipTransfers } from "@/db/rh-schema";
import { requireUser, requireOrgRole, assertEntitled, audit, HttpError } from "@/lib/authz";
import { fail, ok, qnum, body, orgIdOf } from "@/lib/rh-api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Request a transfer. Owner/admin only; pending until approved. */
export async function POST(req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const orgId = await orgIdOf(req);
    const memberId = Number((await params).id);
    if (!orgId) throw new HttpError(400, "orgId is required.");
    const access = await requireOrgRole(user.id, orgId, ["owner", "admin"]);
    await assertEntitled(orgId);

    const { toStationId, reason } = await body<{ toStationId?: number; reason?: string }>(req);
    if (!toStationId || !reason?.trim()) throw new HttpError(400, "toStationId and reason are required.");

    const [m] = await db.select().from(members).where(and(eq(members.id, memberId), eq(members.orgId, orgId)));
    if (!m) throw new HttpError(404, "Member not found in this workspace.");
    if (m.stationId === Number(toStationId)) throw new HttpError(409, "Member is already at that station.");
    const [to] = await db.select().from(pickupStations).where(and(eq(pickupStations.id, toStationId), eq(pickupStations.orgId, orgId)));
    if (!to) throw new HttpError(404, "Destination station not found in this workspace.");
    if (to.isArchived) throw new HttpError(409, "Cannot transfer to an archived station.");

    const [t] = await db
      .insert(membershipTransfers)
      .values({
        orgId,
        memberId,
        fromStationId: m.stationId,
        toStationId: Number(toStationId),
        reason: reason.trim(),
        requestedBy: user.id,
        status: "pending",
      })
      .returning();
    await audit(user.id, orgId, "transfer.requested", { entity: "transfer", entityId: t.id, details: { member: m.membershipNumber } });
    return ok(t, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
