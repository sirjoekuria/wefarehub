import { eq } from "drizzle-orm";
import { db, persistDb } from "@/db";
import { subscriptionPayments, organizationSubscriptions } from "@/db/rh-schema";
import { requirePlatform, audit } from "@/lib/authz";
import { fail, ok, body } from "@/lib/rh-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const user = await requirePlatform("support");
    const paymentId = Number((await params).id);
    const [payment] = await db.select().from(subscriptionPayments).where(eq(subscriptionPayments.id, paymentId));
    if (!payment) return fail(Object.assign(new Error("Payment not found."), { status: 404 }));
    if (payment.status !== "pending")
      return fail(Object.assign(new Error("Only pending payments can be verified."), { status: 409 }));

    const { verdict, notes } = await body<{ verdict?: string; notes?: string }>(req);
    if (verdict === "verified" || verdict === "rejected") {
      const set =
        verdict === "verified"
          ? { status: "verified" as const, verifiedBy: user.id, verifiedAt: new Date(), notes: notes ?? payment.notes }
          : { status: "rejected" as const, verifiedBy: user.id, verifiedAt: new Date(), notes: notes ?? payment.notes };
      await db.update(subscriptionPayments).set(set).where(eq(subscriptionPayments.id, paymentId));

      if (verdict === "verified") {
        // verified payment renews a renewal_due / past_due / grace subscription
        const sub = await db
          .select()
          .from(organizationSubscriptions)
          .where(eq(organizationSubscriptions.orgId, payment.orgId))
          .then(async (rows) => rows[0] ?? null);
        if (sub && ["renewal_due", "past_due", "grace_period"].includes(sub.status)) {
          const start = new Date().toISOString().slice(0, 10);
          const end = new Date(Date.now() + (sub.billingCycle === "annual" ? 365 : 30) * 86400000).toISOString().slice(0, 10);
          await db
            .update(organizationSubscriptions)
            .set({ status: "active", currentPeriodStart: start, currentPeriodEnd: end, notes: "Renewed — payment verified" })
            .where(eq(organizationSubscriptions.id, sub.id));
        }
        await audit(user.id, payment.orgId, "payment.verified", {
          entity: "payment",
          entityId: paymentId,
          details: { method: payment.method, amountKes: payment.amountKes, ref: payment.mpesaRef },
        });
      }
      await persistDb();
      return ok({ ok: true });
    }
    return fail(Object.assign(new Error("verdict must be verified or rejected."), { status: 400 }));
  } catch (e) {
    return fail(e);
  }
}
