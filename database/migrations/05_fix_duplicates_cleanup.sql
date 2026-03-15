-- ============================================================================
-- SCRIPT DE LIMPEZA AVANÇADA (CLEANUP V2)
-- ============================================================================
-- Objetivo: Remover "Lotes Fantasmas" de 11 dígitos e resetar unidades mal formatadas.

-- 1. Remover Lotes inválidos (inscrição com 11+ dígitos ou terminados em 000)
-- Os lotes corretos possuem 8 dígitos (ex: 00001001).
-- Os lotes errados criados pelo JSON possuem 11 (ex: 00001001000).
DELETE FROM lotes 
WHERE LENGTH(inscricao) > 10;

-- 2. Limpar Unidades órfãs ou mal vinculadas
-- Se houver unidades apontando para lotes que acabamos de deletar (ou que não existem),
-- podemos removê-las para reimportar limpo, OU tentar corrigir o vínculo.
-- Como vamos rodar o script de upload novamente, é mais seguro limpar as unidades importadas recentemente
-- para evitar duplicidade ou dados parciais.

-- Opcional: Limpar todas as unidades (CUIDADO: Se já houver dados reais de CRM, não faça isso).
-- Se não há dados reas de CRM ainda, um TRUNCATE cleans slate.
-- TRUNCATE TABLE unidades; 
-- (Comentado por segurança, o usuário deve decidir se quer resetar tudo).

-- Alternativa segura: Remover unidades onde lote_inscricao tem mais de 8 dígitos
DELETE FROM unidades
WHERE LENGTH(lote_inscricao) > 10;

-- 3. Inserir/Garantir que os Lotes REAIS (8 dígitos) existam?
-- A tabela lotes já deve ter os lotes de 8 dígitos originais.
-- Vamos garantir que não deletamos nenhum lote válido. (A query 1 só deleta > 10 chars).

-- 4. Verificação pós-limpeza
-- SELECT count(*) FROM lotes WHERE LENGTH(inscricao) > 10; -- Deve ser 0
-- SELECT count(*) FROM unidades WHERE LENGTH(lote_inscricao) > 10; -- Deve ser 0
