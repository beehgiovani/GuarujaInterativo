/**
 * Institutional & Support Logic for GuaruGeo
 * Handles "About Us", "Contact", "Ideas", and "LGPD/Legal" sections.
 */

window.Institutional = {
    showMenu(event) {
        if (event) event.stopPropagation();
        
        // Remove existing menu if any
        const existing = document.getElementById('institutional-menu');
        if (existing) {
            existing.remove();
            return;
        }

        const menu = document.createElement('div');
        menu.id = 'institutional-menu';
        menu.style.cssText = `
            position: fixed;
            top: ${event.clientY + 10}px;
            left: ${event.clientX - 150}px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.15);
            z-index: 10000;
            width: 220px;
            padding: 8px;
            border: 1px solid #e2e8f0;
            animation: fadeIn 0.2s ease-out;
        `;

        const options = [
            { icon: 'fa-info-circle', text: 'Sobre o GuaruGeo', action: () => this.showAbout() },
            { icon: 'fa-comments', text: 'Fale Conosco / Suporte', action: () => this.showContact() },
            { icon: 'fa-lightbulb', text: 'Sugestões de Ideias', action: () => this.showIdeas() },
            { icon: 'fa-shield-halved', text: 'Segurança Jurídica & LGPD', action: () => this.showLegal() }
        ];

        options.forEach(opt => {
            const item = document.createElement('div');
            item.className = 'inst-menu-item';
            item.style.cssText = `
                display: flex; align-items: center; gap: 12px; padding: 10px 12px;
                cursor: pointer; border-radius: 8px; font-size: 13px; color: #334155;
                transition: background 0.2s;
            `;
            item.innerHTML = `<i class="fas ${opt.icon}" style="width: 16px; color: #2563eb;"></i> ${opt.text}`;
            item.onmouseover = () => item.style.background = '#f1f5f9';
            item.onmouseout = () => item.style.background = 'transparent';
            item.onclick = () => {
                opt.action();
                menu.remove();
            };
            menu.appendChild(item);
        });

        document.body.appendChild(menu);

        // Click outside to close
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 10);
    },

    createModal(title, content) {
        // Remove existing if any
        const existing = document.getElementById('inst-modal-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'inst-modal-overlay';
        overlay.className = 'custom-modal-overlay active';
        overlay.style.zIndex = '11000';

        overlay.innerHTML = `
            <div class="custom-modal" style="max-width: 600px; width: 90%;">
                <div class="custom-modal-header">
                    <div class="custom-modal-title">
                        <span>${title}</span>
                    </div>
                    <button type="button" class="custom-modal-close" onclick="document.getElementById('inst-modal-overlay').remove()">&times;</button>
                </div>
                <div class="custom-modal-body" style="max-height: 70vh; overflow-y: auto; padding: 25px; line-height: 1.6;">
                    ${content}
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        
        overlay.onclick = (e) => {
            if (e.target === overlay) overlay.remove();
        };
    },

    showAbout() {
        const content = `
            <div style="text-align: center; margin-bottom: 20px;">
                <img src="logo.png" style="max-width: 120px; margin-bottom: 15px;">
                <h2 style="color: #0f172a; margin: 0;">GuaruGeo</h2>
                <p style="color: #64748b; font-size: 14px;">Inteligência Imobiliária de Precisão</p>
            </div>
            <p>O <b>GuaruGeo</b> nasceu com a missão de transformar o mercado imobiliário do Guarujá através de dados precisos e tecnologia geoespacial.</p>
            <p>Nossa plataforma consolida bases de dados públicas, registros imobiliários e inteligência de mercado para que o corretor tenha o poder da informação na palma da mão.</p>
            <div style="background: #f8fafc; padding: 15px; border-radius: 12px; margin-top: 20px;">
                <h4 style="margin-top: 0; color: #2563eb;"><i class="fas fa-check-circle"></i> Nossa Visão</h4>
                <p style="font-size: 13px; margin-bottom: 0;">Ser a ferramenta indispensável para todo profissional que busca segurança jurídica, agilidade na prospecção e excelência no atendimento ao cliente final.</p>
            </div>
        `;
        this.createModal('Sobre o Projeto', content);
    },

    showContact() {
        const content = `
            <p>Precisa de suporte técnico ou tem alguma dúvida comercial?</p>
            
            <div style="display: grid; gap: 15px; margin-top: 20px;">
                <a href="https://wa.me/5513997099494?text=Olá, preciso de suporte no GuaruGeo" target="_blank" 
                   style="display: flex; align-items: center; gap: 15px; padding: 20px; background: #22c55e; color: white; border-radius: 12px; text-decoration: none; transition: transform 0.2s;">
                    <i class="fab fa-whatsapp" style="font-size: 30px;"></i>
                    <div>
                        <b style="display: block;">Suporte via WhatsApp</b>
                        <span style="font-size: 12px; opacity: 0.9;">Atendimento rápido em horário comercial</span>
                    </div>
                </a>

                <div style="padding: 20px; background: #f1f5f9; border-radius: 12px; border: 1px solid #e2e8f0;">
                    <h4 style="margin-top: 0;"><i class="fas fa-envelope"></i> Enviar Feedback</h4>
                    <textarea id="inst-feedback-msg" placeholder="Descreva seu problema ou sugestão..." 
                              style="width: 100%; height: 80px; padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1; margin: 10px 0; font-family: inherit; font-size: 13px; resize: none;"></textarea>
                    <button onclick="window.Institutional.sendFeedback()" 
                            style="width: 100%; padding: 10px; background: #2563eb; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 700;">
                        Enviar Mensagem
                    </button>
                </div>
            </div>
        `;
        this.createModal('Canais de Atendimento', content);
    },

    showIdeas() {
        const content = `
            <h3 style="color: #0f172a; margin-top: 0;">Sua ideia move o GuaruGeo! 🚀</h3>
            <p>O banco de ideias é onde você ajuda a construir o futuro da nossa ferramenta. O que falta hoje para o seu trabalho ser 100% digital?</p>
            
            <div style="background: #eff6ff; padding: 15px; border-radius: 12px; border-left: 4px solid #2563eb; margin: 20px 0;">
                <p style="font-size: 13px; color: #1e3a8a; margin: 0;"><b>Exemplos:</b> Novos filtros de busca, integração com apps externos, relatórios em PDF específicos, etc.</p>
            </div>

            <textarea id="inst-idea-text" placeholder="Qual a sua grande ideia?" 
                      style="width: 100%; height: 120px; padding: 15px; border-radius: 12px; border: 1px solid #cbd5e1; margin-bottom: 15px; font-family: inherit; resize: none;"></textarea>
            
            <button onclick="window.Institutional.submitIdea()" 
                    style="width: 100%; padding: 15px; background: #2563eb; color: white; border: none; border-radius: 12px; cursor: pointer; font-weight: 700; font-size: 15px; box-shadow: 0 4px 12px rgba(37,99,235,0.2);">
                Enviar Ideia para o Conselho
            </button>
        `;
        this.createModal('Sugestões de Ideias', content);
    },

    showLegal() {
        const content = `
            <h3 style="color: #0f172a; margin-top: 0;">Transparência e Conformidade</h3>
            <p>O GuaruGeo é uma ferramenta de apoio profissional para corretores de imóveis, focada em fornecer <b>Segurança Jurídica</b> às transações do setor.</p>
            
            <h4 style="color: #1e293b; margin-bottom: 10px;">🛡️ LGPD e Dados Públicos</h4>
            <p style="font-size: 13px; color: #475569;">
                Todas as informações exibidas são originárias de bases de dados **PÚBLICAS** (Prefeitura, Cartórios e Receita Federal), cujo tratamento é autorizado para finalidades de segurança, proteção do crédito e exercício regular de direitos, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018).
            </p>

            <h4 style="color: #1e293b; margin-bottom: 10px;">📜 Ética Profissional</h4>
            <p style="font-size: 13px; color: #475569;">
                O uso destas informações deve seguir estritamente o código de ética do CRECI. O acesso é restrito e auditado para evitar abusos ou uso indevido da informação para fins que não sejam a corretagem imobiliária profissional.
            </p>

            <div style="margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 15px; font-size: 11px; color: #94a3b8;">
                Última revisão jurídica: Marco de 2026.
            </div>
        `;
        this.createModal('Segurança Jurídica & LGPD', content);
    },

    showTrainingModal() {
        const content = `
            <div style="text-align: center; margin-bottom: 25px;">
                <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 15px; font-size: 28px; color: white; box-shadow: 0 10px 20px rgba(16,185,129,0.3);">
                    <i class="fas fa-book-open"></i>
                </div>
                <h2 style="color: #0f172a; margin: 0 0 5px 0;">Manual do Usuário e Treinamento</h2>
                <p style="color: #64748b; font-size: 13px; margin: 0;">Domine o GuaruGeo e acelere seus resultados</p>
            </div>

            <div style="display: grid; gap: 15px;">
                <div style="background: rgba(37,99,235,0.05); border: 1px solid rgba(37,99,235,0.2); border-radius: 12px; padding: 20px; transition: transform 0.2s; cursor: pointer;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                    <h4 style="margin: 0 0 10px 0; color: #1e3a8a; display: flex; align-items: center; justify-content: space-between;">
                        <span><i class="fas fa-file-pdf" style="color: #ef4444; margin-right: 8px;"></i> PDF Oficial (Versão Imprimível)</span>
                        <i class="fas fa-chevron-right" style="opacity: 0.5;"></i>
                    </h4>
                    <p style="font-size: 13px; color: #475569; margin: 0 0 15px 0; line-height: 1.4;">
                        O guia passo-a-passo detalhado, com atalhos, boas práticas para interpretar mapas e tirar o máximo proveito das ferramentas do hub.
                    </p>
                    <button style="background: #2563eb; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 700; cursor: pointer; width: 100%; box-shadow: 0 4px 12px rgba(37,99,235,0.2);" onclick="window.Toast.info('O download será iniciado em breve.')">
                        Fazer Download do Manual Completo
                    </button>
                </div>
                
                <div style="background: rgba(16,185,129,0.05); border: 1px solid rgba(16,185,129,0.2); border-radius: 12px; padding: 20px; transition: transform 0.2s; cursor: pointer;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                    <h4 style="margin: 0 0 10px 0; color: #065f46; display: flex; align-items: center; justify-content: space-between;">
                        <span><i class="fas fa-play-circle" style="color: #10b981; margin-right: 8px;"></i> Aulas Rápidas e Dinâmicas em Vídeo</span>
                        <i class="fas fa-chevron-right" style="opacity: 0.5;"></i>
                    </h4>
                    <p style="font-size: 13px; color: #475569; margin: 0 0 15px 0; line-height: 1.4;">
                        Playlist com vídeos curtos explicando como dominar a mineração de dados, Radar e Funil de Vendas de Leilões em menos de 10 minutos.
                    </p>
                    <button style="background: #10b981; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 700; cursor: pointer; width: 100%; box-shadow: 0 4px 12px rgba(16,185,129,0.2);" onclick="window.open('https://youtube.com', '_blank')">
                        Acessar Formato e Vídeo (Em Breve)
                    </button>
                </div>
            </div>
            
            <div style="text-align: center; margin-top: 25px; padding-top: 15px; border-top: 1px solid #e2e8f0;">
                <p style="font-size: 12px; color: #64748b;">Continua com problemas? Entre no <b style="color: #2563eb; cursor: pointer;" onclick="window.Institutional.showContact();">Fale Conosco / Suporte</b> da nossa plataforma.</p>
            </div>
        `;
        this.createModal('Centro de Treinamento', content);
    },

    async sendFeedback() {
        const msg = document.getElementById('inst-feedback-msg')?.value;
        if (!msg) return window.Toast.warning("Escreva uma mensagem antes de enviar.");

        window.Loading.show("Enviando...");
        try {
            const { data: { user } } = await window.supabaseApp.auth.getUser();
            const { error } = await window.supabaseApp.from('audit_logs').insert({
                user_id: user?.id,
                action: 'FEEDBACK_SUPPORT',
                details: { message: msg },
                severity: 'info'
            });

            if (error) throw error;
            window.Toast.success("Mensagem enviada com sucesso! Analisaremos o quanto antes.");
            document.getElementById('inst-modal-overlay')?.remove();
        } catch (e) {
            console.error(e);
            window.Toast.error("Erro ao enviar mensagem.");
        } finally {
            window.Loading.hide();
        }
    },

    async submitIdea() {
        const idea = document.getElementById('inst-idea-text')?.value;
        if (!idea) return window.Toast.warning("Por favor, descreva sua ideia.");

        window.Loading.show("Registrando Ideia...");
        try {
            const { data: { user } } = await window.supabaseApp.auth.getUser();
            const { error } = await window.supabaseApp.from('audit_logs').insert({
                user_id: user?.id,
                action: 'SUGGEST_IDEA',
                details: { idea: idea },
                severity: 'info'
            });

            if (error) throw error;
            window.Toast.success("Sua ideia foi registrada! Obrigado por contribuir.");
            document.getElementById('inst-modal-overlay')?.remove();
        } catch (e) {
            console.error(e);
            window.Toast.error("Erro ao registrar ideia.");
        } finally {
            window.Loading.hide();
        }
    }
};

console.log("✅ Institutional Handler loaded");
