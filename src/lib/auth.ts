import { createClient } from '@supabase/supabase-js';
import { demoUser, isDemoMode } from './demo-mode';
import type { SessionUser } from './types';

export class ApiError extends Error { constructor(message: string, public status = 400) { super(message); } }
export const isDemo = isDemoMode;

export async function requireUser(req: Request): Promise<SessionUser> {
  const auth = req.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new ApiError('Supabase is not configured.', 503);
    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await supabase.auth.getUser(auth.slice(7));
    if (error || !data.user || data.user.role !== 'authenticated') throw new ApiError('Your session has expired. Please sign in.', 401);
    return { email: data.user.email || 'Administrator', name: 'Administrator', demo: false };
  }
  // The sample workspace is explicitly login-free; it never guards real data.
  if (isDemoMode()) return demoUser();
  throw new ApiError('Administrator authentication required.', 401);
}

export function checkOrigin(req: Request) {
  const origin = req.headers.get('origin');
  if (!origin) return;
  const url = new URL(req.url);
  const hosts = new Set([url.host, req.headers.get('host'), ...(req.headers.get('x-forwarded-host') || '').split(',')].map(h => h?.trim()).filter(Boolean));
  if (!hosts.has(new URL(origin).host)) throw new ApiError('Cross-origin request rejected.', 403);
}
