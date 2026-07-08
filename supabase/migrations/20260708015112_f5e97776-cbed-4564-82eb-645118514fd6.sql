-- Drop old kiosk_punch_v2 overloads so PostgREST can resolve a single function.
DROP FUNCTION IF EXISTS public.kiosk_punch_v2(uuid, text, double precision, double precision, text, text);
DROP FUNCTION IF EXISTS public.kiosk_punch_v2(uuid, text, double precision, double precision, text, text, text, text, text, timestamptz, boolean, real, boolean);

-- Recreate the canonical version (with _gps_accuracy) and grant execute to anon + authenticated so both the desktop and android kiosks can call it.
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
        face_verified, face_match_percentage, face_detection_enabled,
        gps_accuracy_out, latitude, longitude
      )
      VALUES (
        _employee_id, _today, _now,
        _photo_url, _latitude, _longitude,
        _address,
        _employee_code, _employee_name, _device_type, _device_timestamp,
        _face_verified, _face_match_percentage, _face_detection_enabled,
        _gps_accuracy, _latitude, _longitude
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
        face_match_percentage = COALESCE(_face_match_percentage, face_match_percentage),
        gps_accuracy_out = COALESCE(_gps_accuracy, gps_accuracy_out),
        latitude = COALESCE(_latitude, latitude),
        longitude = COALESCE(_longitude, longitude)
      WHERE id = _existing_id;
    END IF;

    RETURN json_build_object('ok', true, 'mode', 'out');
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.kiosk_punch_v2(uuid, text, double precision, double precision, text, text, text, text, text, timestamptz, boolean, real, boolean, double precision) TO anon, authenticated, service_role;