import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function getAdminClient() {
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { full_name, role, phone, email, password } = body;

    const admin = getAdminClient();
    if (!admin) {
      return NextResponse.json(
        { error: 'Server authentication service is not configured.' },
        { status: 500 }
      );
    }

    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanName = String(full_name || '').trim();
    const cleanRole = String(role || '').trim();
    const cleanPhone = String(phone || '').trim();

    if (!cleanName || cleanName.length < 2) {
      return NextResponse.json({ error: 'Please enter a valid full name.' }, { status: 400 });
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }
    if (!password || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters long.' }, { status: 400 });
    }

    // Check if user already exists
    const { data: existingUsers, error: listErr } = await admin.auth.admin.listUsers();
    if (listErr) {
      return NextResponse.json({ error: listErr.message }, { status: 400 });
    }

    const alreadyExists = (existingUsers?.users || []).some(
      u => u.email?.toLowerCase() === cleanEmail
    );
    if (alreadyExists) {
      return NextResponse.json(
        { error: `An official account with email ${cleanEmail} already exists. Please sign in or reset password.` },
        { status: 400 }
      );
    }

    // Determine if this user is the root super admin
    const superAdminEmail = (process.env.ADMIN_EMAIL || 'kuriajoe85@gmail.com').toLowerCase();
    const isSuperAdmin = cleanEmail === superAdminEmail;
    const isApproved = isSuperAdmin; // Super admin is auto-approved; all other officials require admin approval

    // Create user in Supabase
    const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
      email: cleanEmail,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: cleanName,
        role: cleanRole || 'Official',
        phone: cleanPhone,
        is_admin: true,
        approved: isApproved,
        approval_status: isApproved ? 'approved' : 'pending',
        created_at: new Date().toISOString(),
      },
    });

    if (createErr) {
      return NextResponse.json({ error: createErr.message }, { status: 400 });
    }

    // Audit log recording official signup with pending status
    try {
      await admin.from('audit_logs').insert({
        actor_email: cleanEmail,
        action: isApproved ? 'auth.superadmin_created' : 'official.signup_pending',
        entity_type: 'official',
        entity_id: newUser.user?.id,
        entity_name: cleanName,
        details: {
          role: cleanRole || 'Official',
          phone: cleanPhone,
          email: cleanEmail,
          userId: newUser.user?.id,
          status: isApproved ? 'approved' : 'pending_admin_approval',
        },
      });
    } catch {}

    return NextResponse.json({
      success: true,
      approved: isApproved,
      message: isApproved
        ? `Welcome, ${cleanName}! Your administrator profile is active.`
        : `Registration submitted! Welcome, ${cleanName}. Your official account is currently pending approval by an active administrator.`,
      user: {
        email: cleanEmail,
        name: cleanName,
        role: cleanRole,
        approved: isApproved,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An error occurred during official registration.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
