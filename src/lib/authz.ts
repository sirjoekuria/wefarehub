import "server-only";
import { cookies } from "next/headers";
import { and, eq, desc, sql, notInArray } from "drizzle-orm";
import { db } from "@/db";
import {
  users,
  sessions,
  organizations,
  organizationMemberships,
  stationOfficials,
  pickupStations,
  members,
  organizationSubscriptions,
  subscriptionPlans,
  auditLogs,
} from "@/db/rh-schema";
import { verifyPassword } from "./password";

export const SESSION_COOKIE = "rh360_session";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export type SessionUser = {
  id: number;
  email: string;
  fullName: string;
  platformRole: "super_admin" | "support" | null;
};

export type OrgRole = "owner" | "admin" | "secretary" | "treasurer";

/** Everything a user may do inside one organization, derived server-side. */
export type OrgAccess = {
  orgId: number;
  orgRole: OrgRole | null;
  isOrgMember: boolean;
  /** Non-null when the user is the active chairperson of a station in this org. */
  chairStationId: number | null;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({
      token: sessions.token,
      expiresAt: sessions.expiresAt,
      userId: users.id,
      email: users.email,
      fullName: users.fullName,
      platformRole: users.platformRole,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.token, token));
  const row = rows[0];
  if (!row || row.expiresAt.getTime() < Date.now()) return null;
  return {
    id: row.userId,
    email: row.email,
    fullName: row.fullName,
    platformRole: (row.platformRole as SessionUser["platformRole"]) ?? null,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new HttpError(401, "Sign in to continue.");
  return user;
}

export async function requirePlatform(min: "support" | "super_admin" = "support"): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.platformRole) throw new HttpError(403, "Platform access required.");
  if (min === "super_admin" && user.platformRole !== "super_admin")
    throw new HttpError(403, "Super admin required.");
  return user;
}

export async function getOrgBySlug(slug: string) {
  const rows = await db.select().from(organizations).where(eq(organizations.slug, slug));
  return rows[0] ?? null;
}

export async function getOrgById(id: number) {
  const rows = await db.select().from(organizations).where(eq(organizations.id, id));
  return rows[0] ?? null;
}

/**
 * Derive everything the user can do in `orgId`.
 * - orgRole from organization_memberships (one row max)
 * - chairStationId from the user's ACTIVE chairperson appointment, if that
 *   station belongs to this org. Never taken from the client.
 */
export async function getAccess(userId: number, orgId: number): Promise<OrgAccess> {
  const [mem, chairs] = await Promise.all([
    db
      .select({ role: organizationMemberships.role })
      .from(organizationMemberships)
      .where(and(eq(organizationMemberships.orgId, orgId), eq(organizationMemberships.userId, userId))),
    db
      .select({ stationId: stationOfficials.stationId, orgId: pickupStations.orgId })
      .from(stationOfficials)
      .innerJoin(pickupStations, eq(stationOfficials.stationId, pickupStations.id))
      .where(
        and(
          eq(stationOfficials.userId, userId),
          eq(stationOfficials.role, "chairperson"),
          eq(stationOfficials.status, "active"),
        ),
      ),
  ]);
  const chair = chairs.find((c) => c.orgId === orgId);
  return {
    orgId,
    orgRole: (mem[0]?.role as OrgRole | undefined) ?? null,
    isOrgMember: mem.length > 0,
    chairStationId: chair?.stationId ?? null,
  };
}

export async function requireAccess(userId: number, orgId: number): Promise<OrgAccess> {
  const org = await getOrgById(orgId);
  if (!org) throw new HttpError(404, "Workspace not found.");
  const access = await getAccess(userId, orgId);
  if (!access.isOrgMember && !access.chairStationId)
    throw new HttpError(403, "You do not have access to this workspace.");
  return access;
}

export async function requireOrgRole(
  userId: number,
  orgId: number,
  roles: OrgRole[],
): Promise<OrgAccess> {
  const access = await requireAccess(userId, orgId);
  if (!access.orgRole || !roles.includes(access.orgRole))
    throw new HttpError(403, "You need an association administrator role for this action.");
  return access;
}

/**
 * Station scope gate.
 * - chairperson: stationId must equal their assigned station, full stop.
 * - org official: station must belong to this org.
 */
