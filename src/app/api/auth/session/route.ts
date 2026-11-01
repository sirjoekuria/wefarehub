import { scryptSync, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { demoAdmins } from '@/db/schema';
import { checkOrigin, isDemo } from '@/lib/auth';
import { demoUser } from '@/lib/demo-mode';

export const dynamic = 'force-dynamic';
const attempts = new Map<string, { count: number; until: number }>();
const noStore = { headers: { 'Cache-Control': 'no-store' } };

// The demo is intentionally steady: every session check returns the sample admin.
// Supabase-configured deployments never enter this branch and use Supabase Auth.
export async function GET() {
  if (!isDemo()) return Response.json({ user: null }, noStore);
  return Response.json({ user: demoUser() }, noStore);
}

export async function POST(req: Request) {
  try {
    checkOrigin(req);
    if (!isDemo()) return Response.json({ error: 'Local authentication is disabled.' }, { status: 404 });
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'local';
    const previous = attempts.get(ip);
    if (previous && previous.until > Date.now() && previous.count >= 10) return Response.json({ error: 'Too many sign-in attempts. Please try again in 15 minutes.' }, { status: 429 });
    const { email, password, demo } = await req.json();
    if (demo === true) return Response.json({ user: demoUser() }, noStore);
    if (typeof email !== 'string' || typeof password !== 'string' || password.length > 200) return Response.json({ error: 'Enter your email and password.' }, { status: 400 });
    const [admin] = await db.select().from(demoAdmins).where(eq(demoAdmins.email, email.trim().toLowerCase()));
    let valid = false;
    if (admin) {
      const [salt, hash] = admin.passwordHash.split(':');
      const actual = scryptSync(password, salt, 64);
      const expected = Buffer.from(hash, 'hex');
      valid = actual.length === expected.length && timingSafeEqual(actual, expected);
    }
    if (!admin || !valid) {
      const next = previous && previous.until > Date.now() ? previous : { count: 0, until: Date.now() + 900000 };
      next.count++; attempts.set(ip, next);
      return Response.json({ error: 'Incorrect email or password. Please try again.' }, { status: 401 });
    }
    attempts.delete(ip);
    return Response.json({ user: demoUser(admin.email) }, noStore);
  } catch {
    return Response.json({ error: 'Unable to sign in. Please try again.' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try { checkOrigin(req); return Response.json({ ok: true, demo: isDemo() }, noStore); }
  catch { return Response.json({ error: 'Unable to sign out.' }, { status: 400 }); }
}
