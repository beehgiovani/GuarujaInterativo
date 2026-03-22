-- ==============================================================================
-- GUARUJÁ GEOMAP - UNIDADES TABLE ENHANCEMENT
-- Adds missing columns required for Auction Importing (Caixa Leilões).
-- Execute this script in your Supabase SQL Editor.
-- ==============================================================================

ALTER TABLE public.unidades 
ADD COLUMN IF NOT EXISTS matricula TEXT,
ADD COLUMN IF NOT EXISTS valor_venda NUMERIC(15, 2),
ADD COLUMN IF NOT EXISTS arquivos JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS observacoes TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add a trigger to update updated_at if not already present for this table
DROP TRIGGER IF EXISTS trg_unidades_updated_at ON public.unidades;
CREATE TRIGGER trg_unidades_updated_at
    BEFORE UPDATE ON public.unidades
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON COLUMN public.unidades.matricula IS 'O número da matrícula oficial do imóvel.';
COMMENT ON COLUMN public.unidades.valor_venda IS 'O preço de mercado ou valor de avaliação para venda/leilão.';
COMMENT ON COLUMN public.unidades.arquivos IS 'Lista de documentos, PDFs e imagens vinculadas à unidade.';
COMMENT ON COLUMN public.unidades.observacoes IS 'Campo livre para anotações administrativas e detalhes do leilão.';
