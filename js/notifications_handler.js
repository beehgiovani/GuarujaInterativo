/**
 * notifications_handler.js
 * Gerencia o sistema de notificações (Sininho) na Sidebar
 */

class NotificationsHandler {
    constructor() {
        this.supabase = window.supabaseApp;
        this.userId = null;
        this.notifications = [];
        this.unreadCount = 0;

        this.init();
    }

    async init() {
        console.log('[Notifications] Initializing system...');

        // As the app uses a custom localStorage login, we don't strictly need a Supabase session 
        // to show notifications if RLS allows anon access.
        this.setupUI();
        this.fetchNotifications();
        this.subscribeToRealtime();

        // Optional: listen for custom login to refresh
        window.addEventListener('app-initialized', () => this.fetchNotifications());
    }

    setupUI() {
        // Find Sidebar Header Actions container
        const headerActions = document.querySelector('.header-actions');
        if (!headerActions) return;

        // Create Bell Button if not exists
        let btn = document.getElementById('btnNotifications');

        if (!btn) {
            console.warn("⚠️ Notification button not found in HTML. Notifications UI disabled.");
            return;
        }

        // Attach listeners to EXISTING button
        btn.onclick = (e) => this.toggleDropdown(e);
        btn.onmouseover = () => { if (this.unreadCount === 0) btn.style.color = '#3b82f6'; };
        btn.onmouseout = () => { if (this.unreadCount === 0) btn.style.color = '#666'; };

        // No need to appendChild as it is in HTML
        // headerActions.appendChild(btn);

        // Create Dropdown Container (Hidden)
        const dropdown = document.createElement('div');
        dropdown.id = 'notifDropdown';
        dropdown.className = 'notif-dropdown';
        dropdown.style.cssText = `
            display: none;
            position: absolute;
            top: 60px;
            left: 280px; /* Adjust based on sidebar width */
            width: 300px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.15);
            z-index: 10000;
            overflow: hidden;
            border: 1px solid #e5e7eb;
        `;
        // Keep it simple, append to body or sidebar? 
        // If sidebar has overflow hidden, might cut off. Appending to body is safer for absolute positioning.
        document.body.appendChild(dropdown);

        // Close dropdown on click outside
        document.addEventListener('click', (e) => {
            if (!btn.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });
    }

    async fetchNotifications() {
        try {
            // 1. Fetch System Notifications
            const { data: sysNotifs, error: sysError } = await this.supabase
                .from('notificacoes')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(20);

            if (sysError) throw sysError;

            // 2. Fetch Ads Notifications
            const { data: adsNotifs, error: adsError } = await this.supabase
                .from('anuncios_notifications')
                .select('*, anuncios(lote_id)')
                .order('criado_em', { ascending: false })
                .limit(20);

            if (adsError) console.warn('[Notifications] Ads fetch error:', adsError);

            // 3. Normalize & Merge
            const normalizedAds = (adsNotifs || []).map(n => ({
                id: n.id,
                titulo: n.titulo || 'Nova Oportunidade', 
                mensagem: n.mensagem,
                lida: !!n.lido,
                tipo: n.tipo || 'lead',
                created_at: n.criado_em,
                link_url: n.link_action, 
                is_ad: true, 
                lote_id: n.anuncios?.lote_id 
            }));

            // Combine and Sort by Date Descending
            this.notifications = [...(sysNotifs || []), ...normalizedAds]
                .filter(n => n.created_at) // Ensure we have a date to sort by
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                .slice(0, 30); 

            console.log('[Notifications] Total fetched:', this.notifications.length);
            this.updateBadge();
        } catch (e) {
            console.error('[Notifications] Error fetching:', e);
        }
    }

    subscribeToRealtime() {
        // Channel for System Notifications
        this.supabase
            .channel('public:notificacoes')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notificacoes' }, payload => {
                console.log('[Notifications] New system notification!', payload);
                this.notifications.unshift(payload.new);
                this.updateBadge();
                this.showToast(payload.new);
            })
            .subscribe();

