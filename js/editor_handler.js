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
    // Allow everyone to suggest edits (Admin = Global, User = Private/Curatorship)
    const isAdmin = window.Monetization && (window.Monetization.userRole === 'admin' || window.Monetization.userRole === 'master');
    if (!isAdmin && (!window.Monetization || !window.Monetization.checkFeatureAccess('edit_private'))) {
        // We still check for 'edit_private' if we want to restrict basic/guest users, 
        // but the user said "demais usuarios" (other users) should be able to.
        // Let's allow all authenticated users (Elite/Pro/Basic)
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

            <!-- Elevated Documentation Section -->
            <div style="margin-bottom: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 15px;">
                <div style="font-weight: 800; font-size: 13px; color: #1e293b; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; border-bottom: 2px solid #6366f1; padding-bottom: 5px; width: fit-content;">
                    <i class="fas fa-file-signature" style="color: #6366f1;"></i> DOCUMENTAÇÃO MASTER
                </div>
                
                <div style="margin-bottom: 12px;">
                    <label style="display: block; font-weight: 700; font-size: 11px; color: #475569; margin-bottom: 5px; text-transform: uppercase;">Matrícula Mãe (Registro Geral)</label>
                    <input type="text" id="edit-matricula-mae" value="${existingEdits.matricula_mae || lote.matricula_mae || ''}" 
                        style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; font-weight: 600;" placeholder="Ex: 123.456">
                </div>

                <div style="margin-bottom: 12px;">
                    <label style="display: block; font-weight: 700; font-size: 11px; color: #475569; margin-bottom: 5px; text-transform: uppercase;">Plantas & Projetos</label>
                    <div style="display: flex; gap: 10px; margin-bottom: 8px; align-items: center;">
                        <label for="upload-plantas" class="lot-tooltip-btn primary" style="padding: 6px 12px; font-size: 10px; cursor: pointer; display: flex; align-items: center; gap: 6px; margin:0; width: auto; background: #6366f1; border: none; box-shadow: 0 2px 4px rgba(99,102,241,0.2);">
                            <i class="fas fa-plus"></i> Inserir Planta
                        </label>
                        <input type="file" id="upload-plantas" accept="image/*,application/pdf" style="display: none;" 
                            onchange="window.handleAssetUpload(this.files[0], '${inscricao}', 'plantas')">
                        <span id="status-plantas" style="font-size: 10px; color: #94a3b8;"></span>
                    </div>
                    <div id="preview-plantas" style="display: flex; gap: 6px; overflow-x: auto; padding-bottom: 5px; min-height: 40px;"></div>
                    <input type="hidden" id="json-plantas" value='${JSON.stringify(existingEdits.plantas || lote.plantas || [])}'>
                </div>

                <div style="margin-bottom: 5px;">
                    <label style="display: block; font-weight: 700; font-size: 11px; color: #475569; margin-bottom: 5px; text-transform: uppercase;">Docs (Convenção, Habite-se, etc)</label>
                    <div style="display: flex; gap: 10px; margin-bottom: 8px; align-items: center;">
                        <label for="upload-documentos" class="lot-tooltip-btn primary" style="padding: 6px 12px; font-size: 10px; cursor: pointer; display: flex; align-items: center; gap: 6px; margin:0; width: auto; background: #0891b2; border: none; box-shadow: 0 2px 4px rgba(8,145,178,0.2);">
                            <i class="fas fa-plus"></i> Inserir Documento
                        </label>
                        <input type="file" id="upload-documentos" accept="image/*,application/pdf" style="display: none;" 
                            onchange="window.handleAssetUpload(this.files[0], '${inscricao}', 'documentos')">
                        <span id="status-documentos" style="font-size: 10px; color: #94a3b8;"></span>
                    </div>
                    <div id="preview-documentos" style="display: flex; gap: 6px; overflow-x: auto; padding-bottom: 5px; min-height: 40px;"></div>
                    <input type="hidden" id="json-documentos" value='${JSON.stringify(existingEdits.documentos || lote.documentos || [])}'>
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
                        <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer; background: #f8fafc; padding: 6px; border-radius: 4px; border: 1px solid #e2e8f0; color: #1e293b;">
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

    // Initialize previews
    setTimeout(() => {
        window.renderGalleryPreview(existingEdits.gallery || lote.gallery || []);
        window.renderAssetPreview(existingEdits.plantas || lote.plantas || [], 'plantas');
        window.renderAssetPreview(existingEdits.documentos || lote.documentos || [], 'documentos');
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
        window.Toast.error('Erro upload: ' + e.message);
    }
};

window.renderAssetPreview = function (assets, type) {
    const container = document.getElementById(`preview-${type}`);
    const input = document.getElementById(`json-${type}`);
    if (!container || !input) return;

    input.value = JSON.stringify(assets);
    container.innerHTML = '';
    assets.forEach((url, index) => {
        const isPdf = url.toLowerCase().endsWith('.pdf');
        const div = document.createElement('div');
        div.style.position = 'relative';
        div.style.flexShrink = '0';
        div.innerHTML = `
            ${isPdf ? 
                `<div style="width: 50px; height: 50px; background: #fee2e2; border-radius: 4px; display: flex; align-items: center; justify-content: center; border: 1px solid #fecaca;">
                    <i class="fas fa-file-pdf" style="color: #ef4444; font-size: 20px;"></i>
                </div>` : 
                `<img src="${url}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px; border: 1px solid #e2e8f0;">`
            }
            <button onclick="removeAsset(${index}, '${type}')" style="position: absolute; top: -5px; right: -5px; background: #ef4444; color: white; border: none; border-radius: 50%; width: 16px; height: 16px; font-size: 9px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">×</button>
        `;
        container.appendChild(div);
    });
};

window.removeAsset = function (index, type) {
    const input = document.getElementById(`json-${type}`);
    if (!input) return;
    const assets = JSON.parse(input.value || '[]');
    assets.splice(index, 1);
    window.renderAssetPreview(assets, type);
};

window.handleAssetUpload = async function (file, inscricao, type) {
    if (!file) return;
    const statusEl = document.getElementById(`status-${type}`);
    const input = document.getElementById(`json-${type}`);
    if (statusEl) statusEl.innerText = '⏳...';

    try {
        // We can reuse uploadToSupabase but maybe use a different folder logic if needed
        // For now, let's keep it simple or specialized
        const publicUrl = await uploadToSupabase(file, inscricao);
        if (publicUrl) {
            const assets = JSON.parse(input.value || '[]');
            assets.push(publicUrl);
            window.renderAssetPreview(assets, type);
            if (statusEl) statusEl.innerText = '✅';
            setTimeout(() => { if(statusEl) statusEl.innerText = ''; }, 2000);
        }
    } catch (e) {
        console.error(e);
        if (statusEl) statusEl.innerText = '❌';
        window.Toast.error('Erro upload: ' + e.message);
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
            zeladoria: document.getElementById('edit-lote-zeladoria')?.checked || false,
            // Building Docs
            matricula_mae: document.getElementById('edit-matricula-mae')?.value || '',
            plantas: JSON.parse(document.getElementById('json-plantas')?.value || '[]'),
            documentos: JSON.parse(document.getElementById('json-documentos')?.value || '[]')
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
    // Allow everyone to suggest edits
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
                   <label style="display: block; font-weight: 600; font-size: 12px; color: #666; margin-bottom: 4px;">CPF/CNPJ</label>
                   <input type="text" id="edit-unit-cpf" value="${existingEdits.cpf_cnpj || targetUnit.cpf_cnpj || ''}" 
                        style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px;" placeholder="Somente números">
                </div>
            </div>
            <div style="margin-bottom: 12px; display: flex; gap: 8px;">
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
                
                ${(function() {
                    const isUnlocked = window.Monetization && (window.Monetization.isEliteOrAbove() || window.Monetization.isUnlocked(unitInscricao, window.currentLoteForUnit?.inscricao) || window.Monetization.isUnlockedPerson(targetUnit.cpf_cnpj));
                    const canEdit = window.Monetization && (window.Monetization.isEliteOrAbove() || window.Monetization.isUnlocked(unitInscricao, window.currentLoteForUnit?.inscricao));
                    
                    return `
                        <div style="margin-bottom: 8px;">
                            <label style="display: block; font-size: 11px; color: #666; margin-bottom: 2px;">Nome</label>
                            <input type="text" id="edit-unit-owner" placeholder="Nome" 
                                value="${isUnlocked ? (targetUnit.nome_proprietario || '') : window.maskName(targetUnit.nome_proprietario)}" 
                                ${canEdit ? '' : 'readonly'}
                                style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; ${canEdit ? '' : 'background: #f8fafc; cursor: not-allowed;'}">
                        </div>
                        
                        <div style="margin-bottom: 8px;">
                            <label style="display: block; font-size: 11px; color: #666; margin-bottom: 2px;">CPF/CNPJ</label>
                            <div style="position: relative;">
                                <input type="password" id="edit-unit-cpf" placeholder="CPF/CNPJ (Somente números)" 
                                    value="${isUnlocked ? (targetUnit.cpf_cnpj || '') : '************'}" 
                                    ${canEdit ? '' : 'readonly'}
                                    style="width: 100%; padding: 6px; padding-right: 30px; border: 1px solid #ddd; border-radius: 4px; ${canEdit ? '' : 'background: #f8fafc; cursor: not-allowed;'}" 
                                    autocomplete="off" data-lpignore="true">
                                <button onclick="${isUnlocked ? "window.toggleInputType('edit-unit-cpf', this)" : "window.Monetization.showSubscriptionPlans()"}" 
                                    style="position: absolute; right: 5px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #64748b;">
                                    <i class="fas ${isUnlocked ? 'fa-eye' : 'fa-lock'}"></i>
                                </button>
                            </div>
                        </div>

                        <div style="margin-bottom: 8px;">
                            <label style="display: block; font-size: 11px; color: #666; margin-bottom: 2px;">Contato</label>
                            <input type="text" id="edit-unit-contact" placeholder="Contato" 
                                value="${isUnlocked ? (targetUnit.contato_proprietario || '') : window.maskName(targetUnit.contato_proprietario)}" 
                                ${canEdit ? '' : 'readonly'}
                                style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; ${canEdit ? '' : 'background: #f8fafc; cursor: not-allowed;'}">
                        </div>
                    `;
                })()}
                
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
            cpf_cnpj: getText('edit-unit-cpf')?.replace(/\D/g, ''), // Limpar caracteres não numéricos
            nome_proprietario: getText('edit-unit-owner'),
            tipo: getText('edit-unit-tipo'),
            status_venda: getText('edit-unit-status'),

            // Campos numéricos
            quartos: getNumber('edit-unit-quartos'),
            suites: getNumber('edit-unit-suites'),
            vagas: getNumber('edit-unit-vagas'),
            banheiros: getNumber('edit-unit-banheiros'),
            area_util: getNumber('edit-unit-area-util'),
            area_total: getNumber('edit-unit-area-total'),
            valor_venal: getNumber('edit-unit-valor-venal'),
            valor_real: getNumber('edit-unit-valor-real'),
            valor_vendavel: getNumber('edit-unit-valor-vendavel'),
            
            // Novos Campos
            matricula: getText('edit-unit-matricula') || getText(`input-matricula-${unitInscricao}`),
            rip: getText('edit-unit-rip') || getText(`input-rip-${unitInscricao}`),
            cod_ref: getText('edit-unit-cod-ref'),
            link_url: getText('edit-unit-link'),
            imagens: JSON.parse(document.getElementById('edit-unit-gallery-json')?.value || '[]')
        };

        // Security check: Only include owner data if it was editable (not masked/readonly)
        const nameInput = document.getElementById('edit-unit-owner');
        if (nameInput && !nameInput.readOnly) {
            edits.nome_proprietario = nameInput.value.trim();
        }
        
        const cpfInput = document.getElementById('edit-unit-cpf');
        if (cpfInput && !cpfInput.readOnly) {
            // Normalizar CPF/CNPJ removendo pontuação para evitar erros de validação/busca
            edits.cpf_cnpj = cpfInput.value.trim().replace(/\D/g, '');
        }

        const contactInput = document.getElementById('edit-unit-contact');
        if (contactInput && !contactInput.readOnly) {
            const rawValue = contactInput.value.trim();
            // Converter string separada por vírgula em Array para o Postgres (text[])
            edits.contato_proprietario = rawValue ? rawValue.split(',').map(s => s.trim()).filter(s => s !== '') : [];
        }

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

window.updateUnitField = async function (unitInscricao, field, value) {
    const isAdmin = window.Monetization && (window.Monetization.userRole === 'admin' || window.Monetization.userRole === 'master');
    
    try {
        if (isAdmin) {
            console.log(`📤 Atualizando campo único ${field} (Master):`, value);
            const { error } = await window.supabaseApp
                .from('unidades')
                .update({ [field]: value })
                .eq('inscricao', unitInscricao);
            if (error) throw error;

            // Sync local state
            for (const lote of window.allLotes) {
                if (lote.unidades) {
                    const u = lote.unidades.find(u => u.inscricao === unitInscricao);
                    if (u) { u[field] = value; break; }
                }
            }
            window.Toast.success('Campo atualizado!');
        } else {
            // Fluxo de sugestão
            console.log(`📤 Sugerindo campo único ${field}:`, value);
            const { data: { user } } = await window.supabaseApp.auth.getUser();
            const { error } = await window.supabaseApp
                .from('user_unit_edits')
                .upsert({
                    user_id: user.id,
                    unit_inscricao: unitInscricao,
                    field_name: field,
                    new_value: value,
                    old_value: ''
                }, { onConflict: 'user_id, unit_inscricao, field_name' });
            
            if (error) throw error;
            window.Toast.info('Sugestão enviada para curadoria.');
        }

        // Refresh private cache if needed
        if (window.loadUserPendingEdits) await window.loadUserPendingEdits();
        
        if (window.renderHierarchy) window.renderHierarchy();
    } catch (e) {
        console.error("Erro updateUnitField:", e);
        window.Toast.error("Erro ao atualizar campo: " + e.message);
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

let currentCreateLotePos = null;
let currentCreateUnitLote = null;

window.updateLotPreview = function() {
    const z = document.getElementById('new-lot-zona')?.value || '';
    const s = document.getElementById('new-lot-setor')?.value || '';
    const l = document.getElementById('new-lot-lote')?.value || '';
    
    let preview = '';
    if (z || s || l) {
        preview = z.padEnd(1, '-') + s.padStart(4, '0') + l.padStart(3, '0');
    } else {
        preview = '--------';
    }
    document.getElementById('lot-full-preview').innerText = preview;
};

window.openAddLoteModal = function (latlng) {
    currentCreateLotePos = latlng;
    const modal = document.getElementById('modal-lot-form-overlay');
    if (modal) {
        // Reset form
        const zonaInput = document.getElementById('new-lot-zona');
        const setorInput = document.getElementById('new-lot-setor');
        const loteInput = document.getElementById('new-lot-lote');
        
        if (zonaInput) zonaInput.value = '';
        if (setorInput) setorInput.value = '';
        if (loteInput) loteInput.value = '';
        
        window.updateLotPreview();
        
        window.openModal('modal-lot-form-overlay');
    }
};

window.submitNewLot = async function () {
    const zonaInput = document.getElementById('new-lot-zona');
    const setorInput = document.getElementById('new-lot-setor');
    const loteInput = document.getElementById('new-lot-lote');

    if (!zonaInput || !setorInput || !loteInput) return;

    const zona = zonaInput.value.trim();
    const setor = setorInput.value.trim().padStart(4, '0');
    const loteNum = loteInput.value.trim().padStart(3, '0');

    if (zona.length === 0 || setor.length === 0 || loteNum.length === 0) {
        window.Toast.error('Preencha os campos Zona, Setor e Lote.');
        return;
    }

    const inscricao = `${zona}${setor}${loteNum}`;

    if (inscricao.length !== 8) {
        window.Toast.error('A inscrição deve ter exatos 8 dígitos totais.');
        return;
    }

    if (!currentCreateLotePos) {
        window.Toast.error('Posição no mapa não identificada.');
        return;
    }

    const utm = window.latLonToUtm(currentCreateLotePos.lat, currentCreateLotePos.lng);

    window.Loading.show('Criando...', 'Inserindo novo lote...');
    try {
        const { error } = await window.supabaseApp.from('lotes').insert({
            inscricao,
            minx: utm.x, miny: utm.y, maxx: utm.x, maxy: utm.y,
            zona, setor, lote_geo: loteNum,
            municipio: window.currentCity || 'Guarujá'
        });
        if (error) throw error;
        
        window.Toast.success('Lote criado com sucesso!');
        window.closeModal('modal-lot-form-overlay');
    } catch (e) {
        window.Toast.error('Erro ao criar lote: ' + e.message);
    } finally {
        window.Loading.hide();
    }
};

window.openAddUnitModal = function (lote) {
    currentCreateUnitLote = lote;
    const modal = document.getElementById('modal-unit-form-overlay');
    if (modal) {
        document.getElementById('new-unit-lot-ref').value = lote.inscricao;
        document.getElementById('unit-prefix-preview').innerText = lote.inscricao;
        document.getElementById('new-unit-suffix').value = '';
        document.getElementById('new-unit-owner').value = '';
        document.getElementById('new-unit-address').value = '';
        document.getElementById('unit-full-preview').innerText = lote.inscricao + '...';
        
        const suffixInput = document.getElementById('new-unit-suffix');
        if (!suffixInput._hasListener) {
            suffixInput.addEventListener('input', (e) => {
                const val = e.target.value.padStart(3, '0').slice(-3);
                document.getElementById('unit-full-preview').innerText = lote.inscricao + val;
            });
            suffixInput._hasListener = true;
        }
        
        window.openModal('modal-unit-form-overlay');
    }
};

window.submitNewUnit = async function () {
    const suffix = document.getElementById('new-unit-suffix').value.trim();
    const owner = document.getElementById('new-unit-owner').value.trim();
    const address = document.getElementById('new-unit-address').value.trim();

    if (!currentCreateUnitLote) return;
    
    if (suffix.length === 0) {
        window.Toast.error('Informe os 3 dígitos finais da unidade.');
        return;
    }

    const finalSuffix = suffix.padStart(3, '0');
    const unitInscricao = currentCreateUnitLote.inscricao + finalSuffix;

    window.Loading.show('Criando...', 'Inserindo unidade...');
    try {
        const { error } = await window.supabaseApp.from('unidades').insert({
            lote_inscricao: currentCreateUnitLote.inscricao,
            inscricao: unitInscricao,
            nome_proprietario: owner || '',
            endereco_completo: address || ''
        });
        if (error) throw error;
        
        window.Toast.success('Unidade criada com sucesso!');
        window.closeModal('modal-unit-form-overlay');
    } catch (e) {
        window.Toast.error('Erro ao criar unidade: ' + e.message);
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
// ========================================
// MASS UNIT MANAGER (ADMIN ONLY)
// ========================================
let currentMassLoteId = null;

window.openMassUnitManager = async function (loteInscricao) {
    currentMassLoteId = loteInscricao;
    const modal = document.getElementById('modal-mass-unit-manager');
    const tableBody = document.getElementById('mass-unit-table-body');
    const titleSpan = document.getElementById('mass-manager-lote-id');
    
    if (!modal || !tableBody) return;
    
    titleSpan.innerText = loteInscricao;
    tableBody.innerHTML = '<tr><td colspan="6" style="padding: 40px; text-align: center; color: #64748b;"><i class="fas fa-spinner fa-spin"></i> Carregando unidades...</td></tr>';
    window.openModal('modal-mass-unit-manager');
    
    try {
        const { data: units, error } = await window.supabaseApp
            .from('unidades')
            .select('inscricao, nome_proprietario, cpf_cnpj, complemento, matricula, rip, endereco_completo')
            .eq('lote_inscricao', loteInscricao)
            .order('inscricao', { ascending: true });
            
        if (error) throw error;
        
        tableBody.innerHTML = '';
        if (units && units.length > 0) {
            units.forEach(u => window.addMassUnitRow(u));
        } else {
            // Se não houver unidades, adiciona uma linha vazia padrão
            window.addMassUnitRow();
        }
    } catch (e) {
        console.error("Erro ao carregar unidades em massa:", e);
        window.Toast.error("Erro ao carregar lista de unidades.");
    }
};

window.addMassUnitRow = function (data = null) {
    const tableBody = document.getElementById('mass-unit-table-body');
    if (!tableBody) return;
    
    const row = document.createElement('tr');
    row.className = 'mass-unit-row';
    row.style.borderBottom = '1px solid #f1f5f9';
    
    const suffix = data ? data.inscricao.slice(-3) : '';
    const owner = data ? (data.nome_proprietario || '') : '';
    const cpf = data ? (data.cpf_cnpj || '') : '';
    const complemento = data ? (data.complemento || '') : '';
    const matricula = data ? (data.matricula || '') : '';
    const rip = data ? (data.rip || '') : '';
    
    row.innerHTML = `
        <td style="padding: 10px;">
            <input type="text" class="mass-input suffix" value="${suffix}" placeholder="001" maxlength="3" style="width: 100%; padding: 8px; border: 1px solid #e2e8f0; border-radius: 4px; font-family: monospace; text-align: center;">
        </td>
        <td style="padding: 10px;">
            <input type="text" class="mass-input owner" value="${owner}" placeholder="Nome" style="width: 100%; padding: 8px; border: 1px solid #e2e8f0; border-radius: 4px;">
        </td>
        <td style="padding: 10px;">
            <input type="text" class="mass-input cpf" value="${cpf}" placeholder="CPF/CNPJ" style="width: 100%; padding: 8px; border: 1px solid #e2e8f0; border-radius: 4px; font-family: monospace; font-size: 11px;">
        </td>
        <td style="padding: 10px;">
            <input type="text" class="mass-input complemento" value="${complemento}" placeholder="Apto/Torre" style="width: 100%; padding: 8px; border: 1px solid #e2e8f0; border-radius: 4px;">
        </td>
        <td style="padding: 10px;">
            <input type="text" class="mass-input matricula" value="${matricula}" placeholder="Matrícula" style="width: 100%; padding: 8px; border: 1px solid #e2e8f0; border-radius: 4px;">
        </td>
        <td style="padding: 10px;">
            <input type="text" class="mass-input rip" value="${rip}" placeholder="RIP" style="width: 100%; padding: 8px; border: 1px solid #e2e8f0; border-radius: 4px;">
        </td>
        <td style="padding: 10px; text-align: center;">
            <button onclick="this.closest('tr').remove()" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 5px;" title="Remover da lista">
                <i class="fas fa-trash-alt"></i>
            </button>
        </td>
    `;
    tableBody.appendChild(row);
};

window.saveMassUnits = async function () {
    if (!currentMassLoteId) return;
    
    const rows = document.querySelectorAll('.mass-unit-row');
    const unitsToSave = [];
    const errors = [];
    
    const collectiveAddress = document.getElementById('mass-collective-address')?.value.trim() || '';

    rows.forEach((row, index) => {
        const suffix = row.querySelector('.suffix').value.trim().padStart(3, '0');
        if (suffix === '000' && index > 0) {
            // Ignorar avisos se for o registro base, mas validar formato
        }
        
        const owner = row.querySelector('.owner').value.trim();
        const cpf = row.querySelector('.cpf').value.trim().replace(/\D/g, '');
        const complemento = row.querySelector('.complemento').value.trim();
        const matricula = row.querySelector('.matricula').value.trim();
        const rip = row.querySelector('.rip').value.trim();
        
        if (suffix.length === 3) {
            unitsToSave.push({
                lote_inscricao: currentMassLoteId,
                inscricao: currentMassLoteId + suffix,
                nome_proprietario: owner,
                cpf_cnpj: cpf,
                complemento: complemento,
                endereco_completo: collectiveAddress, // Apply collective address
                matricula: matricula,
                rip: rip
            });
        } else {
            errors.push(`Linha ${index + 1}: Sufixo inválido.`);
        }
    });
    
    if (errors.length > 0) {
        window.Toast.error(errors[0]);
        return;
    }
    
    if (unitsToSave.length === 0) {
        window.Toast.info("Nenhuma unidade para salvar.");
        return;
    }
    
    window.Loading.show('Salvando...', `Processando ${unitsToSave.length} unidades`);
    
    try {
        const { error } = await window.supabaseApp
            .from('unidades')
            .upsert(unitsToSave, { onConflict: 'inscricao' });
            
        if (error) throw error;
        
        // Sincronizar estado local (window.allLotes)
        const lote = window.allLotes.find(l => l.inscricao === currentMassLoteId);
        if (lote) {
            // Substituir a lista de unidades local pela nova (mantendo outros campos se existirem)
            // Nota: Para um sync perfeito, idealmente faríamos um novo fetch das unidades completas
            const { data: freshUnits } = await window.supabaseApp
                .from('unidades')
                .select('*')
                .eq('lote_inscricao', currentMassLoteId);
                
            if (freshUnits) lote.unidades = freshUnits;
        }
        
        window.Toast.success(`${unitsToSave.length} unidades salvas com sucesso!`);
        window.closeModal('modal-mass-unit-manager');
        
        // Se estiver com o tooltip aberto, atualiza ele
        if (window.currentTooltip && window.currentLoteForUnit?.inscricao === currentMassLoteId) {
            window.showLotTooltip(lote, 0, 0, true);
        }
        
    } catch (e) {
        console.error("Erro ao salvar unidades em massa:", e);
        window.Toast.error("Erro ao salvar: " + e.message);
    } finally {
        window.Loading.hide();
    }
};
