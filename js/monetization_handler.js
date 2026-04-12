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
        if (!cpf_cnpj) return false;
        const clean = String(cpf_cnpj).replace(/\D/g, '');
        
        // NOVO: Mesmo para Admin/Master, verificamos se o dado foi 'desbloqueado' na sessão atual.
        // Se quisermos que Admin veja TUDO direto (sem clicar no olho), voltamos o bypass.
        // Mas para fins de teste da 'máscara', deixamos ele passar pelo fluxo do olho.
        const role = String(this.userRole || 'user').toLowerCase();
        const isMaster = role === 'admin' || role === 'master';
        
        return this.unlockedPersons.has(clean) || (isMaster && window.DEBUG_MODE); 
        // Nota: DEBUG_MODE ou similar pode ser usado aqui se quisermos bypass automático em dev.
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
        const isVip    = role === 'vip'   || isMaster;
        const isElite  = role === 'elite' || isVip;
        const isPro    = role === 'pro'   || isElite;
        const isStart  = role === 'start' || isPro; // START: acesso a fichas mas sem recursos avançados

        if (window.isGuest) return false;
        
        switch (feature) {
            case 'unlock_lote':     return isStart; // Desbloquear fichas de imóveis
            case 'radar_mercado':   return isPro;   // Radar Farol (básico)
            case 'search_owner':    return isPro;   // Busca por proprietário
            case 'crm_history':     return isPro;   // CRM pessoal
            case 'advanced_ai':     return isElite; // Radar Farol completo
            case 'dossier_pdf': 
            case 'pdf_dossier':     return isElite; // Dossiê PDF automático
            case 'search_opportunity': return isElite; // Alertas de oportunidade
            case 'regional_insights':  return isElite; // Relatórios avançados
            case 'mapear_patrimonio':  return isElite;
            case 'link_cliente':    return isPro;
            case 'marketing_tools': return isPro;
            case 'owner_history':   return isElite;
            case 'edit_private':    return isPro;
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

            // [NOVO] Iniciar Monitor de Expiração de Assinatura
            this.startSubscriptionTimer();

            // Verifica se o perfil já foi marcado como completo para não incomodar o usuário
            if (!data.profile_completed && this.userRole !== 'master') {
                const missingFields = [];
                // Alguns usuários antigos/login social têm full_name. Novos têm broker_name. Checamos ambos.
                if ((!data.full_name || data.full_name.trim() === '') && (!data.broker_name || data.broker_name.trim() === '')) missingFields.push('name');
                if (!data.phone  || data.phone.trim()  === '') missingFields.push('phone');
                if (!data.cpf_cnpj || data.cpf_cnpj.trim() === '') missingFields.push('cpf_cnpj');

                if (missingFields.length > 0) {
                    console.log('⚠️ Campos faltando no perfil:', missingFields);
                    setTimeout(() => this.showProfileCompletionModal(missingFields), 1500);
                }
            }

            const isMaster = this.userRole === 'admin' || this.userRole === 'master';
            const isPro = this.canAccess('radar_mercado');

            // Mostrar botão Admin para masters (agora apontando para o contêiner do badge)
            const adminContainer = document.getElementById('admin-btn-container');
            if (adminContainer) adminContainer.style.display = isMaster ? 'inline-block' : 'none';

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

    // ================================================================
    //  MODAL DE COMPLETAR PERFIL (só campos faltantes)
    // ================================================================
    showProfileCompletionModal: function(missingFields = []) {
        // Evita abrir múltiplas vezes
        if (document.getElementById('profile-completion-modal')) return;

        // Mapa de campos: chave -> label, placeholder, type, mask
        const fieldDefs = {
            full_name: { label: 'Nome Completo',      placeholder: 'Ex: Bruno Giovani',          type: 'text',  mask: null },
            phone:     { label: 'WhatsApp / Telefone', placeholder: 'Ex: (13) 99999-9999',        type: 'tel',   mask: 'phone' },
            cpf_cnpj:  { label: 'CPF',                 placeholder: 'Ex: 000.000.000-00',         type: 'text',  mask: 'cpf' },
        };

        const fieldsHtml = missingFields.map(key => {
            const def = fieldDefs[key];
            if (!def) return '';
            return `
                <div style="margin-bottom: 16px;">
                    <label style="display:block; font-size:11px; font-weight:800; color:#94a3b8; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:6px;">
                        ${def.label} <span style="color:#ef4444">*</span>
                    </label>
                    <input
                        id="pcomp-${key}"
                        type="${def.type}"
                        placeholder="${def.placeholder}"
                        data-mask="${def.mask || ''}"
                        autocomplete="off"
                        style="width:100%; padding:12px 14px; border-radius:10px; border:1.5px solid rgba(255,255,255,0.1);
                               background:rgba(255,255,255,0.06); color:#e2e8f0; font-size:14px; outline:none;
                               transition: border-color 0.2s; box-sizing:border-box;"
                        onfocus="this.style.borderColor='#3b82f6'"
                        onblur="this.style.borderColor='rgba(255,255,255,0.1)'"
                    >
                </div>`;
        }).join('');

        const overlay = document.createElement('div');
        overlay.id = 'profile-completion-modal';
        overlay.style.cssText = `
            position: fixed; inset: 0;
            background: rgba(0,0,0,0.75);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            z-index: 1000000;
            display: flex; align-items: center; justify-content: center;
            padding: 20px; box-sizing: border-box;
            animation: fadeIn 0.3s ease;
        `;

        const plural = missingFields.length > 1 ? 's' : '';
        overlay.innerHTML = `
            <div style="
                background: linear-gradient(160deg, #0f172a 0%, #1e293b 100%);
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 20px;
                padding: 32px;
                width: 100%;
                max-width: 440px;
                box-shadow: 0 40px 80px rgba(0,0,0,0.6);
                animation: slideUp 0.35s cubic-bezier(0.16,1,0.3,1);
            ">
                <div style="text-align:center; margin-bottom:28px;">
                    <div style="width:56px;height:56px;background:linear-gradient(135deg,#3b82f6,#10b981);
                                border-radius:50%;display:flex;align-items:center;justify-content:center;
                                margin:0 auto 16px; font-size:24px;">
                        👤
                    </div>
                    <h2 style="margin:0 0 8px;color:#f8fafc;font-size:20px;font-weight:800;">
                        Complete seu Perfil
                    </h2>
                    <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.5;">
                        ${missingFields.length === 1
                            ? `O campo <b style="color:#e2e8f0">${fieldDefs[missingFields[0]]?.label}</b> está faltando.`
                            : `${missingFields.length} campo${plural} obrigatório${plural} estão faltando.`
                        }
                    </p>
                </div>

                ${fieldsHtml}

                <div id="pcomp-error" style="display:none;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);
                     border-radius:8px;padding:10px;color:#fca5a5;font-size:12px;margin-bottom:16px;"></div>

                <button
                    id="pcomp-save-btn"
                    onclick="window.Monetization.saveProfileCompletion()"
                    style="width:100%;padding:14px;border:none;border-radius:12px;
                           background:linear-gradient(135deg,#3b82f6,#10b981);
                           color:white;font-weight:800;font-size:15px;cursor:pointer;
                           transition:opacity 0.2s; box-shadow: 0 8px 20px rgba(59,130,246,0.3);"
                    onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">
                    Salvar e Continuar →
                </button>
            </div>
        `;

        document.body.appendChild(overlay);

        // Aplicar máscaras
        const phoneInput = document.getElementById('pcomp-phone');
        if (phoneInput) {
            phoneInput.addEventListener('input', (e) => {
                let v = e.target.value.replace(/\D/g, '').slice(0, 11);
                if (v.length > 2)  v = `(${v.slice(0,2)}) ${v.slice(2)}`;
                if (v.length > 10) v = v.slice(0,10) + '-' + v.slice(10);
                e.target.value = v;
            });
        }
        const cpfInput = document.getElementById('pcomp-cpf_cnpj');
        if (cpfInput) {
            cpfInput.addEventListener('input', (e) => {
                let v = e.target.value.replace(/\D/g, '').slice(0, 11);
                if (v.length > 9)       v = `${v.slice(0,3)}.${v.slice(3,6)}.${v.slice(6,9)}-${v.slice(9)}`;
                else if (v.length > 6)  v = `${v.slice(0,3)}.${v.slice(3,6)}.${v.slice(6)}`;
                else if (v.length > 3)  v = `${v.slice(0,3)}.${v.slice(3)}`;
                e.target.value = v;
            });
        }

        // Guarda quais campos precisam ser salvos
        overlay._missingFields = missingFields;
    },

    saveProfileCompletion: async function() {
        const overlay = document.getElementById('profile-completion-modal');
        if (!overlay) return;

        const missingFields = overlay._missingFields || [];
        const updates = { profile_completed: true };
        const errorEl = document.getElementById('pcomp-error');

        // Coleta e valida cada campo
        for (const key of missingFields) {
            const input = document.getElementById(`pcomp-${key}`);
            const val = input?.value?.trim() || '';

            if (!val) {
                errorEl.innerText = `O campo "${input?.placeholder || key}" é obrigatório.`;
                errorEl.style.display = 'block';
                input?.focus();
                return;
            }

            if (key === 'cpf_cnpj') {
                const clean = val.replace(/\D/g, '');
                if (window.validateCPF && !window.validateCPF(clean)) {
                    errorEl.innerText = 'CPF inválido. Verifique o número digitado.';
                    errorEl.style.display = 'block';
                    input?.focus();
                    return;
                }
                updates[key] = clean;
            } else if (key === 'phone') {
                updates[key] = val.replace(/\D/g, '');
            } else {
                updates[key] = val;
            }
        }

        const saveBtn = document.getElementById('pcomp-save-btn');
        if (saveBtn) { saveBtn.disabled = true; saveBtn.innerText = 'Salvando...'; }

        try {
            const { data: { user } } = await window.supabaseApp.auth.getUser();
            const { error } = await window.supabaseApp
                .from('profiles')
                .update(updates)
                .eq('id', user.id);

            if (error) throw error;

            // Atualiza o perfil local
            Object.assign(this.userProfile, updates);

            overlay.style.animation = 'fadeOut 0.3s ease forwards';
            setTimeout(() => overlay.remove(), 300);

            if (window.Toast) window.Toast.success('✅ Perfil atualizado com sucesso!');
        } catch (e) {
            console.error('Erro ao salvar perfil:', e);
            errorEl.innerText = 'Erro ao salvar: ' + e.message;
            errorEl.style.display = 'block';
            if (saveBtn) { saveBtn.disabled = false; saveBtn.innerText = 'Salvar e Continuar →'; }
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

        window.Loading.show("Salvando...", "Verificando integridade e salvando perfil");

        try {
            // 1. Verificar se esse CPF/CNPJ já está em uso por outro ID
            const { data: { user } } = await window.supabaseApp.auth.getUser();
            
            const { data: existingDoc } = await window.supabaseApp
                .from('profiles')
                .select('id')
                .eq('cpf_cnpj', documentVal)
                .neq('id', user.id) // Ignora o próprio usuário
                .maybeSingle();

            if (existingDoc) {
                window.Loading.hide();
                window.Toast.error("⚠️ Este CPF/CNPJ já está vinculado a outro corretor.");
                return;
            }

            // 2. Proceder com o update
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
            document.getElementById('profile-completion-modal')?.remove();
            
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
        const defaultLimits = { user: 0, start: 15, pro: 40, elite: 100, vip: 120, master: 10000, admin: Infinity };
        const defaultLabels = { user: 'Gratuito', start: 'Start', pro: 'Pro', elite: 'Elite', vip: 'Anual VIP', master: 'Master', admin: 'Master' };
        
        const role = this.userRole || 'user';
        
        let limit = defaultLimits[role] ?? 0;
        let label = defaultLabels[role] ?? 'Gratuito';
        
        if (this.plansConfig && this.plansConfig[role]) {
            limit = this.plansConfig[role].credits ?? limit;
            label = this.plansConfig[role].name ?? label;
        }

        const colors = {
            user:   '#64748b',
            start:  '#0d9488',
            pro:    '#2563eb',
            elite:  '#7c3aed',
            vip:    '#1e293b',
            master: '#b45309',
            admin:  '#b45309'
        };
        
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
            // NOTA: Passamos a inscrição ORIGINAL (com os pontos/traços) para o RPC.
            // Limpar os IDs (\D) causava bugs de incompatibilidade ao carregar a Carteira, 
            // pois a tabela de unidades/lotes mantém a formatação da inscrição oficial original.
            const cleanLote = String(loteInscricao || '');
            const cleanUnit = unitId ? String(unitId) : null;
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
                const errorStr = JSON.stringify({
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    code: error.code,
                    rpc_params: { target_lote: cleanLote, target_unidade: cleanUnit, weight: price }
                }, null, 2);
                
                console.error("❌ [Monetization] RPC Error Details:", errorStr);
                
                let userFriendlyMsg = "Erro no servidor: " + (error.message || "Falha ao registrar desbloqueio");
                if (error.code === 'P0001') userFriendlyMsg = "Erro nas Regras de Negócio: " + error.message;
                if (error.code === '57014' || error.message === 'FetchError') userFriendlyMsg = "O servidor demorou muito para responder (Timeout/CORS).";
                
                window.Toast.error(userFriendlyMsg);
                throw error;
            }

            if (data === false) {
                console.warn("⚠️ [Monetization] RPC returned FALSE (Business logic rejected the unlock)");
                window.Toast.error("Desbloqueio não permitido. Verifique seu saldo ou se este item já foi liberado.");
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

    showPixOptions: function() {
        // STRIPE KEYS (TEST - SANDBOX)
        const STRIPE_PK = 'pk_test_51TI0jtDABJhsHWnXjh9pUIz8kvuPYtBXC6GJLrYfuKnloUNHTI9ur7gmDk0xepYsgCxdv2CDFCfnnRo8AFkY60db00rPtzlas9';
        // STRIPE_SK removida para segurança
        
        const modal = document.createElement('div');
        modal.className = 'custom-modal-overlay active';
        modal.style.zIndex = '10020';
        
        modal.innerHTML = `
            <div class="custom-modal" style="max-width: 500px;">
                <div class="custom-modal-header" style="background: #6366f1; color: white;">
                    <div class="custom-modal-title"><i class="fas fa-shopping-cart"></i> Adquirir Créditos / Assinatura</div>
                    <button class="custom-modal-close" onclick="this.closest('.custom-modal-overlay').remove()">&times;</button>
                </div>
                <div class="custom-modal-body" style="padding: 25px;">
                    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 15px; border-radius: 12px; margin-bottom: 20px; font-size: 13px; color: #166534; display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-shield-check" style="font-size: 24px;"></i>
                        <span>Pagamento 100% Seguro via <strong>Stripe</strong>. Aceitamos Cartão de Crédito e PIX.</span>
                    </div>

                    <div style="display: grid; gap: 15px;">
                        <button onclick="window.Monetization.initStripeCheckout('price_1TI_LIVE_50')" class="btn-primary-rich" style="padding: 15px; background: #1e293b; text-align: left; position: relative;">
                            <div style="font-weight: 800; font-size: 14px;">50 Créditos (Avulso)</div>
                            <div style="font-size: 11px; opacity: 0.8;">R$ 49,90 • Sem recorrência</div>
                        </button>
                        <button onclick="window.Monetization.showSubscriptionPlans()" class="btn-primary-rich" style="padding: 15px; background: #6366f1; text-align: left; position: relative;">
                            <div style="font-weight: 800; font-size: 14px;">Mudar para Plano Mensal</div>
                            <div style="font-size: 11px; opacity: 0.8;">A partir de R$ 97,00/mês</div>
                            <i class="fas fa-crown" style="position: absolute; right: 15px; top: 18px; opacity: 0.3;"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    /**
     * NOVO: Desbloqueio direto de pessoa física/jurídica (via Proprietário Tooltip)
     */
    promptUnlockPerson: async function(personCpfCnpj, personName) {
        if (!personCpfCnpj || personCpfCnpj.startsWith('S_PJ_')) {
            window.Toast.info("Dados públicos restritos ou já liberados.");
            return;
        }

        const isUnlocked = this.isUnlockedPerson(personCpfCnpj);
        if (isUnlocked) {
            window.Toast.info("Este proprietário já está desbloqueado em sua conta.");
            return;
        }

        const credits = this.userProfile?.credits || 0;
        const required = 5; // Custo padrão para Pessoa
        
        if (credits < required && !this.canAccess('radar_mercado')) {
            this.showInsufficientCreditsModal(required);
            return;
        }

        const confirms = confirm(`Deseja desbloquear os dados completos de "${personName}"?\n\nCusto: ${required} créditos.`);
        if (!confirms) return;

        window.Loading.show("Desbloqueando...", "Liberando dados do proprietário");
        try {
            const { data, error } = await window.supabaseApp.rpc('unlock_person_data', {
                target_cpf_cnpj: personCpfCnpj.replace(/\D/g, '')
            });

            if (error) throw error;
            if (data) {
                window.Toast.success("Dados do proprietário liberados com sucesso!");
                // Refresh Profile
                if (window.ProprietarioTooltip && window.ProprietarioTooltip.currentPropId) {
                    window.ProprietarioTooltip.show(window.ProprietarioTooltip.currentPropId);
                }
            } else {
                window.Toast.error("Não foi possível processar o débito.");
            }
        } catch (e) {
            console.error("Unlock Person Error:", e);
            window.Toast.error("Falha ao desbloquear: " + (e.message || "Erro desconhecido"));
        } finally {
            window.Loading.hide();
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
        const cfg = this.plansConfig || {};

        const isCurrentPlan = (r) => currentRole === r;
        const currentBadge  = (r) => isCurrentPlan(r)
            ? `<div style="position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:#10b981;color:white;padding:4px 12px;border-radius:20px;font-size:10px;font-weight:800;white-space:nowrap;">✓ SEU PLANO</div>`
            : '';

        // Helper: monta preço com riscado se promo ativa
        const priceHTML = (role, billingLabel) => {
            const p = cfg[role] || {};
            const promo   = p.promo_active && p.promo_price && p.price_tabela;
            const display = promo ? p.promo_price : (p.price || 0);
            const tabela  = p.price_tabela || 0;
            const promoTag = promo
                ? `<span style="text-decoration:line-through;opacity:0.45;font-size:13px;font-weight:400;margin-right:4px;">R$${tabela}</span>` : '';
            return `<div style="font-size:24px;font-weight:800;color:#1e293b;margin:10px 0;">
                        ${promoTag}R$ ${display}<small style="font-size:13px;font-weight:400;">/${billingLabel}</small>
                    </div>`;
        };

        const fichas = (role, def) => (cfg[role]?.credits ?? def);
        const planName = (role, def) => (cfg[role]?.name ?? def);

        const modal = document.createElement('div');
        modal.className = 'custom-modal-overlay active';
        modal.style.zIndex = '10020';
        modal.innerHTML = `
            <div class="custom-modal" style="max-width:980px;width:95%;">
                <div class="custom-modal-header" style="background:#1e293b;color:white;">
                    <div class="custom-modal-title"><i class="fas fa-crown"></i> Planos GuaruGeo</div>
                    <button class="custom-modal-close" onclick="this.closest('.custom-modal-overlay').remove()">&times;</button>
                </div>
                <div class="custom-modal-body" style="padding:24px 30px 30px;background:#f8fafc;">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
                        <div style="font-size:13px;color:#475569;">
                            Seu plano: <strong style="color:#1e293b;">${currentRole.charAt(0).toUpperCase()+currentRole.slice(1)}</strong>
                        </div>
                        <div style="font-size:13px;color:#475569;">
                            Créditos disponíveis: <strong style="color:#f59e0b;">${credits} 🪙</strong>
                        </div>
                    </div>
                    <div class="plans-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(185px,1fr));gap:14px;">

                        <!-- Gratuito -->
                        <div style="background:white;border:${isCurrentPlan('user')?'2px solid #10b981':'1px solid #e2e8f0'};border-radius:16px;padding:20px;display:flex;flex-direction:column;position:relative;transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                            ${currentBadge('user')}
                            <div style="font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;">Gratuito</div>
                            <div style="font-size:24px;font-weight:800;color:#1e293b;margin:10px 0;">R$ 0</div>
                            <ul style="list-style:none;padding:0;margin:12px 0;font-size:12px;color:#475569;flex:1;line-height:1.9;">
                                <li>✅ Mapa base interativo</li>
                                <li>✅ Dados básicos do lote</li>
                                <li>❌ Fichas de imóveis</li>
                                <li>❌ Radar Farol</li>
                            </ul>
                            <button onclick="this.closest('.custom-modal-overlay').remove()" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;background:white;font-weight:700;cursor:pointer;font-size:12px;">Continuar Grátis</button>
                        </div>

                        <!-- START -->
                        <div style="background:white;border:${isCurrentPlan('start')?'2px solid #10b981':'2px solid #0d9488'};border-radius:16px;padding:20px;display:flex;flex-direction:column;position:relative;transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                            ${currentBadge('start')}
                            <div style="font-size:11px;font-weight:800;color:#0d9488;text-transform:uppercase;">${planName('start','START')}</div>
                            ${priceHTML('start','mês')}
                            <ul style="list-style:none;padding:0;margin:12px 0;font-size:12px;color:#475569;flex:1;line-height:1.9;">
                                <li>✅ <b>${fichas('start',15)} fichas/mês</b></li>
                                <li>✅ Desbloquear imóveis</li>
                                <li>✅ Dados de proprietário</li>
                                <li>❌ Radar Farol</li>
                                <li>❌ Dossiê PDF</li>
                            </ul>
                            <button onclick="window.Monetization.startSubscription('start')" style="width:100%;padding:10px;border:none;border-radius:8px;background:#0d9488;color:white;font-weight:700;cursor:pointer;font-size:12px;box-shadow:0 4px 12px rgba(13,148,136,0.3);">Assinar ${planName('start','START')}</button>
                        </div>

                        <!-- PRO -->
                        <div style="background:white;border:${isCurrentPlan('pro')?'2px solid #10b981':'2px solid #2563eb'};border-radius:16px;padding:20px;display:flex;flex-direction:column;position:relative;transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                            ${currentBadge('pro')}
                            ${!isCurrentPlan('pro')&&!isCurrentPlan('elite')&&!isCurrentPlan('vip')&&!isCurrentPlan('master')&&!isCurrentPlan('admin')&&!isCurrentPlan('start')
                                ? `<div style="position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:#2563eb;color:white;padding:4px 12px;border-radius:20px;font-size:10px;font-weight:800;">MAIS VENDIDO</div>` : ''}
                            <div style="font-size:11px;font-weight:800;color:#2563eb;text-transform:uppercase;">${planName('pro','PRO')}</div>
                            ${priceHTML('pro','mês')}
                            <ul style="list-style:none;padding:0;margin:12px 0;font-size:12px;color:#475569;flex:1;line-height:1.9;">
                                <li>✅ <b>${fichas('pro',40)} fichas/mês</b></li>
                                <li>✅ Radar Farol (básico)</li>
                                <li>✅ Busca por proprietário</li>
                                <li>✅ CRM pessoal</li>
                                <li>❌ Dossiê PDF</li>
                            </ul>
                            <button onclick="window.Monetization.startSubscription('pro')" style="width:100%;padding:10px;border:none;border-radius:8px;background:#2563eb;color:white;font-weight:700;cursor:pointer;font-size:12px;box-shadow:0 4px 12px rgba(37,99,235,0.3);">Assinar ${planName('pro','PRO')}</button>
                        </div>

                        <!-- ELITE -->
                        <div style="background:linear-gradient(160deg,#faf5ff,#ede9fe);border:${isCurrentPlan('elite')?'2px solid #10b981':'2px solid #7c3aed'};border-radius:16px;padding:20px;display:flex;flex-direction:column;position:relative;transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                            ${currentBadge('elite')}
                            ${!isCurrentPlan('elite') ? `<div style="position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:#f59e0b;color:#1e293b;padding:4px 12px;border-radius:20px;font-size:10px;font-weight:800;">COMPLETO</div>` : ''}
                            <div style="font-size:11px;font-weight:800;color:#7c3aed;text-transform:uppercase;">${planName('elite','ELITE')}</div>
                            ${priceHTML('elite','mês')}
                            <ul style="list-style:none;padding:0;margin:12px 0;font-size:12px;color:#475569;flex:1;line-height:1.9;">
                                <li>✅ <b>${fichas('elite',100)} fichas/mês</b></li>
                                <li>✅ Radar Farol completo</li>
                                <li>✅ Dossiê PDF automático</li>
                                <li>✅ Alertas de oportunidade</li>
                                <li>✅ Relatórios avançados</li>
                            </ul>
                            <button onclick="window.Monetization.startSubscription('elite')" style="width:100%;padding:10px;border:none;border-radius:8px;background:#7c3aed;color:white;font-weight:700;cursor:pointer;font-size:12px;box-shadow:0 4px 12px rgba(124,58,237,0.3);">Assinar ${planName('elite','ELITE')}</button>
                        </div>

                        <!-- ANUAL VIP -->
                        <div style="background:#1e293b;border:${isCurrentPlan('vip')?'2px solid #10b981':'1px solid #334155'};border-radius:16px;padding:20px;display:flex;flex-direction:column;color:white;position:relative;transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                            ${currentBadge('vip')}
                            <div style="font-size:11px;font-weight:800;color:#94a3b8;text-transform:uppercase;">${planName('vip','ANUAL VIP')}</div>
                            ${(() => {
                                const p = cfg['vip'] || {};
                                const promo = p.promo_active && p.promo_price && p.price_tabela;
                                const display = promo ? p.promo_price : (p.price || 2990);
                                const tabela  = p.price_tabela || 4990;
                                
                                if (promo) {
                                    const discPercent = Math.round((1 - (display / tabela)) * 100);
                                    return `
                                        <div style="margin: 15px 0;">
                                            <div style="display: flex; align-items: baseline; gap: 8px; opacity: 0.5;">
                                                <span style="font-size: 16px; text-decoration: line-through; font-weight: 400;">R$ ${tabela}</span>
                                                <span style="background: #10b981; color: white; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 4px;">${discPercent}% OFF</span>
                                            </div>
                                            <div style="font-size: 32px; font-weight: 900; color: white; display: flex; align-items: baseline; gap: 4px; line-height: 1.1; margin-top: 5px;">
                                                <span style="font-size: 20px;">R$</span> 
                                                <span>${display}</span>
                                                <small style="font-size: 13px; font-weight: 400; opacity: 0.7;">/ano</small>
                                            </div>
                                        </div>
                                    `;
                                }
                                return `<div style="font-size: 28px; font-weight: 800; color: white; margin: 15px 0; display: flex; align-items: baseline; gap: 6px;">
                                    <span style="font-size: 18px;">R$</span> ${display}<small style="font-size: 13px; font-weight: 400; opacity: 0.7;">/ano</small>
                                </div>`;
                            })()}
                            <ul style="list-style:none;padding:0;margin:12px 0;font-size:12px;opacity:0.9;flex:1;line-height:1.9;">
                                <li>✅ <b>${fichas('vip',120)} fichas/mês</b></li>
                                <li>✅ Radar Farol completo</li>
                                <li>✅ Dossiê PDF automático</li>
                                <li>✅ Suporte prioritário</li>
                                <li>✅ Melhor custo-benefício</li>
                            </ul>
                            <button onclick="window.Monetization.startSubscription('vip')" style="width:100%;padding:10px;border:none;border-radius:8px;background:white;color:#1e293b;font-weight:700;cursor:pointer;font-size:12px;">Assinar Anual VIP</button>
                        </div>
                    </div>

                    ${(this.userProfile?.stripe_customer_id || this.userRole !== 'user') ? `
                    <div style="text-align:center;margin-top:20px;padding:15px;background:#f1f5f9;border-radius:12px;border:1px dashed #cbd5e1;">
                        <span style="font-size:12px;color:#475569;">Já possui uma assinatura ativa?</span>
                        <button onclick="window.Monetization.initStripePortal()" style="background:none;border:none;color:#2563eb;font-weight:800;font-size:12px;cursor:pointer;margin-left:5px;text-decoration:underline;">
                            <i class="fas fa-external-link-alt"></i> Gerenciar Assinatura & Faturas
                        </button>
                    </div>
                    ` : ''}
                    <div style="text-align:center;margin-top:20px;padding-top:16px;border-top:1px solid #e2e8f0;">
                        <div style="font-size:12px;color:#94a3b8;margin-bottom:8px;">Ou compre fichas avulsas (sem assinatura):</div>
                        <span style="font-size:12px;color:#2563eb;text-decoration:underline;cursor:pointer;" onclick="window.Monetization.showPixOptions();this.closest('.custom-modal-overlay').remove();">
                            10 fichas = R$ 69,90 &nbsp;·&nbsp; 30 fichas = R$ 149,90 &nbsp;·&nbsp; 100 fichas = R$ 399,90
                        </span>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },



    startSubscription: async function(plan) {
        console.log("💳 Iniciando fluxo de assinatura para o plano:", plan);
        
        const userId = this.userProfile?.id;
        if (!userId) {
            window.Toast.error("Usuário não identificado. Por favor, faça login novamente.");
            return;
        }

        const checkoutMap = {
            'start': 'https://buy.stripe.com/7sY4gz8ANg8ogqOe2l7EQ00',
            'pro':   'https://buy.stripe.com/3cI6oH2cpbS8deC0bv7EQ01',
            'elite': 'https://buy.stripe.com/bJe3cv8ANcWc2zY9M57EQ02',
            'vip':   'https://buy.stripe.com/dRm7sL9ERf4ka2qf6p7EQ03'
        };

        const baseLink = checkoutMap[plan];
        if (!baseLink) {
            window.Toast.error("Link de checkout não configurado para este plano.");
            return;
        }

        window.Loading.show("Iniciando Checkout...", "Abrindo ambiente seguro do Stripe");

        try {
            // Obter e-mail atual para preenchimento (UX)
            const { data: { user } } = await window.supabaseApp.auth.getUser();
            const email = user?.email || '';

            // Construir URL com parâmetros
            const url = new URL(baseLink);
            url.searchParams.set('client_reference_id', userId);
            if (email) url.searchParams.set('prefilled_email', email);
            
            // Opcional: success_url se os links permitirem override
            // url.searchParams.set('success_url', 'https://guarujainterativo.com.br/?payment=success');

            console.log("🚀 Redirecionando para Stripe:", url.toString());
            
            // Log de intenção no banco (Opcional, para auditoria)
            await window.supabaseApp.from('checkout_logs').insert({
                user_id: userId,
                plano: plan,
                url_final: url.toString(),
                status: 'redirected'
            }).select().maybeSingle();

            // Redirecionamento completo
            window.location.href = url.toString();

        } catch (e) {
            window.Loading.hide();
            console.error("Erro ao preparar checkout:", e);
            // Se falhar o log ou o auth, ainda assim tentamos redirecionar com o ID que já temos
            window.location.href = `${baseLink}?client_reference_id=${userId}`;
        }
    },

    initStripeCheckout: async function(priceId) {
        if (!window.Stripe) {
            window.Toast.error("Erro: SDK do Stripe não carregado.");
            return;
        }

        const stripePK = window.CONFIG.STRIPE_PUBLISHABLE_KEY || 'pk_test_...';
        const stripe = window.Stripe(stripePK);
        
        window.Loading.show("Abrindo Pagamento...", "Conectando ao Ambiente Seguro do Stripe");

        try {
            console.log("🚀 Invocando Edge Function 'stripe-checkout' para:", priceId);
            
            // Bruno, aqui chamamos sua Edge Function (você fará o deploy manual)
            const { data, error } = await window.supabaseApp.functions.invoke('stripe-checkout', {
                body: { 
                    priceId: priceId,
                    return_url: window.location.origin + '?payment=success'
                }
            });

            if (error) throw error;

            if (data?.url) {
                // Redirecionamento completo (Melhor UX)
                window.location.href = data.url;
            } else {
                throw new Error("Sessão de checkout não gerada.");
            }

        } catch (e) {
            window.Loading.hide();
            console.error("Stripe Checkout Error:", e);
            window.Toast.error("Erro no Checkout: " + (e.message || "Tente novamente mais tarde."));
        }
    },

    // Nova funcionalidade: Gerenciar Assinatura (Portal do Cliente)
    initStripePortal: async function() {
        window.Loading.show("Abrindo Portal...", "Verificando sessão segura...");
        
        try {
            // 1. Garantir que a sessão está fresca (Refresh JWT)
            const { data: { session }, error: sessionErr } = await window.supabaseApp.auth.getSession();
            if (sessionErr || !session) {
                throw new Error("Sessão expirada. Por favor, saia e entre novamente no sistema.");
            }

            console.log("🔐 Sessão validada para:", session.user.email);
            
            // 2. Invocar a Edge Function com o token atualizado
            const { data, error } = await window.supabaseApp.functions.invoke('create-portal-session', {
                body: { return_url: window.location.href } 
            });

            if (error) {
                if (error.status === 401) {
                    throw new Error("Erro de Autenticação (401): O servidor do Supabase não reconheceu seu login. Tente fazer logout e login novamente.");
                }
                throw error;
            }

            if (data?.url) {
                window.location.href = data.url;
            } else {
                throw new Error("Resposta inválida do servidor de faturamento.");
            }
        } catch (e) {
            console.error("🔥 Erro no Portal:", e);
            window.Loading.hide();
            
            let userMsg = e.message || "Tente novamente mais tarde.";
            if (userMsg.includes('Failed to fetch') || userMsg.includes('ERR_NAME_NOT_RESOLVED')) {
                userMsg = "Erro de Rede/DNS: Não foi possível carregar a Stripe. DESATIVE SEU ADBLOCKER e verifique sua conexão.";
            }
            
            window.Toast.error(userMsg, "Falha no Portal");
        }
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
                    
                    <a href="https://wa.me/5513992058836?text=${encodeURIComponent('Olá Bruno, quero assinar o plano ' + plan.toUpperCase() + ' via Cartão no Guaruja Interativo.')}" 
                       target="_blank"
                       class="btn-secondary-rich" 
                       style="width: 100%; background: #16a34a; color: white; height: 48px; display: flex; align-items: center; justify-content: center; gap: 8px; text-decoration: none; border-radius: 8px; font-weight: 700; box-shadow: 0 4px 12px rgba(22,163,74,0.3); transition: transform 0.2s;"
                       onmouseover="this.style.transform='scale(1.02)'"
                       onmouseout="this.style.transform='scale(1)'">
                        <i class="fab fa-whatsapp"></i> 💳 Pagar com Cartão (WhatsApp)
                    </a>

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

            // 2. Fetch PERSONS with names (CORREÇÃO ERRO 400 - JOIN COM PROPRIETARIOS)
            const { data: personUnlocks, error: personError } = await window.supabaseApp
                .from('unlocked_persons')
                .select('*, proprietarios!unlocked_persons_cpf_cnpj_fkey(nome_completo)')
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
                        lot = window.allLotes.find(l => {
                            const dbId = String(item.lote_inscricao || '').replace(/\D/g, '');
                            const memoryId = String(l.inscricao || '').replace(/\D/g, '');
                            return memoryId === dbId;
                        });
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
    },

    // ==========================================
    // [NOVO] SUBSCRIPTION TIMER ENGINE
    // ==========================================
    
    startSubscriptionTimer: function() {
        if (this._subInterval) clearInterval(this._subInterval);
        
        const updateWidget = () => {
            const expiresAt = this.userProfile?.subscription_expires_at;
            const container = document.getElementById('subscription-timer-container');
            if (!container) return;

            if (!expiresAt) {
                container.innerHTML = '';
                return;
            }

            const now = new Date();
            const end = new Date(expiresAt);
            const diff = end - now;

            if (diff <= 0) {
                // EXPIROU!
                if (this.userRole !== 'user' && this.userRole !== 'master' && this.userRole !== 'admin') {
                    console.warn("⚠️ Assinatura expirada! Executando downgrade...");
                    this.handleSubscriptionExpiration();
                }
                container.innerHTML = `
                    <div style="margin: 0 24px 20px; padding: 12px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; display: flex; align-items: center; gap: 10px;">
                        <div style="width: 32px; height: 32px; background: #ef4444; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white;">
                            <i class="fas fa-history"></i>
                        </div>
                        <div>
                            <div style="font-size: 10px; font-weight: 800; color: #ef4444; text-transform: uppercase;">Acesso Expirado</div>
                            <div style="font-size: 11px; color: #7f1d1d; font-weight: 600;">Renove para continuar usando</div>
                        </div>
                    </div>
                `;
                return;
            }

            // Converter para formato legível
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const secs = Math.floor((diff % (1000 * 60)) / 1000);

            const displayTime = hours > 24 
                ? `${Math.floor(hours/24)}d ${hours%24}h ${mins}m`
                : `${String(hours).padStart(2,'0')}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;

            container.innerHTML = `
                <div style="margin: 0 24px 10px; padding: 12px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 15px; display: flex; align-items: center; gap: 12px; box-shadow: 0 4px 12px rgba(37,99,235,0.08);">
                    <div style="width: 38px; height: 38px; background: #2563eb; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; animation: pulseTiny 2s infinite;">
                        <i class="fas fa-hourglass-half"></i>
                    </div>
                    <div style="flex: 1;">
                        <div style="font-size: 9px; font-weight: 800; color: #2563eb; text-transform: uppercase; letter-spacing: 0.5px;">Acesso Liberado</div>
                        <div style="font-size: 14px; font-weight: 900; color: #1e3a8a; font-family: monospace;">${displayTime}</div>
                    </div>
                </div>
                <style>
                    @keyframes pulseTiny {
                        0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(37,99,235,0.4); }
                        70% { transform: scale(1.05); box-shadow: 0 0 0 8px rgba(37,99,235,0); }
                        100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(37,99,235,0); }
                    }
                </style>
            `;
        };

        this._subInterval = setInterval(updateWidget, 1000);
        updateWidget();
    },

    handleSubscriptionExpiration: async function() {
        if (this._expiring) return;
        this._expiring = true;

        try {
            const { data: { user } } = await window.supabaseApp.auth.getUser();
            if (!user) return;

            // Downgrade no Banco
            await window.supabaseApp
                .from('profiles')
                .update({ 
                    role: 'user', 
                    subscription_expires_at: null 
                })
                .eq('id', user.id);

            window.Toast.info("🕒 Seu período de acesso temporário expirou. Retornando ao plano básico.");
            
            // Recarregar perfil para atualizar UI global
            setTimeout(() => window.location.reload(), 3000);
        } catch (e) {
            console.error("Erro no downgrade automático:", e);
        } finally {
            this._expiring = false;
        }
    }
};

// Auto-init when loaded
window.Monetization.init();

// Global aliases
// Removidos duplicados perigosos para evitar conflito com tooltip_handler
window.isUnitUnlocked = (id) => window.Monetization.isUnlocked(id);
