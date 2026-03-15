-- Garante que todas as colunas necessárias para Edifícios e Galeria existam na tabela LOTES

ALTER TABLE lotes ADD COLUMN IF NOT EXISTS building_name TEXT;
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS gallery TEXT[] DEFAULT '{}';
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS floors VARCHAR(20);
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS build_year VARCHAR(10);
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS manager_info TEXT;
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS amenities TEXT;
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS obs TEXT;

-- Garante que as novas colunas são públicas para Leitura (caso RLS esteja ativo)
-- (O Supabase geralmente expõe colunas novas automaticamente se a Policy for "ALL", mas reforçando)

-- Atualiza Policies (se necessário, descomente e rode se tiver problemas de permissão)
-- DROP POLICY IF EXISTS "Public Updates" ON lotes;
-- CREATE POLICY "Public Updates" ON lotes FOR UPDATE USING (true);
