-- ============================================================
-- Insert Voice Assistant system settings
-- ============================================================

INSERT INTO public.system_settings (key, value, description)
VALUES 
  ('voice_enabled', 'true', 'Enable Voice Assistant'),
  ('voice_welcome_enabled', 'true', 'Enable Welcome Message'),
  ('voice_time_in_enabled', 'true', 'Enable Time In Confirmation'),
  ('voice_time_out_enabled', 'true', 'Enable Time Out Confirmation'),
  ('voice_error_enabled', 'true', 'Enable Error Announcements'),
  ('voice_rate', '1.0', 'Voice speed/rate (0.5 to 2.0)'),
  ('voice_pitch', '1.0', 'Voice pitch (0.5 to 2.0)'),
  ('voice_volume', '100', 'Voice volume (0 to 100)')
ON CONFLICT (key) DO NOTHING;
