// Shared state for private edits
window.userPendingEdits = { lotes: {}, units: {} };

window.initEditorHandlerRefs = function (refs) {
    // Shared state is accessed via window.allLotes, window.Loading, etc.
};

// ========================================
// IMAGE UPLOAD HELPER
// ========================================
async function uploadToSupabase(file, inscricao) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${inscricao}_${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { data, error } = await window.supabaseApp.storage
        .from('lotes_images')
        .upload(filePath, file);

    if (error) throw error;

    const { data: { publicUrl } } = window.supabaseApp.storage
        .from('lotes_images')
        .getPublicUrl(filePath);

    return publicUrl;
}

// ========================================
// LOT EDITOR (TOOLTIP VERSION)
// ========================================
window.editFromTooltip = function (inscricao) {
    if (!window.Monetization || !window.Monetization.checkFeatureAccess('edit_private')) {
        window.Toast.info('Acesso restrito: Edição disponível para assinantes Pro/Elite.');
        return;
    }
    const lote = window.allLotes.find(l => l.inscricao === inscricao);
    if (!lote) return;

    const currentTooltip = document.querySelector('.lot-tooltip');
    if (!currentTooltip) return;

    const existingEdits = window.editedLotes[inscricao] || {};
    const tooltipBody = currentTooltip.querySelector('.lot-tooltip-body');
    if (!tooltipBody) return;

    tooltipBody.innerHTML = `
        <div style="padding: 10px;">
            <div style="margin-bottom: 12px;">
                <label style="display: block; font-weight: 600; font-size: 12px; color: #666; margin-bottom: 4px;">Nome do Edifício</label>
                <input type="text" id="edit-building-name" value="${existingEdits.building_name || lote.building_name || ''}" 
                    style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px;">
            </div>

            <div style="margin-bottom: 12px;">
                <label style="display: block; font-weight: 600; font-size: 12px; color: #666; margin-bottom: 4px;">Galeria de Imagens</label>
                <div style="display: flex; gap: 10px; margin-bottom: 8px; align-items: center;">
                    <label for="edit-image-upload" class="lot-tooltip-btn primary" style="padding: 4px 8px; font-size: 11px; cursor: pointer; display: flex; align-items: center; gap: 6px; margin:0; width: auto;">
                        <i class="fas fa-camera"></i> Upload Foto
                    </label>
                    <input type="file" id="edit-image-upload" accept="image/*" style="display: none;" 
                        onchange="handleGalleryUpload(this.files[0], '${inscricao}')">
                    <span id="upload-status" style="font-size: 10px; color: #666;"></span>
                </div>
                <div id="gallery-preview" style="display: flex; gap: 8px; overflow-x: auto; padding-bottom: 5px;">
                    <!-- Thumbnails injected via renderGalleryPreview -->
                </div>
                <input type="hidden" id="edit-gallery-json" value='${JSON.stringify(existingEdits.gallery || lote.gallery || [])}'>
            </div>

            <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                <div style="flex: 1;">
                    <label style="display: block; font-weight: 600; font-size: 11px; color: #666;">Andares</label>
                    <input type="number" id="edit-floors" value="${existingEdits.floors || lote.floors || ''}" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                <div style="flex: 1;">
                    <label style="display: block; font-weight: 600; font-size: 11px; color: #666;">Ano Const.</label>
                    <input type="number" id="edit-build-year" value="${existingEdits.build_year || lote.build_year || ''}" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px;">
                </div>
            </div>

            <div style="margin-bottom: 12px; border-top: 1px solid #eee; padding-top: 10px;">
                <div style="font-weight: 600; font-size: 12px; color: #333; margin-bottom: 8px;">Dados do Zelador & Condomínio</div>
                <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                    <div style="flex: 1;">
                        <label style="display: block; font-size: 11px; color: #666;">Nome</label>
                        <input type="text" id="edit-zelador-nome" value="${existingEdits.zelador_nome || lote.zelador_nome || ''}" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    <div style="flex: 1;">
                        <label style="display: block; font-size: 11px; color: #666;">Contato (Tel)</label>
                        <input type="text" id="edit-zelador-contato" value="${existingEdits.zelador_contato || lote.zelador_contato || ''}" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px;" placeholder="(13) 9....-....">
                    </div>
                </div>
                 <div style="margin-bottom: 8px;">
                     <label style="display: block; font-size: 11px; color: #666;">Valor Condomínio (Ex: 1300-1500)</label>
                     <input type="text" id="edit-valor-condominio" value="${existingEdits.valor_condominio || lote.valor_condominio || ''}" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px;">
                </div>
            </div>

            <div style="margin-bottom: 12px; border-top: 1px solid #eee; padding-top: 10px;">
                <div style="font-weight: 600; font-size: 12px; color: #333; margin-bottom: 8px;">Itens de Lazer & Infraestrutura</div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px;">
                    ${['piscina', 'academia', 'churrasqueira', 'salao_jogos', 'salao_festas', 'area_verde', 'bicicletario', 'portaria_24h', 'acesso_pcd', 'elevador', 'servico_praia', 'zeladoria'].map(key => `
                        <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer; background: #f8fafc; padding: 6px; border-radius: 4px; border: 1px solid #e2e8f0;">
                            <input type="checkbox" id="edit-lote-${key}" ${(existingEdits[key] || lote[key]) ? 'checked' : ''}>
                            <span style="text-transform: capitalize;">${key.replace('_', ' ').replace('salao', 'salão').replace('servico', 'serviço').replace('acesso_pcd', 'Acessibilidade').replace('portaria_24h', 'Portaria 24h')}</span>
                        </label>
                    `).join('')}
                </div>

                <label style="display: block; font-weight: 600; font-size: 11px; color: #666; margin-bottom: 4px;">Outros Itens (Texto)</label>
                <textarea id="edit-amenities" rows="2" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 12px; resize: vertical;">${existingEdits.amenities || lote.amenities || ''}</textarea>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px; padding-top: 15px; border-top: 1px solid #f1f5f9;">
                <button onclick="cancelEdit('${inscricao}')" 
                    style="padding: 8px 16px; font-weight: 500; border-radius: 6px; border: 1px solid #cbd5e1; background: white; color: #475569; cursor: pointer; transition: all 0.2s; font-size: 13px;">
                    Cancelar
                </button>
                <button onclick="saveEditFromTooltip('${inscricao}')" 
                    style="padding: 8px 16px; font-weight: 500; border-radius: 6px; border: none; background: #0f172a; color: white; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.1); font-size: 13px; display: flex; align-items: center; gap: 6px;">
                    <i class="fas fa-save"></i> Salvar Lote
                </button>
            </div>
        </div>
    `;

    // Initialize gallery preview
    setTimeout(() => {
        window.renderGalleryPreview(existingEdits.gallery || lote.gallery || []);
    }, 0);
};

