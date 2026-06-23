DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='attendance' AND column_name='gps_accuracy') THEN
    ALTER TABLE public.attendance ADD COLUMN gps_accuracy DOUBLE PRECISION;
  END IF;
END
$$;
