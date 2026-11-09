/**
 * Membership-number normalization.
 * "GKA 0002", "gka-2", "GKA 002", "GKA02", "GKA-02" → all normalize to "GKA-0002".
 * Org code (letters) + numeric part padded to at least 4 digits.
 */
export function normalizeMemberNumber(input: string | null | undefined): string | null {
  if (!input) return null;
  const cleaned = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const m = cleaned.match(/^([A-Z]+)(\d+)$/);
  if (!m) return null;
  const code = m[1];
  const num = m[2].padStart(4, "0");
  return `${code}-${num}`;
}

/** True when two membership numbers refer to the same identity. */
export function sameMemberNumber(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeMemberNumber(a);
  const nb = normalizeMemberNumber(b);
  return !!na && !!nb && na === nb;
}
