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
      ad_packages: {
        Row: {
          ad_type: Database["public"]["Enums"]["ad_type"]
          created_at: string
          duration_days: number
          id: string
          is_active: boolean
          max_impressions: number | null
          name: string
          placement_zones: string[]
          price_ttd: number
        }
        Insert: {
          ad_type: Database["public"]["Enums"]["ad_type"]
          created_at?: string
          duration_days: number
          id?: string
          is_active?: boolean
          max_impressions?: number | null
          name: string
          placement_zones?: string[]
          price_ttd: number
        }
        Update: {
          ad_type?: Database["public"]["Enums"]["ad_type"]
          created_at?: string
          duration_days?: number
          id?: string
          is_active?: boolean
          max_impressions?: number | null
          name?: string
          placement_zones?: string[]
          price_ttd?: number
        }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          action_type: string
          admin_email: string
          admin_id: string
          after_state: Json | null
          before_state: Json | null
          created_at: string
          id: string
          ip_address: string | null
          notes: string | null
          target_id: string | null
          target_table: string
        }
        Insert: {
          action_type: string
          admin_email: string
          admin_id: string
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          id?: string
          ip_address?: string | null
          notes?: string | null
          target_id?: string | null
          target_table: string
        }
        Update: {
          action_type?: string
          admin_email?: string
          admin_id?: string
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          id?: string
          ip_address?: string | null
          notes?: string | null
          target_id?: string | null
          target_table?: string
        }
        Relationships: []
      }
      admin_grant_presets: {
        Row: {
          description: string
          grants: Json
          name: string
          slug: string
        }
        Insert: {
          description: string
          grants: Json
          name: string
          slug: string
        }
        Update: {
          description?: string
          grants?: Json
          name?: string
          slug?: string
        }
        Relationships: []
      }
      admin_roles: {
        Row: {
          created_at: string
          granted_by: string | null
          grants: Json
          level: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          grants?: Json
          level: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          grants?: Json
          level?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_roles_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_ladder_log: {
        Row: {
          executed_at: string
          id: string
          outcome: string | null
          period_key: string
          step: number
          subscription_id: string
        }
        Insert: {
          executed_at?: string
          id?: string
          outcome?: string | null
          period_key: string
          step: number
          subscription_id: string
        }
        Update: {
          executed_at?: string
          id?: string
          outcome?: string | null
          period_key?: string
          step?: number
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_ladder_log_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_availability: {
        Row: {
          created_at: string
          end_time: string
          id: string
          is_active: boolean
          max_bookings: number
          professional_id: string
          slot_duration_min: number
          start_time: string
          updated_at: string
          weekday: number
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          is_active?: boolean
          max_bookings?: number
          professional_id: string
          slot_duration_min?: number
          start_time: string
          updated_at?: string
          weekday: number
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          is_active?: boolean
          max_bookings?: number
          professional_id?: string
          slot_duration_min?: number
          start_time?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_availability_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professional_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_blocked_dates: {
        Row: {
          blocked_date: string
          created_at: string
          id: string
          professional_id: string
          reason: string | null
        }
        Insert: {
          blocked_date: string
          created_at?: string
          id?: string
          professional_id: string
          reason?: string | null
        }
        Update: {
          blocked_date?: string
          created_at?: string
          id?: string
          professional_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_blocked_dates_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professional_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          created_at: string
          customer_id: string
          duration_minutes: number
          enquiry_id: string | null
          id: string
          notes: string | null
          professional_id: string
          reminder_1h_sent: boolean
          reminder_24h_sent: boolean
          scheduled_at: string
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          customer_id: string
          duration_minutes?: number
          enquiry_id?: string | null
          id?: string
          notes?: string | null
          professional_id: string
          reminder_1h_sent?: boolean
          reminder_24h_sent?: boolean
          scheduled_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          customer_id?: string
          duration_minutes?: number
          enquiry_id?: string | null
          id?: string
          notes?: string | null
          professional_id?: string
          reminder_1h_sent?: boolean
          reminder_24h_sent?: boolean
          scheduled_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_enquiry_id_fkey"
            columns: ["enquiry_id"]
            isOneToOne: false
            referencedRelation: "job_enquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professional_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      business_knowledge: {
        Row: {
          content: string
          created_at: string
          embedding: string | null
          id: string
          metadata: Json
          professional_id: string
          source: string | null
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json
          professional_id: string
          source?: string | null
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json
          professional_id?: string
          source?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_knowledge_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professional_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      case_notes: {
        Row: {
          author_id: string | null
          created_at: string
          dispute_id: string
          id: string
          is_internal: boolean
          note: string
        }
        Insert: {
          author_id?: string | null
          created_at?: string
          dispute_id: string
          id?: string
          is_internal?: boolean
          note: string
        }
        Update: {
          author_id?: string | null
          created_at?: string
          dispute_id?: string
          id?: string
          is_internal?: boolean
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_notes_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "disputes"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogue_posts: {
        Row: {
          caption: string | null
          category: string | null
          created_at: string
          id: string
          image_urls: string[]
          is_approved: boolean
          is_featured: boolean
          location: string | null
          posted_by: string
          poster_type: Database["public"]["Enums"]["catalogue_poster_type"]
          primary_image: string | null
          professional_id: string
          save_count: number
          tags: string[]
          updated_at: string
          view_count: number
        }
        Insert: {
          caption?: string | null
          category?: string | null
          created_at?: string
          id?: string
          image_urls: string[]
          is_approved?: boolean
          is_featured?: boolean
          location?: string | null
          posted_by: string
          poster_type?: Database["public"]["Enums"]["catalogue_poster_type"]
          primary_image?: string | null
          professional_id: string
          save_count?: number
          tags?: string[]
          updated_at?: string
          view_count?: number
        }
        Update: {
          caption?: string | null
          category?: string | null
          created_at?: string
          id?: string
          image_urls?: string[]
          is_approved?: boolean
          is_featured?: boolean
          location?: string | null
          posted_by?: string
          poster_type?: Database["public"]["Enums"]["catalogue_poster_type"]
          primary_image?: string | null
          professional_id?: string
          save_count?: number
          tags?: string[]
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "catalogue_posts_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalogue_posts_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professional_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogue_saves: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalogue_saves_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "catalogue_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalogue_saves_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string | null
          created_at: string
          display_order: number
          icon: string | null
          id: string
          is_active: boolean
          name: string
          parent_slug: string | null
          slug: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          display_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          parent_slug?: string | null
          slug: string
        }
        Update: {
          color?: string | null
          created_at?: string
          display_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parent_slug?: string | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_slug_fkey"
            columns: ["parent_slug"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["slug"]
          },
        ]
      }
      client_contacts: {
        Row: {
          area: string | null
          created_at: string
          customer_user_id: string | null
          display_name: string
          email: string | null
          enquiry_count: number
          first_contact_at: string
          id: string
          internal_notes: string | null
          is_archived: boolean
          last_activity_at: string
          lifetime_value_ttd: number
          origin: string
          phone: string | null
          professional_id: string
          source_ref_id: string | null
          tags: string[]
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          area?: string | null
          created_at?: string
          customer_user_id?: string | null
          display_name: string
          email?: string | null
          enquiry_count?: number
          first_contact_at?: string
          id?: string
          internal_notes?: string | null
          is_archived?: boolean
          last_activity_at?: string
          lifetime_value_ttd?: number
          origin?: string
          phone?: string | null
          professional_id: string
          source_ref_id?: string | null
          tags?: string[]
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          area?: string | null
          created_at?: string
          customer_user_id?: string | null
          display_name?: string
          email?: string | null
          enquiry_count?: number
          first_contact_at?: string
          id?: string
          internal_notes?: string | null
          is_archived?: boolean
          last_activity_at?: string
          lifetime_value_ttd?: number
          origin?: string
          phone?: string | null
          professional_id?: string
          source_ref_id?: string | null
          tags?: string[]
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_customer_user_id_fkey"
            columns: ["customer_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_contacts_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professional_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      connections: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          professional_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          professional_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          professional_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "connections_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connections_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professional_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_library: {
        Row: {
          body: string
          content_type: Database["public"]["Enums"]["content_type"]
          created_at: string
          id: string
          is_published: boolean
          metadata: Json
          professional_id: string
          published_at: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          body: string
          content_type: Database["public"]["Enums"]["content_type"]
          created_at?: string
          id?: string
          is_published?: boolean
          metadata?: Json
          professional_id: string
          published_at?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          content_type?: Database["public"]["Enums"]["content_type"]
          created_at?: string
          id?: string
          is_published?: boolean
          metadata?: Json
          professional_id?: string
          published_at?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_library_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professional_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cron_heartbeats: {
        Row: {
          consecutive_failures: number
          job: string
          last_duration_ms: number | null
          last_error: string | null
          last_ok_at: string | null
          last_run_at: string | null
          schedule_seconds: number
        }
        Insert: {
          consecutive_failures?: number
          job: string
          last_duration_ms?: number | null
          last_error?: string | null
          last_ok_at?: string | null
          last_run_at?: string | null
          schedule_seconds?: number
        }
        Update: {
          consecutive_failures?: number
          job?: string
          last_duration_ms?: number | null
          last_error?: string | null
          last_ok_at?: string | null
          last_run_at?: string | null
          schedule_seconds?: number
        }
        Relationships: []
      }
      customer_profiles: {
        Row: {
          area: string | null
          connection_count: number
          contact_preference: Database["public"]["Enums"]["contact_preference"]
          created_at: string
          date_of_birth: string | null
          id: string
          id_document_1_url: string | null
          id_document_2_url: string | null
          kyc_rejection_reason: string | null
          kyc_status: Database["public"]["Enums"]["customer_kyc_status"]
          kyc_submitted_at: string | null
          kyc_verified_at: string | null
          kyc_verified_by: string | null
          selfie_url: string | null
          updated_at: string
          user_id: string
          verified_address: string | null
        }
        Insert: {
          area?: string | null
          connection_count?: number
          contact_preference?: Database["public"]["Enums"]["contact_preference"]
          created_at?: string
          date_of_birth?: string | null
          id?: string
          id_document_1_url?: string | null
          id_document_2_url?: string | null
          kyc_rejection_reason?: string | null
          kyc_status?: Database["public"]["Enums"]["customer_kyc_status"]
          kyc_submitted_at?: string | null
          kyc_verified_at?: string | null
          kyc_verified_by?: string | null
          selfie_url?: string | null
          updated_at?: string
          user_id: string
          verified_address?: string | null
        }
        Update: {
          area?: string | null
          connection_count?: number
          contact_preference?: Database["public"]["Enums"]["contact_preference"]
          created_at?: string
          date_of_birth?: string | null
          id?: string
          id_document_1_url?: string | null
          id_document_2_url?: string | null
          kyc_rejection_reason?: string | null
          kyc_status?: Database["public"]["Enums"]["customer_kyc_status"]
          kyc_submitted_at?: string | null
          kyc_verified_at?: string | null
          kyc_verified_by?: string | null
          selfie_url?: string | null
          updated_at?: string
          user_id?: string
          verified_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_profiles_kyc_verified_by_fkey"
            columns: ["kyc_verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      device_push_tokens: {
        Row: {
          app: string
          created_at: string
          device_name: string | null
          id: string
          last_seen_at: string
          platform: string
          revoked_at: string | null
          token: string
          user_id: string
        }
        Insert: {
          app: string
          created_at?: string
          device_name?: string | null
          id?: string
          last_seen_at?: string
          platform: string
          revoked_at?: string | null
          token: string
          user_id: string
        }
        Update: {
          app?: string
          created_at?: string
          device_name?: string | null
          id?: string
          last_seen_at?: string
          platform?: string
          revoked_at?: string | null
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          category: Database["public"]["Enums"]["dispute_category"]
          created_at: string
          customer_id: string | null
          description: string
          enquiry_id: string | null
          id: string
          professional_id: string
          raised_by: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          review_id: string | null
          status: Database["public"]["Enums"]["dispute_status"]
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["dispute_category"]
          created_at?: string
          customer_id?: string | null
          description: string
          enquiry_id?: string | null
          id?: string
          professional_id: string
          raised_by: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          review_id?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["dispute_category"]
          created_at?: string
          customer_id?: string | null
          description?: string
          enquiry_id?: string | null
          id?: string
          professional_id?: string
          raised_by?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          review_id?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_enquiry_id_fkey"
            columns: ["enquiry_id"]
            isOneToOne: false
            referencedRelation: "job_enquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professional_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_raised_by_fkey"
            columns: ["raised_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_referrals: {
        Row: {
          clicked_at: string
          id: string
          ip_hash: string | null
          professional_id: string
          referral_url: string
          user_agent: string | null
        }
        Insert: {
          clicked_at?: string
          id?: string
          ip_hash?: string | null
          professional_id: string
          referral_url: string
          user_agent?: string | null
        }
        Update: {
          clicked_at?: string
          id?: string
          ip_hash?: string | null
          professional_id?: string
          referral_url?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insurance_referrals_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professional_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          acknowledged_at: string | null
          created_at: string
          customer_address: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          due_date: string | null
          generated_by: string
          id: string
          invoice_number: string
          job_id: string | null
          last_reminder_at: string | null
          line_items: Json
          next_reminder_at: string | null
          notes: string | null
          paid_at: string | null
          pdf_url: string | null
          professional_id: string
          public_token: string
          quote_id: string | null
          recurring_invoice_id: string | null
          reminder_count: number
          sent_at: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal_ttd: number
          template_id: string | null
          total_ttd: number
          updated_at: string
          vat_amount_ttd: number
          vat_percent: number
          viewed_at: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          created_at?: string
          customer_address?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          due_date?: string | null
          generated_by?: string
          id?: string
          invoice_number: string
          job_id?: string | null
          last_reminder_at?: string | null
          line_items?: Json
          next_reminder_at?: string | null
          notes?: string | null
          paid_at?: string | null
          pdf_url?: string | null
          professional_id: string
          public_token?: string
          quote_id?: string | null
          recurring_invoice_id?: string | null
          reminder_count?: number
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal_ttd: number
          template_id?: string | null
          total_ttd: number
          updated_at?: string
          vat_amount_ttd?: number
          vat_percent?: number
          viewed_at?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          created_at?: string
          customer_address?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          due_date?: string | null
          generated_by?: string
          id?: string
          invoice_number?: string
          job_id?: string | null
          last_reminder_at?: string | null
          line_items?: Json
          next_reminder_at?: string | null
          notes?: string | null
          paid_at?: string | null
          pdf_url?: string | null
          professional_id?: string
          public_token?: string
          quote_id?: string | null
          recurring_invoice_id?: string | null
          reminder_count?: number
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal_ttd?: number
          template_id?: string | null
          total_ttd?: number
          updated_at?: string
          vat_amount_ttd?: number
          vat_percent?: number
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professional_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_recurring_invoice_id_fkey"
            columns: ["recurring_invoice_id"]
            isOneToOne: false
            referencedRelation: "recurring_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "profile_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      job_enquiries: {
        Row: {
          accepted_at: string | null
          agreed_price_ttd: number | null
          agreed_timeline: string | null
          category_id: string | null
          completed_at: string | null
          contact_preference: Database["public"]["Enums"]["contact_preference"]
          conversation_outcome:
            | Database["public"]["Enums"]["conversation_outcome"]
            | null
          created_at: string
          customer_id: string
          declined_reason: string | null
          description: string
          id: string
          preferred_date: string | null
          professional_id: string
          professional_notes: string | null
          scope_note: string | null
          source: Database["public"]["Enums"]["job_source"]
          status: Database["public"]["Enums"]["enquiry_status"]
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          agreed_price_ttd?: number | null
          agreed_timeline?: string | null
          category_id?: string | null
          completed_at?: string | null
          contact_preference?: Database["public"]["Enums"]["contact_preference"]
          conversation_outcome?:
            | Database["public"]["Enums"]["conversation_outcome"]
            | null
          created_at?: string
          customer_id: string
          declined_reason?: string | null
          description: string
          id?: string
          preferred_date?: string | null
          professional_id: string
          professional_notes?: string | null
          scope_note?: string | null
          source?: Database["public"]["Enums"]["job_source"]
          status?: Database["public"]["Enums"]["enquiry_status"]
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          agreed_price_ttd?: number | null
          agreed_timeline?: string | null
          category_id?: string | null
          completed_at?: string | null
          contact_preference?: Database["public"]["Enums"]["contact_preference"]
          conversation_outcome?:
            | Database["public"]["Enums"]["conversation_outcome"]
            | null
          created_at?: string
          customer_id?: string
          declined_reason?: string | null
          description?: string
          id?: string
          preferred_date?: string | null
          professional_id?: string
          professional_notes?: string | null
          scope_note?: string | null
          source?: Database["public"]["Enums"]["job_source"]
          status?: Database["public"]["Enums"]["enquiry_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_enquiries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_enquiries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_enquiries_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professional_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_logs: {
        Row: {
          created_at: string
          event_type: Database["public"]["Enums"]["job_log_event"]
          id: string
          job_id: string
          new_value: string | null
          note: string | null
          old_value: string | null
          performed_by: Database["public"]["Enums"]["job_log_actor"]
        }
        Insert: {
          created_at?: string
          event_type: Database["public"]["Enums"]["job_log_event"]
          id?: string
          job_id: string
          new_value?: string | null
          note?: string | null
          old_value?: string | null
          performed_by?: Database["public"]["Enums"]["job_log_actor"]
        }
        Update: {
          created_at?: string
          event_type?: Database["public"]["Enums"]["job_log_event"]
          id?: string
          job_id?: string
          new_value?: string | null
          note?: string | null
          old_value?: string | null
          performed_by?: Database["public"]["Enums"]["job_log_actor"]
        }
        Relationships: [
          {
            foreignKeyName: "job_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          accepted_at: string | null
          completed_at: string | null
          completion_deadline: string | null
          completion_timer_hours: number
          created_at: string
          customer_address: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          deleted_at: string | null
          enquiry_id: string | null
          id: string
          in_progress_at: string | null
          invoice_id: string | null
          invoiced_at: string | null
          is_external: boolean
          job_value_ttd: number | null
          notes: string | null
          professional_id: string
          quote_id: string | null
          review_id: string | null
          review_requested: boolean
          review_requested_at: string | null
          service_description: string
          source: Database["public"]["Enums"]["job_source"]
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          completed_at?: string | null
          completion_deadline?: string | null
          completion_timer_hours?: number
          created_at?: string
          customer_address?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          deleted_at?: string | null
          enquiry_id?: string | null
          id?: string
          in_progress_at?: string | null
          invoice_id?: string | null
          invoiced_at?: string | null
          is_external?: boolean
          job_value_ttd?: number | null
          notes?: string | null
          professional_id: string
          quote_id?: string | null
          review_id?: string | null
          review_requested?: boolean
          review_requested_at?: string | null
          service_description: string
          source?: Database["public"]["Enums"]["job_source"]
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          completed_at?: string | null
          completion_deadline?: string | null
          completion_timer_hours?: number
          created_at?: string
          customer_address?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          deleted_at?: string | null
          enquiry_id?: string | null
          id?: string
          in_progress_at?: string | null
          invoice_id?: string | null
          invoiced_at?: string | null
          is_external?: boolean
          job_value_ttd?: number | null
          notes?: string | null
          professional_id?: string
          quote_id?: string | null
          review_id?: string | null
          review_requested?: boolean
          review_requested_at?: string | null
          service_description?: string
          source?: Database["public"]["Enums"]["job_source"]
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_enquiry_id_fkey"
            columns: ["enquiry_id"]
            isOneToOne: false
            referencedRelation: "job_enquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professional_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_acceptances: {
        Row: {
          accepted_at: string
          created_at: string
          document_type: string
          document_version: string
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string
          created_at?: string
          document_type: string
          document_version: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string
          created_at?: string
          document_type?: string
          document_version?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_acceptances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_deliveries: {
        Row: {
          attempts: number
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          delivered_at: string | null
          entity_id: string | null
          entity_type: string | null
          event_type: string
          failed_reason: string | null
          id: string
          last_attempt_at: string | null
          next_attempt_at: string | null
          provider_message_id: string | null
          recipient_hash: string | null
          status: Database["public"]["Enums"]["notification_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          attempts?: number
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          delivered_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          failed_reason?: string | null
          id?: string
          last_attempt_at?: string | null
          next_attempt_at?: string | null
          provider_message_id?: string | null
          recipient_hash?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          attempts?: number
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          delivered_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          failed_reason?: string | null
          id?: string
          last_attempt_at?: string | null
          next_attempt_at?: string | null
          provider_message_id?: string | null
          recipient_hash?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_flags: {
        Row: {
          disabled_reason: string | null
          enabled: boolean
          event_type: string
          updated_at: string
        }
        Insert: {
          disabled_reason?: string | null
          enabled?: boolean
          event_type: string
          updated_at?: string
        }
        Update: {
          disabled_reason?: string | null
          enabled?: boolean
          event_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          enabled: boolean
          event_type: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          enabled?: boolean
          event_type: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          enabled?: boolean
          event_type?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      offerings: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          display_order: number
          duration_minutes: number | null
          id: string
          is_active: boolean
          name: string
          price_ttd: number | null
          price_unit: string | null
          professional_id: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          duration_minutes?: number | null
          id?: string
          is_active?: boolean
          name: string
          price_ttd?: number | null
          price_unit?: string | null
          professional_id: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          duration_minutes?: number | null
          id?: string
          is_active?: boolean
          name?: string
          price_ttd?: number | null
          price_unit?: string | null
          professional_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offerings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offerings_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professional_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_refunded_ttd: number
          amount_ttd: number
          billing_period_key: string | null
          created_at: string
          id: string
          invoice_number: string | null
          kind: string
          notes: string | null
          paid_at: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          professional_id: string
          provider_event_id: string | null
          refunded_at: string | null
          status: Database["public"]["Enums"]["payment_status"]
          subscription_id: string | null
          transaction_reference: string | null
          updated_at: string
        }
        Insert: {
          amount_refunded_ttd?: number
          amount_ttd: number
          billing_period_key?: string | null
          created_at?: string
          id?: string
          invoice_number?: string | null
          kind?: string
          notes?: string | null
          paid_at?: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          professional_id: string
          provider_event_id?: string | null
          refunded_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          subscription_id?: string | null
          transaction_reference?: string | null
          updated_at?: string
        }
        Update: {
          amount_refunded_ttd?: number
          amount_ttd?: number
          billing_period_key?: string | null
          created_at?: string
          id?: string
          invoice_number?: string | null
          kind?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          professional_id?: string
          provider_event_id?: string | null
          refunded_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          subscription_id?: string | null
          transaction_reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professional_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      pioneer_cohort_counters: {
        Row: {
          cap: number
          category_id: string
          enrolled_count: number
          updated_at: string
        }
        Insert: {
          cap?: number
          category_id: string
          enrolled_count?: number
          updated_at?: string
        }
        Update: {
          cap?: number
          category_id?: string
          enrolled_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pioneer_cohort_counters_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: true
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_profiles: {
        Row: {
          availability: Database["public"]["Enums"]["availability_type"] | null
          average_rating: number | null
          bio: string | null
          business_address: string | null
          business_hours: Json | null
          business_name: string
          business_type: Database["public"]["Enums"]["business_type"]
          category_id: string | null
          certifications: Json | null
          contact_phone: string | null
          contact_whatsapp: string | null
          cover_photo_url: string | null
          created_at: string
          date_of_birth: string | null
          employee_range: string | null
          google_place_id: string | null
          has_insurance: boolean
          home_address: string | null
          id: string
          instagram_handle: string | null
          insurance_cert_url: string | null
          insurance_expires_at: string | null
          insurance_policy_number: string | null
          insurance_provider: string | null
          insurance_type: string | null
          insurance_verified_at: string | null
          insurance_verified_by: string | null
          is_organisation: boolean
          latitude: number | null
          listing_status: Database["public"]["Enums"]["listing_status"]
          longitude: number | null
          national_id_back_url: string | null
          national_id_url: string | null
          national_id_verified: boolean
          national_id_verified_at: string | null
          national_id_verified_by: string | null
          onboarding_step: number
          owner_name: string
          portfolio_urls: string[]
          profile_photo_url: string | null
          review_count: number
          search_vector: unknown
          secondary_category_ids: string[]
          selfie_url: string | null
          service_areas: string[]
          services: Json
          slug: string | null
          tagline: string | null
          tenure_started: string | null
          updated_at: string
          user_id: string
          verification_status: Database["public"]["Enums"]["verification_status"]
          website_url: string | null
        }
        Insert: {
          availability?: Database["public"]["Enums"]["availability_type"] | null
          average_rating?: number | null
          bio?: string | null
          business_address?: string | null
          business_hours?: Json | null
          business_name: string
          business_type?: Database["public"]["Enums"]["business_type"]
          category_id?: string | null
          certifications?: Json | null
          contact_phone?: string | null
          contact_whatsapp?: string | null
          cover_photo_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          employee_range?: string | null
          google_place_id?: string | null
          has_insurance?: boolean
          home_address?: string | null
          id?: string
          instagram_handle?: string | null
          insurance_cert_url?: string | null
          insurance_expires_at?: string | null
          insurance_policy_number?: string | null
          insurance_provider?: string | null
          insurance_type?: string | null
          insurance_verified_at?: string | null
          insurance_verified_by?: string | null
          is_organisation?: boolean
          latitude?: number | null
          listing_status?: Database["public"]["Enums"]["listing_status"]
          longitude?: number | null
          national_id_back_url?: string | null
          national_id_url?: string | null
          national_id_verified?: boolean
          national_id_verified_at?: string | null
          national_id_verified_by?: string | null
          onboarding_step?: number
          owner_name: string
          portfolio_urls?: string[]
          profile_photo_url?: string | null
          review_count?: number
          search_vector?: unknown
          secondary_category_ids?: string[]
          selfie_url?: string | null
          service_areas?: string[]
          services?: Json
          slug?: string | null
          tagline?: string | null
          tenure_started?: string | null
          updated_at?: string
          user_id: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
          website_url?: string | null
        }
        Update: {
          availability?: Database["public"]["Enums"]["availability_type"] | null
          average_rating?: number | null
          bio?: string | null
          business_address?: string | null
          business_hours?: Json | null
          business_name?: string
          business_type?: Database["public"]["Enums"]["business_type"]
          category_id?: string | null
          certifications?: Json | null
          contact_phone?: string | null
          contact_whatsapp?: string | null
          cover_photo_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          employee_range?: string | null
          google_place_id?: string | null
          has_insurance?: boolean
          home_address?: string | null
          id?: string
          instagram_handle?: string | null
          insurance_cert_url?: string | null
          insurance_expires_at?: string | null
          insurance_policy_number?: string | null
          insurance_provider?: string | null
          insurance_type?: string | null
          insurance_verified_at?: string | null
          insurance_verified_by?: string | null
          is_organisation?: boolean
          latitude?: number | null
          listing_status?: Database["public"]["Enums"]["listing_status"]
          longitude?: number | null
          national_id_back_url?: string | null
          national_id_url?: string | null
          national_id_verified?: boolean
          national_id_verified_at?: string | null
          national_id_verified_by?: string | null
          onboarding_step?: number
          owner_name?: string
          portfolio_urls?: string[]
          profile_photo_url?: string | null
          review_count?: number
          search_vector?: unknown
          secondary_category_ids?: string[]
          selfie_url?: string | null
          service_areas?: string[]
          services?: Json
          slug?: string | null
          tagline?: string | null
          tenure_started?: string | null
          updated_at?: string
          user_id?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professional_profiles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_profiles_insurance_verified_by_fkey"
            columns: ["insurance_verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_profiles_national_id_verified_by_fkey"
            columns: ["national_id_verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_templates: {
        Row: {
          color: string
          created_at: string
          cta_label: string
          display_order: number
          icon: string
          id: string
          is_active: boolean
          label: string
          optional_fields: Json
          pricing_format: string
          pricing_label: string
          primary_cta: string
          primary_fields: Json
          sections: Json
          suggested_services: Json
          trust_badges: Json
          updated_at: string
        }
        Insert: {
          color: string
          created_at?: string
          cta_label?: string
          display_order?: number
          icon: string
          id: string
          is_active?: boolean
          label: string
          optional_fields?: Json
          pricing_format?: string
          pricing_label?: string
          primary_cta?: string
          primary_fields?: Json
          sections?: Json
          suggested_services?: Json
          trust_badges?: Json
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          cta_label?: string
          display_order?: number
          icon?: string
          id?: string
          is_active?: boolean
          label?: string
          optional_fields?: Json
          pricing_format?: string
          pricing_label?: string
          primary_cta?: string
          primary_fields?: Json
          sections?: Json
          suggested_services?: Json
          trust_badges?: Json
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_status: Database["public"]["Enums"]["account_status"]
          avatar_url: string | null
          created_at: string
          email: string
          email_verified: boolean
          full_name: string | null
          id: string
          phone_number: string | null
          phone_verified: boolean
          professional_subtype:
            | Database["public"]["Enums"]["professional_subtype"]
            | null
          role: Database["public"]["Enums"]["user_role"]
          role_change_count: number
          role_confirmed: boolean
          role_selected_at: string | null
          updated_at: string
        }
        Insert: {
          account_status?: Database["public"]["Enums"]["account_status"]
          avatar_url?: string | null
          created_at?: string
          email: string
          email_verified?: boolean
          full_name?: string | null
          id: string
          phone_number?: string | null
          phone_verified?: boolean
          professional_subtype?:
            | Database["public"]["Enums"]["professional_subtype"]
            | null
          role?: Database["public"]["Enums"]["user_role"]
          role_change_count?: number
          role_confirmed?: boolean
          role_selected_at?: string | null
          updated_at?: string
        }
        Update: {
          account_status?: Database["public"]["Enums"]["account_status"]
          avatar_url?: string | null
          created_at?: string
          email?: string
          email_verified?: boolean
          full_name?: string | null
          id?: string
          phone_number?: string | null
          phone_verified?: boolean
          professional_subtype?:
            | Database["public"]["Enums"]["professional_subtype"]
            | null
          role?: Database["public"]["Enums"]["user_role"]
          role_change_count?: number
          role_confirmed?: boolean
          role_selected_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      quotes: {
        Row: {
          converted_job_id: string | null
          created_at: string
          customer_address: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          enquiry_id: string | null
          id: string
          line_items: Json
          notes: string | null
          professional_id: string
          public_token: string
          responded_at: string | null
          response_note: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["quote_status"]
          subtotal_ttd: number
          supersedes_quote_id: string | null
          total_ttd: number
          updated_at: string
          valid_until: string | null
          vat_amount_ttd: number
          vat_percent: number
          viewed_at: string | null
        }
        Insert: {
          converted_job_id?: string | null
          created_at?: string
          customer_address?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          enquiry_id?: string | null
          id?: string
          line_items?: Json
          notes?: string | null
          professional_id: string
          public_token?: string
          responded_at?: string | null
          response_note?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal_ttd: number
          supersedes_quote_id?: string | null
          total_ttd: number
          updated_at?: string
          valid_until?: string | null
          vat_amount_ttd?: number
          vat_percent?: number
          viewed_at?: string | null
        }
        Update: {
          converted_job_id?: string | null
          created_at?: string
          customer_address?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          enquiry_id?: string | null
          id?: string
          line_items?: Json
          notes?: string | null
          professional_id?: string
          public_token?: string
          responded_at?: string | null
          response_note?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal_ttd?: number
          supersedes_quote_id?: string | null
          total_ttd?: number
          updated_at?: string
          valid_until?: string | null
          vat_amount_ttd?: number
          vat_percent?: number
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_converted_job_id_fkey"
            columns: ["converted_job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_enquiry_id_fkey"
            columns: ["enquiry_id"]
            isOneToOne: false
            referencedRelation: "job_enquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professional_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_supersedes_quote_id_fkey"
            columns: ["supersedes_quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliation_findings: {
        Row: {
          detail: Json
          external_reference: string | null
          finding_type: string
          found_at: string
          id: string
          payment_id: string | null
          resolution_note: string | null
          resolved_at: string | null
          severity: string
          source: string
          subscription_id: string | null
        }
        Insert: {
          detail?: Json
          external_reference?: string | null
          finding_type: string
          found_at?: string
          id?: string
          payment_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          severity?: string
          source: string
          subscription_id?: string | null
        }
        Update: {
          detail?: Json
          external_reference?: string | null
          finding_type?: string
          found_at?: string
          id?: string
          payment_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          severity?: string
          source?: string
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_findings_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_findings_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_invoices: {
        Row: {
          created_at: string
          customer_address: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          frequency: Database["public"]["Enums"]["invoice_frequency"]
          id: string
          invoices_generated: number
          is_active: boolean
          last_sent_at: string | null
          line_items: Json
          next_send_date: string
          notes: string | null
          professional_id: string
          subtotal_ttd: number
          template_id: string | null
          total_ttd: number
          updated_at: string
          vat_amount_ttd: number
          vat_percent: number
        }
        Insert: {
          created_at?: string
          customer_address?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          frequency?: Database["public"]["Enums"]["invoice_frequency"]
          id?: string
          invoices_generated?: number
          is_active?: boolean
          last_sent_at?: string | null
          line_items?: Json
          next_send_date: string
          notes?: string | null
          professional_id: string
          subtotal_ttd: number
          template_id?: string | null
          total_ttd: number
          updated_at?: string
          vat_amount_ttd?: number
          vat_percent?: number
        }
        Update: {
          created_at?: string
          customer_address?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          frequency?: Database["public"]["Enums"]["invoice_frequency"]
          id?: string
          invoices_generated?: number
          is_active?: boolean
          last_sent_at?: string | null
          line_items?: Json
          next_send_date?: string
          notes?: string | null
          professional_id?: string
          subtotal_ttd?: number
          template_id?: string | null
          total_ttd?: number
          updated_at?: string
          vat_amount_ttd?: number
          vat_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "recurring_invoices_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professional_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_invoices_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "profile_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_cases: {
        Row: {
          alternate_names: string[]
          completed_at: string | null
          created_at: string
          fee_ttd: number | null
          id: string
          notes: string | null
          paid_at: string | null
          proposed_business_name: string | null
          registration_number: string | null
          status: string
          submitted_at: string | null
          track: string
          updated_at: string
          user_id: string
        }
        Insert: {
          alternate_names?: string[]
          completed_at?: string | null
          created_at?: string
          fee_ttd?: number | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          proposed_business_name?: string | null
          registration_number?: string | null
          status?: string
          submitted_at?: string | null
          track?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          alternate_names?: string[]
          completed_at?: string | null
          created_at?: string
          fee_ttd?: number | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          proposed_business_name?: string | null
          registration_number?: string | null
          status?: string
          submitted_at?: string | null
          track?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "registration_cases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          created_at: string
          customer_id: string | null
          id: string
          is_seeded: boolean
          job_enquiry_id: string | null
          moderated_at: string | null
          moderated_by: string | null
          photo_url: string | null
          professional_id: string
          rejection_reason: string | null
          reviewer_name: string
          reviewer_phone: string | null
          star_rating: number
          status: Database["public"]["Enums"]["review_status"]
          testimonial: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          id?: string
          is_seeded?: boolean
          job_enquiry_id?: string | null
          moderated_at?: string | null
          moderated_by?: string | null
          photo_url?: string | null
          professional_id: string
          rejection_reason?: string | null
          reviewer_name: string
          reviewer_phone?: string | null
          star_rating: number
          status?: Database["public"]["Enums"]["review_status"]
          testimonial: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          id?: string
          is_seeded?: boolean
          job_enquiry_id?: string | null
          moderated_at?: string | null
          moderated_by?: string | null
          photo_url?: string | null
          professional_id?: string
          rejection_reason?: string | null
          reviewer_name?: string
          reviewer_phone?: string | null
          star_rating?: number
          status?: Database["public"]["Enums"]["review_status"]
          testimonial?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_job_enquiry_id_fkey"
            columns: ["job_enquiry_id"]
            isOneToOne: false
            referencedRelation: "job_enquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_moderated_by_fkey"
            columns: ["moderated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professional_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_professionals: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          professional_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          professional_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          professional_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_professionals_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_professionals_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professional_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_messages: {
        Row: {
          cancelled_at: string | null
          cancelled_reason: string | null
          created_at: string
          due_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          payload: Json
          sent_at: string | null
          trigger_type: string
          user_id: string
        }
        Insert: {
          cancelled_at?: string | null
          cancelled_reason?: string | null
          created_at?: string
          due_at: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          payload?: Json
          sent_at?: string | null
          trigger_type: string
          user_id: string
        }
        Update: {
          cancelled_at?: string | null
          cancelled_reason?: string | null
          created_at?: string
          due_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          payload?: Json
          sent_at?: string | null
          trigger_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsor_campaigns: {
        Row: {
          ad_type: Database["public"]["Enums"]["ad_type"]
          amount_paid_ttd: number | null
          clicks: number
          company_name: string
          contact_email: string
          created_at: string
          creative_url: string | null
          ends_at: string
          id: string
          impressions: number
          is_active: boolean
          link_url: string | null
          package_id: string | null
          placement_zone: string | null
          starts_at: string
          updated_at: string
          weight: number
        }
        Insert: {
          ad_type: Database["public"]["Enums"]["ad_type"]
          amount_paid_ttd?: number | null
          clicks?: number
          company_name: string
          contact_email: string
          created_at?: string
          creative_url?: string | null
          ends_at: string
          id?: string
          impressions?: number
          is_active?: boolean
          link_url?: string | null
          package_id?: string | null
          placement_zone?: string | null
          starts_at: string
          updated_at?: string
          weight?: number
        }
        Update: {
          ad_type?: Database["public"]["Enums"]["ad_type"]
          amount_paid_ttd?: number | null
          clicks?: number
          company_name?: string
          contact_email?: string
          created_at?: string
          creative_url?: string | null
          ends_at?: string
          id?: string
          impressions?: number
          is_active?: boolean
          link_url?: string | null
          package_id?: string | null
          placement_zone?: string | null
          starts_at?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_campaigns_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "ad_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      store_orders: {
        Row: {
          admin_notes: string | null
          branding: string
          color_preference: string | null
          created_at: string
          email: string
          fulfilled_at: string | null
          fulfilled_by: string | null
          full_name: string
          id: string
          notes: string | null
          payment_method: string | null
          phone: string | null
          product_id: string
          product_name: string
          product_price_ttd: number
          quantity: number
          size: string | null
          status: string
          total_ttd: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          branding?: string
          color_preference?: string | null
          created_at?: string
          email: string
          fulfilled_at?: string | null
          fulfilled_by?: string | null
          full_name: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          phone?: string | null
          product_id: string
          product_name: string
          product_price_ttd: number
          quantity?: number
          size?: string | null
          status?: string
          total_ttd: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          branding?: string
          color_preference?: string | null
          created_at?: string
          email?: string
          fulfilled_at?: string | null
          fulfilled_by?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          phone?: string | null
          product_id?: string
          product_name?: string
          product_price_ttd?: number
          quantity?: number
          size?: string | null
          status?: string
          total_ttd?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_orders_fulfilled_by_fkey"
            columns: ["fulfilled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_events: {
        Row: {
          error: string | null
          event_type: string
          id: string
          processed_at: string | null
          received_at: string
          related_object_id: string | null
        }
        Insert: {
          error?: string | null
          event_type: string
          id: string
          processed_at?: string | null
          received_at?: string
          related_object_id?: string | null
        }
        Update: {
          error?: string | null
          event_type?: string
          id?: string
          processed_at?: string | null
          received_at?: string
          related_object_id?: string | null
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          created_at: string
          display_order: number
          id: string
          includes_crm: boolean
          includes_n8n: boolean
          includes_webhooks: boolean
          is_active: boolean
          is_price_from: boolean
          monthly_price_ttd: number
          monthly_tool_credits: number | null
          name: string
          summary: string
          tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order: number
          id?: string
          includes_crm?: boolean
          includes_n8n?: boolean
          includes_webhooks?: boolean
          is_active?: boolean
          is_price_from?: boolean
          monthly_price_ttd: number
          monthly_tool_credits?: number | null
          name: string
          summary: string
          tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          includes_crm?: boolean
          includes_n8n?: boolean
          includes_webhooks?: boolean
          is_active?: boolean
          is_price_from?: boolean
          monthly_price_ttd?: number
          monthly_tool_credits?: number | null
          name?: string
          summary?: string
          tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          billing_failure_count: number
          billing_period: Database["public"]["Enums"]["billing_period"]
          cancellation_requested_at: string | null
          cancelled_at: string | null
          created_at: string
          crossover_applied_at: string | null
          current_period_end: string
          current_period_start: string
          fac_card_token: string | null
          id: string
          last_billing_attempt_at: string | null
          last_billing_period_key: string | null
          paid_months: number
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          pioneer: boolean
          pioneer_category_id: string | null
          plan_id: string
          professional_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          suspension_reason:
            | Database["public"]["Enums"]["suspension_reason"]
            | null
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          billing_failure_count?: number
          billing_period?: Database["public"]["Enums"]["billing_period"]
          cancellation_requested_at?: string | null
          cancelled_at?: string | null
          created_at?: string
          crossover_applied_at?: string | null
          current_period_end: string
          current_period_start?: string
          fac_card_token?: string | null
          id?: string
          last_billing_attempt_at?: string | null
          last_billing_period_key?: string | null
          paid_months?: number
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          pioneer?: boolean
          pioneer_category_id?: string | null
          plan_id: string
          professional_id: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          suspension_reason?:
            | Database["public"]["Enums"]["suspension_reason"]
            | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          billing_failure_count?: number
          billing_period?: Database["public"]["Enums"]["billing_period"]
          cancellation_requested_at?: string | null
          cancelled_at?: string | null
          created_at?: string
          crossover_applied_at?: string | null
          current_period_end?: string
          current_period_start?: string
          fac_card_token?: string | null
          id?: string
          last_billing_attempt_at?: string | null
          last_billing_period_key?: string | null
          paid_months?: number
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          pioneer?: boolean
          pioneer_category_id?: string | null
          plan_id?: string
          professional_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          suspension_reason?:
            | Database["public"]["Enums"]["suspension_reason"]
            | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_pioneer_category_id_fkey"
            columns: ["pioneer_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professional_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tool_credit_accounts: {
        Row: {
          balance: number
          created_at: string
          cycle_reset_at: string
          id: string
          monthly_allowance: number
          professional_id: string
          spent_this_cycle: number
          unlimited: boolean
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          cycle_reset_at?: string
          id?: string
          monthly_allowance?: number
          professional_id: string
          spent_this_cycle?: number
          unlimited?: boolean
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          cycle_reset_at?: string
          id?: string
          monthly_allowance?: number
          professional_id?: string
          spent_this_cycle?: number
          unlimited?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tool_credit_accounts_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: true
            referencedRelation: "professional_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tool_credit_bundles: {
        Row: {
          code: string
          created_at: string
          credits: number
          display_order: number
          id: string
          is_active: boolean
          name: string
          price_ttd: number
          stripe_price_id: string | null
          updated_at: string
          wipay_product_ref: string | null
        }
        Insert: {
          code: string
          created_at?: string
          credits: number
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          price_ttd: number
          stripe_price_id?: string | null
          updated_at?: string
          wipay_product_ref?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          credits?: number
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          price_ttd?: number
          stripe_price_id?: string | null
          updated_at?: string
          wipay_product_ref?: string | null
        }
        Relationships: []
      }
      tool_credit_ledger: {
        Row: {
          account_id: string
          balance_after: number
          bundle_id: string | null
          created_at: string
          delta: number
          id: string
          note: string | null
          reason: string
          reference_id: string | null
          tool_name: string | null
        }
        Insert: {
          account_id: string
          balance_after: number
          bundle_id?: string | null
          created_at?: string
          delta: number
          id?: string
          note?: string | null
          reason: string
          reference_id?: string | null
          tool_name?: string | null
        }
        Update: {
          account_id?: string
          balance_after?: number
          bundle_id?: string | null
          created_at?: string
          delta?: number
          id?: string
          note?: string | null
          reason?: string
          reference_id?: string | null
          tool_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tool_credit_ledger_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "tool_credit_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tool_credit_ledger_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "tool_credit_bundles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_activity_log: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string | null
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_activity_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_configs: {
        Row: {
          consecutive_failures: number
          created_at: string
          disabled_at: string | null
          disabled_reason: string | null
          events: string[]
          id: string
          is_active: boolean
          last_success_at: string | null
          professional_id: string
          secret_encrypted: string
          updated_at: string
          url: string
        }
        Insert: {
          consecutive_failures?: number
          created_at?: string
          disabled_at?: string | null
          disabled_reason?: string | null
          events?: string[]
          id?: string
          is_active?: boolean
          last_success_at?: string | null
          professional_id: string
          secret_encrypted: string
          updated_at?: string
          url: string
        }
        Update: {
          consecutive_failures?: number
          created_at?: string
          disabled_at?: string | null
          disabled_reason?: string | null
          events?: string[]
          id?: string
          is_active?: boolean
          last_success_at?: string | null
          professional_id?: string
          secret_encrypted?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_configs_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professional_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_delivery_log: {
        Row: {
          attempt: number
          created_at: string
          duration_ms: number | null
          error: string | null
          event_type: string
          id: string
          response_excerpt: string | null
          status_code: number | null
          succeeded: boolean
          webhook_config_id: string
        }
        Insert: {
          attempt?: number
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          event_type: string
          id?: string
          response_excerpt?: string | null
          status_code?: number | null
          succeeded?: boolean
          webhook_config_id: string
        }
        Update: {
          attempt?: number
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          event_type?: string
          id?: string
          response_excerpt?: string | null
          status_code?: number | null
          succeeded?: boolean
          webhook_config_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_delivery_log_webhook_config_id_fkey"
            columns: ["webhook_config_id"]
            isOneToOne: false
            referencedRelation: "webhook_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          created_at: string
          direction: Database["public"]["Enums"]["whatsapp_direction"]
          from_number: string
          id: string
          media_url: string | null
          message: string
          metadata: Json
          professional_id: string
          to_number: string | null
        }
        Insert: {
          created_at?: string
          direction: Database["public"]["Enums"]["whatsapp_direction"]
          from_number: string
          id?: string
          media_url?: string | null
          message: string
          metadata?: Json
          professional_id: string
          to_number?: string | null
        }
        Update: {
          created_at?: string
          direction?: Database["public"]["Enums"]["whatsapp_direction"]
          from_number?: string
          id?: string
          media_url?: string | null
          message?: string
          metadata?: Json
          professional_id?: string
          to_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professional_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_pioneer_place: {
        Args: { p_category_id: string; p_total_cap?: number }
        Returns: Json
      }
      deduct_tool_credits: {
        Args: {
          p_amount: number
          p_professional_id: string
          p_reference_id?: string
          p_tool_name: string
        }
        Returns: Json
      }
      generate_document_token: { Args: { prefix: string }; Returns: string }
      has_admin_capability: {
        Args: { capability_key: string }
        Returns: boolean
      }
      increment_campaign_clicks: {
        Args: { campaign_id: string }
        Returns: undefined
      }
      increment_campaign_impressions: {
        Args: { campaign_id: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_owner_admin: { Args: never; Returns: boolean }
      matches_grants: {
        Args: { capability_key: string; grants: Json }
        Returns: boolean
      }
      owns_professional_profile: {
        Args: { profile_id: string }
        Returns: boolean
      }
      professional_enquiry_inbox: {
        Args: never
        Returns: {
          accepted_at: string
          agreed_price_ttd: number
          agreed_timeline: string
          category_id: string
          completed_at: string
          contact_preference: Database["public"]["Enums"]["contact_preference"]
          created_at: string
          customer_first_name: string
          declined_reason: string
          description: string
          id: string
          preferred_date: string
          professional_notes: string
          scope_note: string
          source: Database["public"]["Enums"]["job_source"]
          status: Database["public"]["Enums"]["enquiry_status"]
        }[]
      }
      professional_subtypes: {
        Args: { p_user_ids: string[] }
        Returns: {
          professional_subtype: Database["public"]["Enums"]["professional_subtype"]
          user_id: string
        }[]
      }
      record_insurance_referral: {
        Args: {
          client_ip?: string
          client_user_agent?: string
          target_professional: string
          url: string
        }
        Returns: undefined
      }
      slugify: { Args: { input: string }; Returns: string }
      unique_slug: {
        Args: {
          base_text: string
          exclude_id?: string
          target_column?: string
          target_table: string
        }
        Returns: string
      }
    }
    Enums: {
      account_status: "active" | "suspended" | "pending" | "deleted"
      ad_type: "banner" | "category_sponsor" | "professional_boost"
      availability_type:
        | "full_time"
        | "part_time"
        | "project_based"
        | "by_appointment"
      billing_period: "monthly" | "quarterly" | "annual"
      booking_status: "confirmed" | "completed" | "cancelled" | "no_show"
      business_type: "service_provider" | "catalogue_business" | "hybrid"
      catalogue_poster_type: "professional" | "customer"
      contact_preference: "whatsapp" | "call" | "email"
      content_type:
        | "social_post"
        | "caption"
        | "bio"
        | "service_description"
        | "email"
        | "ad_copy"
        | "other"
      conversation_outcome: "talking" | "agreed" | "declined"
      customer_kyc_status:
        | "not_required"
        | "pending"
        | "submitted"
        | "verified"
        | "rejected"
      dispute_category:
        | "billing"
        | "service_quality"
        | "fake_review"
        | "misconduct"
        | "other"
      dispute_status: "open" | "investigating" | "resolved" | "closed"
      enquiry_status:
        | "pending"
        | "accepted"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "declined"
      invoice_frequency:
        | "weekly"
        | "fortnightly"
        | "monthly"
        | "quarterly"
        | "annually"
      invoice_status:
        | "draft"
        | "sent"
        | "viewed"
        | "paid"
        | "overdue"
        | "cancelled"
      job_log_actor: "professional" | "system" | "timer"
      job_log_event:
        | "status_change"
        | "note_added"
        | "review_requested"
        | "review_received"
        | "invoice_created"
        | "invoice_sent"
        | "timer_started"
        | "timer_expired"
        | "customer_updated"
        | "value_updated"
        | "deleted"
        | "restored"
      job_source:
        | "platform"
        | "whatsapp"
        | "phone"
        | "walk_in"
        | "referral"
        | "other"
      job_status:
        | "enquiry"
        | "accepted"
        | "in_progress"
        | "completed"
        | "invoiced"
      listing_status:
        | "draft"
        | "pending_review"
        | "active"
        | "suspended"
        | "deleted"
      notification_channel: "email" | "whatsapp" | "push" | "webhook"
      notification_status:
        | "queued"
        | "sent"
        | "delivered"
        | "failed"
        | "suppressed"
      payment_method: "stripe" | "wipay" | "fac" | "credit" | "manual"
      payment_status: "pending" | "successful" | "failed" | "refunded"
      professional_subtype:
        | "student_entrepreneur"
        | "sole_trader"
        | "registered_business"
      quote_status:
        | "draft"
        | "sent"
        | "viewed"
        | "accepted"
        | "declined"
        | "expired"
        | "converted"
      review_status: "pending" | "approved" | "featured" | "rejected"
      subscription_status:
        | "trialling"
        | "active"
        | "past_due"
        | "cancelled"
        | "paused"
      subscription_tier: "presence" | "growth" | "studio" | "pro" | "enterprise"
      suspension_reason: "nonpayment" | "policy" | "admin"
      user_role: "customer" | "professional" | "admin"
      verification_status:
        | "not_started"
        | "pending_review"
        | "id_verified"
        | "fully_verified"
        | "rejected"
      whatsapp_direction: "inbound" | "outbound"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      account_status: ["active", "suspended", "pending", "deleted"],
      ad_type: ["banner", "category_sponsor", "professional_boost"],
      availability_type: [
        "full_time",
        "part_time",
        "project_based",
        "by_appointment",
      ],
      billing_period: ["monthly", "quarterly", "annual"],
      booking_status: ["confirmed", "completed", "cancelled", "no_show"],
      business_type: ["service_provider", "catalogue_business", "hybrid"],
      catalogue_poster_type: ["professional", "customer"],
      contact_preference: ["whatsapp", "call", "email"],
      content_type: [
        "social_post",
        "caption",
        "bio",
        "service_description",
        "email",
        "ad_copy",
        "other",
      ],
      conversation_outcome: ["talking", "agreed", "declined"],
      customer_kyc_status: [
        "not_required",
        "pending",
        "submitted",
        "verified",
        "rejected",
      ],
      dispute_category: [
        "billing",
        "service_quality",
        "fake_review",
        "misconduct",
        "other",
      ],
      dispute_status: ["open", "investigating", "resolved", "closed"],
      enquiry_status: [
        "pending",
        "accepted",
        "in_progress",
        "completed",
        "cancelled",
        "declined",
      ],
      invoice_frequency: [
        "weekly",
        "fortnightly",
        "monthly",
        "quarterly",
        "annually",
      ],
      invoice_status: [
        "draft",
        "sent",
        "viewed",
        "paid",
        "overdue",
        "cancelled",
      ],
      job_log_actor: ["professional", "system", "timer"],
      job_log_event: [
        "status_change",
        "note_added",
        "review_requested",
        "review_received",
        "invoice_created",
        "invoice_sent",
        "timer_started",
        "timer_expired",
        "customer_updated",
        "value_updated",
        "deleted",
        "restored",
      ],
      job_source: [
        "platform",
        "whatsapp",
        "phone",
        "walk_in",
        "referral",
        "other",
      ],
      job_status: [
        "enquiry",
        "accepted",
        "in_progress",
        "completed",
        "invoiced",
      ],
      listing_status: [
        "draft",
        "pending_review",
        "active",
        "suspended",
        "deleted",
      ],
      notification_channel: ["email", "whatsapp", "push", "webhook"],
      notification_status: [
        "queued",
        "sent",
        "delivered",
        "failed",
        "suppressed",
      ],
      payment_method: ["stripe", "wipay", "fac", "credit", "manual"],
      payment_status: ["pending", "successful", "failed", "refunded"],
      professional_subtype: [
        "student_entrepreneur",
        "sole_trader",
        "registered_business",
      ],
      quote_status: [
        "draft",
        "sent",
        "viewed",
        "accepted",
        "declined",
        "expired",
        "converted",
      ],
      review_status: ["pending", "approved", "featured", "rejected"],
      subscription_status: [
        "trialling",
        "active",
        "past_due",
        "cancelled",
        "paused",
      ],
      subscription_tier: ["presence", "growth", "studio", "pro", "enterprise"],
      suspension_reason: ["nonpayment", "policy", "admin"],
      user_role: ["customer", "professional", "admin"],
      verification_status: [
        "not_started",
        "pending_review",
        "id_verified",
        "fully_verified",
        "rejected",
      ],
      whatsapp_direction: ["inbound", "outbound"],
    },
  },
} as const

