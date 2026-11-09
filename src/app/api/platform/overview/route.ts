import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  organizations, organizationSubscriptions, subscriptionPlans, subscriptionPayments,
  pickupStations, members,
} from "@/db/rh-schema";
import { requirePlatform } from "@/lib/authz";
import { fail, ok } from "@/lib/rh-api";
import { ensureSeeded } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    await ensureSeeded();
    await requirePlatform("support");

    const orgs = await db.select().from(organizations).orderBy(organizations.name);
    const subs = await db
      .select()
      .from(organizationSubscriptions)
      .orderBy(desc(organizationSubscriptions.id));
    const rawPlans = await db.select().from(subscriptionPlans).orderBy(subscriptionPlans.sortOrder);
    const orgNameById = new Map(orgs.map((o) => [o.id, o.name] as const));
    // plans enriched with their current tenants (the UI renders p.tenants)
    const plans = rawPlans.map((p) => ({
      ...p,
      tenants: subs.filter((s) => s.planId === p.id).map((s) => orgNameById.get(s.orgId) ?? `org ${s.orgId}`),
    }));

    const latestSub = new Map<number, (typeof subs)[number]>();
    for (const s of subs) if (!latestSub.has(s.orgId)) latestSub.set(s.orgId, s);

    const orgRows = await Promise.all(
      orgs.map(async (o) => {
        const sub = latestSub.get(o.id) ?? null;
        const plan = sub ? plans.find((p) => p.id === sub.planId) ?? null : null;
        const [m, st] = await Promise.all([
          db.select({ n: sql`count(*)::int` }).from(members).where(eq(members.orgId, o.id)),
          db
            .select({ n: sql`count(*)::int` })
            .from(pickupStations)
            .where(
              sql`${pickupStations.orgId} = ${o.id} AND (${pickupStations.isArchived} IS NULL OR ${pickupStations.isArchived} = false)`
            ),
        ]);
        return {
          id: o.id,
          name: o.name,
          slug: o.slug,
          code: o.code,
          email: o.email,
          status: o.status,
          planName: plan?.name ?? null,
          subStatus: sub?.status ?? "none",
          periodEnd: sub?.currentPeriodEnd ?? null,
          billingCycle: sub?.billingCycle ?? null,
          members: Number(m[0]?.n ?? 0),
          stations: Number(st[0]?.n ?? 0),
        };
      }),
    );

    const [totalMembers, totalStations] = await Promise.all([
      db.select({ n: sql`count(*)::int` }).from(members),
      db.select({ n: sql`count(*)::int` }).from(pickupStations),
    ]);
    const rev = await db
      .select({ n: sql`coalesce(sum(amount_kes),0)::int` })
      .from(subscriptionPayments)
      .where(eq(subscriptionPayments.status, "verified"));
    const pending = await db
      .select()
      .from(subscriptionPayments)
      .where(eq(subscriptionPayments.status, "pending"))
      .orderBy(desc(subscriptionPayments.createdAt))
      .limit(10);

    return ok({
      stats: {
        orgs: orgs.length,
        activeSubs: orgRows.filter((o) => o.subStatus === "active").length,
        renewalDue: orgRows.filter((o) => o.subStatus === "renewal_due" || o.subStatus === "past_due").length,
        totalMembers: Number(totalMembers[0]?.n ?? 0),
        totalStations: Number(totalStations[0]?.n ?? 0),
        revenueKes: Number(rev[0]?.n ?? 0),
        pendingPayments: pending.length,
      },
      orgs: orgRows,
      plans,
      pendingPayments: pending.map((p) => ({
        id: p.id,
        orgId: p.orgId,
        orgName: orgRows.find((o) => o.id === p.orgId)?.name ?? `#${p.orgId}`,
        method: p.method,
        mpesaRef: p.mpesaRef,
        amountKes: p.amountKes,
        notes: p.notes,
        createdAt: p.createdAt,
      })),
    });
  } catch (e) {
    return fail(e);
  }
}
