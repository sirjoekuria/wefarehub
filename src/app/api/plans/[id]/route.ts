import { eq } from "drizzle-orm";
import { db } from "@/db";
import { subscriptionPlans } from "@/db/rh-schema";
import { requirePlatform, audit } from "@/lib/authz";
import { fail, ok, body } from "@/lib/rh-api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const user = await requirePlatform("super_admin");
    const planId = Number((await params).id);
    const [before] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, planId));
    if (!before) return fail(Object.assign(new Error("Plan not found."), { status: 404 }));

    const b = await body<Record<string, unknown>>(req);
    const set: Record<string, unknown> = {};
    for (const k of ["name", "description", "monthlyPriceKes", "annualPriceKes", "maxStations", "maxMembers", "maxAdmins", "storageMb", "isActive"] as const) {
      if (b[k] !== undefined) set[k] = k === "description" ? String(b[k] ?? null) : b[k];
    }
    if (Object.keys(set).length === 0)
      return fail(Object.assign(new Error("Nothing to update."), { status: 400 }));
    await db.update(subscriptionPlans).set(set as never).where(eq(subscriptionPlans.id, planId));
    await audit(user.id, null, "plan.updated", {
      entity: "plan",
      entityId: planId,
      details: { before: { price: before.monthlyPriceKes, stations: before.maxStations, members: before.maxMembers }, set },
    });
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
