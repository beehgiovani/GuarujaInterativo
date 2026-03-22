-- ================================================================================
-- FIX_RPC_OVERLOADS.sql
-- RESOLVE O ERRO PGRST203 (MULTIPLE CANDIDATES) E ATIVA DESBLOQUEIO GRANULAR
-- ================================================================================

-- 1. LIMPEZA DE VERSÕES ANTIGAS (PARA EVITAR AMBIGUIDADE NO POSTGREST)
-- --------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.unlock_lote_with_plan(VARCHAR);
DROP FUNCTION IF EXISTS public.unlock_lote_with_plan(TEXT);
DROP FUNCTION IF EXISTS public.unlock_lote_with_plan(VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS public.unlock_lote_with_plan(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.unlock_lote_with_plan(VARCHAR, VARCHAR, INTEGER);
DROP FUNCTION IF EXISTS public.unlock_lote_with_plan(TEXT, TEXT, INTEGER);

DROP FUNCTION IF EXISTS public.unlock_lote_with_credits(VARCHAR);
DROP FUNCTION IF EXISTS public.unlock_lote_with_credits(TEXT);
DROP FUNCTION IF EXISTS public.unlock_lote_with_credits(VARCHAR, INTEGER);
DROP FUNCTION IF EXISTS public.unlock_lote_with_credits(TEXT, INTEGER);

-- 2. ATUALIZAÇÃO DA CONSTRAINT DE UNICIDADE
-- --------------------------------------------------------------------------------
-- Remove a restrição antiga que permitia apenas um registro por Lote/Usuário.
-- A nova permite (Lote, nulo) ou (Lote, Unidade específica).
ALTER TABLE public.unlocked_lots DROP CONSTRAINT IF EXISTS unlocked_lots_user_id_lote_inscricao_key;
ALTER TABLE public.unlocked_lots DROP CONSTRAINT IF EXISTS unlocked_lots_unique_selection;

-- Para Postgres 15+ (Supabase padrão), usamos NULLS NOT DISTINCT para tratar nulos como valores únicos.
ALTER TABLE public.unlocked_lots 
ADD CONSTRAINT unlocked_lots_unique_selection UNIQUE NULLS NOT DISTINCT (user_id, lote_inscricao, unidade_inscricao);

-- 3. VERSÃO DEFINITIVA: UNLOCK WITH PLAN
-- --------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.unlock_lote_with_plan(
    target_lote VARCHAR(20), 
    target_unidade VARCHAR(20) DEFAULT NULL,
    token_weight INTEGER DEFAULT 1
)
RETURNS BOOLEAN AS $$
DECLARE
    current_uid UUID := auth.uid();
    user_role TEXT;
    limit_val INTEGER;
    used_val INTEGER;
BEGIN
    -- Obter plano e uso atual
    SELECT role, monthly_unlocks_used INTO user_role, used_val FROM public.profiles WHERE id = current_uid;
    
    -- Definir limites por tier
    limit_val := CASE 
        WHEN user_role = 'pro' THEN 30 
        WHEN user_role = 'elite' THEN 80 
        WHEN user_role = 'vip' THEN 110 
        WHEN user_role IN ('master', 'admin') THEN 999999 
        ELSE 0 
    END;

    -- Verificar limite (Masters ignoram limite)
    IF (used_val + token_weight) > limit_val AND user_role NOT IN ('master', 'admin') THEN 
        RAISE EXCEPTION 'Limite mensal do plano insuficiente para esta operação (% fichas necessárias).', token_weight; 
    END IF;

    -- Registrar desbloqueio (ON CONFLICT garante idempotência)
    INSERT INTO public.unlocked_lots (user_id, lote_inscricao, unidade_inscricao, preco_creditos) 
    VALUES (current_uid, target_lote, target_unidade, 0) 
    ON CONFLICT DO NOTHING;

    -- Incrementar uso proporcional ao peso (Ex: 1 para unidade, 5 para prédio)
    UPDATE public.profiles SET monthly_unlocks_used = monthly_unlocks_used + token_weight WHERE id = current_uid;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. VERSÃO DEFINITIVA: UNLOCK WITH CREDITS
-- --------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.unlock_lote_with_credits(
    target_lote VARCHAR(20), 
    target_unidade VARCHAR(20) DEFAULT NULL,
    credit_cost INTEGER DEFAULT 1
)
RETURNS BOOLEAN AS $$
DECLARE
    current_uid UUID := auth.uid();
    already_unlocked BOOLEAN;
BEGIN
    -- Verificar se já existe (Evita cobrança duplicada)
    SELECT EXISTS (
        SELECT 1 FROM public.unlocked_lots 
        WHERE user_id = current_uid 
          AND lote_inscricao = target_lote 
          AND (unidade_inscricao IS NOT DISTINCT FROM target_unidade)
    ) INTO already_unlocked;

    IF already_unlocked THEN RETURN TRUE; END IF;

    -- Cobrar créditos
    PERFORM public.spend_credits(credit_cost, 'Desbloqueio: ' || COALESCE(target_unidade, target_lote));

    -- Registrar
    INSERT INTO public.unlocked_lots (user_id, lote_inscricao, unidade_inscricao, preco_creditos) 
    VALUES (current_uid, target_lote, target_unidade, credit_cost);
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
