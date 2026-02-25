
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS leave_credits numeric DEFAULT 0;
