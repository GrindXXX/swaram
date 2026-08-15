/**
 * Feed filters — PRD §06.
 *
 * Filters persist across sessions per device AND are encoded in the URL, so a
 * filtered view is shareable. The URL is the source of truth; localStorage is
 * only the "what did I have last time" restore.
 */

export const DISTANCE_OPTIONS = [
  { value: 500, label: '500 m' },
  { value: 1000, label: '1 km' },
  { value: 5000, label: '5 km' },
  { value: 10000, label: '10 km' },
  { value: -1, label: 'My ward' },
] as const;

export const DEPARTMENTS = [
  'Roads',
  'Sanitation',
  'Water',
  'Electricity',
  'Transport',
  'Public Safety',
  'Health',
  'Education',
] as const;

export const ISSUE_TYPES = [
  'Potholes',
  'Garbage',
  'Streetlights',
  'Water leakage',
  'Drainage',
  'Traffic',
  'Public infra',
  'Other',
] as const;

/** Citizen-facing status buckets, collapsed from the twelve DB statuses. */
export const STATUS_BUCKETS = ['Open', 'In progress', 'Resolved'] as const;
export type StatusBucket = (typeof STATUS_BUCKETS)[number];

export const SORTS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'newest', label: 'Newest' },
  { value: 'most-reported', label: 'Most reported' },
  // Deliberate: it gives citizens a way to surface neglect, which is the
  // accountability lever (PRD §06).
  { value: 'longest-pending', label: 'Longest pending' },
] as const;
export type SortKey = (typeof SORTS)[number]['value'];

export type FeedFilters = {
  distanceM: number;
  departments: string[];
  types: string[];
  /** Default is Open + In progress, NOT "All". */
  statuses: StatusBucket[];
  sort: SortKey;
};

export const DEFAULT_FILTERS: FeedFilters = {
  distanceM: 5000,
  departments: [],
  types: [],
  statuses: ['Open', 'In progress'],
  sort: 'relevance',
};

const STORAGE_KEY = 'swaram.feed.filters.v1';

export function parseFilters(params: URLSearchParams | Record<string, string | string[] | undefined>): FeedFilters {
  const get = (k: string): string | undefined => {
    if (params instanceof URLSearchParams) return params.get(k) ?? undefined;
    const v = params[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const list = (k: string): string[] => {
    const raw = get(k);
    return raw ? raw.split(',').filter(Boolean) : [];
  };

  const d = Number(get('d'));
  const statuses = list('s').filter((s): s is StatusBucket =>
    (STATUS_BUCKETS as readonly string[]).includes(s),
  );
  const sortRaw = get('sort');
  const sort = SORTS.find((s) => s.value === sortRaw)?.value ?? DEFAULT_FILTERS.sort;

  return {
    distanceM: Number.isFinite(d) && d !== 0 ? d : DEFAULT_FILTERS.distanceM,
    departments: list('dept'),
    types: list('t'),
    statuses: statuses.length ? statuses : DEFAULT_FILTERS.statuses,
    sort,
  };
}

export function filtersToQuery(f: FeedFilters): string {
  const p = new URLSearchParams();
  if (f.distanceM !== DEFAULT_FILTERS.distanceM) p.set('d', String(f.distanceM));
  if (f.departments.length) p.set('dept', f.departments.join(','));
  if (f.types.length) p.set('t', f.types.join(','));
  if (!sameSet(f.statuses, DEFAULT_FILTERS.statuses)) p.set('s', f.statuses.join(','));
  if (f.sort !== DEFAULT_FILTERS.sort) p.set('sort', f.sort);
  const q = p.toString();
  return q ? `?${q}` : '';
}

export function isDefault(f: FeedFilters): boolean {
  return filtersToQuery(f) === '';
}

export function activeCount(f: FeedFilters): number {
  let n = 0;
  if (f.distanceM !== DEFAULT_FILTERS.distanceM) n++;
  n += f.departments.length + f.types.length;
  if (!sameSet(f.statuses, DEFAULT_FILTERS.statuses)) n++;
  if (f.sort !== DEFAULT_FILTERS.sort) n++;
  return n;
}

export function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function distanceLabelFor(m: number): string {
  return DISTANCE_OPTIONS.find((o) => o.value === m)?.label ?? `${Math.round(m / 1000)} km`;
}

/* -------------------------------------------------------------------------- */
/* per-device persistence                                                     */
/* -------------------------------------------------------------------------- */

export function saveFilters(f: FeedFilters) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(f));
  } catch {
    /* private mode / quota — filters are a convenience, never a blocker */
  }
}

export function loadFilters(): FeedFilters | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return { ...DEFAULT_FILTERS, ...(JSON.parse(raw) as Partial<FeedFilters>) };
  } catch {
    return null;
  }
}

function sameSet(a: readonly string[], b: readonly string[]) {
  if (a.length !== b.length) return false;
  const s = new Set(b);
  return a.every((x) => s.has(x));
}

/** Maps a citizen-facing bucket onto the DB statuses it covers. */
export const BUCKET_STATUSES: Record<StatusBucket, string[]> = {
  Open: ['OPEN', 'ASSIGNED', 'ACKNOWLEDGED', 'REOPENED'],
  'In progress': ['IN_PROGRESS', 'RESOLUTION_SUBMITTED', 'AWAITING_VERIFICATION'],
  Resolved: ['RESOLVED', 'CLOSED'],
};

export function statusInBuckets(status: string, buckets: StatusBucket[]): boolean {
  if (!buckets.length) return true;
  return buckets.some((b) => BUCKET_STATUSES[b].includes(status));
}
