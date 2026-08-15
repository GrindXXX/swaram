/**
 * types.gen.ts — HAND-WRITTEN PLACEHOLDER. Regenerate, do not edit, once the
 * schema is live:
 *
 *     supabase gen types typescript --local        > backend/core/db/types.gen.ts
 *     supabase gen types typescript --project-id X > backend/core/db/types.gen.ts
 *
 * (`npm run gen:types` from backend/core does the local variant.)
 *
 * Why a placeholder exists at all: the domain layer and the workers must
 * compile before the migrations land, and a column rename should break the
 * build in every consumer at once (technical-plan.html §05). This file is
 * shaped exactly like the generator's output so the swap is a straight
 * overwrite.
 *
 * PROVENANCE OF EACH TABLE BELOW
 *   migrations 0001–0006 (exist today, owned by the migrations agent):
 *       jurisdictions, authority_types, categories, category_authority_rules,
 *       organisations, departments, authorities, users,
 *       officer_roster_records, government_officers, role_grants_log
 *   migrations 0007+ (NOT WRITTEN YET — transcribed from technical-plan.html
 *   §05.2/§05.3 and §11 so this layer can be built in parallel):
 *       issues, issue_participants, issue_transfers, reports, comments,
 *       evidence, verifications, cluster_candidates, agent_runs,
 *       notifications, email_dispatches
 *   If the migrations agent names a column differently, this file loses and
 *   the generator output wins. Fix the domain layer, not the schema.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      // ---------------------------------------------------------------- 0003
      jurisdictions: {
        Row: {
          id: number;
          lgd_code: string | null;
          name: string;
          name_local: string | null;
          level: Enums['jurisdiction_level'];
          parent_id: number | null;
          state_code: number | null;
          district_code: number | null;
          body_type: string | null;
          /** geometry(MultiPolygon,4326). Null until 02_load_boundaries.ts runs. */
          geometry: unknown | null;
          /** geometry(Point,4326). */
          centroid: unknown | null;
          source: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          lgd_code?: string | null;
          name: string;
          name_local?: string | null;
          level: Enums['jurisdiction_level'];
          parent_id?: number | null;
          state_code?: number | null;
          district_code?: number | null;
          body_type?: string | null;
          geometry?: unknown | null;
          centroid?: unknown | null;
          source: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['jurisdictions']['Insert']>;
        Relationships: [];
      };

      // ---------------------------------------------------------------- 0004
      authority_types: {
        Row: { id: string; description: string; level: Enums['jurisdiction_level'] | null };
        Insert: { id: string; description: string; level?: Enums['jurisdiction_level'] | null };
        Update: Partial<Database['public']['Tables']['authority_types']['Insert']>;
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          label: string;
          is_sensitive: boolean;
          cluster_radius_m: number;
          default_severity: Enums['issue_severity'];
          sort_order: number;
          is_active: boolean;
        };
        Insert: {
          id: string;
          label: string;
          is_sensitive?: boolean;
          cluster_radius_m?: number;
          default_severity?: Enums['issue_severity'];
          sort_order?: number;
          is_active?: boolean;
        };
        Update: Partial<Database['public']['Tables']['categories']['Insert']>;
        Relationships: [];
      };
      category_authority_rules: {
        Row: { category_id: string; seq: number; authority_type: string; condition: string | null };
        Insert: {
          category_id: string;
          seq: number;
          authority_type: string;
          condition?: string | null;
        };
        Update: Partial<Database['public']['Tables']['category_authority_rules']['Insert']>;
        Relationships: [];
      };

      // ---------------------------------------------------------------- 0005
      organisations: {
        Row: {
          id: number;
          name: string;
          type: string | null;
          contact_email: string | null;
          phone: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          type?: string | null;
          contact_email?: string | null;
          phone?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['organisations']['Insert']>;
        Relationships: [];
      };
      departments: {
        Row: {
          id: number;
          name: string;
          slug: string;
          authority_type: string | null;
          jurisdiction_id: number | null;
          description: string | null;
          sla_overrides: Json | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          slug: string;
          authority_type?: string | null;
          jurisdiction_id?: number | null;
          description?: string | null;
          sla_overrides?: Json | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['departments']['Insert']>;
        Relationships: [];
      };
      authorities: {
        Row: {
          id: number;
          name: string;
          authority_type: string | null;
          jurisdiction_id: number | null;
          department_id: number | null;
          level: Enums['jurisdiction_level'] | null;
          officer_name: string | null;
          grievance_email: string | null;
          phone: string | null;
          appellate_name: string | null;
          appellate_email: string | null;
          official_handles: Json | null;
          verification_status: Enums['verification_status'];
          source: string;
          source_url: string | null;
          last_verified_at: string | null;
          bounce_count: number;
          last_bounce_at: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          authority_type?: string | null;
          jurisdiction_id?: number | null;
          department_id?: number | null;
          level?: Enums['jurisdiction_level'] | null;
          officer_name?: string | null;
          grievance_email?: string | null;
          phone?: string | null;
          appellate_name?: string | null;
          appellate_email?: string | null;
          official_handles?: Json | null;
          verification_status?: Enums['verification_status'];
          source: string;
          source_url?: string | null;
          last_verified_at?: string | null;
          bounce_count?: number;
          last_bounce_at?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['authorities']['Insert']>;
        Relationships: [];
      };

      // ---------------------------------------------------------------- 0006
      users: {
        Row: {
          id: string;
          email: string | null;
          display_name: string | null;
          full_name: string | null;
          avatar_url: string | null;
          role: Enums['app_role'];
          phone: string | null;
          phone_verified_at: string | null;
          home_jurisdiction_id: number | null;
          language: string;
          identity_tier: 'EMAIL' | 'PHONE' | 'ENHANCED';
          verification_ref: string | null;
          is_suspended: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          display_name?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          role?: Enums['app_role'];
          phone?: string | null;
          phone_verified_at?: string | null;
          home_jurisdiction_id?: number | null;
          language?: string;
          identity_tier?: 'EMAIL' | 'PHONE' | 'ENHANCED';
          verification_ref?: string | null;
          is_suspended?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
        Relationships: [];
      };
      officer_roster_records: {
        Row: {
          id: number;
          source_batch_id: string;
          name: string | null;
          designation: string | null;
          department_ref: string | null;
          jurisdiction_ref: string | null;
          department_id: number | null;
          jurisdiction_id: number | null;
          jurisdiction_lvl: Enums['jurisdiction_level'] | null;
          email: string | null;
          phone: string | null;
          employee_ref: string | null;
          match_status:
            | 'PENDING'
            | 'MATCHED'
            | 'CONFIRMED'
            | 'AMBIGUOUS'
            | 'UNUSABLE_CONTACT';
          matched_user_id: string | null;
          confirmed_at: string | null;
          source_url: string | null;
          created_at: string;
          deactivated_at: string | null;
        };
        Insert: {
          id?: number;
          source_batch_id: string;
          name?: string | null;
          designation?: string | null;
          department_ref?: string | null;
          jurisdiction_ref?: string | null;
          department_id?: number | null;
          jurisdiction_id?: number | null;
          jurisdiction_lvl?: Enums['jurisdiction_level'] | null;
          email?: string | null;
          phone?: string | null;
          employee_ref?: string | null;
          match_status?:
            | 'PENDING'
            | 'MATCHED'
            | 'CONFIRMED'
            | 'AMBIGUOUS'
            | 'UNUSABLE_CONTACT';
          matched_user_id?: string | null;
          confirmed_at?: string | null;
          source_url?: string | null;
          created_at?: string;
          deactivated_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['officer_roster_records']['Insert']>;
        Relationships: [];
      };
      government_officers: {
        Row: {
          id: number;
          user_id: string;
          department_id: number | null;
          jurisdiction_id: number;
          jurisdiction_level: Enums['jurisdiction_level'];
          designation: string | null;
          employee_ref: string | null;
          roster_record_id: number | null;
          confirmed_at: string | null;
          last_attested_at: string | null;
          max_workload: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          department_id?: number | null;
          jurisdiction_id: number;
          jurisdiction_level?: Enums['jurisdiction_level'];
          designation?: string | null;
          employee_ref?: string | null;
          roster_record_id?: number | null;
          confirmed_at?: string | null;
          last_attested_at?: string | null;
          max_workload?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['government_officers']['Insert']>;
        Relationships: [];
      };
      role_grants_log: {
        Row: {
          id: number;
          user_id: string;
          granted_role: Enums['app_role'];
          officer_id: number | null;
          roster_record_id: number | null;
          match_method: string;
          granted_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          granted_role: Enums['app_role'];
          officer_id?: number | null;
          roster_record_id?: number | null;
          match_method: string;
          granted_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['role_grants_log']['Insert']>;
        Relationships: [];
      };

      // ------------------------------------------------- 0007+ (NOT YET WRITTEN)
      issues: {
        Row: {
          id: string;
          public_id: string;
          title: string | null;
          description: string | null;
          category_id: string | null;
          subcategory: string | null;
          /** geography(Point,4326) */
          location: unknown;
          location_precision: Enums['location_precision'];
          location_visibility: Enums['location_visibility'];
          visibility: Enums['issue_visibility'];
          severity: Enums['issue_severity'] | null;
          priority: Enums['issue_priority'] | null;
          civic_pressure: number;
          estimated_people_affected: number | null;
          emergency_flag: boolean;
          escalation_level: Enums['escalation_level'];
          routing_tier: Enums['routing_tier'] | null;
          jurisdiction_id: number | null;
          jurisdiction_match_method: Enums['jurisdiction_match_method'] | null;
          authority_id: number | null;
          department_id: number | null;
          owner_officer_id: string | null;
          status: Enums['issue_status'];
          moderation_verdict: Enums['moderation_verdict'] | null;
          published_at: string | null;
          acknowledged_at: string | null;
          resolved_at: string | null;
          closed_at: string | null;
          sla_due_at: string | null;
          sla_ack_due_at: string | null;
          satisfaction_score: number | null;
          merged_into_id: string | null;
          report_count: number;
          follower_count: number;
          support_count: number;
          comment_count: number;
          last_activity_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          public_id?: string;
          title?: string | null;
          description?: string | null;
          category_id?: string | null;
          subcategory?: string | null;
          location: unknown;
          location_precision?: Enums['location_precision'];
          location_visibility?: Enums['location_visibility'];
          visibility?: Enums['issue_visibility'];
          severity?: Enums['issue_severity'] | null;
          priority?: Enums['issue_priority'] | null;
          civic_pressure?: number;
          estimated_people_affected?: number | null;
          emergency_flag?: boolean;
          escalation_level?: Enums['escalation_level'];
          routing_tier?: Enums['routing_tier'] | null;
          jurisdiction_id?: number | null;
          jurisdiction_match_method?: Enums['jurisdiction_match_method'] | null;
          authority_id?: number | null;
          department_id?: number | null;
          owner_officer_id?: string | null;
          status?: Enums['issue_status'];
          moderation_verdict?: Enums['moderation_verdict'] | null;
          published_at?: string | null;
          acknowledged_at?: string | null;
          resolved_at?: string | null;
          closed_at?: string | null;
          sla_due_at?: string | null;
          sla_ack_due_at?: string | null;
          satisfaction_score?: number | null;
          merged_into_id?: string | null;
          report_count?: number;
          follower_count?: number;
          support_count?: number;
          comment_count?: number;
          last_activity_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['issues']['Insert']>;
        Relationships: [];
      };
      issue_participants: {
        Row: {
          id: number;
          issue_id: string;
          user_id: string | null;
          org_id: number | null;
          role: Enums['participant_role'];
          is_public: boolean;
          notify: boolean;
          added_by: string | null;
          expires_at: string | null;
          added_at: string;
          removed_at: string | null;
        };
        Insert: {
          id?: number;
          issue_id: string;
          user_id?: string | null;
          org_id?: number | null;
          role: Enums['participant_role'];
          is_public?: boolean;
          notify?: boolean;
          added_by?: string | null;
          expires_at?: string | null;
          added_at?: string;
          removed_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['issue_participants']['Insert']>;
        Relationships: [];
      };
      issue_transfers: {
        Row: {
          id: number;
          issue_id: string;
          from_authority: number | null;
          to_authority: number | null;
          action: Enums['transfer_action'];
          reason: string | null;
          actor_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          issue_id: string;
          from_authority?: number | null;
          to_authority?: number | null;
          action: Enums['transfer_action'];
          reason?: string | null;
          actor_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['issue_transfers']['Insert']>;
        Relationships: [];
      };
      reports: {
        Row: {
          id: string;
          issue_id: string;
          user_id: string | null;
          client_report_id: string | null;
          source: Enums['report_source'];
          description: string | null;
          transcript: string | null;
          audio_url: string | null;
          media_url: string | null;
          media_type: Enums['media_type'];
          /** geography(Point,4326) */
          location: unknown | null;
          /** vector(1536) — pgvector. Serialised as a JSON array over PostgREST. */
          embedding: number[] | null;
          is_anonymous: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          issue_id: string;
          user_id?: string | null;
          client_report_id?: string | null;
          source?: Enums['report_source'];
          description?: string | null;
          transcript?: string | null;
          audio_url?: string | null;
          media_url?: string | null;
          media_type?: Enums['media_type'];
          location: unknown;
          embedding?: number[] | null;
          is_anonymous?: boolean;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['reports']['Insert']>;
        Relationships: [];
      };
      evidence: {
        Row: {
          id: number;
          issue_id: string;
          type: Enums['evidence_type'];
          media_url: string;
          caption: string | null;
          /** geography(Point,4326) — EXIF/GPS of the capture, for the distance check. */
          captured_at_location: unknown | null;
          captured_at: string | null;
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          issue_id: string;
          type: Enums['evidence_type'];
          media_url: string;
          caption?: string | null;
          captured_at_location?: unknown | null;
          captured_at?: string | null;
          uploaded_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['evidence']['Insert']>;
        Relationships: [];
      };
      verifications: {
        Row: {
          id: number;
          issue_id: string;
          user_id: string;
          verdict: Enums['verification_verdict'];
          comment: string | null;
          media_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          issue_id: string;
          user_id: string;
          verdict: Enums['verification_verdict'];
          comment?: string | null;
          media_url?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['verifications']['Insert']>;
        Relationships: [];
      };
      verification_windows: {
        Row: {
          id: number;
          issue_id: string;
          opened_at: string;
          closes_at: string;
          eligible_count: number;
          quorum_target: number;
          closed_at: string | null;
          outcome: string | null;
          satisfaction_score: number | null;
        };
        Insert: {
          id?: number;
          issue_id: string;
          opened_at?: string;
          closes_at: string;
          eligible_count: number;
          quorum_target: number;
          closed_at?: string | null;
          outcome?: string | null;
          satisfaction_score?: number | null;
        };
        Update: Partial<Database['public']['Tables']['verification_windows']['Insert']>;
        Relationships: [];
      };
      cluster_candidates: {
        Row: {
          id: number;
          issue_id: string;
          candidate_issue_id: string;
          confidence: number;
          reasoning: string | null;
          location_score: number | null;
          image_score: number | null;
          text_score: number | null;
          decision: 'AUTO_MERGED' | 'PENDING_OFFICER' | 'REJECTED';
          resolved_by: string | null;
          resolved_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          issue_id: string;
          candidate_issue_id: string;
          confidence: number;
          reasoning?: string | null;
          location_score?: number | null;
          image_score?: number | null;
          text_score?: number | null;
          decision: 'AUTO_MERGED' | 'PENDING_OFFICER' | 'REJECTED';
          resolved_by?: string | null;
          resolved_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['cluster_candidates']['Insert']>;
        Relationships: [];
      };
      agent_runs: {
        Row: {
          id: number;
          agent_name: 'intake' | 'cluster' | 'verify';
          issue_id: string | null;
          model: string;
          input: Json;
          output: Json | null;
          confidence: number | null;
          latency_ms: number | null;
          input_tokens: number | null;
          output_tokens: number | null;
          error: string | null;
          was_overridden: boolean;
          created_at: string;
        };
        Insert: {
          id?: number;
          agent_name: 'intake' | 'cluster' | 'verify';
          issue_id?: string | null;
          model: string;
          input: Json;
          output?: Json | null;
          confidence?: number | null;
          latency_ms?: number | null;
          input_tokens?: number | null;
          output_tokens?: number | null;
          error?: string | null;
          was_overridden?: boolean;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['agent_runs']['Insert']>;
        Relationships: [];
      };
      email_dispatches: {
        Row: {
          id: number;
          issue_id: string;
          authority_id: number;
          to_email: string;
          subject: string;
          body: string;
          provider_message_id: string | null;
          status: 'QUEUED' | 'SENT' | 'BOUNCED' | 'FAILED';
          error: string | null;
          sent_at: string | null;
          bounced_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          issue_id: string;
          authority_id: number;
          to_email: string;
          subject: string;
          body: string;
          provider_message_id?: string | null;
          status?: 'QUEUED' | 'SENT' | 'BOUNCED' | 'FAILED';
          error?: string | null;
          sent_at?: string | null;
          bounced_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['email_dispatches']['Insert']>;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: number;
          user_id: string;
          issue_id: string | null;
          kind: string;
          title: string;
          body: string | null;
          payload: Json | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          issue_id?: string | null;
          kind: string;
          title: string;
          body?: string | null;
          payload?: Json | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>;
        Relationships: [];
      };
    };

    Views: Record<string, never>;

    Functions: {
      resolve_jurisdiction: {
        Args: { p_lat: number; p_lng: number };
        Returns: {
          jurisdiction_id: number | null;
          method: Enums['jurisdiction_match_method'];
        }[];
      };
      resolve_authority: {
        Args: { p_lat: number; p_lng: number; p_category: string };
        Returns: {
          jurisdiction_id: number | null;
          authority_id: number | null;
          department_id: number | null;
          tier: Enums['routing_tier'];
          method: Enums['jurisdiction_match_method'];
        }[];
      };
      jurisdiction_ancestors: {
        Args: { p_id: number };
        Returns: {
          id: number;
          name: string;
          level: Enums['jurisdiction_level'];
          depth: number;
        }[];
      };
      jurisdiction_descendants: {
        Args: { p_id: number };
        Returns: { id: number }[];
      };
      officer_claim_candidate: {
        Args: { p_user_id: string };
        Returns: {
          roster_record_id: number | null;
          name: string | null;
          designation: string | null;
          department_id: number | null;
          jurisdiction_id: number | null;
          signal: string;
        }[];
      };
      submit_citizen_report: {
        Args: {
          p_client_report_id: string;
          p_description: string;
          p_lat: number;
          p_lng: number;
          p_title?: string | null;
          p_category_id?: string | null;
          p_location_precision?: Enums['location_precision'];
          p_location_visibility?: Enums['location_visibility'];
          p_is_anonymous?: boolean;
        };
        Returns: {
          issue_id: string;
          public_id: string;
          report_id: string;
          title: string;
          routing_tier: Enums['routing_tier'];
          jurisdiction_id: number | null;
          jurisdiction_match_method: Enums['jurisdiction_match_method'];
          published_at: string | null;
        }[];
      };
      /** 0007+: PostGIS + pgvector candidate retrieval for clustering (§09 C4). */
      cluster_candidates_for: {
        Args: {
          p_issue_id: string;
          p_lat: number;
          p_lng: number;
          p_category: string;
          p_radius_m: number;
          p_embedding: string | null;
          p_limit: number;
        };
        Returns: {
          issue_id: string;
          public_id: string;
          metres: number;
          text_sim: number | null;
          created_at: string;
          title: string | null;
          media_url: string | null;
        }[];
      };
    };

    Enums: Enums;

    CompositeTypes: Record<string, never>;
  };
}

export interface Enums {
  app_role: 'CITIZEN' | 'GOVERNMENT' | 'ADMIN';
  issue_status:
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
  issue_severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  issue_priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  issue_visibility: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL';
  location_precision: 'POINT' | 'AREA' | 'JURISDICTION';
  location_visibility: 'EXACT' | 'APPROXIMATE' | 'PRIVATE';
  routing_tier: 'ONBOARDED' | 'CONTACTABLE' | 'UNMAPPED';
  escalation_level: 'LOCAL' | 'WARD' | 'CITY' | 'DISTRICT' | 'STATE' | 'NATIONAL';
  jurisdiction_level: 'STATE' | 'DISTRICT' | 'ULB' | 'ZONE' | 'WARD';
  participant_role:
    | 'OWNER'
    | 'ASSIGNEE'
    | 'CONTRACTOR'
    | 'FIELD_CREW'
    | 'SUPERVISOR'
    | 'REPRESENTATIVE'
    | 'OBSERVER';
  comment_visibility: 'PUBLIC' | 'INTERNAL';
  evidence_type: 'INITIAL_REPORT' | 'PROGRESS' | 'RESOLUTION';
  verification_verdict:
    | 'COMPLETELY_FIXED'
    | 'PARTIALLY_FIXED'
    | 'STILL_EXISTS'
    | 'NEW_PROBLEM';
  moderation_verdict: 'CLEAR' | 'REDACT' | 'HOLD' | 'EMERGENCY' | 'REJECT';
  verification_status: 'VERIFIED' | 'SCRAPED_UNVERIFIED' | 'DRAFT';
  jurisdiction_match_method:
    | 'POLYGON'
    | 'CENTROID_FALLBACK'
    | 'GEOCODE_FALLBACK'
    | 'MANUAL'
    | 'NONE';
  media_type: 'PHOTO' | 'VIDEO' | 'AUDIO' | 'NONE';
  report_source: 'CITIZEN_APP' | 'OFFICER' | 'IMPORT';
  transfer_action: 'received' | 'forwarded' | 'resolved' | 'reopened';
}

// Convenience aliases, mirroring what most Supabase codebases add by hand.
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
export type DbEnum<T extends keyof Enums> = Enums[T];
