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
  public: {
    Tables: {
      activities: {
        Row: {
          created_at: string
          id: number
          kicker: string
          kind: string
          meta: string | null
          route: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          kicker: string
          kind: string
          meta?: string | null
          route: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: never
          kicker?: string
          kind?: string
          meta?: string | null
          route?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      allowed_email_domains: {
        Row: {
          domain: string
        }
        Insert: {
          domain: string
        }
        Update: {
          domain?: string
        }
        Relationships: []
      }
      app_config: {
        Row: {
          id: number
          launch_date: string
          location: string
          record_label: string | null
          record_online: number
          sem_label: string
          sem_start: string
          timezone: string
        }
        Insert: {
          id?: number
          launch_date?: string
          location?: string
          record_label?: string | null
          record_online?: number
          sem_label?: string
          sem_start?: string
          timezone?: string
        }
        Update: {
          id?: number
          launch_date?: string
          location?: string
          record_label?: string | null
          record_online?: number
          sem_label?: string
          sem_start?: string
          timezone?: string
        }
        Relationships: []
      }
      badges: {
        Row: {
          created_at: string
          icon: string
          id: number
          label: string
          tone: string
          user_id: string
        }
        Insert: {
          created_at?: string
          icon: string
          id?: never
          label: string
          tone?: string
          user_id: string
        }
        Update: {
          created_at?: string
          icon?: string
          id?: never
          label?: string
          tone?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      board_categories: {
        Row: {
          icon: string
          id: number
          name: string
          slug: string
          subtitle: string
          tone: string
        }
        Insert: {
          icon: string
          id: number
          name: string
          slug: string
          subtitle: string
          tone: string
        }
        Update: {
          icon?: string
          id?: number
          name?: string
          slug?: string
          subtitle?: string
          tone?: string
        }
        Relationships: []
      }
      board_members: {
        Row: {
          board_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          board_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          board_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_members_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      boards: {
        Row: {
          category_id: number
          description: string | null
          icon: string
          id: string
          is_demo: boolean
          link_screen: string | null
          member_count: number
          name: string
          parent_id: string | null
          post_count: number
          rules: string[]
          short_name: string | null
          slug: string
          sort: number
          thread_count: number
          verified_only: boolean
        }
        Insert: {
          category_id: number
          description?: string | null
          icon?: string
          id?: string
          is_demo?: boolean
          link_screen?: string | null
          member_count?: number
          name: string
          parent_id?: string | null
          post_count?: number
          rules?: string[]
          short_name?: string | null
          slug: string
          sort?: number
          thread_count?: number
          verified_only?: boolean
        }
        Update: {
          category_id?: number
          description?: string | null
          icon?: string
          id?: string
          is_demo?: boolean
          link_screen?: string | null
          member_count?: number
          name?: string
          parent_id?: string | null
          post_count?: number
          rules?: string[]
          short_name?: string | null
          slug?: string
          sort?: number
          thread_count?: number
          verified_only?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "boards_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "board_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boards_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          code: string
          file_count: number
          full_name: string
          name: string
          roll_code: string | null
          sort: number
        }
        Insert: {
          code: string
          file_count?: number
          full_name: string
          name: string
          roll_code?: string | null
          sort?: number
        }
        Update: {
          code?: string
          file_count?: number
          full_name?: string
          name?: string
          roll_code?: string | null
          sort?: number
        }
        Relationships: []
      }
      campus_events: {
        Row: {
          ends_at: string | null
          id: number
          is_demo: boolean
          short_title: string | null
          society_post_id: number | null
          starts_at: string
          sub: string | null
          thread_id: number | null
          title: string
        }
        Insert: {
          ends_at?: string | null
          id?: never
          is_demo?: boolean
          short_title?: string | null
          society_post_id?: number | null
          starts_at: string
          sub?: string | null
          thread_id?: number | null
          title: string
        }
        Update: {
          ends_at?: string | null
          id?: never
          is_demo?: boolean
          short_title?: string | null
          society_post_id?: number | null
          starts_at?: string
          sub?: string | null
          thread_id?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "campus_events_society_post_id_fkey"
            columns: ["society_post_id"]
            isOneToOne: false
            referencedRelation: "society_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campus_events_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      deadlines: {
        Row: {
          highlight: boolean
          id: number
          is_demo: boolean
          on_date: string
          sub: string | null
          title: string
        }
        Insert: {
          highlight?: boolean
          id?: never
          is_demo?: boolean
          on_date: string
          sub?: string | null
          title: string
        }
        Update: {
          highlight?: boolean
          id?: never
          is_demo?: boolean
          on_date?: string
          sub?: string | null
          title?: string
        }
        Relationships: []
      }
      device_push_tokens: {
        Row: {
          token: string
          user_id: string
          platform: string
          updated_at: string
        }
        Insert: {
          token: string
          user_id: string
          platform: string
          updated_at?: string
        }
        Update: {
          token?: string
          user_id?: string
          platform?: string
          updated_at?: string
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
      drafts: {
        Row: {
          board_id: string | null
          body: string
          id: string
          kind: string
          payload: Json
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          board_id?: string | null
          body?: string
          id?: string
          kind?: string
          payload?: Json
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          board_id?: string | null
          body?: string
          id?: string
          kind?: string
          payload?: Json
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drafts_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drafts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_windows: {
        Row: {
          branch_code: string | null
          id: number
          label: string
          semester: number | null
          starts_on: string
        }
        Insert: {
          branch_code?: string | null
          id?: never
          label?: string
          semester?: number | null
          starts_on: string
        }
        Update: {
          branch_code?: string | null
          id?: never
          label?: string
          semester?: number | null
          starts_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_windows_branch_code_fkey"
            columns: ["branch_code"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["code"]
          },
        ]
      }
      karma_events: {
        Row: {
          amount: number
          bucket: string
          created_at: string
          id: number
          reason: string
          user_id: string
        }
        Insert: {
          amount: number
          bucket: string
          created_at?: string
          id?: never
          reason: string
          user_id: string
        }
        Update: {
          amount?: number
          bucket?: string
          created_at?: string
          id?: never
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "karma_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      library_downloads: {
        Row: {
          created_at: string
          id: number
          item_id: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: never
          item_id: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: never
          item_id?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "library_downloads_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "library_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_downloads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      library_items: {
        Row: {
          created_at: string
          downloads: number
          downloads_week: number
          format: string
          id: number
          is_demo: boolean
          kind: string
          size_bytes: number | null
          storage_path: string | null
          subject_code: string
          title: string
          top_rated: boolean
          uploader_id: string | null
        }
        Insert: {
          created_at?: string
          downloads?: number
          downloads_week?: number
          format?: string
          id?: never
          is_demo?: boolean
          kind: string
          size_bytes?: number | null
          storage_path?: string | null
          subject_code: string
          title: string
          top_rated?: boolean
          uploader_id?: string | null
        }
        Update: {
          created_at?: string
          downloads?: number
          downloads_week?: number
          format?: string
          id?: never
          is_demo?: boolean
          kind?: string
          size_bytes?: number | null
          storage_path?: string | null
          subject_code?: string
          title?: string
          top_rated?: boolean
          uploader_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "library_items_subject_code_fkey"
            columns: ["subject_code"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "library_items_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lounge_messages: {
        Row: {
          author_id: string
          body: string
          created_at: string
          edited_at: string | null
          id: number
          is_demo: boolean
          promoted_thread_id: number | null
          room_slug: string
          society_id: string | null
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          edited_at?: string | null
          id?: never
          is_demo?: boolean
          promoted_thread_id?: number | null
          room_slug: string
          society_id?: string | null
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          edited_at?: string | null
          id?: never
          is_demo?: boolean
          promoted_thread_id?: number | null
          room_slug?: string
          society_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lounge_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lounge_messages_promoted_thread_id_fkey"
            columns: ["promoted_thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lounge_messages_room_slug_fkey"
            columns: ["room_slug"]
            isOneToOne: false
            referencedRelation: "lounge_rooms"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "lounge_messages_society_id_fkey"
            columns: ["society_id"]
            isOneToOne: false
            referencedRelation: "societies"
            referencedColumns: ["id"]
          },
        ]
      }
      lounge_rooms: {
        Row: {
          label: string
          pinned_text: string | null
          pinned_thread_id: number | null
          short_label: string | null
          slug: string
          sort: number
        }
        Insert: {
          label: string
          pinned_text?: string | null
          pinned_thread_id?: number | null
          short_label?: string | null
          slug: string
          sort?: number
        }
        Update: {
          label?: string
          pinned_text?: string | null
          pinned_thread_id?: number | null
          short_label?: string | null
          slug?: string
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "lounge_rooms_pinned_thread_id_fkey"
            columns: ["pinned_thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          article_id: number | null
          count: number
          created_at: string
          id: number
          kind: string
          lounge_message_id: number | null
          read_at: string | null
          reply_id: number | null
          route: string
          snippet: string | null
          team_id: number | null
          text: string
          thread_id: number | null
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          article_id?: number | null
          count?: number
          created_at?: string
          id?: never
          kind: string
          lounge_message_id?: number | null
          read_at?: string | null
          reply_id?: number | null
          route: string
          snippet?: string | null
          team_id?: number | null
          text: string
          thread_id?: number | null
          user_id: string
        }
        Update: {
          actor_id?: string | null
          article_id?: number | null
          count?: number
          created_at?: string
          id?: never
          kind?: string
          lounge_message_id?: number | null
          read_at?: string | null
          reply_id?: number | null
          route?: string
          snippet?: string | null
          team_id?: number | null
          text?: string
          thread_id?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "wiki_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_lounge_message_id_fkey"
            columns: ["lounge_message_id"]
            isOneToOne: false
            referencedRelation: "lounge_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_reply_id_fkey"
            columns: ["reply_id"]
            isOneToOne: false
            referencedRelation: "replies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      place_hearts: {
        Row: {
          place_id: number
          user_id: string
        }
        Insert: {
          place_id: number
          user_id: string
        }
        Update: {
          place_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_hearts_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_hearts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      places: {
        Row: {
          author_id: string | null
          category: string
          created_at: string
          distance_km: number | null
          event_on: string | null
          hearts: number
          home_meta: string | null
          home_sort: number | null
          icon: string | null
          id: number
          image_label: string | null
          image_path: string | null
          is_demo: boolean
          metro_minutes: number | null
          name: string
          on_campus: boolean
          price_label: string | null
          recs: number
          short_name: string | null
          short_where: string | null
          sort: number
          tags: string[]
          under_100: boolean
          where_label: string | null
        }
        Insert: {
          author_id?: string | null
          category: string
          created_at?: string
          distance_km?: number | null
          event_on?: string | null
          hearts?: number
          home_meta?: string | null
          home_sort?: number | null
          icon?: string | null
          id?: never
          image_label?: string | null
          image_path?: string | null
          is_demo?: boolean
          metro_minutes?: number | null
          name: string
          on_campus?: boolean
          price_label?: string | null
          recs?: number
          short_name?: string | null
          short_where?: string | null
          sort?: number
          tags?: string[]
          under_100?: boolean
          where_label?: string | null
        }
        Update: {
          author_id?: string | null
          category?: string
          created_at?: string
          distance_km?: number | null
          event_on?: string | null
          hearts?: number
          home_meta?: string | null
          home_sort?: number | null
          icon?: string | null
          id?: never
          image_label?: string | null
          image_path?: string | null
          is_demo?: boolean
          metro_minutes?: number | null
          name?: string
          on_campus?: boolean
          price_label?: string | null
          recs?: number
          short_name?: string | null
          short_where?: string | null
          sort?: number
          tags?: string[]
          under_100?: boolean
          where_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "places_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_options: {
        Row: {
          id: number
          label: string
          sort: number
          thread_id: number
          votes: number
        }
        Insert: {
          id?: never
          label: string
          sort?: number
          thread_id: number
          votes?: number
        }
        Update: {
          id?: never
          label?: string
          sort?: number
          thread_id?: number
          votes?: number
        }
        Relationships: [
          {
            foreignKeyName: "poll_options_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_votes: {
        Row: {
          option_id: number
          thread_id: number
          user_id: string
        }
        Insert: {
          option_id: number
          thread_id: number
          user_id: string
        }
        Update: {
          option_id?: number
          thread_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "poll_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          accepted_count: number
          bio: string | null
          boards_seen_at: string
          branch_code: string | null
          created_at: string
          display_name: string | null
          download_count: number
          github: string | null
          grad_year: number | null
          handle: string
          hostel: string | null
          id: string
          is_demo: boolean
          karma: number
          linkedin: string | null
          onboarded: boolean
          open_to_teams: boolean
          reply_count: number
          role: string
          semester: number | null
          skills: string[]
          thread_count: number
          tint: string
          upload_count: number
        }
        Insert: {
          accepted_count?: number
          bio?: string | null
          boards_seen_at?: string
          branch_code?: string | null
          created_at?: string
          display_name?: string | null
          download_count?: number
          github?: string | null
          grad_year?: number | null
          handle: string
          hostel?: string | null
          id: string
          is_demo?: boolean
          karma?: number
          linkedin?: string | null
          onboarded?: boolean
          open_to_teams?: boolean
          reply_count?: number
          role?: string
          semester?: number | null
          skills?: string[]
          thread_count?: number
          tint?: string
          upload_count?: number
        }
        Update: {
          accepted_count?: number
          bio?: string | null
          boards_seen_at?: string
          branch_code?: string | null
          created_at?: string
          display_name?: string | null
          download_count?: number
          github?: string | null
          grad_year?: number | null
          handle?: string
          hostel?: string | null
          id?: string
          is_demo?: boolean
          karma?: number
          linkedin?: string | null
          onboarded?: boolean
          open_to_teams?: boolean
          reply_count?: number
          role?: string
          semester?: number | null
          skills?: string[]
          thread_count?: number
          tint?: string
          upload_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "profiles_branch_code_fkey"
            columns: ["branch_code"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["code"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          details: string | null
          id: number
          lounge_message_id: number | null
          reason: string
          reply_id: number | null
          reporter_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          thread_id: number | null
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: never
          lounge_message_id?: number | null
          reason: string
          reply_id?: number | null
          reporter_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          thread_id?: number | null
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: never
          lounge_message_id?: number | null
          reason?: string
          reply_id?: number | null
          reporter_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          thread_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_lounge_message_id_fkey"
            columns: ["lounge_message_id"]
            isOneToOne: false
            referencedRelation: "lounge_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reply_id_fkey"
            columns: ["reply_id"]
            isOneToOne: false
            referencedRelation: "replies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      replies: {
        Row: {
          author_id: string
          body: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: number
          is_demo: boolean
          parent_id: number | null
          score: number
          society_id: string | null
          thread_id: number
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: never
          is_demo?: boolean
          parent_id?: number | null
          score?: number
          society_id?: string | null
          thread_id: number
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: never
          is_demo?: boolean
          parent_id?: number | null
          score?: number
          society_id?: string | null
          thread_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "replies_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replies_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "replies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replies_society_id_fkey"
            columns: ["society_id"]
            isOneToOne: false
            referencedRelation: "societies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replies_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      reply_votes: {
        Row: {
          reply_id: number
          user_id: string
          value: number
        }
        Insert: {
          reply_id: number
          user_id: string
          value: number
        }
        Update: {
          reply_id?: number
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "reply_votes_reply_id_fkey"
            columns: ["reply_id"]
            isOneToOne: false
            referencedRelation: "replies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reply_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rsvps: {
        Row: {
          created_at: string
          post_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rsvps_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "society_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rsvps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saves: {
        Row: {
          created_at: string
          thread_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          thread_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          thread_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saves_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saves_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      societies: {
        Row: {
          created_at: string
          description: string | null
          icon: string
          id: string
          is_demo: boolean
          name: string
          short_name: string | null
          slug: string
          tint: string
          verified: boolean
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          is_demo?: boolean
          name: string
          short_name?: string | null
          slug: string
          tint?: string
          verified?: boolean
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          is_demo?: boolean
          name?: string
          short_name?: string | null
          slug?: string
          tint?: string
          verified?: boolean
        }
        Relationships: []
      }
      society_members: {
        Row: {
          can_post: boolean
          role: string
          society_id: string
          user_id: string
        }
        Insert: {
          can_post?: boolean
          role?: string
          society_id: string
          user_id: string
        }
        Update: {
          can_post?: boolean
          role?: string
          society_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "society_members_society_id_fkey"
            columns: ["society_id"]
            isOneToOne: false
            referencedRelation: "societies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "society_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      society_posts: {
        Row: {
          apply_url: string | null
          author_id: string | null
          body: string | null
          created_at: string
          featured: boolean
          id: number
          is_demo: boolean
          kind: string
          meta_note: string | null
          poster_label: string | null
          poster_path: string | null
          rsvp_count: number
          rsvp_word: string
          short_when: string | null
          society_id: string
          starts_at: string | null
          title: string
          when_label: string
          where_label: string | null
        }
        Insert: {
          apply_url?: string | null
          author_id?: string | null
          body?: string | null
          created_at?: string
          featured?: boolean
          id?: never
          is_demo?: boolean
          kind: string
          meta_note?: string | null
          poster_label?: string | null
          poster_path?: string | null
          rsvp_count?: number
          rsvp_word?: string
          short_when?: string | null
          society_id: string
          starts_at?: string | null
          title: string
          when_label: string
          where_label?: string | null
        }
        Update: {
          apply_url?: string | null
          author_id?: string | null
          body?: string | null
          created_at?: string
          featured?: boolean
          id?: never
          is_demo?: boolean
          kind?: string
          meta_note?: string | null
          poster_label?: string | null
          poster_path?: string | null
          rsvp_count?: number
          rsvp_word?: string
          short_when?: string | null
          society_id?: string
          starts_at?: string | null
          title?: string
          when_label?: string
          where_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "society_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "society_posts_society_id_fkey"
            columns: ["society_id"]
            isOneToOne: false
            referencedRelation: "societies"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          branch_code: string
          code: string
          credits: number | null
          exam_on: string | null
          lab_count: number
          name: string
          notes_count: number
          professor: string | null
          pyq_count: number
          semester: number
          short_name: string | null
          sort: number
          thread_count: number
        }
        Insert: {
          branch_code: string
          code: string
          credits?: number | null
          exam_on?: string | null
          lab_count?: number
          name: string
          notes_count?: number
          professor?: string | null
          pyq_count?: number
          semester: number
          short_name?: string | null
          sort?: number
          thread_count?: number
        }
        Update: {
          branch_code?: string
          code?: string
          credits?: number | null
          exam_on?: string | null
          lab_count?: number
          name?: string
          notes_count?: number
          professor?: string | null
          pyq_count?: number
          semester?: number
          short_name?: string | null
          sort?: number
          thread_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "subjects_branch_code_fkey"
            columns: ["branch_code"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["code"]
          },
        ]
      }
      team_members: {
        Row: {
          team_id: number
          user_id: string
        }
        Insert: {
          team_id: number
          user_id: string
        }
        Update: {
          team_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_requests: {
        Row: {
          created_at: string
          status: string
          team_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          status?: string
          team_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          status?: string
          team_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_requests_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_roles: {
        Row: {
          filled: boolean
          filled_by: string | null
          id: number
          name: string
          sort: number
          team_id: number
        }
        Insert: {
          filled?: boolean
          filled_by?: string | null
          id?: never
          name: string
          sort?: number
          team_id: number
        }
        Update: {
          filled?: boolean
          filled_by?: string | null
          id?: never
          name?: string
          sort?: number
          team_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "team_roles_filled_by_fkey"
            columns: ["filled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_roles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          category: string
          created_at: string
          deadline_label: string | null
          deadline_on: string | null
          description: string | null
          event_name: string
          event_short: string | null
          event_tone: string
          extra_members: number
          id: number
          is_demo: boolean
          owner_id: string
          short_title: string | null
          title: string
          urgent: boolean
        }
        Insert: {
          category: string
          created_at?: string
          deadline_label?: string | null
          deadline_on?: string | null
          description?: string | null
          event_name: string
          event_short?: string | null
          event_tone?: string
          extra_members?: number
          id?: never
          is_demo?: boolean
          owner_id: string
          short_title?: string | null
          title: string
          urgent?: boolean
        }
        Update: {
          category?: string
          created_at?: string
          deadline_label?: string | null
          deadline_on?: string | null
          description?: string | null
          event_name?: string
          event_short?: string | null
          event_tone?: string
          extra_members?: number
          id?: never
          is_demo?: boolean
          owner_id?: string
          short_title?: string | null
          title?: string
          urgent?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "teams_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      thread_votes: {
        Row: {
          thread_id: number
          user_id: string
          value: number
        }
        Insert: {
          thread_id: number
          user_id: string
          value: number
        }
        Update: {
          thread_id?: number
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "thread_votes_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      threads: {
        Row: {
          accepted_reply_id: number | null
          attachment: Json | null
          author_id: string
          board_id: string
          body: string
          created_at: string
          edited_at: string | null
          from_lounge_message_id: number | null
          id: number
          image_label: string | null
          image_path: string | null
          is_demo: boolean
          kind: string
          notify_on_reply: boolean
          poll_closes_at: string | null
          reply_count: number
          score: number
          society_id: string | null
          standfirst: string | null
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          accepted_reply_id?: number | null
          attachment?: Json | null
          author_id: string
          board_id: string
          body?: string
          created_at?: string
          edited_at?: string | null
          from_lounge_message_id?: number | null
          id?: never
          image_label?: string | null
          image_path?: string | null
          is_demo?: boolean
          kind?: string
          notify_on_reply?: boolean
          poll_closes_at?: string | null
          reply_count?: number
          score?: number
          society_id?: string | null
          standfirst?: string | null
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          accepted_reply_id?: number | null
          attachment?: Json | null
          author_id?: string
          board_id?: string
          body?: string
          created_at?: string
          edited_at?: string | null
          from_lounge_message_id?: number | null
          id?: never
          image_label?: string | null
          image_path?: string | null
          is_demo?: boolean
          kind?: string
          notify_on_reply?: boolean
          poll_closes_at?: string | null
          reply_count?: number
          score?: number
          society_id?: string | null
          standfirst?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "threads_accepted_fk"
            columns: ["accepted_reply_id"]
            isOneToOne: false
            referencedRelation: "replies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "threads_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "threads_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "threads_lounge_fk"
            columns: ["from_lounge_message_id"]
            isOneToOne: false
            referencedRelation: "lounge_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "threads_society_id_fkey"
            columns: ["society_id"]
            isOneToOne: false
            referencedRelation: "societies"
            referencedColumns: ["id"]
          },
        ]
      }
      wiki_articles: {
        Row: {
          ai_verdict: Json | null
          board_id: string | null
          body: string
          category_id: number | null
          checked_at: string | null
          checked_by: string | null
          cover_label: string | null
          cover_path: string | null
          created_at: string
          dek: string | null
          editor_count: number
          id: number
          is_demo: boolean
          read_minutes: number
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          slug: string
          started_by: string | null
          status: string
          talk_count: number
          title: string
          updated_at: string
          useful_count: number
          views_week: number
        }
        Insert: {
          ai_verdict?: Json | null
          board_id?: string | null
          body?: string
          category_id?: number | null
          checked_at?: string | null
          checked_by?: string | null
          cover_label?: string | null
          cover_path?: string | null
          created_at?: string
          dek?: string | null
          editor_count?: number
          id?: never
          is_demo?: boolean
          read_minutes?: number
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          slug: string
          started_by?: string | null
          status?: string
          talk_count?: number
          title: string
          updated_at?: string
          useful_count?: number
          views_week?: number
        }
        Update: {
          ai_verdict?: Json | null
          board_id?: string | null
          body?: string
          category_id?: number | null
          checked_at?: string | null
          checked_by?: string | null
          cover_label?: string | null
          cover_path?: string | null
          created_at?: string
          dek?: string | null
          editor_count?: number
          id?: never
          is_demo?: boolean
          read_minutes?: number
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          slug?: string
          started_by?: string | null
          status?: string
          talk_count?: number
          title?: string
          updated_at?: string
          useful_count?: number
          views_week?: number
        }
        Relationships: [
          {
            foreignKeyName: "wiki_articles_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wiki_articles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "wiki_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wiki_articles_checked_by_fkey"
            columns: ["checked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wiki_articles_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wiki_articles_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wiki_categories: {
        Row: {
          id: number
          name: string
          pill: string
          slug: string
          tone: string
        }
        Insert: {
          id: number
          name: string
          pill: string
          slug: string
          tone: string
        }
        Update: {
          id?: number
          name?: string
          pill?: string
          slug?: string
          tone?: string
        }
        Relationships: []
      }
      wiki_feedback: {
        Row: {
          article_id: number
          useful: boolean
          user_id: string
        }
        Insert: {
          article_id: number
          useful: boolean
          user_id: string
        }
        Update: {
          article_id?: number
          useful?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wiki_feedback_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "wiki_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wiki_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wiki_revisions: {
        Row: {
          ai_verdict: Json | null
          article_id: number
          body: string | null
          created_at: string
          delta_words: number | null
          editor_id: string
          id: number
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          summary: string
        }
        Insert: {
          ai_verdict?: Json | null
          article_id: number
          body?: string | null
          created_at?: string
          delta_words?: number | null
          editor_id: string
          id?: never
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          summary: string
        }
        Update: {
          ai_verdict?: Json | null
          article_id?: number
          body?: string | null
          created_at?: string
          delta_words?: number | null
          editor_id?: string
          id?: never
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "wiki_revisions_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "wiki_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wiki_revisions_editor_id_fkey"
            columns: ["editor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wiki_revisions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wiki_talk: {
        Row: {
          article_id: number
          author_id: string
          body: string
          created_at: string
          id: number
        }
        Insert: {
          article_id: number
          author_id: string
          body: string
          created_at?: string
          id?: never
        }
        Update: {
          article_id?: number
          author_id?: string
          body?: string
          created_at?: string
          id?: never
        }
        Relationships: [
          {
            foreignKeyName: "wiki_talk_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "wiki_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wiki_talk_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      search_documents: {
        Row: {
          body: string | null
          icon: string | null
          kind: string | null
          popularity: number | null
          route: string | null
          sub: string | null
          title: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_reply: {
        Args: { p_reply: number; p_thread: number }
        Returns: undefined
      }
      board_new_counts: {
        Args: never
        Returns: {
          board_id: string
          n: number
        }[]
      }
      board_path: { Args: { p_board: string }; Returns: string }
      can_post_as: { Args: { p_society: string }; Returns: boolean }
      delete_reply: { Args: { p_reply: number }; Returns: undefined }
      dtour_clear_demo: { Args: never; Returns: undefined }
      fmt_n: { Args: { n: number }; Returns: string }
      fuzzy_pattern: { Args: { q: string }; Returns: string }
      hook_before_user_created: { Args: { event: Json }; Returns: Json }
      is_moderator: { Args: never; Returns: boolean }
      is_society_poster: { Args: never; Returns: boolean }
      karma_breakdown: {
        Args: { p_user: string }
        Returns: {
          amount: number
          bucket: string
        }[]
      }
      karma_this_week: { Args: { p_user: string }; Returns: number }
      mark_notifications_read: { Args: never; Returns: undefined }
      notify: {
        Args: {
          p_actor: string
          p_article?: number
          p_kind: string
          p_msg?: number
          p_reply?: number
          p_route: string
          p_snippet?: string
          p_team?: number
          p_text: string
          p_thread?: number
          p_user: string
        }
        Returns: undefined
      }
      notify_mentions: {
        Args: {
          p_actor: string
          p_body: string
          p_msg?: number
          p_reply?: number
          p_route: string
          p_text: string
          p_thread?: number
        }
        Returns: undefined
      }
      notify_upvote: {
        Args: {
          p_actor: string
          p_owner: string
          p_reply: number
          p_thread: number
          p_title: string
        }
        Returns: undefined
      }
      promote_lounge_message: {
        Args: { p_board: string; p_message: number; p_title: string }
        Returns: number
      }
      record_download: { Args: { p_item: number }; Returns: string }
      resolve_report: {
        Args: { p_remove: boolean; p_report: number }
        Returns: undefined
      }
      review_team_request: {
        Args: { p_accept: boolean; p_role?: number; p_team: number; p_user: string }
        Returns: undefined
      }
      review_wiki_article: {
        Args: { p_approve: boolean; p_article: number; p_note?: string }
        Returns: undefined
      }
      review_wiki_revision: {
        Args: { p_approve: boolean; p_note?: string; p_revision: number }
        Returns: undefined
      }
      root_board_name: { Args: { p_board: string }; Returns: string }
      search: {
        Args: { p_kind?: string; p_limit?: number; q?: string }
        Returns: {
          body: string | null
          icon: string | null
          kind: string | null
          popularity: number | null
          route: string | null
          sub: string | null
          title: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "search_documents"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      search_total: { Args: { p_kind?: string }; Returns: number }
      set_reply_vote: {
        Args: { p_reply: number; p_value: number }
        Returns: number
      }
      set_thread_vote: {
        Args: { p_thread: number; p_value: number }
        Returns: number
      }
      toggle_heart: { Args: { p_place: number }; Returns: boolean }
      toggle_rsvp: { Args: { p_post: number }; Returns: boolean }
      toggle_team_request: { Args: { p_team: number }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
