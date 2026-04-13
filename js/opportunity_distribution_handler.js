/**
 * js/opportunity_distribution_handler.js
 * Gerencia a recepção e visualização de oportunidades diretas para corretores assinantes.
 */

window.OpportunityHandler = {
    init() {
        console.log('🚀 Opportunity Handler: Ativo para Assinantes Elite/Pro.');
        this.setupListeners();
    },

    setupListeners() {
        // Ouve eventos do NotificationsHandler para reagir a 'owner_opportunity'
        window.addEventListener('notification-click', (e) => {
            const notif = e.detail;
            if (notif.tipo === 'owner_opportunity') {
                this.handleOpportunityClick(notif);
            }
        });
    },

    async handleOpportunityClick(notif) {
        const inscricao = notif.data_id;
        if (!inscricao) return;

        console.log('🎯 Focando na Oportunidade Direta:', inscricao);

        // 1. Zoom no Mapa para a unidade/lote
        if (window.mapHandler && window.mapHandler.zoomToLote) {
            window.mapHandler.zoomToLote(inscricao.substring(0, 8)); // Zoom no Lote
        }

        // 2. Abrir o Tooltip ou Painel de Detalhes
        if (window.AdminHandler && window.AdminHandler.openPanel) {
            window.AdminHandler.openPanel(inscricao.substring(0, 8));
        }

        // 3. Destacar visualmente (pode ser um pulso temporário)
        this.highlightOnMap(inscricao);
        
        window.Toast?.info("Oportunidade Direta: Dados do proprietário disponíveis para o seu plano.");
    },

    highlightOnMap(inscricao) {
        // Implementar lógica de destaque visual no mapa se necessário
        // Por exemplo, mudar a cor do polígono temporariamente
    },

    // Estatísticas para o Proprietário (chamado pelo portal_handler.js via RPC)
    async getDistributionStats(inscricao) {
        try {
            const { count, error } = await window.supabaseApp
                .from('notificacoes')
                .select('*', { count: 'exact', head: true })
                .eq('data_id', inscricao)
                .eq('tipo', 'owner_opportunity');

            return count || 0;
        } catch (e) {
            return 0;
        }
    }
};

// Inicialização
window.OpportunityHandler.init();