        // Channel for Ads Notifications
        this.supabase
            .channel('public:anuncios_notifications')
            .on('postgres_changes', { 
                event: '*', // Listen for ALL events (INSERT, UPDATE)
                schema: 'public', 
                table: 'anuncios_notifications' 
            }, async (payload) => {
                console.log('[Notifications] Ad notification event:', payload.eventType, payload);
                const n = payload.new;
                
                // If it was an update that didn't set lido to false, we might want to skip.
                // But usually we want to refresh our local state.
                if (payload.eventType === 'UPDATE' && n.lido === true) {
                    // Update local state if it exists
                    const local = this.notifications.find(item => item.id === n.id);
                    if (local) local.lida = true;
                    this.updateBadge();
                    return;
                }

                // If it's a new or reset notification (lido = false)
                if (n.lido === false) {
                    // 1. Remove if already in list (to avoid duplicates and move to top)
                    this.notifications = this.notifications.filter(item => item.id !== n.id);

                    // 2. Fetch lote_id
                    let loteId = null;
                    if (n.anuncio_id) {
                        const { data } = await this.supabase
                            .from('anuncios')
                            .select('lote_id')
                            .eq('id', n.anuncio_id)
                            .single();
                        loteId = data?.lote_id;
                    }

                    // 3. Normalize
                    const normalized = {
                        id: n.id,
                        titulo: n.titulo || 'Nova Oportunidade',
                        mensagem: n.mensagem,
                        lida: false,
                        tipo: n.tipo || 'lead',
                        created_at: n.criado_em || new Date().toISOString(),
                        link_url: n.link_action,
                        is_ad: true,
                        lote_id: loteId
                    };

                    this.notifications.unshift(normalized);
                    this.updateBadge();
                    this.showToast(normalized);

                    if (n.tipo === '100_match') {
                        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGJ0fPTgjMGHm7A7+OZSA0PVqzn77NeHAU3kdb0zXosBSJ1xu/fljkKElut5O6rWhYLRJzQ8Lp6LgU2iNPz0oMyBh5uwO7lmEgOD1as5O+3YhwGN5HW88x7LAUR');
                        audio.play().catch(e => console.warn('Sound play blocked:', e)); 
                    }
                }
            })
            .subscribe();
    }

    updateBadge() {
        // Count unread (handling both lida and lido fields if raw, but we normalized)
        this.unreadCount = this.notifications.filter(n => !n.lida).length;
        const badge = document.getElementById('notifBadge');
        const btn = document.getElementById('btnNotifications');

        if (badge) {
            badge.innerText = this.unreadCount;
            badge.style.display = this.unreadCount > 0 ? 'block' : 'none';
        }

        if (btn) {
            btn.style.color = this.unreadCount > 0 ? '#f59e0b' : '#666';
        }
    }

    renderDropdown() {
        const dropdown = document.getElementById('notifDropdown');
        if (!dropdown) return;

        const btn = document.getElementById('btnNotifications');
        const rect = btn.getBoundingClientRect();
        dropdown.style.top = `${rect.bottom + 10}px`;
        dropdown.style.left = `${rect.left - 250}px`; // Adjust left to not overflow screen

        let html = `
            <div style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; display:flex; justify-content:space-between; align-items:center;">
                <span>Notificações</span>
                <button onclick="window.NotificationsHandler.markAllRead()" style="border:none; background:transparent; color:#2563eb; cursor:pointer; font-size:0.8rem;">Marcar todas lidas</button>
            </div>
            <div style="max-height: 350px; overflow-y: auto;">
        `;

        if (this.notifications.length === 0) {
            html += `<div style="padding: 20px; text-align: center; color: #999;">Nenhuma notificação recente.</div>`;
        } else {
            this.notifications.forEach(n => {
                let icon = '🔔';
                if (n.tipo === 'certidao') icon = '📄';
                if (n.tipo === '100_match' || n.is_ad) icon = '🔥';
                if (n.tipo === 'owner_opportunity') icon = '🏠';

                const bg = n.lida ? 'white' : '#fff7e6'; // Highlight unread with slight yellow
                const date = new Date(n.created_at).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                // Safe handling of click
                const clickAction = n.is_ad
                    ? `window.NotificationsHandler.handleAdClick('${n.id}', '${n.lote_id || ''}')`
                    : `window.NotificationsHandler.handleClick('${n.id}', '${n.link_url || ''}')`;

                html += `
                    <div class="notif-item" onclick="${clickAction}" 
                         style="padding: 12px; border-bottom: 1px solid #eee; background: ${bg}; cursor: pointer; transition: background 0.2s; position: relative;">
                        <div style="display: flex; align-items: flex-start; gap: 10px;">
                            <div style="font-size: 1.2rem;">${icon}</div>
                            <div style="flex: 1;">
                                <div style="font-weight: 600; font-size: 0.9rem; color: #333;">${n.titulo}</div>
                                <div style="font-size: 0.85rem; color: #666; margin-top: 2px;">${n.mensagem}</div>
                                <div style="font-size: 0.75rem; color: #999; margin-top: 4px;">${date}</div>
                            </div>
                            ${!n.lida ? '<div style="width:8px; height:8px; background:#ef4444; border-radius:50%; margin-top:6px;"></div>' : ''}
                        </div>
                    </div>
                `;
            });
        }

        html += `</div>`;
        dropdown.innerHTML = html;

        // Ensure visible
        dropdown.style.display = 'block';
    }

    toggleDropdown(e) {
        e.stopPropagation();
        const dropdown = document.getElementById('notifDropdown');
        if (dropdown.style.display === 'block') {
            dropdown.style.display = 'none';
        } else {
            this.renderDropdown();
        }
    }

    async handleClick(id, url) {
        // Mark as read in local state
        const notif = this.notifications.find(n => n.id === id);
        if (notif && !notif.lida) {
            notif.lida = true;
            this.updateBadge();
            // Async DB Update
            this.supabase.from('notificacoes').update({ lida: true }).eq('id', id).then();
        }

        // Action
        if (url) {
            if (window.Infosimples && window.Infosimples.verComprovante && url.includes('http')) {
                window.Infosimples.verComprovante(url);
            } else {
                window.open(url, '_blank');
            }
        }

        // NOVO: Disparar evento global para handlers específicos (ex: OpportunityHandler)
        window.dispatchEvent(new CustomEvent('notification-click', { detail: notif }));

        this.renderDropdown();
    }

    async handleAdClick(id, loteInscricao) {
        // Mark as read
        const notif = this.notifications.find(n => n.id === id);
        if (notif && !notif.lida) {
            notif.lida = true;
            this.updateBadge();
            // Mark read in anuncios_notifications table
            this.supabase
                .from('anuncios_notifications')
                .update({ lido: true })
                .eq('id', id)
                .select()
                .then(({ data, error }) => {
                    if (error) {
                        console.error('[Notifications] FAIL to mark as read:', error);
                        console.error('ID:', id);
                    } else {
                        console.log('[Notifications] DB Updated (Read):', data);
                    }
                });
        }

        // Open Ads Panel
        if (loteInscricao && window.AnunciosHandler) {
            // Close dropdown
            document.getElementById('notifDropdown').style.display = 'none';

            // Open Panel
            window.AdminHandler.openPanel(loteInscricao);

            // Optional: Zoom to lote
            // window.mapHandler.zoomToLote(loteInscricao); 
        } else {
            console.warn('Cannot open ad panel. Handler missing or invalid ID:', loteInscricao);
        }
    }

    async markAllRead() {
        this.notifications.forEach(n => n.lida = true);
        this.updateBadge();
        this.renderDropdown();

        // Update both tables
        await Promise.all([
            this.supabase.from('notificacoes').update({ lida: true }).neq('lida', true),
            this.supabase.from('anuncios_notifications').update({ lido: true }).neq('lido', true)
        ]);
    }

    showToast(n) {
        const toast = document.createElement('div');
        toast.className = 'toast info';

        // Style distinction for ads
        if (n.is_ad || n.tipo === '100_match') {
            toast.style.borderLeft = '4px solid #f59e0b';
        }

        toast.style.cursor = 'pointer';
        toast.onclick = (e) => {
            if (!e.target.classList.contains('toast-close')) {
                if (n.is_ad) this.handleAdClick(n.id, n.lote_id);
                else this.handleClick(n.id, n.link_url);
                toast.remove();
            }
        };

        const icon = (n.is_ad || n.tipo === '100_match') ? '🔥' : (n.tipo === 'owner_opportunity' ? '🏠' : '📄');

        toast.innerHTML = `
            <div class="toast-icon">${icon}</div>
            <div class="toast-content" style="flex:1;">
                <div class="toast-title">${n.titulo}</div>
                <div class="toast-message">${n.mensagem}</div>
            </div>
            <div class="toast-close" onclick="event.stopPropagation(); this.parentElement.remove()">×</div>
        `;
        document.getElementById('toast-container')?.appendChild(toast);

        // Sound for ads and opportunities
        if (n.is_ad || n.tipo === 'owner_opportunity') {
            // Som diferenciado: Um 'ping' limpo para oportunidades
            const audioSrc = n.tipo === 'owner_opportunity' 
                ? 'data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAIAAAAf39/f39/f38=' // Placeholder de exemplo ou som curto
                : 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGJ0fPTgjMGHm7A7+OZSA0PVqzn77NeHAU3kdb0zXosBSJ1xu/fljkKElut5O6rWhYLRJzQ8Lp6LgU2iNPz0oMyBh5uwO7lmEgOD1as5O+3YhwGN5HW88x7LAUR';
            
            const audio = new Audio(audioSrc);
            audio.play().catch(e => console.warn('Sound play blocked:', e)); 
        }

        setTimeout(() => {
            toast.classList.add('removing');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }
}

// Global instance
window.addEventListener('DOMContentLoaded', () => {
    // Wait for Supabase to be ready
    setTimeout(() => {
        window.NotificationsHandler = new NotificationsHandler();
    }, 1000);
});
