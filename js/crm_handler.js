// ==========================================
// CRM HANDLER - Gerenciamento de Leads
// ==========================================

// Track leads count
window.currentLeadsCount = 0;

// Initialize and load leads count
window.initCRM = async function () {
    const { data: { user } } = await window.supabaseApp.auth.getUser();
    if (user) {
        await updateLeadsCount(user.id);
        await checkNewMatches(user.id); // Notification
    }
};

// Update leads count badge
async function updateLeadsCount(userId) {
    try {
        const { count, error } = await window.supabaseApp
            .from('leads')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

        if (!error) {
            window.currentLeadsCount = count || 0;
        }
    } catch (e) {
        console.error('Error updating leads count:', e);
    }
}

// Check for matches and notify
async function checkNewMatches() {
    try {
        // Simple logic: Check how many leads have potential matches.
        // Doing this client-side for all leads might be heavy, so limit to last 20?
        // Or just count total leads with status 'ativo'.
        const { data: leads, error } = await window.supabaseApp
            .from('leads')
            .select('id, zonas_interesse, tipo_imovel, quartos_min, valor_max')
            .eq('status', 'ativo')
            .limit(10); // Check top 10 active leads

        if (error || !leads) return;

        let leadsWithMatches = 0;
        for (const lead of leads) {
            // Simplified query to check existence
            let query = window.supabaseApp.from('unidades').select('inscricao', { count: 'exact', head: true });

            if (lead.zonas_interesse && lead.zonas_interesse.length > 0) {
                query = query.in('lotes.zona', lead.zonas_interesse);
                // Note: Join filter on 'lotes' requires inner join syntax in supabase-js or manual logic.
                // Supabase-js basic filter on foreign table: .not('lotes', 'is', null) + filter.
                // Actually, filtering on foreign tables in supabase-js is tricky:
                // select('*, lotes!inner(zona)') .in('lotes.zona', ...)
                query = window.supabaseApp.from('unidades')
                    .select('calc_id, lotes!inner(zona)', { count: 'exact', head: true })
                    .in('lotes.zona', lead.zonas_interesse);
            }

            if (lead.tipo_imovel) query = query.eq('tipo', lead.tipo_imovel);
            if (lead.quartos_min) query = query.gte('quartos', lead.quartos_min);
            if (lead.valor_max) query = query.lte('valor', lead.valor_max);

            const { count } = await query;
            if (count > 0) leadsWithMatches++;
        }

        if (leadsWithMatches > 0) {
            window.Toast.info(`Há imóveis compatíveis para ${leadsWithMatches} dos seus leads ativos!`, 'CRM MATCH');
        }

    } catch (e) {
        console.log("Match check skipped");
    }
}

// ========================================
// OPEN ADD/EDIT LEAD TOOLTIP
// ========================================
window.openAddLeadTooltip = function (leadId = null) {
    // Hide context menu
    if (window.hideContextMenu) window.hideContextMenu();

    const isEdit = !!leadId;
    const title = isEdit ? '✏️ Editar Cliente' : '👤 Novo Cliente CRM';
    const btnText = isEdit ? 'Atualizar Cliente' : 'Salvar Cliente';
    const btnAction = isEdit ? `window.updateLead('${leadId}')` : 'window.saveLead()';

    const tooltip = document.createElement('div');
    tooltip.className = 'lead-tooltip';
    tooltip.id = 'leadTooltip';
    tooltip.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 200000;';

    tooltip.innerHTML = `
        <div class="lead-tooltip-header">
            <h3>${title}</h3>
            <button class="lead-tooltip-close" onclick="window.closeLeadTooltip()">×</button>
        </div>
        <div class="lead-tooltip-body">
            <!-- Dados Pessoais -->
            <div class="lead-form-section">
                <h4>📋 Dados Pessoais</h4>
                <div class="lead-form-row">
                    <div class="lead-form-field">
                        <label>Nome Completo *</label>
                        <input type="text" id="lead-nome" placeholder="João Silva" required>
                    </div>
                    <div class="lead-form-field">
                        <label>Telefone</label>
                        <input type="tel" id="lead-telefone" placeholder="(13) 99999-9999">
                    </div>
                </div>
                <div class="lead-form-row">
                    <div class="lead-form-field">
                        <label>Email</label>
                        <input type="email" id="lead-email" placeholder="joao@email.com">
                    </div>
                    <div class="lead-form-field">
                        <label>CPF/CNPJ</label>
                        <input type="text" id="lead-cpf" placeholder="000.000.000-00">
                    </div>
                </div>
            </div>

            <!-- Critérios de Busca -->
            <div class="lead-form-section">
                <h4>🎯 Critérios de Busca</h4>
                
                <!-- Zonas de Interesse -->
                <div class="lead-form-field">
                    <label>Zonas de Interesse</label>
                    <div class="zone-checkboxes">
                        <div class="zone-checkbox-item">
                            <input type="checkbox" id="zona-1" value="1">
                            <label for="zona-1">Zona 1</label>
                        </div>
                        <div class="zone-checkbox-item">
                            <input type="checkbox" id="zona-2" value="2">
                            <label for="zona-2">Zona 2</label>
                        </div>
                        <div class="zone-checkbox-item">
                            <input type="checkbox" id="zona-3" value="3">
                            <label for="zona-3">Zona 3</label>
                        </div>
                        <div class="zone-checkbox-item">
                            <input type="checkbox" id="zona-4" value="4">
                            <label for="zona-4">Zona 4</label>
                        </div>
                        <div class="zone-checkbox-item">
                            <input type="checkbox" id="zona-5" value="5">
                            <label for="zona-5">Zona 5</label>
                        </div>
                        <div class="zone-checkbox-item">
                            <input type="checkbox" id="zona-6" value="6">
                            <label for="zona-6">Zona 6</label>
                        </div>
                    </div>
                </div>

                <div class="lead-form-row">
                    <div class="lead-form-field">
                        <label>Tipo de Imóvel</label>
                        <select id="lead-tipo">
                            <option value="">Qualquer</option>
                            <option value="Apartamento">Apartamento</option>
                            <option value="Casa">Casa</option>
                            <option value="Terreno">Terreno</option>
                            <option value="Loja">Loja</option>
                        </select>
                    </div>
                    <div class="lead-form-field">
                        <label>Status</label>
                        <select id="lead-status">
                            <option value="ativo">Ativo</option>
                            <option value="inativo">Inativo</option>
                        </select>
                    </div>
                </div>

                <div class="lead-form-row">
                    <div class="lead-form-field">
                        <label>Quartos (Mínimo)</label>
                        <input type="number" id="lead-quartos-min" placeholder="2" min="0">
                    </div>
                    <div class="lead-form-field">
                        <label>Quartos (Máximo)</label>
                        <input type="number" id="lead-quartos-max" placeholder="4" min="0">
                    </div>
                </div>

                <div class="lead-form-row">
                    <div class="lead-form-field">
                        <label>Metragem Mínima (m²)</label>
                        <input type="number" id="lead-metragem-min" placeholder="50" step="0.01">
                    </div>
                    <div class="lead-form-field">
                        <label>Metragem Máxima (m²)</label>
                        <input type="number" id="lead-metragem-max" placeholder="200" step="0.01">
                    </div>
                </div>

                <div class="lead-form-row">
                    <div class="lead-form-field">
                        <label>Valor Mínimo (R$)</label>
                        <input type="number" id="lead-valor-min" placeholder="300000" step="1000">
                    </div>
                    <div class="lead-form-field">
                        <label>Valor Máximo (R$)</label>
                        <input type="number" id="lead-valor-max" placeholder="500000" step="1000">
                    </div>
                </div>
            </div>

            <!-- Observações -->
            <div class="lead-form-section">
                <h4>📝 Observações</h4>
                <div class="lead-form-row full">
                    <div class="lead-form-field">
                        <textarea id="lead-obs" placeholder="Notas adicionais sobre o cliente..."></textarea>
                    </div>
                </div>
            </div>
        </div>
        <div class="lead-tooltip-actions">
            <button class="lead-tooltip-btn secondary" onclick="window.closeLeadTooltip()">Cancelar</button>
            <button class="lead-tooltip-btn primary" onclick="${btnAction}">${btnText}</button>
        </div>
    `;

    document.body.appendChild(tooltip);

    // Initial Mask Setup
    const cpfInput = document.getElementById('lead-cpf');
    if (cpfInput) {
        cpfInput.addEventListener('input', (e) => {
            e.target.value = window.formatDocument(e.target.value, true);
        });
    }

    // Add backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'sidebar-backdrop active';
    backdrop.style.zIndex = '199999';
    backdrop.onclick = window.closeLeadTooltip;
    document.body.appendChild(backdrop);
    tooltip.backdrop = backdrop;

    // IF EDIT, FETCH AND FILL
    if (isEdit) {
        window.loadLeadData(leadId);
    }
};

