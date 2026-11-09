import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { members, pickupStations } from "@/db/rh-schema";
import { requireUser, requireOrgRole, assertEntitled, audit, HttpError } from "@/lib/authz";
import { fail, ok, qnum, body, orgIdOf } from "@/lib/rh-api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Association officials only (chairpersons cannot edit member records). */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const orgId = await orgIdOf(req);
    const memberId = Number((await params).id);
    if (!orgId) throw new HttpError(400, "orgId is required.");
    const access = await requireOrgRole(user.id, orgId, ["owner", "admin", "secretary"]);
    await assertEntitled(orgId);

    const [m] = await db.select().from(members).where(and(eq(members.id, memberId), eq(members.orgId, orgId)));
    if (!m) throw new HttpError(404, "Member not found in this workspace.");

    const b = await body<Record<string, unknown>>(req);
    const set: Record<string, unknown> = { updatedAt: new Date() };
    for (const k of ["firstName", "middleName", "surname", "phone", "altPhone", "email", "area", "dob", "gender", "nationalId", "photoUrl", "bikeRegNo", "bikeModel", "bikeOwnership", "existingQrId"] as const) {
      if (k in b) set[k] = b[k] == null || b[k] === "" ? null : String(b[k]);
    }
    if ("status" in b) {
      const s = String(b.status);
      if (!["pending", "active", "suspended", "inactive", "transferred", "deceased", "archived"].includes(s))
        throw new HttpError(400, "Invalid member status.");
      set.status = s;
    }
    if ("stationId" in b)
      throw new HttpError(409, "Station changes must go through the transfer workflow.");

    if (Object.keys(set).length <= 1) throw new HttpError(400, "Nothing to update.");
    await db.update(members).set(set as never).where(eq(members.id, memberId));
    await audit(user.id, orgId, "member.updated", {
      entity: "member",
      entityId: memberId,
      details: { fields: Object.keys(set).filter((k) => k !== "updatedAt"), status: set.status },
    });
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
