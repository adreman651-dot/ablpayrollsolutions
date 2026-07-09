
-- 1. Add locked flag
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS locked BOOLEAN NOT NULL DEFAULT false;

-- 2. Overrides audit table
CREATE TABLE IF NOT EXISTS public.attendance_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID REFERENCES public.attendance(id) ON DELETE CASCADE,
  employee_id UUID,
  employee_name TEXT,
  original_time_in TIMESTAMPTZ,
  new_time_in TIMESTAMPTZ,
  original_time_out TIMESTAMPTZ,
  new_time_out TIMESTAMPTZ,
  original_date DATE,
  new_date DATE,
  original_latitude DOUBLE PRECISION,
  original_longitude DOUBLE PRECISION,
  new_latitude DOUBLE PRECISION,
  new_longitude DOUBLE PRECISION,
  original_address TEXT,
  new_address TEXT,
  original_selfie_in TEXT,
  new_selfie_in TEXT,
  original_selfie_out TEXT,
  new_selfie_out TEXT,
  reason TEXT NOT NULL,
  modified_by UUID,
  modified_by_email TEXT,
  modified_by_role TEXT,
  device TEXT,
  platform TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.attendance_overrides TO authenticated;
GRANT ALL ON public.attendance_overrides TO service_role;

ALTER TABLE public.attendance_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin HR manage overrides" ON public.attendance_overrides;
CREATE POLICY "Admin HR manage overrides" ON public.attendance_overrides
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.is_hr())
  WITH CHECK (public.is_admin() OR public.is_hr());

DROP POLICY IF EXISTS "Payroll read overrides" ON public.attendance_overrides;
CREATE POLICY "Payroll read overrides" ON public.attendance_overrides
  FOR SELECT TO authenticated
  USING (public.is_payroll_officer());

CREATE INDEX IF NOT EXISTS attendance_overrides_created_at_idx
  ON public.attendance_overrides (created_at DESC);
CREATE INDEX IF NOT EXISTS attendance_overrides_employee_idx
  ON public.attendance_overrides (employee_id);

-- 3. Punch function with duplicate prevention + auto-lock on Time Out
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
  _gps_accuracy double precision DEFAULT NULL
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
  _existing_locked BOOLEAN;
  _total_hours NUMERIC;
BEGIN
  _today := (NOW() AT TIME ZONE 'Asia/Manila')::DATE;
  _now := NOW();
  _hour := EXTRACT(HOUR FROM _now AT TIME ZONE 'Asia/Manila');
  _status := CASE WHEN _hour < 8 THEN 'On Time' ELSE 'Late' END;

  SELECT id, time_in, time_out, COALESCE(locked,false)
    INTO _existing_id, _existing_time_in, _existing_time_out, _existing_locked
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
        gps_accuracy_in, latitude, longitude
      )
      VALUES (
        _employee_id, _today, _now,
        _photo_url, _latitude, _longitude,
        _address, _status,
        _employee_code, _employee_name, _device_type, _device_timestamp,
        _face_verified, _face_match_percentage, _face_detection_enabled,
        _gps_accuracy, _latitude, _longitude
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
        longitude = COALESCE(_longitude, longitude)
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
        gps_accuracy_out, latitude, longitude
      )
      VALUES (
        _employee_id, _today, _now,
        _photo_url, _latitude, _longitude,
        _address, 'COMPLETED', true,
        _employee_code, _employee_name, _device_type, _device_timestamp,
        _face_verified, _face_match_percentage, _face_detection_enabled,
        _gps_accuracy, _latitude, _longitude
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
        latitude = COALESCE(_latitude, latitude),
        longitude = COALESCE(_longitude, longitude),
        status = 'COMPLETED',
        locked = true
      WHERE id = _existing_id;
    END IF;

    RETURN json_build_object('ok', true, 'mode', 'out');
  END IF;
END;
$function$;

-- Make sure existing completed records are locked
UPDATE public.attendance SET locked = true
  WHERE time_out IS NOT NULL AND locked = false;
