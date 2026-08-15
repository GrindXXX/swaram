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

export type RoutingTier = 'ONBOARDED' | 'CONTACTABLE' | 'UNMAPPED';
export type LocationPrecision = 'POINT' | 'AREA' | 'JURISDICTION';
export type LocationVisibility = 'EXACT' | 'APPROXIMATE' | 'PRIVATE';
export type JurisdictionMatchMethod =
  | 'POLYGON'
  | 'CENTROID_FALLBACK'
  | 'GEOCODE_FALLBACK'
  | 'MANUAL'
  | 'NONE';

type Table<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      issues: Table<{
        id: string;
        public_id: string;
        title: string | null;
        description: string | null;
        category_id: string | null;
        address: string | null;
        location_precision: LocationPrecision;
        location_visibility: LocationVisibility;
        severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        civic_pressure: number;
        estimated_people_affected: number | null;
        routing_tier: RoutingTier;
        jurisdiction_id: number | null;
        jurisdiction_match_method: JurisdictionMatchMethod;
        department_id: number | null;
        status: IssueStatus;
        published_at: string | null;
        sla_due_at: string | null;
        report_count: number;
        follower_count: number;
        created_by: string | null;
        created_at: string;
      }>;
      reports: Table<{
        id: string;
        issue_id: string;
        user_id: string | null;
        client_report_id: string | null;
        description: string | null;
        transcript: string | null;
        audio_url: string | null;
        media_url: string | null;
        media_type: 'PHOTO' | 'VIDEO' | 'AUDIO' | 'NONE';
        location: unknown;
        is_anonymous: boolean;
        source: 'CITIZEN_APP' | 'OFFICER' | 'IMPORT';
        created_at: string;
      }>;
      comments: Table<{
        id: string;
        issue_id: string;
        user_id: string | null;
        content: string;
        is_official: boolean;
        created_at: string;
      }>;
      issue_history: Table<{
        id: number;
        issue_id: string;
        action: string;
        created_at: string;
      }>;
      categories: Table<{ id: string; label: string }>;
      departments: Table<{ id: number; name: string }>;
      jurisdictions: Table<{ id: number; name: string }>;
    };
    Views: Record<string, never>;
    Functions: {
      submit_citizen_report: {
        Args: {
          p_client_report_id: string;
          p_description: string;
          p_lat: number;
          p_lng: number;
          p_title?: string | null;
          p_category_id?: string | null;
          p_location_precision?: LocationPrecision;
          p_location_visibility?: LocationVisibility;
          p_is_anonymous?: boolean;
        };
        Returns: {
          issue_id: string;
          public_id: string;
          report_id: string;
          title: string;
          routing_tier: RoutingTier;
          jurisdiction_id: number | null;
          jurisdiction_match_method: JurisdictionMatchMethod;
          published_at: string | null;
        }[];
      };
    };
    Enums: {
      issue_status: IssueStatus;
      routing_tier: RoutingTier;
      location_precision: LocationPrecision;
      location_visibility: LocationVisibility;
      jurisdiction_match_method: JurisdictionMatchMethod;
    };
    CompositeTypes: Record<string, never>;
  };
}
