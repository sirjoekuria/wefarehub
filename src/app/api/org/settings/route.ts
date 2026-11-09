import { eq } from "drizzle-orm";
import { db, persistDb } from "@/db";
import { organizations } from "@/db/rh-schema";
import { requireUser, requireAccess, requireOrgRole, assertEntitled, audit, getOrgById } from "@/lib/authz";
import { fail, ok, qnum, body, orgIdOf } from "@/lib/rh-api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const orgId = qnum(req, "orgId");
    if (!orgId) return fail(Object.assign(new Error("orgId is required."), { status: 400 }));
    await requireAccess(user.id, orgId);
    const org = await getOrgById(orgId);
    if (!org) return fail(Object.assign(new Error("Workspace not found."), { status: 404 }));
    const { id, ...rest } = org;
    void id;
    return ok(rest);
  } catch (e) {
    return fail(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    const orgId = await orgIdOf(req);
    if (!orgId) return fail(Object.assign(new Error("orgId is required."), { status: 400 }));
    const access = await requireOrgRole(user.id, orgId, ["owner", "admin"]);
    await assertEntitled(orgId);

    const b = await body<Record<string, unknown>>(req);
    const set: Record<string, unknown> = {};
    for (const k of ["name", "motto", "logoUrl", "primaryColor", "secondaryColor", "accentColor", "county", "location", "phone", "email", "registrationNumber", "description"] as const) {
      if (b[k] !== undefined) set[k] = k === "logoUrl" && typeof b[k] === "string" && (b[k] as string).length > 400_000 ? null : b[k];
    }
    if (Object.keys(set).length === 0) return fail(Object.assign(new Error("Nothing to update."), { status: 400 }));
    await db.update(organizations).set({ ...set, updatedAt: new Date() } as never).where(eq(organizations.id, orgId));
    await persistDb();
    await audit(user.id, orgId, "org.settings_updated", { entity: "organization", entityId: orgId, details: { fields: Object.keys(set) } });
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
