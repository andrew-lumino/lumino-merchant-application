-- create-merchant-invite.sql
-- Create merchant_applications table if it doesn't exist
CREATE TABLE IF NOT EXISTS merchant_applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Agent/Account Manager Info
  agent_email TEXT,
  
  -- Status
  status TEXT DEFAULT 'invited',
  
  -- Merchant Information
  dba_name TEXT,
  dba_email TEXT,
  ownership_type TEXT,
  legal_name TEXT,
  federal_tax_id TEXT,
  dba_phone TEXT,
  website_url TEXT,
  paperless_statements BOOLEAN DEFAULT FALSE,
  
  -- DBA Address
  dba_address_line1 TEXT,
  dba_address_line2 TEXT,
  dba_city TEXT,
  dba_state TEXT,
  dba_zip TEXT,
  dba_zip_extended TEXT,
  
  -- Legal Address
  legal_differs BOOLEAN DEFAULT FALSE,
  legal_address_line1 TEXT,
  legal_address_line2 TEXT,
  legal_city TEXT,
  legal_state TEXT,
  legal_zip TEXT,
  legal_zip_extended TEXT,
  
  -- Merchant Profile
  monthly_volume DECIMAL,
  average_ticket DECIMAL,
  highest_ticket DECIMAL,
  pct_card_swiped DECIMAL,
  pct_manual_imprint DECIMAL,
  pct_manual_no_imprint DECIMAL,
  business_type TEXT,
  refund_policy TEXT,
  previous_processor TEXT,
  reason_for_termination TEXT,
  seasonal_business BOOLEAN DEFAULT FALSE,
  seasonal_months TEXT[],
  uses_fulfillment_house BOOLEAN DEFAULT FALSE,
  uses_third_parties BOOLEAN DEFAULT FALSE,
  third_parties_list TEXT,
  
  -- Principals (stored as JSON)
  principals JSONB,
  
  -- Managing Member
  managing_member_same_as BOOLEAN DEFAULT FALSE,
  managing_member_reference TEXT,
  managing_member_first_name TEXT,
  managing_member_last_name TEXT,
  managing_member_email TEXT,
  managing_member_phone TEXT,
  managing_member_position TEXT,
  
  -- Authorized Contact
  authorized_contact_same_as BOOLEAN DEFAULT TRUE,
  authorized_contact_name TEXT,
  authorized_contact_email TEXT,
  authorized_contact_phone TEXT,
  
  -- Banking
  bank_name TEXT,
  routing_number TEXT,
  account_number TEXT,
  
  -- Batching
  batch_time TEXT DEFAULT '10:45 PM EST',

  -- Notes
  notes JSONB,
  
  -- Upload Status
  upload_status TEXT,
  upload_errors TEXT,
  
  -- Signature
  agreement_scrolled BOOLEAN DEFAULT FALSE,
  signature_full_name TEXT,
  signature_date DATE,
  certification_ack BOOLEAN DEFAULT FALSE,
  
  -- File uploads (stored as JSON)
  uploads JSONB
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_merchant_applications_agent_email ON merchant_applications(agent_email);
CREATE INDEX IF NOT EXISTS idx_merchant_applications_status ON merchant_applications(status);
CREATE INDEX IF NOT EXISTS idx_merchant_applications_created_at ON merchant_applications(created_at);
CREATE INDEX IF NOT EXISTS idx_merchant_applications_dba_email ON merchant_applications(dba_email);
