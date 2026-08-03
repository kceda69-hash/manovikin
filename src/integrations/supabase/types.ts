export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_balance: {
        Row: {
          created_at: string
          credits: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_balance_ledger: {
        Row: {
          created_at: string
          delta: number
          id: string
          metadata: Json
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          metadata?: Json
          reason: string
          user_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          metadata?: Json
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          created_at: string
          event_type: string
          id: string
          ip: string | null
          metadata: Json
          summary: string | null
          thread_id: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          ip?: string | null
          metadata?: Json
          summary?: string | null
          thread_id?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          ip?: string | null
          metadata?: Json
          summary?: string | null
          thread_id?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      language_memory: {
        Row: {
          created_at: string
          id: string
          language_code: string
          notes: string | null
          terminology: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          language_code: string
          notes?: string | null
          terminology?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          language_code?: string
          notes?: string | null
          terminology?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      magic_link_requests: {
        Row: {
          created_at: string
          email: string
          id: number
          ip: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: number
          ip: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: number
          ip?: string
        }
        Relationships: []
      }
      manovik_brain_updates: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          notes: string | null
          version: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          notes?: string | null
          version: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          notes?: string | null
          version?: string
        }
        Relationships: []
      }
      manovik_builds: {
        Row: {
          command: string
          created_at: string
          duration_ms: number | null
          exit_code: number | null
          finished_at: string | null
          id: string
          logs: string
          metadata: Json
          project_id: string
          status: Database["public"]["Enums"]["build_status"]
          user_id: string
        }
        Insert: {
          command?: string
          created_at?: string
          duration_ms?: number | null
          exit_code?: number | null
          finished_at?: string | null
          id?: string
          logs?: string
          metadata?: Json
          project_id: string
          status?: Database["public"]["Enums"]["build_status"]
          user_id: string
        }
        Update: {
          command?: string
          created_at?: string
          duration_ms?: number | null
          exit_code?: number | null
          finished_at?: string | null
          id?: string
          logs?: string
          metadata?: Json
          project_id?: string
          status?: Database["public"]["Enums"]["build_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manovik_builds_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "manovik_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      manovik_device_commands: {
        Row: {
          command: string
          completed_at: string | null
          created_at: string
          device_id: string
          id: string
          kind: string
          result: string | null
          status: string
          user_id: string
        }
        Insert: {
          command: string
          completed_at?: string | null
          created_at?: string
          device_id: string
          id?: string
          kind?: string
          result?: string | null
          status?: string
          user_id: string
        }
        Update: {
          command?: string
          completed_at?: string | null
          created_at?: string
          device_id?: string
          id?: string
          kind?: string
          result?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manovik_device_commands_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "manovik_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      manovik_devices: {
        Row: {
          capabilities: Json
          created_at: string
          id: string
          last_seen_at: string | null
          name: string
          pair_code: string | null
          pair_code_expires_at: string | null
          paired_at: string | null
          platform: string
          token_hash: string | null
          user_id: string
        }
        Insert: {
          capabilities?: Json
          created_at?: string
          id?: string
          last_seen_at?: string | null
          name: string
          pair_code?: string | null
          pair_code_expires_at?: string | null
          paired_at?: string | null
          platform?: string
          token_hash?: string | null
          user_id: string
        }
        Update: {
          capabilities?: Json
          created_at?: string
          id?: string
          last_seen_at?: string | null
          name?: string
          pair_code?: string | null
          pair_code_expires_at?: string | null
          paired_at?: string | null
          platform?: string
          token_hash?: string | null
          user_id?: string
        }
        Relationships: []
      }
      manovik_project_files: {
        Row: {
          content: string
          created_at: string
          id: string
          language: string | null
          path: string
          project_id: string
          size_bytes: number
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          language?: string | null
          path: string
          project_id: string
          size_bytes?: number
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          language?: string | null
          path?: string
          project_id?: string
          size_bytes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "manovik_project_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "manovik_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      manovik_project_versions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          label: string | null
          project_id: string
          snapshot: Json
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          project_id: string
          snapshot?: Json
          version: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          project_id?: string
          snapshot?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "manovik_project_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "manovik_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      manovik_projects: {
        Row: {
          archived: boolean
          created_at: string
          description: string | null
          entry_path: string
          framework: string
          id: string
          name: string
          owner_id: string
          share_token: string
          updated_at: string
          visibility: Database["public"]["Enums"]["project_visibility"]
          workspace_id: string | null
        }
        Insert: {
          archived?: boolean
          created_at?: string
          description?: string | null
          entry_path?: string
          framework?: string
          id?: string
          name: string
          owner_id: string
          share_token?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["project_visibility"]
          workspace_id?: string | null
        }
        Update: {
          archived?: boolean
          created_at?: string
          description?: string | null
          entry_path?: string
          framework?: string
          id?: string
          name?: string
          owner_id?: string
          share_token?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["project_visibility"]
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manovik_projects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "manovik_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      manovik_subscriptions: {
        Row: {
          cancelled_at: string | null
          created_at: string
          metadata: Json
          monthly_credit_limit: number
          period_start: string
          plan: string
          renews_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          metadata?: Json
          monthly_credit_limit?: number
          period_start?: string
          plan?: string
          renews_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          metadata?: Json
          monthly_credit_limit?: number
          period_start?: string
          plan?: string
          renews_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      manovik_usage_events: {
        Row: {
          cost_micros: number
          created_at: string
          credits: number
          id: string
          input_tokens: number
          kind: string
          metadata: Json
          model: string | null
          output_tokens: number
          project_id: string | null
          user_id: string
        }
        Insert: {
          cost_micros?: number
          created_at?: string
          credits?: number
          id?: string
          input_tokens?: number
          kind: string
          metadata?: Json
          model?: string | null
          output_tokens?: number
          project_id?: string | null
          user_id: string
        }
        Update: {
          cost_micros?: number
          created_at?: string
          credits?: number
          id?: string
          input_tokens?: number
          kind?: string
          metadata?: Json
          model?: string | null
          output_tokens?: number
          project_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manovik_usage_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "manovik_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      manovik_workspace_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["workspace_role"]
          token: string
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["workspace_role"]
          token?: string
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          token?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manovik_workspace_invites_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "manovik_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      manovik_workspace_members: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manovik_workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "manovik_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      manovik_workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          created_at: string
          id: string
          message: Json
          role: string
          thread_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: Json
          role: string
          thread_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: Json
          role?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          ui_prefs: Json
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          ui_prefs?: Json
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          ui_prefs?: Json
        }
        Relationships: []
      }
      purchases: {
        Row: {
          amount: number
          created_at: string
          currency: string
          email: string | null
          id: string
          metadata: Json
          name: string | null
          plan: string
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          receipt_no: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          email?: string | null
          id?: string
          metadata?: Json
          name?: string | null
          plan: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          receipt_no?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          email?: string | null
          id?: string
          metadata?: Json
          name?: string | null
          plan?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          receipt_no?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      security_self_checks: {
        Row: {
          auto_fix_applied: boolean
          check_name: string
          details: Json
          id: string
          ran_at: string
          run_id: string
          status: string
        }
        Insert: {
          auto_fix_applied?: boolean
          check_name: string
          details?: Json
          id?: string
          ran_at?: string
          run_id: string
          status: string
        }
        Update: {
          auto_fix_applied?: boolean
          check_name?: string
          details?: Json
          id?: string
          ran_at?: string
          run_id?: string
          status?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      threads: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_read_project: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      can_write_project: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      can_write_workspace: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_security_scan_token: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_workspace_member: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      magic_link_check_and_record: {
        Args: { _email: string; _ip: string }
        Returns: Json
      }
      manovik_spend_credit: {
        Args: { _amount: number; _reason: string; _user_id: string }
        Returns: number
      }
      manovik_topup_credit: {
        Args: { _amount: number; _reason: string; _user_id: string }
        Returns: number
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      security_scan_new_findings: {
        Args: { _run_id: string }
        Returns: {
          check_name: string
          details: Json
          status: string
        }[]
      }
      workspace_role_of: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: Database["public"]["Enums"]["workspace_role"]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      build_status: "queued" | "running" | "success" | "failed" | "cancelled"
      project_visibility: "private" | "link" | "public"
      workspace_role: "owner" | "admin" | "editor" | "viewer"
    }
    CompositeTypes: {
      [_ in never]: never
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
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
      build_status: ["queued", "running", "success", "failed", "cancelled"],
      project_visibility: ["private", "link", "public"],
      workspace_role: ["owner", "admin", "editor", "viewer"],
    },
  },
} as const
