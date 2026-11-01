import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function register() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!url || !anon || !email || !password) throw new Error('Set SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, ADMIN_EMAIL and ADMIN_PASSWORD for the target environment.');
  if (process.env.MPESA_ENVIRONMENT === 'production' && process.env.CONFIRM_PRODUCTION !== 'yes') throw new Error('Production registration requires CONFIRM_PRODUCTION=yes. Register sandbox first.');
  const auth = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await auth.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error('Admin sign-in failed. Check the target project and credentials.');
  const response = await fetch(`${url}/functions/v1/register-c2b`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: anon, Authorization: `Bearer ${data.session.access_token}` }, signal: AbortSignal.timeout(35000) });
  const result = await response.json();
  console.log(JSON.stringify(result, null, 2));
  if (!response.ok || String(result.ResponseCode ?? result.errorCode ?? '0') !== '0') throw new Error('URL registration was not successful. Inspect the response above.');
  await auth.auth.signOut();
}
register().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