window.renderGalleryPreview = function (gallery) {
    const container = document.getElementById('gallery-preview');
    const input = document.getElementById('edit-gallery-json');
    if (!container || !input) return;

    input.value = JSON.stringify(gallery);
    container.innerHTML = '';
    gallery.forEach((url, index) => {
        const div = document.createElement('div');
        div.style.position = 'relative';
        div.style.flexShrink = '0';
        div.innerHTML = `
            <img src="${url}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px; border: 1px solid #ddd;">
            <button onclick="removeGalleryImage(${index})" style="position: absolute; top: -5px; right: -5px; background: red; color: white; border: none; border-radius: 50%; width: 18px; height: 18px; font-size: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center;">×</button>
        `;
        container.appendChild(div);
    });
};

window.removeGalleryImage = function (index) {
    const input = document.getElementById('edit-gallery-json');
    if (!input) return;
    const gallery = JSON.parse(input.value || '[]');
    gallery.splice(index, 1);
    window.renderGalleryPreview(gallery);
};

window.handleGalleryUpload = async function (file, inscricao) {
    if (!file) return;
    const statusEl = document.getElementById('upload-status');
    const input = document.getElementById('edit-gallery-json');
    if (statusEl) statusEl.innerText = 'Enviando...';

    try {
        const publicUrl = await uploadToSupabase(file, inscricao);
        if (publicUrl) {
            const gallery = JSON.parse(input.value || '[]');
            gallery.push(publicUrl);
            window.renderGalleryPreview(gallery);
            if (statusEl) statusEl.innerText = 'Sucesso!';
        }
    } catch (e) {
        console.error(e);
        if (statusEl) statusEl.innerText = 'Erro';
        Toast.error('Erro upload: ' + e.message);
    }
};

window.cancelEdit = function (inscricao) {
    // 1. Capture the correct 'rich' object BEFORE closing
    // Always prefer window.currentLoteForUnit because it has the units loaded
    let loteToRestore = window.currentLoteForUnit;

    // Safety check: if currentLote isn't the one we are editing, fallback to find
    if (!loteToRestore || loteToRestore.inscricao !== inscricao) {
        loteToRestore = window.allLotes.find(l => l.inscricao === inscricao);
    }

    // 2. Close the editor (tooltip)
    window.closeLotTooltip();

    // 3. Re-open if we have data
    if (loteToRestore) {
        setTimeout(() => {
            if (window.showLotTooltip) window.showLotTooltip(loteToRestore);
        }, 100); // Small delay to allow DOM cleanup
    }
};

