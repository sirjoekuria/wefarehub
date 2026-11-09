import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { membershipTransfers, members } from "@/db/rh-schema";
import { requireUser, requireOrgRole, audit, HttpError } from "@/lib/authz";
import { fail, ok, qnum, body, orgIdOf } from "@/lib/rh-api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * Approve/reject a transfer. Approval moves the member's station in one
 * transaction — same row, same membership number, full history preserved.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const orgId = await orgIdOf(req);
    const transferId = Number((await params).id);
    if (!orgId) throw new HttpError(400, "orgId is required.");
    const access = await requireOrgRole(user.id, orgId, ["owner", "admin"]);

    const { decision, note } = await body<{ decision?: string; note?: string }>(req);
    if (!["approved", "rejected"].includes(decision ?? ""))
      throw new HttpError(400, "decision must be approved or rejected.");

    const [t] = await db.select().from(membershipTransfers).where(and(eq(membershipTransfers.id, transferId), eq(membershipTransfers.orgId, orgId)));
    if (!t) throw new HttpError(404, "Transfer not found in this workspace.");
    if (t.status !== "pending") throw new HttpError(409, "Transfer has already been decided.");

    await db.transaction(async (tx) => {
      await tx
        .update(membershipTransfers)
        .set({
          status: decision as "approved",
          approvedBy: user.id,
          decidedAt: new Date(),
          note: note ?? null,
        })
        .where(eq(membershipTransfers.id, transferId));
      if (decision === "approved") {
        await tx.update(members).set({ stationId: t.toStationId, updatedAt: new Date() }).where(eq(members.id, t.memberId));
      }
    });
    await audit(user.id, orgId, `transfer.${decision}`, {
      entity: "transfer",
      entityId: transferId,
      details: { member: t.memberId, from: t.fromStationId, to: t.toStationId, note },
    });
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
