-- ============================================================================
-- DATABASE SCHEMA V2 (EXAUSTIVO) - GUARUJÁ GEO
-- Versão Definitiva: 2026-01-30 (Atualizado)
-- 
-- ESTE ARQUIVO CONTÉM A DEFINIÇÃO COMPLETA DO BANCO DE DADOS.
-- INCLUI: Tabelas, Índices, Triggers, Views, Funções, RLS, Storage e Realtime.
-- ============================================================================

-- ============================================
-- 1. FUNÇÕES E EXTENSÕES
-- ============================================

-- Extensão UUID (necessária para ids)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- Função: Remover Acentos (Imutável para Índices)
CREATE OR REPLACE FUNCTION remove_accents_custom(text) RETURNS text AS $$
SELECT translate(
    $1, 
    'áàâãäåāăąÁÀÂÃÄÅĀĂĄéèêëēĕėęěÉÈÊËĒĔĖĘĚíìîïìĩīĭįıÍÌÎÏÌĨĪĬĮIóòôõöøōŏőÓÒÔÕÖØŌŎŐúùûüũūŭůűųÚÙÛÜŨŪŬŮŰŲçćĉċčÇĆĈĊČñńņňÑŃŅŇ', 
    'aaaaaaaaaaaaaaaaeeeeeeeeeeeeeeeeiiiiiiiiiiiiiiioooooooooooooooooouuuuuuuuuuuuuuuuuucccccCCCCCNNNN'
);
$$ LANGUAGE sql IMMUTABLE;

-- Função: Atualizar timestamp updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Função: Atualizar nome_busca (Proprietários)
CREATE OR REPLACE FUNCTION update_nome_busca() RETURNS TRIGGER AS $$
BEGIN
    NEW.nome_busca := lower(remove_accents_custom(NEW.nome_completo));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Função: Limpeza de Analytics Antigos
CREATE OR REPLACE FUNCTION cleanup_old_analytics()
RETURNS void AS $$
BEGIN
    DELETE FROM analytics_events
    WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 2. TABELAS CORE (IMOBILIÁRIO)
-- ============================================

-- 2.1 REFERÊNCIAS GEOGRÁFICAS (Desenhos)
-- Armazena desenhos manuais no mapa (Linhas, Polígonos, Pontos)
CREATE TABLE IF NOT EXISTS referencias_geograficas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('MAR', 'POI', 'OUTRO')),
    subtipo TEXT, 
    geometria JSONB NOT NULL, -- GeoJSON Feature
    cor TEXT DEFAULT '#3388ff',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.2 LOTES (Terrenos/Edifícios)
