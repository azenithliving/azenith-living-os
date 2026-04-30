/**
 * Supabase Database Types
 * 
 * Type definitions for all database tables including new agent execution tables.
 * This file provides TypeScript type safety for database operations.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      // ============================================
      // Agent Execution Tables
      // ============================================
      agent_executions: {
        Row: {
          id: string;
          company_id: string | null;
          actor_user_id: string | null;
          command_log_id: string | null;
          suggestion_id: string | null;
          execution_type: string;
          execution_data: Json;
          execution_result: Json | null;
          execution_status: string;
          started_at: string;
          completed_at: string | null;
          execution_time_ms: number | null;
          error_message: string | null;
          error_stack: string | null;
          affected_rows: number;
          affected_tables: string[] | null;
          rollback_available: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id?: string | null;
          actor_user_id?: string | null;
          command_log_id?: string | null;
          suggestion_id?: string | null;
          execution_type: string;
          execution_data?: Json;
          execution_result?: Json | null;
          execution_status?: string;
          started_at?: string;
          completed_at?: string | null;
          execution_time_ms?: number | null;
          error_message?: string | null;
          error_stack?: string | null;
          affected_rows?: number;
          affected_tables?: string[] | null;
          rollback_available?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string | null;
          actor_user_id?: string | null;
          command_log_id?: string | null;
          suggestion_id?: string | null;
          execution_type?: string;
          execution_data?: Json;
          execution_result?: Json | null;
          execution_status?: string;
          started_at?: string;
          completed_at?: string | null;
          execution_time_ms?: number | null;
          error_message?: string | null;
          error_stack?: string | null;
          affected_rows?: number;
          affected_tables?: string[] | null;
          rollback_available?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };

      seo_analysis_results: {
        Row: {
          id: string;
          execution_id: string;
          company_id: string | null;
          page_url: string;
          page_title: string | null;
          score: number | null;
          score_breakdown: Json | null;
          meta_tags: Json | null;
          meta_issues: Json[] | null;
          headings_structure: Json | null;
          headings_issues: Json[] | null;
          images_analysis: Json | null;
          images_issues: Json[] | null;
          links_analysis: Json | null;
          links_issues: Json[] | null;
          performance_metrics: Json | null;
          performance_issues: Json[] | null;
          recommendations: Json[] | null;
          raw_html_snapshot: string | null;
          analysis_status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          execution_id: string;
          company_id?: string | null;
          page_url: string;
          page_title?: string | null;
          score?: number | null;
          score_breakdown?: Json | null;
          meta_tags?: Json | null;
          meta_issues?: Json[] | null;
          headings_structure?: Json | null;
          headings_issues?: Json[] | null;
          images_analysis?: Json | null;
          images_issues?: Json[] | null;
          links_analysis?: Json | null;
          links_issues?: Json[] | null;
          performance_metrics?: Json | null;
          performance_issues?: Json[] | null;
          recommendations?: Json[] | null;
          raw_html_snapshot?: string | null;
          analysis_status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          execution_id?: string;
          company_id?: string | null;
          page_url?: string;
          page_title?: string | null;
          score?: number | null;
          score_breakdown?: Json | null;
          meta_tags?: Json | null;
          meta_issues?: Json[] | null;
          headings_structure?: Json | null;
          headings_issues?: Json[] | null;
          images_analysis?: Json | null;
          images_issues?: Json[] | null;
          links_analysis?: Json | null;
          links_issues?: Json[] | null;
          performance_metrics?: Json | null;
          performance_issues?: Json[] | null;
          recommendations?: Json[] | null;
          raw_html_snapshot?: string | null;
          analysis_status?: string;
          created_at?: string;
          updated_at?: string;
        };
      };

      content_revisions: {
        Row: {
          id: string;
          execution_id: string | null;
          company_id: string | null;
          actor_user_id: string | null;
          table_name: string;
          record_id: string;
          field_name: string;
          old_value: Json | null;
          new_value: Json | null;
          change_diff: string | null;
          change_reason: string | null;
          change_category: string;
          revision_status: string;
          approved_by: string | null;
          approved_at: string | null;
          approval_notes: string | null;
          applied_at: string | null;
          applied_by: string | null;
          rolled_back_at: string | null;
          rolled_back_by: string | null;
          rollback_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          execution_id?: string | null;
          company_id?: string | null;
          actor_user_id?: string | null;
          table_name: string;
          record_id: string;
          field_name: string;
          old_value?: Json | null;
          new_value?: Json | null;
          change_diff?: string | null;
          change_reason?: string | null;
          change_category: string;
          revision_status?: string;
          approved_by?: string | null;
          approved_at?: string | null;
          approval_notes?: string | null;
          applied_at?: string | null;
          applied_by?: string | null;
          rolled_back_at?: string | null;
          rolled_back_by?: string | null;
          rollback_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          execution_id?: string | null;
          company_id?: string | null;
          actor_user_id?: string | null;
          table_name?: string;
          record_id?: string;
          field_name?: string;
          old_value?: Json | null;
          new_value?: Json | null;
          change_diff?: string | null;
          change_reason?: string | null;
          change_category?: string;
          revision_status?: string;
          approved_by?: string | null;
          approved_at?: string | null;
          approval_notes?: string | null;
          applied_at?: string | null;
          applied_by?: string | null;
          rolled_back_at?: string | null;
          rolled_back_by?: string | null;
          rollback_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      site_sections: {
        Row: {
          id: string;
          execution_id: string | null;
          company_id: string | null;
          created_by: string | null;
          section_type: string;
          section_name: string;
          section_slug: string | null;
          section_config: Json;
          section_content: Json;
          section_schema: Json | null;
          page_placement: string | null;
          placement_position: string | null;
          sort_order: number;
          is_active: boolean;
          is_visible: boolean;
          visibility_conditions: Json | null;
          custom_css: string | null;
          custom_classes: string[] | null;
          render_metrics: Json | null;
          created_at: string;
          updated_at: string;
          last_published_at: string | null;
        };
        Insert: {
          id?: string;
          execution_id?: string | null;
          company_id?: string | null;
          created_by?: string | null;
          section_type: string;
          section_name: string;
          section_slug?: string | null;
          section_config?: Json;
          section_content?: Json;
          section_schema?: Json | null;
          page_placement?: string | null;
          placement_position?: string | null;
          sort_order?: number;
          is_active?: boolean;
          is_visible?: boolean;
          visibility_conditions?: Json | null;
          custom_css?: string | null;
          custom_classes?: string[] | null;
          render_metrics?: Json | null;
          created_at?: string;
          updated_at?: string;
          last_published_at?: string | null;
        };
        Update: {
          id?: string;
          execution_id?: string | null;
          company_id?: string | null;
          created_by?: string | null;
          section_type?: string;
          section_name?: string;
          section_slug?: string | null;
          section_config?: Json;
          section_content?: Json;
          section_schema?: Json | null;
          page_placement?: string | null;
          placement_position?: string | null;
          sort_order?: number;
          is_active?: boolean;
          is_visible?: boolean;
          visibility_conditions?: Json | null;
          custom_css?: string | null;
          custom_classes?: string[] | null;
          render_metrics?: Json | null;
          created_at?: string;
          updated_at?: string;
          last_published_at?: string | null;
        };
      };

      backup_snapshots: {
        Row: {
          id: string;
          execution_id: string | null;
          company_id: string | null;
          created_by: string | null;
          backup_type: string;
          backup_name: string;
          backup_description: string | null;
          storage_provider: string;
          storage_url: string;
          storage_path: string | null;
          size_bytes: number;
          size_compressed_bytes: number | null;
          compression_ratio: number | null;
          tables_backed_up: Json | null;
          files_backed_up: Json | null;
          checksum: string | null;
          checksum_algorithm: string;
          integrity_verified: boolean;
          integrity_verified_at: string | null;
          backup_scope: Json | null;
          retention_days: number;
          expires_at: string;
          backup_status: string;
          restored_at: string | null;
          restored_by: string | null;
          restoration_result: Json | null;
          created_at: string;
          updated_at: string;
          completed_at: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          execution_id?: string | null;
          company_id?: string | null;
          created_by?: string | null;
          backup_type: string;
          backup_name: string;
          backup_description?: string | null;
          storage_provider?: string;
          storage_url: string;
          storage_path?: string | null;
          size_bytes: number;
          size_compressed_bytes?: number | null;
          compression_ratio?: number | null;
          tables_backed_up?: Json | null;
          files_backed_up?: Json | null;
          checksum?: string | null;
          checksum_algorithm?: string;
          integrity_verified?: boolean;
          integrity_verified_at?: string | null;
          backup_scope?: Json | null;
          retention_days?: number;
          expires_at: string;
          backup_status?: string;
          restored_at?: string | null;
          restored_by?: string | null;
          restoration_result?: Json | null;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          execution_id?: string | null;
          company_id?: string | null;
          created_by?: string | null;
          backup_type?: string;
          backup_name?: string;
          backup_description?: string | null;
          storage_provider?: string;
          storage_url?: string;
          storage_path?: string | null;
          size_bytes?: number;
          size_compressed_bytes?: number | null;
          compression_ratio?: number | null;
          tables_backed_up?: Json | null;
          files_backed_up?: Json | null;
          checksum?: string | null;
          checksum_algorithm?: string;
          integrity_verified?: boolean;
          integrity_verified_at?: string | null;
          backup_scope?: Json | null;
          retention_days?: number;
          expires_at?: string;
          backup_status?: string;
          restored_at?: string | null;
          restored_by?: string | null;
          restoration_result?: Json | null;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
          deleted_at?: string | null;
        };
      };

      // ============================================
      // Existing Tables (partial definitions for reference)
      // ============================================
      general_suggestions: {
        Row: {
          id: string;
          title: string;
          description: string;
          proposed_plan: Json | null;
          status: string;
          created_at: string;
          triggered_by: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          executed_at: string | null;
          execution_result: Json | null;
          rejection_reason: string | null;
          priority: string | null;
          category: string | null;
          execution_id: string | null;
          company_id: string | null;
          actor_user_id: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          description: string;
          proposed_plan?: Json | null;
          status?: string;
          created_at?: string;
          triggered_by?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          executed_at?: string | null;
          execution_result?: Json | null;
          rejection_reason?: string | null;
          priority?: string | null;
          category?: string | null;
          execution_id?: string | null;
          company_id?: string | null;
          actor_user_id?: string | null;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string;
          proposed_plan?: Json | null;
          status?: string;
          created_at?: string;
          triggered_by?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          executed_at?: string | null;
          execution_result?: Json | null;
          rejection_reason?: string | null;
          priority?: string | null;
          category?: string | null;
          execution_id?: string | null;
          company_id?: string | null;
          actor_user_id?: string | null;
        };
      };

      companies: {
        Row: {
          id: string;
          name: string;
          // ... other fields
        };
        Insert: {
          id?: string;
          name: string;
        };
        Update: {
          id?: string;
          name?: string;
        };
      };

      users: {
        Row: {
          id: string;
          email: string;
          // ... other fields
        };
        Insert: {
          id?: string;
          email: string;
        };
        Update: {
          id?: string;
          email?: string;
        };
      };

      site_settings: {
        Row: {
          id: string;
          setting_key: string;
          setting_value: Json;
          setting_category: string | null;
          setting_schema: Json | null;
          current_revision_id: string | null;
          validated_at: string | null;
          validation_errors: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          setting_key: string;
          setting_value: Json;
          setting_category?: string | null;
          setting_schema?: Json | null;
          current_revision_id?: string | null;
          validated_at?: string | null;
          validation_errors?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          setting_key?: string;
          setting_value?: Json;
          setting_category?: string | null;
          setting_schema?: Json | null;
          current_revision_id?: string | null;
          validated_at?: string | null;
          validation_errors?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      approval_requests: {
        Row: {
          id: string;
          action_id: string;
          action_type: string;
          description: string;
          risk_level: string;
          requested_at: string;
          expires_at: string | null;
          status: string;
          approved_by: string | null;
          approved_at: string | null;
          rejection_reason: string | null;
          metadata: Json | null;
          execution_id: string | null;
          revision_id: string | null;
        };
        Insert: {
          id?: string;
          action_id: string;
          action_type: string;
          description: string;
          risk_level: string;
          requested_at?: string;
          expires_at?: string | null;
          status?: string;
          approved_by?: string | null;
          approved_at?: string | null;
          rejection_reason?: string | null;
          metadata?: Json | null;
          execution_id?: string | null;
          revision_id?: string | null;
        };
        Update: {
          id?: string;
          action_id?: string;
          action_type?: string;
          description?: string;
          risk_level?: string;
          requested_at?: string;
          expires_at?: string | null;
          status?: string;
          approved_by?: string | null;
          approved_at?: string | null;
          rejection_reason?: string | null;
          metadata?: Json | null;
          execution_id?: string | null;
          revision_id?: string | null;
        };
      };

      audit_log: {
        Row: {
          id: string;
          action: string;
          details: string;
          actor_user_id: string | null;
          metadata: Json | null;
          result: string;
          created_at: string;
          company_id: string | null;
          execution_id: string | null;
          revision_id: string | null;
        };
        Insert: {
          id?: string;
          action: string;
          details: string;
          actor_user_id?: string | null;
          metadata?: Json | null;
          result: string;
          created_at?: string;
          company_id?: string | null;
          execution_id?: string | null;
          revision_id?: string | null;
        };
        Update: {
          id?: string;
          action?: string;
          details?: string;
          actor_user_id?: string | null;
          metadata?: Json | null;
          result?: string;
          created_at?: string;
          company_id?: string | null;
          execution_id?: string | null;
          revision_id?: string | null;
        };
      };

      agent_memory: {
        Row: {
          id: string;
          type: string;
          category: string;
          content: string;
          context: Json | null;
          priority: string;
          outcome: string | null;
          user_feedback: string | null;
          expires_at: string | null;
          company_id: string | null;
          actor_user_id: string | null;
          source_table: string | null;
          source_id: string | null;
          created_at: string;
          updated_at: string;
          execution_id: string | null;
          revision_id: string | null;
        };
        Insert: {
          id?: string;
          type: string;
          category: string;
          content: string;
          context?: Json | null;
          priority: string;
          outcome?: string | null;
          user_feedback?: string | null;
          expires_at?: string | null;
          company_id?: string | null;
          actor_user_id?: string | null;
          source_table?: string | null;
          source_id?: string | null;
          created_at?: string;
          updated_at?: string;
          execution_id?: string | null;
          revision_id?: string | null;
        };
        Update: {
          id?: string;
          type?: string;
          category?: string;
          content?: string;
          context?: Json | null;
          priority?: string;
          outcome?: string | null;
          user_feedback?: string | null;
          expires_at?: string | null;
          company_id?: string | null;
          actor_user_id?: string | null;
          source_table?: string | null;
          source_id?: string | null;
          created_at?: string;
          updated_at?: string;
          execution_id?: string | null;
          revision_id?: string | null;
        };
      };
    };

    Views: {
      v_agent_executions_summary: {
        Row: {
          id: string | null;
          execution_type: string | null;
          execution_status: string | null;
          execution_time_ms: number | null;
          affected_tables: string[] | null;
          affected_rows: number | null;
          started_at: string | null;
          completed_at: string | null;
          error_message: string | null;
          rollback_available: boolean | null;
          company_name: string | null;
          actor_email: string | null;
          seo_score: number | null;
        };
      };
      v_pending_content_changes: {
        Row: {
          // ... view columns
        };
      };
      v_active_sections: {
        Row: {
          // ... view columns
        };
      };
    };

    Functions: {
      get_agent_execution_stats: {
        Args: {
          p_company_id?: string;
          p_start_date?: string;
          p_end_date?: string;
        };
        Returns: {
          execution_type: string;
          total_count: number;
          completed_count: number;
          failed_count: number;
          avg_execution_time_ms: number;
          total_affected_rows: number;
        }[];
      };
      rollback_revision: {
        Args: {
          p_revision_id: string;
          p_rollback_reason?: string;
          p_rolled_back_by?: string;
        };
        Returns: boolean;
      };
      verify_backup_integrity: {
        Args: {
          p_backup_id: string;
        };
        Returns: {
          backup_id: string;
          integrity_check_passed: boolean;
          checksum_match: boolean;
          size_match: boolean;
          accessible: boolean;
          verified_at: string;
        };
      };
    };

    Enums: {
      // Define any enums here if needed
    };
  };
}
