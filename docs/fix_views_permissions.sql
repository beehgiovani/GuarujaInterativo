-- =============================================================================
-- SCRIPT NÃO-DESTRUTIVO: PERMISSÕES E SECURITY INVOKER
-- =============================================================================
-- Este script altera as propriedades de segurança sem tocar na estrutura 
-- ou lógica interna (SELECT) das views existentes, preservando sua engenharia.

-- 1. Injetar a regra de Security Invoker (Executar como quem chama) nas views
ALTER VIEW public.v_lotes_tipados SET (security_invoker = true);
ALTER VIEW public.v_unidades_com_mascara SET (security_invoker = true);
ALTER VIEW public.v_unidades_inteligentes SET (security_invoker = true);

-- Caso você tenha aquela view antiga (o linter costuma reclamar dela), garantimos ela também
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'v_unidades_basicas' AND schemaname = 'public') THEN
        EXECUTE 'ALTER VIEW public.v_unidades_basicas SET (security_invoker = true)';
    END IF;
END
$$;

-- =============================================================================
-- 2. CORREÇÃO DOS GRANTS (Permissões de Leitura)
-- Substitui o comando falho de "ALL VIEWS" por liberações cirúrgicas
-- =============================================================================

-- Libera as Views pro usuário logado
GRANT SELECT ON public.v_lotes_tipados TO authenticated;
GRANT SELECT ON public.v_unidades_com_mascara TO authenticated;
GRANT SELECT ON public.v_unidades_inteligentes TO authenticated;

-- Libera as Views base pro usuário não logado (Visitante) - Essencial para o Mapa Base e Vitrine
GRANT SELECT ON public.v_lotes_tipados TO anon;
GRANT SELECT ON public.v_unidades_com_mascara TO anon;
GRANT SELECT ON public.v_unidades_inteligentes TO anon;

-- O Security Invoker exige que quem chama a view também tenha permissão na tabela raiz
-- Isso garante que as tabelas base respondam às consultas das views sem dar erro 400
GRANT SELECT ON public.lotes TO anon, authenticated;
GRANT SELECT ON public.unidades TO anon, authenticated;
GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT SELECT ON public.unlocked_persons TO anon, authenticated;
