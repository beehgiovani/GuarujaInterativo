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

    init: async function() {
        console.log("💰 Monetization Handler Initializing...");
        await this.loadUserProfile();
        await this.loadUnlocks();
        await this.loadPixConfig();
        this.updateBalanceUI();
        
        // Dispatch event for other handlers to know tiers are ready
        window.dispatchEvent(new CustomEvent('monetizationReady', { detail: { role: this.userRole } }));
    },

    canAccess: function(feature) {
        const role = String(this.userRole || 'user').toLowerCase();
        const isMaster = role === 'admin' || role === 'master';
        const isElite = role === 'elite' || isMaster;
        const isPro = role === 'pro' || isElite;

        switch (feature) {
            case 'radar_mercado': return isPro;
            case 'dossier_pdf': 
            case 'pdf_dossier': return isElite;
            case 'mapear_patrimonio': return isElite;
            case 'link_cliente': return isPro;
            case 'crm_history': return isPro;
            case 'advanced_ai': return isPro; // Farol IA
            case 'legal_checkup': return isElite; // Due Diligence logic
            case 'marketing_tools': return isPro;
            case 'regional_insights': return isElite;
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

    loadUserProfile: async function() {
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

    // Limites mensais por tier (calculados para ROI > 2x com custo de R$ 2.00/ficha)
    getTierLimits: function() {
        const limits = { user: 0, pro: 30, elite: 80, master: 110, admin: Infinity };
        const labels = { user: 'Gratuito', pro: 'Pro', elite: 'Elite', master: 'Master', admin: 'Master' };
        const colors = { user: '#64748b', pro: '#2563eb', elite: '#7c3aed', master: '#b45309', admin: '#b45309' };
        const role = this.userRole || 'user';
        return {
            limit: limits[role] ?? 0,
            label: labels[role] ?? 'Gratuito',
            color: colors[role] ?? '#64748b'
        };
    },

    // Renderiza o widget de plano na barra de créditos
    renderPlanWidget: function() {
        const el = document.getElementById('user-credits-display');
        if (!el) return;

        const { limit, label, color } = this.getTierLimits();
        const credits = this.userProfile?.credits || 0;
        const isFree = this.userRole === 'user';
        const isUnlimited = limit === Infinity;

        // Fichas usadas no mês: calculado como créditos comprados menos saldo atual
        // Simplificado: mostramos o saldo de créditos + badge do tier
        el.onclick = () => window.Monetization.showSubscriptionPlans();
        el.title = `Plano ${label} • Clique para ver planos`;
        el.innerHTML = `
            <span style="
                display: inline-flex; align-items: center; gap: 5px;
                background: ${color}18; border: 1px solid ${color}40;
                border-radius: 20px; padding: 4px 10px;
                font-size: 11px; font-weight: 800; color: ${color};
                cursor: pointer; transition: all 0.2s;
            " onmouseover="this.style.background='${color}28'" onmouseout="this.style.background='${color}18'">
                ${isUnlimited ? '👑' : isFree ? '🔐' : '⭐'}
                ${label}
            </span>
            <span style="font-size: 11px; font-weight: 700; color: #1e293b; display: flex; align-items: center; gap: 3px;">
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
            const { data: lotUnlocks, error: lotError } = await window.supabaseApp.from('unlocked_lots').select('lote_inscricao').eq('user_id', user.id);
            const { data: edits } = await window.supabaseApp.from('user_lote_edits').select('lote_inscricao').eq('user_id', user.id);
            const { data: unitEdits } = await window.supabaseApp.from('user_unit_edits').select('unit_inscricao').eq('user_id', user.id);

            const clean = (id) => id ? String(id).replace(/\D/g, '') : '';
            this.unlockedLots = new Set();
            
            (lotUnlocks || []).forEach(row => this.unlockedLots.add(clean(row.lote_inscricao)));
            (edits || []).forEach(row => this.unlockedLots.add(clean(row.lote_inscricao)));
            (unitEdits || []).forEach(row => {
                const uId = clean(row.unit_inscricao);
                this.unlockedLots.add(uId);
                if (uId.length >= 11) this.unlockedLots.add(uId.substring(0, 8));
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

    isUnlocked: function(inscricao, lotInscricao = null) {
        if (this.userRole === 'admin' || this.userRole === 'master') return true;
        
        const clean = (id) => id ? String(id).replace(/\D/g, '') : '';
        const cInsc = clean(inscricao);
        const cLot = clean(lotInscricao);

        // Check lots
        if (cLot && this.unlockedLots.has(cLot)) return true;
        if (cInsc && this.unlockedLots.has(cInsc)) return true;
        
        // Check persons (fallback search in unlockedLots set just in case, or direct clean)
        if (this.unlockedPersons.has(cInsc)) return true;

        for (let unlocked of this.unlockedLots) {
            const cUnlocked = clean(unlocked);
            if (!cUnlocked) continue;
            if (cInsc.startsWith(cUnlocked) || cUnlocked.startsWith(cInsc)) return true;
        }
        
        return false;
    },

    isUnlockedPerson: function(cpf_cnpj) {
        if (this.userRole === 'admin' || this.userRole === 'master') return true;
        if (!cpf_cnpj) return false;
        const clean = String(cpf_cnpj).replace(/\D/g, '');
        return this.unlockedPersons.has(clean);
    },

    isEliteOrAbove: function() {
        const role = String(this.userRole || 'user').toLowerCase();
        return ['admin', 'master', 'elite'].includes(role);
    },

    promptUnlockLote: function(loteInscricao, unitId, price = 1) {
        if (this.isUnlocked(loteInscricao)) return true;
        
        const modal = document.createElement('div');
        modal.className = 'custom-modal-overlay active';
        modal.style.zIndex = '10020';
        modal.innerHTML = `
            <div class="custom-modal" style="max-width: 400px; text-align: center;">
                <div class="custom-modal-header" style="background: #1e293b; color: white;">
                    <div class="custom-modal-title"><i class="fas fa-lock-open"></i> Desbloquear Informações</div>
                    <button class="custom-modal-close" onclick="this.closest('.custom-modal-overlay').remove()">&times;</button>
                </div>
                <div class="custom-modal-body" style="padding: 30px;">
                    <div style="font-size: 40px; margin-bottom: 15px; color: #f59e0b;"><i class="fas fa-gem"></i></div>
                    <p style="color: #475569; font-size: 14px; margin-bottom: 20px;">
                        Para acessar os dados de contato completos, informações restritas e histórico, você precisa usar um crédito da sua carteira.
                    </p>
                    <p style="font-size: 15px; font-weight: 700; color: #1e293b; margin-bottom: 25px;">Custo: ${price} Crédito(s)</p>
                    
                    <button id="btnConfirmUnlock" class="btn-primary-rich" style="width: 100%; padding: 12px; background: #10b981; margin-bottom: 10px;">
                        <i class="fas fa-unlock"></i> Desbloquear Ficha
                    </button>
                    ${this.userProfile?.credits < price ? `<p style="color:#ef4444; font-size:11px; margin-top:5px; font-weight:bold;">Saldo insuficiente! Compre no botão abaixo.</p>` : ''}
                    <button onclick="window.Monetization.showPixOptions(); this.closest('.custom-modal-overlay').remove();" class="btn-primary-rich" style="width: 100%; padding: 12px; background: #2563eb;">
                        <i class="fas fa-shopping-cart"></i> Comprar Mais Créditos
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('#btnConfirmUnlock').onclick = async () => {
            const { limit } = this.getTierLimits();
            const used = this.userProfile?.monthly_unlocks_used || 0;
            const hasMonthlyAllowance = used < limit;

            if (!hasMonthlyAllowance && (this.userProfile?.credits || 0) < price) {
                window.Toast.warning("Você atingiu seu limite mensal e não tem créditos extras. Adquira mais no Painel Financeiro.");
                return;
            }
            modal.remove();
            await this.executeUnlockLote(loteInscricao, unitId, price);
        };
    },

    executeUnlockLote: async function(loteInscricao, unitId, price = 1) {
        const { limit, label } = this.getTierLimits();
        const used = this.userProfile?.monthly_unlocks_used || 0;
        const hasMonthlyAllowance = used < limit;

        const loadingMsg = hasMonthlyAllowance ? 
            `Usando limite mensal do Plano ${label}...` : 
            `Consumindo ${price} crédito(s) da carteira...`;

        window.Loading.show("Desbloqueando...", loadingMsg);
        
        try {
            // 🛑 SAFETY CHECK: No Information Lot?
            if (window.allLotes) {
                const localLote = window.allLotes.find(l => l.inscricao === loteInscricao);
                if (localLote) {
                    const hasOwner = localLote.nome_proprietario && localLote.nome_proprietario !== 'null' && localLote.nome_proprietario.trim() !== '';
                    const hasUnits = localLote.unidades && localLote.unidades.length > 0;
                    
                    if (!hasOwner && !hasUnits) {
                        window.Toast.info("Este lote não possui proprietário ou unidades vinculadas. Dado insuficiente para cobrança.");
                        window.Loading.hide();
                        // Pre-unlock locally anyway so user can see the empty state without prompt again
                        this.unlockedLots.add(loteInscricao);
                        if (window.currentLoteForUnit) window.showLotTooltip(window.currentLoteForUnit, 0, 0);
                        return;
                    }
                }
            }

            if (hasMonthlyAllowance) {
                // Consome do limite do plano (Custo 0 de créditos, mas incrementa monthly_unlocks_used)
                const { error } = await window.supabaseApp.rpc('unlock_lote_with_plan', {
                    target_lote: loteInscricao
                });
                if (error) throw error;
                this.userProfile.monthly_unlocks_used = (this.userProfile.monthly_unlocks_used || 0) + 1;
                window.Toast.success(`Ficha liberada! (${this.userProfile.monthly_unlocks_used}/${limit} do plano usada)`);
            } else {
                // Consome créditos pagos
                const { error } = await window.supabaseApp.rpc('unlock_lote_with_credits', {
                    target_lote: loteInscricao,
                    credit_cost: price
                });
                if (error) throw error;
                this.userProfile.credits -= price;
                window.Toast.success(`Ficha liberada usando créditos!`);
            }
            
            const clean = (id) => id ? String(id).replace(/\D/g, '') : '';
            this.unlockedLots.add(clean(loteInscricao));
            if (unitId) this.unlockedLots.add(clean(unitId)); // Garante que ambos sejam reconhecidos
            this.updateBalanceUI();
            this.renderPlanWidget();
            
            window.Toast.success("Ficha desbloqueada com sucesso! Informações liberadas.");
            
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
        // Roles privilegiadas não gastam créditos
        if (this.userRole === 'master' || this.userRole === 'admin') {
            return true;
        }

        try {
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
        const isCurrentPlan = (r) => currentRole === r || (r === 'master' && currentRole === 'admin');
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
                            <div style="font-size: 11px; font-weight: 800; color: #2563eb; text-transform: uppercase;">Pro</div>
                            <div style="font-size: 24px; font-weight: 800; color: #1e293b; margin: 10px 0;">R$ 199<small style="font-size: 13px; font-weight: 400;">/mês</small></div>
                            <ul style="list-style: none; padding: 0; margin: 16px 0; font-size: 12px; color: #475569; flex: 1; line-height: 1.8;">
                                <li>✅ <b>30 fichas/mês inclusas</b></li>
                                <li>✅ Radar Farol (básico)</li>
                                <li>✅ Busca por proprietário</li>
                                <li>✅ CRM pessoal</li>
                            </ul>
                            <button onclick="window.Monetization.startSubscription('pro')" style="width: 100%; padding: 10px; border: none; border-radius: 8px; background: #2563eb; color: white; font-weight: 700; cursor: pointer; font-size: 12px; box-shadow: 0 4px 12px rgba(37,99,235,0.3);">Assinar Pro</button>
                        </div>

                        <!-- Elite -->
                        <div style="background: linear-gradient(160deg, #faf5ff, #ede9fe); border: ${isCurrentPlan('elite') ? '2px solid #10b981' : '2px solid #7c3aed'}; border-radius: 16px; padding: 24px; display: flex; flex-direction: column; position: relative; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                            ${currentBadge('elite')}
                            ${!isCurrentPlan('elite') ? `<div style="position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: #f59e0b; color: #1e293b; padding: 4px 12px; border-radius: 20px; font-size: 10px; font-weight: 800;">NOVO</div>` : ''}
                            <div style="font-size: 11px; font-weight: 800; color: #7c3aed; text-transform: uppercase;">Elite</div>
                            <div style="font-size: 24px; font-weight: 800; color: #1e293b; margin: 10px 0;">R$ 449<small style="font-size: 13px; font-weight: 400;">/mês</small></div>
                            <ul style="list-style: none; padding: 0; margin: 16px 0; font-size: 12px; color: #475569; flex: 1; line-height: 1.8;">
                                <li>✅ <b>80 fichas/mês inclusas</b></li>
                                <li>✅ Radar Farol completo</li>
                                <li>✅ Dossiê PDF automático</li>
                                <li>✅ Alertas de oportunidade</li>
                                <li>✅ Relatórios avançados</li>
                            </ul>
                            <button onclick="window.Monetization.startSubscription('elite')" style="width: 100%; padding: 10px; border: none; border-radius: 8px; background: #7c3aed; color: white; font-weight: 700; cursor: pointer; font-size: 12px; box-shadow: 0 4px 12px rgba(124,58,237,0.3);">Assinar Elite</button>
                        </div>

                        <!-- Anual VIP -->
                        <div style="background: #1e293b; border: ${isCurrentPlan('master') ? '2px solid #10b981' : '1px solid #334155'}; border-radius: 16px; padding: 24px; display: flex; flex-direction: column; color: white; position: relative; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                            ${currentBadge('master')}
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
        if (plan === 'pro') price = 199;
        else if (plan === 'elite') price = 449;
        else if (plan === 'annual') price = 4990;
        else return;

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
        const config = this.pixConfig || { tipo: 'celular', chave: '+5513991234567', nome_beneficiario: 'OMEGA IMOVEIS', cidade: 'GUARUJA' };
        const cleanPrice = price.toFixed(2).replace('.', '');
        const pixPayload = `00020126360014BR.GOV.BCB.PIX0114${config.chave.replace(/[^0-9a-zA-Z]/g, '')}52040000530398654${cleanPrice.padStart(2, '0')}5802BR5913${config.nome_beneficiario.substring(0, 13)}6009${config.cidade.substring(0, 9)}62070503***6304`;

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

        const config = this.pixConfig || {
            tipo: 'celular',
            chave: '+5513991234567',
            nome_beneficiario: 'OMEGA IMOVEIS',
            cidade: 'GUARUJA'
        };

        // Simplified dynamic BRCode generation
        const cleanPrice = price.toFixed(2).replace('.', '');
        const pixPayload = `00020126360014BR.GOV.BCB.PIX0114${config.chave.replace(/[^0-9a-zA-Z]/g, '')}52040000530398654${cleanPrice.padStart(2, '0')}5802BR5913${config.nome_beneficiario.substring(0, 13)}6009${config.cidade.substring(0, 9)}62070503***6304`;
        
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

    isUnlocked: function(id) {
        if (!id) return true;
        if (this.userRole === 'master' || this.userRole === 'admin') return true;
        
        const cleanId = String(id).replace(/\D/g, '');
        // O sistema de "Minha Carteira" salva o lote (8 dígitos)
        // Se recebermos uma unidade (11+ dígitos), pegamos os primeiros 8
        const loteInscricao = cleanId.length >= 8 ? cleanId.substring(0, 8) : cleanId;
        
        return this.unlockedLots.has(loteInscricao) || this.unlockedLots.has(cleanId);
    },

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

            // 1. Fetch LOTS
            const { data: lotUnlocks, error: lotError } = await window.supabaseApp
                .from('unlocked_lots')
                .select('*, lotes(inscricao, building_name, bairro)')
                .eq('user_id', user.id)
                .order('desbloqueado_em', { ascending: false });

            // 2. Fetch PERSONS
            const { data: personUnlocks, error: personError } = await window.supabaseApp
                .from('unlocked_persons')
                .select('*')
                .eq('user_id', user.id)
                .order('unlocked_at', { ascending: false });

            if (lotError) console.warn("Lot unlock error:", lotError);
            if (personError) console.warn("Person unlock error:", personError);

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
                    const p = { nome_completo: 'Proprietário Desbloqueado', cpf_cnpj: item.cpf_cnpj };
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
                    const lot = item.lotes || {};
                    const building = lot.building_name || "Lotes Avulsos / Terrenos";
                    if (!groups[building]) groups[building] = [];
                    groups[building].push(item);
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
                                const lot = item.lotes || {};

                                return `
                                    <div class="crm-lead-card" style="cursor: pointer; margin-bottom: 6px; transition: all 0.2s; border-left: 3px solid #10b981; padding: 10px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.01);"
                                         onclick="window.Monetization.flyToUnlocked('${item.lote_inscricao}')"
                                         onmouseover="this.style.transform='translateX(4px)'"
                                         onmouseout="this.style.transform='none'">
                                        <div style="display: flex; justify-content: space-between; align-items: center;">
                                            <div>
                                                <div style="font-weight: 700; color: #334155; font-size: 12px;">${lot.inscricao}</div>
                                                <div style="font-size: 9px; color: #94a3b8;">Liberado em ${date}</div>
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

    unlockPerson: async function(cpf_cnpj, name = "Proprietário", price = 1) {
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
