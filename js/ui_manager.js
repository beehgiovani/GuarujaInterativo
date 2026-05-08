/**
 * UIManager.js
 * Orquestração central de componentes de interface (Sidebar, Modais, Toasts).
 * Bruno Giovani: Mantém o estado visual e a fluidez da navegação entre níveis.
 */

window.UIManager = {
    // Controle de estado pra saber o que tá aberto ou fechado
    state: {
        isSidebarOpen: true,
        isMobileMenuOpen: false
    },

    // Inicializa os ouvintes de eventos e a trilha de navegação
    init: function() {
        console.log("🎨 UIManager: Ativando componentes da interface...");
        this.bindEvents();
        this.updateBreadcrumbs();
    },

    bindEvents: function() {
        // Se clicar fora de um modal, ele fecha sozinho
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('settingsModal');
            if (e.target === modal) this.closeSettings();
        });

        // Controle do botão de menu no mobile
        const sidebarToggle = document.getElementById('sidebarToggle');
        if (sidebarToggle) {
            sidebarToggle.onclick = () => {
                if (document.body.classList.contains('sidebar-mobile-active')) {
                    this.closeMobileSidebar();
                } else {
                    this.openMobileSidebar();
                }
            };
        }
    },

    // --- MENUS LATERAIS (SIDEBARS) ---
    toggleSidebar: function() {
        const sidebar = document.getElementById('sidebar');
        const mapContainer = document.getElementById('map');
        
        if (!sidebar) return;

        this.state.isSidebarOpen = !this.state.isSidebarOpen;
        
        // Ajusta o mapa quando o menu abre/fecha no desktop
        if (this.state.isSidebarOpen) {
            sidebar.classList.remove('collapsed');
            if (mapContainer) mapContainer.style.marginLeft = "380px";
        } else {
            sidebar.classList.add('collapsed');
            if (mapContainer) mapContainer.style.marginLeft = "0";
        }
    },

    // Funções pra controlar o menu no celular
    closeMobileSidebar: function() {
        document.body.classList.remove('sidebar-mobile-active');
        const sidebar = document.getElementById('sidebar');
        const backdrop = document.getElementById('sidebarBackdrop');
        if (sidebar) sidebar.classList.remove('active');
        if (backdrop) backdrop.classList.remove('active');
        this.state.isSidebarOpen = false;
    },

    openMobileSidebar: function() {
        document.body.classList.add('sidebar-mobile-active');
        const sidebar = document.getElementById('sidebar');
        const backdrop = document.getElementById('sidebarBackdrop');
        if (sidebar) sidebar.classList.add('active');
        if (backdrop) backdrop.classList.add('active');
        this.state.isSidebarOpen = true;
    },

    // Atualiza a trilha de navegação baseada no nível atual do mapa
    updateBreadcrumbs: function() {
        const breadcrumbEl = document.getElementById('mapBreadcrumbs');
        if (!breadcrumbEl) return;

        let html = `<span onclick="window.goUpLevel()" class="breadcrumb-link">Início</span>`;

        if (window.currentLevel >= 1 && window.currentZone) {
            html += ` <i class="fas fa-chevron-right breadcrumb-sep"></i> 
                      <span onclick="window.currentLevel=1; window.renderHierarchy();" class="breadcrumb-item">Zona ${window.currentZone}</span>`;
        }

        if (window.currentLevel === 2 && window.currentSector) {
            html += ` <i class="fas fa-chevron-right breadcrumb-sep"></i> 
                      <span class="breadcrumb-active">Setor ${window.currentSector}</span>`;
        }

        breadcrumbEl.innerHTML = html;
        
        // Só mostra a barra se não estivermos no nível 0 (cidade inteira)
        if (window.currentLevel > 0) {
            breadcrumbEl.classList.remove('hidden');
        } else {
            breadcrumbEl.classList.add('hidden');
        }
    },

    // --- MODAIS GENÉRICOS ---
    openModal: function(id) {
        const el = document.getElementById(id);
        if (el) {
            el.classList.add('active');
            el.style.display = 'flex';
        }
    },

    // Cria e exibe um modal dinâmico com título e conteúdo HTML
    showModal: function(title, contentHTML) {
        // Remover modal dinâmico anterior se existir
        const oldModal = document.getElementById('dynamic-ui-modal');
        if (oldModal) oldModal.remove();

        const modalDiv = document.createElement('div');
        modalDiv.id = 'dynamic-ui-modal';
        modalDiv.className = 'custom-modal-overlay active';
        modalDiv.style.zIndex = '9999999';

        modalDiv.innerHTML = `
            <div class="custom-modal" style="max-width: 600px; width: 95%; max-height: 85vh; display: flex; flex-direction: column;">
                <div class="custom-modal-header" style="background: linear-gradient(135deg, #0f172a, #1e293b); color: white;">
                    <div class="custom-modal-title" style="font-size: 16px;">${title}</div>
                    <button class="custom-modal-close" onclick="this.closest('.custom-modal-overlay').remove()" style="color: white;">&times;</button>
                </div>
                <div class="custom-modal-body" style="padding: 24px; overflow-y: auto; background: #f8fafc; flex: 1;">
                    ${contentHTML}
                </div>
            </div>
        `;
        document.body.appendChild(modalDiv);
    },

    closeModal: function(id) {
        const el = document.getElementById(id);
        if (el) {
            el.classList.remove('active');
            // Dá um tempinho pra animação de fade-out terminar antes de sumir com o elemento
            setTimeout(() => {
                if (el) el.style.display = 'none';
            }, 300);
        }
    },

    // --- CONFIGURAÇÕES ---
    openSettings: function() {
        this.openModal('settingsModal');
    },

    closeSettings: function() {
        this.closeModal('settingsModal');
    },

    // --- TOASTS & FEEDBACK ---
    // (Ainda uso o Toast global, mas aqui é um atalho de boas-vindas)
    showWelcome: function(userName) {
        if (window.Toast) {
            window.Toast.success(`Bem-vindo de volta, ${userName}!`, "Acesso Autorizado");
        }
    }
};

// Atalhos pra não quebrar quem chama direto pelo window (compatibilidade)
window.toggleSidebar = () => window.UIManager.toggleSidebar();
window.updateBreadcrumbs = () => window.UIManager.updateBreadcrumbs();
window.openMobileSidebar = () => window.UIManager.openMobileSidebar();
window.closeMobileSidebar = () => window.UIManager.closeMobileSidebar();
window.openModal = (id) => window.UIManager.openModal(id);
window.closeModal = (id) => window.UIManager.closeModal(id);
window.openSettings = () => window.UIManager.openSettings();
window.closeSettings = () => window.UIManager.closeSettings();
