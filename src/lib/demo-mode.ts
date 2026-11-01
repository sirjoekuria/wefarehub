import type { SessionUser } from './types';

/**
 * Demo access is intentionally open only for the labeled sample workspace.
 * - Supabase configuration always takes precedence and requires real Auth.
 * - DEMO_MODE=false disables the local demo adapter.
 * - The hosted E2B preview remains a demo even if optional .env values are reset.
 * A real deployment without Supabase must explicitly opt into DEMO_MODE=true.
 */
export function isDemoMode() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) return false;
  if (process.env.DEMO_MODE === 'false') return false;
  return process.env.DEMO_MODE === 'true' || process.env.E2B_SANDBOX === 'true' || Boolean(process.env.E2B_SANDBOX_ID);
}

export function demoUser(email?: string): SessionUser {
  return { email: email || process.env.DEMO_ADMIN_EMAIL || 'admin@stanriders.co.ke', name: 'Administrator', demo: true };
}
