// UnitTooltipUI.js — Ficha detalhada da Unidade/Apartamento (v1.20)
// Bruno Giovani: Máximo de dados expostos, zero peso extra na UI.

window.UnitTooltipUI = {
    parseArrayField: function (value) {
        if (!value) return [];
        if (Array.isArray(value)) return value.filter(Boolean);
        if (typeof value === 'string') {
            try {
                const parsed = JSON.parse(value);
                return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
            } catch (e) {
                return value.startsWith('http') ? [value] : [];
            }
        }
        return [];
    },

    parseContactField: function (value) {
        if (!value) return [];
        if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
        if (typeof value === 'string') {
            try {
                const parsed = JSON.parse(value);
                if (Array.isArray(parsed)) return parsed.map(v => String(v).trim()).filter(Boolean);
            } catch (e) { }
            return value.split(',').map(v => v.trim()).filter(Boolean);
        }
        return [];
    },

    parseDocumentList: function (value) {
        if (!value) return [];
        if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
        return String(value)
            .split(/\r?\n|;|\|/)
            .map(v => v.trim())
            .filter(Boolean);
    },

    render: function (unit, parentLote, history = []) {
        const isAdmin = window.Monetization?.isAdminRole?.()
            || ['admin', 'master'].includes(String(window.Monetization?.userRole || '').toLowerCase());
        const showsFull = isAdmin || window.Monetization?.isUnlocked(unit.inscricao, parentLote.inscricao);
        const canEnrich = isAdmin || window.Monetization?.canAccess?.('marketing_tools');

        // Helpers de formatação
        const fmtCurrency = (v) => v ? 'R$ ' + Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : null;
        const fmtArea = (v) => v ? Number(v).toLocaleString('pt-BR') + ' m²' : null;

        // Campos derivados
        const valorReal = fmtCurrency(unit.valor_real);
        const valorVendavel = fmtCurrency(unit.valor_vendavel);
        const valorVenal = fmtCurrency(unit.valor_venal);
        const valorEdificado = fmtCurrency(unit.valor_venal_edificado);
        const areaUtil = fmtArea(unit.area_util);
        const unitImages = this.parseArrayField(unit.imagens);
        const unitFiles = this.parseArrayField(unit.arquivos);
        const contatos = this.parseContactField(unit.contato_proprietario);
        const matriculas = this.parseDocumentList(unit.matricula);
        const rips = this.parseDocumentList(unit.rip);

        const rawArea = parseFloat(unit.area_total || unit.metragem || unit.area_util || 0);
        const areaTotalLabel = 'Área Total';
        const areaTotal = fmtArea(rawArea);

        const cep = unit.cep ? unit.cep.replace(/(\d{5})(\d{3})/, '$1-$2') : null;

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
        } catch (e) { }

        // ID único para atualização assíncrona da imagem
        const imgId = `unit-hero-img-${unit.inscricao || Math.random().toString(36).substr(2, 9)}`;
        const placeholderImg = 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=500&q=80';

        // Disparar atualização assíncrona (usa parentLote como referência se a unidade não tiver foto própria)
        setTimeout(async () => {
            if (window.MediaHandler) {
                // Se a unidade tem imagem própria, usa ela, senão busca do lote ou streetview
                let realImg = unitImages[0];
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

                    ${parentLote ? `
                    <div class="unit-tooltip-nav unit-tooltip-nav-left">
                        <button class="unit-tooltip-back" aria-label="Voltar para Lote" onclick="window.closeUnitTooltipAndReturn('${parentLote.inscricao}')">
                            <i class="fas fa-arrow-left unit-tooltip-nav-icon"></i>
                        </button>
                    </div>
                    ` : ''}

                    <div class="unit-tooltip-nav unit-tooltip-nav-right">
                        <button class="unit-tooltip-close" aria-label="Fechar" onclick="window.closeLotTooltip()">
                            <i class="fas fa-times unit-tooltip-nav-icon"></i>
                        </button>
                    </div>

                    <div class="header-overlay-info"  >
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
                ${this.renderActionToolbar(unit, parentLote, showsFull, isAdmin, canEnrich)}

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
                        <div class="market-card market-card-asking">
                            <div class="mini-card-label">Valor Pedido</div>
                            <div class="market-val-main market-val-asking">${valorVendavel}</div>
                        </div>` : ''}
                        ${valorReal ? `
                        <div class="market-card market-card-market">
                            <div class="mini-card-label">Valor de Mercado</div>
                            <div class="market-val-main market-val-market">${valorReal}</div>
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
                        <div class="owner-action-row">
                            ${showsFull ? `
                                <button type="button" class="owner-action-btn primary" onclick="window.openUnitOwnerProfile('${unit.inscricao}')">
                                    <i class="fas fa-id-card"></i> Ficha completa
                                </button>
                                ${canEnrich ? `
                                    <button type="button" class="owner-action-btn" onclick="window.Enrichment.enrichUnit('${unit.inscricao}')">
                                        <i class="fas fa-search"></i> Captar dados
                                    </button>` : ''}
                            ` : `
                                <button type="button" class="owner-action-btn primary" onclick="window.Monetization.unlockUnitInfo('${unit.inscricao}')">
                                    <i class="fas fa-unlock"></i> Revelar proprietário
                                </button>
                            `}
                        </div>
                    </div>

                    <!-- Especificações (grid 3x3 = até 9 itens) -->
                    <div class="specs-grid">
                        ${this.renderSpec(areaTotalLabel, areaTotal || '?', 'fa-expand')}
                        ${this.renderSpec('Área Útil', areaUtil || '?', 'fa-vector-square')}
                        ${this.renderSpec('Quartos', unit.quartos || '?', 'fa-bed')}
                        ${this.renderSpec('Suítes', unit.suites || '?', 'fa-bath')}
                        ${this.renderSpec('Banheiros', unit.banheiros || '?', 'fa-shower')}
                        ${this.renderSpec('Vagas', unit.vagas || '?', 'fa-car')}
                        ${this.renderSpec('IPTU / Venal', valorVenal ? valorVenal : '—', 'fa-landmark')}
                        ${this.renderSpec('V. Edificado', valorEdificado ? valorEdificado : '—', 'fa-building')}
                        ${this.renderSpec('Fração Ideal', unit.fracao_ideal || '—', 'fa-percent')}
                        ${this.renderSpec('Status', unit.status_venda || 'Padrão', 'fa-tags')}
                    </div>

                    ${this.renderContactPanel(unit, contatos, showsFull, canEnrich)}

                    <!-- Documentação (Matrícula / RIP) -->
                    ${(matriculas.length || rips.length) && showsFull ? `
                    <div class="unit-docs-row">
                        ${matriculas.length ? `
                        <div class="unit-doc-badge">
                            <i class="fas fa-file-contract"></i>
                            <div>
                                <div class="mini-card-label">Matrículas</div>
                                <div class="unit-doc-chip-list">
                                    ${matriculas.map(doc => `<span class="unit-doc-chip">${doc}</span>`).join('')}
                                </div>
                                ${unit.matricula_qualificacao ? `<div class="unit-doc-note">${unit.matricula_qualificacao}</div>` : ''}
                            </div>
                        </div>` : ''}
                        ${rips.length ? `
                        <div class="unit-doc-badge">
                            <i class="fas fa-anchor"></i>
                            <div>
                                <div class="mini-card-label">RIPs Marinha</div>
                                <div class="unit-doc-chip-list">
                                    ${rips.map(doc => `<span class="unit-doc-chip rip">${doc}</span>`).join('')}
                                </div>
                                ${unit.rip_qualificacao ? `<div class="unit-doc-note">${unit.rip_qualificacao}</div>` : ''}
                            </div>
                        </div>` : ''}
                    </div>` : ''}
                    ${(matriculas.length || rips.length) && !showsFull ? `
                    <div class="unit-docs-row">
                        <div class="unit-doc-badge locked">
                            <i class="fas fa-lock"></i>
                            <div>
                                <div class="mini-card-label">Documentação disponível</div>
                                <div class="cnpj-val">Desbloqueie para ver Matrícula, RIP e IPTU</div>
                            </div>
                        </div>
                    </div>` : ''}

                    ${unitImages.length > 0 ? this.renderUnitGallery(unitImages, unit.complemento || unit.inscricao) : ''}
                    ${unitFiles.length > 0 && showsFull ? this.renderUnitFiles(unitFiles) : ''}

                    <!-- Características (tags do banco) -->
                    ${caracteristicas.length > 0 ? `
                    <div class="unit-caracteristicas">
                        ${caracteristicas.map(c => `<span class="uctx-chip"><i class="fas fa-check"></i>${c}</span>`).join('')}
                    </div>` : ''}

                    <!-- Linha de contexto -->
                    <div class="unit-context-row">
                        ${unit.bairro_unidade ? `<span class="uctx-chip"><i class="fas fa-map"></i>${unit.bairro_unidade}</span>` : ''}
                        ${unit.tipo ? `<span class="uctx-chip"><i class="fas fa-home"></i>${unit.tipo}</span>` : ''}
                        ${unit.complemento ? `<span class="uctx-chip"><i class="fas fa-hashtag"></i>Unid. ${unit.complemento}</span>` : ''}
                        <span class="uctx-chip muted" title="Inscrição Municipal"><i class="fas fa-fingerprint"></i>${unit.inscricao}</span>
                    </div>
                </div>

                <!-- Aba Farol IA -->
                <div id="unit-tab-farol-content" class="unit-tab-content">
                    <div id="farol-ia-container-${unit.inscricao}" class="farol-container">
                        <div class="ia-placeholder">
                            <i class="fas fa-robot"></i>
                            <p>Clique em "Avaliar" para gerar o laudo.</p>
                        </div>
                    </div>
                </div>

                <!-- Aba Histórico -->
                <div id="unit-tab-history-content" class="unit-tab-content">
                    <div class="history-intro">Linha do tempo de transferências:</div>
                    <div id="history-list-${unit.inscricao}" class="history-timeline">
                        ${this.renderHistory(history)}
                    </div>
                </div>
                </div>
            </div>`;
    },

    renderActionToolbar: function (unit, parentLote, showsFull, isAdmin, canEnrich) {
        return `
            <div class="action-toolbar">
                <button class="btn-action-primary" onclick="window.UnitTooltipHandler.evaluateWithFarol('${unit.inscricao}')">
                    <i class="fas fa-magic"></i> Avaliar
                </button>
                <button class="btn-action-secondary" onclick="window.UnitTooltipHandler.showContractOptions('${unit.inscricao}')">
                    <i class="fas fa-file-contract"></i> Contrato
                </button>
                ${showsFull && canEnrich ? `
                <button class="btn-action-secondary" onclick="window.Enrichment.enrichUnit('${unit.inscricao}')" title="Captar dadoss e e-mails">
                    <i class="fas fa-search"></i> Captar dados
                </button>` : ''}
                ${isAdmin ? `
                <button class="btn-action-secondary" onclick="window.editUnitFromTooltip('${unit.inscricao}')" title="Editar Informações">
                    <i class="fas fa-edit"></i> Editar
                </button>` : ''}
                ${!showsFull ? `
                    <button class="btn-unlock" onclick="window.Monetization.unlockUnitInfo('${unit.inscricao}')">
                        <i class="fas fa-unlock"></i> Revelar
                    </button>
                ` : ''}
            </div>`;
    },

    renderContactPanel: function (unit, contatos, showsFull, canEnrich) {
        if (!showsFull && (unit.cpf_cnpj || unit.nome_proprietario)) {
            return `
                <div class="unit-contact-panel locked">
                    <div class="unit-contact-title"><i class="fas fa-lock"></i> Contatos do proprietário</div>
                    <div class="unit-contact-muted">Desbloqueie a unidade para captar e visualizar telefones.</div>
                </div>`;
        }

        const contactChips = contatos.map((contact) => {
            const label = String(contact || '').trim();
            const clean = label.replace(/\D/g, '');
            const isPhone = clean.length >= 10;
            const href = isPhone ? `https://wa.me/55${clean}` : `mailto:${label}`;
            const icon = isPhone ? 'fa-phone' : 'fa-envelope';
            return `
                <a class="unit-contact-chip" href="${href}" target="_blank" rel="noopener">
                    <i class="fas ${icon}"></i>${label}
                </a>`;
        }).join('');

        return `
            <div class="unit-contact-panel">
                <div class="unit-contact-title"><i class="fas fa-address-book"></i> Contatos do proprietário</div>
                ${contactChips ? `<div class="unit-contact-list">${contactChips}</div>` : '<div class="unit-contact-muted">Nenhum telefone salvo ainda.</div>'}
                ${canEnrich ? `
                    <button type="button" class="unit-contact-capture" onclick="window.Enrichment.enrichUnit('${unit.inscricao}')">
                        <i class="fas fa-search"></i> Captar dados
                    </button>` : ''}
            </div>`;
    },

    renderSpec: function (label, value, icon) {
        return `
            <div class="spec-item">
                <i class="fas ${icon}"></i>
                <div class="spec-val">${value}</div>
                <div class="spec-label">${label}</div>
            </div>`;
    },

    renderUnitGallery: function (images, title) {
        const imagesJson = JSON.stringify(images).replace(/"/g, '&quot;');
        return `
            <div class="unit-media-section">
                <div class="mini-card-label">Fotos da Unidade</div>
                <div class="unit-media-strip">
                    ${images.slice(0, 8).map((url, index) => `
                        <button type="button" class="unit-media-thumb" onclick="window.showMediaGallery(${imagesJson}, '${String(title).replace(/'/g, "\\'")}')">
                            <img src="${url}" alt="Foto ${index + 1} da unidade" loading="lazy">
                        </button>
                    `).join('')}
                </div>
            </div>`;
    },

    renderUnitFiles: function (files) {
        return `
            <div class="unit-file-section">
                <div class="mini-card-label">Arquivos da Unidade</div>
                <div class="unit-file-list">
                    ${files.slice(0, 6).map((url, index) => `
                        <a class="unit-file-chip" href="${url}" target="_blank" rel="noopener">
                            <i class="fas fa-file-alt"></i> Arquivo ${index + 1}
                        </a>
                    `).join('')}
                </div>
            </div>`;
    },

    calculatePricePerM2: function (unit) {
        const area = parseFloat(unit.area_total || unit.metragem) || 1;
        const valor = parseFloat(unit.valor_vendavel || unit.valor_real || unit.valor_venal) || 0;
        if (valor === 0) return '---';
        return (valor / area).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
    },

    renderHistory: function (history) {
        if (!history || history.length === 0) return '<div class="empty-state">Nenhum histórico registrado.</div>';
        return history.map(h => `
            <div class="history-item">
                <div class="history-dot"></div>
                <div class="history-name">${h.nome_proprietario_manual || h.nome_proprietario}</div>
                <div class="history-date">${new Date(h.data_fim).toLocaleDateString()}</div>
            </div>`).join('');
    }
};

