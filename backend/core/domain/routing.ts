/**
 * routing.ts — the resolution chain (technical-plan.html §08, PRD §12).
 *
 * The rule this file exists to enforce: the agent tags a CATEGORY, SQL finds
 * the AUTHORITY. No model participates in deciding who owns an issue. This
 * module is a thin, typed wrapper over resolve_authority() plus the one step
 * SQL cannot do on its own — the GEOCODE_FALLBACK name match.
 *
 * UNMAPPED is a valid result. It is never thrown, never logged as an error,
 * and never papered over with a guessed authority. See PRD §12: "Tier 3 is not
 * failure — it is the wedge."
 */

import type { Db } from '../db/client.ts';
import type { AdminDb } from '../db/admin.ts';
import type { LatLng, RoutingResult } from '../types/index.ts';
import { isJurisdictionLevel, type JurisdictionLevel } from '../types/enums.ts';
import { reverseGeocode, matchJurisdictionByName, type GeoProvider } from '../services/geo.ts';

type AnyDb = Db | AdminDb;

export interface ResolveOptions {
  /** Supply to enable step 3 of the fallback ladder. Omitted = skip it. */
  geo?: GeoProvider;
}

/**
 * Resolve (lat, lng, category) -> jurisdiction + authority + tier.
 *
 * Ladder, in order (technical-plan.html §04):
 *   1. ST_Contains at the most specific level available   -> POLYGON
 *   2. nearest district centroid within 25 km             -> CENTROID_FALLBACK
 *   3. reverse-geocode + fuzzy name match against LGD     -> GEOCODE_FALLBACK
 *   4. nothing                                            -> UNMAPPED / NONE
 *
 * Steps 1 and 2 live in SQL (resolve_authority). Step 3 is here because it
 * needs a network call. Never let a fallback masquerade as a polygon match —
 * `method` is returned verbatim so the officer UI can surface degraded matches.
 */
export async function resolveAuthority(
  db: AnyDb,
  point: LatLng,
  categoryId: string,
  opts: ResolveOptions = {},
): Promise<RoutingResult> {
  assertLatLng(point);

  const { data, error } = await db.rpc('resolve_authority', {
    p_lat: point.lat,
    p_lng: point.lng,
    p_category: categoryId,
  });

  if (error) {
    throw new Error(`resolve_authority failed: ${error.message}`);
  }

  const row = Array.isArray(data) ? data[0] : undefined;

  // The SQL function always returns exactly one row, but a category with no
  // rules at all can produce an empty set. Treat that as UNMAPPED, not a crash.
  if (!row) {
    return unmapped('NONE');
  }

  const base: RoutingResult = {
    jurisdictionId: row.jurisdiction_id ?? null,
    authorityId: row.authority_id ?? null,
    departmentId: row.department_id ?? null,
    tier: row.tier,
    method: row.method,
  };

  // Step 3: SQL gave up on the geography entirely. Try a reverse-geocode and a
  // fuzzy name match before declaring the pin unmapped.
  if (base.jurisdictionId === null && opts.geo) {
    const recovered = await resolveViaGeocode(db, point, categoryId, opts.geo);
    if (recovered) return recovered;
  }

  return base;
}

/**
 * GEOCODE_FALLBACK. Reverse-geocode the pin to a district/city name, fuzzy
 * match it against the LGD name table, then re-run the category walk against
 * that jurisdiction.
 *
 * Returns null when geocoding or matching fails — the caller keeps the
 * original UNMAPPED result rather than inventing one.
 */
async function resolveViaGeocode(
  db: AnyDb,
  point: LatLng,
  categoryId: string,
  geo: GeoProvider,
): Promise<RoutingResult | null> {
  const place = await geo.reverse(point).catch(() => null);
  if (!place) return null;

  const names = [place.ward, place.city, place.district, place.state].filter(
    (n): n is string => typeof n === 'string' && n.trim().length > 0,
  );
  if (names.length === 0) return null;

  const match = await matchJurisdictionByName(db, names);
  if (!match) return null;

  const authority = await resolveAuthorityForJurisdiction(db, match.id, categoryId);

  return {
    jurisdictionId: match.id,
    authorityId: authority.authorityId,
    departmentId: authority.departmentId,
    tier: authority.tier,
    // Explicitly GEOCODE_FALLBACK — the officer must see this is a guess.
    method: 'GEOCODE_FALLBACK',
  };
}

