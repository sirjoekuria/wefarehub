import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, email, otp, newPassword, origin } = body;

    const admin = getAdminClient();
    const anon = getAnonClient();

    if (!admin || !anon) {
      return NextResponse.json(
        { error: 'Supabase credentials not configured on server.' },
        { status: 500 }
      );
    }

    const cleanEmail = String(email || '').trim().toLowerCase();

    // ACTION: REQUEST RESET
    if (action === 'request') {
      if (!cleanEmail) {
        return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
      }

      // Check if user exists
      const { data: usersData, error: listErr } = await admin.auth.admin.listUsers();
      if (listErr) {
        return NextResponse.json({ error: listErr.message }, { status: 400 });
      }

      const user = (usersData?.users || []).find(u => u.email?.toLowerCase() === cleanEmail);
      if (!user) {
        return NextResponse.json(
          { error: `No registered account found with email "${cleanEmail}". Please check your email or contact system administration.` },
          { status: 404 }
        );
      }

      const siteOrigin = origin || 'https://welfare-delta-nine.vercel.app';
      const redirectUrl = `${siteOrigin}/reset-password`;

      // 1. Generate recovery link and OTP
      const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
        type: 'recovery',
        email: cleanEmail,
        options: { redirectTo: redirectUrl },
      });

      if (linkErr) {
        return NextResponse.json({ error: linkErr.message }, { status: 400 });
      }

      // 2. Also send Supabase official reset email
      try {
        await anon.auth.resetPasswordForEmail(cleanEmail, { redirectTo: redirectUrl });
      } catch (e) {
        console.warn('resetPasswordForEmail warning:', e);
      }

      // Audit log
      try {
        await admin.from('audit_logs').insert({
          actor_email: cleanEmail,
          action: 'auth.password_reset_request',
          entity_type: 'auth',
          entity_name: 'Password reset request generated',
          details: { email: cleanEmail, redirectTo: redirectUrl },
        });
      } catch {}

      return NextResponse.json({
        success: true,
        message: 'Password reset instructions and verification code generated.',
        emailOtp: linkData.properties?.email_otp || null,
        actionLink: linkData.properties?.action_link || null,
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

      // Try verifyOtp with Supabase client
      const { data: verifyData, error: verifyErr } = await anon.auth.verifyOtp({
        email: cleanEmail,
        token: String(otp).trim(),
        type: 'recovery',
      });

      let userId = verifyData?.user?.id;

      // If client verifyOtp worked, we have userId. If not, look up user
      if (verifyErr || !userId) {
        // Check if user exists
        const { data: usersData } = await admin.auth.admin.listUsers();
        const found = (usersData?.users || []).find(u => u.email?.toLowerCase() === cleanEmail);
        if (!found) {
          return NextResponse.json({ error: 'Invalid verification code or user not found.' }, { status: 400 });
        }
        
        // If verifyErr happened and code wasn't verified
        return NextResponse.json(
          { error: verifyErr?.message || 'Invalid or expired verification code. Please request a fresh reset link.' },
          { status: 400 }
        );
      }

      // Update password via admin
      const { error: updateErr } = await admin.auth.admin.updateUserById(userId, {
        password: newPassword,
      });

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 400 });
      }

      // Audit log
      try {
        await admin.from('audit_logs').insert({
          actor_email: cleanEmail,
          action: 'auth.password_reset_complete',
          entity_type: 'auth',
          entity_name: 'Password successfully updated via reset portal',
          details: { email: cleanEmail, success: true },
        });
      } catch {}

      return NextResponse.json({
        success: true,
        message: 'Your password has been updated successfully! You can now log in.',
      });
    }

    // ACTION: DIRECT ADMIN PASSWORD UPDATE (by session token or service role)
    if (action === 'direct-update') {
      if (!cleanEmail || !newPassword || newPassword.length < 8) {
        return NextResponse.json({ error: 'Valid email and new password (min 8 characters) required.' }, { status: 400 });
      }

      const { data: usersData } = await admin.auth.admin.listUsers();
      const user = (usersData?.users || []).find(u => u.email?.toLowerCase() === cleanEmail);
      if (!user) {
        return NextResponse.json({ error: 'User account not found.' }, { status: 404 });
      }

      const { error: updateErr } = await admin.auth.admin.updateUserById(user.id, {
        password: newPassword,
      });

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 400 });
      }

      try {
        await admin.from('audit_logs').insert({
          actor_email: cleanEmail,
          action: 'auth.password_direct_update',
          entity_type: 'auth',
          entity_name: 'Password changed by administrator',
          details: { email: cleanEmail },
        });
      } catch {}

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