window.loadLeadData = async function (leadId) {
    window.Loading.show('Carregando dados...');
    try {
        const { data: lead, error } = await window.supabaseApp
            .from('leads')
            .select('*')
            .eq('id', leadId)
            .single();

        if (error) throw error;

        // Fill fields
        if (lead.nome) document.getElementById('lead-nome').value = lead.nome;
        if (lead.telefone) document.getElementById('lead-telefone').value = lead.telefone;
        if (lead.email) document.getElementById('lead-email').value = lead.email;
        if (lead.cpf_cnpj) document.getElementById('lead-cpf').value = window.formatDocument(lead.cpf_cnpj, true);

        if (lead.tipo_imovel) document.getElementById('lead-tipo').value = lead.tipo_imovel;
        if (lead.status) document.getElementById('lead-status').value = lead.status;

        if (lead.quartos_min) document.getElementById('lead-quartos-min').value = lead.quartos_min;
        if (lead.quartos_max) document.getElementById('lead-quartos-max').value = lead.quartos_max;

        if (lead.metragem_min) document.getElementById('lead-metragem-min').value = lead.metragem_min;
        if (lead.metragem_max) document.getElementById('lead-metragem-max').value = lead.metragem_max;

        if (lead.valor_min) document.getElementById('lead-valor-min').value = lead.valor_min;
        if (lead.valor_max) document.getElementById('lead-valor-max').value = lead.valor_max;

        if (lead.observacoes) document.getElementById('lead-obs').value = lead.observacoes;

        // Zones
        if (lead.zonas_interesse) {
            lead.zonas_interesse.forEach(zona => {
                const cb = document.getElementById(`zona-${zona}`);
                if (cb) cb.checked = true;
            });
        }

    } catch (e) {
        console.error(e);
        window.Toast.error('Erro ao carregar lead');
        window.closeLeadTooltip();
    } finally {
        window.Loading.hide();
    }
};

// ========================================
// CLOSE LEAD TOOLTIP
// ========================================
window.closeLeadTooltip = function () {
    const tooltip = document.getElementById('leadTooltip');
    if (tooltip) {
        if (tooltip.backdrop) tooltip.backdrop.remove();
        tooltip.remove();
    }
};

// ==========================================
// FORM DATA EXTRACTION
// ==========================================
function getLeadFormData() {
    const nome = document.getElementById('lead-nome')?.value;
    const telefone = document.getElementById('lead-telefone')?.value;
    const email = document.getElementById('lead-email')?.value;
    const cpf_cnpj_raw = document.getElementById('lead-cpf')?.value;
    const cpf_cnpj = cpf_cnpj_raw ? cpf_cnpj_raw.replace(/\D/g, '') : null; // Clean for DB

    // Validation
    if (!nome) { window.Toast.warning('Nome é obrigatório'); return null; }

    // CPF Validation
    if (cpf_cnpj && cpf_cnpj.length > 0) {
        let valid = false;
        if (cpf_cnpj.length <= 11) valid = window.validateCPF(cpf_cnpj);
        else valid = window.validateCNPJ(cpf_cnpj);

        if (!valid) {
            window.Toast.error('CPF/CNPJ inválido!');
            return null;
        }
    }

    const tipo_imovel = document.getElementById('lead-tipo')?.value;
    const status = document.getElementById('lead-status')?.value;
    const quartos_min = parseInt(document.getElementById('lead-quartos-min')?.value) || null;
    const quartos_max = parseInt(document.getElementById('lead-quartos-max')?.value) || null;
    const metragem_min = parseFloat(document.getElementById('lead-metragem-min')?.value) || null;
    const metragem_max = parseFloat(document.getElementById('lead-metragem-max')?.value) || null;
    const valor_min = parseFloat(document.getElementById('lead-valor-min')?.value) || null;
    const valor_max = parseFloat(document.getElementById('lead-valor-max')?.value) || null;
    const observacoes = document.getElementById('lead-obs')?.value;

    const zonas_interesse = [];
    for (let i = 1; i <= 6; i++) {
        const checkbox = document.getElementById(`zona-${i}`);
        if (checkbox && checkbox.checked) zonas_interesse.push(i.toString());
    }

    return {
        nome, telefone, email, cpf_cnpj, zonas_interesse, tipo_imovel,
        quartos_min, quartos_max, metragem_min, metragem_max,
        valor_min, valor_max, observacoes, status,
        contato: telefone || email
    };
}
window.getLeadFormData = getLeadFormData; // Export for testing

