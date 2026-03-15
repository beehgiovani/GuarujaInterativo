-- UNIFIED & DEDUPLICATED SCHEMA
-- This file represents the current state of the database.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- 1. FUNCTIONS
CREATE OR REPLACE FUNCTION remove_accents_custom(text) RETURNS text AS $$
SELECT translate(
    $1, 
    'áàâãäåāăąÁÀÂÃÄÅĀĂĄéèêëēĕėęěÉÈÊËĒĔĖĘĚíìîïìĩīĭįıÍÌÎÏÌĨĪĬĮIóòôõöøōŏőÓÒÔÕÖØŌŎŐúùûüũūŭůűųÚÙÛÜŨŪŬŮŰŲçćĉċčÇĆĈĊČñńņňÑŃŅŇ', 
    'aaaaaaaaaaaaaaaaeeeeeeeeeeeeeeeeiiiiiiiiiiiiiiioooooooooooooooooouuuuuuuuuuuuuuuuuucccccCCCCCNNNN'
);
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION update_nome_busca() RETURNS TRIGGER AS $$
BEGIN
    NEW.nome_busca := lower(remove_accents_custom(NEW.nome_completo));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cleanup_old_analytics()
RETURNS void AS $$
BEGIN
    DELETE FROM analytics_events
    WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

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

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, credits)
  VALUES (new.id, new.email, 
    CASE WHEN new.email = 'brunogp.corretor@gmail.com' THEN 'master' ELSE 'user' END,
    0
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION spend_credits(amount_to_spend INTEGER, detail TEXT)
RETURNS VOID AS $$
DECLARE
    current_uid UUID := auth.uid();
BEGIN
    IF (SELECT credits FROM public.profiles WHERE id = current_uid) < amount_to_spend THEN
        RAISE EXCEPTION 'Saldo de créditos insuficiente';
    END IF;

    UPDATE public.profiles 
    SET credits = credits - amount_to_spend 
    WHERE id = current_uid;

    INSERT INTO credit_transactions (user_id, amount, type, description)
    VALUES (current_uid, -amount_to_spend, 'usage', detail);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION add_credits(amount_to_add INTEGER, detail TEXT)
RETURNS VOID AS $$
DECLARE
    current_uid UUID := auth.uid();
BEGIN
    UPDATE public.profiles 
    SET credits = credits + amount_to_add 
    WHERE id = current_uid;

    INSERT INTO credit_transactions (user_id, amount, type, description)
    VALUES (current_uid, amount_to_add, 'purchase', detail);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION adjust_credits_admin(target_user_id UUID, amount_to_adjust INTEGER)
RETURNS VOID AS $$
DECLARE
    v_admin_email TEXT;
BEGIN
    -- Verificar se quem chama é master
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('master', 'admin')) THEN
        RAISE EXCEPTION 'Acesso negado: Somente administradores podem ajustar créditos.';
    END IF;

    SELECT email INTO v_admin_email FROM profiles WHERE id = auth.uid();

    UPDATE public.profiles 
    SET credits = credits + amount_to_adjust 
    WHERE id = target_user_id;

    INSERT INTO credit_transactions (user_id, amount, type, description)
    VALUES (target_user_id, amount_to_adjust, 'adjustment', 'Ajuste manual por administrador');

    INSERT INTO audit_logs (user_id, user_email, action, detail)
    VALUES (auth.uid(), v_admin_email, 'admin_adjust_credits', 'Ajuste de ' || amount_to_adjust || ' créditos para usuário ' || target_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.check_if_master()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('master', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION unlock_lote_with_plan(
    target_lote TEXT,
    unit_id TEXT DEFAULT NULL,
    credit_cost INTEGER DEFAULT 1
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_role TEXT;
    v_monthly_limit INTEGER;
    v_monthly_used INTEGER;
    v_credits INTEGER;
    v_already_unlocked BOOLEAN;
    v_email TEXT;
BEGIN
    -- 1. Obter dados do usuário
    SELECT role, monthly_unlocks_used, credits, email 
    INTO v_role, v_monthly_used, v_credits, v_email 
    FROM profiles 
    WHERE id = v_user_id;

    -- 2. Verificar se quem chama é Master (bypass total)
    IF v_role = 'master' THEN
        RETURN jsonb_build_object('success', true, 'method', 'master_free');
    END IF;

    -- 3. Verificar se já está desbloqueado
    SELECT EXISTS (
        SELECT 1 FROM unlocked_lots 
        WHERE user_id = v_user_id 
        AND lote_inscricao = target_lote 
        AND (unit_id IS NULL OR unidade_inscricao = unit_id)
    ) INTO v_already_unlocked;

    IF v_already_unlocked THEN
        RETURN jsonb_build_object('success', true, 'method', 'already_unlocked');
    END IF;

    -- 4. Definir limites por role
    v_monthly_limit := CASE 
        WHEN v_role = 'pro' THEN 50 
        WHEN v_role = 'elite' THEN 200 
        ELSE 0 
    END;

    -- 5. Tentar descontar da cota mensal primeiro
    IF v_monthly_used < v_monthly_limit THEN
        UPDATE profiles SET 
            monthly_unlocks_used = monthly_unlocks_used + 1,
            total_unlocked = total_unlocked + 1
        WHERE id = v_user_id;

        INSERT INTO unlocked_lots (user_id, lote_inscricao, unidade_inscricao, preco_creditos, desbloqueado_em)
        VALUES (v_user_id, target_lote, unit_id, 0, now());
        
        -- Log auditoria
        INSERT INTO audit_logs (user_id, user_email, action, detail)
        VALUES (v_user_id, v_email, 'plan_unlock', 'Desbloqueio via cota mensal: ' || target_lote);

        RETURN jsonb_build_object('success', true, 'method', 'plan_limit', 'used', v_monthly_used + 1, 'limit', v_monthly_limit);
    END IF;

    -- 6. Se cota mensal esgotada, tentar usar créditos comprados
    IF v_credits >= credit_cost THEN
        UPDATE profiles SET 
            credits = credits - credit_cost,
            total_unlocked = total_unlocked + 1
        WHERE id = v_user_id;

        INSERT INTO unlocked_lots (user_id, lote_inscricao, unidade_inscricao, preco_creditos, desbloqueado_em)
        VALUES (v_user_id, target_lote, unit_id, credit_cost, now());
        
        INSERT INTO credit_transactions (user_id, amount, type, description)
        VALUES (v_user_id, -credit_cost, 'usage', 'Desbloqueio via créditos: ' || target_lote);

        INSERT INTO audit_logs (user_id, user_email, action, detail)
        VALUES (v_user_id, v_email, 'credit_unlock', 'Desbloqueio pago: ' || target_lote);

        RETURN jsonb_build_object('success', true, 'method', 'credits', 'remaining', v_credits - credit_cost);
    END IF;

    -- 7. Falha: Sem créditos e sem limite
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance and monthly limit reached');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION unlock_lote_with_credits(
    target_lote TEXT,
    unit_id TEXT DEFAULT NULL,
    credit_cost INTEGER DEFAULT 1
)
RETURNS JSONB AS $$
BEGIN
    RETURN unlock_lote_with_plan(target_lote, unit_id, credit_cost);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_financial_summary()
RETURNS JSONB AS $$
DECLARE
    v_total_revenue NUMERIC;
    v_pending_count INTEGER;
    v_approved_count INTEGER;
    v_rejected_count INTEGER;
BEGIN
    SELECT COALESCE(SUM(valor_pago), 0) INTO v_total_revenue
    FROM (
        SELECT valor_pago FROM pending_plan_activations WHERE status = 'approved'
        UNION ALL
        SELECT valor_pago FROM pending_credit_releases WHERE status = 'approved'
    ) AS all_approved;

    SELECT COUNT(*) INTO v_pending_count
    FROM (
        SELECT id FROM pending_plan_activations WHERE status = 'pending'
        UNION ALL
        SELECT id FROM pending_credit_releases WHERE status = 'pending'
    ) AS all_pending;

    SELECT COUNT(*) INTO v_approved_count
    FROM (
        SELECT id FROM pending_plan_activations WHERE status = 'approved'
        UNION ALL
        SELECT id FROM pending_credit_releases WHERE status = 'approved'
    ) AS all_appr;

    SELECT COUNT(*) INTO v_rejected_count
    FROM (
        SELECT id FROM pending_plan_activations WHERE status = 'rejected'
        UNION ALL
        SELECT id FROM pending_credit_releases WHERE status = 'rejected'
    ) AS all_rej;

    RETURN jsonb_build_object(
        'total_revenue', v_total_revenue,
        'pending_count', v_pending_count,
        'approved_count', v_approved_count,
        'rejected_count', v_rejected_count,
        'conversion_rate', CASE WHEN (v_approved_count + v_rejected_count) > 0 
                           THEN (v_approved_count::float / (v_approved_count + v_rejected_count) * 100)::integer 
                           ELSE 100 END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.preservar_historico_proprietario()
RETURNS TRIGGER AS $$
BEGIN
    -- Só salva se houve mudança real de titular
    IF (OLD.nome_proprietario IS DISTINCT FROM NEW.nome_proprietario) OR 
       (OLD.cpf_cnpj IS DISTINCT FROM NEW.cpf_cnpj) THEN
        IF (OLD.nome_proprietario IS NOT NULL AND OLD.nome_proprietario <> '') THEN
            INSERT INTO public.unidades_proprietarios_historico (
                unidade_inscricao,
                proprietario_nome,
                proprietario_documento,
                data_registro,
                detalhes
            ) VALUES (
                OLD.inscricao,
                OLD.nome_proprietario,
                OLD.cpf_cnpj,
                CURRENT_DATE,
                'Transferência: de ' || COALESCE(OLD.nome_proprietario, 'Antigo') || ' para ' || COALESCE(NEW.nome_proprietario, 'Novo')
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.handle_user_email_sync()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (new.id, new.email, 'user')
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. TABLES
-- ============================================
CREATE TABLE IF NOT EXISTS public.visitas (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id              UUID REFERENCES leads(id) ON DELETE CASCADE,
    unidade_inscricao    VARCHAR(20), -- REFERENCES unidades(inscricao) removed for flexibility if needed or check dump
    data_visita          TIMESTAMP WITH TIME ZONE,
    feedback_cliente     TEXT,
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    user_id              UUID
);

CREATE TABLE IF NOT EXISTS public.unlocked_lots (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id              UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    lote_inscricao       VARCHAR(20) REFERENCES public.lotes(inscricao) ON DELETE CASCADE,
    unidade_inscricao    VARCHAR(20) REFERENCES public.unidades(inscricao) ON DELETE CASCADE, -- Opcional,
    preco_creditos       INTEGER DEFAULT 1,
    desbloqueado_em      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.unit_files (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_inscricao       TEXT, -- Link lógico (sem FK rígida para flexibilidade),
    name                 TEXT NOT NULL,
    path                 TEXT NOT NULL,
    folder               TEXT DEFAULT 'root',
    type                 TEXT,
    size                 BIGINT,
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.leads (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome                 TEXT NOT NULL,
    contato              TEXT,
    status               TEXT DEFAULT 'Frio',
    corretor_responsavel_id TEXT,
    preferencias         JSONB DEFAULT '{}',
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    telefone             VARCHAR(20),
    email                TEXT,
    cpf_cnpj             VARCHAR(20),
    zonas_interesse      TEXT[],
    setores_interesse    TEXT[],
    tipo_imovel          VARCHAR(50),
    quartos_min          INT,
    quartos_max          INT,
    metragem_min         NUMERIC,
    metragem_max         NUMERIC,
    valor_min            NUMERIC,
    valor_max            NUMERIC,
    observacoes          TEXT,
    updated_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id              UUID
);

CREATE TABLE IF NOT EXISTS public.unidades_proprietarios_historico (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unidade_inscricao    TEXT NOT NULL REFERENCES public.unidades(inscricao) ON DELETE CASCADE,
    proprietario_id      BIGINT REFERENCES proprietarios(id) ON DELETE SET NULL,
    nome_proprietario_manual TEXT, -- Caso não tenha o ID no sistema,
    data_inicio          DATE,
    data_fim             DATE,
    obs                  TEXT,
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT now(),
    proprietario_nome    TEXT NOT NULL,
    proprietario_documento TEXT,
    detalhes             TEXT,
    data_registro        DATE DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS public.analytics_events (
    id                   BIGINT PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    event_type           VARCHAR(255) NOT NULL,
    event_data           JSONB DEFAULT '{}'::jsonb,
    user_session         VARCHAR(255),
    ip_address           VARCHAR(45),
    user_agent           TEXT
);

CREATE TABLE IF NOT EXISTS public.pending_plan_activations (
    id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id              uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    plano_solicitado     text NOT NULL CHECK (plano_solicitado IN ('pro', 'elite', 'annual')),
    valor_pago           numeric(10,2),
    status               text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at           timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.anuncios_notifications (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    anuncio_id           UUID REFERENCES anuncios(id) ON DELETE CASCADE,
    tipo                 VARCHAR(50) DEFAULT '100_match',
    mensagem             TEXT,
    criado_em            TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    lido                 BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.profiles (
    id                   UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    email                TEXT,
    role                 TEXT DEFAULT 'user', -- 'master', 'admin', 'user',
    credits              INTEGER DEFAULT 0,
    is_active            BOOLEAN DEFAULT true,
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    monthly_unlocks_used INTEGER,
    subscription_period_start TIMESTAMPTZ,
    total_unlocked       INTEGER
);

CREATE TABLE IF NOT EXISTS public.ai_history (
    id                   BIGINT,
    created_at           TIMESTAMPTZ,
    inscricao            TEXT,
    type                 TEXT,
    content              TEXT,
    metadata             JSONB
);

CREATE TABLE IF NOT EXISTS public.bairros_ajustes (
    nome_bairro          TEXT,
    lat                  DOUBLE PRECISION,
    lng                  DOUBLE PRECISION,
    visible              BOOLEAN DEFAULT true,
    updated_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notificacoes (
    id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    titulo               TEXT NOT NULL,
    mensagem             TEXT,
    link_url             TEXT, -- Link para o PDF no Storage,
    tipo                 TEXT DEFAULT 'certidao', -- 'certidao', 'sistema', etc.,
    lida                 BOOLEAN DEFAULT FALSE,
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.referencias_geograficas (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    nome                 TEXT NOT NULL,
    tipo                 TEXT NOT NULL CHECK (tipo IN ('MAR', 'POI', 'OUTRO')),
    subtipo              TEXT,
    geometria            JSONB NOT NULL, -- GeoJSON Feature,
    cor                  TEXT DEFAULT '#3388ff'
);

CREATE TABLE IF NOT EXISTS public.cupons_desconto (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo               TEXT UNIQUE NOT NULL,
    tipo                 TEXT NOT NULL CHECK (tipo IN ('percent', 'flat')),
    valor                NUMERIC NOT NULL,
    ativo                BOOLEAN DEFAULT true,
    expira_em            TIMESTAMPTZ,
    created_at           TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crm_atividades (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id              UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    user_id              UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
    tipo                 TEXT NOT NULL DEFAULT 'nota', -- 'nota', 'ligacao', 'visita', 'whatsapp', 'sistema',
    conteudo             TEXT NOT NULL,
    metadata             JSONB DEFAULT '{}'::jsonb,
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.pending_credit_releases (
    id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id              uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    quantidade           integer NOT NULL CHECK (quantidade > 0),
    valor_pago           numeric(10,2),
    status               text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at           timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.proprietarios (
    id                   BIGSERIAL PRIMARY KEY,
    cpf_cnpj             VARCHAR(20) UNIQUE NOT NULL,
    nome_completo        TEXT NOT NULL,
    tipo                 VARCHAR(10),
    dados_enrichment     JSONB DEFAULT '{}'::jsonb,
    rg                   VARCHAR(20),
    data_nascimento      DATE,
    idade                INTEGER,
    genero               VARCHAR(10),
    nome_mae             TEXT,
    situacao_cadastral   VARCHAR(50),
    pep                  BOOLEAN DEFAULT FALSE,
    aposentado           BOOLEAN DEFAULT FALSE,
    possivelmente_falecido BOOLEAN DEFAULT FALSE,
    bolsa_familia        BOOLEAN DEFAULT FALSE,
    ocupacao             TEXT,
    renda_estimada       VARCHAR(50),
    total_propriedades   INTEGER DEFAULT 0,
    data_enriquecimento  TIMESTAMP WITH TIME ZONE,
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    nome_busca           TEXT
);

CREATE TABLE IF NOT EXISTS public.lotes (
    inscricao            VARCHAR(20) PRIMARY KEY,
    zona                 VARCHAR(10),
    setor                VARCHAR(10),
    lote_geo             VARCHAR(10),
    quadra               VARCHAR(50),
    loteamento           VARCHAR(100),
    bairro               VARCHAR(100),
    valor_m2             NUMERIC(10, 2),
    minx                 DOUBLE PRECISION,
    miny                 DOUBLE PRECISION,
    maxx                 DOUBLE PRECISION,
    maxy                 DOUBLE PRECISION,
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    building_name        TEXT,
    image_url            TEXT,
    floors               VARCHAR(20),
    build_year           VARCHAR(10),
    manager_info         TEXT,
    amenities            TEXT,
    obs                  TEXT,
    gallery              TEXT[] DEFAULT '{}',
    piscina              BOOLEAN DEFAULT FALSE,
    zelador_nome         TEXT,
    zelador_contato      TEXT,
    elevador             BOOLEAN DEFAULT FALSE,
    portaria_24h         BOOLEAN DEFAULT FALSE,
    churrasqueira        BOOLEAN DEFAULT FALSE,
    salao_jogos          BOOLEAN DEFAULT FALSE,
    servico_praia        BOOLEAN DEFAULT FALSE,
    zeladoria            BOOLEAN DEFAULT FALSE,
    academia             BOOLEAN DEFAULT FALSE,
    bicicletario         BOOLEAN DEFAULT FALSE,
    acesso_pcd           BOOLEAN DEFAULT FALSE,
    salao_festas         BOOLEAN DEFAULT FALSE,
    area_verde           BOOLEAN DEFAULT FALSE,
    valor_condominio     TEXT
);

CREATE TABLE IF NOT EXISTS public.credit_transactions (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id              UUID REFERENCES auth.users ON DELETE CASCADE,
    amount               INTEGER NOT NULL,
    type                 TEXT CHECK (type IN ('purchase', 'usage', 'adjustment')),
    description          TEXT,
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status               TEXT
);

CREATE TABLE IF NOT EXISTS public.unidades (
    inscricao            VARCHAR(20) PRIMARY KEY,
    lote_inscricao       VARCHAR(20) REFERENCES lotes(inscricao) ON DELETE CASCADE,
    nome_proprietario    TEXT,
    cpf_cnpj             VARCHAR(20),
    logradouro           TEXT,
    numero               VARCHAR(20),
    complemento          TEXT,
    bairro_unidade       VARCHAR(100),
    cep                  VARCHAR(15),
    endereco_completo    TEXT,
    metragem             NUMERIC(10, 2),
    valor_venal          NUMERIC(15, 2),
    valor_venal_edificado NUMERIC(15, 2),
    descricao_imovel     TEXT,
    status_processamento VARCHAR,
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    cod_ref              TEXT,
    link_url             TEXT,
    quartos              INT,
    suites               INT,
    banheiros            INT,
    vagas                INT,
    area_util            NUMERIC(10, 2),
    area_total           NUMERIC(10, 2),
    caracteristicas      TEXT[] DEFAULT '{}',
    status_venda         TEXT DEFAULT 'Disponível',
    imagens              TEXT[] DEFAULT '{}',
    documentos           JSONB DEFAULT '[]',
    tipo                 VARCHAR(50),
    contato_proprietario TEXT[] DEFAULT '{}',
    dados_enrichment     JSONB DEFAULT '{}',
    last_enrichment_at   TIMESTAMP WITH TIME ZONE,
    proprietario_id      BIGINT REFERENCES proprietarios(id) ON DELETE SET NULL,
    valor_real           NUMERIC(15, 2),
    valor_vendavel       NUMERIC(15, 2),
    matricula            TEXT,
    rip                  TEXT
);

CREATE TABLE IF NOT EXISTS public.user_lote_edits (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    lote_inscricao       TEXT NOT NULL,
    field_name           TEXT NOT NULL,
    old_value            TEXT,
    new_value            TEXT,
    is_approved          BOOLEAN DEFAULT false,
    created_at           TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_unit_edits (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID NOT NULL, -- será linkado abaixo,
    unit_inscricao       TEXT NOT NULL,
    field_name           TEXT NOT NULL,
    old_value            TEXT,
    new_value            TEXT,
    is_approved          BOOLEAN DEFAULT false,
    created_at           TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mercado_historico (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bairro               TEXT,
    tipologia            TEXT,
    preco_venda_real     NUMERIC(15, 2),
    data_venda           DATE,
    fonte                TEXT,
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.anuncios (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inscricao            VARCHAR(20) NOT NULL,
    lote_id              VARCHAR(20) REFERENCES lotes(inscricao), -- FK Link (Inscrição Texto),
    titulo               TEXT NOT NULL,
    descricao            TEXT,
    url                  TEXT NOT NULL UNIQUE,
    source               VARCHAR(50), -- 'olx', 'zap', 'viva_real', 'serper', 'chaves_na_mao',
    preco                NUMERIC,
    area_anunciada       NUMERIC,
    quartos              INTEGER,
    suites               INTEGER,
    banheiros            INTEGER,
    vagas                INTEGER,
    endereco_anuncio     TEXT,
    match_score          INTEGER DEFAULT 0 CHECK (match_score >= 0 AND match_score <= 100),
    scraped_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active            BOOLEAN DEFAULT true,
    last_seen            TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.proprietario_relacionamentos (
    id                   BIGSERIAL PRIMARY KEY,
    proprietario_origem_id BIGINT REFERENCES proprietarios(id) ON DELETE CASCADE,
    proprietario_destino_id BIGINT REFERENCES proprietarios(id) ON DELETE CASCADE,
    tipo_vinculo         VARCHAR(100), -- 'Sócio', 'Sócio-Administrador', 'Mãe', 'Filho', etc.,
    metadata             JSONB DEFAULT '{}'::jsonb, -- % participação, data entrada, etc.,
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.app_settings (
    id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    key                  text UNIQUE NOT NULL,
    value                jsonb NOT NULL DEFAULT '{}',
    updated_at           timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_email           TEXT,
    action               TEXT NOT NULL,
    detail               TEXT,
    created_at           TIMESTAMPTZ DEFAULT now()
);

-- 3. VIEWS
CREATE OR REPLACE VIEW analytics_top_lots AS
SELECT 
    event_data->>'inscricao' as inscricao,
    event_data->>'zona' as zona,
    event_data->>'bairro' as bairro,
    COUNT(*) as view_count
FROM analytics_events
WHERE event_type = 'view_lot'
  AND event_data->>'inscricao' IS NOT NULL
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY event_data->>'inscricao', event_data->>'zona', event_data->>'bairro'
ORDER BY view_count DESC
LIMIT 50;

CREATE MATERIALIZED VIEW IF NOT EXISTS vw_bairros_centroids AS
SELECT 
    u.bairro_unidade AS nome,
    COUNT(DISTINCT l.inscricao) AS total_lotes,
    -- Centróide UTM
    AVG((l.minx + l.maxx) / 2) AS utm_x,
    AVG((l.miny + l.maxy) / 2) AS utm_y
FROM unidades u
JOIN lotes l ON u.lote_inscricao = l.inscricao
WHERE u.bairro_unidade IS NOT NULL 
  AND trim(u.bairro_unidade) != ''
  AND l.minx IS NOT NULL AND l.minx > 0
GROUP BY u.bairro_unidade
HAVING COUNT(DISTINCT l.inscricao) >= 5;

CREATE OR REPLACE VIEW analytics_top_owners AS
SELECT 
    event_data->>'query' as owner_name,
    COUNT(*) as search_count
FROM analytics_events
WHERE event_type = 'search'
  AND event_data->>'searchType' = 'owner'
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY event_data->>'query'
ORDER BY search_count DESC
LIMIT 50;

CREATE OR REPLACE VIEW analytics_stats_30d AS
SELECT 
    (SELECT COUNT(*) FROM analytics_events WHERE created_at >= NOW() - INTERVAL '30 days') as total_events,
    (SELECT COUNT(DISTINCT user_session) FROM analytics_events WHERE created_at >= NOW() - INTERVAL '30 days') as unique_sessions,
    (SELECT COUNT(*) FROM analytics_events WHERE event_type = 'search' AND created_at >= NOW() - INTERVAL '30 days') as total_searches,
    (SELECT COUNT(*) FROM analytics_events WHERE event_type = 'view_lot' AND created_at >= NOW() - INTERVAL '30 days') as total_lot_views,
    (SELECT COUNT(*) FROM analytics_events WHERE event_type = 'view_unit' AND created_at >= NOW() - INTERVAL '30 days') as total_unit_views,
    (SELECT COUNT(*) FROM crm_atividades WHERE created_at >= NOW() - INTERVAL '30 days') as total_crm_actions,
    (SELECT COUNT(*) FROM (SELECT id FROM user_unit_edits UNION ALL SELECT id FROM user_lote_edits) as all_edits) as total_edits,
    (SELECT COALESCE(COUNT(*)::float / NULLIF(COUNT(DISTINCT user_session), 0), 0) FROM analytics_events WHERE created_at >= NOW() - INTERVAL '30 days') as avg_events_per_session;

-- 4. RLS ENABLES
ALTER TABLE public.ai_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anuncios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anuncios_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bairros_ajustes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_atividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cupons_desconto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mercado_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_credit_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_plan_activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proprietario_relacionamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proprietarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referencias_geograficas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unidades_proprietarios_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unlocked_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_lote_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_unit_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitas ENABLE ROW LEVEL SECURITY;

-- 5. POLICIES
CREATE POLICY "Public Read Ajustes" ON bairros_ajustes FOR SELECT USING (true);

CREATE POLICY "Admin All Ajustes" ON bairros_ajustes FOR ALL USING (true);

CREATE POLICY "Public Read Lotes" ON lotes FOR SELECT USING (true);

CREATE POLICY "Public Read Unidades" ON unidades FOR SELECT USING (true);

CREATE POLICY "Public Read Proprietarios" ON proprietarios FOR SELECT USING (true);

CREATE POLICY "Public Read Relacionamentos" ON proprietario_relacionamentos FOR SELECT USING (true);

CREATE POLICY "Public Read Referencias" ON referencias_geograficas FOR SELECT USING (true);

CREATE POLICY "Public Insert Analytics" ON analytics_events FOR INSERT WITH CHECK (true);

CREATE POLICY "Admin All Lotes" ON lotes FOR ALL USING (true);

CREATE POLICY "Admin All Unidades" ON unidades FOR ALL USING (true);

CREATE POLICY "Admin All Proprietarios" ON proprietarios FOR ALL USING (true);

CREATE POLICY "Admin All Referencias" ON referencias_geograficas FOR ALL USING (true);

CREATE POLICY "Leitura Pública" ON public.notificacoes FOR SELECT TO public USING (true);

CREATE POLICY "Inserção Pública" ON public.notificacoes FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Update Público" ON public.notificacoes FOR UPDATE TO public USING (true);

CREATE POLICY "Storage Public Read" ON storage.objects FOR SELECT USING (bucket_id = 'lotes_images');

CREATE POLICY "Storage Pulic Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'lotes_images');

CREATE POLICY "Storage Docs Public Read" ON storage.objects FOR SELECT USING (bucket_id = 'unit_documents');

CREATE POLICY "Storage Docs Pulic Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'unit_documents');

CREATE POLICY "Certidoes Public Read" ON storage.objects FOR SELECT USING (bucket_id = 'certidoes_juridicas');

CREATE POLICY "Certidoes Authenticated Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'certidoes_juridicas');

CREATE POLICY "Public Read Anuncios" ON anuncios FOR SELECT USING (true);

CREATE POLICY "Public Insert Anuncios" ON anuncios FOR INSERT WITH CHECK (true);

CREATE POLICY "Public Update Anuncios" ON anuncios FOR UPDATE USING (true);

CREATE POLICY "Public Read Notifications" ON anuncios_notifications FOR SELECT USING (true);

CREATE POLICY "Public Insert Notifications" ON anuncios_notifications FOR INSERT WITH CHECK (true);

CREATE POLICY "Public Update Notifications" ON anuncios_notifications FOR UPDATE USING (true);

CREATE POLICY "Ver proprios unlocks" ON public.unlocked_lots
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Master ver todos unlocks" ON public.unlocked_lots
    FOR ALL USING (public.check_if_master());

CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Master can view and update all profiles" ON public.profiles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'master'
        )
    );

CREATE POLICY "Users can view their own transactions" ON credit_transactions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Master can view all transactions" ON credit_transactions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'master'
        )
    );

CREATE POLICY "Autenticados podem ler settings"
ON app_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Masters atualizam settings"
ON app_settings FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('master', 'admin')));

CREATE POLICY "Usuário vê e insere suas ativações"
ON pending_plan_activations FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Masters gerenciam ativações"
ON pending_plan_activations FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('master', 'admin')));

CREATE POLICY "Usuário vê e insere suas liberações"
ON pending_credit_releases FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Masters gerenciam créditos"
ON pending_credit_releases FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('master', 'admin')));

CREATE POLICY "Leads - Gerenciamento Pessoal" 
ON public.leads FOR ALL 
TO authenticated 
USING (user_id = auth.uid()) 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Leads - Visão Master" 
ON public.leads FOR SELECT 
TO authenticated 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('master', 'admin')));

CREATE POLICY "Visitas - Gerenciamento Pessoal" 
ON public.visitas FOR ALL 
TO authenticated 
USING (user_id = auth.uid()) 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Atividades - Gerenciamento Pessoal" 
ON public.crm_atividades FOR ALL 
TO authenticated 
USING (user_id = auth.uid()) 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Atividades - Visão Master" 
ON public.crm_atividades FOR SELECT 
TO authenticated 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('master', 'admin')));

CREATE POLICY "Apenas admin gerencia cupons" ON public.cupons_desconto FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('master', 'admin')));

CREATE POLICY "Apenas admin vê audit logs" ON public.audit_logs FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('master', 'admin')));

CREATE POLICY "Histórico - Visualização Pública" 
ON public.unidades_proprietarios_historico FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Histórico - Gestão Admin" 
ON public.unidades_proprietarios_historico FOR ALL 
TO authenticated 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('master', 'admin')));

CREATE POLICY "Edits - Ver e Criar" ON public.user_unit_edits FOR ALL TO authenticated USING (true);

CREATE POLICY "Edits - Admin Tudo" ON public.user_unit_edits FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('master', 'admin')));

CREATE POLICY "Histórico - Ver Geral" ON public.unidades_proprietarios_historico
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Lote Edits - Ver e Criar" ON public.user_lote_edits FOR ALL TO authenticated USING (true);

CREATE POLICY "Lote Edits - Admin Tudo" ON public.user_lote_edits FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('master', 'admin')));

-- 6. TRIGGERS
CREATE TRIGGER update_lotes_modtime BEFORE UPDATE ON lotes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_unidades_modtime BEFORE UPDATE ON unidades FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_proprietarios_modtime BEFORE UPDATE ON proprietarios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_modtime BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_update_nome_busca BEFORE INSERT OR UPDATE OF nome_completo ON proprietarios
    FOR EACH ROW EXECUTE FUNCTION update_nome_busca();

