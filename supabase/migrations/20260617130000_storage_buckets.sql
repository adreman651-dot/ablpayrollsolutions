-- Create Storage Buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('selfies', 'selfies', true, 10485760, ARRAY['image/jpeg','image/png']),
  ('voice-assets', 'voice-assets', true, 5242880, ARRAY['audio/mpeg'])
ON CONFLICT (id) DO NOTHING;

-- RLS storage policies
-- Anyone can read selfies and voice-assets (public bucket)
CREATE POLICY "Public read selfies" ON storage.objects FOR SELECT USING (bucket_id = 'selfies');
CREATE POLICY "Public read voice-assets" ON storage.objects FOR SELECT USING (bucket_id = 'voice-assets');

-- Only authenticated users can upload to selfies
CREATE POLICY "Auth upload selfies" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'selfies' AND auth.role() = 'authenticated');

-- Only admins can upload to voice-assets
CREATE POLICY "Admin upload voice-assets" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'voice-assets' AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
