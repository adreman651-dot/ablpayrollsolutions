
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'hr', 'payroll_officer', 'employee');

-- Create employees table
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  middle_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  birthdate DATE,
  hire_date DATE NOT NULL DEFAULT CURRENT_DATE,
  job_title TEXT,
  department TEXT,
  basic_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
  sss_number TEXT,
  philhealth_number TEXT,
  pagibig_number TEXT,
  tin_number TEXT,
  employment_status TEXT NOT NULL DEFAULT 'active',
  profile_photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create profiles table linking auth users to employees and roles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table (separate from profiles per security guidance)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Create attendance table
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  time_in TIMESTAMPTZ,
  time_out TIMESTAMPTZ,
  selfie_url TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  late_minutes INTEGER DEFAULT 0,
  status TEXT DEFAULT 'present',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create leave_types table
CREATE TABLE public.leave_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  credits_per_year NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create leaves table
CREATE TABLE public.leaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type_id UUID NOT NULL REFERENCES public.leave_types(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  duration NUMERIC(5,2) NOT NULL DEFAULT 1,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create payroll_runs table
CREATE TABLE public.payroll_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  run_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create payroll_items table
CREATE TABLE public.payroll_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id UUID NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  basic_pay NUMERIC(12,2) DEFAULT 0,
  overtime_pay NUMERIC(12,2) DEFAULT 0,
  holiday_pay NUMERIC(12,2) DEFAULT 0,
  allowances NUMERIC(12,2) DEFAULT 0,
  gross_pay NUMERIC(12,2) DEFAULT 0,
  late_deductions NUMERIC(12,2) DEFAULT 0,
  absence_deductions NUMERIC(12,2) DEFAULT 0,
  sss_contribution NUMERIC(12,2) DEFAULT 0,
  philhealth_contribution NUMERIC(12,2) DEFAULT 0,
  pagibig_contribution NUMERIC(12,2) DEFAULT 0,
  withholding_tax NUMERIC(12,2) DEFAULT 0,
  loan_deductions NUMERIC(12,2) DEFAULT 0,
  other_deductions NUMERIC(12,2) DEFAULT 0,
  total_deductions NUMERIC(12,2) DEFAULT 0,
  net_pay NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create loans table
CREATE TABLE public.loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  loan_type TEXT NOT NULL,
  principal_amount NUMERIC(12,2) NOT NULL,
  monthly_amortization NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  remaining_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  start_date DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create loan_payments table
CREATE TABLE public.loan_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  payroll_run_id UUID REFERENCES public.payroll_runs(id),
  amount NUMERIC(12,2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create system_settings table
CREATE TABLE public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default settings
INSERT INTO public.system_settings (key, value, description) VALUES
  ('cutoff_time', '08:00', 'Daily cutoff time for tardiness detection'),
  ('working_days_per_month', '26', 'Working days per month for daily rate calculation'),
  ('working_hours_per_day', '8', 'Working hours per day for hourly rate calculation'),
  ('sss_employer_share', '9.5', 'SSS employer share percentage'),
  ('philhealth_rate', '5', 'PhilHealth premium rate percentage (total, split equally)'),
  ('pagibig_employee', '200', 'Pag-IBIG employee monthly contribution'),
  ('pagibig_employer', '200', 'Pag-IBIG employer monthly contribution');

-- Insert default leave types
INSERT INTO public.leave_types (name, description, credits_per_year) VALUES
  ('Vacation Leave', 'Annual vacation leave', 15),
  ('Sick Leave', 'Annual sick leave', 15),
  ('Emergency Leave', 'Emergency leave', 3),
  ('Maternity Leave', 'Maternity leave (female employees)', 105),
  ('Paternity Leave', 'Paternity leave (male employees)', 7);

-- Enable RLS on all tables
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

-- Helper to check if user is HR
CREATE OR REPLACE FUNCTION public.is_hr()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'hr')
$$;

-- Helper to check if user is payroll officer
CREATE OR REPLACE FUNCTION public.is_payroll_officer()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'payroll_officer')
$$;

-- Get employee_id for current user
CREATE OR REPLACE FUNCTION public.get_my_employee_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT employee_id FROM public.profiles WHERE id = auth.uid()
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-generate employee code
CREATE OR REPLACE FUNCTION public.generate_employee_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  next_code TEXT;
  count_emp INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO count_emp FROM public.employees;
  next_code := 'ABL-' || LPAD(count_emp::TEXT, 5, '0');
  -- Handle collisions
  WHILE EXISTS (SELECT 1 FROM public.employees WHERE employee_code = next_code) LOOP
    count_emp := count_emp + 1;
    next_code := 'ABL-' || LPAD(count_emp::TEXT, 5, '0');
  END LOOP;
  NEW.employee_code := next_code;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_employee_code
  BEFORE INSERT ON public.employees
  FOR EACH ROW
  WHEN (NEW.employee_code IS NULL OR NEW.employee_code = '')
  EXECUTE FUNCTION public.generate_employee_code();

