-- Migration 16: Adicionar Campos Financeiros e Valor Venal
-- Data: 28/01/2026
-- Objetivo: Suportar avaliação de mercado e preço de venda (pedida)

-- 1. Adicionar colunas financeiras (se não existirem)
ALTER TABLE unidades ADD COLUMN IF NOT EXISTS valor_real NUMERIC(15,2); -- Valor de Mercado (Avaliação)
ALTER TABLE unidades ADD COLUMN IF NOT EXISTS valor_vendavel NUMERIC(15,2); -- Valor de Venda (Pedida/Anúncio)
ALTER TABLE unidades ADD COLUMN IF NOT EXISTS valor_venal NUMERIC(15,2); -- Garantir que existe (Fiscal)

-- 2. Comentários para documentação
COMMENT ON COLUMN unidades.valor_real IS 'Valor de Mercado estimado ou avaliado (R$)';
COMMENT ON COLUMN unidades.valor_vendavel IS 'Valor de Venda, Pedida ou Anúncio (R$)';
COMMENT ON COLUMN unidades.valor_venal IS 'Valor Venal oficial da Prefeitura (Referência Fiscal)';

-- 3. Atualizar função de timestamp (trigger já deve existir, mas garantindo atualização)
-- (Opcional, pois triggers padrão já cuidam do updated_at)
