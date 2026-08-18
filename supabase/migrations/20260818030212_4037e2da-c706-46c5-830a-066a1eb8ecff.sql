DROP POLICY IF EXISTS "Auth upload voice-assets" ON storage.objects;
DROP POLICY IF EXISTS "Auth manage voice-assets" ON storage.objects;

CREATE POLICY "Voice assets writable by admin hr"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'voice-assets' AND (public.is_admin() OR public.is_hr()));

CREATE POLICY "Voice assets updatable by admin hr"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'voice-assets' AND (public.is_admin() OR public.is_hr()))
WITH CHECK (bucket_id = 'voice-assets' AND (public.is_admin() OR public.is_hr()));

CREATE POLICY "Voice assets deletable by admin hr"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'voice-assets' AND (public.is_admin() OR public.is_hr()));