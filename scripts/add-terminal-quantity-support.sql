-- Add support for terminal quantities in the merchant_applications table
-- The terminals column already exists as JSONB, so we just need to ensure
-- it can handle the new quantity field structure

-- Update any existing terminal records to include quantity: 1 as default
UPDATE merchant_applications 
SET terminals = (
  SELECT jsonb_agg(
    CASE 
      WHEN jsonb_typeof(terminal) = 'object' AND terminal ? 'name' THEN
        terminal || jsonb_build_object('quantity', 1)
      ELSE terminal
    END
  )
  FROM jsonb_array_elements(terminals) AS terminal
)
WHERE terminals IS NOT NULL 
  AND jsonb_typeof(terminals) = 'array'
  AND terminals != 'null'::jsonb;
