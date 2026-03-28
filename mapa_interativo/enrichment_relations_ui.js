// ==========================================
// ENRICHMENT RELATIONS UI - ENRICHMENT_RELATIONS_UI.JS
// ==========================================
// Modal de confirmação de vínculos detectados pelo Datastone
// Chamado automaticamente após enriquecimento de CPF ou CNPJ

window.EnrichmentRelationsUI = {

    /**
     * Ponto de entrada principal.
     * Chamado após enriquecimento com os dados brutos da API Datastone.
     * @param {number} originId — ID do proprietário que foi enriquecido
     * @param {string} originName — Nome do proprietário principal
     * @param {object} enrichData — Payload completo retornado pela Datastone
     */
    async process(originId, originName, enrichData) {
        if (!originId || !enrichData) return;

        const persons = this._extractPersons(enrichData);
        if (persons.length === 0) {
            console.log('[RelationsUI] Nenhum familiar/sócio no payload.');
            return;
        }

        console.log(`[RelationsUI] ${persons.length} vínculos detectados para: ${originName}`);

        // 1. Para cada pessoa, determinar score de match com o banco
        const results = await Promise.all(
            persons.map(p => this._matchPersonInDB(p))
        );

        // 2. Separar os casos
        const autoLinked = results.filter(r => r.action === 'auto');   // CPF match — automático
        const toConfirm  = results.filter(r => r.action === 'confirm'); // Nome match único — pede confirmação
        const ambiguous  = results.filter(r => r.action === 'ambiguous'); // Nome com 2+ matches
        const toCreate   = results.filter(r => r.action === 'create');   // Não encontrado — criar rascunho

        // 3. Processar automáticos sem UI
        if (autoLinked.length > 0) {
            await this._saveLinks(originId, autoLinked);
            console.log(`[RelationsUI] ${autoLinked.length} vínculos criados automaticamente.`);
        }

        // 4. Criar rascunhos para os que não existem (sem UI)
        for (const item of toCreate) {
            const newId = await this._createDraftProprietario(item.person);
            if (newId) {
                item.resolvedId = newId;
                item.action = 'resolved_draft';
            }
        }
        await this._saveLinks(originId, toCreate.filter(i => i.action === 'resolved_draft'));

        // 5. Se há itens que precisam de confirmação, mostrar modal
        const needsUI = [...toConfirm, ...ambiguous];
        if (needsUI.length > 0) {
            this._showModal(originId, originName, needsUI);
        } else if (autoLinked.length > 0 || toCreate.length > 0) {
            const total = autoLinked.length + toCreate.length;
            window.Toast?.success(`🕸️ ${total} vinculo(s) relacionais salvos automaticamente.`);
        }
    },

    // -----------------------------------------------
    // EXTRAÇÃO DE PESSOAS DO PAYLOAD DATASTONE
    // -----------------------------------------------
    _extractPersons(data) {
        const persons = [];

        // Família (retorno CPF): relatives / family
        const relatives = data.relatives || data.family || [];
        relatives.forEach(r => {
            if (!r.name && !r.full_name) return;
            persons.push({
                name:         r.name || r.full_name,
                cpf:          r.cpf  || r.document || null,
                relationship: r.relationship || r.kinship || 'Familiar',
                source:       'family'
            });
        });

        // Sócios/Quadro societário (retorno CNPJ): partners / qsa
        const partners = data.partners || data.qsa || data.socios || [];
        partners.forEach(p => {
            if (!p.name && !p.nome) return;
            persons.push({
                name:         p.name || p.nome,
                cpf:          p.cpf  || p.document || null,
                relationship: p.role || p.qualificacao || 'Sócio',
                source:       'partner'
            });
        });

        return persons;
    },

    // -----------------------------------------------
    // MATCHING COM O BANCO
    // -----------------------------------------------
    async _matchPersonInDB(person) {
        const { name, cpf } = person;

        // --- Caso A: CPF disponível — busca direta ---
        if (cpf && cpf.replace(/\D/g,'').length >= 11) {
            const cleanCpf = cpf.replace(/\D/g,'');
            const { data } = await window.supabaseApp
                .from('proprietarios')
                .select('id, nome_completo, cpf_cnpj, total_propriedades')
                .eq('cpf_cnpj', cleanCpf)
                .maybeSingle();

            if (data) {
                return { person, action: 'auto', resolvedId: data.id, candidates: [data], confidence: 100 };
            }
            // CPF não encontrado — deve criar
            return { person, action: 'create', confidence: 0 };
        }

        // --- Caso B: Somente nome — busca por nome normalizado ---
        if (!name || name.length < 3) return { person, action: 'skip' };

        const { data: candidates } = await window.supabaseApp
            .from('proprietarios')
            .select('id, nome_completo, cpf_cnpj, total_propriedades, bairro_principal')
            .ilike('nome_completo', name.trim())
            .limit(5);

        if (!candidates || candidates.length === 0) {
            return { person, action: 'create', confidence: 0 };
        }
        if (candidates.length === 1) {
            return { person, action: 'confirm', resolvedId: candidates[0].id, candidates, confidence: 95 };
        }
        // Mais de um resultado — ambíguo
        return { person, action: 'ambiguous', candidates, confidence: 70 };
    },

    // -----------------------------------------------
    // SALVAR VÍNCULOS NO BANCO
    // -----------------------------------------------
    async _saveLinks(originId, items) {
        for (const item of items) {
            const destId = item.resolvedId;
            if (!destId || destId === originId) continue;

            await window.supabaseApp
                .from('proprietario_relacionamentos')
                .upsert({
                    proprietario_origem_id:  originId,
                    proprietario_destino_id: destId,
                    tipo_vinculo:            item.person.relationship,
                    metadata: {
                        source:     item.person.source,
                        origin:     'datastone_enrichment',
                        confidence: item.confidence,
                        linked_at:  new Date().toISOString()
                    }
                }, { onConflict: 'proprietario_origem_id,proprietario_destino_id,tipo_vinculo' });
        }
    },

    // -----------------------------------------------
    // CRIAR PERFIL RASCUNHO
    // -----------------------------------------------
    async _createDraftProprietario(person) {
        try {
            const tempDoc = `TEMP_DS_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
            const { data, error } = await window.supabaseApp
                .from('proprietarios')
                .insert({
                    nome_completo: person.name,
                    tipo: 'PF',
                    cpf_cnpj: tempDoc,
                    dados_enrichment: {
                        origem: 'familiar_datastone',
                        relationship: person.relationship,
                        source: person.source,
                        raw_cpf: person.cpf || null,
                        created_at: new Date().toISOString()
                    }
                })
                .select('id')
                .single();
            if (error) throw error;
            console.log(`[RelationsUI] Rascunho criado: ${person.name} → id ${data.id}`);
            return data.id;
        } catch (e) {
            console.error('[RelationsUI] Erro criando rascunho:', e);
            return null;
        }
    },

    // -----------------------------------------------
    // MODAL DE CONFIRMAÇÃO
    // -----------------------------------------------
    _showModal(originId, originName, items) {
        // Remove modal existente
        document.getElementById('relations-confirm-modal')?.remove();

        const overlay = document.createElement('div');
        overlay.id = 'relations-confirm-modal';
        overlay.style.cssText = `
            position:fixed; inset:0; z-index:100010;
            background:rgba(15,23,42,0.75);
            backdrop-filter:blur(6px);
            display:flex; align-items:center; justify-content:center;
            animation: fadeIn 0.25s ease;
        `;

        overlay.innerHTML = `
            <div style="
                background:#fff; border-radius:16px; width:95%; max-width:540px;
                max-height:85vh; display:flex; flex-direction:column;
                box-shadow:0 25px 60px rgba(0,0,0,0.3); overflow:hidden;
                font-family:'Inter', 'Segoe UI', sans-serif;
            ">
                <!-- Header -->
                <div style="
                    padding:18px 22px; background:linear-gradient(135deg,#1e3a8a,#2563eb);
                    color:white; display:flex; align-items:center; justify-content:space-between;
                ">
                    <div>
                        <div style="font-size:14px; font-weight:800; display:flex; align-items:center; gap:8px;">
                            🕸️ Vínculos Relacionais Detectados
                        </div>
                        <div style="font-size:11px; opacity:0.8; margin-top:2px;">
                            ${items.length} pessoa(s) precisam de confirmação — ${originName}
                        </div>
                    </div>
                    <button onclick="document.getElementById('relations-confirm-modal').remove()"
                        style="background:rgba(255,255,255,0.15); border:none; color:white;
                        width:30px; height:30px; border-radius:8px; font-size:18px;
                        cursor:pointer; display:flex; align-items:center; justify-content:center;">
                        ×
                    </button>
                </div>

                <!-- Body -->
                <div id="relations-modal-body" style="overflow-y:auto; padding:16px; flex:1; background:#f8fafc; display:flex; flex-direction:column; gap:12px;">
                    ${items.map((item, idx) => this._renderItemCard(item, idx)).join('')}
                </div>

                <!-- Footer -->
                <div style="padding:14px 20px; border-top:1px solid #e2e8f0; background:#fff;
                    display:flex; justify-content:flex-end; gap:10px;">
                    <button onclick="document.getElementById('relations-confirm-modal').remove()"
                        style="padding:8px 18px; background:#f1f5f9; border:1px solid #cbd5e1;
                        border-radius:8px; cursor:pointer; color:#475569; font-weight:600; font-size:13px;">
                        Fechar
                    </button>
                    <button id="btn-save-relations"
                        onclick="window.EnrichmentRelationsUI._saveFromModal(${JSON.stringify(originId).replace(/"/g, '&quot;')})"
                        style="padding:8px 20px; background:linear-gradient(135deg,#1e3a8a,#2563eb);
                        border:none; border-radius:8px; cursor:pointer; color:white; font-weight:700; font-size:13px;">
                        💾 Salvar Confirmações
                    </button>
                </div>
            </div>
        `;

        // Guarda os items no modal para acesso posterior
        overlay._pendingItems = items;
        overlay._originId = originId;

        document.body.appendChild(overlay);
    },

    _renderItemCard(item, idx) {
        const { person, candidates, confidence, action } = item;

        const confBadge = action === 'confirm'
            ? `<span style="background:#ecfdf5;color:#059669;border:1px solid #a7f3d0;border-radius:4px;padding:1px 7px;font-size:10px;font-weight:700;">95% MATCH</span>`
            : `<span style="background:#fffbeb;color:#d97706;border:1px solid #fde68a;border-radius:4px;padding:1px 7px;font-size:10px;font-weight:700;">⚠️ AMBÍGUO</span>`;

        const relIcon = person.source === 'family' ? '👨‍👩‍👧' : '🤝';

        let candidatesHtml = '';
        if (action === 'confirm' && candidates?.length > 0) {
            const c = candidates[0];
            candidatesHtml = `
                <label style="display:flex;align-items:center;gap:10px;padding:8px;border:1px solid #d1fae5;border-radius:8px;background:#f0fdf4;cursor:pointer;">
                    <input type="radio" name="rel_${idx}" value="${c.id}" data-idx="${idx}" style="accent-color:#059669;">
                    <div>
                        <div style="font-size:12px;font-weight:700;color:#065f46;">${c.nome_completo}</div>
                        <div style="font-size:10px;color:#6b7280;">${c.bairro_principal || ''} · ${c.total_propriedades || 0} imóvel(is)</div>
                    </div>
                </label>
                <label style="display:flex;align-items:center;gap:10px;padding:8px;border:1px solid #e2e8f0;border-radius:8px;cursor:pointer;">
                    <input type="radio" name="rel_${idx}" value="create" data-idx="${idx}" style="accent-color:#6366f1;">
                    <span style="font-size:12px;color:#6366f1;font-weight:600;">➕ Não é o mesmo — Criar novo perfil</span>
                </label>
            `;
        } else if (action === 'ambiguous' && candidates?.length > 0) {
            const radios = candidates.map(c => `
                <label style="display:flex;align-items:center;gap:10px;padding:8px;border:1px solid #e2e8f0;border-radius:8px;cursor:pointer;">
                    <input type="radio" name="rel_${idx}" value="${c.id}" data-idx="${idx}">
                    <div>
                        <div style="font-size:12px;font-weight:700;color:#1e293b;">${c.nome_completo}</div>
                        <div style="font-size:10px;color:#6b7280;">${c.bairro_principal || ''} · ${c.total_propriedades || 0} imóvel(is) · CPF: ${c.cpf_cnpj ? '✔' : '✖'}</div>
                    </div>
                </label>
            `).join('');
            candidatesHtml = `
                ${radios}
                <label style="display:flex;align-items:center;gap:10px;padding:8px;border:1px solid #e2e8f0;border-radius:8px;cursor:pointer;">
                    <input type="radio" name="rel_${idx}" value="create" data-idx="${idx}" style="accent-color:#6366f1;">
                    <span style="font-size:12px;color:#6366f1;font-weight:600;">➕ Nenhuma é a mesma — Criar novo perfil</span>
                </label>
            `;
        }

        return `
            <div style="background:white;border-radius:12px;border:1px solid #e2e8f0;padding:14px;box-shadow:0 1px 3px rgba(0,0,0,0.06);" data-item-idx="${idx}">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                    <div style="display:flex;align-items:center;gap:8px;">
                        <span style="font-size:18px;">${relIcon}</span>
                        <div>
                            <div style="font-size:13px;font-weight:800;color:#1e293b;">${person.name}</div>
                            <div style="font-size:11px;color:#64748b;">${person.relationship}</div>
                        </div>
                    </div>
                    ${confBadge}
                </div>
                <div style="display:flex;flex-direction:column;gap:6px;">
                    ${candidatesHtml}
                </div>
            </div>
        `;
    },

    // -----------------------------------------------
    // SALVAR CONFIRMAÇÕES DO MODAL
    // -----------------------------------------------
    async _saveFromModal(originId) {
        const overlay = document.getElementById('relations-confirm-modal');
        if (!overlay) return;

        const items = overlay._pendingItems || [];
        const btn   = document.getElementById('btn-save-relations');
        if (btn) { btn.disabled = true; btn.textContent = '⏳ Salvando...'; }

        let saved = 0;
        let created = 0;

        for (let idx = 0; idx < items.length; idx++) {
            const item = items[idx];
            const selected = document.querySelector(`input[name="rel_${idx}"]:checked`);
            if (!selected) continue; // usuário não escolheu — pula

            const value = selected.value;

            let destId = null;
            if (value === 'create') {
                destId = await this._createDraftProprietario(item.person);
                if (destId) created++;
            } else {
                destId = parseInt(value, 10);
            }

            if (destId) {
                await this._saveLinks(originId, [{ ...item, resolvedId: destId }]);
                saved++;
            }
        }

        overlay.remove();
        window.Toast?.success(`✅ ${saved} vínculo(s) confirmado(s)${created > 0 ? `, ${created} perfil(s) criado(s)` : ''}.`);
    }
};
