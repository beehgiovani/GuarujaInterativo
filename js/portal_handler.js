/**
 * PORTAL_HANDLER.JS - Lógica do Dashboard do Proprietário
 */

window.Portal = {
    myProperties: [],
    userProfile: null,

    async init() {
        console.log("🚀 Portal Handler: Iniciando verificação...");
        
        // Pequeno atraso para garantir que o SDK do Supabase restaurou a sessão do localStorage
        await new Promise(r => setTimeout(r, 500));

        // 1. Verificar Autenticação
        const { data: { session } } = await window.supabaseApp.auth.getSession();
        
        if (!session) {
            console.warn("🚫 Sem sessão ativa após wait. Redirecionando para login do portal...");
            window.location.href = 'portal_login.html';
            return;
        }

        console.log("🔐 Sessão encontrada para:", session.user.email);

        // 2. Carregar Perfil para obter CPF
        await this.loadProfile(session.user.id);
        console.log("👤 Perfil carregado:", this.userProfile);
        
        if (!this.userProfile) {
            console.error("❌ Falha ao carregar perfil do banco de dados.");
            return;
        }

        const isAdmin = ['admin', 'master'].includes(this.userProfile.role);
        const isProprietario = this.userProfile.user_type === 'proprietario';

        console.log("🛡️ Permissões -> isAdmin:", isAdmin, "| isProprietario:", isProprietario);

        if (!isProprietario && !isAdmin) {
            console.warn("⛔ Acesso restrito. Tipo:", this.userProfile?.user_type, "Role:", this.userProfile?.role);
            window.location.href = 'index.html';
            return;
        }

        console.log("✅ Acesso validado. Inicializando Dashboard...");
        this.updateUIHeader();
        await this.loadMyProperties();
        await this.loadActivityFeed();
        
        // 3. Verificar Onboarding
        await this.checkOwnerOnboarding();
        this.setupOnboardingEvents();
    },

    async loadProfile(userId) {
        const { data, error } = await window.supabaseApp
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) {
            console.error("Erro ao carregar perfil:", error);
            return;
        }
        this.userProfile = data;
    },

    async checkOwnerOnboarding() {
        // Verifica se o perfil já foi completado
        if (this.userProfile && !this.userProfile.profile_completed) {
            console.log('📝 Perfil incompleto. Iniciando Onboarding...');
            document.getElementById('modal-onboarding').classList.add('active');
            
            // Pré-preenche se houver dados
            if (this.userProfile.full_name) document.getElementById('onb-name').value = this.userProfile.full_name;
            if (this.userProfile.phone) document.getElementById('onb-phone').value = this.userProfile.phone;
            if (this.userProfile.cpf_cnpj) document.getElementById('onb-cpf').value = this.userProfile.cpf_cnpj;
        }
    },

    setupOnboardingEvents() {
        this.currentOnboardingStep = 1;
        const btnNext = document.getElementById('onb-next');
        const btnPrev = document.getElementById('onb-prev');

        if (btnNext) btnNext.onclick = () => this.handleOnboardingNext();
        if (btnPrev) btnPrev.onclick = () => this.handleOnboardingPrev();

        // Photo Upload Preview (Onboarding)
        const photoInput = document.getElementById('onb-photo-input');
        if (photoInput) {
            photoInput.onchange = (e) => this.handlePhotoPreview(e);
        }

        // Photo Upload Preview (Main Modal)
        const propPhotoInput = document.getElementById('property-photo-input');
        const uploadArea = document.getElementById('property-upload-area');
        if (uploadArea && propPhotoInput) {
            uploadArea.onclick = () => propPhotoInput.click();
            propPhotoInput.onchange = (e) => this.handlePropertyPhotoSelection(e);
        }
    },

    handleOnboardingNext() {
        if (this.currentOnboardingStep < 3) {
            this.currentOnboardingStep++;
            this.updateOnboardingUI();
        } else {
            this.submitOnboarding();
        }
    },

    handleOnboardingPrev() {
        if (this.currentOnboardingStep > 1) {
            this.currentOnboardingStep--;
            this.updateOnboardingUI();
        }
    },

    updateOnboardingUI() {
        // Update Stepper
        document.querySelectorAll('.onboarding-stepper .step').forEach(s => {
            const stepNum = parseInt(s.dataset.step);
            s.classList.toggle('active', stepNum === this.currentOnboardingStep);
            s.classList.toggle('completed', stepNum < this.currentOnboardingStep);
        });

        // Update Panes
        document.querySelectorAll('.onboarding-pane').forEach((p, idx) => {
            p.classList.toggle('active', (idx + 1) === this.currentOnboardingStep);
        });

        // Update Buttons
        const btnNext = document.getElementById('onb-next');
        const btnPrev = document.getElementById('onb-prev');
        if (btnPrev) btnPrev.style.visibility = this.currentOnboardingStep === 1 ? 'hidden' : 'visible';
        if (btnNext) btnNext.innerText = this.currentOnboardingStep === 3 ? 'Finalizar e Enviar' : 'Próximo';
    },

    handlePhotoPreview(e) {
        const grid = document.getElementById('onb-preview-grid');
        if (!grid) return;
        grid.innerHTML = '';
        this.selectedOnboardingFiles = Array.from(e.target.files);
        
        this.selectedOnboardingFiles.forEach(file => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const div = document.createElement('div');
                div.className = 'preview-item';
                div.innerHTML = `<img src="${ev.target.result}">`;
                grid.appendChild(div);
            };
            reader.readAsDataURL(file);
        });
    },

    handlePropertyPhotoSelection(e) {
        const grid = document.getElementById('property-preview-grid');
        if (!grid) return;

        const newFiles = Array.from(e.target.files);
        this.selectedPropertyFiles = [...(this.selectedPropertyFiles || []), ...newFiles];
        
        this.renderGallery();
    },

    renderGallery() {
        const grid = document.getElementById('property-preview-grid');
        if (!grid) return;

        // Limpar apenas o que é preview novo (ou tudo e reconstruir)
        grid.innerHTML = '';

        // 1. Mostrar Fotos Existentes (que não foram marcadas para remoção)
        (this.currentUnitImages || []).forEach((url, idx) => {
            const div = document.createElement('div');
            div.className = 'preview-item';
            div.innerHTML = `
                <img src="${url}">
                <button type="button" class="remove-photo" onclick="window.Portal.removeExistingPhoto(${idx})">×</button>
            `;
            grid.appendChild(div);
        });

        // 2. Mostrar Previews de novas fotos
        (this.selectedPropertyFiles || []).forEach((file, idx) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const div = document.createElement('div');
                div.className = 'preview-item new-photo';
                div.innerHTML = `
                    <img src="${ev.target.result}">
                    <button type="button" class="remove-photo" onclick="window.Portal.removeSelectedPhoto(${idx})">×</button>
                    <span style="position:absolute; bottom:2px; left:2px; font-size:8px; background:rgba(0,0,0,0.5); padding:2px; border-radius:4px;">Upload</span>
                `;
                grid.appendChild(div);
            };
            reader.readAsDataURL(file);
        });
    },

    removeExistingPhoto(idx) {
        this.currentUnitImages.splice(idx, 1);
        this.renderGallery();
    },

    removeSelectedPhoto(idx) {
        this.selectedPropertyFiles.splice(idx, 1);
        this.renderGallery();
    },

    async uploadImages(files) {
        if (!files || files.length === 0) return [];
        
        const uploadedUrls = [];
        const bucket = 'submissions-images';

        for (const file of files) {
            const fileExt = file.name.split('.').pop();
            const fileName = `${this.userProfile.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `property/${fileName}`;

            const { data, error } = await window.supabaseApp.storage
                .from(bucket)
                .upload(filePath, file);

            if (error) {
                console.error("Upload error:", error);
                continue;
            }

            // Get Public URL
            const { data: { publicUrl } } = window.supabaseApp.storage
                .from(bucket)
                .getPublicUrl(filePath);
            
            uploadedUrls.push(publicUrl);
        }

        return uploadedUrls;
    },

    async submitOnboarding() {
        window.Loading?.show("Enviando dados...", "Isso pode levar alguns segundos dependendo das fotos");
        
        try {
            // 1. Upload das Imagens primeiro
            const imageUrls = await this.uploadImages(this.selectedOnboardingFiles);

            const profileProposal = {
                user_id: this.userProfile.id,
                full_name: document.getElementById('onb-name').value,
                phone: document.getElementById('onb-phone').value.replace(/\D/g, ''),
                cpf_cnpj: document.getElementById('onb-cpf').value.replace(/\D/g, '')
            };

            const unitStaging = {
                user_id: this.userProfile.id,
                inscricao: document.getElementById('onb-inscricao').value,
                metragem: parseFloat(document.getElementById('onb-metragem').value) || null,
                quartos: parseInt(document.getElementById('onb-quartos').value) || null,
                tipo: document.getElementById('onb-tipo').value,
                imagens_urls: imageUrls,
                status: 'pending'
            };

            // 1. Envia Proposta de Perfil
            const { error: pError } = await window.supabaseApp
                .from('owner_profile_proposals')
                .insert([profileProposal]);

            if (pError) throw pError;

            // 2. Envia Proposta de Unidade (Staging)
            const { error: uError } = await window.supabaseApp
                .from('unidades_staging')
                .insert([unitStaging]);

            if (uError) throw uError;

            // 3. Notifica Admin
            await window.supabaseApp.from('notificacoes').insert({
                titulo: "Novo Proprietário Aguardando Validação",
                mensagem: `${profileProposal.full_name} enviou uma nova proposta de cadastro e imóvel.`,
                tipo: 'admin_alert'
            });

            window.Toast?.success("Dados enviados com sucesso! Aguarde a validação.");
            this.closeModals();
            
            // Marcar localmente que já foi enviado para evitar modal re-abrindo nesta sessão (opcional)
            this.userProfile.profile_completed = true; // Simulado localmente

            setTimeout(() => window.location.reload(), 2000);

        } catch (err) {
            console.error("Erro no Onboarding:", err);
            window.Toast?.error("Erro ao enviar dados: " + err.message);
        } finally {
            window.Loading?.hide();
        }
    },

    updateUIHeader() {
        const elName = document.getElementById('owner-name');
        if (elName) elName.innerText = this.userProfile.full_name || this.userProfile.broker_name || 'Proprietário';
    },

    async loadMyProperties() {
        const userId = this.userProfile.id;
        const cpf = this.userProfile.cpf_cnpj;

        try {
            // 1. Carregar Unidades em Staging (Pendente de Aprovaçao)
            const { data: staging, error: sError } = await window.supabaseApp
                .from('unidades_staging')
                .select('*')
                .eq('user_id', userId)
                .eq('status', 'pending');

            if (sError) console.error("Erro ao buscar staging:", sError);
            this.stagingProperties = staging || [];

            // 2. Tentar vincular via Proprietario_id se houver CPF
            if (cpf) {
                const { data: propData } = await window.supabaseApp
                    .from('proprietarios')
                    .select('id')
                    .eq('cpf_cnpj', cpf.replace(/\D/g, ''))
                    .maybeSingle();

                if (propData) {
                    const { data: units, error: unitError } = await window.supabaseApp
                        .from('unidades')
                        .select('*, lotes (*)')
                        .eq('proprietario_id', propData.id);

                    if (!unitError) this.myProperties = units || [];
                }
            }

            this.renderUnits();
            this.renderStagingUnits();
            await this.updateStats();
            await this.loadActivityFeed();

        } catch (e) {
            console.error("Load properties error:", e);
        }
    },

    async updateStats() {
        if (document.getElementById('stat-total-units')) 
            document.getElementById('stat-total-units').innerText = this.myProperties.length;
        
        const totalVenal = this.myProperties.reduce((acc, u) => acc + (parseFloat(u.valor_real || u.valor_venal) || 0), 0);
        if (document.getElementById('stat-market-value')) {
            document.getElementById('stat-market-value').innerText = totalVenal > 0 
                ? 'R$ ' + (totalVenal/1000000).toFixed(1) + 'M' 
                : 'R$ 0,00';
        }

        // NOVO: Calcular Corretores Alcançados via Distribuição
        let totalReached = 0;
        const inscricoes = this.myProperties.map(u => u.inscricao);
        
        if (inscricoes.length > 0) {
            const { count, error } = await window.supabaseApp
                .from('notificacoes')
                .select('*', { count: 'exact', head: true })
                .in('data_id', inscricoes)
                .eq('tipo', 'owner_opportunity');
            
            if (!error) totalReached = count || 0;
        }

        const elReached = document.getElementById('stat-brokers-reached');
        if (elReached) elReached.innerText = totalReached;
    },

    renderUnits(filter = "") {
        const container = document.getElementById('units-container');
        const emptyState = document.getElementById('portal-dashboard-empty');
        if (!container) return;

        const filtered = this.myProperties.filter(u => {
            const lot = u.lotes || {};
            const searchStr = `${u.inscricao} ${lot.building_name} ${lot.bairro}`.toLowerCase();
            return searchStr.includes(filter.toLowerCase());
        });

        if (filtered.length === 0 && this.stagingProperties.length === 0) {
            if (emptyState) emptyState.style.display = 'block';
            container.innerHTML = '';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';

        container.innerHTML = filtered.map(u => {
            const lot = u.lotes || {};
            const isAnnounced = u.status_venda === 'venda' || u.status_venda === 'locacao';
            
            return `
                <div class="unit-card" onclick="window.Portal.showUnitDetails('${u.inscricao}')">
                    <span class="unit-badge ${isAnnounced ? 'badge-venda' : 'badge-privado'}">
                        ${isAnnounced ? 'Ativo' : 'Privado'}
                    </span>
                    <span class="unit-building">${lot.building_name || 'Edifício não mapeado'}</span>
                    <span class="unit-address">${lot.logradouro || 'Endereço pendente'}, ${lot.numero || ''} ${u.complemento || ''}</span>
                    
                    <div class="unit-details">
                        <div class="detail-item">
                            <span>Inscrição</span>
                            <span>${u.inscricao}</span>
                        </div>
                        <div class="detail-item">
                            <span>Área</span>
                            <span>${u.metragem || '--'} m²</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

    async loadActivityFeed() {
        const container = document.getElementById('activity-feed-container');
        if (!container) return;

        const inscricoes = this.myProperties.map(u => u.inscricao);
        if (inscricoes.length === 0) {
            container.innerHTML = '<div style="padding:20px; text-align:center; color:#94a3b8; font-size:0.8rem;">Anuncie seu imóvel para ver a atividade dos corretores.</div>';
            return;
        }

        try {
            const { data, error } = await window.supabaseApp.rpc('get_owner_activity_feed', {
                p_inscricoes: inscricoes
            });

            if (error) throw error;

            if (!data || data.length === 0) {
                container.innerHTML = '<div style="padding:20px; text-align:center; color:#94a3b8; font-size:0.8rem;">Aguardando as primeiras interações dos corretores...</div>';
                return;
            }

            container.innerHTML = data.map(ev => {
                let icon = '🔔';
                let color = 'rgba(148, 163, 184, 0.1)';
                let textColor = '#94a3b8';

                if (ev.event_type === 'unlock') { icon = '👁️'; color = 'rgba(59, 130, 246, 0.1)'; textColor = '#3b82f6'; }
                if (ev.event_type === 'status_change') { icon = '✅'; color = 'rgba(16, 185, 129, 0.1)'; textColor = '#10b981'; }
                if (ev.event_type === 'visit') { icon = '📅'; color = 'rgba(139, 92, 246, 0.1)'; textColor = '#8b5cf6'; }

                const dateStr = new Date(ev.event_time).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

                return `
                    <div class="activity-item">
                        <div class="activity-icon-box" style="background: ${color}; color: ${textColor};">
                            ${icon}
                        </div>
                        <div class="activity-info">
                            <h5>${ev.broker_name}</h5>
                            <p>${ev.description}</p>
                            <div class="activity-meta">
                                <i class="fas fa-clock"></i> ${dateStr} • Ref: ${ev.unit_inscricao}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

        } catch (e) {
            console.error("Erro ao carregar feed:", e);
            container.innerHTML = '<div style="padding:20px; color:#f87171; font-size:0.75rem;">Erro ao carregar atividade.</div>';
        }
    },

    renderStagingUnits() {
        const stagingContainer = document.getElementById('staging-container');
        const grid = document.getElementById('staging-units-grid');
        if (!stagingContainer || !grid) return;

        if (this.stagingProperties.length === 0) {
            stagingContainer.style.display = 'none';
            return;
        }

        stagingContainer.style.display = 'block';
        grid.innerHTML = this.stagingProperties.map(u => {
            const isRejected = u.status === 'rejected';
            const color = isRejected ? '#ef4444' : '#fbbf24';
            const badgeText = isRejected ? 'REJEITADO' : 'EM ANÁLISE';
            
            return `
                <div class="unit-card staging-card" style="border-left: 4px solid ${color}; opacity: ${isRejected ? '1' : '0.8'};">
                    <span class="unit-badge" style="background: ${isRejected ? 'rgba(239, 68, 68, 0.1)' : 'rgba(251, 191, 36, 0.1)'}; color: ${color};">
                        ${badgeText}
                    </span>
                    <span class="unit-building">${isRejected ? 'Necessita Ajustes' : 'Aguardando Validação'}</span>
                    <span class="unit-address">Inscrição: ${u.inscricao || 'Pendente'}</span>
                    
                    ${u.admin_notes ? `<div style="margin: 10px 0; font-size: 0.75rem; color: #ef4444; background: rgba(239, 68, 68, 0.05); padding: 8px; border-radius: 6px; border: 1px dashed rgba(239, 68, 68, 0.2);">
                        <strong>Motivo:</strong> ${u.admin_notes}
                    </div>` : ''}

                    <div class="unit-details">
                        <div class="detail-item">
                            <span>Tipo</span>
                            <span>${u.tipo || 'Imóvel'}</span>
                        </div>
                        <div class="detail-item">
                            <span>Status</span>
                            <span>${u.status}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

    showAnnounceFlow() {
        // Agora o portal deve permitir anunciar mesmo que não tenha unidades vinculadas ainda
        // Abrimos o modal de cadastro de imóvel novo
        document.getElementById('modal-announce').classList.add('active');
    },

    showUnitDetails(inscricao) {
        const unit = this.myProperties.find(u => u.inscricao === inscricao);
        if (!unit) return;

        console.log("🛠️ Abrindo editor para:", inscricao, unit);
        
        // Preencher Campos da Unidade
        document.getElementById('field-inscricao').value = unit.inscricao;
        document.getElementById('field-metragem').value = unit.metragem || '';
        document.getElementById('field-vagas').value = unit.vagas || '';
        document.getElementById('field-quartos').value = unit.quartos || '';
        document.getElementById('field-suites').value = unit.suites || '';
        document.getElementById('field-banheiros').value = unit.banheiros || '';
        document.getElementById('field-caracteristicas').value = (unit.caracteristicas || []).join(', ');
        document.getElementById('field-descricao').value = unit.descricao_imovel || '';
        
        // Preencher Preço e Status
        document.getElementById('field-status_venda').value = unit.status_venda || 'particular';
        document.getElementById('field-valor_real').value = unit.valor_real || '';
        
        // Preencher Dados do Prédio (Lotes)
        const lot = unit.lotes || {};
        document.getElementById('field-building-name').value = lot.building_name || '';
        
        const amenities = ['piscina', 'academia', 'salao_festas', 'churrasqueira', 'servico_praia', 'portaria_24h', 'elevador', 'bicicletario'];
        amenities.forEach(a => {
            const check = document.getElementById('check-' + a);
            if (check) check.checked = !!lot[a];
        });

        // Galeria de Fotos
        this.currentUnitId = unit.id;
        this.currentUnitImages = [...(unit.imagens || [])];
        this.selectedPropertyFiles = []; // Resetar seleção de novos arquivos
        this.renderGallery();

        // Resetar Abas
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        document.querySelector('.tab-btn').classList.add('active');
        document.getElementById('tab-unit').classList.add('active');

        document.getElementById('modal-announce').classList.add('active');
    },

    switchTab(event, tabId) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        
        event.currentTarget.classList.add('active');
        document.getElementById(tabId).classList.add('active');
    },

    async handleFormSubmit(e) {
        e.preventDefault();
        const inscricao = document.getElementById('field-inscricao').value;
        if (!inscricao) return;

        try {
            window.Loading?.show("Salvando alterações...");

            // 1. Upload de novas fotos
            const newPhotoUrls = await this.uploadImages(this.selectedPropertyFiles);
            const allImages = [...(this.currentUnitImages || []), ...newPhotoUrls];

            // 2. Coletar dados da Unidade
            const unitData = {
                metragem: parseFloat(document.getElementById('field-metragem').value) || null,
                vagas: parseInt(document.getElementById('field-vagas').value) || null,
                quartos: parseInt(document.getElementById('field-quartos').value) || null,
                suites: parseInt(document.getElementById('field-suites').value) || null,
                banheiros: parseInt(document.getElementById('field-banheiros').value) || null,
                caracteristicas: document.getElementById('field-caracteristicas').value.split(',').map(s => s.trim()).filter(s => s !== ''),
                descricao_imovel: document.getElementById('field-descricao').value,
                status_venda: document.getElementById('field-status_venda').value,
                valor_real: parseFloat(document.getElementById('field-valor_real').value) || null,
                imagens: allImages
            };

            // 2. Atualizar Unidade
            const { error: unitErr } = await window.supabaseApp
                .from('unidades')
                .update(unitData)
                .eq('inscricao', inscricao);

            if (unitErr) throw unitErr;

            // 3. Registrar Sugestões de Prédio (Lotes)
            await this.processBuildingSuggestions(inscricao);

            alert("✅ Imóvel atualizado com sucesso! Os corretores já podem ver as novas informações.");
            this.closeModals();
            await this.loadMyProperties();

        } catch (err) {
            console.error("Save error:", err);
            alert("Erro ao salvar. Verifique sua conexão.");
        } finally {
            window.Loading?.hide();
        }
    },

    async processBuildingSuggestions(inscricao) {
        const unit = this.myProperties.find(u => u.inscricao === inscricao);
        if (!unit || !unit.lote_inscricao) return;

        const lotInscricao = unit.lote_inscricao;
        const suggestions = [];

        // Building Name
        const newName = document.getElementById('field-building-name').value;
        if (newName && newName !== (unit.lotes?.building_name || '')) {
            suggestions.push({ field: 'building_name', value: newName });
        }

        // Amenities
        const amenities = ['piscina', 'academia', 'salao_festas', 'churrasqueira', 'servico_praia', 'portaria_24h', 'elevador', 'bicicletario'];
        amenities.forEach(a => {
            const checked = document.getElementById('check-' + a).checked;
            if (checked !== !!(unit.lotes && unit.lotes[a])) {
                suggestions.push({ field: a, value: checked ? 'true' : 'false' });
            }
        });

        if (suggestions.length === 0) return;

        // Inserir na tabela de edições para aprovação ou log
        const logs = suggestions.map(s => ({
            user_id: this.userProfile.id,
            lote_inscricao: lotInscricao,
            field_name: s.field,
            old_value: String(unit.lotes ? unit.lotes[s.field] : ''),
            new_value: s.value,
            is_approved: true // Proprietário tem "auto-aprovação" parcial ou confiança maior
        }));

        await window.supabaseApp.from('user_lote_edits').insert(logs);
        
        // Opcional: Atualizar a tabela 'lotes' diretamente se quisermos que seja imediato
        if (suggestions.length > 0) {
            const updateObj = {};
            suggestions.forEach(s => {
                updateObj[s.field] = s.field === 'building_name' ? s.value : (s.value === 'true');
            });
            await window.supabaseApp.from('lotes').update(updateObj).eq('inscricao', lotInscricao);
        }
    },

    filterUnits() {
        const val = document.getElementById('unit-search').value;
        this.renderUnits(val);
    },

    renderEmptyState(msg) {
        const container = document.getElementById('units-container');
        if (container) {
            container.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 80px 20px;">
                    <i class="fas fa-search" style="font-size: 48px; color: #334155; margin-bottom: 20px;"></i>
                    <h3 style="margin: 0; color: #cbd5e1;">Busca Concluída</h3>
                    <p style="color: #94a3b8; max-width: 400px; margin: 10px auto;">${msg}</p>
                </div>
            `;
        }
    },

    closeModals() {
        document.querySelectorAll('.portal-modal').forEach(m => m.classList.remove('active'));
    }
};

// Auto-init
document.addEventListener('DOMContentLoaded', () => {
    window.Portal.init();
    document.getElementById('announce-form')?.addEventListener('submit', (e) => window.Portal.handleFormSubmit(e));
});
