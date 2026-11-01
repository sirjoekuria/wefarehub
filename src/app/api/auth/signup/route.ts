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

    // Create user with pre-confirmed email so they are immediately authorized to log in
    const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
      email: cleanEmail,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: cleanName,
        role: cleanRole || 'Official',
        phone: cleanPhone,
        is_admin: true,
      },
    });

    if (createErr) {
      return NextResponse.json({ error: createErr.message }, { status: 400 });
    }

    // Audit log
    try {
      await admin.from('audit_logs').insert({
        actor_email: cleanEmail,
        action: 'auth.official_signup',
        entity_type: 'official',
        entity_name: cleanName,
        details: {
          role: cleanRole || 'Official',
          phone: cleanPhone,
          email: cleanEmail,
          userId: newUser.user?.id,
        },
      });
    } catch {}

    return NextResponse.json({
      success: true,
      message: `Welcome, ${cleanName}! Your official account has been created successfully.`,
      user: {
        email: cleanEmail,
        name: cleanName,
        role: cleanRole,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An error occurred during official registration.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
