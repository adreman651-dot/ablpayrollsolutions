-- ============================================================
-- Insert enable_voice_announcement into system_settings
-- ============================================================

INSERT INTO public.system_settings (key, value, description)
VALUES (
  'enable_voice_announcement',
  'true',
  'Enable Text-to-Speech automatic voice announcements for Attendance Kiosk'
)
ON CONFLICT (key) DO NOTHING;
