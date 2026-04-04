/**
 * SUPPORT_USER_HANDLER.JS
 * Interface de chat para o usuário final falar com o Master.
 */

window.SupportUserHandler = {
    isOpen: false,
    initialized: false,

    init: function() {
        if (this.initialized) return;
        
        // Link CSS
        if (!document.getElementById('support-chat-styles')) {
            const link = document.createElement('link');
            link.id = 'support-chat-styles';
            link.rel = 'stylesheet';
            link.href = 'css/support_chat_styles.css';
            document.head.appendChild(link);
        }

        this.createTrigger();
        this.createUI();
        this.subscribeToReplies();
        this.initialized = true;
        console.log("💬 SupportUserHandler Initialized (FAB Mode)");
    },

    createTrigger: function() {
        if (document.getElementById('user-support-trigger')) return;
        const btn = document.createElement('div');
        btn.id = 'user-support-trigger';
        btn.title = "Falar com o Master (Suporte)";
        btn.innerHTML = '<i class="fas fa-headset"></i><div class="support-pulse"></div>';
        btn.onclick = () => this.toggle();
        document.body.appendChild(btn);
    },

    createUI: function() {
        const div = document.createElement('div');
        div.id = 'userChatContainer';
        div.style = `
            position: fixed;
            bottom: 80px;
            right: 20px;
            width: 320px;
            height: 450px;
            background: #0f172a;
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 20px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.5);
            display: none;
            flex-direction: column;
            z-index: 10001;
            overflow: hidden;
            animation: slideUp 0.3s ease-out;
            font-family: 'Inter', sans-serif;
        `;

        div.innerHTML = `
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #1e293b, #0f172a); padding: 20px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="width: 32px; height: 32px; background: #2563eb; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white;">
                        <i class="fas fa-shield-alt"></i>
                    </div>
                    <div>
                        <div style="font-size: 13px; font-weight: 800; color: white;">Suporte Master</div>
                        <div style="font-size: 9px; color: #10b981; text-transform: uppercase; font-weight: 800;">Online agora</div>
                    </div>
                </div>
                <i class="fas fa-times" onclick="window.SupportUserHandler.toggle()" style="color: #64748b; cursor: pointer;"></i>
            </div>
            
            <!-- Messages Area -->
            <div id="userChatMsgs" style="flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; background: rgba(15, 23, 42, 0.95);">
                <div style="background: rgba(255,255,255,0.03); color: #94a3b8; padding: 12px; border-radius: 12px; font-size: 11px; line-height: 1.5;">
                    Olá! Use este canal para tirar dúvidas sobre assinaturas, dados ou bugs diretamente com o administrador.
                </div>
            </div>

            <!-- Input Area -->
            <div style="padding: 15px; background: #1e293b; border-top: 1px solid rgba(255,255,255,0.05); display: flex; gap: 10px;">
                <input type="text" id="userChatInput" placeholder="Sua mensagem..." onkeypress="if(event.key==='Enter') window.SupportUserHandler.sendMessage()" style="flex: 1; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 10px; border-radius: 10px; font-size: 12px; outline: none;">
                <button onclick="window.SupportUserHandler.sendMessage()" style="background: #2563eb; color: white; border: none; width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                    <i class="fas fa-paper-plane"></i>
                </button>
            </div>
        `;

        document.body.appendChild(div);
        this.loadHistory();
    },

    toggle: function() {
        this.init();
        const el = document.getElementById('userChatContainer');
        this.isOpen = !this.isOpen;
        el.style.display = this.isOpen ? 'flex' : 'none';
        if (this.isOpen) {
            setTimeout(() => document.getElementById('userChatInput').focus(), 100);
            this.scrollBottom();
        }
    },

    loadHistory: async function() {
        const { data: { user } } = await window.supabaseApp.auth.getUser();
        if (!user) return;

        const { data: msgs } = await window.supabaseApp
            .from('admin_messages')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: true });

        if (msgs) {
            const container = document.getElementById('userChatMsgs');
            msgs.forEach(m => this.appendMsg(m));
            this.scrollBottom();
        }
    },

    appendMsg: function(msg) {
        const container = document.getElementById('userChatMsgs');
        const div = document.createElement('div');
        const isFromMe = !msg.is_from_admin;
        
        div.style = `
            align-self: ${isFromMe ? 'flex-end' : 'flex-start'};
            background: ${isFromMe ? '#2563eb' : 'rgba(255,255,255,0.05)'};
            color: ${isFromMe ? 'white' : '#cbd5e1'};
            padding: 10px 14px;
            border-radius: 14px;
            max-width: 85%;
            font-size: 11px;
            line-height: 1.4;
            border: 1px solid ${isFromMe ? 'transparent' : 'rgba(255,255,255,0.1)'};
            box-shadow: 0 4px 10px rgba(0,0,0,0.1);
        `;
        div.innerText = msg.content;
        container.appendChild(div);
    },

    sendMessage: async function() {
        const input = document.getElementById('userChatInput');
        const content = input.value.trim();
        if (!content) return;

        const { data: { user } } = await window.supabaseApp.auth.getUser();
        if (!user) { window.Toast.error("Você precisa estar logado."); return; }

        try {
            const msg = {
                user_id: user.id,
                user_email: user.email,
                content: content,
                is_from_admin: false,
                is_read: false
            };

            const { data, error } = await window.supabaseApp.from('admin_messages').insert([msg]).select();
            if (error) throw error;

            this.appendMsg(data[0]);
            input.value = '';
            this.scrollBottom();

        } catch (e) {
            window.Toast.error("Erro ao enviar: " + e.message);
        }
    },

    subscribeToReplies: async function() {
        const { data: { user } } = await window.supabaseApp.auth.getUser();
        if (!user) return;

        window.supabaseApp
            .channel('user-chat-replies')
            .on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'admin_messages',
                filter: `user_id=eq.${user.id}`
            }, (payload) => {
                if (payload.new.is_from_admin) {
                    this.appendMsg(payload.new);
                    this.scrollBottom();
                    if (!this.isOpen) window.Toast.info("Nova mensagem do suporte!");
                }
            })
            .subscribe();
    },

    scrollBottom: function() {
        const el = document.getElementById('userChatMsgs');
        if (el) el.scrollTop = el.scrollHeight;
    }
};

// Auto-Init
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.SupportUserHandler.init());
} else {
    window.SupportUserHandler.init();
}
