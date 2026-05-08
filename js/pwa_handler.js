/**
 * Gestão de PWA e Instalação
 * Aqui eu controlo aquele aviso de "Instalar App" pra quem tá no Chrome ou Android.
 */

window.PWAHandler = {
    deferredPrompt: null,
    storageKey: 'guarugeo_pwa_prompt',
    
    init: function() {
        // Verifica se já tá rodando como app instalado
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
        if (isStandalone) return;

        // Escuta o evento do navegador que avisa que o app pode ser instalado
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            this.checkAndShow();
        });

        // Quando o cara instala, eu limpo o prompt
        window.addEventListener('appinstalled', () => {
            this.deferredPrompt = null;
            this.hide();
            localStorage.setItem(this.storageKey, 'installed');
        });
        
        // No iOS não tem prompt automático, então a gente pode sugerir manual se quiser
        const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        if (isIos && !isStandalone) {
            this.checkAndShow();
        }
    },

    // Vê se já é hora de mostrar o aviso de novo
    checkAndShow: function() {
        const choice = localStorage.getItem(this.storageKey);
        if (choice === 'never' || choice === 'installed') return;
        
        if (choice === 'later') {
            const lastTime = localStorage.getItem(this.storageKey + '_time');
            // Se ele pediu pra avisar depois, espera 24h
            if (lastTime && Date.now() - parseInt(lastTime) < 24 * 60 * 60 * 1000) return;
        }

        // Mostra o aviso depois de 3 segundos pra não ser chato logo de cara
        setTimeout(() => this.show(), 3000);
    },

    show: function() {
        if (document.getElementById('pwa-custom-prompt')) return;

        // Cria o elemento do aviso no cantinho da tela
        const promptDiv = document.createElement('div');
        promptDiv.id = 'pwa-custom-prompt';
        promptDiv.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: white;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            z-index: 99999;
            max-width: 330px;
            border: 1px solid #e2e8f0;
            font-family: 'Inter', sans-serif;
            transform: translateY(150%);
            opacity: 0;
            transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        `;
        promptDiv.innerHTML = `
            <div style="display: flex; gap: 12px; align-items: flex-start; margin-bottom: 16px;">
                <div style="background: #2563eb; color: white; width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 20px; box-shadow: 0 4px 10px rgba(37, 99, 235, 0.3);">
                    <i class="fas fa-cloud-download-alt"></i>
                </div>
                <div>
                    <div style="font-weight: 800; color: #1e293b; font-size: 15px; margin-bottom: 4px;">Instalar Aplicativo</div>
                    <div style="font-size: 12.5px; color: #64748b; line-height: 1.4;">Gostaria de baixar a versão para instalação e ter acesso rápido direto do seu celular ou computador?</div>
                </div>
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <button id="pwa-btn-install" style="background: #2563eb; color: white; border: none; padding: 12px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#1d4ed8'" onmouseout="this.style.background='#2563eb'">
                    <i class="fas fa-download" style="margin-right: 6px;"></i> Baixar Agora
                </button>
                <div style="display: flex; gap: 8px;">
                    <button id="pwa-btn-later" style="flex: 1; background: #f1f5f9; color: #475569; border: none; padding: 10px; border-radius: 8px; font-weight: 600; font-size: 12px; cursor: pointer;">Depois</button>
                    <button id="pwa-btn-never" style="flex: 1; background: #f1f5f9; color: #94a3b8; border: none; padding: 10px; border-radius: 8px; font-weight: 600; font-size: 12px; cursor: pointer;">Não mostrar</button>
                </div>
            </div>
        `;
        document.body.appendChild(promptDiv);

        // Faz o efeito de subir na tela
        setTimeout(() => {
            promptDiv.style.transform = 'translateY(0)';
            promptDiv.style.opacity = '1';
        }, 100);

        // Configura os botões
        document.getElementById('pwa-btn-install').onclick = () => {
            if (this.deferredPrompt) {
                this.deferredPrompt.prompt();
                this.deferredPrompt.userChoice.then((choiceResult) => {
                    if (choiceResult.outcome === 'accepted') {
                        console.log('User accepted the PWA install');
                    }
                    this.deferredPrompt = null;
                    this.hide();
                });
            }
        };

        document.getElementById('pwa-btn-later').onclick = () => {
            localStorage.setItem(this.storageKey, 'later');
            localStorage.setItem(this.storageKey + '_time', Date.now().toString());
            this.hide();
        };

        document.getElementById('pwa-btn-never').onclick = () => {
            localStorage.setItem(this.storageKey, 'never');
            this.hide();
        };
    },

    hide: function() {
        const promptDiv = document.getElementById('pwa-custom-prompt');
        if (promptDiv) {
            promptDiv.style.transform = 'translateY(150%)';
            promptDiv.style.opacity = '0';
            setTimeout(() => promptDiv.remove(), 500);
        }
    }
};