// ========================================
// SAVE LEAD (CREATE)
// ========================================
window.saveLead = async function () {
    const leadData = getLeadFormData();
    if (!leadData) return;

    window.Loading.show('Salvando cliente...');
    try {
        const { data: { user } } = await window.supabaseApp.auth.getUser();
        if (user) leadData.user_id = user.id;

        const { error } = await window.supabaseApp.from('leads').insert(leadData);
        if (error) throw error;

        window.Toast.success('Cliente cadastrado com sucesso!');
        window.closeLeadTooltip();
        if (user) await updateLeadsCount(user.id);
        await window.loadLeads(); // Refresh sidebar list
        if (document.getElementById('leadsPanel')) window.showLeadsPanel(); // Refresh list if open
    } catch (e) {
        console.error('Error saving lead:', e);
        window.Toast.error('Erro ao salvar: ' + e.message);
    } finally {
        window.Loading.hide();
    }
};

// ========================================
// UPDATE LEAD
// ========================================
window.updateLead = async function (leadId) {
    const leadData = getLeadFormData();
    if (!leadData) return;

    window.Loading.show('Atualizando cliente...');
    try {
        const { data: { user } } = await window.supabaseApp.auth.getUser();
        
        const { error } = await window.supabaseApp
            .from('leads')
            .update(leadData)
            .eq('id', leadId);

        if (error) throw error;

        window.Toast.success('Cliente atualizado!');
        window.closeLeadTooltip();
        await window.loadLeads(); // Refresh sidebar list
        if (document.getElementById('leadsPanel')) window.showLeadsPanel(); // Refresh list
    } catch (e) {
        console.error('Error updating lead:', e);
        window.Toast.error('Erro ao atualizar: ' + e.message);
    } finally {
        window.Loading.hide();
    }
};

