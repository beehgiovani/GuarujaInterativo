/**
 * AUTH_HANDLER.JS - Gestão de Acesso Real via Supabase
 */

window.Auth = {
    init: async function() {
        // ============================================
        // DETECTAR FLUXO DE RECUPERAÇÃO DE SENHA
        // O Supabase redireciona de volta com #access_token=...&type=recovery
        // ============================================
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const flowType = hashParams.get('type');
        const hashError = hashParams.get('error');
        const hashErrorCode = hashParams.get('error_code');

        // ============================================
        // DETECTAR ERRO NA URL (link expirado, inválido etc.)
        // Ex: #error=access_denied&error_code=otp_expired
        // ============================================
        if (hashError) {
            window.history.replaceState(null, '', window.location.pathname); // Limpa URL
            document.getElementById('loginOverlay').style.display = 'flex';
            this.toggleAuthMode('login');

            let friendlyMsg = 'Ocorreu um erro de autenticação.';
            if (hashErrorCode === 'otp_expired') {
                friendlyMsg = '⏰ Este link expirou. Solicite um novo link de recuperação de senha abaixo.';
            } else if (hashError === 'access_denied') {
                friendlyMsg = '🔒 Link inválido ou já utilizado. Solicite um novo abaixo.';
            }
            // Mostra mensagem após o DOM estar pronto
            setTimeout(() => this.showAuthMessage(friendlyMsg, 'error'), 100);
            return;
        }

        if (flowType === 'recovery') {
            console.log("🔑 Fluxo de Recuperação de Senha detectado na URL.");
            // O Supabase já processa o token da URL automaticamente via getSession()
            // Aguardamos um moment para ele estabelecer a sessão via token
            await new Promise(r => setTimeout(r, 800));
            const { data: { session } } = await window.supabaseApp.auth.getSession();
            
            if (session) {
                // Sessão estabelecida via token de recovery — mostrar formulário de nova senha
                document.getElementById('loginOverlay').style.display = 'flex';
                this.toggleAuthMode('new-password');
                // Limpar token da URL sem recarregar a página
                window.history.replaceState(null, '', window.location.pathname);
                return; // Não inicializar o mapa ainda
            }
        }

        // Fluxo normal: verifica sessão ativa
        const { data: { session } } = await window.supabaseApp.auth.getSession();
        
        if (session) {
            console.log("🔐 Sessão ativa identificada:", session.user.email);
            await this.handleAuthenticatedUser(session.user);
        } else {
            console.log("🔓 Nenhum usuário logado.");
            localStorage.removeItem('guaruja_auth');
            document.getElementById('loginOverlay').style.display = 'flex';
            document.getElementById('loginOverlay').classList.remove('hidden');
        }

        // Initialize Default State (apenas se não logado ainda)
        if (!this._appInitialized) {
            this.toggleAuthMode('login');
        }

        // Listener para mudanças de estado (login/logout)
        // Guarda para evitar múltiplas inicializações
        window.supabaseApp.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session) {
                if (!this._appInitialized) {
                    // Só inicializa se ainda não foi feito pela sessão ativa acima
                    console.log("🔔 User Logged In (novo login):", session.user.email);
                    await this.handleAuthenticatedUser(session.user);
                } else {
                    console.log('ℹ️ SIGNED_IN ignorado - app já inicializado.');
                }
            }
            if (event === 'SIGNED_OUT') {
                console.log("🔕 User Logged Out");
                localStorage.removeItem('guaruja_auth');
                this._appInitialized = false;
                window.location.reload();
            }
        });
    },

    login: async function(email, password) {
        window.Loading.show("Autenticando...", "Verificando credenciais");
        const { data, error } = await window.supabaseApp.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            console.error("Login Error:", error);
            let msg = "E-mail ou senha incorretos.";
            if (error.message.includes("Email not confirmed")) {
                msg = "Por favor, confirme seu e-mail antes de entrar.";
            } else if (error.message.includes("Invalid login credentials")) {
                msg = "Credenciais inválidas. Verifique seu login.";
            }
            
            document.getElementById('loginError').innerText = msg;
            document.getElementById('loginError').style.display = 'block';
            window.Toast.error(msg);
            window.Loading.hide();
            return;
        }

        window.Toast.success("Login realizado!");
    },

    signUp: async function(email, password, fullName) {
        window.Loading.show("Criando conta...", "Aguarde a aprovação");
        const { data, error } = await window.supabaseApp.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    full_name: fullName,
                }
            }
        });

        if (error) {
            window.Toast.error("Erro no cadastro: " + error.message);
            window.Loading.hide();
            return;
        }

        window.Toast.info("Solicitação enviada! Verifique seu e-mail.");
        this.toggleAuthMode('login');
    },

    resetPassword: async function(email) {
        if (!email || !email.includes('@')) {
            window.Toast.warning("Digite seu e-mail antes de continuar.");
            return;
        }
        window.Loading.show("Enviando...", "Gerando link de redefinição de senha");
        const { error } = await window.supabaseApp.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + window.location.pathname
        });
        window.Loading.hide();
        if (error) {
            window.Toast.error("Erro: " + error.message);
        } else {
            window.Toast.success("✅ E-mail de recuperação enviado! Verifique sua caixa de entrada.");
            this.showAuthMessage("Verifique seu e-mail para redefinir sua senha. O link expira em 1 hora.", 'success');
        }
    },

    resendConfirmation: async function(email) {
        if (!email || !email.includes('@')) {
            window.Toast.warning("Digite seu e-mail primeiro.");
            return;
        }
        window.Loading.show("Reenviando...", "Enviando novo e-mail de confirmação");
        const { error } = await window.supabaseApp.auth.resend({
            type: 'signup',
            email: email
        });
        window.Loading.hide();
        if (error) {
            window.Toast.error("Erro: " + error.message);
        } else {
            window.Toast.success("📨 Novo e-mail de confirmação enviado!");
            this.showAuthMessage("Confira sua caixa de entrada (e spam) para o e-mail de confirmação.", 'info');
        }
    },

    showAuthMessage: function(msg, type) {
        const el = document.getElementById('loginError');
        if (!el) return;
        el.innerText = msg;
        el.style.display = 'block';
        el.style.color = type === 'success' ? '#10b981' : type === 'info' ? '#3b82f6' : '#ef4444';
        el.style.background = type === 'success' ? '#f0fdf4' : type === 'info' ? '#eff6ff' : '#fef2f2';
        el.style.padding = '10px';
        el.style.borderRadius = '8px';
        el.style.fontWeight = '600';
    },

    updatePassword: async function() {
        const newPass = document.getElementById('loginNewPass')?.value || '';
        const confirmPass = document.getElementById('loginConfirmPass')?.value || '';

        if (!newPass || newPass.length < 6) {
            this.showAuthMessage('A senha precisa ter no mínimo 6 caracteres.', 'error');
            return;
        }
        if (newPass !== confirmPass) {
            this.showAuthMessage('As senhas não coincidem. Tente novamente.', 'error');
            return;
        }

        window.Loading.show('Salvando...', 'Atualizando sua senha com segurança');
        const { data, error } = await window.supabaseApp.auth.updateUser({ password: newPass });
        window.Loading.hide();

        if (error) {
            this.showAuthMessage('Erro: ' + error.message, 'error');
        } else {
            window.Toast.success('✅ Senha atualizada com sucesso! Redirecionando...');
            this.showAuthMessage('Senha criada com sucesso! Você será redirecionado automaticamente.', 'success');
            // O onAuthStateChange já vai detectar o SIGNED_IN e inicializar o mapa
            setTimeout(() => this.handleAuthenticatedUser(data.user), 1500);
        }
    },

    logout: async function() {
        localStorage.removeItem('guaruja_auth');
        await window.supabaseApp.auth.signOut();
    },

    handleAuthenticatedUser: async function(user) {
        if (this._appInitialized) {
            console.log('ℹ️ handleAuthenticatedUser ignorado - app já inicializado.');
            return;
        }

        // 1. Carregar Perfil (Status, Saldo, Role)
        if (window.Monetization) {
            await window.Monetization.loadUserProfile(user.id);
        }

        // 2. Verificar Status de Aprovação (Manual Approval Gate)
        const profile = window.Monetization ? window.Monetization.userProfile : null;
        const status = profile ? profile.status : 'approved'; // Default approved para evitar lock se profile falhar? Melhor 'pending'?

        if (status === 'pending' || status === 'rejected') {
            console.warn("⚠️ Acesso bloqueado: Status =", status);
            this.showPendingApprovalUI(status);
            return;
        }

        // 3. Proceder com Inicialização
        this._appInitialized = true;
        localStorage.setItem('guaruja_auth', 'true');
        document.getElementById('loginOverlay').style.display = 'none';
        window.logActivity('login');
        
        // Carrega notas particulares (pendentes de curadoria)
        if (window.loadUserPendingEdits) {
            window.loadUserPendingEdits();
        }

        // 🚀 DISPARA O MAPA (app.js)
        if (typeof window.init === 'function') {
            console.log("📍 Authentication successful. Initializing app...");
            window.init();
        }
    },

    showPendingApprovalUI: function(status) {
        const title = document.querySelector('.login-box h2');
        const btn = document.getElementById('btnLogin');
        const content = document.querySelector('.login-box form');
        const toggleLink = document.getElementById('toggleAuthLink');
        const nameField = document.getElementById('loginNameField');
        const resendLink = document.getElementById('resendConfirmationLink');

        if (status === 'rejected') {
            title.innerText = "Acesso Negado";
            content.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <i class="fas fa-times-circle" style="font-size: 48px; color: #ef4444; margin-bottom: 20px;"></i>
                    <p style="color: #475569; font-size: 14px; line-height: 1.6;">
                        Infelizmente sua solicitação de acesso não foi aprovada no momento.
                    </p>
                    <button onclick="window.Auth.logout()" style="margin-top: 20px; width: 100%; padding: 12px; background: #ef4444; color: white; border: none; border-radius: 8px; font-weight: 700; cursor: pointer;">Sair</button>
                </div>
            `;
        } else {
            title.innerText = "Aguarde a Aprovação";
            content.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <i class="fas fa-hourglass-half" style="font-size: 48px; color: #f59e0b; margin-bottom: 20px;"></i>
                    <p style="color: #475569; font-size: 14px; line-height: 1.6;">
                        Sua conta foi criada e o e-mail confirmado!<br><br>
                        Por questões de segurança, um administrador irá revisar seu acesso. 
                        <b>Você receberá uma notificação quando for liberado.</b>
                    </p>
                    <button onclick="window.Auth.logout()" style="margin-top: 20px; width: 100%; padding: 12px; background: #64748b; color: white; border: none; border-radius: 8px; font-weight: 700; cursor: pointer;">Fazer Logout</button>
                    <a href="https://wa.me/5513997099494" target="_blank" style="display: block; margin-top: 15px; color: #2563eb; font-size: 12px; font-weight: 600; text-decoration: none;">Acelerar aprovação via WhatsApp</a>
                </div>
            `;
        }
        
        if (nameField) nameField.style.display = 'none';
        if (resendLink) resendLink.style.display = 'none';
        if (toggleLink) toggleLink.style.display = 'none';
        if (btn) btn.style.display = 'none';
    },

    toggleAuthMode: function(mode) {
        const title = document.querySelector('.login-box h2');
        const btn = document.getElementById('btnLogin');
        const toggleLink = document.getElementById('toggleAuthLink');
        const nameField = document.getElementById('loginNameField');
        const passField = document.getElementById('loginPassField');
        const forgotLink = document.getElementById('forgotPasswordLink');
        const resendLink = document.getElementById('resendConfirmationLink');
        const errorEl = document.getElementById('loginError');

        // Reset error message
        if (errorEl) { errorEl.style.display = 'none'; errorEl.innerText = ''; }

        if (mode === 'signup') {
            title.innerText = "Criar Conta";
            btn.innerText = "Cadastrar";
            nameField.style.display = 'block';
            if (passField) passField.style.display = 'block';
            if (forgotLink) forgotLink.style.display = 'none';
            if (resendLink) resendLink.style.display = 'flex';
            toggleLink.innerHTML = 'Já tem uma conta? <b>Fazer Login</b>';
            toggleLink.onclick = () => this.toggleAuthMode('login');
            btn.onclick = () => this.signUp(
                document.getElementById('loginUser').value,
                document.getElementById('loginPass').value,
                document.getElementById('loginName').value
            );
        } else if (mode === 'forgot') {
            title.innerText = "Recuperar Senha";
            btn.innerText = "Enviar Link de Recuperação";
            nameField.style.display = 'none';
            if (passField) passField.style.display = 'none';
            if (forgotLink) forgotLink.style.display = 'none';
            if (resendLink) resendLink.style.display = 'none';
            toggleLink.innerHTML = '← Voltar para o <b>Login</b>';
            toggleLink.onclick = () => this.toggleAuthMode('login');
            btn.onclick = () => this.resetPassword(document.getElementById('loginUser').value);
        } else if (mode === 'new-password') {
            title.innerText = 'Criar Nova Senha';
            btn.innerText = 'Salvar Nova Senha';
            nameField.style.display = 'none';
            if (forgotLink) forgotLink.style.display = 'none';
            if (resendLink) resendLink.style.display = 'none';
            toggleLink.style.display = 'none';

            // Substituir os campos do formulário dinamicamente
            const passField = document.getElementById('loginPassField');
            if (passField) {
                passField.style.display = 'block';
                passField.innerHTML = `
                    <input type="password" id="loginNewPass" placeholder="Nova senha (mínimo 6 caracteres)"
                        autocomplete="new-password" style="margin-bottom: 10px; width: 100%;">
                    <input type="password" id="loginConfirmPass" placeholder="Confirmar nova senha"
                        autocomplete="new-password" style="margin-bottom: 15px; width: 100%;">
                `;
            }
            // Esconder campo de e-mail (não precisa)
            const emailField = document.getElementById('loginUser');
            if (emailField) emailField.style.display = 'none';

            this.showAuthMessage('🔑 Link válido! Agora crie sua nova senha de acesso.', 'info');
            btn.onclick = () => this.updatePassword();
        } else {
            title.innerText = 'Acesso Restrito';
            btn.innerText = 'Entrar';
            nameField.style.display = 'none';
            if (passField) passField.style.display = 'block';
            if (forgotLink) forgotLink.style.display = 'block';
            if (resendLink) resendLink.style.display = 'none';
            toggleLink.innerHTML = 'Não tem conta? <b>Solicitar Acesso</b>';
            toggleLink.onclick = () => this.toggleAuthMode('signup');
            btn.onclick = () => this.login(
                document.getElementById('loginUser').value,
                document.getElementById('loginPass').value
            );
        }
    }
};
