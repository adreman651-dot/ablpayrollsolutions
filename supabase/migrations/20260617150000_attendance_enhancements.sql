-- ============================================================
-- Attendance Table Enhancements
-- Adds columns for device tracking, timestamps, and denormalized employee details.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='attendance' AND column_name='employee_code') THEN
    ALTER TABLE public.attendance ADD COLUMN employee_code TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='attendance' AND column_name='employee_name') THEN
    ALTER TABLE public.attendance ADD COLUMN employee_name TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='attendance' AND column_name='device_type') THEN
    ALTER TABLE public.attendance ADD COLUMN device_type TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='attendance' AND column_name='device_timestamp_in') THEN
    ALTER TABLE public.attendance ADD COLUMN device_timestamp_in TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='attendance' AND column_name='device_timestamp_out') THEN
    ALTER TABLE public.attendance ADD COLUMN device_timestamp_out TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='attendance' AND column_name='server_timestamp_in') THEN
    ALTER TABLE public.attendance ADD COLUMN server_timestamp_in TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='attendance' AND column_name='server_timestamp_out') THEN
    ALTER TABLE public.attendance ADD COLUMN server_timestamp_out TIMESTAMPTZ;
  END IF;
END
$$;

-- ============================================================
-- Update Kiosk Punch RPC
-- ============================================================

CREATE OR REPLACE FUNCTION public.kiosk_punch_v2(
  _employee_id UUID,
  _mode TEXT,          -- 'in' or 'out'
  _latitude DOUBLE PRECISION DEFAULT NULL,
  _longitude DOUBLE PRECISION DEFAULT NULL,
  _photo_url TEXT DEFAULT NULL,
  _address TEXT DEFAULT NULL,
  _employee_code TEXT DEFAULT NULL,
  _employee_name TEXT DEFAULT NULL,
  _device_type TEXT DEFAULT NULL,
  _device_timestamp TIMESTAMPTZ DEFAULT NULL
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
    -- Insert new attendance row
    INSERT INTO public.attendance (
      employee_id, date, time_in,
      photo_in_url, latitude_in, longitude_in,
      location_label_in, status,
      employee_code, employee_name, device_type,
      device_timestamp_in, server_timestamp_in
    )
    VALUES (
      _employee_id, _today, COALESCE(_device_timestamp, _now),
      _photo_url, _latitude, _longitude,
      _address, _status,
      _employee_code, _employee_name, _device_type,
      _device_timestamp, _now
    );
    RETURN json_build_object('ok', true, 'mode', 'in');
  ELSE
    -- Find today's open record
    SELECT id, time_in INTO _existing_id, _time_in_val
    FROM public.attendance
    WHERE employee_id = _employee_id AND date = _today
    LIMIT 1;

    IF _existing_id IS NULL THEN
      -- No time-in record; create one with just time_out
      INSERT INTO public.attendance (
        employee_id, date, time_out,
        photo_out_url, latitude_out, longitude_out,
        location_label_out,
        employee_code, employee_name, device_type,
        device_timestamp_out, server_timestamp_out
      )
      VALUES (
        _employee_id, _today, COALESCE(_device_timestamp, _now),
        _photo_url, _latitude, _longitude,
        _address,
        _employee_code, _employee_name, _device_type,
        _device_timestamp, _now
      );
    ELSE
      IF _time_in_val IS NOT NULL THEN
        _total_hours := EXTRACT(EPOCH FROM (COALESCE(_device_timestamp, _now) - _time_in_val)) / 3600.0;
      ELSE
        _total_hours := 0;
      END IF;

      UPDATE public.attendance SET
        time_out = COALESCE(_device_timestamp, _now),
        photo_out_url = _photo_url,
        latitude_out = _latitude,
        longitude_out = _longitude,
        location_label_out = _address,
        device_timestamp_out = _device_timestamp,
        server_timestamp_out = _now,
        total_hours = ROUND(_total_hours::NUMERIC, 2),
        -- Also update these if not set
        employee_code = COALESCE(employee_code, _employee_code),
        employee_name = COALESCE(employee_name, _employee_name),
        device_type = COALESCE(device_type, _device_type)
      WHERE id = _existing_id;
    END IF;

    RETURN json_build_object('ok', true, 'mode', 'out');
  END IF;
END;
$$;
