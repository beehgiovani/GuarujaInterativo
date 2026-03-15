-- ==========================================
-- MIGRATION: Create certidoes_juridicas bucket
-- ==========================================
-- Bucket para armazenar PDFs de certidões jurídicas
-- Organizados por CPF/CNPJ do proprietário

-- 1. Create Bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('certidoes_juridicas', 'certidoes_juridicas', true)
ON CONFLICT DO NOTHING;

-- 2. Allow Public Read
CREATE POLICY "Certidoes Public Read" ON storage.objects
FOR SELECT
USING ( bucket_id = 'certidoes_juridicas' );

-- 3. Allow Public Upload
CREATE POLICY "Certidoes Public Upload" ON storage.objects
FOR INSERT
WITH CHECK ( bucket_id = 'certidoes_juridicas' );

-- 4. Allow Public Delete (for deduplication of old certidões)
CREATE POLICY "Certidoes Public Delete" ON storage.objects
FOR DELETE
USING ( bucket_id = 'certidoes_juridicas' );

-- 5. Allow Public Update
CREATE POLICY "Certidoes Public Update" ON storage.objects
FOR UPDATE
USING ( bucket_id = 'certidoes_juridicas' );
