
-- 4. Alterações na tabela LOTES para permitir edição e imagens
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS building_name TEXT;
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS floors VARCHAR(20); -- Text to allow '10+2' or similar
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS build_year VARCHAR(10);
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS manager_info TEXT;
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS amenities TEXT;
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS obs TEXT;

-- 5. Configurar Storage (Tentativa via SQL, pode falhar se não tiver permissão de admin)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('lotes_images', 'lotes_images', true) ON CONFLICT DO NOTHING;

-- Policy (requires manual setup usually, but trying for convenience)
-- CREATE POLICY "Public Upload" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'lotes_images' );
-- CREATE POLICY "Public Select" ON storage.objects FOR SELECT USING ( bucket_id = 'lotes_images' );
