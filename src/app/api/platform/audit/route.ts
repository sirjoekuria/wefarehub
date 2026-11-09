import { desc, eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, users, organizations } from "@/db/rh-schema";
import { requirePlatform } from "@/lib/authz";
import { fail, ok, query } from "@/lib/rh-api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requirePlatform("support");
    const orgFilter = query(req, "orgId");
    const where = orgFilter ? eq(auditLogs.orgId, Number(orgFilter)) : undefined;
    const rows = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        entity: auditLogs.entity,
        entityId: auditLogs.entityId,
        details: auditLogs.details,
        createdAt: auditLogs.createdAt,
        orgId: auditLogs.orgId,
        orgName: organizations.name,
        userName: users.fullName,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .leftJoin(organizations, eq(auditLogs.orgId, organizations.id))
      .where(where)
      .orderBy(desc(auditLogs.id))
      .limit(100);
    return ok(rows);
  } catch (e) {
    return fail(e);
  }
}