window.openUnitOwnerProfile = async function (unitInscricao) {
    const unit = (window.allLotes || [])
        .flatMap(lote => lote.unidades || [])
        .find(u => u.inscricao === unitInscricao)
        || window.currentLoteForUnit?.unidades?.find(u => u.inscricao === unitInscricao);

    if (!unit) {
        window.Toast?.error?.('Unidade não encontrada para abrir o proprietário.');
        return;
    }

    const isAdmin = window.Monetization?.isAdminRole?.()
        || ['admin', 'master'].includes(String(window.Monetization?.userRole || '').toLowerCase());
    const isUnlocked = isAdmin
        || window.Monetization?.isUnlocked?.(unit.inscricao, unit.lote_inscricao)
        || window.Monetization?.isUnlockedPerson?.(unit.cpf_cnpj);

    if (!isUnlocked) {
        window.Monetization?.unlockUnitInfo?.(unit.inscricao);
        return;
    }

    if (unit.proprietario_id && window.ProprietarioTooltip?.show) {
        window.ProprietarioTooltip.show(unit.proprietario_id);
        return;
    }

    const doc = String(unit.cpf_cnpj || '').replace(/\D/g, '');
    if (!doc) {
        window.Toast?.warning?.('Esta unidade ainda não tem CPF/CNPJ vinculado.');
        return;
    }

    window.Loading?.show?.('Buscando proprietário...', 'Conferindo cadastro unificado');
    try {
        const { data: prop } = await window.supabaseApp
            .from('proprietarios')
            .select('id')
            .eq('cpf_cnpj', doc)
            .maybeSingle();

        if (prop?.id && window.ProprietarioTooltip?.show) {
            unit.proprietario_id = prop.id;
            window.ProprietarioTooltip.show(prop.id);
            return;
        }

        if (window.Enrichment?.enrichPerson) {
            await window.Enrichment.enrichPerson(doc, unit.nome_proprietario || '');
            return;
        }

        window.Toast?.info?.('Proprietário ainda não enriquecido.');
    } catch (e) {
        console.error('Erro ao abrir proprietário completo:', e);
        window.Toast?.error?.('Erro ao abrir ficha do proprietário.');
    } finally {
        window.Loading?.hide?.();
    }
};
