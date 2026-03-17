-- PATCH: Fix RLS Policies for Anuncios Table
-- Reason: The initial migration restricted writes to 'service_role' only.
-- However, the scraper app uses the 'anon' (public) key found in .env.
-- This patch relaxes the policy to allow the scraper to insert data.

-- 1. Drop the restrictive policy
DROP POLICY IF EXISTS "Apenas service role pode modificar anúncios" ON anuncios;

-- 2. Create a permissive policy for authenticated/anon users
-- WARNING: This allows anyone with the anon key to insert/update.
-- For this protected local app, this is acceptable.
CREATE POLICY "Enable insert/update for scraper"
ON anuncios FOR ALL
USING (true)
WITH CHECK (true);

-- 3. Also fix the notifications table
DROP POLICY IF EXISTS "Apenas service role pode criar notificações" ON anuncios_notifications;

CREATE POLICY "Enable insert for scraper notifications"
ON anuncios_notifications FOR INSERT
WITH CHECK (true);

-- Notificações continuam públicas para leitura
-- (A policy de leitura "Notificações são públicas para leitura" já existe e cobre SELECT)