CREATE TABLE IF NOT EXISTS lotes (
    inscricao VARCHAR(20) PRIMARY KEY, -- Ex: 10074006
    
    -- Localização
    zona VARCHAR(10),
    setor VARCHAR(10),
    lote_geo VARCHAR(10),
    quadra VARCHAR(50),
    loteamento VARCHAR(100),
    bairro VARCHAR(100),
    endereco TEXT,
    
    -- Dados Fiscais/Dimensões
    valor_m2 NUMERIC(10, 2),
    minx FLOAT, miny FLOAT, maxx FLOAT, maxy FLOAT, -- UTM Bounds

    -- Dados do Edifício/Condomínio
    building_name TEXT,
    image_url TEXT,
    gallery TEXT[] DEFAULT '{}', -- URLs de imagens
    floors VARCHAR(20),
    build_year VARCHAR(10),
    manager_info TEXT, -- Síndico
    amenities TEXT,
    
    -- Amenidades (Flags Booleanas)
    piscina BOOLEAN DEFAULT FALSE,
    academia BOOLEAN DEFAULT FALSE,
    elevador BOOLEAN DEFAULT FALSE,
    portaria_24h BOOLEAN DEFAULT FALSE,
    churrasqueira BOOLEAN DEFAULT FALSE,
    salao_jogos BOOLEAN DEFAULT FALSE,
    servico_praia BOOLEAN DEFAULT FALSE,
    bicicletario BOOLEAN DEFAULT FALSE,
    acesso_pcd BOOLEAN DEFAULT FALSE, -- Acessibilidade
    salao_festas BOOLEAN DEFAULT FALSE,
    area_verde BOOLEAN DEFAULT FALSE,
    zeladoria BOOLEAN DEFAULT FALSE,
    
    -- Financeiro do Prédio
    valor_condominio TEXT, -- Ex: "1350-1600"

    zelador_nome TEXT,
    zelador_contato TEXT,
    obs TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2.3 PROPRIETÁRIOS (Entidade Central)
CREATE TABLE IF NOT EXISTS proprietarios (
    id BIGSERIAL PRIMARY KEY,
    cpf_cnpj VARCHAR(20) UNIQUE NOT NULL, -- Chave Natural Limpa
    nome_completo TEXT NOT NULL,
    tipo VARCHAR(10), -- 'PF' ou 'PJ'
    
    -- Dados de Busca
    nome_busca TEXT, -- lower(unaccent(nome))
    
    -- Enriquecimento (Campos Estruturados - Ficha Avançada)
    rg VARCHAR(20),
    data_nascimento DATE,
    idade INTEGER,
    genero VARCHAR(10),
    nome_mae TEXT,
    situacao_cadastral VARCHAR(50),
    pep BOOLEAN DEFAULT FALSE,
    aposentado BOOLEAN DEFAULT FALSE,
    possivelmente_falecido BOOLEAN DEFAULT FALSE,
    bolsa_familia BOOLEAN DEFAULT FALSE,
    ocupacao TEXT,
    renda_estimada VARCHAR(50),
    
    -- Dados Brutos
    dados_enrichment JSONB DEFAULT '{}'::jsonb,
    
    -- Metadados
    total_propriedades INTEGER DEFAULT 0,
    data_enriquecimento TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.4 RELACIONAMENTOS (Societários e Familiares)
CREATE TABLE IF NOT EXISTS proprietario_relacionamentos (
    id BIGSERIAL PRIMARY KEY,
    proprietario_origem_id BIGINT REFERENCES proprietarios(id) ON DELETE CASCADE,
    proprietario_destino_id BIGINT REFERENCES proprietarios(id) ON DELETE CASCADE,
    tipo_vinculo VARCHAR(100), -- 'Sócio', 'Sócio-Administrador', 'Mãe', 'Filho', etc.
    metadata JSONB DEFAULT '{}'::jsonb, -- % participação, data entrada, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(proprietario_origem_id, proprietario_destino_id, tipo_vinculo)
);

-- 2.4 UNIDADES (Vínculo Lote-Proprietário)
CREATE TABLE IF NOT EXISTS unidades (
    inscricao VARCHAR(20) PRIMARY KEY, -- Ex: 10074006001
    lote_inscricao VARCHAR(20) REFERENCES lotes(inscricao) ON DELETE CASCADE,
    
    -- Vínculo Principal
    proprietario_id BIGINT REFERENCES proprietarios(id) ON DELETE SET NULL,
    
    -- Cache/Legado (Pode divergir do proprietário unificado em casos raros)
    nome_proprietario TEXT,
    cpf_cnpj VARCHAR(20),
    contato_proprietario TEXT[] DEFAULT '{}', 
    
    -- Enriquecimento Local
    dados_enrichment JSONB DEFAULT '{}',
    last_enrichment_at TIMESTAMP WITH TIME ZONE,
    
    -- Características Físicas
    tipo VARCHAR(50), -- Apartamento, Casa, Garagem, Comercial
    logradouro TEXT,
    numero VARCHAR(20),
    complemento TEXT, -- Bloco/Apto
    bairro_unidade VARCHAR(100),
    cep VARCHAR(15),
    endereco_completo TEXT,
    
    metragem NUMERIC(10, 2),
    valor_venal NUMERIC(15, 2), -- Valor Fiscal
    valor_real NUMERIC(15, 2),  -- Valor de Mercado (Avaliação)
    valor_vendavel NUMERIC(15, 2), -- Valor de Venda (Pedida)
    valor_venal_edificado NUMERIC(15, 2),
    descricao_imovel TEXT,
    quartos INT,
    suites INT,
    banheiros INT,
    vagas INT,
    area_util NUMERIC(10, 2),
    area_total NUMERIC(10, 2),
    caracteristicas TEXT[] DEFAULT '{}',
    
    -- Dados de Venda (CRM)
    status_venda TEXT DEFAULT 'Disponível',
    valor NUMERIC(15, 2),
    cod_ref TEXT,
    link_url TEXT,
    imagens TEXT[] DEFAULT '{}',
    documentos JSONB DEFAULT '[]',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- ============================================
-- 3. CRM E DADOS DE MERCADO
-- ============================================

-- 3.1 LEADS
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    telefone VARCHAR(20),
    email TEXT,
    cpf_cnpj VARCHAR(20),
    status TEXT DEFAULT 'Frio',
    corretor_responsavel_id TEXT,
    preferencias JSONB DEFAULT '{}',
    zonas_interesse TEXT[],
    tipo_imovel VARCHAR(50),
    quartos_min INT,
    quartos_max INT,
    metragem_min NUMERIC,
    metragem_max NUMERIC,
    valor_min NUMERIC,
    valor_max NUMERIC,
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3.2 VISITAS (Histórico)
CREATE TABLE IF NOT EXISTS visitas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    unidade_inscricao VARCHAR(20) REFERENCES unidades(inscricao) ON DELETE SET NULL,
    data_visita TIMESTAMP WITH TIME ZONE,
    feedback_cliente TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3.3 MERCADO HISTÓRICO (Comparativos)
CREATE TABLE IF NOT EXISTS mercado_historico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bairro TEXT,
    tipologia TEXT,
    preco_venda_real NUMERIC(15, 2),
    data_venda DATE,
    fonte TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3.4 NOTIFICAÇÕES (Sistema e Certidões)
CREATE TABLE IF NOT EXISTS notificacoes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    titulo TEXT NOT NULL,
    mensagem TEXT,
    link_url TEXT, -- Link para o PDF no Storage
    tipo TEXT DEFAULT 'certidao', -- 'certidao', 'sistema', etc.
    lida BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================
-- 4. ANALYTICS
-- ============================================
CREATE TABLE IF NOT EXISTS analytics_events (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    event_type VARCHAR(50) NOT NULL, -- 'search', 'view_lot', 'view_unit'
    event_data JSONB DEFAULT '{}'::jsonb,
    user_session VARCHAR(100),
    ip_address VARCHAR(45),
    user_agent TEXT
);

-- VIEWS DE ANALYTICS
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

-- 4.1 VIEW DE BAIRROS (Consolidada)
-- Agregação por bairro baseado nos vínculos das unidades com lotes
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

CREATE INDEX IF NOT EXISTS idx_vw_bairros_nome ON vw_bairros_centroids(nome);

-- 4.2 CONFIGURAÇÃO DE BAIRROS (Manual Adjustments)
-- Permite override da posição e visibilidade dos labels dos bairros
CREATE TABLE IF NOT EXISTS bairros_ajustes (
    nome VARCHAR(100) PRIMARY KEY,
    visible BOOLEAN DEFAULT true,
    custom_utm_x FLOAT,
    custom_utm_y FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE POLICY "Public Read Ajustes" ON bairros_ajustes FOR SELECT USING (true);
CREATE POLICY "Admin All Ajustes" ON bairros_ajustes FOR ALL USING (true);
ALTER TABLE bairros_ajustes ENABLE ROW LEVEL SECURITY;


-- ============================================
-- 5. ÍNDICES E TRIGGERS
-- ============================================

-- Triggers de Updated_at
CREATE TRIGGER update_lotes_modtime BEFORE UPDATE ON lotes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_unidades_modtime BEFORE UPDATE ON unidades FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_proprietarios_modtime BEFORE UPDATE ON proprietarios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leads_modtime BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger de Nome de Busca (Sync)
CREATE TRIGGER trg_update_nome_busca BEFORE INSERT OR UPDATE OF nome_completo ON proprietarios
    FOR EACH ROW EXECUTE FUNCTION update_nome_busca();

-- Índices Lotes
CREATE INDEX IF NOT EXISTS idx_lotes_zona_setor ON lotes(zona, setor);
CREATE INDEX IF NOT EXISTS idx_lotes_search ON lotes USING GIN (to_tsvector('portuguese', COALESCE(endereco,'') || ' ' || COALESCE(building_name,'')));

-- Índices Unidades
CREATE INDEX IF NOT EXISTS idx_unidades_lote_fk ON unidades(lote_inscricao);
CREATE INDEX IF NOT EXISTS idx_unidades_proprietario_id ON unidades(proprietario_id);
CREATE INDEX IF NOT EXISTS idx_unidades_cpf ON unidades(cpf_cnpj);

-- Índices Proprietários
CREATE INDEX IF NOT EXISTS idx_proprietarios_cpf ON proprietarios(cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_proprietarios_nome_busca ON proprietarios (nome_busca text_pattern_ops); -- ILIKE rápido
CREATE INDEX IF NOT EXISTS idx_proprietarios_nome_fts ON proprietarios USING GIN (to_tsvector('portuguese', nome_completo));

-- Índices Analytics
CREATE INDEX IF NOT EXISTS idx_analytics_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics_events(created_at DESC);

-- ============================================
-- 6. SEGURANÇA (RLS)
-- ============================================
ALTER TABLE lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE unidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE proprietarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE proprietario_relacionamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE referencias_geograficas ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;

-- Políticas "Permissivas" (Ajustar para prod conforme necessidade de login)
CREATE POLICY "Public Read Lotes" ON lotes FOR SELECT USING (true);
CREATE POLICY "Public Read Unidades" ON unidades FOR SELECT USING (true);
CREATE POLICY "Public Read Proprietarios" ON proprietarios FOR SELECT USING (true);
CREATE POLICY "Public Read Relacionamentos" ON proprietario_relacionamentos FOR SELECT USING (true);
CREATE POLICY "Public Read Referencias" ON referencias_geograficas FOR SELECT USING (true);

-- Analytics (Escrita Aberta)
CREATE POLICY "Public Insert Analytics" ON analytics_events FOR INSERT WITH CHECK (true);

-- Edição (Restrita a Autenticados em teoria, aqui aberta para admin local)
CREATE POLICY "Admin All Lotes" ON lotes FOR ALL USING (true);
CREATE POLICY "Admin All Unidades" ON unidades FOR ALL USING (true);
CREATE POLICY "Admin All Proprietarios" ON proprietarios FOR ALL USING (true);
CREATE POLICY "Admin All Referencias" ON referencias_geograficas FOR ALL USING (true);

-- Notificações (Públicas para Monitor e Site)
DROP POLICY IF EXISTS "Leitura Pública" ON public.notificacoes;
CREATE POLICY "Leitura Pública" ON public.notificacoes FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Inserção Pública" ON public.notificacoes;
CREATE POLICY "Inserção Pública" ON public.notificacoes FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS "Update Público" ON public.notificacoes;
CREATE POLICY "Update Público" ON public.notificacoes FOR UPDATE TO public USING (true);

-- ============================================
-- 7. STORAGE E REALTIME
-- ============================================

-- Realtime
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;
ALTER PUBLICATION supabase_realtime ADD TABLE lotes, unidades, proprietarios, proprietario_relacionamentos, notificacoes;

-- Storage (Bucket de Imagens)
INSERT INTO storage.buckets (id, name, public) VALUES ('lotes_images', 'lotes_images', true) ON CONFLICT DO NOTHING;
CREATE POLICY "Storage Public Read" ON storage.objects FOR SELECT USING (bucket_id = 'lotes_images');
CREATE POLICY "Storage Pulic Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'lotes_images');

-- Storage (Bucket de Documentos de Imóveis)
INSERT INTO storage.buckets (id, name, public) VALUES ('unit_documents', 'unit_documents', true) ON CONFLICT DO NOTHING;
CREATE POLICY "Storage Docs Public Read" ON storage.objects FOR SELECT USING (bucket_id = 'unit_documents');
CREATE POLICY "Storage Docs Pulic Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'unit_documents');

-- Storage (Bucket de Certidões Jurídicas - NOVO)
INSERT INTO storage.buckets (id, name, public) VALUES ('certidoes_juridicas', 'certidoes_juridicas', true) ON CONFLICT DO NOTHING;
CREATE POLICY "Certidoes Public Read" ON storage.objects FOR SELECT USING (bucket_id = 'certidoes_juridicas');
CREATE POLICY "Certidoes Authenticated Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'certidoes_juridicas');
-- Nota: A "Authenticated" aqui inclui anon se não restringirmos, mas usamos Service Role na Edge Function.

-- ============================================
-- 2.5 ARQUIVOS E DOCUMENTOS (File System)
-- ============================================
CREATE TABLE IF NOT EXISTS unit_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_inscricao TEXT, -- Link lógico (sem FK rígida para flexibilidade)
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    folder TEXT DEFAULT 'root',
    type TEXT,
    size BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_unit_files_inscricao ON unit_files(unit_inscricao);
CREATE INDEX IF NOT EXISTS idx_unit_files_folder ON unit_files(folder);

-- ============================================
-- 8. ANÚNCIOS (Web Scraper Integration)
-- ============================================

-- 8.1 OFERTAS (Listings)
CREATE TABLE IF NOT EXISTS anuncios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lote_id VARCHAR(20) REFERENCES lotes(inscricao), -- FK Link (Inscrição Texto)
    
    -- Dados do Anúncio
    inscricao VARCHAR(20) NOT NULL,
    titulo TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    preco NUMERIC,
    match_score INTEGER DEFAULT 0 CHECK (match_score >= 0 AND match_score <= 100),
    
    -- Metadados Imóvel
    quartos INTEGER,
    suites INTEGER,
    banheiros INTEGER,
    vagas INTEGER,
    area_anunciada NUMERIC,
    endereco_anuncio TEXT,
    descricao TEXT,
    
    -- Controle e Origem
    source VARCHAR(50), -- 'olx', 'zap', 'viva_real', 'serper', 'chaves_na_mao'
    is_active BOOLEAN DEFAULT true,
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices Anúncios
CREATE INDEX IF NOT EXISTS idx_anuncios_lote_id ON anuncios(lote_id);
CREATE INDEX IF NOT EXISTS idx_anuncios_inscricao ON anuncios(inscricao) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_anuncios_url ON anuncios(url);
CREATE INDEX IF NOT EXISTS idx_anuncios_match ON anuncios(match_score DESC);
CREATE INDEX IF NOT EXISTS idx_anuncios_active ON anuncios(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_anuncios_perfect_match ON anuncios(match_score) WHERE match_score = 100 AND is_active = TRUE;

COMMENT ON TABLE anuncios IS 'Anúncios de imóveis capturados pelo scraper para prospecção';
COMMENT ON COLUMN anuncios.inscricao IS 'Código de inscrição da unidade (referência não-enforced)';
COMMENT ON COLUMN anuncios.lote_id IS 'Inscrição do lote ao qual pertence';
COMMENT ON COLUMN anuncios.match_score IS 'Percentual de confiança do match (0-100)';
COMMENT ON COLUMN anuncios.is_active IS 'Se FALSE, anúncio foi removido ou expirou';

-- 8.2 NOTIFICAÇÕES DE LEADS
CREATE TABLE IF NOT EXISTS anuncios_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    anuncio_id UUID REFERENCES anuncios(id) ON DELETE CASCADE,
    
    titulo TEXT,
    mensagem TEXT,
    tipo VARCHAR(50) DEFAULT '100_match',
    lido BOOLEAN DEFAULT false,
    link_action TEXT,
    
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS para Anúncios (Aberto para Scraper via Anon Key)
ALTER TABLE anuncios ENABLE ROW LEVEL SECURITY;
ALTER TABLE anuncios_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read Anuncios" ON anuncios FOR SELECT USING (true);
CREATE POLICY "Public Insert Anuncios" ON anuncios FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update Anuncios" ON anuncios FOR UPDATE USING (true);

CREATE POLICY "Public Read Notifications" ON anuncios_notifications FOR SELECT USING (true);
CREATE POLICY "Public Insert Notifications" ON anuncios_notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update Notifications" ON anuncios_notifications FOR UPDATE USING (true);

-- Realtime para leads quentes
ALTER PUBLICATION supabase_realtime ADD TABLE anuncios_notifications;

