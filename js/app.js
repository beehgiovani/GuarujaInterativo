// ==========================================
// GUARUJÁ GEOMAP - MAIN APP (APP.JS)
// ==========================================
// Entry point for the application.
// Handles initialization, authentication, and module coordination.

// DOM Elements
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');
const editorPanel = document.getElementById('editorPanel');
const formContainer = document.getElementById('formContainer');
const totalLotesEl = document.getElementById('totalLotes');
const totalEditedEl = document.getElementById('totalEdited');
const loginOverlay = document.getElementById('loginOverlay');
const loginUser = document.getElementById('loginUser');
const loginPass = document.getElementById('loginPass');
// btnLogin and others already defined via Auth handler or IDs

// Global State
window.map = null;
window.allLotes = [];
window.editedLotes = {};

// ========================================
// INITIALIZATION
// ========================================

async function init() {
    if (window.map) return; // Prevent double init
    
    console.log("🚀 Starting Guarujá GeoMap initialization...");
    Loading.show('Carregando Mapa...', 'Iniciando módulos');

    // 1. Initialize Map
    window.initMap();

    // 2. Initialize Module References
    window.initMapHandlerRefs({
        map: window.map,
        allLotes: window.allLotes,
        totalLotesEl: totalLotesEl
    });

    window.initEditorHandlerRefs({
        supabaseApp: window.supabaseApp,
        allLotes: window.allLotes,
        editedLotes: window.editedLotes,
        Loading: Loading,
        Toast: Toast
    });

    // Initialize CRM
    if (window.initCRM) {
        window.initCRM();
    }

    // 3. Setup Listeners
    window.setupSearchAndFilters();
    setupAppListeners();

    // 4. Load User Private Edits (Curation Rule)
    if (window.loadUserPendingEdits) {
        await window.loadUserPendingEdits();
    }

    // 5. Load Initial Data (Already handled in sync mode inside map_handler.js via window.initMap)
    // We just need to make sure UI is aware of completion if needed.
    // await loadInitialData(); 

    if (window.RenovationRadar) window.RenovationRadar.init();
    if (window.PushHandler) window.PushHandler.init();
    
    // Check for global alerts from Admin
    // checkGlobalAlert();
    // Start Onboarding (Moved to map_handler.js to wait for data load)
    // if (window.Onboarding) {
    //     setTimeout(() => window.Onboarding.checkAndStart(), 2000);
    // }

    Loading.hide();
    
    // Safety check: hide login if authenticated
    const loginOverlay = document.getElementById('loginOverlay');
    if (loginOverlay) loginOverlay.style.display = 'none';

    Toast.success('Bem-vindo ao Guarujá GeoMap!');

    // Recomendação de dispositivo para fluidez (UX)
    if (window.innerWidth <= 768) {
        showMobileExperienceWarning();
    }
}

/**
 * Exibe um alerta centralizado sugerindo o uso de Tablet ou Computador 
 * para uma melhor performance em dispositivos móveis.
 */
