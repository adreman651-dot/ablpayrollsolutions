
-- employee-photos: remove anon SELECT
DROP POLICY IF EXISTS "Employee photos anon read" ON storage.objects;

-- selfies: remove public read + public upload; keep authenticated ALL policy
DROP POLICY IF EXISTS "Public read selfies" ON storage.objects;
DROP POLICY IF EXISTS "Public upload selfies" ON storage.objects;

-- voice-assets: remove public listing/read policy (bucket remains public so
-- getPublicUrl still serves files via /storage/v1/object/public/...).
DROP POLICY IF EXISTS "Public read voice-assets" ON storage.objects;
