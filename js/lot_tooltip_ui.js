// LotTooltipUI.js — Ficha de inteligência do Prédio/Lote (v1.20)
// Bruno Giovani: Máximo de dados visíveis sem precisar abrir o editor.

window.LotTooltipUI = {
    render: function(lote) {
        const totalUnidades = lote.unidades?.length || lote.total_unidades || '?';
        const bairro        = lote.bairro || lote.metadata?.bairro || '—';
        const area          = lote.area_terreno ? `${Number(lote.area_terreno).toLocaleString('pt-BR')} m²` : '—';
        const cnpj          = lote.cnpj_edificio || lote.cnpj_condominio || lote.cnpj || null;
        const zoneamento    = lote.zoneamento || lote.uso_solo || '—';
        const setor         = lote.setor ? `Setor ${lote.setor}` : null;
        const quadra        = lote.quadra ? `Qd ${lote.quadra}` : null;
        const descricao     = lote.descricao_imovel || null;
        const loteamento    = lote.loteamento || null;
        const valorM2       = lote.valor_m2 ? `R$ ${Number(lote.valor_m2).toLocaleString('pt-BR')}/m²` : null;
        const matriculaMae  = lote.matricula_mae || null;
        const zeladorNome   = lote.zelador_nome || null;
        const zeladorTel    = lote.zelador_contato || null;

        // ID único para atualização assíncrona da imagem
        const imgId = `hero-img-${lote.inscricao || Math.random().toString(36).substr(2, 9)}`;
        
        // Placeholder inicial (Elegant Shimmer)
        const placeholderImg = 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=500&q=80';
        
        // Disparar atualização assíncrona
        setTimeout(async () => {
            if (window.MediaHandler) {
                const realImg = await window.MediaHandler.getSmartPhoto(lote);
                const imgEl = document.getElementById(imgId);
                if (imgEl && realImg) {
                    imgEl.src = realImg;
                    imgEl.classList.add('loaded');
                }
            }
        }, 10);

        // Amenidades como chips visuais (só exibe o que existe no banco)
        const amenityMap = [
            { flag: lote.elevador,      icon: 'fa-elevator',          label: 'Elevador'       },
            { flag: lote.portaria_24h,  icon: 'fa-shield-halved',     label: 'Portaria 24h'   },
            { flag: lote.piscina,       icon: 'fa-swimming-pool',     label: 'Piscina'        },
            { flag: lote.academia,      icon: 'fa-dumbbell',          label: 'Academia'       },
            { flag: lote.salao_festas,  icon: 'fa-champagne-glasses', label: 'Salão Festas'   },
            { flag: lote.churrasqueira, icon: 'fa-fire',              label: 'Churrasqueira'  },
            { flag: lote.salao_jogos,   icon: 'fa-gamepad',           label: 'Salão Jogos'    },
            { flag: lote.servico_praia, icon: 'fa-umbrella-beach',    label: 'Serv. Praia'    },
            { flag: lote.bicicletario,  icon: 'fa-bicycle',           label: 'Bicicletário'   },
            { flag: lote.acesso_pcd,    icon: 'fa-wheelchair',        label: 'Acessibilidade' },
            { flag: lote.area_verde,    icon: 'fa-tree',              label: 'Área Verde'     },
            { flag: lote.zeladoria,     icon: 'fa-person-digging',    label: 'Zeladoria'      },
        ];
        const amenityChips = amenityMap
            .filter(a => a.flag)
            .map(a => `<span class="ctx-chip amenity-chip"><i class="fas ${a.icon}"></i>${a.label}</span>`)
            .join('');

        return `
            <div class="lot-tooltip-container">
                <!-- Header com Imagem Heroica (Lazy Loaded) -->
                <div class="tooltip-header-img">
                    <img id="${imgId}" src="${placeholderImg}" alt="${lote.building_name || 'Imóvel'}" loading="lazy" class="shimmer-loading" onerror="this.src='${placeholderImg}'">
                    <div class="lot-badge-zona">ZONA ${lote.zona || '?'} | ${lote.inscricao}</div>
                    <button class="lot-tooltip-close" aria-label="Fechar"><i class="fas fa-times"></i></button>
                    <div class="header-overlay-info">
                        <h2>${lote.building_name || 'Sem Nome Cadastrado'}</h2>
                        <p><i class="fas fa-map-marker-alt"></i> ${lote.endereco || 'Endereço não informado'}${bairro !== '—' ? ' — ' + bairro : ''}</p>
                    </div>
                </div>

                <!-- Chips de contexto rápido -->
                <div class="lot-context-chips">
                    ${setor      ? `<span class="ctx-chip"><i class="fas fa-th"></i>${setor}</span>` : ''}
                    ${quadra     ? `<span class="ctx-chip"><i class="fas fa-vector-square"></i>${quadra}</span>` : ''}
                    ${loteamento ? `<span class="ctx-chip"><i class="fas fa-map"></i>${loteamento}</span>` : ''}
                    ${area !== '—' ? `<span class="ctx-chip"><i class="fas fa-ruler-combined"></i>${area}</span>` : ''}
                    ${zoneamento !== '—' ? `<span class="ctx-chip"><i class="fas fa-city"></i>${zoneamento}</span>` : ''}
                    ${valorM2    ? `<span class="ctx-chip accent"><i class="fas fa-tag"></i>${valorM2}</span>` : ''}
                    <span class="ctx-chip accent"><i class="fas fa-door-open"></i>${totalUnidades} unid.</span>
                </div>

                ${descricao ? `<div class="lot-descricao-bar"><i class="fas fa-info-circle"></i> ${descricao}</div>` : ''}

                <!-- Body: Tabs + Content (wrapper for editor injection) -->
                <div class="lot-tooltip-body">
                <div class="tooltip-tabs">
                    <button id="tab-btn-geral" class="lot-tab-btn active" onclick="window.switchLotTab('geral')">GERAL</button>
                    <button id="tab-btn-docs" class="lot-tab-btn" onclick="window.switchLotTab('docs')">DOCUMENTOS</button>
                </div>

                <div id="lot-tab-geral-content" class="lot-tab-content active scrollable-content">
                    <!-- Grid de Atributos Principais (6 cards) -->
                    <div class="attribute-grid">
                        ${this.renderMiniCard('Ano de Const.', lote.build_year || '?', 'fa-calendar')}
                        ${this.renderMiniCard('Andares', lote.floors || '?', 'fa-layer-group')}
                        ${this.renderMiniCard('Área Terreno', area, 'fa-ruler-combined')}
                        ${this.renderMiniCard('Cond. /mês', lote.valor_condominio ? 'R$ ' + Number(lote.valor_condominio).toLocaleString('pt-BR') : 'Consultar', 'fa-wallet')}
                        ${this.renderMiniCard('Total Unid.', String(totalUnidades), 'fa-door-open')}
                        ${this.renderMiniCard('Valor/m²', lote.valor_m2 ? 'R$ ' + Number(lote.valor_m2).toLocaleString('pt-BR') : '—', 'fa-chart-line')}
                    </div>
                    
                    
                    <div class="lot-edit-section">
                        <button class="lot-edit-btn" onclick="window.editFromTooltip('${lote.inscricao}')">
                            <i class="fas fa-edit"></i> Editar Informações do Lote
                        </button>
                    </div>

                    <!-- Infraestrutura / Amenidades -->
                    ${amenityChips ? `
                    <div class="lot-amenities-section">
                        <div class="section-title"><i class="fas fa-star"></i> Infraestrutura</div>
                        <div class="lot-amenity-chips">${amenityChips}</div>
                    </div>` : ''}

                    <!-- Zelador -->
                    ${zeladorNome ? `
                    <div class="lot-zelador-row">
                        <i class="fas fa-person-digging"></i>
                        <div>
                            <div class="cnpj-label">Zelador: <span class="cnpj-val">${zeladorNome}</span></div>
                            ${zeladorTel ? `<div style="font-size:11px;color:#64748b;margin-top:2px;">${zeladorTel}</div>` : ''}
                        </div>
                    </div>` : ''}

                    <!-- CNPJ do Condomínio -->
                    ${cnpj ? `
                    <div class="lot-cnpj-row">
                        <i class="fas fa-building"></i>
                        <span class="cnpj-label">CNPJ Condomínio:</span>
                        <span class="cnpj-val">${cnpj}</span>
                    </div>` : ''}

                    <!-- Matrícula Mãe -->
                    ${matriculaMae ? `
                    <div class="lot-cnpj-row">
                        <i class="fas fa-file-contract"></i>
                        <span class="cnpj-label">Matrícula Mãe:</span>
                        <span class="cnpj-val">${matriculaMae}</span>
                    </div>` : ''}

                    <!-- Vizinhança (OSM) -->
                    <div class="neighborhood-context-box">
                        <div id="osm-context-${lote.inscricao}">
                            <div class="loading-poi"><i class="fas fa-spinner fa-spin"></i> Analisando arredores...</div>
                        </div>
                    </div>

                    <!-- Altimetria -->
                    <div class="elevation-analysis-box">
                        <div class="elevation-data">
                            <div class="elevation-label">⛰️ Topografia</div>
                            <div id="elevation-value-${lote.inscricao}" class="elevation-val">Buscando...</div>
                        </div>
                        <i class="fas fa-mountain icon-muted"></i>
                    </div>

                    <!-- Camada de Marinha -->
                    <div id="marine-context-${lote.inscricao}">
                        ${window.MarinhaHandler?.getMarineExplanation(lote) || ''}
                    </div>

                    <!-- Inventário de Unidades -->
                    <div class="inventory-section">
                        <h3 class="section-title"><i class="fas fa-door-open"></i> Inventário de Unidades</h3>
                        <div id="unit-list-container-${lote.inscricao}">
                            <!-- Injetado via TooltipUnitList -->
                        </div>
                    </div>
                </div>

                <div id="lot-tab-docs-content" class="lot-tab-content" style="display: none;">
                    <div style="padding: 20px;">
                        <button onclick="window.editFromTooltip('${lote.inscricao}')" style="width: 100%; padding: 14px; border-radius: 10px; background: linear-gradient(135deg, #6366f1, #4f46e5); color: white; border: none; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 20px; box-shadow: 0 4px 10px rgba(99, 102, 241, 0.3);">
                            <i class="fas fa-cloud-upload-alt"></i> Gerenciar Plantas & Documentos
                        </button>
                        
                        ${(lote.plantas?.length || lote.documentos?.length) ? `
                            <div class="docs-list" style="display: grid; gap: 12px;">
                                ${[...(lote.plantas || []), ...(lote.documentos || [])].map(url => {
                                    const isPdf = url.toLowerCase().endsWith('.pdf');
                                    const fileName = url.split('/').pop().split('_').slice(1).join('_') || 'Arquivo';
                                    return `
                                        <a href="${url}" target="_blank" class="doc-item-link" style="display: flex; align-items: center; gap: 12px; padding: 12px; background: white; border: 1px solid #e2e8f0; border-radius: 10px; text-decoration: none; color: #1e293b; transition: all 0.2s;">
                                            <i class="fas ${isPdf ? 'fa-file-pdf' : 'fa-file-image'}" style="font-size: 20px; color: ${isPdf ? '#ef4444' : '#3b82f6'};"></i>
                                            <div style="flex: 1; overflow: hidden;">
                                                <div style="font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${fileName}</div>
                                                <div style="font-size: 11px; color: #64748b;">Clique para visualizar</div>
                                            </div>
                                            <i class="fas fa-external-link-alt" style="font-size: 12px; color: #94a3b8;"></i>
                                        </a>
                                    `;
                                }).join('')}
                            </div>
                        ` : `
                            <div class="empty-docs-state" style="border: 2px dashed #cbd5e1; background: #f8fafc; padding: 30px; text-align: center; border-radius: 12px;">
                                <i class="fas fa-file-pdf" style="color: #94a3b8; font-size: 32px; margin-bottom: 10px; display: block;"></i>
                                <p style="color: #64748b; font-weight: 500;">Arquivos anexados aparecerão aqui.</p>
                            </div>
                        `}
                    </div>
                </div>
                </div>
            </div>`;
    },

    renderMiniCard: function(label, value, icon) {
        return `
            <div class="mini-card">
                <i class="fas ${icon}"></i>
                <div>
                    <div class="mini-card-label">${label}</div>
                    <div class="mini-card-value">${value}</div>
                </div>
            </div>`;
    }
};
