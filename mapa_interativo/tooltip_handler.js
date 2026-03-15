// ==========================================
// TOOLTIP HANDLER - TOOLTIP_HANDLER.JS
// ==========================================
// Manages all tooltip functionality: lot tooltips, unit tooltips, carousel

// ========================================
// HELPER: DETECT & FIX UNIT TYPE (Garage & Commercial)
// ========================================
async function checkAndFixUnitType(unit) {
    const textToCheck = (unit.complemento || '') + ' ' + (unit.inscricao || '') + ' ' + (unit.tipo || '');
    const lowerText = textToCheck.toLowerCase();

    // 1. Check for Garage
    const garageKeywords = ['garagem', 'vaga', 'box', 'moto', 'estacionamento', 'bicicletario'];
    const matchesGarage = garageKeywords.some(kw => lowerText.includes(kw));
    const isAlreadyGarage = (unit.tipo || '').toLowerCase() === 'garagem';

    if (matchesGarage && !isAlreadyGarage) {
        console.log(`🔧 Auto-Fixing Unit ${unit.inscricao}: Detected as Garagem`);
        unit.tipo = 'Garagem';
        silentUpdateType(unit.inscricao, 'Garagem');
        return 'Garagem';
    }

    // 2. Check for Commercial (Loja, Sala, etc)
    const commercialKeywords = ['loja', 'comercial', 'escritorio', 'sala', 'consultorio'];
    const matchesCommercial = commercialKeywords.some(kw => lowerText.includes(kw));
    const isAlreadyCommercial = ['loja', 'comercial', 'sala'].includes((unit.tipo || '').toLowerCase());

    if (matchesCommercial && !isAlreadyCommercial) {
        console.log(`🔧 Auto-Fixing Unit ${unit.inscricao}: Detected as Comercial`);
        unit.tipo = 'Comercial';
        silentUpdateType(unit.inscricao, 'Comercial');
        return 'Comercial';
    }

    return unit.tipo;
}

async function silentUpdateType(inscricao, newType) {
    try {
        await window.supabaseApp
            .from('unidades')
            .update({ tipo: newType })
            .eq('inscricao', inscricao);
        window.Toast.success(`Unidade auto-classificada como ${newType}`);
    } catch (err) {
        console.error("Auto-fix failed:", err);
    }
}

