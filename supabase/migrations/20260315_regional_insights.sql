-- FUNÇÃO PARA RANKING DE INVESTIDORES POR ZONA
-- Esta função agrega unidades por proprietário dentro de uma zona específica.
-- Prioriza unidades com proprietários unificados (tabela proprietarios) e fallback para nome_proprietario na tabela unidades.

CREATE OR REPLACE FUNCTION public.get_top_investors_by_zone(
    p_zone TEXT,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    name TEXT,
    doc TEXT,
    count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH regional_units AS (
        SELECT 
            COALESCE(p.nome_completo, u.nome_proprietario) as investor_name,
            COALESCE(p.cpf_cnpj, u.cpf_cnpj) as investor_doc
        FROM public.unidades u
        LEFT JOIN public.proprietarios p ON u.proprietario_id = p.id
        WHERE u.inscricao LIKE p_zone || '%'
          AND (u.nome_proprietario IS NOT NULL OR p.nome_completo IS NOT NULL)
    )
    SELECT 
        investor_name,
        investor_doc,
        COUNT(*) as property_count
    FROM regional_units
    GROUP BY investor_name, investor_doc
    ORDER BY property_count DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentário para o usuário: Rode este SQL no editor de SQL do Supabase.
