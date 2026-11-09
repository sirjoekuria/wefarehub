import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, users } from "@/db/rh-schema";
import { requireUser, requireOrgRole, HttpError } from "@/lib/authz";
import { fail, ok, qnum } from "@/lib/rh-api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const orgId = qnum(req, "orgId");
    if (!orgId) throw new HttpError(400, "orgId is required.");
    await requireOrgRole(user.id, orgId, ["owner", "admin"]);

    const rows = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        entity: auditLogs.entity,
        entityId: auditLogs.entityId,
        details: auditLogs.details,
        createdAt: auditLogs.createdAt,
        userName: users.fullName,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(eq(auditLogs.orgId, orgId))
      .orderBy(desc(auditLogs.id))
      .limit(150);
    return ok(rows);
  } catch (e) {
    return fail(e);
  }
}