// ========================================
// LOT TOOLTIP (Main - with thumbnail grid)
// ========================================
async function showLotTooltip(lote, x, y, isRefresh = false) {
    if (!lote) return;
    
    // Prevent multiple refreshes 
    if (isRefresh && lote._lastRefresh && (Date.now() - lote._lastRefresh < 2000)) {
        console.log('🛑 Bloqueando refresh excessivo para', lote.inscricao);
        return;
    }
    if (isRefresh) lote._lastRefresh = Date.now();

    console.log('🏢 showLotTooltip CHAMADA!', {
        inscricao: lote.inscricao,
        isRefresh: isRefresh
    });

    window.currentTooltipType = 'lote';
    window.currentLoteForUnit = lote;

    // Role check for UI restrictions
    const role = window.Monetization ? window.Monetization.userRole : 'user';
    const isFree = role === 'user';

    // Apply private edits (Curation rule)
    if (window.mergeUserEdits) window.mergeUserEdits(lote, 'lote');

    // ADD TO HISTORY (New V1.2)
    if (window.HistoryHandler) {
        window.HistoryHandler.add(lote);
    }

    // BACKGROUND REFRESH: Ensure we have the latest data (including all new columns)
    if (window.fetchLotDetails && !isRefresh) {
        // Use a flag on the lot object to prevent multiple simultaneous background fetches
        if (lote._isRefreshing) {
            console.log('⏳ Já existe uma atualização em andamento para este lote.');
            return;
        }

        lote._isRefreshing = true;
        window.fetchLotDetails(lote.inscricao).then(freshData => {
            lote._isRefreshing = false;
            
            if (freshData) {
                Object.assign(lote, freshData);
                console.log('🔄 Dados do lote atualizados em background!');

                // SEGURANÇA: Só re-renderiza se o usuário ainda estiver vendo ESTE LOTE
                // E se não tiver mudado para a visualização de UNIDADE (evita "pular" de volta)
                if (window.currentTooltip && 
                    window.currentTooltipType === 'lote' && 
                    window.currentLoteForUnit?.inscricao === lote.inscricao) {
                    
                    // Salva scroll atual antes de re-renderizar
                    const scrollable = window.currentTooltip.querySelector('.lot-tooltip-body, [style*="overflow-y"]');
                    const savedScroll = scrollable ? scrollable.scrollTop : 0;

                    showLotTooltip(lote, 0, 0, true).then(() => {
                        // Restaura scroll após re-render
                        setTimeout(() => {
                            const newScrollable = window.currentTooltip?.querySelector('.lot-tooltip-body, [style*="overflow-y"]');
                            if (newScrollable) newScrollable.scrollTop = savedScroll;
                        }, 50);
                    });
                } else if (window.currentTooltipType === 'unit' && window.currentLoteForUnit?.inscricao === lote.inscricao) {
                    console.log('ℹ️ Lote atualizado em background, mas usuário está na unidade. Pulando re-render.');
                    // Aqui opcionalmente poderíamos atualizar window.currentUnitForUpdate com os novos dados do lote
                }
            }
        }).catch(err => {
            lote._isRefreshing = false;
            console.error('Refresh background falhou:', err);
        });
    }

    // Google Places Photos Integration
    if (window.MediaHandler) {
        // Wait up to 1200ms for Google Photos to improve first-render experience
        try {
            await Promise.race([
                window.MediaHandler.fetchGooglePhotos(lote),
                new Promise(resolve => setTimeout(resolve, 1200))
            ]);
            console.log('🖼️ Photos fetch phase complete');
        } catch (e) {
            console.warn('Photos fetch error or timeout', e);
        }
    }

    // Track lot view
    if (window.Analytics) {
        const meta = lote.metadata || {};
        window.Analytics.trackLotView(
            lote.inscricao,
            meta.zona || lote.zona,
            meta.bairro || lote.bairro,
            lote.building_name || lote.nome_edificio
        );
    }

    if (window.currentTooltip) window.currentTooltip.remove();

    const meta = lote.metadata || {};
    const hasUnits = lote.unidades && lote.unidades.length > 0;

    let residentialUnits = [];
    let garageUnits = [];
    let commercialUnits = [];

    if (hasUnits) {
        const sortedUnits = [...lote.unidades].sort((a, b) => {
            const endA = a.inscricao.slice(-3);
            const endB = b.inscricao.slice(-3);
            if (endA === '000') return -1;
            if (endB === '000') return 1;
            return a.inscricao.localeCompare(b.inscricao, undefined, { numeric: true, sensitivity: 'base' });
        });

        sortedUnits.forEach(u => {
            const textToCheck = (u.complemento || '') + ' ' + (u.inscricao || '') + ' ' + (u.tipo || '');
            const lowerText = textToCheck.toLowerCase();

            const garageKeywords = ['garagem', 'vaga', 'box', 'moto', 'estacionamento', 'bicicletario'];
            const commercialKeywords = ['loja', 'comercial', 'escritorio', 'sala', 'consultorio'];

            const matchesGarage = garageKeywords.some(kw => lowerText.includes(kw));
            const matchesCommercial = commercialKeywords.some(kw => lowerText.includes(kw));

            const currentType = (u.tipo || '').toLowerCase();
            const isTypeGarage = currentType === 'garagem';
            const isTypeCommercial = ['comercial', 'loja', 'sala'].includes(currentType);

            let finalType = 'residencial';

            if (isTypeGarage || matchesGarage) finalType = 'garagem';
            else if (isTypeCommercial || matchesCommercial) finalType = 'comercial';

            if (matchesGarage && !isTypeGarage) {
                // checkAndFixUnitType(u); // REMOVIDO para evitar loop de re-render via realtime
            }
            if (matchesCommercial && !isTypeCommercial) {
                // checkAndFixUnitType(u); // REMOVIDO para evitar loop de re-render via realtime
            }

            if (u.inscricao.slice(-3) !== '000' || sortedUnits.length === 1) {
                if (finalType === 'garagem') garageUnits.push(u);
                else if (finalType === 'comercial') commercialUnits.push(u);
                else residentialUnits.push(u);
            }
        });
    }

    const runMatching = (list) => {
        list.forEach(item => {
            item._linkedUnit = null;
            if (!item.nome_proprietario) return;
            const ownerLower = item.nome_proprietario.trim().toLowerCase();
            const match = residentialUnits.find(res => {
                if (!res.nome_proprietario) return false;
                return res.nome_proprietario.trim().toLowerCase() === ownerLower;
            });
            if (match) item._linkedUnit = match;
        });
    };
    runMatching(garageUnits);
    runMatching(commercialUnits);

    const groups = {};
    const groupKeys = [];
    if (residentialUnits.length > 0) {
        residentialUnits.forEach(u => {
            let key = (u.complemento && u.complemento.trim().length > 1) ? u.complemento.trim() : 'Geral';
            if (!groups[key]) { groups[key] = []; groupKeys.push(key); }
            groups[key].push(u);
        });
        groupKeys.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    }

    let tooltipWidth = '90vw';
    let tooltipMaxWidth = '1200px';
    if (groupKeys.length === 1) { tooltipWidth = '90vw'; }
    else if (groupKeys.length === 2) { tooltipWidth = '92vw'; }
    else { tooltipWidth = '95vw'; tooltipMaxWidth = '1400px'; }

    const tooltip = document.createElement('div');
    tooltip.className = 'lot-tooltip';
    tooltip.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: ${tooltipWidth};
        max-width: ${tooltipMaxWidth};
        min-width: 350px;
        max-height: 85vh; /* Limite de altura seguro */
        display: flex;
        flex-direction: column;
        background: white;
        border-radius: 12px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        z-index: 10000;
        pointer-events: auto;
        overflow: hidden; /* Prevent bleed */
    `;

    // CRITICAL: Prevent clicks inside the tooltip from bubbling to the map
    tooltip.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    tooltip.addEventListener('mousedown', (e) => {
        e.stopPropagation();
    });
    tooltip.addEventListener('touchstart', (e) => {
        e.stopPropagation();
    });

    // Prevenir propagação de scroll para o mapa (Se Leaflet ainda existisse em algum lugar)
    if (window.L && L.DomEvent) {
        L.DomEvent.disableScrollPropagation(tooltip);
        L.DomEvent.disableClickPropagation(tooltip);
    }

    let tooltipHTML = '';

    const headerGradient = 'linear-gradient(135deg, #1e293b, #0f172a)';

    // Preparar botão Street View para o header
    let lat = null;
    let lng = null;

    if (lote.minx && lote.miny && lote.maxx && lote.maxy) {
        const centerX = (parseFloat(lote.minx) + parseFloat(lote.maxx)) / 2;
        const centerY = (parseFloat(lote.miny) + parseFloat(lote.maxy)) / 2;
        const coords = window.utmToLatLon(centerX, centerY);
        lat = coords.lat;
        lng = coords.lng;
    }

    const navigateBtn = (lat && lng) ? `
        <a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" 
           target="_blank"
           title="Navegar até o Imóvel"
           style="background: #2563eb; border: 1px solid rgba(255,255,255,0.2); color: white; border-radius: 6px; padding: 6px 12px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: 11px; text-decoration: none;"
           onmouseover="this.style.background='#1d4ed8'"
           onmouseout="this.style.background='#2563eb'">
            <i class="fas fa-route"></i> Como Chegar
        </a>
    ` : '';

    const streetViewBtn = (lat && lng) ? `
        <button onclick="window.StreetViewHandler.open(${lat}, ${lng}, window.currentLoteForUnit)" 
           title="Ver no Google Street View com overlays"
           style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white; border-radius: 6px; padding: 6px 12px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 6px; font-weight: 600; font-size: 11px; text-decoration: none;"
           onmouseover="this.style.background='rgba(255,255,255,0.2)'"
           onmouseout="this.style.background='rgba(255,255,255,0.1)'">
            <i class="fas fa-street-view"></i> Street View IQ
        </button>
    ` : '';

    const cameraBtn = `
        <button onclick="window.CameraHandler.takePhoto('${lote.inscricao}')" 
           title="Adicionar Foto (Mobile)"
           style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white; border-radius: 6px; padding: 6px 12px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 6px; font-weight: 600; font-size: 11px;"
           onmouseover="this.style.background='rgba(255,255,255,0.2)'"
           onmouseout="this.style.background='rgba(255,255,255,0.1)'">
            <i class="fas fa-camera"></i>
        </button>
    `;

    const googleEarthBtn = (lat && lng && window.Monetization.canAccess('mapear_patrimonio')) ? `
        <div style="display: flex; gap: 4px;">
            <button onclick="window.GoogleEarthHandler.exportLotToKML(window.currentLote)" 
               title="Exportar para Google Earth (KML)"
               style="background: #10b981; border: 1px solid rgba(255,255,255,0.2); color: white; border-radius: 6px; padding: 6px 12px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 6px; font-weight: 600; font-size: 11px;"
               onmouseover="this.style.background='#059669'"
               onmouseout="this.style.background='#10b981'">
                <i class="fas fa-globe-americas"></i> KML
            </button>
            <button onclick="window.GoogleEarthHandler.openInGoogleEarth(${lat}, ${lng})" 
               title="Ver em 3D no Google Earth Web"
               style="background: #3b82f6; border: 1px solid rgba(255,255,255,0.2); color: white; border-radius: 6px; padding: 6px 12px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 6px; font-weight: 600; font-size: 11px;"
               onmouseover="this.style.background='#2563eb'"
               onmouseout="this.style.background='#3b82f6'">
                <i class="fas fa-cube"></i> 3D
            </button>
        </div>
    ` : '';

    // Prepare Amenities (Building View)
    const amenitiesList = [
        { key: 'piscina', label: 'Piscina', icon: '🏊' },
        { key: 'academia', label: 'Academia', icon: '🏋️' },
        { key: 'churrasqueira', label: 'Churrasqueira', icon: '🍖' },
        { key: 'salao_jogos', label: 'Salão de Jogos', icon: '🎱' },
        { key: 'salao_festas', label: 'Salão de Festas', icon: '🎉' },
        { key: 'area_verde', label: 'Área Verde', icon: '🌳' },
        { key: 'bicicletario', label: 'Bicicletário', icon: '🚲' },
        { key: 'portaria_24h', label: 'Portaria 24h', icon: '🛡️' },
        { key: 'acesso_pcd', label: 'Acessibilidade', icon: '♿' },
        { key: 'elevador', label: 'Elevador', icon: '🛗' },
        { key: 'servico_praia', label: 'Serviço de Praia', icon: '🏖️' },
        { key: 'zeladoria', label: 'Zeladoria', icon: '🧹' }
    ];
    const activeAmenities = amenitiesList.filter(item => lote[item.key] === true);
    const amenitiesHTML = activeAmenities.length > 0
        ? activeAmenities.map(item => `
            <span style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; background: rgba(255,255,255,0.1); color: white; border-radius: 4px; font-size: 10px; font-weight: 600; border: 1px solid rgba(255,255,255,0.2);">
                <span style="font-size: 12px;">${item.icon}</span> ${item.label}
            </span>
          `).join('')
        : `<span style="font-size: 10px; opacity: 0.6; font-style: italic;">Sem lazer cadastrado</span>`;

    // Condominio Info
    const condoInfo = lote.valor_condominio ? `
         <div style="font-size: 11px; opacity: 0.9; margin-top: 6px; display: flex; align-items: center; gap: 4px; color: #fbbf24; font-weight: 600;">
            <i class="fas fa-file-invoice-dollar"></i> Condomínio: R$ ${lote.valor_condominio}
         </div>
    ` : '';

    // Title & Address Logic (Requested by USER)
    const validOwner = (lote.nome_proprietario && lote.nome_proprietario !== 'null' && lote.nome_proprietario.trim() !== '');
    const headerTitle = lote.building_name || (validOwner ? lote.nome_proprietario : 'Lote sem Nome');

    const lotHeaderAddress = (() => {
        let addr = lote.logradouro || lote.endereco || '';
        // Remove trailing "N° 00000" or similar from the base logradouro if present
        addr = addr.replace(/\s+N[°º]?\s*\d+$/i, '').trim();

        let num = lote.numero ? String(lote.numero).replace(/^0+/, '') : '';
        let bai = lote.bairro || '';
        let final = addr ? (addr + (num ? ', ' + num : '')) : '';
        if (bai) final += (final ? ' - ' : '') + bai;
        return final || 'Endereço não informado';
    })();

    // Building Stats (Number of Apartments, Garages, etc)
    const totalUnitsCount = (residentialUnits.length + garageUnits.length + commercialUnits.length) || 0;
    const unitsStatsHtml = hasUnits && totalUnitsCount > 0 ? `
        <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;">
            <span style="background: rgba(96, 165, 250, 0.1); color: #93c5fd; padding: 4px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; border: 1px solid rgba(96, 165, 250, 0.2);">
                <i class="fas fa-cubes" style="margin-right: 4px;"></i> ${totalUnitsCount} Unidades
            </span>
            ${residentialUnits.length > 0 ? `
            <span style="background: rgba(52, 211, 153, 0.1); color: #6ee7b7; padding: 4px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; border: 1px solid rgba(52, 211, 153, 0.2);">
                <i class="fas fa-door-closed" style="margin-right: 4px;"></i> ${residentialUnits.length} Apts
            </span>` : ''}
            ${garageUnits.length > 0 ? `
            <span style="background: rgba(251, 191, 36, 0.1); color: #fcd34d; padding: 4px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; border: 1px solid rgba(251, 191, 36, 0.2);">
                <i class="fas fa-car" style="margin-right: 4px;"></i> ${garageUnits.length} Vagas
            </span>` : ''}
             ${commercialUnits.length > 0 ? `
            <span style="background: rgba(236, 72, 153, 0.1); color: #f472b6; padding: 4px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; border: 1px solid rgba(236, 72, 153, 0.2);">
                <i class="fas fa-store" style="margin-right: 4px;"></i> ${commercialUnits.length} Lojas/Salas
            </span>` : ''}
        </div>
    ` : `
        <div style="display: flex; gap: 6px; margin-top: 8px;">
            <span style="background: rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; border: 1px solid rgba(255,255,255,0.2);">
                <i class="fas fa-home" style="color: #cbd5e1; margin-right: 4px;"></i> Terreno/Casa (Lote Único)
            </span>
        </div>
    `;

    tooltipHTML += `
    <div class="lot-tooltip-header" style="flex: 0 0 auto; background: ${headerGradient}; color: white; padding: 16px 20px; display: flex; flex-direction: column; border-radius: 12px 12px 0 0; gap: 12px; min-width: 350px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
            <div style="flex: 1; min-width: 180px;">
                <div style="font-weight: 700; font-size: 16px; margin-bottom: 4px; display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-building" style="color: #60a5fa;"></i> 
                    ${headerTitle}
                </div>
                <div style="font-size: 11px; opacity: 0.7; font-family: monospace;">${lote.inscricao}</div>
                <div style="font-size: 11px; opacity: 0.9; margin-top: 4px; display: flex; align-items: start; gap: 4px; max-width: 300px;">
                    <i class="fas fa-map-marker-alt" style="margin-top: 2px;"></i>
                    <span>${lotHeaderAddress}</span>
                </div>
                ${unitsStatsHtml}
            </div>
            <div class="header-buttons-wrapper" style="display: flex; gap: 6px; align-items: center; flex-wrap: nowrap; justify-content: flex-end; flex-shrink: 0;">
                ${navigateBtn}
                ${cameraBtn}
                ${streetViewBtn}
                ${googleEarthBtn}
                
                <button onclick="window.AnunciosHandler.openPanel('${lote.inscricao}')"
                    class="tooltip-action-btn"
                    style="background: #fbbf24; border: 1px solid rgba(255,255,255,0.2); color: #92400e; border-radius: 6px; padding: 6px 12px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: 11px;"
                    onmouseover="this.style.background='#f59e0b'"
                    onmouseout="this.style.background='#fbbf24'">
                    <i class="fas fa-bullhorn"></i> 
                    <span class="btn-text">Anúncios</span>
                    <span id="header-anuncios-badge-${lote.inscricao}" style="background: #ef4444; color: white; border-radius: 50%; padding: 2px 6px; font-size: 9px; display: none;">0</span>
                </button>

                ${window.Monetization.canAccess('link_cliente') ? `
                <button onclick="window.ClientModeHandler.generateLink(lote)"
                    class="tooltip-action-btn"
                    title="Gerar Link Seguro para Cliente"
                    style="background: #10b981; border: 1px solid rgba(255,255,255,0.2); color: white; border-radius: 6px; padding: 6px 12px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: 11px;"
                    onmouseover="this.style.background='#059669'"
                    onmouseout="this.style.background='#10b981'">
                    <i class="fas fa-share-alt"></i> 
                    <span class="btn-text">Link</span>
                </button>
                ` : ''}

                ${window.Monetization.canAccess('advanced_ai') ? `
                <button onclick="window.AdvancedMaps.startDroneFlyover(${lat}, ${lng})"
                    class="tooltip-action-btn"
                    title="Voo de Drone 3D"
                    style="background: #6366f1; border: 1px solid rgba(255,255,255,0.2); color: white; border-radius: 6px; padding: 6px 12px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: 11px;"
                    onmouseover="this.style.background='#4f46e5'"
                    onmouseout="this.style.background='#6366f1'">
                    <i class="fas fa-helicopter"></i> 
                    <span class="btn-text">Drone 3D</span>
                </button>
                ` : ''}

                <button onclick="${isFree ? 'window.Monetization.showSubscriptionPlans()' : `window.editFromTooltip('${lote.inscricao}')`}"
                    class="tooltip-action-btn"
                    title="${isFree ? 'Edição exclusiva para planos Pro/Elite' : 'Editar dados do lote'}"
                    style="background: ${isFree ? 'rgba(251, 191, 36, 0.2)' : 'rgba(255,255,255,0.1)'}; border: 1px solid ${isFree ? '#fbbf24' : 'rgba(255,255,255,0.2)'}; color: ${isFree ? '#fcd34d' : 'white'}; border-radius: 6px; padding: 6px 12px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 6px; font-weight: 600; font-size: 11px;">
                    <i class="fas ${isFree ? 'fa-lock' : 'fa-pen'}"></i> <span class="btn-text">${isFree ? 'Editar (Pro+)' : 'Editar'}</span>
                </button>
                <button class="lot-tooltip-close" style="background: transparent; border: none; color: white; font-size: 24px; cursor: pointer; padding: 0 4px; line-height: 1; margin-left: 4px;">×</button>
            </div>
        </div>

        <!-- Trigger Badge Check -->
        <script>
            setTimeout(() => {
                if(window.AnunciosHandler) window.AnunciosHandler.checkBadge('${lote.inscricao}');
            }, 500);
        </script>

        <!-- AMENITIES BAR -->
        <div style="width: 100%; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1);">
            <div style="font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.6; margin-bottom: 6px; font-weight: 700;">Infraestrutura & Lazer</div>
            <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                ${amenitiesHTML}
            </div>
        </div>
    </div>
    `;

    tooltipHTML += `<div class="lot-tooltip-body" style="padding: 32px 40px; background: #f8fafc; overflow-y: auto; flex: 1 1 auto; min-height: 0; overscroll-behavior: contain; position: relative;">`;

    tooltipHTML += (function () {
        const internalImages = (lote.gallery && lote.gallery.length > 0) ? lote.gallery : (lote.image_url ? [lote.image_url] : []);
        const externalImages = lote._googlePhotos || [];
        
        const allImages = [...internalImages, ...externalImages];
        if (allImages.length === 0) return '';

        const imagesJson = JSON.stringify(allImages).replace(/"/g, '&quot;');

        if (allImages.length === 1) {
            const isGoogle = externalImages.includes(allImages[0]);
            return `
            <div style="margin-bottom: 24px; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); max-height: 380px; cursor: pointer; transition: transform 0.2s; position: relative; background: #f1f5f9;" 
                 onmouseover="this.style.transform='scale(1.01)'" 
                 onmouseout="this.style.transform='scale(1)'"
                 onclick="window.openImageModal(0, ${imagesJson})">
                <img src="${allImages[0]}" style="width: 100%; height: 380px; object-fit: contain; background: #0f172a;" onerror="this.src='/placeholder.png'">
                ${isGoogle ? `<div style="position: absolute; bottom: 12px; right: 12px; background: rgba(0,0,0,0.6); color: white; padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: bold; display: flex; align-items: center; gap: 6px; backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);"><i class="fab fa-google"></i> Google Photos</div>` : ''}
            </div>`;
        }

        // Bento Grid for 2+ images
        const displayLimit = 5; // 1 large + 4 small
        const mainImg = allImages[0];
        const thumbs = allImages.slice(1, displayLimit);
        const hasMore = allImages.length > displayLimit;

        return `
        <div class="bento-gallery" style="display: grid; grid-template-columns: repeat(4, 1fr); grid-template-rows: repeat(2, 110px); gap: 10px; margin-bottom: 24px;">
            <!-- Main Highlight -->
            <div style="grid-column: span 2; grid-row: span 2; border-radius: 12px; overflow: hidden; position: relative; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.15);"
                 onclick="window.openImageModal(0, ${imagesJson})">
                <img src="${mainImg}" style="width: 100%; height: 100%; object-fit: cover;">
                ${externalImages.includes(mainImg) ? `<div style="position: absolute; top: 8px; left: 8px; background: rgba(0,0,0,0.5); color: white; padding: 3px 6px; border-radius: 4px; font-size: 9px;"><i class="fab fa-google"></i></div>` : ''}
            </div>
            <!-- Thumbnails -->
            ${thumbs.map((img, i) => {
                const index = i + 1;
                const isFinal = (index === displayLimit - 1) && hasMore;
                return `
                <div style="border-radius: 10px; overflow: hidden; position: relative; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.1); transition: transform 0.2s;"
                     onmouseover="this.style.transform='scale(1.03)'"
                     onmouseout="this.style.transform='scale(1)'"
                     onclick="window.openImageModal(${index}, ${imagesJson})">
                    <img src="${img}" style="width: 100%; height: 100%; object-fit: cover;">
                    ${externalImages.includes(img) ? `<div style="position: absolute; bottom: 4px; right: 4px; background: rgba(0,0,0,0.5); color: white; padding: 1px 4px; border-radius: 3px; font-size: 8px;"><i class="fab fa-google"></i></div>` : ''}
                    ${isFinal ? `<div style="position: absolute; inset:0; background: rgba(0,0,0,0.7); color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 18px; letter-spacing: 1px;">+${allImages.length - displayLimit + 1}</div>` : ''}
                </div>`;
            }).join('')}
            <!-- If 2 images, fill the gap -->
            ${allImages.length === 2 ? `<div style="grid-column: span 2; grid-row: span 2; background: #f1f5f9; border-radius: 12px; display: flex; align-items: center; justify-content: center; border: 2px dashed #e2e8f0; color: #94a3b8; font-size: 11px; font-weight: 600;">Galeria</div>` : ''}
        </div>`;
    })();

    // Info Blocks
    tooltipHTML += `
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px;">
            <div class="info-block" style="background: white; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; text-align: center;">
                <div class="info-label" style="font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase;">Zona</div>
                <div class="info-value" style="font-size: 14px; color: #334155; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 4px;"><span style="width: 8px; height: 8px; border-radius: 50%; background: ${window.getZoneColor(meta.zona)};"></span> ${meta.zona || '-'}</div>
            </div>
             <div class="info-block" style="background: white; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; text-align: center;">
                <div class="info-label" style="font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase;">Setor</div>
                <div class="info-value" style="font-size: 14px; color: #334155; font-weight: 600; margin-top: 4px;">${meta.setor || '-'}</div>
            </div>
             <div class="info-block" style="background: white; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; text-align: center;">
                <div class="info-label" style="font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase;">Quadra</div>
                <div class="info-value" style="font-size: 14px; color: #334155; font-weight: 600; margin-top: 4px;">${meta.quadra || '-'}</div>
            </div>
            <div class="info-block" style="background: white; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; text-align: center;">
                <div class="info-label" style="font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase;">Altimetria</div>
                <div class="info-value" id="elevation-value-${lote.inscricao}" style="font-size: 14px; font-weight: 600; margin-top: 4px; display:flex; flex-direction:column; align-items:center;">
                    <span style="color: #94a3b8;"><i class="fas fa-spinner fa-spin"></i></span>
                </div>
            </div>
        </div>
        ${meta.endereco ? `<div style="margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px dashed #e2e8f0;"><div style="font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; margin-bottom: 6px;">Endereço</div><div style="font-size: 14px; color: #1e293b; line-height: 1.4; font-weight: 500;">${meta.endereco}</div></div>` : ''}
    `;

    // Fetch and Inject Elevation Data Asynchronously
    if (window.AdvancedMaps && lat && lng) {
        window.AdvancedMaps.getElevation(lat, lng).then(elev => {
            const el = document.getElementById(`elevation-value-${lote.inscricao}`);
            if (el) {
                if (elev !== null) {
                    const h = parseFloat(elev);
                    let badge = '';
                    let tempColor = '#0ea5e9'; // Default Blue
                    if (h <= 2.5) { badge = 'Baixada / PLANO'; tempColor = '#3b82f6'; }
                    else if (h > 2.5 && h <= 15) { badge = 'Nível Intermediário'; tempColor = '#10b981'; } // Green
                    else { badge = 'Elevação Panorâmica'; tempColor = '#8b5cf6'; } // Purple for hills

                    el.innerHTML = `
                        <span style="color: ${tempColor};">${h.toFixed(1)}m</span>
                        <span style="font-size: 9px; padding: 2px 4px; background: ${tempColor}20; color: ${tempColor}; border-radius: 4px; margin-top: 4px; border: 1px solid ${tempColor}40;">${badge}</span>
                    `;
                } else {
                    el.innerHTML = `<span style="color: #94a3b8;">Indisponível</span>`;
                }
            }
        });
    }

    // ===== SOLAR ANALYSIS (V1.2) =====
    if (window.SolarHandler && lat && lng) {
        try {
           tooltipHTML += window.SolarHandler.getSolarWidgetHTML(lat, lng, lote.inscricao);
        } catch(e) { console.error('Solar Error', e); }
    }

    // ===== DISTANCES (TURF.JS) - System GeoRefs & Drawn Items =====
    if (window.turf && lote.minx) {
        try {
            const centerX = (parseFloat(lote.minx) + parseFloat(lote.maxx)) / 2;
            const centerY = (parseFloat(lote.miny) + parseFloat(lote.maxy)) / 2;
            const loteLatLng = window.utmToLatLon(centerX, centerY);
            const lotePoint = turf.point([loteLatLng.lng, loteLatLng.lat]);

            const dists = [];
            
            // 1. Process System Georefs (Praias, Comércios, etc)
            if (window.georefs && window.georefs.length > 0) {
                window.georefs.forEach(ref => {
                    if (!ref.geometria) return;
                    
                    let d = null;
                    const geojson = ref.geometria;
                    const target = (geojson.geometry.type === 'Point') ? geojson : turf.centroid(geojson);
                    d = turf.distance(lotePoint, target, { units: 'meters' });

                    if (d !== null) {
                        const distance = Math.round(d);
                        const isBeach = ref.tipo === 'PRAIA' || ref.tipo === 'MAR';
                        const maxDist = isBeach ? 3000 : 200; // 3km para praia, 200m para POIs gerais

                        if (distance <= maxDist) {
                            dists.push({ 
                                name: ref.nome || ref.tipo, 
                                type: ref.tipo, 
                                dist: distance,
                                id: ref.id,
                                lat: target.geometry.coordinates[1],
                                lng: target.geometry.coordinates[0]
                            });
                        }
                    }
                });
            }

            // 2. Process Drawn Items (Optional backward compatibility)
            if (window.drawnItems && window.drawnItems.eachLayer) {
                window.drawnItems.eachLayer(layer => {
                    const props = layer.feature?.properties;
                    if (!props) return;

                    let d = null;
                    const geojson = layer.toGeoJSON();
                    if (props.tipo === 'MAR') {
                        d = turf.pointToLineDistance(lotePoint, geojson, { units: 'meters' });
                    } else {
                        const target = (geojson.geometry.type === 'Point') ? geojson : turf.centroid(geojson);
                        d = turf.distance(lotePoint, target, { units: 'meters' });
                    }

                    if (d !== null) {
                        const distance = Math.round(d);
                        const isBeach = props.tipo === 'PRAIA' || props.tipo === 'MAR';
                        const maxDist = isBeach ? 3000 : 200;

                        if (distance <= maxDist) {
                            dists.push({ 
                                name: props.nome || props.tipo, 
                                type: props.tipo, 
                                dist: distance,
                                lat: (geojson.geometry.type === 'Point') ? geojson.geometry.coordinates[1] : turf.centroid(geojson).geometry.coordinates[1],
                                lng: (geojson.geometry.type === 'Point') ? geojson.geometry.coordinates[0] : turf.centroid(geojson).geometry.coordinates[0]
                            });
                        }
                    }
                });
            }

            if (dists.length > 0) {
                // Deduplicate and group
                dists.sort((a, b) => a.dist - b.dist);
                const uniqueDists = dists.slice(0, 6); // Max 6 to avoid clutter

                tooltipHTML += `<div style="margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px dashed #e2e8f0;">
                    <div style="font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; margin-bottom: 8px;">Pontos de Interesse & Praia</div>
                    <div style="display:flex; gap:8px; flex-wrap:wrap;">`;

                uniqueDists.forEach((item, i) => {
                    let icon = 'fa-map-marker-alt';
                    if (item.type === 'PRAIA' || item.type === 'MAR') icon = 'fa-water';
                    if (item.type === 'COMERCIO' || item.type === 'SHOPPING') icon = 'fa-shopping-cart';
                    if (item.type === 'ESCOLA') icon = 'fa-graduation-cap';
                    
                    let color = '#475569';
                    let bg = '#f1f5f9';
                    if (item.type === 'PRAIA' || item.type === 'MAR') { color = '#0284c7'; bg = '#e0f2fe'; }

                    tooltipHTML += `
                    <div class="poi-tag" 
                         onclick="window.flyToPOI(${item.lat}, ${item.lng}, '${item.name}')"
                         id="poi-tag-${lote.inscricao}-${i}"
                         style="font-size:11px; font-weight:600; color:${color}; background:${bg}; padding:4px 10px; border-radius:6px; display:flex; align-items:center; gap:6px; cursor:pointer; transition: all 0.2s; border: 1px solid rgba(0,0,0,0.05);"
                         onmouseover="this.style.transform='scale(1.05)'; this.style.borderColor='${color}'"
                         onmouseout="this.style.transform='scale(1)'; this.style.borderColor='rgba(0,0,0,0.05)'">
                        <i class="fas ${icon}"></i> 
                        <span>${item.dist}m - ${item.name}</span>
                        <span class="walking-time" style="font-size: 9px; opacity: 0.7; font-weight: normal; margin-left: 4px;"></span>
                        <i class="fas fa-external-link-alt" style="font-size: 8px; opacity: 0.5;"></i>
                    </div>
                    <script>
                        if (window.AdvancedMaps && ${i} < 3) { // Top 3 to stay within free tier easily
                           window.AdvancedMaps.getWalkingInfo({lat: ${lat}, lng: ${lng}}, {lat: ${item.lat}, lng: ${item.lng}}).then(info => {
                               if (info) {
                                   const tag = document.querySelector('#poi-tag-${lote.inscricao}-${i} .walking-time');
                                   if (tag) tag.innerText = '👣 ' + info.duration;
                               }
                           });
                        }
                    </script>`;
                });
                tooltipHTML += `</div></div>`;
            }
        } catch (e) {
            console.error("Dist Error:", e);
        }
    }

    // ===== NEIGHBORHOOD CONTEXT (OSM - V1.2) =====
    // We add a placeholder div, then call the handler to fill it
    if (lote.inscricao) {
        const osmContainerId = `osm-context-${lote.inscricao}`;
        tooltipHTML += `<div id="${osmContainerId}" style="min-height: 20px;"></div>`;
        
        // Trigger async fetch after render
        setTimeout(() => {
            if (window.OSMHandler && lat && lng) {
                window.OSMHandler.fetchPOIs(lat, lng, osmContainerId);
            }
        }, 100);
    }

    // ===== RESIDENTIAL UNITS =====
    if (residentialUnits.length > 0) {
        tooltipHTML += `<div style="display: flex; gap: 16px; flex-wrap: wrap; padding-bottom: 12px; align-items: flex-start; justify-content: flex-start;">`;
        groupKeys.forEach(key => {
            const groupUnits = groups[key];
            tooltipHTML += `<div style="min-width: 250px; flex: 1 1 250px; background: #fff; border-radius: 8px; border: 1px solid #cbd5e1; display: flex; flex-direction: column; overflow: hidden; margin-bottom: 8px;">`;
            tooltipHTML += `<div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; background: #f1f5f9; border-bottom: 1px solid #cbd5e1;"><div style="font-size: 13px; font-weight: 800; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"><i class="fas fa-layer-group" style="font-size: 12px; color: #64748b;"></i> ${key}</div><button onclick="window.renameTower('${lote.inscricao}', '${key}')" style="background: white; border: 1px solid #d1d5db; cursor: pointer; color: #4b5563; font-size: 10px; display: flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 4px; font-weight: 600; flex-shrink: 0;" onmouseover="this.style.background='#f3f4f6'" onmouseout="this.style.background='white'"><i class="fas fa-pencil-alt"></i></button></div>`;
            tooltipHTML += `<div style="display: flex; flex-direction: column; padding: 8px; gap: 6px;">`;
            groupUnits.forEach(u => tooltipHTML += renderUnitItem(u));
            tooltipHTML += `</div></div>`;
        });
        tooltipHTML += `</div>`;
    }

    // ===== COMMERCIAL SECTION =====
    if (commercialUnits.length > 0) {
        tooltipHTML += `
            <div style="margin-top: 24px; padding-top: 16px; border-top: 2px dashed #cbd5e1;">
                <div style="font-size: 12px; font-weight: 800; color: #0ea5e9; text-transform: uppercase; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-store" style="font-size: 14px;"></i> Área Comercial / Lojas (${commercialUnits.length})
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px;">
        `;
        commercialUnits.forEach(u => tooltipHTML += renderUnitItem(u, 'comercial'));
        tooltipHTML += `</div></div>`;
    }

    // ===== GARAGE SECTION =====
    if (garageUnits.length > 0) {
        tooltipHTML += `
            <div style="margin-top: 24px; padding-top: 16px; border-top: 2px dashed #cbd5e1;">
                <div style="font-size: 12px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-car" style="font-size: 14px;"></i> Garagens & Outros (${garageUnits.length})
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px;">
        `;
        garageUnits.forEach(u => tooltipHTML += renderUnitItem(u, 'garagem'));
        tooltipHTML += `</div></div>`;
    }

    tooltipHTML += `</div>`; // Close Body

    tooltip.innerHTML = tooltipHTML;
    document.body.appendChild(tooltip);
    window.currentTooltip = tooltip;

    // Handlers & Scroll Restore
    const closeBtn = tooltip.querySelector('.lot-tooltip-close');
    if (closeBtn) closeBtn.onclick = window.closeLotTooltip;
    setupUnitClickHandlers(tooltip, lote, x, y);

    const backdrop = document.createElement('div');
    backdrop.className = 'sidebar-backdrop active';
    backdrop.style.zIndex = '9998';
    backdrop.onclick = window.closeLotTooltip;
    document.body.appendChild(backdrop);
    tooltip.backdrop = backdrop;

    if (window.tooltipScrollState && window.tooltipScrollState[lote.inscricao]) {
        const body = tooltip.querySelector('.lot-tooltip-body');
        if (body) setTimeout(() => { body.scrollTop = window.tooltipScrollState[lote.inscricao]; }, 0);
    }

    // Trigger Context Help
    if (window.Onboarding && window.Onboarding.checkAndShowContextHelp) {
        window.Onboarding.checkAndShowContextHelp('lot', '.lot-tooltip');
    }
}