function showMobileExperienceWarning() {
    if (sessionStorage.getItem('guarugeo_mobile_warned')) return;

    const overlay = document.createElement('div');
    overlay.className = 'mobile-experience-alert-overlay';
    overlay.innerHTML = `
        <div class="mobile-experience-alert">
            <div class="mobile-experience-icon-wrap">
                <i class="fas fa-desktop"></i>
            </div>
            <h3>Experiência Otimizada</h3>
            <p>Para uma navegação mais fluida e acesso completo a todos os dados geoespaciais, recomendamos o uso de um <b>Tablet</b> ou <b>Computador</b>.</p>
            <button class="btn-mobile-warning" onclick="this.closest('.mobile-experience-alert-overlay').classList.remove('active'); setTimeout(()=>this.closest('.mobile-experience-alert-overlay').remove(), 500);">
                Entendi, Continuar
            </button>
            <div style="margin-top:15px; font-size:11px; color:#94a3b8;">
                Versão Mobile v2.0
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    // Fade in
    setTimeout(() => {
        overlay.classList.add('active');
        sessionStorage.setItem('guarugeo_mobile_warned', 'true');
    }, 1500);
}


async function loadInitialData() {
    Loading.show('Carregando Dados...', 'Baixando lotes do servidor');

    try {
        // Try Cache first
        const cache = await window.loadLotesFromCache();
        if (cache && cache.data && (Date.now() - cache.timestamp < 3600000)) {
            window.allLotes = cache.data;
            console.log("📦 Data loaded from Cache");
        } else {
            // Fetch from Supabase (Limit 2000 for demo performance, normally 50k)
            const { data, error } = await window.supabaseApp
                .from('lotes')
                .select('*')
                .limit(2000);

            if (error) throw error;
            window.allLotes = data;

            // Save to Cache
            window.saveLotesToCache(data);
            console.log("🌐 Data loaded from Server");
        }

        // Process and Render
        window.processDataHierarchy();
        window.renderHierarchy();

        if (totalLotesEl) totalLotesEl.innerText = window.allLotes.length.toLocaleString();

        // Auto-expand sidebar on mobile if results found
        if (window.innerWidth <= 768) {
            const sidebar = document.getElementById('sidebar');
            const backdrop = document.getElementById('sidebarBackdrop');
            if (sidebar) sidebar.classList.add('active');
            if (backdrop) backdrop.classList.add('active');
        }

    } catch (e) {
        console.error("Data load failed:", e);
        Toast.error("Falha ao carregar dados.");
    }
}

// ========================================
// UI HANDLERS & LISTENERS
// ========================================

function setupAppListeners() {
    // Sidebar Tabs (Redirecionado para o Hub 2.0)
    window.switchSidebarTab = function (tab) {
        if (tab === 'map') {
            if (window.HubHandler) window.HubHandler.closeAllAppModals();
            return;
        }

        // Tenta abrir via Hub
        if (window.HubHandler) {
            window.HubHandler.launchApp(tab);
        }

        if (tab === 'crm') {
            window.loadLeads?.(); // Safety optional chain
        }
        
        if (tab === 'wallet') {
            window.Monetization?.loadWallet();
        }
    };

    // Logout
    window.logout = async function () {
        if (confirm('Deseja realmente sair?')) {
            if (window.Auth && window.Auth.logout) {
                await window.Auth.logout();
            } else {
                localStorage.removeItem('guaruja_auth');
                location.reload();
            }
        }
    };

    // --- MOBILE: SIDEBAR TOGGLE ---
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');

    // Global helper to close sidebar
    window.closeMobileSidebar = () => {
        document.body.classList.remove('sidebar-mobile-active');
        if (sidebar) sidebar.classList.remove('active');
        if (backdrop) backdrop.classList.remove('active');
    };

    window.openMobileSidebar = () => {
        document.body.classList.add('sidebar-mobile-active');
        if (sidebar) sidebar.classList.add('active');
        if (backdrop) backdrop.classList.add('active');
    };

    if (sidebarToggle) {
        sidebarToggle.onclick = () => {
            // If active, close it. If inactive, open it.
            if (document.body.classList.contains('sidebar-mobile-active')) {
                window.closeMobileSidebar();
            } else {
                window.openMobileSidebar();
            }
        };
    }

    // CLICK OUTSIDE TO CLOSE (Backdrop)
    if (backdrop) {
        backdrop.onclick = () => {
            window.closeMobileSidebar();
        };
    }

    // --- PWA INSTALLATION LOGIC ---
    window.PWAHandler = {
        deferredPrompt: null,
        storageKey: 'guarugeo_pwa_prompt',
        
        init: function() {
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
            if (isStandalone) return;

            window.addEventListener('beforeinstallprompt', (e) => {
                e.preventDefault();
                this.deferredPrompt = e;
                this.checkAndShow();
            });

            window.addEventListener('appinstalled', () => {
                this.deferredPrompt = null;
                this.hide();
                localStorage.setItem(this.storageKey, 'installed');
            });
            
            // For iOS we can check and show manual instructions if needed.
            // But let's stick to the prompt structure.
            const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
            if (isIos && !isStandalone) {
                this.checkAndShow();
            }
        },

        checkAndShow: function() {
            const choice = localStorage.getItem(this.storageKey);
            if (choice === 'never' || choice === 'installed') return;
            
            if (choice === 'later') {
                const lastTime = localStorage.getItem(this.storageKey + '_time');
                if (lastTime && Date.now() - parseInt(lastTime) < 24 * 60 * 60 * 1000) return;
            }

            // Show after 3s delay
            setTimeout(() => this.show(), 3000);
        },

        show: function() {
            if (document.getElementById('pwa-custom-prompt')) return;

            const promptDiv = document.createElement('div');
            promptDiv.id = 'pwa-custom-prompt';
            promptDiv.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: white;
                padding: 20px;
                border-radius: 12px;
                box-shadow: 0 10px 25px rgba(0,0,0,0.2);
                z-index: 99999;
                max-width: 330px;
                border: 1px solid #e2e8f0;
                font-family: 'Inter', sans-serif;
                transform: translateY(150%);
                opacity: 0;
                transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            `;
            promptDiv.innerHTML = `
                <div style="display: flex; gap: 12px; align-items: flex-start; margin-bottom: 16px;">
                    <div style="background: #2563eb; color: white; width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 20px; box-shadow: 0 4px 10px rgba(37, 99, 235, 0.3);">
                        <i class="fas fa-cloud-download-alt"></i>
                    </div>
                    <div>
                        <div style="font-weight: 800; color: #1e293b; font-size: 15px; margin-bottom: 4px;">Instalar Aplicativo</div>
                        <div style="font-size: 12.5px; color: #64748b; line-height: 1.4;">Gostaria de baixar a versão para instalação e ter acesso rápido direto do seu celular ou computador?</div>
                    </div>
                </div>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <button id="pwa-btn-install" style="background: #2563eb; color: white; border: none; padding: 12px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#1d4ed8'" onmouseout="this.style.background='#2563eb'">
                        <i class="fas fa-download" style="margin-right: 6px;"></i> Baixar Agora
                    </button>
                    <div style="display: flex; gap: 8px;">
                        <button id="pwa-btn-later" style="flex: 1; background: #f8fafc; color: #475569; border: 1px solid #cbd5e1; padding: 10px; border-radius: 8px; font-weight: 600; font-size: 12px; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='#f8fafc'">Lembrar Depois</button>
                        <button id="pwa-btn-never" style="flex: 1; background: #fef2f2; color: #ef4444; border: 1px solid #fecaca; padding: 10px; border-radius: 8px; font-weight: 600; font-size: 12px; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#fee2e2'" onmouseout="this.style.background='#fef2f2'">Nunca</button>
                    </div>
                </div>
            `;

            document.body.appendChild(promptDiv);

            // Animate in
            requestAnimationFrame(() => {
                setTimeout(() => {
                    promptDiv.style.transform = 'translateY(0)';
                    promptDiv.style.opacity = '1';
                }, 100);
            });

            document.getElementById('pwa-btn-install').onclick = () => this.install();
            document.getElementById('pwa-btn-later').onclick = () => this.dismiss('later');
            document.getElementById('pwa-btn-never').onclick = () => this.dismiss('never');
        },

        hide: function() {
            const promptDiv = document.getElementById('pwa-custom-prompt');
            if (promptDiv) {
                promptDiv.style.transform = 'translateY(150%)';
                promptDiv.style.opacity = '0';
                setTimeout(() => promptDiv.remove(), 500);
            }
        },

        dismiss: function(type) {
            this.hide();
            localStorage.setItem(this.storageKey, type);
            if (type === 'later') {
                localStorage.setItem(this.storageKey + '_time', Date.now().toString());
            }
        },

        install: async function() {
            if (!this.deferredPrompt) {
                const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
                if(isIos) {
                    if(window.Toast) window.Toast.info("No iPhone: Toque no ícone Compartilhar e depois 'Adicionar à Tela de Início'");
                    else alert("No iPhone: Toque no ícone Compartilhar e depois 'Adicionar à Tela de Início'");
                } else {
                    if(window.Toast) window.Toast.warning("A instalação automática não está disponível no momento. Tente opções no menu do navegador.");
                    else alert("A instalação automática não está disponível no momento.");
                }
                this.hide();
                return;
            }
            this.deferredPrompt.prompt();
            const { outcome } = await this.deferredPrompt.userChoice;
            console.log(`PWA install outcome: ${outcome}`);
            this.deferredPrompt = null;
            this.hide();
        }
    };

    window.PWAHandler.init();
}

