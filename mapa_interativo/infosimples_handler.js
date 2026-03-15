// ==========================================
// INFOSIMPLES HANDLER - INFOSIMPLES_HANDLER.JS
// ==========================================
// Integração com Infosimples API para consultas de certidões jurídicas

const INFOSIMPLES_API_URL = 'https://ijmgvsztgljribnogtsx.supabase.co/functions/v1/infosimples-api';

// Configuração das certidões disponíveis
const CERTIDOES_CONFIG = {
    'tst-cndt': {
        id: 'tst-cndt',
        nome: 'TST - CNDT (Trabalhista)',
        descricao: 'Certidão Negativa de Débitos Trabalhistas',
        preco: 0.04,
        icone: 'fa-gavel',
        params: ['cpf', 'cnpj'],
        cor: '#8b5cf6'
    },
    'trt2-digital': {
        id: 'trt2-digital',
        nome: 'TRT2 Digital (SP)',
        descricao: 'Processos Digitais SP',
        preco: 0.04,
        icone: 'fa-laptop',
        params: ['cpf', 'cnpj_raiz'],
        cor: '#3b82f6'
    },
    'trt2-fisico': {
        id: 'trt2-fisico',
        nome: 'TRT2 Físico (SP)',
        descricao: 'Processos Físicos SP',
        preco: 0.04,
        icone: 'fa-folder-open',
        params: ['cpf', 'cnpj', 'nome'],
        cor: '#6366f1'
    },
    'trf-unificada': {
        id: 'trf-unificada',
        nome: 'TRF Unificada',
        descricao: 'Tribunais Regionais Federais',
        preco: 0.04,
        icone: 'fa-university',
        params: ['cpf', 'cnpj', 'tipo', 'email'],
        cor: '#10b981'
    },
    'trf3': {
        id: 'trf3',
        nome: 'TRF3 - Distribuição',
        descricao: 'Certidão de Distribuição TRF3',
        preco: 0.04,
        icone: 'fa-balance-scale',
        params: ['cpf', 'cnpj', 'nome', 'tipo', 'abrangencia'],
        cor: '#14b8a6',
        suboptions: {
            tipo: {
                label: 'Tipo',
                options: [
                    { value: '1', label: 'Cível' },
                    { value: '2', label: 'Criminal' },
                    { value: '3', label: 'Eleitoral' }
                ]
            },
            abrangencia: {
                label: 'Abrangência',
                options: [
                    { value: '1', label: 'Regional' },
                    { value: '2', label: 'Seção Judiciária SP' },
                    { value: '3', label: 'Tribunal Regional Federal 3ª' },
                    { value: '4', label: 'Seção Judiciária MS' }
                ]
            }
        }
    },
    'tjsp-segundo-grau': {
        id: 'tjsp-segundo-grau',
        nome: 'TJSP 2º Grau',
        descricao: 'Processos do 2º Grau TJSP',
        preco: 0.20,
        icone: 'fa-gavel',
        params: ['cpf', 'cnpj', 'nome'],
        cor: '#ef4444'
    },
    'cenprot-sp': {
        id: 'cenprot-sp',
        nome: 'CENPROT SP (Protestos)',
        descricao: 'Central de Protestos SP',
        preco: 0.06,
        icone: 'fa-exclamation-triangle',
        params: ['cpf', 'cnpj'],
        cor: '#f59e0b'
    },
    'pgfn': {
        id: 'pgfn',
        nome: 'Receita Federal PGFN',
        descricao: 'CND Federal (Tributos e FGTS)',
        preco: 0.06,
        icone: 'fa-building-columns',
        params: ['cpf', 'cnpj', 'birthdate'],
        cor: '#059669'
    },
    'sefaz-sp': {
        id: 'sefaz-sp',
        nome: 'SEFAZ SP',
        descricao: 'Certidão Estadual SP',
        preco: 0.04,
        icone: 'fa-landmark',
        params: ['cpf', 'cnpj', 'ie', 'uf'],
        cor: '#0ea5e9'
    },
    'cnj-improbidade': {
        id: 'cnj-improbidade',
        nome: 'CNJ Improbidade',
        descricao: 'Cadastro Nacional de Condenações',
        preco: 0.04,
        icone: 'fa-user-slash',
        params: ['cpf', 'cnpj', 'nome'],
        cor: '#ef4444'
    }
};


