
-- Add columns that existing code expects
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS sss_schedule text NOT NULL DEFAULT 'both',
  ADD COLUMN IF NOT EXISTS phic_schedule text NOT NULL DEFAULT 'both',
  ADD COLUMN IF NOT EXISTS hdmf_schedule text NOT NULL DEFAULT 'both';

ALTER TABLE public.loans
  ADD COLUMN IF NOT EXISTS per_cutoff_amortization numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS total_hours_worked numeric(6,2),
  ADD COLUMN IF NOT EXISTS overtime_minutes integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS undertime_minutes integer DEFAULT 0;

ALTER TABLE public.payroll_runs
  ADD COLUMN IF NOT EXISTS cutoff_type text NOT NULL DEFAULT 'both';