/**
 * Walk a category's resolution_order against a known jurisdiction and its
 * ancestors, and compute the tier the same way resolve_authority() does.
 *
 * Used by the geocode fallback (where we have a jurisdiction but got there
 * outside SQL) and by re-routing after an officer corrects the category.
 */
export async function resolveAuthorityForJurisdiction(
  db: AnyDb,
  jurisdictionId: number,
  categoryId: string,
): Promise<Omit<RoutingResult, 'jurisdictionId' | 'method'>> {
  const scope = await jurisdictionScope(db, jurisdictionId);

  const { data: rules, error: rulesErr } = await db
    .from('category_authority_rules')
    .select('seq, authority_type')
    .eq('category_id', categoryId)
    .order('seq', { ascending: true });

  if (rulesErr) throw new Error(`category_authority_rules read failed: ${rulesErr.message}`);
  if (!rules || rules.length === 0) {
    return { authorityId: null, departmentId: null, tier: 'UNMAPPED' };
  }

  for (const rule of rules) {
    const { data: candidates, error: authErr } = await db
      .from('authorities')
      .select('id, department_id, grievance_email, verification_status')
      .eq('authority_type', rule.authority_type)
      .in('jurisdiction_id', scope)
      .eq('is_active', true)
      .limit(1);

    if (authErr) throw new Error(`authorities read failed: ${authErr.message}`);
    const authority = candidates?.[0];
    if (!authority) continue;

    const tier = await tierFor(db, {
      departmentId: authority.department_id,
      scope,
      grievanceEmail: authority.grievance_email,
      verificationStatus: authority.verification_status,
    });

    return {
      authorityId: authority.id,
      departmentId: authority.department_id,
      tier,
    };
  }

  // Jurisdiction known, nobody to send it to. Still a valid answer.
  return { authorityId: null, departmentId: null, tier: 'UNMAPPED' };
}

/**
 * Tier logic, mirrored from resolve_authority() in 0005_authorities.sql.
 *
 * ONBOARDED   an active officer exists for this department in scope
 * CONTACTABLE a VERIFIED grievance email exists (and only then)
 * UNMAPPED    everything else
 *
 * The verification_status check is load-bearing: state_agencies.csv ships 0 of
 * 36 rows verified and two column-shifted rows, so water and electricity must
 * not auto-route until D3 completes.
 */
async function tierFor(
  db: AnyDb,
  args: {
    departmentId: number | null;
    scope: number[];
    grievanceEmail: string | null;
    verificationStatus: string;
  },
): Promise<RoutingResult['tier']> {
  if (args.departmentId !== null) {
    const { data, error } = await db
      .from('government_officers')
      .select('id')
      .eq('department_id', args.departmentId)
      .in('jurisdiction_id', args.scope)
      .eq('is_active', true)
      .limit(1);
    if (error) throw new Error(`government_officers read failed: ${error.message}`);
    if (data && data.length > 0) return 'ONBOARDED';
  }

  if (args.grievanceEmail && args.verificationStatus === 'VERIFIED') {
    return 'CONTACTABLE';
  }
  return 'UNMAPPED';
}

/** The jurisdiction itself plus every ancestor — a ward pin can find a city board. */
export async function jurisdictionScope(db: AnyDb, jurisdictionId: number): Promise<number[]> {
  const { data, error } = await db.rpc('jurisdiction_ancestors', { p_id: jurisdictionId });
  if (error) throw new Error(`jurisdiction_ancestors failed: ${error.message}`);
  return [jurisdictionId, ...(data ?? []).map((a) => a.id)];
}

