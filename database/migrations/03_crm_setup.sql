-- ============================================================================
-- MIGRATION: CRM & INTELLIGENCE SETUP
-- ============================================================================

-- 1. EXPANSÃO DA TABELA UNIDADES
-- Adicionar colunas de características físicas e multimídia
ALTER TABLE unidades ADD COLUMN IF NOT EXISTS quartos INT;
ALTER TABLE unidades ADD COLUMN IF NOT EXISTS suites INT;
ALTER TABLE unidades ADD COLUMN IF NOT EXISTS banheiros INT;
ALTER TABLE unidades ADD COLUMN IF NOT EXISTS vagas INT;
ALTER TABLE unidades ADD COLUMN IF NOT EXISTS area_util NUMERIC(10, 2);
ALTER TABLE unidades ADD COLUMN IF NOT EXISTS area_total NUMERIC(10, 2);
ALTER TABLE unidades ADD COLUMN IF NOT EXISTS caracteristicas TEXT[] DEFAULT '{}'; -- Ex: ['Varanda', 'Vista Mar']
ALTER TABLE unidades ADD COLUMN IF NOT EXISTS status_venda TEXT DEFAULT 'Disponível'; -- Ex: Disponível, Vendido
ALTER TABLE unidades ADD COLUMN IF NOT EXISTS imagens TEXT[] DEFAULT '{}'; -- Array de URLs de imagens
ALTER TABLE unidades ADD COLUMN IF NOT EXISTS documentos JSONB DEFAULT '[]'; -- Array de objetos {nome, url, data}

-- 2. TABELA DE LEADS (CLIENTES)
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    contato TEXT, -- Email ou Telefone
    status TEXT DEFAULT 'Frio', -- Frio, Morno, Quente
    corretor_responsavel_id TEXT, -- ID ou Nome do corretor
    preferencias JSONB DEFAULT '{}', -- { "bairros": [], "min_quartos": 2, "teto": 1000000 }
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. TABELA DE VISITAS (HISTÓRICO)
CREATE TABLE IF NOT EXISTS visitas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    unidade_inscricao VARCHAR(20) REFERENCES unidades(inscricao) ON DELETE SET NULL,
    data_visita TIMESTAMP WITH TIME ZONE,
    feedback_cliente TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. TABELA DE MERCADO HISTÓRICO (INTELIGÊNCIA)
CREATE TABLE IF NOT EXISTS mercado_historico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bairro TEXT,
    tipologia TEXT, -- Ex: 2 Quartos
    preco_venda_real NUMERIC(15, 2),
    data_venda DATE,
    fonte TEXT, -- Ex: "Interno", "ZAP", "OLX"
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 5. POLÍTICAS RLS (Segurança Básica)
-- Habilitar RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE mercado_historico ENABLE ROW LEVEL SECURITY;

-- Políticas Permissivas (Ajuste conforme necessidade de Auth)
CREATE POLICY "Leads - Publico" ON leads FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Visitas - Publico" ON visitas FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Mercado - Publico" ON mercado_historico FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
