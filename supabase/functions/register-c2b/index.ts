import { accessToken } from '../_shared/c2b.ts';

// Protected by the Supabase gateway: invoke with an authenticated admin's JWT.
Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return Response.json({ error: 'Use POST' }, { status: 405 });
  try {
    const { token, base } = await accessToken();
    const root = Deno.env.get('CALLBACK_BASE_URL') || `${Deno.env.get('SUPABASE_URL')}/functions/v1`;
    const response = await fetch(`${base}/mpesa/c2b/v1/registerurl`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ShortCode: Deno.env.get('MPESA_SHORTCODE'),
        ResponseType: Deno.env.get('C2B_RESPONSE_TYPE') || 'Completed',
        ConfirmationURL: `${root.replace(/\/$/, '')}/mpesa-confirmation`,
        ValidationURL: `${root.replace(/\/$/, '')}/mpesa-validation`,
      }),
      signal: AbortSignal.timeout(25000),
    });
    const result = await response.json();
    return Response.json(result, { status: response.ok ? 200 : 502 });
  } catch (error) {
    console.error('C2B URL registration failed', error);
    return Response.json({ error: error instanceof Error ? error.message : 'Registration failed' }, { status: 500 });
  }
});
