/**
 * ADMIN_MODERATION_HANDLER.JS - Gestão de Aprovações do Portal (Master Side)
 */

window.AdminModeration = {
    pendingOwners: [],
    pendingUnits: [],

    async init() {
        console.log("👮 Admin Moderation: Verificando permissões...");
        const { data: { session } } = await window.supabaseApp.auth.getSession();
        if (!session) return;

        // Verificar se é admin no profiles
        const { data: profile } = await window.supabaseApp
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();

        if (profile && ['admin', 'master'].includes(profile.role)) {
            console.log("🛠️ Modo Admin Ativado. Monitorando Portal...");
            this.startMonitoring();
            this.injectUI();
        }
    },

    async startMonitoring() {
        this.checkPending();
        // Poll a cada 5 minutos
        setInterval(() => this.checkPending(), 5 * 60 * 1000);
    },

    async checkPending() {
        try {
            const { data: owners } = await window.supabaseApp
                .from('owner_profile_proposals')
                .select('*')
                .eq('is_approved', false);

            const { data: units } = await window.supabaseApp
                .from('unidades_staging')
                .select('*')
                .eq('status', 'pending');

            this.pendingOwners = owners || [];
            this.pendingUnits = units || [];

            this.updateBadge();
        } catch (e) {
            console.error("Erro ao monitorar pendências:", e);
        }
    },

    injectUI() {
        // Injeta o botão de acesso no header-top-row do mapa
        const target = document.querySelector('.header-top-row');
        if (!target) return;

        const btn = document.createElement('div');
        btn.id = 'admin-portal-trigger';
        btn.className = 'admin-bubble';
        btn.style.cssText = `
            background: #fbbf24;
            color: #000;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 800;
            display: none;
            cursor: pointer;
            margin-left: 10px;
            animation: pulse-warn 2s infinite;
        `;
        btn.onclick = () => this.openModerationModal();
        target.appendChild(btn);

        // Injeta os estilos de animação
        const style = document.createElement('style');
        style.innerHTML = `
            @keyframes pulse-warn {
                0% { box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.4); }
                70% { box-shadow: 0 0 0 10px rgba(251, 191, 36, 0); }
                100% { box-shadow: 0 0 0 0 rgba(251, 191, 36, 0); }
            }
        `;
        document.head.appendChild(style);
    },

    updateBadge() {
        const total = this.pendingOwners.length + this.pendingUnits.length;
        const btn = document.getElementById('admin-portal-trigger');
        if (!btn) return;

        if (total > 0) {
            btn.style.display = 'block';
            btn.innerHTML = `<i class="fas fa-shield-alt"></i> ${total} Pendência(s) Portal`;
        } else {
            btn.style.display = 'none';
        }
    },

    async openModerationModal() {
        // Aqui injetaremos um modal simples para o Admin aprovar
        const html = `
            <div id="admin-moderation-overlay" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(8px);">
                <div style="background:#0f172a; color:#fff; width:95%; max-width:900px; border-radius:24px; max-height:90vh; display:flex; flex-direction:column; border:1px solid rgba(255,255,255,0.1); overflow:hidden; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
                    <header style="display:flex; justify-content:space-between; padding:25px 30px; background:rgba(255,255,255,0.02); border-bottom:1px solid rgba(255,255,255,0.05);">
                        <h3 style="margin:0; font-weight:900; letter-spacing:-0.5px;">Centro de Moderação e Curadoria</h3>
                        <button onclick="document.getElementById('admin-moderation-overlay').remove()" style="background:none; border:none; color:#94a3b8; font-size:24px; cursor:pointer;">&times;</button>
                    </header>
                    
                    <div style="padding:30px; overflow-y:auto; flex:1;">
                        ${this.renderPendingList()}
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
    },

    renderPendingList() {
        let listHtml = '';

        if (this.pendingOwners.length === 0 && this.pendingUnits.length === 0) {
            return '<p style="text-align:center; padding:20px; color:#94a3b8;">Nenhuma pendência.</p>';
        }

        // Owners
        this.pendingOwners.forEach(o => {
            listHtml += `
                <div style="background:rgba(255,255,255,0.03); border-radius:8px; padding:15px; margin-bottom:10px; border-left:4px solid #3b82f6;">
                    <div style="font-weight:800; font-size:14px;">${o.full_name}</div>
                    <div style="font-size:12px; color:#94a3b8;">CPF: ${o.cpf_cnpj} | Tel: ${o.phone}</div>
                    <div style="margin-top:10px; display:flex; gap:10px;">
                        <button onclick="window.AdminModeration.approveProfile('${o.id}')" style="background:#10b981; color:#fff; border:none; padding:5px 12px; border-radius:4px; font-size:11px; cursor:pointer; font-weight:700;">Aprovar Perfil</button>
                    </div>
                </div>
            `;
        });

        // Units (Imóveis)
        this.pendingUnits.forEach(u => {
            const photosHtml = (u.imagens_urls || []).map(url => `
                <div style="width:120px; height:80px; flex-shrink:0; border-radius:8px; overflow:hidden; position:relative;">
                    <img src="${url}" style="width:100%; height:100%; object-fit:cover; cursor:pointer;" onclick="window.open('${url}', '_blank')">
                </div>
            `).join('') || '<div style="color:#64748b; font-size:12px; padding:10px;">Sem fotos enviadas</div>';

            listHtml += `
                <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); border-radius:16px; padding:20px; margin-bottom:25px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:20px;">
                        <span style="background:#fbbf24; color:#000; padding:4px 10px; border-radius:6px; font-size:10px; font-weight:900; text-transform:uppercase;">Validação Técnica Requerida</span>
                        <span style="color:#64748b; font-size:11px;">Enviado por UID: ${u.user_id.substring(0,8)}...</span>
                    </div>

                    <!-- Galeria de Conferência -->
                    <div style="display:flex; gap:10px; overflow-x:auto; padding-bottom:10px; margin-bottom:20px;">
                        ${photosHtml}
                    </div>

                    <!-- Formulário de Curadoria -->
                    <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:15px; margin-bottom:20px;">
                        <div>
                            <label style="display:block; font-size:10px; color:#94a3b8; font-weight:800; margin-bottom:5px;">Inscrição</label>
                            <input type="text" id="mod-inscricao-${u.id}" value="${u.inscricao || ''}" style="width:100%; padding:8px; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff; font-size:13px;">
                        </div>
                        <div>
                            <label style="display:block; font-size:10px; color:#94a3b8; font-weight:800; margin-bottom:5px;">Tipo</label>
                            <select id="mod-tipo-${u.id}" style="width:100%; padding:8px; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff; font-size:13px;">
                                <option value="Apartamento" ${u.tipo==='Apartamento'?'selected':''}>Apartamento</option>
                                <option value="Casa" ${u.tipo==='Casa'?'selected':''}>Casa</option>
                                <option value="Terreno" ${u.tipo==='Terreno'?'selected':''}>Terreno</option>
                            </select>
                        </div>
                        <div>
                            <label style="display:block; font-size:10px; color:#94a3b8; font-weight:800; margin-bottom:5px;">Área (m²)</label>
                            <input type="number" id="mod-metragem-${u.id}" value="${u.metragem || ''}" style="width:100%; padding:8px; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff; font-size:13px;">
                        </div>
                        <div>
                            <label style="display:block; font-size:10px; color:#94a3b8; font-weight:800; margin-bottom:5px;">Quartos</label>
                            <input type="number" id="mod-quartos-${u.id}" value="${u.quartos || ''}" style="width:100%; padding:8px; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff; font-size:13px;">
                        </div>
                        <div>
                            <label style="display:block; font-size:10px; color:#94a3b8; font-weight:800; margin-bottom:5px;">Suítes</label>
                            <input type="number" id="mod-suites-${u.id}" value="${u.suites || ''}" style="width:100%; padding:8px; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff; font-size:13px;">
                        </div>
                        <div>
                            <label style="display:block; font-size:10px; color:#94a3b8; font-weight:800; margin-bottom:5px;">Valor de Venda (R$)</label>
                            <input type="number" id="mod-valor-${u.id}" value="${u.valor_proposto || ''}" style="width:100%; padding:8px; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff; font-size:13px;">
                        </div>
                    </div>

                    <div style="display:flex; gap:10px; justify-content:flex-end;">
                        <button onclick="window.AdminModeration.rejectUnit('${u.id}')" style="background:none; border:1px solid #ef4444; color:#ef4444; padding:10px 20px; border-radius:10px; font-size:11px; font-weight:800; cursor:pointer;">REJEITAR</button>
                        <button onclick="window.AdminModeration.editAndApproveUnit('${u.id}')" style="background:#fbbf24; color:#000; border:none; padding:10px 25px; border-radius:10px; font-size:11px; font-weight:900; cursor:pointer;">VALIDAR E PUBLICAR</button>
                    </div>
                </div>
            `;
        });

        return listHtml;
    },

    async approveProfile(id) {
        if (!confirm("Confirmar aprovação deste proprietário?")) return;
        try {
            const { error } = await window.supabaseApp.rpc('approve_owner_profile', { proposal_id: id });
            if (error) throw error;
            window.Toast?.success("Perfil aprovado com sucesso!");
            this.checkPending();
            document.getElementById('admin-moderation-overlay')?.remove();
        } catch (e) {
            console.error(e);
            alert("Erro ao aprovar: " + e.message);
        }
    },

    async editAndApproveUnit(id) {
        if (!confirm("Confirmar entrada deste imóvel já com as correções realizadas?")) return;

        try {
            window.Loading?.show("Validando e Publicando...");
            
            // 1. Coletar dados corrigidos pelo Admin
            const correctedData = {
                inscricao: document.getElementById(`mod-inscricao-${id}`).value,
                tipo: document.getElementById(`mod-tipo-${id}`).value,
                metragem: parseFloat(document.getElementById(`mod-metragem-${id}`).value) || null,
                quartos: parseInt(document.getElementById(`mod-quartos-${id}`).value) || null,
                suites: parseInt(document.getElementById(`mod-suites-${id}`).value) || null,
                valor_real: parseFloat(document.getElementById(`mod-valor-${id}`).value) || null,
                status: 'pending' // Continua pendente até o RPC finalizar
            };

            // 2. Salvar correções no Staging antes de aprovar
            const { error: updErr } = await window.supabaseApp
                .from('unidades_staging')
                .update(correctedData)
                .eq('id', id);

            if (updErr) throw updErr;

            // 3. Chamar a aprovação definitiva (RPC)
            const { error: rpcErr } = await window.supabaseApp.rpc('approve_unit_staging', { staging_id: id });
            if (rpcErr) throw rpcErr;

            window.Toast?.success("Imóvel validado pelo Master e publicado com sucesso!");
            this.checkPending();
            document.getElementById('admin-moderation-overlay')?.remove();

        } catch (e) {
            console.error("Erro na curadoria:", e);
            alert("Erro ao processar: " + e.message);
        } finally {
            window.Loading?.hide();
        }
    },

    async rejectUnit(id) {
        const reason = prompt("Motivo da rejeição (opcional):");
        if (reason === null) return;

        try {
            window.Loading?.show("Processando rejeição...");
            
            // 1. Obter o user_id e inscrição antes de atualizar
            const { data: unit } = await window.supabaseApp
                .from('unidades_staging')
                .select('user_id, inscricao')
                .eq('id', id)
                .single();

            // 2. Marcar como rejeitado no staging
            const { error: updErr } = await window.supabaseApp
                .from('unidades_staging')
                .update({ status: 'rejected', admin_notes: reason })
                .eq('id', id);

            if (updErr) throw updErr;

            // 3. Notificar o Proprietário
            if (unit) {
                await window.supabaseApp.from('notificacoes').insert({
                    user_id: unit.user_id,
                    titulo: '⚠️ Imóvel Necessita Ajustes',
                    mensagem: `Sua solicitação para o imóvel ${unit.inscricao || ''} foi revisada e necessita de correções: ${reason}`,
                    tipo: 'approval_rejection',
                    data_id: unit.inscricao
                });
            }

            window.Toast?.success("Imóvel rejeitado e proprietário notificado.");
            this.checkPending();
            document.getElementById('admin-moderation-overlay')?.remove();
        } catch (e) {
            alert("Erro: " + e.message);
        } finally {
            window.Loading?.hide();
        }
    }
};

// Auto-init
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.AdminModeration.init());
} else {
    window.AdminModeration.init();
}
