/**
 * TOOLTIP_UNIFIED_RENDERER.JS
 * Sistema Unificado de Renderização de Tooltips (Lotes + Unidades)
 * Conforme Manifestos Oficiais V6.1 + GuaruGeo V5.1
 * 
 * Objetivo:
 * - Uniformizar apresentação de dados
 * - Aplicar glasmorphism premium
 * - Mostrar todas as informações relevantes do banco
 * - Manter ordem de classificação
 * - Exibir informações de pagamento/valor
 * - Suportar informações de projeto
 */

window.TooltipUnifiedRenderer = {
    
    /**
     * Renderiza Card Mini com Ícone, Label e Valor
     */
    renderMiniCard: function(label, value, iconClass = 'fa-info-circle') {
        return `
            <div class="attribute-card">
                <div class="attribute-card-icon">
                    <i class="fas ${iconClass}"></i>
                </div>
                <div class="attribute-card-label">${label}</div>
                <div class="attribute-card-value">${value}</div>
            </div>
        `;
    },

    /**
     * Renderiza Info Row (Label + Value)
     */
    renderInfoRow: function(label, value, classes = '') {
        return `
            <div class="info-row">
                <span class="info-label">${label}</span>
                <span class="info-value ${classes}">${value}</span>
            </div>
        `;
    },

    /**
     * Renderiza Status Badge Colorido
     */
    renderStatusBadge: function(status) {
        const statusMap = {
            'Disponível': { class: 'available', icon: 'fa-check-circle', label: 'Disponível' },
            'Vendido': { class: 'sold', icon: 'fa-times-circle', label: 'Vendido' },
            'Suspenso': { class: 'suspended', icon: 'fa-pause-circle', label: 'Suspenso' },
        };
        
        const config = statusMap[status] || { class: 'available', icon: 'fa-question-circle', label: status };
        
        return `
            <span class="status-badge ${config.class}">
                <i class="fas ${config.icon}"></i> ${config.label}
            </span>
        `;
    },

    /**
     * Renderiza Seção com Título
     */
    renderSectionTitle: function(title, iconClass = 'fa-info-circle') {
        return `
            <div class="tooltip-section-title">
                <i class="fas ${iconClass}"></i> ${title}
            </div>
        `;
    },

    /**
     * Formata valor em BRL
     */
    formatBRL: function(value) {
        if (!value) return '—';
        const num = parseFloat(value);
        if (isNaN(num)) return '—';
        return `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    },

    /**
     * Formata valor em m²
     */
    formatArea: function(value) {
        if (!value) return '—';
        const num = parseFloat(value);
        if (isNaN(num)) return '—';
        return `${num.toLocaleString('pt-BR')} m²`;
    },

    /**
     * Formata porcentagem
     */
    formatPercent: function(value) {
        if (!value) return '—';
        const num = parseFloat(value);
        if (isNaN(num)) return '—';
        return `${num.toFixed(2)}%`;
    },

    /**
     * Renderiza Informações de Endereço
     */
    renderAddressSection: function(data) {
        return `
            <div class="tooltip-section">
                ${this.renderSectionTitle('Localização', 'fa-map-marker-alt')}
                ${this.renderInfoRow('Zona', data.zona || '—')}
                ${this.renderInfoRow('Bairro', data.bairro || '—')}
                ${this.renderInfoRow('Endereço', data.endereco || '—')}
                ${data.cep ? this.renderInfoRow('CEP', data.cep) : ''}
                ${data.loteamento ? this.renderInfoRow('Loteamento', data.loteamento) : ''}
            </div>
        `;
    },

    /**
     * Renderiza Informações Territoriais
     */
    renderTerritorialSection: function(data) {
        return `
            <div class="tooltip-section">
                ${this.renderSectionTitle('Identificação Territorial', 'fa-th')}
                ${this.renderInfoRow('Inscrição', data.inscricao || '—')}
                ${data.setor ? this.renderInfoRow('Setor', `Setor ${data.setor}`) : ''}
                ${data.quadra ? this.renderInfoRow('Quadra', `Qd ${data.quadra}`) : ''}
                ${data.lote_geo ? this.renderInfoRow('Lote', data.lote_geo) : ''}
                ${data.matricula_mae ? this.renderInfoRow('Matrícula Mãe', data.matricula_mae, 'secondary') : ''}
            </div>
        `;
    },

    /**
     * Renderiza Informações de Valor & Pagamento
     */
    renderValuationSection: function(data) {
        const sections = [];
        
        sections.push(`
            <div class="tooltip-section">
                ${this.renderSectionTitle('Avaliação Imobiliária', 'fa-chart-line')}
                ${data.valor_venal ? this.renderInfoRow('Valor Venal (IPTU)', this.formatBRL(data.valor_venal), 'accent') : ''}
                ${data.valor_venal_edificado ? this.renderInfoRow('Valor Venal Edificado', this.formatBRL(data.valor_venal_edificado), 'accent') : ''}
                ${data.valor_real ? this.renderInfoRow('Valor Real Estimado', this.formatBRL(data.valor_real), 'success') : ''}
                ${data.valor_vendavel ? this.renderInfoRow('Valor Anunciado', this.formatBRL(data.valor_vendavel), 'success') : ''}
                ${data.valor_m2 ? this.renderInfoRow('Valor/m² Terreno', this.formatBRL(data.valor_m2)) : ''}
                ${data.fracao_ideal ? this.renderInfoRow('Fração Ideal', this.formatPercent(data.fracao_ideal)) : ''}
            </div>
        `);
        
        if (data.valor_condominio || data.iptu_anual) {
            sections.push(`
                <div class="tooltip-section">
                    ${this.renderSectionTitle('Despesas Periódicas', 'fa-wallet')}
                    ${data.valor_condominio ? this.renderInfoRow('Condomínio Mensal', this.formatBRL(data.valor_condominio)) : ''}
                    ${data.iptu_anual ? this.renderInfoRow('IPTU Anual', this.formatBRL(data.iptu_anual)) : ''}
                </div>
            `);
        }
        
        return sections.join('');
    },

    /**
     * Renderiza Informações Prediais (para Lotes)
     */
    renderBuildingSection: function(data) {
        return `
            <div class="tooltip-section">
                ${this.renderSectionTitle('Características Prediais', 'fa-building')}
                ${data.build_year ? this.renderInfoRow('Ano de Construção', data.build_year) : ''}
                ${data.floors ? this.renderInfoRow('Andares', data.floors) : ''}
                ${data.area_terreno ? this.renderInfoRow('Área Terreno', this.formatArea(data.area_terreno)) : ''}
                ${data.total_unidades ? this.renderInfoRow('Total de Unidades', data.total_unidades) : ''}
                ${data.building_name ? this.renderInfoRow('Nome do Prédio', data.building_name, 'secondary') : ''}
                ${data.cnpj_edificio ? this.renderInfoRow('CNPJ', data.cnpj_edificio, 'secondary') : ''}
            </div>
        `;
    },

    /**
     * Renderiza Informações Prediais (para Unidades)
     */
    renderUnitFeaturesSection: function(data) {
        const features = [];
        
        if (data.quartos || data.suites || data.banheiros || data.vagas) {
            features.push(`
                <div class="tooltip-section">
                    ${this.renderSectionTitle('Composição', 'fa-door-open')}
                    ${data.quartos ? this.renderInfoRow('Dormitórios', data.quartos) : ''}
                    ${data.suites ? this.renderInfoRow('Suítes', data.suites) : ''}
                    ${data.banheiros ? this.renderInfoRow('Banheiros', data.banheiros) : ''}
                    ${data.vagas ? this.renderInfoRow('Vagas Garagem', data.vagas) : ''}
                </div>
            `);
        }
        
        if (data.area_util || data.area_total) {
            features.push(`
                <div class="tooltip-section">
                    ${this.renderSectionTitle('Áreas', 'fa-ruler-combined')}
                    ${data.area_util ? this.renderInfoRow('Área Útil', this.formatArea(data.area_util)) : ''}
                    ${data.area_total ? this.renderInfoRow('Área Total', this.formatArea(data.area_total)) : ''}
                    ${data.metragem ? this.renderInfoRow('Metragem (Legado)', this.formatArea(data.metragem)) : ''}
                </div>
            `);
        }
        
        return features.join('');
    },

    /**
     * Renderiza Informações de Registro & Marinha
     */
    renderLegalSection: function(data) {
        const sections = [];
        
        if (data.matricula || data.rip) {
            sections.push(`
                <div class="tooltip-section">
                    ${this.renderSectionTitle('Registros Legais', 'fa-file-contract')}
                    ${data.matricula ? this.renderInfoRow('Matrícula (RI)', data.matricula, 'secondary') : ''}
                    ${data.matricula_qualificacao ? this.renderInfoRow('Qualif. Matrícula', data.matricula_qualificacao) : ''}
                    ${data.rip ? this.renderInfoRow('RIP (Marinha/SPU)', data.rip, 'secondary') : ''}
                    ${data.rip_qualificacao ? this.renderInfoRow('Qualif. RIP', data.rip_qualificacao) : ''}
                </div>
            `);
        }
        
        return sections.join('');
    },

    /**
     * Renderiza Amenidades (Badges com Ícones)
     */
    renderAmenitiesSection: function(data) {
        const amenityMap = [
            { flag: data.elevador, icon: 'fa-elevator', label: 'Elevador' },
            { flag: data.portaria_24h, icon: 'fa-shield-halved', label: 'Portaria 24h' },
            { flag: data.piscina, icon: 'fa-swimming-pool', label: 'Piscina' },
            { flag: data.academia, icon: 'fa-dumbbell', label: 'Academia' },
            { flag: data.salao_festas, icon: 'fa-champagne-glasses', label: 'Salão Festas' },
            { flag: data.churrasqueira, icon: 'fa-fire', label: 'Churrasqueira' },
            { flag: data.salao_jogos, icon: 'fa-gamepad', label: 'Salão Jogos' },
            { flag: data.servico_praia, icon: 'fa-umbrella-beach', label: 'Serv. Praia' },
            { flag: data.bicicletario, icon: 'fa-bicycle', label: 'Bicicletário' },
            { flag: data.acesso_pcd, icon: 'fa-wheelchair', label: 'Acessibilidade' },
            { flag: data.area_verde, icon: 'fa-tree', label: 'Área Verde' },
            { flag: data.zeladoria, icon: 'fa-person-digging', label: 'Zeladoria' },
        ];
        
        const amenities = amenityMap.filter(a => a.flag)
            .map(a => `<span class="ctx-chip accent"><i class="fas ${a.icon}"></i>${a.label}</span>`)
            .join('');
        
        if (!amenities) return '';
        
        return `
            <div class="tooltip-section">
                ${this.renderSectionTitle('Amenidades', 'fa-star')}
                <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                    ${amenities}
                </div>
            </div>
        `;
    },

    /**
     * Renderiza Informações de Contato & Gestão
     */
    renderContactSection: function(data) {
        if (!data.zelador_nome && !data.zelador_contato && !data.nome_proprietario) {
            return '';
        }
        
        return `
            <div class="tooltip-section">
                ${this.renderSectionTitle('Gestão & Contatos', 'fa-phone')}
                ${data.zelador_nome ? this.renderInfoRow('Zelador', data.zelador_nome, 'secondary') : ''}
                ${data.zelador_contato ? this.renderInfoRow('Telefone Prédio', data.zelador_contato, 'secondary') : ''}
                ${data.nome_proprietario ? this.renderInfoRow('Proprietário', data.nome_proprietario, 'secondary') : ''}
            </div>
        `;
    },

    /**
     * Renderiza Informações de Projeto (complemento)
     */
    renderProjectSection: function(data) {
        if (!data.projeto_nome && !data.projeto_descricao && !data.projeto_url) {
            return '';
        }
        
        return `
            <div class="tooltip-section">
                ${this.renderSectionTitle('Informações do Projeto', 'fa-building')}
                ${data.projeto_nome ? this.renderInfoRow('Projeto', data.projeto_nome) : ''}
                ${data.projeto_descricao ? `<div style="padding: 8px 0; font-size: 12px; color: var(--tooltip-muted);">${data.projeto_descricao}</div>` : ''}
                ${data.projeto_url ? `<div style="padding: 8px 0;"><a href="${data.projeto_url}" target="_blank" class="tooltip-btn secondary" style="width: 100%; text-align: center;">Visitar Site</a></div>` : ''}
            </div>
        `;
    },

    /**
     * Renderiza Observações Internas
     */
    renderNotesSection: function(data) {
        if (!data.obs && !data.descricao_imovel && !data.caracteristicas) {
            return '';
        }
        
        let notes = `
            <div class="tooltip-section">
                ${this.renderSectionTitle('Notas & Observações', 'fa-sticky-note')}
        `;
        
        if (data.descricao_imovel) {
            notes += `<div style="padding: 8px 0; font-size: 12px; color: var(--tooltip-muted);">📝 ${data.descricao_imovel}</div>`;
        }
        
        if (data.obs) {
            notes += `<div style="padding: 8px 0; font-size: 12px; background: rgba(59, 130, 246, 0.05); border-left: 3px solid var(--tooltip-accent); padding-left: 12px; color: var(--tooltip-muted);">⚠️ ${data.obs}</div>`;
        }
        
        if (Array.isArray(data.caracteristicas) && data.caracteristicas.length > 0) {
            notes += `<div style="padding: 8px 0; display: flex; flex-wrap: wrap; gap: 6px;">`;
            data.caracteristicas.forEach(char => {
                notes += `<span class="ctx-chip">${char}</span>`;
            });
            notes += `</div>`;
        }
        
        notes += `</div>`;
        return notes;
    },

    /**
     * Calcula e renderiza Card Grid (6 items principais)
     */
    renderAttributeGrid: function(data, gridConfig = []) {
        // Config padrão para lotes
        if (gridConfig.length === 0) {
            gridConfig = [
                { label: 'Zona', value: data.zona || '?', icon: 'fa-map-pin' },
                { label: 'Área Terreno', value: this.formatArea(data.area_terreno), icon: 'fa-ruler-combined' },
                { label: 'Andares', value: data.floors || '?', icon: 'fa-layer-group' },
                { label: 'Ano Const.', value: data.build_year || '?', icon: 'fa-calendar' },
                { label: 'Total Unid.', value: data.total_unidades || '?', icon: 'fa-door-open' },
                { label: 'Valor/m²', value: this.formatBRL(data.valor_m2), icon: 'fa-chart-line' },
            ];
        }
        
        return `
            <div class="attribute-grid">
                ${gridConfig.map(item => this.renderMiniCard(item.label, item.value, item.icon)).join('')}
            </div>
        `;
    }
};

// Aliases globais
window.TooltipRenderer = window.TooltipUnifiedRenderer;
