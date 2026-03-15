window.neighborhoodsLoaded = false;
window.neighborhoodData = []; // Combined Data
window.neighborhoodMarkers = []; // Array de marcadores do Google
window.isNeighborhoodMode = false;
window.isNeighborhoodEditMode = false; // New Edit Mode

// Color Palette
const NEIGHBORHOOD_COLORS = [
    '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231',
    '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe',
    '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000',
    '#aaffc3', '#808000', '#ffd8b1', '#000075', '#808080'
];

// Helper: Get Color by Neighborhood Name (Stable Hash)
window.getNeighborhoodColor = function (name) {
    if (!name) return '#cccccc';
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % NEIGHBORHOOD_COLORS.length;
    return NEIGHBORHOOD_COLORS[index];
};

// Main Toggle Function (Called by UI Button)
window.toggleNeighborhoods = async function (buttonEl) {
    window.isNeighborhoodMode = !window.isNeighborhoodMode;
    const editBtn = document.getElementById('btnEditNeighborhoods');

    if (window.isNeighborhoodMode) {
        buttonEl.classList.add('active');
        buttonEl.innerHTML = '🏘️ Bairros';
        if (editBtn) editBtn.style.display = 'inline-block';
        window.Toast.info('Ativando visão por Bairros...');

        if (!window.neighborhoodsLoaded) {
            await window.loadNeighborhoods();
        } else {
            window.renderNeighborhoods();
        }

    } else {
        buttonEl.classList.remove('active');
        buttonEl.innerHTML = '🗺️ Zonas';
        if (editBtn) editBtn.style.display = 'none';
        window.Toast.info('Retornando visão por Zonas...');

        // Limpar marcadores
        window.neighborhoodMarkers.forEach(m => m.setMap(null));
        window.neighborhoodMarkers = [];
    }

    if (window.renderHierarchy) window.renderHierarchy();
};

window.toggleNeighborhoodEditMode = function (btn) {
    window.isNeighborhoodEditMode = !window.isNeighborhoodEditMode;

    if (window.isNeighborhoodEditMode) {
        btn.classList.add('active');
        btn.innerHTML = '💾 Salvar';
        window.Toast.warning('MODO EDIÇÃO: Arraste os rótulos ou clique com botão direito para ocultar.', 'Edição Ativada');
    } else {
        btn.classList.remove('active');
        btn.innerHTML = '✏️ Editar';
        window.Toast.success('Modo de edição finalizado.');
    }

    window.renderNeighborhoods();
};

window.loadNeighborhoods = async function () {
    try {
        window.Loading.show('Carregando Bairros...', 'Obtendo dados...');

        const { data: autoData, error: viewError } = await window.supabaseApp
            .from('vw_bairros_centroids').select('*');
        if (viewError) throw viewError;

        const { data: manualData, error: manualError } = await window.supabaseApp
            .from('bairros_ajustes').select('*');

        const adjustments = {};
        if (manualData) {
            manualData.forEach(m => {
                if (m.nome_bairro) adjustments[m.nome_bairro.trim()] = m;
            });
        }

        const mergedMap = new Map();

        autoData.forEach(b => {
            const bairroName = b.nome ? b.nome.trim() : 'Desconhecido';
            const adj = adjustments[bairroName] || {};

            let coords = window.utmToLatLon(b.utm_x, b.utm_y);
            if (adj.lat && adj.lng) {
                coords = { lat: adj.lat, lng: adj.lng };
            }

            mergedMap.set(bairroName, {
                ...b,
                nome: bairroName,
                _lat: coords.lat,
                _lng: coords.lng,
                _visible: adj.visible !== false
            });
        });

        if (manualData) {
            manualData.forEach(m => {
                const manualName = m.nome_bairro ? m.nome_bairro.trim() : null;
                if (manualName && !mergedMap.has(manualName)) {
                    mergedMap.set(manualName, {
                        nome: manualName,
                        _lat: m.lat,
                        _lng: m.lng,
                        _visible: m.visible !== false,
                        total_lotes: 0
                    });
                }
            });
        }

        window.neighborhoodData = Array.from(mergedMap.values());
        window.neighborhoodsLoaded = true;
        window.renderNeighborhoods();
        window.Loading.hide();

    } catch (e) {
        console.error("Erro loadNeighborhoods:", e);
        window.Toast.error('Erro ao carregar dados de bairros.');
        window.Loading.hide();
    }
};

