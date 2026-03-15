-- Create table for system notifications
CREATE TABLE IF NOT EXISTS public.notificacoes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    titulo TEXT NOT NULL,
    mensagem TEXT,
    link_url TEXT, -- URL to the PDF or resource
    tipo TEXT DEFAULT 'certidao', -- 'certidao', 'sistema', etc.
    lida BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Policies
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users
CREATE POLICY "Enable read access for authenticated users" ON public.notificacoes
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow update (mark as read) for authenticated users
CREATE POLICY "Enable update for authenticated users" ON public.notificacoes
    FOR UPDATE
    TO authenticated
    USING (true);

-- Allow insert via Service Role (Edge Functions) only? 
-- Or authenticated users too? For now, let's allow service role only implicitly (bypass RLS) 
-- but if we need insert from client app:
CREATE POLICY "Enable insert for authenticated users" ON public.notificacoes
    FOR INSERT
    TO authenticated
    WITH CHECK (true);