export async function assertStation(access: OrgAccess, stationId: number | null | undefined) {
  if (!stationId) throw new HttpError(400, "Station is required.");
  const rows = await db
    .select({ id: pickupStations.id, orgId: pickupStations.orgId, isArchived: pickupStations.isArchived })
    .from(pickupStations)
    .where(eq(pickupStations.id, stationId));
  const station = rows[0];
  if (!station || station.orgId !== access.orgId)
    throw new HttpError(403, "Station not found in this workspace.");
  if (access.chairStationId !== null && station.id !== access.chairStationId)
    throw new HttpError(403, "Chairpersons can only access their assigned station.");
  return station;
}

/** Station rows the caller may read (org officials → all; chairpersons → own). */
export function stationScopeFilter(access: OrgAccess) {
  if (access.chairStationId !== null && access.orgRole === null)
    return eq(pickupStations.id, access.chairStationId);
  return undefined;
}

/** Subscription entitlement gate for operational writes. */
export async function getSubscription(orgId: number) {
  const rows = await db
    .select({
      id: organizationSubscriptions.id,
      orgId: organizationSubscriptions.orgId,
      status: organizationSubscriptions.status,
      billingCycle: organizationSubscriptions.billingCycle,
      currentPeriodStart: organizationSubscriptions.currentPeriodStart,
      currentPeriodEnd: organizationSubscriptions.currentPeriodEnd,
      planId: subscriptionPlans.id,
      planCode: subscriptionPlans.code,
      planName: subscriptionPlans.name,
      maxStations: subscriptionPlans.maxStations,
      maxMembers: subscriptionPlans.maxMembers,
      monthlyPriceKes: subscriptionPlans.monthlyPriceKes,
      annualPriceKes: subscriptionPlans.annualPriceKes,
    })
    .from(organizationSubscriptions)
    .innerJoin(subscriptionPlans, eq(organizationSubscriptions.planId, subscriptionPlans.id))
    .where(eq(organizationSubscriptions.orgId, orgId))
    .orderBy(desc(organizationSubscriptions.id));
  return rows[0] ?? null;
}

export const BLOCKED_SUB_STATUSES = ["pending_payment", "suspended", "cancelled", "expired"] as const;

export async function assertEntitled(orgId: number, feature = "operations") {
  const sub = await getSubscription(orgId);
  if (!sub)
    throw new HttpError(402, "This workspace needs an active RiderHub 360 subscription to use this feature.");
  if ((BLOCKED_SUB_STATUSES as readonly string[]).includes(sub.status))
    throw new HttpError(402, `Subscription is ${sub.status.replace("_", " ")} — operational access is paused.`);
  return sub;
}

export async function assertCapacity(orgId: number, kind: "station" | "member" | "admin") {
  const sub = await assertEntitled(orgId);
  const [plan] = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.code, sub.planCode));
  if (!plan) throw new HttpError(402, "Subscription plan unavailable.");
  const limit =
    kind === "station" ? plan.maxStations : kind === "member" ? plan.maxMembers : plan.maxAdmins;
  const [c] =
    kind === "station"
      ? await db
          .select({ n: sql`count(*)::int` })
          .from(pickupStations)
          .where(and(eq(pickupStations.orgId, orgId), eq(pickupStations.isArchived, false)))
      : kind === "member"
        ? await db
            .select({ n: sql`count(*)::int` })
            .from(members)
            .where(and(eq(members.orgId, orgId), notInArray(members.status, ["archived", "deceased"])))
        : await db.select({ n: sql`count(*)::int` }).from(organizationMemberships).where(eq(organizationMemberships.orgId, orgId));
  const count = Number(c?.n ?? 0);
  if (count >= limit)
    throw new HttpError(
      402,
      `Your ${sub.planName} plan is at its ${kind} limit (${limit}). Upgrade to continue.`,
    );
  return sub;
}

export async function audit(
  userId: number | null,
  orgId: number | null,
  action: string,
  opts: { entity?: string; entityId?: string | number; details?: Record<string, unknown> } = {},
) {
  try {
    await db.insert(auditLogs).values({
      userId,
      orgId,
      action,
      entity: opts.entity ?? null,
      entityId: opts.entityId != null ? String(opts.entityId) : null,
      details: opts.details ?? null,
    });
  } catch {
    // auditing must never break the primary operation
  }
}
