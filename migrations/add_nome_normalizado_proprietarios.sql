-- ================================================
-- MIGRATION: add_nome_normalizado_to_proprietarios
-- Objetivo: Índice de busca por nome sem acento para
-- matching do Grafo Relacional Datastone
-- Criado: 2026-03-26
-- ================================================

-- 1. Adiciona a coluna gerada automaticamente
ALTER TABLE proprietarios
ADD COLUMN IF NOT EXISTS nome_normalizado TEXT
GENERATED ALWAYS AS (
  lower(
    translate(
      nome_completo,
      'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
      'aaaaaeeeeiiiioooooouuuucaaaaaeeeeiiiioooooouuuuc'
    )
  )
) STORED;

-- 2. Cria índice para performance de busca relacional
CREATE INDEX IF NOT EXISTS idx_proprietarios_nome_norm
ON proprietarios (nome_normalizado);

-- 3. Cria índice composto para upsert de relacionamentos sem conflito
CREATE UNIQUE INDEX IF NOT EXISTS idx_prop_rel_unique
ON proprietario_relacionamentos (
  proprietario_origem_id,
  proprietario_destino_id,
  tipo_vinculo
)
WHERE tipo_vinculo IS NOT NULL;

-- ================================================
-- VERIFICAÇÃO
-- ================================================
-- SELECT nome_completo, nome_normalizado FROM proprietarios LIMIT 10;
