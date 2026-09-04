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
      detected_subscriptions: {
        Row: {
          details_locked: boolean
          reviewed_at: string | null
          amount: number
          cancellation_url: string | null
          created_at: string
          estimated_annual_cost: number | null
          frequency: string
          id: string
          last_charged: string | null
          service_name: string
          status: string | null
          user_id: string
        }
        Insert: {
          details_locked?: boolean
          reviewed_at?: string | null
          amount: number
          cancellation_url?: string | null
          created_at?: string
          estimated_annual_cost?: number | null
          frequency: string
          id?: string
          last_charged?: string | null
          service_name: string
          status?: string | null
          user_id: string
        }
        Update: {
          details_locked?: boolean
          reviewed_at?: string | null
          amount?: number
          cancellation_url?: string | null
          created_at?: string
          estimated_annual_cost?: number | null
          frequency?: string
          id?: string
          last_charged?: string | null
          service_name?: string
          status?: string | null
          user_id?: string
        }
        Relationships: []
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
      profiles: {
        Row: {
          created_at: string
          current_period_end: string | null
          full_name: string | null
          id: string
          language: string | null
          monthly_spending_history: Json | null
          monthly_uploads_used: number | null
          stripe_customer_id: string | null
          subscription_status: string | null
          subscription_tier: string | null
          theme: string | null
          updated_at: string
          uploads_reset_date: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          full_name?: string | null
          id?: string
          language?: string | null
          monthly_spending_history?: Json | null
          monthly_uploads_used?: number | null
          stripe_customer_id?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          theme?: string | null
          updated_at?: string
          uploads_reset_date?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          full_name?: string | null
          id?: string
          language?: string | null
          monthly_spending_history?: Json | null
          monthly_uploads_used?: number | null
          stripe_customer_id?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          theme?: string | null
          updated_at?: string
          uploads_reset_date?: string | null
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          converted_at: string | null
          created_at: string
          id: string
          referral_code: string
          referred_user_id: string | null
          referrer_id: string
          reward_granted: boolean | null
          status: string
        }
        Insert: {
          converted_at?: string | null
          created_at?: string
          id?: string
          referral_code: string
          referred_user_id?: string | null
          referrer_id: string
          reward_granted?: boolean | null
          status?: string
        }
        Update: {
          converted_at?: string | null
          created_at?: string
          id?: string
          referral_code?: string
          referred_user_id?: string | null
          referrer_id?: string
          reward_granted?: boolean | null
          status?: string
        }
        Relationships: []
      }
      savings_goals: {
        Row: {
          created_at: string
          current_amount: number | null
          deadline: string | null
          id: string
          target_amount: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_amount?: number | null
          deadline?: string | null
          id?: string
          target_amount: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_amount?: number | null
          deadline?: string | null
          id?: string
          target_amount?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          created_at: string
          features: Json | null
          id: string
          name: string
          price: number
          stripe_price_id: string | null
        }
        Insert: {
          created_at?: string
          features?: Json | null
          id?: string
          name: string
          price: number
          stripe_price_id?: string | null
        }
        Update: {
          created_at?: string
          features?: Json | null
          id?: string
          name?: string
          price?: number
          stripe_price_id?: string | null
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
      transactions: {
        Row: {
          direction_override: string | null
          category_override: string | null
          reviewed_at: string | null
          amount: number
          category: string | null
          created_at: string
          date: string
          description: string
          direction: string | null
          id: string
          import_version: number | null
          is_recurring: boolean | null
          merchant: string | null
          recurring_frequency: string | null
          user_id: string
        }
        Insert: {
          direction_override?: string | null
          category_override?: string | null
          reviewed_at?: string | null
          amount: number
          category?: string | null
          created_at?: string
          date: string
          description: string
          direction?: string | null
          id?: string
          import_version?: number | null
          is_recurring?: boolean | null
          merchant?: string | null
          recurring_frequency?: string | null
          user_id: string
        }
        Update: {
          direction_override?: string | null
          category_override?: string | null
          reviewed_at?: string | null
          amount?: number
          category?: string | null
          created_at?: string
          date?: string
          description?: string
          direction?: string | null
          id?: string
          import_version?: number | null
          is_recurring?: boolean | null
          merchant?: string | null
          recurring_frequency?: string | null
          user_id?: string
        }
        Relationships: []
      }
      upload_history: {
        Row: {
          created_at: string
          csv_hash: string | null
          id: string
          potential_savings: number
          subscriptions_count: number
          total_credits: number | null
          total_spending: number
          transaction_count: number
          upload_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          csv_hash?: string | null
          id?: string
          potential_savings?: number
          subscriptions_count?: number
          total_credits?: number | null
          total_spending: number
          transaction_count?: number
          upload_date?: string
          user_id: string
        }
        Update: {
          created_at?: string
          csv_hash?: string | null
          id?: string
          potential_savings?: number
          subscriptions_count?: number
          total_credits?: number | null
          total_spending?: number
          transaction_count?: number
          upload_date?: string
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
          role?: Database["public"]["Enums"]["app_role"]
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
      user_subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan_id: string
          status: string
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id: string
          status?: string
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id?: string
          status?: string
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          created_at: string
          error_message: string | null
          event_id: string
          event_type: string
          id: string
          payload: Json | null
          processed_at: string | null
          processing_status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_id: string
          event_type: string
          id?: string
          payload?: Json | null
          processed_at?: string | null
          processing_status?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json | null
          processed_at?: string | null
          processing_status?: string
        }
        Relationships: []
      }
    }
    Views: {
      referrals_user_view: {
        Row: {
          converted_at: string | null
          created_at: string | null
          id: string | null
          referral_code: string | null
          referrer_id: string | null
          reward_granted: boolean | null
          status: string | null
        }
        Insert: {
          converted_at?: string | null
          created_at?: string | null
          id?: string | null
          referral_code?: string | null
          referrer_id?: string | null
          reward_granted?: boolean | null
          status?: string | null
        }
        Update: {
          converted_at?: string | null
          created_at?: string | null
          id?: string | null
          referral_code?: string | null
          referrer_id?: string | null
          reward_granted?: boolean | null
          status?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      review_transaction: {
        Args: { _id: string; _direction: string; _category: string; _expected_reviewed_at?: string | null }
        Returns: Json
      }
      review_subscription: {
        Args: { _id: string; _status: string; _amount: number; _frequency: string; _expected_reviewed_at?: string | null }
        Returns: Json
      }
      current_request_role: { Args: never; Returns: string }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      entitlement_writes_allowed: { Args: never; Returns: boolean }
      get_upload_usage: {
        Args: never
        Returns: {
          period_start: string
          tier: string
          upload_limit: number
          uploads_used: number
        }[]
      }
      increment_monthly_uploads: {
        Args: { _user_id: string }
        Returns: {
          monthly_uploads_used: number
        }[]
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
      release_upload_slot: { Args: { _user_id: string }; Returns: number }
      reserve_upload_slot: {
        Args: { _user_id: string }
        Returns: {
          allowed: boolean
          period_start: string
          reason: string
          tier: string
          upload_limit: number
          uploads_used: number
        }[]
      }
      upload_limit_for_tier: { Args: { _tier: string }; Returns: number }
    }
    Enums: {
      app_role: "admin" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "user"],
    },
  },
} as const
