import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sessions } from "@/db/rh-schema";
import { SESSION_COOKIE } from "@/lib/authz";

export const dynamic = "force-dynamic";

export async function POST() {
  const c = await cookies();
  const t = c.get(SESSION_COOKIE)?.value;
  if (t) await db.delete(sessions).where(eq(sessions.token, t));
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
