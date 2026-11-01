import { createClient } from '@supabase/supabase-js';

export type AuditLog = {
  id: string;
  actor_id?: string | null;
  actor_email: string;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  entity_name?: string | null;
  details: Record<string, unknown>;
  ip_address?: string | null;
  created_at: string;
};

export type AuditPayload = {
  actor_id?: string | null;
  actor_email?: string;
  action: string;
  entity_type: 'member' | 'pickup_point' | 'payment' | 'welfare_case' | 'auth' | 'system';
  entity_id?: string | null;
  entity_name?: string | null;
  details?: Record<string, unknown>;
  ip_address?: string | null;
};

function getServiceClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Record an audit log entry safely.
 * Non-blocking: failures will never interrupt business logic.
 */
export async function recordAudit(entry: AuditPayload): Promise<void> {
  try {
    const client = getServiceClient();
    if (!client) {
      console.warn('[Audit] Skipping audit log: Supabase client not configured.');
      return;
    }

    const payload = {
      actor_id: entry.actor_id || null,
      actor_email: entry.actor_email || 'system',
      action: entry.action,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id || null,
      entity_name: entry.entity_name || null,
      details: entry.details || {},
      ip_address: entry.ip_address || null,
    };

    const { error } = await client.from('audit_logs').insert(payload);
    if (error) {
      console.warn('[Audit] Could not write audit log (table may not be created yet):', error.message);
    }
  } catch (err) {
    console.error('[Audit] Unexpected error recording audit entry:', err);
  }
}
