-- ==========================================
-- FAROL PREDITIVO - SQL BACKEND
-- ==========================================
-- Otimização de busca por leads quentes

-- Função RPC para buscar oportunidades com prioridade preditiva
CREATE OR REPLACE FUNCTION get_predictive_opportunities(
    p_zone TEXT DEFAULT NULL,
    p_min_score INTEGER DEFAULT 70
)
RETURNS TABLE (
    proprietario_id BIGINT,
    nome_completo TEXT,
    cpf_cnpj TEXT,
    total_propriedades INTEGER,
    score INTEGER,
    top_reason TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH scored_owners AS (
        SELECT 
            p.id,
            p.nome_completo,
            p.cpf_cnpj,
            p.total_propriedades,
            (
                CASE WHEN p.possivelmente_falecido = true THEN 65 ELSE 0 END +
                CASE WHEN p.idade > 70 THEN 20 WHEN p.idade > 60 THEN 10 ELSE 0 END +
                CASE WHEN p.total_propriedades > 10 THEN 15 WHEN p.total_propriedades > 3 THEN 5 ELSE 0 END
            ) as calculated_score,
            (
                CASE 
                    WHEN p.possivelmente_falecido = true THEN 'FALECIMENTO'
                    WHEN p.idade > 70 THEN 'SENIOR'
                    WHEN p.total_propriedades > 10 THEN 'GRANDE_CARTEIRA'
                    ELSE 'NORMAL'
                END
            ) as primary_reason
        FROM proprietarios p
    )
    SELECT 
        so.id,
        so.nome_completo,
        so.cpf_cnpj,
        so.total_propriedades,
        so.calculated_score,
        so.primary_reason
    FROM scored_owners so
    WHERE so.calculated_score >= p_min_score
    ORDER BY so.calculated_score DESC
    LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentário para documentação do Supabase
COMMENT ON FUNCTION get_predictive_opportunities IS 'Retorna os proprietários com maior probabilidade de venda/inventário (Platinum)';
