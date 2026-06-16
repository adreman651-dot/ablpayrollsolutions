
ALTER TABLE public.payroll_items ADD COLUMN IF NOT EXISTS cash_advance numeric(12,2) DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS payroll_type text NOT NULL DEFAULT 'monthly';

INSERT INTO public.system_settings (key, value, description)
VALUES ('company_name', 'JHAYMARTS INDUSTRIES INC.', 'Company name shown on payslips and reports')
ON CONFLICT (key) DO NOTHING;
