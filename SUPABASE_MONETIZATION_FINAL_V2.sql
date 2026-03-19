-- ============================================================================
-- SCRIPT FINAL DE MONETIZAÇÃO E PRIVACIDADE (MASTER CONSOLIDADO)
-- ============================================================================
-- Este script garante que TODAS as tabelas, permissões e funções (RPCs) 
-- necessárias para o sistema de assinaturas e créditos funcionem perfeitamente.

-- 1. ESTRUTURA DE TABELAS (Garantia de Existência)
--------------------------------------------------

-- Tabela de desbloqueios de IMÓVEIS (Lotes/Edifícios)
CREATE TABLE IF NOT EXISTS public.unlocked_lots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    lote_inscricao VARCHAR(20),
    unidade_inscricao VARCHAR(20),
    preco_creditos INTEGER DEFAULT 1,
    desbloqueado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, lote_inscricao)
);

-- Tabela de desbloqueios de PESSOAS (Proprietários/E-mails)
CREATE TABLE IF NOT EXISTS public.unlocked_persons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    cpf_cnpj VARCHAR(20),
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, cpf_cnpj)
);

-- Tabela de transações de crédito (Extrato)
CREATE TABLE IF NOT EXISTS public.credit_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    amount INTEGER,
    type VARCHAR(20), -- 'usage', 'purchase', 'bonus'
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'success'
);

-- 2. POLÍTICAS DE SEGURANÇA (RLS)
----------------------------------
ALTER TABLE public.unlocked_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unlocked_persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- Políticas para unlocked_lots
DROP POLICY IF EXISTS "Users can view their own lot unlocks" ON public.unlocked_lots;
CREATE POLICY "Users can view their own lot unlocks" ON public.unlocked_lots 
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own lot unlocks" ON public.unlocked_lots;
CREATE POLICY "Users can insert their own lot unlocks" ON public.unlocked_lots 
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Políticas para unlocked_persons
DROP POLICY IF EXISTS "Users can view their own person unlocks" ON public.unlocked_persons;
CREATE POLICY "Users can view their own person unlocks" ON public.unlocked_persons 
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own person unlocks" ON public.unlocked_persons;
CREATE POLICY "Users can insert their own person unlocks" ON public.unlocked_persons 
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 3. FUNÇÕES ATÔMICAS (RPCs) - SEGURANÇA MÁXIMA
-------------------------------------------------

-- A. Função para consumir créditos genérica
CREATE OR REPLACE FUNCTION public.consume_user_credits(credit_amount INTEGER, tx_description TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    current_uid UUID := auth.uid();
    user_credits INTEGER;
BEGIN
    SELECT credits INTO user_credits FROM public.profiles WHERE id = current_uid;
    
    IF user_credits IS NULL OR user_credits < credit_amount THEN
        RAISE EXCEPTION 'Saldo insuficiente.';
    END IF;

    -- Debitar Créditos
    UPDATE public.profiles SET credits = credits - credit_amount WHERE id = current_uid;

    -- Registrar Transação
    INSERT INTO public.credit_transactions (user_id, amount, type, description)
    VALUES (current_uid, -credit_amount, 'usage', tx_description);

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- B. Função para desbloquear LOTE com CRÉDITOS
CREATE OR REPLACE FUNCTION public.unlock_lote_with_credits(target_lote VARCHAR(20), credit_cost INTEGER DEFAULT 1)
RETURNS BOOLEAN AS $$
DECLARE
    current_uid UUID := auth.uid();
    already_unlocked BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.unlocked_lots 
        WHERE user_id = current_uid AND lote_inscricao = target_lote
    ) INTO already_unlocked;

    IF already_unlocked THEN RETURN TRUE; END IF;

    -- Consumir créditos (reusando a lógica atômica)
    IF public.consume_user_credits(credit_cost, 'Desbloqueio de Lote: ' || target_lote) THEN
        INSERT INTO public.unlocked_lots (user_id, lote_inscricao, preco_creditos)
        VALUES (current_uid, target_lote, credit_cost);
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- C. Função para desbloquear LOTE com PLANO (Limite Mensal)
CREATE OR REPLACE FUNCTION public.unlock_lote_with_plan(target_lote VARCHAR(20))
RETURNS BOOLEAN AS $$
DECLARE
    current_uid UUID := auth.uid();
    already_unlocked BOOLEAN;
    user_role TEXT;
    used_this_month INTEGER;
    max_limit INTEGER;
BEGIN
    -- 1. Verificar se já existe
    SELECT EXISTS (
        SELECT 1 FROM public.unlocked_lots 
        WHERE user_id = current_uid AND lote_inscricao = target_lote
    ) INTO already_unlocked;

    IF already_unlocked THEN RETURN TRUE; END IF;

    -- 2. Verificar papel e limites
    SELECT role, monthly_unlocks_used INTO user_role, used_this_month FROM public.profiles WHERE id = current_uid;
    
    -- Definir limites técnicos (Sincronizados com monetization_handler.js)
    max_limit := CASE 
        WHEN user_role = 'pro' THEN 30
        WHEN user_role = 'elite' THEN 80
        WHEN user_role = 'master' THEN 110
        ELSE 0
    END;

    IF user_role = 'admin' THEN max_limit := 999999; END IF;

    IF used_this_month >= max_limit THEN
        RAISE EXCEPTION 'Limite mensal do seu plano atingido (% de %). Use créditos avulsos.', used_this_month, max_limit;
    END IF;

    -- 3. Incrementar uso e salvar
    UPDATE public.profiles SET 
        monthly_unlocks_used = COALESCE(monthly_unlocks_used, 0) + 1,
        total_unlocked = COALESCE(total_unlocked, 0) + 1
    WHERE id = current_uid;

    INSERT INTO public.unlocked_lots (user_id, lote_inscricao, preco_creditos)
    VALUES (current_uid, target_lote, 0);

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- D. Função para desbloquear PESSOA (Proprietário) com CRÉDITOS
CREATE OR REPLACE FUNCTION public.unlock_person_with_credits(target_cpf_cnpj VARCHAR(20), credit_cost INTEGER DEFAULT 1)
RETURNS BOOLEAN AS $$
DECLARE
    current_uid UUID := auth.uid();
    already_unlocked BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.unlocked_persons 
        WHERE user_id = current_uid AND cpf_cnpj = target_cpf_cnpj
    ) INTO already_unlocked;

    IF already_unlocked THEN RETURN TRUE; END IF;

    IF public.consume_user_credits(credit_cost, 'Desbloqueio de Proprietário: ' || target_cpf_cnpj) THEN
        INSERT INTO public.unlocked_persons (user_id, cpf_cnpj)
        VALUES (current_uid, target_cpf_cnpj);
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. GARANTIA DE COLUNAS NO PERFIL
-----------------------------------
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='monthly_unlocks_used') THEN
        ALTER TABLE public.profiles ADD COLUMN monthly_unlocks_used INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='total_unlocked') THEN
        ALTER TABLE public.profiles ADD COLUMN total_unlocked INTEGER DEFAULT 0;
    END IF;
END $$;
