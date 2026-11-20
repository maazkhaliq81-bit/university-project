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
      agent_conversations: {
        Row: {
          created_at: string
          id: string
          pinned: boolean
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pinned?: boolean
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pinned?: boolean
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "agent_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          answers: Json
          created_at: string
          id: string
          level: string | null
          target_role: string
          updated_at: string
          user_id: string
          verdict: Json | null
        }
        Insert: {
          answers?: Json
          created_at?: string
          id?: string
          level?: string | null
          target_role: string
          updated_at?: string
          user_id: string
          verdict?: Json | null
        }
        Update: {
          answers?: Json
          created_at?: string
          id?: string
          level?: string | null
          target_role?: string
          updated_at?: string
          user_id?: string
          verdict?: Json | null
        }
        Relationships: []
      }
      courses: {
        Row: {
          completed: boolean
          created_at: string
          difficulty: string | null
          id: string
          reason: string | null
          relevance: number | null
          source: string
          title: string
          topic: string
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          difficulty?: string | null
          id?: string
          reason?: string | null
          relevance?: number | null
          source?: string
          title: string
          topic: string
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          difficulty?: string | null
          id?: string
          reason?: string | null
          relevance?: number | null
          source?: string
          title?: string
          topic?: string
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      cv_documents: {
        Row: {
          created_at: string
          data: Json
          id: string
          template: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          template?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          template?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      interview_sessions: {
        Row: {
          created_at: string
          evaluation: Json | null
          id: string
          interview_type: string
          overall_score: number | null
          role: string
          status: string
          transcript: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          evaluation?: Json | null
          id?: string
          interview_type?: string
          overall_score?: number | null
          role: string
          status?: string
          transcript?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          evaluation?: Json | null
          id?: string
          interview_type?: string
          overall_score?: number | null
          role?: string
          status?: string
          transcript?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      job_matches: {
        Row: {
          apply_links: Json
          company: string | null
          created_at: string
          description: string | null
          employment_type: string | null
          experience: string | null
          fit_score: number | null
          id: string
          level: string | null
          location: string | null
          salary_range: string | null
          skills: Json
          title: string
          url: string | null
          user_id: string
        }
        Insert: {
          apply_links?: Json
          company?: string | null
          created_at?: string
          description?: string | null
          employment_type?: string | null
          experience?: string | null
          fit_score?: number | null
          id?: string
          level?: string | null
          location?: string | null
          salary_range?: string | null
          skills?: Json
          title: string
          url?: string | null
          user_id: string
        }
        Update: {
          apply_links?: Json
          company?: string | null
          created_at?: string
          description?: string | null
          employment_type?: string | null
          experience?: string | null
          fit_score?: number | null
          id?: string
          level?: string | null
          location?: string | null
          salary_range?: string | null
          skills?: Json
          title?: string
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      portfolios: {
        Row: {
          bio: string | null
          created_at: string
          github_username: string
          id: string
          projects: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          github_username: string
          id?: string
          projects?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          github_username?: string
          id?: string
          projects?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          github_username: string | null
          headline: string | null
          id: string
          target_role: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          github_username?: string | null
          headline?: string | null
          id: string
          target_role?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          github_username?: string | null
          headline?: string | null
          id?: string
          target_role?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      quizzes: {
        Row: {
          answers: Json
          course_id: string | null
          created_at: string
          id: string
          questions: Json
          score: number | null
          topic: string
          updated_at: string
          user_id: string
          weak_concepts: Json
        }
        Insert: {
          answers?: Json
          course_id?: string | null
          created_at?: string
          id?: string
          questions?: Json
          score?: number | null
          topic: string
          updated_at?: string
          user_id: string
          weak_concepts?: Json
        }
        Update: {
          answers?: Json
          course_id?: string | null
          created_at?: string
          id?: string
          questions?: Json
          score?: number | null
          topic?: string
          updated_at?: string
          user_id?: string
          weak_concepts?: Json
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      resumes: {
        Row: {
          analysis: Json | null
          ats_score: number | null
          content: string
          created_at: string
          id: string
          target_role: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis?: Json | null
          ats_score?: number | null
          content: string
          created_at?: string
          id?: string
          target_role?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis?: Json | null
          ats_score?: number | null
          content?: string
          created_at?: string
          id?: string
          target_role?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      roadmap_items: {
        Row: {
          created_at: string
          description: string | null
          estimated_weeks: number | null
          id: string
          position: number
          status: string
          sub_topics: Json
          topic: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          estimated_weeks?: number | null
          id?: string
          position?: number
          status?: string
          sub_topics?: Json
          topic: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          estimated_weeks?: number | null
          id?: string
          position?: number
          status?: string
          sub_topics?: Json
          topic?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      skill_assessments: {
        Row: {
          analysis: Json
          created_at: string
          current_skills: string | null
          id: string
          overall_score: number | null
          target_role: string
          user_id: string
        }
        Insert: {
          analysis: Json
          created_at?: string
          current_skills?: string | null
          id?: string
          overall_score?: number | null
          target_role: string
          user_id: string
        }
        Update: {
          analysis?: Json
          created_at?: string
          current_skills?: string | null
          id?: string
          overall_score?: number | null
          target_role?: string
          user_id?: string
        }
        Relationships: []
      }
      study_sessions: {
        Row: {
          created_at: string
          day: string
          id: string
          minutes: number
          user_id: string
        }
        Insert: {
          created_at?: string
          day?: string
          id?: string
          minutes?: number
          user_id: string
        }
        Update: {
          created_at?: string
          day?: string
          id?: string
          minutes?: number
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