// Helper to render unit item (DRY)
function renderUnitItem(u, mode = 'residential') {
    const unitNum = u.inscricao.slice(-3);
    const linked = u._linkedUnit;
    let statusColor = '#94a3b8';
    const status = (u.status_venda || '').toLowerCase();
    if (status === 'vendido') statusColor = '#ef4444';
    if (status === 'reservado') statusColor = '#f59e0b';
    if (status === 'disponível') statusColor = '#10b981';
    if (status === 'captar') statusColor = '#3b82f6';

    let bgColor = ((mode === 'garagem') || (mode === 'comercial')) ? '#f8fafc' : 'white';
    if (mode === 'comercial') bgColor = '#f0f9ff';

    return `
        <div class="unit-item-clickable" data-unit-inscricao="${u.inscricao}"
            style="background: ${bgColor}; border: 1px solid #e2e8f0; border-left: 4px solid ${statusColor}; border-radius: 6px; padding: 10px 12px; cursor: pointer; transition: all 0.15s; display: flex; flex-direction: column; gap: 4px; box-shadow: 0 1px 1px rgba(0,0,0,0.05);">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; flex-direction: column;">
                        <span style="font-weight: 800; color: #1e293b; font-size: 15px;">${unitNum}</span>
                        ${(mode === 'residential') ? (u.metragem ? `<span style="font-size: 10px; color: #64748b;">${u.metragem}m²</span>` : '') : ''}
                    </div>
                    ${(mode !== 'residential') ? `<span style="font-size: 10px; color: #475569; background: white; padding: 2px 4px; border: 1px solid #e2e8f0; border-radius: 4px; max-width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${u.tipo || (mode === 'comercial' ? 'Loja' : 'Vaga')}</span>` : ''}
                </div>
        ${linked ? `
        <div style="margin-top: 2px; padding: 4px; background: #dcfce7; border-radius: 4px; border: 1px solid #bbf7d0; display: flex; align-items: center; gap: 6px;">
            <i class="fas fa-link" style="color: #166534; font-size: 10px;"></i>
            <span style="font-size: 10px; font-weight: 700; color: #166534;">Ap. ${linked.inscricao.slice(-3)}</span>
        </div>
        ` : ((u.nome_proprietario && u.nome_proprietario !== 'null' && u.nome_proprietario.trim() !== '') ? `
        <div style="font-size: 11px; color: #334155; font-weight: 500; display: flex; align-items: center; gap: 4px; max-width: 140px; justify-content: flex-end;">
             ${window.isUnitUnlocked(u.inscricao) ? u.nome_proprietario.split(' ')[0] : window.maskName(u.nome_proprietario)} 
             ${window.isUnitUnlocked(u.inscricao) ? '' : '<i class="fas fa-lock" style="font-size: 10px; opacity: 0.5;"></i>'}
        </div>` : '')
        }
    </div>`;
}

function setupUnitClickHandlers(tooltip, lote, x, y) {
    tooltip.querySelectorAll('.unit-item-clickable').forEach(item => {
        item.onmouseenter = () => { item.style.transform = 'translateY(-1px)'; item.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.1)'; item.style.borderColor = '#94a3b8'; };
        item.onmouseleave = () => { item.style.transform = 'none'; item.style.boxShadow = '0 1px 1px rgba(0,0,0,0.05)'; item.style.borderColor = '#e2e8f0'; };
        item.onclick = (e) => {
            e.stopPropagation();
            const unitInscricao = item.dataset.unitInscricao;
            const unit = lote.unidades.find(u => u.inscricao === unitInscricao);
            const body = tooltip.querySelector('.lot-tooltip-body');
            if (body) {
                window.tooltipScrollState = window.tooltipScrollState || {};
                window.tooltipScrollState[lote.inscricao] = body.scrollTop;
            }
            if (unit) showUnitTooltip(unit, lote, x, y);
        };
    });
}

window.renameTower = async function (loteInscricao, oldName) {
    const newName = prompt(`Renomear grupo "${oldName}" para: `, oldName);
    if (!newName || newName === oldName) return;
    window.Loading.show('Atualizando...', 'Renomeando grupo...');
    try {
        let query = window.supabaseApp.from('unidades').update({ complemento: newName }).eq('lote_inscricao', loteInscricao);
        if (oldName === 'Geral') query = query.is('complemento', null); else query = query.eq('complemento', oldName);
        const { error } = await query;
        if (error) throw error;
        const lote = window.allLotes.find(l => l.inscricao === loteInscricao);
        if (lote && lote.unidades) lote.unidades.forEach(u => { const currentGroup = (u.complemento && u.complemento.trim().length > 1) ? u.complemento.trim() : 'Geral'; if (currentGroup === oldName) u.complemento = newName; });
        window.Toast.success('Grupo renomeado!');
        showLotTooltip(lote, 0, 0);
    } catch (e) { console.error(e); window.Toast.error('Erro ao renomear: ' + e.message); } finally { window.Loading.hide(); }
};

async function fetchPersonalInsights(unitInscricao) {
    try {
        const { data: { user } } = await window.supabaseApp.auth.getUser();
        if (!user) return {};

        const { data, error } = await window.supabaseApp
            .from('user_unit_edits')
            .select('field_name, new_value')
            .eq('user_id', user.id)
            .eq('unit_inscricao', unitInscricao);

        if (error) return {};

        // Convert array to object { field: value }
        return data.reduce((acc, curr) => {
            acc[curr.field_name] = curr.new_value;
            return acc;
        }, {});
    } catch (e) {
        return {};
    }
}

async function showUnitTooltip(unit, parentLote, x, y) {
    // 🔍 FETCH PERSONAL INSIGHTS FIRST
    const personalData = await fetchPersonalInsights(unit.inscricao);
    const displayUnit = { ...unit, ...personalData };
    
    // Ensure numeric fields are correctly parsed from string (Supabase saves as text)
    if (personalData.valor_vendavel) displayUnit.valor_vendavel = parseFloat(personalData.valor_vendavel);
    if (personalData.valor_real) displayUnit.valor_real = parseFloat(personalData.valor_real);
    
    // Determine visibility and role
    const showsFull = window.Monetization && window.Monetization.isUnlocked(unit.inscricao, parentLote.inscricao);
    const role = window.Monetization ? window.Monetization.userRole : 'user';
    const isFree = role === 'user';
    
    window.currentTooltipType = 'unit';
    window.currentLoteForUnit = parentLote;
    window.currentUnitForUpdate = displayUnit; // Use display version for the editor

    // Check for pending edits by this user for this unit
    let isPendingApproval = false;
    try {
        const { data: { user } } = await window.supabaseApp.auth.getUser();
        if (user) {
            const { data: pending } = await window.supabaseApp
                .from('user_unit_edits')
                .select('id')
                .eq('unit_inscricao', unit.inscricao)
                .eq('user_id', user.id)
                .is('is_approved', false)
                .limit(1);
            isPendingApproval = pending && pending.length > 0;
        }
    } catch(e) {}

    if (window.Analytics) {
        window.Analytics.trackUnitView(unit.id || unit.inscricao, unit.nome_proprietario);
    }

    // --- SAVE TO HISTORY (RECENTLY VIEWED) ---
    if (window.HistoryHandler) {
        window.HistoryHandler.add(parentLote, unit);
    }

    // --- FETCH OWNER HISTORY (DB) ---
    let ownerHistory = [];
    try {
        const { data: hist } = await window.supabaseApp
            .from('unidades_proprietarios_historico')
            .select('*')
            .eq('unidade_inscricao', unit.inscricao)
            .order('created_at', { ascending: false });
        ownerHistory = hist || [];
    } catch(e) { console.error("Error fetching history:", e); }

    if (window.currentTooltip) window.currentTooltip.remove();
    const tooltip = document.createElement('div');
    tooltip.className = 'unit-tooltip';
    tooltip.style.cssText = 'padding:0; border:none; overflow:hidden; border-radius:16px; width:600px; box-shadow:0 30px 60px -12px rgba(0, 0, 0, 0.3); position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); z-index:10000; background:white;';
    const unitNum = unit.inscricao.slice(-3);

    const formatInscricao = (inscricao) => {
        if (!inscricao || inscricao.length < 11) return inscricao;
        return `${inscricao.charAt(0)}-${inscricao.slice(1, 5)}-${inscricao.slice(5, 8)}-${inscricao.slice(-3)}`;
    };

    // --- HEADER HTML ---
    // Prepare Amenities HTML
    const amenitiesList = [
        { key: 'piscina', label: 'Piscina', icon: '🏊' },
        { key: 'academia', label: 'Academia', icon: '🏋️' },
        { key: 'churrasqueira', label: 'Churrasqueira', icon: '🍖' },
        { key: 'salao_jogos', label: 'Salão de Jogos', icon: '🎱' },
        { key: 'portaria_24h', label: 'Portaria 24h', icon: '🛡️' },
        { key: 'elevador', label: 'Elevador', icon: '🛗' },
        { key: 'servico_praia', label: 'Serviço de Praia', icon: '🏖️' },
        { key: 'zeladoria', label: 'Zeladoria', icon: '🧹' }
    ];

    const activeAmenities = amenitiesList.filter(item => parentLote[item.key] === true); // Changed lote to parentLote
    const amenitiesHTML = activeAmenities.length > 0
        ? activeAmenities.map(item => `
            <span style="display: inline-flex; align-items: center; gap: 4px; padding: 6px 10px; background: #f1f5f9; color: #334155; border-radius: 6px; font-size: 11px; font-weight: 700; border: 1px solid #e2e8f0;">
                <span style="font-size: 14px;">${item.icon}</span> ${item.label}
            </span>
          `).join('')
        : `<span style="font-size: 11px; color: #94a3b8; font-style: italic; padding-left: 10px;">Dados de lazer não informados</span>`;

    let tooltipHTML = `
        <div style="background: linear-gradient(135deg, #059669, #047857); color: white; padding: 35px 50px; position: relative; border-bottom: 4px solid #059669;">
            <button class="unit-tooltip-close" style="position: absolute; top: 15px; right: 15px; background: rgba(255,255,255,0.15); border: none; color: white; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.15)'">&times;</button>
            
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
                <button onclick="if(window.currentLoteForUnit) window.showLotTooltip(window.currentLoteForUnit, 0, 0);" 
                        style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white; padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s;" 
                        onmouseover="this.style.background='rgba(255,255,255,0.2)'" 
                        onmouseout="this.style.background='rgba(255,255,255,0.1)'">
                    <i class="fas fa-chevron-left"></i> Explorar Lote
                </button>
                <div style="text-align: right;">
                    <div style="font-size: 10px; opacity: 0.8; text-transform: uppercase; font-weight: 800; letter-spacing: 1px;">Inscrição Imobiliária</div>
                    <div style="font-size: 14px; font-weight: 700; font-family: 'JetBrains Mono', monospace;">${formatInscricao(unit.inscricao)}</div>
                </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                <div>
                    <div style="font-size: 11px; opacity: 0.9; text-transform: uppercase; font-weight: 800; letter-spacing: 1.5px; margin-bottom: 5px;">
                        ${(unit && unit.inscricao.slice(-3) !== '000') ? 'Unidade Autônoma' : 'Informação do Terreno'}
                    </div>
                    <div style="font-size: 42px; font-weight: 900; letter-spacing: -1.5px; line-height: 0.9; display: flex; align-items: center; gap: 15px;">
                        ${(unit && unit.inscricao.slice(-3) !== '000') ? unit.inscricao.slice(-3) : 'Geral'}
                        ${isPendingApproval ? `
                            <div style="background: #f59e0b; color: #1e293b; padding: 5px 14px; border-radius: 30px; font-size: 10px; font-weight: 900; text-transform: uppercase; display: flex; align-items: center; gap: 6px; box-shadow: 0 4px 15px rgba(245, 158, 11, 0.4); border: 2px solid white;">
                                <i class="fas fa-history"></i> Pendente
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                <div style="display: flex; gap: 12px;">
                    ${unit.valor_vendavel ? `
                        <div style="background: rgba(255,255,255,0.2); backdrop-filter: blur(4px); border: 1px solid rgba(255,255,255,0.3); border-radius: 10px; padding: 10px 15px; text-align: right; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                            <div style="font-size: 9px; text-transform: uppercase; font-weight: 900; opacity: 0.9;">Valor Venda</div>
                            <div style="font-size: 18px; font-weight: 900;">
                                ${showsFull ? `R$ ${parseFloat(unit.valor_vendavel).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'R$ *,***,***.**'}
                            </div>
                        </div>
                    ` : ''}
                    ${unit.valor_real ? `
                        <div style="background: rgba(0,0,0,0.1); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 10px 15px; text-align: right;">
                            <div style="font-size: 9px; text-transform: uppercase; font-weight: 800; opacity: 0.7;">Avaliação Real</div>
                            <div style="font-size: 16px; font-weight: 700; opacity: 0.9;">
                                ${showsFull ? `R$ ${parseFloat(unit.valor_real).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'R$ ???'}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>

        <div style="padding: 25px 50px 15px; background: white;">
            <div style="display: flex; gap: 15px; margin-bottom: 25px; align-items: center; flex-wrap: wrap;">
                ${(function () {
                const unitImages = (unit.gallery && unit.gallery.length > 0) ? unit.gallery : (unit.image_url ? [unit.image_url] : []);
                const loteImages = (parentLote.gallery && parentLote.gallery.length > 0) ? parentLote.gallery : (parentLote.image_url ? [parentLote.image_url] : []);
                const finalImages = unitImages.length > 0 ? unitImages : loteImages;

                if (finalImages.length > 0) {
                    const imagesJson = JSON.stringify(finalImages).replace(/"/g, '&quot;');
                    return `
                        <button onclick="window.openImageModal(0, ${imagesJson})" style="background: #f1f5f9; border: 1px solid #e2e8f0; color: #1e293b; padding: 12px 22px; border-radius: 12px; font-size: 13px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 10px; transition: all 0.2s; box-shadow: 0 2px 4px rgba(0,0,0,0.03);" onmouseover="this.style.background='#e2e8f0'; this.style.transform='translateY(-2px)';" onmouseout="this.style.background='#f1f5f9'; this.style.transform='none';">
                            <i class="fas fa-images"></i> Galeria
                        </button>
                    `;
                }
                return '';
                })()}

                <button onclick="window.ClientModeHandler.generateLink(window.currentLoteForUnit, window.currentUnitForUpdate)"
                    style="background: #10b981; border: none; color: white; border-radius: 12px; padding: 12px 22px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 13px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);"
                    onmouseover="this.style.background='#059669'; this.style.transform='translateY(-2px)';" 
                    onmouseout="this.style.background='#10b981'; this.style.transform='none';">
                    <i class="fas fa-share-alt"></i> Link ao Cliente
                </button>

                <!-- Tools Dropdown Menu -->
                <div style="position: relative; margin-left: auto;">
                    <button onclick="
                            const menu = document.getElementById('tooltip-tools-menu'); 
                            menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
                        " 
                        style="background: #eff6ff; border: 1px solid #bfdbfe; color: #2563eb; padding: 12px 20px; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s;"
                        onmouseover="this.style.background='#dbeafe';" 
                        onmouseout="this.style.background='#eff6ff';">
                        <i class="fas fa-toolbox"></i> Ferramentas <i class="fas fa-chevron-down" style="font-size: 10px;"></i>
                    </button>
                    
                    <div id="tooltip-tools-menu" style="display: none; position: absolute; right: 0; top: 110%; background: white; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); width: 220px; z-index: 1000; overflow: hidden;">
                        
                        ${window.Monetization.canAccess('radar_mercado') ? `
                        <button onclick="
                            if(window.AnunciosHandler && window.AnunciosHandler.liveScrapeWeb) {
                                let uLog = window.currentUnitForUpdate.logradouro || window.currentLoteForUnit.logradouro || '';
                                uLog = uLog.replace(/\\s+N[°º]?\\s*\\d+$/i, '').trim();
                                let uNum = window.currentUnitForUpdate.numero ? String(window.currentUnitForUpdate.numero).replace(/^0+/, '') : (window.currentLoteForUnit.numero ? String(window.currentLoteForUnit.numero).replace(/^0+/, '') : '');
                                let uBairro = window.currentUnitForUpdate.bairro_unidade || window.currentLoteForUnit.bairro || '';
                                window.AnunciosHandler.liveScrapeWeb(window.currentUnitForUpdate.inscricao, uLog, uNum, uBairro);
                            }
                            document.getElementById('tooltip-tools-menu').style.display='none';" 
                            style="width: 100%; text-align: left; background: none; border: none; border-bottom: 1px solid #f1f5f9; padding: 12px 15px; font-size: 13px; font-weight: 600; color: #8b5cf6; cursor: pointer; display: flex; align-items: center; gap: 10px; transition: background 0.2s;"
                            onmouseover="this.style.background='#f8fafc';" onmouseout="this.style.background='none';">
                            <i class="fas fa-radar" style="width: 16px;"></i> Radar de Mercado
                        </button>
                        ` : `
                        <button onclick="window.Monetization.showSubscriptionPlans();" 
                            style="width: 100%; text-align: left; background: #fffbeb; border: none; border-bottom: 1px solid #f1f5f9; padding: 12px 15px; font-size: 13px; font-weight: 600; color: #d97706; cursor: pointer; display: flex; align-items: center; gap: 10px; opacity: 0.8;">
                            <i class="fas fa-lock" style="width: 16px;"></i> Radar (Pro+)
                        </button>
                        `}

                        <button onclick="if(window.AnunciosHandler && window.AnunciosHandler.sendFichaWhatsApp) window.AnunciosHandler.sendFichaWhatsApp(window.currentLoteForUnit, window.currentUnitForUpdate); document.getElementById('tooltip-tools-menu').style.display='none';" 
                            style="width: 100%; text-align: left; background: none; border: none; border-bottom: 1px solid #f1f5f9; padding: 12px 15px; font-size: 13px; font-weight: 600; color: #16a34a; cursor: pointer; display: flex; align-items: center; gap: 10px; transition: background 0.2s;"
                            onmouseover="this.style.background='#f8fafc';" onmouseout="this.style.background='none';">
                            <i class="fab fa-whatsapp" style="width: 16px;"></i> Enviar Ficha Zap
                        </button>

                        ${window.Monetization?.checkFeatureAccess('pdf_dossier') ? `
                        <button onclick="window.ReportHandler.generateDossie('${unit.inscricao}')" 
                            style="width: 100%; text-align: left; background: #f0fdf4; border: none; padding: 12px 15px; font-size: 13px; font-weight: 700; color: #166534; cursor: pointer; display: flex; align-items: center; gap: 10px; transition: background 0.2s;"
                            onmouseover="this.style.background='#dcfce7'" onmouseout="this.style.background='#f0fdf4'">
                            <i class="fas fa-file-pdf" style="width: 16px;"></i> Gerar Dossiê PDF
                        </button>
                        ` : `
                        <button onclick="window.Monetization.showSubscriptionPlans();" 
                            style="width: 100%; text-align: left; background: #fff1f2; border: none; padding: 12px 15px; font-size: 13px; font-weight: 600; color: #e11d48; cursor: pointer; display: flex; align-items: center; gap: 10px; opacity: 0.8;">
                            <i class="fas fa-lock" style="width: 16px;"></i> Dossiê PDF (Exclusivo Elite)
                        </button>
                        `}
                    </div>
                </div>
            </div>

            ${unit._has_private_notes ? `
                <div style="background: #fdf2f8; border: 1px solid #fbcfe8; padding: 6px 12px; border-radius: 6px; margin-bottom: 12px; font-size: 11px; color: #db2777; display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-user-lock"></i> <strong>Nota Particular:</strong> Esta informação é visível apenas para você até ser aprovada.
                </div>
            ` : ''}

            <div style="font-size: 15px; color: #1e293b; font-weight: 800; font-family: 'JetBrains Mono', monospace; letter-spacing: 0.5px; margin-bottom: 6px;">${formatInscricao(unit.inscricao)}</div>
            
            ${(function() {
                let uLogradouro = unit.logradouro || parentLote.logradouro || '';
                // Strip trailing 'N° 0000000X' or 'N 000X' from logradouro to avoid duplication
                uLogradouro = uLogradouro.replace(/\s+N[°º]?\s*\d+$/i, '').trim();

                let uNum = unit.numero ? String(unit.numero).replace(/^0+/, '') : (parentLote.numero ? String(parentLote.numero).replace(/^0+/, '') : '');
                let uBairro = unit.bairro_unidade || parentLote.bairro || '';
                let uAddr = uLogradouro ? (uLogradouro + (uNum && uNum !== 'null' ? ', ' + uNum : '')) : '';
                if (uBairro && uBairro !== 'null') uAddr += (uAddr ? ' - ' : '') + uBairro;
                
                return `
                <div style="font-size: 13px; color: #64748b; font-weight: 600; display: flex; align-items: center; gap: 8px; margin-bottom: 2px;">
                    <i class="fas fa-map-marker-alt" style="color: #94a3b8;"></i> ${uAddr}
                </div>
                `;
            })()}

            <div style="font-size: 12px; color: #94a3b8; font-weight: 500; display: flex; align-items: center; gap: 8px;">
                <i class="fas fa-building" style="color: #cbd5e1;"></i> ${parentLote.building_name || 'Terreno'} • ${unit.complemento || 'Gleba Principal'}
            </div>

        <div class="tooltip-tabs" style="padding: 0 60px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; gap: 8px;">
            <div class="tooltip-tab active" onclick="window.switchTooltipTab(this, 'tab-geral')" style="padding: 14px 16px; font-size: 12px; font-weight: 700; color: #0284c7; cursor: pointer; border-bottom: 3px solid #0284c7;">📋 Geral</div>
            <div class="tooltip-tab" onclick="window.switchTooltipTab(this, 'tab-farol'); setTimeout(() => { if(window.AIHistoryHandler) window.AIHistoryHandler.refreshHistoryUI('${unit.inscricao}'); }, 50);" style="padding: 14px 16px; font-size: 12px; font-weight: 700; color: #64748b; cursor: pointer;">🏮 Farol IA</div>
            <div class="tooltip-tab" onclick="window.switchTooltipTab(this, 'tab-docs'); window.refreshFileExplorer('${unit.inscricao}');" style="padding: 14px 16px; font-size: 12px; font-weight: 700; color: #64748b; cursor: pointer;">📂 Documentos</div>
        </div>

        <div class="unit-tooltip-body" style="padding: 32px 60px; background: white; max-height: 500px; overflow-y: auto; position: relative;">
            <!-- ABA: GERAL -->
            <div id="tab-geral" class="tab-content-pane active">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;">
                    <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); padding: 20px; border-radius: 14px; border: 1px solid #bbf7d0; display: flex; flex-direction: column; justify-content: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                        <div style="font-size: 12px; color: #166534; font-weight: 800; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">Área Privativa</div>
                        <div style="font-size: 24px; color: #14532d; font-weight: 800;">
                            ${showsFull ? (unit.metragem || '-') : '***'} 
                            <span style="font-size: 14px; font-weight: 600;">m²</span>
                        </div>
                    </div>
                    <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); padding: 20px; border-radius: 14px; border: 1px solid #e2e8f0; display: flex; flex-direction: column; justify-content: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                        <div style="font-size: 12px; color: #475569; font-weight: 800; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">Status da Unidade</div>
                        <div style="font-size: 18px; color: #334155; font-weight: 700;">${unit.status_venda || 'Disponível'}</div>
                    </div>
                </div>

                <div style="margin-bottom: 15px; border-bottom: 1px solid #f1f5f9; padding-bottom: 10px;">
                    <div style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; margin-bottom: 4px;">Proprietário</div>
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            ${(function() {
                                
                                if (showsFull) {
                                    return `
                                        <div style="font-size: 14px; color: #1e293b; font-weight: 700; display: flex; align-items: center; gap: 6px;">
                                            <i class="fas fa-check-circle" style="color: #10b981;"></i>
                                            ${unit.nome_proprietario || 'Não informado'}
                                        </div>
                                        <button onclick="window.showPreviousOwners('${unit.inscricao}')" style="background: #f1f5f9; border: 1px solid #cbd5e1; color: #475569; border-radius: 4px; padding: 2px 6px; font-size: 9px; font-weight: 700; cursor: pointer;" title="Ver proprietários anteriores">
                                            <i class="fas fa-history"></i> Anteriores
                                        </button>
                                    `;
                                } else {
                                    if (isFree) {
                                        return `
                                            <div style="font-size: 13px; color: #64748b; font-weight: 600; font-style: italic;">
                                                ${window.maskName(unit.nome_proprietario)}
                                            </div>
                                            <button onclick="window.Monetization.showSubscriptionPlans()" 
                                                    style="background: linear-gradient(135deg, #f59e0b, #d97706); color: white; border: none; border-radius: 6px; padding: 6px 14px; font-size: 10px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 4px 6px -1px rgba(217, 119, 6, 0.3);">
                                                <i class="fas fa-star"></i> Exclusivo Pro / Elite
                                            </button>
                                        `;
                                    } else {
                                        return `
                                            <div style="font-size: 14px; color: #64748b; font-weight: 600; font-style: italic;">
                                                ${window.maskName(unit.nome_proprietario)}
                                            </div>
                                            <button onclick="window.unlockUnitInfo('${unit.inscricao}')" 
                                                    style="background: #1e293b; color: white; border: none; border-radius: 6px; padding: 6px 14px; font-size: 10px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s;"
                                                    onmouseover="this.style.background='#334155'" onmouseout="this.style.background='#1e293b'">
                                                <i class="fas fa-unlock"></i> Desbloquear (1 Ficha)
                                            </button>
                                        `;
                                    }
                                }
                            })()}
                        </div>
                        <div style="display: flex; gap: 6px;">
                             <button onclick="window.Enrichment.enrichUnit('${unit.inscricao}')" style="background: #fffbeb; border: 1px solid #fcd34d; color: #b45309; border-radius: 4px; padding: 4px 8px; font-size: 10px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 4px;" title="Consulta Avançada">
                                <i class="fas fa-search-dollar"></i> <span style="display: none; @media(min-width: 400px){display:inline;}">Consultar</span>
                            </button>
                             ${unit.proprietario_id ? `<button onclick="window.ProprietarioTooltip.show(${unit.proprietario_id})" style="background: #f1f5f9; border: 1px solid #cbd5e1; color: #475569; border-radius: 4px; padding: 4px 8px; font-size: 10px; font-weight: 700; cursor: pointer;">Ver Perfil</button>` : ''}
                        </div>
                    </div>
                </div>

                <!-- Novos Campos: Matrícula e RIP -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;">
                    <div style="background: #f8fafc; padding: 14px; border-radius: 12px; border: 1px solid #e2e8f0; transition: all 0.2s;" onmouseover="this.style.borderColor='#cbd5e1'">
                        <div style="font-size: 10px; color: #64748b; font-weight: 800; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">📋 Matrícula Registro</div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <input type="text" id="input-matricula-${unit.inscricao}" value="${unit.matricula || ''}" placeholder="Ex: 123.456" 
                                style="width: 100%; border: none; background: transparent; font-size: 14px; font-weight: 700; color: #1e293b; outline: none; ${isFree ? 'pointer-events: none;' : ''}"
                                ${isFree ? 'readonly' : `onchange="window.updateUnitField('${unit.inscricao}', 'matricula', this.value)"`}>
                            <i class="fas ${isFree ? 'fa-lock' : 'fa-edit'}" style="font-size: 11px; color: ${isFree ? '#fcd34d' : '#cbd5e1'};"></i>
                        </div>
                    </div>
                    <div style="background: #f8fafc; padding: 14px; border-radius: 12px; border: 1px solid #e2e8f0; transition: all 0.2s;" onmouseover="this.style.borderColor='#cbd5e1'">
                        <div style="font-size: 10px; color: #64748b; font-weight: 800; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">⚓ RIP (Marinha)</div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <input type="text" id="input-rip-${unit.inscricao}" value="${unit.rip || ''}" placeholder="Ex: 000123.45" 
                                style="width: 100%; border: none; background: transparent; font-size: 14px; font-weight: 700; color: #1e293b; outline: none; ${isFree ? 'pointer-events: none;' : ''}"
                                ${isFree ? 'readonly' : `onchange="window.updateUnitField('${unit.inscricao}', 'rip', this.value)"`}>
                            <i class="fas ${isFree ? 'fa-lock' : 'fa-anchor'}" style="font-size: 11px; color: ${isFree ? '#fcd34d' : '#cbd5e1'};"></i>
                        </div>
                    </div>
                </div>

                ${unit.cpf_cnpj ? `
                <div style="margin-bottom: 15px; border-bottom: 1px solid #f1f5f9; padding-bottom: 10px;">
                    <div style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; margin-bottom: 4px;">CPF/CNPJ</div>
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span style="font-size: 14px; color: #334155; font-weight: 600;">${window.formatDocument(unit.cpf_cnpj, !window.Monetization?.isUnlocked(unit.inscricao, parentLote.inscricao))}</span>
                            ${window.Monetization?.isUnlocked(unit.inscricao, parentLote.inscricao) ? `<i class="fas fa-eye" style="cursor: pointer; color: #64748b;" onclick="window.toggleCpfVisibility(this, '${unit.cpf_cnpj}')"></i>` : ''}
                        </div>
                        <!-- Detalhes Ficha Avançada -->
                        <button onclick="${window.Monetization?.isUnlocked(unit.inscricao, parentLote.inscricao) ? `window.Enrichment.showFullDetails('${unit.proprietario_id}')` : `window.unlockUnitInfo('${unit.inscricao}')`}" 
                                style="background: #eff6ff; border: 1px solid #bfdbfe; color: #2563eb; border-radius: 4px; padding: 4px 10px; font-size: 10px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                            <i class="fas fa-plus-circle"></i> + INF
                        </button>
                    </div>
                </div>` : ''}

                <div style="margin-top: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <button onclick="${isFree ? 'window.Monetization.showSubscriptionPlans()' : `window.editUnitFromTooltip('${unit.inscricao}')`}" 
                            style="padding: 12px; background: ${isFree ? '#fefce8' : '#f1f5f9'}; border: 1px solid ${isFree ? '#fef08a' : '#cbd5e1'}; border-radius: 8px; color: ${isFree ? '#a16207' : '#475569'}; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <i class="fas ${isFree ? 'fa-lock' : 'fa-edit'}"></i> 
                        ${isFree ? 'Editar (Pro+)' : 'Editar Dados'}
                    </button>
                    <button onclick="${isFree ? 'window.Monetization.showSubscriptionPlans()' : `window.showOwnerTransferForm('${unit.inscricao}')`}" 
                            style="padding: 12px; background: ${isFree ? '#fefce8' : '#fff7ed'}; border: 1px solid ${isFree ? '#fef08a' : '#ffedd5'}; border-radius: 8px; color: ${isFree ? '#a16207' : '#9a3412'}; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <i class="fas ${isFree ? 'fa-lock' : 'fa-handshake'}"></i> 
                        ${isFree ? 'Titular (Pro+)' : 'Trocar Titular'}
                    </button>
                </div>

                ${(ownerHistory.length > 0 && window.Monetization?.checkFeatureAccess('owner_history')) ? `
                <div style="margin-top: 25px; border-top: 1px solid #f1f5f9; padding-top: 15px;">
                    <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
                        <i class="fas fa-history"></i> Histórico de Proprietários
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        ${ownerHistory.map(h => `
                            <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 8px; font-size: 13px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                    <span style="font-weight: 700; color: #1e293b;">${h.proprietario_nome}</span>
                                    <span style="font-size: 10px; color: #94a3b8; font-weight: 600;">${new Date(h.created_at).toLocaleDateString('pt-BR')}</span>
                                </div>
                                <div style="display: flex; gap: 10px; align-items: center;">
                                    <span style="font-size: 11px; color: #64748b;">${window.formatDocument(h.proprietario_documento || 'N/A')}</span>
                                    <span style="font-size: 10px; color: #94a3b8; font-style: italic;">• ${h.detalhes || 'Transferência'}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : (ownerHistory.length > 0 ? `
                <div style="margin-top: 25px; border-top: 1px dashed #e2e8f0; padding: 15px; text-align: center; background: #f8fafc; border-radius: 10px;">
                    <div style="font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 5px;"><i class="fas fa-lock"></i> Histórico de Proprietários</div>
                    <button onclick="window.Monetization.showSubscriptionPlans()" style="background: none; border: none; color: #2563eb; font-size: 10px; font-weight: 800; cursor: pointer; text-decoration: underline;">Planos Elite+</button>
                </div>
                ` : '')}
            </div>

            <!-- ABA: FAROL IA -->
            <div id="tab-farol" class="tab-content-pane" style="display:none;">
                <div style="margin-bottom: 20px; padding: 15px; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 1px solid #bae6fd; border-radius: 12px;">
                    <div style="font-size: 12px; font-weight: 800; color: #0369a1; text-transform: uppercase; margin-bottom: 12px;">Assistente de Inteligência</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <button id="btn-evaluate-farol" onclick="window.evaluateWithFarol('${unit.inscricao}')" style="background: #0f172a; color: white; border: none; padding: 10px; border-radius: 8px; font-weight: 700; font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;"><i class="fas fa-magic"></i> Avaliar Imóvel</button>
                        <button onclick="window.legalCheckup('${unit.inscricao}')" style="background: white; color: #334155; border: 1px solid #cbd5e1; padding: 10px; border-radius: 8px; font-weight: 600; font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;"><i class="fas fa-shield-alt"></i> Segurança Jurídica</button>
                    </div>
                </div>
                <div id="farol-history-${unit.inscricao}" style="border-top: 1px solid #f1f5f9; padding-top: 15px;">
                    <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 10px;">Histórico de Análises</div>
                    <div style="font-size: 12px; color: #94a3b8; text-align: center; padding: 20px;">Nenhuma análise salva.</div>
                </div>
            </div>

            <div id="tab-docs" class="tab-content-pane" style="display:none; height: 100%;">
                <div style="background: #f1f5f9; height: 100%; border-radius: 8px; display: flex; flex-direction: column; overflow: hidden; border: 1px solid #e2e8f0;">
                    
                    <!-- Toolbar -->
                    <div style="padding: 10px; background: white; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                        <div id="explorer-breadcrumbs" style="font-size: 11px; font-weight: 600; color: #475569; flex-shrink: 0; min-width: 60px;">🏠 Início</div>
                        <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                             <!-- AI Tools Dropdown -->
                             <div style="position: relative;">
                                <button onclick="
                                        const aiMenu = document.getElementById('docs-ai-menu'); 
                                        aiMenu.style.display = aiMenu.style.display === 'none' ? 'block' : 'none';
                                        document.getElementById('docs-mkt-menu').style.display='none';
                                    " 
                                    style="background: white; border: 1px solid #e2e8f0; color: #3b82f6; padding: 6px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s;"
                                    title="Inteligência Artificial">
                                    <i class="fas fa-robot"></i> IA <i class="fas fa-chevron-down" style="font-size: 9px;"></i>
                                </button>
                                
                                 <div id="docs-ai-menu" style="display: none; position: absolute; left: 0; top: 110%; background: white; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); width: 160px; z-index: 1000; overflow: hidden;">
                                    <button onclick="window.showContractOptions('${unit.inscricao}'); document.getElementById('docs-ai-menu').style.display='none';" 
                                        style="width: 100%; text-align: left; background: none; border: none; border-bottom: 1px solid #f1f5f9; padding: 10px 12px; font-size: 11px; font-weight: 600; color: #3b82f6; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: background 0.2s;"
                                        onmouseover="this.style.background='#eff6ff';" onmouseout="this.style.background='none';">
                                        <i class="fas fa-file-contract" style="width: 14px;"></i> Contratos
                                    </button>
                                    <button onclick="window.showMatriculaAnalyzer('${unit.inscricao}'); document.getElementById('docs-ai-menu').style.display='none';" 
                                        style="width: 100%; text-align: left; background: none; border: none; padding: 10px 12px; font-size: 11px; font-weight: 600; color: #8b5cf6; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: background 0.2s;"
                                        onmouseover="this.style.background='#f3e8ff';" onmouseout="this.style.background='none';">
                                        <i class="fas fa-search-plus" style="width: 14px;"></i> Analisar Matrícula
                                    </button>
                                </div>
                             </div>
                             
                             <!-- Marketing Dropdown -->
                             <div style="position: relative;">
                                <button onclick="
                                        const mktMenu = document.getElementById('docs-mkt-menu'); 
                                        mktMenu.style.display = mktMenu.style.display === 'none' ? 'block' : 'none';
                                        document.getElementById('docs-ai-menu').style.display='none';
                                    " 
                                    style="background: white; border: 1px solid #e2e8f0; color: #ec4899; padding: 6px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s;"
                                    title="Marketing">
                                    <i class="fas fa-bullhorn"></i> Redes <i class="fas fa-chevron-down" style="font-size: 9px;"></i>
                                </button>
                                
                                <div id="docs-mkt-menu" style="display: none; position: absolute; left: 0; top: 110%; background: white; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); width: 180px; z-index: 1000; overflow: hidden;">
                                    <button onclick="window.generateMarketing('${unit.inscricao}', 'Instagram'); document.getElementById('docs-mkt-menu').style.display='none';" 
                                        style="width: 100%; text-align: left; background: none; border: none; border-bottom: 1px solid #f1f5f9; padding: 10px 12px; font-size: 11px; font-weight: 600; color: #db2777; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: background 0.2s;"
                                        onmouseover="this.style.background='#fdf2f8';" onmouseout="this.style.background='none';">
                                        <i class="fab fa-instagram" style="width: 14px;"></i> Post Instagram
                                    </button>
                                    <button onclick="window.generateMarketing('${unit.inscricao}', 'WhatsApp'); document.getElementById('docs-mkt-menu').style.display='none';" 
                                        style="width: 100%; text-align: left; background: none; border: none; border-bottom: 1px solid #f1f5f9; padding: 10px 12px; font-size: 11px; font-weight: 600; color: #16a34a; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: background 0.2s;"
                                        onmouseover="this.style.background='#f0fdf4';" onmouseout="this.style.background='none';">
                                        <i class="fab fa-whatsapp" style="width: 14px;"></i> Mensagem Zap
                                    </button>
                                    <button onclick="window.generateMarketing('${unit.inscricao}', 'Script Captação'); document.getElementById('docs-mkt-menu').style.display='none';" 
                                        style="width: 100%; text-align: left; background: none; border: none; border-bottom: 1px solid #f1f5f9; padding: 10px 12px; font-size: 11px; font-weight: 600; color: #0284c7; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: background 0.2s;"
                                        onmouseover="this.style.background='#f0f9ff';" onmouseout="this.style.background='none';">
                                        <i class="fas fa-phone-alt" style="width: 14px;"></i> Script Captação
                                    </button>
                                    <button onclick="window.generateMarketing('${unit.inscricao}', 'Exclusividade'); document.getElementById('docs-mkt-menu').style.display='none';" 
                                        style="width: 100%; text-align: left; background: none; border: none; padding: 10px 12px; font-size: 11px; font-weight: 600; color: #ca8a04; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: background 0.2s;"
                                        onmouseover="this.style.background='#fefce8';" onmouseout="this.style.background='none';">
                                        <i class="fas fa-star" style="width: 14px;"></i> Argumentos
                                    </button>
                                </div>
                             </div>

                             <div style="width: 1px; background: #e2e8f0; margin: 0 4px;"></div>
                             
                             <!-- Explorer Actions -->
                             <label style="background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; font-size: 11px; font-weight: 700; padding: 6px 10px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                                <i class="fas fa-cloud-upload-alt"></i> Upload
                                <input type="file" style="display: none;" onchange="window.uploadFile(this)">
                             </label>
                             <button onclick="window.createFolder()" style="background: white; border: 1px solid #e2e8f0; color: #64748b; font-size: 11px; font-weight: 700; padding: 6px 10px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                                <i class="fas fa-folder-plus"></i> <span class="mobile-hide">Pasta</span>
                             </button>
                        </div>
                    </div>

                    <!-- File Grid -->
                    <div id="file-explorer-content" style="flex: 1; padding: 15px; display: grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); grid-auto-rows: min-content; gap: 10px; overflow-y: auto;">
                        <!-- Files Load Here -->
                    </div>

                </div>
            </div>
        </div>
    `;

    tooltip.innerHTML = tooltipHTML;
    document.body.appendChild(tooltip);
    window.currentTooltip = tooltip;
    window.currentLoteForUnit = parentLote;

    const closeBtn = tooltip.querySelector('.unit-tooltip-close');
    if (closeBtn) closeBtn.onclick = window.closeLotTooltip;

    const backdrop = document.createElement('div');
    backdrop.className = 'sidebar-backdrop active';
    backdrop.style.zIndex = '9998';
    backdrop.onclick = window.closeLotTooltip;
    document.body.appendChild(backdrop);
    tooltip.backdrop = backdrop;

    // CRITICAL: Prevent clicks inside the tooltip from bubbling to the map
    tooltip.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    tooltip.addEventListener('mousedown', (e) => {
        e.stopPropagation();
    });
    tooltip.addEventListener('touchstart', (e) => {
        e.stopPropagation();
    });

    if (unit.cpf_cnpj && unit.nome_proprietario && !unit.proprietario_id) {
        checkAndConsolidateOwner(unit);
    }

    // Trigger Context Help
    if (window.Onboarding && window.Onboarding.checkAndShowContextHelp) {
        window.Onboarding.checkAndShowContextHelp('unit', '.unit-tooltip');
    }

    // 🏷️ INDICATE PRIVATE VIEW
    if (Object.keys(personalData).length > 0) {
        const badge = document.createElement('div');
        badge.style.cssText = 'position: absolute; bottom: 10px; right: 60px; font-size: 9px; color: #6366f1; font-weight: 800; background: #eef2ff; padding: 2px 8px; border-radius: 4px; border: 1px solid #c3dafe;';
        badge.innerHTML = '<i class="fas fa-user-shield"></i> Exibindo Suas Notas Particulares';
        tooltip.appendChild(badge);
    }
}

async function checkAndConsolidateOwner(unit) {
    // 1. Validar CPF e Nome mínimos
    const cpfLimpo = unit.cpf_cnpj.replace(/\D/g, '');
    let nomeLimpo = unit.nome_proprietario ? unit.nome_proprietario.trim() : '';

    if (cpfLimpo.length < 11 || nomeLimpo.length < 3) return;
    try {
        let ownerId = null;
        let ownerData = null;

        // 2. Tentar UPSERT (Criar ou ignorar se existe)
        // Usamos ignoreDuplicates: true para NÃO sobrescrever dados se já existir.
        // ========================================
        // GLOBAL INTERACTION HELPERS
        // ========================================
        window.flyToPOI = function(lat, lng, name) {
            if (!window.map) return;
            
            window.Toast.info(`Navegando para: ${name}`);
            
            // Smooth navigation to POI
            window.map.panTo({ lat, lng });
            window.map.setZoom(19);
            window.map.setTilt(45);
            
            // Optional: add temporary highlight marker/pulse?
            const marker = new google.maps.Marker({
                position: { lat, lng },
                map: window.map,
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 10,
                    fillColor: "#ef4444",
                    fillOpacity: 0.4,
                    strokeWeight: 2,
                    strokeColor: "#ef4444"
                }
            });
            
            setTimeout(() => marker.setMap(null), 3000);
        };

        window.flyToGeoRef = function(georef, name) {
            if (!window.map || !georef || !georef.lat || !georef.lng) return;
            window.flyToPOI(georef.lat, georef.lng, name || 'Localização');
        };

        // IMPORTANTE: NÃO usamos .select() aqui para evitar erro 406 (Not Acceptable) se o upsert for ignorado.
        const tipo = cpfLimpo.length > 11 ? 'PJ' : 'PF';

        const { error: upsertError } = await window.supabaseApp
            .from('proprietarios')
            .upsert({
                cpf_cnpj: cpfLimpo,
                nome_completo: nomeLimpo,
                tipo: tipo,
                created_at: new Date().toISOString()
            }, {
                onConflict: 'cpf_cnpj',
                ignoreDuplicates: true
            });

        if (upsertError) {
            console.error("Erro no Upsert (Silent):", upsertError);
            // Não retornamos porque pode ser erro de rede, mas a query abaixo pode funcionar se já exitir
        }

        // 3. Buscar o ID do proprietário (seja novo ou existente)
        const { data: ownerRecord } = await window.supabaseApp
            .from('proprietarios')
            .select('id, dados_enrichment')
            .eq('cpf_cnpj', cpfLimpo)
            .maybeSingle();

        if (ownerRecord) {
            ownerId = ownerRecord.id;
            ownerData = ownerRecord.dados_enrichment;
        }

        // 4. Vincular Unidade (e Backfill se disponível)
        if (ownerId) {
            // Se já está vinculado corretamente, pula
            if (unit.proprietario_id === ownerId) {
                return;
            }

            const updates = { proprietario_id: ownerId };

            // Se o dono tem dados ricos e a unidade não, copiar! (Backfill Gratuito)
            if (ownerData && (!unit.dados_enrichment || Object.keys(unit.dados_enrichment).length === 0)) {
                updates.dados_enrichment = ownerData;

                // Mesclar contatos com cuidado
                if (ownerData.mobile_phones) {
                    const phones = ownerData.mobile_phones.map(p => `(${p.ddd}) ${p.number} `);
                    const currentStr = unit.contato_proprietario;
                    let currentList = [];

                    if (Array.isArray(currentStr)) currentList = currentStr;
                    else if (currentStr) currentList = [currentStr];

                    updates.contato_proprietario = [...new Set([...currentList, ...phones])];
                }
            }

            const { error: updateError } = await window.supabaseApp
                .from('unidades')
                .update(updates)
                .eq('inscricao', unit.inscricao);

            if (!updateError) {
                // console.log(`🔗 Unidade ${ unit.inscricao } vinculada -> ${ ownerId } `);
            }
        }
    } catch (e) {
        console.error("Erro checkAndConsolidateOwner:", e);
    }
}

function closeLotTooltip() {
    if (window.currentTooltip) {
        window.tooltipScrollState = {};
        if (window.currentTooltip.backdrop) window.currentTooltip.backdrop.remove();
        window.currentTooltip.remove();
        window.currentTooltip = null;
    }

    // Clean up specifically created backdrops (prevent duplicates)
    // Note: We avoid removing the main sidebarBackdrop if we define it differently,
    // but here we are removing dynamically created ones.
    const allBackdrops = document.querySelectorAll('.sidebar-backdrop:not(#sidebarBackdrop)');
    allBackdrops.forEach(backdrop => backdrop.remove());
    document.body.style.overflow = '';

    // RESTORE MOBILE SIDEBAR IF NEEDED
    if (window.innerWidth <= 768 && window.mobileSidebarWasOpen) {
        // Short delay to allow transitions to finish
        setTimeout(() => {
            if (window.openMobileSidebar) window.openMobileSidebar();
            window.mobileSidebarWasOpen = false; // Reset flag
        }, 100);
    }
}

window.unlockUnitInfo = async function(inscricao) {
    if (!window.Monetization) return;
    
    // Agora usamos o sistema centralizado de confirmação/desbloqueio
    const loteInscricao = window.currentLoteForUnit?.inscricao;
    if (!loteInscricao) return;

    // promptUnlockLote em monetization_handler já cuida do modal de confirmação,
    // custo de créditos, limite do plano e feedback final.
    await window.Monetization.promptUnlockLote(loteInscricao, inscricao, 1);
    
    // Ouvimos pelo sucesso para atualizar a UI local
    // (Poderíamos usar um observer, mas um pequeno delay em tooltip refresh funciona)
    setTimeout(() => {
        if (window.Monetization.isUnlocked(inscricao, loteInscricao)) {
            const unit = window.currentLoteForUnit.unidades.find(u => u.inscricao === inscricao);
            const lote = window.currentLoteForUnit;
            if (unit && lote) {
                window.showUnitTooltip(unit, lote, 0, 0, true);
            }
        }
    }, 1500);
};

window.showLotTooltip = showLotTooltip;
window.showUnitTooltip = showUnitTooltip;
window.closeLotTooltip = closeLotTooltip;
window.moveCarousel = window.moveCarousel || function () { };

// ===========================================
// FERRAMENTA DE ADMIN: SINCRONIZAÇÃO EM MASSA
// ===========================================
window.runFullOwnerSync = async function () {
    console.log("🚀 Iniciando Sincronização em Massa de Proprietários...");
    window.Toast.info("Iniciando Sync de Proprietários (Ver Console)...");

    // 1. Buscar unidades candidatas (Com CPF mas desvinculadas)
    // REDUZIDO para 200 para evitar sobrecarga de recursos do navegador
    const LIMIT = 200;
    const { data: units, error } = await window.supabaseApp
        .from('unidades')
        .select('inscricao, cpf_cnpj, nome_proprietario, proprietario_id, dados_enrichment, contato_proprietario')
        .not('cpf_cnpj', 'is', null)
        .is('proprietario_id', null)
        .limit(LIMIT);

    if (error) {
        console.error("Erro buscando unidades:", error);
        window.Toast.error("Erro ao buscar dados.");
        return;
    }

    if (units.length === 0) {
        console.log("✅ Nada para processar. Tudo sincronizado!");
        window.Toast.success("Tudo sincronizado!");
        return;
    }

    console.log(`📋 Encontradas ${units.length} unidades pendentes.Processando em lotes...`);

    let processed = 0;
    let errors = 0;

    for (const unit of units) {
        // Pausa pequena ENTRE CADA ITEM para não engasgar o navegador
        await new Promise(r => setTimeout(r, 50));

        try {
            await checkAndConsolidateOwner(unit);
        } catch (e) {
            console.error(`Erro ao processar unidade ${unit.inscricao}: `, e);
            errors++;
        }

        processed++;

        // Pausa maior a cada 20 itens para liberar recursos do navegador (network/cpu)
        if (processed % 20 === 0) {
            console.log(`⏳ Processado ${processed}/${units.length}... (Pausa para respirar)`);
            await new Promise(r => setTimeout(r, 1000)); // 1 segundo de pausa
        }
    }

    console.log(`✅ Fim do lote.Processados: ${processed}, Erros: ${errors} `);

    if (processed === LIMIT) {
        window.Toast.warning(`Lote de ${LIMIT} concluído.Ainda pode haver mais.Rode novamente para continuar.`);
    } else {
        window.Toast.success(`Sincronização concluída! ${processed} unidades processadas.`);
    }
};

window.evaluateWithFarol = async function (inscricao) {
    const unit = window.currentLoteForUnit.unidades.find(u => u.inscricao === inscricao);
    const lote = window.currentLoteForUnit;
    if (!unit) return;

    const btn = document.getElementById('btn-evaluate-farol');
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = "Consultando...";
    btn.style.opacity = '0.7';

    // Show Progress Modal
    const loadingModal = document.createElement('div');
    loadingModal.id = 'farol-loading-modal';
    loadingModal.className = 'custom-modal-overlay active';
    loadingModal.style.zIndex = '10002';
    loadingModal.innerHTML = `
        <div class="custom-modal" style="max-width: 400px; text-align: center; padding: 40px;">
            <div style="font-size: 50px; margin-bottom: 20px; animation: pulse 1.5s infinite;">💎</div>
            <div style="font-size: 18px; font-weight: 700; color: #334155; margin-bottom: 10px;">Analisando Mercado...</div>
            <div style="font-size: 13px; color: #64748b; margin-bottom: 20px;">O Farol está cruzando dados de oferta, demanda e valorização.</div>
            
            <div style="width: 100%; height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; position: relative;">
                <div style="width: 30%; height: 100%; background: #0284c7; border-radius: 3px; position: absolute; left: 0; animation: loadingBar 2s infinite ease-in-out;"></div>
            </div>
            <style>
                @keyframes loadingBar {
                    0% { left: -30%; width: 30%; }
                    50% { left: 30%; width: 60%; }
                    100% { left: 100%; width: 30%; }
                }
                @keyframes pulse {
                    0% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.1); opacity: 0.8; }
                    100% { transform: scale(1); opacity: 1; }
                }
            </style>
        </div>
    `;
    document.body.appendChild(loadingModal);

    try {
        if (!window.Farol) {
            window.Toast.error("IA do Farol não inicializada.");
            return;
        }

        const isBuilding = lote.unidades && lote.unidades.length > 5;
        const areaContext = isBuilding
            ? `ATENÇÃO: Este é um edifício.A metragem informada(${unit.metragem}m²) pode referir - se à área total do terreno do loteamento, e não necessariamente à área privativa da unidade isolada.Considere isso na sua estimativa.`
            : `Esta é uma unidade em lote individual ou pequeno condomínio.A metragem de ${unit.metragem} m² é provavelmente a área real da unidade.`;

        // Calculate Precise Location
        let locationContext = "";
        if (lote.minx && lote.miny && window.utmToLatLon) {
            const coords = window.utmToLatLon(lote.minx, lote.miny);
            locationContext = `- Coordenadas Exatas (GPS): Lat ${coords.lat.toFixed(6)}, Lon ${coords.lng.toFixed(6)}`;
        }

        // Calculate Building Stats for Context
        let buildingStats = "";
        if (lote.unidades && lote.unidades.length > 0) {
            const areas = lote.unidades
                .map(u => parseFloat(u.metragem))
                .filter(a => !isNaN(a) && a > 0);

            if (areas.length > 0) {
                const minArea = Math.min(...areas);
                const maxArea = Math.max(...areas);
                const avgArea = (areas.reduce((a, b) => a + b, 0) / areas.length).toFixed(0);

                buildingStats = `
                [ESTATÍSTICAS DO EDIFÍCIO/LOTE]
                - Total de Unidades no dataset: ${lote.unidades.length}
                - Menor Metragem encontrada: ${minArea} m²
                - Maior Metragem encontrada: ${maxArea} m²
                - Média Geral: ${avgArea} m²
                - Metragem desta unidade (${unit.metragem || 0} m²) vs Média: ${unit.metragem ? (unit.metragem / avgArea * 100).toFixed(0) : 0}%
                (Se esta unidade for muito menor que a média, pode ser uma Garagem, Depósito ou Kitnet. Se for muito maior, pode ser Cobertura ou Junção).
                [/ESTATÍSTICAS DO EDIFÍCIO/LOTE]`;
            }
        }

        const prompt = `Como seu Farol (Assistente Sênior Imobiliário e Jurídico), realize uma AVALIAÇÃO COMPLETA da seguinte unidade:
    
    [DADOS DA UNIDADE]
    - Edifício: ${lote.building_name || 'Não informado'}
    - Endereço: ${unit.logradouro || lote.endereco || 'Logradouro não informado'}, ${unit.bairro_unidade || lote.bairro || 'Guarujá'}
    - Metragem Sistema: ${unit.metragem || 'Não informada'} m²
    - Valores Sistema: Venal R$ ${unit.valor_venal || '?'} | Pedida R$ ${unit.valor_vendavel || '?'}
    ${locationContext}
    ${buildingStats}

    [SUA MISSÃO - SIGA ESTES 3 PASSOS OBRIGATÓRIOS]:
    
    PASSO 1: PROVAS E REFERÊNCIAS REAIS (Crucial: Cite Fontes)
    - Pesquise no Google por "Venda ${lote.building_name} Guarujá" ou o endereço.
    - CITE LINKS REAIS de anúncios no VivaReal, Zap, etc.
    
    [IMAGENS - Atenção!]
    - NÃO TENTE GERA IMAGENS DO STREET VIEW DIRETO NO CODIGO (Isso quebra).
    - Se encontrar uma foto boa na web (jpg/png), use o comando:
      ![Imagem do Prédio](URL_DA_IMAGEM)
    - Se não achar foto direta, forneça apenas o LINK para o Google Maps/Street View:
      [Ver no Google Street View](https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((lote.building_name || '') + ' ' + (lote.endereco || '') + ' Guarujá')})

    VALIDAÇÃO DE DADOS (CRÍTICO):
      Se o banco diz ${unit.metragem}m² mas a web só mostra aptos de 120m², ASSUMA QUE O BANCO ESTÁ ERRADO.
      NÃO invente que é uma "Kitnet".
      Se o padrão do prédio for 120m², diga: "🚨 ALERTA DE DADOS: Metragem incorreta."

    PASSO 2: COLHEITA DE INFOS (Enriqueça o CRM)
    - Se encontrar a ficha técnica do prédio, procure por: Quartos, Suítes, Vagas e Banheiros.
    - Se encontrar Lazer (Piscina, Academia).
    - PARA CADA DADO NOVO ENCONTRADO, GERAR UM BOTÃO DE ATUALIZAÇÃO:
      Ex: "Encontrei que o padrão é 3 Quartos." -> [UPDATE_DATA:Quartos=3]
      Ex: "Prédio tem Piscina." -> [UPDATE_DATA:Piscina=Sim]
      Ex: "Padrão é 2 Vagas." -> [UPDATE_DATA:Vagas=2]
      Ex: "Metragem é 120." -> [UPDATE_DATA:Metragem=120]

    PASSO 3: CÁLCULO DE VALOR (Matemática de Mercado)
    - Calcule o valor para a metragem CORRETA (120m²) se for o caso.
    - Defina: **Preço de Mercado Justo** (valor_real) e **Preço de Oportunidade/Liquidez** (valor_vendavel).
    
    [OBRIGATÓRIO] GERE OS BOTÕES PARA SALVAR OS VALORES CALCULADOS:
    -> [UPDATE_DATA:Valor_de_Mercado=XXXX] (Onde XXXX é seu "Preço de Mercado Justo" (apenas números))
    -> [UPDATE_DATA:Valor_de_Venda=YYYY] (Onde YYYY é seu "Preço de Oportunidade/Liquidez" (apenas números))
    
    IMPORTANTE: Gere o relatório COMPLETO e ofereça os botões de atualização para TUDO que achar.`;

        const result = await window.Farol.ask(prompt, 'smart');

        if (window.AIHistoryHandler) {
            window.AIHistoryHandler.save(unit.inscricao, 'VALUATION (IA)', result);
        }

        const resultModal = document.createElement('div');
        resultModal.className = 'custom-modal-overlay active';
        resultModal.style.zIndex = '10001';
        resultModal.innerHTML = `
        <div class="custom-modal" style="max-width: 800px; width: 90%; max-height: 90vh; display: flex; flex-direction: column;">
                <div class="custom-modal-header" style="background: linear-gradient(135deg, #0284c7, #0369a1); color: white; flex-shrink: 0;">
                    <div class="custom-modal-title">💎 Avaliação de Mercado & Imagem</div>
                    <button class="custom-modal-close" onclick="this.closest('.custom-modal-overlay').remove()">&times;</button>
                </div>
                <div class="custom-modal-body" style="font-size: 14px; line-height: 1.6; color: #334155; padding: 30px; overflow-y: auto; flex-grow: 1;">
                    <div class="ai-message-content">
                        ${window.parseMarkdown(result)}
                    </div>
                </div>
                <div style="margin-top: 0; padding: 20px; border-top: 1px solid #eee; text-align: center; background: #fff; border-radius: 0 0 12px 12px; flex-shrink: 0;">
                    <button class="btn-primary-rich" onclick="this.closest('.custom-modal-overlay').remove()">Entendido</button>
                </div>
            </div>
        `;
        document.body.appendChild(resultModal);

    } catch (e) {
        console.error("Erro avaliação Farol:", e);
        window.Toast.error("Farol teve um problema na análise.");
    } finally {
        const loading = document.getElementById('farol-loading-modal');
        if (loading) loading.remove();

        if (btn) {
            btn.disabled = false;
            btn.innerText = originalText;
            btn.style.opacity = '1';
        }
    }
};

window.showContractOptions = function (inscricao) {
    const el = document.getElementById(`contract - options - ${inscricao} `);
    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
};

// ==========================================
// CONTRACT & LEGAL GENERATION
// ==========================================

window.generateContract = async function (inscricao, type) {
    const unit = window.currentLoteForUnit.unidades.find(u => u.inscricao === inscricao);
    const lote = window.currentLoteForUnit;
    if (!unit) return;

    window.Loading.show(`🏛️ Consultor Jurídico Ativo...`, `Redigindo minutas e consultando bases de dados...`);

    try {
        let specializedPrompt = "";

        if (type === 'Checklist Documentação') {
            specializedPrompt = `
            ACAO_NECESSARIA: Gere um CHECKLIST DE DILIGÊNCIA completo.
            OBJETIVO: Orientar o corretor sobre quais documentos exatos solicitar para este perfil de imóvel.
            DETALHES: Considere que é um imóvel de ${unit.quartos || '?'} quartos em ${lote.bairro || 'Guarujá'}.
            SAIDA: Lista com checkboxes [ ] para copiar e colar no WhatsApp.`;
        } else if (type === 'Aditivo Contratual') {
            specializedPrompt = `
            ACAO_NECESSARIA: Redija um ADITIVO CONTRATUAL padrão.
            OBJETIVO: Alterar cláusulas de prazo ou pagamento.
            ESTRUTURA: 
            1. Qualificação das Partes (Use dados do proprietário: ${unit.nome_proprietario || '[NOME_PROPRIETARIO]'})
            2. Cláusula de Objeto (O imóvel inscrição ${inscricao})
            3. Espaços para as novas condições.`;
        } else {
            specializedPrompt = `
            ACAO_NECESSARIA: Redija uma MINUTA DE CONTRATO DE ${type.toUpperCase()}.
            AUTORIDADE: Aja como um Advogado Sênior Especialista em Direito Imobiliário.
            
            DADOS PARA FUSAO (MERGE):
            - VENDEDOR: ${unit.nome_proprietario || '[INSERIR NOME DO VENDEDOR]'} (CPF: ${unit.cpf_cnpj || '[INSERIR CPF]'})
            - COMPRADOR: [DADOS DO COMPRADOR]
            - OBJETO: Unidade ${unit.complemento || unit.inscricao.slice(-3)} do Edifício ${lote.building_name || 'Tal'}, situado em ${unit.logradouro || lote.endereco || 'Guarujá/SP'}.
            - VALOR: R$ ${unit.valor_venal || '[VALOR DA VENDA]'} (Confirmar valor de fechamento)
            
            DIRETRIZES DE FORMATAÇÃO (IMPORTANTE):
            1.  Retorne o texto formatado em **HTML PURO** (sem markdown ticks ``html).
            2.  Use < h3 > centralizado para Títulos.
            3.  Use < p style = "text-align: justify; margin-bottom: 12px; line-height: 1.6;" > para cláusulas.
            4.  Use < b > para destacar nomes, valores e prazos.
            5.  Use < ul style = "margin-left: 20px;" > para listas.
            6.  NÃO use < html > ou < body >, apenas o conteúdo interno.
            `;
        }

        const prompt = `
        ${specializedPrompt}
        
        CONTEXTO DO SISTEMA(READ_ONLY):
            - O usuário é um Corretor da Omega Imóveis.
        - A data de hoje é ${new Date().toLocaleDateString('pt-BR')}.
            - A legislação aplicável é a Brasileira(Código Civil / Lei do Inquilinato).
            `;

        if (!window.Farol) {
            window.Toast.error("Módulo Jurídico Offline.");
            return;
        }

        let result = await window.Farol.ask(prompt);

        // Clean cleanup of markdown if present
        result = result.replace(/```html /, '').replace(/```/g, '');

        if (window.AIHistoryHandler) {
            window.AIHistoryHandler.save(unit.inscricao, `LEGAL: ${type}`, result);
        }

        const modalId = `contract-modal-${Date.now()}`;
        const modal = document.createElement('div');
        modal.className = 'custom-modal-overlay active';
        modal.style.zIndex = '10050';
        modal.innerHTML = `
        <div class="custom-modal" style="max-width: 800px; height: 85vh; display: flex; flex-direction: column;">
            <div class="custom-modal-header" style="background: #1e293b; color: white; padding: 15px 20px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-file-signature text-xl"></i>
                    <div>
                        <div class="custom-modal-title" style="margin:0; font-size: 16px;">${type}</div>
                        <div style="font-size: 11px; color: #94a3b8; font-weight: 400;">Gerado por Farol Jurídico IA • ${new Date().toLocaleTimeString()}</div>
                    </div>
                </div>
                <button class="custom-modal-close" onclick="this.closest('.custom-modal-overlay').remove()">&times;</button>
            </div>
            
            <div class="custom-modal-body" style="flex: 1; padding: 0; display: flex; flex-direction: column; background: #f8fafc;">
                <!-- Toolbar -->
                <div style="padding: 10px 20px; background: white; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-size: 12px; color: #64748b; display: flex; align-items: center; gap: 6px;">
                        <i class="fas fa-check-circle" style="color: #10b981;"></i> Minuta gerada. <b>Pode editar livremente.</b>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button onclick="window.saveContractDraft('${unit.inscricao}', '${type}', 'contract-text-${modalId}')" 
                            style="padding: 6px 12px; background: #e0f2fe; border: 1px solid #7dd3fc; border-radius: 6px; font-size: 11px; font-weight: 700; color: #0284c7; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                            <i class="fas fa-save"></i> Salvar Alterações
                        </button>
                        <button onclick="navigator.clipboard.writeText(document.getElementById('contract-text-${modalId}').innerText); window.Toast.success('Texto copiado!')" 
                            style="padding: 6px 12px; background: white; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 11px; font-weight: 600; color: #475569; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                            <i class="far fa-copy"></i> Copiar
                        </button>
                        <button onclick="window.printContract('contract-text-${modalId}')" 
                            style="padding: 6px 12px; background: #0f172a; border: none; border-radius: 6px; font-size: 11px; font-weight: 600; color: white; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                            <i class="fas fa-file-pdf"></i> Salvar PDF/Imprimir
                        </button>
                    </div>
                </div>

                <!-- Document Editor Look -->
                <div style="flex: 1; overflow-y: auto; padding: 40px; display: flex; justify-content: center; background: #cbd5e1;">
                    <div id="contract-text-${modalId}" contenteditable="true" 
                        style="width: 21cm; min-height: 29.7cm; background: white; padding: 2.5cm; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); outline: none; font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; color: #000; margin-bottom: 40px;">
                        ${result}
                    </div>
                </div>
            </div>
        </div>
        `;
        document.body.appendChild(modal);
        window.Toast.success("Minuta gerada com sucesso! Você pode editar.");

    } catch (e) {
        console.error("Erro contrato Farol:", e);
        window.Toast.error("Farol teve um problema ao redigir o contrato.");
    } finally {
        window.Loading.hide();
    }
};

window.saveContractDraft = function (inscricao, type, elementId) {
    const content = document.getElementById(elementId).innerText; // Save raw text for now, or innerHTML if we want style
    // Actually, preserving innerHTML is better for paragraphs, but innerText is safer for pure text reuse.
    // Let's stick to innerText for the history summary but maybe we want formatting?
    // User wants "editavel", so probably text is fine for a raw draft.
    // However, if they added bolding manually (browser contenteditable supports generic rich text usually with shortcuts), we might lose it.
    // Let's save the innerHTML but wrapped in a way that remains readable? 
    // No, standard AI output is text. Let's just save the text content to ensure it acts as a "prompt result" equivalent.

    if (window.AIHistoryHandler) {
        window.AIHistoryHandler.save(inscricao, `LEGAL EDIT: ${type}`, content);
        window.Toast.success("Edições salvas no Histórico!");
    } else {
        window.Toast.error("Erro ao salvar histórico.");
    }
};

window.legalCheckup = async function (inscricao) {
    const unit = window.currentLoteForUnit.unidades.find(u => u.inscricao === inscricao);
    const lote = window.currentLoteForUnit;
    if (!unit) return;

    // IMMEDIATE MODAL: Loading State
    const checkModal = document.createElement('div');
    checkModal.className = 'custom-modal-overlay active';
    checkModal.style.zIndex = '10001';
    checkModal.innerHTML = `
        <div class="custom-modal" style="max-width: 550px;">
            <div class="custom-modal-header" style="background: #1e293b; color: white;">
                <div class="custom-modal-title">🛡️ Segurança Jurídica</div>
                <button class="custom-modal-close" onclick="this.closest('.custom-modal-overlay').remove()">&times;</button>
            </div>
            <div class="custom-modal-body" style="padding: 40px; text-align: center;" id="legal-modal-body-${inscricao}">
                 <div style="font-size: 40px; margin-bottom: 20px; animation: bounce 1s infinite;">🛡️</div>
                 <div style="font-size: 16px; font-weight: 600; color: #334155; margin-bottom: 8px;">Analisando Segurança Jurídica...</div>
                 <div style="font-size: 13px; color: #64748b;">O Farol está realizando a Due Diligence do imóvel.</div>
            </div>
        </div>
    `;
    document.body.appendChild(checkModal);

    try {
        if (!window.Farol) {
            window.Toast.error("IA do Farol não inicializada.");
            return;
        }

        // Calculate Precise Location
        let locationContext = "";
        if (lote.minx && lote.miny && window.utmToLatLon) {
            const coords = window.utmToLatLon(lote.minx, lote.miny);
            locationContext = `- Coordenadas Precisas: Lat ${coords.lat.toFixed(6)}, Lon ${coords.lng.toFixed(6)}`;
        }

        const prompt = `Como seu Farol(Advogado Jurídico Imobiliário Sênior), realize um "Checkup de Segurança Jurídica"(Due Diligence rápidos) para:
            - Imóvel: ${lote.building_name || 'Unidade Individual'} - Unidade ${unit.complemento || unit.inscricao.slice(-3)}
            - Proprietário Atual: ${unit.nome_proprietario || 'Não Identificado'}
            - Referência Fiscal: ${unit.inscricao}
            ${locationContext}
        
        Sua análise deve:
            1. Avaliar o "Semáforo de Risco"(Verde, Amarelo ou Vermelho) baseado na clareza dos dados e região.
        2. Listar os 3 principais documentos que devem ser exigidos imediatamente.
        3. Alertar sobre possíveis pendências comuns no Guarujá para este tipo de imóvel.
        
        REGRAS DE ATUALIZAÇAO DE DADOS (CRÍTICO):
        - Se identificar dados incorretos, use a tag [UPDATE_DATA:Campo=NovoValor].
        - PARA CAMPOS NUMÉRICOS (Metragem, Valor, etc): SOMENTE sugira update se tiver certeza de um NÚMERO VÁLIDO.
        - JAMAIS sugira "Verificar" ou texto para campos de Metragem ou Valor. Se não souber o número exato, NÃO SUGIRA NADA.
        
        INSTRUÇÃO VISUAL:
        - Se encontrar (na sua base ou busca) imagens públicas do edifício, fachada ou mapa oficial, inclua-as no relatório usando markdown: ![Legenda](URL).

        Seja rigoroso e técnico.`;

        const result = await window.Farol.ask(prompt);

        if (window.AIHistoryHandler) {
            window.AIHistoryHandler.save(unit.inscricao, 'LEGAL CHECKUP', result);
        }

        // UPDATE MODAL CONTENT
        const bodyContainer = document.getElementById(`legal-modal-body-${inscricao}`);
        if (bodyContainer) {
            bodyContainer.style.padding = '30px';
            bodyContainer.style.textAlign = 'left';
            bodyContainer.innerHTML = `
                <div style="background: #fff; border-radius: 8px; padding: 0; border: 1px solid #e2e8f0; overflow: hidden; display: flex; flex-direction: column;">
                    <div style="background: #f1f5f9; padding: 10px 20px; border-bottom: 1px solid #e2e8f0; font-size: 12px; font-weight: 700; color: #64748b;">Parecer Jurídico</div>
                    <div style="padding: 20px; max-height: 60vh; overflow-y: auto; color: #334155; line-height: 1.6; font-size: 14px;">
                        ${window.parseMarkdown(result)}
                    </div>
                </div>
                <div style="text-align: center; padding-top: 15px; margin-top: 15px; border-top: 1px solid #eee;">
                    <button class="btn-primary-rich" onclick="this.closest('.custom-modal-overlay').remove()">Fechar Parecer</button>
                </div>
            `;
        }

    } catch (e) {
        console.error("Erro Checkup Farol:", e);
        window.Toast.error("Erro ao realizar checkup jurídico.");
        document.getElementById(`legal-modal-body-${inscricao}`).innerHTML = `
            <div style="color: #ef4444; padding: 20px;">
                <i class="fas fa-exclamation-triangle" style="font-size: 30px; margin-bottom: 10px;"></i><br>
                Erro ao conectar com o Farol.
            </div>
        `;
    }
};

window.showMarketingOptions = function (inscricao) {
    const el = document.getElementById(`marketing - options - ${inscricao} `);
    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
};

window.generateMarketing = async function (inscricao, channel) {
    const unit = window.currentLoteForUnit.unidades.find(u => u.inscricao === inscricao);
    const lote = window.currentLoteForUnit;
    if (!unit) return;

    // IMMEDIATE MODAL: Loading
    const marketingModal = document.createElement('div');
    marketingModal.className = 'custom-modal-overlay active';
    marketingModal.style.zIndex = '10001';
    marketingModal.innerHTML = `
        <div class="custom-modal" style="max-width: 500px;">
            <div class="custom-modal-header" style="background: #db2777; color: white;">
                <div class="custom-modal-title">📢 Criando: ${channel}</div>
                <button class="custom-modal-close" onclick="this.closest('.custom-modal-overlay').remove()">&times;</button>
            </div>
            <div class="custom-modal-body" style="padding: 40px; text-align: center;" id="marketing-modal-body-${inscricao}">
                 <div style="font-size: 40px; margin-bottom: 20px; animation: bounce 1s infinite;">✨</div>
                 <div style="font-size: 16px; font-weight: 600; color: #334155; margin-bottom: 8px;">Criando Conteúdo Viral...</div>
                 <div style="font-size: 13px; color: #64748b;">O Farol está escrevendo o melhor texto para ${channel}.</div>
            </div>
        </div>
    `;
    document.body.appendChild(marketingModal);

    try {
        let taskPrompt = "";
        if (channel === 'Instagram') taskPrompt = "Crie uma legenda vendedora para o Instagram, com emojis, hashtags e foco no desejo de morar no Guarujá.";
        else if (channel === 'WhatsApp') taskPrompt = "Crie uma mensagem curta e persuasiva para enviar via WhatsApp para um cliente potencial.";
        else if (channel === 'Anúncio Portais') taskPrompt = "Crie uma descrição detalhada e técnica para portais imobiliários (Zap/VivaReal).";
        else if (channel === 'Script Captação') taskPrompt = "Crie um roteiro de abordagem (Cold Call) para convencer o proprietário a dar o imóvel para venda na Omega Imóveis.";
        else if (channel === 'Exclusividade') taskPrompt = "Crie uma lista de 5 argumentos IRREFUTÁVEIS e PODEROSOS para convencer o proprietário a dar EXCLUSIVIDADE de venda para a Omega Imóveis para este imóvel específico.";

        const prompt = `Como seu Farol(Assistente de Marketing e Vendas da Omega Imóveis), execute a seguinte tarefa:
        ${taskPrompt}
        
        DADOS DO IMÓVEL:
            - Edifício: ${lote.building_name || 'Lote Único'}
            - Bairro: ${unit.bairro_unidade || lote.bairro || 'Guarujá'}
            - Rua: ${unit.logradouro || lote.endereco || 'Não informada'}
            - Metragem: ${unit.metragem || 'Não informada'} m²
            - Valor Estimado: R$ ${unit.valor || 'Sob Consulta'}
        
        INSTRUÇÃO VISUAL (IMPORTANTE):
        - Enriqueça o conteúdo sugerindo ou incorporando imagens conceituais ou reais do local/edifício se houver acesso.
        - Use markdown para imagens: ![Descrição](URL_DA_IMAGEM).

        Seja criativo, profissional e focado em alta conversão.`;

        const result = await window.Farol.ask(prompt);

        if (window.AIHistoryHandler) {
            window.AIHistoryHandler.save(unit.inscricao, `MARKETING: ${channel}`, result);
        }

        // UPDATE MODAL
        const body = document.getElementById(`marketing-modal-body-${inscricao}`);
        if (body) {
            body.style.padding = '25px';
            body.style.textAlign = 'left';
            body.innerHTML = `
                <div style="background: #fff; border-radius: 8px; border: 1px solid #fecdd3; overflow: hidden;">
                     <div style="background: #fff1f2; padding: 10px 20px; border-bottom: 1px solid #fecdd3; font-size: 12px; font-weight: 700; color: #be185d;">Sugestão de Copy</div>
                     <div style="padding: 20px; max-height: 60vh; overflow-y: auto; font-size: 14px; line-height: 1.6; color: #334155;">
                        ${window.parseMarkdown(result)}
                     </div>
                </div>
                <div class="modal-actions" style="padding-top: 20px; margin-top: 15px; border-top: 1px solid #eee; display: flex; gap: 10px; justify-content: center;">
                    <button class="btn-ghost" onclick="this.closest('.custom-modal-overlay').remove()">Fechar</button>
                    <button class="btn-primary-rich" style="background: #db2777;" onclick="window.copyToClipboard('${result.replace(/'/g, "\\'")}')">📋 Copiar Conteúdo</button>
                </div>
            `;
        }

    } catch (e) {
        console.error("Erro Marketing IA:", e);
        window.Toast.error("Farol teve um problema ao criar o anúncio.");
        const body = document.getElementById(`marketing-modal-body-${inscricao}`);
        if (body) body.innerHTML = `<div style="color:red">Erro: ${e.message}</div>`;
    }
};

window.showMatriculaAnalyzer = function (inscricao) {
    const modal = document.createElement('div');
    modal.className = 'custom-modal-overlay active';
    modal.style.zIndex = '10001';
    modal.innerHTML = `
        <div class="custom-modal" style="max-width: 600px;">
            <div class="custom-modal-header" style="background: #1e293b; color: white;">
                <div class="custom-modal-title">📄 Analisador de Matrícula (Farol IA)</div>
                <button class="custom-modal-close" onclick="this.closest('.custom-modal-overlay').remove()">&times;</button>
            </div>
            <div class="custom-modal-body" style="padding: 25px;">
                <p style="font-size: 13px; color: #64748b; margin-bottom: 15px;">Cole o texto (OCR ou transcrição) da matrícula do imóvel aqui. O Farol identificará gravames, usufrutos, penhoras e riscos jurídicos.</p>
                <textarea id="matricula-text-input" style="width: 100%; height: 200px; padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px; font-family: monospace; font-size: 12px; resize: none;" placeholder="Cole o texto da matrícula aqui..."></textarea>
                <div style="margin-top: 20px; text-align: center;">
                    <button class="btn-primary-rich" onclick="window.analyzeMatriculaText('${inscricao}')">🚀 Iniciar Análise de Risco</button>
                </div>
            </div>
        </div >
                `;
    document.body.appendChild(modal);
};

window.analyzeMatriculaText = async function (inscricao) {
    const text = document.getElementById('matricula-text-input').value;
    if (!text || text.length < 50) {
        window.Toast.warning("Por favor, forneça um texto de matrícula válido.");
        return;
    }

    const unit = window.currentLoteForUnit.unidades.find(u => u.inscricao === inscricao);
    const lote = window.currentLoteForUnit;

    window.Loading.show("Farol lendo matrícula...", "Identificando gravames e ônus...");

    try {
        const prompt = `Como seu Farol(Advogado Jurídico Imobiliário Sênior), realize uma análise técnica detalhada do seguinte texto de MATRÍCULA IMOBILIÁRIA:
        
        TEXTO DA MATRÍCULA:
            ---
                ${text}
            ---

                CONTEXTO DO IMÓVEL NO GUARUGEO:
            - Insc.Fiscal: ${inscricao}
            - Edifício: ${lote.building_name || 'Não informado'}
        
        Sua tarefa:
            1. Identifique o Proprietário Atual mencionado no texto.
        2. Identifique Gravames, Ônus, Penhoras ou Usufrutos ativos.
        3. Identifique possíveis riscos para uma transação de Compra e Venda.
        4. Dê um parecer conclusivo: Viável, Risco Moderado ou Risco Alto.
        
        Use um tom técnico, direto e focado na segurança do corretor da Omega Imóveis.`;

        const result = await window.Farol.ask(prompt);

        // Substituir o conteúdo do modal pela resposta
        const body = document.querySelector('.custom-modal-body');
        body.innerHTML = `
            <div style="background: #f1f5f9; border-left: 5px solid #0f172a; padding: 20px; font-size: 14px; line-height: 1.6; color: #334155;">
                <div style="font-weight: 800; color: #0284c7; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-shield-alt"></i> Parecer Jurídico do Farol
                    </div>
                ${window.parseMarkdown(result)}
            </div >
                <div style="margin-top: 20px; text-align: center;">
                    <button class="btn-primary-rich" onclick="this.closest('.custom-modal-overlay').remove()">Entendido, Fechar</button>
                </div>
            `;

    } catch (e) {
        console.error(e);
        window.Toast.error("Erro na análise da matrícula.");
    } finally {
        window.Loading.hide();
    }
};

window.estimateFees = async function (inscricao) {
    const unit = window.currentLoteForUnit.unidades.find(u => u.inscricao === inscricao);
    const lote = window.currentLoteForUnit;
    if (!unit) return;

    // IMMEDIATE MODAL
    const feeModal = document.createElement('div');
    feeModal.className = 'custom-modal-overlay active';
    feeModal.style.zIndex = '10001';
    feeModal.innerHTML = `
        <div class="custom-modal" style="max-width: 500px;">
            <div class="custom-modal-header" style="background: #854d0e; color: white;">
                <div class="custom-modal-title">💰 Estimativa de Custos</div>
                <button class="custom-modal-close" onclick="this.closest('.custom-modal-overlay').remove()">&times;</button>
            </div>
            <div class="custom-modal-body" style="padding: 40px; text-align: center;" id="fees-modal-body-${inscricao}">
                 <div style="font-size: 40px; margin-bottom: 20px; animation: bounce 1s infinite;">💸</div>
                 <div style="font-size: 16px; font-weight: 600; color: #334155; margin-bottom: 8px;">Calculando Impostos e Taxas...</div>
                 <div style="font-size: 13px; color: #64748b;">Consultando tabela de ITBI e Cartórios do Guarujá.</div>
            </div>
        </div>
    `;
    document.body.appendChild(feeModal);


    try {
        const prompt = `Como seu Farol(Consultor Financeiro Imobiliário da Omega Imóveis), forneça uma estimativa de custos de fechamento para este imóvel no Guarujá:
            - Valor Referência: R$ ${unit.valor || unit.valor_venal || '1.000.000 (Simulação)'}
            - Bairro: ${unit.bairro_unidade || lote.bairro || 'Guarujá'}
            - Rua: ${unit.logradouro || lote.endereco || 'Não informada'}
        
        Sua estimativa deve incluir:
            1. ITBI Estimado(Considere a alíquota atual do Guarujá).
            2. Escritura e Registro(Valores aproximados de cartório).
        3. LAUDÊMIO(Identifique se o bairro é área de marinha e explique o custo extra se houver).
        4. Custo Total de Fechamento estimado.
        
        Mantenha um tom consultivo e técnico.`;

        const result = await window.Farol.ask(prompt);

        // UPDATE MODAL
        const body = document.getElementById(`fees-modal-body-${inscricao}`);
        if (body) {
            body.style.padding = '25px';
            body.style.textAlign = 'left';
            body.innerHTML = `
                <div style="background: #fff; border-radius: 8px; border: 1px solid #ca8a04; overflow: hidden;">
                    <div style="background: #fefce8; padding: 10px 20px; border-bottom: 1px solid #ca8a04; font-size: 12px; font-weight: 700; color: #854d0e;">Custos & Impostos</div>
                    <div style="padding: 20px; max-height: 60vh; overflow-y: auto; font-size: 14px; line-height: 1.6; color: #334155;">
                        ${window.parseMarkdown(result)}
                    </div>
                </div>
                <div style="text-align: center; padding-top: 20px; margin-top: 15px; border-top: 1px solid #eee;">
                    <button class="btn-primary-rich" style="background: #854d0e;" onclick="this.closest('.custom-modal-overlay').remove()">Entendido</button>
                </div>
            `;
        }

    } catch (e) {
        console.error(e);
        window.Toast.error("Erro ao estimar custos.");
        document.getElementById(`fees-modal-body-${inscricao}`).innerHTML = `<div style="color:red">Erro: ${e.message}</div>`;
    }
};

window.switchTooltipTab = function (btn, tabId) {
    const parent = btn.closest('.tooltip-tabs');
    const tabs = parent.querySelectorAll('.tooltip-tab');
    const container = parent.parentElement;

    // Cores baseadas no contexto (Unidade vs Proprietário)
    const isOwner = container.classList.contains('proprietario-tooltip');
    const activeColor = isOwner ? '#764ba2' : '#0284c7';

    tabs.forEach(t => {
        t.classList.remove('active');
        t.style.color = '#64748b';
        t.style.borderBottom = 'none';
    });

    btn.classList.add('active');
    btn.style.color = activeColor;
    btn.style.borderBottom = `3px solid ${activeColor} `;

    const panes = container.querySelectorAll('.tab-content-pane');
    panes.forEach(p => p.style.display = 'none');

    const target = container.querySelector(`#${tabId} `);
    if (target) target.style.display = 'block';
};

