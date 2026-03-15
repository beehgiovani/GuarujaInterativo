-- ============================================================================
-- GUARUJÁ GEO - ESQUEMA CONSOLIDADO ATUALIZADO
-- Data: 2026-03-14
-- Este arquivo unifica Lotes, Unidades, Proprietários, Perfis, Créditos e Anúncios.
-- ============================================================================

-- 1. EXTENSÕES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- 2. TABELA DE PERFIS (Monetização)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    email TEXT,
    role TEXT DEFAULT 'user', -- 'master', 'admin', 'user'
    credits INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- FUNÇÃO SEGURA PARA CHECK DE ROLE (Evita Erro 500 Recursivo)
CREATE OR REPLACE FUNCTION check_if_master()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'master'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- POLÍTICAS DE PERFIS
DROP POLICY IF EXISTS "Visualização Individual" ON public.profiles;
CREATE POLICY "Visualização Individual" ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Master Controle Total" ON public.profiles;
CREATE POLICY "Master Controle Total" ON public.profiles FOR ALL USING (check_if_master());

-- 3. TABELA DE PROPRIETÁRIOS (Entidade Central)
CREATE TABLE IF NOT EXISTS proprietarios (
    id BIGSERIAL PRIMARY KEY,
    cpf_cnpj VARCHAR(20) UNIQUE NOT NULL,
    nome_completo TEXT NOT NULL,
    tipo VARCHAR(10), -- 'PF' ou 'PJ'
    nome_busca TEXT,
    dados_enrichment JSONB DEFAULT '{}'::jsonb,
    total_propriedades INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE proprietarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Leitura Pública" ON proprietarios;
CREATE POLICY "Leitura Pública" ON proprietarios FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin Edição Proprietários" ON proprietarios;
CREATE POLICY "Admin Edição Proprietários" ON proprietarios FOR ALL USING (check_if_master());

-- 4. TABELA DE LOTES (Edifícios/Terrenos)
CREATE TABLE IF NOT EXISTS lotes (
    inscricao VARCHAR(20) PRIMARY KEY,
    building_name TEXT,
    bairro VARCHAR(100),
    endereco TEXT,
    quadra VARCHAR(50),
    lote_geo VARCHAR(10),
    zona VARCHAR(10),
    setor VARCHAR(10),
    valor_m2 NUMERIC(10, 2),
    minx FLOAT, miny FLOAT, maxx FLOAT, maxy FLOAT,
    image_url TEXT,
    gallery TEXT[] DEFAULT '{}',
    manager_info TEXT, -- Síndico
    amenities TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE lotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Leitura Pública Lotes" ON lotes;
CREATE POLICY "Leitura Pública Lotes" ON lotes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin Edição Lotes" ON lotes;
CREATE POLICY "Admin Edição Lotes" ON lotes FOR ALL USING (check_if_master());

-- 5. TABELA DE UNIDADES (Vínculo Lote-Proprietário)
CREATE TABLE IF NOT EXISTS unidades (
    inscricao VARCHAR(20) PRIMARY KEY,
    lote_inscricao VARCHAR(20) REFERENCES lotes(inscricao) ON DELETE CASCADE,
    proprietario_id BIGINT REFERENCES proprietarios(id) ON DELETE SET NULL,
    tipo VARCHAR(50),
    complemento TEXT,
    metragem NUMERIC(10, 2),
    valor_venal NUMERIC(15, 2),
    status_venda TEXT DEFAULT 'Disponível',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE unidades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Leitura Pública Unidades" ON unidades;
CREATE POLICY "Leitura Pública Unidades" ON unidades FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin Edição Unidades" ON unidades;
CREATE POLICY "Admin Edição Unidades" ON unidades FOR ALL USING (check_if_master());

-- 6. TABELA DE ANÚNCIOS (Scraper)
CREATE TABLE IF NOT EXISTS anuncios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inscricao TEXT NOT NULL,
    lote_id VARCHAR(20) REFERENCES lotes(inscricao),
    titulo TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    source TEXT NOT NULL,
    preco NUMERIC,
    match_score INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE anuncios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Leitura Pública Anuncios" ON anuncios;
CREATE POLICY "Leitura Pública Anuncios" ON anuncios FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin Edição Anuncios" ON anuncios;
CREATE POLICY "Admin Edição Anuncios" ON anuncios FOR ALL USING (check_if_master());

-- 7. TABELA DE LOGS DE AUDITORIA
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    user_email TEXT,
    action TEXT NOT NULL,
    detail TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Logs Visíveis por Admin" ON audit_logs;
CREATE POLICY "Logs Visíveis por Admin" ON audit_logs FOR SELECT USING (check_if_master());

DROP POLICY IF EXISTS "Usuário vê próprios logs" ON audit_logs;
CREATE POLICY "Usuário vê próprios logs" ON audit_logs FOR SELECT USING (auth.uid() = user_id);

-- 8. TRIGGER DE NOVO USUÁRIO
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
