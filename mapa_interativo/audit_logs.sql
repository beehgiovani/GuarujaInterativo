-- TABELA DE LOGS DE ATIVIDADE (AUDITORIA)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    user_email TEXT,
    action TEXT NOT NULL, -- 'search', 'unlock_data', 'generate_pdf', 'login'
    detail TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all logs" ON audit_logs 
    FOR SELECT TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Users can view own logs" ON audit_logs 
    FOR SELECT TO authenticated 
    USING (auth.uid() = user_id);
