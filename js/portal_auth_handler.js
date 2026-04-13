/**
 * PORTAL_AUTH_HANDLER.JS - Autenticação dedicada para o Portal do Proprietário
 */

window.PortalAuth = {
    async init() {
        const loginForm = document.getElementById('portal-login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Verificar se já existe uma sessão ativa
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

    forgotPassword() {
        const email = document.getElementById('email').value;
        if (!email) {
            alert("Por favor, digite seu e-mail antes para recuperar a senha.");
            return;
        }
        alert("Enviando link de recuperação para: " + email);
        // Implementar futuramente se necessário
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
