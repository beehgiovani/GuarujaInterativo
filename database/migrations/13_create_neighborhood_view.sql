-- ============================================================================
-- MIGRATION: 13_create_neighborhood_view.sql
-- PURPOSE: Create a materialized view to aggregate neighborhoods based on units
-- DATE: 2026-01-27
-- ============================================================================

-- Drop if exists to ensure clean state
DROP MATERIALIZED VIEW IF EXISTS vw_bairros_centroids;

-- Create Materialized View
-- Uses 'unidades' for the trusted neighborhood name and 'lotes' for geometry
CREATE MATERIALIZED VIEW vw_bairros_centroids AS
SELECT 
    u.bairro_unidade AS nome,
    COUNT(DISTINCT l.inscricao) AS total_lotes,
    -- Calculate Average UTM Coordinates (Centroid)
    AVG((l.minx + l.maxx) / 2) AS utm_x,
    AVG((l.miny + l.maxy) / 2) AS utm_y
FROM unidades u
JOIN lotes l ON u.lote_inscricao = l.inscricao
WHERE u.bairro_unidade IS NOT NULL 
  AND trim(u.bairro_unidade) != ''
  AND l.minx IS NOT NULL 
  AND l.minx > 0 -- Basic sanity check for UTM
GROUP BY u.bairro_unidade
HAVING COUNT(DISTINCT l.inscricao) >= 5; -- Filter out typos or very small clusters

-- Create Index for performance
CREATE INDEX idx_vw_bairros_nome ON vw_bairros_centroids(nome);

-- Grant access (if using anonymous/authenticated roles)
GRANT SELECT ON vw_bairros_centroids TO anon, authenticated, service_role;

-- Comment
COMMENT ON MATERIALIZED VIEW vw_bairros_centroids IS 'Aggregated neighborhood centroids based on linked units (Source of Truth for Bairro Name)';
