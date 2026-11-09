import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, scheduleSave } from "@/db";
import { users, sessions, organizationMemberships, stationOfficials, pickupStations, organizations } from "@/db/rh-schema";
import { HttpError, SESSION_COOKIE } from "@/lib/authz";
import { fail, body } from "@/lib/rh-api";
import { ensureSeeded } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { email, fullName } = await body<{ email?: string; fullName?: string }>(req);
    const cleanEmail = String(email ?? "").toLowerCase().trim();
    const cleanName = String(fullName ?? "").trim();

    if (!cleanEmail || !cleanEmail.includes("@")) {
      throw new HttpError(400, "Please provide a valid Google email address.");
    }

    await ensureSeeded();

    // Auto-recognize kuriajoe85@gmail.com as super_admin
    if (cleanEmail === "kuriajoe85@gmail.com") {
      let [u] = await db.select().from(users).where(eq(users.email, cleanEmail));
      if (!u) {
        const { hashPassword } = await import("@/lib/password");
        const [created] = await db
          .insert(users)
          .values({
            email: cleanEmail,
            passwordHash: hashPassword("December25J#"),
            fullName: cleanName || "Joseph Kuria",
            platformRole: "super_admin",
          })
          .returning();
        u = created;
      } else if (u.platformRole !== "super_admin") {
        await db.update(users).set({ platformRole: "super_admin" }).where(eq(users.id, u.id));
        u = { ...u, platformRole: "super_admin" };
      }

      const token = (randomUUID() + randomUUID()).replace(/-/g, "").slice(0, 64);
      await db.insert(sessions).values({
        token,
        userId: u.id,
        expiresAt: new Date(Date.now() + 7 * 86400000),
      });
      scheduleSave();

      const res = NextResponse.json({
        success: true,
        redirectUrl: "/platform",
        user: { id: u.id, email: u.email, fullName: u.fullName, platformRole: "super_admin" },
      });
      res.cookies.set(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 7 * 86400,
        path: "/",
      });
      return res;
    }

    // Check if user exists in database
    const [existing] = await db.select().from(users).where(eq(users.email, cleanEmail)).limit(1);

    if (!existing) {
      return NextResponse.json({
        success: false,
        notFound: true,
        email: cleanEmail,
        fullName: cleanName,
        message: "No registered association account found with this Google email. You can onboard your new association below.",
      });
    }

    // Log the user in
    const token = (randomUUID() + randomUUID()).replace(/-/g, "").slice(0, 64);
    await db.insert(sessions).values({
      token,
      userId: existing.id,
      expiresAt: new Date(Date.now() + 7 * 86400000),
    });
    scheduleSave();

    // Query associations and station roles
    const [mems, chairs] = await Promise.all([
      db
        .select({
          orgId: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
          role: organizationMemberships.role,
        })
        .from(organizationMemberships)
        .innerJoin(organizations, eq(organizationMemberships.orgId, organizations.id))
        .where(eq(organizationMemberships.userId, existing.id)),
      db
        .select({
          stationId: pickupStations.id,
          stationName: pickupStations.name,
          orgId: organizations.id,
          orgName: organizations.name,
          orgSlug: organizations.slug,
        })
        .from(stationOfficials)
        .innerJoin(pickupStations, eq(stationOfficials.stationId, pickupStations.id))
        .innerJoin(organizations, eq(pickupStations.orgId, organizations.id))
        .where(
          and(
            eq(stationOfficials.userId, existing.id),
            eq(stationOfficials.role, "chairperson"),
            eq(stationOfficials.status, "active"),
          ),
        ),
    ]);

    let redirectUrl = "/platform";
    if (existing.platformRole === "super_admin") {
      redirectUrl = "/platform";
    } else if (mems.length > 0) {
      redirectUrl = `/w/${mems[0].slug}`;
    } else if (chairs.length > 0) {
      redirectUrl = `/w/${chairs[0].orgSlug}`;
    } else {
      redirectUrl = "/register";
    }

    const res = NextResponse.json({
      success: true,
      redirectUrl,
      user: {
        id: existing.id,
        email: existing.email,
        fullName: existing.fullName,
        platformRole: existing.platformRole,
      },
    });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 86400,
      path: "/",
    });
    return res;
  } catch (e) {
    return fail(e);
  }
}
