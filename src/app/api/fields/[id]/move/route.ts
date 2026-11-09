import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { memberCustomFieldDefinitions, organizations } from "@/db/rh-schema";
import { requireUser, requireOrgRole, audit, HttpError } from "@/lib/authz";
import { fail, ok, qnum, body, orgIdOf } from "@/lib/rh-api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Reorder a field: body { index: number } (0-based target position). */
export async function POST(req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const orgId = await orgIdOf(req);
    const fieldId = Number((await params).id);
    if (!orgId) throw new HttpError(400, "orgId is required.");
    const access = await requireOrgRole(user.id, orgId, ["owner", "admin"]);

    const { index } = await body<{ index?: number }>(req);
    if (index == null || !Number.isInteger(index)) throw new HttpError(400, "index is required.");

    const all = await db
      .select()
      .from(memberCustomFieldDefinitions)
      .where(eq(memberCustomFieldDefinitions.orgId, orgId))
      .orderBy(asc(memberCustomFieldDefinitions.position));
    const idx = all.findIndex((f) => f.id === fieldId);
    if (idx === -1) throw new HttpError(404, "Field not found in this workspace.");
    const target = Math.max(0, Math.min(index, all.length - 1));
    const [moved] = all.splice(idx, 1);
    all.splice(target, 0, moved);

    await db.transaction(async (tx) => {
      for (let i = 0; i < all.length; i++)
        if (all[i].position !== i)
          await tx.update(memberCustomFieldDefinitions).set({ position: i, updatedAt: new Date() }).where(eq(memberCustomFieldDefinitions.id, all[i].id));
    });
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
    await db.update(organizations).set({ formVersion: org.formVersion + 1 }).where(eq(organizations.id, orgId));
    await audit(user.id, orgId, "form.field_moved", { entity: "field", entityId: fieldId, details: { from: idx, to: target } });
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
