/**
 * ONBOARDING HANDLER (Guided Tour)
 * Uses Intro.js to guide new users through the main features.
 * Overhauled for Premium UI (Dark Glassmorphism) and Didactical User Flow.
 */

window.Onboarding = {
    key: 'guarugeo_onboarding_v3', // Force restart to see new changes

    init() {
        console.log("🎓 Onboarding Module Initialized");
        this.injectPremiumCSS();
        this.addHelpButton();
    },

    injectPremiumCSS() {
        if (document.getElementById('onboarding-premium-css')) return;
        
        const style = document.createElement('style');
        style.id = 'onboarding-premium-css';
        style.innerHTML = `
            /* Welcome Modal Custom */
            .onboarding-welcome-modal {
                position: fixed;
                top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0, 0, 0, 0.7);
                backdrop-filter: blur(10px);
                z-index: 100000;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                transition: opacity 0.4s ease;
            }
            .onboarding-welcome-modal.active {
                opacity: 1;
            }
            .onboarding-welcome-content {
                background: rgba(15, 23, 42, 0.95);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 24px;
                padding: 40px;
                max-width: 480px;
                text-align: center;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                transform: scale(0.9);
                transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                color: white;
            }
            .onboarding-welcome-modal.active .onboarding-welcome-content {
                transform: scale(1);
            }
            .onboarding-icon-pulse {
                width: 80px; height: 80px;
                background: linear-gradient(135deg, #2563eb, #38bdf8);
                border-radius: 20px;
                display: flex; align-items: center; justify-content: center;
                margin: 0 auto 20px auto;
                font-size: 36px;
                box-shadow: 0 0 30px rgba(37, 99, 235, 0.5);
                animation: pulseGlow 2s infinite;
            }
            @keyframes pulseGlow {
                0% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.7); }
                70% { box-shadow: 0 0 0 15px rgba(37, 99, 235, 0); }
                100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); }
            }
            
            /* Intro JS Overrides (Premium Dark Mode) */
            .introjs-tooltip {
                background: rgba(15, 23, 42, 0.95) !important;
                backdrop-filter: blur(12px) !important;
                border: 1px solid rgba(255, 255, 255, 0.15) !important;
                color: white !important;
                border-radius: 16px !important;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6) !important;
                max-width: 420px !important;
                padding: 10px !important;
                font-family: inherit !important;
            }
            .introjs-arrow.top { border-bottom-color: rgba(15, 23, 42, 0.95) !important; }
            .introjs-arrow.bottom { border-top-color: rgba(15, 23, 42, 0.95) !important; }
            .introjs-arrow.left { border-right-color: rgba(15, 23, 42, 0.95) !important; }
            .introjs-arrow.right { border-left-color: rgba(15, 23, 42, 0.95) !important; }
            
            .introjs-tooltip-header { padding-right: 0 !important; }
            .introjs-tooltip-title {
                font-weight: 800 !important;
                font-size: 16px !important;
                color: #38bdf8 !important;
                margin-top: 5px !important;
            }
            .introjs-tooltiptext {
                font-size: 13px !important;
                color: #cbd5e1 !important;
                line-height: 1.6 !important;
                padding: 15px 0 !important;
            }
            /* Styling nested badges or bold text in instructions */
            .introjs-tooltiptext b { color: white; background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; font-weight: 700; }
            
            .introjs-button {
                background: rgba(255, 255, 255, 0.1) !important;
                color: white !important;
                border: 1px solid rgba(255, 255, 255, 0.2) !important;
                border-radius: 8px !important;
                padding: 8px 16px !important;
                font-weight: 700 !important;
                text-shadow: none !important;
                transition: all 0.2s !important;
            }
            .introjs-button:hover {
                background: rgba(255, 255, 255, 0.2) !important;
            }
            .introjs-nextbutton {
                background: #2563eb !important;
                border-color: #2563eb !important;
                box-shadow: 0 4px 10px rgba(37, 99, 235, 0.3) !important;
            }
            .introjs-nextbutton:hover {
                background: #3b82f6 !important;
            }
            .introjs-disabled {
                opacity: 0.4 !important;
                cursor: not-allowed !important;
            }
            .introjs-bullets ul li a {
                background: #475569 !important;
            }
            .introjs-bullets ul li a.active {
                background: #38bdf8 !important;
                box-shadow: 0 0 8px #38bdf8 !important;
            }
            .introjs-helperLayer {
                background: rgba(255, 255, 255, 0.03) !important;
                border: 2px dashed #38bdf8 !important;
                border-radius: 8px !important;
                box-shadow: 0 0 0 9999px rgba(0,0,0,0.7) !important;
            }
            .introjs-helperNumberLayer {
                background: #fbbf24 !important;
                color: #0f172a !important;
                font-weight: 800 !important;
                border: none !important;
            }
        `;
        document.head.appendChild(style);
    },

    checkAndStart() {
        const seen = localStorage.getItem(this.key);
        if (!seen) {
            console.log("🆕 Novo usuário (ou nova versão de onboarding). Iniciando fluxo...");
            this.showWelcomeModal();
        } else {
            console.log("ℹ️ Onboarding já concluído.");
        }
    },

    showWelcomeModal() {
        const overlay = document.createElement('div');
        overlay.className = 'onboarding-welcome-modal';
        
        overlay.innerHTML = `
            <div class="onboarding-welcome-content">
                <div class="onboarding-icon-pulse">
                    <i class="fas fa-satellite"></i>
                </div>
                <h2 style="font-size: 24px; font-weight: 800; margin-bottom: 10px;">GuarujaGeo Imóveis</h2>
                <div style="background: rgba(37, 99, 235, 0.1); border: 1px solid rgba(37, 99, 235, 0.2); border-radius: 12px; padding: 15px; margin-bottom: 20px;">
                    <p style="color: #60a5fa; font-size: 13px; font-weight: 700; margin: 0;">DOMINE O MERCADO COM INTELIGÊNCIA</p>
                </div>
                <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin-bottom: 25px; text-align: left;">
                    Este tour rápido ensinará como:<br><br>
                    ✅ <b>Explorar o Mapa:</b> Clicar em prédios e descobrir os donos de todos os apartamentos em segundos.<br>
                    ✅ <b>Elevar o Acesso:</b> Entender como os CRÉDITOS e PLANOS liberam dados sensíveis.<br>
                    ✅ <b>Lucrar Mais:</b> Usar o CRM e o Farol IA para fechar negócios blindados.
                </p>
                <button id="start-onboarding-btn" style="background: linear-gradient(to right, #2563eb, #10b981); width: 100%; border: none; padding: 14px; border-radius: 12px; color: white; font-weight: 800; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; transition: transform 0.2s; box-shadow: 0 4px 15px rgba(37,99,235,0.3);">
                    INICIAR MINHA JORNADA <i class="fas fa-rocket"></i>
                </button>
            </div>
        `;
        document.body.appendChild(overlay);

        // Animar entrada
        setTimeout(() => overlay.classList.add('active'), 50);

        document.getElementById('start-onboarding-btn').onclick = () => {
            overlay.classList.remove('active');
            setTimeout(() => {
                overlay.remove();
                this.startTour();
            }, 400);
        };
    },

    startTour(retryCount = 0) {
        if (!window.introJs) {
            if (retryCount < 5) {
                console.warn(`⚠️ Intro.js não detectado. Tentando novamente... (${retryCount + 1}/5)`);
                setTimeout(() => this.startTour(retryCount + 1), 1000);
                return;
            }
            console.error("❌ Intro.js falhou em carregar.");
            return;
        }

        const intro = introJs();

        intro.setOptions({
            steps: [
                {
                    title: "Busca Universal e Filtros 🔍",
                    intro: "A barra lateral inteira agora é dedicada à Busca! Pense nela como seu Motor de Pesquisa imobiliário. Digite ruas, donos ou edifícios aqui, aplique filtros logo abaixo e os resultados premium aparecerão na mesma listagem.",
                    element: document.querySelector('.search-box'),
                    position: 'bottom'
                },
                {
                    title: "O Novo Hub de Aplicativos 🍔",
                    intro: "Nós libertamos a tela para você! Limpamos todos os botões que enchiam a antiga sidebar e os movemos para este <b>Menu Hamburger</b>. Ao clicar aqui, você abrirá a sua Nuvem Operacional contendo o <b>Meu CRM</b>, <b>Radar Oportunidades</b>, <b>Carteira VIP</b> e seus botões de Perfil/Créditos.",
                    element: document.getElementById('hubToggleBtn'),
                    position: 'right' // Menu is top left, tooltip opens to the right
                },
                {
                    title: "Planos e Acessos Restritos ⭐",
                    intro: "Ao abrir o Menu Hamburger, você verá o seu Perfil. Como usuário inicial (Start), você enxerga dados de superfície do mapa. Para destravar os segredos imobiliários (Ver CPF, baixar matrículas e ligar para proprietários ocultos), será necessário migrar para <b>PRO</b> ou consumir <b>Créditos Ouro</b>.",
                    position: 'center'
                },
                {
                    title: "GuaruBot: Inteligência Artificial 🧠",
                    intro: "Este é o seu Assistente de Bolso IA 24h. Em vez de procurar no mapa, você pode simplesmente enviar uma ordem para ele: <i>'Ache imóveis gigantes na Enseada'</i>, e o GuaruBot fará a varredura.",
                    element: document.getElementById('ai-chat-trigger'),
                    position: 'left'
                },
                {
                    title: "Interação no Mapa 📍",
                    intro: "É aqui que a mágica final acontece. <b>Clique em qualquer Empreendimento (Hexágonos) ou Lotes Comuns</b> no mapa para mergulhar nas entranhas da construção, descobrir quem comprou e hackear as negociações.",
                    element: document.getElementById('map'),
                    position: 'center'
                },
                {
                    title: "Missão Concluída! 🚀",
                    intro: "Seja bem-vindo a elite do ramo imobiliário. Navegue no mapa, abra os edifícios e ative minitutoriais específicos que se abrirão automaticamente durante a exploração.",
                }
            ],
            showProgress: true,
            showBullets: true,
            exitOnOverlayClick: false,
            nextLabel: 'Próxima <i class="fas fa-chevron-right" style="font-size: 10px; margin-left: 5px;"></i>',
            prevLabel: '<i class="fas fa-chevron-left" style="font-size: 10px; margin-right: 5px;"></i> Voltar',
            doneLabel: 'Ir para o Mapa',
            dontShowAgain: true,
            dontShowAgainLabel: "Não mostrar mais"
        });

        intro.oncomplete(() => {
            localStorage.setItem(this.key, 'true');
            if (window.Toast) window.Toast.success("Tour Geral Finalizado! Aproveite a plataforma.");
        });
        intro.onexit(() => localStorage.setItem(this.key, 'true'));

        intro.start();
    },

    checkAndShowContextHelp(context, targetSelector) {
        const key = `guarugeo_help_${context}_v2`; // Forced restart for V2 detailed explanations
        if (localStorage.getItem(key)) return;

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
                        title: "🏢 Ficha do Empreendimento (Nível 1)",
                        intro: "Visão Macro. Aqui está o Nome oficial, o Endereço com número, CEP e também as principais <b>Amenidades e Lazer</b> que o condomínio oferece (Ex: Piscina, Quadra, Elevadores).",
                        position: 'bottom'
                    },
                    {
                        element: target.querySelector('.header-buttons-wrapper'),
                        title: "📍 Ações de Campo do Empreendimento",
                        intro: "Ferramentas práticas para a rua: Obtenha a rota via <b>Google Maps</b> ou <b>Waze</b>, abra o <b>Street View</b> para ver a fachada em 3D, ou sugira correções nos dados cadastrais colaborando com o GuarujaGeo.",
                        position: 'left'
                    },
                    {
                        element: target.querySelector('.lot-tooltip-body'), // The entire body container
                        title: "🚪 Tipologia e Distribuição",
                        intro: "Aqui você verá gráficos rápidos sobre como os imóveis estão distribuídos (Residencial, Comercial, Garagens). Os botões acima filtram para você ver apenas os apartamentos ou lojas.",
                        position: 'top'
                    },
                    {
                        element: target.querySelector('.units-grid') || target.querySelector('.lot-tooltip-body'),
                        title: "🏠 Lista Rica de Unidades",
                        intro: "Sem precisar subir, você vê as portas de todos os imóveis dentro desse condomínio. <br>Cada quadradinho é uma propriedade independente.<br><br><b>AÇÃO EXIGIDA:</b> Clique em uma dessas unidades agora para ir para a 'Visão de Raio-X' (Nível 2).",
                        position: 'top'
                    }
                ];
            } else if (context === 'unit') {
                steps = [
                    {
                        element: target.querySelector('.unit-tooltip-body'),
                        title: "🔑 Raio-X da Unidade (Nível 2)",
                        intro: "Você penetrou na camada física do imóvel. Aqui exibe-se a Inscrição Cadastral exata, Fração Ideal, Área Construída e se tem garagem.",
                        position: 'top'
                    },
                    {
                        element: target.querySelector('.dados-basicos'),
                        title: "💰 Valores Base (Plano Start)",
                        intro: "Qualquer usuário consegue ver o <b>Valor Venal</b> de IPTU. Mas atenção, isso é apenas a base tributária. Não é o valor real de mercado. O valor venal costuma ser 30% a 50% do valor comercial.",
                        position: 'bottom'
                    },
                    {
                        element: target.querySelector('.proprietario-card') || target.querySelector('[onclick*="getTelefone"]'),
                        title: "🔐 Desbloqueio Sensível (Plano PRO/VIP)",
                        intro: "Como Usuário Grátis você vê o primeiro nome. O Sobrenome, CPF Completo e botões para consultar WhatsApp ou Score dependem da sua assinatura. <b>Aviso: Descobrir contatos exige Créditos.</b>",
                        position: 'left'
                    },
                    {
                        element: target.querySelector('.tooltip-tabs'),
                        title: "📑 Navegação das Abas Seguras",
                        intro: "A Unidade se divide em 3 painéis:<br><ul><li><b>Geral:</b> Área, Planta, Proprietário Oculto.</li><li><b>Farol IA:</b> Avaliação inteligente de Preço de Mercado em relação à vizinhança.</li><li><b>Documentos:</b> Aqui moram as Matrículas, Alvarás e Guias de IPTU do imóvel.</li></ul>",
                        position: 'top'
                    }
                ];
            } else if (context === 'owner') {
                steps = [
                    {
                        element: target.querySelector('.proprietario-header'),
                        title: "👤 Dossiê Pessoal do Investidor (Nível 3)",
                        intro: "Chegamos ao último nível. Ao descobrir quem é o dono da unidade, o sistema forma o Dossiê Pessoa. Você verá dados cruzados como Idade provável e Faixa Salarial Estimada (Baseada em IBGE/TSE).",
                        position: 'bottom'
                    },
                    {
                        element: target.querySelector('.proprie-external-actions'),
                        title: "🕵️‍♂️ Background Check Cível",
                        intro: "Acione botões que trazem a ficha direta do <b>InfoSimples, Receita Federal, Tribunal de Justiça ou Jucesp</b>. Ideal para qualificar o credor antes da venda.",
                        position: 'left'
                    },
                    {
                        element: target.querySelector('.tooltip-tabs'),
                        title: "📂 O Império do Cliente",
                        intro: "Na aba <b>'Imóveis Ligados'</b>, a plataforma varre a cidade e te conta todos os outros cantos do Guarujá onde esse CPF é dono. Em <b>'Empresas'</b>, descobrimos de quais CNPJs este cliente é sócio, avaliando seu patrimônio geral.",
                        position: 'bottom'
                    }
                ];
            }

            if (steps.length > 0) {
                intro.setOptions({
                    steps: steps,
                    showProgress: true,
                    showBullets: true,
                    nextLabel: 'Saquei!',
                    prevLabel: 'Voltar',
                    doneLabel: 'Entendi Tudo',
                    scrollToElement: true
                });

                intro.onexit(() => localStorage.setItem(key, 'true'));
                intro.oncomplete(() => localStorage.setItem(key, 'true'));

                intro.start();
            }
        }, 1200);
    },

    addHelpButton() {
        const actionsContainer = document.querySelector('.header-actions');
        if (actionsContainer && !document.getElementById('restart-tour-btn')) {
            const btn = document.createElement('button');
            btn.id = 'restart-tour-btn';
            btn.innerHTML = '<i class="fas fa-graduation-cap"></i>';
            btn.title = "Rever Treinamento";
            btn.className = 'help-tour-btn';
            btn.style.cssText = "background: rgba(37,99,235,0.15); border: 1px solid rgba(37,99,235,0.3); font-size: 1rem; cursor: pointer; color: #60a5fa; width: 32px; height: 32px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s; margin-right: 10px;";
            
            btn.onmouseover = () => { btn.style.background = '#2563eb'; btn.style.color = '#fff'; };
            btn.onmouseout = () => { btn.style.background = 'rgba(37,99,235,0.15)'; btn.style.color = '#60a5fa'; };
            
            btn.onclick = () => {
                localStorage.removeItem(this.key);
                this.showWelcomeModal();
            };

            actionsContainer.insertBefore(btn, actionsContainer.firstElementChild);
        }
    }
};

window.Onboarding.init();
