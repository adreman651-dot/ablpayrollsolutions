
DROP POLICY IF EXISTS "Kiosk can read employees for time-in" ON public.employees;
DROP POLICY IF EXISTS "Kiosk can read attendance" ON public.attendance;
DROP POLICY IF EXISTS "Kiosk can insert attendance" ON public.attendance;
DROP POLICY IF EXISTS "Kiosk can update attendance" ON public.attendance;
DROP POLICY IF EXISTS "Kiosk can read system settings" ON public.system_settings;

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.employees FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.attendance FROM anon;
REVOKE SELECT ON public.system_settings FROM anon;

CREATE OR REPLACE FUNCTION public.kiosk_lookup_employee(_code text)
RETURNS TABLE(employee_code text, first_name text, last_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.employee_code, e.first_name, e.last_name
  FROM public.employees e
  WHERE e.employee_code = _code
    AND COALESCE(e.employment_status, 'active') = 'active'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.kiosk_punch(
  _code text,
  _mode text,
  _latitude numeric,
  _longitude numeric,
  _selfie text,
  _address text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp public.employees%ROWTYPE;
  v_existing public.attendance%ROWTYPE;
  v_today date := (now() AT TIME ZONE 'Asia/Manila')::date;
  v_stamp timestamptz := now();
  v_cutoff_raw text;
  v_late int := 0;
  v_total_hours numeric := 0;
  v_overtime int := 0;
  v_undertime int := 0;
  v_found_existing boolean := false;
BEGIN
  IF _code IS NULL OR length(trim(_code)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Employee code required');
  END IF;
  IF _mode NOT IN ('in','out') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid mode');
  END IF;

  SELECT * INTO v_emp FROM public.employees
   WHERE employee_code = _code
     AND COALESCE(employment_status,'active') = 'active'
   LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Employee not found');
  END IF;

  SELECT * INTO v_existing FROM public.attendance
   WHERE employee_id = v_emp.id AND date = v_today LIMIT 1;
  v_found_existing := FOUND;

  IF _mode = 'in' THEN
    IF v_found_existing THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Already timed in today');
    END IF;

    SELECT value::text INTO v_cutoff_raw FROM public.system_settings WHERE key = 'cutoff_time' LIMIT 1;
    IF v_cutoff_raw IS NOT NULL THEN
      DECLARE
        v_h int;
        v_m int;
        v_cut timestamptz;
        parts text[];
      BEGIN
        parts := string_to_array(trim(both '"' from v_cutoff_raw), ':');
        v_h := COALESCE(parts[1]::int, 0);
        v_m := COALESCE(parts[2]::int, 0);
        v_cut := (v_today::timestamp + make_interval(hours => v_h, mins => v_m)) AT TIME ZONE 'Asia/Manila';
        IF v_stamp > v_cut THEN
          v_late := CEIL(EXTRACT(EPOCH FROM (v_stamp - v_cut)) / 60.0)::int;
        END IF;
      EXCEPTION WHEN OTHERS THEN v_late := 0;
      END;
    END IF;

    INSERT INTO public.attendance (
      employee_id, date, time_in, latitude, longitude, selfie_url,
      late_minutes, status, notes
    ) VALUES (
      v_emp.id, v_today, v_stamp, _latitude, _longitude, _selfie,
      v_late, CASE WHEN v_late > 0 THEN 'late' ELSE 'present' END, _address
    );

    RETURN jsonb_build_object(
      'ok', true, 'mode', 'in',
      'first_name', v_emp.first_name, 'last_name', v_emp.last_name,
      'late_minutes', v_late
    );
  ELSE
    IF NOT v_found_existing THEN
      RETURN jsonb_build_object('ok', false, 'error', 'No time-in record for today');
    END IF;
    IF v_existing.time_out IS NOT NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Already timed out today');
    END IF;

    v_total_hours := EXTRACT(EPOCH FROM (v_stamp - v_existing.time_in)) / 3600.0;
    IF v_total_hours > 5 THEN v_total_hours := v_total_hours - 1; END IF;
    IF v_total_hours > 8 THEN v_overtime := ROUND((v_total_hours - 8) * 60); END IF;
    IF v_total_hours > 0 AND v_total_hours < 8 THEN v_undertime := ROUND((8 - v_total_hours) * 60); END IF;

    UPDATE public.attendance SET
      time_out = v_stamp,
      selfie_url = COALESCE(_selfie, selfie_url),
      total_hours_worked = GREATEST(0, ROUND(v_total_hours, 2)),
      overtime_minutes = v_overtime,
      undertime_minutes = v_undertime
    WHERE id = v_existing.id;

    RETURN jsonb_build_object(
      'ok', true, 'mode', 'out',
      'first_name', v_emp.first_name, 'last_name', v_emp.last_name
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.kiosk_lookup_employee(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.kiosk_punch(text,text,numeric,numeric,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kiosk_lookup_employee(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kiosk_punch(text,text,numeric,numeric,text,text) TO anon, authenticated;
