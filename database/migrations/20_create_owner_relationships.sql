-- Migration: Create proprietario_relacionamentos table
-- Date: 2026-01-29

CREATE TABLE IF NOT EXISTS proprietario_relacionamentos (
    id BIGSERIAL PRIMARY KEY,
    proprietario_origem_id BIGINT REFERENCES proprietarios(id) ON DELETE CASCADE,
    proprietario_destino_id BIGINT REFERENCES proprietarios(id) ON DELETE CASCADE,
    tipo_vinculo VARCHAR(100), -- 'Sócio', 'Sócio-Administrador', 'Mãe', 'Filho', etc.
    metadata JSONB DEFAULT '{}'::jsonb, -- Para guardar info extra (ex: % participação, data entrada)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Evitar duplicatas do mesmo vínculo
    UNIQUE(proprietario_origem_id, proprietario_destino_id, tipo_vinculo)
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_rel_origem ON proprietario_relacionamentos(proprietario_origem_id);
CREATE INDEX IF NOT EXISTS idx_rel_destino ON proprietario_relacionamentos(proprietario_destino_id);

-- RLS
ALTER TABLE proprietario_relacionamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read Relacionamentos" ON proprietario_relacionamentos FOR SELECT USING (true);
CREATE POLICY "Admin All Relacionamentos" ON proprietario_relacionamentos FOR ALL USING (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE proprietario_relacionamentos;
