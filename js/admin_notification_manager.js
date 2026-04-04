/**
 * ADMIN_NOTIFICATION_MANAGER.JS
 * Monitora mensagens, vendas e novos usuários em tempo real para o Master.
 */

window.AdminNotificationManager = {
    init: async function() {
        const { data: { user } } = await window.supabaseApp.auth.getUser();
        if (!user) return;

        // Verificar se é Master
        const { data: profile } = await window.supabaseApp
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        const role = String(profile?.role || 'user').toLowerCase();
        if (role !== 'master' && role !== 'admin') return;

        console.log("🔔 Admin Notification Manager Ativo");
        this.checkNotifications();
        this.subscribeToChanges();
    },

    checkNotifications: async function() {
        try {
            // 1. Mensagens não lidas
            const { count: unreadMsgs } = await window.supabaseApp
                .from('admin_messages')
                .select('*', { count: 'exact', head: true })
                .eq('is_read', false)
                .eq('is_from_admin', false);

            // 2. Vendas pendentes (Exemplo usando uma RPC ou contagem direta)
            const { count: pendingSales } = await window.supabaseApp
                .from('pending_plan_activations')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'pending');

            // 3. Novos usuários (Últimas 24h)
            const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            const { count: newUsers } = await window.supabaseApp
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .gt('created_at', yesterday);

            const total = (unreadMsgs || 0) + (pendingSales || 0) + (newUsers || 0);
            this.updateBadge(total > 0);

        } catch (e) {
            console.warn("Erro ao checar notificações admin:", e);
        }
    },

    subscribeToChanges: function() {
        // Monitorar mensagens
        window.supabaseApp
            .channel('admin-changes')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_messages' }, () => this.checkNotifications())
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profiles' }, () => this.checkNotifications())
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pending_plan_activations' }, () => this.checkNotifications())
            .subscribe();
    },

    updateBadge: function(hasNotifications) {
        const container = document.getElementById('admin-btn-container');
        if (!container) return;

        // Remover badge anterior se existir
        const oldBadge = document.getElementById('adminNotifBadge');
        if (oldBadge) oldBadge.remove();

        if (hasNotifications) {
            const badge = document.createElement('span');
            badge.id = 'adminNotifBadge';
            badge.innerHTML = '!';
            badge.style = `
                position: absolute;
                top: -5px;
                right: -5px;
                background: #ef4444;
                color: white;
                font-size: 10px;
                font-weight: 900;
                width: 16px;
                height: 16px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                border: 2px solid white;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                animation: pulse 2s infinite;
            `;
            container.style.position = 'relative';
            container.appendChild(badge);
        }
    }
};

// Iniciar após o carregamento do Supabase
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => window.AdminNotificationManager.init(), 2000);
});
