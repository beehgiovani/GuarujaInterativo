-- ============================================================
-- MIGRATION 17: FILES SYSTEM (Local PC Style)
-- ============================================================

-- 1. Create Table for File Metadata
CREATE TABLE IF NOT EXISTS public.unit_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_inscricao TEXT NOT NULL, -- Logical link to Lote/Unit
    name TEXT NOT NULL,
    path TEXT NOT NULL, -- Full path in bucket: unit_inscricao/folder/filename
    folder TEXT DEFAULT 'root', -- Virtual folder name
    type TEXT NOT NULL, -- Mime type: application/pdf, image/png
    size BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Index for faster listing
CREATE INDEX IF NOT EXISTS idx_unit_files_inscricao ON public.unit_files(unit_inscricao);
CREATE INDEX IF NOT EXISTS idx_unit_files_folder ON public.unit_files(folder);

-- 2. Storage Bucket Setup
-- Create Bucket 'unit_documents' if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('unit_documents', 'unit_documents', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage Policies (RLS)
-- Allow Public SELECT (Viewing)
DROP POLICY IF EXISTS "Public Access Docs" ON storage.objects;
CREATE POLICY "Public Access Docs"
ON storage.objects FOR SELECT
USING ( bucket_id = 'unit_documents' );

-- Allow Public INSERT (Uploading)
DROP POLICY IF EXISTS "Allow Uploads Docs" ON storage.objects;
CREATE POLICY "Allow Uploads Docs"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'unit_documents' );

-- Allow Public DELETE (Deleting)
DROP POLICY IF EXISTS "Allow Delete Docs" ON storage.objects;
CREATE POLICY "Allow Delete Docs"
ON storage.objects FOR DELETE
USING ( bucket_id = 'unit_documents' );

-- Allow Public UPDATE (Renaming/Moving - essentially replacing)
DROP POLICY IF EXISTS "Allow Update Docs" ON storage.objects;
CREATE POLICY "Allow Update Docs"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'unit_documents' );
