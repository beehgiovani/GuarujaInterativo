
-- 🛠️ MIGRATION: Alter Anuncios to use Inscricao (TEXT) instead of UUID
-- This aligns with the 'lotes' table which uses inscricao as PK.

-- 1. Alter column type (UUID -> VARCHAR)
-- Note: existing data might be partial/broken, this cast simply converts to string
ALTER TABLE anuncios
  ALTER COLUMN lote_id TYPE VARCHAR(20) USING lote_id::text;

-- 2. Add Foreign Key to lotes(inscricao)
-- Need to ensure data integrity first or allow NO DATA initially?
-- We will try to add it. If it fails, data cleaning is needed.
-- First, let's try to update NULL values with derived logic
UPDATE anuncios
SET lote_id = substring(inscricao from 1 for 8)
WHERE lote_id IS NULL 
  AND length(inscricao) = 11;

-- 3. Add FK Constraint
ALTER TABLE anuncios
  ADD CONSTRAINT fk_anuncios_lotes
  FOREIGN KEY (lote_id)
  REFERENCES lotes (inscricao);

-- 4. Fix any lingering bad data (optional, only if constraint fails)
-- If constraint fails, run: DELETE FROM anuncios WHERE lote_id NOT IN (SELECT inscricao FROM lotes);
