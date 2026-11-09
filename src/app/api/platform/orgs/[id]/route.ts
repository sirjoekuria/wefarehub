import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organizations, organizationSubscriptions, subscriptionPlans } from "@/db/rh-schema";
import { requirePlatform, getOrgById, audit } from "@/lib/authz";
import { fail, ok, body } from "@/lib/rh-api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const user = await requirePlatform("super_admin");
    const { id } = await params;
    const orgId = Number(id);
    const org = await getOrgById(orgId);
    if (!org) return fail(Object.assign(new Error("Association not found."), { status: 404 }));

    const { action, reason, planId, billingCycle } = await body<{
      action?: string; reason?: string; planId?: number; billingCycle?: "monthly" | "annual";
    }>(req);

    if (action === "suspend") {
      await db.update(organizations).set({ status: "suspended" }).where(eq(organizations.id, orgId));
      await db
        .update(organizationSubscriptions)
        .set({ status: "suspended", notes: `Suspended by platform: ${reason ?? "no reason"}` })
        .where(eq(organizationSubscriptions.orgId, orgId));
      await audit(user.id, orgId, "org.suspended", { entity: "organization", entityId: orgId, details: { reason } });
      return ok({ ok: true });
    }

    if (action === "reinstate") {
      const start = new Date().toISOString().slice(0, 10);
      const end = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      await db.update(organizations).set({ status: "active" }).where(eq(organizations.id, orgId));
      await db
        .update(organizationSubscriptions)
        .set({ status: "active", currentPeriodStart: start, currentPeriodEnd: end, notes: `Reinstated: ${reason ?? ""}` })
        .where(eq(organizationSubscriptions.orgId, orgId));
      await audit(user.id, orgId, "org.reinstated", { entity: "organization", entityId: orgId, details: { reason } });
      return ok({ ok: true });
    }

    if (action === "set_subscription") {
      if (!planId || !billingCycle) return fail(Object.assign(new Error("planId and billingCycle are required."), { status: 400 }));
      const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, planId));
      if (!plan) return fail(Object.assign(new Error("Plan not found."), { status: 400 }));
      const start = new Date().toISOString().slice(0, 10);
      const end = new Date(Date.now() + (billingCycle === "annual" ? 365 : 30) * 86400000).toISOString().slice(0, 10);
      await db
        .insert(organizationSubscriptions)
        .values({
          orgId,
          planId,
          status: "active",
          billingCycle,
          currentPeriodStart: start,
          currentPeriodEnd: end,
          notes: `Set by platform admin: ${reason ?? ""}`,
        });
      await db.update(organizations).set({ status: "active" }).where(eq(organizations.id, orgId));
      await audit(user.id, orgId, "subscription.activated", {
        entity: "subscription",
        entityId: orgId,
        details: { plan: plan.code, cycle: billingCycle },
      });
      return ok({ ok: true });
    }

    return fail(Object.assign(new Error("Unknown action."), { status: 400 }));
  } catch (e) {
    return fail(e);
  }
}
