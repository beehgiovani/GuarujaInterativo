/**
 * UnitTooltipHandler.js
 * Lógica da ficha técnica da unidade.
 * Bruno Giovani: Gerencia IA (Farol), Contratos, Histórico e Documentos.
 */

window.UnitTooltipHandler = {
    // Renderiza o tooltip da unidade baseado no lote pai
    show: async function(unit, parentLote, x, y, isRefresh = false) {
        // 1. Busca insights personalizados do usuário (CRM Pessoal)
        const personalData = await this.fetchPersonalInsights(unit.inscricao);
        const displayUnit = { ...unit, ...personalData };
        
        // Ajuste de tipos numéricos
        if (personalData.valor_vendavel) displayUnit.valor_vendavel = parseFloat(personalData.valor_vendavel);
        if (personalData.valor_real) displayUnit.valor_real = parseFloat(personalData.valor_real);
        
        // Inteligência de Dados: Limpa campos concatenados (Matrícula/RIP)
        if (window.cleanUnitData) window.cleanUnitData(displayUnit);

        window.currentTooltipType = 'unit';
        window.currentLoteForUnit = parentLote;
        window.currentUnitForUpdate = displayUnit;

        // 2. Registra no histórico de visualização recente
        if (window.HistoryHandler) window.HistoryHandler.add(parentLote, unit);
        if (window.Analytics) window.Analytics.trackUnitView(unit.id || unit.inscricao, unit.nome_proprietario);

        // 3. Busca histórico de proprietários no banco
        let ownerHistory = [];
        try {
            const { data: hist } = await window.supabaseApp
                .from('unidades_proprietarios_historico')
                .select('*')
                .eq('unidade_inscricao', unit.inscricao)
                .order('created_at', { ascending: false });
            ownerHistory = hist || [];
        } catch(e) { console.error("Erro ao buscar histórico:", e); }

        // 4. Renderização do Tooltip (delegando para o gerador de UI se necessário)
        // Por enquanto vou manter a chamada global para manter compatibilidade
        this.render(displayUnit, parentLote, ownerHistory);
    },

    // Renderiza o tooltip delegando para o UnitTooltipUI
    render: function(unit, parentLote, history) {
        // Busca histórico de edições/sugestões do usuário
        if (!window.UnitTooltipUI) {
            console.error("❌ UnitTooltipUI não carregado!");
            return;
        }

        const html = window.UnitTooltipUI.render(unit, parentLote, history);
        
        // Mantém apenas um tooltip ativo por vez
        if (window.currentTooltip) window.currentTooltip.remove();
        if (window.currentTooltip?.backdrop) window.currentTooltip.backdrop.remove();
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        const tooltipEl = tempDiv.firstElementChild;
        document.body.appendChild(tooltipEl);
        window.currentTooltip = tooltipEl;
        window.currentTooltipType = 'unit';

        const backdrop = document.createElement('div');
        backdrop.className = 'sidebar-backdrop active';
        backdrop.style.zIndex = '9998';
        backdrop.onclick = window.closeLotTooltip;
        document.body.appendChild(backdrop);
        tooltipEl.backdrop = backdrop;

        this.setupEvents(tooltipEl, unit, parentLote);

        if (unit.cpf_cnpj && unit.nome_proprietario && !unit.proprietario_id) {
            window.OwnerHandler?.checkAndConsolidate(unit);
        }
    },

    setupEvents: function(el, unit, lote) {
        const closeBtn = el.querySelector('.unit-tooltip-close');
        if (closeBtn) closeBtn.onclick = window.closeLotTooltip;

        ['click', 'mousedown', 'touchstart'].forEach(evt => {
            el.addEventListener(evt, e => e.stopPropagation());
        });

        // Configurar Abas da Unidade
        window.switchUnitTab = (tab) => this.switchTab(el, tab);
    },

    switchTab: function(el, tab) {
        const tabs = el.querySelectorAll('.unit-tab-content');
        const btns = el.querySelectorAll('.unit-tab-btn');
        
        tabs.forEach(t => t.style.display = 'none');
        btns.forEach(b => {
            b.classList.remove('active');
            b.style.color = '#64748b';
            b.style.borderBottomColor = 'transparent';
        });

        const activeTab = el.querySelector(`#unit-tab-${tab}-content`);
        const activeBtn = el.querySelector(`#unit-tab-btn-${tab}`);
        
        if (activeTab) activeTab.style.display = 'block';
        if (activeBtn) {
            activeBtn.classList.add('active');
            activeBtn.style.color = '#0284c7';
            activeBtn.style.borderBottomColor = '#0284c7';
        }
    },

    closeUnitTooltipAndReturn: async function(loteInscricao) {
        // 1. Close unit tooltip
        window.closeLotTooltip();
        
        // 2. Buscar/Garantir detalhes do lote (reidratação de unidades)
        // Usamos fetchLotDetails para garantir que window.allLotes seja atualizado e as unidades existam.
        const lote = await window.fetchLotDetails(loteInscricao);
        
        if (lote && window.showLotTooltip) {
            setTimeout(() => {
                // Restore previous state (tab)
                window.showLotTooltip(lote, 0, 0, false, window.lastLotActiveTab || 'geral');
            }, 50);
        }
    },

    fetchPersonalInsights: async function(unitInscricao) {
        try {
            const { data: { user } } = await window.supabaseApp.auth.getUser();
            if (!user) return {};

            const { data, error } = await window.supabaseApp
                .from('user_unit_edits')
                .select('field_name, new_value')
                .eq('user_id', user.id)
                .eq('unit_inscricao', unitInscricao);

            if (error) return {};
            return data.reduce((acc, curr) => {
                acc[curr.field_name] = curr.new_value;
                return acc;
            }, {});
        } catch (e) { return {}; }
    },

    // Farol IA: Gera análise de mercado injetada diretamente na aba
    evaluateWithFarol: async function(inscricao) {
        const unit = window.currentUnitForUpdate;
        const lote = window.currentLoteForUnit;
        if (!unit || !window.Farol) return;

        // Muda para a aba do Farol para mostrar o progresso
        window.switchUnitTab('farol');
        
        const container = document.getElementById(`farol-ia-container-${unit.inscricao}`);
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px 0;">
                    <i class="fas fa-robot fa-spin" style="font-size: 40px; color: #0284c7; margin-bottom: 20px;"></i>
                    <div style="font-size: 16px; font-weight: 800; color: #1e293b;">O Farol está analisando...</div>
                    <p style="font-size: 12px; color: #64748b; margin-top: 10px;">Cruzando dados de mercado, altimetria e histórico.</p>
                </div>`;
        }

        try {
            let buildingStats = "";
            if (lote.unidades && lote.unidades.length > 0) {
                const areas = lote.unidades.map(u => parseFloat(u.metragem)).filter(a => !isNaN(a) && a > 0);
                if (areas.length > 0) {
                    const avgArea = (areas.reduce((a, b) => a + b, 0) / areas.length).toFixed(0);
                    buildingStats = `Média do Prédio: ${avgArea}m². Unidade: ${unit.metragem}m².`;
                }
            }

            const prompt = `Como Farol (Especialista Imobiliário), avalie a unidade ${unit.inscricao} no prédio ${lote.building_name || 'Geral'}. 
            Endereço: ${lote.endereco}. Metragem: ${unit.metragem}m². 
            ${buildingStats}
            Forneça um parecer técnico curto e direto sobre o valor de mercado e liquidez. Use markdown simples.`;
            
            const result = await window.Farol.ask(prompt, 'smart');
            
            if (container) {
                container.innerHTML = `
                    <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 12px; padding: 20px;">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px; color: #0369a1;">
                            <i class="fas fa-certificate"></i>
                            <span style="font-weight: 800; font-size: 14px; text-transform: uppercase;">Laudo de Avaliação IA</span>
                        </div>
                        <div style="font-size: 14px; color: #1e293b; line-height: 1.6; font-family: 'Inter', sans-serif;">
                            ${window.parseMarkdown ? window.parseMarkdown(result) : result}
                        </div>
                        <div style="margin-top: 20px; padding-top: 15px; border-top: 1px dashed #bae6fd; font-size: 10px; color: #64748b; font-style: italic;">
                            *Esta análise é baseada em algoritmos e deve ser validada por um perito humano.
                        </div>
                    </div>`;
            }

            if (window.AIHistoryHandler) {
                window.AIHistoryHandler.save(unit.inscricao, 'VALUATION (IA)', result);
            }
        } catch (e) {
            console.error("Erro Farol:", e);
            if (container) container.innerHTML = `<div style="color: #ef4444; padding: 20px; text-align: center;">O Farol está temporariamente fora de serviço.</div>`;
        }
    },

    // Gerador de Contratos (Minutas Jurídicas)
    generateContract: async function(inscricao, type) {
        const unit = window.currentUnitForUpdate;
        const lote = window.currentLoteForUnit;
        if (!unit || !window.Farol) return;

        window.Loading?.show(`🏛️ Consultor Jurídico...`, `Redigindo minuta de ${type}...`);

        try {
            const prompt = `Aja como Advogado Imobiliário Sênior. 
            Redija uma minuta de ${type.toUpperCase()} para o imóvel:
            - Unidade ${unit.complemento || unit.inscricao} do Edifício ${lote.building_name || 'Tal'}.
            - Proprietário: ${unit.nome_proprietario || '[NOME]'}.
            - Valor Sugerido: R$ ${unit.valor_venal || '[VALOR]'}.
            Formate em HTML limpo.`;

            let result = await window.Farol.ask(prompt);
            result = result.replace(/```html/, '').replace(/```/g, '');

            if (window.AIHistoryHandler) {
                window.AIHistoryHandler.save(unit.inscricao, `LEGAL: ${type}`, result);
            }

            const modalHtml = `
                <div style="padding: 20px;">
                    <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: inset 0 0 10px rgba(0,0,0,0.05); max-height: 60vh; overflow-y: auto; font-family: 'Times New Roman', serif;">
                        ${result}
                    </div>
                    <div style="margin-top: 20px; text-align: right;">
                        <button class="btn-primary-rich" onclick="window.copyToClipboard(\`${result.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`)">📋 Copiar Conteúdo</button>
                    </div>
                </div>
            `;

            window.UIManager?.showModal(`🏛️ Minuta: ${type}`, modalHtml);
        } catch (e) {
            console.error("Erro Jurídico:", e);
            window.Toast?.error("Erro ao gerar documento.");
        } finally {
            window.Loading?.hide();
        }
    },

    // Menu de opções de contrato
    showContractOptions: function(inscricao) {
        const modalHtml = `
            <div style="padding: 25px; text-align: center; font-family: 'Inter', sans-serif;">
                <div style="font-size: 14px; color: #64748b; margin-bottom: 25px; font-weight: 500;">Selecione o tipo de minuta jurídica que o Consultor IA deve redigir:</div>
                <div style="display: grid; grid-template-columns: 1fr; gap: 12px;">
                    <button onclick="window.UnitTooltipHandler.generateContract('${inscricao}', 'Venda e Compra')" 
                        style="padding: 14px; background: #059669; color: white; border: none; border-radius: 10px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; transition: transform 0.2s;">
                        <i class="fas fa-handshake"></i> Venda e Compra
                    </button>
                    <button onclick="window.UnitTooltipHandler.generateContract('${inscricao}', 'Locação')" 
                        style="padding: 14px; background: white; color: #1e293b; border: 2px solid #e2e8f0; border-radius: 10px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px;">
                        <i class="fas fa-key"></i> Locação Residencial
                    </button>
                    <button onclick="window.UnitTooltipHandler.generateContract('${inscricao}', 'Permuta')" 
                        style="padding: 14px; background: white; color: #1e293b; border: 2px solid #e2e8f0; border-radius: 10px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px;">
                        <i class="fas fa-exchange-alt"></i> Permuta de Imóveis
                    </button>
                </div>
                <div style="margin-top: 20px; font-size: 10px; color: #94a3b8; font-style: italic;">
                    *A geração pode levar alguns segundos dependendo da complexidade.
                </div>
            </div>
        `;
        window.UIManager?.showModal('🏛️ Consultor Jurídico IA', modalHtml);
    },
    // --- GESTÃO DE ARQUIVOS E HISTÓRICO ---

    showPreviousOwners: async function(unitInscricao) {
        window.Loading.show('Buscando histórico...', 'Acessando registros anteriores');
        try {
            const { data: history, error } = await window.supabaseApp
                .from('unidades_proprietarios_historico')
                .select('*')
                .eq('unidade_inscricao', unitInscricao)
                .order('data_fim', { ascending: false });

            if (error) throw error;

            const modal = document.createElement('div');
            modal.className = 'custom-modal-overlay active';
            modal.style.zIndex = '10010';

            let historyHtml = '';
            if (history && history.length > 0) {
                historyHtml = history.map(h => `
                    <div style="background: white; border-radius: 8px; border: 1px solid #e2e8f0; padding: 12px; margin-bottom: 10px; border-left: 4px solid #64748b;">
                        <div style="font-weight: 700; color: #1e293b; font-size: 14px;">${h.nome_proprietario_manual || h.nome_proprietario || 'Nome não informado'}</div>
                        <div style="font-size: 11px; color: #64748b; margin-top: 4px;">
                            <i class="fas fa-calendar-alt"></i> ${h.data_inicio ? new Date(h.data_inicio).toLocaleDateString() : '?'} até ${h.data_fim ? new Date(h.data_fim).toLocaleDateString() : 'Ainda proprietário'}
                        </div>
                        ${h.obs ? `<div style="font-size: 12px; color: #475569; margin-top: 6px; padding: 6px; background: #f8fafc; border-radius: 4px;">${h.obs}</div>` : ''}
                    </div>
                `).join('');
            } else {
                historyHtml = `<div style="text-align: center; padding: 20px; color: #94a3b8; font-style: italic;">Nenhum proprietário anterior registrado.</div>`;
            }

            modal.innerHTML = `
                <div class="custom-modal" style="max-width: 500px; width: 90%;">
                    <div class="custom-modal-header" style="background: #475569; color: white;">
                        <div class="custom-modal-title"><i class="fas fa-history"></i> Proprietários Anteriores</div>
                        <button class="custom-modal-close" onclick="this.closest('.custom-modal-overlay').remove()">&times;</button>
                    </div>
                    <div class="custom-modal-body" style="padding: 20px; background: #f1f5f9;">
                        <div style="margin-bottom: 15px; font-size: 12px; color: #64748b;">Histórico manual de transferências para a unidade <strong>${unitInscricao}</strong>.</div>
                        <div style="max-height: 400px; overflow-y: auto;">
                            ${historyHtml}
                        </div>
                    </div>
                    <div class="custom-modal-footer" style="padding: 12px; background: white; border-top: 1px solid #e2e8f0; text-align: right;">
                        <button onclick="window.UnitTooltipHandler.triggerManualProprietarioHistory('${unitInscricao}')" style="background: #1e293b; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer;">
                            <i class="fas fa-plus"></i> Registrar Transferência
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

        } catch (e) {
            console.error(e);
            window.Toast.error('Erro ao buscar histórico: ' + e.message);
        } finally {
            window.Loading.hide();
        }
    },

    triggerManualProprietarioHistory: function(inscricao) {
        const nome = prompt("Nome do Proprietário Anterior:");
        if (!nome) return;
        const dataFim = prompt("Data da Transferência (AAAA-MM-DD):", new Date().toISOString().split('T')[0]);
        if (!dataFim) return;
        const detalhes = prompt("Detalhes (Opcional):");

        window.Loading.show('Registrando...', 'Salvando histórico');
        window.supabaseApp
            .from('unidades_proprietarios_historico')
            .insert({
                unidade_inscricao: inscricao,
                nome_proprietario_manual: nome,
                data_fim: dataFim,
                obs: detalhes
            })
            .then(({ error }) => {
                window.Loading.hide();
                if (error) {
                    window.Toast.error('Erro ao salvar: ' + error.message);
                } else {
                    window.Toast.success('Histórico registrado!');
                    const currentModal = document.querySelector('.custom-modal-overlay[style*="z-index: 10010"]');
                    if (currentModal) currentModal.remove();
                    this.showPreviousOwners(inscricao);
                }
            });
    },

    refreshFileExplorer: function(inscricao) {
        const container = document.getElementById('file-explorer-content');
        if (!container) return;
        
        let unit = null;
        for (const lote of window.allLotes) {
            if (lote.unidades) {
                unit = lote.unidades.find(u => u.inscricao === inscricao);
                if (unit) break;
            }
        }
        
        if (!unit) {
            container.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: #ef4444; font-size: 11px; padding: 20px;">Unidade não encontrada na memória.</div>`;
            return;
        }

        let arquivos = [];
        try {
            if (typeof unit.arquivos === 'string') arquivos = JSON.parse(unit.arquivos);
            else if (Array.isArray(unit.arquivos)) arquivos = unit.arquivos;
        } catch(e) {}
        
        container.innerHTML = '';
        
        if (arquivos.length === 0) {
            container.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: #94a3b8; font-size: 11px; padding: 20px;">Pasta de documentos vazia.</div>`;
            return;
        }
        
        arquivos.forEach((file, index) => {
            const url = file.url || file;
            const name = file.name || `Documento ${index + 1}`;
            const isImage = url.match(/\.(jpeg|jpg|gif|png|webp)$/i) !== null;
            const icon = isImage ? '<i class="fas fa-image" style="color: #3b82f6; font-size: 24px;"></i>' : '<i class="fas fa-file-pdf" style="color: #ef4444; font-size: 24px;"></i>';
            
            container.innerHTML += `
                <div style="display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; position: relative; padding: 10px; border-radius: 8px;" class="file-item">
                    <div style="width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; background: white; border-radius: 8px; border: 1px solid #e2e8f0; cursor: pointer;" onclick="window.open('${url}', '_blank')">
                        ${icon}
                    </div>
                    <div style="font-size: 10px; color: #475569; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80px;" title="${name}">${name}</div>
                    <button onclick="window.UnitTooltipHandler.deleteUnitFile('${unit.inscricao}', ${index})" style="position: absolute; top: 0; right: 0; background: white; padding: 4px; border-radius: 50%; border: 1px solid #e2e8f0; color: #ef4444; font-size: 9px; cursor: pointer;"><i class="fas fa-trash"></i></button>
                </div>`;
        });
    },

    handleUnitDocumentUpload: async function(input, inscricao) {
        const file = input.files[0];
        if (!file) return;
        
        window.Loading.show('Enviando...', 'Salvando arquivo na unidade');
        
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `unit_${Date.now()}.${fileExt}`;
            const filePath = `${inscricao}/${fileName}`;
            
            const { data, error } = await window.supabaseApp.storage
                .from('unit_documents')
                .upload(filePath, file);
                
            if (error) throw error;
            
            const { data: { publicUrl } } = window.supabaseApp.storage
                .from('unit_documents')
                .getPublicUrl(filePath);
                
            const { data: unitData } = await window.supabaseApp
                .from('unidades')
                .select('arquivos')
                .eq('inscricao', inscricao)
                .single();
                
            let arquivos = [];
            if (unitData && unitData.arquivos) {
                arquivos = typeof unitData.arquivos === 'string' ? JSON.parse(unitData.arquivos) : unitData.arquivos;
            }
            
            arquivos.push({ name: file.name, url: publicUrl, type: fileExt });
            
            await window.supabaseApp.from('unidades').update({ arquivos: arquivos }).eq('inscricao', inscricao);
            
            // Sync local memory
            for (let lote of window.allLotes) {
                if (lote.unidades) {
                    let u = lote.unidades.find(x => x.inscricao === inscricao);
                    if (u) { u.arquivos = arquivos; break; }
                }
            }
            
            window.Toast.success('Documento salvo!');
            this.refreshFileExplorer(inscricao);
            
        } catch (e) {
            console.error(e);
            window.Toast.error('Erro no upload: ' + e.message);
        } finally {
            window.Loading.hide();
        }
    },

    deleteUnitFile: async function(inscricao, index) {
        if (!confirm('Deseja excluir este documento?')) return;
        
        try {
            const { data: unitData } = await window.supabaseApp
                .from('unidades')
                .select('arquivos')
                .eq('inscricao', inscricao)
                .single();
                
            let arquivos = typeof unitData.arquivos === 'string' ? JSON.parse(unitData.arquivos) : unitData.arquivos;
            arquivos.splice(index, 1);
            
            await window.supabaseApp.from('unidades').update({ arquivos: arquivos }).eq('inscricao', inscricao);
            
            for (let lote of window.allLotes) {
                if (lote.unidades) {
                    let u = lote.unidades.find(x => x.inscricao === inscricao);
                    if (u) { u.arquivos = arquivos; break; }
                }
            }
            
            window.Toast.success('Documento excluído!');
            this.refreshFileExplorer(inscricao);
        } catch(e) {
            window.Toast.error('Erro ao remover: ' + e.message);
        }
    }
};

// Atalhos globais
window.showUnitTooltip = (u, p, x, y) => window.UnitTooltipHandler.show(u, p, x, y);
window.closeUnitTooltipAndReturn = (ins) => window.UnitTooltipHandler.closeUnitTooltipAndReturn(ins);
window.evaluateWithFarol = (ins) => window.UnitTooltipHandler.evaluateWithFarol(ins);
window.generateContract = (ins, type) => window.UnitTooltipHandler.generateContract(ins, type);
window.showPreviousOwners = (ins) => window.UnitTooltipHandler.showPreviousOwners(ins);
window.refreshFileExplorer = (ins) => window.UnitTooltipHandler.refreshFileExplorer(ins);
window.handleUnitDocumentUpload = (inp, ins) => window.UnitTooltipHandler.handleUnitDocumentUpload(inp, ins);
