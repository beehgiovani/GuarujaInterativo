// Guarujá GeoMap - Ponto de Entrada Principal (app.js)
// Aqui é onde tudo começa: autenticação, início dos mapas e coordenação dos módulos.

// Pegando os elementos do DOM pra usar depois
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');
const editorPanel = document.getElementById('editorPanel');
const formContainer = document.getElementById('formContainer');
const totalLotesEl = document.getElementById('totalLotes');
const totalEditedEl = document.getElementById('totalEdited');
const loginOverlay = document.getElementById('loginOverlay');
const loginUser = document.getElementById('loginUser');
const loginPass = document.getElementById('loginPass');

// Estado global da aplicação (Single Source of Truth)
window.map = null;
window.allLotes = [];
window.editedLotes = {};

/**
 * Função de Inicialização principal
 * Roda logo que o mapa ou a autenticação estão prontos.
 */
async function init() {
    if (window.map) return; // Se o mapa já existir, não faz nada (evita duplicar)
    
    console.log("🚀 Iniciando o motor do Guarujá GeoMap...");
    Loading.show('Carregando Mapa...', 'Iniciando módulos');

    // 0. Liga a interface primeiro (Menu lateral, Breadcrumbs, etc)
    if (window.UIManager) window.UIManager.init();

    // 1. Carrega o mapa do Google
    window.initMap();

    // 2. Referências do mapa são lidas do 'window' global agora na nova arquitetura.

    window.initEditorHandlerRefs({
        supabaseApp: window.supabaseApp,
        allLotes: window.allLotes,
        editedLotes: window.editedLotes,
        Loading: Loading,
        Toast: Toast
    });

    // Inicia o CRM se ele estiver disponível
    if (window.initCRM) window.initCRM();

    // 3. Ativa os ouvintes de eventos (clicks, buscas, filtros)
    window.setupSearchAndFilters();
    setupAppListeners();
    setupPWAOfflineListeners();

    // 4. Inicia o gestor de PWA (Instalação no celular/desktop)
    if (window.PWAHandler) window.PWAHandler.init();

    // 5. Carrega as edições privadas que eu fiz e estão pendentes
    if (window.loadUserPendingEdits) {
        await window.loadUserPendingEdits();
    }

    // Liga módulos extras se eles existirem
    if (window.RenovationRadar) window.RenovationRadar.init();
    if (window.PushHandler) window.PushHandler.init();
    
    // Tira o loading da tela
    Loading.hide();
    
    // Se eu já estiver logado, esconde a tela de login na hora
    const loginOverlay = document.getElementById('loginOverlay');
    if (loginOverlay) loginOverlay.style.display = 'none';

    Toast.success('Tudo pronto! Guarujá GeoMap carregado.');

    // Se o cara tiver no celular, dou um toque que no PC é melhor
    if (window.innerWidth <= 768) {
        showMobileExperienceWarning();
    }
}

/**
 * Alerta de experiência mobile
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

    setTimeout(() => {
        overlay.classList.add('active');
        sessionStorage.setItem('guarugeo_mobile_warned', 'true');
    }, 1500);
}

/**
 * Carregamento inicial de dados
 */
async function loadInitialData() {
    Loading.show('Carregando Dados...', 'Sincronizando com o servidor');

    try {
        // Tenta o cache pra não precisar baixar tudo de novo
        const cache = await window.loadLotesFromCache();
        if (cache && cache.data && (Date.now() - cache.timestamp < 3600000)) {
            window.allLotes = cache.data;
            console.log("📦 Dados vindos do cache local");
        } else {
            console.log("🌐 Carregamento sob demanda ativado.");
            window.allLotes = [];
        }

        if (window.allLotes.length > 0) {
            window.processDataHierarchy();
            window.renderHierarchy();
            if (totalLotesEl) totalLotesEl.innerText = window.allLotes.length.toLocaleString();
        }

    } catch (e) {
        console.error("Falha ao carregar dados:", e);
    }
}

/**
 * Listeners globais do App
 */
function setupAppListeners() {
    // Troca de abas no menu lateral
    window.switchSidebarTab = function (tab) {
        if (tab === 'map') {
            if (window.HubHandler) window.HubHandler.closeAllAppModals();
            return;
        }

        if (window.HubHandler) window.HubHandler.launchApp(tab);
        if (tab === 'crm') window.loadLeads?.();
        if (tab === 'wallet') window.Monetization?.loadWallet();
    };

    // Logout do usuário
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

    // Fechar menu mobile se clicar no fundo
    const backdrop = document.getElementById('sidebarBackdrop');
    if (backdrop) {
        backdrop.onclick = () => {
            if (window.closeMobileSidebar) window.closeMobileSidebar();
        };
    }
}

