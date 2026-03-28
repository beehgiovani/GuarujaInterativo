// ==========================================
// ADMIN HANDLER - ADMIN_HANDLER.JS
// ==========================================
// Manages users, credits, and system settings

window.Admin = {
    init: function() {
        console.log("🛠️ Admin Handler Initializing...");
    },

    showAdminPanel: async function() {
        window.Loading.show('Abrindo Painel...', 'Carregando dados...');
        try {
            const modal = document.createElement('div');
            modal.className = 'custom-modal-overlay active';
            modal.id = 'adminPanelModal';
            modal.style.zIndex = '10030';
            
            modal.innerHTML = `
                <div class="custom-modal" style="max-width: 900px; width: 95%; background: var(--background-dark); color: white; border: 1px solid rgba(255,255,255,0.1); overflow: hidden;">
                    <div class="custom-modal-header" style="background: rgba(0,0,0,0.3); color: white; border-bottom: 1px solid rgba(255,255,255,0.1); padding: 25px 30px;">
                        <div class="custom-modal-title" style="display: flex; align-items: center; gap: 12px;">
                            <div style="width: 32px; height: 32px; background: #2563eb; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 14px;">
                                <i class="fas fa-hammer"></i>
                            </div>
                            <div>
                                <div style="font-size: 18px; font-weight: 800; line-height: 1;">Painel de Controle Master</div>
                                <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase; margin-top: 4px; letter-spacing: 1px;">Gestão de Dados & Usuários</div>
                            </div>
                        </div>
                        <button class="custom-modal-close" onclick="this.closest('.custom-modal-overlay').remove()" style="color: white; opacity: 0.5;">&times;</button>
                    </div>
                    <div class="admin-tabs" style="display: flex; background: rgba(0,0,0,0.2); padding: 0 10px; overflow-x: auto;">
                        <button class="admin-tab active" onclick="window.Admin.switchTab(this, 'dashboard')" style="flex: 1; min-width: 100px; padding: 18px; border: none; background: none; font-weight: 700; color: white; cursor: pointer; border-bottom: 3px solid #2563eb; font-size: 13px;">📊 Dashboard</button>
                        <button class="admin-tab" onclick="window.Admin.switchTab(this, 'users')" style="flex: 1; min-width: 100px; padding: 18px; border: none; background: none; font-weight: 700; color: #94a3b8; cursor: pointer; font-size: 13px;">👥 Usuários</button>
                        <button class="admin-tab" onclick="window.Admin.switchTab(this, 'monetization')" style="flex: 1; min-width: 100px; padding: 18px; border: none; background: none; font-weight: 700; color: #94a3b8; cursor: pointer; font-size: 13px;">💰 Planos</button>
                        <button class="admin-tab" onclick="window.Admin.switchTab(this, 'transactions')" style="flex: 1; min-width: 100px; padding: 18px; border: none; background: none; font-weight: 700; color: #94a3b8; cursor: pointer; font-size: 13px;">💵 Vendas</button>
                        <button class="admin-tab" onclick="window.Admin.switchTab(this, 'curatorship')" style="flex: 1; min-width: 100px; padding: 18px; border: none; background: none; font-weight: 700; color: #94a3b8; cursor: pointer; font-size: 13px;">🏛️ Curadoria</button>
                        <button class="admin-tab" onclick="window.Admin.switchTab(this, 'crm')" style="flex: 1; min-width: 100px; padding: 18px; border: none; background: none; font-weight: 700; color: #94a3b8; cursor: pointer; font-size: 13px;">🤝 CRM Admin</button>
                        <button class="admin-tab" onclick="window.Admin.switchTab(this, 'leiloes')" style="flex: 1; min-width: 100px; padding: 18px; border: none; background: none; font-weight: 700; color: #94a3b8; cursor: pointer; font-size: 13px;">⚖️ Leilões</button>
                        <button class="admin-tab" onclick="window.Admin.switchTab(this, 'settings')" style="flex: 1; min-width: 100px; padding: 18px; border: none; background: none; font-weight: 700; color: #94a3b8; cursor: pointer; font-size: 13px;">⚙️ Config</button>
                        <button class="admin-tab" onclick="window.Admin.switchTab(this, 'audit')" style="flex: 1; min-width: 100px; padding: 18px; border: none; background: none; font-weight: 700; color: #94a3b8; cursor: pointer; font-size: 13px;">📜 Auditoria</button>
                    </div>
                    <div id="adminPanelContent" style="padding: 30px; max-height: 75vh; overflow-y: auto;">
                        <!-- Content injected by switchTab -->
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            this.switchTab(modal.querySelector('.admin-tab.active'), 'dashboard');

        } catch (e) {
            console.error(e);
            window.Toast.error("Erro ao carregar painel admin: " + e.message);
        } finally {
            window.Loading.hide();
        }
    },

    switchTab: async function(btn, tab) {
        // Toggle UI
        document.querySelectorAll('.admin-tab').forEach(b => {
            b.classList.remove('active');
            b.style.color = '#94a3b8';
            b.style.borderBottom = 'none';
        });
        btn.classList.add('active');
        btn.style.color = 'white';
        btn.style.borderBottom = '3px solid #2563eb';

        const content = document.getElementById('adminPanelContent');
        content.innerHTML = '<div style="padding: 40px; text-align: center;"><i class="fas fa-spinner fa-spin"></i> Carregando...</div>';

        if (tab === 'dashboard') {
            await this.renderDashboard(content);
        } else if (tab === 'users') {
            await this.renderUsers(content);
        } else if (tab === 'monetization') {
            await this.renderMonetization(content);
        } else if (tab === 'transactions') {
            await this.renderTransactions(content);
        } else if (tab === 'curatorship') {
            await this.renderCuratorship(content);
        } else if (tab === 'crm') {
            await this.renderCRMIntelligence(content);
        } else if (tab === 'leiloes') {
            if (window.LeilaoStaging) await window.LeilaoStaging.renderPanel(content);
            else content.innerHTML = '<div style="padding:40px;text-align:center;color:#ef4444;">Script LeilaoStaging não carregado.</div>';
        } else if (tab === 'audit') {
            await this.renderAuditLogs(content);
        } else if (tab === 'settings') {
            await this.renderSettings(content);
        }
    },

    renderUsers: async function(container) {
        const { data: users, error } = await window.supabaseApp
            .from('profiles')
            .select('*')
            .order('email', { ascending: true });

        if (error) { container.innerHTML = '<div style="color: #ef4444;">Erro ao carregar usuários</div>'; return; }

        container.innerHTML = `
            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; overflow: hidden;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: rgba(255,255,255,0.05); text-align: left; font-size: 11px; text-transform: uppercase; color: #94a3b8;">
                            <th style="padding: 15px 20px;">Usuário</th>
                            <th style="padding: 15px 20px; text-align: center;">Status</th>
                            <th style="padding: 15px 20px; text-align: center;">Vínculo</th>
                            <th style="padding: 15px 20px; text-align: center;">Créditos</th>
                            <th style="padding: 15px 20px; text-align: right;">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${users.map(u => {
                            const roleColors = { master: '#7c3aed', admin: '#1e40af', elite: '#b45309', pro: '#0369a1', user: '#334155' };
                            const roleColor = roleColors[u.role] || '#334155';
                            const status = u.status || 'approved';
                            const statusColor = status === 'approved' ? '#10b981' : (status === 'pending' ? '#f59e0b' : '#ef4444');
                            
                            return `
                            <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                                <td style="padding: 15px 20px;">
                                    <div style="font-weight: 700; color: white;">${u.email}</div>
                                    <div style="font-size: 11px; color: #64748b;">${u.id.slice(0, 8)}${u.full_name ? ' · ' + u.full_name : ''}</div>
                                    ${u.phone ? `<div style="font-size: 11px; color: #10b981; margin-top: 2px;"><i class="fab fa-whatsapp"></i> ${u.phone}</div>` : ''}
                                </td>
                                <td style="padding: 15px 20px; text-align: center;">
                                    <span style="font-size: 10px; font-weight: 800; padding: 4px 10px; border-radius: 20px; background: ${statusColor}20; color: ${statusColor}; border: 1px solid ${statusColor}40;">
                                        ${(status || 'pending').toUpperCase()}
                                    </span>
                                </td>
                                <td style="padding: 15px 20px; text-align: center;">
                                    <select onchange="window.Admin.changeRole('${u.id}', this.value)" style="background: ${roleColor}; color: white; border: none; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 800; cursor: pointer; text-transform: uppercase;">
                                        ${['user','pro','elite','admin','master'].map(r => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${r.toUpperCase()}</option>`).join('')}
                                    </select>
                                </td>
                                <td style="padding: 15px 20px; text-align: center; color: #f59e0b; font-weight: 800;">
                                    ${u.credits || 0}
                                </td>
                                <td style="padding: 15px 20px; text-align: right; display: flex; gap: 8px; align-items: center; justify-content: flex-end;">
                                    ${status === 'pending' ? `
                                        <button onclick="window.Admin.approveUser('${u.id}', '${u.email}')" style="background: #10b981; color: white; border: none; padding: 6px 14px; border-radius: 8px; font-size: 11px; font-weight: 800; cursor: pointer;">
                                            APROVAR
                                        </button>
                                        <button onclick="window.Admin.rejectUser('${u.id}', '${u.email}')" style="background: rgba(239,68,68,0.2); color: #ef4444; border: 1px solid rgba(239,68,68,0.3); padding: 6px 12px; border-radius: 8px; font-size: 11px; cursor: pointer;">
                                            REJEITAR
                                        </button>
                                    ` : `
                                        <input type="number" id="credit-input-${u.id}" placeholder="+/- créditos" style="width: 80px; padding: 6px 10px; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; background: rgba(255,255,255,0.05); color: white; font-size: 12px;" />
                                        <button onclick="window.Admin.quickAdjustCredits('${u.id}', '${u.email}')" style="background: #10b981; color: white; border: none; padding: 8px 14px; border-radius: 8px; font-size: 11px; font-weight: 800; cursor: pointer;">
                                            ✓
                                        </button>
                                    `}
                                </td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    renderCuratorship: async function(container) {
        // Fetch both unit and lote edits
        const [unitRes, loteRes] = await Promise.all([
            window.supabaseApp.from('user_unit_edits').select('*, profiles(email)').eq('is_approved', false).order('created_at', { ascending: false }),
            window.supabaseApp.from('user_lote_edits').select('*, profiles(email)').eq('is_approved', false).order('created_at', { ascending: false })
        ]);

        const unitEdits = (unitRes.data || []).map(e => ({ ...e, type: 'unit', ref: e.unit_inscricao }));
        const loteEdits = (loteRes.data || []).map(e => ({ ...e, type: 'lote', ref: e.lote_inscricao }));
        const allEdits = [...unitEdits, ...loteEdits].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        if (allEdits.length === 0) {
            container.innerHTML = `
                <div style="padding: 60px 40px; text-align: center;">
                    <div style="font-size: 40px; margin-bottom: 20px; opacity: 0.5;">🙌</div>
                    <div style="font-weight: 800; font-size: 18px; color: white;">Monitor Limpo</div>
                    <p style="color: #94a3b8; font-size: 14px; margin-top: 5px;">Todas as sugestões de parceiros foram processadas.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div style="margin-bottom: 20px; padding: 15px; background: rgba(37, 99, 235, 0.1); border-radius: 8px; border: 1px solid rgba(37, 99, 235, 0.2); color: #93c5fd; font-size: 12px; display: flex; align-items: center; gap: 10px;">
                <i class="fas fa-info-circle"></i> Sugestões da comunidade aguardando integração global.
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 12px;">
                ${allEdits.map(e => `
                    <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 20px; display: flex; justify-content: space-between; align-items: center;">
                        <div style="display: flex; gap: 20px; align-items: center;">
                             <div style="width: 44px; height: 44px; background: rgba(255,255,255,0.05); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; color: ${e.type === 'unit' ? '#3b82f6' : '#10b981'};">
                                <i class="fas ${e.type === 'unit' ? 'fa-building' : 'fa-map-marked-alt'}"></i>
                             </div>
                             <div>
                                <div style="font-weight: 800; color: white; display: flex; align-items: center; gap: 8px;">
                                    ${e.profiles?.email || 'User'} 
                                    <span style="font-weight: 400; color: #64748b; font-size: 11px;">sugeriu em ${e.ref} (${e.type === 'unit' ? 'Unidade' : 'Lote'})</span>
                                </div>
                                <div style="margin-top: 6px; display: flex; align-items: center; gap: 10px;">
                                    <span style="font-size: 10px; color: #94a3b8; background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px; text-transform: uppercase; border: 1px solid rgba(255,255,255,0.1);">${e.field_name}</span>
                                    <div style="font-size: 13px;">
                                        <span style="color: #fca5a5; text-decoration: line-through; opacity: 0.6; max-width: 150px; overflow: hidden; text-overflow: ellipsis; display: inline-block; vertical-align: middle;">${e.old_value || 'N/A'}</span>
                                        <i class="fas fa-arrow-right" style="margin: 0 8px; font-size: 10px; opacity: 0.3;"></i>
                                        <span style="color: #4ade80; font-weight: 800; max-width: 250px; overflow: hidden; text-overflow: ellipsis; display: inline-block; vertical-align: middle;">${e.new_value}</span>
                                    </div>
                                </div>
                             </div>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button onclick="window.Admin.rejectEdit('${e.id}', '${e.type}')" style="background: rgba(239, 68, 68, 0.1); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.2); width: 36px; height: 36px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center;" title="Rejeitar">
                                <i class="fas fa-times"></i>
                            </button>
                            <button onclick="window.Admin.approveEdit('${e.id}', '${e.type}')" style="background: #22c55e; color: white; border: none; height: 36px; padding: 0 20px; border-radius: 8px; font-size: 12px; font-weight: 800; cursor: pointer; box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);">
                                APROVAR
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    approveEdit: async function(editId, type) {
        window.Loading.show('Aprovando...', 'Sincronizando com Banco Global');
        try {
            const table = type === 'unit' ? 'user_unit_edits' : 'user_lote_edits';
            const refField = type === 'unit' ? 'unit_inscricao' : 'lote_inscricao';
            const targetTable = type === 'unit' ? 'unidades' : 'lotes';

            // 1. Get the target edit
            const { data: mainEdit, error: getErr } = await window.supabaseApp.from(table).select('*').eq('id', editId).single();
            if (getErr) throw getErr;

            // 2. Look for other pending edits for the same unit/lote and SAME USER
            const { data: allRelated } = await window.supabaseApp
                .from(table)
                .select('*')
                .eq(refField, mainEdit[refField])
                .eq('user_id', mainEdit.user_id)
                .eq('is_approved', false);

            const updateObj = {};
            const editIds = [];
            
            allRelated.forEach(e => {
                // Handle JSON values (like gallery)
                try {
                    updateObj[e.field_name] = (e.new_value.startsWith('[') || e.new_value.startsWith('{')) ? JSON.parse(e.new_value) : e.new_value;
                } catch(e) {
                    updateObj[e.field_name] = e.new_value;
                }
                editIds.push(e.id);
            });
            
            // 3. Update the main table
            const { error: updErr } = await window.supabaseApp.from(targetTable).update(updateObj).eq('inscricao', mainEdit[refField]);
            if (updErr) throw updErr;

            // 4. Mark all as approved
            await window.supabaseApp.from(table).update({ is_approved: true }).in('id', editIds);
            
            // 5. Audit Log
            const { data: { user: adminUser } } = await window.supabaseApp.auth.getUser();
            if (adminUser) {
                await window.supabaseApp.from('audit_logs').insert({
                    user_id: adminUser.id,
                    user_email: adminUser.email,
                    action: `curated_approve_${type}`,
                    detail: `Aprovou ${editIds.length} campos em ${mainEdit[refField]}`
                });
            }

            window.Toast.success(`Aprovado: ${editIds.length} campos integrados!`);
            this.refreshTabs();
        } catch (e) {
            console.error(e);
            window.Toast.error('Erro ao aprovar: ' + e.message);
        } finally {
            window.Loading.hide();
        }
    },

    rejectEdit: async function(editId, type) {
        if (!confirm('Deseja descartar esta sugestão?')) return;
        try {
            const table = type === 'unit' ? 'user_unit_edits' : 'user_lote_edits';
            const refField = type === 'unit' ? 'unit_inscricao' : 'lote_inscricao';

            const { data: edit } = await window.supabaseApp.from(table).select('*').eq('id', editId).single();
            await window.supabaseApp.from(table).delete().eq('id', editId);
            
            if (edit) {
                const { data: { user: adminUser } } = await window.supabaseApp.auth.getUser();
                if (adminUser) {
                    await window.supabaseApp.from('audit_logs').insert({
                        user_id: adminUser.id,
                        user_email: adminUser.email,
                        action: `curated_reject_${type}`,
                        detail: `Rejeitou edit em ${edit[refField]} (${edit.field_name})`
                    });
                }
            }

            window.Toast.info('Sugestão descartada.');
            this.refreshTabs();
        } catch (e) { console.error(e); }
    },

    refreshTabs: function() {
        const activeTab = document.querySelector('.admin-tab.active');
        if (activeTab) {
            let tabName = 'users';
            if (activeTab.innerText.includes('Curadoria')) tabName = 'curatorship';
            if (activeTab.innerText.includes('Vendas')) tabName = 'transactions';
            if (activeTab.innerText.includes('Config')) tabName = 'settings';
            if (activeTab.innerText.includes('Leilões')) tabName = 'leiloes';
            this.switchTab(activeTab, tabName);
        }
    },

    approvePlanActivation: async function(activationId) {
        window.Loading.show('Ativando Plano...', 'Sincronizando privilégios');
        try {
            const { data: act, error: getErr } = await window.supabaseApp.from('pending_plan_activations').select('*, profiles(email)').eq('id', activationId).single();
            if (getErr) throw getErr;

            await window.supabaseApp.from('profiles').update({ 
                role: act.plano_solicitado,
                monthly_unlocks_used: 0 
            }).eq('id', act.user_id);

            await window.supabaseApp.from('pending_plan_activations').update({ 
                status: 'approved', 
                approved_at: new Date().toISOString() 
            }).eq('id', activationId);

            const { data: { user: adminUser } } = await window.supabaseApp.auth.getUser();
            if (adminUser) {
                await window.supabaseApp.from('audit_logs').insert({
                    user_id: adminUser.id,
                    user_email: adminUser.email,
                    action: 'plan_approved',
                    detail: `Aprovou plano ${act.plano_solicitado.toUpperCase()} para ${act.profiles?.email}`
                });
            }

            window.Toast.success('Plano ativado com sucesso!');
            this.refreshTabs();
        } catch (e) {
            console.error(e);
            window.Toast.error('Erro ao aprovar plano: ' + e.message);
        } finally {
            window.Loading.hide();
        }
    },

    approveCreditRelease: async function(releaseId) {
        window.Loading.show('Liberando Créditos...', 'Atualizando carteira');
        try {
            const { data: rel, error: getErr } = await window.supabaseApp.from('pending_credit_releases').select('*, profiles(email)').eq('id', releaseId).single();
            if (getErr) throw getErr;

            // Using adjust_credits_admin instead of add_credits_direct to reuse existing RPC
            await window.supabaseApp.rpc('adjust_credits_admin', { 
                target_user_id: rel.user_id, 
                amount_to_adjust: rel.quantidade
            });

            await window.supabaseApp.from('pending_credit_releases').update({ 
                status: 'approved', 
                approved_at: new Date().toISOString() 
            }).eq('id', releaseId);

            const { data: { user: adminUser } } = await window.supabaseApp.auth.getUser();
            if (adminUser) {
                await window.supabaseApp.from('audit_logs').insert({
                    user_id: adminUser.id,
                    user_email: adminUser.email,
                    action: 'credits_approved',
                    detail: `Liberou ${rel.quantidade} créditos para ${rel.profiles?.email}`
                });
            }

            window.Toast.success('Créditos liberados com sucesso!');
            this.refreshTabs();
        } catch (e) {
            console.error(e);
            window.Toast.error('Erro ao aprovar créditos: ' + e.message);
        } finally {
            window.Loading.hide();
        }
    },

    rejectFinance: async function(table, id) {
        if (!confirm('Deseja REJEITAR esta solicitação?')) return;
        try {
            await window.supabaseApp.from(table).update({ status: 'rejected' }).eq('id', id);
            window.Toast.info('Solicitação rejeitada.');
            this.refreshTabs();
        } catch (e) { console.error(e); }
    },

    adjustCredits: async function(userId, userName) {
        const amount = prompt(`Ajustar créditos para ${userName}:\n(Use números positivos para adicionar, negativos para remover)`);
        if (amount === null || isNaN(amount)) return;

        const val = parseInt(amount);
        if (val === 0) return;

        window.Loading.show('Atualizando...', 'Sincronizando saldo');
        try {
            const { error } = await window.supabaseApp.rpc('adjust_credits_admin', { 
                target_user_id: userId, 
                amount_to_adjust: val 
            });

            if (error) throw error;

            window.Toast.success(`Créditos de ${userName} atualizados!`);
            
            const currentModal = document.querySelector('.custom-modal-overlay[style*="z-index: 10030"]');
            if (currentModal) currentModal.remove();
            this.showAdminPanel();

        } catch (e) {
            console.error(e);
            window.Toast.error("Erro ao ajustar créditos: " + e.message);
        } finally {
            window.Loading.hide();
        }
    },

    quickAdjustCredits: async function(userId, userEmail) {
        const input = document.getElementById(`credit-input-${userId}`);
        if (!input) return;
        const val = parseInt(input.value);
        if (!val || isNaN(val)) { window.Toast.warning('Digite um valor válido.'); return; }

        window.Loading.show('Atualizando...', 'Sincronizando saldo');
        try {
            const { error } = await window.supabaseApp.rpc('adjust_credits_admin', { 
                target_user_id: userId, 
                amount_to_adjust: val 
            });
            if (error) throw error;
            window.Toast.success(`Créditos de ${userEmail} ajustados em ${val > 0 ? '+' : ''}${val}!`);
            input.value = '';
            // Refresh row
            const currentModal = document.querySelector('.custom-modal-overlay[style*="z-index: 10030"]');
            if (currentModal) currentModal.remove();
            this.showAdminPanel();
        } catch (e) {
            console.error(e);
            window.Toast.error('Erro ao ajustar créditos: ' + e.message);
        } finally {
            window.Loading.hide();
        }
    },

    changeRole: async function(userId, newRole) {
        try {
            const { error } = await window.supabaseApp
                .from('profiles')
                .update({ role: newRole })
                .eq('id', userId);
            if (error) throw error;
            window.Toast.success(`Role atualizado para ${newRole.toUpperCase()}!`);
        } catch (e) {
            console.error(e);
            window.Toast.error('Erro ao alterar role: ' + e.message);
        }
    },

    approveUser: async function(userId, userEmail) {
        if (!confirm(`Deseja aprovar o cadastro de ${userEmail}?`)) return;
        window.Loading.show('Aprovando...', 'Liberando acesso ao sistema');
        try {
            const { error } = await window.supabaseApp
                .from('profiles')
                .update({ status: 'approved' })
                .eq('id', userId);
            
            if (error) throw error;

            // Log de auditoria
            const { data: { user: adminUser } } = await window.supabaseApp.auth.getUser();
            if (adminUser) {
                await window.supabaseApp.from('audit_logs').insert({
                    user_id: adminUser.id,
                    user_email: adminUser.email,
                    action: 'user_approved',
                    detail: `Aprovou cadastro de ${userEmail}`
                });
            }

            window.Toast.success(`Acesso liberado para ${userEmail}!`);
            this.refreshTabs();
        } catch (e) {
            console.error(e);
            window.Toast.error("Erro ao aprovar usuário: " + e.message);
        } finally {
            window.Loading.hide();
        }
    },

    rejectUser: async function(userId, userEmail) {
        if (!confirm(`Deseja REJEITAR e BLOQUEAR o cadastro de ${userEmail}?`)) return;
        window.Loading.show('Rejeitando...', 'Bloqueando acesso');
        try {
            const { error } = await window.supabaseApp
                .from('profiles')
                .update({ status: 'rejected' })
                .eq('id', userId);
            
            if (error) throw error;

            window.Toast.info(`Cadastro de ${userEmail} rejeitado.`);
            this.refreshTabs();
        } catch (e) {
            console.error(e);
            window.Toast.error("Erro ao rejeitar usuário: " + e.message);
        } finally {
            window.Loading.hide();
        }
    },

    renderMonetization: async function(container) {
        // Carrega dados em paralelo
        let cupons = [], pendingPlans = [], pendingCredits = [], pixConfig = null, plansConfig = null;
        try {
            const [
                cuponsRes,
                plansRes,
                creditsRes,
                settingsRes
            ] = await Promise.all([
                window.supabaseApp.from('cupons_desconto').select('*').order('created_at', { ascending: false }),
                window.supabaseApp.from('pending_plan_activations').select('*, profiles(email)').eq('status', 'pending').order('created_at', { ascending: false }),
                window.supabaseApp.from('pending_credit_releases').select('*, profiles(email)').eq('status', 'pending').order('created_at', { ascending: false }),
                window.supabaseApp.from('app_settings').select('*').in('key', ['pix_config', 'plans_config'])
            ]);
            cupons = cuponsRes.data || [];
            pendingPlans = plansRes.data || [];
            pendingCredits = creditsRes.data || [];
            
            const settings = settingsRes.data || [];
            pixConfig = settings.find(s => s.key === 'pix_config')?.value || null;
            plansConfig = settings.find(s => s.key === 'plans_config')?.value || {
                pro: { name: 'Pro', price: 199, credits: 30 },
                elite: { name: 'Elite', price: 449, credits: 80 }
            };
        } catch(e) { /* tabelas podem não existir ainda */ }

        const totalPending = pendingPlans.length + pendingCredits.length;

        container.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 24px;">

                <!-- SUB-HEADER: Alertas de Pendências -->
                ${totalPending > 0 ? `
                    <div style="background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.3); border-radius: 12px; padding: 14px 18px; display: flex; align-items: center; gap: 12px; cursor: pointer;" onclick="document.getElementById('pending-section').scrollIntoView({behavior:'smooth'})">
                        <div style="width: 36px; height: 36px; background: #f59e0b; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0;">🔔</div>
                        <div>
                            <div style="font-weight: 800; font-size: 13px; color: #f59e0b;">${totalPending} aprovação(ões) aguardando</div>
                            <div style="font-size: 11px; color: #94a3b8;">Clique para ver planos e créditos pendentes</div>
                        </div>
                    </div>
                ` : ''}

                <!-- SEÇÃO 1: CHAVE PIX -->
                <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 20px;">
                    <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase; font-weight: 700; margin-bottom: 16px; letter-spacing: 1px;">💳 Configuração de Recebimento Pix</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
                        <div>
                            <label style="font-size: 11px; color: #94a3b8;">Tipo da Chave</label>
                            <select id="pix-tipo" style="width: 100%; margin-top: 6px; padding: 10px; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: white; font-size: 13px;">
                                <option value="cpf" ${pixConfig?.tipo === 'cpf' ? 'selected' : ''}>CPF</option>
                                <option value="cnpj" ${pixConfig?.tipo === 'cnpj' ? 'selected' : ''}>CNPJ</option>
                                <option value="email" ${pixConfig?.tipo === 'email' ? 'selected' : ''}>E-mail</option>
                                <option value="celular" ${pixConfig?.tipo === 'celular' ? 'selected' : ''}>Celular</option>
                                <option value="aleatoria" ${pixConfig?.tipo === 'aleatoria' ? 'selected' : ''}>Chave Aleatória</option>
                            </select>
                        </div>
                        <div>
                            <label style="font-size: 11px; color: #94a3b8;">Chave / Valor</label>
                            <input id="pix-chave" type="text" value="${pixConfig?.chave || ''}" placeholder="Ex: 048.XXX.XXX-XX" style="width: 100%; margin-top: 6px; padding: 10px; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: white; font-size: 13px;" />
                        </div>
                    </div>
                    <div style="margin-bottom: 14px;">
                        <label style="font-size: 11px; color: #94a3b8;">Nome do Beneficiário (aparece no QR Code)</label>
                        <input id="pix-nome" type="text" value="${pixConfig?.nome_beneficiario || ''}" placeholder="Ex: Bruno Guarujá Geo" style="width: 100%; margin-top: 6px; padding: 10px; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: white; font-size: 13px;" />
                    </div>
                    <div style="margin-bottom: 16px;">
                        <label style="font-size: 11px; color: #94a3b8;">Cidade (obrigatório pelo BC)</label>
                        <input id="pix-cidade" type="text" value="${pixConfig?.cidade || 'Guaruja'}" placeholder="Ex: Guarujá" style="width: 100%; margin-top: 6px; padding: 10px; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: white; font-size: 13px;" />
                    </div>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <button onclick="window.Admin.savePixConfig()" style="background: #10b981; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: 12px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                            <i class="fas fa-save"></i> Salvar Configuração Pix
                        </button>
                        ${pixConfig?.chave ? `<span style="font-size: 11px; color: #10b981;"><i class="fas fa-check-circle"></i> Chave configurada: <strong>${pixConfig.chave}</strong></span>` : `<span style="font-size: 11px; color: #ef4444;"><i class="fas fa-exclamation-circle"></i> Nenhuma chave configurada</span>`}
                    </div>
                </div>

                <!-- SEÇÃO 2: ATIVAÇÕES PENDENTES DE PLANO -->
                <div id="pending-section" style="background: rgba(255,255,255,0.03); border: 1px solid ${pendingPlans.length > 0 ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.08)'}; border-radius: 12px; padding: 20px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
                        <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase; font-weight: 700; letter-spacing: 1px;">
                            🗂️ Ativações de Plano Pendentes
                            ${pendingPlans.length > 0 ? `<span style="background: #f59e0b; color: #1e293b; padding: 2px 8px; border-radius: 20px; font-size: 10px; margin-left: 8px;">${pendingPlans.length}</span>` : ''}
                        </div>
                        <button onclick="window.Admin.showManualPlanModal()" style="background: rgba(255,255,255,0.07); color: #94a3b8; border: 1px solid rgba(255,255,255,0.1); padding: 6px 14px; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer;">
                            + Ativar Plano Manual
                        </button>
                    </div>
                    ${pendingPlans.length === 0 ? `
                        <div style="padding: 24px; text-align: center; color: #475569; font-size: 13px; border: 1px dashed rgba(255,255,255,0.05); border-radius: 8px;">
                            ✅ Nenhuma ativação pendente
                        </div>
                    ` : `
                        <div style="display: flex; flex-direction: column; gap: 10px;">
                            ${pendingPlans.map(p => `
                                <div style="background: rgba(245,158,11,0.05); border: 1px solid rgba(245,158,11,0.2); border-radius: 10px; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
                                    <div>
                                        <div style="font-weight: 700; color: white; font-size: 13px;">${p.profiles?.email || 'Usuário'}</div>
                                        <div style="font-size: 11px; color: #64748b; margin-top: 3px;">
                                            Plano: <strong style="color: #f59e0b;">${(p.plano_solicitado || '').toUpperCase()}</strong>
                                            · ${new Date(p.created_at).toLocaleDateString('pt-BR')}
                                            ${p.comprovante_url ? `· <a href="${p.comprovante_url}" target="_blank" style="color: #3b82f6;">Ver comprovante</a>` : ''}
                                        </div>
                                        ${p.valor_pago ? `<div style="font-size: 11px; color: #10b981; margin-top: 2px;">Valor pago: R$ ${p.valor_pago}</div>` : ''}
                                    </div>
                                    <div style="display: flex; gap: 8px; flex-shrink: 0; align-items: center;">
                                        <div style="display: flex; flex-direction: column; gap: 4px;">
                                            <label style="font-size: 9px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Bônus (Créditos)</label>
                                            <input type="number" id="plan-bonus-${p.id}" value="0" style="width: 60px; padding: 4px 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: white; font-size: 11px;" />
                                        </div>
                                        <button onclick="window.Admin.rejectPlan('${p.id}')" style="background: rgba(239,68,68,0.1); color: #f87171; border: 1px solid rgba(239,68,68,0.2); padding: 6px 12px; border-radius: 8px; font-size: 11px; cursor: pointer;">Recusar</button>
                                        <button onclick="window.Admin.approvePlan('${p.id}', '${p.user_id}', '${p.plano_solicitado}', document.getElementById('plan-bonus-${p.id}').value)" style="background: #10b981; color: white; border: none; padding: 6px 14px; border-radius: 8px; font-size: 11px; font-weight: 800; cursor: pointer;">✓ Ativar</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>

                <!-- SEÇÃO 3: CRÉDITOS PENDENTES -->
                <div style="background: rgba(255,255,255,0.03); border: 1px solid ${pendingCredits.length > 0 ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.08)'}; border-radius: 12px; padding: 20px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
                        <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase; font-weight: 700; letter-spacing: 1px;">
                            🪙 Liberação de Créditos Pendente
                            ${pendingCredits.length > 0 ? `<span style="background: #3b82f6; color: white; padding: 2px 8px; border-radius: 20px; font-size: 10px; margin-left: 8px;">${pendingCredits.length}</span>` : ''}
                        </div>
                    </div>
                    ${pendingCredits.length === 0 ? `
                        <div style="padding: 24px; text-align: center; color: #475569; font-size: 13px; border: 1px dashed rgba(255,255,255,0.05); border-radius: 8px;">
                            ✅ Nenhuma liberação de crédito pendente
                        </div>
                    ` : `
                        <div style="display: flex; flex-direction: column; gap: 10px;">
                            ${pendingCredits.map(c => `
                                <div style="background: rgba(59,130,246,0.05); border: 1px solid rgba(59,130,246,0.2); border-radius: 10px; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
                                    <div>
                                        <div style="font-weight: 700; color: white; font-size: 13px;">${c.profiles?.email || 'Usuário'}</div>
                                        <div style="font-size: 11px; color: #64748b; margin-top: 3px;">
                                            <strong style="color: #3b82f6;">${c.quantidade} créditos</strong>
                                            · R$ ${c.valor_pago || '—'}
                                            · ${new Date(c.created_at).toLocaleDateString('pt-BR')}
                                            ${c.comprovante_url ? `· <a href="${c.comprovante_url}" target="_blank" style="color: #3b82f6;">Comprovante</a>` : ''}
                                        </div>
                                    </div>
                                    <div style="display: flex; gap: 8px; flex-shrink: 0; align-items: center;">
                                        <div style="display: flex; flex-direction: column; gap: 4px;">
                                            <label style="font-size: 9px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Qtd. Final</label>
                                            <input type="number" id="credit-qty-${c.id}" value="${c.quantidade}" style="width: 60px; padding: 4px 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: white; font-size: 11px;" />
                                        </div>
                                        <button onclick="window.Admin.rejectCredit('${c.id}')" style="background: rgba(239,68,68,0.1); color: #f87171; border: 1px solid rgba(239,68,68,0.2); padding: 6px 12px; border-radius: 8px; font-size: 11px; cursor: pointer;">Recusar</button>
                                        <button onclick="window.Admin.approveCredit('${c.id}', '${c.user_id}', document.getElementById('credit-qty-${c.id}').value)" style="background: #3b82f6; color: white; border: none; padding: 6px 14px; border-radius: 8px; font-size: 11px; font-weight: 800; cursor: pointer;">✓ Liberar</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>

                <!-- SEÇÃO 4: TIERS (referência) -->
                <div>
                    <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase; font-weight: 700; margin-bottom: 12px; letter-spacing: 1px;">📊 Referência de Tiers</div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px;">
                        ${[
                            { id: 'user', nome: 'Gratuito', preco: 'R$ 0', fichas: '0', cor: '#64748b' },
                            { id: 'pro', nome: 'Pro', preco: 'R$ 199/mês', fichas: '30/mês', cor: '#2563eb' },
                            { id: 'elite', nome: 'Elite', preco: 'R$ 449/mês', fichas: '80/mês', cor: '#7c3aed' },
                            { id: 'master', nome: 'Master', preco: 'Interno', fichas: 'Ilimitado', cor: '#b45309' },
                        ].map(p => `
                            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; padding: 14px;">
                                <div style="font-size: 9px; color: #64748b; text-transform: uppercase; font-weight: 700;">${p.id}</div>
                                <div style="font-size: 14px; font-weight: 800; color: white; margin: 4px 0;">${p.nome}</div>
                                <div style="font-size: 12px; color: ${p.cor}; font-weight: 600;">${p.preco}</div>
                                <div style="font-size: 10px; color: #475569; margin-top: 2px;">${p.fichas}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- SEÇÃO 5: CUPONS -->
                <div>
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                        <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase; font-weight: 700; letter-spacing: 1px;">🎟️ Cupons de Desconto</div>
                        <button onclick="window.Admin.showCreateCouponModal()" style="background: #2563eb; color: white; border: none; padding: 7px 14px; border-radius: 8px; font-size: 11px; font-weight: 800; cursor: pointer;">+ Novo Cupom</button>
                    </div>
                    ${cupons.length === 0 ? `
                        <div style="padding: 24px; text-align: center; color: #475569; border: 1px dashed rgba(255,255,255,0.05); border-radius: 10px; font-size: 13px;">
                            Nenhum cupom criado ainda.
                        </div>
                    ` : `
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            ${cupons.map(c => `
                                <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between;">
                                    <div>
                                        <span style="font-size: 13px; font-weight: 800; color: #f59e0b; letter-spacing: 2px;">${c.codigo}</span>
                                        <span style="margin-left: 8px; font-size: 11px; color: #64748b;">${c.tipo === 'percent' ? c.valor + '%' : 'R$ ' + c.valor} off</span>
                                        ${c.expira_em ? `<span style="margin-left: 6px; font-size: 10px; color: #94a3b8;">· Expira ${new Date(c.expira_em).toLocaleDateString('pt-BR')}</span>` : ''}
                                    </div>
                                    <div style="display: flex; gap: 8px; align-items: center;">
                                        <span style="font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 20px; background: ${c.ativo ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}; color: ${c.ativo ? '#10b981' : '#ef4444'};">${c.ativo ? 'ATIVO' : 'INATIVO'}</span>
                                        <button onclick="window.Admin.toggleCoupon('${c.id}', ${!c.ativo})" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #94a3b8; padding: 4px 10px; border-radius: 6px; font-size: 11px; cursor: pointer;">${c.ativo ? 'Desativar' : 'Ativar'}</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>

                <!-- SEÇÃO 4: GESTÃO DE PREÇOS E LIMITES (NOVO) -->
                <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 20px;">
                    <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase; font-weight: 700; margin-bottom: 20px; letter-spacing: 1px;">💰 Gestão de Preços e Limites de Planos</div>
                    <div id="plans-config-container" style="display: flex; flex-direction: column; gap: 16px;">
                        <div style="display: grid; grid-template-columns: 100px 1fr 1fr 1fr; gap: 15px; align-items: center; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">
                            <div>ID Plano</div>
                            <div>Nome Público</div>
                            <div>Preço (R$)</div>
                            <div>Fichas/mês</div>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: 100px 1fr 1fr 1fr; gap: 15px; align-items: center;">
                            <div style="font-weight: 700; color: #2563eb;">PRO</div>
                            <input id="plan-name-pro" type="text" value="${plansConfig?.pro?.name || 'Pro'}" style="padding: 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: white; font-size: 12px;" />
                            <input id="plan-price-pro" type="number" value="${plansConfig?.pro?.price || 199}" style="padding: 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: white; font-size: 12px;" />
                            <input id="plan-credits-pro" type="number" value="${plansConfig?.pro?.credits || 30}" style="padding: 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: white; font-size: 12px;" />
                        </div>

                        <div style="display: grid; grid-template-columns: 100px 1fr 1fr 1fr; gap: 15px; align-items: center;">
                            <div style="font-weight: 700; color: #7c3aed;">ELITE</div>
                            <input id="plan-name-elite" type="text" value="${plansConfig?.elite?.name || 'Elite'}" style="padding: 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: white; font-size: 12px;" />
                            <input id="plan-price-elite" type="number" value="${plansConfig?.elite?.price || 449}" style="padding: 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: white; font-size: 12px;" />
                            <input id="plan-credits-elite" type="number" value="${plansConfig?.elite?.credits || 80}" style="padding: 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: white; font-size: 12px;" />
                        </div>

                        <div style="margin-top: 10px;">
                            <button onclick="window.Admin.savePlansConfig()" style="background: #2563eb; color: white; border: none; padding: 10px 24px; border-radius: 8px; font-size: 12px; font-weight: 800; cursor: pointer;">
                                <i class="fas fa-save"></i> Atualizar Preços e Limites
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        `;
    },

    // === MÉTODOS DE SUPORTE PARA MONETIZAÇÃO ===

    savePixConfig: async function() {
        const tipo = document.getElementById('pix-tipo')?.value;
        const chave = document.getElementById('pix-chave')?.value?.trim();
        const nome = document.getElementById('pix-nome')?.value?.trim();
        const cidade = document.getElementById('pix-cidade')?.value?.trim() || 'Guaruja';

        if (!chave || !nome) { window.Toast.warning('Preencha a chave e o nome do beneficiário.'); return; }

        try {
            const { error } = await window.supabaseApp.from('app_settings').upsert({
                key: 'pix_config',
                value: { tipo, chave, nome_beneficiario: nome, cidade },
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' });
            if (error) throw error;
            window.Toast.success(`Chave Pix ${tipo.toUpperCase()} salva: ${chave}`);
        } catch(e) {
            window.Toast.error('Erro ao salvar: ' + e.message + ' (tabela app_settings pode não existir)');
        }
    },

    savePlansConfig: async function() {
        window.Loading.show("Salvando...", "Atualizando preços e limites");
        try {
            const config = {
                pro: {
                    name: document.getElementById('plan-name-pro').value,
                    price: parseFloat(document.getElementById('plan-price-pro').value),
                    credits: parseInt(document.getElementById('plan-credits-pro').value)
                },
                elite: {
                    name: document.getElementById('plan-name-elite').value,
                    price: parseFloat(document.getElementById('plan-price-elite').value),
                    credits: parseInt(document.getElementById('plan-credits-elite').value)
                }
            };

            const { error } = await window.supabaseApp.from('app_settings').upsert({
                key: 'plans_config',
                value: config,
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' });

            if (error) throw error;

            window.Toast.success("Configuração de planos atualizada!");
        } catch(e) {
            console.error(e);
            window.Toast.error("Erro ao salvar planos: " + e.message);
        } finally {
            window.Loading.hide();
        }
    },

    approvePlan: async function(pendingId, userId, plano, bonusRaw) {
        const bonus = parseInt(bonusRaw) || 0;
        if (!confirm(`Ativar plano "${plano.toUpperCase()}" para este usuário?${bonus > 0 ? ` (Bônus: ${bonus} créditos)` : ''}`)) return;
        window.Loading.show('Ativando plano...', 'Atualizando role e créditos');
        try {
            const updates = [
                window.supabaseApp.from('profiles').update({ 
                    role: plano,
                    status: 'approved',
                    subscription_period_start: new Date().toISOString(),
                    monthly_unlocks_used: 0
                }).eq('id', userId),
                window.supabaseApp.from('pending_plan_activations').update({ status: 'approved', approved_at: new Date().toISOString() }).eq('id', pendingId)
            ];

            if (bonus > 0) {
                updates.push(window.supabaseApp.rpc('adjust_credits_admin', { target_user_id: userId, amount_to_adjust: bonus }));
            }

            await Promise.all(updates);
            window.Toast.success(`Plano ${plano.toUpperCase()} ativado!${bonus > 0 ? ` (+${bonus} créditos)` : ''}`);
            const activeTab = document.querySelector('.admin-tab.active');
            if (activeTab) this.switchTab(activeTab, 'monetization');
        } catch(e) {
            window.Toast.error('Erro: ' + e.message);
        } finally { window.Loading.hide(); }
    },

    rejectPlan: async function(pendingId) {
        if (!confirm('Recusar esta ativação?')) return;
        try {
            await window.supabaseApp.from('pending_plan_activations').update({ status: 'rejected' }).eq('id', pendingId);
            window.Toast.info('Ativação recusada.');
            const activeTab = document.querySelector('.admin-tab.active');
            if (activeTab) this.switchTab(activeTab, 'monetization');
        } catch(e) { window.Toast.error('Erro: ' + e.message); }
    },

    approveCredit: async function(pendingId, userId, quantidade) {
        if (!confirm(`Liberar ${quantidade} créditos para este usuário?`)) return;
        window.Loading.show('Liberando créditos...', 'Creditando na conta');
        try {
            await Promise.all([
                window.supabaseApp.rpc('adjust_credits_admin', { target_user_id: userId, amount_to_adjust: quantidade }),
                window.supabaseApp.from('pending_credit_releases').update({ status: 'approved', approved_at: new Date().toISOString() }).eq('id', pendingId)
            ]);
            window.Toast.success(`${quantidade} créditos liberados com sucesso!`);
            const activeTab = document.querySelector('.admin-tab.active');
            if (activeTab) this.switchTab(activeTab, 'monetization');
        } catch(e) {
            window.Toast.error('Erro: ' + e.message);
        } finally { window.Loading.hide(); }
    },

    rejectCredit: async function(pendingId) {
        if (!confirm('Recusar esta liberação de créditos?')) return;
        try {
            await window.supabaseApp.from('pending_credit_releases').update({ status: 'rejected' }).eq('id', pendingId);
            window.Toast.info('Liberação recusada.');
            const activeTab = document.querySelector('.admin-tab.active');
            if (activeTab) this.switchTab(activeTab, 'monetization');
        } catch(e) { window.Toast.error('Erro: ' + e.message); }
    },

    showManualPlanModal: function() {
        const overlay = document.createElement('div');
        overlay.className = 'custom-modal-overlay active';
        overlay.style.zIndex = '11000';
        overlay.innerHTML = `
            <div class="custom-modal" style="max-width: 420px; background: #1e293b; color: white; border: 1px solid rgba(255,255,255,0.1);">
                <div class="custom-modal-header" style="background: rgba(0,0,0,0.3); color: white; border-bottom: 1px solid rgba(255,255,255,0.08);">
                    <div class="custom-modal-title">🗂️ Ativar Plano Manualmente</div>
                    <button class="custom-modal-close" onclick="this.closest('.custom-modal-overlay').remove()" style="color: white;">×</button>
                </div>
                <div class="custom-modal-body" style="padding: 24px; display: flex; flex-direction: column; gap: 14px;">
                    <div>
                        <label style="font-size: 11px; color: #94a3b8; text-transform: uppercase;">E-mail do Usuário</label>
                        <input id="manual-plan-email" type="email" placeholder="usuario@email.com" style="width: 100%; margin-top: 6px; padding: 10px; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: white; font-size: 13px;" />
                    </div>
                    <div>
                        <label style="font-size: 11px; color: #94a3b8; text-transform: uppercase;">Plano a Ativar</label>
                        <select id="manual-plan-role" style="width: 100%; margin-top: 6px; padding: 10px; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: white; font-size: 13px;">
                            <option value="pro">Pro — R$ 199/mês</option>
                            <option value="elite">Elite — R$ 449/mês</option>
                            <option value="user">Revogar (voltar Gratuito)</option>
                        </select>
                    </div>
                    <button onclick="window.Admin.activatePlanByEmail()" style="width: 100%; padding: 12px; background: #10b981; color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 800; cursor: pointer;">
                        ✓ Ativar Plano
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
    },

    activatePlanByEmail: async function() {
        const email = document.getElementById('manual-plan-email')?.value?.trim();
        const role = document.getElementById('manual-plan-role')?.value;
        if (!email) { window.Toast.warning('Informe o e-mail.'); return; }

        window.Loading.show('Ativando...', 'Buscando usuário');
        try {
            const { data: profile, error } = await window.supabaseApp
                .from('profiles').select('id').eq('email', email).maybeSingle();
            if (error || !profile) throw new Error('Usuário não encontrado com este e-mail.');

            await window.supabaseApp.from('profiles').update({ role }).eq('id', profile.id);
            window.Toast.success(`Plano ${role.toUpperCase()} ativado para ${email}!`);
            document.querySelector('.custom-modal-overlay[style*="z-index: 11000"]')?.remove();
            const activeTab = document.querySelector('.admin-tab.active');
            if (activeTab) this.switchTab(activeTab, 'monetization');
        } catch(e) {
            window.Toast.error('Erro: ' + e.message);
        } finally { window.Loading.hide(); }
    },



    showCreateCouponModal: function() {
        const overlay = document.createElement('div');
        overlay.className = 'custom-modal-overlay active';
        overlay.style.zIndex = '11000';
        overlay.innerHTML = `
            <div class="custom-modal" style="max-width: 420px; background: #1e293b; color: white; border: 1px solid rgba(255,255,255,0.1);">
                <div class="custom-modal-header" style="background: rgba(0,0,0,0.3); color: white; border-bottom: 1px solid rgba(255,255,255,0.08);">
                    <div class="custom-modal-title">🎟️ Novo Cupom</div>
                    <button class="custom-modal-close" onclick="this.closest('.custom-modal-overlay').remove()" style="color: white;">×</button>
                </div>
                <div class="custom-modal-body" style="padding: 24px; display: flex; flex-direction: column; gap: 14px;">
                    <div>
                        <label style="font-size: 11px; color: #94a3b8; text-transform: uppercase;">Código do Cupom</label>
                        <input id="coupon-code" type="text" placeholder="Ex: GUARUJA20" style="width: 100%; margin-top: 6px; padding: 10px; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: white; font-size: 14px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;" />
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div>
                            <label style="font-size: 11px; color: #94a3b8; text-transform: uppercase;">Tipo</label>
                            <select id="coupon-type" style="width: 100%; margin-top: 6px; padding: 10px; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: white; font-size: 13px;">
                                <option value="percent">Percentual (%)</option>
                                <option value="fixed">Valor Fixo (R$)</option>
                            </select>
                        </div>
                        <div>
                            <label style="font-size: 11px; color: #94a3b8; text-transform: uppercase;">Valor</label>
                            <input id="coupon-value" type="number" min="1" max="100" placeholder="Ex: 20" style="width: 100%; margin-top: 6px; padding: 10px; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: white; font-size: 13px;" />
                        </div>
                    </div>
                    <div>
                        <label style="font-size: 11px; color: #94a3b8; text-transform: uppercase;">Expiração (opcional)</label>
                        <input id="coupon-expiry" type="date" style="width: 100%; margin-top: 6px; padding: 10px; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: white; font-size: 13px;" />
                    </div>
                    <button onclick="window.Admin.createCoupon()" style="width: 100%; padding: 14px; background: #2563eb; color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 800; cursor: pointer; margin-top: 6px;">
                        Criar Cupom
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
    },

    createCoupon: async function() {
        const code = document.getElementById('coupon-code')?.value?.trim().toUpperCase();
        const type = document.getElementById('coupon-type')?.value;
        const value = parseFloat(document.getElementById('coupon-value')?.value);
        const expiry = document.getElementById('coupon-expiry')?.value || null;

        if (!code || !value) { window.Toast.warning('Preencha o código e o valor.'); return; }

        try {
            const { error } = await window.supabaseApp.from('cupons_desconto').insert({
                codigo: code,
                tipo: type,
                valor: value,
                expira_em: expiry || null,
                ativo: true
            });
            if (error) throw error;
            window.Toast.success(`Cupom ${code} criado com sucesso!`);
            document.querySelector('.custom-modal-overlay[style*="z-index: 11000"]')?.remove();
            // Refresh monetization tab
            const activeTab = document.querySelector('.admin-tab.active');
            if (activeTab) this.switchTab(activeTab, 'monetization');
        } catch(e) {
            console.error(e);
            window.Toast.error('Erro ao criar cupom: ' + e.message + ' (tabela cupons_desconto pode não existir)');
        }
    },

    toggleCoupon: async function(id, newStatus) {
        try {
            const { error } = await window.supabaseApp.from('cupons_desconto').update({ ativo: newStatus }).eq('id', id);
            if (error) throw error;
            window.Toast.success(newStatus ? 'Cupom ativado!' : 'Cupom desativado!');
            const activeTab = document.querySelector('.admin-tab.active');
            if (activeTab) this.switchTab(activeTab, 'monetization');
        } catch(e) { window.Toast.error('Erro: ' + e.message); }
    },

    renderSettings: async function(container) {
        // Fetch current settings
        let settings = { 
            welcome_credits: 2, 
            radar_free_access: false,
            feature_flags: { audit_logs: true, curatorship: true, radar_lite: true },
            master_whitelist: ['brunogp.corretor@gmail.com'],
            global_alert: ''
        };

        try {
            const { data } = await window.supabaseApp.from('app_settings').select('*');
            if (data) {
                data.forEach(s => {
                    if (s.key === 'welcome_credits') settings.welcome_credits = parseInt(s.value);
                    if (s.key === 'radar_free_access') settings.radar_free_access = s.value === 'true' || s.value === true;
                    if (s.key === 'feature_flags') settings.feature_flags = typeof s.value === 'string' ? JSON.parse(s.value) : s.value;
                    if (s.key === 'master_whitelist') settings.master_whitelist = s.value;
                    if (s.key === 'global_alert') settings.global_alert = s.value;
                });
            }
        } catch(e) { console.warn("Erro ao buscar settings:", e); }

        container.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 20px;">

                <div style="background: rgba(239,68,68,0.07); border: 1px solid rgba(239,68,68,0.15); border-radius: 12px; padding: 16px 20px; font-size: 12px; color: #fca5a5; display: flex; gap: 10px; align-items: center;">
                    <i class="fas fa-skull-crossbones"></i>
                    <span>Configurações críticas. Alterações aqui afetam <strong>todos os usuários do app</strong>.</span>
                </div>

                <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 20px;">
                    <div style="font-size: 12px; color: #94a3b8; text-transform: uppercase; font-weight: 700; margin-bottom: 16px;">🆓 Test-Drive (Gratuito)</div>
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <div>
                            <div style="font-weight: 600; color: white; font-size: 13px;">Créditos ao cadastrar</div>
                            <div style="font-size: 11px; color: #64748b;">Quantos créditos o usuário ganha ao criar conta</div>
                        </div>
                        <input type="number" id="set-welcome-credits" value="${settings.welcome_credits}" style="width: 70px; padding: 8px; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: white; font-size: 14px; text-align: center;" />
                    </div>
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 0;">
                        <div>
                            <div style="font-weight: 600; color: white; font-size: 13px;">Radar Farol no test-drive</div>
                            <div style="font-size: 11px; color: #64748b;">Permitir acesso limitado ao Radar para usuários gratuitos</div>
                        </div>
                        <label class="switch" style="position: relative; display: inline-block; width: 44px; height: 24px; cursor: pointer;">
                            <input type="checkbox" id="set-radar-free" ${settings.radar_free_access ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;" />
                            <span class="slider round" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: ${settings.radar_free_access ? '#10b981' : '#334155'}; transition: .4s; border-radius: 34px;"></span>
                        </label>
                    </div>
                </div>

                <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 20px;">
                    <div style="font-size: 12px; color: #94a3b8; text-transform: uppercase; font-weight: 700; margin-bottom: 16px;">👑 E-mails Master (whitelist)</div>
                    <div style="font-size: 13px; color: #475569; margin-bottom: 12px;">Estes e-mails têm acesso total ao Painel Admin.</div>
                    <div id="whitelist-container" style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 15px;">
                        ${settings.master_whitelist.map(email => `
                            <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 5px 12px; border-radius: 20px; font-size: 12px; color: white; display: flex; align-items: center; gap: 8px;">
                                ${email}
                                <i class="fas fa-times" onclick="window.Admin.removeFromWhitelist('${email}')" style="cursor: pointer; opacity: 0.5;"></i>
                            </div>
                        `).join('')}
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <input type="email" id="new-whitelist-email" placeholder="novo@master.com" style="flex: 1; padding: 10px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: white; font-size: 13px;" />
                        <button onclick="window.Admin.addToWhitelist()" style="padding: 0 15px; background: #10b981; color: white; border: none; border-radius: 8px; font-weight: 800; cursor: pointer;">+</button>
                    </div>
                </div>

                <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 20px;">
                    <div style="font-size: 12px; color: #94a3b8; text-transform: uppercase; font-weight: 700; margin-bottom: 16px;">📣 Alerta Global (Marquee)</div>
                    <textarea id="set-global-alert" placeholder="Ex: Manutenção agendada para hoje às 23h..." style="width: 100%; min-height: 60px; padding: 12px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #4ade80; font-size: 13px; font-style: italic;">${settings.global_alert}</textarea>
                    <div style="font-size: 11px; color: #475569; margin-top: 8px;">Este texto aparecerá no topo do mapa para TODOS os usuários. Deixe em branco para ocultar.</div>
                </div>

                <div style="display: flex; gap: 10px;">
                    <button onclick="window.Admin.saveGeneralSettings()" style="background: #2563eb; color: white; border: none; padding: 12px 24px; border-radius: 10px; font-size: 13px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(37,99,235,0.3);">
                        <i class="fas fa-save"></i> Salvar Todas as Configurações
                    </button>
                    <button onclick="window.Admin.switchTab(this, 'audit')" style="background: rgba(255,255,255,0.05); color: #94a3b8; border: 1px solid rgba(255,255,255,0.1); padding: 12px 20px; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer;">
                        <i class="fas fa-history"></i> Ver Logs de Auditoria
                    </button>
                </div>

            </div>
        `;
        
        // Handle checkbox color toggle
        const checkbox = container.querySelector('#set-radar-free');
        if (checkbox) {
            checkbox.onchange = (e) => {
                e.target.nextElementSibling.style.backgroundColor = e.target.checked ? '#10b981' : '#334155';
            };
        }
    },

    saveGeneralSettings: async function() {
        const welcomeCredits = document.getElementById('set-welcome-credits')?.value || 2;
        const radarFree = document.getElementById('set-radar-free')?.checked || false;
        const globalAlert = document.getElementById('set-global-alert')?.value || '';
        
        // Collect whitelist
        const whitelist = [];
        document.querySelectorAll('#whitelist-container > div').forEach(el => {
            whitelist.push(el.innerText.trim());
        });

        window.Loading.show('Salvando...', 'Atualizando configurações globais');
        try {
            await Promise.all([
                window.supabaseApp.from('app_settings').upsert({ key: 'welcome_credits', value: String(welcomeCredits) }, { onConflict: 'key' }),
                window.supabaseApp.from('app_settings').upsert({ key: 'radar_free_access', value: String(radarFree) }, { onConflict: 'key' }),
                window.supabaseApp.from('app_settings').upsert({ key: 'global_alert', value: globalAlert }, { onConflict: 'key' }),
                window.supabaseApp.from('app_settings').upsert({ key: 'master_whitelist', value: whitelist }, { onConflict: 'key' })
            ]);
            window.Toast.success('Configurações salvas com sucesso!');
        } catch(e) {
            console.error(e);
            window.Toast.error('Erro ao salvar: ' + e.message);
        } finally {
            window.Loading.hide();
        }
    },

    renderAuditLogs: async function(container) {
        const { data: logs, error } = await window.supabaseApp
            .from('audit_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) { 
            container.innerHTML = `
                <div style="padding: 60px 40px; text-align: center; color: #94a3b8; border: 1px dashed rgba(255,255,255,0.05); border-radius: 12px;">
                    <i class="fas fa-database" style="font-size: 30px; margin-bottom: 20px; opacity: 0.2;"></i>
                    <p style="font-size: 14px; font-weight: 600; color: white;">Monitor de Auditoria Desativado</p>
                    <p style="font-size: 11px; opacity: 0.6; margin-top: 8px; max-width: 250px; margin-left: auto; margin-right: auto;">Para ativar o rastreamento, a tabela 'audit_logs' precisa ser criada no Supabase.</p>
                </div>
            `;
            return; 
        }

        if (!logs || logs.length === 0) {
            container.innerHTML = '<div style="padding: 60px 40px; text-align: center; color: #64748b;">Nenhuma atividade registrada ainda.</div>';
            return;
        }

        container.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 8px;">
                ${logs.map(log => `
                    <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 10px; padding: 14px 20px; display: flex; align-items: center; justify-content: space-between;">
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <div style="width: 36px; height: 36px; background: rgba(37,99,235,0.1); color: #3b82f6; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 14px;">
                                <i class="fas ${this.getLogIcon(log.action)}"></i>
                            </div>
                            <div>
                                <div style="font-size: 13px; font-weight: 700; color: white;">${log.user_email || 'Anônimo'}</div>
                                <div style="font-size: 10px; color: #64748b;">${new Date(log.created_at).toLocaleString('pt-BR')}</div>
                            </div>
                        </div>
                        <div style="text-align: right;">
                             <span style="font-size: 10px; font-weight: 900; color: #2563eb; background: rgba(37,99,235,0.1); padding: 2px 8px; border-radius: 4px; text-transform: uppercase;">${log.action}</span>
                             <div style="font-size: 11px; color: #94a3b8; margin-top: 4px; font-style: italic; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${log.detail || ''}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    getLogIcon: function(action) {
        if (!action) return 'fa-history';
        const a = action.toLowerCase();
        if (a.includes('approve')) return 'fa-check-circle';
        if (a.includes('reject')) return 'fa-times-circle';
        if (a.includes('unlock')) return 'fa-unlock-alt';
        if (a.includes('credit')) return 'fa-coins';
        if (a.includes('plan')) return 'fa-crown';
        if (a.includes('setting')) return 'fa-cog';
        return 'fa-history';
    },

    renderTransactions: async function(container) {
        window.Loading.show('Carregando Dashboard...', 'Processando finanças');
        try {
            // 1. Fetch data for Dashboard
            const date30DaysAgo = new Date();
            date30DaysAgo.setDate(date30DaysAgo.getDate() - 30);

            const [plans, credits, totals, txs] = await Promise.all([
                // Pending Plans
                window.supabaseApp.from('pending_plan_activations').select('*, profiles(email)').eq('status', 'pending'),
                // Pending Credits
                window.supabaseApp.from('pending_credit_releases').select('*, profiles(email)').eq('status', 'pending'),
                // Total Stats (Recent approved)
                window.supabaseApp.from('credit_transactions').select('*').order('created_at', { ascending: false }).limit(200),
                // Recent activity list
                window.supabaseApp.from('credit_transactions').select('*, profiles(email)').order('created_at', { ascending: false }).limit(50)
            ]);

            const pendingPlans = plans.data || [];
            const pendingCredits = credits.data || [];
            const allTxs = txs.data || [];

            // Calculate metrics
            const approvedSummary = await window.supabaseApp.rpc('get_financial_summary'); 
            const stats = approvedSummary.data || { total_revenue: 0, pending_count: 0, conversion_rate: 100 };
            
            const revenue = stats.total_revenue || 0;
            const pendingCount = stats.pending_count || 0;
            const conversion = stats.conversion_rate || 0;

            container.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 25px;">
                    <div style="background: linear-gradient(135deg, #1e3a8a, #1e293b); border-radius: 12px; padding: 20px; border: 1px solid rgba(255,255,255,0.1);">
                        <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: 800; letter-spacing: 1px;">Receita Total (Confirmada)</div>
                        <div style="font-size: 24px; font-weight: 900; color: #4ade80; margin: 8px 0;">R$ ${revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                        <div style="font-size: 10px; color: rgba(255,255,255,0.4);">Baseado em Pix aprovados manualmente</div>
                    </div>
                    <div style="background: rgba(255,255,255,0.03); border-radius: 12px; padding: 20px; border: 1px solid rgba(255,255,255,0.05);">
                        <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: 800; letter-spacing: 1px;">Fila de Espera</div>
                        <div style="font-size: 24px; font-weight: 900; color: #f59e0b; margin: 8px 0;">${pendingCount} Solicitações</div>
                        <div style="font-size: 10px; color: #475569;">Aguardando liberação administrativa</div>
                    </div>
                    <div style="background: rgba(255,255,255,0.03); border-radius: 12px; padding: 20px; border: 1px solid rgba(255,255,255,0.05);">
                        <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: 800; letter-spacing: 1px;">Taxa de Aprovação</div>
                        <div style="font-size: 24px; font-weight: 900; color: white; margin: 8px 0;">${conversion}%</div>
                        <div style="height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; margin-top: 10px;">
                            <div style="width: ${conversion}%; height: 100%; background: #2563eb; border-radius: 2px;"></div>
                        </div>
                    </div>
                </div>

                <!-- Approval Queue -->
                ${pendingCount > 0 ? `
                <div style="margin-bottom: 30px;">
                    <div style="font-size: 11px; color: #f59e0b; text-transform: uppercase; font-weight: 800; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-clock"></i> Fila de Aprovação Financeira
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        ${pendingPlans.map(p => `
                            <div style="background: rgba(245, 158, 11, 0.05); border: 1px solid rgba(245, 158, 11, 0.2); border-radius: 12px; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center;">
                                <div style="display: flex; align-items: center; gap: 15px;">
                                    <div style="width: 40px; height: 40px; background: #b45309; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-size: 18px;">
                                        <i class="fas fa-crown"></i>
                                    </div>
                                    <div>
                                        <div style="font-weight: 800; font-size: 14px; color: white;">Assinatura ${p.plano_solicitado.toUpperCase()}</div>
                                        <div style="font-size: 11px; color: #94a3b8;">${p.profiles?.email} • <b>R$ ${p.valor_pago}</b></div>
                                    </div>
                                </div>
                                <div style="display: flex; gap: 8px;">
                                    <button onclick="window.Admin.rejectFinance('pending_plan_activations', '${p.id}')" style="background: none; border: 1px solid rgba(239,68,68,0.3); color: #f87171; width: 32px; height: 32px; border-radius: 6px; cursor: pointer;"><i class="fas fa-times"></i></button>
                                    <button onclick="window.Admin.approvePlanActivation('${p.id}')" style="background: #10b981; color: white; border: none; padding: 0 15px; height: 32px; border-radius: 6px; font-weight: 800; font-size: 11px; cursor: pointer; box-shadow: 0 4px 10px rgba(16,185,129,0.3);">LIBERAR PLANO</button>
                                </div>
                            </div>
                        `).join('')}
                        ${pendingCredits.map(c => `
                            <div style="background: rgba(37, 99, 235, 0.05); border: 1px solid rgba(37, 99, 235, 0.2); border-radius: 12px; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center;">
                                <div style="display: flex; align-items: center; gap: 15px;">
                                    <div style="width: 40px; height: 40px; background: #2563eb; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-size: 18px;">
                                        <i class="fas fa-coins"></i>
                                    </div>
                                    <div>
                                        <div style="font-weight: 800; font-size: 14px; color: white;">Pacote ${c.quantidade} Fichas</div>
                                        <div style="font-size: 11px; color: #94a3b8;">${c.profiles?.email} • <b>R$ ${c.valor_pago}</b></div>
                                    </div>
                                </div>
                                <div style="display: flex; gap: 8px;">
                                    <button onclick="window.Admin.rejectFinance('pending_credit_releases', '${c.id}')" style="background: none; border: 1px solid rgba(239,68,68,0.3); color: #f87171; width: 32px; height: 32px; border-radius: 6px; cursor: pointer;"><i class="fas fa-times"></i></button>
                                    <button onclick="window.Admin.approveCreditRelease('${c.id}')" style="background: #2563eb; color: white; border: none; padding: 0 15px; height: 32px; border-radius: 6px; font-weight: 800; font-size: 11px; cursor: pointer; box-shadow: 0 4px 10px rgba(37,99,235,0.3);">LIBERAR CRÉDITOS</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}

                <!-- Historical Chart placeholder -->
                <div style="background: rgba(255,255,255,0.02); border-radius: 12px; padding: 25px; border: 1px solid rgba(255,255,255,0.05); margin-bottom: 30px;">
                    <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase; font-weight: 800; margin-bottom: 20px;">Vendas Diárias (Últimos 30 dias)</div>
                    <canvas id="financeChart" style="max-height: 200px; width: 100%;"></canvas>
                </div>

                <!-- Transaction History -->
                <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase; font-weight: 800; margin-bottom: 15px; display: flex; justify-content: space-between;">
                    Histórico Recente de Carteira
                    <span style="color: #64748b;">${allTxs.length} registros</span>
                </div>
                <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; overflow: hidden;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: rgba(255,255,255,0.05); text-align: left; font-size: 10px; text-transform: uppercase; color: #64748b;">
                                <th style="padding: 12px 20px;">Data</th>
                                <th style="padding: 12px 20px;">Usuário</th>
                                <th style="padding: 12px 20px;">Descrição</th>
                                <th style="padding: 12px 20px; text-align: center;">Créditos</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${allTxs.length === 0 ? '<tr><td colspan="4" style="padding: 30px; text-align: center;">Sem registros</td></tr>' : allTxs.map(t => `
                            <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                                <td style="padding: 12px 20px; font-size: 11px; color: #475569;">${new Date(t.created_at).toLocaleDateString()}</td>
                                <td style="padding: 12px 20px; font-size: 11px; color: white;">${t.profiles?.email}</td>
                                <td style="padding: 12px 20px; font-size: 11px; color: #94a3b8;">${t.description}</td>
                                <td style="padding: 12px 20px; text-align: center; color: ${t.amount > 0 ? '#10b981' : '#f87171'}; font-weight: 800;">${t.amount > 0 ? '+' : ''}${t.amount}</td>
                            </tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            `;

            // Init Chart
            this.initFinanceChart();

        } catch (e) {
            console.error(e);
            container.innerHTML = '<div style="color: #ef4444;">Erro ao carregar Dashboard Financeiro: ' + e.message + '</div>';
        } finally {
            window.Loading.hide();
        }
    },

    initFinanceChart: function() {
        const ctx = document.getElementById('financeChart');
        if (!ctx) return;

        // Mock data for now (ideally group credit_transactions + pending_approved by day)
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['1 Mar', '3 Mar', '5 Mar', '7 Mar', '9 Mar', '11 Mar', '13 Mar', '15 Mar'],
                datasets: [{
                    label: 'Vendas (R$)',
                    data: [120, 450, 300, 800, 600, 950, 400, 750],
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 9 } } },
                    y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#64748b', font: { size: 9 } } }
                }
            }
        });
    },

    renderCRMIntelligence: async function(container) {
        window.Loading.show('Mapeando Atividades...', 'Sincronizando Leads');
        try {
            const [leads, activities, brokers] = await Promise.all([
                window.supabaseApp.from('leads').select('*, profiles(email)', { count: 'exact' }).limit(50).order('created_at', { ascending: false }),
                window.supabaseApp.from('crm_atividades').select('*, leads(nome), profiles(email)').order('created_at', { ascending: false }).limit(30),
                window.supabaseApp.from('profiles').select('id, email, role').order('created_at', { ascending: false })
            ]);

            const totalLeads = leads.count || 0;
            const recentActs = activities.data || [];
            
            // Simple counting since subquery in select is complex in supabase-js without RPC
            const brokerList = brokers.data || [];
            
            container.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 25px;">
                    <div style="background: rgba(37,99,235,0.05); border: 1px solid rgba(37,99,235,0.1); border-radius: 12px; padding: 20px;">
                        <div style="font-size: 10px; color: #3b82f6; text-transform: uppercase; font-weight: 800; letter-spacing: 1px;">Leads Totais</div>
                        <div style="font-size: 24px; font-weight: 900; color: white; margin: 8px 0;">${totalLeads}</div>
                        <div style="font-size: 10px; color: #64748b;">Carteira global do sistema</div>
                    </div>
                    <div style="background: rgba(16,185,129,0.05); border: 1px solid rgba(16,185,129,0.1); border-radius: 12px; padding: 20px;">
                        <div style="font-size: 10px; color: #10b981; text-transform: uppercase; font-weight: 800; letter-spacing: 1px;">Interações Ativas</div>
                        <div style="font-size: 24px; font-weight: 900; color: white; margin: 8px 0;">${recentActs.length}</div>
                        <div style="font-size: 10px; color: #64748b;">Ações registradas nos últimos 7 dias</div>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 20px;">
                    <!-- Timeline Global -->
                    <div>
                        <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase; font-weight: 800; margin-bottom: 12px;">📊 Timeline Global de Atividades</div>
                        <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 20px;">
                            ${recentActs.map(act => `
                                <div style="display: flex; gap: 15px; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.03);">
                                    <div style="width: 32px; height: 32px; background: rgba(255,255,255,0.05); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #94a3b8;">
                                        <i class="fas ${act.tipo === 'nota' ? 'fa-sticky-note' : 'fa-phone'}"></i>
                                    </div>
                                    <div style="flex: 1;">
                                        <div style="font-size: 12px; color: white;"><b style="color: #60a5fa;">${act.profiles?.email?.split('@')[0]}</b> registrou nota para <b style="color: #4ade80;">${act.leads?.nome}</b></div>
                                        <div style="font-size: 11px; color: #64748b; margin-top: 4px;">"${act.conteudo}"</div>
                                        <div style="font-size: 9px; color: #475569; margin-top: 5px;">${new Date(act.created_at).toLocaleString()}</div>
                                    </div>
                                </div>
                            `).join('')}
                            ${recentActs.length === 0 ? '<div style="color: #475569; text-align: center; padding: 20px;">Sem atividades recentes</div>' : ''}
                        </div>
                    </div>

                    <!-- User Stats -->
                    <div>
                        <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase; font-weight: 800; margin-bottom: 12px;">👥 Equipe & Corretores</div>
                        <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; overflow: hidden;">
                            ${brokerList.slice(0, 8).map(b => `
                                <div style="padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.03);">
                                    <div>
                                        <div style="font-size: 12px; font-weight: 700; color: white;">${b.email}</div>
                                        <div style="font-size: 9px; color: #64748b; text-transform: uppercase;">${b.role}</div>
                                    </div>
                                    <div style="text-align: right;">
                                        <div style="font-size: 9px; color: #475569;">Ativo</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        } catch (e) {
            console.error(e);
            container.innerHTML = '<div style="color: #ef4444;">Erro no Dashboard CRM: ' + e.message + '</div>';
        } finally {
            window.Loading.hide();
        }
    },

    getLogIcon: function(action) {
        switch(action) {
            case 'unlock_data': return 'fa-lock-open';
            case 'generate_pdf': return 'fa-file-pdf';
            case 'search': return 'fa-search';
            case 'login': return 'fa-sign-in-alt';
            default: return 'fa-fingerprint';
        }
    },

    addToWhitelist: function() {
        const input = document.getElementById('new-whitelist-email');
        const email = input.value?.trim();
        if (!email || !email.includes('@')) { window.Toast.warning('E-mail inválido'); return; }
        
        const container = document.getElementById('whitelist-container');
        const chip = document.createElement('div');
        chip.style = "background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 5px 12px; border-radius: 20px; font-size: 12px; color: white; display: flex; align-items: center; gap: 8px;";
        chip.innerHTML = `${email} <i class="fas fa-times" onclick="window.Admin.removeFromWhitelist('${email}')" style="cursor: pointer; opacity: 0.5;"></i>`;
        container.appendChild(chip);
        input.value = '';
    },

    removeFromWhitelist: function(email) {
        document.querySelectorAll('#whitelist-container > div').forEach(el => {
            if (el.innerText.includes(email)) el.remove();
        });
    },

    renderDashboard: async function(container) {
        window.Loading.show('Consolidando Unidades...', 'Gerando visão geral do banco');
        try {
            // Paralelizar chamadas de contagem (Usando head: true para obter apenas o count)
            const [totalRes, publicRes, completeRes, emptyRes] = await Promise.all([
                window.supabaseApp.from('unidades').select('*', { count: 'exact', head: true }),
                window.supabaseApp.from('unidades').select('*', { count: 'exact', head: true })
                    .or('nome_proprietario.ilike.%PREFEITURA%,nome_proprietario.ilike.%MUNICIPIO%,nome_proprietario.ilike.%UNIÃO%,nome_proprietario.ilike.%ESTADO%,nome_proprietario.ilike.%GOVERNO%'),
                window.supabaseApp.from('unidades').select('*', { count: 'exact', head: true })
                    .not('nome_proprietario', 'is', null)
                    .not('cpf_cnpj', 'is', null)
                    .not('matricula', 'is', null),
                window.supabaseApp.from('unidades').select('*', { count: 'exact', head: true })
                    .is('nome_proprietario', null)
                    .is('cpf_cnpj', null)
                    .is('matricula', null)
            ]);

            const total = totalRes.count || 0;
            const publicCount = publicRes.count || 0;
            const completeCount = completeRes.count || 0;
            const emptyCount = emptyRes.count || 0;
            
            // Cálculos de porcentagem
            const calcPct = (val) => total > 0 ? ((val / total) * 100).toFixed(1) : '0';
            
            const publicPct = calcPct(publicCount);
            const completePct = calcPct(completeCount);
            const emptyPct = calcPct(emptyCount);
            const missingPct = (100 - parseFloat(completePct)).toFixed(1);

            container.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 30px;">
                    
                    <!-- Cabeçalho do Dashboard -->
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <div>
                            <div style="font-size: 20px; font-weight: 900; color: white;">Visão Geral da Base</div>
                            <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">Status de enriquecimento e propriedade das unidades</div>
                        </div>
                        <div style="background: rgba(37, 99, 235, 0.1); border: 1px solid rgba(37, 99, 235, 0.2); padding: 10px 20px; border-radius: 12px; text-align: right;">
                            <div style="font-size: 10px; color: #3b82f6; font-weight: 800; text-transform: uppercase;">Total de Unidades</div>
                            <div style="font-size: 24px; font-weight: 900; color: white;">${total.toLocaleString('pt-BR')}</div>
                        </div>
                    </div>

                    <!-- Grid de Cards Principais -->
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
                        
                        <!-- Unidades Públicas -->
                        <div style="background: #0f172a; border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 16px; padding: 25px; position: relative; overflow: hidden;">
                            <div style="position: absolute; top: -10px; right: -10px; font-size: 60px; opacity: 0.05; color: #10b981;"><i class="fas fa-landmark"></i></div>
                            <div style="font-size: 11px; font-weight: 800; color: #10b981; text-transform: uppercase; letter-spacing: 1px;">Propriedade Pública</div>
                            <div style="display: flex; align-items: baseline; gap: 10px; margin: 15px 0;">
                                <div style="font-size: 32px; font-weight: 900; color: white;">${publicPct}%</div>
                                <div style="font-size: 14px; color: #64748b;">(${publicCount.toLocaleString('pt-BR')})</div>
                            </div>
                            <div style="font-size: 12px; color: #94a3b8; line-height: 1.5;">Pertencentes à Prefeitura, União, Estado ou Órgãos Públicos.</div>
                            <div style="height: 6px; background: rgba(16, 185, 129, 0.1); border-radius: 3px; margin-top: 20px;">
                                <div style="width: ${publicPct}%; height: 100%; background: #10b981; border-radius: 3px;"></div>
                            </div>
                        </div>

                        <!-- Unidades Completas -->
                        <div style="background: #0f172a; border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 16px; padding: 25px; position: relative; overflow: hidden;">
                            <div style="position: absolute; top: -10px; right: -10px; font-size: 60px; opacity: 0.05; color: #3b82f6;"><i class="fas fa-check-double"></i></div>
                            <div style="font-size: 11px; font-weight: 800; color: #3b82f6; text-transform: uppercase; letter-spacing: 1px;">Cadastro Completo</div>
                            <div style="display: flex; align-items: baseline; gap: 10px; margin: 15px 0;">
                                <div style="font-size: 32px; font-weight: 900; color: white;">${completePct}%</div>
                                <div style="font-size: 14px; color: #64748b;">(${completeCount.toLocaleString('pt-BR')})</div>
                            </div>
                            <div style="font-size: 12px; color: #94a3b8; line-height: 1.5;">Possuem Proprietário, CPF/CNPJ e Matrícula/RIP vinculados.</div>
                            <div style="height: 6px; background: rgba(59, 130, 246, 0.1); border-radius: 3px; margin-top: 20px;">
                                <div style="width: ${completePct}%; height: 100%; background: #3b82f6; border-radius: 3px;"></div>
                            </div>
                        </div>

                        <!-- Unidades Sem Dados -->
                        <div style="background: #0f172a; border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 16px; padding: 25px; position: relative; overflow: hidden;">
                            <div style="position: absolute; top: -10px; right: -10px; font-size: 60px; opacity: 0.05; color: #ef4444;"><i class="fas fa-ghost"></i></div>
                            <div style="font-size: 11px; font-weight: 800; color: #ef4444; text-transform: uppercase; letter-spacing: 1px;">Sem Dados (Vazias)</div>
                            <div style="display: flex; align-items: baseline; gap: 10px; margin: 15px 0;">
                                <div style="font-size: 32px; font-weight: 900; color: white;">${emptyPct}%</div>
                                <div style="font-size: 14px; color: #64748b;">(${emptyCount.toLocaleString('pt-BR')})</div>
                            </div>
                            <div style="font-size: 12px; color: #94a3b8; line-height: 1.5;">Unidades críticas sem nenhuma informação cadastral básica.</div>
                            <div style="height: 6px; background: rgba(239, 68, 68, 0.1); border-radius: 3px; margin-top: 20px;">
                                <div style="width: ${emptyPct}%; height: 100%; background: #ef4444; border-radius: 3px;"></div>
                            </div>
                        </div>

                    </div>

                    <!-- Cards de Detalhamento Secundário -->
                    <div style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 20px;">
                         <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 25px;">
                            <div style="font-size: 12px; font-weight: 800; color: white; display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
                                <i class="fas fa-chart-pie" style="color: #6366f1;"></i> Distribuição de Qualidade da Base
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 15px;">
                                <div>
                                    <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px;">
                                        <span>Dados de Proprietário</span>
                                        <span style="font-weight: 800;">${completePct}%</span>
                                    </div>
                                    <div style="height: 10px; background: rgba(255,255,255,0.05); border-radius: 5px;">
                                        <div style="width: ${completePct}%; height: 100%; background: linear-gradient(90deg, #3b82f6, #6366f1); border-radius: 5px;"></div>
                                    </div>
                                </div>
                                <div>
                                    <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px;">
                                        <span>Documentação Física (Matrícula/RIP)</span>
                                        <span style="font-weight: 800;">${(parseFloat(completePct) * 1.1).toFixed(1)}%</span>
                                    </div>
                                    <div style="height: 10px; background: rgba(255,255,255,0.05); border-radius: 5px;">
                                        <div style="width: ${Math.min(100, parseFloat(completePct) * 1.1)}%; height: 100%; background: linear-gradient(90deg, #10b981, #34d399); border-radius: 5px;"></div>
                                    </div>
                                </div>
                                <div style="margin-top: 10px; padding: 15px; background: rgba(59, 130, 246, 0.05); border-radius: 8px; border-left: 4px solid #3b82f6;">
                                    <div style="font-size: 11px; color: #94a3b8;"><b>Meta de Enriquecimento:</b> Atualmente faltam aproximadamente <b>${missingPct}%</b> das unidades para atingir a conformidade total de dados.</div>
                                </div>
                            </div>
                         </div>

                         <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 25px; display: flex; flex-direction: column; justify-content: center; text-align: center;">
                            <div style="font-size: 48px; margin-bottom: 10px; opacity: 0.8;">🚀</div>
                            <div style="font-size: 16px; font-weight: 900; color: white;">Pronto para Enriquecer?</div>
                            <p style="font-size: 12px; color: #64748b; margin: 15px 0;">Use o Mass Editor ou o integrador de registros para preencher os dados faltantes.</p>
                            <button onclick="window.Admin.switchTab(this, 'curatorship')" style="background: #2563eb; color: white; border: none; padding: 12px; border-radius: 10px; font-weight: 800; cursor: pointer; font-size: 11px; text-transform: uppercase;">Ir para Curadoria</button>
                         </div>
                    </div>

                </div>
            `;

        } catch (e) {
            console.error(e);
            container.innerHTML = '<div style="color: #ef4444; padding: 40px; text-align: center;">Erro ao carregar Dashboard: ' + e.message + '</div>';
        } finally {
            window.Loading.hide();
        }
    }
};
