-- 1. Attendance: per-punch location capture metadata
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS location_captured_at_in timestamptz,
  ADD COLUMN IF NOT EXISTS location_captured_at_out timestamptz,
  ADD COLUMN IF NOT EXISTS location_source_in text,
  ADD COLUMN IF NOT EXISTS location_source_out text;

-- 2. Rebuild kiosk_punch_v2 with location capture metadata (single canonical signature)
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc
           WHERE proname = 'kiosk_punch_v2' AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE 'DROP FUNCTION ' || r.sig;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.kiosk_punch_v2(
  _employee_id uuid,
  _mode text,
  _latitude double precision DEFAULT NULL,
  _longitude double precision DEFAULT NULL,
  _photo_url text DEFAULT NULL,
  _address text DEFAULT NULL,
  _employee_code text DEFAULT NULL,
  _employee_name text DEFAULT NULL,
  _device_type text DEFAULT NULL,
  _device_timestamp timestamptz DEFAULT NULL,
  _face_verified boolean DEFAULT NULL,
  _face_match_percentage real DEFAULT NULL,
  _face_detection_enabled boolean DEFAULT NULL,
  _gps_accuracy double precision DEFAULT NULL,
  _location_captured_at timestamptz DEFAULT NULL,
  _location_source text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _today DATE;
  _now TIMESTAMPTZ;
  _status TEXT;
  _hour INT;
  _existing_id UUID;
  _existing_time_in TIMESTAMPTZ;
  _existing_time_out TIMESTAMPTZ;
  _total_hours NUMERIC;
BEGIN
  _today := (NOW() AT TIME ZONE 'Asia/Manila')::DATE;
  _now := NOW();
  _hour := EXTRACT(HOUR FROM _now AT TIME ZONE 'Asia/Manila');
  _status := CASE WHEN _hour < 8 THEN 'On Time' ELSE 'Late' END;

  SELECT id, time_in, time_out
    INTO _existing_id, _existing_time_in, _existing_time_out
  FROM public.attendance
  WHERE employee_id = _employee_id AND date = _today
  LIMIT 1;

  IF _mode = 'in' THEN
    IF _existing_id IS NOT NULL AND _existing_time_in IS NOT NULL THEN
      RETURN json_build_object('ok', false, 'code', 'ALREADY_TIMED_IN',
        'error', 'You have already completed your Time In for today.');
    END IF;

    IF _existing_id IS NULL THEN
      INSERT INTO public.attendance (
        employee_id, date, time_in,
        photo_in_url, latitude_in, longitude_in,
        location_label_in, status,
        employee_code, employee_name, device_type, device_timestamp,
        face_verified, face_match_percentage, face_detection_enabled,
        gps_accuracy_in, latitude, longitude,
        location_captured_at_in, location_source_in
      )
      VALUES (
        _employee_id, _today, _now,
        _photo_url, _latitude, _longitude,
        _address, _status,
        _employee_code, _employee_name, _device_type, _device_timestamp,
        _face_verified, _face_match_percentage, _face_detection_enabled,
        _gps_accuracy, _latitude, _longitude,
        COALESCE(_location_captured_at, _now), _location_source
      );
    ELSE
      UPDATE public.attendance SET
        time_in = _now,
        photo_in_url = COALESCE(_photo_url, photo_in_url),
        latitude_in = COALESCE(_latitude, latitude_in),
        longitude_in = COALESCE(_longitude, longitude_in),
        location_label_in = COALESCE(_address, location_label_in),
        status = _status,
        gps_accuracy_in = COALESCE(_gps_accuracy, gps_accuracy_in),
        latitude = COALESCE(_latitude, latitude),
        longitude = COALESCE(_longitude, longitude),
        location_captured_at_in = COALESCE(_location_captured_at, _now),
        location_source_in = COALESCE(_location_source, location_source_in)
      WHERE id = _existing_id;
    END IF;

    RETURN json_build_object('ok', true, 'mode', 'in');
  ELSE
    IF _existing_id IS NOT NULL AND _existing_time_out IS NOT NULL THEN
      RETURN json_build_object('ok', false, 'code', 'ALREADY_TIMED_OUT',
        'error', 'You have already completed your Time Out for today.');
    END IF;

    IF _existing_id IS NULL THEN
      INSERT INTO public.attendance (
        employee_id, date, time_out,
        photo_out_url, latitude_out, longitude_out,
        location_label_out, status, locked,
        employee_code, employee_name, device_type, device_timestamp,
        face_verified, face_match_percentage, face_detection_enabled,
        gps_accuracy_out, latitude, longitude,
        location_captured_at_out, location_source_out
      )
      VALUES (
        _employee_id, _today, _now,
        _photo_url, _latitude, _longitude,
        _address, 'COMPLETED', true,
        _employee_code, _employee_name, _device_type, _device_timestamp,
        _face_verified, _face_match_percentage, _face_detection_enabled,
        _gps_accuracy, _latitude, _longitude,
        COALESCE(_location_captured_at, _now), _location_source
      );
    ELSE
      IF _existing_time_in IS NOT NULL THEN
        _total_hours := EXTRACT(EPOCH FROM (_now - _existing_time_in)) / 3600.0;
      ELSE
        _total_hours := 0;
      END IF;

      UPDATE public.attendance SET
        time_out = _now,
        photo_out_url = _photo_url,
        latitude_out = _latitude,
        longitude_out = _longitude,
        location_label_out = _address,
        total_hours = ROUND(_total_hours::NUMERIC, 2),
        face_verified = COALESCE(_face_verified, face_verified),
        face_match_percentage = COALESCE(_face_match_percentage, face_match_percentage),
        gps_accuracy_out = COALESCE(_gps_accuracy, gps_accuracy_out),
        location_captured_at_out = COALESCE(_location_captured_at, _now),
        location_source_out = COALESCE(_location_source, location_source_out),
        status = 'COMPLETED',
        locked = true
      WHERE id = _existing_id;
    END IF;

    RETURN json_build_object('ok', true, 'mode', 'out');
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.kiosk_punch_v2(uuid, text, double precision, double precision, text, text, text, text, text, timestamptz, boolean, real, boolean, double precision, timestamptz, text) TO anon, authenticated;

-- 3. Payroll override audit log
CREATE TABLE IF NOT EXISTS public.payroll_override_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id uuid,
  period_start date,
  period_end date,
  employee_id uuid,
  employee_code text,
  employee_name text,
  original_gross numeric,
  new_gross numeric,
  original_days_worked numeric,
  new_days_worked numeric,
  original_deductions numeric,
  new_deductions numeric,
  original_net_pay numeric,
  new_net_pay numeric,
  action text NOT NULL DEFAULT 'override',
  reason text NOT NULL,
  override_by uuid,
  override_by_email text,
  override_by_role text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.payroll_override_logs TO authenticated;
GRANT ALL ON public.payroll_override_logs TO service_role;

ALTER TABLE public.payroll_override_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authorized can insert payroll override logs" ON public.payroll_override_logs;
CREATE POLICY "Authorized can insert payroll override logs"
ON public.payroll_override_logs FOR INSERT TO authenticated
WITH CHECK (public.is_admin() OR public.is_hr() OR public.is_payroll_officer());

DROP POLICY IF EXISTS "Authorized can view payroll override logs" ON public.payroll_override_logs;
CREATE POLICY "Authorized can view payroll override logs"
ON public.payroll_override_logs FOR SELECT TO authenticated
USING (public.is_admin() OR public.is_hr() OR public.is_payroll_officer());