-- Migration: Add New Amenities and Condo Fee to Lotes
-- Date: 2026-01-28

ALTER TABLE lotes
ADD COLUMN IF NOT EXISTS bicicletario BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS acesso_pcd BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS salao_festas BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS area_verde BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS valor_condominio TEXT; -- Text to support ranges like "1300-1600"

-- Comment on columns
COMMENT ON COLUMN lotes.bicicletario IS 'Possui bicicletário';
COMMENT ON COLUMN lotes.acesso_pcd IS 'Possui acessibilidade/rampas';
COMMENT ON COLUMN lotes.salao_festas IS 'Possui salão de festas';
COMMENT ON COLUMN lotes.area_verde IS 'Possui área verde/jardim';
COMMENT ON COLUMN lotes.valor_condominio IS 'Valor ou faixa estimada do condomínio';
