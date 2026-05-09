// Relationship handler - relationship_handler.js
// Platinum Level: Connects owners based on shared data

window.RelationshipHandler = {
    _cleanDoc(value) {
        return value ? String(value).replace(/\D/g, '') : '';
    },

    _normalizeName(value) {
        return value ? String(value).trim().replace(/\s+/g, ' ') : '';
    },

    _extractEntityDoc(entity) {
        return this._cleanDoc(
            entity?.cpf_cnpj ||
            entity?.cnpj ||
            entity?.cpf ||
            entity?.document ||
            entity?.tax_id ||
            entity?.company_document ||
            entity?.cpf_cnpj_socio
        );
    },

    _extractEntityName(entity) {
        return this._normalizeName(
            entity?.nome ||
            entity?.name ||
            entity?.company_name ||
            entity?.razao_social ||
            entity?.nome_completo
        );
    },

    _formatUnitSuggestion(unit, matchType) {
        const lote = unit.lotes || {};
        const title = [
            lote.building_name || lote.endereco || 'Imóvel',
            unit.complemento || unit.tipo || ''
        ].filter(Boolean).join(' · ');

        return {
            inscricao: unit.inscricao,
            loteInscricao: unit.lote_inscricao,
            title,
            bairro: lote.bairro || '',
            setor: lote.setor || '',
            zona: lote.zona || '',
            matricula: unit.matricula || '',
            rip: unit.rip || '',
            confidence: matchType === 'doc' ? 'alta' : 'baixa',
            reason: matchType === 'doc'
                ? 'CPF/CNPJ coincide com uma unidade cadastrada.'
                : 'Nome semelhante encontrado em unidade cadastrada.'
        };
    },

    async findSuggestedPropertiesForEntity(entity, options = {}) {
        if (!window.supabaseApp) return [];

        const doc = this._extractEntityDoc(entity);
        const name = this._extractEntityName(entity);
        const suggestions = new Map();
        const selectFields = `
            inscricao,
            lote_inscricao,
            tipo,
            complemento,
            nome_proprietario,
            cpf_cnpj,
            matricula,
            rip,
            lotes (
                inscricao,
                building_name,
                bairro,
                zona,
                setor
            )
        `;

        if (doc && doc.length >= 11 && !String(entity?.cpf_cnpj_socio || '').includes('*')) {
            const { data, error } = await window.supabaseApp
                .from('unidades')
                .select(selectFields)
                .eq('cpf_cnpj', doc)
                .limit(options.limit || 5);

            if (!error && data) {
                data.forEach(unit => suggestions.set(unit.inscricao, this._formatUnitSuggestion(unit, 'doc')));
            }
        }

        if (name && name.length >= 5 && suggestions.size < (options.limit || 5)) {
            const { data, error } = await window.supabaseApp
                .from('unidades')
                .select(selectFields)
                .ilike('nome_proprietario', `%${name}%`)
                .limit(options.limit || 5);

            if (!error && data) {
                data.forEach(unit => {
                    if (!suggestions.has(unit.inscricao)) {
                        suggestions.set(unit.inscricao, this._formatUnitSuggestion(unit, 'name'));
                    }
                });
            }
        }

        return [...suggestions.values()].slice(0, options.limit || 5);
    },

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
                            type: r.tipo_relacionamento || r.tipo_vinculo || 'Sócios',
                            properties: r.linked_prop.total_propriedades || 0,
                            source: 'direct_db',
                            confidence: 'confirmado'
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
                            source: 'cnpj_match',
                            confidence: 'alta'
                        });
                    });
                }
            }

            // --- LOGIC C: Enrichment entities with suggestive property correlation ---
            const relatedCos = prop.dados_enrichment?.related_companies || [];
            const family = prop.dados_enrichment?.family_persons || [];
            const partners = prop.dados_enrichment?.partners || [];

            if (relatedCos.length > 0) {
                for (const co of relatedCos.slice(0, 10)) {
                    const suggestedProperties = await this.findSuggestedPropertiesForEntity(co, { limit: 4 });
                    connections.push({
                        id: null, // Might not be in our DB yet
                        nome: this._extractEntityName(co),
                        doc: this._extractEntityDoc(co),
                        type: 'Empresa Vinculada',
                        properties: suggestedProperties.length || '?',
                        source: 'enrichment_company',
                        confidence: suggestedProperties.some(item => item.confidence === 'alta') ? 'alta' : 'sugestivo',
                        suggestedProperties
                    });
                }
            }

            if (family.length > 0) {
                for (const person of family.slice(0, 12)) {
                    const suggestedProperties = await this.findSuggestedPropertiesForEntity(person, { limit: 4 });
                    connections.push({
                        id: null,
                        nome: this._extractEntityName(person),
                        doc: this._extractEntityDoc(person),
                        type: person.description || person.relationship || 'Familiar citado no enriquecimento',
                        properties: suggestedProperties.length || '?',
                        source: 'enrichment_family',
                        confidence: suggestedProperties.some(item => item.confidence === 'alta') ? 'alta' : 'sugestivo',
                        suggestedProperties
                    });
                }
            }

            if (partners.length > 0) {
                for (const partner of partners.slice(0, 12)) {
                    const suggestedProperties = await this.findSuggestedPropertiesForEntity(partner, { limit: 4 });
                    connections.push({
                        id: null,
                        nome: this._extractEntityName(partner),
                        doc: this._extractEntityDoc(partner),
                        type: partner.role || partner.description || 'Sócio relacionado',
                        properties: suggestedProperties.length || '?',
                        source: 'enrichment_partner',
                        confidence: suggestedProperties.some(item => item.confidence === 'alta') ? 'alta' : 'sugestivo',
                        suggestedProperties
                    });
                }
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
                main: false,
                type: c.type,
                confidence: c.confidence || 'sugestivo'
            });
            links.push({
                source: mainId,
                target: nodeId,
                value: 2
            });

            (c.suggestedProperties || []).forEach((property, index) => {
                const propertyNodeId = `prop_${property.inscricao || `${nodeId}_${index}`}`;
                nodes.push({
                    id: propertyNodeId,
                    name: property.title || property.inscricao,
                    main: false,
                    kind: 'property_suggestion',
                    confidence: property.confidence || 'baixa'
                });
                links.push({
                    source: nodeId,
                    target: propertyNodeId,
                    value: property.confidence === 'alta' ? 1.6 : 1,
                    suggested: true
                });
            });
        });

        return { nodes, links };
    }
};