window.copyToClipboard = function (text) {
    navigator.clipboard.writeText(text).then(() => {
        window.Toast.success("Copiado para a área de transferência!");
    });
};

console.log("✅ Tooltip Handler module loaded");

window.editUnitFromTooltip = function (inscricao) {
    const unit = window.currentLoteForUnit.unidades.find(u => u.inscricao === inscricao);
    if (!unit) return;

    const editModal = document.createElement('div');
    editModal.className = 'custom-modal-overlay active';
    editModal.style.zIndex = '10002';
    editModal.innerHTML = `
        <div class="custom-modal" style="max-width: 500px;">
            <div class="custom-modal-header" style="background: #334155; color: white;">
                <div class="custom-modal-title">✏️ Editar Unidade</div>
                <button class="custom-modal-close" onclick="this.closest('.custom-modal-overlay').remove()">&times;</button>
            </div>
            <div class="custom-modal-body" style="padding: 20px;">
                <div style="font-size: 13px; color: #64748b; margin-bottom: 5px;">Área Privativa (m²)</div>
                <input type="number" step="0.01" id="edit-metragem" class="editor-input" value="${unit.metragem || ''}" placeholder="Ex: 50.00" style="width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 15px;">
                
                <div style="font-size: 13px; color: #64748b; margin-bottom: 5px;">Valor Venal (Fiscal) R$</div>
                <input type="number" step="0.01" id="edit-valor-venal" class="editor-input" value="${unit.valor_venal || ''}" placeholder="Valor da Prefeitura" style="width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 15px;">

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div>
                        <div style="font-size: 13px; color: #64748b; margin-bottom: 5px;">Valor de Mercado R$</div>
                        <input type="number" step="0.01" id="edit-valor-real" class="editor-input" value="${unit.valor_real || ''}" placeholder="Avaliação" style="width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 15px;">
                    </div>
                    <div>
                        <div style="font-size: 13px; color: #64748b; margin-bottom: 5px;">Valor de Venda (Pedida) R$</div>
                        <input type="number" step="0.01" id="edit-valor-vendavel" class="editor-input" value="${unit.valor_vendavel || ''}" placeholder="Ex: 500000" style="width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 15px;">
                    </div>
                </div>

                <div style="font-size: 13px; color: #64748b; margin-bottom: 5px;">Proprietário</div>
                <input type="text" id="edit-nome-proprietario" class="editor-input" value="${unit.nome_proprietario || ''}" placeholder="Nome do Dono" style="width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 15px;">
                
                <div style="font-size: 13px; color: #64748b; margin-bottom: 5px;">Status</div>
                <select id="edit-status" class="editor-input" style="width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 6px;">
                    <option value="Disponível" ${unit.status_venda === 'Disponível' ? 'selected' : ''}>Disponível</option>
                    <option value="Vendido" ${unit.status_venda === 'Vendido' ? 'selected' : ''}>Vendido</option>
                    <option value="Reservado" ${unit.status_venda === 'Reservado' ? 'selected' : ''}>Reservado</option>
                    <option value="Captar" ${unit.status_venda === 'Captar' ? 'selected' : ''}>Captar</option>
                </select>

                <div style="margin-top: 20px; display: flex; justify-content: flex-end; gap: 10px;">
                    <button class="btn-ghost" onclick="this.closest('.custom-modal-overlay').remove()">Cancelar</button>
                    <button class="btn-primary-rich" onclick="window.confirmUnitEdit('${inscricao}')">Salvar Alterações</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(editModal);
};

window.confirmUnitEdit = async function (inscricao) {
    const metragem = document.getElementById('edit-metragem').value;
    const nome = document.getElementById('edit-nome-proprietario').value;
    const status = document.getElementById('edit-status').value;
    const valorVenal = document.getElementById('edit-valor-venal').value;
    const valorReal = document.getElementById('edit-valor-real').value;
    const valorVendavel = document.getElementById('edit-valor-vendavel').value;

    window.Loading.show("Salvando...", "Atualizando dados da unidade...");

    try {
        const updateData = {
            metragem: metragem ? parseFloat(metragem) : null,
            nome_proprietario: nome,
            status_venda: status,
            valor_venal: valorVenal ? parseFloat(valorVenal) : null,
            valor_real: valorReal ? parseFloat(valorReal) : null,
            valor_vendavel: valorVendavel ? parseFloat(valorVendavel) : null
        };

        const { error } = await window.supabaseApp
            .from('unidades')
            .update(updateData)
            .eq('inscricao', inscricao);

        if (error) throw error;

        // Update local memory
        const unit = window.currentLoteForUnit.unidades.find(u => u.inscricao === inscricao);
        if (unit) {
            Object.assign(unit, updateData);
        }

        window.Toast.success("Unidade atualizada com sucesso!");
        document.querySelector('.custom-modal-overlay[style*="z-index: 10002"]').remove();

        if (window.currentTooltip) {
            window.showUnitTooltip(unit, window.currentLoteForUnit, 0, 0);
        }

    } catch (e) {
        console.error(e);
        window.Toast.error("Erro ao salvar: " + e.message);
    } finally {
        window.Loading.hide();
    }
};

window.editUnitFromTooltip = function (inscricao) {
    const unit = window.currentLoteForUnit.unidades.find(u => u.inscricao === inscricao);
    if (!unit) return;

    const editModal = document.createElement('div');
    editModal.className = 'custom-modal-overlay active';
    editModal.style.zIndex = '10002';
    editModal.innerHTML = `
        <div class="custom-modal" style="max-width: 500px;">
            <div class="custom-modal-header" style="background: #334155; color: white;">
                <div class="custom-modal-title">✏️ Editar Unidade</div>
                <button class="custom-modal-close" onclick="this.closest('.custom-modal-overlay').remove()">&times;</button>
            </div>
            <div class="custom-modal-body" style="padding: 20px;">
                <div style="font-size: 13px; color: #64748b; margin-bottom: 5px;">Área Privativa (m²)</div>
                <input type="number" step="0.01" id="edit-metragem" class="editor-input" value="${unit.metragem || ''}" placeholder="Ex: 50.00" style="width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 15px;">
                
                <div style="font-size: 13px; color: #64748b; margin-bottom: 5px;">Valor Venal (Fiscal) R$</div>
                <input type="number" step="0.01" id="edit-valor-venal" class="editor-input" value="${unit.valor_venal || ''}" placeholder="Valor da Prefeitura" style="width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 15px;">

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div>
                        <div style="font-size: 13px; color: #64748b; margin-bottom: 5px;">Valor de Mercado R$</div>
                        <input type="number" step="0.01" id="edit-valor-real" class="editor-input" value="${unit.valor_real || ''}" placeholder="Avaliação" style="width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 15px;">
                    </div>
                    <div>
                        <div style="font-size: 13px; color: #64748b; margin-bottom: 5px;">Valor de Venda (Pedida) R$</div>
                        <input type="number" step="0.01" id="edit-valor-vendavel" class="editor-input" value="${unit.valor_vendavel || ''}" placeholder="Ex: 500000" style="width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 15px;">
                    </div>
                </div>

                <div style="font-size: 13px; color: #64748b; margin-bottom: 5px;">Proprietário</div>
                <input type="text" id="edit-nome-proprietario" class="editor-input" value="${unit.nome_proprietario || ''}" placeholder="Nome do Dono" style="width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 15px;">
                
                <div style="font-size: 13px; color: #64748b; margin-bottom: 5px;">Status</div>
                <select id="edit-status" class="editor-input" style="width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 6px;">
                    <option value="Disponível" ${unit.status_venda === 'Disponível' ? 'selected' : ''}>Disponível</option>
                    <option value="Vendido" ${unit.status_venda === 'Vendido' ? 'selected' : ''}>Vendido</option>
                    <option value="Reservado" ${unit.status_venda === 'Reservado' ? 'selected' : ''}>Reservado</option>
                    <option value="Captar" ${unit.status_venda === 'Captar' ? 'selected' : ''}>Captar</option>
                </select>

                <div style="margin-top: 20px; display: flex; justify-content: flex-end; gap: 10px;">
                    <button class="btn-ghost" onclick="this.closest('.custom-modal-overlay').remove()">Cancelar</button>
                    <button class="btn-primary-rich" onclick="window.confirmUnitEdit('${inscricao}')">Salvar Alterações</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(editModal);
};

