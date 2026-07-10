
-- Attendance Status management columns
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS attendance_status TEXT,
  ADD COLUMN IF NOT EXISTS status_reason TEXT,
  ADD COLUMN IF NOT EXISTS status_modified_by UUID,
  ADD COLUMN IF NOT EXISTS status_modified_by_email TEXT,
  ADD COLUMN IF NOT EXISTS status_modified_by_role TEXT,
  ADD COLUMN IF NOT EXISTS status_modified_at TIMESTAMPTZ;

-- Audit log for status changes
CREATE TABLE IF NOT EXISTS public.attendance_status_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID,
  employee_id UUID,
  employee_name TEXT,
  attendance_date DATE,
  old_status TEXT,
  new_status TEXT,
  reason TEXT,
  modified_by UUID,
  modified_by_email TEXT,
  modified_by_role TEXT,
  platform TEXT,
  device TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_status_logs TO authenticated;
GRANT ALL ON public.attendance_status_logs TO service_role;

ALTER TABLE public.attendance_status_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and HR can view status logs"
  ON public.attendance_status_logs FOR SELECT TO authenticated
  USING (public.is_admin() OR public.is_hr());

CREATE POLICY "Admins and HR can insert status logs"
  ON public.attendance_status_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.is_hr());