/**
 * Busca detalhes de um lote específico (Inscrição)
 */
window.fetchLotDetails = async function (inscricao) {
    try {
        const { data, error } = await window.supabaseApp
            .from('lotes')
            .select('*, unidades(*)')
            .eq('inscricao', inscricao)
            .single();

        if (error) throw error;

        if (data) {
            // Normaliza os dados pra bater com o que o mapa espera
            data.metadata = {
                zona: data.zona,
                setor: data.setor,
                quadra: data.quadra,
                lote: data.lote_geo,
                bairro: data.bairro,
                endereco: data.endereco
            };
            data.bounds_utm = { minx: data.minx, miny: data.miny, maxx: data.maxx, maxy: data.maxy };

            if (!data._lat && data.minx) {
                const ll = window.utmToLatLon((data.minx + data.maxx) / 2, (data.miny + data.maxy) / 2);
                data._lat = ll.lat;
                data._lng = ll.lng;
            }
        }
        return data;
    } catch (e) {
        console.error("Erro ao buscar detalhes do lote:", e);
        return null;
    }
};

/**
 * Notificações Offline (PWA)
 */
function setupPWAOfflineListeners() {
    const updateStatus = () => {
        const isOnline = navigator.onLine;
        let banner = document.getElementById('pwa-offline-banner');
        
        if (!isOnline) {
            if (!banner) {
                banner = document.createElement('div');
                banner.id = 'pwa-offline-banner';
                banner.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; background: #ef4444; color: white; text-align: center; padding: 6px; font-size: 11px; font-weight: 800; z-index: 999999;';
                banner.innerHTML = '🚫 Você está offline. O app vai salvar tudo localmente.';
                document.body.appendChild(banner);
            }
        } else if (banner) {
            banner.style.background = '#10b981';
            banner.innerHTML = '✅ Conexão recuperada! Sincronizando...';
            setTimeout(() => banner.remove(), 2500);
        }
    };
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
}

// 🔥 GUARDIÃO ASSÍNCRONO DE AUTENTICAÇÃO E SESSÃO (SENTINELA)
// Fica monitorando falhas globais. Se a sessão corromper, houver dupla instância, 
// ou o token JWT falhar, ele intercepta na mesma hora e levanta o muro do Login.
window.addEventListener('unhandledrejection', async (event) => {
    const errorMsg = event.reason ? (event.reason.message || event.reason.toString()) : '';
    
    // Palavras-chave que indicam que a sessão ou permissão de rede (login) foi pro espaço
    const isAuthError = 
        errorMsg.includes('AuthApiError') || 
        errorMsg.includes('Refresh Token') || 
        errorMsg.includes('JWT') ||
        errorMsg.includes('401') ||
        errorMsg.includes('400') ||
        errorMsg.includes('ERR_NAME_NOT_RESOLVED') || // Intercepta falhas criticas de rede em scripts vitais
        errorMsg.includes('not authenticated');

    if (isAuthError) {
        console.error("🛡️ Sentinela detectou quebra de segurança/rede:", errorMsg);
        
        // Derruba a tela preta de loading que esconde a UI
        const splashScreen = document.getElementById('global-loading-overlay');
        if (splashScreen) splashScreen.style.display = 'none';

        // Bloqueia a tela com o login instantaneamente
        const loginOverlay = document.getElementById('loginOverlay');
        if (loginOverlay) {
            loginOverlay.style.display = 'flex';
        }
        
        // Aciona o logout para limpar tokens corrompidos silenciosamente
        if (window.Auth && typeof window.Auth.logout === 'function') {
            await window.Auth.logout();
        } else {
            localStorage.removeItem('guaruja_auth');
            window.location.reload();
        }
    }
});

// 🔥 GATILHO OFICIAL DE INICIALIZAÇÃO
// Assim que o DOM carregar, a primeira barreira a subir é a da Autenticação.
// O mapa só será carregado DEPOIS do Auth liberar.
document.addEventListener('DOMContentLoaded', () => {
    if (window.Auth && typeof window.Auth.init === 'function') {
        console.log("🔒 Booting Authentication Engine...");
        
        // Se o usuário já constar como não autenticado localmente, derrubamos o loading
        // para garantir que a interface de login apareça limpa
        if (!localStorage.getItem('guaruja_auth')) {
            const splashScreen = document.getElementById('global-loading-overlay');
            if (splashScreen) splashScreen.style.display = 'none';
        }

        window.Auth.init();
    } else {
        console.error("❌ Auth Handler not found! App cannot start safely.");
    }
});

console.log("✅ Main App (app.js) pronto e modularizado!");
