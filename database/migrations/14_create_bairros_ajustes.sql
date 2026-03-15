-- ============================================================================
-- MIGRATION: 14_create_bairros_ajustes.sql
-- PURPOSE: Store manual overrides for neighborhood centroids (position/visibility)
-- DATE: 2026-01-27
-- ============================================================================

CREATE TABLE IF NOT EXISTS bairros_ajustes (
    nome_bairro TEXT PRIMARY KEY, -- Matches 'bairro_unidade' from view
    lat FLOAT,                    -- Custom Latitude
    lng FLOAT,                    -- Custom Longitude
    visible BOOLEAN DEFAULT TRUE, -- If false, label is hidden
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS (Optional, but good practice)
ALTER TABLE bairros_ajustes ENABLE ROW LEVEL SECURITY;

-- Allow all for now (internal tool)
CREATE POLICY "Enable all access" ON bairros_ajustes
    FOR ALL USING (true) WITH CHECK (true);

-- Grant access
GRANT ALL ON bairros_ajustes TO anon, authenticated, service_role;

COMMENT ON TABLE bairros_ajustes IS 'Stores manual position/visibility overrides for neighborhood labels.';
