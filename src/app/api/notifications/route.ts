import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/rh-schema";
import { requireUser } from "@/lib/authz";
import { fail, ok } from "@/lib/rh-api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(30);
    return ok(rows);
  } catch (e) {
    return fail(e);
  }
}

export async function POST() {
  try {
    const user = await requireUser();
    const unread = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
    for (const n of unread)
      await db.update(notifications).set({ readAt: new Date() }).where(eq(notifications.id, n.id));
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