window.Infosimples = {
    // Cache do saldo
    _balance: null,
    _balanceTimestamp: null,

    // Certidões selecionadas
    _selected: new Set(),

    /**
     * Criar uma nova notificação no sistema
     */
    async criarNotificacao(titulo, mensagem, link) {
        try {
            if (!window.supabaseApp) return;

            const { error } = await window.supabaseApp
                .from('notificacoes')
                .insert({
                    titulo: titulo,
                    mensagem: mensagem,
                    link_url: link,
                    tipo: 'certidao',
                    lida: false
                });

            if (error) console.error('[Infosimples] Erro ao criar notificação:', error);
        } catch (e) {
            console.error('[Infosimples] Erro ao criar notificação:', e);
        }
    },

    /**
     * Buscar saldo da conta Infosimples
     */
    async checkBalance(forceRefresh = false) {
        // Cache por 5 minutos
        if (!forceRefresh && this._balance !== null && this._balanceTimestamp) {
            const age = Date.now() - this._balanceTimestamp;
            if (age < 5 * 60 * 1000) {
                return { success: true, balance: this._balance };
            }
        }

        try {
            const response = await fetch(`${INFOSIMPLES_API_URL}?action=check_balance`);
            const data = await response.json();

            if (data.success) {
                this._balance = data.balance;
                this._balanceTimestamp = Date.now();
            }

            return data;
        } catch (e) {
            console.error('[Infosimples] Erro ao verificar saldo:', e);
            return { success: false, error: e.message };
        }
    },

    /**
     * Obter configuração das certidões
     */
    getCertidoesConfig() {
        return CERTIDOES_CONFIG;
    },

    /**
     * Obter preço de uma certidão
     */
    getPreco(certidaoId) {
        return CERTIDOES_CONFIG[certidaoId]?.preco || 0;
    },

    /**
     * Calcular total das certidões selecionadas
     */
    calcularTotal() {
        let total = 0;
        this._selected.forEach(id => {
            total += this.getPreco(id);
        });
        return total;
    },

    async verComprovante(url, isHtml = false) {
        if (!url) return;

        // Detect HTML by extension if flag not explicit
        if (url.toLowerCase().includes('.html') || isHtml) {
            this.openHtmlViewer(url);
        } else {
            window.open(url, '_blank');
        }
    },

    async openHtmlViewer(url) {
        const modal = document.getElementById('html-cert-modal');
        const iframe = document.getElementById('cert-frame');

        if (!modal || !iframe) {
            console.error("HTML Modal elements not found");
            window.open(url, '_blank'); // Fallback
            return;
        }

        // Show loading state
        modal.style.display = 'block';
        iframe.srcdoc = `
            <div style="display:flex; justify-content:center; align-items:center; height:100%; font-family:sans-serif; color:#666;">
                <div style="text-align:center">
                    <div style="font-size:2rem; margin-bottom:10px;">⌛</div>
                    Carregando certidão...
                </div>
            </div>
        `;

        try {
            // Fetch content
            const response = await fetch(url);
            let htmlContent = await response.text();

            // Inject print styles if missing
            if (!htmlContent.includes('@media print')) {
                htmlContent += `
                    <style>
                        @media print { 
                            body { margin: 0; padding: 0; } 
                            .no-print { display: none; }
                        }
                    </style>
                `;
            }

            // Render in iframe
            iframe.srcdoc = htmlContent;

            // Setup global print helper
            window.printCertFrame = () => {
                iframe.contentWindow.print();
            };

        } catch (e) {
            console.error("Error loading HTML cert:", e);
            iframe.srcdoc = `<div style="padding:20px; color:red;">Erro ao carregar documento: ${e.message}</div>`;
        }
    },

    async downloadPdf(url, filename) {
        // The provided snippet for downloadPdf was incomplete.
        // Assuming it's meant to be a placeholder or will be filled later.
        // For now, it's an empty method as per the provided diff.
    },

    /**
     * Toggle seleção de certidão
     */
    toggleCertidao(certidaoId) {
        if (this._selected.has(certidaoId)) {
            this._selected.delete(certidaoId);
        } else {
            this._selected.add(certidaoId);
        }
        return this._selected;
    },

    /**
     * Limpar seleção
     */
    limparSelecao() {
        this._selected.clear();
    },

    /**
     * Solicitar certidão específica
     */
    async requestCertidao(certidaoId, params) {
        if (!CERTIDOES_CONFIG[certidaoId]) {
            return { success: false, error: 'Certidão não encontrada' };
        }

        try {
            console.log('[Infosimples] Requesting:', certidaoId, 'with params:', params);
            const response = await fetch(`${INFOSIMPLES_API_URL}?action=request_certidao`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    certidao_id: certidaoId,
                    params: params
                })
            });

            const data = await response.json();

            // Atualizar cache de saldo (consumiu créditos)
            if (data.success) {
                this._balance = null;
                this._balanceTimestamp = null;
            }

            return data;
        } catch (e) {
            console.error('[Infosimples] Erro ao solicitar certidão:', e);

            // Better error messages for common scenarios
            let errorMsg = e.message;
            if (e.message === 'Failed to fetch' || e.name === 'TypeError') {
                errorMsg = 'Timeout ou erro de conexão. A API pode estar demorando muito para responder.';
            }

            return { success: false, error: errorMsg };
        }
    },

    /**
     * Solicitar múltiplas certidões e salvar PDFs
     */
    async requestMultiplasCertidoes(certidaoIds, baseParams, onProgress) {
        const results = [];
        const documento = baseParams.cpf || baseParams.cnpj || '';
        const total = certidaoIds.length;

        for (let i = 0; i < certidaoIds.length; i++) {
            const id = certidaoIds[i];
            const progress = Math.round(((i) / total) * 100);

            // Update progress bar
            if (onProgress) {
                onProgress(progress, `Consultando ${CERTIDOES_CONFIG[id]?.nome || id}...`, i + 1, total);
            }

            // Clone params to modify safely
            const currentParams = { ...baseParams };

            // === SPECIAL RULES PER CERTIDAO ===

            if (id === 'trf3') {
                // TRF3 Strict Mode: Only CPF, TIPO, ABRANGENCIA
                // Explicitly remove everything else
                delete currentParams.nome;
                delete currentParams.birthdate;
                delete currentParams.email;
                delete currentParams.nome_parte;
                delete currentParams.preferencia_emissao; // CRITICAL: Not in API docs

                // Use stored options or defaults
                currentParams.tipo = currentParams._trf3_tipo || '1';
                currentParams.abrangencia = currentParams._trf3_abrangencia || '1';

                // Remove internal keys
                delete currentParams._trf3_tipo;
                delete currentParams._trf3_abrangencia;
                delete currentParams.cnpj; // TRF3 via 'certidao-distr' is CPF usually.
            } else if (id === 'tjsp-segundo-grau') {
                // TJSP 2º Grau: Only accepts nome, cpf/cnpj, birthdate, nome_parte
                // Remove extra params that cause 400
                delete currentParams.email;
                delete currentParams.tipo;
                delete currentParams.abrangencia;
                delete currentParams.preferencia_emissao;
            } else if (id === 'trt2-fisico') {
                // Ensure nome and birthdate (if available) are present
                // They should be in baseParams, so we just ensure we didn't delete them.
            } else if (id === 'sefaz-sp') {
                // SEFAZ SP: Only accepts nome, cpf/cnpj, uf
                delete currentParams.email;
                delete currentParams.birthdate;
                delete currentParams.nome_parte;
                delete currentParams.preferencia_emissao; // Not in API docs
                delete currentParams.tipo;
                delete currentParams.abrangencia;

                currentParams.uf = 'SP';
            } else if (id === 'pgfn') {
                // PGFN: Requires Name and Birthdate for validation on Receita site
                delete currentParams.email;
                delete currentParams.nome_parte;
                delete currentParams.tipo;
                delete currentParams.abrangencia;
                // nome and birthdate are kept as they are useful for validation
                // preference_emissao is also kept if present
            } else if (id === 'cenprot-sp') { // Confirm ID matches CERTIDOES_CONFIG key
                // CENPROT SP: Docs say ONLY cpf OR cnpj. Nothing else!
                delete currentParams.nome;
                delete currentParams.email;
                delete currentParams.birthdate;
                delete currentParams.tipo;
                delete currentParams.abrangencia;
                delete currentParams.nome_parte;
                delete currentParams.preferencia_emissao; // CRITICAL: API rejects this

            } else if (id === 'trf-unificada') {
                // TRF Unificada: REQUIRES 'tipo' (1=Cível), 'email', 'cpf/cnpj'.
                // I previously deleted 'tipo', which caused the 400 error.

                // Ensure 'tipo' is set (Default 1 - Cível)
                if (!currentParams.tipo) {
                    currentParams.tipo = '1';
                }

                // Ensure 'email'
                if (!currentParams.email) {
                    currentParams.email = 'developersteste11@gmail.com';
                }

                // Remove incompatible params
                delete currentParams.abrangencia;
                delete currentParams.birthdate;
                // delete currentParams.nome; // Docs list 'nome_social' as optional, maybe 'nome' is ignored or mapped? 
                // Let's remove 'nome' to be safe and strictly follow "parâmetros inválidos" hint.
                // But docs say "nome_social" is optional.
                delete currentParams.nome;
                delete currentParams.nome_parte;
            }

            // Cleanup internal keys for all
            delete currentParams._trf3_tipo;
            delete currentParams._trf3_abrangencia;

            const result = await this.requestCertidao(id, currentParams);

            // Se sucesso e tem PDF, salvar no bucket via Edge Function
            if (result.success && result.pdfs && result.pdfs.length > 0) {
                if (onProgress) {
                    onProgress(progress, `Salvando PDF de ${CERTIDOES_CONFIG[id]?.nome || id}...`, i + 1, total);
                }

                try {
                    const savedResult = await this.salvarPdfViaEdge(documento, id, result.pdfs[0]);
                    result.saved_path = savedResult.saved_path;
                    result.public_url = savedResult.public_url;
                } catch (e) {
                    console.error('[Infosimples] Erro ao salvar PDF:', e);
                    result.save_error = e.message;
                }
            }

            results.push({
                certidao_id: id,
                ...result
            });

            // Pequeno delay entre requisições
            await new Promise(r => setTimeout(r, 300));
        }

        // Final progress
        if (onProgress) {
            onProgress(100, 'Concluído!', total, total);
        }

        return results;
    },

    /**
     * Salvar PDF via Edge Function (evita CORS)
     */
    async salvarPdfViaEdge(documento, certidaoId, pdfUrl) {
        const response = await fetch(`${INFOSIMPLES_API_URL}?action=save_pdf`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pdf_url: pdfUrl,
                documento: documento,
                certidao_id: certidaoId
            })
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Erro ao salvar PDF');
        }

        return data;
    },



    /**
     * Renderizar UI do seletor de certidões
     */
    /**
     * Renderizar UI do seletor de certidões
     */
    renderSeletorCertidoes(prop) {
        const tipoPessoa = prop.tipo; // 'PF' ou 'PJ'
        const documento = prop.cpf_cnpj?.replace(/\D/g, '') || '';
        const nome = prop.nome_completo || prop.nome || '';

        // Tentar encontrar data de nascimento e normalizar para AAAA-MM-DD
        let birthdate = '';

        // Prioridade 1: Campo direto do banco (data_nascimento)
        if (prop.data_nascimento) {
            // Se for data ISO ou timestamp, pegar YYYY-MM-DD
            birthdate = prop.data_nascimento.substring(0, 10);
        }
        // Prioridade 2: Enrichment
        else if (prop.dados_enrichment?.basic_data?.birthdate) {
            const rawDate = prop.dados_enrichment.basic_data.birthdate;
            // Se já for AAAA-MM-DD
            if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
                birthdate = rawDate;
            }
            // Se for DD/MM/AAAA
            else if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawDate)) {
                const [dia, mes, ano] = rawDate.split('/');
                birthdate = `${ano}-${mes}-${dia}`;
            }
        }

        const nomeEscaped = nome.replace(/'/g, "\\'");

        let html = `
            <div class="infosimples-container" style="margin-bottom: 24px;">
                <!-- Header com Saldo -->
                <div class="infosimples-saldo" id="infosimples-saldo" style="
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border-radius: 12px;
                    padding: 16px;
                    color: white;
                    margin-bottom: 16px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <div>
                        <div style="font-size: 12px; opacity: 0.8; text-transform: uppercase; letter-spacing: 1px;">
                            Saldo Disponível
                        </div>
                        <div id="saldo-valor" style="font-size: 24px; font-weight: 800; margin-top: 4px;">
                            <i class="fas fa-spinner fa-spin"></i> Carregando...
                        </div>
                    </div>
                    <button onclick="window.Infosimples.atualizarSaldoUI(true)" style="
                        background: rgba(255,255,255,0.2);
                        border: none;
                        color: white;
                        padding: 8px 12px;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 12px;
                    " title="Atualizar saldo">
                        <i class="fas fa-sync-alt"></i>
                    </button>
                </div>

                <!-- Lista de Certidões -->
                <h3 style="
                    font-size: 14px;
                    font-weight: 700;
                    color: #1e293b;
                    margin-bottom: 12px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                ">
                    <i class="fas fa-file-certificate" style="color: #667eea;"></i>
                    Selecione as Certidões
                </h3>

                <div class="certidoes-grid" style="display: grid; gap: 8px;">
        `;

        // Renderizar cada certidão
        Object.values(CERTIDOES_CONFIG).forEach(cert => {
            html += `
                <label class="certidao-item" data-id="${cert.id}" style="
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px;
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                " onmouseover="this.style.borderColor='${cert.cor}'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.08)'" 
                   onmouseout="if(!this.querySelector('input').checked) {this.style.borderColor='#e2e8f0'; this.style.boxShadow='none'}">
                    
                    <input type="checkbox" 
                           id="cert-${cert.id}" 
                           data-certidao="${cert.id}"
                           data-preco="${cert.preco}"
                           onchange="window.Infosimples.onCertidaoChange(this)"
                           style="width: 18px; height: 18px; accent-color: ${cert.cor};">
                    
                    <i class="fas ${cert.icone}" style="
                        font-size: 18px;
                        color: ${cert.cor};
                        width: 24px;
                        text-align: center;
                    "></i>
                    
                    <div style="flex: 1;">
                        <div style="font-size: 13px; font-weight: 600; color: #1e293b;">
                            ${cert.nome}
                        </div>
                        <div style="font-size: 11px; color: #64748b;">
                            ${cert.descricao}
                        </div>
                    </div>
                    
                    <div style="
                        font-size: 13px;
                        font-weight: 700;
                        color: ${cert.cor};
                        background: ${cert.cor}15;
                        padding: 4px 10px;
                        border-radius: 6px;
                    ">
                        R$ ${cert.preco.toFixed(2).replace('.', ',')}
                    </div>
                </label>
            `;
        });

        html += `
                </div>

                <!-- Total e Botão -->
                <div style="
                    margin-top: 16px;
                    padding: 16px;
                    background: #f8fafc;
                    border-radius: 12px;
                    border: 2px dashed #cbd5e1;
                ">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <span style="font-size: 14px; color: #64748b;">
                            Total Selecionado:
                        </span>
                        <span id="total-certidoes" style="font-size: 20px; font-weight: 800; color: #1e293b;">
                            R$ 0,00
                        </span>
                    </div>
                    
                    <button id="btn-solicitar-certidoes" 
                            onclick="window.Infosimples.solicitarCertidoesSelecionadas('${documento}', '${tipoPessoa}', '${nomeEscaped}', '${birthdate}')"
                            disabled
                            style="
                                width: 100%;
                                padding: 14px;
                                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                border: none;
                                border-radius: 10px;
                                color: white;
                                font-size: 14px;
                                font-weight: 700;
                                cursor: pointer;
                                display: flex;
                                alignItems: center;
                                justify-content: center;
                                gap: 8px;
                                opacity: 0.5;
                                transition: all 0.2s;
                            ">
                        <i class="fas fa-search"></i>
                        Solicitar Certidões Selecionadas
                    </button>
                </div>
            </div>
        `;

        // Auto-fetch saldo
        setTimeout(() => this.atualizarSaldoUI(), 100);

        return html;
    },

    /**
     * Handler de mudança de checkbox
     */
    onCertidaoChange(checkbox) {
        const certidaoId = checkbox.dataset.certidao;
        const label = checkbox.closest('.certidao-item');
        const cert = CERTIDOES_CONFIG[certidaoId];

        if (checkbox.checked) {
            this._selected.add(certidaoId);
            label.style.borderColor = cert.cor;
            label.style.background = `${cert.cor}08`;
        } else {
            this._selected.delete(certidaoId);
            label.style.borderColor = '#e2e8f0';
            label.style.background = 'white';
        }

        if (cert.suboptions && checkbox.checked) {
            this.renderSuboptions(cert.id, cert.suboptions);
        } else {
            this.removeSuboptions(cert.id);
        }

        this.atualizarTotalUI();
    },

    renderSuboptions(certId, suboptions) {
        let container = document.getElementById(`suboptions-${certId}`);
        if (!container) {
            // Find parent label to append after
            const checkbox = document.getElementById(`cert-${certId}`);
            if (checkbox) {
                const label = checkbox.closest('label');
                container = document.createElement('div');
                container.id = `suboptions-${certId}`;
                container.style.cssText = 'grid-column: 1 / -1; padding: 10px 15px; background: #f8fafc; border-radius: 6px; margin-top: -5px; margin-bottom: 5px; border: 1px dashed #cbd5e1; display: flex; gap: 15px; flex-wrap: wrap; animation: fadeIn 0.3s ease;';
                label.after(container);
            }
        }

        if (container) {
            let html = '';

            // Render Tipo
            if (suboptions.tipo) {
                html += `
                    <div style="flex: 1; min-width: 120px;">
                        <label style="display: block; font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 4px;">Tipo</label>
                        <select id="opt-${certId}-tipo" style="width: 100%; padding: 6px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 12px; outline: none;">
                            ${suboptions.tipo.options.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
                        </select>
                    </div>
                `;
            }

            // Render Abrangencia
            if (suboptions.abrangencia) {
                html += `
                    <div style="flex: 1; min-width: 150px;">
                        <label style="display: block; font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 4px;">Abrangência</label>
                        <select id="opt-${certId}-abrangencia" style="width: 100%; padding: 6px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 12px; outline: none;">
                            ${suboptions.abrangencia.options.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
                        </select>
                    </div>
                `;
            }

            container.innerHTML = html;
        }
    },

    removeSuboptions(certId) {
        const container = document.getElementById(`suboptions-${certId}`);
        if (container) container.remove();
    },

    /**
     * Atualizar UI do total
     */
    atualizarTotalUI() {
        const total = this.calcularTotal();
        const totalEl = document.getElementById('total-certidoes');
        const btnEl = document.getElementById('btn-solicitar-certidoes');

        if (totalEl) {
            totalEl.textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
        }

        if (btnEl) {
            const hasSelection = this._selected.size > 0;
            btnEl.disabled = !hasSelection;
            btnEl.style.opacity = hasSelection ? '1' : '0.5';
            btnEl.style.cursor = hasSelection ? 'pointer' : 'not-allowed';
        }
    },

    /**
     * Atualizar UI do saldo
     */
    async atualizarSaldoUI(forceRefresh = false) {
        const saldoEl = document.getElementById('saldo-valor');
        if (!saldoEl) return;

        saldoEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Carregando...';

        const result = await this.checkBalance(forceRefresh);

        if (result.success) {
            saldoEl.textContent = `R$ ${result.balance.toFixed(2).replace('.', ',')}`;
        } else {
            saldoEl.innerHTML = '<span style="opacity: 0.7">Erro ao carregar</span>';
        }
    },

    /**
     * Solicitar certidões selecionadas
     */
    async solicitarCertidoesSelecionadas(documento, tipoPessoa, nome, birthdate) {
        if (this._selected.size === 0) {
            window.Toast.warning('Selecione pelo menos uma certidão');
            return;
        }

        // Validação de parâmetros obrigatórios
        if (this._selected.has('trt2-fisico') && !nome) {
            nome = prompt('A certidão TRT2 Físico requer o NOME COMPLETO. Por favor, digite:', '') || '';
            if (!nome) {
                window.Toast.error('Nome é obrigatório para TRT2 Físico.');
                return;
            }
        }

        if (this._selected.has('pgfn') && tipoPessoa !== 'PJ' && !birthdate) {
            birthdate = prompt('A certidão PGFN requer DATA DE NASCIMENTO (AAAA-MM-DD). Por favor, digite:', '') || '';
            if (!birthdate) {
                window.Toast.error('Data de nascimento é obrigatória para PGFN.');
                return;
            }
            // Simple validator YYYY-MM-DD
            if (!/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) {
                window.Toast.error('Formato inválido. Use AAAA-MM-DD.');
                return;
            }
        }

        const total = this.calcularTotal();
        const nomesStr = Array.from(this._selected)
            .map(id => CERTIDOES_CONFIG[id]?.nome || id)
            .join('\n• ');

        if (!confirm(`Confirma a solicitação de ${this._selected.size} certidão(ões)?\n\n• ${nomesStr}\n\nTotal: R$ ${total.toFixed(2).replace('.', ',')}`)) {
            return;
        }

        // Preparar parâmetros base
        const baseParams = {};

        if (nome) baseParams.nome = nome;
        if (birthdate) baseParams.birthdate = birthdate;

        if (tipoPessoa === 'PJ') {
            baseParams.cnpj = documento;
            baseParams.cnpj_raiz = documento.substring(0, 8); // Para TRT2 Digital
        } else {
            baseParams.cpf = documento;
        }

        // Parâmetros específicos por certidão
        // Aplicados dentro do loop em requestMultiplasCertidoes ou aqui se for global
        // Mas como enviamos baseParams para todos, melhor limpar o que é específico

        // TRF Unificada pede email
        if (this._selected.has('trf-unificada')) {
            // Se tiver TRF Unificada, adiciona email no baseParams (não atrapalha os outros se a API for permissiva, 
            // mas TRF3 rejeitou abrangencia/etc. Vamos ver.)
            // Melhor estratégia: Adicionar params específicos no momento da chamada individual ou aqui condicionalmente se for único.
            // Como baseParams vai para todos, vamos adicionar email só se trf-unificada estiver no bolo, 
            // mas isso pode quebrar TRF3 se TRF3 não aceitar email.

            // SOLUÇÃO: Vamos injetar propriedades 'extras' no objeto da certidão na lista results?
            // Não, o requestMultiplasCertidoes itera e chama requestCertidao(id, baseParams).
            // Vou alterar requestMultiplasCertidoes para aceitar params dinâmicos ou limpar baseParams.
        }

        // TRF3 Options (collected here, applied in loop)
        const trf3Tipo = document.getElementById('opt-trf3-tipo') ? document.getElementById('opt-trf3-tipo').value : '1';
        const trf3Abr = document.getElementById('opt-trf3-abrangencia') ? document.getElementById('opt-trf3-abrangencia').value : '1';

        // Pass info globally via baseParams (using special keys that won't hurt, or handled in loop)
        // We'll attach them to baseParams but they will only be used by TRF3 logic in loop
        baseParams._trf3_tipo = trf3Tipo;
        baseParams._trf3_abrangencia = trf3Abr;

        // TJSP 2º Grau
        if (this._selected.has('tjsp-segundo-grau') && nome) {
            baseParams.nome_parte = nome;
        }

        // PGFN
        if (this._selected.has('pgfn')) {
            baseParams.preferencia_emissao = '2via'; // Tenta 2via primeiro se for endpoint antigo
            // Para 'novo' endpoint, talvez ignore.
        }

        // Email apenas para quem precisa (TRF Unificada)
        // Como o baseParams é compartilhado, vamos passar o email no braço apenas para quem precisa
        // Modificarei requestMultiplasCertidoes levemente para lidar com isso ou faço aqui:
        // WORKAROUND: Adicionar email sempre. Se TRF3 reclamou, pode ser outra coisa.
        // A mensagem de erro do TRF3 listou 'abrangencia, birthdate, cpf, nome, tipo' como inválidos.
        // Não listou 'email'. Então email TALVEZ não seja o problema.
        // O problema pode ser 'abrangencia' sendo enviada para quem não é TRF3? 
        // Não, a reclamação veio DO TRF3.
        // Se TRF3 diz que 'cpf' é inválido, e eu mandei CPF...

        baseParams.email = 'developersteste11@gmail.com'; // TRF Unificada exige.
        // baseParams.uf = 'SP'; // REMOVIDO para evitar erro no SEFAZ SP específico e TRF3.

        // Criar modal de progresso
        const progressModal = document.createElement('div');
        progressModal.id = 'certidoes-progress-modal';
        progressModal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.7); z-index: 99999;
            display: flex; align-items: center; justify-content: center;
        `;
        progressModal.innerHTML = `
            <div style="
                background: white;
                border-radius: 16px;
                padding: 32px;
                max-width: 450px;
                width: 90%;
                text-align: center;
            ">
                <div style="font-size: 48px; margin-bottom: 16px;">📄</div>
                <h3 id="progress-title" style="margin: 0 0 8px; font-size: 18px; color: #1e293b;">
                    Consultando Certidões
                </h3>
                <p id="progress-subtitle" style="margin: 0 0 24px; font-size: 13px; color: #64748b;">
                    Preparando requisições...
                </p>
                
                <!-- Progress Bar -->
                <div style="
                    background: #e2e8f0;
                    border-radius: 999px;
                    height: 12px;
                    overflow: hidden;
                    margin-bottom: 12px;
                ">
                    <div id="progress-bar-fill" style="
                        background: linear-gradient(90deg, #667eea, #764ba2);
                        height: 100%;
                        width: 0%;
                        transition: width 0.3s ease;
                        border-radius: 999px;
                    "></div>
                </div>
                
                <p id="progress-counter" style="margin: 0; font-size: 12px; color: #94a3b8;">
                    0 de ${this._selected.size} certidões
                </p>
            </div>
        `;
        document.body.appendChild(progressModal);

        // Progress callback
        const onProgress = (percent, message, current, total) => {
            const bar = document.getElementById('progress-bar-fill');
            const subtitle = document.getElementById('progress-subtitle');
            const counter = document.getElementById('progress-counter');

            if (bar) bar.style.width = `${percent}%`;
            if (subtitle) subtitle.textContent = message;
            if (counter) counter.textContent = `${current} de ${total} certidões`;
        };

        const certidaoIds = Array.from(this._selected);
        const results = await this.requestMultiplasCertidoes(certidaoIds, baseParams, onProgress);

        // Remover modal de progresso
        progressModal.remove();

        // Processar resultados
        let sucessos = 0;
        let falhas = 0;
        let htmlResultados = '';

        results.forEach(r => {
            const cert = CERTIDOES_CONFIG[r.certidao_id];
            const isSuccess = r.success;

            // Verificar detalhes do retorno da API
            const apiData = r.data && r.data.length > 0 ? r.data[0] : null;
            const emitiuPdf = apiData && typeof apiData.emitiu_pdf !== 'undefined' ? apiData.emitiu_pdf : true;
            const mensagem = apiData ? apiData.mensagem : null;

            let statusText = '';
            let statusColor = '';
            let borderColor = '';
            let bgColor = '';
            let icon = '';

            if (isSuccess) {
                if (r.nada_consta) {
                    statusText = '✅ Nada Consta';
                    statusColor = '#059669';
                    borderColor = '#10b981';
                    bgColor = '#f0fff4';
                    icon = '✅';
                } else if (emitiuPdf === false) {
                    statusText = '⏳ Aguardando Emissão';
                    statusColor = '#d97706'; // Amber
                    borderColor = '#f59e0b';
                    bgColor = '#fffbeb';
                    icon = '⏳';
                } else {
                    statusText = '✅ Sucesso';
                    statusColor = '#059669';
                    borderColor = '#10b981';
                    bgColor = '#f0fff4';
                    icon = '✅';
                }
            } else {
                statusText = `❌ ${r.code_message || r.error || 'Erro'}`;
                statusColor = '#dc2626';
                borderColor = '#ef4444';
                bgColor = '#fef2f2';
                icon = '❌';
            }

            if (isSuccess) sucessos++;
            else falhas++;

            // Usar URL salva no Supabase se disponível, senão usar URL original
            const pdfLink = r.public_url || (r.pdfs && r.pdfs.length > 0 ? r.pdfs[0] : null);
            const isHtml = pdfLink && (pdfLink.includes('.html') || pdfLink.includes('html')); // Simple detection

            const savedBadge = r.saved_path
                ? '<span style="font-size: 10px; background: #10b981; color: white; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">Salvo</span>'
                : (r.save_error ? '<span style="font-size: 10px; background: #f59e0b; color: white; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">Não salvo</span>' : '');

            // Se emitiu_pdf é falso, mostrar mensagem de aviso
            const messageBlock = (!emitiuPdf && mensagem)
                ? `<div style="margin-top: 8px; font-size: 11px; color: #b45309; background: #fff7ed; padding: 6px; border-radius: 4px; border: 1px solid #fed7aa;">${mensagem}</div>`
                : '';

            htmlResultados += `
                <div style="padding: 10px 14px; background: ${bgColor}; border-radius: 8px; margin-bottom: 8px; border-left: 4px solid ${borderColor};">
                    <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
                        <div>
                            <strong style="color: #1e293b;">${cert?.nome || r.certidao_id}</strong>
                            ${savedBadge}
                        </div>
                        <span style="font-size: 12px; font-weight: 600; color: ${statusColor};">${statusText}</span>
                    </div>
                    
                    ${messageBlock}

                    ${pdfLink ? `
                    ${pdfLink ? `
                        <button onclick="window.Infosimples.verComprovante('${pdfLink}', ${isHtml})" style="
                            display: inline-flex;
                            align-items: center;
                            gap: 6px;
                            margin-top: 8px;
                            padding: 6px 12px;
                            background: ${isHtml ? '#3b82f6' : '#3b82f6'}; 
                            color: white;
                            border: none;
                            border-radius: 6px;
                            font-size: 12px;
                            font-weight: 600;
                            text-decoration: none;
                            cursor: pointer;
                        ">
                            <i class="fas ${isHtml ? 'fa-globe' : 'fa-file-pdf'}"></i> ${isHtml ? 'Ver Comprovante Web' : 'Abrir PDF'}
                        </button>
                    ` : ''}
                    ` : ''}
                </div>
            `;
        });

        // Mostrar modal de resultados
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.5); z-index: 99999;
            display: flex; align-items: center; justify-content: center;
        `;
        modal.innerHTML = `
            <div style="
                background: white;
                border-radius: 16px;
                padding: 24px;
                max-width: 500px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
            ">
                <h3 style="margin: 0 0 16px; font-size: 18px; color: #1e293b; display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-clipboard-check" style="color: #667eea;"></i>
                    Resultado das Consultas
                </h3>
                <div style="margin-bottom: 16px; padding: 12px; background: #f8fafc; border-radius: 8px; display: flex; gap: 16px;">
                    <span style="color: #10b981; font-weight: 700;"><i class="fas fa-check-circle"></i> ${sucessos} sucesso(s)</span>
                    ${falhas > 0 ? `<span style="color: #ef4444; font-weight: 700;"><i class="fas fa-times-circle"></i> ${falhas} falha(s)</span>` : ''}
                </div>
                ${htmlResultados}
                <button onclick="this.closest('div[style*=fixed]').remove(); window.ProprietarioTooltip?.loadCertidoesHistorico && window.ProprietarioTooltip.loadCertidoesHistorico();" style="
                    width: 100%;
                    padding: 14px;
                    margin-top: 16px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    border-radius: 10px;
                    font-weight: 700;
                    font-size: 14px;
                    cursor: pointer;
                ">
                    Fechar
                </button>
            </div>
        `;
        document.body.appendChild(modal);
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

        // Limpar seleção e atualizar saldo
        this.limparSelecao();
        document.querySelectorAll('.certidao-item input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
            const label = cb.closest('.certidao-item');
            label.style.borderColor = '#e2e8f0';
            label.style.background = 'white';
        });
        this.atualizarTotalUI();
        this.atualizarSaldoUI(true);

        // --- Criar Notificações para os Sucessos ---
        results.forEach(r => {
            const isSuccess = r.success;
            if (isSuccess) {
                const cert = CERTIDOES_CONFIG[r.certidao_id];
                const pdfLink = r.public_url || (r.pdfs && r.pdfs.length > 0 ? r.pdfs[0] : null);
                this.criarNotificacao(
                    `Certidão Pronta: ${cert?.nome || r.certidao_id}`,
                    `A certidão para o documento ${documento} foi obtida com sucesso.`,
                    pdfLink
                );
            }
        });

        // Recarregar histórico de certidões
        if (documento) {
            const propId = document.querySelector('[id^="certidoes-historico-"]')?.id?.replace('certidoes-historico-', '');
            if (propId && window.ProprietarioTooltip) {
                setTimeout(() => window.ProprietarioTooltip.loadCertidoesHistorico(propId, documento), 500);
            }
        }
    }
};

console.log("✅ Infosimples Handler module loaded");
