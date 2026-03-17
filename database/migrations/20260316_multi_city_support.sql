-- =============================================
-- Migration: Multi-City Support
-- Date: 2026-03-16
-- Description: Adds 'municipio' column to lots and units, and creates municipios table.
-- =============================================

-- 1. Create municipios table
CREATE TABLE IF NOT EXISTS municipios (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) UNIQUE NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    lat_centro FLOAT NOT NULL,
    lng_centro FLOAT NOT NULL,
    zoom_padrao INTEGER DEFAULT 13,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Insert default cities
INSERT INTO municipios (nome, slug, lat_centro, lng_centro, zoom_padrao)
VALUES 
    ('Guarujá', 'guaruja', -23.9934, -46.2567, 13),
    ('Santos', 'santos', -23.9608, -46.3339, 13)
ON CONFLICT (nome) DO NOTHING;

-- 3. Add municipio column to lotes
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lotes' AND column_name='municipio') THEN
        ALTER TABLE lotes ADD COLUMN municipio VARCHAR(100) DEFAULT 'Guarujá';
    END IF;
END $$;

-- 4. Add municipio column to unidades
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='unidades' AND column_name='municipio') THEN
        ALTER TABLE unidades ADD COLUMN municipio VARCHAR(100) DEFAULT 'Guarujá';
    END IF;
END $$;

-- 5. Index for faster filtering
CREATE INDEX IF NOT EXISTS idx_lotes_municipio ON lotes(municipio);
CREATE INDEX IF NOT EXISTS idx_unidades_municipio ON unidades(municipio);

-- 6. Update existing schemas references if needed (Already handled by defaults)
