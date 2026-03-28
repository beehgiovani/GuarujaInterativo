-- ============================================================================
-- MIGRATION: ADICIONAR CAMPOS DE PERFIL E TELEFONE/WHATSAPP
-- ============================================================================
-- Esta migração adiciona os campos necessários à tabela profiles e atualiza
-- o trigger de criação de usuário para capturar os novos metadados.

-- 1. Garantir que as colunas existam na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- 2. Atualizar a função handle_new_user para capturar metadados do Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone, role, status, credits)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    COALESCE(new.raw_user_meta_data->>'phone', ''),
    CASE WHEN new.email = 'brunogp.corretor@gmail.com' THEN 'master' ELSE 'user' END,
    'pending',
    3 -- Iniciando com 3 créditos de boas-vindas
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. (Opcional) Sincronizar dados existentes do Auth Metadata para o Profile
-- UPDATE public.profiles p
-- SET 
--   full_name = u.raw_user_meta_data->>'full_name',
--   phone = u.raw_user_meta_data->>'phone'
-- FROM auth.users u
-- WHERE p.id = u.id AND p.full_name IS NULL;
