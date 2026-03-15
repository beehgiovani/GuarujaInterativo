-- Tabela para armazenar desenhos do mapa (Linhas de Mar, POIs, Zonas Especiais)
CREATE TABLE IF NOT EXISTS referencias_geograficas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    nome TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('MAR', 'POI', 'OUTRO')), -- Expandable types
    subtipo TEXT, -- Ex: 'PADARIA', 'ESCOLA' para POIs
    geometria JSONB NOT NULL, -- GeoJSON da geometria desenhada
    cor TEXT DEFAULT '#3388ff'
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE referencias_geograficas ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso (Aberto para leitura, restrito admin para escrita - simplificado para anon por enquanto)
CREATE POLICY "Leitura pública de referencias" 
ON referencias_geograficas FOR SELECT 
USING (true);

CREATE POLICY "Escrita de referencias" 
ON referencias_geograficas FOR ALL 
USING (true)
WITH CHECK (true);

-- Index para busca rápida (futuro PostGIS)
-- CREATE INDEX idx_referencias_geo ON referencias_geograficas USING GIN (geometria);
