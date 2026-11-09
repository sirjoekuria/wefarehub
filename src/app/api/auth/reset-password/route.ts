import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const globalForAuth = globalThis as typeof globalThis & {
  __riderHubOtpStore?: Map<string, { code: string; expiresAt: number }>;
};
const localOtpStore =
  globalForAuth.__riderHubOtpStore ?? (globalForAuth.__riderHubOtpStore = new Map());

function getAdminClient() {
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function getAnonClient() {
  if (!supabaseUrl || !anonKey) return null;
  return createClient(supabaseUrl, anonKey);
}

async function syncLocalUserPassword(email: string, newPassword: string) {
  try {
    const { db, scheduleSave } = await import('@/db');
    const { users } = await import('@/db/rh-schema');
    const { hashPassword } = await import('@/lib/password');
    const { eq } = await import('drizzle-orm');

    await db
      .update(users)
      .set({
        passwordHash: hashPassword(newPassword),
      })
      .where(eq(users.email, email.toLowerCase().trim()));

    scheduleSave();
  } catch (err) {
    console.warn('Could not sync password to local DB:', err);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, email, otp, newPassword, origin } = body;

    const admin = getAdminClient();
    const anon = getAnonClient();

    const cleanEmail = String(email || '').trim().toLowerCase();

    // ACTION: REQUEST RESET
    if (action === 'request') {
      if (!cleanEmail) {
        return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
      }

      let supabaseUser: { id: string; email?: string } | null = null;
      if (admin) {
        try {
          const { data: usersData } = await admin.auth.admin.listUsers();
          supabaseUser = (usersData?.users || []).find((u) => u.email?.toLowerCase() === cleanEmail) || null;
        } catch (e) {
          console.warn('listUsers error:', e);
        }
      }

      // Check local DB if not found in Supabase
      let localUserFound = false;
      try {
        const { db } = await import('@/db');
        const { users } = await import('@/db/rh-schema');
        const { eq } = await import('drizzle-orm');
        const [localU] = await db.select().from(users).where(eq(users.email, cleanEmail)).limit(1);
        if (localU) localUserFound = true;
      } catch {}

      if (!supabaseUser && !localUserFound) {
        return NextResponse.json(
          {
            error: `No registered account found with email "${cleanEmail}". Please check your email or contact system administration.`,
          },
          { status: 404 }
        );
      }

      const siteOrigin = origin || 'https://welfare-delta-nine.vercel.app';
      const redirectUrl = `${siteOrigin}/reset-password`;

      let emailOtp: string | null = null;
      let actionLink: string | null = null;

      // If Supabase user exists and admin client is available, generate Supabase recovery link
      if (supabaseUser && admin) {
        const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
          type: 'recovery',
          email: cleanEmail,
          options: { redirectTo: redirectUrl },
        });

        if (!linkErr && linkData?.properties) {
          emailOtp = linkData.properties.email_otp || null;
          actionLink = linkData.properties.action_link || null;
        }

        if (anon) {
          try {
            await anon.auth.resetPasswordForEmail(cleanEmail, { redirectTo: redirectUrl });
          } catch (e) {
            console.warn('resetPasswordForEmail warning:', e);
          }
        }
      }

      // Fallback or additional local OTP code
      if (!emailOtp) {
        emailOtp = Math.floor(10000000 + Math.random() * 90000000).toString();
      }
      localOtpStore.set(cleanEmail, { code: emailOtp, expiresAt: Date.now() + 15 * 60 * 1000 });

      // Audit log
      if (admin) {
        try {
          await admin.from('audit_logs').insert({
            actor_email: cleanEmail,
            action: 'auth.password_reset_request',
            entity_type: 'auth',
            entity_name: 'Password reset request generated',
            details: { email: cleanEmail, redirectTo: redirectUrl },
          });
        } catch {}
      }

      return NextResponse.json({
        success: true,
        message: 'Password reset instructions and verification code generated.',
        emailOtp,
        actionLink: actionLink || `${redirectUrl}?email=${encodeURIComponent(cleanEmail)}`,
      });
    }

    // ACTION: VERIFY OTP AND UPDATE PASSWORD
    if (action === 'verify-and-update') {
      if (!cleanEmail) {
        return NextResponse.json({ error: 'Email address is required.' }, { status: 400 });
      }
      if (!otp) {
        return NextResponse.json({ error: 'Please enter the verification code or OTP.' }, { status: 400 });
      }
      if (!newPassword || newPassword.length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters long.' }, { status: 400 });
      }

      const inputOtp = String(otp).trim();
      let verified = false;

      // Check local OTP store first
      const stored = localOtpStore.get(cleanEmail);
      if (stored && stored.code === inputOtp && stored.expiresAt > Date.now()) {
        verified = true;
        localOtpStore.delete(cleanEmail);
      }

      // Try verify with Supabase if anon is configured
      if (!verified && anon) {
        const { error: verifyErr } = await anon.auth.verifyOtp({
          email: cleanEmail,
          token: inputOtp,
          type: 'recovery',
        });
        if (!verifyErr) {
          verified = true;
        }
      }

      if (!verified) {
        return NextResponse.json(
          { error: 'Invalid or expired verification code. Please request a fresh reset link.' },
          { status: 400 }
        );
      }

      // Update in Supabase if user exists there
      if (admin) {
        try {
          const { data: usersData } = await admin.auth.admin.listUsers();
          const found = (usersData?.users || []).find((u) => u.email?.toLowerCase() === cleanEmail);
          if (found) {
            await admin.auth.admin.updateUserById(found.id, { password: newPassword });
          }
        } catch (e) {
          console.warn('Supabase updateUserById error:', e);
        }
      }

      // Always sync to local DB
      await syncLocalUserPassword(cleanEmail, newPassword);

      if (admin) {
        try {
          await admin.from('audit_logs').insert({
            actor_email: cleanEmail,
            action: 'auth.password_reset_complete',
            entity_type: 'auth',
            entity_name: 'Password successfully updated via reset portal',
            details: { email: cleanEmail, success: true },
          });
        } catch {}
      }

      return NextResponse.json({
        success: true,
        message: 'Your password has been updated successfully! You can now log in.',
      });
    }

    // ACTION: DIRECT ADMIN PASSWORD UPDATE
    if (action === 'direct-update') {
      if (!cleanEmail || !newPassword || newPassword.length < 8) {
        return NextResponse.json(
          { error: 'Valid email and new password (min 8 characters) required.' },
          { status: 400 }
        );
      }

      if (admin) {
        const { data: usersData } = await admin.auth.admin.listUsers();
        const user = (usersData?.users || []).find((u) => u.email?.toLowerCase() === cleanEmail);
        if (user) {
          await admin.auth.admin.updateUserById(user.id, { password: newPassword });
        }
      }

      await syncLocalUserPassword(cleanEmail, newPassword);

      return NextResponse.json({
        success: true,
        message: 'Password updated successfully.',
      });
    }

    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An error occurred during password reset.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
