export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      agent_runs: {
        Row: {
          agent_name: string
          confidence: number | null
          created_at: string
          error: string | null
          id: number
          input: Json
          issue_id: string | null
          latency_ms: number | null
          model: string
          output: Json | null
          overridden_at: string | null
          overridden_by: string | null
          override_reason: string | null
          prompt_version: string | null
          report_id: string | null
          status: string
          was_overridden: boolean
        }
        Insert: {
          agent_name: string
          confidence?: number | null
          created_at?: string
          error?: string | null
          id?: number
          input: Json
          issue_id?: string | null
          latency_ms?: number | null
          model: string
          output?: Json | null
          overridden_at?: string | null
          overridden_by?: string | null
          override_reason?: string | null
          prompt_version?: string | null
          report_id?: string | null
          status?: string
          was_overridden?: boolean
        }
        Update: {
          agent_name?: string
          confidence?: number | null
          created_at?: string
          error?: string | null
          id?: number
          input?: Json
          issue_id?: string | null
          latency_ms?: number | null
          model?: string
          output?: Json | null
          overridden_at?: string | null
          overridden_by?: string | null
          override_reason?: string | null
          prompt_version?: string | null
          report_id?: string | null
          status?: string
          was_overridden?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_runs_overridden_by_fkey"
            columns: ["overridden_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_runs_overridden_by_fkey"
            columns: ["overridden_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_runs_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      authorities: {
        Row: {
          appellate_email: string | null
          appellate_name: string | null
          authority_type: string | null
          bounce_count: number
          created_at: string
          department_id: number | null
          grievance_email: string | null
          id: number
          is_active: boolean
          jurisdiction_id: number | null
          last_bounce_at: string | null
          last_verified_at: string | null
          level: Database["public"]["Enums"]["jurisdiction_level"] | null
          name: string
          officer_name: string | null
          official_handles: Json | null
          phone: string | null
          source: string
          source_url: string | null
          updated_at: string
          verification_status: Database["public"]["Enums"]["verification_status"]
        }
        Insert: {
          appellate_email?: string | null
          appellate_name?: string | null
          authority_type?: string | null
          bounce_count?: number
          created_at?: string
          department_id?: number | null
          grievance_email?: string | null
          id?: number
          is_active?: boolean
          jurisdiction_id?: number | null
          last_bounce_at?: string | null
          last_verified_at?: string | null
          level?: Database["public"]["Enums"]["jurisdiction_level"] | null
          name: string
          officer_name?: string | null
          official_handles?: Json | null
          phone?: string | null
          source: string
          source_url?: string | null
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Update: {
          appellate_email?: string | null
          appellate_name?: string | null
          authority_type?: string | null
          bounce_count?: number
          created_at?: string
          department_id?: number | null
          grievance_email?: string | null
          id?: number
          is_active?: boolean
          jurisdiction_id?: number | null
          last_bounce_at?: string | null
          last_verified_at?: string | null
          level?: Database["public"]["Enums"]["jurisdiction_level"] | null
          name?: string
          officer_name?: string | null
          official_handles?: Json | null
          phone?: string | null
          source?: string
          source_url?: string | null
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Relationships: [
          {
            foreignKeyName: "authorities_authority_type_fkey"
            columns: ["authority_type"]
            isOneToOne: false
            referencedRelation: "authority_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "authorities_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "authorities_jurisdiction_id_fkey"
            columns: ["jurisdiction_id"]
            isOneToOne: false
            referencedRelation: "jurisdictions"
            referencedColumns: ["id"]
          },
        ]
      }
      authority_types: {
        Row: {
          description: string
          id: string
          level: Database["public"]["Enums"]["jurisdiction_level"] | null
        }
        Insert: {
          description: string
          id: string
          level?: Database["public"]["Enums"]["jurisdiction_level"] | null
        }
        Update: {
          description?: string
          id?: string
          level?: Database["public"]["Enums"]["jurisdiction_level"] | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          cluster_radius_m: number
          default_severity: Database["public"]["Enums"]["issue_severity"]
          id: string
          is_active: boolean
          is_sensitive: boolean
          label: string
          sort_order: number
        }
        Insert: {
          cluster_radius_m?: number
          default_severity?: Database["public"]["Enums"]["issue_severity"]
          id: string
          is_active?: boolean
          is_sensitive?: boolean
          label: string
          sort_order?: number
        }
        Update: {
          cluster_radius_m?: number
          default_severity?: Database["public"]["Enums"]["issue_severity"]
          id?: string
          is_active?: boolean
          is_sensitive?: boolean
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      category_authority_rules: {
        Row: {
          authority_type: string
          category_id: string
          condition: string | null
          seq: number
        }
        Insert: {
          authority_type: string
          category_id: string
          condition?: string | null
          seq: number
        }
        Update: {
          authority_type?: string
          category_id?: string
          condition?: string | null
          seq?: number
        }
        Relationships: [
          {
            foreignKeyName: "category_authority_rules_authority_type_fkey"
            columns: ["authority_type"]
            isOneToOne: false
            referencedRelation: "authority_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_authority_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          content: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          flag_count: number
          hidden_at: string | null
          id: string
          is_hidden: boolean
          is_official: boolean
          is_representative: boolean
          issue_id: string
          parent_id: string | null
          updated_at: string
          user_id: string | null
          visibility: Database["public"]["Enums"]["comment_visibility"]
        }
        Insert: {
          content: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          flag_count?: number
          hidden_at?: string | null
          id?: string
          is_hidden?: boolean
          is_official?: boolean
          is_representative?: boolean
          issue_id: string
          parent_id?: string | null
          updated_at?: string
          user_id?: string | null
          visibility?: Database["public"]["Enums"]["comment_visibility"]
        }
        Update: {
          content?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          flag_count?: number
          hidden_at?: string | null
          id?: string
          is_hidden?: boolean
          is_official?: boolean
          is_representative?: boolean
          issue_id?: string
          parent_id?: string | null
          updated_at?: string
          user_id?: string | null
          visibility?: Database["public"]["Enums"]["comment_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "comments_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          authority_type: string | null
          created_at: string
          description: string | null
          id: number
          is_active: boolean
          jurisdiction_id: number | null
          name: string
          sla_overrides: Json | null
          slug: string
        }
        Insert: {
          authority_type?: string | null
          created_at?: string
          description?: string | null
          id?: number
          is_active?: boolean
          jurisdiction_id?: number | null
          name: string
          sla_overrides?: Json | null
          slug: string
        }
        Update: {
          authority_type?: string | null
          created_at?: string
          description?: string | null
          id?: number
          is_active?: boolean
          jurisdiction_id?: number | null
          name?: string
          sla_overrides?: Json | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_authority_type_fkey"
            columns: ["authority_type"]
            isOneToOne: false
            referencedRelation: "authority_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_jurisdiction_id_fkey"
            columns: ["jurisdiction_id"]
            isOneToOne: false
            referencedRelation: "jurisdictions"
            referencedColumns: ["id"]
          },
        ]
      }
      flags: {
        Row: {
          created_at: string
          detail: string | null
          id: number
          reason: string
          reporter_id: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          detail?: string | null
          id?: number
          reason: string
          reporter_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string
          detail?: string | null
          id?: number
          reason?: string
          reporter_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "flags_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flags_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flags_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flags_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      government_officers: {
        Row: {
          confirmed_at: string | null
          created_at: string
          department_id: number | null
          designation: string | null
          employee_ref: string | null
          id: number
          is_active: boolean
          jurisdiction_id: number
          jurisdiction_level: Database["public"]["Enums"]["jurisdiction_level"]
          last_attested_at: string | null
          max_workload: number
          roster_record_id: number | null
          user_id: string
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          department_id?: number | null
          designation?: string | null
          employee_ref?: string | null
          id?: number
          is_active?: boolean
          jurisdiction_id: number
          jurisdiction_level?: Database["public"]["Enums"]["jurisdiction_level"]
          last_attested_at?: string | null
          max_workload?: number
          roster_record_id?: number | null
          user_id: string
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          department_id?: number | null
          designation?: string | null
          employee_ref?: string | null
          id?: number
          is_active?: boolean
          jurisdiction_id?: number
          jurisdiction_level?: Database["public"]["Enums"]["jurisdiction_level"]
          last_attested_at?: string | null
          max_workload?: number
          roster_record_id?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "government_officers_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "government_officers_jurisdiction_id_fkey"
            columns: ["jurisdiction_id"]
            isOneToOne: false
            referencedRelation: "jurisdictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "government_officers_roster_record_id_fkey"
            columns: ["roster_record_id"]
            isOneToOne: false
            referencedRelation: "officer_roster_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "government_officers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "government_officers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_evidence: {
        Row: {
          caption: string | null
          captured_at: string | null
          created_at: string
          evidence_type: Database["public"]["Enums"]["evidence_type"]
          geotagged: boolean
          id: number
          issue_id: string
          location: unknown
          media_type: Database["public"]["Enums"]["media_type"]
          media_url: string
          report_id: string | null
          uploaded_by: string | null
        }
        Insert: {
          caption?: string | null
          captured_at?: string | null
          created_at?: string
          evidence_type: Database["public"]["Enums"]["evidence_type"]
          geotagged?: boolean
          id?: number
          issue_id: string
          location?: unknown
          media_type?: Database["public"]["Enums"]["media_type"]
          media_url: string
          report_id?: string | null
          uploaded_by?: string | null
        }
        Update: {
          caption?: string | null
          captured_at?: string | null
          created_at?: string
          evidence_type?: Database["public"]["Enums"]["evidence_type"]
          geotagged?: boolean
          id?: number
          issue_id?: string
          location?: unknown
          media_type?: Database["public"]["Enums"]["media_type"]
          media_url?: string
          report_id?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "issue_evidence_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_evidence_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_evidence_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_evidence_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_followers: {
        Row: {
          created_at: string
          issue_id: string
          muted: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          issue_id: string
          muted?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          issue_id?: string
          muted?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_followers_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_followers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_followers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_history: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string
          created_at: string
          id: number
          issue_id: string
          metadata: Json | null
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          id?: number
          issue_id: string
          metadata?: Json | null
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          id?: number
          issue_id?: string
          metadata?: Json | null
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "issue_history_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_history_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_history_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_participants: {
        Row: {
          added_at: string
          added_by: string | null
          expires_at: string | null
          id: number
          is_public: boolean
          issue_id: string
          notify: boolean
          org_id: number | null
          reason: string | null
          removed_at: string | null
          role: Database["public"]["Enums"]["participant_role"]
          user_id: string | null
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          expires_at?: string | null
          id?: number
          is_public?: boolean
          issue_id: string
          notify?: boolean
          org_id?: number | null
          reason?: string | null
          removed_at?: string | null
          role: Database["public"]["Enums"]["participant_role"]
          user_id?: string | null
        }
        Update: {
          added_at?: string
          added_by?: string | null
          expires_at?: string | null
          id?: number
          is_public?: boolean
          issue_id?: string
          notify?: boolean
          org_id?: number | null
          reason?: string | null
          removed_at?: string | null
          role?: Database["public"]["Enums"]["participant_role"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "issue_participants_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_participants_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_participants_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_participants_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_reactions: {
        Row: {
          created_at: string
          issue_id: string
          reaction_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          issue_id: string
          reaction_type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          issue_id?: string
          reaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_reactions_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_transfers: {
        Row: {
          action: Database["public"]["Enums"]["transfer_action"]
          actor_id: string | null
          created_at: string
          from_authority: number | null
          from_department: number | null
          id: number
          is_manual: boolean
          issue_id: string
          reason: string | null
          seq: number
          to_authority: number | null
          to_department: number | null
        }
        Insert: {
          action: Database["public"]["Enums"]["transfer_action"]
          actor_id?: string | null
          created_at?: string
          from_authority?: number | null
          from_department?: number | null
          id?: number
          is_manual?: boolean
          issue_id: string
          reason?: string | null
          seq: number
          to_authority?: number | null
          to_department?: number | null
        }
        Update: {
          action?: Database["public"]["Enums"]["transfer_action"]
          actor_id?: string | null
          created_at?: string
          from_authority?: number | null
          from_department?: number | null
          id?: number
          is_manual?: boolean
          issue_id?: string
          reason?: string | null
          seq?: number
          to_authority?: number | null
          to_department?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "issue_transfers_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_transfers_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_transfers_from_authority_fkey"
            columns: ["from_authority"]
            isOneToOne: false
            referencedRelation: "authorities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_transfers_from_department_fkey"
            columns: ["from_department"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_transfers_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_transfers_to_authority_fkey"
            columns: ["to_authority"]
            isOneToOne: false
            referencedRelation: "authorities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_transfers_to_department_fkey"
            columns: ["to_department"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      issues: {
        Row: {
          acknowledged_at: string | null
          address: string | null
          authority_id: number | null
          category_id: string | null
          civic_pressure: number
          closed_at: string | null
          created_at: string
          created_by: string | null
          department_id: number | null
          description: string | null
          escalation_level: Database["public"]["Enums"]["escalation_level"]
          estimated_people_affected: number | null
          follower_count: number
          id: string
          jurisdiction_id: number | null
          jurisdiction_match_method: Database["public"]["Enums"]["jurisdiction_match_method"]
          location: unknown
          location_precision: Database["public"]["Enums"]["location_precision"]
          location_visibility: Database["public"]["Enums"]["location_visibility"]
          merged_into_id: string | null
          moderation_reviewed_at: string | null
          moderation_reviewed_by: string | null
          moderation_verdict:
            | Database["public"]["Enums"]["moderation_verdict"]
            | null
          owner_officer_id: number | null
          priority: Database["public"]["Enums"]["issue_priority"]
          public_id: string
          published_at: string | null
          rejection_reason: string | null
          report_count: number
          resolved_at: string | null
          routing_tier: Database["public"]["Enums"]["routing_tier"]
          satisfaction_score: number | null
          severity: Database["public"]["Enums"]["issue_severity"]
          sla_ack_due_at: string | null
          sla_due_at: string | null
          status: Database["public"]["Enums"]["issue_status"]
          subcategory: string | null
          title: string | null
          updated_at: string
          visibility: Database["public"]["Enums"]["issue_visibility"]
        }
        Insert: {
          acknowledged_at?: string | null
          address?: string | null
          authority_id?: number | null
          category_id?: string | null
          civic_pressure?: number
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: number | null
          description?: string | null
          escalation_level?: Database["public"]["Enums"]["escalation_level"]
          estimated_people_affected?: number | null
          follower_count?: number
          id?: string
          jurisdiction_id?: number | null
          jurisdiction_match_method?: Database["public"]["Enums"]["jurisdiction_match_method"]
          location: unknown
          location_precision?: Database["public"]["Enums"]["location_precision"]
          location_visibility?: Database["public"]["Enums"]["location_visibility"]
          merged_into_id?: string | null
          moderation_reviewed_at?: string | null
          moderation_reviewed_by?: string | null
          moderation_verdict?:
            | Database["public"]["Enums"]["moderation_verdict"]
            | null
          owner_officer_id?: number | null
          priority?: Database["public"]["Enums"]["issue_priority"]
          public_id?: string
          published_at?: string | null
          rejection_reason?: string | null
          report_count?: number
          resolved_at?: string | null
          routing_tier?: Database["public"]["Enums"]["routing_tier"]
          satisfaction_score?: number | null
          severity?: Database["public"]["Enums"]["issue_severity"]
          sla_ack_due_at?: string | null
          sla_due_at?: string | null
          status?: Database["public"]["Enums"]["issue_status"]
          subcategory?: string | null
          title?: string | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["issue_visibility"]
        }
        Update: {
          acknowledged_at?: string | null
          address?: string | null
          authority_id?: number | null
          category_id?: string | null
          civic_pressure?: number
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: number | null
          description?: string | null
          escalation_level?: Database["public"]["Enums"]["escalation_level"]
          estimated_people_affected?: number | null
          follower_count?: number
          id?: string
          jurisdiction_id?: number | null
          jurisdiction_match_method?: Database["public"]["Enums"]["jurisdiction_match_method"]
          location?: unknown
          location_precision?: Database["public"]["Enums"]["location_precision"]
          location_visibility?: Database["public"]["Enums"]["location_visibility"]
          merged_into_id?: string | null
          moderation_reviewed_at?: string | null
          moderation_reviewed_by?: string | null
          moderation_verdict?:
            | Database["public"]["Enums"]["moderation_verdict"]
            | null
          owner_officer_id?: number | null
          priority?: Database["public"]["Enums"]["issue_priority"]
          public_id?: string
          published_at?: string | null
          rejection_reason?: string | null
          report_count?: number
          resolved_at?: string | null
          routing_tier?: Database["public"]["Enums"]["routing_tier"]
          satisfaction_score?: number | null
          severity?: Database["public"]["Enums"]["issue_severity"]
          sla_ack_due_at?: string | null
          sla_due_at?: string | null
          status?: Database["public"]["Enums"]["issue_status"]
          subcategory?: string | null
          title?: string | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["issue_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "issues_authority_id_fkey"
            columns: ["authority_id"]
            isOneToOne: false
            referencedRelation: "authorities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_jurisdiction_id_fkey"
            columns: ["jurisdiction_id"]
            isOneToOne: false
            referencedRelation: "jurisdictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_merged_into_id_fkey"
            columns: ["merged_into_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_moderation_reviewed_by_fkey"
            columns: ["moderation_reviewed_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_moderation_reviewed_by_fkey"
            columns: ["moderation_reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_owner_officer_id_fkey"
            columns: ["owner_officer_id"]
            isOneToOne: false
            referencedRelation: "government_officers"
            referencedColumns: ["id"]
          },
        ]
      }
      jurisdictions: {
        Row: {
          body_type: string | null
          centroid: unknown
          created_at: string
          district_code: number | null
          geometry: unknown
          id: number
          level: Database["public"]["Enums"]["jurisdiction_level"]
          lgd_code: string | null
          name: string
          name_local: string | null
          parent_id: number | null
          source: string
          state_code: number | null
          updated_at: string
        }
        Insert: {
          body_type?: string | null
          centroid?: unknown
          created_at?: string
          district_code?: number | null
          geometry?: unknown
          id?: number
          level: Database["public"]["Enums"]["jurisdiction_level"]
          lgd_code?: string | null
          name: string
          name_local?: string | null
          parent_id?: number | null
          source: string
          state_code?: number | null
          updated_at?: string
        }
        Update: {
          body_type?: string | null
          centroid?: unknown
          created_at?: string
          district_code?: number | null
          geometry?: unknown
          id?: number
          level?: Database["public"]["Enums"]["jurisdiction_level"]
          lgd_code?: string | null
          name?: string
          name_local?: string | null
          parent_id?: number | null
          source?: string
          state_code?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jurisdictions_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "jurisdictions"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          channel: string
          created_at: string
          error: string | null
          failed_at: string | null
          id: number
          is_read: boolean
          issue_id: string | null
          read_at: string | null
          sent_at: string | null
          title: string
          type: string
          url: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          channel?: string
          created_at?: string
          error?: string | null
          failed_at?: string | null
          id?: number
          is_read?: boolean
          issue_id?: string | null
          read_at?: string | null
          sent_at?: string | null
          title: string
          type: string
          url?: string | null
          user_id: string
        }
        Update: {
          body?: string | null
          channel?: string
          created_at?: string
          error?: string | null
          failed_at?: string | null
          id?: number
          is_read?: boolean
          issue_id?: string | null
          read_at?: string | null
          sent_at?: string | null
          title?: string
          type?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      officer_roster_records: {
        Row: {
          confirmed_at: string | null
          created_at: string
          deactivated_at: string | null
          department_id: number | null
          department_ref: string | null
          designation: string | null
          email: string | null
          employee_ref: string | null
          id: number
          jurisdiction_id: number | null
          jurisdiction_lvl:
            | Database["public"]["Enums"]["jurisdiction_level"]
            | null
          jurisdiction_ref: string | null
          match_status: string
          matched_user_id: string | null
          name: string | null
          phone: string | null
          source_batch_id: string
          source_url: string | null
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          deactivated_at?: string | null
          department_id?: number | null
          department_ref?: string | null
          designation?: string | null
          email?: string | null
          employee_ref?: string | null
          id?: number
          jurisdiction_id?: number | null
          jurisdiction_lvl?:
            | Database["public"]["Enums"]["jurisdiction_level"]
            | null
          jurisdiction_ref?: string | null
          match_status?: string
          matched_user_id?: string | null
          name?: string | null
          phone?: string | null
          source_batch_id: string
          source_url?: string | null
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          deactivated_at?: string | null
          department_id?: number | null
          department_ref?: string | null
          designation?: string | null
          email?: string | null
          employee_ref?: string | null
          id?: number
          jurisdiction_id?: number | null
          jurisdiction_lvl?:
            | Database["public"]["Enums"]["jurisdiction_level"]
            | null
          jurisdiction_ref?: string | null
          match_status?: string
          matched_user_id?: string | null
          name?: string | null
          phone?: string | null
          source_batch_id?: string
          source_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "officer_roster_records_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "officer_roster_records_jurisdiction_id_fkey"
            columns: ["jurisdiction_id"]
            isOneToOne: false
            referencedRelation: "jurisdictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "officer_roster_records_matched_user_id_fkey"
            columns: ["matched_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "officer_roster_records_matched_user_id_fkey"
            columns: ["matched_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      organisations: {
        Row: {
          contact_email: string | null
          created_at: string
          id: number
          is_active: boolean
          name: string
          phone: string | null
          type: string | null
        }
        Insert: {
          contact_email?: string | null
          created_at?: string
          id?: number
          is_active?: boolean
          name: string
          phone?: string | null
          type?: string | null
        }
        Update: {
          contact_email?: string | null
          created_at?: string
          id?: number
          is_active?: boolean
          name?: string
          phone?: string | null
          type?: string | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          action: string
          count: number
          scope: string
          user_id: string
          window_start: string
        }
        Insert: {
          action: string
          count?: number
          scope?: string
          user_id: string
          window_start: string
        }
        Update: {
          action?: string
          count?: number
          scope?: string
          user_id?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_limits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_limits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          audio_url: string | null
          client_report_id: string | null
          created_at: string
          description: string | null
          embedding: string | null
          id: string
          is_anonymous: boolean
          is_facing_too: boolean
          issue_id: string
          location: unknown
          media_type: Database["public"]["Enums"]["media_type"]
          media_url: string | null
          source: Database["public"]["Enums"]["report_source"]
          transcript: string | null
          user_id: string | null
        }
        Insert: {
          audio_url?: string | null
          client_report_id?: string | null
          created_at?: string
          description?: string | null
          embedding?: string | null
          id?: string
          is_anonymous?: boolean
          is_facing_too?: boolean
          issue_id: string
          location: unknown
          media_type?: Database["public"]["Enums"]["media_type"]
          media_url?: string | null
          source?: Database["public"]["Enums"]["report_source"]
          transcript?: string | null
          user_id?: string | null
        }
        Update: {
          audio_url?: string | null
          client_report_id?: string | null
          created_at?: string
          description?: string | null
          embedding?: string | null
          id?: string
          is_anonymous?: boolean
          is_facing_too?: boolean
          issue_id?: string
          location?: unknown
          media_type?: Database["public"]["Enums"]["media_type"]
          media_url?: string | null
          source?: Database["public"]["Enums"]["report_source"]
          transcript?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      resolution_submissions: {
        Row: {
          action_taken: string
          attempt: number
          authority_id: number | null
          cost_incurred: number | null
          created_at: string
          department_id: number | null
          documents: Json | null
          eligible_count: number | null
          id: string
          intent: string | null
          issue_id: string
          outcome: string | null
          quorum_target: number
          resolution_gps_distance_m: number | null
          resolution_photo_url: string | null
          satisfaction_score: number | null
          submitted_at: string
          submitted_by: string | null
          verification_closed_at: string | null
          verification_opened_at: string | null
        }
        Insert: {
          action_taken: string
          attempt?: number
          authority_id?: number | null
          cost_incurred?: number | null
          created_at?: string
          department_id?: number | null
          documents?: Json | null
          eligible_count?: number | null
          id?: string
          intent?: string | null
          issue_id: string
          outcome?: string | null
          quorum_target?: number
          resolution_gps_distance_m?: number | null
          resolution_photo_url?: string | null
          satisfaction_score?: number | null
          submitted_at?: string
          submitted_by?: string | null
          verification_closed_at?: string | null
          verification_opened_at?: string | null
        }
        Update: {
          action_taken?: string
          attempt?: number
          authority_id?: number | null
          cost_incurred?: number | null
          created_at?: string
          department_id?: number | null
          documents?: Json | null
          eligible_count?: number | null
          id?: string
          intent?: string | null
          issue_id?: string
          outcome?: string | null
          quorum_target?: number
          resolution_gps_distance_m?: number | null
          resolution_photo_url?: string | null
          satisfaction_score?: number | null
          submitted_at?: string
          submitted_by?: string | null
          verification_closed_at?: string | null
          verification_opened_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resolution_submissions_authority_id_fkey"
            columns: ["authority_id"]
            isOneToOne: false
            referencedRelation: "authorities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resolution_submissions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resolution_submissions_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resolution_submissions_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resolution_submissions_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      role_grants_log: {
        Row: {
          created_at: string
          granted_by: string | null
          granted_role: Database["public"]["Enums"]["app_role"]
          id: number
          match_method: string
          officer_id: number | null
          roster_record_id: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          granted_role: Database["public"]["Enums"]["app_role"]
          id?: number
          match_method: string
          officer_id?: number | null
          roster_record_id?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          granted_role?: Database["public"]["Enums"]["app_role"]
          id?: number
          match_method?: string
          officer_id?: number | null
          roster_record_id?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_grants_log_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_grants_log_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_grants_log_officer_id_fkey"
            columns: ["officer_id"]
            isOneToOne: false
            referencedRelation: "government_officers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_grants_log_roster_record_id_fkey"
            columns: ["roster_record_id"]
            isOneToOne: false
            referencedRelation: "officer_roster_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_grants_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_grants_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          full_name: string | null
          home_jurisdiction_id: number | null
          id: string
          identity_tier: string
          is_suspended: boolean
          language: string
          phone: string | null
          phone_verified_at: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          verification_ref: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          home_jurisdiction_id?: number | null
          id: string
          identity_tier?: string
          is_suspended?: boolean
          language?: string
          phone?: string | null
          phone_verified_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          verification_ref?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          home_jurisdiction_id?: number | null
          id?: string
          identity_tier?: string
          is_suspended?: boolean
          language?: string
          phone?: string | null
          phone_verified_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          verification_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_home_jurisdiction_id_fkey"
            columns: ["home_jurisdiction_id"]
            isOneToOne: false
            referencedRelation: "jurisdictions"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_responses: {
        Row: {
          comment: string | null
          created_at: string
          distance_m: number | null
          id: string
          is_reporter: boolean
          issue_id: string
          media_url: string | null
          resolution_submission_id: string
          user_id: string
          verdict: Database["public"]["Enums"]["verification_verdict"]
          weight: number
        }
        Insert: {
          comment?: string | null
          created_at?: string
          distance_m?: number | null
          id?: string
          is_reporter?: boolean
          issue_id: string
          media_url?: string | null
          resolution_submission_id: string
          user_id: string
          verdict: Database["public"]["Enums"]["verification_verdict"]
          weight?: number
        }
        Update: {
          comment?: string | null
          created_at?: string
          distance_m?: number | null
          id?: string
          is_reporter?: boolean
          issue_id?: string
          media_url?: string | null
          resolution_submission_id?: string
          user_id?: string
          verdict?: Database["public"]["Enums"]["verification_verdict"]
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "verification_responses_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_responses_resolution_submission_id_fkey"
            columns: ["resolution_submission_id"]
            isOneToOne: false
            referencedRelation: "resolution_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_responses_submission_issue_fk"
            columns: ["resolution_submission_id", "issue_id"]
            isOneToOne: false
            referencedRelation: "resolution_submissions"
            referencedColumns: ["id", "issue_id"]
          },
          {
            foreignKeyName: "verification_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
      public_profiles: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          id: string | null
        }
        Insert: {
          avatar_url?: string | null
          display_name?: string | null
          id?: string | null
        }
        Update: {
          avatar_url?: string | null
          display_name?: string | null
          id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      account_age_days: { Args: { p_user: string }; Returns: number }
      acting_user_id: { Args: never; Returns: string }
      add_citizen_issue_report: {
        Args: { p_client_report_id: string; p_public_id: string }
        Returns: {
          inserted: boolean
          report_count: number
        }[]
      }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      can_view_issue: { Args: { p_issue: string }; Returns: boolean }
      can_view_issue_detail: { Args: { p_issue: string }; Returns: boolean }
      check_rate_limit: {
        Args: {
          p_action: string
          p_limit: number
          p_scope?: string
          p_user: string
          p_window?: string
        }
        Returns: boolean
      }
      citizen_issue_state: {
        Args: { p_public_id: string }
        Returns: {
          has_reported: boolean
          is_following: boolean
        }[]
      }
      citizen_my_issue_ids: {
        Args: never
        Returns: {
          issue_id: string
          relation: string
        }[]
      }
      compute_civic_pressure: { Args: { p_issue_id: string }; Returns: number }
      compute_satisfaction: { Args: { p_issue_id: string }; Returns: number }
      create_citizen_comment: {
        Args: { p_content: string; p_public_id: string }
        Returns: string
      }
      current_app_role: { Args: never; Returns: string }
      current_dept_id: { Args: never; Returns: number }
      current_juris_id: { Args: never; Returns: number }
      current_juris_level: {
        Args: never
        Returns: Database["public"]["Enums"]["jurisdiction_level"]
      }
      custom_access_token: { Args: { event: Json }; Returns: Json }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      enablelongtransactions: { Args: never; Returns: string }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      feed_rank: {
        Args: {
          i: Database["public"]["Tables"]["issues"]["Row"]
          p_lat: number
          p_lng: number
          w1?: number
          w2?: number
          w3?: number
          w4?: number
          w5?: number
          w6?: number
        }
        Returns: number
      }
      generate_public_id: { Args: never; Returns: string }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      gettransactionid: { Args: never; Returns: unknown }
      gov_can_operate_issue: { Args: { p_issue: string }; Returns: boolean }
      gov_issue_detail: { Args: { p_public_id: string }; Returns: Json }
      gov_owns_issue: { Args: { p_issue: string }; Returns: boolean }
      gov_post_public_reply: {
        Args: { p_content: string; p_public_id: string }
        Returns: string
      }
      gov_queue: { Args: never; Returns: Json }
      gov_scope_covers: { Args: { p_juris: number }; Returns: boolean }
      gov_scope_covers_department: {
        Args: { p_department: number; p_juris: number }
        Returns: boolean
      }
      gov_start_issue: {
        Args: { p_public_id: string }
        Returns: Database["public"]["Enums"]["issue_status"]
      }
      gov_submit_resolution: {
        Args: {
          p_action_taken: string
          p_intent?: string
          p_photo_url?: string
          p_public_id: string
        }
        Returns: string
      }
      in_gov_scope: { Args: { p_juris: number }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_gov: { Args: never; Returns: boolean }
      is_issue_follower: { Args: { p_issue: string }; Returns: boolean }
      is_issue_participant: { Args: { p_issue: string }; Returns: boolean }
      is_issue_reporter: { Args: { p_issue: string }; Returns: boolean }
      jurisdiction_ancestors: {
        Args: { p_id: number }
        Returns: {
          depth: number
          id: number
          level: Database["public"]["Enums"]["jurisdiction_level"]
          name: string
        }[]
      }
      jurisdiction_descendants: {
        Args: { p_id: number }
        Returns: {
          id: number
        }[]
      }
      log_issue_event: {
        Args: {
          p_action: string
          p_issue: string
          p_meta?: Json
          p_new: string
          p_old: string
        }
        Returns: undefined
      }
      longtransactionsenabled: { Args: never; Returns: boolean }
      officer_claim_candidate: {
        Args: { p_user_id: string }
        Returns: {
          department_id: number
          designation: string
          jurisdiction_id: number
          name: string
          roster_record_id: number
          signal: string
        }[]
      }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      resolve_authority: {
        Args: { p_category: string; p_lat: number; p_lng: number }
        Returns: {
          authority_id: number
          department_id: number
          jurisdiction_id: number
          method: Database["public"]["Enums"]["jurisdiction_match_method"]
          tier: Database["public"]["Enums"]["routing_tier"]
        }[]
      }
      resolve_jurisdiction: {
        Args: { p_lat: number; p_lng: number }
        Returns: {
          jurisdiction_id: number
          method: Database["public"]["Enums"]["jurisdiction_match_method"]
        }[]
      }
      set_citizen_issue_following: {
        Args: { p_following: boolean; p_public_id: string }
        Returns: {
          follower_count: number
          is_following: boolean
        }[]
      }
      severity_weight: {
        Args: { p_sev: Database["public"]["Enums"]["issue_severity"] }
        Returns: number
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      sla_targets: {
        Args: {
          p_department?: number
          p_priority: Database["public"]["Enums"]["issue_priority"]
        }
        Returns: {
          ack_interval: string
          resolve_interval: string
        }[]
      }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      submit_citizen_report: {
        Args: {
          p_category_id?: string
          p_client_report_id: string
          p_description: string
          p_is_anonymous?: boolean
          p_lat: number
          p_lng: number
          p_location_precision?: Database["public"]["Enums"]["location_precision"]
          p_location_visibility?: Database["public"]["Enums"]["location_visibility"]
          p_title?: string
        }
        Returns: {
          issue_id: string
          jurisdiction_id: number
          jurisdiction_match_method: Database["public"]["Enums"]["jurisdiction_match_method"]
          public_id: string
          published_at: string
          report_id: string
          routing_tier: Database["public"]["Enums"]["routing_tier"]
          title: string
        }[]
      }
      unlockrows: { Args: { "": string }; Returns: number }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
      verification_breakdown: {
        Args: { p_issue_id: string }
        Returns: {
          pct: number
          responses: number
          verdict: Database["public"]["Enums"]["verification_verdict"]
        }[]
      }
    }
    Enums: {
      app_role: "CITIZEN" | "GOVERNMENT" | "ADMIN"
      comment_visibility: "PUBLIC" | "INTERNAL"
      escalation_level:
        | "LOCAL"
        | "WARD"
        | "CITY"
        | "DISTRICT"
        | "STATE"
        | "NATIONAL"
      evidence_type: "INITIAL_REPORT" | "PROGRESS" | "RESOLUTION"
      issue_priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
      issue_severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
      issue_status:
        | "OPEN"
        | "ASSIGNED"
        | "ACKNOWLEDGED"
        | "IN_PROGRESS"
        | "HELD"
        | "RESOLUTION_SUBMITTED"
        | "AWAITING_VERIFICATION"
        | "RESOLVED"
        | "CLOSED"
        | "REOPENED"
        | "REJECTED"
        | "MERGED"
      issue_visibility: "PUBLIC" | "RESTRICTED" | "CONFIDENTIAL"
      jurisdiction_level: "STATE" | "DISTRICT" | "ULB" | "ZONE" | "WARD"
      jurisdiction_match_method:
        | "POLYGON"
        | "CENTROID_FALLBACK"
        | "GEOCODE_FALLBACK"
        | "MANUAL"
        | "NONE"
      location_precision: "POINT" | "AREA" | "JURISDICTION"
      location_visibility: "EXACT" | "APPROXIMATE" | "PRIVATE"
      media_type: "PHOTO" | "VIDEO" | "AUDIO" | "NONE"
      moderation_verdict: "CLEAR" | "REDACT" | "HOLD" | "EMERGENCY" | "REJECT"
      participant_role:
        | "OWNER"
        | "ASSIGNEE"
        | "CONTRACTOR"
        | "FIELD_CREW"
        | "SUPERVISOR"
        | "REPRESENTATIVE"
        | "OBSERVER"
      report_source: "CITIZEN_APP" | "OFFICER" | "IMPORT"
      routing_tier: "ONBOARDED" | "CONTACTABLE" | "UNMAPPED"
      transfer_action: "received" | "forwarded" | "resolved" | "reopened"
      verification_status: "VERIFIED" | "SCRAPED_UNVERIFIED" | "DRAFT"
      verification_verdict:
        | "COMPLETELY_FIXED"
        | "PARTIALLY_FIXED"
        | "STILL_EXISTS"
        | "NEW_PROBLEM"
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["CITIZEN", "GOVERNMENT", "ADMIN"],
      comment_visibility: ["PUBLIC", "INTERNAL"],
      escalation_level: [
        "LOCAL",
        "WARD",
        "CITY",
        "DISTRICT",
        "STATE",
        "NATIONAL",
      ],
      evidence_type: ["INITIAL_REPORT", "PROGRESS", "RESOLUTION"],
      issue_priority: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      issue_severity: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      issue_status: [
        "OPEN",
        "ASSIGNED",
        "ACKNOWLEDGED",
        "IN_PROGRESS",
        "HELD",
        "RESOLUTION_SUBMITTED",
        "AWAITING_VERIFICATION",
        "RESOLVED",
        "CLOSED",
        "REOPENED",
        "REJECTED",
        "MERGED",
      ],
      issue_visibility: ["PUBLIC", "RESTRICTED", "CONFIDENTIAL"],
      jurisdiction_level: ["STATE", "DISTRICT", "ULB", "ZONE", "WARD"],
      jurisdiction_match_method: [
        "POLYGON",
        "CENTROID_FALLBACK",
        "GEOCODE_FALLBACK",
        "MANUAL",
        "NONE",
      ],
      location_precision: ["POINT", "AREA", "JURISDICTION"],
      location_visibility: ["EXACT", "APPROXIMATE", "PRIVATE"],
      media_type: ["PHOTO", "VIDEO", "AUDIO", "NONE"],
      moderation_verdict: ["CLEAR", "REDACT", "HOLD", "EMERGENCY", "REJECT"],
      participant_role: [
        "OWNER",
        "ASSIGNEE",
        "CONTRACTOR",
        "FIELD_CREW",
        "SUPERVISOR",
        "REPRESENTATIVE",
        "OBSERVER",
      ],
      report_source: ["CITIZEN_APP", "OFFICER", "IMPORT"],
      routing_tier: ["ONBOARDED", "CONTACTABLE", "UNMAPPED"],
      transfer_action: ["received", "forwarded", "resolved", "reopened"],
      verification_status: ["VERIFIED", "SCRAPED_UNVERIFIED", "DRAFT"],
      verification_verdict: [
        "COMPLETELY_FIXED",
        "PARTIALLY_FIXED",
        "STILL_EXISTS",
        "NEW_PROBLEM",
      ],
    },
  },
} as const
