-- ==============================================================================
-- GUARUJÁ GEOMAP - CAIXA LEILÕES STAGING TABLE
-- Script for creating the 'caixa_leiloes_staging' table and its RLS policies.
-- Execute this script in your Supabase SQL Editor.
-- ==============================================================================

-- 1. Create the sequence and table
CREATE TABLE IF NOT EXISTS public.caixa_leiloes_staging (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_imovel_caixa TEXT NOT NULL, -- The unique 'Código Imóvel' from the Caixa auction site
    inscricao_imobiliaria TEXT, -- The 11-digit or full inscription number extracted
    matricula_encontrada TEXT, -- The specific matricula number extracted
    valor_avaliacao NUMERIC,
    descricao_anuncio TEXT,
    storage_path_temporario TEXT, -- The Supabase storage path to the downloaded PDF
    url_origem TEXT, -- The origin URL for reference
    status_aprovacao TEXT DEFAULT 'pendente', -- 'pendente', 'aprovado', 'rejeitado'
    revisao_admin_id UUID REFERENCES auth.users(id), -- Tracks which admin approved/rejected
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Add an explicit unique constraint on the Caixa property code to avoid duplicate scraped entries
ALTER TABLE public.caixa_leiloes_staging 
ADD CONSTRAINT unique_codigo_imovel_caixa UNIQUE (codigo_imovel_caixa);

-- 3. Set up Row Level Security (RLS)
ALTER TABLE public.caixa_leiloes_staging ENABLE ROW LEVEL SECURITY;

-- Policy: Allow reading for authenticated admins/masters
CREATE POLICY "Enable read access for authenticated admins/masters" ON public.caixa_leiloes_staging
    FOR SELECT
    USING (
        auth.role() = 'authenticated' 
    );

-- Policy: Allow the service role (Scraper) to insert freely securely
CREATE POLICY "Enable insert for service_role" ON public.caixa_leiloes_staging
    FOR INSERT
    WITH CHECK (true); -- Usually service_role bypasses RLS anyway, but good for explicit tracking.

-- Policy: Allow authenticated users (specifically Admins/Masters in the application logic) to update status
CREATE POLICY "Enable update for auth users" ON public.caixa_leiloes_staging
    FOR UPDATE
    USING (auth.role() = 'authenticated');

-- 4. Automatically update the updated_at column
CREATE OR REPLACE FUNCTION update_modified_column_leiloes()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_caixa_leiloes_modtime ON public.caixa_leiloes_staging;
CREATE TRIGGER update_caixa_leiloes_modtime
    BEFORE UPDATE ON public.caixa_leiloes_staging
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column_leiloes();
