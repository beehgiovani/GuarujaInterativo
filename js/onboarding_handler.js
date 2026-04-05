/**
 * ONBOARDING HANDLER 2.0 - Sistema de Mini-Tours Modulares
 * 
 * Arquitetura de Trilhas (Mini-Cursos Independentes):
 *   - Trilha 0: Tour Geral de Boas-Vindas (dispara 1x no primeiro login)
 *   - Trilha 1: Hub Hamburger (dispara 1x ao abrir o Hub pela 1ª vez)
 *   - Trilha 2: CRM Pessoal (dispara 1x ao abrir o CRM pela 1ª vez)
 *   - Trilha 3: Carteira VIP (dispara 1x ao abrir a Carteira pela 1ª vez)
 *   - Trilha 4: Radar / Farol (dispara 1x ao abrir o Radar pela 1ª vez)
 *   - Trilha 5: Ficha de Empreendimento (context-aware, ao abrir tooltip de lote)
 *   - Trilha 6: Unidade / Apartamento (context-aware)
 *   - Trilha 7: Proprietário / Dossiê (context-aware)
 */

window.Onboarding = {
    // Versão atual - mude para forçar reset do tour
    VERSION: 'v4',

    _keys: {
        main:    'guarugeo_tour_main_v4',
        hub:     'guarugeo_tour_hub_v4',
        crm:     'guarugeo_tour_crm_v4',
        wallet:  'guarugeo_tour_wallet_v4',
        radar:   'guarugeo_tour_radar_v4',
        lot:     'guarugeo_help_lot_v4',
        unit:    'guarugeo_help_unit_v4',
        owner:   'guarugeo_help_owner_v4',
    },

    /** ============================================================
     *  INICIALIZAÇÃO
     *  ========================================================== */
    init() {
        console.log('🎓 Onboarding 2.0 Inicializado');
        this.addHelpButton();
    },

    /** Lança automaticamente o tour principal apenas uma vez */
    checkAndStart() {
        if (!localStorage.getItem(this._keys.main)) {
            this.showWelcomeModal();
        }
    },

    /** Marca uma trilha como "vista" */
    _mark(key) {
        localStorage.setItem(key, 'true');
    },

    /** Checa se uma trilha já foi vista */
    _seen(key) {
        return !!localStorage.getItem(key);
    },

    /** ============================================================
     *  UTILIDADE: Executar tour seguro
     *  ========================================================== */
    _runTour(steps, options = {}, onDoneKey = null) {
        if (!window.introJs || steps.length === 0) return;

        const intro = introJs();
        intro.setOptions({
            steps,
            showProgress: true,
            showBullets: true,
            exitOnOverlayClick: true,
            scrollToElement: true,
            nextLabel: 'Próximo →',
            prevLabel: '← Voltar',
            doneLabel: '✅ Entendi!',
            ...options
        });

        if (onDoneKey) {
            intro.oncomplete(() => this._mark(onDoneKey));
            intro.onexit(() => this._mark(onDoneKey));
        }

        intro.start();
    },

    /** ============================================================
     *  TRILHA 0: TOUR GERAL DE BOAS-VINDAS
     *  ========================================================== */
    showWelcomeModal() {
        if (document.getElementById('onboarding-welcome-modal')) return;

        const overlay = document.createElement('div');
        overlay.id = 'onboarding-welcome-modal';
        overlay.className = 'onboarding-welcome-modal';

        overlay.innerHTML = `
            <div class="onboarding-welcome-content">
                <div class="onboarding-icon-pulse">
                    <i class="fas fa-satellite"></i>
                </div>
                <h2 style="font-size: clamp(20px,4vw,26px); font-weight: 900; margin-bottom: 8px;">GuarujaGeo 2.0</h2>
                <p style="color: #38bdf8; font-weight: 700; font-size: 13px; margin-bottom: 18px; text-transform: uppercase; letter-spacing: 1px;">Inteligência Imobiliária de Guarujá</p>
                
                <div style="background: rgba(37,99,235,0.08); border: 1px solid rgba(37,99,235,0.2); border-radius: 14px; padding: 18px; margin-bottom: 22px; text-align: left;">
                    <p style="color: #94a3b8; font-size: 13px; line-height: 1.7; margin: 0;">
                        Este tour rápido (4 passos) vai te mostrar como:<br><br>
                        🗺️ <b style="color:#e2e8f0;">Explorar o mapa</b> — Clicar em prédios e descobrir os donos.<br>
                        🍔 <b style="color:#e2e8f0;">O Hub de Aplicativos</b> — Acesse CRM, Radar e Carteira.<br>
                        🔍 <b style="color:#e2e8f0;">A Busca Avançada</b> — Encontre qualquer lote ou proprietário.<br>
                        💎 <b style="color:#e2e8f0;">Créditos e Planos</b> — O que cada nível de acesso libera.
                    </p>
                </div>

                <button id="start-onboarding-btn" style="background: linear-gradient(135deg, #2563eb, #10b981); width: 100%; border: none; padding: 15px; border-radius: 12px; color: white; font-weight: 800; font-size: 15px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; transition: transform 0.2s; box-shadow: 0 6px 20px rgba(37,99,235,0.35); margin-bottom: 10px;">
                    INICIAR TOUR AGORA <i class="fas fa-rocket"></i>
                </button>
                <button id="skip-onboarding-btn" style="background: none; width: 100%; border: none; padding: 10px; color: #475569; font-size: 13px; cursor: pointer;">
                    Pular, já conheço a plataforma
                </button>
            </div>
        `;

        document.body.appendChild(overlay);
        setTimeout(() => overlay.classList.add('active'), 60);

        document.getElementById('start-onboarding-btn').onclick = () => {
            overlay.classList.remove('active');
            setTimeout(() => {
                overlay.remove();
                this.startMainTour();
            }, 400);
        };

        document.getElementById('skip-onboarding-btn').onclick = () => {
            overlay.classList.remove('active');
            setTimeout(() => {
                overlay.remove();
                this._mark(this._keys.main);
            }, 400);
        };
    },

    startMainTour() {
        const steps = [
            {
                title: '🍔 Seu Hub de Aplicativos',
                intro: 'Este é o <b>botão central</b> da plataforma. Ao clicar aqui, abre-se o seu <b>Hub Operacional</b> com acesso a todos os aplicativos: CRM, Carteira VIP, Radar de Oportunidades e Analytics. Mini-tutoriais se abrirão automaticamente na primeira vez que você acessar cada um!',
                element: document.getElementById('hubToggleBtn'),
                position: 'right'
            },
            {
                title: '🔍 Sua Central de Pesquisa',
                intro: 'A barra lateral agora é um <b>Motor de Busca Imobiliário</b> completo. Digite ruas, nomes de edifícios ou proprietários. Use os <b>filtros abaixo</b> para refinar sua busca por tipo (Rua / Edifício / Imóveis). Os resultados aparecem aqui em cards premium.',
                element: document.querySelector('.search-box'),
                position: 'right'
            },
            {
                title: '🗺️ Interação com o Mapa',
                intro: 'O mapa é seu campo de batalha. <b>Clique em qualquer Hexágono</b> (Empreendimento) ou Lote para abrir a Ficha Completa do imóvel — com tipologia, proprietários e dados cadastrais. Um novo tooltip de contexto te ensinará cada seção na primeira vez.',
                element: document.getElementById('map'),
                position: 'center'
            },
            {
                title: '💎 Planos e Créditos Ouro',
                intro: `<b>Start (Grátis):</b> Vê dados gerais, Valor Venal e o primeiro nome do proprietário.<br><br>
                        <b>PRO:</b> Desbloqueia CPF, telefone e contatos WhatsApp.<br><br>
                        <b>VIP:</b> Acesso ao Farol IA, matrículas completas e Background Check.<br><br>
                        <b>MASTER:</b> Busca por nome de Proprietário, painel admin e tudo sem limites.<br><br>
                        💰 <b>Créditos Ouro</b> permitem desbloquear dados individualmente, sem plano fixo.`,
                position: 'center'
            },
            {
                title: '🚀 Tudo Pronto!',
                intro: 'Você está na elite do mercado imobiliário de Guarujá. Explore o mapa, acesse o Hub e use o GuaruBot (IA) quando precisar de uma busca avançada. <b>Mini-Cursos específicos</b> irão aparecer automaticamente na primeira vez que você usar cada ferramenta!',
                position: 'center'
            }
        ];

        this._runTour(steps, {
            doneLabel: '🗺️ Ir para o Mapa',
        }, this._keys.main);
    },

    /** ============================================================
     *  TRILHA 1: HUB HAMBURGER (primeira abertura)
     *  ========================================================== */
    checkHubTour() {
        if (this._seen(this._keys.hub)) return;

        setTimeout(() => {
            const hubContainer = document.querySelector('.global-hub-container');
            if (!hubContainer) return;

            const steps = [
                {
                    title: '🍔 Bem-vindo ao Hub!',
                    intro: 'Este é o <b>centro de comando</b> do GuarujaGeo. Aqui ficam todos seus aplicativos profissionais. Seu perfil e créditos ficam sempre visíveis no topo.',
                    element: document.querySelector('.hub-profile-banner'),
                    position: 'bottom'
                },
                {
                    title: '🎯 Seus Aplicativos',
                    intro: 'Cada ícone aqui é um <b>App Independente</b>.<br><br>' +
                           '👥 <b>CRM:</b> Gerencie seus leads e pipeline.<br>' +
                           '📦 <b>Carteira VIP:</b> Imóveis salvos para você.<br>' +
                           '🔥 <b>Radar:</b> Oportunidades rastreadas pela IA.<br>' +
                           '📊 <b>Analytics:</b> Dados de uso da plataforma.',
                    element: document.querySelector('.hub-apps-grid'),
                    position: 'top'
                },
                {
                    title: '🔔 Notificações e Saída',
                    intro: 'No rodapé, acesse suas <b>Notificações</b> do sistema ou finalize sua sessão com segurança.',
                    element: document.querySelector('.hub-footer'),
                    position: 'top'
                }
            ];

            this._runTour(steps, { exitOnOverlayClick: true, doneLabel: '✅ Entendi o Hub!' }, this._keys.hub);
        }, 600);
    },

    /** ============================================================
     *  TRILHA 2: CRM PESSOAL (primeira abertura)
     *  ========================================================== */
    checkCrmTour() {
        if (this._seen(this._keys.crm)) return;

        setTimeout(() => {
            const crmBody = document.getElementById('crm-modal-body-container');
            if (!crmBody) return;

            const steps = [
                {
                    title: '👥 Meu CRM Pessoal',
                    intro: 'O CRM é o seu <b>Gerenciador de Relacionamentos</b>. Cadastre clientes interessados, adicione notas sobre cada contato e acompanhe em qual etapa da venda eles estão.',
                    element: crmBody,
                    position: 'center'
                },
                {
                    title: '🔄 Pipeline de Vendas',
                    intro: 'Use as colunas para mover seus contatos: <b>Novo Lead → Em Contato → Proposta Enviada → Fechado</b>. Cada card de cliente pode ter imóveis de interesse associados diretamente do mapa.',
                    element: crmBody,
                    position: 'top'
                }
            ];

            this._runTour(steps, { doneLabel: '✅ Entendido!' }, this._keys.crm);
        }, 700);
    },

    /** ============================================================
     *  TRILHA 3: CARTEIRA VIP (primeira abertura)
     *  ========================================================== */
    checkWalletTour() {
        if (this._seen(this._keys.wallet)) return;

        setTimeout(() => {
            const walletBody = document.getElementById('wallet-modal-body-container');
            if (!walletBody) return;

            const steps = [
                {
                    title: '📦 Minha Carteira VIP',
                    intro: 'Aqui ficam todos os imóveis que você <b>desbloqueou ou salvou</b> durante sua exploração no mapa. Nenhum dado descoberto é perdido — eles vivem aqui para sempre.',
                    element: walletBody,
                    position: 'center'
                },
                {
                    title: '🔑 Como Adicionar Imóveis',
                    intro: 'Enquanto explora o mapa e abre a <b>Ficha de qualquer Unidade</b>, você verá o botão <b>💎 Salvar na Carteira</b>. Ao clicar, o imóvel aparece aqui com todos os dados que você desbloqueou.',
                    element: walletBody,
                    position: 'top'
                }
            ];

            this._runTour(steps, { doneLabel: '✅ Entendido!' }, this._keys.wallet);
        }, 700);
    },

    /** ============================================================
     *  TRILHA 4: RADAR / FAROL (primeira abertura)
     *  ========================================================== */
    checkRadarTour() {
        if (this._seen(this._keys.radar)) return;

        setTimeout(() => {
            const radarBody = document.getElementById('modal-app-radar');
            const sidebar = document.getElementById('sidebar');
            if (!radarBody) return;

            const steps = [
                {
                    title: '🔥 Radar de Oportunidades [BETA]',
                    intro: 'O <b>Farol IA</b> analisa dados históricos, IPTU vencido e tempo de mercado para identificar imóveis com <b>alta probabilidade de negociação</b>. Ele rastreia o mercado por você.',
                    element: radarBody,
                    position: 'center'
                },
                {
                    title: '📋 Resultados na Barra Lateral',
                    intro: 'Ao acionar o diagnóstico, o Radar <b>fecha esta janela</b> e envia os resultados ranqueados diretamente para a <b>Barra Lateral de Pesquisa</b> (à sua esquerda). Cada card mostra o score de oportunidade.',
                    element: sidebar || radarBody,
                    position: 'right'
                },
                {
                    title: '🎯 Filtrando no Mapa',
                    intro: 'Use o filtro <b>"Farol Oportunidades"</b> na Sidebar para ver apenas os lotes de alto potencial destacados no mapa. Combine com a busca por bairro para precisão cirúrgica.',
                    element: document.querySelector('.filter-chips') || radarBody,
                    position: 'right'
                }
            ];

            this._runTour(steps, { doneLabel: '🔥 Vamos Rastrear!' }, this._keys.radar);
        }, 700);
    },

    /** ============================================================
     *  TRILHAS CONTEXT-AWARE (Tooltips de Fichas do Mapa)
     *  ========================================================== */
    checkAndShowContextHelp(context, targetSelector) {
        const key = this._keys[context];
        if (!key || this._seen(key)) return;
        if (!window.introJs) return;

        setTimeout(() => {
            const target = document.querySelector(targetSelector);
            if (!target) return;

            let steps = [];

            if (context === 'lot') {
                steps = [
                    {
                        element: target.querySelector('.lot-tooltip-header') || target,
                        title: '🏢 Ficha do Empreendimento (Nível 1)',
                        intro: 'Visão geral do condomínio. Aqui estão o <b>Nome Oficial</b>, Endereço completo, CEP e as principais <b>Amenidades</b> (Piscina, Quadra, Elevadores). Esses dados são acessíveis a todos os planos.',
                        position: 'bottom'
                    },
                    {
                        element: target.querySelector('.header-buttons-wrapper') || target,
                        title: '📍 Ferramentas de Campo',
                        intro: 'Botões de ação rápida: <b>Google Maps</b> ou <b>Waze</b> para navegar até o imóvel, <b>Street View</b> para ver a fachada em 360°, e opção de sugerir correções nos dados cadastrais.',
                        position: 'left'
                    },
                    {
                        element: target.querySelector('.units-grid') || target.querySelector('.lot-tooltip-body') || target,
                        title: '🏠 Lista de Unidades — Clique para Mergulhar!',
                        intro: 'Cada quadrado é um <b>imóvel independente</b> dentro do condomínio (apartamento, loja, garagem). <b>Clique em qualquer unidade</b> para acessar a "Visão de Raio-X" com dados do proprietário.',
                        position: 'top'
                    }
                ];
            } else if (context === 'unit') {
                steps = [
                    {
                        element: target.querySelector('.unit-tooltip-body') || target,
                        title: '🔑 Raio-X da Unidade (Nível 2)',
                        intro: 'Camada física do imóvel. Aqui estão a <b>Inscrição Cadastral</b> exata, Fração Ideal, Área Construída e localização da vaga de garagem.',
                        position: 'top'
                    },
                    {
                        element: target.querySelector('.dados-basicos') || target,
                        title: '💰 Valor Venal (Plano Start)',
                        intro: 'Qualquer usuário vê o <b>Valor Venal de IPTU</b>. Atenção: este é o valor tributário, geralmente <b>30% a 50% abaixo</b> do valor real de mercado.',
                        position: 'bottom'
                    },
                    {
                        element: target.querySelector('.proprietario-card') || target,
                        title: '🔐 Proprietário — Acesso por Plano',
                        intro: '<b>Start:</b> Primeiro nome apenas.<br><b>PRO:</b> Nome completo + CPF mascarado.<br><b>VIP:</b> CPF completo + botão WhatsApp.<br><b>MASTER:</b> Dossiê completo + Background Check.<br><br><b>Créditos Ouro</b> permitem desbloquear individualmente.',
                        position: 'left'
                    },
                    {
                        element: target.querySelector('.tooltip-tabs') || target,
                        title: '📑 Abas da Unidade',
                        intro: '<b>Geral:</b> Planta, área e proprietário.<br><b>Farol IA:</b> Avaliação inteligente de preço vs. vizinhança.<br><b>Documentos:</b> Matrículas, Alvarás e Guias de IPTU.',
                        position: 'top'
                    }
                ];
            } else if (context === 'owner') {
                steps = [
                    {
                        element: target.querySelector('.proprietario-header') || target,
                        title: '👤 Dossiê Pessoal (Nível 3)',
                        intro: 'Nível máximo de inteligência. O sistema cruza dados de <b>IBGE/TSE</b> para estimar Idade provável e Faixa Salarial do proprietário — informação estratégica para abordagem.',
                        position: 'bottom'
                    },
                    {
                        element: target.querySelector('.proprie-external-actions') || target,
                        title: '🕵️ Background Check Cível',
                        intro: 'Acione consultas diretas no <b>InfoSimples, Receita Federal, Tribunal de Justiça e Jucesp</b>. Qualifique o cliente antes da proposta.',
                        position: 'left'
                    },
                    {
                        element: target.querySelector('.tooltip-tabs') || target,
                        title: '📂 O Império do Proprietário',
                        intro: '<b>Imóveis Ligados:</b> Todos os outros imóveis deste CPF em Guarujá.<br><b>Empresas:</b> CNPJs onde este cliente é sócio — avalie o patrimônio total.',
                        position: 'bottom'
                    }
                ];
            }

            this._runTour(steps, {
                nextLabel: 'Saquei!',
                doneLabel: '✅ Entendi Tudo'
            }, key);
        }, 800);
    },

    /** ============================================================
     *  BOTÃO DE AJUDA (Reiniciar Tour)
     *  ========================================================== */
    addHelpButton() {
        const actionsContainer = document.querySelector('.header-actions');
        if (!actionsContainer || document.getElementById('restart-tour-btn')) return;

        const btn = document.createElement('button');
        btn.id = 'restart-tour-btn';
        btn.innerHTML = '<i class="fas fa-graduation-cap"></i>';
        btn.title = 'Rever Tutorial';
        btn.setAttribute('aria-label', 'Rever Tutorial');
        btn.style.cssText = `
            background: rgba(37,99,235,0.12);
            border: 1px solid rgba(37,99,235,0.25);
            font-size: 1rem;
            cursor: pointer;
            color: #60a5fa;
            width: 34px; height: 34px;
            border-radius: 8px;
            display: inline-flex;
            align-items: center; justify-content: center;
            transition: all 0.25s;
            margin-right: 8px;
        `;

        btn.onmouseover = () => { btn.style.background = '#2563eb'; btn.style.color = '#fff'; };
        btn.onmouseout  = () => { btn.style.background = 'rgba(37,99,235,0.12)'; btn.style.color = '#60a5fa'; };

        btn.onclick = () => {
            // Remove todas as trilhas para recomeçar
            Object.values(this._keys).forEach(k => localStorage.removeItem(k));
            this.showWelcomeModal();
        };

        actionsContainer.insertBefore(btn, actionsContainer.firstElementChild);
    }
};

// Auto-inicializa
window.Onboarding.init();
