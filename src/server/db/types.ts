export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      admin_actions: {
        Row: {
          action: string;
          admin_user_id: string;
          after: Json | null;
          before: Json | null;
          created_at: string;
          id: number;
          reason: string;
          target_id: string;
          target_table: string;
        };
        Insert: {
          action: string;
          admin_user_id: string;
          after?: Json | null;
          before?: Json | null;
          created_at?: string;
          id?: never;
          reason: string;
          target_id: string;
          target_table: string;
        };
        Update: {
          action?: string;
          admin_user_id?: string;
          after?: Json | null;
          before?: Json | null;
          created_at?: string;
          id?: never;
          reason?: string;
          target_id?: string;
          target_table?: string;
        };
        Relationships: [
          {
            foreignKeyName: "admin_actions_admin_user_id_fkey";
            columns: ["admin_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      appointment_status_history: {
        Row: {
          appointment_id: string;
          business_id: string;
          changed_by: string | null;
          created_at: string;
          from_status: Database["public"]["Enums"]["appointment_status"] | null;
          id: number;
          reason: string | null;
          to_status: Database["public"]["Enums"]["appointment_status"];
        };
        Insert: {
          appointment_id: string;
          business_id: string;
          changed_by?: string | null;
          created_at?: string;
          from_status?: Database["public"]["Enums"]["appointment_status"] | null;
          id?: never;
          reason?: string | null;
          to_status: Database["public"]["Enums"]["appointment_status"];
        };
        Update: {
          appointment_id?: string;
          business_id?: string;
          changed_by?: string | null;
          created_at?: string;
          from_status?: Database["public"]["Enums"]["appointment_status"] | null;
          id?: never;
          reason?: string | null;
          to_status?: Database["public"]["Enums"]["appointment_status"];
        };
        Relationships: [
          {
            foreignKeyName: "appointment_status_history_appointment_id_fkey";
            columns: ["appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointment_status_history_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointment_status_history_changed_by_fkey";
            columns: ["changed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      appointments: {
        Row: {
          buffer_after_minutes: number;
          buffer_before_minutes: number;
          business_id: string;
          cancellation_reason: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          client_id: string | null;
          created_at: string;
          created_by: string | null;
          currency_code: string;
          customer_name: string;
          customer_note: string | null;
          customer_phone_e164: string | null;
          customer_user_id: string | null;
          deposit_minor: number | null;
          ends_at: string;
          final_price_minor: number | null;
          hold_expires_at: string | null;
          id: string;
          idempotency_key: string | null;
          occupied: unknown;
          payment_status: Database["public"]["Enums"]["payment_status"] | null;
          price_minor: number;
          price_type: Database["public"]["Enums"]["price_type"];
          rescheduled_from_id: string | null;
          service_id: string;
          service_name: string;
          source: Database["public"]["Enums"]["appointment_source"];
          staff_id: string;
          starts_at: string;
          status: Database["public"]["Enums"]["appointment_status"];
          updated_at: string;
        };
        Insert: {
          buffer_after_minutes?: number;
          buffer_before_minutes?: number;
          business_id: string;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          client_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency_code: string;
          customer_name: string;
          customer_note?: string | null;
          customer_phone_e164?: string | null;
          customer_user_id?: string | null;
          deposit_minor?: number | null;
          ends_at: string;
          final_price_minor?: number | null;
          hold_expires_at?: string | null;
          id?: string;
          idempotency_key?: string | null;
          occupied: unknown;
          payment_status?: Database["public"]["Enums"]["payment_status"] | null;
          price_minor: number;
          price_type: Database["public"]["Enums"]["price_type"];
          rescheduled_from_id?: string | null;
          service_id: string;
          service_name: string;
          source: Database["public"]["Enums"]["appointment_source"];
          staff_id: string;
          starts_at: string;
          status?: Database["public"]["Enums"]["appointment_status"];
          updated_at?: string;
        };
        Update: {
          buffer_after_minutes?: number;
          buffer_before_minutes?: number;
          business_id?: string;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          client_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency_code?: string;
          customer_name?: string;
          customer_note?: string | null;
          customer_phone_e164?: string | null;
          customer_user_id?: string | null;
          deposit_minor?: number | null;
          ends_at?: string;
          final_price_minor?: number | null;
          hold_expires_at?: string | null;
          id?: string;
          idempotency_key?: string | null;
          occupied?: unknown;
          payment_status?: Database["public"]["Enums"]["payment_status"] | null;
          price_minor?: number;
          price_type?: Database["public"]["Enums"]["price_type"];
          rescheduled_from_id?: string | null;
          service_id?: string;
          service_name?: string;
          source?: Database["public"]["Enums"]["appointment_source"];
          staff_id?: string;
          starts_at?: string;
          status?: Database["public"]["Enums"]["appointment_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "appointments_business_id_client_id_fkey";
            columns: ["business_id", "client_id"];
            isOneToOne: false;
            referencedRelation: "business_client_summaries";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "appointments_business_id_client_id_fkey";
            columns: ["business_id", "client_id"];
            isOneToOne: false;
            referencedRelation: "business_clients";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "appointments_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_business_id_service_id_fkey";
            columns: ["business_id", "service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "appointments_business_id_staff_id_fkey";
            columns: ["business_id", "staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "appointments_cancelled_by_fkey";
            columns: ["cancelled_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_currency_code_fkey";
            columns: ["currency_code"];
            isOneToOne: false;
            referencedRelation: "currencies";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "appointments_customer_user_id_fkey";
            columns: ["customer_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_rescheduled_from_id_fkey";
            columns: ["rescheduled_from_id"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
        ];
      };
      areas: {
        Row: {
          centroid: unknown;
          city_id: string;
          id: string;
          name: string;
          slug: string;
        };
        Insert: {
          centroid?: unknown;
          city_id: string;
          id?: string;
          name: string;
          slug: string;
        };
        Update: {
          centroid?: unknown;
          city_id?: string;
          id?: string;
          name?: string;
          slug?: string;
        };
        Relationships: [
          {
            foreignKeyName: "areas_city_id_fkey";
            columns: ["city_id"];
            isOneToOne: false;
            referencedRelation: "cities";
            referencedColumns: ["id"];
          },
        ];
      };
      blocked_times: {
        Row: {
          business_id: string;
          created_at: string;
          created_by: string | null;
          during: unknown;
          id: string;
          reason: string | null;
          staff_id: string | null;
        };
        Insert: {
          business_id: string;
          created_at?: string;
          created_by?: string | null;
          during: unknown;
          id?: string;
          reason?: string | null;
          staff_id?: string | null;
        };
        Update: {
          business_id?: string;
          created_at?: string;
          created_by?: string | null;
          during?: unknown;
          id?: string;
          reason?: string | null;
          staff_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "blocked_times_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "blocked_times_business_id_staff_id_fkey";
            columns: ["business_id", "staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "blocked_times_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      booking_rules: {
        Row: {
          allow_full_payment_online: boolean;
          allow_guest_booking: boolean;
          auto_confirm: boolean;
          buffer_after_minutes: number;
          buffer_before_minutes: number;
          business_id: string;
          cancellation_window_hours: number;
          collect_deposits_online: boolean;
          max_advance_days: number;
          min_notice_minutes: number;
          pending_hold_minutes: number;
          refund_deposit_on_no_show: boolean;
          reschedule_window_hours: number;
          slot_interval_minutes: number;
          updated_at: string;
        };
        Insert: {
          allow_full_payment_online?: boolean;
          allow_guest_booking?: boolean;
          auto_confirm?: boolean;
          buffer_after_minutes?: number;
          buffer_before_minutes?: number;
          business_id: string;
          cancellation_window_hours?: number;
          collect_deposits_online?: boolean;
          max_advance_days?: number;
          min_notice_minutes?: number;
          pending_hold_minutes?: number;
          refund_deposit_on_no_show?: boolean;
          reschedule_window_hours?: number;
          slot_interval_minutes?: number;
          updated_at?: string;
        };
        Update: {
          allow_full_payment_online?: boolean;
          allow_guest_booking?: boolean;
          auto_confirm?: boolean;
          buffer_after_minutes?: number;
          buffer_before_minutes?: number;
          business_id?: string;
          cancellation_window_hours?: number;
          collect_deposits_online?: boolean;
          max_advance_days?: number;
          min_notice_minutes?: number;
          pending_hold_minutes?: number;
          refund_deposit_on_no_show?: boolean;
          reschedule_window_hours?: number;
          slot_interval_minutes?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "booking_rules_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: true;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      business_categories: {
        Row: {
          business_id: string;
          category_id: string;
          is_primary: boolean;
        };
        Insert: {
          business_id: string;
          category_id: string;
          is_primary?: boolean;
        };
        Update: {
          business_id?: string;
          category_id?: string;
          is_primary?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "business_categories_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "business_categories_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      business_clients: {
        Row: {
          business_id: string;
          created_at: string;
          full_name: string;
          id: string;
          notes: string | null;
          phone_e164: string | null;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          business_id: string;
          created_at?: string;
          full_name: string;
          id?: string;
          notes?: string | null;
          phone_e164?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          business_id?: string;
          created_at?: string;
          full_name?: string;
          id?: string;
          notes?: string | null;
          phone_e164?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "business_clients_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "business_clients_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      business_hours: {
        Row: {
          business_id: string;
          during: unknown;
          id: string;
          weekday: number;
        };
        Insert: {
          business_id: string;
          during: unknown;
          id?: string;
          weekday: number;
        };
        Update: {
          business_id?: string;
          during?: unknown;
          id?: string;
          weekday?: number;
        };
        Relationships: [
          {
            foreignKeyName: "business_hours_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      business_locations: {
        Row: {
          address_line: string | null;
          area_id: string | null;
          business_id: string;
          city_id: string | null;
          country_code: string;
          created_at: string;
          directions: string | null;
          geo: unknown;
          id: string;
          is_primary: boolean;
          landmark: string | null;
          lat: number | null;
          lng: number | null;
          locality_text: string | null;
          region_id: string | null;
          updated_at: string;
        };
        Insert: {
          address_line?: string | null;
          area_id?: string | null;
          business_id: string;
          city_id?: string | null;
          country_code: string;
          created_at?: string;
          directions?: string | null;
          geo?: never;
          id?: string;
          is_primary?: boolean;
          landmark?: string | null;
          lat?: number | null;
          lng?: number | null;
          locality_text?: string | null;
          region_id?: string | null;
          updated_at?: string;
        };
        Update: {
          address_line?: string | null;
          area_id?: string | null;
          business_id?: string;
          city_id?: string | null;
          country_code?: string;
          created_at?: string;
          directions?: string | null;
          geo?: never;
          id?: string;
          is_primary?: boolean;
          landmark?: string | null;
          lat?: number | null;
          lng?: number | null;
          locality_text?: string | null;
          region_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "business_locations_area_id_fkey";
            columns: ["area_id"];
            isOneToOne: false;
            referencedRelation: "areas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "business_locations_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "business_locations_city_id_fkey";
            columns: ["city_id"];
            isOneToOne: false;
            referencedRelation: "cities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "business_locations_country_code_fkey";
            columns: ["country_code"];
            isOneToOne: false;
            referencedRelation: "countries";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "business_locations_region_id_fkey";
            columns: ["region_id"];
            isOneToOne: false;
            referencedRelation: "regions";
            referencedColumns: ["id"];
          },
        ];
      };
      business_members: {
        Row: {
          business_id: string;
          created_at: string;
          role: Database["public"]["Enums"]["member_role"];
          user_id: string;
        };
        Insert: {
          business_id: string;
          created_at?: string;
          role: Database["public"]["Enums"]["member_role"];
          user_id: string;
        };
        Update: {
          business_id?: string;
          created_at?: string;
          role?: Database["public"]["Enums"]["member_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "business_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      business_payout_accounts: {
        Row: {
          account_name: string;
          bank_account_number: string | null;
          bank_name: string | null;
          business_id: string;
          method: Database["public"]["Enums"]["payout_method"];
          momo_network: string | null;
          momo_number_e164: string | null;
          provider_account_ref: string | null;
          status: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          account_name: string;
          bank_account_number?: string | null;
          bank_name?: string | null;
          business_id: string;
          method: Database["public"]["Enums"]["payout_method"];
          momo_network?: string | null;
          momo_number_e164?: string | null;
          provider_account_ref?: string | null;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          account_name?: string;
          bank_account_number?: string | null;
          bank_name?: string | null;
          business_id?: string;
          method?: Database["public"]["Enums"]["payout_method"];
          momo_network?: string | null;
          momo_number_e164?: string | null;
          provider_account_ref?: string | null;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "business_payout_accounts_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: true;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "business_payout_accounts_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      business_photos: {
        Row: {
          business_id: string;
          caption: string | null;
          created_at: string;
          height: number | null;
          id: string;
          path_large: string;
          path_small: string;
          service_id: string | null;
          sort_order: number;
          width: number | null;
        };
        Insert: {
          business_id: string;
          caption?: string | null;
          created_at?: string;
          height?: number | null;
          id?: string;
          path_large: string;
          path_small: string;
          service_id?: string | null;
          sort_order?: number;
          width?: number | null;
        };
        Update: {
          business_id?: string;
          caption?: string | null;
          created_at?: string;
          height?: number | null;
          id?: string;
          path_large?: string;
          path_small?: string;
          service_id?: string | null;
          sort_order?: number;
          width?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "business_photos_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "business_photos_service_fk";
            columns: ["business_id", "service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["business_id", "id"];
          },
        ];
      };
      business_verification_notes: {
        Row: {
          business_id: string;
          note: string;
          updated_at: string;
        };
        Insert: {
          business_id: string;
          note: string;
          updated_at?: string;
        };
        Update: {
          business_id?: string;
          note?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "business_verification_notes_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: true;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      businesses: {
        Row: {
          country_code: string;
          cover_path: string | null;
          created_at: string;
          created_by: string;
          currency_code: string;
          deleted_at: string | null;
          description: string | null;
          email: string | null;
          facebook_url: string | null;
          id: string;
          instagram_handle: string | null;
          kind: Database["public"]["Enums"]["business_kind"];
          logo_path: string | null;
          name: string;
          next_available_at: string | null;
          notify_new_booking_sms: boolean;
          phone_e164: string | null;
          published_at: string | null;
          rating_avg: number | null;
          rating_count: number;
          search_document: unknown;
          slug: string;
          status: Database["public"]["Enums"]["business_status"];
          tiktok_handle: string | null;
          timezone: string;
          updated_at: string;
          verification_requested_at: string | null;
          verification_status: Database["public"]["Enums"]["business_verification"];
          verified_at: string | null;
          website_url: string | null;
          whatsapp_e164: string | null;
          x_handle: string | null;
          youtube_url: string | null;
        };
        Insert: {
          country_code: string;
          cover_path?: string | null;
          created_at?: string;
          created_by: string;
          currency_code: string;
          deleted_at?: string | null;
          description?: string | null;
          email?: string | null;
          facebook_url?: string | null;
          id?: string;
          instagram_handle?: string | null;
          kind?: Database["public"]["Enums"]["business_kind"];
          logo_path?: string | null;
          name: string;
          next_available_at?: string | null;
          notify_new_booking_sms?: boolean;
          phone_e164?: string | null;
          published_at?: string | null;
          rating_avg?: number | null;
          rating_count?: number;
          search_document?: unknown;
          slug: string;
          status?: Database["public"]["Enums"]["business_status"];
          tiktok_handle?: string | null;
          timezone?: string;
          updated_at?: string;
          verification_requested_at?: string | null;
          verification_status?: Database["public"]["Enums"]["business_verification"];
          verified_at?: string | null;
          website_url?: string | null;
          whatsapp_e164?: string | null;
          x_handle?: string | null;
          youtube_url?: string | null;
        };
        Update: {
          country_code?: string;
          cover_path?: string | null;
          created_at?: string;
          created_by?: string;
          currency_code?: string;
          deleted_at?: string | null;
          description?: string | null;
          email?: string | null;
          facebook_url?: string | null;
          id?: string;
          instagram_handle?: string | null;
          kind?: Database["public"]["Enums"]["business_kind"];
          logo_path?: string | null;
          name?: string;
          next_available_at?: string | null;
          notify_new_booking_sms?: boolean;
          phone_e164?: string | null;
          published_at?: string | null;
          rating_avg?: number | null;
          rating_count?: number;
          search_document?: unknown;
          slug?: string;
          status?: Database["public"]["Enums"]["business_status"];
          tiktok_handle?: string | null;
          timezone?: string;
          updated_at?: string;
          verification_requested_at?: string | null;
          verification_status?: Database["public"]["Enums"]["business_verification"];
          verified_at?: string | null;
          website_url?: string | null;
          whatsapp_e164?: string | null;
          x_handle?: string | null;
          youtube_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "businesses_country_code_fkey";
            columns: ["country_code"];
            isOneToOne: false;
            referencedRelation: "countries";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "businesses_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "businesses_currency_code_fkey";
            columns: ["currency_code"];
            isOneToOne: false;
            referencedRelation: "currencies";
            referencedColumns: ["code"];
          },
        ];
      };
      categories: {
        Row: {
          created_at: string;
          description: string | null;
          icon: string | null;
          id: string;
          is_active: boolean;
          name: string;
          parent_id: string | null;
          search_keywords: string[];
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          icon?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          parent_id?: string | null;
          search_keywords?: string[];
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          icon?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          parent_id?: string | null;
          search_keywords?: string[];
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      cities: {
        Row: {
          centroid: unknown;
          id: string;
          name: string;
          region_id: string;
          slug: string;
        };
        Insert: {
          centroid?: unknown;
          id?: string;
          name: string;
          region_id: string;
          slug: string;
        };
        Update: {
          centroid?: unknown;
          id?: string;
          name?: string;
          region_id?: string;
          slug?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cities_region_id_fkey";
            columns: ["region_id"];
            isOneToOne: false;
            referencedRelation: "regions";
            referencedColumns: ["id"];
          },
        ];
      };
      consents: {
        Row: {
          created_at: string;
          granted: boolean;
          id: string;
          kind: string;
          source: string;
          user_id: string;
          version: string;
        };
        Insert: {
          created_at?: string;
          granted: boolean;
          id?: string;
          kind: string;
          source: string;
          user_id: string;
          version: string;
        };
        Update: {
          created_at?: string;
          granted?: boolean;
          id?: string;
          kind?: string;
          source?: string;
          user_id?: string;
          version?: string;
        };
        Relationships: [
          {
            foreignKeyName: "consents_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      countries: {
        Row: {
          calling_code: string;
          code: string;
          currency_code: string;
          default_timezone: string;
          is_active: boolean;
          name: string;
        };
        Insert: {
          calling_code: string;
          code: string;
          currency_code: string;
          default_timezone: string;
          is_active?: boolean;
          name: string;
        };
        Update: {
          calling_code?: string;
          code?: string;
          currency_code?: string;
          default_timezone?: string;
          is_active?: boolean;
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "countries_currency_code_fkey";
            columns: ["currency_code"];
            isOneToOne: false;
            referencedRelation: "currencies";
            referencedColumns: ["code"];
          },
        ];
      };
      currencies: {
        Row: {
          code: string;
          minor_unit: number;
          name: string;
          symbol: string;
        };
        Insert: {
          code: string;
          minor_unit?: number;
          name: string;
          symbol: string;
        };
        Update: {
          code?: string;
          minor_unit?: number;
          name?: string;
          symbol?: string;
        };
        Relationships: [];
      };
      favorites: {
        Row: {
          business_id: string;
          created_at: string;
          user_id: string;
        };
        Insert: {
          business_id: string;
          created_at?: string;
          user_id: string;
        };
        Update: {
          business_id?: string;
          created_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "favorites_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "favorites_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          appointment_id: string | null;
          attempts: number;
          business_id: string | null;
          channel: Database["public"]["Enums"]["notification_channel"];
          claimed_at: string | null;
          created_at: string;
          dedupe_key: string | null;
          id: string;
          last_error: string | null;
          locale: string;
          payload: NonNullable<Json>;
          provider: string | null;
          provider_message_id: string | null;
          read_at: string | null;
          recipient_address: string | null;
          recipient_user_id: string | null;
          scheduled_for: string;
          sent_at: string | null;
          status: Database["public"]["Enums"]["notification_status"];
          template_key: string;
        };
        Insert: {
          appointment_id?: string | null;
          attempts?: number;
          business_id?: string | null;
          channel: Database["public"]["Enums"]["notification_channel"];
          claimed_at?: string | null;
          created_at?: string;
          dedupe_key?: string | null;
          id?: string;
          last_error?: string | null;
          locale?: string;
          payload?: NonNullable<Json>;
          provider?: string | null;
          provider_message_id?: string | null;
          read_at?: string | null;
          recipient_address?: string | null;
          recipient_user_id?: string | null;
          scheduled_for?: string;
          sent_at?: string | null;
          status?: Database["public"]["Enums"]["notification_status"];
          template_key: string;
        };
        Update: {
          appointment_id?: string | null;
          attempts?: number;
          business_id?: string | null;
          channel?: Database["public"]["Enums"]["notification_channel"];
          claimed_at?: string | null;
          created_at?: string;
          dedupe_key?: string | null;
          id?: string;
          last_error?: string | null;
          locale?: string;
          payload?: NonNullable<Json>;
          provider?: string | null;
          provider_message_id?: string | null;
          read_at?: string | null;
          recipient_address?: string | null;
          recipient_user_id?: string | null;
          scheduled_for?: string;
          sent_at?: string | null;
          status?: Database["public"]["Enums"]["notification_status"];
          template_key?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_appointment_id_fkey";
            columns: ["appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_recipient_user_id_fkey";
            columns: ["recipient_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_events: {
        Row: {
          id: string;
          payload: NonNullable<Json>;
          payment_id: string | null;
          provider: string;
          provider_event_id: string;
          received_at: string;
          result: string | null;
        };
        Insert: {
          id?: string;
          payload?: NonNullable<Json>;
          payment_id?: string | null;
          provider: string;
          provider_event_id: string;
          received_at?: string;
          result?: string | null;
        };
        Update: {
          id?: string;
          payload?: NonNullable<Json>;
          payment_id?: string | null;
          provider?: string;
          provider_event_id?: string;
          received_at?: string;
          result?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payment_events_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: false;
            referencedRelation: "payments";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          amount_minor: number;
          appointment_id: string;
          business_id: string;
          created_at: string;
          currency_code: string;
          customer_user_id: string | null;
          failure_reason: string | null;
          id: string;
          idempotency_key: string;
          kind: Database["public"]["Enums"]["payment_kind"];
          method: Database["public"]["Enums"]["payment_method"];
          momo_network: string | null;
          next_refund_at: string | null;
          note: string | null;
          paid_at: string | null;
          payer_phone_e164: string | null;
          provider: string;
          provider_reference: string | null;
          recorded_by: string | null;
          refund_attempts: number;
          refund_reference: string | null;
          refund_requested_at: string | null;
          refunded_at: string | null;
          status: Database["public"]["Enums"]["payment_attempt_status"];
          updated_at: string;
        };
        Insert: {
          amount_minor: number;
          appointment_id: string;
          business_id: string;
          created_at?: string;
          currency_code: string;
          customer_user_id?: string | null;
          failure_reason?: string | null;
          id?: string;
          idempotency_key: string;
          kind: Database["public"]["Enums"]["payment_kind"];
          method: Database["public"]["Enums"]["payment_method"];
          momo_network?: string | null;
          next_refund_at?: string | null;
          note?: string | null;
          paid_at?: string | null;
          payer_phone_e164?: string | null;
          provider: string;
          provider_reference?: string | null;
          recorded_by?: string | null;
          refund_attempts?: number;
          refund_reference?: string | null;
          refund_requested_at?: string | null;
          refunded_at?: string | null;
          status?: Database["public"]["Enums"]["payment_attempt_status"];
          updated_at?: string;
        };
        Update: {
          amount_minor?: number;
          appointment_id?: string;
          business_id?: string;
          created_at?: string;
          currency_code?: string;
          customer_user_id?: string | null;
          failure_reason?: string | null;
          id?: string;
          idempotency_key?: string;
          kind?: Database["public"]["Enums"]["payment_kind"];
          method?: Database["public"]["Enums"]["payment_method"];
          momo_network?: string | null;
          next_refund_at?: string | null;
          note?: string | null;
          paid_at?: string | null;
          payer_phone_e164?: string | null;
          provider?: string;
          provider_reference?: string | null;
          recorded_by?: string | null;
          refund_attempts?: number;
          refund_reference?: string | null;
          refund_requested_at?: string | null;
          refunded_at?: string | null;
          status?: Database["public"]["Enums"]["payment_attempt_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_business_id_appointment_id_fkey";
            columns: ["business_id", "appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "payments_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_currency_code_fkey";
            columns: ["currency_code"];
            isOneToOne: false;
            referencedRelation: "currencies";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "payments_customer_user_id_fkey";
            columns: ["customer_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_recorded_by_fkey";
            columns: ["recorded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_admins: {
        Row: {
          created_at: string;
          created_by: string | null;
          role: Database["public"]["Enums"]["admin_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          role: Database["public"]["Enums"]["admin_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          role?: Database["public"]["Enums"]["admin_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "platform_admins_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "platform_admins_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_path: string | null;
          country_code: string | null;
          created_at: string;
          deleted_at: string | null;
          email: string | null;
          full_name: string | null;
          id: string;
          locale: string;
          notify_email: boolean;
          notify_sms: boolean;
          notify_whatsapp: boolean;
          phone_e164: string | null;
          updated_at: string;
        };
        Insert: {
          avatar_path?: string | null;
          country_code?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          email?: string | null;
          full_name?: string | null;
          id: string;
          locale?: string;
          notify_email?: boolean;
          notify_sms?: boolean;
          notify_whatsapp?: boolean;
          phone_e164?: string | null;
          updated_at?: string;
        };
        Update: {
          avatar_path?: string | null;
          country_code?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          locale?: string;
          notify_email?: boolean;
          notify_sms?: boolean;
          notify_whatsapp?: boolean;
          phone_e164?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_country_code_fkey";
            columns: ["country_code"];
            isOneToOne: false;
            referencedRelation: "countries";
            referencedColumns: ["code"];
          },
        ];
      };
      regions: {
        Row: {
          country_code: string;
          id: string;
          name: string;
          slug: string;
        };
        Insert: {
          country_code: string;
          id?: string;
          name: string;
          slug: string;
        };
        Update: {
          country_code?: string;
          id?: string;
          name?: string;
          slug?: string;
        };
        Relationships: [
          {
            foreignKeyName: "regions_country_code_fkey";
            columns: ["country_code"];
            isOneToOne: false;
            referencedRelation: "countries";
            referencedColumns: ["code"];
          },
        ];
      };
      review_reports: {
        Row: {
          business_id: string;
          created_at: string;
          details: string | null;
          id: string;
          reason: string;
          reporter_id: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          review_id: string;
        };
        Insert: {
          business_id: string;
          created_at?: string;
          details?: string | null;
          id?: string;
          reason: string;
          reporter_id?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          review_id: string;
        };
        Update: {
          business_id?: string;
          created_at?: string;
          details?: string | null;
          id?: string;
          reason?: string;
          reporter_id?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          review_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "review_reports_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "review_reports_reporter_id_fkey";
            columns: ["reporter_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "review_reports_resolved_by_fkey";
            columns: ["resolved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "review_reports_review_id_fkey";
            columns: ["review_id"];
            isOneToOne: false;
            referencedRelation: "reviews";
            referencedColumns: ["id"];
          },
        ];
      };
      reviews: {
        Row: {
          appointment_id: string;
          author_name: string;
          body: string | null;
          business_id: string;
          created_at: string;
          id: string;
          moderation_note: string | null;
          rating: number;
          replied_at: string | null;
          reply_body: string | null;
          reply_by: string | null;
          service_name: string;
          staff_name: string | null;
          status: Database["public"]["Enums"]["review_status"];
          updated_at: string;
          user_id: string | null;
          visited_on: string;
        };
        Insert: {
          appointment_id: string;
          author_name: string;
          body?: string | null;
          business_id: string;
          created_at?: string;
          id?: string;
          moderation_note?: string | null;
          rating: number;
          replied_at?: string | null;
          reply_body?: string | null;
          reply_by?: string | null;
          service_name: string;
          staff_name?: string | null;
          status?: Database["public"]["Enums"]["review_status"];
          updated_at?: string;
          user_id?: string | null;
          visited_on: string;
        };
        Update: {
          appointment_id?: string;
          author_name?: string;
          body?: string | null;
          business_id?: string;
          created_at?: string;
          id?: string;
          moderation_note?: string | null;
          rating?: number;
          replied_at?: string | null;
          reply_body?: string | null;
          reply_by?: string | null;
          service_name?: string;
          staff_name?: string | null;
          status?: Database["public"]["Enums"]["review_status"];
          updated_at?: string;
          user_id?: string | null;
          visited_on?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_appointment_id_fkey";
            columns: ["appointment_id"];
            isOneToOne: true;
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_reply_by_fkey";
            columns: ["reply_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      services: {
        Row: {
          business_id: string;
          category_id: string | null;
          created_at: string;
          currency_code: string;
          deleted_at: string | null;
          deposit_minor: number | null;
          description: string | null;
          duration_minutes: number;
          id: string;
          is_active: boolean;
          name: string;
          price_minor: number;
          price_type: Database["public"]["Enums"]["price_type"];
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          business_id: string;
          category_id?: string | null;
          created_at?: string;
          currency_code: string;
          deleted_at?: string | null;
          deposit_minor?: number | null;
          description?: string | null;
          duration_minutes: number;
          id?: string;
          is_active?: boolean;
          name: string;
          price_minor: number;
          price_type?: Database["public"]["Enums"]["price_type"];
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          business_id?: string;
          category_id?: string | null;
          created_at?: string;
          currency_code?: string;
          deleted_at?: string | null;
          deposit_minor?: number | null;
          description?: string | null;
          duration_minutes?: number;
          id?: string;
          is_active?: boolean;
          name?: string;
          price_minor?: number;
          price_type?: Database["public"]["Enums"]["price_type"];
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "services_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "services_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "services_currency_code_fkey";
            columns: ["currency_code"];
            isOneToOne: false;
            referencedRelation: "currencies";
            referencedColumns: ["code"];
          },
        ];
      };
      staff: {
        Row: {
          accepts_online_bookings: boolean;
          bio: string | null;
          business_id: string;
          created_at: string;
          deleted_at: string | null;
          display_name: string;
          id: string;
          is_active: boolean;
          photo_path: string | null;
          role_title: string | null;
          sort_order: number;
          updated_at: string;
          user_id: string | null;
          uses_business_hours: boolean;
        };
        Insert: {
          accepts_online_bookings?: boolean;
          bio?: string | null;
          business_id: string;
          created_at?: string;
          deleted_at?: string | null;
          display_name: string;
          id?: string;
          is_active?: boolean;
          photo_path?: string | null;
          role_title?: string | null;
          sort_order?: number;
          updated_at?: string;
          user_id?: string | null;
          uses_business_hours?: boolean;
        };
        Update: {
          accepts_online_bookings?: boolean;
          bio?: string | null;
          business_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          display_name?: string;
          id?: string;
          is_active?: boolean;
          photo_path?: string | null;
          role_title?: string | null;
          sort_order?: number;
          updated_at?: string;
          user_id?: string | null;
          uses_business_hours?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "staff_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      staff_invites: {
        Row: {
          accepted_at: string | null;
          accepted_by: string | null;
          business_id: string;
          created_at: string;
          expires_at: string;
          id: string;
          invited_by: string | null;
          phone_e164: string;
          revoked_at: string | null;
          role: Database["public"]["Enums"]["member_role"];
          staff_id: string;
          token_hash: string;
        };
        Insert: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          business_id: string;
          created_at?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          phone_e164: string;
          revoked_at?: string | null;
          role?: Database["public"]["Enums"]["member_role"];
          staff_id: string;
          token_hash: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          business_id?: string;
          created_at?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          phone_e164?: string;
          revoked_at?: string | null;
          role?: Database["public"]["Enums"]["member_role"];
          staff_id?: string;
          token_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_invites_accepted_by_fkey";
            columns: ["accepted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_invites_business_id_staff_id_fkey";
            columns: ["business_id", "staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "staff_invites_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      staff_services: {
        Row: {
          business_id: string;
          service_id: string;
          staff_id: string;
        };
        Insert: {
          business_id: string;
          service_id: string;
          staff_id: string;
        };
        Update: {
          business_id?: string;
          service_id?: string;
          staff_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_services_business_id_service_id_fkey";
            columns: ["business_id", "service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "staff_services_business_id_staff_id_fkey";
            columns: ["business_id", "staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["business_id", "id"];
          },
        ];
      };
      staff_working_hours: {
        Row: {
          business_id: string;
          during: unknown;
          id: string;
          staff_id: string;
          weekday: number;
        };
        Insert: {
          business_id: string;
          during: unknown;
          id?: string;
          staff_id: string;
          weekday: number;
        };
        Update: {
          business_id?: string;
          during?: unknown;
          id?: string;
          staff_id?: string;
          weekday?: number;
        };
        Relationships: [
          {
            foreignKeyName: "staff_working_hours_business_id_staff_id_fkey";
            columns: ["business_id", "staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["business_id", "id"];
          },
        ];
      };
    };
    Views: {
      business_client_summaries: {
        Row: {
          business_id: string | null;
          created_at: string | null;
          full_name: string | null;
          id: string | null;
          last_visit_at: string | null;
          no_shows: number | null;
          notes: string | null;
          phone_e164: string | null;
          spent_minor: number | null;
          upcoming: number | null;
          user_id: string | null;
          visits: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "business_clients_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "business_clients_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      abandon_payment: { Args: { p_payment_id: string; p_reason?: string }; Returns: undefined };
      accept_staff_invite: { Args: { p_token: string }; Returns: string };
      account_deletion_blocker: { Args: Record<PropertyKey, never>; Returns: string };
      admin_moderate_review: {
        Args: { p_reason: string; p_review_id: string; p_status: Database["public"]["Enums"]["review_status"] };
        Returns: undefined;
      };
      admin_save_category: {
        Args: {
          p_description: string;
          p_id: string;
          p_is_active: boolean;
          p_keywords: string[];
          p_name: string;
          p_reason: string;
          p_slug: string;
          p_sort_order: number;
        };
        Returns: string;
      };
      admin_set_business_verification: {
        Args: {
          p_business_id: string;
          p_note?: string;
          p_reason: string;
          p_status: Database["public"]["Enums"]["business_verification"];
        };
        Returns: undefined;
      };
      apply_payment_event: {
        Args: {
          p_amount_minor: number;
          p_currency: string;
          p_event_id: string;
          p_outcome: string;
          p_payload?: Json;
          p_provider: string;
          p_reference: string;
        };
        Returns: string;
      };
      book_appointment: {
        Args: {
          p_business_id: string;
          p_customer_name: string;
          p_customer_phone?: string;
          p_idempotency_key?: string;
          p_note?: string;
          p_service_id: string;
          p_staff_ids: string[];
          p_starts_at: string;
        };
        Returns: string;
      };
      business_publish_readiness: { Args: { p_business_id: string }; Returns: string[] };
      cancel_my_appointment: { Args: { p_appointment_id: string; p_reason?: string }; Returns: undefined };
      claim_notifications: {
        Args: { p_limit?: number };
        Returns: {
          appointment_id: string | null;
          attempts: number;
          business_id: string | null;
          channel: Database["public"]["Enums"]["notification_channel"];
          claimed_at: string | null;
          created_at: string;
          dedupe_key: string | null;
          id: string;
          last_error: string | null;
          locale: string;
          payload: NonNullable<Json>;
          provider: string | null;
          provider_message_id: string | null;
          read_at: string | null;
          recipient_address: string | null;
          recipient_user_id: string | null;
          scheduled_for: string;
          sent_at: string | null;
          status: Database["public"]["Enums"]["notification_status"];
          template_key: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "notifications";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      claim_refunds: {
        Args: { p_limit?: number };
        Returns: {
          amount_minor: number;
          currency_code: string;
          idempotency_key: string;
          payment_id: string;
          provider: string;
          provider_reference: string;
        }[];
      };
      create_blocked_time: {
        Args: {
          p_business_id: string;
          p_ends_local: string;
          p_reason: string;
          p_staff_id: string;
          p_starts_local: string;
        };
        Returns: string;
      };
      create_business: {
        Args: {
          p_category_id: string;
          p_country_code: string;
          p_kind: Database["public"]["Enums"]["business_kind"];
          p_name: string;
        };
        Returns: {
          id: string;
          slug: string;
        }[];
      };
      create_manual_appointment: {
        Args: {
          p_allow_outside_hours?: boolean;
          p_business_id: string;
          p_client_id?: string;
          p_client_name?: string;
          p_client_phone?: string;
          p_note?: string;
          p_service_id: string;
          p_staff_id: string;
          p_starts_at: string;
          p_walk_in?: boolean;
        };
        Returns: string;
      };
      delete_my_account: { Args: Record<PropertyKey, never>; Returns: undefined };
      expire_payment_holds: { Args: Record<PropertyKey, never>; Returns: number };
      finish_notification: {
        Args: {
          p_error: string;
          p_id: string;
          p_message_id: string;
          p_ok: boolean;
          p_provider: string;
          p_retryable: boolean;
        };
        Returns: undefined;
      };
      finish_refund: {
        Args: { p_error?: string; p_ok: boolean; p_payment_id: string; p_reference?: string };
        Returns: undefined;
      };
      get_busy_intervals: {
        Args: { p_business_id: string; p_from: string; p_to: string };
        Returns: {
          ends_at: string;
          kind: string;
          staff_id: string;
          starts_at: string;
        }[];
      };
      get_busy_intervals_many: {
        Args: { p_business_ids: string[]; p_from: string; p_to: string };
        Returns: {
          business_id: string;
          ends_at: string;
          kind: string;
          staff_id: string;
          starts_at: string;
        }[];
      };
      get_staff_invite: {
        Args: { p_token: string };
        Returns: {
          business_name: string;
          phone_hint: string;
          role: Database["public"]["Enums"]["member_role"];
          staff_name: string;
          status: string;
        }[];
      };
      invite_staff: {
        Args: { p_phone_e164: string; p_role?: Database["public"]["Enums"]["member_role"]; p_staff_id: string };
        Returns: string;
      };
      match_search_terms: {
        Args: { p_country_code: string; p_what: string; p_where: string };
        Returns: {
          area_id: string;
          area_name: string;
          category_id: string;
          category_name: string;
          category_slug: string;
          city_id: string;
          city_name: string;
          region_id: string;
          region_name: string;
        }[];
      };
      move_appointment: {
        Args: { p_allow_outside_hours?: boolean; p_appointment_id: string; p_staff_id: string; p_starts_at: string };
        Returns: undefined;
      };
      my_favorite_businesses: {
        Args: { p_limit?: number; p_offset?: number };
        Returns: {
          area_name: string;
          category_name: string;
          category_slug: string;
          city_name: string;
          currency_code: string;
          distance_m: number;
          has_from_price: boolean;
          id: string;
          is_verified: boolean;
          locality_text: string;
          logo_path: string;
          min_price_minor: number;
          name: string;
          next_available_at: string;
          photo_path: string;
          published_at: string;
          rank: number;
          rating_avg: number;
          rating_count: number;
          saved_at: string;
          slug: string;
          total_count: number;
        }[];
      };
      publish_business: { Args: { p_business_id: string }; Returns: undefined };
      record_manual_payment: {
        Args: {
          p_amount_minor: number;
          p_appointment_id: string;
          p_method: Database["public"]["Enums"]["payment_method"];
          p_note?: string;
        };
        Returns: string;
      };
      remove_staff_member: { Args: { p_staff_id: string }; Returns: undefined };
      reply_to_review: { Args: { p_body: string; p_review_id: string }; Returns: undefined };
      report_review: { Args: { p_details: string; p_reason: string; p_review_id: string }; Returns: undefined };
      request_business_verification: {
        Args: { p_business_id: string };
        Returns: Database["public"]["Enums"]["business_verification"];
      };
      request_refund: { Args: { p_payment_id: string; p_reason: string }; Returns: undefined };
      reschedule_my_appointment: {
        Args: { p_appointment_id: string; p_staff_ids: string[]; p_starts_at: string };
        Returns: string;
      };
      revoke_staff_invite: { Args: { p_staff_id: string }; Returns: undefined };
      save_business_client: {
        Args: { p_business_id: string; p_client_id: string; p_name: string; p_notes: string; p_phone: string };
        Returns: string;
      };
      search_businesses: {
        Args: {
          p_area_id?: string;
          p_category_id?: string;
          p_city_id?: string;
          p_lat?: number;
          p_limit?: number;
          p_lng?: number;
          p_offset?: number;
          p_radius_km?: number;
          p_region_id?: string;
          p_sort?: string;
          p_text?: string;
        };
        Returns: {
          area_name: string;
          category_name: string;
          category_slug: string;
          city_name: string;
          currency_code: string;
          distance_m: number;
          has_from_price: boolean;
          id: string;
          is_verified: boolean;
          locality_text: string;
          logo_path: string;
          min_price_minor: number;
          name: string;
          next_available_at: string;
          photo_path: string;
          published_at: string;
          rank: number;
          rating_avg: number;
          rating_count: number;
          slug: string;
          total_count: number;
        }[];
      };
      set_appointment_status: {
        Args: {
          p_appointment_id: string;
          p_final_price_minor?: number;
          p_reason?: string;
          p_status: Database["public"]["Enums"]["appointment_status"];
        };
        Returns: undefined;
      };
      set_business_hours: { Args: { p_business_id: string; p_hours: Json }; Returns: undefined };
      set_business_slug: { Args: { p_business_id: string; p_slug: string }; Returns: string };
      set_payment_reference: { Args: { p_payment_id: string; p_reference: string }; Returns: undefined };
      set_payout_account: {
        Args: {
          p_account_name: string;
          p_bank_account_number?: string;
          p_bank_name?: string;
          p_business_id: string;
          p_method: Database["public"]["Enums"]["payout_method"];
          p_momo_network?: string;
          p_momo_number?: string;
        };
        Returns: undefined;
      };
      set_primary_category: { Args: { p_business_id: string; p_category_id: string }; Returns: undefined };
      set_service_staff: { Args: { p_service_id: string; p_staff_ids: string[] }; Returns: undefined };
      set_staff_hours: {
        Args: { p_hours: Json; p_staff_id: string; p_uses_business_hours: boolean };
        Returns: undefined;
      };
      set_staff_services: { Args: { p_service_ids: string[]; p_staff_id: string }; Returns: undefined };
      stale_pending_payments: {
        Args: { p_limit?: number; p_older_than_minutes?: number };
        Returns: {
          payment_id: string;
          provider: string;
          provider_reference: string;
        }[];
      };
      start_payment: {
        Args: {
          p_appointment_id: string;
          p_kind: Database["public"]["Enums"]["payment_kind"];
          p_method: Database["public"]["Enums"]["payment_method"];
          p_network?: string;
          p_phone?: string;
          p_provider: string;
        };
        Returns: {
          amount_minor: number;
          currency_code: string;
          idempotency_key: string;
          payment_id: string;
        }[];
      };
      submit_review: { Args: { p_appointment_id: string; p_body: string; p_rating: number }; Returns: string };
      timemultirange: { Args: Record<PropertyKey, never>; Returns: unknown };
      unpublish_business: { Args: { p_business_id: string }; Returns: undefined };
      update_review: { Args: { p_body: string; p_rating: number; p_review_id: string }; Returns: undefined };
    };
    Enums: {
      admin_role: "super_admin" | "moderator" | "support";
      appointment_source: "online" | "manual" | "walk_in";
      appointment_status: "pending" | "confirmed" | "arrived" | "completed" | "cancelled" | "no_show";
      business_kind: "solo" | "team";
      business_status: "draft" | "published" | "suspended" | "deactivated";
      business_verification: "none" | "pending" | "verified" | "declined";
      member_role: "owner" | "manager" | "staff";
      notification_channel: "sms" | "whatsapp" | "email" | "in_app";
      notification_status: "queued" | "sending" | "sent" | "failed" | "cancelled";
      payment_attempt_status: "pending" | "paid" | "failed" | "expired" | "refund_pending" | "refunded";
      payment_kind: "deposit" | "balance" | "full";
      payment_method: "mobile_money" | "card" | "cash" | "bank_transfer";
      payment_status: "pending" | "paid" | "partially_paid" | "failed" | "refunded";
      payout_method: "mobile_money" | "bank";
      price_type: "fixed" | "from" | "on_request";
      review_status: "published" | "hidden" | "removed";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      admin_role: ["super_admin", "moderator", "support"],
      appointment_source: ["online", "manual", "walk_in"],
      appointment_status: ["pending", "confirmed", "arrived", "completed", "cancelled", "no_show"],
      business_kind: ["solo", "team"],
      business_status: ["draft", "published", "suspended", "deactivated"],
      business_verification: ["none", "pending", "verified", "declined"],
      member_role: ["owner", "manager", "staff"],
      notification_channel: ["sms", "whatsapp", "email", "in_app"],
      notification_status: ["queued", "sending", "sent", "failed", "cancelled"],
      payment_attempt_status: ["pending", "paid", "failed", "expired", "refund_pending", "refunded"],
      payment_kind: ["deposit", "balance", "full"],
      payment_method: ["mobile_money", "card", "cash", "bank_transfer"],
      payment_status: ["pending", "paid", "partially_paid", "failed", "refunded"],
      payout_method: ["mobile_money", "bank"],
      price_type: ["fixed", "from", "on_request"],
      review_status: ["published", "hidden", "removed"],
    },
  },
} as const;
