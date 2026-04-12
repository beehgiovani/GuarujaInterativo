/**
 * HUB HANDLER (Global Navigation 2.0)
 * Manages the Hamburger Menu, App Grid Hub, and App Modals.
 */

window.HubHandler = {
    init() {
        console.log("🔗 Hub Handler Initialized");
        this.buildHubModal();
        this.bindEvents();
    },

    bindEvents() {
        // Toggle from Hamburger Menu
        const toggleBtn = document.getElementById('hubToggleBtn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.openHub());
        }

        // Close when clicking outside modal
        const hubOverlay = document.getElementById('global-hub-modal');
        if (hubOverlay) {
            hubOverlay.addEventListener('click', (e) => {
                if(e.target === hubOverlay) this.closeHub();
            });
        }
    },

    openHub() {
        // Update user stats before opening (Protected)
        try { this.refreshHubStats(); } catch (e) { console.error('refreshHubStats:', e); }

        const hubOverlay = document.getElementById('global-hub-modal');
        if (hubOverlay) {
            hubOverlay.classList.add('active');
            // Dispara mini-tour do Hub apenas 1x
            if (window.Onboarding) setTimeout(() => window.Onboarding.checkHubTour(), 500);
        }
    },

    closeHub() {
        const hubOverlay = document.getElementById('global-hub-modal');
        if (hubOverlay) {
            hubOverlay.classList.remove('active');
        }
    },

    refreshHubStats() {
        const creditsVal = document.getElementById('hub-credits-value');
        const roleStr    = document.getElementById('hub-premium-badge');
        const adminApp   = document.getElementById('hub-app-admin');

        // Sempre esconde admin por padrão — só abre se role === 'master'
        const role = window.Monetization?.userRole || window.Monetization?.userProfile?.role || '';
        const isAdmin = (role === 'master');

        if (adminApp) adminApp.style.display = isAdmin ? 'flex' : 'none';

        if (window.Monetization?.userProfile) {
            const up = window.Monetization.userProfile;
            if (creditsVal) creditsVal.innerText = up.credits || 0;
            if (roleStr) {
                const badges = {
                    start:  '⭐ START',
                    pro:    '💎 PRO',
                    elite:  '🏆 ELITE',
                    vip:    '👑 VIP ANUAL',
                    master: '🛡️ ADMIN'
                };
                roleStr.innerHTML = badges[up.role] || '⭐ START';
            }
        }
    },

    /**
     * App Launchers
     */
    launchApp(appId) {
        this.closeHub();
        
        if (appId === 'map') {
            // Already there
            return;
        }

        if (appId === 'crm') {
            if (window.loadLeads) window.loadLeads();
            this.openAppModal('modal-app-crm');
        } else if (appId === 'wallet') {
            if (window.Monetization && window.Monetization.loadWallet) window.Monetization.loadWallet();
            this.openAppModal('modal-app-wallet');
        } else if (appId === 'radar') {
            this.openAppModal('modal-app-radar');
        } else if (appId === 'analytics') {
            if (window.AnalyticsDashboard) window.AnalyticsDashboard.show();
        } else if (appId === 'support') {
            // Treinamento -> Manual do Usuário
            if (window.Institutional) {
                window.Institutional.showTrainingModal();
            }
        } else if (appId === 'admin') {
            // SEGURANÇA: dupla verificação de role antes de abrir o painel
            const role = window.Monetization?.userRole || window.Monetization?.userProfile?.role || '';
            if (role !== 'master') {
                console.warn('🚫 Acesso negado ao Master Panel. Role:', role);
                if (window.Toast) window.Toast.error('🚫 Acesso restrito ao Administrador.');
                return;
            }
            if (window.Admin) window.Admin.showAdminPanel();
        }
    },

    openAppModal(modalId) {
        // Hide others first
        document.querySelectorAll('.app-modal').forEach(m => m.classList.remove('active'));

        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');

            // Dispara mini-tour dedicado do app (apenas 1x)
            if (window.Onboarding) {
                if (modalId === 'modal-app-crm')    setTimeout(() => window.Onboarding.checkCrmTour(),    600);
                if (modalId === 'modal-app-wallet') setTimeout(() => window.Onboarding.checkWalletTour(), 600);
                if (modalId === 'modal-app-radar')  setTimeout(() => window.Onboarding.checkRadarTour(),  600);
            }
        }
    },

    closeAllAppModals() {
        document.querySelectorAll('.app-modal').forEach(m => m.classList.remove('active'));
    },

    /** Ativa busca de Oportunidades defensivamente (chip pode estar oculto) */
    launchRadarSearch() {
        // Tenta clicar no chip de oportunidade
        const chip = document.querySelector('[data-search-type="opportunity"]');
        if (chip) {
            chip.click();
        } else if (typeof window.performOpportunitySearch === 'function') {
            // Fallback: dispara busca de oportunidade diretamente pelo handler  
            window.performOpportunitySearch();
            if (window.Toast) window.Toast.info("Radar ativado no mapa. Analise a lista abaixo.");
        } else {
            if (window.Toast) window.Toast.info('🔥 Ative o filtro "Farol Oportunidades" na barra lateral para rastrear o mercado!');
        }
    },

    buildHubModal() {
        // Injected into DOM logically
        if (document.getElementById('global-hub-modal')) return;

        const html = `
            <div id="global-hub-modal" class="global-hub-overlay">
                <div class="global-hub-container">
                    <button class="hub-close-btn" onclick="window.HubHandler.closeHub()"><i class="fas fa-times"></i></button>
                    
                    <!-- USER PROFILE BANNER -->
                    <div class="hub-profile-banner">
                        <div class="hub-user-info">
                            <div class="hub-user-avatar">
                                <i class="fas fa-user-tie"></i>
                            </div>
                            <div class="hub-user-details">
                                <h3 id="hub-user-name">Corretor Geo</h3>
                                <p id="hub-user-email">Carregando...</p>
                                <div id="hub-premium-badge" class="hub-premium-badge">⭐ START</div>
                            </div>
                        </div>
                        <div class="hub-credits-display" onclick="window.HubHandler.closeHub(); window.Monetization && window.Monetization.showSubscriptionPlans();">
                            <div class="hub-credits-title">Créditos Ouro</div>
                            <div class="hub-credits-value"><i class="fas fa-coins"></i> <span id="hub-credits-value">0</span></div>
                        </div>
                    </div>

                    <h4 style="margin: 0 0 10px 0; color: #cbd5e1; font-weight: 800; text-transform: uppercase; font-size: 12px; letter-spacing: 1px;">Menu de Aplicativos</h4>
                    
                    <!-- APPS GRID -->
                    <div class="hub-apps-grid">
                        <div class="hub-app-card app-map" onclick="window.HubHandler.launchApp('map')">
                            <div class="hub-app-icon" style="background: linear-gradient(135deg, #10b981, #059669);"><i class="fas fa-map-marked-alt"></i></div>
                            <div class="hub-app-title">Mapa Livre</div>
                        </div>
                        
                        <div class="hub-app-card app-crm" onclick="window.HubHandler.launchApp('crm')">
                            <div class="hub-app-icon"><i class="fas fa-users"></i></div>
                            <div class="hub-app-title">Meu CRM</div>
                        </div>
                        
                        <div class="hub-app-card app-wallet" onclick="window.HubHandler.launchApp('wallet')">
                            <div class="hub-app-icon"><i class="fas fa-box-open"></i></div>
                            <div class="hub-app-title">Carteira VIP</div>
                        </div>

                        <div class="hub-app-card app-radar" onclick="window.HubHandler.launchApp('radar')">
                            <div class="hub-app-icon"><i class="fas fa-fire"></i></div>
                            <div class="hub-app-title">Radar (Farol)</div>
                        </div>
                        
                        <div class="hub-app-card app-analytics" onclick="window.HubHandler.launchApp('analytics')">
                            <div class="hub-app-icon"><i class="fas fa-chart-line"></i></div>
                            <div class="hub-app-title">Analytics</div>
                        </div>
                        
                        <div class="hub-app-card app-support" onclick="window.HubHandler.launchApp('support')">
                            <div class="hub-app-icon"><i class="fas fa-life-ring"></i></div>
                            <div class="hub-app-title">Treinamento</div>
                        </div>

                        <div class="hub-app-card app-plans" onclick="window.HubHandler.closeHub(); window.Monetization && window.Monetization.showSubscriptionPlans();">
                            <div class="hub-app-icon" style="background: linear-gradient(135deg, #f59e0b, #d97706);"><i class="fas fa-crown"></i></div>
                            <div class="hub-app-title">Meu Plano</div>
                        </div>

                        <div id="hub-app-admin" class="hub-app-card app-admin" style="display:none;" onclick="window.HubHandler.launchApp('admin')">
                            <div class="hub-app-icon"><i class="fas fa-shield-alt"></i></div>
                            <div class="hub-app-title">Master Panel</div>
                        </div>
                    </div>

                    <!-- FOOTER -->
                    <div class="hub-footer">
                        <button class="hub-footer-btn" onclick="window.HubHandler.closeHub(); window.NotificationsHandler && window.NotificationsHandler.toggleDropdown(event)">
                            <i class="fas fa-bell"></i> Notificações <span id="hub-notif-count" class="hub-notif-badge">0</span>
                        </button>
                        <button class="hub-footer-btn logout" onclick="window.HubHandler.closeHub(); window.Auth && window.Auth.logout()">
                            Sair do Sistema <i class="fas fa-sign-out-alt"></i>
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- APP MODALS -->
            
            <!-- CRM Modal -->
            <div id="modal-app-crm" class="app-modal">
                <div class="app-modal-content">
                    <div class="app-modal-header">
                        <div>
                            <h2 style="margin:0; font-size: 22px; font-weight: 800; color: #1e293b;">Meu CRM Pessoal</h2>
                            <p style="margin:2px 0 0; font-size: 13px; color: #64748b;">Acompanhamento de Leads e Pipeline.</p>
                        </div>
                        <button class="app-modal-close" onclick="window.HubHandler.closeAllAppModals()">&times;</button>
                    </div>
                    <div class="app-modal-body" id="crm-modal-body-container">
                        <!-- CRM HTML will be moved here -->
                    </div>
                </div>
            </div>

            <!-- Wallet Modal -->
            <div id="modal-app-wallet" class="app-modal">
                <div class="app-modal-content">
                    <div class="app-modal-header">
                        <div>
                            <h2 style="margin:0; font-size: 22px; font-weight: 800; color: #1e293b;">Minha Carteira</h2>
                            <p style="margin:2px 0 0; font-size: 13px; color: #64748b;">Imóveis desbloqueados e guardados a sete chaves.</p>
                        </div>
                        <button class="app-modal-close" onclick="window.HubHandler.closeAllAppModals()">&times;</button>
                    </div>
                    <div class="app-modal-body" id="wallet-modal-body-container">
                        <!-- Wallet HTML will be moved here -->
                    </div>
                </div>
            </div>

            <!-- Radar Modal -->
            <div id="modal-app-radar" class="app-modal">
                <div class="app-modal-content" style="max-width: 600px; height: auto;">
                    <div class="app-modal-header" style="background: #fffbeb;">
                        <div>
                            <h2 style="margin:0; font-size: 22px; font-weight: 900; color: #92400e;">Radar de Oportunidades [BETA]</h2>
                        </div>
                        <button class="app-modal-close" style="background: rgba(245,158,11,0.2); color: #b45309;" onclick="window.HubHandler.closeAllAppModals()">&times;</button>
                    </div>
                    <div class="app-modal-body" style="text-align: center; padding: 20px;">
                        <i class="fas fa-fire" style="font-size: 40px; color: #f59e0b; margin-bottom: 20px;"></i>
                        <p style="color: #92400e; font-size: 13px; margin-bottom: 20px; font-weight: 500;">
                            A Inteligência Artificial rastreia o mercado.<br>Ative e descubra as melhores Oportunidades.
                        </p>
                        <button onclick="window.HubHandler.launchRadarSearch();" 
                                style="background: #f59e0b; border: none; padding: 12px 24px; border-radius: 12px; color: white; font-weight: 800; font-size: 14px; cursor: pointer; width: 100%; margin-bottom: 20px;">
                            <i class="fas fa-search-dollar"></i> Rodar Diagnóstico Agora
                        </button>
                        
                        <div id="prospecting-leads-list" style="text-align: left; max-height: 400px; overflow-y: auto;">
                            <div style="padding: 15px; background: #f8fafc; border-radius: 12px; border: 1px dashed #e2e8f0; color: #94a3b8; font-size: 11px; text-align: center;">
                                Ative o Radar acima para listar aqui investidores e oportunidades quentes.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', html);
        this.migrateLegacyDOM();
    },

    migrateLegacyDOM() {
        console.log("🚚 Migrando DOM da Sidebar para os Modais do Hub...");
        
        // Mover CRM
        const oldCrm = document.querySelector('#tab-crm > div');
        const crmContainer = document.getElementById('crm-modal-body-container');
        if (oldCrm && crmContainer) {
            crmContainer.appendChild(oldCrm);
        }
        
        // Mover Wallet
        const oldWallet = document.querySelector('#tab-wallet > div');
        const walletContainer = document.getElementById('wallet-modal-body-container');
        if (oldWallet && walletContainer) {
            walletContainer.appendChild(oldWallet);
        }

        // Remover da DOM os wrappers antigos
        const tabCrm = document.getElementById('tab-crm');
        const tabWallet = document.getElementById('tab-wallet');
        const tabProspecting = document.getElementById('tab-prospecting');
        if (tabCrm) tabCrm.remove();
        if (tabWallet) tabWallet.remove();
        if (tabProspecting) tabProspecting.remove(); // we recreated prospecting in the modal directly
    }
};

// Auto-init logic robusta
function bootHub() {
    if (!document.getElementById('global-hub-modal')) {
        window.HubHandler.init();
    }
    
    // Sync user info when Auth triggers
    if (window.supabaseApp) {
        window.supabaseApp.auth.getUser().then(({ data: { user } }) => {
            if (user) {
                const elName = document.getElementById('hub-user-name');
                const elEmail = document.getElementById('hub-user-email');
                if (elName) elName.innerText = user.user_metadata?.full_name || 'Corretor Geo';
                if (elEmail) elEmail.innerText = user.email;
            }
        });
    }
}

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', () => setTimeout(bootHub, 500));
} else {
    setTimeout(bootHub, 500);
}
