-- POLICY: Permitir DELETAR Lotes (Público/Anon)
DROP POLICY IF EXISTS "Lotes - Exclusão Pública" ON lotes;
CREATE POLICY "Lotes - Exclusão Pública" ON lotes FOR DELETE TO anon, authenticated USING (true);

-- POLICY: Permitir DELETAR Unidades (Público/Anon)
DROP POLICY IF EXISTS "Unidades - Exclusão Pública" ON unidades;
CREATE POLICY "Unidades - Exclusão Pública" ON unidades FOR DELETE TO anon, authenticated USING (true);
