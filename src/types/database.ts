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
          created_at: string
          full_name: string
          id: string
          phone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          phone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          phone?: string
          updated_at?: string
        }
        Relationships: []
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
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Functions: {
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
      random_token: { Args: never; Returns: string }
      rent_period_months: {
        Args: { p: Database["public"]["Enums"]["rent_period"] }
        Returns: number
      }
      today_lagos: { Args: never; Returns: string }
    }
    Enums: {
      charge_status: "unpaid" | "partially_paid" | "paid" | "cancelled"
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
