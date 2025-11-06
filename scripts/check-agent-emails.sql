-- Check agent_email values for the applications mentioned
SELECT 
  id,
  dba_name,
  agent_email,
  created_at,
  status
FROM merchant_applications
WHERE 
  dba_name ILIKE '%Flawless Painting%' 
  OR dba_name ILIKE '%Go Alpha Labs%'
  OR dba_name ILIKE '%test - ra%'
  OR dba_name ILIKE '%Kitchen at New Boston%'
ORDER BY created_at DESC;

-- Also check all applications with NULL or empty agent_email
SELECT 
  id,
  dba_name,
  agent_email,
  created_at,
  status
FROM merchant_applications
WHERE 
  agent_email IS NULL 
  OR agent_email = ''
ORDER BY created_at DESC
LIMIT 20;
