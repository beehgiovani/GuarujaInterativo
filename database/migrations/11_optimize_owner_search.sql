-- Índice para busca textual ignorando acentos (usando dicionário português)
CREATE INDEX IF NOT EXISTS idx_proprietarios_nome_fts 
ON proprietarios 
USING GIN (to_tsvector('portuguese', nome_completo));

-- Opcional: Índice trigram para busca parcial ILIKE (se pg_trgm estiver disponível, ajuda muito)
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CREATE INDEX IF NOT EXISTS idx_proprietarios_nome_trgm ON proprietarios USING GIN (nome_completo gin_trgm_ops);
