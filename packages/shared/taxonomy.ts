/**
 * taxonomy.ts — GENERATED FROM data/departments/taxonomy.json
 *
 * 13 civic issue categories and the 15 authority *types* that own them. This is
 * jurisdiction-generic: it never names a specific department, because that name
 * changes per state and per city. Resolving an actual department is a query
 * (category x jurisdiction -> category_department_map), not a lookup here.
 *
 * The intake agent emits a CategoryId from this file and nothing else. It never
 * emits a department (PRD S13).
 *
 * Regenerate rather than hand-edit if data/departments/taxonomy.json changes.
 */

/* ------------------------------------------------------------------ *
 * Authority types
 * ------------------------------------------------------------------ */

export const AuthorityType = {
  ULB_ENGINEERING: "ULB_ENGINEERING",
  ULB_SANITATION: "ULB_SANITATION",
  ULB_ELECTRICAL: "ULB_ELECTRICAL",
  ULB_HEALTH: "ULB_HEALTH",
  ULB_HORTICULTURE: "ULB_HORTICULTURE",
  ULB_TOWN_PLANNING: "ULB_TOWN_PLANNING",
  ULB_ANIMAL_HUSBANDRY: "ULB_ANIMAL_HUSBANDRY",
  STATE_WATER_BOARD: "STATE_WATER_BOARD",
  STATE_PHED: "STATE_PHED",
  STATE_DISCOM: "STATE_DISCOM",
  STATE_PWD: "STATE_PWD",
  NHAI: "NHAI",
  TRAFFIC_POLICE: "TRAFFIC_POLICE",
  STATE_FIRE: "STATE_FIRE",
  REVENUE_DEPT: "REVENUE_DEPT",
} as const;
export type AuthorityType = (typeof AuthorityType)[keyof typeof AuthorityType];
export const AUTHORITY_TYPES = Object.values(AuthorityType) as readonly AuthorityType[];

/** Plain-language description of each authority type, for officer-facing UI
 *  and for the "who will receive this" line on the citizen confirmation. */
export const AUTHORITY_TYPE_DESCRIPTION: Record<AuthorityType, string> = {
  ULB_ENGINEERING: "The urban local body's own civil engineering wing (roads, potholes, footpaths within municipal limits)",
  ULB_SANITATION: "The ULB's solid waste management / sanitation wing",
  ULB_ELECTRICAL: "The ULB's street lighting section (distinct from the state DISCOM, which handles supply to premises)",
  ULB_HEALTH: "The ULB's public health department (mosquito breeding, sanitation-linked disease)",
  ULB_HORTICULTURE: "The ULB's parks/trees department",
  ULB_TOWN_PLANNING: "The ULB's building-plan approval and illegal-construction enforcement wing",
  ULB_ANIMAL_HUSBANDRY: "The ULB's stray animal control wing",
  STATE_WATER_BOARD: "A state or city-level water & sewerage board, where one exists (see state_agencies.csv). Falls back to ULB_ENGINEERING or state PHED where no dedicated board exists.",
  STATE_PHED: "Public Health Engineering Department \u2014 handles water supply in states/rural areas without a dedicated water board",
  STATE_DISCOM: "The state electricity distribution company \u2014 handles supply faults, transformer issues, billing (distinct from ULB_ELECTRICAL streetlights)",
  STATE_PWD: "Public Works Department \u2014 state highways and roads outside municipal limits",
  NHAI: "National Highways Authority of India \u2014 national highways only",
  TRAFFIC_POLICE: "City traffic police \u2014 signals, signage, congestion",
  STATE_FIRE: "State Fire & Emergency Services",
  REVENUE_DEPT: "District Collector / Revenue Department \u2014 encroachment on government land, disputes",
};

/* ------------------------------------------------------------------ *
 * Categories
 * ------------------------------------------------------------------ */

export const CategoryId = {
  pothole_road_damage: "pothole_road_damage",
  streetlight: "streetlight",
  garbage_swm: "garbage_swm",
  water_supply: "water_supply",
  sewerage_drainage: "sewerage_drainage",
  power_outage: "power_outage",
  traffic_signal_signage: "traffic_signal_signage",
  encroachment: "encroachment",
  stray_animals: "stray_animals",
  parks_trees: "parks_trees",
  illegal_construction: "illegal_construction",
  public_health_sanitation: "public_health_sanitation",
  fire_hazard: "fire_hazard",
} as const;
export type CategoryId = (typeof CategoryId)[keyof typeof CategoryId];
export const CATEGORY_IDS = Object.values(CategoryId) as readonly CategoryId[];

/** One step in a category's resolution order. The first step whose `condition`
 *  holds for the issue's location wins; `condition` absent means unconditional. */
export interface ResolutionStep {
  readonly authorityType: AuthorityType;
  readonly condition?: string;
}

export interface CivicCategory {
  readonly id: CategoryId;
  readonly label: string;
  /** Ordered — index 0 is the default owner. */
  readonly resolutionOrder: readonly ResolutionStep[];
}

