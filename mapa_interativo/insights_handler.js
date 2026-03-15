// ==========================================
// FAROL INSIGHTS - Inteligência de Mercado
// ==========================================

window.showFarolInsights = async function () {
    window.Loading.show("Farol analisando mercado...", "Cruzando oferta vs demanda...");

    try {
        // 1. Coletar dados de demanda (Leads ativos)
        const { data: leads } = await window.supabaseApp
            .from('leads')
            .select('tipo_imovel, zonas_interesse, valor_max')
            .eq('status', 'ativo');

        // 2. Coletar dados de oferta (Resumo das unidades disponíveis)
        const { data: units } = await window.supabaseApp
            .from('unidades')
            .select('tipo, lotes!inner(zona)') // REMOVE 'valor' to fix 400 Bad Request
            .eq('status_venda', 'Disponível');

        // 3. Preparar resumo para a IA
        const summary = {
            demanda: (leads || []).reduce((acc, lead) => {
                const key = `${lead.tipo_imovel || 'Imóvel'} na Zona ${lead.zonas_interesse?.[0] || '?'}`;
                acc[key] = (acc[key] || 0) + 1;
                return acc;
            }, {}),
            oferta: (units || []).reduce((acc, u) => {
                const key = `${u.tipo || 'Imóvel'} na Zona ${u.lotes?.zona || '?'}`;
                acc[key] = (acc[key] || 0) + 1;
                return acc;
            }, {})
        };

        const prompt = `Como seu Farol (Estrategista de Real Estate da Omega Imóveis), analise os seguintes dados de GAPS de mercado no Guarujá:
        
        DEMANDA (Leads procurando): ${JSON.stringify(summary.demanda)}
        OFERTA (O que temos no estoque): ${JSON.stringify(summary.oferta)}
        
        Sua tarefa:
        1. Identifique o maior "GAP" (Onde temos muita procura e pouco estoque).
        2. Dê uma direção de prospecção para o corretor (Ex: "Focar em captação de 2 dorms na Zona 2").
        3. Crie um "Alerta de Oportunidade" para a equipe de vendas.
        
        Seja direto, estratégico e encorajador.`;

        if (!window.Farol) {
            window.Toast.error("IA do Farol não inicializada.");
            return;
        }

        const result = await window.Farol.ask(prompt);

        // Mostrar em um modal de Insights
        const insightModal = document.createElement('div');
        insightModal.className = 'custom-modal-overlay active';
        insightModal.style.zIndex = '10001';
        insightModal.innerHTML = `
            <div class="custom-modal" style="max-width: 600px;">
                <div class="custom-modal-header" style="background: linear-gradient(135deg, #f59e0b, #d97706); color: white;">
                    <div class="custom-modal-title">🏮 Farol Insights: Oportunidades de Mercado</div>
                    <button class="custom-modal-close" onclick="this.closest('.custom-modal-overlay').remove()">&times;</button>
                </div>
                <div class="custom-modal-body" style="padding: 30px; line-height: 1.6; font-size: 14px; color: #334155;">
                    <div style="margin-bottom: 20px; font-weight: 700; color: #92400e; display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-bullseye"></i> Radar de Gaps (Oferta vs Procura)
                    </div>
                    <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 12px; padding: 25px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                        ${result.replace(/\n/g, '<br>')}
                    </div>
                    <div style="margin-top: 25px; padding: 15px; border-radius: 8px; background: #f8fafc; font-size: 12px; color: #64748b; border: 1px dashed #e2e8f0;">
                        *Dados baseados nos Leads ativos e Imóveis disponíveis no seu CRM Guarugeo.
                    </div>
                </div>
                <div style="text-align: center; padding: 20px; border-top: 1px solid #eee;">
                    <button class="btn-primary-rich" style="background: #f59e0b;" onclick="this.closest('.custom-modal-overlay').remove()">Mãos à obra!</button>
                </div>
            </div>
        `;
        document.body.appendChild(insightModal);

    } catch (e) {
        console.error("Erro Farol Insights:", e);
        window.Toast.error("Farol teve um problema ao cruzar dados de mercado.");
    } finally {
        window.Loading.hide();
    }
}
