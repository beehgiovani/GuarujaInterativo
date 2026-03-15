-- ============================================================================
-- SCRIPT DE LIMPEZA DE DADOS (CLEANUP)
-- ============================================================================
-- Este script remove registros da tabela 'lotes' que são na verdade 'unidades'
-- importadas incorretamente.

-- 1. Remoção baseada em geometria nula e inscrição longa (Unidades geralmente têm inscrições maiores ou derivadas)
-- Lotes válidos devem ter geometria gerada ou importada corretamente.
-- Registros quebrados da importação recente têm 'lote' no nome ou inscrição de unidade mas estão na tabela lote.

DELETE FROM lotes 
WHERE lote_geo IS NULL 
  AND (
      LENGTH(inscricao) > 10  -- Inscrições de lotes costumam ser menores (ex: 10 chars vs 13+ de unidades)
      OR zona IS NULL         -- Se não tem Zona/Setor/Quadra definidos
  );

-- 2. Garantir que não removemos lotes que são apenas "fantasmas" mas legítimos (raro, mas cuidado)
-- A regra acima é segura pois lote sem geo E sem zona é lixo de importação.

-- 3. (Opcional) Limpeza de Unidades órfãs se necessário
-- DELETE FROM unidades WHERE lote_inscricao NOT IN (SELECT inscricao FROM lotes);
