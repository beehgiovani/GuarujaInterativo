-- ============================================================================
-- SQL: DESBLOQUEIO PERSISTENTE DE PROPRIETÁRIOS (CARTEIRA)
-- ============================================================================
-- Objetivo: Criar função atômica para desbloquear proprietário usando créditos.
-- Rode este script no "SQL Editor" do seu Supabase.

-- 1. Garantir que a tabela existe (Opcional se já estiver no esquema)
CREATE TABLE IF NOT EXISTS public.unlocked_persons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    cpf_cnpj VARCHAR(20) NOT NULL,
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, cpf_cnpj)
);

-- 2. Ativar RLS se necessário
ALTER TABLE public.unlocked_persons ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de Acesso
DROP POLICY IF EXISTS "Ver proprios unlocks de pessoas" ON public.unlocked_persons;
CREATE POLICY "Ver proprios unlocks de pessoas" ON public.unlocked_persons
    FOR SELECT USING (auth.uid() = user_id);

-- 4. FUNÇÃO ATÔMICA
CREATE OR REPLACE FUNCTION public.unlock_person_with_credits(target_cpf_cnpj VARCHAR(20), credit_cost INTEGER DEFAULT 1)
RETURNS BOOLEAN AS $$
DECLARE
    current_uid UUID := auth.uid();
    user_credits INTEGER;
    already_unlocked BOOLEAN;
BEGIN
    -- 4.1 Verificar se já comprou antes
    SELECT EXISTS (
        SELECT 1 FROM public.unlocked_persons 
        WHERE user_id = current_uid AND cpf_cnpj = target_cpf_cnpj
    ) INTO already_unlocked;

    IF already_unlocked THEN
        RETURN TRUE;
    END IF;

    -- 4.2 Verificar Saldo (Admin/Master não pagam, mas aqui a função rpc pode tratar)
    -- Se for master, nem devia estar chamando aqui, mas garantimos:
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = current_uid AND (role = 'master' OR role = 'admin')) THEN
        -- Apenas insere sem cobrar
        INSERT INTO public.unlocked_persons (user_id, cpf_cnpj)
        VALUES (current_uid, target_cpf_cnpj)
        ON CONFLICT DO NOTHING;
        RETURN TRUE;
    END IF;

    SELECT credits INTO user_credits FROM public.profiles WHERE id = current_uid;
    
    IF user_credits IS NULL OR user_credits < credit_cost THEN
        RAISE EXCEPTION 'Saldo insuficiente.';
    END IF;

    -- 4.3 Debitar
    UPDATE public.profiles 
    SET credits = credits - credit_cost 
    WHERE id = current_uid;

    -- 4.4 Registrar Transação
    INSERT INTO public.credit_transactions (user_id, amount, type, description)
    VALUES (current_uid, -credit_cost, 'usage', 'Desbloqueio de Proprietário: ' || target_cpf_cnpj);

    -- 4.5 Registrar na Carteira
    INSERT INTO public.unlocked_persons (user_id, cpf_cnpj)
    VALUES (current_uid, target_cpf_cnpj);

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
