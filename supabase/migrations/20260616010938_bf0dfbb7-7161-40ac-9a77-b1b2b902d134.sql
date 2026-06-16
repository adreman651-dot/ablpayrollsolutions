
-- Allow public kiosk (anon) to perform employee time-in/out
GRANT SELECT ON public.employees TO anon;
GRANT SELECT, INSERT, UPDATE ON public.attendance TO anon;
GRANT SELECT ON public.system_settings TO anon;

CREATE POLICY "Kiosk can read employees for time-in"
ON public.employees FOR SELECT TO anon USING (true);

CREATE POLICY "Kiosk can read attendance"
ON public.attendance FOR SELECT TO anon USING (true);

CREATE POLICY "Kiosk can insert attendance"
ON public.attendance FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Kiosk can update attendance"
ON public.attendance FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Kiosk can read system settings"
ON public.system_settings FOR SELECT TO anon USING (true);
