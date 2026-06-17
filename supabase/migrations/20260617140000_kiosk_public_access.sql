-- ============================================================
-- Kiosk: Public Employee Lookup (bypasses RLS via SECURITY DEFINER)
-- ============================================================

-- Function: lookup employee by typed code (supports partial like "01" → "ABL-00001")
CREATE OR REPLACE FUNCTION public.kiosk_lookup_by_code(_typed TEXT)
RETURNS TABLE (
  id UUID,
  first_name TEXT,
  last_name TEXT,
  employee_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _padded TEXT;
BEGIN
  -- Pad the typed number: "01" → "ABL-00001"
  IF _typed ~ '^\d+$' THEN
    _padded := 'ABL-' || LPAD(_typed, 5, '0');
  ELSE
    _padded := _typed;
  END IF;

  RETURN QUERY
    SELECT e.id, e.first_name, e.last_name, e.employee_code
    FROM public.employees e
    WHERE
      e.employee_code = _padded
      OR e.employee_code ILIKE ('%' || _typed || '%')
    ORDER BY e.employee_code
    LIMIT 5;
END;
$$;

-- Grant execute to anon (kiosk is unauthenticated)
GRANT EXECUTE ON FUNCTION public.kiosk_lookup_by_code(TEXT) TO anon;

-- ============================================================
-- Kiosk: Public Attendance Punch (bypasses RLS via SECURITY DEFINER)
-- ============================================================

CREATE OR REPLACE FUNCTION public.kiosk_punch_v2(
  _employee_id UUID,
  _mode TEXT,          -- 'in' or 'out'
  _latitude DOUBLE PRECISION DEFAULT NULL,
  _longitude DOUBLE PRECISION DEFAULT NULL,
  _photo_url TEXT DEFAULT NULL,
  _address TEXT DEFAULT NULL
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
      location_label_in, status
    )
    VALUES (
      _employee_id, _today, _now,
      _photo_url, _latitude, _longitude,
      _address, _status
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
        location_label_out
      )
      VALUES (
        _employee_id, _today, _now,
        _photo_url, _latitude, _longitude,
        _address
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
        total_hours = ROUND(_total_hours::NUMERIC, 2)
      WHERE id = _existing_id;
    END IF;

    RETURN json_build_object('ok', true, 'mode', 'out');
  END IF;
END;
$$;

-- Grant execute to anon
GRANT EXECUTE ON FUNCTION public.kiosk_punch_v2(UUID, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT) TO anon;

-- ============================================================
-- Kiosk: Check today attendance (is employee timed-in already?)
-- ============================================================

CREATE OR REPLACE FUNCTION public.kiosk_get_today_attendance(_employee_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _today DATE;
  _rec RECORD;
BEGIN
  _today := (NOW() AT TIME ZONE 'Asia/Manila')::DATE;

  SELECT time_in, time_out INTO _rec
  FROM public.attendance
  WHERE employee_id = _employee_id AND date = _today
  LIMIT 1;

  RETURN json_build_object(
    'has_record', _rec IS NOT NULL,
    'time_in', _rec.time_in,
    'time_out', _rec.time_out
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.kiosk_get_today_attendance(UUID) TO anon;

-- ============================================================
-- Storage: Fix voice-assets and selfies bucket RLS
-- Ensure buckets exist (idempotent)
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('selfies', 'selfies', true, 10485760, ARRAY['image/jpeg','image/png']),
  ('voice-assets', 'voice-assets', true, 5242880, ARRAY['audio/mpeg'])
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop old restrictive policies if they exist
DROP POLICY IF EXISTS "Public read selfies" ON storage.objects;
DROP POLICY IF EXISTS "Public read voice-assets" ON storage.objects;
DROP POLICY IF EXISTS "Auth upload selfies" ON storage.objects;
DROP POLICY IF EXISTS "Admin upload voice-assets" ON storage.objects;

-- Allow anyone to READ from selfies and voice-assets (public buckets)
CREATE POLICY "Public read selfies"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'selfies');

CREATE POLICY "Public read voice-assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'voice-assets');

-- Allow any authenticated user to upload selfies (kiosk will use auth session)
CREATE POLICY "Auth upload selfies"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'selfies' AND auth.role() = 'authenticated');

-- Allow any authenticated user to upload voice-assets (admin uses admin UI)
CREATE POLICY "Auth upload voice-assets"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'voice-assets' AND auth.role() = 'authenticated');

-- Allow authenticated to update/delete their own uploads
CREATE POLICY "Auth manage voice-assets"
  ON storage.objects FOR ALL
  USING (bucket_id = 'voice-assets' AND auth.role() = 'authenticated');

CREATE POLICY "Auth manage selfies"
  ON storage.objects FOR ALL
  USING (bucket_id = 'selfies' AND auth.role() = 'authenticated');

-- ============================================================
-- Make sure attendance table has the new columns
-- (safe: adds only if not exists)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='attendance' AND column_name='photo_in_url') THEN
    ALTER TABLE public.attendance ADD COLUMN photo_in_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='attendance' AND column_name='photo_out_url') THEN
    ALTER TABLE public.attendance ADD COLUMN photo_out_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='attendance' AND column_name='latitude_in') THEN
    ALTER TABLE public.attendance ADD COLUMN latitude_in DOUBLE PRECISION;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='attendance' AND column_name='longitude_in') THEN
    ALTER TABLE public.attendance ADD COLUMN longitude_in DOUBLE PRECISION;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='attendance' AND column_name='latitude_out') THEN
    ALTER TABLE public.attendance ADD COLUMN latitude_out DOUBLE PRECISION;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='attendance' AND column_name='longitude_out') THEN
    ALTER TABLE public.attendance ADD COLUMN longitude_out DOUBLE PRECISION;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='attendance' AND column_name='location_label_in') THEN
    ALTER TABLE public.attendance ADD COLUMN location_label_in TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='attendance' AND column_name='location_label_out') THEN
    ALTER TABLE public.attendance ADD COLUMN location_label_out TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='attendance' AND column_name='total_hours') THEN
    ALTER TABLE public.attendance ADD COLUMN total_hours NUMERIC(6,2);
  END IF;
END
$$;

-- Allow anon to INSERT into attendance (for kiosk punch via RPC, already SECURITY DEFINER but needs table grant too)
GRANT INSERT, UPDATE, SELECT ON public.attendance TO anon;
GRANT SELECT ON public.employees TO anon;
