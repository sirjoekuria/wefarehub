import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { subscriptionPlans, organizations, organizationSubscriptions } from "@/db/rh-schema";
import { requirePlatform, audit } from "@/lib/authz";
import { fail, ok, body } from "@/lib/rh-api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requirePlatform("support");
    const plans = await db.select().from(subscriptionPlans).orderBy(asc(subscriptionPlans.sortOrder));
    const subs = await db.select().from(organizationSubscriptions);
    const orgs = await db.select({ id: organizations.id, name: organizations.name }).from(organizations);
    const orgName = new Map(orgs.map((o) => [o.id, o.name] as const));
    const usage = plans.map((p) => ({
      ...p,
      tenants: subs.filter((s) => s.planId === p.id).map((s) => orgName.get(s.orgId) ?? `org ${s.orgId}`),
    }));
    return ok(usage);
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requirePlatform("super_admin");
    const { name, code, monthlyPriceKes, annualPriceKes, maxStations, maxMembers, maxAdmins, storageMb, description } =
      await body<Record<string, unknown>>(req);
    if (!name || !code || !monthlyPriceKes || !annualPriceKes)
      return fail(Object.assign(new Error("name, code and pricing are required."), { status: 400 }));
    const [row] = await db
      .insert(subscriptionPlans)
      .values({
        name: String(name),
        code: String(code).toLowerCase(),
        description: description ? String(description) : null,
        monthlyPriceKes: Number(monthlyPriceKes),
        annualPriceKes: Number(annualPriceKes),
        maxStations: Number(maxStations || 1),
        maxMembers: Number(maxMembers || 50),
        maxAdmins: Number(maxAdmins || 1),
        storageMb: Number(storageMb || 100),
      })
      .returning();
    await audit(user.id, null, "plan.created", { entity: "plan", entityId: row.id });
    return ok(row, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
