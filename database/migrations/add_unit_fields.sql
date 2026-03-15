-- Add Reference Code and Link columns to 'unidades' table
ALTER TABLE unidades ADD COLUMN IF NOT EXISTS cod_ref TEXT;
ALTER TABLE unidades ADD COLUMN IF NOT EXISTS link_url TEXT;

-- Verify if policies allow update (usually they do if authenticated/anon key has permissions)
-- If not, you might need to adjust RLS, but standard setup usually allows it.
