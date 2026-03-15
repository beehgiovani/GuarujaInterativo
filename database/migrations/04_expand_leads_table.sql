-- ============================================================================
-- MIGRATION: Expandir Tabela LEADS para Critérios de Match
-- Data: 2026-01-22
-- Objetivo: Adicionar campos estruturados para facilitar matching de propriedades
-- ============================================================================

-- Adicionar campos de critérios de busca estruturados
ALTER TABLE leads ADD COLUMN IF NOT EXISTS telefone VARCHAR(20);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS cpf_cnpj VARCHAR(20);

-- Critérios de Match
ALTER TABLE leads ADD COLUMN IF NOT EXISTS zonas_interesse TEXT[];
ALTER TABLE leads ADD COLUMN IF NOT EXISTS setores_interesse TEXT[];
ALTER TABLE leads ADD COLUMN IF NOT EXISTS tipo_imovel VARCHAR(50);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS quartos_min INTEGER;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS quartos_max INTEGER;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS metragem_min NUMERIC(10,2);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS metragem_max NUMERIC(10,2);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS valor_min NUMERIC(15,2);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS valor_max NUMERIC(15,2);

-- Campos adicionais
ALTER TABLE leads ADD COLUMN IF NOT EXISTS observacoes TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- Criar índices para otimizar buscas
CREATE INDEX IF NOT EXISTS idx_leads_nome ON leads(nome);
CREATE INDEX IF NOT EXISTS idx_leads_telefone ON leads(telefone);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_zonas ON leads USING GIN(zonas_interesse);
CREATE INDEX IF NOT EXISTS idx_leads_tipo_imovel ON leads(tipo_imovel);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_leads_timestamp ON leads;
CREATE TRIGGER trigger_update_leads_timestamp
    BEFORE UPDATE ON leads
    FOR EACH ROW
    EXECUTE FUNCTION update_leads_updated_at();

-- Comentário na tabela
COMMENT ON TABLE leads IS 'Tabela de leads/clientes CRM com critérios de match para propriedades';
COMMENT ON COLUMN leads.zonas_interesse IS 'Array de zonas de interesse do cliente (ex: [''1'', ''2''])';
COMMENT ON COLUMN leads.tipo_imovel IS 'Tipo preferido: Apartamento, Casa, Terreno, Loja, etc';
COMMENT ON COLUMN leads.preferencias IS '(LEGADO) Campo JSONB para critérios adicionais flexíveis';
