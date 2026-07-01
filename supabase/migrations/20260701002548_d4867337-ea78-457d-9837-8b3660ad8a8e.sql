
-- Face detection & attendance filters
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS face_detection_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS face_descriptor JSONB;

ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS face_verified BOOLEAN,
  ADD COLUMN IF NOT EXISTS face_match_percentage REAL,
  ADD COLUMN IF NOT EXISTS face_detection_enabled BOOLEAN;

-- Add missing columns from earlier code (device_type, employee_code, employee_name on attendance were referenced but may not exist)
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS device_type TEXT,
  ADD COLUMN IF NOT EXISTS employee_code TEXT,
  ADD COLUMN IF NOT EXISTS employee_name TEXT,
  ADD COLUMN IF NOT EXISTS device_timestamp TIMESTAMPTZ;

-- Storage policies for employee-photos (private bucket)
DROP POLICY IF EXISTS "Employee photos readable by authenticated" ON storage.objects;
CREATE POLICY "Employee photos readable by authenticated"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'employee-photos');

DROP POLICY IF EXISTS "Employee photos writable by admin hr" ON storage.objects;
CREATE POLICY "Employee photos writable by admin hr"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'employee-photos' AND (public.is_admin() OR public.is_hr()));

DROP POLICY IF EXISTS "Employee photos updatable by admin hr" ON storage.objects;
CREATE POLICY "Employee photos updatable by admin hr"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'employee-photos' AND (public.is_admin() OR public.is_hr()));

-- Allow anon to read employee photos so kiosk (unauthenticated) can compare face
-- (photo urls are unguessable random names; low risk for kiosk workflow)
DROP POLICY IF EXISTS "Employee photos anon read" ON storage.objects;
CREATE POLICY "Employee photos anon read"
ON storage.objects FOR SELECT TO anon
USING (bucket_id = 'employee-photos');

-- Kiosk RPC to fetch face descriptor for verification (unauthenticated safe: returns only face data)
CREATE OR REPLACE FUNCTION public.kiosk_get_face_data(_employee_id UUID)
RETURNS JSON
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'face_detection_enabled', COALESCE(face_detection_enabled, false),
    'face_descriptor', face_descriptor,
    'profile_photo_url', profile_photo_url
  )
  FROM public.employees
  WHERE id = _employee_id;
$$;

-- Update kiosk_punch_v2 to accept face verification fields
CREATE OR REPLACE FUNCTION public.kiosk_punch_v2(
  _employee_id UUID,
  _mode TEXT,
  _latitude DOUBLE PRECISION DEFAULT NULL,
  _longitude DOUBLE PRECISION DEFAULT NULL,
  _photo_url TEXT DEFAULT NULL,
  _address TEXT DEFAULT NULL,
  _employee_code TEXT DEFAULT NULL,
  _employee_name TEXT DEFAULT NULL,
  _device_type TEXT DEFAULT NULL,
  _device_timestamp TIMESTAMPTZ DEFAULT NULL,
  _face_verified BOOLEAN DEFAULT NULL,
  _face_match_percentage REAL DEFAULT NULL,
  _face_detection_enabled BOOLEAN DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _today DATE;
  _now TIMESTAMPTZ;
  _status TEXT;
  _hour INT;
  _existing_id UUID;
  _time_in_val TIMESTAMPTZ;
  _total_hours NUMERIC;
BEGIN
  _today := (NOW() AT TIME ZONE 'Asia/Manila')::DATE;
  _now := NOW();
  _hour := EXTRACT(HOUR FROM _now AT TIME ZONE 'Asia/Manila');
  _status := CASE WHEN _hour < 8 THEN 'On Time' ELSE 'Late' END;

  IF _mode = 'in' THEN
    INSERT INTO public.attendance (
      employee_id, date, time_in,
      photo_in_url, latitude_in, longitude_in,
      location_label_in, status,
      employee_code, employee_name, device_type, device_timestamp,
      face_verified, face_match_percentage, face_detection_enabled
    )
    VALUES (
      _employee_id, _today, _now,
      _photo_url, _latitude, _longitude,
      _address, _status,
      _employee_code, _employee_name, _device_type, _device_timestamp,
      _face_verified, _face_match_percentage, _face_detection_enabled
    );
    RETURN json_build_object('ok', true, 'mode', 'in');
  ELSE
    SELECT id, time_in INTO _existing_id, _time_in_val
    FROM public.attendance
    WHERE employee_id = _employee_id AND date = _today
    LIMIT 1;

    IF _existing_id IS NULL THEN
      INSERT INTO public.attendance (
        employee_id, date, time_out,
        photo_out_url, latitude_out, longitude_out,
        location_label_out,
        employee_code, employee_name, device_type, device_timestamp,
        face_verified, face_match_percentage, face_detection_enabled
      )
      VALUES (
        _employee_id, _today, _now,
        _photo_url, _latitude, _longitude,
        _address,
        _employee_code, _employee_name, _device_type, _device_timestamp,
        _face_verified, _face_match_percentage, _face_detection_enabled
      );
    ELSE
      IF _time_in_val IS NOT NULL THEN
        _total_hours := EXTRACT(EPOCH FROM (_now - _time_in_val)) / 3600.0;
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
        face_match_percentage = COALESCE(_face_match_percentage, face_match_percentage)
      WHERE id = _existing_id;
    END IF;

    RETURN json_build_object('ok', true, 'mode', 'out');
  END IF;
END;
$$;
