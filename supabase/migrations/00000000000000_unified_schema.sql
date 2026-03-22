/*
================================================================================
DATABASE_SCHEMA_MASTER_V1.sql (VERSÃO 100% INTEGRADA)
ARQUIVO MESTRE E UNIFICADO DO BANCO DE DADOS (SUPABASE / POSTGRES)

ESTE É O DOCUMENTO DE REFERÊNCIA DEFINITIVO PARA O PROJETO GUARUJÁ INTERATIVO.
QUALQUER ALTERAÇÃO NO BANCO DE DADOS DEVE SER CONSULTADA E REGISTRADA AQUI.
================================================================================
*/

-- 1. SETUP & EXTENSIONS
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";

-- 2. CUSTOM FUNCTIONS & RPCs
-- ============================================

-- Remover acentos para busca
CREATE OR REPLACE FUNCTION public.remove_accents_custom(text) RETURNS text
LANGUAGE sql IMMUTABLE AS $_$
SELECT translate($1, 'áàâãäåāăąÁÀÂÃÄÅĀĂĄéèêëēĕėęěÉÈÊËĒĔĖĘĚíìîïĩīĭįıİÍÌÎÏĨĪĬĮIóòôõöøōŏőÒÓÔÕÖØŌŎŐúùûüũūŭůűųÚÙÛÜŨŪŬŮŰŲçćĉċčÇĆĈĊČñńņňŉÑŃŅŇ', 'aaaaaaaaaAAAAAAAAAeeeeeeeeeEEEEEEEEEiiiiiiiiiiIIIIIIIIIoooooooooOOOOOOOOOuuuuuuuuuuUUUUUUUUUUcccccCCCCCNNNNN');
$_$;

-- Atualizar nome de busca (Trigger function)
CREATE OR REPLACE FUNCTION public.update_nome_busca() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN NEW.nome_busca := lower(public.remove_accents_custom(NEW.nome_completo)); RETURN NEW; END; $$;

-- Atualizar timestamp updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

-- Verificar se o usuário é Master
CREATE OR REPLACE FUNCTION public.check_if_master() 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'master');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Obter Role do Usuário
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = user_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Gastar Créditos (Genérico)
CREATE OR REPLACE FUNCTION public.spend_credits(amount_to_spend INTEGER, detail TEXT)
RETURNS VOID AS $$
DECLARE
    current_uid UUID := auth.uid();
    user_credits INTEGER;
BEGIN
    SELECT credits INTO user_credits FROM public.profiles WHERE id = current_uid;
    IF user_credits < amount_to_spend THEN
        RAISE EXCEPTION 'Saldo insuficiente.';
    END IF;
    UPDATE public.profiles SET credits = credits - amount_to_spend WHERE id = current_uid;
    INSERT INTO public.credit_transactions (user_id, amount, type, description)
    VALUES (current_uid, -amount_to_spend, 'usage', detail);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Desbloquear Lote com Créditos
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

-- Desbloquear Lote com Plano (Monthly Limit)
CREATE OR REPLACE FUNCTION public.unlock_lote_with_plan(
    target_lote VARCHAR(20), 
    target_unidade VARCHAR(20) DEFAULT NULL
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
    IF used_val >= limit_val AND user_role NOT IN ('master', 'admin') THEN 
        RAISE EXCEPTION 'Limite mensal do plano atingido.'; 
    END IF;

    -- Registrar desbloqueio (ON CONFLICT garante idempotência)
    INSERT INTO public.unlocked_lots (user_id, lote_inscricao, unidade_inscricao, preco_creditos) 
    VALUES (current_uid, target_lote, target_unidade, 0) 
    ON CONFLICT DO NOTHING;

    -- Incrementar uso
    UPDATE public.profiles SET monthly_unlocks_used = monthly_unlocks_used + 1 WHERE id = current_uid;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ajustar Créditos por Admin
CREATE OR REPLACE FUNCTION public.adjust_credits_admin(target_user_id UUID, amount_to_adjust INTEGER)
RETURNS VOID AS $$
BEGIN
    IF NOT public.check_if_master() THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
    UPDATE public.profiles SET credits = credits + amount_to_adjust WHERE id = target_user_id;
    INSERT INTO public.credit_transactions (user_id, amount, type, description) VALUES (target_user_id, amount_to_adjust, 'adjustment', 'Ajuste administrativo');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger de novos usuários
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, credits)
  VALUES (new.id, new.email, CASE WHEN new.email = 'brunogp.corretor@gmail.com' THEN 'master' ELSE 'user' END, 3);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Histórico de proprietários
