/**
 * PORTAL_AUTH_HANDLER.JS - Autenticação dedicada para o Portal do Proprietário
 */

window.PortalAuth = {
    async init() {
        const loginForm = document.getElementById('portal-login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // DETECTAR FLUXO DE RECUPERAÇÃO DE SENHA
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const flowType = hashParams.get('type');

        if (flowType === 'recovery') {
            console.log("🔑 Fluxo de Recuperação no Portal detectado.");
            await new Promise(r => setTimeout(r, 800));
            const { data: { session } } = await window.supabaseApp.auth.getSession();
            if (session) {
                this.showNewPasswordUI();
                window.history.replaceState(null, '', window.location.pathname);
                return;
            }
        }

        // Verificar se já existe uma sessão ativa (fluxo normal)
        const { data: { session } } = await window.supabaseApp.auth.getSession();
        if (session) {
            console.log("Sessão ativa detectada, redirecionando para o portal...");
            window.location.href = 'portal.html';
        }
    },

    async handleLogin(e) {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const btnSubmit = document.getElementById('btn-submit');
        const errorEl = document.getElementById('login-error');

        // Capturar Token hCaptcha
        const captchaResponse = hcaptcha.getResponse();
        if (!captchaResponse) {
            errorEl.innerText = "Por favor, complete o desafio de segurança (Captcha).";
            errorEl.style.display = 'block';
            return;
        }

        // Reset UI
        errorEl.style.display = 'none';
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Autenticando...';

        try {
            // Em uma implementação real com Supabase hCaptcha, passaríamos o options: { captchaToken }
            // Mas aqui vamos focar na validação do fluxo do portal e perfil.
            const { data, error } = await window.supabaseApp.auth.signInWithPassword({
                email,
                password,
                options: {
                    captchaToken: captchaResponse
                }
            });

            if (error) {
                hcaptcha.reset(); // Reseta captcha se falhar
                throw error;
            }

            // Verificar se o usuário tem permissão para acessar o portal
            const { data: profile, error: profileError } = await window.supabaseApp
                .from('profiles')
                .select('role, user_type')
                .eq('id', data.user.id)
                .single();

            if (profileError) throw profileError;

            const isAdmin = ['admin', 'master'].includes(profile.role);
            const isProprietario = profile.user_type === 'proprietario';

            if (!isProprietario && !isAdmin) {
                // Se não for proprietário nem admin, desloga e avisa
                await window.supabaseApp.auth.signOut();
                throw new Error("Este acesso é restrito apenas a Proprietários.");
            }

            // Sucesso - Redirecionar para o Dashboard do Portal
            window.location.href = 'portal.html';

        } catch (err) {
            console.error("Login fail:", err);
            errorEl.innerText = err.message || "E-mail ou senha incorretos.";
            errorEl.style.display = 'block';
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = 'Entrar no Portal <i class="fas fa-arrow-right"></i>';
        }
    },

    async forgotPassword() {
        const email = document.getElementById('email').value;
        const errorEl = document.getElementById('login-error');
        
        if (!email || !email.includes('@')) {
            errorEl.innerText = "Por favor, digite um e-mail válido para recuperar a senha.";
            errorEl.style.display = 'block';
            return;
        }

        // Capturar Token hCaptcha para evitar spam de recuperação
        const captchaResponse = hcaptcha.getResponse();
        if (!captchaResponse) {
            errorEl.innerText = "Por favor, complete o Captcha para solicitar a recuperação.";
            errorEl.style.display = 'block';
            return;
        }

        errorEl.style.display = 'none';
        const btnSubmit = document.getElementById('btn-submit');
        const originalText = btnSubmit.innerHTML;
        
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Enviando...';

        try {
            const { error } = await window.supabaseApp.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin + '/portal_login.html',
                captchaToken: captchaResponse
            });

            if (error) throw error;

            alert("✅ E-mail de recuperação enviado! Verifique sua caixa de entrada (e a pasta de spam).");
            hcaptcha.reset();
            
        } catch (err) {
            console.error("Recovery error:", err);
            errorEl.innerText = "Erro ao enviar: " + (err.message || "Tente novamente mais tarde.");
            errorEl.style.display = 'block';
            hcaptcha.reset();
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = originalText;
        }
    },

    showNewPasswordUI() {
        const form = document.getElementById('portal-login-form');
        const header = form.parentElement.querySelector('header');
        
        if (header) {
            header.querySelector('h2').innerText = "Definir Nova Senha";
            header.querySelector('p').innerText = "Crie uma senha forte para sua segurança.";
        }

        form.innerHTML = `
            <div class="form-group">
                <label for="new-password">Nova Senha</label>
                <div class="input-with-icon">
                    <i class="fas fa-lock"></i>
                    <input type="password" id="new-password" placeholder="Mínimo 6 caracteres" required>
                </div>
            </div>
            <div class="form-group">
                <label for="confirm-password">Confirmar Senha</label>
                <div class="input-with-icon">
                    <i class="fas fa-lock"></i>
                    <input type="password" id="confirm-password" placeholder="Repita a nova senha" required>
                </div>
            </div>
            <div id="login-error" class="error-msg" style="display: none;"></div>
            <button type="button" class="btn-login-submit" id="btn-save-pass" onclick="window.PortalAuth.handleUpdatePassword()">
                Atualizar Senha <i class="fas fa-save"></i>
            </button>
            <div class="form-footer">
                <p><a href="portal_login.html" class="signup-link">Voltar ao Login</a></p>
            </div>
        `;
    },

    async handleUpdatePassword() {
        const newPass = document.getElementById('new-password').value;
        const confirmPass = document.getElementById('confirm-password').value;
        const errorEl = document.getElementById('login-error');

        if (newPass.length < 6) {
            errorEl.innerText = "A senha deve ter pelo menos 6 caracteres.";
            errorEl.style.display = 'block';
            return;
        }

        if (newPass !== confirmPass) {
            errorEl.innerText = "As senhas não coincidem.";
            errorEl.style.display = 'block';
            return;
        }

        const btn = document.getElementById('btn-save-pass');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Salvando...';

        try {
            const { error } = await window.supabaseApp.auth.updateUser({ password: newPass });
            if (error) throw error;

            alert("✅ Senha atualizada com sucesso!");
            window.location.href = 'portal.html';
        } catch (err) {
            errorEl.innerText = err.message || "Erro ao atualizar senha.";
            errorEl.style.display = 'block';
            btn.disabled = false;
            btn.innerHTML = 'Atualizar Senha <i class="fas fa-save"></i>';
        }
    },

    showSignUp() {
        // Redireciona para o index com o modo de signup se quisermos centralizar lá,
        // ou podemos abrir um modal aqui no futuro.
        alert("O cadastro de novos proprietários está sendo liberado em lotes. Entre em contato com o suporte para acesso imediato.");
    }
};

// Auto-init
document.addEventListener('DOMContentLoaded', () => {
    window.PortalAuth.init();
});
