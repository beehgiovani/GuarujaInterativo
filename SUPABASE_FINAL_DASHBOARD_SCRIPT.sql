-- ============================================================================
-- SCRIPT FINAL DE MIGRAÇÃO - GUARUJÁ GEOMAP (SQL EDITOR)
-- ============================================================================
-- Este script contém TODAS as funções, tabelas e políticas necessárias.
-- Rode no SQL Editor do Supabase se o banco estiver vazio ou incompleto.

-- 1. FUNÇÕES ESSENCIAIS (RPCs)
-- ============================================

CREATE OR REPLACE FUNCTION public.check_if_master() 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'master');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.spend_credits(amount_to_spend INTEGER, detail TEXT)
RETURNS VOID AS $$
DECLARE
    current_uid UUID := auth.uid();
    user_credits INTEGER;
BEGIN
    SELECT credits INTO user_credits FROM public.profiles WHERE id = current_uid;
    IF user_credits < amount_to_spend THEN RAISE EXCEPTION 'Saldo insuficiente.'; END IF;
    UPDATE public.profiles SET credits = credits - amount_to_spend WHERE id = current_uid;
    INSERT INTO public.credit_transactions (user_id, amount, type, description)
    VALUES (current_uid, -amount_to_spend, 'usage', detail);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.unlock_lote_with_credits(target_lote VARCHAR(20), credit_cost INTEGER DEFAULT 1)
RETURNS BOOLEAN AS $$
DECLARE
    current_uid UUID := auth.uid();
BEGIN
    IF EXISTS (SELECT 1 FROM public.unlocked_lots WHERE user_id = current_uid AND lote_inscricao = target_lote) THEN RETURN TRUE; END IF;
    PERFORM public.spend_credits(credit_cost, 'Desbloqueio do Lote ID: ' || target_lote);
    INSERT INTO public.unlocked_lots (user_id, lote_inscricao, preco_creditos) VALUES (current_uid, target_lote, credit_cost);
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.unlock_lote_with_plan(target_lote VARCHAR(20), target_unidade VARCHAR(20) DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
    current_uid UUID := auth.uid();
    user_role TEXT;
    limit_val INTEGER;
    used_val INTEGER;
BEGIN
    SELECT role, monthly_unlocks_used INTO user_role, used_val FROM public.profiles WHERE id = current_uid;
    limit_val := CASE WHEN user_role = 'pro' THEN 30 WHEN user_role = 'elite' THEN 80 WHEN user_role = 'vip' THEN 110 WHEN user_role IN ('master', 'admin') THEN 999999 ELSE 0 END;
    IF used_val >= limit_val AND user_role NOT IN ('master', 'admin') THEN RAISE EXCEPTION 'Limite mensal atingido.'; END IF;
    INSERT INTO public.unlocked_lots (user_id, lote_inscricao, unidade_inscricao, preco_creditos) VALUES (current_uid, target_lote, target_unidade, 0) ON CONFLICT DO NOTHING;
    UPDATE public.profiles SET monthly_unlocks_used = monthly_unlocks_used + 1 WHERE id = current_uid;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.adjust_credits_admin(target_user_id UUID, amount_to_adjust INTEGER)
RETURNS VOID AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('master', 'admin')) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
    UPDATE public.profiles SET credits = credits + amount_to_adjust WHERE id = target_user_id;
    INSERT INTO public.credit_transactions (user_id, amount, type, description) VALUES (target_user_id, amount_to_adjust, 'adjustment', 'Ajuste administrativo');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. TABELAS DE MONETIZAÇÃO (Se não existirem)
-- ============================================

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    role TEXT DEFAULT 'user',
    credits INTEGER DEFAULT 0,
    monthly_unlocks_used INTEGER DEFAULT 0,
    subscription_period_start TIMESTAMPTZ DEFAULT NOW(),
    profile_completed BOOLEAN DEFAULT false,
    person_type TEXT,
    cpf_cnpj TEXT,
    broker_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.unlocked_lots (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    lote_inscricao VARCHAR(20),
    unidade_inscricao VARCHAR(20),
    preco_creditos INTEGER DEFAULT 1,
    desbloqueado_em TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, lote_inscricao)
);

CREATE TABLE IF NOT EXISTS public.credit_transactions (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    type VARCHAR(20),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. POLÍTICAS RLS ESSENCIAIS
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unlocked_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles: Ver próprio" ON public.profiles;
CREATE POLICY "Profiles: Ver próprio" ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Profiles: Master vê tudo" ON public.profiles;
CREATE POLICY "Profiles: Master vê tudo" ON public.profiles FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'master')
);

DROP POLICY IF EXISTS "Unlocks: Ver próprio" ON public.unlocked_lots;
CREATE POLICY "Unlocks: Ver próprio" ON public.unlocked_lots FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Transactions: Ver próprio" ON public.credit_transactions;
CREATE POLICY "Transactions: Ver próprio" ON public.credit_transactions FOR SELECT USING (auth.uid() = user_id);

-- 4. TRIGGER DE BOAS VINDAS
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, credits)
  VALUES (new.id, new.email, CASE WHEN new.email = 'brunogp.corretor@gmail.com' THEN 'master' ELSE 'user' END, 3);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