// ========================================
// MEU CRM: CARREGAMENTO PESSOAL (SIDEBAR)
// ========================================
window.loadLeads = async function () {
    const listContainer = document.getElementById('sidebarCRMList');
    if (!listContainer) return;

    if (!window.Monetization.canAccess('crm_history')) {
        listContainer.innerHTML = `
            <div style="padding: 40px 20px; text-align: center; background: #fffbeb; border-radius: 12px; margin: 10px; border: 1px solid #fde68a;">
                <i class="fas fa-lock" style="font-size: 32px; color: #d97706; margin-bottom: 12px;"></i>
                <h4 style="color: #92400e; margin-bottom: 8px;">CRM Exclusivo Pro</h4>
                <p style="font-size: 11px; color: #b45309; line-height: 1.4;">
                    Organize seus clientes, receba notificações de novos imóveis compatíveis e acelere suas vendas.
                </p>
                <button onclick="window.Monetization.showSubscriptionPlans()" 
                    style="margin-top: 15px; background: #d97706; color: white; border: none; padding: 10px 15px; border-radius: 8px; font-weight: 700; font-size: 12px; cursor: pointer; width: 100%;">
                    Fazer Upgrade agora
                </button>
            </div>
        `;
        return;
    }

    listContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #94a3b8;"><i class="fas fa-spinner fa-spin"></i> Sincronizando sua carteira...</div>';

    try {
        const { data: { user } } = await window.supabaseApp.auth.getUser();
        if (!user) return;

        const { data: leads, error } = await window.supabaseApp
            .from('leads')
            .select('*')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false });

        if (error) throw error;

        // Renderização Base
        if (!leads || leads.length === 0) {
            listContainer.innerHTML = `
                <div style="padding: 40px 20px; text-align: center; color: #94a3b8;">
                    <i class="fas fa-user-friends" style="font-size: 32px; opacity: 0.2; margin-bottom: 12px; display: block;"></i>
                    <p style="font-size: 13px; font-weight: 500; color: #64748b;">Sua carteira Kanban está vazia.</p>
                </div>`;
            return;
        }

        const hotLeads = leads.filter(l => l.status === 'Quente').length;
        const totalValue = leads.reduce((acc, l) => acc + (l.valor_max || 0), 0);

        let dashboardHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px; padding: 0 10px;">
                <div style="background: #fdf2f2; border: 1px solid #fee2e2; padding: 12px; border-radius: 12px;">
                    <div style="font-size: 9px; color: #ef4444; font-weight: 800; text-transform: uppercase;">🔥 Quentes</div>
                    <div style="font-size: 18px; font-weight: 900; color: #991b1b;">${hotLeads}</div>
                </div>
                <div style="background: #f0fdf4; border: 1px solid #dcfce7; padding: 12px; border-radius: 12px;">
                    <div style="font-size: 9px; color: #16a34a; font-weight: 800; text-transform: uppercase;">💰 Potencial Global</div>
                    <div style="font-size: 18px; font-weight: 900; color: #166534;">R$ ${(totalValue/1000000).toFixed(1)}M</div>
                </div>
            </div>
            <div style="padding: 0 10px; margin-bottom: 10px; color: #64748b; font-size: 11px; font-weight: 700;">
                <i class="fas fa-arrows-alt-h"></i> Arraste os cards (Touch ou Mouse) entre as colunas para atualizar.
            </div>
        `;

        // Kanban Board Generation
        const renderKanban = (data) => {
            const columns = {
                'Frio': { id: 'Frio', title: '❄️ Frio', color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe', items: [] },
                'Morno': { id: 'Morno', title: '🌤️ Morno', color: '#f59e0b', bg: '#fffbeb', border: '#fde68a', items: [] },
                'Quente': { id: 'Quente', title: '🔥 Quente', color: '#ef4444', bg: '#fef2f2', border: '#fecaca', items: [] },
                'Fechado': { id: 'Fechado', title: '✅ Fechado', color: '#10b981', bg: '#f0fdf4', border: '#bbf7d0', items: [] }
            };

            data.forEach(l => {
                const status = columns[l.status] ? l.status : 'Frio';
                columns[status].items.push(l);
            });

            return `
                <div class="kanban-board" style="display: flex; gap: 15px; padding: 0 10px 20px 10px; overflow-x: auto; scroll-snap-type: x mandatory; min-height: 400px;">
                    ${Object.values(columns).map(col => `
                        <div class="kanban-column" data-status="${col.id}" style="scroll-snap-align: start; flex: 0 0 280px; background: #f8fafc; border-radius: 16px; display: flex; flex-direction: column; overflow: hidden; border: 1px solid #e2e8f0;">
                            <div style="padding: 12px 15px; background: ${col.bg}; border-bottom: 2px solid ${col.border}; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 2;">
                                <span style="font-weight: 800; font-size: 13px; color: ${col.color};">${col.title}</span>
                                <span style="background: white; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 800; color: ${col.color}; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">${col.items.length}</span>
                            </div>
                            <div class="kanban-dropzone" style="flex: 1; padding: 10px; min-height: 150px; overflow-y: auto; touch-action: pan-y;">
                                ${col.items.map(l => createSidebarLeadCard(l)).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        };

        listContainer.innerHTML = dashboardHTML + renderKanban(leads);

        // Search Listener
        const searchInput = document.getElementById('crmSearchInput');
        if (searchInput) {
            searchInput.oninput = (e) => {
                const query = e.target.value.toLowerCase();
                const filtered = leads.filter(l => l.nome.toLowerCase().includes(query) || (l.telefone && l.telefone.includes(query)));
                listContainer.innerHTML = dashboardHTML + renderKanban(filtered);
                window.initKanbanTouchEvents();
            };
        }

        // Initialize Native Mobile Drag & Drop (Touch Events)
        window.initKanbanTouchEvents();

    } catch (e) {
        console.error('CRM Load error:', e);
        listContainer.innerHTML = `<div style="padding: 20px; color: #ef4444; font-size: 12px;">Erro ao carregar seu CRM. Verifique sua conexão.</div>`;
    }
};

function createSidebarLeadCard(lead) {
    const valorFormatted = lead.valor_max ? `R$ ${(lead.valor_max/1000).toFixed(0)}k` : '---';

    return `
        <div class="crm-sidebar-card kanban-card" data-lead-id="${lead.id}" draggable="true" style="position: relative; background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; margin-bottom: 10px; cursor: grab; box-shadow: 0 2px 5px rgba(0,0,0,0.02); touch-action: none; transition: transform 0.2s, box-shadow 0.2s;" 
             onclick="window.openLeadDetail('${lead.id}')">
            
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                <div style="flex: 1; min-width: 0; pointer-events: none;">
                    <div style="font-weight: 800; color: #1e293b; font-size: 13px; margin-bottom: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${lead.nome}</div>
                    <div style="font-size: 10px; color: #94a3b8;"><i class="fas fa-clock"></i> ${new Date(lead.updated_at || lead.created_at).toLocaleDateString()}</div>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr; gap: 4px; margin-bottom: 10px; pointer-events: none;">
                <div style="font-size: 11px; color: #059669; font-weight: 800;"><i class="fas fa-money-bill-wave"></i> ${valorFormatted}</div>
                <div style="font-size: 10px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"><i class="fas fa-home"></i> ${lead.tipo_imovel || 'Imóvel'}</div>
            </div>

            <div style="display: flex; gap: 6px;" onclick="event.stopPropagation()">
                <button onclick="window.findMatches('${lead.id}')" style="flex: 1; height: 28px; background: #f1f5f9; color: #2563eb; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 10px; font-weight: 800; cursor: pointer;">
                    <i class="fas fa-search"></i> Match
                </button>
                <button onclick="window.openWhatsApp('${lead.telefone}', '${lead.nome}')" style="width: 28px; height: 28px; background: #22c55e; color: white; border: none; border-radius: 6px; cursor: pointer;">
                    <i class="fab fa-whatsapp"></i>
                </button>
            </div>
        </div>
    `;
}

// ========================================
// KANBAN TOUCH & DRAG SYSTEM (PWA Mobile)
// ========================================
window.initKanbanTouchEvents = function() {
    const cards = document.querySelectorAll('.kanban-card');
    const dropzones = document.querySelectorAll('.kanban-dropzone');
    
    let draggedCard = null;
    let initialX = 0, initialY = 0;
    let cloneCard = null;

    // --- MOUSE DRAG & DROP (Desktop) ---
    cards.forEach(card => {
        card.addEventListener('dragstart', function(e) {
            draggedCard = this;
            e.dataTransfer.setData('text/plain', this.dataset.leadId);
            setTimeout(() => this.style.opacity = '0.4', 0);
        });
        card.addEventListener('dragend', function() {
            this.style.opacity = '1';
            draggedCard = null;
        });
    });

    dropzones.forEach(zone => {
        zone.addEventListener('dragover', e => {
            e.preventDefault();
            zone.closest('.kanban-column').style.transform = 'scale(1.02)';
        });
        zone.addEventListener('dragleave', e => {
            zone.closest('.kanban-column').style.transform = 'none';
        });
        zone.addEventListener('drop', async function(e) {
            e.preventDefault();
            this.closest('.kanban-column').style.transform = 'none';
            if (!draggedCard) return;
            
            this.appendChild(draggedCard);
            const newStatus = this.closest('.kanban-column').dataset.status;
            await window.updateLeadStatus(draggedCard.dataset.leadId, newStatus);
        });
    });

    // --- MOBILE TOUCH DRAG PWA ---
    cards.forEach(card => {
        card.addEventListener('touchstart', function(e) {
            // Prevent interference if clicking a button inside
            if(e.target.tagName.toLowerCase() === 'button' || e.target.closest('button')) return;

            initialX = e.touches[0].clientX;
            initialY = e.touches[0].clientY;
            draggedCard = this;

            // Long press delay for scrolling vs dragging
            this.touchTimer = setTimeout(() => {
                // visual feedback
                this.style.opacity = '0.5';
                
                // Create absolute clone to follow finger
                cloneCard = this.cloneNode(true);
                cloneCard.style.position = 'fixed';
                cloneCard.style.zIndex = '999999';
                cloneCard.style.opacity = '0.9';
                cloneCard.style.width = this.offsetWidth + 'px';
                cloneCard.style.pointerEvents = 'none'; // so we can detect elements underneath
                document.body.appendChild(cloneCard);
                moveClone(e.touches[0]);
            }, 300); // 300ms hold to drag
        }, { passive: true });

        card.addEventListener('touchmove', function(e) {
            if (!cloneCard && this.touchTimer) {
                // If moved before timer fired, it's a scroll, cancel drag
                clearTimeout(this.touchTimer);
                return;
            }
            if (cloneCard) {
                e.preventDefault(); // Stop scrolling while dragging
                moveClone(e.touches[0]);
            }
        }, { passive: false });

        card.addEventListener('touchend', async function(e) {
            clearTimeout(this.touchTimer);
            this.style.opacity = '1';
            
            if (cloneCard) {
                const touch = e.changedTouches[0];
                cloneCard.remove();
                cloneCard = null;

                // Find element finger dropped on
                const dropTarget = document.elementFromPoint(touch.clientX, touch.clientY);
                if (dropTarget) {
                    const column = dropTarget.closest('.kanban-column');
                    if (column && column !== draggedCard.closest('.kanban-column')) {
                        const newStatus = column.dataset.status;
                        const dropzone = column.querySelector('.kanban-dropzone');
                        dropzone.appendChild(draggedCard);
                        await window.updateLeadStatus(draggedCard.dataset.leadId, newStatus);
                    }
                }
            }
            draggedCard = null;
        });
    });

    function moveClone(touch) {
        if (!cloneCard) return;
        cloneCard.style.left = (touch.clientX - (cloneCard.offsetWidth / 2)) + 'px';
        cloneCard.style.top = (touch.clientY - (cloneCard.offsetHeight / 2)) + 'px';
    }
};

window.updateLeadStatus = async function(leadId, newStatus) {
    if(!navigator.onLine) {
        window.Toast.warning("Sem conexão. Movimento guardado para sincronizar depois.");
        // Note: For complete PWA, we would save to local IndexedDB fallback here.
    } else {
        window.Toast.info(`Atualizando para ${newStatus}...`);
    }

    try {
        const { error } = await window.supabaseApp.from('leads').update({ status: newStatus }).eq('id', leadId);
        if (error) throw error;
        window.Toast.success('Kanban atualizado!');
        if(document.getElementById('leadsPanel')) window.showLeadsPanel(); // trigger radar refresh if needed
    } catch (e) {
        window.Toast.error("Erro ao mover cliente: " + e.message);
        window.loadLeads(); // roll back UI
    }
};

// ========================================
// LEAD DETAIL PANEL (Premium View)
// ========================================
window.openLeadDetail = async function (leadId) {
    window.Loading.show('Abrindo dossiê do cliente...');
    try {
        const { data: lead, error } = await window.supabaseApp
            .from('leads')
            .select('*')
            .eq('id', leadId)
            .single();

        if (error) throw error;

        const panel = document.createElement('div');
        panel.className = 'leads-panel';
        panel.id = 'leadDetailPanel';
        panel.style.maxWidth = '600px';

        panel.innerHTML = `
            <div class="leads-panel-header" style="background: #1e293b; color: white;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="width: 40px; height: 40px; background: #3b82f6; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 800;">
                        ${lead.nome.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h3 style="margin: 0; font-size: 18px;">${lead.nome}</h3>
                        <span style="font-size: 10px; opacity: 0.7; text-transform: uppercase;">Lead ID: ${lead.id.split('-')[0]}</span>
                    </div>
                </div>
                <button class="lead-tooltip-close" onclick="window.closeLeadDetail()">&times;</button>
            </div>
            <div class="leads-panel-body" style="background: #f8fafc;">
                <div class="detail-tabs">
                    <div class="detail-tab active" onclick="window.switchDetailTab('info')">Informações</div>
                    <div class="detail-tab" onclick="window.switchDetailTab('history')">Histórico</div>
                    <div class="detail-tab" onclick="window.switchDetailTab('matches')" id="tab-matches-trigger">Matches</div>
                </div>

                <div id="detail-content-info" class="detail-content">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px;">
                        <div style="background: white; padding: 15px; border-radius: 12px; border: 1px solid #e2e8f0;">
                            <label style="display: block; font-size: 10px; color: #94a3b8; text-transform: uppercase; margin-bottom: 5px;">📞 Contato</label>
                            <div style="font-size: 13px; font-weight: 600; color: #1e293b;">${lead.telefone || '---'}</div>
                            <div style="font-size: 11px; color: #64748b;">${lead.email || 'Sem e-mail'}</div>
                        </div>
                        <div style="background: white; padding: 15px; border-radius: 12px; border: 1px solid #e2e8f0;">
                            <label style="display: block; font-size: 10px; color: #94a3b8; text-transform: uppercase; margin-bottom: 5px;">🔥 Qualificação</label>
                            <span class="heat-tag ${lead.status?.toLowerCase() || 'cold'}">${lead.status || 'Frio'}</span>
                        </div>
                    </div>

                    <div style="background: white; padding: 20px; border-radius: 15px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
                        <h4 style="margin: 0 0 15px 0; font-size: 14px; color: #1e293b;">🎯 Perfil de Compra</h4>
                        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                            <span style="background: #f1f5f9; padding: 4px 10px; border-radius: 20px; font-size: 11px; color: #475569;">${lead.tipo_imovel || 'Qualquer Tipo'}</span>
                            <span style="background: #f1f5f9; padding: 4px 10px; border-radius: 20px; font-size: 11px; color: #475569;">Até R$ ${(lead.valor_max?.toLocaleString() || '---')}</span>
                            <span style="background: #f1f5f9; padding: 4px 10px; border-radius: 20px; font-size: 11px; color: #475569;">Min. ${lead.quartos_min || 0} Quartos</span>
                        </div>
                        <div style="margin-top: 15px; font-size: 12px; color: #64748b; line-height: 1.5;">
                            <b>Zonas:</b> ${lead.zonas_interesse?.join(', ') || 'Todas'}
                        </div>
                    </div>

                    <div style="background: white; padding: 20px; border-radius: 15px; border: 1px solid #e2e8f0;">
                        <h4 style="margin: 0 0 10px 0; font-size: 14px; color: #1e293b;">📝 Notas</h4>
                        <p style="font-size: 13px; color: #475569; line-height: 1.6; margin: 0;">${lead.observacoes || 'Nenhuma observação cadastrada.'}</p>
                    </div>

                    <div style="margin-top: 25px; display: flex; gap: 10px;">
                        <button onclick="window.editLead('${lead.id}')" style="flex: 1; padding: 12px; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 10px; font-weight: 700; cursor: pointer; color: #475569;">Editar Dados</button>
                        <button onclick="window.openWhatsApp('${lead.telefone}', '${lead.nome}')" style="flex: 1; padding: 12px; background: #22c55e; color: white; border: none; border-radius: 10px; font-weight: 700; cursor: pointer;">WhatsApp</button>
                    </div>
                </div>

                <div id="detail-content-history" class="detail-content" style="display: none;">
                    <div style="margin-bottom: 20px;">
                        <textarea id="new-activity-text" placeholder="Adicionar nota ou registro de atividade..." style="width: 100%; padding: 15px; border-radius: 12px; border: 1px solid #e2e8f0; font-size: 13px; min-height: 80px;"></textarea>
                        <div style="display: flex; justify-content: flex-end; margin-top: 10px;">
                            <button onclick="window.addActivity('${lead.id}')" style="padding: 8px 20px; background: #2563eb; color: white; border: none; border-radius: 8px; font-weight: 700; cursor: pointer;">Salvar Nota</button>
                        </div>
                    </div>
                    <div id="activities-timeline" class="crm-timeline">
                        <!-- Carregado via JS -->
                    </div>
                </div>

                <div id="detail-content-matches" class="detail-content" style="display: none;">
                    <div id="matches-list-container">
                        <!-- Carregado via JS -->
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(panel);
        
        const backdrop = document.createElement('div');
        backdrop.className = 'sidebar-backdrop active';
        backdrop.style.zIndex = '9999';
        backdrop.onclick = window.closeLeadDetail;
        document.body.appendChild(backdrop);
        panel.backdrop = backdrop;

        // Load activities by default
        window.loadLeadActivities(leadId);

    } catch (e) {
        console.error(e);
        window.Toast.error('Erro ao abrir detalhes');
    } finally {
        window.Loading.hide();
    }
};

window.closeLeadDetail = function() {
    const panel = document.getElementById('leadDetailPanel');
    if (panel) {
        if (panel.backdrop) panel.backdrop.remove();
        panel.remove();
    }
};

window.switchDetailTab = function(tab) {
    document.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.detail-content').forEach(c => c.style.display = 'none');
    
    event.target.classList.add('active');
    document.getElementById(`detail-content-${tab}`).style.display = 'block';

    if (tab === 'matches') {
        window.loadLeadMatches(window.currentOpenLeadId);
    }
};

window.loadLeadActivities = async function(leadId) {
    window.currentOpenLeadId = leadId;
    const container = document.getElementById('activities-timeline');
    if (!container) return;

    container.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i></div>';

    try {
        const { data, error } = await window.supabaseApp
            .from('crm_atividades')
            .select('*')
            .eq('lead_id', leadId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-clipboard"></i><p>Nenhuma atividade registrada ainda.</p></div>';
            return;
        }

        container.innerHTML = data.map(act => `
            <div class="crm-timeline-item">
                <div class="crm-timeline-time">${new Date(act.created_at).toLocaleString()}</div>
                <div class="crm-timeline-content">${act.conteudo}</div>
            </div>
        `).join('');

    } catch (e) {
        console.error(e);
    }
};

window.addActivity = async function(leadId) {
    const text = document.getElementById('new-activity-text')?.value;
    if (!text) return;

    try {
        const { error } = await window.supabaseApp.from('crm_atividades').insert({
            lead_id: leadId,
            conteudo: text,
            tipo: 'nota'
        });

        if (error) throw error;

        document.getElementById('new-activity-text').value = '';
        window.loadLeadActivities(leadId);
        window.Toast.success('Histórico atualizado!');
    } catch (e) {
        console.error(e);
        window.Toast.error('Erro ao salvar nota');
    }
};

window.loadLeadMatches = async function(leadId) {
    const container = document.getElementById('matches-list-container');
    if (!container) return;

    container.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i></div>';

    try {
        const { data: lead } = await window.supabaseApp.from('leads').select('*').eq('id', leadId).single();
        
        let query = window.supabaseApp.from('unidades').select('*, lotes!inner(*)');
        if (lead.zonas_interesse && lead.zonas_interesse.length > 0) {
            query = query.in('lotes.zona', lead.zonas_interesse);
        }
        if (lead.tipo_imovel) query = query.eq('tipo', lead.tipo_imovel);
        if (lead.valor_max) {
            // Se o lead tem um valor_max, filtramos imóveis até esse valor + uma margem de 10%
            query = query.lte('valor', lead.valor_max * 1.1);
        }

        const { data: matches, error } = await query.order('valor', { ascending: false }).limit(20);
        if (error) throw error;

        if (!matches || matches.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-search"></i><p>Nenhum imóvel compatível no momento.</p></div>';
            return;
        }

        container.innerHTML = `
            <div style="padding: 10px; font-size: 13px; font-weight: 700; color: #1e293b;">${matches.length} Sugestões no Perfil</div>
            <div style="display: flex; flex-direction: column; gap: 12px; padding: 10px;">
                ${matches.map(m => `
                    <div style="background: white; border: 1px solid #e2e8f0; padding: 15px; border-radius: 12px; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.02);">
                        <div style="display: flex; gap: 12px; cursor: pointer;" onclick="window.flyToUnlocked('${m.lote_inscricao}')">
                            <div style="width: 70px; height: 70px; background: #f1f5f9; border-radius: 10px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; position: relative;">
                                <i class="fas fa-building" style="color: #cbd5e1; font-size: 24px;"></i>
                                ${m.unidades_garagens ? `<span style="position: absolute; bottom: 4px; right: 4px; background: white; font-size: 8px; font-weight: 800; padding: 2px 4px; border-radius: 4px; border: 1px solid #e2e8f0;">🚗 ${m.unidades_garagens}</span>` : ''}
                            </div>
                            <div style="flex: 1; min-width: 0;">
                                <div style="font-size: 13px; font-weight: 800; color: #1e293b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${m.lotes.building_name || m.logradouro}</div>
                                <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${m.tipo} • ${m.complemento || 'Unidade ' + m.inscricao.slice(-3)}</div>
                                <div style="font-size: 14px; font-weight: 900; color: #059669; margin-top: 6px;">R$ ${(m.valor/1000).toFixed(0)}k</div>
                            </div>
                        </div>
                        <div style="display: flex; gap: 6px; border-top: 1px solid #f1f5f9; pt-10;">
                            <button onclick="window.openScheduleVisit('${leadId}', '${m.inscricao}')" style="flex: 1; padding: 8px; background: #2563eb; color: white; border: none; border-radius: 8px; font-size: 10px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px;">
                                <i class="fas fa-calendar-check"></i> Marcar Visita
                            </button>
                            <button onclick="window.flyToUnlocked('${m.lote_inscricao}')" style="padding: 8px 12px; background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 10px; cursor: pointer;">
                                <i class="fas fa-map-marker-alt"></i> Ver no Mapa
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

    } catch (e) {
        console.error(e);
        container.innerHTML = '<p>Erro ao buscar matches.</p>';
    }
};

// ========================================
// VISIT SCHEDULING
// ========================================
window.openScheduleVisit = function(leadId, unitInscricao) {
    const modal = document.createElement('div');
    modal.className = 'custom-modal-overlay active';
    modal.style.zIndex = '10020';
    modal.innerHTML = `
        <div class="custom-modal" style="max-width: 400px;">
            <div class="custom-modal-header" style="background: #2563eb; color: white;">
                <div class="custom-modal-title">📅 Agendar Visita</div>
                <button class="custom-modal-close" onclick="this.closest('.custom-modal-overlay').remove()">&times;</button>
            </div>
            <div class="custom-modal-body" style="padding: 25px;">
                <div class="lead-form-field" style="margin-bottom: 15px;">
                    <label>Data e Hora</label>
                    <input type="datetime-local" id="visit-date" style="width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 10px;">
                </div>
                <div class="lead-form-field">
                    <label>Observações / Feedback Prévio</label>
                    <textarea id="visit-obs" placeholder="Algum detalhe importante para a visita?" style="width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 10px; min-height: 80px;"></textarea>
                </div>
                <button id="btnSaveVisit" class="btn-primary-rich" style="width: 100%; padding: 15px; background: #2563eb; margin-top: 20px;">
                    Confirmar Agendamento
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('#btnSaveVisit').onclick = async () => {
        const date = modal.querySelector('#visit-date').value;
        const obs = modal.querySelector('#visit-obs').value;
        if (!date) { window.Toast.warning("Escolha uma data."); return; }

        window.Loading.show("Agendando...");
        try {
            const { data: { user } } = await window.supabaseApp.auth.getUser();
            const { error } = await window.supabaseApp.from('visitas').insert({
                lead_id: leadId,
                unidade_inscricao: unitInscricao,
                data_visita: date,
                feedback_cliente: obs,
                user_id: user.id
            });

            if (error) throw error;

            // Log de atividade automático
            await window.supabaseApp.from('crm_atividades').insert({
                lead_id: leadId,
                conteudo: `🚨 Visita agendada para o imóvel ${unitInscricao} em ${new Date(date).toLocaleString()}`,
                tipo: 'visita'
            });

            window.Toast.success("Visita agendada com sucesso!");
            modal.remove();
            if (window.currentOpenLeadId === leadId) window.loadLeadActivities(leadId);
        } catch (e) {
            console.error(e);
            window.Toast.error("Erro ao agendar visita.");
        } finally {
            window.Loading.hide();
        }
    };
};

// Keep showLeadsPanel as a compatibility or "Full View" option
window.showLeadsPanel = async function () {
    window.Loading.show('Carregando clientes e patrimônios...');

    try {
        const { data: leads, error } = await window.supabaseApp
            .from('leads')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // --- ENRIQUECIMENTO DE LEADS COM DADOS DE PATRIMÔNIO ---
        // Para cada lead, vamos verificar se ele possui propriedades no mapa
        const leadsWithPortfolio = await Promise.all(leads.map(async (lead) => {
            if (lead.cpf_cnpj) {
                const { count } = await window.supabaseApp
                    .from('unidades')
                    .select('*', { count: 'exact', head: true })
                    .eq('cpf_cnpj', lead.cpf_cnpj);
                
                lead.total_propriedades = count || 0;
            } else {
                // Tentativa por nome se CPF não existir (Unificação por Nome)
                const { count } = await window.supabaseApp
                    .from('unidades')
                    .select('*', { count: 'exact', head: true })
                    .ilike('nome_proprietario', lead.nome);
                
                lead.total_propriedades = count || 0;
            }
            return lead;
        }));

        renderLeadsPanel(leadsWithPortfolio);
    } catch (e) {
        console.error('Error loading leads:', e);
        window.Toast.error('Erro ao carregar clientes');
    } finally {
        window.Loading.hide();
    }
};

function renderLeadsPanel(leads) {
    const existing = document.getElementById('leadsPanel');
    if (existing) existing.remove();

    const panel = document.createElement('div');
    panel.className = 'leads-panel';
    panel.id = 'leadsPanel';

    panel.innerHTML = `
        <div class="leads-panel-header">
            <h3>👥 Gestão Unificada de Clientes (${leads.length})</h3>
            <button class="lead-tooltip-close" onclick="window.closeLeadsPanel()">×</button>
        </div>
        <div class="leads-panel-search">
            <input type="text" id="leadsSearchInput" placeholder="🔍 Buscar por nome, telefone ou patrimônio...">
        </div>
        <div class="leads-panel-body" id="leadsPanelBody">
            ${leads.length === 0 ?
            '<div style="padding: 40px; text-align: center; color: #999;">Nenhum cliente cadastrado.</div>' :
            leads.map(lead => createLeadCard(lead)).join('')
        }
        </div>
    `;

    document.body.appendChild(panel);

    const backdrop = document.createElement('div');
    backdrop.className = 'sidebar-backdrop active';
    backdrop.style.zIndex = '9999';
    backdrop.onclick = window.closeLeadsPanel;
    document.body.appendChild(backdrop);
    panel.backdrop = backdrop;

    const searchInput = document.getElementById('leadsSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const filtered = leads.filter(lead =>
                lead.nome.toLowerCase().includes(query) ||
                (lead.telefone && lead.telefone.includes(query)) ||
                (lead.email && lead.email.toLowerCase().includes(query))
            );
            document.getElementById('leadsPanelBody').innerHTML =
                filtered.map(lead => createLeadCard(lead)).join('');
        });
    }
}

function createLeadCard(lead) {
    const zonas = lead.zonas_interesse && lead.zonas_interesse.length > 0
        ? `Zonas ${lead.zonas_interesse.join(', ')}`
        : 'Qualquer zona';

    const valor = lead.valor_max
        ? `Até R$ ${(lead.valor_max).toLocaleString('pt-BR')}`
        : '';

    // Badge de Patrimônio Unificado
    const portfolioBadge = lead.total_propriedades > 0 
        ? `<div class="portfolio-badge" onclick="window.viewPortfolio('${lead.cpf_cnpj || lead.nome}')" title="Clique para ver patrimônio no mapa">
            <i class="fas fa-building"></i> <b>${lead.total_propriedades}</b> Propriedade(s) no Guarujá
           </div>`
        : '';

    const heatLevel = Math.random();
    let heatTag = '';
    if (heatLevel > 0.7) heatTag = '<span class="heat-tag hot">🔥 QUENTE</span>';
    else if (heatLevel > 0.3) heatTag = '<span class="heat-tag warm">⚡ MORNO</span>';
    else heatTag = '<span class="heat-tag cold">🧊 FRIO</span>';

    return `
        <div class="lead-card">
            <div class="lead-card-header">
                <h4 class="lead-card-name">👤 ${lead.nome}</h4>
                <div style="display: flex; gap: 4px; align-items: center;">
                    ${heatTag}
                    ${lead.status === 'inativo' ? '<span class="status-inactive">Inativo</span>' : ''}
                </div>
            </div>
            ${portfolioBadge}
            ${lead.telefone ? `<div class="lead-card-contact">📞 ${lead.telefone}</div>` : ''}
            ${lead.email ? `<div class="lead-card-contact">📧 ${lead.email}</div>` : ''}
            <div class="lead-card-criteria">
                🎯 ${zonas} ${lead.tipo_imovel ? ` • ${lead.tipo_imovel}` : ''}
                ${valor ? `<br>💰 ${valor}` : ''}
            </div>
            <div class="lead-card-actions">
                <button class="lead-card-btn edit" onclick="window.editLead('${lead.id}')" title="Editar">✏️</button>
                <button class="lead-card-btn matches" onclick="window.findMatches('${lead.id}')" title="Buscar Oportunidades">🔍 Buscar Matches</button>
                <button class="lead-card-btn ia-boost" onclick="window.generateFollowup('${lead.id}')" title="Roteiro IA">🚀 IA</button>
                ${lead.telefone ? `<button class="lead-card-btn whatsapp" onclick="window.openWhatsApp('${lead.telefone}', '${lead.nome}')" title="Falar no WhatsApp">💬 Zap</button>` : ''}
                <button class="lead-card-btn delete" onclick="window.deleteLead('${lead.id}')" title="Excluir">🗑️</button>
            </div>
        </div>
    `;
}

// ========================================
// OPEN WHATSAPP
// ========================================
window.openWhatsApp = function (phone, nome) {
    if (!phone) {
        if (window.Toast) window.Toast.warning("Cliente não possui telefone cadastrado.");
        return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    const message = encodeURIComponent(`Olá ${nome}, encontrei algumas oportunidades de imóveis que cruzam exatamente com o que você procura!`);
    window.open(`https://wa.me/55${cleanPhone}?text=${message}`, '_blank');
};

// ========================================
// CLOSE LEADS PANEL
// ========================================
window.closeLeadsPanel = function () {
    const panel = document.getElementById('leadsPanel');
    if (panel) {
        if (panel.backdrop) panel.backdrop.remove();
        panel.remove();
    }
};

// ========================================
// FIND MATCHES FOR LEAD
// ========================================
window.findMatches = async function (leadId) {
    window.Loading.show('Procurando imóveis compatíveis...');

    try {
        const { data: lead, error: leadError } = await window.supabaseApp
            .from('leads')
            .select('*')
            .eq('id', leadId)
            .single();

        if (leadError) throw leadError;

        let query = window.supabaseApp
            .from('unidades')
            .select('*, lotes(*)');

        if (lead.zonas_interesse && lead.zonas_interesse.length > 0) {
            query = window.supabaseApp.from('unidades').select('*, lotes!inner(*)').in('lotes.zona', lead.zonas_interesse);
        } else {
            // Re-select if zone filter wasn't used to get lotes join usually
            query = window.supabaseApp.from('unidades').select('*, lotes(*)');
        }

        if (lead.tipo_imovel) query = query.eq('tipo', lead.tipo_imovel);
        if (lead.quartos_min) query = query.gte('quartos', lead.quartos_min);
        if (lead.quartos_max) query = query.lte('quartos', lead.quartos_max);
        if (lead.metragem_min) query = query.gte('metragem', lead.metragem_min);
        if (lead.metragem_max) query = query.lte('metragem', lead.metragem_max);
        if (lead.valor_min) query = query.gte('valor', lead.valor_min);
        if (lead.valor_max) query = query.lte('valor', lead.valor_max);

        const { data: matches, error } = await query;

        if (error) throw error;

        if (!matches || matches.length === 0) {
            window.Toast.info('Nenhum imóvel compatível encontrado');
            return;
        }

        window.closeLeadsPanel();

        const results = matches.map(unit => ({
            type: 'unit',
            lote_inscricao: unit.lote_inscricao,
            label: unit.inscricao,
            sub: unit.endereco_completo || '',
            inscricao: unit.inscricao,
            isUnit: true
        }));

        if (window.displaySearchResults) {
            window.displaySearchResults(results);
        }

        window.Toast.success(`${matches.length} imóvel(is) compatível(is) encontrado(s)!`);
    } catch (e) {
        console.error('Error finding matches:', e);
        window.Toast.error('Erro ao buscar matches: ' + e.message);
    } finally {
        window.Loading.hide();
    }
};

// ========================================
// DELETE LEAD
// ========================================
window.deleteLead = async function (leadId) {
    if (!confirm('Tem certeza que deseja excluir este cliente?')) return;

    window.Loading.show('Excluindo...');
    try {
        const { error } = await window.supabaseApp
            .from('leads')
            .delete()
            .eq('id', leadId);

        if (error) throw error;

        window.Toast.success('Cliente excluído com sucesso!');
        await updateLeadsCount();
        window.closeLeadsPanel();
        window.showLeadsPanel();
    } catch (e) {
        console.error('Error deleting lead:', e);
        window.Toast.error('Erro ao excluir cliente');
    } finally {
        window.Loading.hide();
    }
};

// ========================================
// EDIT LEAD TRIGGER
// ========================================
window.editLead = function (leadId) {
    window.closeLeadsPanel();
    window.openAddLeadTooltip(leadId); // Reuse the add modal logic
};

// ========================================
// AI INTEGRATION: SAVE LEAD FROM FAROL
// ========================================
// AI Lead Capture logic removed per user plan

window.generateFollowup = async function (leadId) {
    window.Loading.show(`🚀 Preparando Follow-up...`, `O Farol está analisando o melhor roteiro...`);

    try {
        const { data: lead } = await window.supabaseApp.from('leads').select('*').eq('id', leadId).single();
        if (!lead) return;

        const prompt = `Como seu Farol (Assistente de Relacionamento da Omega Imóveis), crie um roteiro de "Follow-up" persuasivo para este cliente:
        - Nome: ${lead.nome}
        - Interesse: ${lead.tipo_imovel || 'Imóvel'} em ${lead.zonas_interesse?.[0] || 'Guarujá'}
        - Status Atual: ${lead.status || 'Morno'}
        - Últimas Notas: ${lead.observacoes || 'Sem notas recentes'}
        
        Sua tarefa:
        1. Crie uma mensagem curta de WhatsApp para "reaquecer" o contato.
        2. Dê uma sugestão técnica de "Próximo Passo" para o corretor (ex: agendar visita, enviar planilha de custos).
        
        Mantenha o tom profissional e focado em avançar no funil de vendas.`;

        if (!window.Farol) {
            window.Toast.error("IA do Farol não inicializada.");
            return;
        }

        const result = await window.Farol.ask(prompt);

        const followupModal = document.createElement('div');
        followupModal.className = 'custom-modal-overlay active';
        followupModal.style.zIndex = '10001';
        followupModal.innerHTML = `
            <div class="custom-modal" style="max-width: 450px;">
                <div class="custom-modal-header" style="background: #6366f1; color: white;">
                    <div class="custom-modal-title">🚀 Farol CRM: Estratégia de Follow-up</div>
                    <button class="custom-modal-close" onclick="this.closest('.custom-modal-overlay').remove()">&times;</button>
                </div>
                <div class="custom-modal-body" style="padding: 25px; line-height: 1.6; font-size: 14px; color: #334155;">
                    <div style="background: #eef2ff; border-left: 5px solid #6366f1; padding: 15px; border-radius: 8px;">
                        ${result.replace(/\n/g, '<br>')}
                    </div>
                </div>
                <div class="modal-actions" style="padding: 20px; border-top: 1px solid #eee; display: flex; justify-content: center; gap: 10px;">
                    <button class="btn-ghost" onclick="this.closest('.custom-modal-overlay').remove()">Recuar</button>
                    <button class="btn-primary-rich" style="background: #6366f1;" onclick="window.copyToClipboard('${result.replace(/'/g, "\\\\'").replace(/\n/g, ' ')}')">📋 Copiar Roteiro</button>
                </div>
            </div>
        `;
        document.body.appendChild(followupModal);

    } catch (e) {
        console.error(e);
        window.Toast.error("Erro ao gerar follow-up.");
    } finally {
        window.Loading.hide();
    }
};

console.log("✅ CRM Handler module loaded");
