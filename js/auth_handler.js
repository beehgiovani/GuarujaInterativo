/**
 * AUTH_HANDLER.JS - Gestão de Acesso Real via Supabase
 */

// ─── hCaptcha Site Key ────────────────────────────────────────────────────────
const HCAPTCHA_SITEKEY = 'e1eafec4-ed60-45d2-a634-b50e4dfe0df2';
// ─────────────────────────────────────────────────────────────────────────────

window.Auth = {
    // ─── UTILS DE MASCARAMENTO DA UI ─────────────────────────────────────────
    maskCpf: function(input) {
        let v = input.value.replace(/\D/g, ''); // só números
        if (v.length > 14) v = v.substring(0, 14);
        
        let res = "";
        if (v.length <= 11) {
            res = v.substring(0, 3);
            if (v.length > 3) res += "." + v.substring(3, 6);
            if (v.length > 6) res += "." + v.substring(6, 9);
            if (v.length > 9) res += "-" + v.substring(9, 11);
        } else {
            res = v.substring(0, 2);
            if (v.length > 2) res += "." + v.substring(2, 5);
            if (v.length > 5) res += "." + v.substring(5, 8);
            if (v.length > 8) res += "/" + v.substring(8, 12);
            if (v.length > 12) res += "-" + v.substring(12, 14);
        }
        input.value = res;
    },

    maskPhone: function(input) {
        let v = input.value.replace(/\D/g, ''); // só números
        // Se começou a digitar, mas não tem 55, injeta o 55 automático
        if (v.length > 0 && !v.startsWith('55')) {
            v = '55' + v;
        }
        if (v.length > 13) v = v.substring(0, 13);
        
        let res = v;
        if (v.length > 2) {
            res = "+55 (" + v.substring(2, 4);
            if (v.length >= 5) res += ") " + v.substring(4, 9);
            if (v.length >= 10) res += "-" + v.substring(9, 13);
        } else if (v.length > 0) {
            res = "+55";
        }
        input.value = res; // visual UI formatado
    },

    togglePasswordVisibility: function(inputId, icon) {
        const input = document.getElementById(inputId);
        if (!input) return;
        
        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    },
    // ─────────────────────────────────────────────────────────────────────────

    init: async function() {
        // --- 🚀 NUCLEAR RESET / VERSION SYNC ---
        const currentVersion = window.APP_VERSION || "1.0";
        const storedVersion = localStorage.getItem('guaruja_app_version');

        if (storedVersion !== currentVersion) {
            console.warn(`🔄 Version Mismatch: ${storedVersion} -> ${currentVersion}. Clearing old session/cache...`);
            
            // 1. Sign out (Server-side clear)
            if (window.supabaseApp) await window.supabaseApp.auth.signOut();

            // 2. Clear LocalStorage (except specific settings if any)
            localStorage.clear();

            // 3. Clear IndexedDB (Cache)
            try {
                indexedDB.deleteDatabase('GuarujaGeoDB');
                console.log("📦 Cache Database deleted.");
            } catch (e) {
                console.error("Failed to delete DB:", e);
            }

            // 4. Set new version and reload if needed, or just proceed to login
            localStorage.setItem('guaruja_app_version', currentVersion);
            
            // Re-render overlay explicitly
            if (document.getElementById('loginOverlay')) {
                document.getElementById('loginOverlay').style.display = 'block';
                document.getElementById('loginOverlay').classList.remove('hidden');
            }
            console.log("✨ Nuclear Reset Complete. Ready for new version.");
        }

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
            document.getElementById('loginOverlay').style.display = 'block';
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
                document.getElementById('loginOverlay').style.display = 'block';
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
            document.getElementById('loginOverlay').style.display = 'block';
            document.getElementById('loginOverlay').classList.remove('hidden');
            
            // Puxar as estatísticas reais para a vitrine do login
            this.loadLiveStats();
            
            // Ativa o monitoramento de sessão única para quem já está logado
            this.startSessionMonitor();
        }

        // Initialize Default State (apenas se não logado ainda)
        if (!this._appInitialized) {
            this.toggleAuthMode('login');
        }

        // Listener para mudanças de estado (login/logout)
        window.supabaseApp.auth.onAuthStateChange(async (event, session) => {

            // ─── RECUPERAÇÃO DE SENHA (Supabase v2 PKCE/hash) ───────────────
            if (event === 'PASSWORD_RECOVERY') {
                console.log('🔑 PASSWORD_RECOVERY detectado via onAuthStateChange');
                this._inPasswordRecovery = true; // bloqueia init do mapa
                document.getElementById('loginOverlay').style.display = 'block';
                this.toggleAuthMode('new-password');
                window.history.replaceState(null, '', window.location.pathname);
                return;
            }

            // ─── LOGIN NORMAL ────────────────────────────────────────────────
            if (event === 'SIGNED_IN' && session) {
                // Se estamos em fluxo de recovery, NÃO inicializa o mapa
                if (this._inPasswordRecovery) {
                    console.log('ℹ️ SIGNED_IN ignorado — esperando usuário definir nova senha.');
                    return;
                }
                if (!this._appInitialized) {
                    console.log('🔔 User Logged In (novo login):', session.user.email);
                    await this.handleAuthenticatedUser(session.user);
                } else {
                    console.log('ℹ️ SIGNED_IN ignorado - app já inicializado.');
                }
            }

            if (event === 'SIGNED_OUT') {
                console.log('🔕 User Logged Out');
                localStorage.removeItem('guaruja_auth');
                this._appInitialized = false;
                this._inPasswordRecovery = false;
                window.location.reload();
            }
        });
    },

    // Alias chamado pelo botão do HTML (mantém compatibilidade)
    handleLogin: function() {
        const email = document.getElementById('loginUser')?.value?.trim();
        const password = document.getElementById('loginPass')?.value;
        if (!email || !password) {
            this.showAuthMessage('Preencha e-mail e senha para continuar.', 'error');
            return;
        }
        this.login(email, password);
    },

    login: async function(email, password) {
        window.Loading.show("Autenticando...", "Verificando credenciais");

        // Captura e valida o token do captcha (Login tbm exige se ativo no Supabase Global)
        const captchaToken = window.hcaptcha ? window.hcaptcha.getResponse() : undefined;
        if (!captchaToken) {
            window.Loading.hide();
            window.Toast.warning('⚠️ Por favor, complete a verificação "Não sou robô" para entrar.');
            return;
        }

        const { data, error } = await window.supabaseApp.auth.signInWithPassword({
            email: email,
            password: password,
            options: { captchaToken }
        });

        if (error) {
            console.error("Login Error:", error);
            // Reset captcha após erro
            if (window.hcaptcha) window.hcaptcha.reset();
            let msg = "E-mail ou senha incorretos.";
            if (error.message.includes("Email not confirmed")) {
                msg = "Por favor, confirme seu e-mail antes de entrar.";
            } else if (error.message.includes("Invalid login credentials")) {
                msg = "Credenciais inválidas. Verifique seu login.";
            } else if (error.message.includes("captcha")) {
                msg = "⚠️ Verificação anti-bot falhou. Resolva o captcha e tente novamente.";
            }
            
            document.getElementById('loginError').innerText = msg;
            document.getElementById('loginError').style.display = 'block';
            window.Toast.error(msg);
            window.Loading.hide();
            return;
        }

        window.Toast.success("Login realizado!");
    },

    signUp: async function(email, password, fullName, phone, cpf) {
        window.Loading.show("Verificando dados...", "Validando integridade do cadastro");

        try {
            // 1. Normalização de dados
            const cleanEmail = email.trim().toLowerCase();
            const cleanPhone = phone.replace(/\D/g, '');
            const cleanCpf = cpf.replace(/\D/g, '');

            // 2. Validações Básicas de Segurança
            if (!password || password.length < 6) {
                window.Loading.hide();
                window.Toast.warning("⚠️ A senha deve ter no mínimo 6 caracteres.");
                return;
            }

            if (!window.validateCPF(cleanCpf) && !window.validateCNPJ(cleanCpf)) {
                window.Loading.hide();
                window.Toast.warning("⚠️ CPF/CNPJ inválido. Por favor, digite um documento real.");
                return;
            }

            const captchaToken = window.hcaptcha ? window.hcaptcha.getResponse() : undefined;
            if (!captchaToken) {
                window.Loading.hide();
                window.Toast.warning('⚠️ Por favor, complete a verificação "Não sou um robô".');
                return;
            }

            if (!cleanEmail.includes('@') || cleanEmail.length < 5) {
                window.Loading.hide();
                window.Toast.warning("⚠️ Por favor, digite um e-mail válido.");
                return;
            }

            // 3. Verificação de Unicidade
            const { data: existingUsers, error: checkError } = await window.supabaseApp
                .from('profiles')
                .select('id, phone, cpf_cnpj')
                .or(`phone.eq.${cleanPhone},cpf_cnpj.eq.${cleanCpf}`)
                .limit(1);

            if (checkError) console.error("Erro na verificação de unicidade:", checkError);

            if (existingUsers && existingUsers.length > 0) {
                window.Loading.hide();
                const user = existingUsers[0];
                let reason = user.phone === cleanPhone ? "Telefone" : "CPF";
                window.Toast.error(`⚠️ Este ${reason} já está cadastrado em outra conta.`);
                return;
            }

            // 4. Proceder com o Auth SignUp
            const { data, error } = await window.supabaseApp.auth.signUp({
                email: cleanEmail,
                password: password,
                options: {
                    captchaToken,
                    data: {
                        full_name: fullName,
                        phone: cleanPhone,
                        cpf_cnpj: cleanCpf
                    }
                }
            });

            if (error) {
                if (window.hcaptcha) window.hcaptcha.reset();
                throw error;
            }

            window.Toast.success("Solicitação enviada!");
            this.showAuthMessage("✅ Quase pronto! Verifique seu e-mail para confirmar a conta antes de entrar.", "success");
            this.toggleAuthMode('login');
        } catch (error) {
            console.error("Erro no cadastro:", error);
            let msg = "Erro no cadastro: " + error.message;
            if (error.message.includes("already registered")) msg = "⚠️ Este e-mail já está cadastrado.";
            window.Toast.error(msg);
        } finally {
            window.Loading.hide();
        }
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
        console.log("🚪 Iniciando Logout...");
        localStorage.removeItem('guaruja_auth');
        
        // Desativa a flag de inicialização para evitar que o listener de auth tente re-inicializar
        this._appInitialized = false;

        try {
            const { error } = await window.supabaseApp.auth.signOut();
            if (error) console.error("Erro no signOut do Supabase:", error);
            
            // Forçamos o reload manual caso o onAuthStateChange não dispare rápido o suficiente
            console.log("♻️ Recarregando página para limpar estado...");
            window.location.href = window.location.origin + window.location.pathname;
        } catch (e) {
            console.error("Erro crítico no logout:", e);
            window.location.reload();
        }
    },

    deleteAccount: async function() {
        const role = String(window.Monetization?.userRole || 'user').toLowerCase();
        if (role === 'master' || role === 'admin') {
            window.Toast.error("❌ Administradores não podem excluir suas próprias contas por este menu.");
            return;
        }

        const confirm = window.confirm("⚠️ ATENÇÃO: Você tem certeza que deseja EXCLUIR sua conta?\n\nEsta ação é irreversível e você perderá acesso a todos os seus desbloqueios, créditos e histórico.");
        if (!confirm) return;

        window.Loading.show("Excluindo conta...", "Removendo seus dados com segurança");

        try {
            const { data: { user } } = await window.supabaseApp.auth.getUser();
            if (!user) throw new Error("Usuário não identificado.");

            // 1. Marcar perfil como inativo/deletado (Soft Delete para auditoria)
            const { error: profileError } = await window.supabaseApp
                .from('profiles')
                .update({ 
                    is_active: false, 
                    updated_at: new Date().toISOString(),
                    email: `deleted_${user.id}@guarujainterativo.com.br`,
                    cpf_cnpj: `DELETED_${user.id}`
                })
                .eq('id', user.id);

            if (profileError) throw profileError;

            // 2. Registrar no log de auditoria
            await window.supabaseApp.from('audit_logs').insert({
                user_id: user.id,
                action: 'ACCOUNT_DELETION_REQUEST',
                detail: `Usuário solicitou exclusão definitiva da conta. Email anterior: ${user.email}`
            });

            window.Toast.success("Sua conta foi desativada e programada para exclusão definitiva.");
            
            // 3. Logout
            setTimeout(() => this.logout(), 2500);

        } catch (e) {
            console.error("Erro ao excluir conta:", e);
            window.Toast.error("Erro ao processar solicitação: " + e.message);
            window.Loading.hide();
        }
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

        // 2. Verificar Perfil Completo (Forçado)
        if (window.Monetization && window.Monetization.userProfile) {
            const data = window.Monetization.userProfile;
            const role = String(data.role || 'user').toLowerCase();
            const isMaster = role === 'admin' || role === 'master';
            
            if (!isMaster) {
                const missingFields = [];
                if (!data.broker_name || data.broker_name.trim() === '') missingFields.push('broker_name');
                if (!data.phone || data.phone.trim() === '') missingFields.push('phone');
                if (!data.cpf_cnpj || data.cpf_cnpj.trim() === '') missingFields.push('cpf_cnpj');
                if (!data.creci || data.creci.trim() === '') missingFields.push('creci');

                if (missingFields.length > 0) {
                    console.log('⚠️ Perfil incompleto detectado no login:', missingFields);
                    if (window.Monetization.showProfileCompletionModal) {
                        window.Monetization.showProfileCompletionModal(missingFields);
                    }
                }
            }
        }

        // 3. Redirecionamento Automático para Proprietários
        const profile = window.Monetization ? window.Monetization.userProfile : null;
        if (profile && profile.user_type === 'proprietario') {
            const isPortal = window.location.pathname.includes('/portalCliente') || window.location.pathname.includes('portal.html');
            if (!isPortal) {
                console.log("📍 Proprietário identificado. Redirecionando para /portalCliente...");
                window.location.href = '/portalCliente';
                return;
            }
        }

        // 4. Verificar Status de Aprovação (Manual Approval Gate - RELAXED)
        const status = profile ? profile.status : 'pending'; 

        if (status === 'rejected') {
            console.warn("⚠️ Acesso bloqueado: Status =", status);
            this.showPendingApprovalUI(status);
            return;
        }

        // Se status for 'pending', permitimos acesso ao mapa básico, mas alguns recursos (planos) podem estar limitados
        if (status === 'pending') {
            console.info("ℹ️ Usuário em status 'pending'. Acesso permitido ao mapa básico.");
        }

        // 3. Gerar e Registrar Session ID (Sessão Única)
        const sessionId = crypto.randomUUID();
        localStorage.setItem('guaruja_session_id', sessionId);
        
        await window.supabaseApp
            .from('profiles')
            .update({ last_session_id: sessionId })
            .eq('id', user.id);

        // 4. Proceder com Inicialização
        this._appInitialized = true;
        localStorage.setItem('guaruja_auth', 'true');
        document.getElementById('loginOverlay').style.display = 'none';
        window.logActivity('login');
        
        // Ativa monitoramento
        this.startSessionMonitor();

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
        const title = document.querySelector('.login-form-side h2');
        const btn = document.getElementById('btnLogin');
        const content = document.querySelector('.login-form-side form');
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
        const title = document.querySelector('.login-form-side h2');
        const btn = document.getElementById('btnLogin');
        const toggleLink = document.getElementById('toggleAuthLink');
        const nameField = document.getElementById('loginNameField');
        const phoneField = document.getElementById('loginPhoneField');
        const cpfField = document.getElementById('loginCpfField');
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
            if (phoneField) phoneField.style.display = 'block';
            if (cpfField) cpfField.style.display = 'block';
            if (passField) passField.style.display = 'block';
            if (forgotLink) forgotLink.style.display = 'none';
            if (resendLink) resendLink.style.display = 'flex';
            // Mostra o reCAPTCHA
            const captchaBox = document.getElementById('hcaptcha-container');
            if (captchaBox) captchaBox.style.display = 'block';
            toggleLink.innerHTML = 'Já tem uma conta? <b>Fazer Login</b>';
            toggleLink.onclick = () => this.toggleAuthMode('login');
            btn.onclick = () => this.signUp(
                document.getElementById('loginUser').value,
                document.getElementById('loginPass').value,
                document.getElementById('loginName').value,
                document.getElementById('loginPhone').value,
                document.getElementById('loginCpf').value
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
            if (passField) {
                passField.style.display = 'block';
                passField.style.position = 'relative';
                passField.innerHTML = `
                    <div style="position: relative; margin-bottom: 10px;">
                        <input type="password" id="loginNewPass" placeholder="Nova senha (mínimo 6 caracteres)"
                            autocomplete="new-password" style="width: 100%; padding-right: 40px;">
                        <i class="fas fa-eye" onclick="window.Auth.togglePasswordVisibility('loginNewPass', this)" 
                           style="position: absolute; right: 15px; top: 13px; cursor: pointer; color: #64748b;"></i>
                    </div>
                    <div style="position: relative; margin-bottom: 15px;">
                        <input type="password" id="loginConfirmPass" placeholder="Confirmar nova senha"
                            autocomplete="new-password" style="width: 100%; padding-right: 40px;">
                        <i class="fas fa-eye" onclick="window.Auth.togglePasswordVisibility('loginConfirmPass', this)" 
                           style="position: absolute; right: 15px; top: 13px; cursor: pointer; color: #64748b;"></i>
                    </div>
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
            if (phoneField) phoneField.style.display = 'none';
            if (cpfField) cpfField.style.display = 'none';
            if (passField) passField.style.display = 'block';
            if (forgotLink) forgotLink.style.display = 'block';
            if (resendLink) resendLink.style.display = 'none';
            // Reset password type and icon when switching
            const passInput = document.getElementById('loginPass');
            const toggleIcon = document.getElementById('togglePasswordIcon');
            if (passInput) passInput.type = 'password';
            if (toggleIcon) {
                toggleIcon.classList.remove('fa-eye-slash');
                toggleIcon.classList.add('fa-eye');
            }

            const captchaBox = document.getElementById('hcaptcha-container');
            if (captchaBox) captchaBox.style.display = 'block';
            if (window.hcaptcha) window.hcaptcha.reset();
            toggleLink.innerHTML = 'Não tem conta? <b>Solicitar Acesso</b>';
            toggleLink.onclick = () => this.toggleAuthMode('signup');
            btn.onclick = () => this.handleLogin();
        }
    },

    // Função para carregar os números reais do banco na tela de login
    loadLiveStats: async function() {
        console.log("📊 Buscando números reais para a vitrine...");
        try {
            // Contagem total de lotes
            const { count: totalLotes } = await window.supabaseApp
                .from('lotes')
                .select('*', { count: 'exact', head: true });

            // Contagem de lotes públicos (exemplo: zona 0 ou filtro específico)
            const { count: publicLotes } = await window.supabaseApp
                .from('lotes')
                .select('*', { count: 'exact', head: true })
                .eq('zona', '0');

            // Contagem de matrículas (unidades que possuem o campo matrícula preenchido)
            const { count: totalMatriculas } = await window.supabaseApp
                .from('unidades')
                .select('*', { count: 'exact', head: true })
                .not('matricula', 'is', null);

            // Atualizando os elementos na tela
            if (document.getElementById('home-total-count')) 
                document.getElementById('home-total-count').innerText = (totalLotes || 0).toLocaleString('pt-BR');
            
            if (document.getElementById('home-public-count')) 
                document.getElementById('home-public-count').innerText = (publicLotes || 0).toLocaleString('pt-BR');

            if (document.getElementById('home-matricula-count')) 
                document.getElementById('home-matricula-count').innerText = (totalMatriculas || 0).toLocaleString('pt-BR');

            console.log("✅ Vitrine atualizada com sucesso!");
        } catch (err) {
            console.error("❌ Erro ao carregar estatísticas da vitrine:", err);
        }
    },

    // ============================================
    // MONITOR DE SESSÃO ÚNICA (KICK LOGIC)
    // ============================================
    startSessionMonitor: function() {
        if (this._sessionInterval) clearInterval(this._sessionInterval);
        
        // Verifica a cada 30 segundos se a sessão ainda é a válida
        this._sessionInterval = setInterval(async () => {
            const localSessionId = localStorage.getItem('guaruja_session_id');
            const { data: { user } } = await window.supabaseApp.auth.getUser();
            if (!user) return;

            // Busca status e session_id mais recentes
            const { data: profile } = await window.supabaseApp
                .from('profiles')
                .select('last_session_id, status')
                .eq('id', user.id)
                .maybeSingle();

            if (!profile) return;

            // 1. Verificação de Bloqueio (Rejeição Administrativa)
            if (profile.status === 'rejected') {
                console.warn("🚫 Acesso Revogado Administrativamente.");
                clearInterval(this._sessionInterval);
                window.Toast.error("🚨 Seu acesso foi revogado pelo administrador.");
                setTimeout(() => this.logout(), 3000);
                return;
            }

            // 2. Verificação de Sessão Única (Kick Logic)
            if (profile.last_session_id && localSessionId && profile.last_session_id !== localSessionId) {
                console.warn("⚠️ Sessão Única: Outro acesso detectado.");
                clearInterval(this._sessionInterval);
                window.Toast.warning("⚠️ Outro acesso detectado. Sua conta foi conectada em outro dispositivo.");
                setTimeout(() => this.logout(), 3000);
            }
        }, 15000); // Verificação a cada 15 segundos
    }
};
