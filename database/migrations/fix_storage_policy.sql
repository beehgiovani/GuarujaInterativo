-- Storage is a pre-installed schema in Supabase. No extension creation needed.

-- Create Bucket 'lotes_images' if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('lotes_images', 'lotes_images', true)
ON CONFLICT (id) DO NOTHING;

-- RLS is enabled by default on storage.objects, so we don't need to enable it.
-- Trying to enable it again causes permissions errors if we aren't the system owner.

-- 1. Policy: Allow Public SELECT (Viewing images)
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'lotes_images' );

-- 2. Policy: Allow Public INSERT (Uploading images)
DROP POLICY IF EXISTS "Allow Uploads" ON storage.objects;
CREATE POLICY "Allow Uploads"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'lotes_images' );

-- 3. Policy: Allow Public UPDATE (Replacing images)
DROP POLICY IF EXISTS "Allow Updates" ON storage.objects;
CREATE POLICY "Allow Updates"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'lotes_images' );

-- 4. Policy: Allow Public DELETE (Deleting images - optional/dangerous)
-- Uncomment if needed.
-- CREATE POLICY "Allow Deletes"
-- ON storage.objects FOR DELETE
-- USING ( bucket_id = 'lotes_images' );