window.saveEditFromTooltip = async function (inscricao) {
    Loading.show('Salvando...', 'Atualizando dados...');
    try {
        const galleryInput = document.getElementById('edit-gallery-json');
        const gallery = galleryInput ? JSON.parse(galleryInput.value || '[]') : [];
        const imageUrl = gallery.length > 0 ? gallery[0] : null;

        const edits = {
            building_name: document.getElementById('edit-building-name')?.value || '',
            image_url: imageUrl,
            gallery: gallery,
            floors: document.getElementById('edit-floors')?.value || '',
            build_year: document.getElementById('edit-build-year')?.value || '',
            zelador_nome: document.getElementById('edit-zelador-nome')?.value || '',
            zelador_contato: document.getElementById('edit-zelador-contato')?.value || '',
            valor_condominio: document.getElementById('edit-valor-condominio')?.value || '', // New Field
            amenities: document.getElementById('edit-amenities')?.value || '',
            // Boolean Fields
            piscina: document.getElementById('edit-lote-piscina')?.checked || false,
            academia: document.getElementById('edit-lote-academia')?.checked || false,
            churrasqueira: document.getElementById('edit-lote-churrasqueira')?.checked || false,
            salao_jogos: document.getElementById('edit-lote-salao_jogos')?.checked || false,
            salao_festas: document.getElementById('edit-lote-salao_festas')?.checked || false, // New
            area_verde: document.getElementById('edit-lote-area_verde')?.checked || false, // New
            bicicletario: document.getElementById('edit-lote-bicicletario')?.checked || false, // New
            portaria_24h: document.getElementById('edit-lote-portaria_24h')?.checked || false,
            acesso_pcd: document.getElementById('edit-lote-acesso_pcd')?.checked || false, // New
            elevador: document.getElementById('edit-lote-elevador')?.checked || false,
            servico_praia: document.getElementById('edit-lote-servico_praia')?.checked || false,
            zeladoria: document.getElementById('edit-lote-zeladoria')?.checked || false
        };

        const isAdmin = window.Monetization && (window.Monetization.userRole === 'admin' || window.Monetization.userRole === 'master');
        const { data: { user } } = await window.supabaseApp.auth.getUser();

        if (isAdmin) {
            const { error } = await supabaseApp
                .from('lotes')
                .update(edits)
                .eq('inscricao', inscricao);

            if (error) throw error;
            
            // Sync with central state
            const lote = allLotes.find(l => l.inscricao === inscricao);
            if (lote) Object.assign(lote, edits);
            window.Toast.success('Edição salva globalmente!');
        } else {
            // Save to Personal Database / Curatorship (user_lote_edits)
            const editRecords = Object.entries(edits).map(([key, val]) => ({
                user_id: user.id,
                lote_inscricao: inscricao,
                field_name: key,
                new_value: Array.isArray(val) ? JSON.stringify(val) : String(val),
                old_value: String(allLotes.find(l => l.inscricao === inscricao)?.[key] || '')
            }));

            const { error } = await window.supabaseApp
                .from('user_lote_edits')
                .upsert(editRecords, { onConflict: 'user_id, lote_inscricao, field_name' });
            
            if (error) throw error;
            window.Toast.info('Sugestão enviada para curadoria!');
        }

        editedLotes[inscricao] = edits;
        
        // Adicionar à carteira persistente (se ainda não estiver)
        if (window.Monetization && window.Monetization.unlockedLots) {
            window.Monetization.unlockedLots.add(String(inscricao).replace(/\D/g, ''));
        }

        if (window.renderHierarchy) window.renderHierarchy();

        Loading.hide();

        // Refresh: Close Edit -> Re-open View
        if (window.closeLotTooltip) window.closeLotTooltip();
        setTimeout(() => {
            const currentLote = allLotes.find(l => l.inscricao === inscricao);
            if (window.showLotTooltip && currentLote) {
                window.showLotTooltip(currentLote);
            }
        }, 300);
    } catch (e) {
        console.error(e);
        Loading.hide();
        Toast.error('Erro ao salvar: ' + e.message);
    }
};

