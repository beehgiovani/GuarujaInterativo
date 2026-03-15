-- Migration 09: Criação da Tabela de Proprietários Unificados
-- Data: 26/01/2026
-- Objetivo: Unificar proprietários por CPF/CNPJ e preparar para enriquecimento de dados

-- 1. Criar Tabela Proprietários
CREATE TABLE IF NOT EXISTS proprietarios (
    id BIGSERIAL PRIMARY KEY,
    
    -- Identificação Única
    cpf_cnpj VARCHAR(20) UNIQUE NOT NULL,  -- Chave natural
    nome_completo TEXT NOT NULL,
    tipo VARCHAR(10), -- 'PF' ou 'PJ'
    
    -- Dados Completos (JSONB)
    dados_enrichment JSONB DEFAULT '{}'::jsonb,
    
    -- Campos Extraídos
    rg VARCHAR(20),
    data_nascimento DATE,
    idade INTEGER,
    genero VARCHAR(1),
    nome_mae TEXT,
    
    -- Situação
    situacao_cadastral VARCHAR(50),
    pep BOOLEAN DEFAULT false,
    aposentado BOOLEAN DEFAULT false,
    possivelmente_falecido BOOLEAN DEFAULT false,
    bolsa_familia BOOLEAN DEFAULT false,
    
    -- Profissional
    ocupacao TEXT,
    renda_estimada TEXT,
    
    -- Estatísticas
    total_propriedades INTEGER DEFAULT 0,
    
    -- Timestamps
    data_enriquecimento TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Índices de Performance
CREATE INDEX IF NOT EXISTS idx_proprietarios_cpf ON proprietarios(cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_proprietarios_tipo ON proprietarios(tipo);
CREATE INDEX IF NOT EXISTS idx_proprietarios_nome ON proprietarios USING GIN (
    to_tsvector('portuguese', nome_completo)
);

-- 3. Atualizar Tabela de Unidades (Relacionamento)
ALTER TABLE unidades ADD COLUMN IF NOT EXISTS proprietario_id BIGINT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_proprietario' AND table_name = 'unidades'
    ) THEN
        ALTER TABLE unidades ADD CONSTRAINT fk_proprietario 
            FOREIGN KEY(proprietario_id) 
            REFERENCES proprietarios(id) 
            ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_unidades_proprietario_id ON unidades(proprietario_id);

-- 4. Políticas de Segurança (RLS)
ALTER TABLE proprietarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Proprietários - Acesso Total" ON proprietarios;
CREATE POLICY "Proprietários - Acesso Total" ON proprietarios 
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 5. Comentários
COMMENT ON TABLE proprietarios IS 'Tabela unificada de proprietários (1 CPF = 1 registro)';
COMMENT ON COLUMN unidades.proprietario_id IS 'Link para cadastro único de proprietário (pode ser NULL)';
