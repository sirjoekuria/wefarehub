import { NextResponse } from "next/server";
import { HttpError } from "./authz";

export function ok(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(e: unknown) {
  if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
  const msg = e instanceof Error ? e.message : "Internal error";
  return NextResponse.json({ error: msg || "Internal error" }, { status: 500 });
}

export function query(req: Request, key: string): string | null {
  return new URL(req.url).searchParams.get(key);
}

export function qnum(req: Request, key: string): number | null {
  const v = query(req, key);
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const bodyCache = new WeakMap<object, Promise<unknown>>();

export async function body<T = Record<string, unknown>>(req: Request): Promise<T> {
  let p = bodyCache.get(req);
  if (!p) {
    p = req.json().catch(() => {
      throw new HttpError(400, "Invalid or missing request body.");
    });
    bodyCache.set(req, p);
  }
  return p as Promise<T>;
}

/** Resolve the target organization: query param first, JSON body second. */
export async function orgIdOf(req: Request): Promise<number | null> {
  const q = qnum(req, "orgId");
  if (q != null) return q;
  try {
    const b = await body<Record<string, unknown>>(req);
    if (b && b.orgId != null) {
      const n = Number(b.orgId);
      if (Number.isFinite(n)) return n;
    }
  } catch {
    // no body — caller will surface its own error
  }
  return null;
}

/** CSV escaping */
export function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csv(columns: { header: string; value: (r: Record<string, unknown>) => unknown }[], rows: Record<string, unknown>[]): string {
  const head = columns.map((c) => csvEscape(c.header)).join(",");
  const lines = rows.map((r) => columns.map((c) => csvEscape(c.value(r))).join(","));
  return [head, ...lines].join("\r\n");
}
