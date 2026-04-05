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
        // Update user stats before opening
        this.refreshHubStats();
        
        const hubOverlay = document.getElementById('global-hub-modal');
        if (hubOverlay) {
            hubOverlay.classList.add('active');
        }
    },

    closeHub() {
        const hubOverlay = document.getElementById('global-hub-modal');
        if (hubOverlay) {
            hubOverlay.classList.remove('active');
        }
    },

    refreshHubStats() {
        // Safe check for Monetization data
        const creditsVal = document.getElementById('hub-credits-value');
        const roleStr = document.getElementById('hub-premium-badge');
        
        if (window.Monetization && window.Monetization.userProfile) {
            const up = window.Monetization.userProfile;
            if (creditsVal) creditsVal.innerText = up.credits || 0;
            if (roleStr) {
                roleStr.innerHTML = up.role === 'start' ? '⭐ START' :
                                    up.role === 'pro' ? '💎 PRO' :
                                    up.role === 'vip' ? '👑 VIP' :
                                    up.role === 'master' ? '🛡️ MASTER' : '⭐ START';
            }

            // Hide or show Admin App
            const adminApp = document.getElementById('hub-app-admin');
            if (adminApp) {
                if (window.AdminNotificationManager && window.AdminNotificationManager.isAdminUser()) {
                    adminApp.style.display = 'flex';
                } else {
                    adminApp.style.display = 'none';
                }
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
            this.openAppModal('modal-app-crm');
        } else if (appId === 'wallet') {
            this.openAppModal('modal-app-wallet');
        } else if (appId === 'radar') {
            this.openAppModal('modal-app-radar');
        } else if (appId === 'analytics') {
            if (window.AnalyticsDashboard) window.AnalyticsDashboard.show();
        } else if (appId === 'support') {
            // Institutional
            if (window.Institutional) {
                // Mock event to pass to showMenu
                window.Institutional.showMenu({ target: document.body });
            }
        } else if (appId === 'admin') {
            if (window.Admin) window.Admin.showAdminPanel();
        }
    },

    openAppModal(modalId) {
        // Hide others first
        document.querySelectorAll('.app-modal').forEach(m => m.classList.remove('active'));
        
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
        }
    },

    closeAllAppModals() {
        document.querySelectorAll('.app-modal').forEach(m => m.classList.remove('active'));
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

                        <div id="hub-app-admin" class="hub-app-card app-admin" onclick="window.HubHandler.launchApp('admin')">
                            <div class="hub-app-icon"><i class="fas fa-shield-alt"></i></div>
                            <div class="hub-app-title">Master Panel</div>
                        </div>
                    </div>

                    <!-- FOOTER -->
                    <div class="hub-footer">
                        <button class="hub-footer-btn" onclick="window.HubHandler.closeHub(); window.NotificationsHandler && window.NotificationsHandler.toggleDropdown(event)">
                            <i class="fas fa-bell"></i> Notificações <span id="hub-notif-count" class="hub-notif-badge">0</span>
                        </button>
                        <button class="hub-footer-btn logout" onclick="window.HubHandler.closeHub(); window.Auth.logout()">
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
                    <div class="app-modal-body" style="text-align: center; padding: 40px;">
                        <i class="fas fa-fire" style="font-size: 60px; color: #f59e0b; margin-bottom: 20px;"></i>
                        <p style="color: #92400e; font-size: 15px; margin-bottom: 30px; font-weight: 500;">
                            O Farol IA rastreia o mercado para você.<br>Feche as janelas e ative os filtros de Oportunidade no Menu Lateral do Mapa.
                        </p>
                        <button onclick="window.HubHandler.closeAllAppModals(); document.querySelector('[data-search-type=\\'opportunity\\']').click();" 
                                style="background: #f59e0b; border: none; padding: 15px 30px; border-radius: 12px; color: white; font-weight: 800; font-size: 14px; cursor: pointer;">
                            <i class="fas fa-search-dollar"></i> Rodar Diagnóstico no Mapa Agora
                        </button>
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

// Auto-init logic
window.addEventListener('load', () => {
    // Wait for the app to structure, then init hub
    setTimeout(() => {
        window.HubHandler.init();
        
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
    }, 1500);
});
