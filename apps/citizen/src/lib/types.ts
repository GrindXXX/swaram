/**
 * UI-facing types for the citizen app. These mirror the shape of
 * backend/core/types/enums.ts and backend/core/domain/*.ts, but are declared
 * locally rather than imported from @swaram/shared: there's no root workspace
 * manifest yet (see apps/web/tsconfig.json's comment on the same gap), so
 * apps/citizen installs standalone like apps/web does. Swap these for real
 * imports once that manifest exists.
 */

export type IssueStatus =
  | 'OPEN'
  | 'ASSIGNED'
  | 'ACKNOWLEDGED'
  | 'IN_PROGRESS'
  | 'HELD'
  | 'RESOLUTION_SUBMITTED'
  | 'AWAITING_VERIFICATION'
  | 'RESOLVED'
  | 'CLOSED'
  | 'REOPENED'
  | 'REJECTED'
  | 'MERGED';

export type LocationPrecision = 'POINT' | 'AREA' | 'JURISDICTION';
export type LocationVisibility = 'EXACT' | 'APPROXIMATE' | 'PRIVATE';
export type RoutingTier = 'ONBOARDED' | 'CONTACTABLE' | 'UNMAPPED';
export type JurisdictionMatchMethod =
  | 'POLYGON'
  | 'CENTROID_FALLBACK'
  | 'GEOCODE_FALLBACK'
  | 'MANUAL'
  | 'NONE';

export type ReplyAuthorKind = 'citizen' | 'government';

export interface Reply {
  id: string;
  authorKind: ReplyAuthorKind;
  authorLabel: string; // "#B72D" or "Roads Department"
  timeAgo: string;
  body: string;
  workOrder?: string;
}

export interface Issue {
  id: string; // "CIV-10482"
  title: string;
  body: string;
  category: string;
  ward: string;
  city: string;
  status: IssueStatus;
  authorHandle: string; // "Citizen #A82F"
  timeAgo: string;
  filedOn: string;
  rage: number; // 0-100
  rageDelta7d?: number;
  affected: number;
  reportCount: number;
  standingWithCount: number;
  photoCount: number;
  overdueDays?: number;
  routingTier?: RoutingTier;
  jurisdictionMatchMethod?: JurisdictionMatchMethod;
  locationPrecision?: LocationPrecision;
  locationVisibility?: LocationVisibility;
  publishedToFeed?: boolean;
  replies: Reply[];
  history: string[]; // "Reported" -> "Routed" -> "Response" -> "Evidence" -> "Verifying"
}

export interface Badge {
  id: string;
  name: string;
  color: 'resolved' | 'gov' | 'rage' | 'locked';
  earned: boolean;
}
