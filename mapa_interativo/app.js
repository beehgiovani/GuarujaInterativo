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
    // Sidebar Tabs
    window.switchSidebarTab = function (tab) {
        // Hide all contents
        document.querySelectorAll('.sidebar-tab-content').forEach(c => c.style.display = 'none');
        document.querySelectorAll('.sidebar-tabs .tab-btn').forEach(b => b.classList.remove('active'));

        const targetTab = document.getElementById(`tab-${tab}`);
        if (targetTab) {
            targetTab.style.display = 'block';
        } else {
            console.warn(`Tab content 'tab-${tab}' not found.`);
        }

        const targetBtn = document.querySelector(`.sidebar-tabs .tab-btn[onclick*="${tab}"]`);
        if (targetBtn) {
            targetBtn.classList.add('active');
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
    let deferredPrompt;
    const pwaBtn = document.getElementById('btn-pwa-install');
    const pwaIos = document.getElementById('pwa-ios-instructions');

    // Detect if is iOS
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

    if (isStandalone) {
        // Already installed
        const container = document.getElementById('pwa-install-container');
        if (container) container.style.display = 'none';
    } else if (isIos) {
        // Show iOS instructions
        if (pwaIos) pwaIos.style.display = 'block';
    }

    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent default browser prompt
        e.preventDefault();
        deferredPrompt = e;
        // Show our custom button
        if (pwaBtn) pwaBtn.style.display = 'inline-block';
    });

    if (pwaBtn) {
        pwaBtn.addEventListener('click', async () => {
            if (!deferredPrompt) return;
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`PWA install outcome: ${outcome}`);
            deferredPrompt = null;
            pwaBtn.style.display = 'none';
        });
    }
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
