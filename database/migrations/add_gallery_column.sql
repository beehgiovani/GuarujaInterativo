-- Add 'gallery' column to 'lotes' table
-- It's an array of text (URLs)
ALTER TABLE lotes
ADD COLUMN IF NOT EXISTS gallery TEXT[] DEFAULT '{}';

-- Migration: Initialize gallery with existing image_url if present
-- (Optional, but good for consistency)
UPDATE lotes
SET gallery = ARRAY[image_url]
WHERE image_url IS NOT NULL AND image_url <> '' AND (gallery IS NULL OR gallery = '{}');
