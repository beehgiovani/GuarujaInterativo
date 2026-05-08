/**
 * Gestor de Proprietários (owner_handler.js)
 * Cuida da consolidação de dados, limpeza de CPFs e vínculos com unidades.
 */

window.OwnerHandler = {
    // Consolida o proprietário no banco de forma silenciosa
    checkAndConsolidate: async function(unit) {
        if (!unit.nome_proprietario || !unit.cpf_cnpj) return;

        try {
            const nomeLimpo = unit.nome_proprietario.trim().toUpperCase();
            const cpfLimpo = String(unit.cpf_cnpj).replace(/\D/g, '');

            if (cpfLimpo.length < 11) return;

            let ownerId = null;
            let ownerData = null;

            // 1. Garante que o proprietário existe (Upsert Silencioso)
            const tipo = cpfLimpo.length > 11 ? 'PJ' : 'PF';
            const { error: upsertError } = await window.supabaseApp
                .from('proprietarios')
                .upsert({
                    cpf_cnpj: cpfLimpo,
                    nome_completo: nomeLimpo,
                    tipo: tipo,
                    created_at: new Date().toISOString()
                }, { onConflict: 'cpf_cnpj', ignoreDuplicates: true });

            if (upsertError) console.error("Erro no Upsert de Proprietário:", upsertError);

            // 2. Busca o ID (novo ou existente)
            const { data: ownerRecord } = await window.supabaseApp
                .from('proprietarios')
                .select('id, dados_enrichment')
                .eq('cpf_cnpj', cpfLimpo)
                .maybeSingle();

            if (ownerRecord) {
                ownerId = ownerRecord.id;
                ownerData = ownerRecord.dados_enrichment;
            }

            // 3. Vincula à unidade se necessário
            if (ownerId && unit.proprietario_id !== ownerId) {
                const updates = { proprietario_id: ownerId };

                // Backfill Gratuito: se o dono tem dados ricos e a unidade não, a gente copia!
                if (ownerData && (!unit.dados_enrichment || Object.keys(unit.dados_enrichment).length === 0)) {
                    updates.dados_enrichment = ownerData;
                }

                await window.supabaseApp
                    .from('unidades')
                    .update(updates)
                    .eq('inscricao', unit.inscricao);
            }
        } catch (e) {
            console.error("Erro na consolidação de proprietário:", e);
        }
    }
};

// Atalho global
window.checkAndConsolidateOwner = (u) => window.OwnerHandler.checkAndConsolidate(u);
