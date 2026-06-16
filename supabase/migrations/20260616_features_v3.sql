-- ============================================================
-- ABL Payroll Solutions
-- Database Migration Script - Features v3
-- Add deduction schedules and auto-cutoffs
-- ============================================================

-- 1. Add government deduction schedules to employees
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS sss_schedule TEXT DEFAULT 'both',
  ADD COLUMN IF NOT EXISTS phic_schedule TEXT DEFAULT 'both',
  ADD COLUMN IF NOT EXISTS hdmf_schedule TEXT DEFAULT 'both';

-- 2. Add per cut-off amortization to loans
ALTER TABLE loans
  ADD COLUMN IF NOT EXISTS per_cutoff_amortization NUMERIC(12,2) DEFAULT 0;

-- 3. Add cutoff_type to payroll runs
ALTER TABLE payroll_runs
  ADD COLUMN IF NOT EXISTS cutoff_type TEXT DEFAULT 'both';

-- 4. Seed new System Settings for Auto-Cutoff
INSERT INTO system_settings (key, value)
VALUES 
  ('cutoff_days_before_payout', '3'),
  ('cutoff_skip_weekends', 'false')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
