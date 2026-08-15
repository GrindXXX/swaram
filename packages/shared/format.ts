/**
 * format.ts — display formatting. Pure, locale-explicit, no wall clock.
 *
 * India-first: numbers use the en-IN grouping (1,00,000 not 100,000) because
 * that is what the number means to the person reading it.
 */

/* ================================================================== *
 * Public IDs
 * ================================================================== */

export const PUBLIC_ID_PREFIX = 'CIV';
export const PUBLIC_ID_DIGITS = 5;
/** CIV- followed by five or more digits. Anchored. */
export const PUBLIC_ID_PATTERN = /^CIV-\d{5,}$/;

/**
 * Format a numeric issue id as its public form: `formatPublicId(10482)` →
 * `"CIV-10482"`. Pads to five digits; longer ids are not truncated, because a
 * six-digit CIV-100482 is a real id and mangling it breaks every shared link.
 *
 * Every CIV-##### is monospaced everywhere (PRD §15). This function produces
 * the string; the `<Mono>` treatment is the UI's job.
 */
export function formatPublicId(id: number | string): string {
  const raw = String(id).replace(/^CIV-/i, '');
  if (!/^\d+$/.test(raw)) throw new Error(`Not a valid issue id: ${String(id)}`);
  return `${PUBLIC_ID_PREFIX}-${raw.padStart(PUBLIC_ID_DIGITS, '0')}`;
}

export function isPublicId(value: string): boolean {
  return PUBLIC_ID_PATTERN.test(value);
}

/** Pull the numeric part back out of a public id. */
export function parsePublicId(publicId: string): number {
  const m = /^CIV-(\d+)$/.exec(publicId.trim().toUpperCase());
  if (!m) throw new Error(`Not a valid public id: ${publicId}`);
  return Number(m[1]);
}

/* ================================================================== *
 * Distance
 * ================================================================== */

export interface DistanceOptions {
  /** Append " away" — "500 m away" rather than "500 m". Default true. */
  readonly suffix?: boolean;
  /** Uppercase for the newsprint chrome — "500 M AWAY". Default false. */
  readonly uppercase?: boolean;
}

/**
 * Human distance from kilometres.
 *
 *   0.06 → "Right here"      (below the accuracy of a phone GPS pin)
 *   0.5  → "500 m away"
 *   1.24 → "1.2 km away"
 *   14   → "14 km away"
 *
 * Metres below 1 km, rounded to 10 m — a citizen does not need 483 m, and the
 * false precision implies a fix on the pothole we do not have.
 */
export function formatDistance(km: number, options: DistanceOptions = {}): string {
  const { suffix = true, uppercase = false } = options;
  const d = Math.max(0, km);

  let text: string;
  if (d < 0.075) {
    text = 'Right here';
    return uppercase ? text.toUpperCase() : text;
  } else if (d < 1) {
    text = `${Math.round((d * 1000) / 10) * 10} m`;
  } else if (d < 10) {
    text = `${(Math.round(d * 10) / 10).toFixed(1)} km`;
  } else {
    text = `${Math.round(d)} km`;
  }

  const out = suffix ? `${text} away` : text;
  return uppercase ? out.toUpperCase() : out;
}

/** Great-circle distance in km between two WGS84 points. */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/* ================================================================== *
 * Time
 * ================================================================== */

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
const WEEK = 7 * DAY;

export interface RelativeTimeOptions {
  /** "12d" instead of "12 days ago". Default false. */
  readonly compact?: boolean;
  readonly uppercase?: boolean;
}

/**
 * Relative time. `now` is a required parameter — never read the clock inside a
 * formatter, or the same record renders differently in a test than in a browser.
 *
 *   30 s  → "Just now"
 *   4 min → "4 minutes ago"    compact "4m"
 *   2 h   → "2 hours ago"      compact "2h"
 *   12 d  → "12 days ago"      compact "12d"
 *   3 w   → "3 weeks ago"      compact "3w"
 *
 * Future timestamps render as "in ..." — SLA deadlines are legitimately ahead.
 */
