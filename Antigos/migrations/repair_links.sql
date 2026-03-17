
-- 🛠️ REPAIR SCRIPT: Link Anuncios to Lotes
-- Run this in Supabase SQL Editor to fix the "invisible" leads.

UPDATE anuncios
SET lote_id = lotes.id
FROM lotes
WHERE anuncios.lote_id IS NULL
AND (
    -- 1. Match exact inscription (e.g. if you edited it to 00011001)
    anuncios.inscricao = lotes.inscricao
    OR
    -- 2. Match derived from unit (e.g. 00011001055 -> 00011001)
    (length(anuncios.inscricao) = 11 AND substring(anuncios.inscricao from 1 for 8) = lotes.inscricao)
);

-- Check results
SELECT id, titulo, inscricao, lote_id FROM anuncios;