export const CATEGORIES: readonly CivicCategory[] = [
  {
    id: CategoryId.pothole_road_damage,
    label: "Pothole / Road Damage",
    resolutionOrder: [
      { authorityType: AuthorityType.ULB_ENGINEERING, condition: "within municipal ward boundary" },
      { authorityType: AuthorityType.STATE_PWD, condition: "on a state highway outside municipal limits" },
      { authorityType: AuthorityType.NHAI, condition: "on a national highway" },
    ],
  },
  {
    id: CategoryId.streetlight,
    label: "Streetlight Not Working",
    resolutionOrder: [
      { authorityType: AuthorityType.ULB_ELECTRICAL },
    ],
  },
  {
    id: CategoryId.garbage_swm,
    label: "Garbage / Solid Waste",
    resolutionOrder: [
      { authorityType: AuthorityType.ULB_SANITATION },
    ],
  },
  {
    id: CategoryId.water_supply,
    label: "Water Supply (no supply / low pressure / contamination)",
    resolutionOrder: [
      { authorityType: AuthorityType.STATE_WATER_BOARD, condition: "city has a dedicated water board" },
      { authorityType: AuthorityType.STATE_PHED, condition: "no dedicated board (mostly rural/smaller towns)" },
    ],
  },
  {
    id: CategoryId.sewerage_drainage,
    label: "Sewerage / Drainage / Waterlogging",
    resolutionOrder: [
      { authorityType: AuthorityType.STATE_WATER_BOARD, condition: "city has a dedicated water board" },
      { authorityType: AuthorityType.ULB_ENGINEERING, condition: "storm-water drains not under the water board" },
    ],
  },
  {
    id: CategoryId.power_outage,
    label: "Electricity Outage / Faulty Line / Transformer",
    resolutionOrder: [
      { authorityType: AuthorityType.STATE_DISCOM },
    ],
  },
  {
    id: CategoryId.traffic_signal_signage,
    label: "Traffic Signal / Signage / Road Markings",
    resolutionOrder: [
      { authorityType: AuthorityType.TRAFFIC_POLICE },
      { authorityType: AuthorityType.ULB_ENGINEERING },
    ],
  },
  {
    id: CategoryId.encroachment,
    label: "Encroachment on Public Land",
    resolutionOrder: [
      { authorityType: AuthorityType.ULB_TOWN_PLANNING },
      { authorityType: AuthorityType.REVENUE_DEPT },
    ],
  },
  {
    id: CategoryId.stray_animals,
    label: "Stray Animals",
    resolutionOrder: [
      { authorityType: AuthorityType.ULB_ANIMAL_HUSBANDRY },
    ],
  },
  {
    id: CategoryId.parks_trees,
    label: "Parks / Fallen Trees / Green Cover",
    resolutionOrder: [
      { authorityType: AuthorityType.ULB_HORTICULTURE },
    ],
  },
  {
    id: CategoryId.illegal_construction,
    label: "Illegal / Unauthorized Construction",
    resolutionOrder: [
      { authorityType: AuthorityType.ULB_TOWN_PLANNING },
    ],
  },
  {
    id: CategoryId.public_health_sanitation,
    label: "Public Health (mosquito breeding, open defecation, dead animal removal)",
    resolutionOrder: [
      { authorityType: AuthorityType.ULB_HEALTH },
    ],
  },
  {
    id: CategoryId.fire_hazard,
    label: "Fire Hazard",
    resolutionOrder: [
      { authorityType: AuthorityType.STATE_FIRE },
    ],
  },
] as const;


const BY_ID: Record<CategoryId, CivicCategory> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c]),
) as Record<CategoryId, CivicCategory>;

/** Look up a category. Throws on an unknown id — an unknown category means the
 *  agent drifted from the taxonomy, which must be loud, not silent. */
export function categoryById(id: CategoryId): CivicCategory {
  const c = BY_ID[id];
  if (!c) throw new Error(`Unknown civic category: ${id}`);
  return c;
}

/** Display label, e.g. "Pothole / Road Damage". */
export function categoryLabel(id: CategoryId): string {
  return categoryById(id).label;
}

/** Short label for chips and pills, e.g. "Pothole". Takes the first clause. */
export function categoryShortLabel(id: CategoryId): string {
  const label = categoryById(id).label;
  return (label.split(/[/(]/)[0] ?? label).trim();
}

/** True if `value` is a category id known to this build. */
export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === 'string' && value in BY_ID;
}

/** True if `value` is an authority type known to this build. */
export function isAuthorityType(value: unknown): value is AuthorityType {
  return typeof value === 'string' && value in AuthorityType;
}

/** The authority type that owns this category when no condition applies.
 *  Never a department name — see the file header. */
export function defaultAuthorityType(id: CategoryId): AuthorityType {
  const first = categoryById(id).resolutionOrder[0];
  if (!first) throw new Error(`Category ${id} has an empty resolution order`);
  return first.authorityType;
}

/** Every category that can land on a given authority type, at any step. */
export function categoriesForAuthorityType(
  type: AuthorityType,
): readonly CivicCategory[] {
  return CATEGORIES.filter((c) =>
    c.resolutionOrder.some((s) => s.authorityType === type),
  );
}
