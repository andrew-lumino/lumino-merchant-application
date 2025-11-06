-- Add agent_name column to merchant_applications table
ALTER TABLE merchant_applications 
ADD COLUMN IF NOT EXISTS agent_name TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_merchant_applications_agent_name 
ON merchant_applications(agent_name);

-- Update existing records with agent_name extracted from agent_email
UPDATE merchant_applications
SET agent_name = UPPER(SPLIT_PART(agent_email, '@', 1))
WHERE agent_email IS NOT NULL 
  AND agent_name IS NULL;
