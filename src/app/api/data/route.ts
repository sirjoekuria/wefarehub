import { NextRequest } from 'next/server';
import { requireUser, checkOrigin, isDemo, ApiError } from '@/lib/auth';
import { apiShape, localDashboard, localList, localMutation, localReport, localListCases, localGetActiveCase, localOpenCase, localCloseCase } from '@/lib/local-service';

export const dynamic = 'force-dynamic';
function failure(error: unknown) {
  if (error instanceof ApiError) return Response.json({ error: error.message }, { status: error.status });
  if (typeof error === 'object' && error && 'code' in error && error.code === '23505') return Response.json({ error: 'This pickup code or QR number is already in use. Please use a unique value.' }, { status: 409 });
  if (error instanceof Error && /Choose|Enter|Select|Use |Import between|Row \d|name between|QR number|Pickup|Cross-origin|already an open|Case type|Member not|already closed/.test(error.message)) return Response.json({ error: error.message }, { status: 400 });
  console.error('Data API error', error);
  return Response.json({ error: 'Unable to complete this request. Please try again.' }, { status: 500 });
}
export async function GET(req: NextRequest) {
  try {
    await requireUser(req);
    if (!isDemo()) throw new ApiError('Use the configured Supabase API.', 404);
    const params = Object.fromEntries(req.nextUrl.searchParams);
    const resource = params.resource;
    let data;
    if (resource === 'dashboard') data = await localDashboard(Number(params.days) || 14);
    else if (resource === 'report') data = await localReport(params.point || '', params.from, params.to);
    else if (resource === 'cases') data = await localListCases(params);
    else if (resource === 'active-case') data = await localGetActiveCase();
    else data = await localList(resource, params);
    return Response.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return failure(error); }
}
export async function POST(req: NextRequest) {
  try {
    checkOrigin(req); await requireUser(req);
    if (!isDemo()) throw new ApiError('Use the configured Supabase API.', 404);
    const body = await req.json();
    if (!body || typeof body.action !== 'string') throw new ApiError('An action is required.');
    if (body.action === 'open-case') return Response.json(apiShape(await localOpenCase(body)));
    if (body.action === 'close-case') return Response.json(apiShape(await localCloseCase(body)));
    return Response.json(apiShape(await localMutation(body.action, body)));
  } catch (error) { return failure(error); }
}
