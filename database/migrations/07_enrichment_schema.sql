-- ============================================================================
-- MIGRATION 07: ENRICHMENT SCHEMA (ENRICHMENT INTEGRATION) - FIXED
-- ============================================================================

-- 1. Garantir que a coluna contato_proprietario existe.
-- Se não existir, cria já como Array. Se existir (como text), o comando ignora.
ALTER TABLE unidades ADD COLUMN IF NOT EXISTS contato_proprietario TEXT[] DEFAULT '{}';

-- 2. Se a coluna já existia mas era TEXT, precisamos converter para ARRAY.
-- Este bloco verifica o tipo e converte se necessário.
DO $$
BEGIN
    -- Verifica se é do tipo 'text' (não array)
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'unidades' 
        AND column_name = 'contato_proprietario' 
        AND data_type = 'text'
    ) THEN
        -- Converte de TEXT para TEXT[]
        ALTER TABLE unidades
          ALTER COLUMN contato_proprietario TYPE TEXT[]
          USING CASE
            WHEN contato_proprietario IS NULL OR contato_proprietario = '' THEN '{}'
            ELSE ARRAY[contato_proprietario]
          END;
          
        -- Define o default para garantir integridade futura
        ALTER TABLE unidades ALTER COLUMN contato_proprietario SET DEFAULT '{}';
    END IF;
END $$;

-- 3. Adicionar coluna para armazenar dados brutos do enriquecimento
ALTER TABLE unidades ADD COLUMN IF NOT EXISTS dados_enrichment JSONB DEFAULT '{}';

-- 4. Adicionar data da última consulta
ALTER TABLE unidades ADD COLUMN IF NOT EXISTS last_enrichment_at TIMESTAMP WITH TIME ZONE;

-- 5. Comentários
COMMENT ON COLUMN unidades.contato_proprietario IS 'Array de telefones de contato. Ex: {"(13) 9999-9999", "(11) 9888-8888"}';
COMMENT ON COLUMN unidades.dados_enrichment IS 'Dados completos retornados pela API de Enriquecimento (emails, sócios, etc)';
