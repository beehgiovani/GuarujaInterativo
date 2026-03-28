// ==========================================
// MONETIZATION HANDLER - MONETIZATION_HANDLER.JS
// ==========================================
// Manages credits, subscriptions, and Pix payments

window.Monetization = {
    userProfile: null,
    userRole: 'user',
    unlockedLots: new Set(),
    unlockedPersons: new Set(), // Persistent set for CPFs/CNPJs unlocked by this user
    pixConfig: null,
    plansConfig: null, // Dynamic configuration from app_settings

    // Early declaration to avoid racing
    isUnlockedPerson: function(cpf_cnpj) {
        if (this.userRole === 'admin' || this.userRole === 'master') return true;
        if (!cpf_cnpj) return false;
        const clean = String(cpf_cnpj).replace(/\D/g, '');
        return this.unlockedPersons.has(clean);
    },

    init: async function() {
        console.log("💰 Monetization Handler Initializing...");
        await this.loadUserProfile();
        await this.loadUnlocks();
        await this.loadPixConfig();
        await this.loadPlansConfig();
        this.updateBalanceUI();
        
        // Dispatch event for other handlers to know tiers are ready
        window.dispatchEvent(new CustomEvent('monetizationReady', { detail: { role: this.userRole } }));
    },

    canAccess: function(feature) {
        const role = String(this.userRole || 'user').toLowerCase();
        const isMaster = role === 'admin' || role === 'master';
        const isVip = role === 'vip' || isMaster;
        const isElite = role === 'elite' || isVip;
        const isPro = role === 'pro' || isElite;

        if (window.isGuest) return false;
        
        switch (feature) {
            case 'radar_mercado': return isPro; // Radar Farol (básico)
            case 'search_owner': return isPro;  // Busca por proprietário
            case 'crm_history': return isPro;   // CRM pessoal
            case 'advanced_ai': return isElite; // Radar Farol completo
            case 'dossier_pdf': 
            case 'pdf_dossier': return isElite; // Dossiê PDF automático
            case 'search_opportunity': return isElite; // Alertas de oportunidade
            case 'regional_insights': return isElite; // Relatórios avançados
            case 'mapear_patrimonio': return isElite;
            case 'link_cliente': return isPro;
            case 'marketing_tools': return isPro;
            case 'owner_history': return isElite;
            case 'edit_private': return isPro;
            default: return true;
        }
    },

    // Alias for backward compatibility
    checkFeatureAccess: function(feature) {
        return this.canAccess(feature);
    },

    loadPixConfig: async function() {
        try {
            const { data } = await window.supabaseApp.from('app_settings').select('value').eq('key', 'pix_config').maybeSingle();
            if (data && data.value) {
                this.pixConfig = data.value;
            }
        } catch (e) { console.error("Error loading pix config:", e); }
    },

    loadPlansConfig: async function() {
        try {
            const { data } = await window.supabaseApp.from('app_settings').select('value').eq('key', 'plans_config').maybeSingle();
            if (data && data.value) {
                this.plansConfig = data.value;
                console.log("💰 Plans Configuration Loaded:", this.plansConfig);
            }
        } catch (e) { console.error("Error loading plans config:", e); }
    },

    loadUserProfile: async function() {
        if (window.isGuest) {
            this.userProfile = { credits: 0, role: 'guest', full_name: 'Visitante' };
            this.userRole = 'guest';
            console.log("👤 User Role: GUEST (Visitor Mode)");
            return;
        }

        try {
            const { data: { user } } = await window.supabaseApp.auth.getUser();
            if (!user) return;

            const { data, error } = await window.supabaseApp
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (error) throw error;
            this.userProfile = data;
            this.userRole = String(data.role || 'user').toLowerCase();
            console.log("👤 User Role Loaded:", this.userRole);

            // Verificação de Perfil Completo (Garante CPF/CNPJ e agora Telefone)
            const isMissingData = !data.profile_completed || !data.phone;
            if (isMissingData && this.userRole !== 'admin' && this.userRole !== 'master') {
                console.log("⚠️ Perfil incompleto detectado. Solicitando dados...");
                setTimeout(() => this.showProfileCompletionModal(), 2000);
            }

            const isMaster = this.userRole === 'admin' || this.userRole === 'master';
            const isPro = this.canAccess('radar_mercado');

            // Mostrar botão Admin para masters
            const adminBtn = document.getElementById('btnAdminPanel');
            if (adminBtn) adminBtn.style.display = isMaster ? 'flex' : 'none';

            // Desbloquear chips conforme tier
            document.querySelectorAll('.filter-chip.master-only').forEach(el => {
                const searchType = el.dataset.searchType;
                let hasAccess = false;

                if (isMaster) hasAccess = true;
                else if (isPro) {
                    // Pro+ can access most advanced searches
                    hasAccess = ['opportunity', 'owner', 'property', 'all'].includes(searchType);
                }

                if (hasAccess) {
                    el.classList.remove('locked');
                    el.style.removeProperty('border-style');
                    el.style.removeProperty('background');
                    el.style.removeProperty('color');
                    const lockIcon = el.querySelector('.lock-icon');
                    if (lockIcon) lockIcon.remove();
                    // Some elements might have a specific click disabled or changed
                    if (el.getAttribute('onclick')?.includes('showSubscriptionPlans')) {
                        el.removeAttribute('onclick');
                    }
                }
            });

            // Renderizar widget de plano
            this.renderPlanWidget();

        } catch (e) {
            console.error("Error loading user profile:", e);
            if (!this.userProfile) {
                this.userProfile = { credits: 0, role: 'user' };
            }
        }
    },

    generatePixPayload: function(refLabel, price) {
        const config = this.pixConfig || { tipo: 'celular', chave: '39683283888', nome_beneficiario: 'BRUNO GIOVANI', cidade: 'GUARUJA' };
        
        // Função auxiliar para formatar campos [ID][TAMANHO][VALOR]
        // Usa TextEncoder para garantir que o tamanho seja em BYTES (Requisito EMV)
        const encoder = new TextEncoder();
        const f = (id, val) => {
            const v = String(val);
            const vBytes = encoder.encode(v);
            return id.toString().padStart(2, '0') + vBytes.length.toString().padStart(2, '0') + v;
        };

        // 00: Payload Format Indicator (Obrigatório)
        const payloadFormat = f(0, "01");
        
        // 01: Point of Initiation Method (11 = Estático, 12 = Dinâmico)
        const initiationMethod = f(1, "11");

        // 26: Merchant Account Information
        const gui = f(0, "BR.GOV.BCB.PIX");
        const key = f(1, config.chave.replace(/[^0-9a-zA-Z]/g, ''));
        const merchantAccount = f(26, gui + key);

        // Campos obrigatórios
        const mcc = f(52, "0000");   
        const currency = f(53, "986"); 
        const amount = f(54, price.toFixed(2)); 
        const country = f(58, "BR"); 
        
        // Normalização rigorosa (Apenas ASCII)
        const normalize = (str) => {
            return str.normalize('NFD')
                .replace(/[\u0300-\u036f]/g, "")
                .toUpperCase()
                .replace(/[^A-Z0-9 ]/g, "")
                .substring(0, 25);
        };

        const name = f(59, normalize(config.nome_beneficiario));
        const city = f(60, normalize(config.cidade).substring(0, 15));

        // 62: TXID (Para Pix Estático '***' é o mais compatível)
        const txid = f(5, "***"); 
        const additionalData = f(62, txid);

        let payload = payloadFormat + initiationMethod + merchantAccount + mcc + currency + amount + country + name + city + additionalData + "6304";

        // Cálculo do CRC16 CCITT-FALSE
        let crc = 0xFFFF;
        const payloadBytes = encoder.encode(payload);
        for (let i = 0; i < payloadBytes.length; i++) {
            crc ^= (payloadBytes[i] << 8);
            for (let j = 0; j < 8; j++) {
                if (crc & 0x8000) crc = (crc << 1) ^ 0x1021;
                else crc = (crc << 1);
                crc &= 0xFFFF;
            }
        }
        const crcHex = crc.toString(16).toUpperCase().padStart(4, '0');
        return payload + crcHex;
    },

    showProfileCompletionModal: function() {
        // Evitar duplicatas
        document.getElementById('profile-completion-modal')?.remove();

        const modal = document.createElement('div');
        modal.className = 'custom-modal-overlay active';
        modal.id = 'profile-completion-modal';
        modal.style.zIndex = '10025';
        
        modal.innerHTML = `
            <div class="custom-modal" style="max-width: 450px; text-align: left; background: white; border-radius: 16px; overflow: hidden;">
                <div class="custom-modal-header" style="background: #0f172a; color: white; padding: 20px;">
                    <div class="custom-modal-title" style="font-size: 18px; font-weight: 700;">
                        <i class="fas fa-user-edit"></i> Complete seu Perfil
                    </div>
                </div>
                <div class="custom-modal-body" style="padding: 30px;">
                    <p style="color: #475569; font-size: 14px; margin-bottom: 25px;">
                        Para garantir a segurança das informações e personalizar suas mensagens automáticas, precisamos de alguns dados adicionais.
                    </p>

                    <form id="profile-complete-form">
                        <div style="margin-bottom: 20px;">
                            <label style="display: block; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 8px;">Tipo de Usuário</label>
                            <div style="display: flex; gap: 10px;">
                                <button type="button" class="type-btn active" data-type="PF" style="flex: 1; min-height: 44px; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: white; font-weight: 700; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Pessoa Física</button>
                                <button type="button" class="type-btn" data-type="PJ" style="flex: 1; min-height: 44px; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: white; font-weight: 700; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Pessoa Jurídica</button>
                            </div>
                            <input type="hidden" id="p-person-type" value="PF">
                        </div>

                        <div style="margin-bottom: 20px;">
                            <label style="display: block; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 8px;" id="doc-label">CPF</label>
                            <input type="text" id="p-document" placeholder="000.000.000-00" style="width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px;">
                        </div>

                        <div style="margin-bottom: 20px;">
                            <label style="display: block; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 8px;">WhatsApp (Celular)</label>
                            <input type="text" id="p-phone" value="${this.userProfile?.phone || ''}" placeholder="(13) 90000-0000" style="width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px;">
                        </div>

                        <div style="margin-bottom: 25px;">
                            <label style="display: block; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 8px;">Nome do Corretor / Imobiliária</label>
                            <input type="text" id="p-broker" value="${this.userProfile?.broker_name || ''}" placeholder="Ex: João Silva ou Imobiliária Guarujá" style="width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px;">
                            <small style="color: #94a3b8; font-size: 10px;">Este nome será usado em suas mensagens aos clientes.</small>
                        </div>

                        <button type="button" onclick="window.Monetization.saveProfileCompletion()" style="width: 100%; padding: 15px; background: #2563eb; color: white; border: none; border-radius: 12px; font-weight: 800; font-size: 14px; cursor: pointer; transition: all 0.2s;">
                            SALVAR E CONTINUAR
                        </button>
                    </form>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Lógica de alternância PF/PJ
        const btns = modal.querySelectorAll('.type-btn');
        btns.forEach(btn => {
            btn.onclick = () => {
                console.log('🔄 Alternando para tipo:', btn.dataset.type);
                btns.forEach(b => {
                    b.classList.remove('active');
                    b.style.borderColor = '#cbd5e1';
                    b.style.background = '#f8fafc';
                    b.style.color = '#64748b';
                    b.style.boxShadow = 'none';
                });
                btn.classList.add('active');
                btn.style.borderColor = '#2563eb';
                btn.style.background = '#2563eb';
                btn.style.color = '#ffffff';
                btn.style.boxShadow = '0 4px 6px -1px rgba(37, 99, 235, 0.2)';
                
                const type = btn.dataset.type;
                modal.querySelector('#p-person-type').value = type;
                modal.querySelector('#doc-label').innerText = type === 'PF' ? 'CPF' : 'CNPJ';
                modal.querySelector('#p-document').placeholder = type === 'PF' ? '000.000.000-00' : '00.000.000/0000-00';
                
                // Limpar campo se mudar tipo para evitar validação errada
                modal.querySelector('#p-document').value = '';
            };
        });
        
        // Ativar o primeiro por padrão com um pequeno delay para garantir renderização
        setTimeout(() => {
            if (btns[0]) btns[0].click();
        }, 100);
    },

    saveProfileCompletion: async function() {
        const personType = document.getElementById('p-person-type').value;
        const documentRaw = document.getElementById('p-document').value;
        const brokerName = document.getElementById('p-broker').value;
        const phone = document.getElementById('p-phone').value;

        // Limpa documento para validar apenas números
        const documentVal = documentRaw.replace(/\D/g, '');

        if (!documentVal || (personType === 'PF' && documentVal.length !== 11) || (personType === 'PJ' && documentVal.length !== 14)) {
            window.Toast.warning(`Preencha o ${personType === 'PF' ? 'CPF' : 'CNPJ'} corretamente.`);
            return;
        }
        if (!brokerName || brokerName.length < 3) {
            window.Toast.warning("Preencha o nome do corretor responsável.");
            return;
        }
        if (!phone || phone.length < 8) {
            window.Toast.warning("Preencha o seu WhatsApp corretamente.");
            return;
        }

        window.Loading.show("Salvando...", "Atualizando seu perfil");

        try {
            const { data: { user } } = await window.supabaseApp.auth.getUser();
            const { error } = await window.supabaseApp
                .from('profiles')
                .update({
                    person_type: personType,
                    cpf_cnpj: documentVal,
                    broker_name: brokerName,
                    phone: phone,
                    profile_completed: true
                })
                .eq('id', user.id);

            if (error) throw error;

            window.Loading.hide();
            window.Toast.success("Perfil atualizado com sucesso!");
            document.getElementById('profile-completion-modal').remove();
            
            // Recarregar perfil na memória
            if (this.userProfile) {
                this.userProfile.person_type = personType;
                this.userProfile.cpf_cnpj = documentVal;
                this.userProfile.broker_name = brokerName;
                this.userProfile.profile_completed = true;
            }

        } catch (e) {
            window.Loading.hide();
            console.error("Save Profile Error:", e);
            window.Toast.error("Erro ao salvar perfil: " + e.message);
        }
    },

    // Limites mensais por tier (calculados para ROI > 2x com custo de R$ 2.00/ficha)
    getTierLimits: function() {
        // Fallback hardcoded values (same as before)
        const defaultLimits = { user: 0, pro: 30, elite: 80, vip: 110, master: 10000, admin: Infinity };
        const defaultLabels = { user: 'Gratuito', pro: 'Pro', elite: 'Elite', vip: 'Anual VIP', master: 'Master', admin: 'Master' };
        
        const role = this.userRole || 'user';
        
        // Use dynamic config if available
        let limit = defaultLimits[role] ?? 0;
        let label = defaultLabels[role] ?? 'Gratuito';
        
        if (this.plansConfig && this.plansConfig[role]) {
            limit = this.plansConfig[role].credits ?? limit;
            label = this.plansConfig[role].name ?? label;
        }

        const colors = { user: '#64748b', pro: '#2563eb', elite: '#7c3aed', vip: '#1e293b', master: '#b45309', admin: '#b45309' };
        
        return {
            limit: limit,
            label: label,
            color: colors[role] ?? '#64748b'
        };
    },

    // Renderiza o widget de plano na barra de créditos
    renderPlanWidget: function() {
        const el = document.getElementById('user-credits-display');
        if (!el) return;

        const { limit, label, color } = this.getTierLimits();
        const credits = this.userProfile?.credits || 0;
        const used = this.userProfile?.monthly_unlocks_used || 0;
        const isFree = this.userRole === 'user';
        const isUnlimited = limit === Infinity;
        const isGuest = window.isGuest;

        if (isGuest) {
            el.innerHTML = `
                <span style="background: #64748b18; border: 1px solid #64748b40; border-radius: 20px; padding: 4px 10px; font-size: 11px; font-weight: 800; color: #64748b;">
                    👤 Visitante
                </span>
            `;
            return;
        }

        const usageStr = (!isUnlimited && !isFree) ? `<span style="opacity: 0.7; font-size: 9px; margin-left: 4px;">(${used}/${limit})</span>` : '';
        const tooltip = isUnlimited ? `Plano ${label} • Ilimitado` : 
                        isFree ? `Plano ${label} • Use créditos para desbloquear` : 
                        `Plano ${label} • ${used} de ${limit} fichas mensais usadas. Após o limite, usa seus créditos.`;

        el.onclick = () => window.Monetization.showSubscriptionPlans();
        el.title = tooltip;
        el.innerHTML = `
            <span style="
                display: inline-flex; align-items: center; gap: 5px;
                background: ${color}18; border: 1px solid ${color}40;
                border-radius: 20px; padding: 4px 10px;
                font-size: 11px; font-weight: 800; color: ${color};
                cursor: pointer; transition: all 0.2s;
            " onmouseover="this.style.background='${color}28'" onmouseout="this.style.background='${color}18'">
                ${isUnlimited ? '👑' : isFree ? '🔐' : '⭐'}
                ${label} ${usageStr}
            </span>
            <span style="font-size: 11px; font-weight: 700; color: #1e293b; display: flex; align-items: center; gap: 3px;" title="Saldo de Créditos (Fichas Extras)">
                <i class="fas fa-coins" style="color: #f59e0b; font-size: 10px;"></i>
                ${credits}
            </span>
        `;
    },

    loadUnlocks: async function() {
        try {
            const { data: { user } } = await window.supabaseApp.auth.getUser();
            if (!user) return;

            // 1. Load unlocked LOTS (Credits, Plan, Edits)
            const { data: lotUnlocks, error: lotError } = await window.supabaseApp.from('unlocked_lots').select('lote_inscricao, unidade_inscricao').eq('user_id', user.id);
            const { data: edits } = await window.supabaseApp.from('user_lote_edits').select('lote_inscricao').eq('user_id', user.id);
            const { data: unitEdits } = await window.supabaseApp.from('user_unit_edits').select('unit_inscricao').eq('user_id', user.id);

            const clean = (id) => id ? String(id).replace(/\D/g, '') : '';
            this.unlockedLots = new Set();
            
            // Combine all unlocks into a single array for processing
            const allUnlocks = [
                ...(lotUnlocks || []).map(row => ({ lote_inscricao: row.lote_inscricao, unidade_inscricao: row.unidade_inscricao })),
                ...(edits || []).map(row => ({ lote_inscricao: row.lote_inscricao, unidade_inscricao: null })),
                ...(unitEdits || []).map(row => ({ lote_inscricao: clean(row.unit_inscricao).substring(0,8), unidade_inscricao: row.unit_inscricao }))
            ];

            allUnlocks.forEach(item => {
                // Se unidade_inscricao for nula no banco, item.lote_inscricao é o que vale (Lote Inteiro)
                // Se unidade_inscricao existir, salvamos apenas a unidade.
                if (item.unidade_inscricao) {
                    this.unlockedLots.add(clean(item.unidade_inscricao));
                } else {
                    this.unlockedLots.add(clean(item.lote_inscricao));
                }
            });

            // 2. Load unlocked PERSONS (CPF/CNPJ)
            const { data: personUnlocks, error: personError } = await window.supabaseApp
                .from('unlocked_persons')
                .select('cpf_cnpj')
                .eq('user_id', user.id);

            if (!personError && personUnlocks) {
                this.unlockedPersons = new Set(personUnlocks.map(u => clean(u.cpf_cnpj)));
                console.log(`👤 ${this.unlockedPersons.size} proprietários desbloqueados carregados.`);
            } else if (personError) {
                console.warn("⚠️ Tabela 'unlocked_persons' não encontrada ou erro. Ignorando por enquanto.");
            }

            console.log(`🔑 Carteira sincronizada: ${this.unlockedLots.size} lotes.`);
            
            if (window.renderHierarchy) window.renderHierarchy();
        } catch (e) {
            console.error("Error loading unlocks:", e);
        }
    },

    isUnlocked: function(id) {
        if (!id) return true;
        
        const role = String(this.userRole || '').toLowerCase();
        if (role === 'master' || role === 'admin') return true;

        const clean = (val) => String(val).replace(/\D/g, '');
        const cleanId = clean(id);
        
        // Atencão: 
        // 1. Se o set tem o Lote Inteiro (8 dig), está liberado.
        // 2. Se o set tem a Unidade específica (11 dig), está liberado.
        // 3. Se o ID é uma unidade (11 digitos) e o lote inteiro (8 digitos) está liberado, a unidade também está.
        const lotePrefix = cleanId.substring(0, 8);
        return this.unlockedLots.has(cleanId) || (cleanId.length >= 11 && this.unlockedLots.has(lotePrefix));
    },

    isEliteOrAbove: function() {
        const role = String(this.userRole || 'user').toLowerCase();
        return ['admin', 'master', 'elite'].includes(role);
    },

    promptUnlockLote: function(loteInscricao, unitId, price = 1) {
        console.warn("💎 [Monetization] promptUnlockLote Granular!", { loteInscricao, unitId, price });
        const targetId = unitId || loteInscricao;
        
        if (this.isUnlocked(targetId)) {
            console.log("✅ Já está desbloqueado.");
            return true;
        }
        
        const isUnitQuery = unitId && String(unitId).replace(/\D/g, '').length >= 11;
        const modal = document.createElement('div');
        modal.className = 'custom-modal-overlay active';
        modal.style.zIndex = '10020';
        
        let subContent = '';
        if (isUnitQuery) {
            subContent = `
                <p style="color: #475569; font-size: 13px; margin-bottom: 20px;">Escolha o nível de acesso desejado:</p>
                <div style="display: grid; gap: 12px; margin-bottom: 20px;">
                    <button id="btnUnlockUnit" class="btn-primary-rich" style="padding: 16px; background: #10b981; border: none; border-radius: 12px; text-align: left; position: relative; overflow: hidden; cursor: pointer;">
                        <div style="font-weight: 800; font-size: 15px; color: white;">Apenas esta Unidade</div>
                        <div style="font-size: 12px; color: rgba(255,255,255,0.9);">Custo: 1 Crédito</div>
                        <i class="fas fa-home" style="position: absolute; right: 15px; top: 50%; transform: translateY(-50%); font-size: 28px; opacity: 0.2; color: white;"></i>
                    </button>
                    <button id="btnUnlockLot" class="btn-primary-rich" style="padding: 16px; background: #1e293b; border: none; border-radius: 12px; text-align: left; position: relative; overflow: hidden; cursor: pointer;">
                        <div style="font-weight: 800; font-size: 15px; color: white;">Prédio Inteiro (Todas as Unidades)</div>
                        <div style="font-size: 12px; color: rgba(255,255,255,0.9);">Custo: 5 Créditos</div>
                        <i class="fas fa-building" style="position: absolute; right: 15px; top: 50%; transform: translateY(-50%); font-size: 28px; opacity: 0.2; color: white;"></i>
                    </button>
                </div>
            `;
        } else {
            subContent = `
                <p style="color: #475569; font-size: 14px; margin-bottom: 20px;">Deseja desbloquear o acesso total a todas as unidades deste prédio?</p>
                <div style="font-size: 24px; font-weight: 800; color: #1e293b; margin-bottom: 25px;">5 Créditos</div>
                <button id="btnUnlockLotOnly" class="btn-primary-rich" style="width: 100%; padding: 15px; background: #1e293b; color: white; border: none; border-radius: 8px; font-weight: 800; cursor: pointer;">
                    <i class="fas fa-unlock"></i> Desbloquear Tudo
                </button>
            `;
        }

        modal.innerHTML = `
            <div class="custom-modal" style="max-width: 450px; text-align: center;">
                <div class="custom-modal-header" style="background: #1e293b; color: white; display: flex; justify-content: space-between; align-items: center; padding: 15px 20px;">
                    <div class="custom-modal-title" style="font-weight: 800;"><i class="fas fa-lock-open"></i> Desbloquear Dados</div>
                    <button class="custom-modal-close" onclick="this.closest('.custom-modal-overlay').remove()" style="background:none; border:none; color:white; font-size:24px; cursor:pointer;">&times;</button>
                </div>
                <div class="custom-modal-body" style="padding: 30px;">
                    <div style="font-size: 40px; margin-bottom: 15px; color: #f59e0b;"><i class="fas fa-gem"></i></div>
                    ${subContent}
                    <div style="margin-top: 15px; border-top: 1px solid #eee; padding-top: 15px;">
                        <button onclick="window.Monetization.showPixOptions(); this.closest('.custom-modal-overlay').remove();" style="background:none; border:none; color:#2563eb; font-weight:700; cursor:pointer; font-size:12px;">
                            <i class="fas fa-shopping-cart"></i> Reservar mais créditos
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const confirmUnlock = async (finalId, finalPrice) => {
            const { limit } = this.getTierLimits();
            const used = this.userProfile?.monthly_unlocks_used || 0;
            const hasAllowance = used < limit;

            if (!hasAllowance && (this.userProfile?.credits || 0) < finalPrice) {
                window.Toast.warning(`Saldo insuficiente para esta ação (${finalPrice} créditos necessários).`);
                return;
            }

            modal.remove();
            await this.executeUnlockLote(loteInscricao, finalId === loteInscricao ? null : finalId, finalPrice);
        };

        if (isUnitQuery) {
            modal.querySelector('#btnUnlockUnit').onclick = () => confirmUnlock(unitId, 1);
            modal.querySelector('#btnUnlockLot').onclick = () => confirmUnlock(loteInscricao, 5);
        } else {
            modal.querySelector('#btnUnlockLotOnly').onclick = () => confirmUnlock(loteInscricao, 5);
        }
    },

    executeUnlockLote: async function(loteInscricao, unitId, price = 1) {
        console.warn("🚀 [Monetization] executeUnlockLote INICIADO!", { loteInscricao, unitId, price });
        const { limit, label } = this.getTierLimits();
        const used = this.userProfile?.monthly_unlocks_used || 0;
        const hasMonthlyAllowance = used < limit;

        const loadingMsg = hasMonthlyAllowance ? 
            `Usando limite mensal do Plano ${label}...` : 
            `Consumindo ${price} crédito(s) da carteira...`;

        window.Loading.show("Desbloqueando...", loadingMsg);
        
        try {
            const cleanLote = String(loteInscricao || '').replace(/\D/g, '').substring(0, 8);
            const cleanUnit = unitId ? String(unitId).replace(/\D/g, '') : null;
            console.warn("🛰️ [Monetization] Preparando chamada RPC para:", { cleanLote, cleanUnit });

            console.log("💰 [Monetization] Starting Unlock Flow for:", { cleanLote, cleanUnit, price, role: this.userRole });

            let rpcResponse;
            if (hasMonthlyAllowance) {
                console.log("💎 [Monetization] Using Plan Allowance (RPC: unlock_lote_with_plan)");
                rpcResponse = await window.supabaseApp.rpc('unlock_lote_with_plan', {
                    target_lote: cleanLote,
                    target_unidade: cleanUnit,
                    token_weight: price // Consome 1 ou 5 conforme o peso
                });
            } else {
                console.log("💳 [Monetization] Using Paid Credits (RPC: unlock_lote_with_credits)");
                rpcResponse = await window.supabaseApp.rpc('unlock_lote_with_credits', {
                    target_lote: cleanLote,
                    target_unidade: cleanUnit,
                    credit_cost: price
                });
            }

            const { data, error } = rpcResponse;
            console.log("🛰️ [Monetization] RPC Response:", { data, error });

            if (error) {
                console.error("❌ [Monetization] RPC Error:", error);
                window.Toast.error("Erro no servidor: " + (error.message || "Falha ao registrar desbloqueio"));
                throw error;
            }

            if (data === false) {
                console.warn("⚠️ [Monetization] RPC returned FALSE (Unknown failure)");
                window.Toast.error("O servidor não pôde processar o desbloqueio. Verifique seu saldo ou limite.");
                return;
            }

            // SUCCESS!
            if (hasMonthlyAllowance) {
                // Incrementa localmente conforme o peso (1 ou 5)
                this.userProfile.monthly_unlocks_used = (this.userProfile.monthly_unlocks_used || 0) + price;
                window.Toast.success(`Ficha liberada pelo plano! (${this.userProfile.monthly_unlocks_used}/${limit})`);
            } else {
                this.userProfile.credits -= price;
                window.Toast.success(`Ficha liberada usando créditos!`);
            }
            
            const cleanIdStr = (val) => String(val).replace(/\D/g, '');
            // Se o alvo for de 8 dígitos, é um LOTE INTEIRO.
            // Se for de 11+, é uma UNIDADE.
            const targetId = cleanIdStr(unitId || loteInscricao);
            const isLoteInteiro = targetId.length === 8;

            this.unlockedLots.add(targetId);
            
            await this.updateBalanceUI();
            this.renderPlanWidget();
            
            window.Toast.success(isLoteInteiro ? "Prédio inteiro desbloqueado!" : "Unidade desbloqueada com sucesso!");
            
            // Re-render tooltip since it's now unlocked
            if (window.currentTooltip) {
                // Preservar scroll position
                const scrollable = window.currentTooltip.querySelector('.lot-tooltip-body, [style*="overflow-y"]');
                const savedScroll = scrollable ? scrollable.scrollTop : 0;

                const refreshAndScroll = (promise) => {
                    promise.then(() => {
                        setTimeout(() => {
                            const newScrollable = window.currentTooltip?.querySelector('.lot-tooltip-body, [style*="overflow-y"]');
                            if (newScrollable) newScrollable.scrollTop = savedScroll;
                        }, 50);
                    });
                };

                if (window.currentUnitForUpdate && window.currentLoteForUnit) {
                    refreshAndScroll(window.showUnitTooltip(window.currentUnitForUpdate, window.currentLoteForUnit, 0, 0));
                } else if (window.currentLoteForUnit) {
                    refreshAndScroll(window.showLotTooltip(window.currentLoteForUnit, 0, 0));
                }
            }
            
        } catch(e) {
             console.error("Unlock Error:", e);
             // Safety: If error occurred before or during RPC, Toast will show it
             // but userProfile.credits hasn't been touched yet.
             window.Toast.error(e.message || "Erro no servidor ao processar desbloqueio. Seus créditos foram preservados.");
        } finally {
             window.Loading.hide();
        }
    },

    updateBalanceUI: function() {
        if (this.userProfile) {
            this.renderPlanWidget();
        }
    },


    checkCredits: async function(amountRequired) {
        if (!this.userProfile) {
            await this.loadUserProfile();
        }

        // Roles privilegiadas não gastam créditos
        if (this.userRole === 'master' || this.userRole === 'admin') {
            return true;
        }
        
        if (!this.userProfile || this.userProfile.credits < amountRequired) {
            this.showInsufficientCreditsModal(amountRequired);
            return false;
        }
        return true;
    },

    consumeCredits: async function(amount, serviceName) {
        console.warn("💳 [Monetization] consumeCredits CHAMADA!", { amount, serviceName });
        // Roles privilegiadas não gastam créditos
        if (this.userRole === 'master' || this.userRole === 'admin') {
            console.log("👑 [Monetization] Role privilegiada - Ignorando débito.");
            return true;
        }

        try {
            console.log("🛰️ [Monetization] Enviando RPC spend_credits...");
            const { data, error } = await window.supabaseApp.rpc('spend_credits', {
                amount_to_spend: amount,
                detail: serviceName
            });

            if (error) throw error;

            // Update local state
            if (this.userProfile) {
                this.userProfile.credits -= amount;
                this.updateBalanceUI();
            }
            return true;
        } catch (e) {
            console.error("Error consuming credits:", e);
            window.Toast.error("Erro ao processar créditos: " + e.message);
            return false;
        }
    },

    showInsufficientCreditsModal: function(required) {
        const modal = document.createElement('div');
        modal.className = 'custom-modal-overlay active';
        modal.style.zIndex = '10020';
        modal.innerHTML = `
            <div class="custom-modal" style="max-width: 400px; text-align: center;">
                <div class="custom-modal-header" style="background: #e11d48; color: white;">
                    <div class="custom-modal-title">Saldo Insuficiente</div>
                    <button class="custom-modal-close" onclick="this.closest('.custom-modal-overlay').remove()">&times;</button>
                </div>
                <div class="custom-modal-body" style="padding: 30px;">
                    <div style="font-size: 50px; margin-bottom: 20px;">🪙</div>
                    <p style="color: #475569; font-size: 14px; margin-bottom: 20px;">
                        Você precisa de <strong>${required} créditos</strong> para realizar esta operação. Seu saldo atual é de <strong>${this.userProfile?.credits || 0} créditos</strong>.
                    </p>
                    <button onclick="window.Monetization.showSubscriptionPlans(); this.closest('.custom-modal-overlay').remove();" 
                        class="btn-primary-rich" style="width: 100%; padding: 12px; background: #2563eb;">
                        Ver Planos de Assinatura
                    </button>
                    <div style="margin-top: 15px; font-size: 11px; color: #94a3b8; cursor: pointer;" onclick="window.Monetization.showPixOptions(); this.closest('.custom-modal-overlay').remove();">
                        Ou apenas comprar créditos avulsos
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    showSubscriptionPlans: function() {
        const currentRole = this.userRole || 'user';
        const credits = this.userProfile?.credits || 0;
        const isCurrentPlan = (r) => currentRole === r;
        const currentBadge = (r) => isCurrentPlan(r) ?
            `<div style="position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: #10b981; color: white; padding: 4px 12px; border-radius: 20px; font-size: 10px; font-weight: 800; white-space: nowrap;">✓ SEU PLANO</div>` : '';

        const modal = document.createElement('div');
        modal.className = 'custom-modal-overlay active';
        modal.style.zIndex = '10020';
        modal.innerHTML = `
            <div class="custom-modal" style="max-width: 900px; width: 95%;">
                <div class="custom-modal-header" style="background: #1e293b; color: white;">
                    <div class="custom-modal-title"><i class="fas fa-crown"></i> Planos GuaruGeo</div>
                    <button class="custom-modal-close" onclick="this.closest('.custom-modal-overlay').remove()">&times;</button>
                </div>
                <div class="custom-modal-body" style="padding: 24px 30px 30px; background: #f8fafc;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
                        <div style="font-size: 13px; color: #475569;">
                            Seu plano: <strong style="color: #1e293b;">${currentRole.charAt(0).toUpperCase() + currentRole.slice(1)}</strong>
                        </div>
                        <div style="font-size: 13px; color: #475569;">
                            Créditos disponíveis: <strong style="color: #f59e0b;">${credits} 🪙</strong>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">

                        <!-- Gratuito -->
                        <div style="background: white; border: ${isCurrentPlan('user') ? '2px solid #10b981' : '1px solid #e2e8f0'}; border-radius: 16px; padding: 24px; display: flex; flex-direction: column; position: relative; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                            ${currentBadge('user')}
                            <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase;">Gratuito</div>
                            <div style="font-size: 24px; font-weight: 800; color: #1e293b; margin: 10px 0;">R$ 0</div>
                            <ul style="list-style: none; padding: 0; margin: 16px 0; font-size: 12px; color: #475569; flex: 1; line-height: 1.8;">
                                <li>✅ Mapa base interativo</li>
                                <li>✅ Dados básicos do lote</li>
                                <li>❌ Fichas de proprietário</li>
                                <li>❌ Radar Farol</li>
                                <li>❌ Busca por proprietário</li>
                            </ul>
                            <button onclick="this.closest('.custom-modal-overlay').remove()" style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: white; font-weight: 700; cursor: pointer; font-size: 12px;">Continuar Grátis</button>
                        </div>

                        <!-- Pro -->
                        <div style="background: white; border: ${isCurrentPlan('pro') ? '2px solid #10b981' : '2px solid #2563eb'}; border-radius: 16px; padding: 24px; display: flex; flex-direction: column; position: relative; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                            ${currentBadge('pro')}
                            ${!isCurrentPlan('pro') && !isCurrentPlan('elite') && !isCurrentPlan('master') && !isCurrentPlan('admin') ? `<div style="position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: #2563eb; color: white; padding: 4px 12px; border-radius: 20px; font-size: 10px; font-weight: 800;">MAIS VENDIDO</div>` : ''}
                            <div style="font-size: 11px; font-weight: 800; color: #2563eb; text-transform: uppercase;">${this.plansConfig?.pro?.name || 'Pro'}</div>
                            <div style="font-size: 24px; font-weight: 800; color: #1e293b; margin: 10px 0;">R$ ${this.plansConfig?.pro?.price || 199}<small style="font-size: 13px; font-weight: 400;">/mês</small></div>
                            <ul style="list-style: none; padding: 0; margin: 16px 0; font-size: 12px; color: #475569; flex: 1; line-height: 1.8;">
                                <li>✅ <b>${this.plansConfig?.pro?.credits || 30} fichas/mês inclusas</b></li>
                                <li>✅ Radar Farol (básico)</li>
                                <li>✅ Busca por proprietário</li>
                                <li>✅ CRM pessoal</li>
                            </ul>
                            <button onclick="window.Monetization.startSubscription('pro')" style="width: 100%; padding: 10px; border: none; border-radius: 8px; background: #2563eb; color: white; font-weight: 700; cursor: pointer; font-size: 12px; box-shadow: 0 4px 12px rgba(37,99,235,0.3);">Assinar ${this.plansConfig?.pro?.name || 'Pro'}</button>
                        </div>

                        <!-- Elite -->
                        <div style="background: linear-gradient(160deg, #faf5ff, #ede9fe); border: ${isCurrentPlan('elite') ? '2px solid #10b981' : '2px solid #7c3aed'}; border-radius: 16px; padding: 24px; display: flex; flex-direction: column; position: relative; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                            ${currentBadge('elite')}
                            ${!isCurrentPlan('elite') ? `<div style="position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: #f59e0b; color: #1e293b; padding: 4px 12px; border-radius: 20px; font-size: 10px; font-weight: 800;">NOVO</div>` : ''}
                            <div style="font-size: 11px; font-weight: 800; color: #7c3aed; text-transform: uppercase;">${this.plansConfig?.elite?.name || 'Elite'}</div>
                            <div style="font-size: 24px; font-weight: 800; color: #1e293b; margin: 10px 0;">R$ ${this.plansConfig?.elite?.price || 449}<small style="font-size: 13px; font-weight: 400;">/mês</small></div>
                            <ul style="list-style: none; padding: 0; margin: 16px 0; font-size: 12px; color: #475569; flex: 1; line-height: 1.8;">
                                <li>✅ <b>${this.plansConfig?.elite?.credits || 80} fichas/mês inclusas</b></li>
                                <li>✅ Radar Farol completo</li>
                                <li>✅ Dossiê PDF automático</li>
                                <li>✅ Alertas de oportunidade</li>
                                <li>✅ Relatórios avançados</li>
                            </ul>
                            <button onclick="window.Monetization.startSubscription('elite')" style="width: 100%; padding: 10px; border: none; border-radius: 8px; background: #7c3aed; color: white; font-weight: 700; cursor: pointer; font-size: 12px; box-shadow: 0 4px 12px rgba(124,58,237,0.3);">Assinar ${this.plansConfig?.elite?.name || 'Elite'}</button>
                        </div>

                        <!-- Anual VIP -->
                        <div style="background: #1e293b; border: ${isCurrentPlan('vip') ? '2px solid #10b981' : '1px solid #334155'}; border-radius: 16px; padding: 24px; display: flex; flex-direction: column; color: white; position: relative; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                            ${currentBadge('vip')}
                            <div style="font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Anual VIP</div>
                            <div style="font-size: 24px; font-weight: 800; color: white; margin: 10px 0;">R$ 4.990<small style="font-size: 13px; font-weight: 400;">/ano</small></div>
                            <ul style="list-style: none; padding: 0; margin: 16px 0; font-size: 12px; opacity: 0.9; flex: 1; line-height: 1.8;">
                                <li>✅ <b>110 fichas/mês inclusas</b></li>
                                <li>✅ Radar Farol completo</li>
                                <li>✅ Dossiê PDF automático</li>
                                <li>✅ Suporte prioritário</li>
                                <li>✅ 15% economia sobre o Elite</li>
                            </ul>
                            <button onclick="window.Monetization.startSubscription('annual')" style="width: 100%; padding: 10px; border: none; border-radius: 8px; background: white; color: #1e293b; font-weight: 700; cursor: pointer; font-size: 12px;">Assinar Anual</button>
                        </div>

                    </div>
                    <div style="text-align: center; margin-top: 20px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
                        <div style="font-size: 12px; color: #94a3b8; margin-bottom: 8px;">Ou compre fichas avulsas (sem assinatura):</div>
                         <span style="font-size: 12px; color: #2563eb; text-decoration: underline; cursor: pointer;" onclick="window.Monetization.showPixOptions(); this.closest('.custom-modal-overlay').remove();">
                            10 fichas = R$ 69,90 &nbsp;·&nbsp; 30 fichas = R$ 149,90 &nbsp;·&nbsp; 100 fichas = R$ 399,90
                        </span>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },



    startSubscription: function(plan) {
        let price = 0;
        if (this.plansConfig && this.plansConfig[plan]) {
            price = this.plansConfig[plan].price;
        } else {
            // Fallbacks
            if (plan === 'pro') price = 199;
            else if (plan === 'elite') price = 449;
            else if (plan === 'annual') price = 4990;
            else return;
        }

        // Open Pix Checkout for Plan
        const modal = document.createElement('div');
        modal.className = 'custom-modal-overlay active';
        modal.style.zIndex = '10030';
        modal.innerHTML = `
            <div class="custom-modal" style="max-width: 450px;">
                <div class="custom-modal-header" style="background: #1e293b; color: white;">
                    <div class="custom-modal-title"><i class="fas fa-crown"></i> Assinatura ${plan.toUpperCase()}</div>
                    <button class="custom-modal-close" onclick="this.closest('.custom-modal-overlay').remove()">&times;</button>
                </div>
                <div class="custom-modal-body" id="plan-checkout-body">
                    <!-- Conteúdo preenchido dinamicamente -->
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        this.renderPlanPixCheckout(plan, price);
    },

    renderPlanPixCheckout: function(plan, price) {
        const body = document.getElementById('plan-checkout-body');
        const pixPayload = this.generatePixPayload(`PLAN_${plan.toUpperCase()}`, price);

        body.innerHTML = `
            <div style="text-align: center; padding: 25px;">
                <div style="background: #f8fafc; border-radius: 12px; padding: 20px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
                    <div style="font-size: 13px; color: #64748b; margin-bottom: 10px;">
                        <i class="fas fa-clock fa-spin" style="color: #2563eb; margin-right: 5px;"></i> Aguardando confirmação do pagamento...
                    </div>
                    <div style="font-size: 32px; font-weight: 800; color: #1e293b;">R$ ${price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                </div>
                
                <div style="background: white; padding: 15px; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 20px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixPayload)}" style="width: 180px; height: 180px; border-radius: 8px;">
                </div>

                <div style="margin-bottom: 20px; text-align: left;">
                    <label style="font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: 700;">Pix Copia e Cola</label>
                    <div style="display: flex; gap: 8px; margin-top: 5px;">
                        <input readonly value="${pixPayload}" style="flex: 1; font-size: 10px; padding: 8px; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 6px; font-family: monospace;" />
                        <button onclick="navigator.clipboard.writeText('${pixPayload}'); window.Toast.success('Copiado!')" style="background: #1e293b; color: white; border: none; padding: 0 15px; border-radius: 6px; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#0f172a'" onmouseout="this.style.background='#1e293b'"><i class="fas fa-copy"></i></button>
                    </div>
                </div>

                <div style="display: grid; gap: 10px;">
                    <button onclick="window.Monetization.submitPendingPlan('${plan}', ${price})" class="btn-primary-rich" style="width: 100%; background: #2563eb; height: 48px; box-shadow: 0 4px 12px rgba(37,99,235,0.3);">
                        <i class="fas fa-check-circle"></i> Já paguei via Pix
                    </button>
                    <button onclick="this.closest('.custom-modal-overlay').remove()" style="background: none; border: none; color: #94a3b8; font-size: 12px; cursor: pointer; padding: 10px;">
                        Cancelar e voltar
                    </button>
                </div>
            </div>
        `;
    },

    submitPendingPlan: async function(plan, price) {
        window.Loading.show("Enviando solicitação...", "Notificando administrador");
        try {
            const { error } = await window.supabaseApp.from('pending_plan_activations').insert({
                user_id: this.userProfile.id,
                plano_solicitado: plan,
                valor_pago: price,
                status: 'pending'
            });

            if (error) throw error;

            window.Loading.hide();
            window.Toast.success("Solicitação enviada! Seu plano será ativado após conferência.");
            document.querySelector('.custom-modal-overlay[style*="z-index: 10030"]')?.remove();
            document.querySelector('.custom-modal-overlay[style*="z-index: 10020"]')?.remove();
        } catch (e) {
            console.error(e);
            window.Loading.hide();
            window.Toast.error("Erro ao enviar: " + e.message);
        }
    },

    showPixOptions: function() {
        const modal = document.createElement('div');
        modal.className = 'custom-modal-overlay active';
        modal.style.zIndex = '10020';
        modal.innerHTML = `
            <div class="custom-modal" style="max-width: 450px;">
                <div class="custom-modal-header" style="background: #0d9488; color: white;">
                    <div class="custom-modal-title"><i class="fas fa-bolt"></i> Recarga Via Pix</div>
                    <button class="custom-modal-close" onclick="this.closest('.custom-modal-overlay').remove()">&times;</button>
                </div>
                <div class="custom-modal-body" style="padding: 25px;">
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px;">
                        <div onclick="window.Monetization.generatePixCheckout(10, 69.90)" style="border: 2px solid #e2e8f0; border-radius: 12px; padding: 12px; cursor: pointer; text-align: center; transition: all 0.2s;" onmouseover="this.style.borderColor='#0d9488'" onmouseout="this.style.borderColor='#e2e8f0'">
                            <div style="font-size: 14px; font-weight: 800; color: #1e293b;">10 Fichas</div>
                            <div style="color: #0d9488; font-weight: 700; font-size: 13px;">R$ 69,90</div>
                        </div>
                        <div onclick="window.Monetization.generatePixCheckout(30, 149.90)" style="border: 2px solid #e2e8f0; border-radius: 12px; padding: 12px; cursor: pointer; text-align: center; transition: all 0.2s; position: relative;" onmouseover="this.style.borderColor='#0d9488'" onmouseout="this.style.borderColor='#e2e8f0'">
                            <div style="position: absolute; top: -8px; right: -8px; background: #f59e0b; color: white; font-size: 9px; padding: 2px 6px; border-radius: 20px; font-weight: 800;">TOP</div>
                            <div style="font-size: 14px; font-weight: 800; color: #1e293b;">30 Fichas</div>
                            <div style="color: #0d9488; font-weight: 700; font-size: 13px;">R$ 149,90</div>
                        </div>
                        <div onclick="window.Monetization.generatePixCheckout(100, 399.90)" style="border: 2px solid #e2e8f0; border-radius: 12px; padding: 12px; cursor: pointer; text-align: center; transition: all 0.2s;" onmouseover="this.style.borderColor='#0d9488'" onmouseout="this.style.borderColor='#e2e8f0'">
                            <div style="font-size: 14px; font-weight: 800; color: #1e293b;">100 Fichas</div>
                            <div style="color: #0d9488; font-weight: 700; font-size: 13px;">R$ 399,90</div>
                        </div>
                    </div>
                    <p style="font-size: 11px; color: #64748b; text-align: center;">Créditos são liberados imediatamente após a confirmação do Pix.</p>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    generatePixCheckout: function(credits, price) {
        const modal = document.querySelector('.custom-modal-overlay[style*="z-index: 10020"]');
        if (!modal) return;

        const pixPayload = this.generatePixPayload(`${credits}F`, price);
        
        const body = modal.querySelector('.custom-modal-body');
        body.innerHTML = `
            <div style="text-align: center;">
                <div style="background: #ecfdf5; color: #065f46; padding: 10px; border-radius: 8px; font-size: 11px; margin-bottom: 20px;">
                    <i class="fas fa-shield-alt"></i> Pagamento Seguro via Pix
                </div>
                
                <div style="font-weight: 800; color: #1e293b; font-size: 20px; margin-bottom: 5px;">R$ ${price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                <div style="font-size: 12px; color: #64748b; margin-bottom: 20px;">Pacote: <b>${credits} Fichas</b></div>
                
                <div style="background: white; padding: 15px; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 20px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixPayload)}" 
                         style="width: 180px; height: 180px; border-radius: 8px;">
                </div>

                <div style="margin-bottom: 20px;">
                    <label style="font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 6px;">Pix Copia e Cola</label>
                    <div style="display: flex; gap: 8px;">
                        <input id="pix-copy-input" readonly value="${pixPayload}" style="flex: 1; font-size: 10px; padding: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-family: monospace;" />
                        <button onclick="navigator.clipboard.writeText('${pixPayload}'); window.Toast.success('Copiado!')" style="background: #1e293b; color: white; border: none; padding: 0 12px; border-radius: 6px; cursor: pointer;"><i class="fas fa-copy"></i></button>
                    </div>
                </div>

                <button onclick="window.Monetization.showReceiptUpload(${credits}, ${price})" class="btn-primary-rich" style="width: 100%; background: #0d9488; height: 45px;">
                    <i class="fas fa-upload"></i> Já paguei, enviar comprovante
                </button>
                
                <p style="font-size: 10px; color: #94a3b8; margin-top: 15px;">A liberação será feita pelo administrador após conferência do Pix.</p>
            </div>
        `;
    },

    showReceiptUpload: function(credits, price) {
        const modal = document.querySelector('.custom-modal-overlay[style*="z-index: 10020"]');
        if (!modal) return;

        const body = modal.querySelector('.custom-modal-body');
        body.innerHTML = `
            <div style="text-align: center;">
                <button onclick="window.Monetization.generatePixCheckout(${credits}, ${price})" style="position: absolute; top: 15px; left: 15px; background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 12px;"><i class="fas fa-arrow-left"></i> Voltar</button>
                
                <div style="font-weight: 800; color: #1e293b; font-size: 18px; margin: 20px 0 10px;">Comprovante de Pagamento</div>
                <p style="font-size: 12px; color: #64748b; margin-bottom: 25px;">Para agilizar sua liberação, anexe o comprovante (ou apenas confirme se já pagou).</p>
                
                <div style="background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 30px; margin-bottom: 25px; cursor: pointer; position: relative;" onclick="document.getElementById('receipt-file').click()">
                    <i class="fas fa-cloud-upload-alt" style="font-size: 30px; color: #94a3b8; margin-bottom: 10px;"></i>
                    <div style="font-size: 13px; font-weight: 700; color: #475569;">Clique para anexar arquivo</div>
                    <div style="font-size: 11px; color: #94a3b8; margin-top: 5px;">PNG, JPG ou PDF (opcional)</div>
                    <input type="file" id="receipt-file" style="display: none;" onchange="this.parentElement.querySelector('div').innerText = this.files[0].name; this.parentElement.style.borderColor = '#0d9488'" />
                </div>

                <button onclick="window.Monetization.submitPendingCredit(${credits}, ${price})" class="btn-primary-rich" style="width: 100%; background: #0d9488; height: 45px;">
                    ✓ Confirmar Pagamento
                </button>
            </div>
        `;
    },

    submitPendingCredit: async function(credits, price) {
        window.Loading.show("Enviando solicitação...", "Registrando no painel do administrador");
        try {
            // No mundo real aqui faríamos upload do arquivo para o Storage
            // Por enquanto, criamos o registro pendente direto
            const { error } = await window.supabaseApp.from('pending_credit_releases').insert({
                user_id: this.userProfile.id,
                quantidade: credits,
                valor_pago: price,
                status: 'pending'
            });

            if (error) throw error;

            window.Loading.hide();
            window.Toast.success("Solicitação enviada! Aguarde a liberação pelo administrador.");
            
            const modal = document.querySelector('.custom-modal-overlay[style*="z-index: 10020"]');
            if (modal) modal.remove();
        } catch (e) {
            console.error(e);
            window.Loading.hide();
            window.Toast.error("Erro ao enviar: " + e.message);
        }
    },

    unlockUnitInfo: async function(unitInscricao) {
        // Delegates to the new full paywall modal flow
        const loteInscricao = unitInscricao.slice(0, -3); // remove last 3 digits (unit number)
        this.promptUnlockLote(loteInscricao, unitInscricao, 1);
    },

    // Duplicate isUnlocked removed - moved to line 207

    loadWallet: async function() {
        const listEl = document.getElementById('wallet-list');
        const statsEl = document.getElementById('wallet-stats');
        if (!listEl) return;

        listEl.innerHTML = `
            <div style="padding: 40px; text-align: center; color: #94a3b8;">
                <i class="fas fa-spinner fa-spin fa-2x"></i>
                <p style="margin-top: 10px;">Consultando cofre...</p>
            </div>
        `;

        try {
            const { data: { user } } = await window.supabaseApp.auth.getUser();
            if (!user) return;

            // 1. Fetch LOTS (Sem o join problemático que causava PGRST200)
            const { data: lotUnlocks, error: lotError } = await window.supabaseApp
                .from('unlocked_lots')
                .select('*')
                .eq('user_id', user.id)
                .order('desbloqueado_em', { ascending: false });

            // 2. Fetch PERSONS with names
            const { data: personUnlocks, error: personError } = await window.supabaseApp
                .from('unlocked_persons')
                .select('*, proprietarios(nome_completo)')
                .eq('user_id', user.id)
                .order('unlocked_at', { ascending: false });

            if (lotError) console.warn("Lot unlock error:", lotError);
            if (personError) console.warn("Person unlock error:", personError);

            // 3. SE existirem unidades desbloqueadas, buscar detalhes delas para Proprietário/Matricula/RIP
            const unitInscricoes = lotUnlocks
                .filter(item => item.unidade_inscricao)
                .map(item => item.unidade_inscricao);
            
            let unitsData = [];
            if (unitInscricoes.length > 0) {
                const { data: units, error: uError } = await window.supabaseApp
                    .from('unidades')
                    .select('inscricao, matricula, rip, logradouro, numero, complemento, nome_proprietario, endereco_completo')
                    .in('inscricao', unitInscricoes);
                if (!uError) unitsData = units;
            }

            const totalCount = (lotUnlocks?.length || 0) + (personUnlocks?.length || 0);
            if (statsEl) {
                 statsEl.querySelector('div').innerText = totalCount;
            }

            if (totalCount === 0) {
                listEl.innerHTML = `
                    <div style="padding: 40px; text-align: center; background: #f8fafc; border-radius: 12px; border: 2px dashed #e2e8f0; margin: 10px;">
                        <i class="fas fa-wallet" style="font-size: 32px; color: #cbd5e1; margin-bottom: 15px;"></i>
                        <p style="font-size: 13px; font-weight: 700; color: #475569;">Carteira Vazia</p>
                        <p style="font-size: 11px; color: #94a3b8;">Desbloqueie fichas e proprietários no mapa para investir em sua carteira pessoal.</p>
                    </div>
                `;
                return;
            }

            let html = '';

            // --- CATEGORY: PROPRIETÁRIOS ---
            if (personUnlocks && personUnlocks.length > 0) {
                html += `
                    <div style="margin-bottom: 24px;">
                        <div style="font-size: 11px; font-weight: 800; color: #7c3aed; text-transform: uppercase; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
                            <i class="fas fa-user-shield"></i> Proprietários Desbloqueados
                            <span style="background: #f3e8ff; color: #7c3aed; padding: 2px 6px; border-radius: 10px; font-size: 9px;">${personUnlocks.length}</span>
                        </div>
                        <div style="display: grid; gap: 8px;">
                `;
                
                personUnlocks.forEach(item => {
                    const nome = item.proprietarios?.nome_completo || 'Proprietário Desbloqueado';
                    const p = { nome_completo: nome, cpf_cnpj: item.cpf_cnpj };
                    const date = new Date(item.unlocked_at || item.created_at).toLocaleDateString('pt-BR');
                    
                    html += `
                        <div class="crm-lead-card" style="cursor: pointer; transition: all 0.2s; border-left: 4px solid #7c3aed; padding: 12px; background: white; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);"
                             onclick="window.ProprietarioTooltip.show('${p.cpf_cnpj}')"
                             onmouseover="this.style.transform='translateX(5px)'"
                             onmouseout="this.style.transform='none'">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <div style="font-weight: 700; color: #1e293b; font-size: 13px;">${p.nome_completo}</div>
                                    <div style="font-size: 10px; color: #94a3b8;">${window.formatDocument(p.cpf_cnpj, false)} • ${date}</div>
                                </div>
                                <i class="fas fa-chevron-right" style="font-size: 10px; color: #cbd5e1;"></i>
                            </div>
                        </div>
                    `;
                });
                html += `</div></div>`;
            }

            // --- CATEGORY: LOTES/EDIFÍCIOS ---
            if (lotUnlocks && lotUnlocks.length > 0) {
                const groups = {};
                lotUnlocks.forEach(item => {
                    // Resolve metadata localmente (evita dependência de Foreing Key no banco)
                    let lot = item.lotes; 
                    if (!lot && window.allLotes) {
                        lot = window.allLotes.find(l => l.inscricao === item.lote_inscricao);
                    }
                    if (!lot) lot = { inscricao: item.lote_inscricao };

                    const building = lot.building_name || "Lotes Avulsos / Terrenos";
                    if (!groups[building]) groups[building] = [];
                    groups[building].push({ ...item, resolved_lot: lot });
                });

                html += `
                    <div style="font-size: 11px; font-weight: 800; color: #10b981; text-transform: uppercase; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-map-marked-alt"></i> Fichas de Imóveis
                        <span style="background: #ecfdf5; color: #059669; padding: 2px 6px; border-radius: 10px; font-size: 9px;">${lotUnlocks.length}</span>
                    </div>
                `;

                html += Object.keys(groups).map(buildingName => {
                    const items = groups[buildingName];
                    return `
                        <div style="margin-bottom: 16px; padding-left: 8px; border-left: 1px solid #e2e8f0;">
                            <div style="font-size: 10px; font-weight: 700; color: #64748b; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                                <i class="fas ${buildingName.includes('Lote') ? 'fa-draw-polygon' : 'fa-building'}" style="opacity: 0.5;"></i>
                                ${buildingName}
                            </div>
                            ${items.map(item => {
                                const date = new Date(item.desbloqueado_em).toLocaleDateString('pt-BR');
                                const lot = item.resolved_lot || {};
                                const unitId = item.unidade_inscricao;
                                const u = unitId ? unitsData.find(u => u.inscricao === unitId) : null;

                                // Prioridade de Título:
                                // 1. Se unidade: Nome do Proprietário
                                // 2. Se prédio: Nome do Edifício (se não for o nome do grupo)
                                // 3. Endereço Completo
                                // 4. Inscrição
                                let cardTitle = "";
                                if (u) {
                                    cardTitle = u.nome_proprietario || u.endereco_completo || (lot.logradouro ? `${lot.logradouro}, ${lot.numero_imovel || 'S/N'}` : unitId);
                                } else {
                                    cardTitle = (lot.building_name && lot.building_name !== buildingName) ? lot.building_name : 
                                                (lot.logradouro ? `${lot.logradouro}, ${lot.numero_imovel || 'S/N'}` : item.lote_inscricao);
                                }

                                return `
                                    <div class="crm-lead-card" style="cursor: pointer; margin-bottom: 6px; transition: all 0.2s; border-left: 3px solid #10b981; padding: 10px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.01);"
                                         onclick="window.Monetization.flyToUnlocked('${item.lote_inscricao}')"
                                         onmouseover="this.style.transform='translateX(4px)'"
                                         onmouseout="this.style.transform='none'">
                                        <div style="display: flex; justify-content: space-between; align-items: center;">
                                            <div>
                                                <div style="font-weight: 700; color: #334155; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 250px;" title="${cardTitle}">
                                                    ${cardTitle}
                                                </div>
                                                ${(function() {
                                                    if (u) {
                                                        let extra = `<div style="font-size: 9px; color: #64748b; font-weight: 600; margin-top: 2px;">`;
                                                        if (u.matricula) extra += `<i class="fas fa-file-contract"></i> Matrícula: ${u.matricula} `;
                                                        if (u.rip) extra += `<i class="fas fa-anchor"></i> RIP: ${u.rip}`;
                                                        extra += `</div>`;
                                                        return extra;
                                                    }
                                                    return '';
                                                })()}
                                                <div style="font-size: 9px; color: #94a3b8;">
                                                    ${u ? `Unidade ${unitId.slice(-3)}` : (lot.building_name || 'Lote')} • Liberado em ${date}
                                                </div>
                                            </div>
                                            <i class="fas fa-location-arrow" style="font-size: 9px; color: #10b981;"></i>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `;
                }).join('');
            }

            listEl.innerHTML = html;

        } catch (e) {
            console.error("Error loading wallet:", e);
            listEl.innerHTML = '<div style="padding: 20px; color: #ef4444; font-size:12px;">Erro ao carregar carteira. Tente novamente.</div>';
        }
    },

    unlockPerson: async function(cpf_cnpj, name = "Proprietário", price = 3) {
        if (this.isUnlockedPerson(cpf_cnpj)) return true;
        
        const modal = document.createElement('div');
        modal.className = 'custom-modal-overlay active';
        modal.style.zIndex = '10020';
        modal.innerHTML = `
            <div class="custom-modal" style="max-width: 400px; text-align: center;">
                <div class="custom-modal-header" style="background: #1e293b; color: white;">
                    <div class="custom-modal-title"><i class="fas fa-user-lock"></i> Desbloquear Proprietário</div>
                    <button class="custom-modal-close" onclick="this.closest('.custom-modal-overlay').remove()">&times;</button>
                </div>
                <div class="custom-modal-body" style="padding: 30px;">
                    <div style="font-size: 40px; margin-bottom: 15px; color: #7c3aed;"><i class="fas fa-id-card"></i></div>
                    <h3 style="margin-bottom: 10px; color: #1e293b;">${name}</h3>
                    <p style="color: #475569; font-size: 14px; margin-bottom: 20px;">
                        Para acessar o nome completo, CPF/CNPJ e contatos deste proprietário em todo o sistema, você precisa usar 1 crédito.
                    </p>
                    <p style="font-size: 15px; font-weight: 700; color: #1e293b; margin-bottom: 15px;">Custo: ${price} Crédito(s)</p>
                    <div style="font-size: 11px; color: #64748b; margin-bottom: 25px; background: #f1f5f9; padding: 10px; border-radius: 8px;">
                        <i class="fas fa-info-circle"></i> Uma vez desbloqueado, este proprietário ficará disponível na sua carteira permanentemente.
                    </div>
                    
                    <button id="btnConfirmUnlockPerson" class="btn-primary-rich" style="width: 100%; padding: 12px; background: #7c3aed; margin-bottom: 10px;">
                        <i class="fas fa-unlock"></i> Desbloquear Agora
                    </button>
                    ${this.userProfile?.credits < price ? `<p style="color:#ef4444; font-size:11px; margin-top:5px; font-weight:bold;">Saldo insuficiente!</p>` : ''}
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('#btnConfirmUnlockPerson').onclick = async () => {
            if ((this.userProfile?.credits || 0) < price && this.userRole !== 'master' && this.userRole !== 'admin') {
                window.Toast.warning("Saldo insuficiente. Adquira mais no Painel Financeiro.");
                return;
            }
            modal.remove();
            await this.executeUnlockPerson(cpf_cnpj, price);
        };
    },

    executeUnlockPerson: async function(cpf_cnpj, price = 1) {
        window.Loading.show("Desbloqueando proprietário...", "Sincronizando com sua carteira...");
        
        try {
            const { error } = await window.supabaseApp.rpc('unlock_person_with_credits', {
                target_cpf_cnpj: cpf_cnpj,
                credit_cost: price
            });

            if (error) {
                // Se a função RPC ainda não existe, tentamos via insert direto (fallback temporário se as permissões permitirem)
                console.warn("RPC unlock_person_with_credits failed, trying direct insert fallback:", error);
                
                // Spend credits first
                const spent = await this.consumeCredits(price, `Desbloqueio de Proprietário: ${cpf_cnpj}`);
                if (!spent) throw new Error("Não foi possível debitar os créditos.");

                // Then insert to unlocked_persons
                const { data: { user } } = await window.supabaseApp.auth.getUser();
                const { error: insertError } = await window.supabaseApp.from('unlocked_persons').insert({
                    user_id: user.id,
                    cpf_cnpj: cpf_cnpj
                });
                
                if (insertError) throw insertError;
            }

            const clean = String(cpf_cnpj).replace(/\D/g, '');
            this.unlockedPersons.add(clean);
            this.updateBalanceUI();
            
            window.Toast.success("Proprietário desbloqueado com sucesso!");
            
            // Re-render tooltip 
            if (window.ProprietarioTooltip && window.ProprietarioTooltip.currentCpfCnpj === cpf_cnpj) {
                window.ProprietarioTooltip.show(cpf_cnpj);
            }
            
            // Dispatch event for other modules
            window.dispatchEvent(new CustomEvent('personUnlocked', { detail: { cpf_cnpj } }));

        } catch(e) {
             console.error("Unlock Person Error:", e);
             window.Toast.error("Erro ao desbloquear proprietário: " + e.message);
        } finally {
             window.Loading.hide();
        }
    },

    flyToUnlocked: async function(inscricao) {
        if (!window.map) return;
        window.Loading.show("Localizando imóvel...");
        try {
             const details = await window.fetchLotDetails(inscricao);
             if (details) {
                 window.map.panTo({ lat: details._lat, lng: details._lng });
                 window.map.setZoom(20);
                 window.showLotTooltip(details, 0, 0);
             } else {
                 window.Toast.error("Não foi possível carregar os detalhes do imóvel.");
             }
        } catch(e) { console.error(e); }
        finally { window.Loading.hide(); }
    }
};

// Auto-init when loaded
window.Monetization.init();

// Global aliases
// Removidos duplicados perigosos para evitar conflito com tooltip_handler
window.isUnitUnlocked = (id) => window.Monetization.isUnlocked(id);
