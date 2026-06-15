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
      asset_expenses: {
        Row: {
          amount: number
          asset_id: string
          category: string
          company_id: string
          created_at: string
          created_by: string | null
          expense_date: string
          id: string
          invoice_ref: string | null
          notes: string | null
          updated_at: string
          vendor: string | null
        }
        Insert: {
          amount: number
          asset_id: string
          category: string
          company_id: string
          created_at?: string
          created_by?: string | null
          expense_date?: string
          id?: string
          invoice_ref?: string | null
          notes?: string | null
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          amount?: number
          asset_id?: string
          category?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          expense_date?: string
          id?: string
          invoice_ref?: string | null
          notes?: string | null
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_expenses_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_expenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_photos: {
        Row: {
          asset_id: string
          caption: string | null
          company_id: string
          created_at: string
          id: string
          is_primary: boolean
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          asset_id: string
          caption?: string | null
          company_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          asset_id?: string
          caption?: string | null
          company_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_photos_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_photos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          asset_number: string | null
          assigned_operator_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          current_value: number | null
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
          requires_attention: boolean
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
          assigned_operator_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          current_value?: number | null
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
          requires_attention?: boolean
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
          assigned_operator_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          current_value?: number | null
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
          requires_attention?: boolean
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
            foreignKeyName: "assets_assigned_operator_id_fkey"
            columns: ["assigned_operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          company_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          ip: string | null
          metadata: Json
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          company_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip?: string | null
          metadata?: Json
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          company_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip?: string | null
          metadata?: Json
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_company_id_fkey"
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
      company_invites: {
        Row: {
          code: string
          company_id: string
          created_at: string
          created_by: string
          email: string | null
          email_sent_at: string | null
          expires_at: string
          id: string
          invited_name: string | null
          invited_phone: string | null
          revoked_at: string | null
          role: Database["public"]["Enums"]["app_role"]
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          created_by: string
          email?: string | null
          email_sent_at?: string | null
          expires_at?: string
          id?: string
          invited_name?: string | null
          invited_phone?: string | null
          revoked_at?: string | null
          role: Database["public"]["Enums"]["app_role"]
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          created_by?: string
          email?: string | null
          email_sent_at?: string | null
          expires_at?: string
          id?: string
          invited_name?: string | null
          invited_phone?: string | null
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_invites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
      contact_enquiries: {
        Row: {
          admin_notes: string | null
          company_name: string
          created_at: string
          current_system: string
          email: string
          employee_count: string
          enquiry_type: string
          full_name: string
          heard_about: string
          id: string
          industry: string
          machine_count: string
          message: string
          phone: string
          state: string
          status: Database["public"]["Enums"]["contact_enquiry_status"]
          submitter_ip: string | null
          submitter_user_agent: string | null
          survey_biggest_challenge: string | null
          survey_current_system: string | null
          survey_time_saving_feature: string | null
          survey_wants_contact: boolean | null
          survey_wants_demo: boolean | null
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          company_name: string
          created_at?: string
          current_system: string
          email: string
          employee_count: string
          enquiry_type: string
          full_name: string
          heard_about: string
          id?: string
          industry: string
          machine_count: string
          message: string
          phone: string
          state: string
          status?: Database["public"]["Enums"]["contact_enquiry_status"]
          submitter_ip?: string | null
          submitter_user_agent?: string | null
          survey_biggest_challenge?: string | null
          survey_current_system?: string | null
          survey_time_saving_feature?: string | null
          survey_wants_contact?: boolean | null
          survey_wants_demo?: boolean | null
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          company_name?: string
          created_at?: string
          current_system?: string
          email?: string
          employee_count?: string
          enquiry_type?: string
          full_name?: string
          heard_about?: string
          id?: string
          industry?: string
          machine_count?: string
          message?: string
          phone?: string
          state?: string
          status?: Database["public"]["Enums"]["contact_enquiry_status"]
          submitter_ip?: string | null
          submitter_user_agent?: string | null
          survey_biggest_challenge?: string | null
          survey_current_system?: string | null
          survey_time_saving_feature?: string | null
          survey_wants_contact?: boolean | null
          survey_wants_demo?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      defect_photos: {
        Row: {
          caption: string | null
          company_id: string
          created_at: string
          defect_id: string
          id: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          caption?: string | null
          company_id: string
          created_at?: string
          defect_id: string
          id?: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          caption?: string | null
          company_id?: string
          created_at?: string
          defect_id?: string
          id?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "defect_photos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "defect_photos_defect_id_fkey"
            columns: ["defect_id"]
            isOneToOne: false
            referencedRelation: "defect_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      defect_reports: {
        Row: {
          asset_id: string
          company_id: string
          created_at: string
          description: string
          id: string
          operator_id: string | null
          prestart_id: string | null
          reported_at: string
          reported_by: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          status: string
          submitter_ip: string | null
          submitter_user_agent: string | null
          updated_at: string
        }
        Insert: {
          asset_id: string
          company_id: string
          created_at?: string
          description: string
          id?: string
          operator_id?: string | null
          prestart_id?: string | null
          reported_at?: string
          reported_by?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          submitter_ip?: string | null
          submitter_user_agent?: string | null
          updated_at?: string
        }
        Update: {
          asset_id?: string
          company_id?: string
          created_at?: string
          description?: string
          id?: string
          operator_id?: string | null
          prestart_id?: string | null
          reported_at?: string
          reported_by?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          submitter_ip?: string | null
          submitter_user_agent?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "defect_reports_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "defect_reports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "defect_reports_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "defect_reports_prestart_id_fkey"
            columns: ["prestart_id"]
            isOneToOne: false
            referencedRelation: "prestart_checks"
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
          user_id: string | null
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
          user_id?: string | null
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
          user_id?: string | null
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
      platform_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      prestart_checks: {
        Row: {
          admin_notes: string | null
          asset_id: string
          checklist: Json
          company_id: string
          completed_at: string
          created_at: string
          gps_accuracy: number | null
          gps_lat: number | null
          gps_lng: number | null
          id: string
          meter_reading: number | null
          notes: string | null
          operator_id: string | null
          performed_by: string | null
          signature_path: string | null
          status: string
          submitter_ip: string | null
          submitter_user_agent: string | null
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          asset_id: string
          checklist?: Json
          company_id: string
          completed_at?: string
          created_at?: string
          gps_accuracy?: number | null
          gps_lat?: number | null
          gps_lng?: number | null
          id?: string
          meter_reading?: number | null
          notes?: string | null
          operator_id?: string | null
          performed_by?: string | null
          signature_path?: string | null
          status?: string
          submitter_ip?: string | null
          submitter_user_agent?: string | null
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          asset_id?: string
          checklist?: Json
          company_id?: string
          completed_at?: string
          created_at?: string
          gps_accuracy?: number | null
          gps_lat?: number | null
          gps_lng?: number | null
          id?: string
          meter_reading?: number | null
          notes?: string | null
          operator_id?: string | null
          performed_by?: string | null
          signature_path?: string | null
          status?: string
          submitter_ip?: string | null
          submitter_user_agent?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prestart_checks_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prestart_checks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prestart_checks_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      prestart_photos: {
        Row: {
          caption: string | null
          company_id: string
          created_at: string
          id: string
          prestart_id: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          caption?: string | null
          company_id: string
          created_at?: string
          id?: string
          prestart_id: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          caption?: string | null
          company_id?: string
          created_at?: string
          id?: string
          prestart_id?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prestart_photos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prestart_photos_prestart_id_fkey"
            columns: ["prestart_id"]
            isOneToOne: false
            referencedRelation: "prestart_checks"
            referencedColumns: ["id"]
          },
        ]
      }
      prestart_template_items: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          id: string
          is_critical: boolean
          label: string
          section: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          id?: string
          is_critical?: boolean
          label: string
          section: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          id?: string
          is_critical?: boolean
          label?: string
          section?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prestart_template_items_company_id_fkey"
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
          asset_id: string | null
          company_id: string
          compliance_id: string | null
          days_before: number
          id: string
          operator_licence_id: string | null
          recipient_email: string
          sent_at: string
          status: string
        }
        Insert: {
          asset_id?: string | null
          company_id: string
          compliance_id?: string | null
          days_before: number
          id?: string
          operator_licence_id?: string | null
          recipient_email: string
          sent_at?: string
          status?: string
        }
        Update: {
          asset_id?: string | null
          company_id?: string
          compliance_id?: string | null
          days_before?: number
          id?: string
          operator_licence_id?: string | null
          recipient_email?: string
          sent_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_log_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_log_compliance_id_fkey"
            columns: ["compliance_id"]
            isOneToOne: false
            referencedRelation: "compliance_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_log_operator_licence_id_fkey"
            columns: ["operator_licence_id"]
            isOneToOne: false
            referencedRelation: "operator_licences"
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
      service_photos: {
        Row: {
          caption: string | null
          company_id: string
          created_at: string
          id: string
          service_id: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          caption?: string | null
          company_id: string
          created_at?: string
          id?: string
          service_id: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          caption?: string | null
          company_id?: string
          created_at?: string
          id?: string
          service_id?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_photos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_photos_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "service_history"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          company_id: string
          created_at: string
          created_by: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          paddle_customer_id: string
          paddle_subscription_id: string
          price_id: string
          product_id: string
          status: string
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          company_id: string
          created_at?: string
          created_by?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          paddle_customer_id: string
          paddle_subscription_id: string
          price_id: string
          product_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          paddle_customer_id?: string
          paddle_subscription_id?: string
          price_id?: string
          product_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
      ticket_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          operator_id: string
          ticket_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          operator_id: string
          ticket_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          operator_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_assignments_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_assignments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          expiry_date: string | null
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          issue_date: string | null
          notes: string | null
          ticket_number: string | null
          ticket_type: string | null
          title: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          expiry_date?: string | null
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          issue_date?: string | null
          notes?: string | null
          ticket_number?: string | null
          ticket_type?: string | null
          title: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          expiry_date?: string | null
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          issue_date?: string | null
          notes?: string | null
          ticket_number?: string | null
          ticket_type?: string | null
          title?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_company_id_fkey"
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
      accept_company_invite: { Args: { _code: string }; Returns: string }
      can_edit_company: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      company_asset_limit: {
        Args: { _company_id: string; _env?: string }
        Returns: number
      }
      company_billing_state: {
        Args: { _company_id: string; _env?: string }
        Returns: {
          asset_limit: number
          cancel_at_period_end: boolean
          period_end: string
          product_id: string
          state: string
          status: string
          trial_ends_at: string
        }[]
      }
      contact_enquiry_rate_check: {
        Args: { _ip: string; _max: number; _window_minutes: number }
        Returns: boolean
      }
      create_company_invite:
        | {
            Args: {
              _email?: string
              _role: Database["public"]["Enums"]["app_role"]
            }
            Returns: {
              invite_code: string
              invite_id: string
            }[]
          }
        | {
            Args: {
              _email?: string
              _name?: string
              _phone?: string
              _role: Database["public"]["Enums"]["app_role"]
            }
            Returns: {
              invite_code: string
              invite_id: string
            }[]
          }
      create_company_with_admin: {
        Args: { _abn: string; _name: string }
        Returns: string
      }
      current_role: {
        Args: { _company_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      current_user_email: { Args: never; Returns: string }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _company_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _company_id: string }; Returns: boolean }
      is_company_member: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_office: { Args: { _company_id: string }; Returns: boolean }
      is_operator: { Args: { _company_id: string }; Returns: boolean }
      is_platform_admin: { Args: never; Returns: boolean }
      is_workshop: { Args: { _company_id: string }; Returns: boolean }
      log_audit: {
        Args: {
          _action: string
          _company_id: string
          _entity_id?: string
          _entity_type?: string
          _metadata?: Json
          _user_agent?: string
        }
        Returns: string
      }
      mark_invite_email_sent: {
        Args: { _invite_id: string }
        Returns: undefined
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
      operator_asset_ids: { Args: never; Returns: string[] }
      preview_company_invite: {
        Args: { _code: string }
        Returns: {
          company_name: string
          invited_email: string
          invited_name: string
          role: string
          status: string
        }[]
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      record_operator_meter: {
        Args: { _asset_id: string; _new_value: number }
        Returns: undefined
      }
      remove_member: {
        Args: { _company_id: string; _user_id: string }
        Returns: undefined
      }
      resend_company_invite: {
        Args: { _invite_id: string }
        Returns: undefined
      }
      seed_prestart_template: {
        Args: { _company_id: string }
        Returns: undefined
      }
      set_active_company: { Args: { _company_id: string }; Returns: undefined }
      update_member_role: {
        Args: {
          _company_id: string
          _new_role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "manager"
        | "viewer"
        | "office_staff"
        | "workshop"
        | "operator"
        | "super_admin"
        | "supervisor"
        | "mechanic"
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
      contact_enquiry_status: "new" | "in_progress" | "completed"
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
      app_role: [
        "admin",
        "manager",
        "viewer",
        "office_staff",
        "workshop",
        "operator",
        "super_admin",
        "supervisor",
        "mechanic",
      ],
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
      contact_enquiry_status: ["new", "in_progress", "completed"],
    },
  },
} as const
