DROP POLICY IF EXISTS "Auth upload selfies" ON storage.objects;
DROP POLICY IF EXISTS "Public upload selfies" ON storage.objects;
CREATE POLICY "Public upload selfies" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'selfies');