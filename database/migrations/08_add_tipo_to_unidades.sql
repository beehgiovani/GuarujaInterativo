-- Migration: 08_add_tipo_to_unidades.sql
-- Description: Adds 'tipo' column to classify units (Apartamento, Casa, Garagem, Loja, etc.)

ALTER TABLE unidades 
ADD COLUMN IF NOT EXISTS tipo VARCHAR(50) DEFAULT 'Apartamento';

-- Update RLS if needed (already permissive)
