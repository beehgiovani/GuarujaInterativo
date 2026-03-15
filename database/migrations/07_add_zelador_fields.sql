-- Migration: 07_add_zelador_fields
-- Description: Adds zelador_nome and zelador_contato to lotes table

ALTER TABLE lotes
ADD COLUMN IF NOT EXISTS zelador_nome TEXT,
ADD COLUMN IF NOT EXISTS zelador_contato TEXT;
