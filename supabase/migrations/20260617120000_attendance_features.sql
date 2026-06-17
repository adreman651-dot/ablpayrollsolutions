-- Add new columns to attendance table if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance' AND column_name = 'exact_location') THEN
        ALTER TABLE attendance ADD COLUMN exact_location TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance' AND column_name = 'device_information') THEN
        ALTER TABLE attendance ADD COLUMN device_information TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance' AND column_name = 'attendance_type') THEN
        ALTER TABLE attendance ADD COLUMN attendance_type TEXT;
    END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_attendance_employee_id ON attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_type ON attendance(attendance_type);

-- Note: The kiosk_punch function handles inserting the selfie and address (which we can map to exact_location).
-- We'll modify the kiosk_punch function to ensure exact_location is updated and device_information is passed.
-- But since we cannot fully drop and recreate kiosk_punch without knowing its exact existing signature and logic (like leave/late calculations),
-- we will just rely on the frontend updating these new columns via an update call immediately after kiosk_punch, OR we can just pass _address to exact_location if we redefine it.
-- Actually, the frontend can just do an update on the attendance record returned by kiosk_punch to set exact_location, device_information, and attendance_type if the RPC isn't easily modifiable.
