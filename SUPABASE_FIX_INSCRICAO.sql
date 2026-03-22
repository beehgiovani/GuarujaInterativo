/*
================================================================================
SCRIPT DE CORREÇÃO DE DADOS: INSCRIÇÃO 00077010000 -> 00077010
================================================================================
Este script migra com segurança o lote e suas dependências (unidades e desbloqueios)
da inscrição incorreta de 11 dígitos para a correta de 8 dígitos.
*/

BEGIN;

-- 1. CRIAR O NOVO LOTE (COM ID CORRETO)
-- Clonamos todas as informações geográficas e detalhes do prédio
INSERT INTO public.lotes (
    inscricao, zona, bairro, minx, miny, maxx, maxy, 
    building_name, image_url, gallery, created_at
)
SELECT 
    '00077010', zona, bairro, minx, miny, maxx, maxy, 
    building_name, image_url, gallery, created_at
FROM public.lotes 
WHERE inscricao = '00077010000'
ON CONFLICT (inscricao) DO NOTHING;

-- 2. MIGRAR AS UNIDADES
-- Atualizamos o vínculo das unidades para o novo lote
UPDATE public.unidades 
SET lote_inscricao = '00077010' 
WHERE lote_inscricao = '00077010000';

-- 3. MIGRAR HISTÓRICO E DESBLOQUEIOS (CRÍTICO)
-- Garante que usuários que pagaram pelo desbloqueio não percam o acesso
UPDATE public.unlocked_lots 
SET lote_inscricao = '00077010' 
WHERE lote_inscricao = '00077010000';

-- 4. REMOVER O LOTE INCORRETO
-- Como as unidades já foram movidas para '00077010', podemos deletar o antigo
DELETE FROM public.lotes 
WHERE inscricao = '00077010000';

COMMIT;

-- CONSULTA DE VERIFICAÇÃO (RODE APÓS O SCRIPT)
-- -----------------------------------------------------------------------------
-- SELECT * FROM public.lotes WHERE inscricao = '00077010';
-- SELECT count(*) as unidades_migradas FROM public.unidades WHERE lote_inscricao = '00077010';
-- -----------------------------------------------------------------------------
