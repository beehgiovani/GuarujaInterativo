// TooltipUnitList.js - Renderizador do Inventário de Unidades
// Bruno Giovani: Focado em organização de grupos (Torres) e performance de renderização.

window.TooltipUnitList = {
    render: function(lote, container) {
        if (!lote.unidades || lote.unidades.length === 0) {
            container.innerHTML = `<div class="empty-state">
                <i class="fas fa-home" style="font-size: 30px; margin-bottom: 10px; display: block;"></i>
                Lote sem unidades cadastradas.
            </div>`;
            return;
        }

        // Classificação por tipo (Residencial, Comercial, Garagem)
        let residential = [];
        let garage = [];
        let commercial = [];

        // Ordenação: 000 primeiro (Lote), depois numérico natural
        const sortedUnits = [...lote.unidades].sort((a, b) => {
            const endA = a.inscricao.slice(-3);
            const endB = b.inscricao.slice(-3);
            if (endA === '000') return -1;
            if (endB === '000') return 1;
            return a.inscricao.localeCompare(b.inscricao, undefined, { numeric: true });
        });

        sortedUnits.forEach(u => {
            const type = (u.tipo || '').toLowerCase();
            const comp = (u.complemento || '').toLowerCase();
            const text = comp + ' ' + type;

            if (type === 'garagem' || text.includes('vaga') || text.includes('box')) {
                garage.push(u);
            } else if (type === 'loja' || type === 'sala' || text.includes('comercial')) {
                commercial.push(u);
            } else {
                if (u.inscricao.slice(-3) !== '000' || sortedUnits.length === 1) {
                    residential.push(u);
                }
            }
        });

        // Agrupamento Inteligente por Torres/Grupos (Extraindo do Complemento)
        const groups = {};
        residential.forEach(u => {
            let key = 'Geral';
            if (u.complemento && u.complemento.trim().length > 1) {
                const comp = u.complemento.trim().toUpperCase();
                // Procura padrões como "TORRE 01", "BLOCO A", "EDIFICIO 2"
                const match = comp.match(/(TORRE|BLOCO|EDIFICIO|ED\.|ED)\s*[A-Z0-9]+/);
                if (match) {
                    key = match[0];
                } else if (comp.includes('COBERTURA') || comp.includes('PENTHOUSE') || comp.includes('COB')) {
                    key = 'Coberturas';
                }
            }
            if (!groups[key]) groups[key] = [];
            groups[key].push(u);
        });

        // Início da montagem do HTML via Classes CSS
        let html = '<div class="unit-list-wrapper">';

        // 1. Sessão Residencial (Organizada por Torres)
        const sortedGroups = Object.keys(groups).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        if (sortedGroups.length > 0) {
            html += `<div class="unit-group-container">`;
            sortedGroups.forEach(groupName => {
                html += `
                    <div class="unit-group-card">
                        <div class="unit-group-header">
                            <span><i class="fas fa-layer-group"></i> ${groupName}</span>
                            <button onclick="window.renameTower('${lote.inscricao}', '${groupName}')" class="btn-icon-muted">
                                <i class="fas fa-pen"></i>
                            </button>
                        </div>
                        <div class="unit-group-grid">
                            ${groups[groupName].map(u => this.renderItem(u, 'residential')).join('')}
                        </div>
                    </div>`;
            });
            html += `</div>`;
        }

        // 2. Sessão Comercial
        if (commercial.length > 0) {
            html += `
                <div>
                    <div class="unit-section-header commercial"><i class="fas fa-store"></i> Áreas Comerciais (${commercial.length})</div>
                    <div class="unit-group-grid">
                        ${commercial.map(u => this.renderItem(u, 'comercial')).join('')}
                    </div>
                </div>`;
        }

        // 3. Sessão Garagem
        if (garage.length > 0) {
            html += `
                <div>
                    <div class="unit-section-header garage"><i class="fas fa-car"></i> Vagas & Garagens (${garage.length})</div>
                    <div class="unit-group-grid">
                        ${garage.map(u => this.renderItem(u, 'garagem')).join('')}
                    </div>
                </div>`;
        }

        html += '</div>';
        container.innerHTML = html;
        this.setupHandlers(container, lote);
    },

    renderItem: function(u, mode = 'residential') {
        const unitNum = u.inscricao.slice(-3);
        
        // Prioridade Bruno Giovani: Mostrar apenas os 3 dígitos da unidade (001, 002) conforme regras GIS.
        let displayNum = unitNum;
        
        // Se o complemento for algo como "00 0001", ignoramos e usamos o número limpo (001)
        if (u.complemento && u.complemento.includes('00 ')) {
            displayNum = unitNum;
        } else if (mode === 'residential' && u.complemento) {
            const comp = u.complemento.trim().toUpperCase();
            const match = comp.match(/(TORRE|BLOCO|EDIFICIO|ED\.|ED)\s*[A-Z0-9]+/);
            if (match) {
                const cleaned = comp.replace(match[0], '').trim();
                displayNum = cleaned || unitNum;
            } else {
                displayNum = comp;
            }
            // Se o complemento for muito grande ou redundante, volta pro número limpo de 3 dígitos
            if (displayNum.length > 8) displayNum = unitNum;
        }
        
        // Cores de Status (Borda Lateral)
        let statusColor = '#94a3b8'; // Default
        const status = (u.status_venda || '').toLowerCase();
        const colors = { 'vendido': '#ef4444', 'reservado': '#f59e0b', 'disponível': '#10b981', 'captar': '#3b82f6' };
        statusColor = colors[status] || statusColor;

        // Referências documentais (matrícula, RIP)
        let refBadges = '';
        if (u.matricula) {
            refBadges += `<span class="unit-ref-badge"><i class="fas fa-file-contract"></i>${u.matricula}</span>`;
        }
        if (u.rip) {
            refBadges += `<span class="unit-ref-badge rip"><i class="fas fa-anchor"></i>${u.rip}</span>`;
        }

        return `
            <div class="unit-item-clickable" data-unit-inscricao="${u.inscricao}" style="border-left-color: ${statusColor};">
                <div class="unit-item-top">
                    <div class="unit-item-info">
                        <span class="unit-item-id">
                            ${this.renderStatusEmoji(u.inscricao)}${displayNum}
                        </span>
                        ${(mode === 'residential' && u.metragem) ? `<span class="unit-item-area">${u.metragem}m²</span>` : ''}
                    </div>
                    ${(mode !== 'residential') ? `<span class="unit-item-type-tag">${u.tipo || (mode === 'comercial' ? 'Loja' : 'Vaga')}</span>` : ''}
                </div>
                ${refBadges ? `<div class="unit-ref-row">${refBadges}</div>` : ''}
                ${this.renderOwnerInfo(u)}
            </div>`;
    },

    renderStatusEmoji: function(inscricao) {
        if (window.UserUnitStatusHandler) {
            const pStatus = window.UserUnitStatusHandler.getStatus(inscricao);
            const pConfig = window.UserUnitStatusHandler.getStatusConfig(pStatus);
            return `<span title="${pConfig.label}">${pConfig.emoji}</span> `;
        }
        return '';
    },

    renderOwnerInfo: function(u) {
        if (u.nome_proprietario && u.nome_proprietario.trim() !== '') {
            const isUnlocked = window.Monetization?.isUnlocked?.(u.inscricao);
            const name = isUnlocked ? u.nome_proprietario.split(' ')[0] : window.maskName(u.nome_proprietario);
            return `
                <div class="unit-owner-tag">
                    ${name} ${isUnlocked ? '' : '<i class="fas fa-lock"></i>'}
                </div>`;
        }
        return '';
    },

    setupHandlers: function(container, lote) {
        container.querySelectorAll('.unit-item-clickable').forEach(item => {
            item.onclick = (e) => {
                e.stopPropagation();
                const unitInscricao = item.dataset.unitInscricao;
                const unit = lote.unidades.find(u => u.inscricao === unitInscricao);
                
                // Backup do Scroll para retorno fluido
                const activeTab = document.querySelector('.lot-tab-content.active');
                if (activeTab) {
                    window.tooltipScrollState = window.tooltipScrollState || {};
                    window.tooltipScrollState[lote.inscricao] = activeTab.scrollTop;
                }
                
                if (unit) window.showUnitTooltip(unit, lote);
            };
        });
    }
};

// Proxies de Compatibilidade
window.UnitListRenderer = window.TooltipUnitList;
