-- 1. Função determinística para remover acentos (não depende da extensão unaccent)
CREATE OR REPLACE FUNCTION remove_accents_custom(text) RETURNS text AS $$
SELECT translate(
    $1, 
    'áàâãäåāăąÁÀÂÃÄÅĀĂĄéèêëēĕėęěÉÈÊËĒĔĖĘĚíìîïìĩīĭįıÍÌÎÏÌĨĪĬĮIóòôõöøōŏőÓÒÔÕÖØŌŎŐúùûüũūŭůűųÚÙÛÜŨŪŬŮŰŲçćĉċčÇĆĈĊČñńņňÑŃŅŇ', 
    'aaaaaaaaaaaaaaaaeeeeeeeeeeeeeeeeiiiiiiiiiiiiiiioooooooooooooooooouuuuuuuuuuuuuuuuuucccccCCCCCNNNN'
);
$$ LANGUAGE sql IMMUTABLE;

-- 2. Adicionar coluna de busca normalizada
ALTER TABLE proprietarios ADD COLUMN IF NOT EXISTS nome_busca TEXT;

-- 3. Trigger para manter atualizado
CREATE OR REPLACE FUNCTION update_nome_busca() RETURNS TRIGGER AS $$
BEGIN
    NEW.nome_busca := lower(remove_accents_custom(NEW.nome_completo));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_nome_busca ON proprietarios;
CREATE TRIGGER trg_update_nome_busca
    BEFORE INSERT OR UPDATE OF nome_completo ON proprietarios
    FOR EACH ROW
    EXECUTE FUNCTION update_nome_busca();

-- 4. Atualizar dados existentes (Backfill)
UPDATE proprietarios SET nome_busca = lower(remove_accents_custom(nome_completo)) WHERE nome_busca IS NULL;

-- 5. Índice para busca rápida (Like 'foo%')
CREATE INDEX IF NOT EXISTS idx_proprietarios_nome_busca ON proprietarios (nome_busca text_pattern_ops);