-- Updated_at triggers
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_leaves_updated_at BEFORE UPDATE ON public.leaves FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_payroll_runs_updated_at BEFORE UPDATE ON public.payroll_runs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_loans_updated_at BEFORE UPDATE ON public.loans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS Policies

-- profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin() OR public.is_hr());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Admin/HR can insert profiles" ON public.profiles FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.is_hr());

-- user_roles
CREATE POLICY "Admin can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

-- employees
CREATE POLICY "Admin/HR full access employees" ON public.employees FOR ALL TO authenticated USING (public.is_admin() OR public.is_hr());
CREATE POLICY "PO can read employees" ON public.employees FOR SELECT TO authenticated USING (public.is_payroll_officer());
CREATE POLICY "Employee can read own" ON public.employees FOR SELECT TO authenticated USING (id = public.get_my_employee_id());

-- attendance
CREATE POLICY "Admin/HR full access attendance" ON public.attendance FOR ALL TO authenticated USING (public.is_admin() OR public.is_hr());
CREATE POLICY "PO can read attendance" ON public.attendance FOR SELECT TO authenticated USING (public.is_payroll_officer());
CREATE POLICY "Employee can read own attendance" ON public.attendance FOR SELECT TO authenticated USING (employee_id = public.get_my_employee_id());
CREATE POLICY "Employee can insert own attendance" ON public.attendance FOR INSERT TO authenticated WITH CHECK (employee_id = public.get_my_employee_id());

-- leave_types
CREATE POLICY "Admin/HR manage leave types" ON public.leave_types FOR ALL TO authenticated USING (public.is_admin() OR public.is_hr());
CREATE POLICY "All authenticated can read leave types" ON public.leave_types FOR SELECT TO authenticated USING (true);

-- leaves
CREATE POLICY "Admin/HR full access leaves" ON public.leaves FOR ALL TO authenticated USING (public.is_admin() OR public.is_hr());
CREATE POLICY "PO can read leaves" ON public.leaves FOR SELECT TO authenticated USING (public.is_payroll_officer());
CREATE POLICY "Employee can read own leaves" ON public.leaves FOR SELECT TO authenticated USING (employee_id = public.get_my_employee_id());
CREATE POLICY "Employee can create own leave" ON public.leaves FOR INSERT TO authenticated WITH CHECK (employee_id = public.get_my_employee_id());
CREATE POLICY "Employee can update own leave" ON public.leaves FOR UPDATE TO authenticated USING (employee_id = public.get_my_employee_id() AND status = 'pending');

-- payroll_runs
CREATE POLICY "Admin/PO full access payroll runs" ON public.payroll_runs FOR ALL TO authenticated USING (public.is_admin() OR public.is_payroll_officer());
CREATE POLICY "HR can read payroll runs" ON public.payroll_runs FOR SELECT TO authenticated USING (public.is_hr());

-- payroll_items
CREATE POLICY "Admin/PO full access payroll items" ON public.payroll_items FOR ALL TO authenticated USING (public.is_admin() OR public.is_payroll_officer());
CREATE POLICY "HR can read payroll items" ON public.payroll_items FOR SELECT TO authenticated USING (public.is_hr());
CREATE POLICY "Employee can read own payroll items" ON public.payroll_items FOR SELECT TO authenticated USING (employee_id = public.get_my_employee_id());

-- loans
CREATE POLICY "Admin/PO full access loans" ON public.loans FOR ALL TO authenticated USING (public.is_admin() OR public.is_payroll_officer());
CREATE POLICY "HR can read loans" ON public.loans FOR SELECT TO authenticated USING (public.is_hr());
CREATE POLICY "Employee can read own loans" ON public.loans FOR SELECT TO authenticated USING (employee_id = public.get_my_employee_id());
CREATE POLICY "Employee can create own loan" ON public.loans FOR INSERT TO authenticated WITH CHECK (employee_id = public.get_my_employee_id());

-- loan_payments
CREATE POLICY "Admin/PO full access loan payments" ON public.loan_payments FOR ALL TO authenticated USING (public.is_admin() OR public.is_payroll_officer());
CREATE POLICY "HR can read loan payments" ON public.loan_payments FOR SELECT TO authenticated USING (public.is_hr());

-- system_settings
CREATE POLICY "Admin/HR manage settings" ON public.system_settings FOR ALL TO authenticated USING (public.is_admin() OR public.is_hr());
CREATE POLICY "All authenticated can read settings" ON public.system_settings FOR SELECT TO authenticated USING (true);
