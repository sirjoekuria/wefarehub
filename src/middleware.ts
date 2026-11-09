import { NextResponse, type NextRequest } from "next/server";

/**
 * The preview environment proxies and can cache HTML documents, which leads to
 * users seeing a stale (or broken) page from an earlier build. Never cache
 * document responses; static assets remain content-hashed and cacheable.
 */
export function middleware(_req: NextRequest) {
  const res = NextResponse.next();
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.headers.set("Pragma", "no-cache");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.svg).*)"],
};