// ========================================
// UNIT EDITOR
// ========================================
window.editUnitFromTooltip = function (unitInscricao) {
    if (!window.Monetization || !window.Monetization.checkFeatureAccess('edit_private')) {
        window.Toast.info('Acesso restrito: Edição disponível para assinantes Pro/Elite.');
        return;
    }
    console.log('🔧 editUnitFromTooltip called with:', unitInscricao);

    if (!window.currentTooltip) {
        console.error('❌ No currentTooltip found');
        return;
    }

    // Use the stored parent lote instead of searching allLotes
    let targetUnit = null;
    if (window.currentLoteForUnit && window.currentLoteForUnit.unidades) {
        targetUnit = window.currentLoteForUnit.unidades.find(u => u.inscricao === unitInscricao);
        console.log('🔍 Searching in currentLoteForUnit:', window.currentLoteForUnit.inscricao);
    }

    // Fallback to searching allLotes if not found
    if (!targetUnit) {
        console.log('⚠️ Not found in currentLoteForUnit, searching allLotes...');
        for (const lote of window.allLotes) {
            if (lote.unidades) {
                targetUnit = lote.unidades.find(u => u.inscricao === unitInscricao);
                if (targetUnit) break;
            }
        }
    }

    if (!targetUnit) {
        console.error('❌ Target unit not found:', unitInscricao);
        return;
    }

    console.log('✅ Target unit found:', targetUnit);

    const existingEdits = window.editedLotes[unitInscricao] || {};
    const tooltipBody = window.currentTooltip.querySelector('.unit-tooltip-body');

    if (!tooltipBody) {
        console.error('❌ Tooltip body not found');
        return;
    }

    console.log('✅ Tooltip body found, rendering editor form');

    tooltipBody.innerHTML = `
        <div style="padding: 10px;">
            <div style="margin-bottom: 12px; display: flex; gap: 8px;">
                <div style="flex: 1;">
                   <label style="display: block; font-weight: 600; font-size: 12px; color: #666; margin-bottom: 4px;">Complemento (Torre/Bloco)</label>
                   <input type="text" id="edit-unit-complemento" value="${existingEdits.complemento || targetUnit.complemento || ''}" 
                        style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px;" placeholder="Ex: Torre A">
                </div>
                 <div style="flex: 1;">
                     <label style="display: block; font-weight: 600; font-size: 12px; color: #666; margin-bottom: 4px;">Tipo de Unidade</label>
                     <select id="edit-unit-tipo" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px;">
                         ${['Apartamento', 'Casa', 'Garagem', 'Loja', 'Terreno'].map(t => `<option value="${t}" ${(existingEdits.tipo || targetUnit.tipo) === t ? 'selected' : ''}>${t}</option>`).join('')}
                     </select>
                 </div>
            </div>
            
            <div style="margin-bottom: 12px;">
                <label style="display: block; font-weight: 600; font-size: 12px; color: #666; margin-bottom: 4px;">Status da Venda</label>
                <select id="edit-unit-status" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px;">
                    ${['Disponível', 'Vendido', 'Reservado', 'Captar'].map(s => `<option value="${s}" ${(existingEdits.status_venda || targetUnit.status_venda) === s ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
            </div>

            <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                ${['quartos', 'suites', 'vagas', 'banheiros'].map(f => `
                    <div style="flex: 1;">
                        <label style="display: block; font-weight: 600; font-size: 11px; color: #666; text-transform: capitalize;">${f}</label>
                        <input type="number" id="edit-unit-${f}" value="${existingEdits[f] || targetUnit[f] || ''}" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                `).join('')}
            </div>

            <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                <div style="flex: 1;">
                    <label style="display: block; font-weight: 600; font-size: 12px; color: #666; margin-bottom: 4px;">Área Útil (m²)</label>
                    <input type="text" id="edit-unit-area-util" value="${existingEdits.area_util || targetUnit.area_util || ''}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 6px;">
                </div>
                <div style="flex: 1;">
                    <label style="display: block; font-weight: 600; font-size: 12px; color: #666; margin-bottom: 4px;">Área Total (m²)</label>
                    <input type="text" id="edit-unit-area-total" value="${existingEdits.area_total || targetUnit.area_total || ''}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 6px;">
                </div>
            </div>

            <div style="margin-bottom: 12px; padding: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
                <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 8px;">Valores (R$)</div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
                    <div>
                        <label style="display: block; font-size: 11px; color: #475569; margin-bottom: 2px;">Valor Venal</label>
                        <input type="number" step="0.01" id="edit-unit-valor-venal" value="${existingEdits.valor_venal || targetUnit.valor_venal || ''}" placeholder="Fiscal" style="width: 100%; padding: 6px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 12px;">
                    </div>
                    <div>
                        <label style="display: block; font-size: 11px; color: #059669; font-weight: 700; margin-bottom: 2px;">Valor Real (Est.)</label>
                        <input type="number" step="0.01" id="edit-unit-valor-real" value="${existingEdits.valor_real || targetUnit.valor_real || ''}" placeholder="Mercado" style="width: 100%; padding: 6px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 12px; background: #f0fdf4;">
                    </div>
                    <div>
                        <label style="display: block; font-size: 11px; color: #475569; margin-bottom: 2px;">Valor Venda</label>
                        <input type="number" step="0.01" id="edit-unit-valor-vendavel" value="${existingEdits.valor_vendavel || targetUnit.valor_vendavel || ''}" placeholder="Pedida" style="width: 100%; padding: 6px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 12px;">
                    </div>
                </div>
            </div>

            <!-- Unit Gallery -->
            <div style="margin-bottom: 12px;">
                <label style="display: block; font-weight: 600; font-size: 12px; color: #666; margin-bottom: 4px;">Imagens da Unidade</label>
                <div style="display: flex; gap: 10px; margin-bottom: 8px; align-items: center;">
                    <label for="unit-upload-input" class="lot-tooltip-btn primary" style="padding: 4px 8px; font-size: 11px; cursor: pointer; display: flex; align-items: center; gap: 6px; margin:0; width: auto;">
                        <i class="fas fa-camera"></i> Upload Foto
                    </label>
                    <input type="file" id="unit-upload-input" accept="image/*" style="display: none;" 
                        onchange="handleUnitGalleryUpload(this.files[0], '${unitInscricao}')">
                    <span id="unit-upload-status" style="font-size: 10px; color: #666;"></span>
                </div>
                <div id="unit-gallery-preview" style="display: flex; gap: 8px; overflow-x: auto; padding-bottom: 5px;"></div>
                <input type="hidden" id="edit-unit-gallery-json" value='${JSON.stringify(existingEdits.imagens || targetUnit.imagens || [])}'>
            </div>

            <div style="margin-bottom: 12px; border-top: 1px solid #eee; padding-top: 10px;">
                <div style="font-weight: 600; font-size: 12px; color: #333; margin-bottom: 8px;">Dados do Proprietário</div>
                <input type="text" id="edit-unit-owner" placeholder="Nome" value="${existingEdits.nome_proprietario || targetUnit.nome_proprietario || ''}" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 8px;">
                
                <div style="margin-bottom: 8px; position: relative;">
                    <input type="password" id="edit-unit-cpf" placeholder="CPF/CNPJ (Somente números)" value="${existingEdits.cpf_cnpj || targetUnit.cpf_cnpj || ''}" 
                        style="width: 100%; padding: 6px; padding-right: 30px; border: 1px solid #ddd; border-radius: 4px;" autocomplete="off" data-lpignore="true">
                    <button onclick="window.toggleInputType('edit-unit-cpf', this)" style="position: absolute; right: 5px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #64748b;">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>

                <input type="text" id="edit-unit-contact" placeholder="Contato" value="${existingEdits.contato_proprietario || targetUnit.contato_proprietario || ''}" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 8px;">
                
                <div style="display: flex; gap: 8px;">
                    <input type="text" id="edit-unit-cod-ref" placeholder="Cód Ref." value="${existingEdits.cod_ref || targetUnit.cod_ref || ''}" style="flex: 1; padding: 6px; border: 1px solid #ddd; border-radius: 4px;">
                    <input type="text" id="edit-unit-link" placeholder="Link Anúncio" value="${existingEdits.link_url || targetUnit.link_url || ''}" style="flex: 1; padding: 6px; border: 1px solid #ddd; border-radius: 4px;">
                </div>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px; padding-top: 15px; border-top: 1px solid #f1f5f9;">
                <button class="lot-tooltip-btn secondary" onclick="cancelUnitEdit('${unitInscricao}')" style="padding: 10px 20px; font-weight: 600; border-radius: 8px; border: 1px solid #cbd5e1; background: white; color: #475569; cursor: pointer; transition: all 0.2s;">
                    Cancelar
                </button>
                <button class="lot-tooltip-btn primary" onclick="saveUnitEdit('${unitInscricao}')" style="padding: 10px 20px; font-weight: 600; border-radius: 8px; border: none; background: #0f172a; color: white; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.1);">
                    Salvar Alterações
                </button>
            </div>
        </div>
    `;

    // Hide actions in header
    const actions = currentTooltip.querySelector('.unit-tooltip-actions');
    if (actions) actions.style.display = 'none';

    setTimeout(() => {
        window.renderUnitGalleryPreview(existingEdits.imagens || targetUnit.imagens || []);
    }, 0);
};

window.renderUnitGalleryPreview = function (gallery) {
    const container = document.getElementById('unit-gallery-preview');
    const input = document.getElementById('edit-unit-gallery-json');
    if (!container || !input) return;
    input.value = JSON.stringify(gallery);
    container.innerHTML = '';
    gallery.forEach((url, index) => {
        const div = document.createElement('div');
        div.style.cssText = 'position: relative; flex-shrink: 0;';
        div.innerHTML = `
            <img src="${url}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px; border: 1px solid #ddd;">
            <button onclick="removeUnitGalleryImage(${index})" style="position: absolute; top: -5px; right: -5px; background: red; color: white; border: none; border-radius: 50%; width: 18px; height: 18px; font-size: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center;">×</button>
        `;
        container.appendChild(div);
    });
};

window.handleUnitGalleryUpload = async function (file, inscricao) {
    if (!file) return;
    const statusEl = document.getElementById('unit-upload-status');
    const input = document.getElementById('edit-unit-gallery-json');
    if (statusEl) statusEl.innerText = 'Enviando...';

    try {
        const publicUrl = await uploadToSupabase(file, inscricao);
        if (publicUrl) {
            const gallery = JSON.parse(input.value || '[]');
            gallery.push(publicUrl);
            window.renderUnitGalleryPreview(gallery);
            if (statusEl) statusEl.innerText = 'Sucesso!';
        }
    } catch (e) {
        console.error(e);
        if (statusEl) statusEl.innerText = 'Erro';
        Toast.error('Erro upload: ' + e.message);
    }
};

window.removeUnitGalleryImage = function (index) {
    const input = document.getElementById('edit-unit-gallery-json');
    if (!input) return;
    const gallery = JSON.parse(input.value || '[]');
    gallery.splice(index, 1);
    window.renderUnitGalleryPreview(gallery);
};

window.cancelUnitEdit = function (unitInscricao) {
    // Try to find the unit and parent lote to re-open the tooltip
    // Similar search logic as in editUnitFromTooltip
    let targetUnit = null;
    let parentLote = window.currentLoteForUnit;

    if (parentLote && parentLote.unidades) {
        targetUnit = parentLote.unidades.find(u => u.inscricao === unitInscricao);
    } else {
        // Fallback search
        for (const lote of window.allLotes) {
            if (lote.unidades) {
                targetUnit = lote.unidades.find(u => u.inscricao === unitInscricao);
                if (targetUnit) {
                    parentLote = lote;
                    break;
                }
            }
        }
    }

    if (targetUnit && parentLote) {
        // Re-open the unit tooltip
        window.showUnitTooltip(targetUnit, parentLote, 0, 0); // x, y are not strictly used for fixed center tooltip
    } else {
        // Fallback to closing if something went wrong
        closeLotTooltip();
    }
};

window.saveUnitEdit = async function (unitInscricao) {
    window.Loading.show('Salvando...', 'Atualizando unidade...');
    try {
        // Função auxiliar para tratar números (converte vazio para null)
        const getNumber = (id) => {
            const val = document.getElementById(id)?.value;
            if (!val || val.trim() === '') return null;
            return parseFloat(val.replace(',', '.')); // Aceita vírgula como decimal
        };

        // Função auxiliar para texto
        const getText = (id) => {
            const val = document.getElementById(id)?.value;
            return val ? val.trim() : null;
        };

        const edits = {
            complemento: getText('edit-unit-complemento'),
            tipo: getText('edit-unit-tipo'),
            status_venda: getText('edit-unit-status'),

            // Campos numéricos
            quartos: getNumber('edit-unit-quartos'),
            suites: getNumber('edit-unit-suites'),
            vagas: getNumber('edit-unit-vagas'),
            banheiros: getNumber('edit-unit-banheiros'),
            area_util: getNumber('edit-unit-area-util'),
            area_total: getNumber('edit-unit-area-total'),

            // Valores Financeiros
            valor_venal: getNumber('edit-unit-valor-venal'),
            valor_real: getNumber('edit-unit-valor-real'),
            valor_vendavel: getNumber('edit-unit-valor-vendavel'),

            imagens: JSON.parse(document.getElementById('edit-unit-gallery-json')?.value || '[]'),

            nome_proprietario: getText('edit-unit-owner'),
            cod_ref: getText('edit-unit-cod-ref'),
            link_url: getText('edit-unit-link'),
            cpf_cnpj: getText('edit-unit-cpf'),
            contato_proprietario: getText('edit-unit-contact')
        };

        const isAdmin = window.Monetization && (window.Monetization.userRole === 'admin' || window.Monetization.userRole === 'master');

        if (isAdmin) {
            console.log('📤 Enviando payload (Master):', edits);
            const { error } = await window.supabaseApp
                .from('unidades')
                .update(edits)
                .eq('inscricao', unitInscricao);
            if (error) throw error;
            
            // Sync local
            for (const lote of window.allLotes) {
                if (lote.unidades) {
                    const u = lote.unidades.find(u => u.inscricao === unitInscricao);
                    if (u) { Object.assign(u, edits); break; }
                }
            }
        } else {
            console.log('📤 Enviando Edição Privada (User):', edits);
            const { data: { user } } = await window.supabaseApp.auth.getUser();
            
            const editRecords = Object.entries(edits).map(([key, val]) => ({
                user_id: user.id,
                unit_inscricao: unitInscricao,
                field_name: key,
                new_value: Array.isArray(val) ? JSON.stringify(val) : String(val),
                old_value: '' // Could fetch current value if needed
            }));

            const { error } = await window.supabaseApp
                .from('user_unit_edits')
                .upsert(editRecords, { onConflict: 'user_id, unit_inscricao, field_name' });
            
            if (error) throw error;
        }

        // Refresh private cache
        if (window.loadUserPendingEdits) await window.loadUserPendingEdits();

        window.editedLotes[unitInscricao] = edits;

        // Adicionar lote pai à carteira persistente
        if (window.Monetization && window.Monetization.unlockedLots) {
            const cleanId = String(unitInscricao).replace(/\D/g, '');
            window.Monetization.unlockedLots.add(cleanId);
            if (cleanId.length >= 11) {
                window.Monetization.unlockedLots.add(cleanId.substring(0, 8));
            }
        }

        window.Toast.success(isAdmin ? 'Edição salva globalmente!' : 'Sugestão enviada para curadoria!');
        window.Loading.hide();
        window.closeLotTooltip();
        if (window.renderHierarchy) window.renderHierarchy();
    } catch (e) {
        console.error(e);
        window.Loading.hide();
        window.Toast.error('Erro ao salvar unidade: ' + e.message);
    }
};

// ========================================
// OWNER TRANSFER / SALE FLOW
// ========================================
window.showOwnerTransferForm = function(unitInscricao) {
    if (!window.Monetization || !window.Monetization.checkFeatureAccess('edit_private')) {
        window.Toast.info('Acesso restrito: Edição disponível para assinantes Pro/Elite.');
        return;
    }
    const parent = window.currentLoteForUnit;
    const unit = parent?.unidades?.find(u => u.inscricao === unitInscricao);
    
    if (!unit) {
        window.Toast.error("Unidade não encontrada.");
        return;
    }

    const container = document.querySelector('.unit-tooltip-body');
    if (!container) return;

    container.innerHTML = `
        <div style="padding: 20px; animation: slideInUp 0.3s ease;">
            <div style="background: #fff7ed; border: 1px solid #ffedd5; padding: 15px; border-radius: 12px; margin-bottom: 20px;">
                <div style="font-size: 14px; font-weight: 800; color: #9a3412; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-handshake"></i> Transferência de Titularidade
                </div>
                <div style="font-size: 12px; color: #b45309; line-height: 1.5;">
                    Utilize este formulário para registrar uma venda ou troca de proprietário. 
                    <strong>O proprietário atual será movido para o histórico</strong> assim que a alteração for aprovada.
                </div>
            </div>

            <div style="margin-bottom: 15px;">
                <label style="display: block; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 6px;">Proprietário Atual</label>
                <div style="background: #f1f5f9; padding: 10px; border-radius: 8px; color: #475569; font-size: 13px; font-weight: 600;">
                    ${unit.nome_proprietario || 'Não informado'}
                </div>
            </div>

            <div style="margin-bottom: 15px;">
                <label style="display: block; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 6px;">Novo Proprietário (Nome Completo)</label>
                <input type="text" id="transfer-new-owner" placeholder="Ex: João da Silva" style="width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; outline: none; transition: border-color 0.2s;" onfocus="this.style.borderColor='#fb923c'">
            </div>

            <div style="margin-bottom: 15px;">
                <label style="display: block; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 6px;">Novo CPF/CNPJ (Opcional)</label>
                <input type="text" id="transfer-new-doc" placeholder="000.000.000-00" style="width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; outline: none; transition: border-color 0.2s;" onfocus="this.style.borderColor='#fb923c'">
            </div>

            <div style="margin-bottom: 20px;">
                <label style="display: block; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 6px;">Status após Transferência</label>
                <select id="transfer-new-status" style="width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; background: white; outline: none;">
                    <option value="Vendido">✅ Vendido (Finalizado)</option>
                    <option value="Em Negociação">⏳ Em Negociação</option>
                    <option value="Disponível">🏠 Disponível (Apenas troca de nome)</option>
                </select>
            </div>

            <div style="display: flex; flex-direction: column; gap: 10px;">
                <button onclick="window.requestOwnerTransfer('${unit.inscricao}')" style="width: 100%; padding: 14px; background: #ea580c; color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 6px -1px rgba(234, 88, 12, 0.25);">
                    <i class="fas fa-check"></i> Solicitar Transferência
                </button>
                <button onclick="window.showUnitTooltip(window.currentUnitForUpdate, window.currentLoteForUnit)" style="width: 100%; padding: 12px; background: transparent; color: #64748b; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer;">
                    Cancelar
                </button>
            </div>
        </div>
    `;
};

window.requestOwnerTransfer = async function(unitInscricao) {
    const newOwner = document.getElementById('transfer-new-owner')?.value?.trim();
    const newDoc = document.getElementById('transfer-new-doc')?.value?.trim();
    const newStatus = document.getElementById('transfer-new-status')?.value;

    if (!newOwner || newOwner.length < 5) {
        window.Toast.warning("Por favor, informe o nome completo do novo proprietário.");
        return;
    }

    window.Loading.show('Processando...', 'Enviando solicitação de transferência');

    try {
        const { data: { user } } = await window.supabaseApp.auth.getUser();
        const isAdmin = window.Monetization && (window.Monetization.userRole === 'admin' || window.Monetization.userRole === 'master');

        if (isAdmin) {
            // Se for admin, aplica direto (o trigger fará o histórico)
            const { error } = await window.supabaseApp
                .from('unidades')
                .update({ 
                    nome_proprietario: newOwner,
                    cpf_cnpj: newDoc || null,
                    status_venda: newStatus
                })
                .eq('inscricao', unitInscricao);
            
            if (error) throw error;
            window.Toast.success("Transferência realizada com sucesso!");
        } else {
            // Se não for admin, manda para curadoria como edits
            const edits = [];
            edits.push({
                user_id: user.id,
                unit_inscricao: unitInscricao,
                field_name: 'nome_proprietario',
                new_value: newOwner,
                old_value: window.currentUnitForUpdate?.nome_proprietario
            });

            if (newDoc) {
                edits.push({
                    user_id: user.id,
                    unit_inscricao: unitInscricao,
                    field_name: 'cpf_cnpj',
                    new_value: newDoc,
                    old_value: window.currentUnitForUpdate?.cpf_cnpj
                });
            }

            if (newStatus) {
                 edits.push({
                    user_id: user.id,
                    unit_inscricao: unitInscricao,
                    field_name: 'status_venda',
                    new_value: newStatus,
                    old_value: window.currentUnitForUpdate?.status_venda
                });
            }

            const { error } = await window.supabaseApp
                .from('user_unit_edits')
                .upsert(edits, { onConflict: 'user_id, unit_inscricao, field_name' });
            
            if (error) throw error;
            window.Toast.success("Solicitação enviada para aprovação do Master!");
        }

        // Refresh tooltip
        window.closeLotTooltip();
        setTimeout(() => {
            if (window.currentLoteForUnit) window.showLotTooltip(window.currentLoteForUnit);
        }, 500);

    } catch(e) {
        console.error(e);
        window.Toast.error("Erro ao solicitar transferência: " + e.message);
    } finally {
        window.Loading.hide();
    }
};
window.toggleInputType = function (inputId, btn) {
    const input = document.getElementById(inputId);
    const icon = btn.querySelector('i');
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
};

// ========================================
// LOTE CRUD OPERATIONS
// ========================================
window.deleteLote = async function (lote) {
    if (!confirm(`ATENÇÃO: Deseja realmente EXCLUIR o lote ${lote.inscricao}?\nEsta ação é irreversível!`)) return;

    window.Loading.show('Excluindo...', 'Removendo do servidor...');
    try {
        const { error } = await window.supabaseApp.from('lotes').delete().eq('inscricao', lote.inscricao);
        if (error) throw error;

        const index = window.allLotes.findIndex(l => l.inscricao === lote.inscricao);
        if (index !== -1) {
            window.allLotes.splice(index, 1);
            if (typeof window.processDataHierarchy === 'function') window.processDataHierarchy();
            if (typeof window.renderHierarchy === 'function') window.renderHierarchy();
        }

        window.Toast.success(`Lote ${lote.inscricao} excluído.`);
    } catch (e) {
        console.error(e);
        window.Toast.error('Erro ao excluir: ' + e.message);
    } finally {
        window.Loading.hide();
    }
};

// ========================================
// PRIVATE EDITS SYNC & MERGE
// ========================================

window.loadUserPendingEdits = async function() {
    try {
        const { data: { user } } = await window.supabaseApp.auth.getUser();
        if (!user) return;

        const [unitEdits, loteEdits] = await Promise.all([
            window.supabaseApp.from('user_unit_edits').select('*').eq('user_id', user.id).eq('is_approved', false),
            window.supabaseApp.from('user_lote_edits').select('*').eq('user_id', user.id).eq('is_approved', false)
        ]);

        // Reset cache
        window.userPendingEdits = { lotes: {}, units: {} };

        (unitEdits.data || []).forEach(e => {
            if (!window.userPendingEdits.units[e.unit_inscricao]) window.userPendingEdits.units[e.unit_inscricao] = {};
            try {
                window.userPendingEdits.units[e.unit_inscricao][e.field_name] = (e.new_value.startsWith('[') || e.new_value.startsWith('{')) ? JSON.parse(e.new_value) : e.new_value;
            } catch(err) {
                window.userPendingEdits.units[e.unit_inscricao][e.field_name] = e.new_value;
            }
        });

        (loteEdits.data || []).forEach(e => {
            if (!window.userPendingEdits.lotes[e.lote_inscricao]) window.userPendingEdits.lotes[e.lote_inscricao] = {};
            try {
                window.userPendingEdits.lotes[e.lote_inscricao][e.field_name] = (e.new_value.startsWith('[') || e.new_value.startsWith('{')) ? JSON.parse(e.new_value) : e.new_value;
            } catch(err) {
                window.userPendingEdits.lotes[e.lote_inscricao][e.field_name] = e.new_value;
            }
        });

        console.log('📖 Notas particulares carregadas:', window.userPendingEdits);
    } catch (e) {
        console.error('Erro ao carregar notas particulares:', e);
    }
};

window.mergeUserEdits = function(obj, type) {
    if (!obj || !obj.inscricao) return obj;
    const cache = type === 'unit' ? window.userPendingEdits.units : window.userPendingEdits.lotes;
    const edits = cache[obj.inscricao];
    
    if (edits) {
        // Create a copy to avoid mutating central allLotes unless intended
        // But for tooltip display, we usually WANT the mutated version
        Object.assign(obj, edits);
        obj._has_private_notes = true; 
    }
    return obj;
};

window.openAddLoteModal = async function (latlng) {
    const zona = prompt("Zona (0 a 6):", "1");
    if (zona === null) return;
    const setor = prompt("Setor (0000 a 9999):", "0000");
    if (setor === null) return;
    const loteNum = prompt("Lote (000 a 999):", "000");
    if (loteNum === null) return;

    const inscricao = `${zona}${setor.padStart(4, '0')}${loteNum.padStart(3, '0')}000`;
    const utm = window.latLonToUtm(latlng.lat, latlng.lng);

    window.Loading.show('Criando...', 'Inserindo novo lote...');
    try {
        const { error } = await window.supabaseApp.from('lotes').insert({
            inscricao,
            minx: utm.x, miny: utm.y, maxx: utm.x, maxy: utm.y,
            zona, setor: setor.padStart(4, '0'), lote_geo: loteNum.padStart(3, '0')
        });
        if (error) throw error;
        window.Toast.success('Lote criado! Recarregando hierarchy...');
        // Optimization: Normally we'd wait for realtime, but let's assume it works
    } catch (e) {
        window.Toast.error(e.message);
    } finally {
        window.Loading.hide();
    }
};

window.openAddUnitModal = function (lote) {
    let defaultId = lote.inscricao.endsWith('000') ? lote.inscricao.slice(0, -3) + '001' : lote.inscricao + '001';
    const inscricao = prompt("Inscrição da Nova Unidade:", defaultId);
    if (!inscricao) return;
    const owner = prompt("Proprietário:");

    window.addUnit(lote.inscricao, inscricao, owner);
};

window.addUnit = async function (loteInscricao, unitInscricao, owner) {
    Loading.show('Criando...', 'Inserindo unidade...');
    try {
        const { error } = await supabaseApp.from('unidades').insert({
            lote_inscricao: loteInscricao,
            inscricao: unitInscricao,
            nome_proprietario: owner || ''
        });
        if (error) throw error;
        Toast.success('Unidade criada!');
    } catch (e) {
        Toast.error(e.message);
    } finally {
        window.Loading.hide();
    }
};

// Edit Lote - Opens editor panel with lote details
window.editLote = async function (inscricao) {
    console.log('🔧 editLote called with:', inscricao);

    const lote = await window.fetchLotDetails(inscricao);

    if (!lote) {
        console.error('❌ Lote not found:', inscricao);
        window.Toast.error("Lote não encontrado");
        return;
    }

    console.log('✅ Lote found:', lote);

    // Open editor panel (if exists)
    const editorPanel = document.getElementById('editorPanel');
    if (editorPanel) {
        console.log('✅ Editor panel found, populating form');

        // Remove hidden class to show the panel
        editorPanel.classList.remove('hidden');

        // Populate form fields (assuming they exist in the panel)
        const inscricaoInput = editorPanel.querySelector('#edit-inscricao');
        const bairroInput = editorPanel.querySelector('#edit-bairro');
        const quadraInput = editorPanel.querySelector('#edit-quadra');
        const loteNumInput = editorPanel.querySelector('#edit-lote-num');

        if (inscricaoInput) inscricaoInput.value = lote.inscricao || '';
        if (bairroInput) bairroInput.value = lote.bairro || '';
        if (quadraInput) quadraInput.value = lote.quadra || '';
        if (loteNumInput) loteNumInput.value = lote.lote || '';

        window.Toast.info(`Editando lote ${inscricao}`);
    } else {
        console.log('⚠️ No editor panel, using prompt fallback');
        // Quick edit via prompt
        const newBairro = prompt("Bairro:", lote.bairro || "");
        if (newBairro !== null) {
            try {
                const { error } = await window.supabaseApp
                    .from('lotes')
                    .update({ bairro: newBairro })
                    .eq('inscricao', inscricao);
                if (error) throw error;
                window.Toast.success("Lote atualizado!");
            } catch (e) {
                window.Toast.error(e.message);
            }
        }
    }
};

// Move Lote - Update coordinates
window.moveLote = async function (inscricao, latlng) {
    const utm = window.latLonToUtm(latlng.lat, latlng.lng);

    window.Loading.show('Movendo...', 'Atualizando coordenadas...');
    try {
        const { error } = await window.supabaseApp
            .from('lotes')
            .update({
                minx: utm.x,
                miny: utm.y,
                maxx: utm.x,
                maxy: utm.y
            })
            .eq('inscricao', inscricao);
        if (error) throw error;
        window.Toast.success('Lote movido!');
    } catch (e) {
        window.Toast.error(e.message);
    } finally {
        window.Loading.hide();
    }
};

// Delete Lote
window.deleteLote = async function (inscricao) {
    if (!confirm(`Deseja realmente excluir o lote ${inscricao}?`)) return;

    window.Loading.show('Excluindo...', 'Removendo lote...');
    try {
        const { error } = await window.supabaseApp
            .from('lotes')
            .delete()
            .eq('inscricao', inscricao);
        if (error) throw error;
        window.Toast.success('Lote excluído!');
    } catch (e) {
        window.Toast.error(e.message);
    } finally {
        window.Loading.hide();
    }
};

// Delete Unit - Remove a unit from unidades table
window.deleteUnit = async function (inscricao) {
    if (!confirm(`Deseja realmente excluir a unidade ${inscricao}?`)) return;

    window.Loading.show('Excluindo...', 'Removendo unidade...');
    try {
        const { error } = await window.supabaseApp
            .from('unidades')
            .delete()
            .eq('inscricao', inscricao);
        if (error) throw error;
        window.Toast.success('Unidade excluída!');

        // Close tooltip and refresh
        if (window.closeLotTooltip) window.closeLotTooltip();
        if (window.renderHierarchy) window.renderHierarchy();
    } catch (e) {
        window.Toast.error(e.message);
    } finally {
        window.Loading.hide();
    }
};

console.log("✅ Editor Handler module loaded");