export function formatRelativeTime(
  when: Date,
  now: Date,
  options: RelativeTimeOptions = {},
): string {
  const { compact = false, uppercase = false } = options;
  const delta = now.getTime() - when.getTime();
  const future = delta < 0;
  const ms = Math.abs(delta);

  let text: string;
  if (ms < 45_000) {
    text = compact ? 'now' : 'Just now';
    return uppercase ? text.toUpperCase() : text;
  } else if (ms < HOUR) {
    const n = Math.round(ms / MINUTE);
    text = compact ? `${n}m` : plural(n, 'minute');
  } else if (ms < DAY) {
    const n = Math.round(ms / HOUR);
    text = compact ? `${n}h` : plural(n, 'hour');
  } else if (ms < WEEK) {
    const n = Math.round(ms / DAY);
    text = compact ? `${n}d` : plural(n, 'day');
  } else if (ms < 30 * DAY) {
    const n = Math.round(ms / WEEK);
    text = compact ? `${n}w` : plural(n, 'week');
  } else if (ms < 365 * DAY) {
    const n = Math.round(ms / (30 * DAY));
    text = compact ? `${n}mo` : plural(n, 'month');
  } else {
    const n = Math.round(ms / (365 * DAY));
    text = compact ? `${n}y` : plural(n, 'year');
  }

  const out = compact ? text : future ? `in ${text}` : `${text} ago`;
  return uppercase ? out.toUpperCase() : out;
}

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? '' : 's'}`;
}

/**
 * Duration of a wait, for "12 DAYS PENDING" and "Fixed in 3 days".
 * Always whole days above 48 h; hours below that.
 */
export function formatDuration(ms: number, options: { uppercase?: boolean } = {}): string {
  const abs = Math.max(0, ms);
  let text: string;
  if (abs < HOUR) text = plural(Math.max(1, Math.round(abs / MINUTE)), 'minute');
  else if (abs < 2 * DAY) text = plural(Math.round(abs / HOUR), 'hour');
  else text = plural(Math.round(abs / DAY), 'day');
  return options.uppercase ? text.toUpperCase() : text;
}

/**
 * SLA countdown for a queue row. Negative remaining renders as overdue, which
 * the QueueRow shows in --rage with a left edge marker (PRD §10).
 */
export function formatSlaCountdown(msRemaining: number): string {
  if (msRemaining < 0) return `Overdue by ${formatDuration(-msRemaining)}`;
  return `${formatDuration(msRemaining)} left`;
}

/** Newsprint dateline: "15 AUG 2026". */
export function formatDateline(date: Date): string {
  const months = [
    'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
    'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
  ];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

/* ================================================================== *
 * Numbers
 * ================================================================== */

/** en-IN grouping: 1482 → "1,482", 2140000 → "21,40,000". */
export function formatCount(n: number): string {
  return new Intl.NumberFormat('en-IN').format(Math.round(n));
}

/** Compact for tight chrome: 1482 → "1.5K", 28400 → "28.4K", 2140000 → "21.4L". */
export function formatCompactCount(n: number): string {
  const v = Math.round(n);
  if (v >= 10_000_000) return `${(v / 10_000_000).toFixed(1)}Cr`;
  if (v >= 100_000) return `${(v / 100_000).toFixed(1)}L`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
}

/**
 * People affected. Always displayed as an estimate with a `~` (PRD §06) —
 * it is inferred from the area and locality, never counted, and presenting it
 * as a hard figure is the fastest way to be caught lying.
 */
export function formatPeopleAffected(estimated: number): string {
  return `~${formatCount(estimated)}`;
}

/** "12.9698°N 77.7500°E" — the coordinate stamp on the capture sheet. */
export function formatCoordinates(lat: number, lng: number, decimals = 4): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(decimals)}°${ns} ${Math.abs(lng).toFixed(decimals)}°${ew}`;
}

/** "94%" from a 0–1 model confidence. */
export function formatConfidence(confidence: number): string {
  return `${Math.round(Math.max(0, Math.min(1, confidence)) * 100)}%`;
}

/** Anonymous handle: 'a82f' → '#A82F'. Citizens are never named publicly. */
export function formatCitizenHandle(handle: string): string {
  const clean = handle.replace(/^#/, '').toUpperCase();
  return `#${clean}`;
}

/** Title case a SCREAMING_SNAKE enum: 'IN_PROGRESS' → 'In progress'. */
export function humanizeEnum(value: string): string {
  const lower = value.toLowerCase().replace(/_/g, ' ');
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
