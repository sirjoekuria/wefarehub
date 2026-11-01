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

export async function GET() {
  try {
    const admin = getAdminClient();
    if (!admin) {
      return NextResponse.json({ error: 'Server authentication service not configured.' }, { status: 500 });
    }

    const superAdminEmail = (process.env.ADMIN_EMAIL || 'kuriajoe85@gmail.com').toLowerCase();
    const { data, error } = await admin.auth.admin.listUsers();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const officials = (data?.users || []).map(u => {
      const email = u.email?.toLowerCase() || '';
      const isSuperAdmin = email === superAdminEmail;
      const isApproved = isSuperAdmin ? true : Boolean(u.user_metadata?.approved);
      const status = isSuperAdmin
        ? 'approved'
        : u.user_metadata?.approval_status || (isApproved ? 'approved' : 'pending');

      return {
        id: u.id,
        email: u.email,
        full_name: u.user_metadata?.full_name || u.email?.split('@')[0] || 'Official',
        role: u.user_metadata?.role || (isSuperAdmin ? 'Super Administrator' : 'Official'),
        phone: u.user_metadata?.phone || '',
        approved: isApproved,
        approval_status: status,
        approved_by: u.user_metadata?.approved_by || (isSuperAdmin ? 'System' : null),
        approved_at: u.user_metadata?.approved_at || null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        is_super_admin: isSuperAdmin,
      };
    });

    const pendingCount = officials.filter(o => !o.approved && o.approval_status === 'pending').length;

    return NextResponse.json({
      officials,
      pendingCount,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve officials.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const admin = getAdminClient();
    if (!admin) {
      return NextResponse.json({ error: 'Server authentication service not configured.' }, { status: 500 });
    }

    const body = await req.json();
    const { action, officialId, adminEmail } = body;

    if (!officialId || !action) {
      return NextResponse.json({ error: 'Official ID and action are required.' }, { status: 400 });
    }

    const actorEmail = String(adminEmail || 'admin').trim();
    const superAdminEmail = (process.env.ADMIN_EMAIL || 'kuriajoe85@gmail.com').toLowerCase();

    // Fetch user
    const { data: userResp, error: fetchErr } = await admin.auth.admin.getUserById(officialId);
    if (fetchErr || !userResp?.user) {
      return NextResponse.json({ error: 'Official not found.' }, { status: 404 });
    }

    const targetUser = userResp.user;
    const targetEmail = targetUser.email?.toLowerCase() || '';

    if (targetEmail === superAdminEmail && action === 'suspend') {
      return NextResponse.json({ error: 'The Primary Super Administrator account cannot be suspended.' }, { status: 403 });
    }

    const now = new Date().toISOString();
    const meta = targetUser.user_metadata || {};

    if (action === 'approve') {
      const updatedMeta = {
        ...meta,
        approved: true,
        approval_status: 'approved',
        approved_by: actorEmail,
        approved_at: now,
      };

      const { error: updateErr } = await admin.auth.admin.updateUserById(officialId, {
        user_metadata: updatedMeta,
      });

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 400 });
      }

      // Log official approval in audit logs
      try {
        await admin.from('audit_logs').insert({
          actor_email: actorEmail,
          action: 'official.approve',
          entity_type: 'official',
          entity_id: officialId,
          entity_name: meta.full_name || targetUser.email,
          details: {
            official_email: targetUser.email,
            role: meta.role || 'Official',
            approved_by: actorEmail,
            approved_at: now,
          },
        });
      } catch (logErr) {
        console.warn('Audit log write error:', logErr);
      }

      return NextResponse.json({
        success: true,
        message: `Official ${meta.full_name || targetUser.email} has been approved. They can now access the workspace.`,
      });
    }

    if (action === 'suspend') {
      const updatedMeta = {
        ...meta,
        approved: false,
        approval_status: 'suspended',
        suspended_by: actorEmail,
        suspended_at: now,
      };

      const { error: updateErr } = await admin.auth.admin.updateUserById(officialId, {
        user_metadata: updatedMeta,
      });

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 400 });
      }

      // Log official suspension in audit logs
      try {
        await admin.from('audit_logs').insert({
          actor_email: actorEmail,
          action: 'official.suspend',
          entity_type: 'official',
          entity_id: officialId,
          entity_name: meta.full_name || targetUser.email,
          details: {
            official_email: targetUser.email,
            role: meta.role || 'Official',
            suspended_by: actorEmail,
            suspended_at: now,
          },
        });
      } catch (logErr) {
        console.warn('Audit log write error:', logErr);
      }

      return NextResponse.json({
        success: true,
        message: `Official ${meta.full_name || targetUser.email} access has been suspended.`,
      });
    }

    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Action failed.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
