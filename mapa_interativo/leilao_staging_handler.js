// ==========================================
// LEILÃO STAGING HANDLER
// ==========================================
// Manages the moderation panel for scraped property auctions (Caixa Leilões).

window.LeilaoStaging = {
    renderPanel: async function(container) {
        container.innerHTML = '<div style="padding: 40px; text-align: center;"><i class="fas fa-spinner fa-spin"></i> Carregando Leilões...</div>';

        try {
            const { data: leiloes, error } = await window.supabaseApp
                .from('caixa_leiloes_staging')
                .select('*')
                .eq('status_aprovacao', 'pendente')
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (!leiloes || leiloes.length === 0) {
                container.innerHTML = `
                    <div style="padding: 60px 40px; text-align: center;">
                        <div style="font-size: 40px; margin-bottom: 20px; opacity: 0.5;">⚖️</div>
                        <div style="font-weight: 800; font-size: 18px; color: white;">Nenhum Leilão Pendente</div>
                        <p style="color: #94a3b8; font-size: 14px; margin-top: 5px;">A fila de raspagem (scraper) está limpa.</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = `
                <div style="margin-bottom: 20px; padding: 15px; background: rgba(37, 99, 235, 0.1); border-radius: 8px; border: 1px solid rgba(37, 99, 235, 0.2); color: #93c5fd; font-size: 12px; display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-robot"></i> <strong>${leiloes.length}</strong> lotes capturados pelo scraper da Caixa Econômica aguardam verificação manual.
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    ${leiloes.map(l => this.renderRow(l)).join('')}
                </div>
            `;
        } catch (e) {
            console.error("Erro carregando leilões staging", e);
            container.innerHTML = `<div style="color: #ef4444; padding: 20px;">Lha ao carregar leilões: ${e.message}</div>`;
        }
    },

    renderRow: function(leilao) {
        const urlFile = leilao.storage_path_temporario 
            ? window.supabaseApp.storage.from('unit_documents').getPublicUrl(leilao.storage_path_temporario).data.publicUrl 
            : null;

        return `
            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div style="display: flex; gap: 16px;">
                        <div style="width: 48px; height: 48px; background: rgba(37,99,235,0.1); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px; color: #3b82f6; flex-shrink: 0;">
                            <i class="fas fa-gavel"></i>
                        </div>
                        <div>
                            <div style="font-weight: 800; color: white; display:flex; align-items:center; gap: 8px; font-size: 16px;">
                                Inscrição: <span style="color: #f59e0b; letter-spacing: 1px;">${leilao.inscricao_imobiliaria || 'DESCONHECIDA'}</span>
                                <span style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; font-size: 10px; color: #94a3b8;">Ref Caixa: ${leilao.codigo_imovel_caixa}</span>
                            </div>
                            <div style="margin-top: 6px; color: #cbd5e1; font-size: 13px; line-height: 1.4;">
                                <strong>Descrição:</strong> ${leilao.descricao_anuncio || 'Sem descrição.'}
                            </div>
                        </div>
                    </div>
                </div>
                
                <div style="display: flex; gap: 15px; margin-top: 10px; flex-wrap: wrap;">
                    <div style="background: rgba(0,0,0,0.3); padding: 10px 15px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.03); flex: 1; min-width: 150px;">
                        <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase;">Ação / Matrícula</div>
                        <div style="font-size: 14px; color: white; font-weight: 700;">${leilao.matricula_encontrada || '--'}</div>
                    </div>
                    <div style="background: rgba(0,0,0,0.3); padding: 10px 15px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.03); flex: 1; min-width: 150px;">
                        <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase;">Valor Avaliação</div>
                        <div style="font-size: 14px; color: #10b981; font-weight: 800;">R$ ${leilao.valor_avaliacao ? Number(leilao.valor_avaliacao).toLocaleString('pt-BR', {minimumFractionDigits: 2}) : '--'}</div>
                    </div>
                    <div style="background: rgba(0,0,0,0.3); padding: 10px 15px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.03); flex: 1; min-width: 150px;">
                        <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase;">Documento Original</div>
                        ${urlFile ? 
                            `<a href="${urlFile}" target="_blank" style="color: #3b82f6; font-size: 13px; font-weight: 700; text-decoration: none; display: inline-flex; align-items: center; gap: 5px;"><i class="fas fa-file-pdf"></i> Visualizar (Staging)</a>` 
                            : `<span style="color: #ef4444; font-size: 12px;"><i class="fas fa-times"></i> Sem documento</span>`
                        }
                    </div>
                </div>

                <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 15px;">
                    <a href="${leilao.url_origem}" target="_blank" class="admin-action-btn" style="background: rgba(255,255,255,0.1); color: white; padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: 700; text-decoration: none; display: flex; align-items: center; gap: 6px;">
                        <i class="fas fa-external-link-alt"></i> Ver no Site
                    </a>
                    <button onclick="window.LeilaoStaging.reject('${leilao.id}')" style="background: rgba(239, 68, 68, 0.1); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.2); padding: 8px 16px; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 12px;">
                        Descartar
                    </button>
                    <button onclick="window.LeilaoStaging.approve('${leilao.id}')" style="background: #22c55e; color: white; border: none; padding: 8px 24px; border-radius: 8px; font-size: 13px; font-weight: 800; cursor: pointer; box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);">
                        APROVAR E IMPORTAR
                    </button>
                </div>
            </div>
        `;
    },

    approve: async function(id) {
        if (!confirm('Isso integrará este leilão na base de unidades oficiais. Confirmar?')) return;
        
        window.Loading.show('Importando Leilão...', 'Vinculando documento e valores');
        
        try {
            const { data: { user } } = await window.supabaseApp.auth.getUser();

            // 1. Fetch staging record
            const { data: record, error: getErr } = await window.supabaseApp
                .from('caixa_leiloes_staging')
                .select('*')
                .eq('id', id)
                .single();
                
            if (getErr || !record) throw new Error("Registro de staging não encontrado.");
            
            if (!record.inscricao_imobiliaria) {
                throw new Error("Este registro de leilão não capturou nenhuma inscrição de união válida.");
            }

            // 2. Fetch original unit
            const { data: unity, error: unitErr } = await window.supabaseApp
                .from('unidades')
                .select('inscricao, matricula, valor_vendavel, arquivos, descricao_imovel')
                .eq('inscricao', record.inscricao_imobiliaria)
                .single();
                
            if (unitErr || !unity) {
                // Se a unidade não existir fisicamente, podemos jogar no log ou criar?
                // Em Guarujá GeoMap, lotes e unidades geralmente existem na carga inicial.
                throw new Error("O imóvel (Inscrição " + record.inscricao_imobiliaria + ") não existe na base principal. Rascunho inválido.");
            }

            // 3. Prepare PDF Migration
            let newArquivos = Array.isArray(unity.arquivos) ? [...unity.arquivos] : [];
            
            if (record.storage_path_temporario) {
                const pubUrlStr = window.supabaseApp.storage.from('unit_documents').getPublicUrl(record.storage_path_temporario).data.publicUrl;
                
                newArquivos.push({
                    name: `Matrícula Caixa (${record.codigo_imovel_caixa})`,
                    url: pubUrlStr,
                    type: "application/pdf",
                    uploaded_at: new Date().toISOString()
                });
            }

            // 4. Update units payload
            let newDesc = unity.descricao_imovel || '';
            newDesc += "\n--- LEILÃO CAIXA IMPORTADO ---\nCódigo: " + record.codigo_imovel_caixa + "\nDetalhes: " + record.descricao_anuncio + "\n";

            const updatePayload = {
                valor_vendavel: record.valor_avaliacao || unity.valor_vendavel, // Avaliação CAIXA overrides Venda
                matricula: record.matricula_encontrada || unity.matricula,
                arquivos: newArquivos,
                descricao_imovel: newDesc
            };

            // 5. Commit to unidades
            const { error: updErr } = await window.supabaseApp
                .from('unidades')
                .update(updatePayload)
                .eq('inscricao', record.inscricao_imobiliaria);
                
            if (updErr) throw updErr;

            // 6. Update Staging status
            await window.supabaseApp
                .from('caixa_leiloes_staging')
                .update({ status_aprovacao: 'aprovado', revisao_admin_id: user.id })
                .eq('id', id);

            window.Toast.success('Leilão Importado com Sucesso!');

            // Refresh UI
            if (window.Admin && typeof window.Admin.refreshTabs === 'function') {
                window.Admin.refreshTabs();
            }

        } catch (e) {
            console.error(e);
            window.Toast.error('Falha na Importação: ' + e.message);
        } finally {
            window.Loading.hide();
        }
    },

    reject: async function(id) {
        if (!confirm('Deseja descartar este leilão? Ele não entrará na base oficial.')) return;
        
        try {
            const { data: { user } } = await window.supabaseApp.auth.getUser();
            
            await window.supabaseApp
                .from('caixa_leiloes_staging')
                .update({ status_aprovacao: 'rejeitado', revisao_admin_id: user.id })
                .eq('id', id);

            window.Toast.info('Leilão descartado.');
            
            if (window.Admin && typeof window.Admin.refreshTabs === 'function') {
                window.Admin.refreshTabs();
            }
        } catch (e) {
            console.error(e);
            window.Toast.error('Erro ao rejeitar: ' + e.message);
        }
    }
};
