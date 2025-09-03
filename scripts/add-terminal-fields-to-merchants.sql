-- Add terminal selection fields to the merchant_applications table
ALTER TABLE merchant_applications
ADD COLUMN terminal_name TEXT,
ADD COLUMN terminal_price NUMERIC(10, 2);
