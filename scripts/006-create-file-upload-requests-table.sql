-- Create file_upload_requests table for tracking file upload requests sent to clients
CREATE TABLE IF NOT EXISTS file_upload_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES merchant_applications(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  requested_files TEXT[] NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create index for faster lookups by application_id
CREATE INDEX idx_file_upload_requests_application_id ON file_upload_requests(application_id);

-- Create index for active requests
CREATE INDEX idx_file_upload_requests_active ON file_upload_requests(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE file_upload_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read (needed for public upload page)
CREATE POLICY "Anyone can read file upload requests" ON file_upload_requests
  FOR SELECT USING (true);

-- Policy: Authenticated users can insert
CREATE POLICY "Authenticated users can create file upload requests" ON file_upload_requests
  FOR INSERT WITH CHECK (true);

-- Policy: Anyone can update (needed for public page to mark complete)
CREATE POLICY "Anyone can update file upload requests" ON file_upload_requests
  FOR UPDATE USING (true);
