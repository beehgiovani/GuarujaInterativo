/**
 * ONBOARDING HANDLER (Guided Tour)
 * Uses Intro.js to guide new users through the main features.
 */

window.Onboarding = {
    key: 'guarugeo_onboarding_v1',

    init() {
        console.log("🎓 Onboarding Module Initialized");

        // Wait a bit for map/app to load
        // Wait a bit for map/app to load - MOVED TO APP.JS INIT
        // window.addEventListener('load', () => { ... });

        // Add 'Ajuda' button to sidebar header or somewhere accessible
        this.addHelpButton();
    },

    checkAndStart() {
        const seen = localStorage.getItem(this.key);
        if (!seen) {
            console.log("🆕 First time user detected. Starting tour...");
            this.startTour();
        } else {
            console.log("ℹ️ User has already seen the tour. Skipping.");
        }
    },

    startTour(retryCount = 0) {
        if (!window.introJs) {
            if (retryCount < 5) {
                console.warn(`⚠️ Intro.js not detected. Retrying... (${retryCount + 1}/5)`);
                setTimeout(() => this.startTour(retryCount + 1), 1000);
                return;
            }
            console.error("❌ Intro.js failed to load after retries.");
            return;
        }

        const intro = introJs();

        // Define Steps
        intro.setOptions({
            steps: [
                {
                    title: "Bem-vindo ao Omega Imóveis GeoMap 🗺️",
                    intro: "Esta é sua nova ferramenta de inteligência imobiliária. Vamos fazer um tour rápido?",
                },
                {
                    element: document.querySelector('.search-box'),
                    title: "Busca Inteligente 🔍",
                    intro: "Pesquise por <b>Endereço</b>, <b>Nome do Edifício</b>, <b>Nome do Proprietário</b> ou <b>Matrícula</b>. Tudo indexado.",
                    position: 'bottom'
                },
                {
                    element: document.querySelector('.filter-section'),
                    title: "Filtros de Busca 🏷️",
                    intro: "Refine sua pesquisa por: <b>Todos</b>, <b>Rua</b>, <b>Edifício</b>, <b>Proprietários</b> ou <b>Imóveis</b>.",
                    position: 'right'
                },
                {
                    element: document.querySelector('.crm-leads-btn'),
                    title: "Gestão de Clientes (CRM) 👥",
                    intro: "Acesse sua lista de leads e oportunidades clicando aqui.",
                    position: 'bottom'
                },
                {
                    element: document.getElementById('ai-chat-trigger'),
                    title: "🧠 GuaruBot (Novo!)",
                    intro: "Seu assistente de IA. Peça para ele: <br><i>'Busque apartamentos com 3 quartos na Enseada'</i> ou <i>'Quem é o dono deste lote?'</i>. Ele cruza dados para você.",
                    position: 'left'
                },
                {
                    element: document.getElementById('map'),
                    title: "Interação no Mapa 📍",
                    intro: "Clique em qualquer lote ou unidade para ver detalhes completos, fotos e documentos.",
                    position: 'center'
                },
                {
                    title: "Você está pronto! 🚀",
                    intro: "Explore o mapa e bons negócios! Este tutorial ficará disponível no botão de Ajuda e existem tutoriais específicos dentro das janelas de imóveis.",
                }
            ],
            showProgress: true,
            showBullets: false,
            exitOnOverlayClick: false,
            nextLabel: 'Próximo →',
            prevLabel: '← Voltar',
            doneLabel: 'Começar',
            dontShowAgain: true,
            dontShowAgainLabel: "Não mostrar mais"
        });

        // Check if intro instance is valid
        if (!intro || typeof intro.start !== 'function') {
            console.error("❌ Intro.js instance is invalid:", intro);
            return;
        }

        // Setup Callbacks safely
        if (typeof intro.oncomplete === 'function') {
            intro.oncomplete(() => {
                localStorage.setItem(this.key, 'true');
                if (window.Toast) window.Toast.success("Tour concluído! Aproveite o sistema.");
            });
        } else {
            console.warn("⚠️ intro.oncomplete method missing.");
        }

        if (typeof intro.onexit === 'function') {
            intro.onexit(() => {
                // Mark as seen even if skipped
                localStorage.setItem(this.key, 'true');
            });
        }

        // Start
        console.log("🚀 Starting Intro.js tour...");
        intro.start();
    },

    /**
     * Contextual Help for Specific Features (Lot, Unit, Owner)
     */
    checkAndShowContextHelp(context, targetSelector) {
        const key = `guarugeo_help_${context}_v1`;
        if (localStorage.getItem(key)) return; // Already seen

        if (!window.introJs) return;

        setTimeout(() => {
            const target = document.querySelector(targetSelector);
            if (!target) return;

            const intro = introJs();
            let steps = [];

            if (context === 'lot') {
                steps = [
                    {
                        element: target.querySelector('.lot-tooltip-header'),
                        title: "🏢 Detalhes do Edifício/Lote",
                        intro: "Aqui você vê o nome, endereço e recursos de lazer do condomínio.",
                        position: 'bottom'
                    },
                    {
                        element: target.querySelector('.thumbnail-grid') || target.querySelector('img'),
                        title: "📷 Galeria de Fotos",
                        intro: "Clique nas fotos para ampliar e ver em tela cheia.",
                        position: 'top'
                    },
                    {
                        element: target.querySelector('.header-buttons-wrapper'),
                        title: "📍 Ações Rápidas",
                        intro: "Use estes botões para navegar (GPS), ver Street View ou adicionar novas fotos.",
                        position: 'left'
                    },
                    {
                        element: target.querySelector('.lot-tooltip-body'),
                        title: "🏠 Lista de Unidades",
                        intro: "Aqui estão todas as unidades (Apartamentos, Lojas, Garagens). <br><b>Clique em uma unidade</b> para abrir a ficha completa dela.",
                        position: 'top'
                    }
                ];
            } else if (context === 'unit') {
                steps = [
                    {
                        element: target.querySelector('.unit-tooltip-body'),
                        title: "🔑 Ficha da Unidade",
                        intro: "Esta é a visão detalhada do imóvel. Você tem dados de área, valores e status.",
                        position: 'top'
                    },
                    {
                        element: target.querySelector('.tooltip-tabs'),
                        title: "📑 Abas de Informação",
                        intro: "Alterne entre: <br><b>Geral:</b> Dados básicos <br><b>Farol IA:</b> Análise de mercado e jurídica <br><b>Documentos:</b> Matrículas e contratos.",
                        position: 'bottom'
                    },
                    {
                        element: target.querySelector('.tooltip-tabs div:nth-child(2)'), // Farol
                        title: "🏮 Farol de Oportunidades",
                        intro: "Use esta aba para pedir à IA que avalie o preço ou verifique riscos jurídicos.",
                        position: 'bottom'
                    },
                    {
                        element: target.querySelector('.fa-search-dollar')?.parentElement,
                        title: "💰 Enriquecimento de Dados",
                        intro: "Clique aqui para consultar dados financeiros e de contato atualizados do proprietário (Consulta Avançada).",
                        position: 'left'
                    }
                ];
            } else if (context === 'owner') {
                steps = [
                    {
                        element: target.querySelector('.proprietario-header'),
                        title: "👤 Perfil do Proprietário",
                        intro: "Visão 360° do cliente. Veja idade, profissão e renda estimada.",
                        position: 'bottom'
                    },
                    {
                        element: target.querySelector('.tooltip-tabs'),
                        title: "📂 Tudo em um só lugar",
                        intro: "Navegue pelas abas para ver <b>Todos os Imóveis</b> dele, <b>Empresas</b> onde é sócio e <b>Certidões Jurídicas</b>.",
                        position: 'bottom'
                    },
                    {
                        element: target.querySelector('.fa-globe')?.parentElement, // InfoSimples/Receita
                        title: "🔍 Consultas Externas",
                        intro: "Use estes botões para puxar ficha na Receita Federal ou buscar contatos atualizados.",
                        position: 'left'
                    }
                ];
            }

            if (steps.length > 0) {
                intro.setOptions({
                    steps: steps,
                    showProgress: true,
                    showBullets: true,
                    nextLabel: 'Próximo',
                    prevLabel: 'Voltar',
                    doneLabel: 'Entendi',
                    scrollToElement: true
                });

                intro.onexit(() => localStorage.setItem(key, 'true'));
                intro.oncomplete(() => localStorage.setItem(key, 'true'));

                console.log(`🚀 Starting Context Help: ${context}`);
                intro.start();
            }
        }, 1000); // Wait for animation
    },

    addHelpButton() {
        // Find a place to put the help button. Maybe in the sidebar header actions.
        const actionsContainer = document.querySelector('.header-actions');
        if (actionsContainer) {
            const btn = document.createElement('button');
            btn.innerHTML = '❓';
            btn.title = "Reiniciar Tour / Ajuda";
            btn.style.cssText = "background: none; border: none; font-size: 1.1rem; cursor: pointer; color: #64748b;";
            btn.onclick = () => this.startTour();

            // Insert before logout
            actionsContainer.insertBefore(btn, actionsContainer.firstElementChild);
        }
    }
};

window.Onboarding.init();
