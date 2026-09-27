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
          allow_guest_booking: boolean;
          auto_confirm: boolean;
          buffer_after_minutes: number;
          buffer_before_minutes: number;
          business_id: string;
          cancellation_window_hours: number;
          max_advance_days: number;
          min_notice_minutes: number;
          pending_hold_minutes: number;
          reschedule_window_hours: number;
          slot_interval_minutes: number;
          updated_at: string;
        };
        Insert: {
          allow_guest_booking?: boolean;
          auto_confirm?: boolean;
          buffer_after_minutes?: number;
          buffer_before_minutes?: number;
          business_id: string;
          cancellation_window_hours?: number;
          max_advance_days?: number;
          min_notice_minutes?: number;
          pending_hold_minutes?: number;
          reschedule_window_hours?: number;
          slot_interval_minutes?: number;
          updated_at?: string;
        };
        Update: {
          allow_guest_booking?: boolean;
          auto_confirm?: boolean;
          buffer_after_minutes?: number;
          buffer_before_minutes?: number;
          business_id?: string;
          cancellation_window_hours?: number;
          max_advance_days?: number;
          min_notice_minutes?: number;
          pending_hold_minutes?: number;
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
      business_photos: {
        Row: {
          business_id: string;
          caption: string | null;
          created_at: string;
          height: number | null;
          id: string;
          path_large: string;
          path_small: string;
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
          id: string;
          kind: Database["public"]["Enums"]["business_kind"];
          logo_path: string | null;
          name: string;
          next_available_at: string | null;
          phone_e164: string | null;
          published_at: string | null;
          rating_avg: number | null;
          rating_count: number;
          slug: string;
          status: Database["public"]["Enums"]["business_status"];
          timezone: string;
          updated_at: string;
          whatsapp_e164: string | null;
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
          id?: string;
          kind?: Database["public"]["Enums"]["business_kind"];
          logo_path?: string | null;
          name: string;
          next_available_at?: string | null;
          phone_e164?: string | null;
          published_at?: string | null;
          rating_avg?: number | null;
          rating_count?: number;
          slug: string;
          status?: Database["public"]["Enums"]["business_status"];
          timezone?: string;
          updated_at?: string;
          whatsapp_e164?: string | null;
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
          id?: string;
          kind?: Database["public"]["Enums"]["business_kind"];
          logo_path?: string | null;
          name?: string;
          next_available_at?: string | null;
          phone_e164?: string | null;
          published_at?: string | null;
          rating_avg?: number | null;
          rating_count?: number;
          slug?: string;
          status?: Database["public"]["Enums"]["business_status"];
          timezone?: string;
          updated_at?: string;
          whatsapp_e164?: string | null;
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
      [_ in never]: never;
    };
    Functions: {
      accept_staff_invite: { Args: { p_token: string }; Returns: string };
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
      business_publish_readiness: { Args: { p_business_id: string }; Returns: string[] };
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
      publish_business: { Args: { p_business_id: string }; Returns: undefined };
      remove_staff_member: { Args: { p_staff_id: string }; Returns: undefined };
      revoke_staff_invite: { Args: { p_staff_id: string }; Returns: undefined };
      set_business_hours: { Args: { p_business_id: string; p_hours: Json }; Returns: undefined };
      set_business_slug: { Args: { p_business_id: string; p_slug: string }; Returns: string };
      set_primary_category: { Args: { p_business_id: string; p_category_id: string }; Returns: undefined };
      set_service_staff: { Args: { p_service_id: string; p_staff_ids: string[] }; Returns: undefined };
      set_staff_hours: {
        Args: { p_hours: Json; p_staff_id: string; p_uses_business_hours: boolean };
        Returns: undefined;
      };
      set_staff_services: { Args: { p_service_ids: string[]; p_staff_id: string }; Returns: undefined };
      timemultirange: { Args: Record<PropertyKey, never>; Returns: unknown };
      unpublish_business: { Args: { p_business_id: string }; Returns: undefined };
    };
    Enums: {
      admin_role: "super_admin" | "moderator" | "support";
      business_kind: "solo" | "team";
      business_status: "draft" | "published" | "suspended" | "deactivated";
      member_role: "owner" | "manager" | "staff";
      price_type: "fixed" | "from";
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
      business_kind: ["solo", "team"],
      business_status: ["draft", "published", "suspended", "deactivated"],
      member_role: ["owner", "manager", "staff"],
      price_type: ["fixed", "from"],
    },
  },
} as const;
