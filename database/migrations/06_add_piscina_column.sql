-- Add 'piscina' column to 'lotes' table
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS piscina BOOLEAN DEFAULT FALSE;
