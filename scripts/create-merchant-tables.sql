-- Create the merchant_applications table if it doesn't exist
CREATE TABLE IF NOT EXISTS merchant_applications (
    id SERIAL PRIMARY KEY,
    merchant_name TEXT NOT NULL,
    merchant_email TEXT NOT NULL,
    application_date DATE NOT NULL
);

-- Add status, agent_email, and timestamp columns to the merchant_applications table.
-- Also, add a trigger to automatically update the updated_at timestamp.

ALTER TABLE merchant_applications
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'invited',
ADD COLUMN IF NOT EXISTS agent_email TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- If created_at doesn't exist, add it. If it does, ensure it has a default.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='merchant_applications' AND column_name='created_at') THEN
        ALTER TABLE merchant_applications ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Function to update the updated_at column
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at on row change
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_merchant_applications_modtime') THEN
        CREATE TRIGGER update_merchant_applications_modtime
        BEFORE UPDATE ON merchant_applications
        FOR EACH ROW
        EXECUTE FUNCTION update_modified_column();
    END IF;
END $$;