// Make init global so Auth can call it
window.init = init;

// Start Auth if available
document.addEventListener('DOMContentLoaded', () => {
    if (window.Auth) {
        window.Auth.init();
    }
});

// ========================================
// DATA FETCHING HELPER
// ========================================
window.fetchLotDetails = async function (inscricao) {
    try {
        const { data, error } = await window.supabaseApp
            .from('lotes')
            .select('*, unidades(*)')
            .eq('inscricao', inscricao)
            .single();

        if (error) {
            console.error("Error fetching lot details:", error);
            return null;
        }

        // Transform if needed (similar to loadInitialData)
        // Ensure metadata structure if app relies on it, or just use raw data
        // Map handler expects .metadata for some things, but search handler now checks both.
        // Let's add basic metadata wrapper for compatibility
        if (data) {
            data.metadata = {
                zona: data.zona,
                setor: data.setor,
                quadra: data.quadra,
                lote: data.lote_geo,
                bairro: data.bairro,
                endereco: data.endereco // if exists
            };

            // Vital for processDataHierarchy
            data.bounds_utm = {
                minx: data.minx,
                miny: data.miny,
                maxx: data.maxx,
                maxy: data.maxy
            };

            // Calculate coords if missing
            if (!data._lat && data.minx) {
                const cx = (data.minx + data.maxx) / 2;
                const cy = (data.miny + data.maxy) / 2;
                const ll = window.utmToLatLon(cx, cy);
                data._lat = ll.lat;
                data._lng = ll.lng;
            }
        }

        return data;
    } catch (e) {
        console.error("Exception fetching lot details:", e);
        return null;
    }
};

// ========================================
// GLOBAL NOTIFICATIONS (ADMIN CONTROLLED)
// ========================================
async function checkGlobalAlert() {
    try {
        const { data, error } = await window.supabaseApp
            .from('app_settings')
            .select('value')
            .eq('key', 'global_alert')
            .maybeSingle();

        if (error) throw error;
        if (!data || !data.value) return;

        const text = data.value.trim();
        if (!text) return;

        // Create alert bar if not exists
        let bar = document.getElementById('globalAlertBar');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'globalAlertBar';
            bar.className = 'global-alert-bar';
            document.body.appendChild(bar);
        }

        bar.innerHTML = `
            <i class="fas fa-bullhorn"></i>
            <div class="marquee-container">
                <div class="marquee-content">${text}</div>
            </div>
        `;
        bar.classList.add('active');

    } catch (e) {
        console.warn("Global alert skip:", e);
    }
}

console.log("✅ Main App (app.js) initialized");
