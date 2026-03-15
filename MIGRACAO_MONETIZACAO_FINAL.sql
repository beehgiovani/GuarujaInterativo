-- ============================================================================
-- MIGRATION: FASE 1 & FASE 2 MONETIZAÇÃO - PAYWALL & DESBLOQUEIOS
-- ============================================================================
-- IMPORTANTE: Rode este script no "SQL Editor" do painel do Supabase.
-- Ele cria a tabela que gerencia "quem comprou qual lote" e cria uma função
-- atômica que debita o crédito garantindo segurança máxima contra fraudes.

-- 1. TABELA DE COMPRAS/DESBLOQUEIOS (Minha Carteira)
CREATE TABLE IF NOT EXISTS public.unlocked_lots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    lote_inscricao VARCHAR(20) REFERENCES public.lotes(inscricao) ON DELETE CASCADE,
    unidade_inscricao VARCHAR(20) REFERENCES public.unidades(inscricao) ON DELETE CASCADE, -- Opcional
    preco_creditos INTEGER DEFAULT 1,
    desbloqueado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, lote_inscricao) -- Garante que o usuário não pague 2x pelo mesmo lote
);

-- Segurança de Linha (RLS)
ALTER TABLE public.unlocked_lots ENABLE ROW LEVEL SECURITY;

-- Usuários só podem ver o que eles mesmos desbloquearam
CREATE POLICY "Ver proprios unlocks" ON public.unlocked_lots
    FOR SELECT USING (auth.uid() = user_id);

-- Somente o master pode ver tudo (reaproveitando sua função segura check_if_master)
CREATE POLICY "Master ver todos unlocks" ON public.unlocked_lots
    FOR ALL USING (public.check_if_master());


-- 2. FUNÇÃO ATÔMICA: DESBLOQUEAR LOTE PAGANDO CRÉDITO
-- Isso impede que o usuário adultere o código do navegador para abrir sem pagar
CREATE OR REPLACE FUNCTION public.unlock_lote_with_credits(target_lote VARCHAR(20), credit_cost INTEGER DEFAULT 1)
RETURNS BOOLEAN AS $$
DECLARE
    current_uid UUID := auth.uid();
    user_credits INTEGER;
    already_unlocked BOOLEAN;
BEGIN
    -- 2.1 Verificar se já comprou antes
    SELECT EXISTS (
        SELECT 1 FROM public.unlocked_lots 
        WHERE user_id = current_uid AND lote_inscricao = target_lote
    ) INTO already_unlocked;

    IF already_unlocked THEN
        RETURN TRUE; -- Já é dele, então apenas retorna ok
    END IF;

    -- 2.2 Verificar Saldo do Usuário
    SELECT credits INTO user_credits FROM public.profiles WHERE id = current_uid;
    
    IF user_credits IS NULL OR user_credits < credit_cost THEN
        RAISE EXCEPTION 'Saldo insuficiente. Recarregue seus créditos.';
    END IF;

    -- 2.3 Debitar os Créditos (Atomic Update)
    UPDATE public.profiles 
    SET credits = credits - credit_cost 
    WHERE id = current_uid;

    -- 2.4 Registrar no extrato (credit_transactions)
    INSERT INTO public.credit_transactions (user_id, amount, type, description)
    VALUES (current_uid, -credit_cost, 'usage', 'Desbloqueio do Lote ID: ' || target_lote);

    -- 2.5 Registrar a posse na Carteira (unlocked_lots)
    INSERT INTO public.unlocked_lots (user_id, lote_inscricao, preco_creditos)
    VALUES (current_uid, target_lote, credit_cost);

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. AJUSTE DE TRIGGER: Adicionando saldo inicial (Ex: 3 créditos grátis para isca)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, credits)
  VALUES (new.id, new.email, 
    CASE WHEN new.email = 'brunogp.corretor@gmail.com' THEN 'master' ELSE 'user' END,
    3 -- NOVO: Dando 3 créditos de boas-vindas para o usuário testar a plataforma
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
