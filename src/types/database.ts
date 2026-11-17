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
    PostgrestVersion: "14.18"
  }
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
      app_config: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      dev_sms_outbox: {
        Row: {
          created_at: string
          id: string
          otp: string
          phone: string
        }
        Insert: {
          created_at?: string
          id?: string
          otp: string
          phone: string
        }
        Update: {
          created_at?: string
          id?: string
          otp?: string
          phone?: string
        }
        Relationships: []
      }
      landlords: {
        Row: {
          account_name: string | null
          account_number: string | null
          bank_code: string | null
          bank_name: string | null
          created_at: string
          flw_subaccount_id: string | null
          flw_subaccount_ref: number | null
          full_name: string
          id: string
          payout_updated_at: string | null
          phone: string
          updated_at: string
        }
        Insert: {
          account_name?: string | null
          account_number?: string | null
          bank_code?: string | null
          bank_name?: string | null
          created_at?: string
          flw_subaccount_id?: string | null
          flw_subaccount_ref?: number | null
          full_name: string
          id?: string
          payout_updated_at?: string | null
          phone?: string
          updated_at?: string
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          bank_code?: string | null
          bank_name?: string | null
          created_at?: string
          flw_subaccount_id?: string | null
          flw_subaccount_ref?: number | null
          full_name?: string
          id?: string
          payout_updated_at?: string | null
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_attempts: {
        Row: {
          amount_kobo: number
          charge_id: string
          created_at: string
          failure_reason: string | null
          flw_transaction_id: number | null
          id: string
          status: string
          tx_ref: string
          updated_at: string
        }
        Insert: {
          amount_kobo: number
          charge_id: string
          created_at?: string
          failure_reason?: string | null
          flw_transaction_id?: number | null
          id?: string
          status?: string
          tx_ref: string
          updated_at?: string
        }
        Update: {
          amount_kobo?: number
          charge_id?: string
          created_at?: string
          failure_reason?: string | null
          flw_transaction_id?: number | null
          id?: string
          status?: string
          tx_ref?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_attempts_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "charge_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_attempts_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "rent_charges"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_kobo: number
          charge_id: string
          created_at: string
          flw_transaction_id: number | null
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          note: string | null
          paid_at: string
          recorded_by: string | null
          reference: string
          void_reason: string | null
          voided_at: string | null
        }
        Insert: {
          amount_kobo: number
          charge_id: string
          created_at?: string
          flw_transaction_id?: number | null
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          note?: string | null
          paid_at?: string
          recorded_by?: string | null
          reference: string
          void_reason?: string | null
          voided_at?: string | null
        }
        Update: {
          amount_kobo?: number
          charge_id?: string
          created_at?: string
          flw_transaction_id?: number | null
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          note?: string | null
          paid_at?: string
          recorded_by?: string | null
          reference?: string
          void_reason?: string | null
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "charge_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "rent_charges"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          address: string | null
          created_at: string
          id: string
          landlord_id: string
          name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          landlord_id?: string
          name: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          landlord_id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_landlord_id_fkey"
            columns: ["landlord_id"]
            isOneToOne: false
            referencedRelation: "landlords"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          channel: string
          charge_id: string
          created_at: string
          error: string | null
          id: string
          kind: string
          message: string
          provider_message_id: string | null
          scheduled_for: string
          sent_at: string | null
          status: string
          to_phone: string
        }
        Insert: {
          channel?: string
          charge_id: string
          created_at?: string
          error?: string | null
          id?: string
          kind: string
          message: string
          provider_message_id?: string | null
          scheduled_for: string
          sent_at?: string | null
          status?: string
          to_phone: string
        }
        Update: {
          channel?: string
          charge_id?: string
          created_at?: string
          error?: string | null
          id?: string
          kind?: string
          message?: string
          provider_message_id?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          to_phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "charge_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "rent_charges"
            referencedColumns: ["id"]
          },
        ]
      }
      rent_charges: {
        Row: {
          amount_kobo: number
          amount_paid_kobo: number
          charge_type: string
          created_at: string
          due_date: string
          id: string
          period_end: string
          period_start: string
          status: Database["public"]["Enums"]["charge_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount_kobo: number
          amount_paid_kobo?: number
          charge_type?: string
          created_at?: string
          due_date: string
          id?: string
          period_end: string
          period_start: string
          status?: Database["public"]["Enums"]["charge_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount_kobo?: number
          amount_paid_kobo?: number
          charge_type?: string
          created_at?: string
          due_date?: string
          id?: string
          period_end?: string
          period_start?: string
          status?: Database["public"]["Enums"]["charge_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rent_charges_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          access_token: string
          created_at: string
          full_name: string
          id: string
          moved_out_at: string | null
          paid_until: string | null
          phone: string
          reminders_enabled: boolean
          rent_amount_kobo: number
          rent_period: Database["public"]["Enums"]["rent_period"]
          start_date: string
          status: Database["public"]["Enums"]["tenant_status"]
          unit_id: string
          updated_at: string
        }
        Insert: {
          access_token?: string
          created_at?: string
          full_name: string
          id?: string
          moved_out_at?: string | null
          paid_until?: string | null
          phone: string
          reminders_enabled?: boolean
          rent_amount_kobo: number
          rent_period: Database["public"]["Enums"]["rent_period"]
          start_date: string
          status?: Database["public"]["Enums"]["tenant_status"]
          unit_id: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          created_at?: string
          full_name?: string
          id?: string
          moved_out_at?: string | null
          paid_until?: string | null
          phone?: string
          reminders_enabled?: boolean
          rent_amount_kobo?: number
          rent_period?: Database["public"]["Enums"]["rent_period"]
          start_date?: string
          status?: Database["public"]["Enums"]["tenant_status"]
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenants_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "charge_overview"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "tenants_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          created_at: string
          id: string
          label: string
          property_id: string
          rent_amount_kobo: number
          rent_period: Database["public"]["Enums"]["rent_period"]
          unit_type: Database["public"]["Enums"]["unit_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          property_id: string
          rent_amount_kobo: number
          rent_period?: Database["public"]["Enums"]["rent_period"]
          unit_type?: Database["public"]["Enums"]["unit_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          property_id?: string
          rent_amount_kobo?: number
          rent_period?: Database["public"]["Enums"]["rent_period"]
          unit_type?: Database["public"]["Enums"]["unit_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "charge_overview"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "units_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          error: string | null
          event_type: string | null
          external_id: string | null
          id: string
          payload: Json
          processed_at: string | null
          provider: string
          received_at: string
        }
        Insert: {
          error?: string | null
          event_type?: string | null
          external_id?: string | null
          id?: string
          payload: Json
          processed_at?: string | null
          provider: string
          received_at?: string
        }
        Update: {
          error?: string | null
          event_type?: string | null
          external_id?: string | null
          id?: string
          payload?: Json
          processed_at?: string | null
          provider?: string
          received_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      charge_overview: {
        Row: {
          amount_kobo: number | null
          amount_paid_kobo: number | null
          balance_kobo: number | null
          days_until_due: number | null
          due_date: string | null
          id: string | null
          period_end: string | null
          period_start: string | null
          property_id: string | null
          property_name: string | null
          status: Database["public"]["Enums"]["charge_status"] | null
          tenant_id: string | null
          tenant_name: string | null
          tenant_phone: string | null
          timing: string | null
          unit_id: string | null
          unit_label: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rent_charges_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_overview: {
        Row: {
          amount_kobo: number | null
          charge_id: string | null
          id: string | null
          method: Database["public"]["Enums"]["payment_method"] | null
          note: string | null
          paid_at: string | null
          period_end: string | null
          period_start: string | null
          property_name: string | null
          tenant_id: string | null
          tenant_name: string | null
          unit_label: string | null
          void_reason: string | null
          voided_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "charge_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "rent_charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rent_charges_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      charge_horizon_days: {
        Args: { p_period: Database["public"]["Enums"]["rent_period"] }
        Returns: number
      }
      chargeable_periods: {
        Args: {
          p_added_on: string
          p_horizon: string
          p_moved_out_at: string
          p_paid_until: string
          p_period: Database["public"]["Enums"]["rent_period"]
          p_start_date: string
        }
        Returns: {
          period_end: string
          period_start: string
        }[]
      }
      dev_send_sms_hook: { Args: { event: Json }; Returns: Json }
      earlier_open_charge_due: {
        Args: { p_charge_id: string }
        Returns: string
      }
      generate_all_charges: { Args: never; Returns: number }
      generate_tenant_charges: {
        Args: { p_tenant_id: string }
        Returns: number
      }
      owns_charge: { Args: { p_charge_id: string }; Returns: boolean }
      queue_reminders: { Args: never; Returns: number }
      random_token: { Args: never; Returns: string }
      record_manual_payment: {
        Args: {
          p_amount_kobo: number
          p_charge_id: string
          p_method: Database["public"]["Enums"]["payment_method"]
          p_note?: string
          p_paid_on: string
        }
        Returns: string
      }
      record_payment: {
        Args: {
          p_amount_kobo: number
          p_charge_id: string
          p_flw_transaction_id?: number
          p_method: Database["public"]["Enums"]["payment_method"]
          p_note?: string
          p_paid_at?: string
          p_recorded_by?: string
          p_reference: string
        }
        Returns: string
      }
      refresh_charge_paid: { Args: { p_charge_id: string }; Returns: undefined }
      reminder_kind: {
        Args: {
          p_due: string
          p_period?: Database["public"]["Enums"]["rent_period"]
          p_today: string
        }
        Returns: string
      }
      reminder_message: {
        Args: {
          p_balance_kobo: number
          p_due: string
          p_kind: string
          p_landlord_name: string
          p_link: string
          p_tenant_name: string
          p_unit_label: string
        }
        Returns: string
      }
      rent_period_months: {
        Args: { p: Database["public"]["Enums"]["rent_period"] }
        Returns: number
      }
      tenant_portal: { Args: { p_token: string }; Returns: Json }
      today_lagos: { Args: never; Returns: string }
      void_payment: {
        Args: { p_payment_id: string; p_reason: string }
        Returns: undefined
      }
    }
    Enums: {
      charge_status: "unpaid" | "partially_paid" | "paid" | "cancelled"
      payment_method: "link" | "cash" | "transfer"
      rent_period: "monthly" | "six_monthly" | "yearly"
      tenant_status: "active" | "moved_out"
      unit_type:
        | "room"
        | "self_contain"
        | "mini_flat"
        | "flat"
        | "duplex"
        | "shop"
        | "other"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      charge_status: ["unpaid", "partially_paid", "paid", "cancelled"],
      payment_method: ["link", "cash", "transfer"],
      rent_period: ["monthly", "six_monthly", "yearly"],
      tenant_status: ["active", "moved_out"],
      unit_type: [
        "room",
        "self_contain",
        "mini_flat",
        "flat",
        "duplex",
        "shop",
        "other",
      ],
    },
  },
} as const
