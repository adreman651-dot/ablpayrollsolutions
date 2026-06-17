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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          created_at: string
          date: string
          employee_id: string
          id: string
          late_minutes: number | null
          latitude: number | null
          longitude: number | null
          notes: string | null
          overtime_minutes: number | null
          selfie_url: string | null
          status: string | null
          time_in: string | null
          time_out: string | null
          total_hours_worked: number | null
          undertime_minutes: number | null
        }
        Insert: {
          created_at?: string
          date?: string
          employee_id: string
          id?: string
          late_minutes?: number | null
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          overtime_minutes?: number | null
          selfie_url?: string | null
          status?: string | null
          time_in?: string | null
          time_out?: string | null
          total_hours_worked?: number | null
          undertime_minutes?: number | null
        }
        Update: {
          created_at?: string
          date?: string
          employee_id?: string
          id?: string
          late_minutes?: number | null
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          overtime_minutes?: number | null
          selfie_url?: string | null
          status?: string | null
          time_in?: string | null
          time_out?: string | null
          total_hours_worked?: number | null
          undertime_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          address: string | null
          basic_salary: number
          birthdate: string | null
          created_at: string
          department: string | null
          email: string | null
          employee_code: string
          employment_status: string
          first_name: string
          hdmf_schedule: string
          hire_date: string
          id: string
          job_title: string | null
          last_name: string
          leave_credits: number | null
          middle_name: string | null
          pagibig_number: string | null
          payroll_type: string
          phic_schedule: string
          philhealth_number: string | null
          phone: string | null
          profile_photo_url: string | null
          sss_number: string | null
          sss_schedule: string
          tin_number: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          basic_salary?: number
          birthdate?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          employee_code: string
          employment_status?: string
          first_name: string
          hdmf_schedule?: string
          hire_date?: string
          id?: string
          job_title?: string | null
          last_name: string
          leave_credits?: number | null
          middle_name?: string | null
          pagibig_number?: string | null
          payroll_type?: string
          phic_schedule?: string
          philhealth_number?: string | null
          phone?: string | null
          profile_photo_url?: string | null
          sss_number?: string | null
          sss_schedule?: string
          tin_number?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          basic_salary?: number
          birthdate?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          employee_code?: string
          employment_status?: string
          first_name?: string
          hdmf_schedule?: string
          hire_date?: string
          id?: string
          job_title?: string | null
          last_name?: string
          leave_credits?: number | null
          middle_name?: string | null
          pagibig_number?: string | null
          payroll_type?: string
          phic_schedule?: string
          philhealth_number?: string | null
          phone?: string | null
          profile_photo_url?: string | null
          sss_number?: string | null
          sss_schedule?: string
          tin_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      leave_types: {
        Row: {
          created_at: string
          credits_per_year: number
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          credits_per_year?: number
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          credits_per_year?: number
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      leaves: {
        Row: {
          approved_by: string | null
          created_at: string
          duration: number
          employee_id: string
          end_date: string
          id: string
          leave_type_id: string
          reason: string | null
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          duration?: number
          employee_id: string
          end_date: string
          id?: string
          leave_type_id: string
          reason?: string | null
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          duration?: number
          employee_id?: string
          end_date?: string
          id?: string
          leave_type_id?: string
          reason?: string | null
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaves_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaves_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          loan_id: string
          payment_date: string
          payroll_run_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          loan_id: string
          payment_date?: string
          payroll_run_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          loan_id?: string
          payment_date?: string
          payroll_run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_payments_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          approved_by: string | null
          created_at: string
          employee_id: string
          id: string
          loan_type: string
          monthly_amortization: number
          per_cutoff_amortization: number
          principal_amount: number
          remaining_balance: number
          start_date: string | null
          status: string
          total_paid: number
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          employee_id: string
          id?: string
          loan_type: string
          monthly_amortization?: number
          per_cutoff_amortization?: number
          principal_amount: number
          remaining_balance?: number
          start_date?: string | null
          status?: string
          total_paid?: number
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          loan_type?: string
          monthly_amortization?: number
          per_cutoff_amortization?: number
          principal_amount?: number
          remaining_balance?: number
          start_date?: string | null
          status?: string
          total_paid?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loans_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_items: {
        Row: {
          absence_deductions: number | null
          allowances: number | null
          basic_pay: number | null
          cash_advance: number | null
          created_at: string
          employee_id: string
          gross_pay: number | null
          holiday_pay: number | null
          id: string
          late_deductions: number | null
          loan_deductions: number | null
          net_pay: number | null
          other_deductions: number | null
          overtime_pay: number | null
          pagibig_contribution: number | null
          payroll_run_id: string
          philhealth_contribution: number | null
          sss_contribution: number | null
          total_deductions: number | null
          withholding_tax: number | null
        }
        Insert: {
          absence_deductions?: number | null
          allowances?: number | null
          basic_pay?: number | null
          cash_advance?: number | null
          created_at?: string
          employee_id: string
          gross_pay?: number | null
          holiday_pay?: number | null
          id?: string
          late_deductions?: number | null
          loan_deductions?: number | null
          net_pay?: number | null
          other_deductions?: number | null
          overtime_pay?: number | null
          pagibig_contribution?: number | null
          payroll_run_id: string
          philhealth_contribution?: number | null
          sss_contribution?: number | null
          total_deductions?: number | null
          withholding_tax?: number | null
        }
        Update: {
          absence_deductions?: number | null
          allowances?: number | null
          basic_pay?: number | null
          cash_advance?: number | null
          created_at?: string
          employee_id?: string
          gross_pay?: number | null
          holiday_pay?: number | null
          id?: string
          late_deductions?: number | null
          loan_deductions?: number | null
          net_pay?: number | null
          other_deductions?: number | null
          overtime_pay?: number | null
          pagibig_contribution?: number | null
          payroll_run_id?: string
          philhealth_contribution?: number | null
          sss_contribution?: number | null
          total_deductions?: number | null
          withholding_tax?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_items_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_items_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_runs: {
        Row: {
          created_at: string
          created_by: string | null
          cutoff_type: string
          id: string
          notes: string | null
          period_end: string
          period_start: string
          run_date: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          cutoff_type?: string
          id?: string
          notes?: string | null
          period_end: string
          period_start: string
          run_date?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          cutoff_type?: string
          id?: string
          notes?: string | null
          period_end?: string
          period_start?: string
          run_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          employee_id: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          employee_id?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          employee_id?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_my_employee_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_hr: { Args: never; Returns: boolean }
      is_payroll_officer: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "hr" | "payroll_officer" | "employee"
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
      app_role: ["admin", "hr", "payroll_officer", "employee"],
    },
  },
} as const