window.renderNeighborhoods = function () {
    if (!window.neighborhoodData) return;

    // Limpar marcadores anteriores
    window.neighborhoodMarkers.forEach(m => m.setMap(null));
    window.neighborhoodMarkers = [];

    if (!window.isNeighborhoodMode) return;

    window.neighborhoodData.forEach(bairro => {
        if (!bairro._visible && !window.isNeighborhoodEditMode) return;

        // Container HTML para o rótulo
        const content = document.createElement('div');
        const editClass = window.isNeighborhoodEditMode ? 'editing' : '';
        content.innerHTML = `<div class="neighborhood-label-content ${editClass}" style="
            opacity: ${bairro._visible ? '' : '0.3'};
            cursor: ${window.isNeighborhoodEditMode ? 'move' : 'default'};
            pointer-events: auto;
            background: white;
            padding: 4px 10px;
            border-radius: 20px;
            font-weight: 800;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            border: 2px solid ${window.getNeighborhoodColor(bairro.nome)};
            white-space: nowrap;
            transform: translate(-50%, -50%);
        ">${bairro.nome} ${!bairro._visible ? '(Oculto)' : ''}</div>`;

        const marker = new google.maps.marker.AdvancedMarkerElement({
            map: window.map,
            position: { lat: bairro._lat, lng: bairro._lng },
            content: content,
            gmpDraggable: window.isNeighborhoodEditMode,
            title: bairro.nome
        });

        // --- EVENTOS ---
        if (window.isNeighborhoodEditMode) {
            marker.addListener('dragend', async (e) => {
                const newPos = marker.position;
                bairro._lat = newPos.lat;
                bairro._lng = newPos.lng;
                await window.saveNeighborhoodAdjustment(bairro.nome, { lat: newPos.lat, lng: newPos.lng });
            });

            content.addEventListener('contextmenu', async (e) => {
                e.preventDefault();
                const hide = confirm(`Ocultar o bairro "${bairro.nome}"?`);
                if (hide) {
                    bairro._visible = false;
                    await window.saveNeighborhoodAdjustment(bairro.nome, { visible: false });
                    window.renderNeighborhoods();
                }
            });

            if (!bairro._visible) {
                marker.addListener('gmp-click', async () => {
                    const show = confirm(`Restaurar o bairro "${bairro.nome}"?`);
                    if (show) {
                        bairro._visible = true;
                        await window.saveNeighborhoodAdjustment(bairro.nome, { visible: true });
                        window.renderNeighborhoods();
                    }
                });
            }
        }

        window.neighborhoodMarkers.push(marker);
    });

    // Registrar evento de clique no mapa para criar bairros (Modo Edição)
    if (window.isNeighborhoodEditMode && !window._googleMapContextListener) {
        window._googleMapContextListener = window.map.addListener('contextmenu', async (e) => {
            if (!window.isNeighborhoodEditMode) return;
            
            const nome = prompt("Nome do Novo Bairro (Manual):");
            if (nome) {
                const latlng = e.latLng.toJSON();
                window.Loading.show('Criando Bairro...');

                await window.saveNeighborhoodAdjustment(nome, { lat: latlng.lat, lng: latlng.lng, visible: true });

                window.neighborhoodData.push({
                    nome: nome,
                    _lat: latlng.lat,
                    _lng: latlng.lng,
                    _visible: true,
                    total_lotes: 0
                });

                window.renderNeighborhoods();
                window.Loading.hide();
                window.Toast.success(`Bairro "${nome}" criado!`);
            }
        });
    } else if (!window.isNeighborhoodEditMode && window._googleMapContextListener) {
        google.maps.event.removeListener(window._googleMapContextListener);
        window._googleMapContextListener = null;
    }
};

window.saveNeighborhoodAdjustment = async function (nome, changes) {
    if (!nome) return;
    const cleanNome = nome.trim();

    try {
        const payload = {
            nome_bairro: cleanNome,
            ...changes,
            updated_at: new Date()
        };

        const { error } = await window.supabaseApp
            .from('bairros_ajustes')
            .upsert(payload, { onConflict: 'nome_bairro' });

        if (error) throw error;
        window.Toast.success(`Ajuste de "${cleanNome}" salvo!`);
    } catch (e) {
        console.error("❌ Erro ao salvar bairro:", e);
        window.Toast.error(`Erro ao salvar: ${e.message}`);
    }
};
