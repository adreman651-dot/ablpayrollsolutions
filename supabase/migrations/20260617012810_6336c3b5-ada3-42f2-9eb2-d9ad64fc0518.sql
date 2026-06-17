ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS sss_contribution numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS phic_contribution numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hdmf_contribution numeric NOT NULL DEFAULT 0;