window.confirmUnitEdit = async function (inscricao) {
    const metragem = document.getElementById('edit-metragem').value;
    const nome = document.getElementById('edit-nome-proprietario').value;
    const status = document.getElementById('edit-status').value;
    const valorVenal = document.getElementById('edit-valor-venal').value;
    const valorReal = document.getElementById('edit-valor-real').value;
    const valorVendavel = document.getElementById('edit-valor-vendavel').value;

    window.Loading.show("Salvando...", "Atualizando dados da unidade...");

    try {
        const updateData = {
            metragem: metragem ? parseFloat(metragem) : null,
            nome_proprietario: nome,
            status_venda: status,
            valor_venal: valorVenal ? parseFloat(valorVenal) : null,
            valor_real: valorReal ? parseFloat(valorReal) : null,
            valor_vendavel: valorVendavel ? parseFloat(valorVendavel) : null
        };

        const { error } = await window.supabaseApp
            .from('unidades')
            .update(updateData)
            .eq('inscricao', inscricao);

        if (error) throw error;

        // Update local memory
        const unit = window.currentLoteForUnit.unidades.find(u => u.inscricao === inscricao);
        if (unit) {
            Object.assign(unit, updateData);
        }

        window.Toast.success("Unidade atualizada com sucesso!");
        document.querySelector('.custom-modal-overlay[style*="z-index: 10002"]').remove();

        if (window.currentTooltip) {
            window.showUnitTooltip(unit, window.currentLoteForUnit, 0, 0);
        }

    } catch (e) {
        console.error(e);
        window.Toast.error("Erro ao salvar: " + e.message);
    } finally {
        window.Loading.hide();
    }
};