CREATE OR REPLACE FUNCTION public.preservar_historico_proprietario()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.nome_proprietario IS DISTINCT FROM NEW.nome_proprietario) OR (OLD.cpf_cnpj IS DISTINCT FROM NEW.cpf_cnpj) THEN
        IF (OLD.nome_proprietario IS NOT NULL AND OLD.nome_proprietario <> '') THEN
            INSERT INTO public.unidades_proprietarios_historico (unidade_inscricao, proprietario_nome, proprietario_documento, detalhes)
            VALUES (OLD.inscricao, OLD.nome_proprietario, OLD.cpf_cnpj, 'Transferência de titularidade');
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. TABLES (Core First)
-- ============================================

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('master', 'admin', 'user', 'pro', 'elite', 'vip')),
    credits INTEGER DEFAULT 0,
    monthly_unlocks_used INTEGER DEFAULT 0,
    subscription_period_start TIMESTAMPTZ DEFAULT NOW(),
    profile_completed BOOLEAN DEFAULT false,
    person_type TEXT,
    cpf_cnpj TEXT,
    broker_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.proprietarios (
    id BIGSERIAL PRIMARY KEY,
    cpf_cnpj VARCHAR(20) UNIQUE NOT NULL,
    nome_completo TEXT NOT NULL,
    nome_busca TEXT,
    dados_enrichment JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lotes (
    inscricao VARCHAR(20) PRIMARY KEY,
    zona VARCHAR(10),
    bairro VARCHAR(100),
    minx DOUBLE PRECISION, miny DOUBLE PRECISION, maxx DOUBLE PRECISION, maxy DOUBLE PRECISION,
    building_name TEXT,
    image_url TEXT,
    gallery TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.unidades (
    inscricao VARCHAR(20) PRIMARY KEY,
    lote_inscricao VARCHAR(20) REFERENCES public.lotes(inscricao) ON DELETE CASCADE,
    nome_proprietario TEXT,
    cpf_cnpj VARCHAR(20),
    endereco_completo TEXT,
    metragem NUMERIC(15, 2),
    valor_venal NUMERIC(15, 2),
    quartos INT, suites INT, banheiros INT, vagas INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.unlocked_lots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    lote_inscricao VARCHAR(20) REFERENCES public.lotes(inscricao) ON DELETE CASCADE,
    unidade_inscricao VARCHAR(20) REFERENCES public.unidades(inscricao) ON DELETE CASCADE,
    preco_creditos INTEGER DEFAULT 1,
    desbloqueado_em TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE NULLS NOT DISTINCT (user_id, lote_inscricao, unidade_inscricao)
);

CREATE TABLE IF NOT EXISTS public.unlocked_persons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    cpf_cnpj VARCHAR(20) NOT NULL,
    unlocked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.credit_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    type VARCHAR(20) CHECK (type IN ('purchase', 'usage', 'adjustment', 'refund')),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    user_email TEXT,
    action TEXT NOT NULL,
    detail TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.unidades_proprietarios_historico (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unidade_inscricao VARCHAR(20) REFERENCES public.unidades(inscricao),
    proprietario_nome TEXT,
    proprietario_documento VARCHAR(20),
    data_registro DATE DEFAULT CURRENT_DATE,
    detalhes TEXT
);

CREATE TABLE IF NOT EXISTS public.cupons_desconto (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo VARCHAR(20) UNIQUE NOT NULL,
    tipo VARCHAR(10) CHECK (tipo IN ('percent', 'fixed')),
    valor NUMERIC NOT NULL,
    ativo BOOLEAN DEFAULT true,
    expira_em TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pending_plan_activations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    plano_solicitado TEXT,
    valor_pago NUMERIC,
    comprovante_url TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.pending_credit_releases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    quantidade INTEGER,
    valor_pago NUMERIC,
    comprovante_url TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ
);

-- 4. RLS ENABLES
-- ============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unlocked_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unlocked_persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cupons_desconto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_plan_activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_credit_releases ENABLE ROW LEVEL SECURITY;

-- 5. POLICIES (Simplified & Unified)
-- ============================================

-- PROFILES
CREATE POLICY "Profiles: Ver próprio" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Profiles: Master vê tudo" ON public.profiles FOR ALL USING (public.check_if_master());

-- UNLOCKS
CREATE POLICY "Unlocks: Ver próprio" ON public.unlocked_lots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Unlocks: Master vê tudo" ON public.unlocked_lots FOR ALL USING (public.check_if_master());

-- TRANSAÇÕES
CREATE POLICY "Transactions: Ver próprio" ON public.credit_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Transactions: Master vê tudo" ON public.credit_transactions FOR ALL USING (public.check_if_master());

-- AUDITORIA
CREATE POLICY "Audit: Master vê tudo" ON public.audit_logs FOR SELECT USING (public.check_if_master());
CREATE POLICY "Audit: Inserção autenticada" ON public.audit_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- SETTINGS
CREATE POLICY "Settings: Leitura autenticada" ON public.app_settings FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Settings: Master tudo" ON public.app_settings FOR ALL USING (public.check_if_master());

-- SOLICITAÇÕES FINANCEIRAS
CREATE POLICY "Fin: Ver próprio" ON public.pending_plan_activations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Fin: Inserir próprio" ON public.pending_plan_activations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Fin: Master tudo" ON public.pending_plan_activations FOR ALL USING (public.check_if_master());

CREATE POLICY "Cred: Ver próprio" ON public.pending_credit_releases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Cred: Inserir próprio" ON public.pending_credit_releases FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Cred: Master tudo" ON public.pending_credit_releases FOR ALL USING (public.check_if_master());

-- CUPONS
CREATE POLICY "Cupons: Master tudo" ON public.cupons_desconto FOR ALL USING (public.check_if_master());
CREATE POLICY "Cupons: Leitura pública para checkout" ON public.cupons_desconto FOR SELECT USING (ativo = true);

-- 6. TRIGGERS
-- ============================================
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
CREATE TRIGGER trg_unit_history BEFORE UPDATE ON public.unidades FOR EACH ROW EXECUTE FUNCTION public.preservar_historico_proprietario();
CREATE TRIGGER trg_owner_search BEFORE INSERT OR UPDATE OF nome_completo ON public.proprietarios FOR EACH ROW EXECUTE FUNCTION public.update_nome_busca();

-- 7. PUBLIC READ ACCESS (Core Data)
-- ============================================
-- Tabelas geográficas são leitura pública
ALTER TABLE public.lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura pública lotes" ON public.lotes FOR SELECT USING (true);
CREATE POLICY "Leitura pública unidades" ON public.unidades FOR SELECT USING (true);
