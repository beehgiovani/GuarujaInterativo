// ==========================================
// AI HISTORY HANDLER
// ==========================================
// Manages persistence of AI generated content (Farol, Marketing, Legal)

window.AIHistoryHandler = {

    // Save a new interaction
    save: async function (inscricao, type, content) {
        console.log(`💾 Saving AI History: ${type} for ${inscricao}`);

        const timestamp = new Date().toISOString();
        const entry = {
            inscricao,
            type, // 'MARKETING', 'VALUATION', 'LEGAL', 'CHAT'
            content,
            created_at: timestamp
        };

        // 1. Save to Supabase (if available)
        if (window.supabaseApp) {
            const { error } = await window.supabaseApp
                .from('ai_history')
                .insert([entry]); // Assuming table exists, if not we might fallback to local or ignore

            if (error) {
                console.warn("Could not save to Supabase, falling back to LocalStorage", error);
                this.saveLocal(entry);
            }
        } else {
            this.saveLocal(entry);
        }

        // 2. Refresh UI if open
        this.refreshHistoryUI(inscricao);
    },

    saveLocal: function (entry) {
        let history = JSON.parse(localStorage.getItem('ai_history_cache') || '[]');
        history.push(entry);
        // Keep last 100 entries to avoid overflow
        if (history.length > 100) history = history.slice(-100);
        localStorage.setItem('ai_history_cache', JSON.stringify(history));
    },

    // Get history for a unit
    getHistory: async function (inscricaoRaw) {
        let items = [];
        // CLEAN INSCRICAO: Remove dashes for DB query if DB uses clean format
        // Assuming DB stores correct format, but let's try both or clean it.
        // Based on screenshot, DB has '10108001000' (clean).
        const inscricao = inscricaoRaw.replace(/\D/g, '');

        // Try Supabase
        if (window.supabaseApp) {
            const { data, error } = await window.supabaseApp
                .from('ai_history')
                .select('*')
                .eq('inscricao', inscricao)
                .order('created_at', { ascending: false });

            if (!error && data) items = data;
        }

        // Merge with local (deduping might be needed in prod, but for MVP just concat or prefer server)
        // For now, if server fails or is empty, check local
        if (items.length === 0) {
            const local = JSON.parse(localStorage.getItem('ai_history_cache') || '[]');
            // Local might have dashed or clean, check both? 
            items = local.filter(x => x.inscricao === inscricao || x.inscricao === inscricaoRaw).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            console.log(`📜 Loaded ${items.length} items from local history for ${inscricao}`);
        }

        return items;
    },

    refreshHistoryUI: async function (inscricao) {
        const container = document.getElementById(`farol-history-${inscricao}`);
        if (!container) {
            // Try Clean ID if failed
            const clean = inscricao.replace(/\D/g, '');
            const containerClean = document.getElementById(`farol-history-${clean}`);
            if (containerClean) {
                this.refreshHistoryUI(clean); // Recursion with clean ID
                return;
            }
            return; // Tab not open
        }

        container.innerHTML = '<div style="text-align:center; padding:10px; color:#666;"><i class="fas fa-spinner fa-spin"></i> Atualizando...</div>';

        const history = await this.getHistory(inscricao);

        if (history.length === 0) {
            container.innerHTML = `
                <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 10px;">Histórico de Análises</div>
                <div style="font-size: 12px; color: #94a3b8; text-align: center; padding: 20px;">Nenhuma análise salva.</div>
            `;
            return;
        }

        let html = `<div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 10px;">Histórico (${history.length})</div>`;

        history.forEach(item => {
            const date = new Date(item.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

            let icon = '🤖';
            let color = '#475569';
            let label = item.type; // Default to raw type

            // Translation Map
            if (item.type.includes('MARKETING')) {
                icon = '📸';
                color = '#be185d';
                label = item.type.replace('MARKETING: ', 'Marketing: ').replace('MARKETING', 'Marketing');
            }
            if (item.type.includes('VALUATION')) {
                icon = '💎';
                color = '#0369a1';
                label = 'Avaliação de Preço';
            }
            if (item.type.includes('LEGAL')) {
                icon = '🛡️';
                color = '#0f172a';
                label = 'Segurança Jurídica';
            }
            if (item.type.includes('CHAT')) {
                icon = '💬';
                label = 'Chat Farol';
            }

            // Truncate content for preview
            const preview = item.content.length > 60 ? item.content.substring(0, 60) + '...' : item.content;

            html += `
                <div onclick="window.AIHistoryHandler.showDetail('${escape(JSON.stringify(item))}')" style="background: white; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; margin-bottom: 8px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='#94a3b8'" onmouseout="this.style.borderColor='#e2e8f0'">
                    <div style="display: flex; justify-content: space-between; font-size: 10px; color: #64748b; margin-bottom: 4px;">
                        <span><i class="far fa-clock"></i> ${date}</span>
                        <span style="font-weight: 700; color: ${color};">${label}</span>
                    </div>
                    <div style="font-size: 11px; color: #334155; display: flex; gap: 6px;">
                        <span>${icon}</span>
                        <span>${preview}</span>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    },

    showDetail: function (itemStr) {
        try {
            const item = JSON.parse(unescape(itemStr));

            // Translation Logic (Same as list)
            let icon = '🤖';
            let color = '#475569';
            let label = item.type;

            if (item.type.includes('MARKETING')) {
                icon = '📸';
                color = '#be185d';
                label = item.type.replace('MARKETING: ', 'Marketing: ').replace('MARKETING', 'Marketing');
            }
            if (item.type.includes('VALUATION')) {
                icon = '💎';
                color = '#0369a1';
                label = 'Avaliação de Preço';
            }
            if (item.type.includes('LEGAL')) {
                icon = '🛡️';
                color = '#0f172a';
                label = 'Segurança Jurídica';
            }
            if (item.type.includes('CHAT')) {
                icon = '💬';
                label = 'Chat Farol';
            }

            // Show modal with full content
            const modal = document.createElement('div');
            modal.className = 'custom-modal-overlay active';
            modal.style.zIndex = '10200';
            modal.innerHTML = `
                <div class="custom-modal" style="max-width: 550px; max-height: 90vh; display: flex; flex-direction: column;">
                    <div class="custom-modal-header" style="background: ${color}; color: white; flex-shrink: 0;">
                        <div class="custom-modal-title" style="display: flex; align-items: center; gap: 8px;">
                            <span>${icon}</span> ${label}
                        </div>
                        <button class="custom-modal-close" onclick="this.closest('.custom-modal-overlay').remove()">&times;</button>
                    </div>
                    <div class="custom-modal-body" style="padding: 0; overflow-y: auto;">
                        <div style="font-size: 11px; color: #64748b; padding: 10px 20px; background: #fff; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between;">
                            <span><i class="far fa-clock"></i> ${new Date(item.created_at).toLocaleString()}</span>
                            <span>Histórico Salvo</span>
                        </div>
                        <div style="padding: 25px; background: #fff;">
                             <div style="background: #f8fafc; border-radius: 8px; padding: 20px; border: 1px solid #e2e8f0; line-height: 1.6; font-size: 14px; color: #334155;">
                                ${window.parseMarkdown(item.content)}
                             </div>
                        </div>
                        <div style="padding: 15px; text-align: center; border-top: 1px solid #eee;">
                            <button class="btn-primary-rich" onclick="this.closest('.custom-modal-overlay').remove()">Fechar</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        } catch (e) {
            console.error("Error showing detail", e);
            window.Toast.error("Erro ao abrir detalhe do histórico.");
        }
    }
};
