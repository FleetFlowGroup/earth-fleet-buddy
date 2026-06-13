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
      assets: {
        Row: {
          asset_number: string | null
          company_id: string
          created_at: string
          created_by: string | null
          custom_type: string | null
          engine_hours: number | null
          id: string
          last_service_date: string | null
          last_service_hours: number | null
          last_service_odometer: number | null
          location: string | null
          make: string | null
          model: string | null
          name: string
          notes: string | null
          odometer: number | null
          operator_name: string | null
          purchase_date: string | null
          purchase_price: number | null
          registration: string | null
          serial_number: string | null
          service_interval_days: number | null
          service_interval_hours: number | null
          service_interval_km: number | null
          status: Database["public"]["Enums"]["asset_status"]
          type: Database["public"]["Enums"]["asset_type"]
          updated_at: string
          vin_serial: string | null
          year: number | null
        }
        Insert: {
          asset_number?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          custom_type?: string | null
          engine_hours?: number | null
          id?: string
          last_service_date?: string | null
          last_service_hours?: number | null
          last_service_odometer?: number | null
          location?: string | null
          make?: string | null
          model?: string | null
          name: string
          notes?: string | null
          odometer?: number | null
          operator_name?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          registration?: string | null
          serial_number?: string | null
          service_interval_days?: number | null
          service_interval_hours?: number | null
          service_interval_km?: number | null
          status?: Database["public"]["Enums"]["asset_status"]
          type?: Database["public"]["Enums"]["asset_type"]
          updated_at?: string
          vin_serial?: string | null
          year?: number | null
        }
        Update: {
          asset_number?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          custom_type?: string | null
          engine_hours?: number | null
          id?: string
          last_service_date?: string | null
          last_service_hours?: number | null
          last_service_odometer?: number | null
          location?: string | null
          make?: string | null
          model?: string | null
          name?: string
          notes?: string | null
          odometer?: number | null
          operator_name?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          registration?: string | null
          serial_number?: string | null
          service_interval_days?: number | null
          service_interval_hours?: number | null
          service_interval_km?: number | null
          status?: Database["public"]["Enums"]["asset_status"]
          type?: Database["public"]["Enums"]["asset_type"]
          updated_at?: string
          vin_serial?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          abn: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
        }
        Insert: {
          abn?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
        }
        Update: {
          abn?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      compliance_records: {
        Row: {
          asset_id: string
          company_id: string
          created_at: string
          expiry_date: string
          id: string
          label: string | null
          notes: string | null
          reference: string | null
          type: Database["public"]["Enums"]["compliance_type"]
          updated_at: string
        }
        Insert: {
          asset_id: string
          company_id: string
          created_at?: string
          expiry_date: string
          id?: string
          label?: string | null
          notes?: string | null
          reference?: string | null
          type: Database["public"]["Enums"]["compliance_type"]
          updated_at?: string
        }
        Update: {
          asset_id?: string
          company_id?: string
          created_at?: string
          expiry_date?: string
          id?: string
          label?: string | null
          notes?: string | null
          reference?: string | null
          type?: Database["public"]["Enums"]["compliance_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_records_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          asset_id: string | null
          category: string | null
          company_id: string
          id: string
          mime_type: string | null
          name: string
          size_bytes: number | null
          storage_path: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          asset_id?: string | null
          category?: string | null
          company_id: string
          id?: string
          mime_type?: string | null
          name: string
          size_bytes?: number | null
          storage_path: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          asset_id?: string | null
          category?: string | null
          company_id?: string
          id?: string
          mime_type?: string | null
          name?: string
          size_bytes?: number | null
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      meter_readings: {
        Row: {
          asset_id: string
          company_id: string
          difference: number | null
          id: string
          meter_type: string
          new_value: number
          previous_value: number | null
          recorded_at: string
          recorded_by: string | null
        }
        Insert: {
          asset_id: string
          company_id: string
          difference?: number | null
          id?: string
          meter_type: string
          new_value: number
          previous_value?: number | null
          recorded_at?: string
          recorded_by?: string | null
        }
        Update: {
          asset_id?: string
          company_id?: string
          difference?: number | null
          id?: string
          meter_type?: string
          new_value?: number
          previous_value?: number | null
          recorded_at?: string
          recorded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meter_readings_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meter_readings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_licences: {
        Row: {
          certificate_path: string | null
          company_id: string
          created_at: string
          created_by: string | null
          expiry_date: string | null
          id: string
          issue_date: string | null
          licence_name: string | null
          licence_number: string | null
          licence_type: string
          notes: string | null
          operator_id: string
          updated_at: string
        }
        Insert: {
          certificate_path?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          licence_name?: string | null
          licence_number?: string | null
          licence_type: string
          notes?: string | null
          operator_id: string
          updated_at?: string
        }
        Update: {
          certificate_path?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          licence_name?: string | null
          licence_number?: string | null
          licence_type?: string
          notes?: string | null
          operator_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_licences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_licences_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      operators: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          depot: string | null
          email: string | null
          employee_id: string | null
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          position: string | null
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          depot?: string | null
          email?: string | null
          employee_id?: string | null
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          position?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          depot?: string | null
          email?: string | null
          employee_id?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          position?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operators_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_id: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_log: {
        Row: {
          compliance_id: string
          days_before: number
          id: string
          recipient_email: string
          sent_at: string
          status: string
        }
        Insert: {
          compliance_id: string
          days_before: number
          id?: string
          recipient_email: string
          sent_at?: string
          status?: string
        }
        Update: {
          compliance_id?: string
          days_before?: number
          id?: string
          recipient_email?: string
          sent_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_log_compliance_id_fkey"
            columns: ["compliance_id"]
            isOneToOne: false
            referencedRelation: "compliance_records"
            referencedColumns: ["id"]
          },
        ]
      }
      service_history: {
        Row: {
          asset_id: string
          company_id: string
          cost: number | null
          created_at: string
          created_by: string | null
          hours_at: number | null
          id: string
          invoice_path: string | null
          notes: string | null
          odometer_at: number | null
          parts_replaced: string | null
          service_date: string
          technician: string | null
          workshop: string | null
        }
        Insert: {
          asset_id: string
          company_id: string
          cost?: number | null
          created_at?: string
          created_by?: string | null
          hours_at?: number | null
          id?: string
          invoice_path?: string | null
          notes?: string | null
          odometer_at?: number | null
          parts_replaced?: string | null
          service_date: string
          technician?: string | null
          workshop?: string | null
        }
        Update: {
          asset_id?: string
          company_id?: string
          cost?: number | null
          created_at?: string
          created_by?: string | null
          hours_at?: number | null
          id?: string
          invoice_path?: string | null
          notes?: string | null
          odometer_at?: number | null
          parts_replaced?: string | null
          service_date?: string
          technician?: string | null
          workshop?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_history_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_edit_company: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      create_company_with_admin: {
        Args: { _abn: string; _name: string }
        Returns: string
      }
      has_role: {
        Args: {
          _company_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_company_member: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "viewer"
      asset_status: "active" | "workshop" | "broken_down" | "sold" | "disposed"
      asset_type:
        | "vehicle"
        | "machinery"
        | "trailer"
        | "other"
        | "truck"
        | "prime_mover"
        | "ute"
        | "car"
        | "excavator"
        | "loader"
        | "skid_steer"
        | "dozer"
        | "grader"
        | "roller"
        | "water_cart"
        | "dump_truck"
        | "generator"
        | "compressor"
        | "attachment"
      compliance_type:
        | "registration"
        | "insurance"
        | "service"
        | "inspection"
        | "permit"
        | "other"
        | "plant_inspection"
        | "safety_inspection"
        | "operator_licence"
        | "fire_extinguisher"
        | "warranty"
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
      app_role: ["admin", "manager", "viewer"],
      asset_status: ["active", "workshop", "broken_down", "sold", "disposed"],
      asset_type: [
        "vehicle",
        "machinery",
        "trailer",
        "other",
        "truck",
        "prime_mover",
        "ute",
        "car",
        "excavator",
        "loader",
        "skid_steer",
        "dozer",
        "grader",
        "roller",
        "water_cart",
        "dump_truck",
        "generator",
        "compressor",
        "attachment",
      ],
      compliance_type: [
        "registration",
        "insurance",
        "service",
        "inspection",
        "permit",
        "other",
        "plant_inspection",
        "safety_inspection",
        "operator_licence",
        "fire_extinguisher",
        "warranty",
      ],
    },
  },
} as const
