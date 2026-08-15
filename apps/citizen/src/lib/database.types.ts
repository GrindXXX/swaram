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
        is_facing_too: boolean;
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
      issue_followers: Table<{
        issue_id: string;
        user_id: string;
        muted: boolean;
        created_at: string;
      }>;
      // RLS: notifications_self (select where user_id = auth.uid()). Rows are
      // written by the backend only — no INSERT policy for any client role.
      notifications: Table<{
        id: number;
        user_id: string;
        issue_id: string | null;
        type: string;
        title: string;
        body: string | null;
        url: string | null;
        channel: 'PUSH' | 'IN_APP' | 'EMAIL' | 'SMS' | 'DIGEST';
        is_read: boolean;
        read_at: string | null;
        created_at: string;
      }>;
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
      citizen_issue_state: {
        Args: { p_public_id: string };
        Returns: { is_following: boolean; has_reported: boolean }[];
      };
      citizen_my_issue_ids: {
        Args: Record<string, never>;
        Returns: { issue_id: string; relation: 'created' | 'following' }[];
      };
      citizen_issue_descriptions: {
        Args: { p_issue_ids: string[] };
        Returns: { issue_id: string; description: string | null }[];
      };
      set_citizen_issue_following: {
        Args: { p_public_id: string; p_following: boolean };
        Returns: { is_following: boolean; follower_count: number }[];
      };
      create_citizen_comment: {
        Args: { p_public_id: string; p_content: string };
        Returns: string;
      };
      add_citizen_issue_report: {
        Args: { p_public_id: string; p_client_report_id: string };
        Returns: { inserted: boolean; report_count: number }[];
      };
      add_citizen_comment: {
        Args: { p_issue_id: string; p_content: string };
        Returns: string;
      };
      toggle_issue_support: {
        Args: { p_issue_id: string };
        Returns: boolean;
      };
      toggle_issue_follow: {
        Args: { p_issue_id: string };
        Returns: boolean;
      };
      submit_verification_response: {
        Args: {
          p_issue_id: string;
          p_resolution_id: string;
          p_verdict: 'COMPLETELY_FIXED' | 'PARTIALLY_FIXED' | 'STILL_EXISTS' | 'NEW_PROBLEM';
          p_comment?: string | null;
        };
        Returns: string;
      };
      verification_context: {
        Args: { p_issue_id: string };
        Returns: {
          resolution_id: string;
          action_taken: string;
          submitted_at: string;
          resolution_photo_url: string | null;
          same_location: boolean | null;
          verification_open: boolean;
          breakdown: Array<{
            verdict: 'COMPLETELY_FIXED' | 'PARTIALLY_FIXED' | 'STILL_EXISTS' | 'NEW_PROBLEM';
            responses: number;
            pct: number;
          }>;
        } | null;
      };
    };
    Enums: {
      issue_status: IssueStatus;
      routing_tier: RoutingTier;
      location_precision: LocationPrecision;
      location_visibility: LocationVisibility;
      jurisdiction_match_method: JurisdictionMatchMethod;
      verification_verdict: 'COMPLETELY_FIXED' | 'PARTIALLY_FIXED' | 'STILL_EXISTS' | 'NEW_PROBLEM';
    };
    CompositeTypes: Record<string, never>;
  };
}