// ==========================================
// DOCUMENT EXPLORER LOGIC (Mac/PC Style)
// ==========================================
window.currentExplorerFolder = 'root';
window.currentExplorerUnit = null;

window.refreshFileExplorer = async function (inscricao, folder = 'root') {
    window.currentExplorerUnit = inscricao;
    window.currentExplorerFolder = folder;

    const container = document.getElementById('file-explorer-content');
    if (!container) return; // Tab not active

    container.innerHTML = '<div style="grid-column: 1 / -1; text-align:center; color:#64748b; padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Carregando arquivos...</div>';

    try {
        // Fetch Files
        const { data, error } = await window.supabaseApp
            .from('unit_files')
            .select('*')
            .eq('unit_inscricao', inscricao);

        if (error) throw error;

        // Simple client-side filter for now
        const currentFiles = data ? data.filter(f => f.folder === folder) : [];

        // Breadcrumbs
        const breadcrumb = folder === 'root' ? '🏠 Início' : `🏠 Início > 📂 ${folder}`;
        const breadcrumbEl = document.getElementById('explorer-breadcrumbs');
        if (breadcrumbEl) breadcrumbEl.innerHTML = breadcrumb;

        // RENDER UI
        let html = '';

        // Back Button (Virtual Folder)
        if (folder !== 'root') {
            html += `
                <div class="file-card" onclick="window.refreshFileExplorer('${inscricao}', 'root')" 
                     style="background: #eff6ff; border: 1px dashed #bfdbfe; border-radius: 8px; padding: 10px; display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer;">
                    <i class="fas fa-reply" style="font-size: 24px; color: #2563eb;"></i>
                    <div style="font-size: 11px; font-weight: 600; text-align: center;">.. Voltar</div>
                </div>
             `;
        }

        if (currentFiles.length === 0 && folder === 'root') {
            html += `
                <div style="grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px; color: #94a3b8; border: 2px dashed #e2e8f0; border-radius: 12px; margin-top: 10px;">
                    <i class="fas fa-cloud-upload-alt" style="font-size: 32px; margin-bottom: 10px;"></i>
                    <div style="font-size: 14px; font-weight: 500;">Pasta Vazia</div>
                    <div style="font-size: 12px;">Use os botões acima para adicionar conteúdo.</div>
                </div>
             `;
        } else {
            // Sort: Folders first, then files
            currentFiles.sort((a, b) => {
                if (a.type === 'folder' && b.type !== 'folder') return -1;
                if (a.type !== 'folder' && b.type === 'folder') return 1;
                return a.name.localeCompare(b.name);
            });

            currentFiles.forEach(file => {
                let icon = 'fa-file';
                let color = '#64748b';
                let label = file.name;

                // CUSTOM ICONS LOGIC
                if (file.type === 'folder') {
                    if (file.name.includes('Instagram')) { icon = 'fa-instagram'; color = '#E1306C'; }
                    else if (file.name.includes('WhatsApp')) { icon = 'fa-whatsapp'; color = '#25D366'; }
                    else if (file.name.includes('Relató')) { icon = 'fa-chart-line'; color = '#3b82f6'; }
                    else { icon = 'fa-folder'; color = '#fbbf24'; }
                }
                else {
                    // File Types
                    if (file.name.includes('Instagram')) { icon = 'fa-instagram'; color = '#E1306C'; }
                    else if (file.name.includes('WhatsApp')) { icon = 'fa-whatsapp'; color = '#25D366'; }
                    else if (file.type.includes('pdf')) { icon = 'fa-file-pdf'; color = '#ef4444'; }
                    else if (file.type.includes('image')) { icon = 'fa-file-image'; color = '#10b981'; }
                    else if (file.type.includes('word') || file.type.includes('doc')) { icon = 'fa-file-word'; color = '#3b82f6'; }
                    else if (file.type.includes('html')) { icon = 'fa-file-code'; color = '#f97316'; }
                }

                html += `
                    <div class="file-card" 
                         onclick="${file.type === 'folder' ? `window.refreshFileExplorer('${inscricao}', '${file.name}')` : `window.previewFile('${file.path}', '${file.name}', '${file.type}')`}" 
                         oncontextmenu="window.handleFileCtx(event, '${file.id}', '${file.path}')"
                         title="${file.name}"
                         style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer; transition: all 0.2s; position: relative;">
                        
                        <i class="fab ${icon.startsWith('fa-') && !'instagram whatsapp'.includes(icon.replace('fa-', '')) ? 'fas ' + icon : icon} ${!icon.startsWith('fa-') ? 'fas ' + icon : ''}" style="font-size: 24px; color: ${color};" class="${icon.includes('instagram') || icon.includes('whatsapp') ? 'fab ' + icon : 'fas ' + icon}"></i>
                        <i class="${icon.includes('instagram') || icon.includes('whatsapp') ? 'fab' : 'fas'} ${icon}" style="font-size: 24px; color: ${color};"></i>
                        <div style="font-size: 11px; font-weight: 600; text-align: center; word-break: break-all; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; width: 100%;">
                            ${file.name}
                        </div>
                    </div>
                `;
            });
        }

        container.innerHTML = html;

    } catch (e) {
        console.error(e);
        container.innerHTML = '<div style="color:red; text-align:center;">Erro ao carregar arquivos.</div>';
    }
};

