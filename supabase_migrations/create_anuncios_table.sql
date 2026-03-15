-- Migration: Create Anuncios System for Prospecting Leads
-- Description: New tables to store scraped property listings as leads
-- Date: 2026-02-03

-- =====================================================
-- TABLE: anuncios
-- Purpose: Store scraped property listings as prospecting leads
-- =====================================================

CREATE TABLE IF NOT EXISTS anuncios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Relacionamento com unidades e lotes
  inscricao TEXT NOT NULL,
  lote_id UUID,
  
  -- Dados do Anúncio
  titulo TEXT NOT NULL,
  descricao TEXT,
  url TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL, -- 'serper', 'olx', 'zap', 'viva_real', etc
  
  -- Dados do Imóvel Anunciado
  preco NUMERIC,
  area_anunciada NUMERIC,
  quartos INTEGER,
  suites INTEGER,
  banheiros INTEGER,
  vagas INTEGER,
  
  -- Endereço conforme aparece no anúncio (pode diferir do oficial)
  endereco_anuncio TEXT,
  
  -- Match Score (0-100)
  match_score INTEGER NOT NULL,
  
  -- Metadata
  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CHECK (match_score >= 0 AND match_score <= 100),
  CHECK (source IN ('serper', 'olx', 'zap', 'viva_real', 'chaves_na_mao', 'outro'))
);

-- =====================================================
-- INDEXES for Performance
-- =====================================================

-- Buscar anúncios por inscrição (usado no tooltip)
CREATE INDEX IF NOT EXISTS idx_anuncios_inscricao 
  ON anuncios(inscricao) 
  WHERE is_active = TRUE;

-- Buscar anúncios por lote (tooltip do lote)
CREATE INDEX IF NOT EXISTS idx_anuncios_lote 
  ON anuncios(lote_id) 
  WHERE is_active = TRUE;

-- Filtrar apenas anúncios ativos
CREATE INDEX IF NOT EXISTS idx_anuncios_active 
  ON anuncios(is_active) 
  WHERE is_active = TRUE;

-- Buscar matches perfeitos (para notificações)
CREATE INDEX IF NOT EXISTS idx_anuncios_perfect_match 
  ON anuncios(match_score) 
  WHERE match_score = 100 AND is_active = TRUE;

-- Índice composto para ordenação por data
CREATE INDEX IF NOT EXISTS idx_anuncios_activity 
  ON anuncios(is_active, scraped_at DESC);

-- =====================================================
-- TABLE: anuncios_notifications
-- Purpose: Store notifications for important events (100% matches, etc)
-- =====================================================

CREATE TABLE IF NOT EXISTS anuncios_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  anuncio_id UUID REFERENCES anuncios(id) ON DELETE CASCADE,
  
  tipo TEXT NOT NULL, -- '100_match', 'price_drop', 'new_listing', etc
  mensagem TEXT NOT NULL,
  
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  lido BOOLEAN DEFAULT FALSE,
  
  -- Constraints
  CHECK (tipo IN ('100_match', 'price_drop', 'new_listing', 'back_on_market'))
);

-- Index para buscar notificações não lidas
CREATE INDEX IF NOT EXISTS idx_notif_unread 
  ON anuncios_notifications(lido, criado_em DESC) 
  WHERE lido = FALSE;

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE anuncios ENABLE ROW LEVEL SECURITY;
ALTER TABLE anuncios_notifications ENABLE ROW LEVEL SECURITY;

-- Política: Leitura pública para visualização no mapa
CREATE POLICY "Anúncios são públicos para leitura"
  ON anuncios FOR SELECT
  USING (true);

-- Política: Apenas service_role pode inserir/atualizar
CREATE POLICY "Apenas service role pode modificar anúncios"
  ON anuncios FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Política: Notificações públicas para leitura
CREATE POLICY "Notificações são públicas para leitura"
  ON anuncios_notifications FOR SELECT
  USING (true);

-- Política: Apenas service_role pode criar notificações
CREATE POLICY "Apenas service role pode criar notificações"
  ON anuncios_notifications FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- =====================================================
-- FOREIGN KEY (Opcional - se quiser enforce referência)
-- =====================================================

-- Descomentar se quiser que lote_id seja obrigatório e validado
-- ALTER TABLE anuncios 
--   ADD CONSTRAINT fk_anuncios_lote 
--   FOREIGN KEY (lote_id) REFERENCES lotes(id) ON DELETE SET NULL;

-- =====================================================
-- COMMENTS (Documentação)
-- =====================================================

COMMENT ON TABLE anuncios IS 'Anúncios de imóveis capturados pelo scraper para prospecção';
COMMENT ON COLUMN anuncios.inscricao IS 'Código de inscrição da unidade (referência não-enforced)';
COMMENT ON COLUMN anuncios.lote_id IS 'ID do lote ao qual pertence (opcional)';
COMMENT ON COLUMN anuncios.match_score IS 'Percentual de confiança do match (0-100)';
COMMENT ON COLUMN anuncios.is_active IS 'Se FALSE, anúncio foi removido ou expirou';

COMMENT ON TABLE anuncios_notifications IS 'Notificações de eventos importantes sobre anúncios';
COMMENT ON COLUMN anuncios_notifications.tipo IS 'Tipo da notificação (100_match, price_drop, etc)';

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration complete: anuncios system created successfully';
END $$;
