/**
 * Vietnam time (UTC+7, no daylight saving) for server code, which runs in
 * UTC: a bank transaction at 06:30 on the 15th in Hà Nội is still the 14th in UTC.
 */
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/** `YYYY-MM-DD` in Vietnam for an instant. */
export function vnDay(at: Date): string {
  return new Date(at.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

const DAY_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const VN_DMY = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/;

function vnInstant(y: number, mo: number, d: number, h = 0, mi = 0, s = 0): Date | null {
  const ms = Date.UTC(y, mo - 1, d, h, mi, s) - VN_OFFSET_MS;
  const out = new Date(ms);
  // Reject roll-overs such as 2026-02-31.
  const back = new Date(ms + VN_OFFSET_MS);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
  return out;
}

export type ParsedWhen = { at: Date; dayOnly: boolean };

/**
 * A date from a bank or webhook payload. Accepts an ISO instant with a zone,
 * a date-time without one (`2026-10-15 08:30:00`, read as Vietnam time),
 * `15/10/2026 08:30`, a bare `YYYY-MM-DD`, or epoch seconds / milliseconds.
 */
export function parseVnDateTime(value: unknown): ParsedWhen | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    const ms = value < 1e12 ? value * 1000 : value;
    const at = new Date(ms);
    return Number.isNaN(at.getTime()) ? null : { at, dayOnly: false };
  }
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (!s) return null;
  let m = DAY_ONLY.exec(s);
  if (m) {
    const at = vnInstant(+m[1], +m[2], +m[3], 12);
    return at ? { at, dayOnly: true } : null;
  }
  m = LOCAL_DATE_TIME.exec(s);
  if (m) {
    const at = vnInstant(+m[1], +m[2], +m[3], +m[4], +m[5], +(m[6] ?? 0));
    return at ? { at, dayOnly: false } : null;
  }
  m = VN_DMY.exec(s);
  if (m) {
    const at = m[4] === undefined ? vnInstant(+m[3], +m[2], +m[1], 12) : vnInstant(+m[3], +m[2], +m[1], +m[4], +m[5], +(m[6] ?? 0));
    return at ? { at, dayOnly: m[4] === undefined } : null;
  }
  // ISO with a zone (`Z` or `+07:00`).
  if (/^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:?\d{2})$/i.test(s)) {
    const at = new Date(s);
    return Number.isNaN(at.getTime()) ? null : { at, dayOnly: false };
  }
  return null;
}
