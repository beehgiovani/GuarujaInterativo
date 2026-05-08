// UnitTooltipUI.js — Ficha detalhada da Unidade/Apartamento (v1.20)
// Bruno Giovani: Máximo de dados expostos, zero peso extra na UI.

window.UnitTooltipUI = {
    render: function(unit, parentLote, history = []) {
        const showsFull = window.Monetization?.isUnlocked(unit.inscricao, parentLote.inscricao);

        // Helpers de formatação
        const fmtCurrency = (v) => v ? 'R$ ' + Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : null;
        const fmtArea     = (v) => v ? Number(v).toLocaleString('pt-BR') + ' m²' : null;

        // Campos derivados
        const valorReal     = fmtCurrency(unit.valor_real);
        const valorVendavel = fmtCurrency(unit.valor_vendavel);
        const valorEdificado = fmtCurrency(unit.valor_venal_edificado);
        const areaUtil      = fmtArea(unit.area_util);
        
        // Lógica Inteligente de Metragem: Se for AP e muito baixo, deduzir Fração Ideal
        const rawArea = parseFloat(unit.area_total || unit.metragem || unit.area_util || 0);
        const unitType = (unit.tipo || '').toLowerCase();
        // Se for apartamento ou unidade genérica com metragem suspeita (< 40m²), tratamos como Fração Ideal
        const isLowAreaAp = (unitType.includes('ap') || unitType.includes('unid')) && rawArea > 0 && rawArea < 40;
        
        const areaTotalLabel = isLowAreaAp ? 'Fração Ideal' : 'Área Total';
        const areaTotal     = fmtArea(rawArea);

        const cep           = unit.cep ? unit.cep.replace(/(\d{5})(\d{3})/, '$1-$2') : null;
        
        // Máscara de Documento (CPF/CNPJ)
        const formatDoc = (doc) => {
            if (!doc) return '***.***.***-**';
            const clean = doc.replace(/\D/g, '');
            if (clean.length === 11) {
                return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
            } else if (clean.length === 14) {
                return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
            }
            return doc;
        };

        // Características (array de tags)
        let caracteristicas = [];
        try {
            if (unit.caracteristicas) {
                caracteristicas = Array.isArray(unit.caracteristicas)
                    ? unit.caracteristicas
                    : JSON.parse(unit.caracteristicas);
            }
        } catch(e) {}

        // ID único para atualização assíncrona da imagem
        const imgId = `unit-hero-img-${unit.inscricao || Math.random().toString(36).substr(2, 9)}`;
        const placeholderImg = 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=500&q=80';
        
        // Disparar atualização assíncrona (usa parentLote como referência se a unidade não tiver foto própria)
        setTimeout(async () => {
            if (window.MediaHandler) {
                // Se a unidade tem imagem própria, usa ela, senão busca do lote ou streetview
                let realImg = (unit.imagens && unit.imagens[0]);
                if (!realImg) {
                    realImg = await window.MediaHandler.getSmartPhoto(parentLote);
                }
                const imgEl = document.getElementById(imgId);
                if (imgEl && realImg) {
                    imgEl.src = realImg;
                    imgEl.classList.add('loaded');
                }
            }
        }, 10);

        return `
            <div class="unit-tooltip-container">
                <!-- Header com Imagem Heroica (Premium Style) -->
                <div class="tooltip-header-img unit-header-img">
                    <img id="${imgId}" src="${placeholderImg}" alt="${unit.complemento || 'Unidade'}" loading="lazy" class="shimmer-loading" onerror="this.src='${placeholderImg}'">
                    <div class="lot-badge-zona">Unidade: ${String(unit.inscricao).slice(-3)}</div>
                    
                    <div style="position: absolute; top: 15px; left: 15px; z-index: 10;">
                        ${parentLote ? `
                        <button class="unit-tooltip-back" aria-label="Voltar para Lote" onclick="window.closeUnitTooltipAndReturn('${parentLote.inscricao}')" style="background: rgba(15,23,42,0.6); border: none; color: white; border-radius: 12px; width: 40px; height: 40px; display: flex; justify-content: center; align-items: center; cursor: pointer; backdrop-filter: blur(8px); transition: all 0.2s; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
                            <i class="fas fa-arrow-left" style="font-size: 18px;"></i>
                        </button>
                        ` : ''}
                    </div>

                    <div style="position: absolute; top: 15px; right: 15px; z-index: 10;">
                        <button class="unit-tooltip-close" aria-label="Fechar" onclick="window.closeLotTooltip()" style="background: rgba(15,23,42,0.6); border: none; color: white; border-radius: 12px; width: 40px; height: 40px; display: flex; justify-content: center; align-items: center; cursor: pointer; backdrop-filter: blur(8px); transition: all 0.2s; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
                            <i class="fas fa-times" style="font-size: 18px;"></i>
                        </button>
                    </div>

                    <div class="header-overlay-info">
                        <span class="unit-type-badge">${unit.tipo || 'Unidade'}</span>
                        <h2 class="unit-title">${parentLote?.building_name || unit.complemento || 'Unidade'}</h2>
                        <p class="unit-subtitle-addr">
                            <i class="fas fa-map-marker-alt"></i>
                            ${unit.endereco_completo || parentLote?.endereco || 'Endereço não informado'}
                            ${cep ? ` · CEP ${cep}` : ''}
                        </p>
                    </div>
                </div>

                <!-- Barra de Ações -->
                ${this.renderActionToolbar(unit, parentLote, showsFull)}

                <!-- Body: Tabs + Content (wrapper for editor injection) -->
                <div class="unit-tooltip-body">
                <div class="tooltip-tabs">
                    <button id="unit-tab-btn-geral" class="unit-tab-btn active" onclick="window.switchUnitTab('geral')">GERAL</button>
                    <button id="unit-tab-btn-farol" class="unit-tab-btn" onclick="window.switchUnitTab('farol')">FAROL IA</button>
                    <button id="unit-tab-btn-history" class="unit-tab-btn" onclick="window.switchUnitTab('history')">HISTÓRICO</button>
                </div>

                <div id="unit-tab-geral-content" class="unit-tab-content active scrollable-content">

                    <!-- Market IQ: Valores de Mercado -->
                    <div class="market-iq-grid">
                        <div class="market-card">
                            <div class="mini-card-label">Preço p/ m² Est.</div>
                            <div class="market-val-main">R$ ${this.calculatePricePerM2(unit)}/m²</div>
                        </div>
                        <div class="market-card">
                            <div class="mini-card-label">Liquidez</div>
                            <div class="liquidity-val">ALTA ★★★★</div>
                        </div>
                        ${valorVendavel ? `
                        <div class="market-card" style="border-left: 3px solid #059669;">
                            <div class="mini-card-label">Valor Pedido</div>
                            <div class="market-val-main" style="color:#059669;">${valorVendavel}</div>
                        </div>` : ''}
                        ${valorReal ? `
                        <div class="market-card" style="border-left: 3px solid #3b82f6;">
                            <div class="mini-card-label">Valor de Mercado</div>
                            <div class="market-val-main" style="color:#3b82f6;">${valorReal}</div>
                        </div>` : ''}
                    </div>

                    <!-- Proprietário -->
                    <div class="owner-info-box ${!showsFull ? 'locked' : 'unlocked'}">
                        <div class="owner-header">
                            <h3 class="owner-label">Proprietário Atual</h3>
                            <i class="fas ${!showsFull ? 'fa-lock' : 'fa-check-circle'}"></i>
                        </div>
                        <div class="owner-name">
                            ${showsFull ? unit.nome_proprietario : unit.nome_exibicao || 'Nome Mascarado'}
                        </div>
                        <div class="owner-doc">
                            Doc: ${showsFull ? formatDoc(unit.cpf_cnpj) : unit.documento_exibicao || '***.***.***-**'}
                        </div>
                    </div>

                    <!-- Especificações (grid 3x3 = até 9 itens) -->
                    <div class="specs-grid">
                        ${this.renderSpec(areaTotalLabel, areaTotal || '?', isLowAreaAp ? 'fa-chart-pie' : 'fa-expand')}
                        ${this.renderSpec('Área Útil', areaUtil || '?', 'fa-vector-square')}
                        ${this.renderSpec('Quartos', unit.quartos || '?', 'fa-bed')}
                        ${this.renderSpec('Suítes', unit.suites || '?', 'fa-bath')}
                        ${this.renderSpec('Banheiros', unit.banheiros || '?', 'fa-shower')}
                        ${this.renderSpec('Vagas', unit.vagas || '?', 'fa-car')}
                        ${this.renderSpec('V. Venal Solo', unit.valor_venal ? 'R$ ' + (unit.valor_venal/1000).toFixed(0) + 'k' : '—', 'fa-landmark')}
                        ${this.renderSpec('V. Edificado', valorEdificado ? valorEdificado : '—', 'fa-building')}
                        ${this.renderSpec('Status', unit.status_venda || 'Padrão', 'fa-tags')}
                    </div>

                    <!-- Documentação (Matrícula / RIP) -->
                    ${(unit.matricula || unit.rip) ? `
                    <div class="unit-docs-row">
                        ${unit.matricula ? `
                        <div class="unit-doc-badge">
                            <i class="fas fa-file-contract"></i>
                            <div>
                                <div class="mini-card-label">Matrícula</div>
                                <div class="cnpj-val">${unit.matricula}${unit.matricula_qualificacao ? ' · ' + unit.matricula_qualificacao : ''}</div>
                            </div>
                        </div>` : ''}
                        ${unit.rip ? `
                        <div class="unit-doc-badge">
                            <i class="fas fa-anchor"></i>
                            <div>
                                <div class="mini-card-label">RIP Marinha</div>
                                <div class="cnpj-val">${unit.rip}${unit.rip_qualificacao ? ' · ' + unit.rip_qualificacao : ''}</div>
                            </div>
                        </div>` : ''}
                    </div>` : ''}

                    <!-- Características (tags do banco) -->
                    ${caracteristicas.length > 0 ? `
                    <div class="unit-caracteristicas">
                        ${caracteristicas.map(c => `<span class="uctx-chip"><i class="fas fa-check"></i>${c}</span>`).join('')}
                    </div>` : ''}

                    <!-- Linha de contexto -->
                    <div class="unit-context-row">
                        ${unit.bairro_unidade ? `<span class="uctx-chip"><i class="fas fa-map"></i>${unit.bairro_unidade}</span>` : ''}
                        ${unit.tipo          ? `<span class="uctx-chip"><i class="fas fa-home"></i>${unit.tipo}</span>` : ''}
                        ${unit.complemento   ? `<span class="uctx-chip"><i class="fas fa-hashtag"></i>Unid. ${unit.complemento}</span>` : ''}
                        <span class="uctx-chip muted" title="Inscrição Municipal"><i class="fas fa-fingerprint"></i>${unit.inscricao}</span>
                    </div>
                </div>

                <!-- Aba Farol IA -->
                <div id="unit-tab-farol-content" class="unit-tab-content" style="display: none;">
                    <div id="farol-ia-container-${unit.inscricao}" class="farol-container">
                        <div class="ia-placeholder">
                            <i class="fas fa-robot"></i>
                            <p>Clique em "Avaliar" para gerar o laudo.</p>
                        </div>
                    </div>
                </div>

                <!-- Aba Histórico -->
                <div id="unit-tab-history-content" class="unit-tab-content" style="display: none;">
                    <div class="history-intro">Linha do tempo de transferências:</div>
                    <div id="history-list-${unit.inscricao}" class="history-timeline">
                        ${this.renderHistory(history)}
                    </div>
                </div>
                </div>
            </div>`;
    },

    renderActionToolbar: function(unit, parentLote, showsFull) {
        return `
            <div class="action-toolbar">
                <button class="btn-action-primary" onclick="window.UnitTooltipHandler.evaluateWithFarol('${unit.inscricao}')">
                    <i class="fas fa-magic"></i> Avaliar
                </button>
                <button class="btn-action-secondary" onclick="window.UnitTooltipHandler.showContractOptions('${unit.inscricao}')">
                    <i class="fas fa-file-contract"></i> Contrato
                </button>
                <button class="btn-action-secondary" onclick="window.editUnitFromTooltip('${unit.inscricao}')" title="Editar Informações">
                    <i class="fas fa-edit"></i> Editar
                </button>
                ${!showsFull ? `
                    <button class="btn-unlock" onclick="window.Monetization.promptUnlockUnit('${unit.inscricao}', 2)">
                        <i class="fas fa-unlock"></i> Revelar
                    </button>
                ` : ''}
            </div>`;
    },

    renderSpec: function(label, value, icon) {
        return `
            <div class="spec-item">
                <i class="fas ${icon}"></i>
                <div class="spec-val">${value}</div>
                <div class="spec-label">${label}</div>
            </div>`;
    },

    calculatePricePerM2: function(unit) {
        const area = parseFloat(unit.area_total || unit.metragem) || 1;
        const valor = parseFloat(unit.valor_vendavel || unit.valor_real || unit.valor_venal) || 0;
        if (valor === 0) return '---';
        return (valor / area).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
    },

    renderHistory: function(history) {
        if (!history || history.length === 0) return '<div class="empty-state">Nenhum histórico registrado.</div>';
        return history.map(h => `
            <div class="history-item">
                <div class="history-dot"></div>
                <div class="history-name">${h.nome_proprietario_manual || h.nome_proprietario}</div>
                <div class="history-date">${new Date(h.data_fim).toLocaleDateString()}</div>
            </div>`).join('');
    }
};
