// ==========================================
// RELATIONSHIP HANDLER - RELATIONSHIP_HANDLER.JS
// ==========================================
// Platinum Level: Connects owners based on shared data

window.RelationshipHandler = {
    /**
     * Finds connections for a given owner
     * @param {number} proprietarioId 
     * @returns {Promise<Array>} List of connected entities
     */
    getConnections: async function(proprietarioId) {
        // SECURITY GUARD: Elite feature (Influencer Network)
        if (window.Monetization && !window.Monetization.canAccess('regional_insights') && !window.Monetization.isEliteOrAbove()) {
            console.warn("Access denied to Relationship Network (Elite feature)");
            return [];
        }

        console.log("🕸️ Fetching relationship network for:", proprietarioId);
        
        try {
            // 1. Get base owner data to have the CPF/CNPJ
            const { data: prop, error: propErr } = await window.supabaseApp
                .from('proprietarios')
                .select('id, nome_completo, cpf_cnpj, dados_enrichment')
                .eq('id', proprietarioId)
                .single();

            if (propErr || !prop) return [];

            const connections = [];
            const docBase = prop.cpf_cnpj?.replace(/\D/g, '');
            
            // --- LOGIC A: Direct DB Relationships (Partners/Socios) ---
            const { data: directRels } = await window.supabaseApp
                .from('proprietario_relacionamentos')
                .select(`
                    *,
                    linked_prop:proprietarios!proprietario_destino_id (
                        id, nome_completo, cpf_cnpj, total_propriedades
                    )
                `)
                .eq('proprietario_origem_id', proprietarioId);
            
            if (directRels) {
                directRels.forEach(r => {
                    if (r.linked_prop) {
                        connections.push({
                            id: r.linked_prop.id,
                            nome: r.linked_prop.nome_completo,
                            doc: r.linked_prop.cpf_cnpj,
                            type: r.tipo_relacionamento || 'Sócios',
                            properties: r.linked_prop.total_propriedades || 0,
                            source: 'direct_db'
                        });
                    }
                });
            }

            // --- LOGIC B: Shared CNPJ Base (For Companies) ---
            if (docBase && docBase.length === 14) {
                const cnpjBase = docBase.substring(0, 8); // Matrix/Branch logic
                const { data: sharedCnpj } = await window.supabaseApp
                    .from('proprietarios')
                    .select('id, nome_completo, cpf_cnpj, total_propriedades')
                    .ilike('cpf_cnpj', `${cnpjBase}%`)
                    .neq('id', proprietarioId);
                
                if (sharedCnpj) {
                    sharedCnpj.forEach(p => {
                        connections.push({
                            id: p.id,
                            nome: p.nome_completo,
                            doc: p.cpf_cnpj,
                            type: 'Grupo Econômico (Mesmo CNPJ)',
                            properties: p.total_propriedades || 0,
                            source: 'cnpj_match'
                        });
                    });
                }
            }

            // --- LOGIC C: Shared Addresses (From Enrichment) ---
            const addresses = prop.dados_enrichment?.addresses || [];
            if (addresses.length > 0) {
                // This is a simplified example. In production, we'd query a view that indexes these addresses.
                // For now, let's look for exact name/doc matches in related_companies as a proxy.
                const relatedCos = prop.dados_enrichment?.related_companies || [];
                relatedCos.forEach(co => {
                    connections.push({
                        id: null, // Might not be in our DB yet
                        nome: co.company_name,
                        doc: co.cnpj,
                        type: 'Empresa Vinculada',
                        properties: '?',
                        source: 'enrichment_company'
                    });
                });
            }

            // Deduplicate by Doc/Name
            const seen = new Set();
            const finalConnections = connections.filter(c => {
                const key = c.doc || c.nome;
                if (!key || seen.has(key)) return false;
                seen.add(key);
                return true;
            });

            return finalConnections;

        } catch (e) {
            console.error("Error in getConnections:", e);
            return [];
        }
    },

    /**
     * Converts raw connection data into Nodes and Links for D3
     * @param {number} mainId 
     * @param {string} mainName
     * @param {Array} connections 
     */
    createGraphData: function(mainId, mainName, connections) {
        const nodes = [{ id: mainId, name: mainName, main: true }];
        const links = [];

        connections.forEach(c => {
            const nodeId = c.id || `temp_${c.doc || c.nome}`;
            nodes.push({
                id: nodeId,
                name: c.nome,
                main: false
            });
            links.push({
                source: mainId,
                target: nodeId,
                value: 2
            });
        });

        return { nodes, links };
    }
};
