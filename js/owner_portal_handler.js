/**
 * OWNER_PORTAL_HANDLER.JS - Gestão do Portal do Proprietário
 * Permite que proprietários identifiquem e gerenciem seus próprios imóveis.
 */

window.OwnerPortal = {
    myProperties: [],

    init() {
        console.log("🏠 Owner Portal Handler Initialized");
        this.buildPortalModal();
    },

    async openPortal() {
        const profile = window.Monetization?.userProfile;
        if (!profile) {
            window.Toast.error("Erro: Perfil de usuário não carregado.");
            return;
        }

        const cpf = profile.cpf_cnpj;
        if (!cpf) {
            window.Toast.warning("⚠️ Você precisa cadastrar seu CPF no perfil para acessar o portal.");
            if (window.Monetization && window.Monetization.showProfileCompletionModal) {
                window.Monetization.showProfileCompletionModal(['cpf_cnpj']);
            }
            return;
        }

        window.Loading.show("Buscando seus imóveis...", "Localizando registros vinculados ao seu CPF");
        
        try {
            // 1. Buscar o ID do proprietário na tabela 'proprietarios' pelo CPF
            const { data: propData, error: propError } = await window.supabaseApp
                .from('proprietarios')
                .select('id, nome_completo')
                .eq('cpf_cnpj', cpf.replace(/\D/g, ''))
                .maybeSingle();

            if (propError) throw propError;

            if (!propData) {
                this.renderEmptyState("Nenhum registro encontrado vinculado a este CPF. Entre em contato com o suporte para vincular seus imóveis.");
                return;
            }

            // 2. Buscar unidades vinculadas a este ID
            const { data: units, error: unitError } = await window.supabaseApp
                .from('unidades')
                .select(`
                    inscricao,
                    lote_inscricao,
                    tipo,
                    complemento,
                    metragem,
                    status_venda,
                    lotes (
                        building_name,
                        bairro,
                        zona
                    )
                `)
                .eq('proprietario_id', propData.id);

            if (unitError) throw unitError;

            this.myProperties = units || [];
            this.renderMyProperties(propData.nome_completo);

        } catch (e) {
            console.error("Portal Error:", e);
            window.Toast.error("Erro ao carregar portal.");
        } finally {
            window.Loading.hide();
            const modal = document.getElementById('modal-owner-portal');
            if (modal) modal.classList.add('active');
        }
    },

    buildPortalModal() {
        if (document.getElementById('modal-owner-portal')) return;

        const html = `
            <div id="modal-owner-portal" class="app-modal">
                <div class="app-modal-content" style="max-width: 800px;">
                    <div class="app-modal-header" style="background: linear-gradient(135deg, #1e293b, #0f172a); color: white;">
                        <div>
                            <h2 style="margin:0; font-size: 22px; font-weight: 800;">Portal do Proprietário</h2>
                            <p style="margin:2px 0 0; font-size: 13px; color: #94a3b8;">Gerencie seus imóveis mapeados no Guarujá.</p>
                        </div>
                        <button class="app-modal-close" style="color: white; opacity: 0.8;" onclick="window.OwnerPortal.closePortal()">&times;</button>
                    </div>
                    <div class="app-modal-body" id="owner-portal-body">
                        <div style="padding: 40px; text-align: center; color: #64748b;">
                            <i class="fas fa-circle-notch fa-spin" style="font-size: 32px; margin-bottom: 20px;"></i>
                            <p>Carregando sua carteira de imóveis...</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', html);
    },

    closePortal() {
        document.getElementById('modal-owner-portal')?.classList.remove('active');
    },

    renderEmptyState(msg) {
        const body = document.getElementById('owner-portal-body');
        if (!body) return;

        body.innerHTML = `
            <div style="padding: 60px 40px; text-align: center;">
                <div style="width: 80px; height: 80px; background: #f8fafc; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; font-size: 32px; color: #cbd5e1;">
                    🏠
                </div>
                <h3 style="color: #1e293b; font-weight: 800; margin-bottom: 8px;">Dados não localizados</h3>
                <p style="color: #64748b; font-size: 14px; max-width: 400px; margin: 0 auto 24px;">${msg}</p>
                <button onclick="window.OwnerPortal.closePortal()" style="padding: 12px 24px; background: #2563eb; color: white; border: none; border-radius: 10px; font-weight: 700; cursor: pointer;">
                    Voltar ao Mapa
                </button>
            </div>
        `;
    },

    renderMyProperties(ownerName) {
        const body = document.getElementById('owner-portal-body');
        if (!body) return;

        const listHtml = this.myProperties.map(u => {
            const lot = u.lotes || {};
            return `
                <div style="background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; display: flex; align-items: center; justify-content: space-between; transition: transform 0.2s; cursor: pointer;" 
                     onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'"
                     onclick="window.OwnerPortal.goToProperty('${u.lote_inscricao}')">
                    <div style="display: flex; gap: 16px; align-items: center;">
                        <div style="width: 48px; height: 48px; background: #f1f5f9; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px; color: #2563eb;">
                            <i class="fas fa-building"></i>
                        </div>
                        <div>
                            <h4 style="margin: 0; color: #1e293b; font-weight: 800;">${lot.building_name || 'Edifício s/ nome'}</h4>
                            <p style="margin: 2px 0 0; color: #64748b; font-size: 12px;">
                                ${lot.bairro || 'Bairro indefinido'} • Zona ${lot.zona || '?'}<br>
                                <b>Unidade:</b> ${u.complemento || 'Padrão'}
                            </p>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <span style="display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 10px; font-weight: 800; text-transform: uppercase; 
                                   background: ${u.status_venda === 'venda' ? '#ecfdf5' : '#f8fafc'}; 
                                   color: ${u.status_venda === 'venda' ? '#10b981' : '#64748b'}; 
                                   border: 1px solid ${u.status_venda === 'venda' ? '#10b98130' : '#e2e8f0'};">
                            ${u.status_venda === 'venda' ? 'Anunciado' : 'Privado'}
                        </span>
                        <div style="margin-top: 8px; font-size: 11px; color: #2563eb; font-weight: 700;">Ver no mapa →</div>
                    </div>
                </div>
            `;
        }).join('');

        body.innerHTML = `
            <div style="padding: 24px;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px;">
                    <div>
                        <h3 style="margin: 0; color: #1e293b;">Bem-vindo, <b>${ownerName}</b></h3>
                        <p style="margin: 4px 0 0; font-size: 13px; color: #64748b;">Localizamos ${this.myProperties.length} imóveis vinculados ao seu CPF.</p>
                    </div>
                    <button onclick="window.Toast.info('Funcionalidade de anúncio em breve!')" 
                            style="background: #10b981; color: white; border: none; padding: 10px 18px; border-radius: 10px; font-weight: 700; font-size: 13px; cursor: pointer;">
                        + Anunciar Novo
                    </button>
                </div>

                <div style="display: grid; grid-template-columns: 1fr; gap: 16px;">
                    ${listHtml}
                </div>
            </div>
        `;
    },

    goToProperty(loteInscricao) {
        this.closePortal();
        window.HubHandler.closeHub();
        if (window.selectLoteParaEdicao) {
            window.selectLoteParaEdicao(loteInscricao);
        } else if (window.searchByInscricao) {
            window.searchByInscricao(loteInscricao);
        }
    }
};

// Auto-init
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', () => window.OwnerPortal.init());
} else {
    window.OwnerPortal.init();
}