window.previewFile = async function (path, name, type) {
    window.Loading.show("Carregando...", "Abrindo visualizador...");
    try {
        const { data, error } = await window.supabaseApp.storage.from('unit_documents').download(path);
        if (error) throw error;

        const url = URL.createObjectURL(data);
        const modalId = 'file-preview-modal';
        let contentHTML = '';

        if (type.includes('image')) {
            contentHTML = `<img src="${url}" style="max-width: 100%; max-height: 70vh; border-radius: 8px;">`;
        } else if (name.endsWith('.txt') || name.endsWith('.md') || type.includes('text')) {
            const text = await data.text();
            contentHTML = `
                <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; text-align: left; font-family: sans-serif; white-space: pre-wrap; max-height: 70vh; overflow-y: auto;">
                    ${window.parseMarkdown ? window.parseMarkdown(text) : text}
                </div>`;
        } else {
            // Fallback for PDF/others: Show button to open/download
            contentHTML = `
                <div style="padding: 40px; text-align: center;">
                    <i class="fas fa-file-download" style="font-size: 48px; color: #64748b; margin-bottom: 20px;"></i>
                    <p>Este arquivo deve ser baixado ou aberto externamente.</p>
                    <a href="${url}" target="_blank" class="btn-primary-rich" style="display: inline-block; margin-top: 10px; text-decoration: none;">Abrir / Baixar</a>
                </div>`;
        }

        const modal = document.createElement('div');
        modal.className = 'custom-modal-overlay active';
        modal.style.zIndex = '10200';
        modal.innerHTML = `
            <div class="custom-modal" style="max-width: 800px; width: 90%;">
                <div class="custom-modal-header" style="background: #0f172a; color: white; display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-eye"></i> <span style="font-size: 14px; font-weight: 600;">${name}</span>
                    </div>
                    <button class="custom-modal-close" style="color: white;" onclick="this.closest('.custom-modal-overlay').remove()">&times;</button>
                </div>
                <div class="custom-modal-body" style="padding: 0; background: #fff; display: flex; justify-content: center; align-items: center; min-height: 200px; padding: 20px;">
                    ${contentHTML}
                </div>
                <div style="padding: 15px; border-top: 1px solid #eee; text-align: right; background: #f8fafc;">
                     <button class="btn secondary" onclick="this.closest('.custom-modal-overlay').remove()">Fechar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

    } catch (e) {
        console.error(e);
        window.Toast.error("Erro ao abrir arquivo.");
    } finally {
        window.Loading.hide();
    }
};

window.openFile = function (path) {
    // Keep legacy or redirect to preview
    window.previewFile(path, 'Arquivo', 'unknown');
};

window.handleFileCtx = function (e, id, path) {
    // Context Menu Placeholder
    e.preventDefault();
};

// End refreshFileExplorer - DO NOT DELETE uploadFile below

window.uploadFile = async function (input) {

    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const unit = window.currentExplorerUnit;
    const folder = window.currentExplorerFolder;

    if (!unit) return;

    window.Loading.show("Vruum...", "Enviando arquivo para a nuvem...");

    try {
        const filePath = `${unit}/${folder}/${Date.now()}_${file.name}`;

        // 1. Upload Storage
        const { data, error: uploadError } = await window.supabaseApp.storage
            .from('unit_documents')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        // 2. Insert DB Record
        const { error: dbError } = await window.supabaseApp
            .from('unit_files')
            .insert({
                unit_inscricao: unit,
                name: file.name,
                path: filePath,
                folder: folder,
                type: file.type,
                size: file.size
            });

        if (dbError) throw dbError;

        window.Toast.success("Arquivo enviado com sucesso!");
        window.refreshFileExplorer(unit, folder);

    } catch (e) {
        console.error(e);
        window.Toast.error("Erro no upload: " + e.message);
    } finally {
        window.Loading.hide();
        input.value = ''; // Reset
    }
};

window.createFolder = async function () {
    const name = prompt("Nome da nova pasta:");
    if (!name) return;

    // Logical folder creation (just a file record with type 'folder')
    try {
        await window.supabaseApp.from('unit_files').insert({
            unit_inscricao: window.currentExplorerUnit,
            name: name,
            path: 'virtual',
            folder: window.currentExplorerFolder,
            type: 'folder'
        });
        window.refreshFileExplorer(window.currentExplorerUnit, window.currentExplorerFolder);
    } catch (e) {
        console.error(e);
    }
};

window.openFile = function (path) {
    if (path === 'virtual') return; // Folder
    const { data } = window.supabaseApp.storage.from('unit_documents').getPublicUrl(path);
    if (data && data.publicUrl) {
        window.open(data.publicUrl, '_blank');
    }
};

window.deleteFile = async function (id, path) {
    if (!confirm("Excluir este arquivo permanentemente?")) return;

    window.Loading.show("Apagando...");
    try {
        if (path !== 'virtual') {
            await window.supabaseApp.storage.from('unit_documents').remove([path]);
        }
        await window.supabaseApp.from('unit_files').delete().eq('id', id);

        window.refreshFileExplorer(window.currentExplorerUnit, window.currentExplorerFolder);
        window.Toast.success("Arquivo removido.");
    } catch (e) {
        window.Toast.error("Erro ao excluir.");
        console.error(e);
    } finally {
        window.Loading.hide();
    }
};

// ==========================================
// FILE ACTIONS (Rename, Delete, Context Menu)
// ==========================================
window.handleFileCtx = function (e, id, path) {
    e.preventDefault();
    e.stopPropagation();

    // Create custom context menu for files
    const existingMenu = document.querySelector('.file-context-menu');
    if (existingMenu) existingMenu.remove();

    const menu = document.createElement('div');
    menu.className = 'file-context-menu';
    menu.style.cssText = `
        position: fixed;
        top: ${e.clientY}px;
        left: ${e.clientX}px;
        background: white;
        border: 1px solid #e2e8f0;
        box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
        border-radius: 8px;
        padding: 5px 0;
        z-index: 20000;
        min-width: 150px;
        font-family: 'Inter', sans-serif;
    `;

    const itemStyle = 'padding: 8px 12px; font-size: 13px; color: #1e293b; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: background 0.1s;';

    menu.innerHTML = `
        <div class="ctx-item" onclick="window.openFile('${path}'); this.parentElement.remove();"><i class="fas fa-eye" style="color:#3b82f6;"></i> Abrir / Baixar</div>
        <div class="ctx-item" onclick="window.renameFile('${id}', '${path}'); this.parentElement.remove();"><i class="fas fa-edit" style="color:#f59e0b;"></i> Renomear</div>
        <div style="height:1px; background:#f1f5f9; margin:4px 0;"></div>
        <div class="ctx-item" style="color:#ef4444;" onclick="window.deleteFile('${id}', '${path}'); this.parentElement.remove();"><i class="fas fa-trash"></i> Excluir</div>
    `;

    // Add Hover Effect via JS since inline styles are tricky for hover
    menu.querySelectorAll('.ctx-item').forEach(item => {
        item.style.cssText = itemStyle;
        item.onmouseenter = () => item.style.background = '#f1f5f9';
        item.onmouseleave = () => item.style.background = 'transparent';
    });

    document.body.appendChild(menu);

    // Close on click outside
    const closeMenu = () => {
        menu.remove();
        document.removeEventListener('click', closeMenu);
        document.removeEventListener('contextmenu', closeMenu);
    };
    setTimeout(() => {
        document.addEventListener('click', closeMenu);
        document.addEventListener('contextmenu', closeMenu);
    }, 10);
};

window.renameFile = async function (id, oldPath) {
    const oldName = oldPath.split('/').pop();
    const newName = prompt("Novo nome do arquivo:", oldName);
    if (!newName || newName === oldName) return;

    // Construct new path
    const pathParts = oldPath.split('/');
    pathParts.pop(); // Remove old filename
    const newPath = pathParts.join('/') + '/' + newName;

    window.Loading.show("Renomeando...");
    try {
        // Supabase Storage Move
        const { error: moveError } = await window.supabaseApp.storage
            .from('unit_documents')
            .move(oldPath, newPath);

        if (moveError) throw moveError;

        // Update DB Record
        const { error: dbError } = await window.supabaseApp
            .from('unit_files')
            .update({ name: newName, path: newPath })
            .eq('id', id);

        if (dbError) throw dbError;

        window.Toast.success("Arquivo renomeado!");
        window.refreshFileExplorer(window.currentExplorerUnit, window.currentExplorerFolder);

    } catch (e) {
        console.error(e);
        window.Toast.error("Erro ao renomear: " + e.message);
    } finally {
        window.Loading.hide();
    }
};

window.saveAIReportToStorage = async function (inscricao, title, content, type = 'text', targetFolder = 'Relatórios IA') {
    // 1. Target Folder & Ensure it exists (virtual check)
    const folderName = targetFolder;

    // Create folder record if not exists logic (optional but good for UX)
    // For now we just save the file with that folder property.

    // 2. Create Blob
    let blob;
    let ext;
    let mimeType;
    if (type === 'pdf' || type === 'html') {
        blob = new Blob([content], { type: 'text/html' });
        ext = 'html';
        mimeType = 'text/html';
    } else {
        blob = new Blob([content], { type: 'text/plain' });
        ext = 'txt';
        mimeType = 'text/plain';
    }

    const filename = `${title.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.${ext}`;
    const filePath = `${inscricao}/${folderName}/${filename}`;

    try {
        // Upload
        const { error: uploadError } = await window.supabaseApp.storage
            .from('unit_documents')
            .upload(filePath, blob, { contentType: mimeType, upsert: true });

        if (uploadError) throw uploadError;

        // Check if folder exists, if not create visual folder record
        const { data: folderCheck } = await window.supabaseApp.from('unit_files')
            .select('id').eq('unit_inscricao', inscricao).eq('name', folderName).eq('type', 'folder');

        if (!folderCheck || folderCheck.length === 0) {
            console.log(`📂 Creating new folder: ${folderName}`);
            await window.supabaseApp.from('unit_files').insert({
                unit_inscricao: inscricao, name: folderName, path: 'virtual', folder: 'root', type: 'folder'
            });
        }

        // Database Record
        await window.supabaseApp.from('unit_files').insert({
            unit_inscricao: inscricao,
            name: filename,
            path: filePath,
            folder: folderName,
            type: mimeType,
            size: blob.size
        });

        window.Toast.info("📄 Salvo em: Documentos > " + folderName);

        // Refresh if currently viewing that folder
        if (window.currentExplorerUnit === inscricao) {
            if (window.currentExplorerFolder === folderName || window.currentExplorerFolder === 'root') {
                window.refreshFileExplorer(inscricao, window.currentExplorerFolder);
            }
        }

    } catch (e) {
        console.error("Failed to save auto-report:", e);
    }
};

// ========================================
// TOGGLE ANÚNCIOS SECTION
// ========================================
window.toggleAnunciosSection = function(loteId) {
   const container = document.getElementById(`anuncios-container-${loteId}`);
    const icon = document.getElementById(`anuncios-toggle-icon-${loteId}`);
    
    if (!container || !icon) return;
    
    if (container.style.display === 'none') {
        container.style.display = 'block';
        icon.style.transform = 'rotate(180deg)';
    } else {
        container.style.display = 'none';
        icon.style.transform = 'rotate(0deg)';
    }
};

// ==========================================
// NEW FEATURES: PREVIOUS OWNERS & QUICK UPDATE
// ==========================================

window.showPreviousOwners = async function(unitInscricao) {
    window.Loading.show('Buscando histórico...', 'Acessando registros anteriores');
    try {
        const { data: history, error } = await window.supabaseApp
            .from('unidades_proprietarios_historico')
            .select('*')
            .eq('unidade_inscricao', unitInscricao)
            .order('data_fim', { ascending: false });

        if (error) throw error;

        const modal = document.createElement('div');
        modal.className = 'custom-modal-overlay active';
        modal.style.zIndex = '10010';

        let historyHtml = '';
        if (history && history.length > 0) {
            historyHtml = history.map(h => `
                <div style="background: white; border-radius: 8px; border: 1px solid #e2e8f0; padding: 12px; margin-bottom: 10px; border-left: 4px solid #64748b;">
                    <div style="font-weight: 700; color: #1e293b; font-size: 14px;">${h.nome_proprietario_manual || h.nome_proprietario || 'Nome não informado'}</div>
                    <div style="font-size: 11px; color: #64748b; margin-top: 4px;">
                        <i class="fas fa-calendar-alt"></i> ${h.data_inicio ? new Date(h.data_inicio).toLocaleDateString() : '?'} até ${h.data_fim ? new Date(h.data_fim).toLocaleDateString() : 'Ainda proprietário'}
                    </div>
                    ${h.obs ? `<div style="font-size: 12px; color: #475569; margin-top: 6px; padding: 6px; background: #f8fafc; border-radius: 4px;">${h.obs}</div>` : ''}
                </div>
            `).join('');
        } else {
            historyHtml = `<div style="text-align: center; padding: 20px; color: #94a3b8; font-style: italic;">Nenhum proprietário anterior registrado.</div>`;
        }

        modal.innerHTML = `
            <div class="custom-modal" style="max-width: 500px; width: 90%;">
                <div class="custom-modal-header" style="background: #475569; color: white;">
                    <div class="custom-modal-title"><i class="fas fa-history"></i> Proprietários Anteriores</div>
                    <button class="custom-modal-close" onclick="this.closest('.custom-modal-overlay').remove()">&times;</button>
                </div>
                <div class="custom-modal-body" style="padding: 20px; background: #f1f5f9;">
                    <div style="margin-bottom: 15px; font-size: 12px; color: #64748b;">Histórico manual de transferências para a unidade <strong>${unitInscricao}</strong>.</div>
                    <div style="max-height: 400px; overflow-y: auto;">
                        ${historyHtml}
                    </div>
                </div>
                <div class="custom-modal-footer" style="padding: 12px; background: white; border-top: 1px solid #e2e8f0; text-align: right;">
                    <button onclick="window.triggerManualProprietarioHistory('${unitInscricao}')" style="background: #1e293b; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer;">
                        <i class="fas fa-plus"></i> Registrar Transferência
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

    } catch (e) {
        console.error(e);
        window.Toast.error('Erro ao buscar histórico: ' + e.message);
    } finally {
        window.Loading.hide();
    }
};

window.updateUnitField = async function(inscricao, field, value) {
    if (!field) return;

    if (!window.Monetization || !window.Monetization.checkFeatureAccess('edit_private')) {
        window.Toast.info('Acesso restrito: Edição disponível apenas para assinantes Pro/Elite.');
        return;
    }
    
    // Quick local sync
    let currentUnit = null;
    for (const lote of window.allLotes) {
        if (lote.unidades) {
            currentUnit = lote.unidades.find(u => u.inscricao === inscricao);
            if (currentUnit) {
                currentUnit[field] = value;
                break;
            }
        }
    }

    try {
        const { error } = await window.supabaseApp
            .from('unidades')
            .update({ [field]: value })
            .eq('inscricao', inscricao);

        if (error) throw error;
        window.Toast.success('Campo atualizado!');
    } catch (e) {
        console.error(e);
        window.Toast.error('Erro ao atualizar campo: ' + e.message);
    }
};

window.triggerManualProprietarioHistory = function(inscricao) {
    const nome = prompt("Nome do Proprietário Anterior:");
    if (!nome) return;
    const dataFim = prompt("Data da Transferência (AAAA-MM-DD):", new Date().toISOString().split('T')[0]);
    if (!dataFim) return;
    const detalhes = prompt("Detalhes (Opcional):");

    window.Loading.show('Registrando...', 'Salvando histórico');
    window.supabaseApp
        .from('unidades_proprietarios_historico')
        .insert({
            unidade_inscricao: inscricao,
            nome_proprietario_manual: nome,
            data_fim: dataFim,
            obs: detalhes
        })
        .then(({ error }) => {
            window.Loading.hide();
            if (error) {
                window.Toast.error('Erro ao salvar: ' + error.message);
            } else {
                window.Toast.success('Histórico registrado!');
                // Close current modal and re-open to show new entry
                const currentModal = document.querySelector('.custom-modal-overlay[style*="z-index: 10010"]');
                if (currentModal) currentModal.remove();
                window.showPreviousOwners(inscricao);
            }
        });
};
