/**
 * Presentation formatters. Pure — safe on the server and in the browser.
 * Deliberately Indian-English and deliberately plain: "500 m away", not
 * coordinates; "2d old", not an ISO string.
 */

/** "500 m away" · "1.2 km away" · "Nearby" when location is unknown. */
export function distanceLabel(metres: number | null): string {
  if (metres === null || Number.isNaN(metres)) return 'Location unknown';
  if (metres < 100) return 'Right here';
  if (metres < 1000) return `${Math.round(metres / 50) * 50} m away`;
  const km = metres / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km away`;
}

/** "12m" · "4h" · "2d" · "3w". Compact, monospaced in use. */
export function shortAge(iso: string, now: Date = new Date()): string {
  const ms = now.getTime() - new Date(iso).getTime();
  const min = Math.max(0, Math.floor(ms / 60000));
  if (min < 1) return 'now';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 14) return `${d}d`;
  const w = Math.floor(d / 7);
  if (w < 9) return `${w}w`;
  const mo = Math.floor(d / 30);
  return `${mo}mo`;
}

/** "2d old" for the feed card's age line. */
export function ageLabel(iso: string, now?: Date): string {
  const a = shortAge(iso, now);
  return a === 'now' ? 'just now' : `${a} old`;
}

/** "officer updated 4h ago" / "updated 4h ago". */
export function activityLabel(iso: string, actor?: string | null, now?: Date): string {
  const a = shortAge(iso, now);
  const who = actor ? `${actor} updated` : 'updated';
  return a === 'now' ? `${who} just now` : `${who} ${a} ago`;
}

/** "27 people reported this" — never "27 reports", the people are the point. */
export function crowdLabel(count: number): string {
  if (count <= 1) return 'You are the first to report this';
  return `${count.toLocaleString('en-IN')} people reported this`;
}

/** Estimates always carry a ~ (PRD §06). */
export function affectedLabel(estimate: number): string {
  if (estimate >= 100000) return `~${(estimate / 100000).toFixed(1)} lakh affected`;
  if (estimate >= 1000) return `~${(estimate / 1000).toFixed(estimate < 10000 ? 1 : 0)}k affected`;
  return `~${estimate} affected`;
}

/** "in 3d" · "3d overdue". Only ever called for ONBOARDED issues. */
export function slaLabel(dueIso: string, now: Date = new Date()): { text: string; breached: boolean } {
  const ms = new Date(dueIso).getTime() - now.getTime();
  const breached = ms < 0;
  const abs = Math.abs(ms);
  const h = Math.floor(abs / 3600000);
  const unit = h < 48 ? `${h}h` : `${Math.floor(h / 24)}d`;
  return { text: breached ? `${unit} overdue` : `due in ${unit}`, breached };
}

/** "13 Aug 09:12" — newspaper datelines, not locale soup. */
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function dateline(iso: string, withTime = true): string {
  const d = new Date(iso);
  const day = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  if (!withTime) return day;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${hh}:${mm}`;
}

/** "15 AUGUST 2026" for the masthead edition line. */
export function editionLine(d: Date = new Date()): string {
  const full = [
    'JANUARY',
    'FEBRUARY',
    'MARCH',
    'APRIL',
    'MAY',
    'JUNE',
    'JULY',
    'AUGUST',
    'SEPTEMBER',
    'OCTOBER',
    'NOVEMBER',
    'DECEMBER',
  ];
  return `${d.getDate()} ${full[d.getMonth()]} ${d.getFullYear()}`;
}

/** Group alerts by day (PRD §09). */
export function dayBucket(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(now) - startOf(d)) / 86400000);
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return 'This week';
  return dateline(iso, false);
}

export function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}
