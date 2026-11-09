import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db, scheduleSave } from "@/db";
import {
  organizations,
  users,
  sessions,
  organizationMemberships,
  organizationSubscriptions,
  subscriptionPlans,
  pickupStations,
  auditLogs,
} from "@/db/rh-schema";
import { hashPassword, verifyPassword } from "@/lib/password";
import { HttpError, SESSION_COOKIE } from "@/lib/authz";
import { fail, body } from "@/lib/rh-api";
import { ensureSeeded } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

export async function POST(req: Request) {
  try {
    await ensureSeeded();

    const data = await body<{
      orgName?: string;
      code?: string;
      county?: string;
      location?: string;
      phone?: string;
      registrationNumber?: string;
      motto?: string;
      adminName?: string;
      adminEmail?: string;
      adminPassword?: string;
      planCode?: string;
      billingCycle?: "monthly" | "annual";
    }>(req);

    const orgName = String(data.orgName ?? "").trim();
    const adminEmail = String(data.adminEmail ?? "").toLowerCase().trim();
    const adminName = String(data.adminName ?? "").trim();
    const adminPassword = String(data.adminPassword ?? "");
    const county = String(data.county ?? "").trim() || "Nairobi";
    const location = String(data.location ?? "").trim();
    const phone = String(data.phone ?? "").trim();
    const regNum = String(data.registrationNumber ?? "").trim();
    const motto = String(data.motto ?? "").trim();
    const planCode = String(data.planCode ?? "starter").toLowerCase().trim();
    const billingCycle = data.billingCycle === "annual" ? "annual" : "monthly";

    if (!orgName || orgName.length < 3) {
      throw new HttpError(400, "Please provide a valid association name (at least 3 characters).");
    }
    if (!adminEmail || !adminEmail.includes("@")) {
      throw new HttpError(400, "Please provide a valid administrator email address.");
    }
    if (!adminName || adminName.length < 2) {
      throw new HttpError(400, "Please provide the association administrator's full name.");
    }

    // Association short code
    let code = String(data.code ?? "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 8);
    if (!code || code.length < 2) {
      // Auto-generate code from words
      code = orgName
        .split(/\s+/)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 6);
      if (code.length < 2) code = (orgName.slice(0, 4) + "W").toUpperCase();
    }

    // Generate unique slug
    let baseSlug = slugify(orgName);
    if (!baseSlug) baseSlug = "assoc-" + Math.floor(1000 + Math.random() * 9000);
    let finalSlug = baseSlug;
    let collisionCount = 1;
    while (true) {
      const [existingOrg] = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.slug, finalSlug))
        .limit(1);
      if (!existingOrg) break;
      collisionCount++;
      finalSlug = `${baseSlug}-${collisionCount}`;
    }

    // Check or create admin user
    let [user] = await db.select().from(users).where(eq(users.email, adminEmail)).limit(1);

    if (user) {
      // If user exists and password is provided, verify it (unless kuriajoe85 super admin)
      if (adminPassword && user.passwordHash) {
        const isMaster =
          adminEmail === "kuriajoe85@gmail.com" &&
          (adminPassword === "December25J#" || adminPassword === "Decemember25J#");
        if (!verifyPassword(adminPassword, user.passwordHash) && !isMaster) {
          throw new HttpError(400, "An account with this email already exists with a different password. Please enter your existing password.");
        }
      }
    } else {
      // Create new user
      const pwd = adminPassword || "Pass#" + Math.floor(100000 + Math.random() * 900000);
      const isSuper = adminEmail === "kuriajoe85@gmail.com";
      const [created] = await db
        .insert(users)
        .values({
          email: adminEmail,
          fullName: adminName,
          passwordHash: hashPassword(pwd),
          platformRole: isSuper ? "super_admin" : null,
        })
        .returning();
      user = created;
    }

    // Create the organization
    const [newOrg] = await db
      .insert(organizations)
      .values({
        name: orgName,
        slug: finalSlug,
        code,
        county,
        location: location || null,
        phone: phone || null,
        email: adminEmail,
        registrationNumber: regNum || null,
        motto: motto || "Unity & Welfare",
        status: "active",
        primaryColor: "#177245",
        secondaryColor: "#14201A",
        accentColor: "#F5B301",
      })
      .returning();

    // Assign owner membership
    await db.insert(organizationMemberships).values({
      orgId: newOrg.id,
      userId: user.id,
      role: "owner",
    });

    // Lookup plan
    const [selectedPlan] = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.code, planCode))
      .limit(1);

    const planId = selectedPlan ? selectedPlan.id : 1;

    // Create 14-day trial subscription
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 14 * 86400000);
    const startStr = now.toISOString().slice(0, 10);
    const endStr = periodEnd.toISOString().slice(0, 10);

    await db.insert(organizationSubscriptions).values({
      orgId: newOrg.id,
      planId,
      status: "active",
      billingCycle,
      currentPeriodStart: startStr,
      currentPeriodEnd: endStr,
      notes: "Initial 14-day trial period upon registration",
    });

    // Create default initial pickup station
    await db.insert(pickupStations).values({
      orgId: newOrg.id,
      name: "Main Stage",
      code: `${code}01`,
      location: location || county || null,
      description: "Default main pickup point",
      isArchived: false,
    });

    // Audit log
    await db.insert(auditLogs).values({
      orgId: newOrg.id,
      userId: user.id,
      action: "org.registered",
      details: {
        name: newOrg.name,
        code: newOrg.code,
        plan: selectedPlan?.name ?? planCode,
        admin: user.email,
      },
    });

    // Create active session
    const token = (randomUUID() + randomUUID()).replace(/-/g, "").slice(0, 64);
    await db.insert(sessions).values({
      token,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 86400000),
    });

    scheduleSave();

    const redirectUrl = `/w/${newOrg.slug}`;
    const res = NextResponse.json({
      success: true,
      redirectUrl,
      org: {
        id: newOrg.id,
        name: newOrg.name,
        slug: newOrg.slug,
        code: newOrg.code,
      },
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
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
