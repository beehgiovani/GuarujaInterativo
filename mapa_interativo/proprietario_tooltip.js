// ==========================================
// PROPRIETARIO TOOLTIP - PROPRIETARIO_TOOLTIP.JS
// ==========================================
// Tooltip 360° do proprietário com TODAS as propriedades

// Helper global para toggle de texto de CPF (usado nos cards de sócios)
window.toggleCpfText = function (icon, fullCpf) {
    const container = icon.previousElementSibling;
    if (!container) return;

    if (!window.Monetization || !window.Monetization.isEliteOrAbove()) {
        window.Toast.warning("Acesso restrito. Somente para perfil Elite / Master.");
        if (window.Monetization && window.Monetization.showSubscriptionPlans) {
            window.Monetization.showSubscriptionPlans();
        }
        return;
    }

    // Se for ID temporário, não faz nada ou avisa
    if (fullCpf.startsWith('S_PJ_')) {
        window.Toast.info('CPF completo não disponível. Realize a consulta avançada.');
        return;
    }

    const current = container.innerText;
    // Se já tiver formatado (com pontos/traço) e contiver *, é mascarado

    // Lógica simples: Se tem * está oculto. Se não tem, está visível. 
    if (current.includes('*')) {
        // Mostrar Real
        container.innerText = window.formatDocument(fullCpf, true);
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        // Mascarar
        // Se quisermos mascarar manualmente: 
        // Mas window.formatDocument(..., true) pode já retornar formatado. 
        // Vamos forçar um mascaramento visual simples para testar.
        container.innerText = "***." + fullCpf.substr(3, 3) + "." + fullCpf.substr(6, 3) + "-**";
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
};

window.ProprietarioTooltip = {

    /**
     * Exibir tooltip completo do proprietário
     * @param {number} proprietarioId - ID do proprietário
     */
    async show(proprietarioId, x = 0, y = 0) {
        window.Loading.show('Carregando...', 'Buscando dados do proprietário');

        try {
            // 1. Buscar dados do proprietário
            const { data: prop, error: propError } = await window.supabaseApp
                .from('proprietarios')
                .select('*')
                .eq('id', proprietarioId)
                .single();

            if (propError || !prop) {
                console.error("Erro prop:", propError);
                window.Toast.error('Proprietário não encontrado');
                return;
            }

            // 2. Buscar unidades deste proprietário (Query separada para evitar erro 400 de relacionamento)
            const { data: unidades, error: unitError } = await window.supabaseApp
                .from('unidades')
                .select(`
                    inscricao,
                    lote_inscricao,
                    tipo,
                    complemento,
                    metragem,
                    valor_venal,
                    status_venda,
                    lotes (
                        inscricao,
                        building_name,
                        bairro,
                        zona,
                        setor
                    )
                `)
                .eq('proprietario_id', proprietarioId);

            if (unitError) console.warn("Erro buscando unidades:", unitError);

            // Juntar
            prop.unidades = unidades || [];

            // The original `if (error || !prop)` check used a variable `error` that is no longer defined.
            // The `propError` check above already handles the case where `prop` is not found.
            // So, this redundant check can be simplified or removed.
            // Keeping it as `if (!prop)` for safety, though `propError || !prop` already covers it.
            if (!prop) {
                window.Toast.error('Proprietário não encontrado');
                return;
            }

            // 3. Buscar Sócios/Relacionamentos (Vinculados no DB)
            const { data: rels, error: relError } = await window.supabaseApp
                .from('proprietario_relacionamentos')
                .select(`
                    *,
                    socio:proprietarios!proprietario_destino_id (
                        id,
                        nome_completo,
                        cpf_cnpj,
                        tipo,
                        total_propriedades,
                        dados_enrichment
                    )
                `)
                .eq('proprietario_origem_id', proprietarioId);

            if (!relError && rels) {
                prop.relacionamentos = rels;

                // Verificar se cada sócio tem imóveis (contagem rápida se total_propriedades não for confiável)
                // Opcional: fazer count na tabela unidades se necessário, mas total_propriedades deve ser mantido atualizado
            } else {
                prop.relacionamentos = [];
            }

            this.render(prop, x, y);

        } catch (e) {
            console.error('Erro ao carregar proprietário:', e);
            window.Toast.error('Erro ao carregar dados');
        } finally {
            window.Loading.hide();
        }
    },

    /**
     *Renderizar tooltip
     */
    render(prop, x, y) {
        if (window.currentTooltip) this.close();

        const tooltip = document.createElement('div');
        tooltip.className = 'proprietario-tooltip';
        tooltip.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            width: 90%; max-width: 900px; height: 80vh; background: white;
            border-radius: 16px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.3);
            z-index: 9999; overflow: hidden; display: flex; flex-direction: column;
        `;

        let html = this.renderHeader(prop);

        // TABS
        html += `
            <div class="tooltip-tabs" style="padding: 0 24px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; gap: 8px; flex-wrap: wrap;">
                <div class="tooltip-tab active" onclick="window.switchTooltipTab(this, 'prop-tab-geral')" style="padding: 12px 16px; font-size: 13px; font-weight: 700; color: #764ba2; cursor: pointer; border-bottom: 3px solid #764ba2;">📋 Geral</div>
                <div class="tooltip-tab" onclick="window.switchTooltipTab(this, 'prop-tab-imoveis')" style="padding: 12px 16px; font-size: 13px; font-weight: 700; color: #64748b; cursor: pointer;">🏠 Imóveis (${prop.unidades.length})</div>
                <!-- <div class="tooltip-tab" onclick="window.switchTooltipTab(this, 'prop-tab-juridico')" style="padding: 12px 16px; font-size: 13px; font-weight: 700; color: #64748b; cursor: pointer;">📂 Jurídico</div> -->
                <div class="tooltip-tab" onclick="window.switchTooltipTab(this, 'prop-tab-outras')" style="padding: 12px 16px; font-size: 13px; font-weight: 700; color: #64748b; cursor: pointer;">ℹ️ Outras Info</div>
                ${prop.tipo === 'PJ' ? `<div class="tooltip-tab" onclick="window.switchTooltipTab(this, 'prop-tab-socios')" style="padding: 12px 16px; font-size: 13px; font-weight: 700; color: #64748b; cursor: pointer;">👥 Sócios</div>` : ''}
            </div>
        `;

        html += '<div class="proprietario-body" style="padding: 24px; flex: 1; overflow-y: auto;">';

        // ABA: GERAL
        html += '<div id="prop-tab-geral" class="tab-content-pane active">';
        html += this.renderContatos(prop.dados_enrichment || {});
        html += this.renderEnderecos(prop.dados_enrichment || {});
        html += this.renderDadosAdicionais(prop);
        html += '</div>';

        // ABA: IMÓVEIS
        html += '<div id="prop-tab-imoveis" class="tab-content-pane" style="display:none;">';
        html += this.renderPropriedades(prop.unidades || []);
        html += '</div>';

        // ABA: JURÍDICO (Apenas Certidões) - DESATIVADA
        /*
        html += '<div id="prop-tab-juridico" class="tab-content-pane" style="display:none;">';
        html += this.renderCertidoes(prop);
        html += this.renderCertidoesHistorico(prop);
        html += '</div>';
        */

        // ABA: OUTRAS INFORMAÇÕES (Empresas + Família)
        html += '<div id="prop-tab-outras" class="tab-content-pane" style="display:none;">';
        html += this.renderEmpresas(prop.dados_enrichment || {});
        html += this.renderFamilia(prop.dados_enrichment || {});
        html += '</div>';

        // ABA: SÓCIOS (PJ)
        if (prop.tipo === 'PJ') {
            html += '<div id="prop-tab-socios" class="tab-content-pane" style="display:none;">';
            html += this.renderSocios(prop);
            html += '</div>';
        }

        html += '</div>';

        tooltip.innerHTML = html;
        document.body.appendChild(tooltip);
        window.currentTooltip = tooltip;

        const backdrop = document.createElement('div');
        backdrop.className = 'sidebar-backdrop active';
        backdrop.style.zIndex = '9998';
        backdrop.onclick = () => this.close();
        document.body.appendChild(backdrop);
        tooltip.backdrop = backdrop;

        this.setupHandlers(tooltip, prop);

        // Trigger Context Help
        if (window.Onboarding && window.Onboarding.checkAndShowContextHelp) {
            window.Onboarding.checkAndShowContextHelp('owner', '.proprietario-tooltip');
        }
    },

    renderHeader(prop) {
        const tipoPessoa = prop.tipo === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica';
        const icone = prop.tipo === 'PF' ? 'fa-user' : 'fa-building';

        return `
            <div class="proprietario-header" style="
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 24px;
                position: relative;
            ">
                <button onclick="window.ProprietarioTooltip.close()" style="
                    position: absolute;
                    top: 20px;
                    right: 20px;
                    background: rgba(255,255,255,0.2);
                    border: none;
                    color: white;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    cursor: pointer;
                    font-size: 18px;
                ">×</button>
                
                <div style="display: flex; align-items: center; gap: 20px; margin-bottom: 16px;">
                    <div style="width: 64px; height: 64px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px);">
                        <i class="fas ${icone}" style="font-size: 32px;"></i>
                    </div>
                    <div style="flex: 1;">
                        <div style="font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">${window.maskName(prop.nome_completo)}</div>
                        <div style="font-size: 14px; opacity: 0.9; margin-top: 6px; display: flex; align-items: center; gap: 12px;">
                            <span style="background: rgba(255,255,255,0.15); padding: 2px 8px; border-radius: 4px; font-weight: 600;">${tipoPessoa}</span>
                            <span>
                                CPF/CNPJ: 
                                <span class="doc-value" style="font-family: monospace; font-weight: 700;">${window.formatDocument(prop.cpf_cnpj, !window.Monetization.canAccess('advanced_ai'))}</span>
                                <i class="fas fa-eye" style="cursor: pointer; margin-left: 6px; opacity: 0.8;" 
                                   onclick="window.toggleCpfVisibility(this, '${prop.cpf_cnpj}')" title="Mostrar/Ocultar"></i>
                            </span>
                        </div>
                    </div>
                </div>
                
                <div style="display: flex; gap: 12px; align-items: center; background: rgba(0,0,0,0.1); padding: 12px 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);">
                    <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: rgba(255,255,255,0.6); margin-right: 8px;">Ações Premium</div>
                    
                    ${prop.tipo === 'PJ' ? `
                    <button onclick="${window.Monetization.canAccess('advanced_ai') ? `window.ProprietarioTooltip.consultarReceita('${prop.cpf_cnpj}', ${prop.id})` : `window.Monetization.showSubscriptionPlans()`}" 
                        style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); color: white; border-radius: 8px; padding: 8px 14px; cursor: pointer; font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 8px; transition: all 0.2s;"
                        onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">
                        <i class="fas ${window.Monetization.canAccess('advanced_ai') ? 'fa-globe' : 'fa-lock'}"></i> Receita Federal
                    </button>` : ''}

                    <button onclick="${window.Monetization.canAccess('marketing_tools') ? `window.Enrichment.enrichPerson('${prop.cpf_cnpj}')` : `window.Monetization.showSubscriptionPlans()`}" 
                        style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); color: white; border-radius: 8px; padding: 8px 14px; cursor: pointer; font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 8px; transition: all 0.2s;"
                        onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">
                        <i class="fas ${window.Monetization.canAccess('marketing_tools') ? 'fa-search-plus' : 'fa-lock'}"></i> Ficha Avançada
                    </button>
                    
                    <button onclick="${window.Monetization.canAccess('mapear_patrimonio') ? `window.viewPortfolio('${prop.cpf_cnpj}'); window.ProprietarioTooltip.close();` : `window.Monetization.showSubscriptionPlans()`}" 
                        style="background: #10b981; border: 1px solid #059669; color: white; border-radius: 8px; padding: 8px 14px; cursor: pointer; font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 8px; margin-left: auto; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3); transition: all 0.2s;"
                        onmouseover="this.style.background='#059669'; this.style.transform='translateY(-1px)';" onmouseout="this.style.background='#10b981'; this.style.transform='none';">
                        <i class="fas ${window.Monetization.canAccess('mapear_patrimonio') ? 'fa-map-marked-alt' : 'fa-lock'}"></i> Mapear Patrimônio
                    </button>
                </div>
            </div>
                
                <div style="display: flex; gap: 16px; font-size: 13px;">
                    ${prop.idade ? `<span>🎂 ${prop.idade} anos</span>` : ''}
                    ${prop.ocupacao ? `<span>💼 ${prop.ocupacao}</span>` : ''}
                    ${prop.renda_estimada ? `<span>💰 ${prop.renda_estimada}</span>` : ''}
                </div>
            </div>
        `;
    },

    renderPropriedades(unidades) {
        if (!unidades || unidades.length === 0) {
            return '';
        }

        let html = `
            <div class="section" style="margin-bottom: 24px;">
                <h3 style="
                    font-size: 16px;
                    font-weight: 700;
                    color: #1e293b;
                    margin-bottom: 16px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    border-bottom: 2px solid #e2e8f0;
                    padding-bottom: 8px;
                ">
                    <i class="fas fa-home" style="color: #667eea;"></i>
                    Propriedades (${unidades.length})
                </h3>
                <div style="display: grid; gap: 12px;">
        `;

        unidades.forEach(u => {
            const lote = u.lotes || {};
            const statusColor = {
                'Disponível': '#10b981',
                'Vendido': '#ef4444',
                'Reservado': '#f59e0b',
                'Captar': '#3b82f6'
            }[u.status_venda] || '#94a3b8';

            html += `
                <div class="prop-item" data-inscricao="${u.inscricao}" style="
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-left: 4px solid ${statusColor};
                    border-radius: 8px;
                    padding: 16px;
                    cursor: pointer;
                    transition: all 0.2s;
                " onmouseover="this.style.boxShadow='0 4px 6px -1px rgba(0,0,0,0.1)'" 
                   onmouseout="this.style.boxShadow='none'">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div style="flex: 1;">
                            <div style="font-weight: 700; color: #1e293b; font-size: 15px; margin-bottom: 4px;">
                                ${lote.building_name || lote.endereco || 'Imóvel'}
                            </div>
                            <div style="font-size: 12px; color: #64748b; margin-bottom: 8px;">
                                ${u.tipo || 'Residencial'} ${u.complemento || ''}${u.metragem ? ` • ${u.metragem}m²` : ''}
                            </div>
                            <div style="font-size: 11px; color: #94a3b8;">
                                📍 ${lote.bairro || '-'} • Zona ${lote.zona || '-'}
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 10px; color: ${statusColor}; font-weight: 600; margin-bottom: 4px;">
                                ${u.status_venda || 'N/A'}
                            </div>
                            ${u.valor_venal ? `<div style="font-size: 12px; color: #334155; font-weight: 600;">R$ ${(u.valor_venal).toLocaleString('pt-BR')}</div>` : ''}
                        </div>
                    </div>
                    <div style="margin-top: 8px; font-size: 10px; color: #94a3b8; font-family: monospace;">
                        ${u.inscricao}
                    </div>
                </div>
            `;
        });

        html += '</div></div>';
        return html;
    },

    renderContatos(dados) {
        const moveis = dados.mobile_phones || [];
        const fixos = dados.land_lines || [];
        const emails = dados.emails || [];

        if (moveis.length === 0 && fixos.length === 0 && emails.length === 0) {
            return '';
        }

        let html = `<div class="section" style="margin-bottom: 24px;">
            <h3 style="font-size: 16px; font-weight: 700; color: #1e293b; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">
                <i class="fas fa-phone" style="color: #667eea;"></i>
                Contatos
            </h3>`;

        // Telefones Móveis
        if (moveis.length > 0) {
            html += '<div style="margin-bottom: 12px;"><strong style="font-size: 13px; color: #64748b;">📱 Celulares:</strong><div style="margin-top: 8px; display: grid; gap: 6px;">';
            moveis.forEach(p => {
                const ddd = String(p.ddd).padStart(2, '0');
                const num = p.number;
                const formatted = `(${ddd}) ${num.substring(0, 5)}-${num.substring(5)}`;
                const hasWhatsApp = p.whatsapp_datetime ? '💬 WhatsApp' : '';
                html += `<div style="font-size: 13px; padding: 6px 12px; background: #f8fafc; border-radius: 6px; display: flex; justify-content: space-between;">
                    <span>${formatted}</span>
                    <span style="color: #10b981; font-size: 11px; font-weight: 600;">${hasWhatsApp}</span>
                </div>`;
            });
            html += '</div></div>';
        }

        // Telefones Fixos
        if (fixos.length > 0) {
            html += '<div style="margin-bottom: 12px;"><strong style="font-size: 13px; color: #64748b;">☎️ Fixos:</strong><div style="margin-top: 8px; display: grid; gap: 6px;">';
            fixos.forEach(p => {
                const ddd = String(p.ddd).padStart(2, '0');
                const num = p.number;
                const formatted = `(${ddd}) ${num.substring(0, 4)}-${num.substring(4)}`;
                html += `<div style="font-size: 13px; padding: 6px 12px; background: #f8fafc; border-radius: 6px;">${formatted}</div>`;
            });
            html += '</div></div>';
        }

        // Emails
        if (emails.length > 0) {
            html += '<div><strong style="font-size: 13px; color: #64748b;">📧 Emails:</strong><div style="margin-top: 8px; display: grid; gap: 6px;">';
            emails.forEach(e => {
                html += `<div style="font-size: 12px; padding: 6px 12px; background: #f8fafc; border-radius: 6px;">${e.email}</div>`;
            });
            html += '</div></div>';
        }

        html += '</div>';
        return html;
    },

    renderEnderecos(dados) {
        const enderecos = dados.addresses || [];
        if (enderecos.length === 0) return '';

        let html = `<div class="section" style="margin-bottom: 24px;">
            <h3 style="font-size: 16px; font-weight: 700; color: #1e293b; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">
                <i class="fas fa-map-marker-alt" style="color: #667eea;"></i>
                Endereços (${enderecos.length})
            </h3>
            <div style="display: grid; gap: 12px;">`;

        enderecos.forEach((end, i) => {
            html += `<div style="padding: 12px; background: #f8fafc; border-radius: 8px; border-left: 3px solid #667eea;">
                <div style="font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 4px;">
                    ${end.type || 'Rua'} ${end.street}, ${end.number}${end.complement ? ` ${end.complement}` : ''}
                </div>
                <div style="font-size: 12px; color: #64748b;">
                    ${end.neighborhood} - ${end.city}/${end.district}
                </div>
                ${end.postal_code ? `<div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">CEP: ${end.postal_code}</div>` : ''}
            </div>`;
        });

        html += '</div></div>';
        return html;
    },

    renderEmpresas(dados) {
        const empresas = dados.related_companies || [];
        if (empresas.length === 0) return '';

        let html = `<div class="section" style="margin-bottom: 24px;">
            <h3 style="font-size: 16px; font-weight: 700; color: #1e293b; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">
                <i class="fas fa-briefcase" style="color: #667eea;"></i>
                Empresas Relacionadas (${empresas.length})
            </h3>
            <div style="display: grid; gap: 10px;">`;

        empresas.forEach(emp => {
            const ativa = emp.registry_situation === 'ATIVA';
            const statusColor = ativa ? '#10b981' : '#94a3b8';

            html += `<div style="padding: 12px; background: white; border: 1px solid #e2e8f0; border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div style="flex: 1;">
                        <div style="font-size: 13px; font-weight: 700; color: #1e293b;">${emp.company_name}</div>
                        <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${emp.description || '-'}</div>
                    </div>
                    <div style="text-align: right;">
                        ${emp.ownership ? `<div style="font-size: 13px; font-weight: 700; color: #667eea;">${emp.ownership}%</div>` : ''}
                        <div style="font-size: 10px; color: ${statusColor}; font-weight: 600; margin-top: 2px;">${emp.registry_situation || 'N/A'}</div>
                    </div>
                </div>
            </div>`;
        });

        html += '</div></div>';
        return html;
    },

    renderFamilia(dados) {
        const familia = dados.family_persons || [];
        if (familia.length === 0) return '';

        let html = `<div class="section" style="margin-bottom: 24px;">
            <h3 style="font-size: 16px; font-weight: 700; color: #1e293b; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">
                <i class="fas fa-users" style="color: #667eea;"></i>
                Família (${familia.length})
            </h3>
            <div style="display: grid; gap: 8px;">`;

        familia.forEach(f => {
            html += `<div style="padding: 10px; background: #f8fafc; border-radius: 6px; display: flex; justify-content: space-between;">
                <span style="font-size: 13px; font-weight: 600; color: #334155;">${f.name}</span>
                <span style="font-size: 11px; color: #64748b;">${f.description || 'Familiar'}</span>
            </div>`;
        });

        html += '</div></div>';
        return html;
    },

    // ========================================
    // INFOSIMPLES - CONSULTAS JURÍDICAS
    // ========================================

    renderCertidoes(prop) {
        // Usar o handler Infosimples para renderizar o seletor
        if (window.Infosimples && window.Infosimples.renderSeletorCertidoes) {
            return window.Infosimples.renderSeletorCertidoes(prop);
        }

        return `
            <div style="padding: 20px; text-align: center; color: #64748b;">
                <i class="fas fa-exclamation-circle" style="font-size: 24px; margin-bottom: 12px;"></i>
                <p>Módulo Infosimples não carregado.</p>
            </div>
        `;
    },

    renderCertidoesHistorico(prop) {
        const documento = prop.cpf_cnpj?.replace(/\D/g, '') || '';
        const propId = prop.id;

        // Auto-load após o DOM ser atualizado
        setTimeout(() => this.loadCertidoesHistorico(propId, documento), 300);

        return `
            <div class="section" style="margin-top: 24px; margin-bottom: 24px;">
                <h3 style="
                    font-size: 16px;
                    font-weight: 700;
                    color: #1e293b;
                    margin-bottom: 16px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    border-bottom: 2px solid #e2e8f0;
                    padding-bottom: 8px;
                ">
                    <i class="fas fa-history" style="color: #667eea;"></i>
                    Certidões Salvas
                </h3>
                <div id="certidoes-historico-${prop.id}" style="display: grid; gap: 8px;">
                    <div style="text-align: center; padding: 20px; color: #94a3b8;">
                        <i class="fas fa-spinner fa-spin"></i> Carregando...
                    </div>
                </div>
            </div>
        `;
    },


    async loadCertidoesHistorico(proprietarioId, documento) {
        const container = document.getElementById(`certidoes-historico-${proprietarioId}`);
        if (!container) return;

        try {
            // Buscar arquivos salvos no bucket certidoes_juridicas
            const { data: files, error } = await window.supabaseApp
                .storage
                .from('certidoes_juridicas')
                .list(`${documento}/`, { limit: 50, sortBy: { column: 'created_at', order: 'desc' } });

            if (error) {
                console.warn('Erro ao carregar certidões:', error);
                container.innerHTML = `
                    <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 13px;">
                        <i class="fas fa-folder-open" style="font-size: 24px; margin-bottom: 8px;"></i>
                        <p>Nenhuma certidão salva ainda.</p>
                        <p style="font-size: 11px; opacity: 0.8;">Solicite certidões acima para salvá-las aqui.</p>
                    </div>
                `;
                return;
            }

            if (!files || files.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 13px;">
                        <i class="fas fa-folder-open" style="font-size: 24px; margin-bottom: 8px;"></i>
                        <p>Nenhuma certidão salva ainda.</p>
                        <p style="font-size: 11px; opacity: 0.8;">Solicite certidões acima para salvá-las aqui.</p>
                    </div>
                `;
                return;
            }

            // Agrupar arquivos por certidão (baseado no prefixo do nome)
            // Ex: tjsp-segundo-grau_2024-01-30.pdf e .html
            const groups = {};

            files.forEach(file => {
                if (file.name === '.emptyFolderPlaceholder') return;

                // Tentar identificar o tipo da certidão
                // Estratégia: O nome começa com o ID da certidão?
                // IDs: trf-unificada, tjsp-primeiro-grau, etc.

                let certId = 'unknown';
                let dateStr = '';

                // Iterar sobre configs para ver qual ID casa com o prefixo
                const knownIds = Object.keys(window.Infosimples?.getCertidoesConfig() || {});

                // Ordenar IDs por tamanho (decrescente) para evitar falso positivo em substring
                knownIds.sort((a, b) => b.length - a.length);

                for (const id of knownIds) {
                    if (file.name.startsWith(id)) {
                        certId = id;
                        // O resto é data/hora
                        dateStr = file.name.replace(id, '').replace(/^[_-]/, '').replace(/\.(pdf|html)$/, '');
                        break;
                    }
                }

                // ALIAS / CORREÇÕES DE NOMES
                // O bot de email salva como "Certidao_Unificada.pdf", mas o ID é "trf-unificada"
                if (file.name.includes('Certidao_Unificada') || file.name.includes('Certidão_Unificada')) {
                    certId = 'trf-unificada';
                }

                // Se não achou pelo ID, usa a lógica antiga de split
                if (certId === 'unknown') {
                    const parts = file.name.split('_');
                    certId = parts[0];
                    dateStr = parts.slice(1).join('_').replace(/\.(pdf|html)$/, '');
                }

                if (!groups[certId]) {
                    groups[certId] = { pdf: null, html: null, latest: null };
                }

                const isHtml = file.name.toLowerCase().endsWith('.html') || file.metadata?.mimetype === 'text/html';

                // Guardar referência
                if (isHtml) groups[certId].html = file;
                else groups[certId].pdf = file;

                // Track latest file per cert type regardless of extension
                if (!groups[certId].latest || new Date(file.created_at) > new Date(groups[certId].latest.created_at)) {
                    groups[certId].latest = file;
                }
            });

            // Renderizar lista filtrada
            let html = '';

            Object.keys(groups).forEach(certId => {
                const group = groups[certId];

                // Prioridade: PDF > HTML
                // Se tiver PDF, mostra o PDF (Sucesso).
                // Se só tiver HTML, mostra como "Aguardando" ou "Visualizar Online".

                const fileToUse = group.pdf || group.html;
                if (!fileToUse) return;

                // Buscar config da certidão
                const certConfig = window.Infosimples?.getCertidoesConfig()[certId] || {
                    nome: certId.replace(/-/g, ' ').toUpperCase(),
                    icone: 'fa-file-pdf',
                    cor: '#64748b'
                };

                // Gerar URL pública
                const { data: urlData } = window.supabaseApp
                    .storage
                    .from('certidoes_juridicas')
                    .getPublicUrl(`${documento}/${fileToUse.name}`);

                const publicUrl = urlData?.publicUrl || '#';

                // Formatar data
                let dataFormatada = '';
                if (fileToUse.created_at) {
                    dataFormatada = new Date(fileToUse.created_at).toLocaleDateString('pt-BR', {
                        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    });
                }

                const isHtml = group.pdf ? false : true;

                // Lógica de Status Baseada no Tipo e Extensão
                let statusColor = group.pdf ? '#10b981' : '#3b82f6'; // Verde (PDF) ou Azul (Web)
                let statusBadge = '';
                let btnIcon = group.pdf ? 'fa-download' : 'fa-globe';
                let btnText = group.pdf ? 'Baixar PDF' : 'Visualizar Web';

                // Exceções e Ajustes Específicos
                if (!group.pdf && isHtml) {
                    // CENPROT e TRT2 geralmente retornam HTML válido (Nada Consta)
                    if (certId.includes('cenprot') || certId.includes('trt2') || certId.includes('tjsp')) {
                        statusColor = '#3b82f6'; // Azul (Info)
                        statusBadge = '';
                    }
                    // TRF Unificada pode ser "Aguardando" ou "Resultados Web"
                    else if (certId.includes('trf')) {
                        statusColor = '#f59e0b'; // Amarelo
                        btnIcon = 'fa-external-link-alt';
                        btnText = 'Ver Status';
                        statusBadge = '<span style="font-size: 10px; background: #fffbeb; color: #b45309; padding: 2px 6px; border-radius: 4px; border: 1px solid #fcd34d;">Ver Status</span>';
                    }
                    else {
                        statusColor = '#64748b'; // Cinza
                    }
                }
                let clickAction = `window.Infosimples.verComprovante('${publicUrl}', ${isHtml})`;

                html += `
                    <div style="    
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        padding: 12px;
                        background: white;
                        border: 1px solid #e2e8f0;
                        border-left: 4px solid ${certConfig.cor || '#667eea'};
                        border-radius: 8px;
                        margin-bottom: 8px;
                    ">
                        <i class="fas ${certConfig.icone || 'fa-file-pdf'}" style="
                            font-size: 20px;
                            color: ${certConfig.cor || '#667eea'};
                            width: 28px;
                            text-align: center;
                        "></i>
                        <div style="flex: 1;">
                            <div style="font-size: 13px; font-weight: 600; color: #1e293b; display: flex; align-items: center; gap: 8px;">
                                ${certConfig.nome || fileToUse.name}
                                ${statusBadge}
                            </div>
                            <div style="font-size: 11px; color: #64748b;">
                                ${dataFormatada || 'Data não disponível'}
                            </div>
                        </div>
                        <button onclick="${clickAction}" style="
                            background: linear-gradient(135deg, ${group.pdf ? '#667eea 0%, #764ba2' : (statusColor === '#f59e0b' ? '#f59e0b 0%, #d97706' : '#3b82f6 0%, #2563eb')} 100%);
                            color: white;
                            padding: 8px 14px;
                            border: none;
                            border-radius: 6px;
                            font-size: 12px;
                            font-weight: 600;
                            text-decoration: none;
                            display: flex;
                            align-items: center;
                            gap: 6px;
                            cursor: pointer;
                        ">
                            <i class="fas ${btnIcon}"></i> ${btnText}
                        </button>
                    </div>
                `;
            });

            container.innerHTML = html || `
                <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 13px;">
                    <i class="fas fa-folder-open" style="font-size: 24px; margin-bottom: 8px;"></i>
                    <p>Nenhuma certidão salva.</p>
                </div>
            `;

        } catch (e) {
            console.error('Erro ao carregar histórico de certidões:', e);
            container.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #ef4444;">
                    <i class="fas fa-exclamation-circle"></i> Erro ao carregar
                </div>
            `;
        }
    },

    renderDadosAdicionais(prop) {
        let html = `<div class="section" style="background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px dashed #cbd5e1;">
            <h4 style="font-size: 13px; font-weight: 700; color: #64748b; margin-bottom: 12px; text-transform: uppercase;">ℹ️ Dados Adicionais</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px;">`;

        if (prop.rg) html += `<div><strong>RG:</strong> ${prop.rg}</div>`;
        if (prop.data_nascimento) html += `<div><strong>Nascimento:</strong> ${new Date(prop.data_nascimento).toLocaleDateString('pt-BR')}</div>`;
        if (prop.genero) html += `<div><strong>Gênero:</strong> ${prop.genero === 'M' ? 'Masculino' : 'Feminino'}</div>`;
        if (prop.nome_mae) html += `<div><strong>Mãe:</strong> ${prop.nome_mae}</div>`;
        if (prop.situacao_cadastral) html += `<div><strong>Situação:</strong> ${prop.situacao_cadastral}</div>`;
        if (prop.data_enriquecimento) html += `<div><strong>Última consulta:</strong> ${new Date(prop.data_enriquecimento).toLocaleDateString('pt-BR')}</div>`;

        html += '</div></div > ';
        return html;
    },


    setupHandlers(tooltip, prop) {
        // Click nas propriedades para navegar
        tooltip.querySelectorAll('.prop-item').forEach(item => {
            item.addEventListener('click', async () => {
                const inscricao = item.dataset.inscricao;
                this.close();

                // Navegar para o lote usando o motor central (Hierárquico: Zona -> Setor -> Lote)
                const unidade = (prop.unidades || []).find(u => u.inscricao === inscricao);
                if (unidade && unidade.lote_inscricao) {
                    window.navigateToInscricao(unidade.lote_inscricao, unidade.inscricao);
                }
            });
        });
    },

    renderSocios(prop) {
        const publicData = prop.dados_publicos || (prop.dados_enrichment ? prop.dados_enrichment.raw_public_data : null);
        const rawSocios = publicData ? publicData.socios : [];
        const dbRels = prop.relacionamentos || [];

        if ((!rawSocios || rawSocios.length === 0) && dbRels.length === 0) {
            return `
                <div style="text-align: center; padding: 40px; color: #64748b;">
                    <i class="fas fa-users" style="font-size: 32px; margin-bottom: 16px; opacity: 0.5;"></i>
                    <p>Nenhum sócio listado.</p>
                    <p style="font-size: 12px; margin-top: 8px;">Clique em "Consultar Receita" no topo para buscar dados atualizados.</p>
                </div>
            `;
        }

        let html = `<div class="section">
            <h3 style="font-size: 16px; font-weight: 700; color: #1e293b; margin-bottom: 16px;">
                Quadro Societário
            </h3>
            <div style="display: grid; gap: 12px;">`;

        const mapSocios = new Map();

        // 1. Adicionar do DB
        dbRels.forEach(r => {
            if (r.socio) {
                mapSocios.set(r.socio.nome_completo.toUpperCase(), {
                    origin: 'DB',
                    name: r.socio.nome_completo,
                    role: r.tipo_vinculo,
                    date: r.metadata ? r.metadata.data_entrada : null,
                    id: r.socio.id,
                    cpf: r.socio.cpf_cnpj,
                    properties: r.socio.total_propriedades || 0,
                    enriched: !!r.socio.dados_enrichment
                });
            }
        });

        // 2. Mesclar Raw (se não existir no map)
        if (rawSocios) {
            rawSocios.forEach(s => {
                const key = s.nome.toUpperCase();
                if (!mapSocios.has(key)) {
                    mapSocios.set(key, {
                        origin: 'RAW',
                        name: s.nome,
                        role: s.qualificacao_socio ? s.qualificacao_socio.descricao : s.tipo,
                        date: s.data_entrada,
                        cpf: s.cpf_cnpj_socio, // Mascarado vindo da API
                        properties: 0,
                        id: null
                    });
                } else {
                    // Atualizar info se necessário
                    const existing = mapSocios.get(key);
                    if (!existing.date) existing.date = s.data_entrada;
                    // Se o DB não tem CPF completo, tenta pegar o raw (mascarado é melhor que nada)
                }
            });
        }

        // Renderizar Lista
        mapSocios.forEach((s) => {
            const entrada = s.date ? new Date(s.date).toLocaleDateString('pt-BR') : '-';
            const isEnriched = s.origin === 'DB' && !s.cpf.startsWith('S_PJ_'); // Só é enriquecido se não for ID temporário
            const hasProperties = s.properties > 0;

            // CPF Display Logic
            let cpfDisplay = 'CPF não informado';
            let realCpfForToggle = s.cpf;
            let showEye = false;

            if (s.cpf) {
                if (s.cpf.startsWith('S_PJ_')) {
                    // É um ID temporário. Tentar achar o mascarado nos metadados
                    // Precisamos acessar os dados_enrichment do sócio se vieram do DB
                    // No map, não salvei dados_enrichment brutos, apenas flag enriched.
                    // Tentar recuperar do rawSocios ou se foi setado no map

                    // Fallback: Se for ID interno, mostrar "Oculto na Receita" ou mask genérica se tivermos
                    // Na verdade, o 's.cpf' veio de r.socio.cpf_cnpj.
                    // Vamos tentar ver se tem masked_cpf salvo
                    // Como não tenho acesso fácil ao objeto completo aqui no loop final sem refazer o map,
                    // Vou assumir que se for S_PJ_, mostramos "Documento Protegido" ou pegamos do raw correspondente se der match de nome

                    const rawMatch = rawSocios ? rawSocios.find(rs => rs.nome.toUpperCase() === s.name.toUpperCase()) : null;
                    if (rawMatch && rawMatch.cpf_cnpj_socio) {
                        cpfDisplay = rawMatch.cpf_cnpj_socio; // Ex: ***123456**
                    } else {
                        cpfDisplay = '***.***.***-**';
                    }

                    realCpfForToggle = s.cpf; // Mantém o ID interno para controle
                    showEye = false; // Não adianta mostrar ID interno
                }
                else if (s.cpf.includes('*')) {
                    // Já mascarado (Raw original sem ID interno?)
                    cpfDisplay = s.cpf;
                    showEye = false;
                }
                else {
                    // Full (DB Real)
                    cpfDisplay = window.formatDocument(s.cpf, true); // Mascara padrão
                    // Mas queremos mostrar MASCARADO por padrão?
                    // Sim, o request do user foi "liberar ou restringir".
                    // Então mostramos ***... e o olho libera.
                    // Vamos mascarar visualmente agora
                    const clean = s.cpf.replace(/\D/g, '');
                    if (clean.length === 11) {
                        cpfDisplay = `***.${clean.substr(3, 3)}.${clean.substr(6, 3)}-**`;
                        showEye = true;
                    } else {
                        cpfDisplay = window.formatDocument(s.cpf, true);
                    }
                }
            }

            // Botão de Ação
            let actionBtn = '';

            // Lógica de Vínculo:
            // Se isEnriched (Tem CPF Real), mostra "Ver Perfil" ou "Cadastrado".
            // Se NÃO tem CPF Real (S_PJ_), mostra "Detalhar" (Consulta Avançada).

            if (isEnriched) {
                if (hasProperties) {
                    actionBtn = `
                        <button onclick="window.ProprietarioTooltip.show(${s.id})" style="
                            background: white; border: 1px solid #10b981; color: #10b981; 
                            padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer;
                            display: flex; align-items: center; gap: 6px;
                        " title="Ver Perfil do Sócio">
                            <i class="fas fa-user-check"></i> Ver Perfil (${s.properties})
                        </button>
                     `;
                } else {
                    actionBtn = `
                        <button style="
                            background: #f1f5f9; border: 1px solid #cbd5e1; color: #64748b; 
                            padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: default;
                            display: flex; align-items: center; gap: 6px; opacity: 0.7;
                        " title="Cadastrado, sem imóveis">
                            <i class="fas fa-check-circle"></i> Cadastrado
                        </button>
                     `;
                }
            } else {
                actionBtn = `
                    <button onclick="window.ProprietarioTooltip.consultarSocio('${s.name}', '${prop.id}')" style="
                        background: white; border: 1px solid #3b82f6; color: #3b82f6; 
                        padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer;
                        display: flex; align-items: center; gap: 6px;
                    ">
                        <i class="fas fa-search-plus"></i> Detalhar
                    </button>
                `;
            }

            html += `
                <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; transition: all 0.2s;">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div>
                            <div style="font-weight: 700; color: #1e293b; font-size: 14px; display: flex; align-items: center; gap: 8px;">
                                ${s.name}
                                ${isEnriched ? '<i class="fas fa-certificate" style="color: #3b82f6; font-size: 12px;" title="Verificado"></i>' : ''}
                            </div>
                            
                            <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
                                <span style="display: inline-block; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-weight: 600;">Cargo: ${s.role}</span>
                                <span style="margin-left: 8px;">Entrada: ${entrada}</span>
                            </div>

                            <div style="font-size: 12px; color: #475569; margin-top: 6px; display: flex; align-items: center; gap: 6px;">
                                <i class="far fa-id-card"></i> 
                                <span class="cpf-display">${cpfDisplay}</span>
                                ${showEye ? `
                                    <i class="fas fa-eye" style="cursor: pointer; opacity: 0.6; font-size: 12px;" 
                                       onclick="window.toggleCpfText(this, '${realCpfForToggle}')" title="Mostrar/Ocultar"></i>
                                ` : ''}
                            </div>
                        </div>
                        
                        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
                            ${actionBtn}
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div></div>';
        return html;
    },

    // Ação: Consultar Receita Federal
    async consultarReceita(cnpj, proprietarioId) {
        window.Loading.show('Consultando Receita...', 'Buscando dados públicos do CNPJ');
        try {
            const dados = await window.Enrichment.fetchPublicCNPJ(cnpj);

            if (dados) {
                // Salvar dados no proprietário
                // Aqui mantemos os dados de enrichment intactos e salvamos o publico em 'dados_publicos' (se tiver coluna) ou merge em enrichment
                // Como não criei coluna 'dados_publicos', vou salvar dentro de dados_enrichment.raw_public_data ou mergear

                // Opção: Merge inteligente
                const updatePayload = {
                    dados_enrichment: {
                        ...(dados), // Merge direto
                        raw_public_data: dados,
                        updated_at: new Date().toISOString()
                    }
                };

                // Atualizar DB
                await window.supabaseApp.from('proprietarios').update(updatePayload).eq('id', proprietarioId);

                // Processar Sócios e Criar Vínculos
                if (dados.socios) {
                    const count = await window.Enrichment.processPartners(proprietarioId, dados.socios);
                    window.Toast.success(`${count} sócios processados/vinculados.`);
                }

                window.Toast.success('Dados da Receita atualizados!');

                // Refresh
                this.show(proprietarioId);
            }
        } catch (e) {
            window.Toast.error(e.message);
        } finally {
            window.Loading.hide();
        }
    },

    // Ação: Consultar e Detalhar Sócio
    async consultarSocio(nome, pjId) {
        if (!confirm(`Deseja buscar detalhes de "${nome}" na consulta avançada?\nIsso consumirá créditos.`)) return;

        window.Loading.show('Consulta Avançada', `Buscando "${nome}"...`);
        try {
            // Tenta buscar por nome
            const results = await window.Enrichment.searchPersonByName(nome);

            if (results && results.length > 0) {
                // Se achou, geralmente é uma lista. Pegar o primeiro ou dar opção?
                // MVP: Pega o primeiro
                const personData = results[0];
                const cpf = personData.document || personData.cpf;

                // Enriquece oficialmente (salva e vincula)
                await window.Enrichment.enrichPerson(cpf); // Essa func já faz upsert

                // Refresh
                this.show(pjId);
            } else {
                window.Toast.warning('Pessoa não encontrada na consulta avançada pelo nome.');
            }
        } catch (e) {
            window.Toast.error('Erro na busca: ' + e.message);
        } finally {
            window.Loading.hide();
        }
    },

    close() {
        if (window.currentTooltip) {
            if (window.currentTooltip.backdrop) {
                window.currentTooltip.backdrop.remove();
            }
            window.currentTooltip.remove();
            window.currentTooltip = null;
        }
    }
};

console.log("✅ Proprietario Tooltip module loaded");
