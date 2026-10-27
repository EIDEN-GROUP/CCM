/**
 * Database types for the CCM schema.
 *
 * Regenerate with `npm run db:types` after changing a migration. The
 * hand-written portion below covers the tables the application reads; run the
 * generator to refresh it against the live schema.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Row<T extends Record<string, unknown>> = {
  [K in keyof T]: T[K];
};

/**
 * Insert/Update payloads.
 *
 * The hand-written file covers the tables the application reads precisely.
 * For writes it stays permissive so that the repository layer can insert
 * without fighting the type system; `npm run db:types` regenerates the whole
 * file from the live schema with exact types.
 */
type Write = Record<string, any>;

export interface Database {
  public: {
    Tables: {
      workspaces: {
        Row: Row<{
          id: string;
          name: string;
          slug: string;
          timezone: string;
          currency: string;
          created_at: string;
          updated_at: string;
        }>;
        Insert: Row<{
          id?: string;
          name: string;
          slug: string;
          timezone?: string;
          currency?: string;
          created_at?: string;
          updated_at?: string;
        }>;
        Update: Partial<
          Row<{
            id: string;
            name: string;
            slug: string;
            timezone: string;
            currency: string;
            created_at: string;
            updated_at: string;
          }>
        >;
        Relationships: [];
      };
      workspace_members: {
        Row: Row<{
          id: string;
          workspace_id: string;
          user_id: string;
          role: string;
          status: "invited" | "active" | "suspended";
          invited_by: string | null;
          invited_at: string | null;
          created_at: string;
          updated_at: string;
        }>;
        Insert: Row<{
          id?: string;
          workspace_id: string;
          user_id: string;
          role?: string;
          status?: "invited" | "active" | "suspended";
          invited_by?: string | null;
          invited_at?: string | null;
          created_at?: string;
          updated_at?: string;
        }>;
        Update: Partial<
          Row<{
            id: string;
            workspace_id: string;
            user_id: string;
            role: string;
            status: "invited" | "active" | "suspended";
            invited_by: string | null;
            invited_at: string | null;
            created_at: string;
            updated_at: string;
          }>
        >;
        Relationships: [];
      };
      roles: {
        Row: Row<{
          key: string;
          label: string;
          account_scoped: boolean;
          description: string | null;
          created_at: string;
        }>;
        Insert: Row<{
          key: string;
          label: string;
          account_scoped?: boolean;
          description?: string | null;
          created_at?: string;
        }>;
        Update: Write;
        Relationships: [];
      };
      websites: {
        Row: Row<{
          id: string;
          workspace_id: string;
          name: string;
          domain: string;
          primary_locale: string;
          locales: string[];
          service_lines: string[];
          owner_label: string | null;
          health_state: string;
          is_active: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        }>;
        Insert: Row<{
          id?: string;
          workspace_id: string;
          name: string;
          domain: string;
          primary_locale?: string;
          locales?: string[];
          service_lines?: string[];
          owner_label?: string | null;
          health_state?: string;
          is_active?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        }>;
        Update: Write;
        Relationships: [];
      };
      website_pages: {
        Row: Row<{
          id: string;
          workspace_id: string;
          website_id: string;
          url: string;
          path: string;
          locale: string | null;
          page_class: string;
          service_line: string | null;
          title: string | null;
          canonical_url: string | null;
          noindex: boolean;
          status_code: number | null;
          meta_description: string | null;
          h1_count: number | null;
          last_crawled_at: string | null;
          created_at: string;
          updated_at: string;
        }>;
        Insert: Write;
        Update: Write;
        Relationships: [];
      };
      provider_definitions: {
        Row: Row<{
          key: string;
          display_name: string;
          category: string;
          api_version: string;
          hosts: string[];
          capabilities: Json;
          docs_url: string | null;
          blocking_approvals: string[];
          updated_at: string;
        }>;
        Insert: Write;
        Update: Write;
        Relationships: [];
      };
      provider_connections: {
        Row: Row<{
          id: string;
          workspace_id: string;
          provider_key: string;
          display_label: string;
          status:
            | "connected"
            | "needs_setup"
            | "token_refresh_failed"
            | "permission_revoked"
            | "provider_outage"
            | "rate_limited"
            | "sync_stale";
          auth_mode: string;
          scopes: string[];
          account_timezone: string | null;
          account_currency: string | null;
          api_access_level: string | null;
          quota_limit: number | null;
          quota_used: number;
          quota_window_started_at: string | null;
          last_success_at: string | null;
          last_attempt_at: string | null;
          last_error_code: string | null;
          last_error_message: string | null;
          next_refresh_at: string | null;
          created_at: string;
          updated_at: string;
        }>;
        Insert: Write;
        Update: Write;
        Relationships: [];
      };
      external_accounts: {
        Row: Row<{
          id: string;
          workspace_id: string;
          connection_id: string | null;
          provider_key: string;
          external_account_id: string | null;
          display_label: string;
          identifiers: Json;
          launch_account_url: string | null;
          launch_management_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        }>;
        Insert: Write;
        Update: Write;
        Relationships: [];
      };
      account_launch_profiles: {
        Row: Row<{
          account_id: string;
          workspace_id: string;
          launch_mode: "direct" | "extension" | "helper";
          status:
            | "ready"
            | "profile_unmapped"
            | "extension_not_paired"
            | "helper_unavailable"
            | "browser_unsupported";
          browser_profile_label: string | null;
          browser_profile_directory: string | null;
          helper_endpoint: string | null;
          extension_instance_id: string | null;
          last_opened_at: string | null;
          last_launch_result: string | null;
          created_at: string;
          updated_at: string;
        }>;
        Insert: Write;
        Update: Write;
        Relationships: [];
      };
      account_login_credentials: {
        Row: Row<{
          account_id: string;
          workspace_id: string;
          username: string;
          encrypted_password: string;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        }>;
        Insert: Write;
        Update: Write;
        Relationships: [];
      };
      account_login_access_tickets: {
        Row: Row<{
          jti: string;
          account_id: string;
          workspace_id: string;
          user_id: string;
          expires_at: string;
          consumed_at: string | null;
          created_at: string;
        }>;
        Insert: Write;
        Update: Write;
        Relationships: [];
      };
      launch_tickets: {
        Row: Row<{
          jti: string;
          workspace_id: string;
          account_id: string;
          user_id: string;
          provider_key: string;
          host: string;
          path: string;
          mode: "direct" | "extension" | "helper";
          expires_at: string;
          consumed_at: string | null;
          created_at: string;
        }>;
        Insert: Write;
        Update: Write;
        Relationships: [];
      };
      launch_events: {
        Row: Row<{
          id: string;
          workspace_id: string;
          account_id: string | null;
          user_id: string | null;
          ticket_jti: string | null;
          mode: "direct" | "extension" | "helper";
          outcome: string;
          host: string | null;
          reason: string | null;
          via_extension: boolean;
          created_at: string;
        }>;
        Insert: Write;
        Update: Write;
        Relationships: [];
      };
      sync_jobs: {
        Row: Row<{
          id: string;
          workspace_id: string;
          connection_id: string | null;
          account_id: string | null;
          kind: string;
          status:
            | "queued"
            | "running"
            | "succeeded"
            | "failed"
            | "dead_letter"
            | "cancelled";
          dedupe_key: string;
          payload: Json;
          run_after: string;
          attempts: number;
          max_attempts: number;
          locked_until: string | null;
          lease_owner: string | null;
          last_error: string | null;
          created_at: string;
          updated_at: string;
        }>;
        Insert: Write;
        Update: Write;
        Relationships: [];
      };
      sync_runs: {
        Row: Row<{
          id: string;
          workspace_id: string;
          job_id: string | null;
          connection_id: string | null;
          account_id: string | null;
          status: string;
          started_at: string;
          finished_at: string | null;
          rows_written: number | null;
          duration_ms: number | null;
          error_code: string | null;
          error_message: string | null;
        }>;
        Insert: Write;
        Update: Write;
        Relationships: [];
      };
      sync_errors: {
        Row: Row<{
          id: string;
          workspace_id: string;
          connection_id: string | null;
          job_id: string | null;
          error_code: string;
          error_message: string;
          retryable: boolean;
          occurred_at: string;
        }>;
        Insert: Write;
        Update: Write;
        Relationships: [];
      };
      daily_ads_metrics: {
        Row: Row<{
          workspace_id: string;
          account_id: string;
          metric_date: string;
          dimension: string;
          dimension_id: string;
          dimension_label: string | null;
          impressions: number | null;
          clicks: number | null;
          cost_micros: number | null;
          conversions: number | null;
          conversion_value_micros: number | null;
          currency: string | null;
          source_fetched_at: string;
        }>;
        Insert: Write;
        Update: Write;
        Relationships: [];
      };
      daily_ga4_metrics: {
        Row: Row<{
          workspace_id: string;
          account_id: string;
          metric_date: string;
          dimension: string;
          dimension_id: string;
          dimension_label: string | null;
          sessions: number | null;
          active_users: number | null;
          new_users: number | null;
          engaged_sessions: number | null;
          screen_page_views: number | null;
          key_events: number | null;
          event_name: string | null;
          event_count: number | null;
          revenue: number | null;
          currency: string | null;
          source_fetched_at: string;
        }>;
        Insert: Write;
        Update: Write;
        Relationships: [];
      };
      daily_gsc_metrics: {
        Row: Row<{
          workspace_id: string;
          account_id: string;
          metric_date: string;
          dimension: string;
          dimension_id: string;
          dimension_label: string | null;
          clicks: number | null;
          impressions: number | null;
          ctr: number | null;
          position: number | null;
          country: string | null;
          device: string | null;
          search_type: string | null;
          source_fetched_at: string;
        }>;
        Insert: Write;
        Update: Write;
        Relationships: [];
      };
      rank_snapshots: {
        Row: Row<{
          id: string;
          workspace_id: string;
          account_id: string;
          keyword: string;
          search_engine: string;
          country: string | null;
          city: string | null;
          device: string;
          landing_url: string | null;
          position: number | null;
          observed_on: string;
          source_provider: string;
          source_fetched_at: string;
        }>;
        Insert: Write;
        Update: Write;
        Relationships: [];
      };
      social_account_metrics: {
        Row: Row<{
          workspace_id: string;
          account_id: string;
          metric_date: string;
          organic: boolean;
          followers: number | null;
          reach: number | null;
          impressions: number | null;
          engagements: number | null;
          clicks: number | null;
          video_views: number | null;
          content_count: number | null;
          source_fetched_at: string;
        }>;
        Insert: Write;
        Update: Write;
        Relationships: [];
      };
      social_post_metrics: {
        Row: Row<{
          id: string;
          workspace_id: string;
          account_id: string;
          platform: string;
          post_id: string;
          posted_at: string | null;
          format: string | null;
          link: string | null;
          caption_excerpt: string | null;
          reach: number | null;
          impressions: number | null;
          engagements: number | null;
          clicks: number | null;
          video_views: number | null;
          source_fetched_at: string;
        }>;
        Insert: Write;
        Update: Write;
        Relationships: [];
      };
      tag_manager_snapshots: {
        Row: Row<{
          id: string;
          workspace_id: string;
          account_id: string;
          container_id: string;
          version_id: string | null;
          version_number: number | null;
          published_at: string | null;
          tags: Json;
          triggers: Json;
          variables: Json;
          workspaces: Json;
          environments: Json;
          expected_measurement_ids: string[];
          captured_at: string;
        }>;
        Insert: Write;
        Update: Write;
        Relationships: [];
      };
      metric_definitions: {
        Row: Row<{
          key: string;
          display_name: string;
          definition: string;
          formula: string | null;
          connector: string;
          source_field: string | null;
          unit: string;
          grain: string;
          currency_aware: boolean;
          timezone_aware: boolean;
          aggregation: string;
          dimensions: string[];
          attribution_notes: string | null;
          caveats: string[];
          freshness_target_seconds: number | null;
          created_at: string;
          updated_at: string;
        }>;
        Insert: Write;
        Update: Write;
        Relationships: [];
      };
      alerts: {
        Row: Row<{
          id: string;
          workspace_id: string;
          rule_id: string | null;
          account_id: string | null;
          website_id: string | null;
          metric: string;
          severity: string;
          title: string;
          reason: string;
          observed: number | null;
          baseline: number | null;
          confidence: number | null;
          status: "open" | "acknowledged" | "snoozed" | "resolved";
          owner_user_id: string | null;
          due_at: string | null;
          source_ref: Json;
          opened_at: string;
          resolved_at: string | null;
          resolution_note: string | null;
        }>;
        Insert: Write;
        Update: Write;
        Relationships: [];
      };
      alert_rules: {
        Row: Row<{
          id: string;
          workspace_id: string;
          metric: string;
          direction: "increase" | "decrease";
          threshold: number;
          severity: string;
          min_volume: number;
          hysteresis_windows: number;
          grace_windows: number;
          quiet_hours: Json | null;
          min_repeat_hours: number;
          scope: Json | null;
          enabled: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        }>;
        Insert: Write;
        Update: Write;
        Relationships: [];
      };
      action_items: {
        Row: Row<{
          id: string;
          workspace_id: string;
          alert_id: string | null;
          title: string;
          detail: string | null;
          status: "open" | "in_progress" | "done" | "cancelled";
          priority: "low" | "normal" | "high";
          owner_user_id: string | null;
          due_at: string | null;
          source: string;
          created_at: string;
          updated_at: string;
        }>;
        Insert: Write;
        Update: Write;
        Relationships: [];
      };
      audit_events: {
        Row: Row<{
          id: string;
          workspace_id: string | null;
          actor_user_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          target_label: string | null;
          severity: string;
          details: Json;
          created_at: string;
        }>;
        Insert: Write;
        Update: Write;
        Relationships: [];
      };
      mailbox_connections: {
        Row: Row<{
          id: string;
          workspace_id: string;
          account_id: string;
          provider_key: string;
          mailbox_email: string;
          display_label: string;
          auth_method: string;
          host: string | null;
          port: number | null;
          username: string | null;
          smtp_host: string | null;
          smtp_port: number | null;
          status: string;
          scopes: string[];
          ai_processing_enabled: boolean;
          last_sync_at: string | null;
          last_error: string | null;
          created_at: string;
          updated_at: string;
        }>;
        Insert: Write;
        Update: Write;
        Relationships: [];
      };
      mailbox_threads: {
        Row: Row<{
          id: string;
          workspace_id: string;
          mailbox_id: string;
          provider_thread_id: string;
          subject: string | null;
          snippet: string | null;
          participant_count: number | null;
          message_count: number | null;
          is_unread: boolean;
          is_starred: boolean;
          has_attachments: boolean;
          last_message_at: string | null;
          labels: string[];
          created_at: string;
          updated_at: string;
        }>;
        Insert: Write;
        Update: Write;
        Relationships: [];
      };
      provider_app_credentials: {
        Row: Row<{
          id: string;
          workspace_id: string;
          provider_key: string;
          client_id: string;
          encrypted_secret: string | null;
          key_fingerprint: string | null;
          redirect_uri: string | null;
          scopes: string[];
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        }>;
        Insert: Write;
        Update: Write;
        Relationships: [];
      };
      role_tab_access: {
        Row: Row<{
          workspace_id: string;
          role: string;
          tab: string;
          level: string;
          updated_by: string | null;
          updated_at: string;
        }>;
        Insert: Write;
        Update: Write;
        Relationships: [];
      };
      role_permissions: {
        Row: Row<{
          workspace_id: string;
          role: string;
          permission: string;
        }>;
        Insert: Write;
        Update: Write;
        Relationships: [];
      };
      user_preferences: {
        Row: Row<{
          user_id: string;
          workspace_id: string;
          locale: string;
          timezone: string | null;
          currency: string | null;
          default_range: string;
          safe_mode: boolean;
          notifications: Json;
          updated_at: string;
        }>;
        Insert: Write;
        Update: Write;
        Relationships: [];
      };
      external_account_grants: {
        Row: Row<{
          external_account_id: string;
          user_id: string;
          permission: string;
          granted_by: string | null;
          created_at: string;
        }>;
        Insert: Write;
        Update: Write;
        Relationships: [];
      };
      website_domains: {
        Row: Row<{
          id: string;
          website_id: string;
          hostname: string;
          is_primary: boolean;
          verified_at: string | null;
          created_at: string;
        }>;
        Insert: Write;
        Update: Write;
        Relationships: [];
      };
      site_health_checks: {
        Row: Row<{
          id: string;
          workspace_id: string;
          website_id: string;
          check_type: string;
          status: string;
          checked_at: string;
          value: number | null;
          unit: string | null;
          detail: Json;
        }>;
        Insert: Write;
        Update: Write;
        Relationships: [];
      };
      external_account_identifiers: {
        Row: Row<{ account_id: string; kind: string; value: string }>;
        Insert: Write;
        Update: Write;
        Relationships: [];
      };
      provider_connection_credentials: {
        Row: Row<{
          connection_id: string;
          encrypted_secrets: string;
          key_fingerprint: string | null;
          updated_at: string;
        }>;
        Insert: Write;
        Update: Write;
        Relationships: [];
      };
      sync_cursors: {
        Row: Row<{
          id: string;
          workspace_id: string;
          connection_id: string;
          account_id: string | null;
          stream: string;
          cursor_value: string | null;
          checkpoint: Json;
          updated_at: string;
        }>;
        Insert: Write;
        Update: Write;
        Relationships: [];
      };

      mailbox_messages: {
        Row: Row<{
          id: string;
          workspace_id: string;
          mailbox_id: string;
          thread_id: string | null;
          provider_message_id: string;
          from_address: string | null;
          from_name: string | null;
          to_addresses: string[];
          cc_addresses: string[];
          subject: string | null;
          body_storage: string;
          body_size_bytes: number | null;
          snippet: string | null;
          sent_at: string | null;
          received_at: string | null;
          is_unread: boolean;
          is_draft: boolean;
          labels: string[];
          source_fetched_at: string;
        }>;
        Insert: Write;
        Update: Write;
        Relationships: [];
      };
      mailbox_cursors: {
        Row: Row<{
          mailbox_id: string;
          stream: string;
          cursor_value: string | null;
          history_id: string | null;
          updated_at: string;
        }>;
        Insert: Write;
        Update: Write;
        Relationships: [];
      };
      action_item_events: {
        Row: Row<{
          id: string;
          action_item_id: string;
          actor_user_id: string | null;
          event_type: string;
          note: string | null;
          created_at: string;
        }>;
        Insert: Write;
        Update: Write;
        Relationships: [];
      };
      metric_source_references: {
        Row: Row<{
          id: string;
          workspace_id: string;
          metric_key: string;
          source_connector: string;
          source_record_id: string | null;
          source_url: string | null;
          fetched_at: string | null;
          coverage: number | null;
          note: string | null;
          created_at: string;
        }>;
        Insert: Write;
        Update: Write;
        Relationships: [];
      };
      report_definitions: {
        Row: Row<{
          id: string;
          workspace_id: string;
          key: string;
          title: string;
          description: string | null;
          cadence: string;
          sections: Json;
          formats: string[];
          recipients: string[];
          created_by: string | null;
          enabled: boolean;
          last_run_at: string | null;
          next_run_at: string | null;
          created_at: string;
          updated_at: string;
        }>;
        Insert: Write;
        Update: Write;
        Relationships: [];
      };
      report_runs: {
        Row: Row<{
          id: string;
          workspace_id: string;
          definition_id: string | null;
          period_start: string | null;
          period_end: string | null;
          timezone: string | null;
          currency: string | null;
          status: string;
          payload: Json;
          safe_mode: boolean;
          generated_at: string;
        }>;
        Insert: Write;
        Update: Write;
        Relationships: [];
      };
      ai_insight_requests: {
        Row: Row<{
          id: string;
          workspace_id: string;
          user_id: string;
          question: string;
          answer: string | null;
          status: string;
          model: string | null;
          filters: Json;
          caveats: Json;
          created_at: string;
          completed_at: string | null;
        }>;
        Insert: Write;
        Update: Write;
        Relationships: [];
      };
      ai_insight_sources: {
        Row: Row<{
          id: string;
          request_id: string;
          source_type: string;
          source_ref: string;
          label: string;
          period_start: string | null;
          period_end: string | null;
          fetched_at: string | null;
          excerpt: string | null;
        }>;
        Insert: Write;
        Update: Write;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_workspace_for_owner: {
        Args: { p_name: string };
        Returns: Array<{ id: string; name: string }>;
      };
      add_provider_quota_usage: {
        Args: {
          p_connection_id: string;
          p_calls: number;
          p_window_start?: string | null;
        };
        Returns: number;
      };
      has_provider_quota: {
        Args: {
          p_connection_id: string;
        };
        Returns: boolean;
      };
      claim_sync_jobs: {
        Args: {
          p_workspace_id: string | null;
          p_limit: number;
          p_lease_owner: string;
          p_lease_seconds: number;
        };
        Returns: Database["public"]["Tables"]["sync_jobs"]["Row"][];
      };
      complete_sync_job: {
        Args: {
          p_job_id: string;
          p_status: Database["public"]["Enums"]["sync_job_status"];
          p_rows_written: number | null;
          p_duration_ms: number | null;
          p_error_code: string | null;
          p_error_message: string | null;
          p_run_after: string | null;
          p_dead_letter: boolean;
        };
        Returns: undefined;
      };
      record_sync_error: {
        Args: {
          p_workspace_id: string;
          p_connection_id: string | null;
          p_job_id: string | null;
          p_error_code: string;
          p_error_message: string;
          p_retryable: boolean;
        };
        Returns: undefined;
      };
    };
    Enums: {
      connection_status:
        | "connected"
        | "needs_setup"
        | "token_refresh_failed"
        | "permission_revoked"
        | "provider_outage"
        | "rate_limited"
        | "sync_stale";
      launch_status:
        | "ready"
        | "profile_unmapped"
        | "extension_not_paired"
        | "helper_unavailable"
        | "browser_unsupported";
      launch_mode: "direct" | "extension" | "helper";
      member_status: "invited" | "active" | "suspended";
      sync_job_status:
        | "queued"
        | "running"
        | "succeeded"
        | "failed"
        | "dead_letter"
        | "cancelled";
    };
    CompositeTypes: Record<string, never>;
  };
}
