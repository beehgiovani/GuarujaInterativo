// ==========================================
// REGIONAL HANDLER - REGIONAL_HANDLER.JS
// ==========================================
// Lógica para análise de investidores e estatísticas por região (Zona)

window.RegionalHandler = {
    
    /**
     * Mostra o ranking dos maiores investidores da zona atual
     */
    async showTopInvestors() {
        // SECURITY GUARD: Elite or above
        if (window.Monetization && !window.Monetization.canAccess('regional_insights') && !window.Monetization.isEliteOrAbove()) {
            window.Monetization.showSubscriptionPlans();
            window.Toast.info("Ranking de Tubarões é informação privilegiada de planos Elite/Master.");
            return;
        }

        const zoneId = window.currentZone; // Assuming zoneId is now taken from window.currentZone
        if (!zoneId) {
            window.Toast.error("Zona não identificada.");
            return;
        }

        window.Loading.show("Analisando Região...", `Mapeando proprietários da Zona ${zoneId}`);

        try {
            // Buscamos os top investidores (por contagem de unidades na zona)
            // Nota: Para precisão máxima, usamos RPC se disponível, ou agregação local
            const { data, error } = await window.supabaseApp.rpc('get_top_investors_by_zone', {
                p_zone: String(zoneId),
                p_limit: 10
            });

            if (error) {
                // Fallback: Tentativa via query convencional se RPC não existir
                return this.showFallbackRanking(zoneId);
            }

            this.renderRankingModal(zoneId, data);

        } catch (e) {
            console.error("Erro no ranking regional:", e);
            window.Toast.error("Erro ao processar análise regional.");
        } finally {
            window.Loading.hide();
        }
    },

    /**
     * Fallback caso a função RPC ainda não esteja no banco
     */
    async showFallbackRanking(zoneId) {
        // Busca unidades na zona
        const { data, error } = await window.supabaseApp
            .from('unidades')
            .select('nome_proprietario, cpf_cnpj, lote_inscricao')
            .ilike('inscricao', `${String(zoneId).padStart(2, '0')}%`)
            .limit(1000);

        if (error || !data) throw error;

        // Agregação manual
        const counts = {};
        data.forEach(u => {
            const name = u.nome_proprietario || 'Desconhecido';
            if (!counts[name]) counts[name] = { name, count: 0, doc: u.cpf_cnpj };
            counts[name].count++;
        });

        const ranking = Object.values(counts)
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        this.renderRankingModal(zoneId, ranking);
    },

    renderRankingModal(zoneId, investors) {
        const modal = document.createElement('div');
        modal.className = 'custom-modal-overlay active';
        modal.style.zIndex = '10005';
        
        const rowsHtml = investors.map((inv, idx) => `
            <div class="investor-ranking-row" style="
                display: flex; align-items: center; justify-content: space-between;
                padding: 12px 15px; border-radius: 12px; background: rgba(255,255,255,0.05);
                margin-bottom: 8px; border: 1px solid rgba(255,255,255,0.1);
                transition: all 0.2s;
            " onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <span style="font-weight: 900; color: ${idx < 3 ? '#f59e0b' : '#94a3b8'}; font-size: 14px; width: 20px;">#${idx + 1}</span>
                    <div>
                        <div style="font-weight: 700; color: white; font-size: 13px;">${inv.name || inv.nome_completo || 'Proprietário'}</div>
                        <div style="font-size: 10px; color: #94a3b8;">${inv.count || 0} propriedades nesta zona</div>
                    </div>
                </div>
                <button onclick="window.RegionalHandler.viewInvestor('${inv.name || inv.nome_completo}'); this.closest('.custom-modal-overlay').remove()" 
                    style="background: #7c3aed; color: white; border: none; padding: 6px 12px; border-radius: 8px; font-size: 10px; font-weight: 700; cursor: pointer;">
                    VER PORTFÓLIO
                </button>
            </div>
        `).join('');

        modal.innerHTML = `
            <div class="custom-modal" style="max-width: 500px; background: #0f172a; border: 1px solid #334155; color: white;">
                <div class="custom-modal-header" style="border-bottom: 1px solid #334155;">
                    <div class="custom-modal-title">
                        <i class="fas fa-chart-line" style="color: #f59e0b;"></i> Maiores Investidores • Zona ${zoneId}
                    </div>
                    <button class="custom-modal-close" style="color: white;" onclick="this.closest('.custom-modal-overlay').remove()">&times;</button>
                </div>
                <div class="custom-modal-body" style="padding: 20px;">
                    <p style="font-size: 12px; color: #94a3b8; margin-bottom: 20px;">
                        Detecção automática de "Tubarões" baseada na concentração de ativos mapeados nesta região.
                    </p>
                    <div style="max-height: 400px; overflow-y: auto; padding-right: 5px;">
                        ${rowsHtml}
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    viewInvestor(name) {
        if (window.PortfolioHandler) {
            window.PortfolioHandler.viewPortfolio(name);
        } else {
            window.Toast.error("Sistema de portfólio não carregado.");
        }
    }
};