/** Every jurisdiction at or beneath this one — the supervisor scope. */
export async function jurisdictionSubtree(db: AnyDb, jurisdictionId: number): Promise<number[]> {
  const { data, error } = await db.rpc('jurisdiction_descendants', { p_id: jurisdictionId });
  if (error) throw new Error(`jurisdiction_descendants failed: ${error.message}`);
  return (data ?? []).map((d) => d.id);
}

/**
 * Resolve just the jurisdiction, with the same honest method reporting. Used by
 * the feed's distance filter and by the report flow's "what will happen to
 * this?" preview, neither of which needs an authority.
 */
export async function resolveJurisdiction(
  db: AnyDb,
  point: LatLng,
  opts: ResolveOptions = {},
): Promise<{ jurisdictionId: number | null; method: RoutingResult['method'] }> {
  assertLatLng(point);

  const { data, error } = await db.rpc('resolve_jurisdiction', {
    p_lat: point.lat,
    p_lng: point.lng,
  });
  if (error) throw new Error(`resolve_jurisdiction failed: ${error.message}`);

  const row = Array.isArray(data) ? data[0] : undefined;
  if (row?.jurisdiction_id != null) {
    return { jurisdictionId: row.jurisdiction_id, method: row.method };
  }

  if (opts.geo) {
    const place = await opts.geo.reverse(point).catch(() => null);
    if (place) {
      const names = [place.ward, place.city, place.district, place.state].filter(
        (n): n is string => !!n && n.trim().length > 0,
      );
      const match = names.length > 0 ? await matchJurisdictionByName(db, names) : null;
      if (match) return { jurisdictionId: match.id, method: 'GEOCODE_FALLBACK' };
    }
  }

  return { jurisdictionId: null, method: row?.method ?? 'NONE' };
}

/**
 * What the citizen is promised at report time (PRD §12: "Coverage is a
 * first-class product surface"). Pure — no I/O, so the UI can call it too.
 */
export function tierPromise(result: RoutingResult): {
  headline: string;
  detail: string;
  hasSlaClock: boolean;
} {
  switch (result.tier) {
    case 'ONBOARDED':
      return {
        headline: 'Assigned to a department officer',
        detail: "We'll notify the responsible officer and track the response clock.",
        hasSlaClock: true,
      };
    case 'CONTACTABLE':
      return {
        headline: 'Sent to the grievance cell',
        detail: "We'll email a formatted grievance and show you when it was delivered.",
        hasSlaClock: false,
      };
    case 'UNMAPPED':
      return {
        headline: 'Published · no authority contact yet',
        detail:
          "We don't have a contact for this area yet. Your report is public, counted and " +
          'clustered with others — that record is what gets a body onboarded.',
        hasSlaClock: false,
      };
  }
}

/** True when the match is below polygon grade and must be surfaced to an officer. */
export function isDegradedMatch(result: Pick<RoutingResult, 'method'>): boolean {
  return result.method !== 'POLYGON' && result.method !== 'MANUAL';
}

// --- helpers --------------------------------------------------------------

function unmapped(method: RoutingResult['method']): RoutingResult {
  return {
    jurisdictionId: null,
    authorityId: null,
    departmentId: null,
    tier: 'UNMAPPED',
    method,
  };
}

function assertLatLng(p: LatLng): void {
  if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) {
    throw new Error(`Invalid coordinates: ${JSON.stringify(p)}`);
  }
  if (p.lat < -90 || p.lat > 90) throw new Error(`Latitude out of range: ${p.lat}`);
  if (p.lng < -180 || p.lng > 180) throw new Error(`Longitude out of range: ${p.lng}`);
}

/** Narrow a free-text level from a CSV or an API into the enum. Used by ingest. */
export function coerceJurisdictionLevel(raw: string): JurisdictionLevel | null {
  const up = raw.trim().toUpperCase();
  return isJurisdictionLevel(up) ? up : null;
}
