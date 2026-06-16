-- ============================================================
-- ABL Payroll Solutions – Philippine Payroll System v2.0
-- Database Migration Script
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ─── 1. ADD MISSING COLUMNS TO employees TABLE ──────────────
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS payroll_type TEXT NOT NULL DEFAULT 'monthly_rate'
    CHECK (payroll_type IN ('monthly_rate', 'daily_rate', 'hourly_rate'));

-- ─── 2. ADD MISSING COLUMNS TO attendance TABLE ─────────────
ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS location_address TEXT,
  ADD COLUMN IF NOT EXISTS device_information TEXT,
  ADD COLUMN IF NOT EXISTS undertime_minutes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overtime_minutes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_hours_worked NUMERIC(5,2) DEFAULT 0;

-- ─── 3. RENAME latitude/longitude → gps_latitude/gps_longitude (if needed)
-- (Only run if your existing columns are named 'latitude'/'longitude')
-- ALTER TABLE attendance RENAME COLUMN latitude TO gps_latitude;
-- ALTER TABLE attendance RENAME COLUMN longitude TO gps_longitude;

-- ─── 4. ADD COMPUTED TIME FIELDS TO payroll_items ────────────
ALTER TABLE payroll_items
  ADD COLUMN IF NOT EXISTS leave_days INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS days_worked INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gross_income NUMERIC(12,2) DEFAULT 0;

-- ─── 5. ENSURE leave_types TABLE HAS PH DEFAULT TYPES ────────
INSERT INTO leave_types (name, credits_per_year)
SELECT v.name, v.credits
FROM (VALUES
  ('Sick Leave', 5),
  ('Vacation Leave', 5),
  ('Emergency Leave', 3),
  ('Maternity Leave', 105),
  ('Paternity Leave', 7),
  ('Other Leave', 3)
) AS v(name, credits)
WHERE NOT EXISTS (
  SELECT 1 FROM leave_types WHERE leave_types.name = v.name
);

-- ─── 6. ENSURE SYSTEM SETTINGS HAS PH PAYROLL DEFAULTS ──────
INSERT INTO system_settings (key, value, description)
SELECT v.key, v.value, v.desc
FROM (VALUES
  ('company_name', 'ABL Payroll Solutions Inc.', 'Company name shown on payslips'),
  ('company_address', 'Philippines', 'Company address shown on payslips'),
  ('payroll_frequency', 'semi-monthly', 'How often payroll is processed'),
  ('cutoff_time', '08:30', 'Regular work start time HH:MM'),
  ('work_hours_per_day', '8', 'Standard working hours per day'),
  ('working_days_per_month', '26', 'Working days per month for daily rate computation'),
  ('overtime_rate', '1.25', 'Overtime rate multiplier'),
  ('holiday_rate', '2.0', 'Regular holiday pay rate multiplier'),
  ('special_holiday_rate', '1.3', 'Special holiday pay rate multiplier'),
  ('pagibig_employee', '200', 'Pag-IBIG employee monthly contribution'),
  ('pagibig_employer', '200', 'Pag-IBIG employer monthly contribution'),
  ('sss_rate_ee', '0.05', 'SSS employee contribution rate (5%)'),
  ('sss_rate_er', '0.10', 'SSS employer contribution rate (10%)'),
  ('philhealth_rate', '0.05', 'PhilHealth premium rate (5%, split 50/50)')
) AS v(key, value, desc)
WHERE NOT EXISTS (
  SELECT 1 FROM system_settings WHERE system_settings.key = v.key
);

-- ─── 7. CREATE INDEX FOR PERFORMANCE ──────────────────────────
CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON attendance(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_payroll_items_run ON payroll_items(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_leaves_employee ON leaves(employee_id, status);

-- ─── 8. ENABLE RLS POLICIES (if not already enabled) ─────────
-- These are informational; run if you get permission errors:
-- ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE payroll_items ENABLE ROW LEVEL SECURITY;

-- ─── 9. VERIFY MIGRATION ──────────────────────────────────────
SELECT
  'employees' AS table_name,
  count(*) AS row_count
FROM employees
UNION ALL
SELECT 'attendance', count(*) FROM attendance
UNION ALL
SELECT 'payroll_items', count(*) FROM payroll_items
UNION ALL
SELECT 'leave_types', count(*) FROM leave_types
UNION ALL
SELECT 'system_settings', count(*) FROM system_settings;
