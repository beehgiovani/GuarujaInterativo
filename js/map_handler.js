// ==========================================
// MAP HANDLER - MAP_HANDLER.JS
// ==========================================
// Handles map initialization, hierarchy processing, and rendering

// Variables for internal map state
let markersLayer = null;

// EXPORT state to window for cross-module access
window.cityData = {};
window.currentLevel = 0;
window.currentZone = null;
window.currentSector = null;
window.georefs = []; // Global store for POIs (Praias, Comércios, etc)
window.allLotesSet = new Set(); // Cache para checagem rápida de duplicatas

// --- FEATURE RESTORATION HELPER FUNCTIONS ---



window.initRuler = function() {
    if (!window.map) return;
    let isRulerActive = false;
    let rulerPolyline = null;
    let rulerPoints = [];
    let rulerLabels = [];
    const rulerBtn = document.createElement('div');
    rulerBtn.className = 'landscape-control ruler-btn';
    rulerBtn.title = 'Medir Distância (Régua)';
    rulerBtn.style.cssText = `
        margin: 10px; background: white; border-radius: 8px; width: 44px; height: 44px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.15); cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        border: 1px solid #e2e8f0; font-size: 18px; color: #334155;
    `;
    rulerBtn.innerHTML = '<i class="fas fa-ruler-combined"></i>';
    window.map.controls[google.maps.ControlPosition.RIGHT_TOP].push(rulerBtn);

    const clearRuler = () => {
        if (rulerPolyline) rulerPolyline.setMap(null);
        rulerPoints = [];
        rulerLabels.forEach(l => l.setMap(null));
        rulerLabels = [];
        rulerPolyline = new google.maps.Polyline({path: [], geodesic: true, strokeColor: '#ef4444', strokeWeight: 3, map: window.map});
    };

    rulerBtn.onclick = () => {
        isRulerActive = !isRulerActive;
        rulerBtn.style.backgroundColor = isRulerActive ? '#eff6ff' : 'white';
        if (isRulerActive) {
            window.map.setOptions({ draggableCursor: 'crosshair' });
            clearRuler();
            window.Toast.info("Modo de Medição Ativo.");
        } else {
            window.map.setOptions({ draggableCursor: null });
            if (rulerPolyline) rulerPolyline.setMap(null);
            rulerLabels.forEach(l => l.setMap(null));
        }
    };

    window.map.addListener('click', (e) => {
        if (!isRulerActive) return;
        const point = e.latLng;
        rulerPoints.push(point);
        rulerPolyline.setPath(rulerPoints);
        if (rulerPoints.length > 1) {
            const totalDist = google.maps.geometry.spherical.computeLength(rulerPoints);
            const label = new google.maps.InfoWindow({content: `<div style="color:#ef4444; font-weight:bold;">${totalDist.toFixed(1)}m</div>`, position: point});
            label.open(window.map);
            rulerLabels.push(label);
        }
    });
};
window.init3DToggle = function() {
    if (!window.map) return;
    
    // Check if device is mobile for performance optimization
    const isMobile = window.innerWidth <= 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    
    // Controles de Ângulo (Tilt/3D Perspective)
    const angleUp = document.createElement('div');
    angleUp.className = 'landscape-control';
    angleUp.title = 'Inclinar Mapa (Perspectiva 3D)';
    angleUp.innerHTML = '<i class="fas fa-cube"></i>';
    angleUp.style.cssText = `
        margin: 10px; background: white; border-radius: 8px; width: 44px; height: 44px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.15); cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        border: 1px solid #e2e8f0; font-size: 18px; color: #334155;
    `;
    
    const angleDown = angleUp.cloneNode(true);
    angleDown.title = 'Visão de Topo (2D)';
    angleDown.innerHTML = '<i class="fas fa-layer-group"></i>';
    
    angleUp.onclick = () => {
        // On mobile, 45 is fine, but we can set a slightly lower tilt if we wanted 
        // to save some rendering cost, though 45 is standard.
        window.map.setTilt(45);
        window.Toast.info(isMobile ? "3D Ativo" : "Perspectiva 45° Ativada.");
        angleUp.style.color = '#2563eb';
        angleDown.style.color = '#334155';
        
        if (isMobile) {
            // Close mobile sidebar if open to give more space for 3D
            window.closeMobileSidebar?.();
        }
    };

    angleDown.onclick = () => {
        window.map.setTilt(0);
        window.Toast.info("Visão de Topo (2D)");
        angleDown.style.color = '#2563eb';
        angleUp.style.color = '#334155';
    };

    // Push to RIGHT_CENTER to avoid stack conflicts with TOP/BOTTOM controls
    window.map.controls[google.maps.ControlPosition.RIGHT_CENTER].push(angleUp);
    window.map.controls[google.maps.ControlPosition.RIGHT_CENTER].push(angleDown);
};

// --- LEGENDA GEOGRÁFICA INTERATIVA (ZONAS 0-6) ---
window.initMapLegend = function() {
    if (!window.map || !window.GUARA_ZONES) return;

    const legendBtn = document.createElement('div');
    legendBtn.className = 'landscape-control legend-toggle-btn';
    legendBtn.title = 'Abrir Legenda de Zonas (0-6)';
    legendBtn.style.cssText = `
        margin: 10px; background: white; border-radius: 8px; width: 44px; height: 44px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.15); cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        border: 1px solid #e2e8f0; font-size: 18px; color: #334155;
        transition: all 0.2s;
    `;
    legendBtn.innerHTML = '<i class="fas fa-map-marked-alt"></i>';
    window.map.controls[google.maps.ControlPosition.LEFT_TOP].push(legendBtn);

    const legendPanel = document.createElement('div');
    legendPanel.className = 'zone-legend-flyout';
    legendPanel.style.cssText = `
        display: none; position: absolute; top: 120px; left: 14px;
        background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(12px);
        color: white; border-radius: 12px; padding: 20px; width: 260px;
        box-shadow: 0 20px 50px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1);
        z-index: 10000; animation: fadeIn 0.25s ease-out;
    `;
    
    let zonesHtml = '<div style="font-size: 11px; font-weight: 900; text-transform: uppercase; margin-bottom: 20px; color: #94a3b8; letter-spacing: 1.5px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 10px;">Identificação Geográfica</div>';
    Object.entries(window.GUARA_ZONES).forEach(([id, zone]) => {
        zonesHtml += `
            <div style="display: flex; gap: 12px; margin-bottom: 15px; align-items: flex-start; transition: all 0.2s;">
                <div style="width: 12px; height: 12px; border-radius: 3px; background: ${zone.color}; margin-top: 3px; flex-shrink: 0; box-shadow: 0 0 10px ${zone.color}60;"></div>
                <div>
                    <div style="font-size: 12px; font-weight: 800; color: white;">${zone.name}</div>
                    <div style="font-size: 10px; color: #94a3b8; margin-top: 4px; line-height: 1.4; font-weight: 500;">${zone.neighborhoods}</div>
                </div>
            </div>`;
    });
    
    legendPanel.innerHTML = zonesHtml;
    document.getElementById('map').appendChild(legendPanel);

    legendBtn.onclick = () => {
        const isVisible = legendPanel.style.display === 'block';
        legendPanel.style.display = isVisible ? 'none' : 'block';
        legendBtn.style.color = isVisible ? '#334155' : '#2563eb';
        legendBtn.style.backgroundColor = isVisible ? 'white' : '#eff6ff';
        if (!isVisible) window.Toast.info("Legenda de Zonas Ativa");
    };
};

window.initHeatmap = function() {
    if (!window.map) return;
    let heatmap = null;
    let isActive = false;
    
    const heatmapBtn = document.createElement('div');
    heatmapBtn.className = 'landscape-control heatmap-btn';
    heatmapBtn.title = 'Mapa de Calor (Valor m²)';
    heatmapBtn.style.cssText = `
        margin: 10px; background: white; border-radius: 8px; width: 44px; height: 44px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.15); cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        border: 1px solid #e2e8f0; font-size: 18px; color: #334155;
    `;
    heatmapBtn.innerHTML = '<i class="fas fa-fire"></i>';
    // Move to LEFT_CENTER to separate from administrative/tilt tools on the right
    window.map.controls[google.maps.ControlPosition.LEFT_CENTER].push(heatmapBtn);

    heatmapBtn.onclick = async () => {
        isActive = !isActive;
        heatmapBtn.style.backgroundColor = isActive ? '#fff7ed' : 'white';
        heatmapBtn.style.color = isActive ? '#f97316' : '#334155';
        
        if (isActive) {
            window.Toast.info("Gerando mapa de calor de mercado...");
            try {
                if (!heatmap) {
                    await google.maps.importLibrary("visualization");
                    const { data } = await window.supabaseApp.from('lotes').select('minx, miny, maxx, maxy, valor_m2').not('valor_m2', 'is', null).gt('valor_m2', 0);
                    
                    if (!data || data.length === 0) {
                        window.Toast.warning("Dados de valor insuficiente para o mapa.");
                        isActive = false;
                        heatmapBtn.style.backgroundColor = 'white';
                        heatmapBtn.style.color = '#334155';
                        return;
                    }

                    const points = data.map(l => {
                        const cx = (l.minx + l.maxx) / 2;
                        const cy = (l.miny + l.maxy) / 2;
                        const ll = window.utmToLatLon(cx, cy);
                        return {
                            location: new google.maps.LatLng(ll.lat, ll.lng),
                            weight: parseFloat(l.valor_m2) / 100 // Normalize weight
                        };
                    });

                    heatmap = new google.maps.visualization.HeatmapLayer({
                        data: points,
                        map: window.map,
                        radius: 40,
                        opacity: 0.8
                    });
                } else {
                    heatmap.setMap(window.map);
                }
            } catch (err) {
                console.error("Heatmap error:", err);
                window.Toast.error("Erro ao carregar visualização.");
            }
        } else {
            if (heatmap) heatmap.setMap(null);
        }
    };
};

// Hyper 3D Mode Desativado
window.isHyper3DActive = false;
window.enterHyper3D = () => console.warn("Hyper 3D Desativado");
window.exitHyper3D = () => console.warn("Hyper 3D Desativado");

// ========================================
// MOBILE: GPS & DRAWER LOGIC
// ========================================

// GPS Control moved to location_handler.js
window.addGpsControl = function () {
    if (!window.map) return;
    
    // Evitar duplicatas
    if (document.getElementById('custom-gps-control')) return;

    const controlDiv = document.createElement('div');
    controlDiv.id = 'custom-gps-control';
    controlDiv.style.cssText = 'background: white; padding: 8px; margin: 10px; border-radius: 4px; box-shadow: rgba(0, 0, 0, 0.3) 0px 1px 4px -1px; cursor: pointer; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; transition: background 0.2s;';
    controlDiv.title = 'Minha Localização';
    
    controlDiv.innerHTML = '<i class="fas fa-crosshairs" style="color: #666; font-size: 18px;"></i>';
    
    controlDiv.onmouseover = () => controlDiv.style.background = '#f3f4f6';
    controlDiv.onmouseout = () => controlDiv.style.background = 'white';

    controlDiv.addEventListener('click', () => {
        if (navigator.geolocation) {
            if (window.Toast) window.Toast.info("Buscando localização GPS...");
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const pos = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    };
                    window.map.setCenter(pos);
                    window.map.setZoom(18);
                    
                    if (window.gpsMarker) {
                        window.gpsMarker.setPosition(pos);
                    } else {
                        window.gpsMarker = new google.maps.Marker({
                            position: pos,
                            map: window.map,
                            title: 'Sua Localização',
                            icon: {
                                path: google.maps.SymbolPath.CIRCLE,
                                scale: 8,
                                fillColor: '#4285F4',
                                fillOpacity: 1,
                                strokeColor: 'white',
                                strokeWeight: 2
                            },
                        });
                    }
                },
                (error) => {
                    console.error("GPS Error:", error);
                    window.Toast && window.Toast.warning("Não foi possível acessar a localização. Verifique as permissões do navegador.");
                },
                { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
            );
        } else {
            window.Toast && window.Toast.error("Geolocalização não suportada pelo seu navegador.");
        }
    });

    window.map.controls[google.maps.ControlPosition.TOP_RIGHT].push(controlDiv);
};

window.initMobileSidebar = function () {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');

    if (!sidebar) return;

    // Mobile Drawer Peak/Expand logic
    let touchStartY = 0;
    sidebar.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    sidebar.addEventListener('touchend', (e) => {
        const touchEndY = e.changedTouches[0].clientY;
        const diff = touchStartY - touchEndY;

        if (window.innerWidth <= 768) {
            if (diff > 50) { // Swipe Up
                sidebar.classList.add('active');
                if (backdrop) backdrop.classList.add('active');
            } else if (diff < -50) { // Swipe Down
                sidebar.classList.remove('active');
                if (backdrop) backdrop.classList.remove('active');
            }
        }
    }, { passive: true });

    // Backdrop click to close
    if (backdrop) {
        backdrop.onclick = () => {
            sidebar.classList.remove('active');
            backdrop.classList.remove('active');
        };
    }
};
window.initMapHandlerRefs = function (refs) {
    // Shared state is accessed via window.allLotes, window.map, etc.
};

function handleRealtimeUpdate(payload) {
    console.log("Realtime update:", payload);

    if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        const newRow = payload.new;
        const updatedLote = {
            ...newRow,
            metadata: {
                inscricao: newRow.inscricao,
                zona: newRow.zona,
                setor: newRow.setor,
                lote: newRow.lote_geo,
                quadra: newRow.quadra,
                loteamento: newRow.loteamento,
                bairro: newRow.bairro,
                valor_m2: newRow.valor_m2 ? newRow.valor_m2.toString().replace('.', ',') : null
            },
            bounds_utm: {
                minx: newRow.minx, miny: newRow.miny, maxx: newRow.maxx, maxy: newRow.maxy
            },
            unidades: []
        };

        const existingIndex = window.allLotes.findIndex(l => l.inscricao === updatedLote.inscricao);
        if (existingIndex >= 0) {
            window.allLotes[existingIndex] = updatedLote;
        } else {
            window.allLotes.push(updatedLote);
        }

        // Refresh hierarchy
        processDataHierarchy();
        renderHierarchy();
        window.Toast.info(`Lote ${updatedLote.inscricao} atualizado em tempo real`);
    } else if (payload.eventType === 'DELETE') {
        const inscricao = payload.old.inscricao;
        window.allLotes = window.allLotes.filter(l => l.inscricao !== inscricao);
        processDataHierarchy();
        window.renderHierarchy();
        window.Toast.warning(`Lote ${inscricao} removido`);
    }
}

// ========================================
// MAIN INITIALIZATION
// ========================================
window.initMap = async function () {
    const totalLotesEl = document.getElementById('totalLotes');
    const mapBackBtn = document.getElementById('mapBackBtn');

    // Show loading overlay
    Loading.show('Inicializando Guarugeo...', 'Carregando inteligência imobiliária');
    Loading.setProgress(10);

    try {
        // 1. Carregar a API do Google Maps
        await window.loadGoogleMaps();
        window.Loading.setProgress(30);

        // --- NUCLEAR SAFETY DELAY ---
        // Algumas versões Beta do Google Maps (para 3D) podem reportar que estão prontas
        // mas variáveis internas (como 'Ea') ainda não inicializaram.
        await new Promise(r => setTimeout(r, 500)); 

        // 2. Inicializar o Mapa
        const mapDiv = document.getElementById('map');
        if (!mapDiv) throw new Error("Container 'map' não encontrado no DOM");

        window.PREMIUM_MAP_STYLE = [
            { "featureType": "poi", "stylers": [{ "visibility": "off" }] },
            { "featureType": "transit", "stylers": [{ "visibility": "off" }] },
            { "featureType": "road", "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
            { "featureType": "business", "stylers": [{ "visibility": "off" }] },
            { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#a2daf2" }] },
            { "featureType": "landscape", "elementType": "geometry", "stylers": [{ "color": "#fafafa" }] },
            { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#ffffff" }] },
            { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#8a8a8a" }] },
            { "featureType": "administrative", "elementType": "labels.text.fill", "stylers": [{ "color": "#444444" }] }
        ];

        const mapOptions = {
            center: { lat: -23.9934, lng: -46.2567 },
            zoom: 13,
            minZoom: 12,
            mapTypeId: 'roadmap',
            tilt: 45, // 3D perspective
            heading: 0,
            mapId: window.GoogleMapsConfig?.MAP_ID || 'DEMO_MAP_ID', // Requerido para Marcadores Avançados
            disableDefaultUI: false,
            gestureHandling: 'greedy',
            streetViewControl: true,
            mapTypeControl: true
        };

        window.map = new google.maps.Map(document.getElementById('map'), mapOptions);

        // Resolve o erro de conflito: "A Map's styles property cannot be set when a mapId is present."
        // Como o usuário quer o estilo padrão (claro) da imagem de referência, 
        // removemos o suporte a estilos locais via código quando há um Map ID.
        console.log("[MapHandler] Inicializado com Map ID:", mapOptions.mapId);

        // --- NATIVE CONTROL INTEGRATION ---
        
        // 1. Back Button (Left Top)
        if (mapBackBtn) {
            window.map.controls[google.maps.ControlPosition.TOP_LEFT].push(mapBackBtn);
        }

        // 2. GPS Button (Right Bottom)
        if (window.LocationHandler && window.LocationHandler.createControl) {
            const gpsBtn = window.LocationHandler.createControl();
            window.map.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(gpsBtn);
        }

        // 2.1 Traffic Layer Button
        const trafficLayer = new google.maps.TrafficLayer();
        let isTrafficOn = false;
        
        const trafficBtnWrapper = document.createElement('div');
        trafficBtnWrapper.style.marginRight = '10px';
        trafficBtnWrapper.style.marginBottom = '10px';
        
        const trafficBtn = document.createElement('button');
        trafficBtn.title = 'Mostrar Trânsito e Fluxo Comercial';
        trafficBtn.style.cssText = `
            background: rgba(255,255,255,0.9); border: none; border-radius: 8px; width: 40px; height: 40px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15); cursor: pointer; color: #475569;
            font-size: 16px; display: flex; align-items: center; justify-content: center;
            transition: all 0.2s; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
        `;
        trafficBtn.innerHTML = '<i class="fas fa-car-side"></i>';
        trafficBtnWrapper.appendChild(trafficBtn);

        trafficBtn.onclick = () => {
             isTrafficOn = !isTrafficOn;
             if (isTrafficOn) {
                 trafficLayer.setMap(window.map);
                 trafficBtn.style.color = '#ef4444'; // Red showing it's active
                 trafficBtn.style.background = '#fee2e2';
                 if(window.Toast) window.Toast.info("Camada de Trânsito Ativada", "Analise os fluxos nas vias.");
             } else {
                 trafficLayer.setMap(null);
                 trafficBtn.style.color = '#475569';
                 trafficBtn.style.background = 'rgba(255,255,255,0.9)';
             }
        };
        window.map.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(trafficBtnWrapper);


        // 3. GuaruBot (Left Bottom)
        if (window.Farol && window.Farol.trigger) {
            window.map.controls[google.maps.ControlPosition.LEFT_BOTTOM].push(window.Farol.trigger);
        }

        // mapBackBtn already declared at top of initMap
        if (mapBackBtn) mapBackBtn.onclick = () => window.goUpLevel();

        // 4. Initialize Layer Switcher & Ruler (Feature Restoration)

        window.initRuler();
        window.init3DToggle();
        window.initMapLegend();
        window.initHeatmap();

        // 5. Initialize Search Autocomplete (Integrated Database Search)
        if (typeof window.initSearchAutocomplete === 'function') {
            window.initSearchAutocomplete();
        }

        // --- BILLING & API ERROR DETECTION ---
        // Monitorar erros específicos do Google Maps que podem não disparar o try-catch
        const originalConsoleError = console.error;
        console.error = function() {
            const message = Array.from(arguments).join(' ');
            if (message.includes('BillingNotEnabledMapError')) {
                window.Loading.hide();
                window.Toast.error("⚠️ ERRO DE FATURAMENTO: O mapa não pode carregar porque o faturamento não está ativo no Google Cloud para este projeto.", "billing_error", 0);
            }
            if (message.includes('ApiNotActivatedMapError')) {
                window.Loading.hide();
                window.Toast.error("⚠️ API NÃO ATIVADA: A 'Maps JavaScript API' precisa ser ativada no console do Google Cloud para esta chave funcionar.", "api_activation_error", 0);
            }
            originalConsoleError.apply(console, arguments);
        };

        // --- MOBILE: SIDEBAR DRAWER LOGIC ---
        window.initMobileSidebar();

        // Map Right Click for Creating Lots
        window.map.addListener('contextmenu', (e) => {
            // Converter evento do Google para o formato que o handleContextMenu espera
            const latlng = e.latLng.toJSON();
            const syntheticEvent = {
                latlng: latlng,
                originalEvent: e.domEvent,
                containerPoint: { x: 0, y: 0 } // Simulado
            };
            window.handleContextMenu(syntheticEvent, 'map', null);
        });

        // SMART NAVIGATION CLICK LISTENER
        window.map.addListener('click', () => {
            window.hideContextMenu();

            if (window.currentTooltip) {
                if (window.currentTooltipType === 'unit' && window.currentLoteForUnit) {
                    window.showLotTooltip(window.currentLoteForUnit, 0, 0);
                } else {
                    if (window.closeParamsTooltip) window.closeParamsTooltip();
                    if (window.currentTooltip) window.currentTooltip.remove();
                    window.currentTooltip = null;
                    window.currentTooltipType = null;
                }
            }
        });

        // Feature Group Simulado para manter compatibilidade
        window.drawnItems = {
            layers: [],
            addLayer: (l) => { 
                l.setMap(window.map); 
                window.drawnItems.layers.push(l);
            },
            removeLayer: (l) => {
                l.setMap(null);
                window.drawnItems.layers = window.drawnItems.layers.filter(layer => layer !== l);
            },
            eachLayer: (cb) => window.drawnItems.layers.forEach(cb)
        };

        // Add GPS Control Discretely (TOP RIGHT)
        if (window.addGpsControl) window.addGpsControl();

        // 6. Start Data Loading Sequence
        await window.initMapData();

    } catch (err) {
        console.error("Erro ao inicializar Google Maps:", err);
        window.Toast.error("Falha ao carregar o motor de mapas (Google Maps). Verifique a API Key.");
        Loading.hide();
        return;
    }
};

    // --- SPATIAL UTILITIES ---
    window.findNearestLot = function(lat, lng) {
        if (!window.allLotes || window.allLotes.length === 0) return null;
        
        console.log(`[Spatial] Cross-referencing: ${lat}, ${lng}`);
        
        // Convert to UTM for bounding box check
        const utm = window.latLonToUtm(lat, lng);
        const center = new google.maps.LatLng(lat, lng);
        
        // 1. Precise Bound Check (UTM)
        for (const lote of window.allLotes) {
            if (lote.bounds_utm && 
                utm.x >= lote.bounds_utm.minx && utm.x <= lote.bounds_utm.maxx &&
                utm.y >= lote.bounds_utm.miny && utm.y <= lote.bounds_utm.maxy) {
                console.log(`[Spatial] Precise Match Found: ${lote.inscricao}`);
                return lote;
            }
        }

        // 2. Proximity Fallback (within 50m)
        let nearest = null;
        let minDistance = 50; 

        for (const lote of window.allLotes) {
            if (!lote._lat) continue;
            const dist = google.maps.geometry.spherical.computeDistanceBetween(
                center, 
                new google.maps.LatLng(lote._lat, lote._lng)
            );
            
            if (dist < minDistance) {
                minDistance = dist;
                nearest = lote;
            }
        }
        
        if (nearest) {
            console.log(`[Spatial] Proximity Match: ${nearest.inscricao} at ${minDistance.toFixed(1)}m`);
        } else {
            console.log(`[Spatial] No local match found.`);
        }
        return nearest;
    };
    window.initDraw = async function () {
        // Aguarda um curto período para garantir que o DOM e os Custom Elements estejam prontos
        await new Promise(resolve => setTimeout(resolve, 800));

        try {
            const { DrawingManager } = await google.maps.importLibrary("drawing");
            let drawingManagerControl = document.getElementById('main-drawing-manager');
            
            if (!drawingManagerControl) {
                console.warn("Componente <gmp-drawing-manager> não encontrado no HTML. Criando dinamicamente...");
                drawingManagerControl = document.createElement('gmp-drawing-manager');
                drawingManagerControl.id = 'main-drawing-manager';
                // Adiciona como um controle nativo para garantir que apareça sobre o mapa
                window.map.controls[google.maps.ControlPosition.RIGHT_TOP].push(drawingManagerControl);
            }

            // Ativa os modos suportados
            drawingManagerControl.drawingModes = ['polygon', 'polyline', 'circle', 'rectangle', 'marker'];  
            
            // Configurações visuais (opcional, se a biblioteca permitir via props ou CSS)
            // No momento, o controle Web Component usa estilos padrão do Google.

            // Evento de conclusão de desenho (Versão Moderna)
            drawingManagerControl.addEventListener('gmp-drawingcomplete', (event) => {
                const overlay = event.detail.overlay;
                const type = event.detail.type; // 'polygon', 'circle', etc.
                
                console.log("Desenho concluído via Modern API!", type, overlay);

                if (type === 'polygon' || type === 'rectangle' || type === 'circle' || type === 'polyline') {
                    // Adiciona comportamento de edição
                    if (type === 'polygon' || type === 'polyline') {
                        google.maps.event.addListener(overlay, 'rightclick', (mev) => {
                            if (mev.vertex != null) {
                                overlay.getPath().removeAt(mev.vertex);
                                window.showDrawingMenu(overlay, type);
                            }
                        });
                    }
                    
                    google.maps.event.addListener(overlay, 'click', () => {
                         window.showDrawingMenu(overlay, type);
                    });

                    window.showDrawingMenu(overlay, type);
                }
            });

            window.drawingManager = drawingManagerControl; 
            console.log("✅ Modern Drawing Manager Initialized");
        } catch (e) {
            console.error("Erro ao inicializar Drawing Moderno:", e);
        }
    };

    /**
     * Contextual Menu for Drawn Shapes
     */
    window.activeDrawings = window.activeDrawings || [];

    window.showDrawingMenu = function(overlay, type) {
        // Track overlay if new
        if (overlay && !window.activeDrawings.includes(overlay)) {
            window.activeDrawings.push(overlay);
        }

        // Remove existing menu if any
        const existing = document.getElementById('drawing-context-menu');
        if (existing) existing.remove();

        // Calculate Stats
        let statsHtml = '';
        if (type === 'polygon' || type === 'rectangle') {
            const area = google.maps.geometry.spherical.computeArea(overlay.getPath ? overlay.getPath() : getBoundsPath(overlay));
            statsHtml = `<b>Área:</b> ${area.toFixed(2)} m²`;
        } else if (type === 'circle') {
            const area = Math.PI * Math.pow(overlay.getRadius(), 2);
            statsHtml = `<b>Área:</b> ${area.toFixed(2)} m²`;
        } else if (type === 'polyline') {
            const length = google.maps.geometry.spherical.computeLength(overlay.getPath());
            statsHtml = `<b>Distância:</b> ${length.toFixed(2)} m<br><span style="font-size:9px; color:#94a3b8;">Botão direito num ponto para excluí-lo</span>`;
        }

        const menu = document.createElement('div');
        menu.id = 'drawing-context-menu';
        menu.style.cssText = `
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(255, 255, 255, 0.90);
            backdrop-filter: blur(15px);
            -webkit-backdrop-filter: blur(15px);
            padding: 12px 20px;
            border-radius: 16px;
            box-shadow: 0 20px 40px -10px rgba(0,0,0,0.15);
            z-index: 5000;
            display: flex;
            align-items: center;
            gap: 15px;
            border: 1px solid rgba(226, 232, 240, 0.8);
            animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            transition: all 0.2s ease;
        `;

        menu.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:8px; margin-right:5px;">
                <button onclick="document.getElementById('drawing-context-menu').remove()" style="background:transparent; border:none; cursor:pointer; color:#94a3b8; padding:0; height:auto; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'" title="Ocultar Menu">
                    <i class="fas fa-times-circle" style="font-size: 16px;"></i>
                </button>
                <button id="btnClearAllDrawings" style="background:transparent; border:none; cursor:pointer; color:#ef4444; padding:0; height:auto; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'" title="Apagar Todos">
                    <i class="fas fa-trash-alt" style="font-size: 14px;"></i>
                </button>
            </div>
            <div style="font-size: 12px; color: #475569; border-right: 1px solid rgba(226,232,240,0.8); padding-right: 15px; border-left: 1px solid rgba(226,232,240,0.8); padding-left: 15px;">
                <div style="font-weight: 800; color: #1e293b; text-transform: uppercase; font-size: 10px; margin-bottom: 2px;">Ferramenta Real Estate</div>
                ${statsHtml}
            </div>
            <button onclick="window.analyzeAreaAction(null)" id="btnAnalyze" style="background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; border: none; padding: 10px 18px; border-radius: 10px; cursor: pointer; font-size: 12px; font-weight: bold; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 10px rgba(59, 130, 246, 0.3); transition: all 0.2s;" onmouseover="this.style.transform='translateY(-2px)';" onmouseout="this.style.transform='translateY(0)';">
                <i class="fas fa-search-location"></i> ANALISAR ÁREA
            </button>
            <button onclick="window.exportAreaPDF(null)" id="btnExportPDF" style="background: linear-gradient(135deg, #8b5cf6, #7c3aed); color: white; border: none; padding: 10px 18px; border-radius: 10px; cursor: pointer; font-size: 12px; font-weight: bold; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 10px rgba(139, 92, 246, 0.3); transition: all 0.2s;" onmouseover="this.style.transform='translateY(-2px)';" onmouseout="this.style.transform='translateY(0)';">
                <i class="fas fa-file-pdf"></i> EXPORTAR
            </button>
            <button id="btnSimulate" style="background: linear-gradient(135deg, #0ea5e9, #0284c7); color: white; border: none; padding: 10px 18px; border-radius: 10px; cursor: pointer; font-size: 12px; font-weight: bold; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 10px rgba(14, 165, 233, 0.3); transition: all 0.2s;" onmouseover="this.style.transform='translateY(-2px)';" onmouseout="this.style.transform='translateY(0)';">
                <i class="fas fa-chart-line"></i> SIMULAR
            </button>
            <button id="btnDeleteDrawing" style="background: rgba(254, 226, 226, 0.8); color: #ef4444; border: none; padding: 10px 18px; border-radius: 10px; cursor: pointer; font-size: 12px; font-weight: bold; transition: all 0.2s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.background='#fecaca'" onmouseout="this.style.transform='translateY(0)'; this.style.background='rgba(254, 226, 226, 0.8)'">
                <i class="fas fa-eraser"></i> APAGAR
            </button>
        `;

        document.body.appendChild(menu);

        // Disable area-based tools for polyline
        if (type === 'polyline') {
            document.getElementById('btnAnalyze').style.display = 'none';
            document.getElementById('btnExportPDF').style.display = 'none';
            if (document.getElementById('btnSimulate')) document.getElementById('btnSimulate').style.display = 'none';
        }

        // Simulation Action
        document.getElementById('btnSimulate').onclick = () => {
            if (window.ZoningHandler) {
                window.ZoningHandler.runSimulation(overlay, type);
            }
        };

        // Analyze Action
        window.analyzeAreaAction = () => {
            window.analyzeSpatialArea(overlay, type);
            menu.remove();
        };

        // Export PDF Action
        window.exportAreaPDF = () => {
            window.exportSpatialAreaPDF(overlay, type);
            menu.remove();
        };

        // Delete Current Action
        document.getElementById('btnDeleteDrawing').onclick = () => {
            overlay.setMap(null);
            window.activeDrawings = window.activeDrawings.filter(d => d !== overlay);
            menu.remove();
        };

        // Delete All Action
        document.getElementById('btnClearAllDrawings').onclick = () => {
            window.activeDrawings.forEach(d => d.setMap(null));
            window.activeDrawings = [];
            menu.remove();
            window.Toast.info("Todos os desenhos foram removidos.");
        };
    };

    /**
     * Real Estate Spatial Analysis Logic
     */
    window.analyzeSpatialArea = function(overlay, type) {
        if (!window.allLotes) return;
        
        window.Loading.show('Analisando Prospecção...', 'Filtrando lotes dentro do perímetro');
        
        const internalResults = [];
        
        window.allLotes.forEach(lote => {
            if (!lote._lat || !lote._lng) return;
            const pt = new google.maps.LatLng(lote._lat, lote._lng);
            
            let isInside = false;
            if (type === 'polygon') {
                isInside = google.maps.geometry.poly.containsLocation(pt, overlay);
            } else if (type === 'rectangle') {
                isInside = overlay.getBounds().contains(pt);
            } else if (type === 'circle') {
                const dist = google.maps.geometry.spherical.computeDistanceBetween(pt, overlay.getCenter());
                isInside = dist <= overlay.getRadius();
            }

            if (isInside) {
                internalResults.push({
                    ...lote,
                    label: lote.building_name || lote.inscricao,
                    sub: `${lote.logradouro || ''}, ${lote.numero_logradouro || ''}`,
                    type: 'Edifício/Loteamento',
                    inscricao: lote.inscricao
                });
            }
        });

        window.Loading.hide();
        
        if (internalResults.length > 0) {
            window.displaySearchResults(internalResults);
            window.Toast.success(`${internalResults.length} lotes encontrados na área selecionada!`, 'Prospecção Concluída');
            
            // Open sidebar on mobile if needed
            if (window.innerWidth <= 768 && window.MobileSidebar) {
                window.MobileSidebar.open();
            }
        } else {
            window.Toast.warning('Nenhum lote oficial encontrado dentro desta área.');
        }
    };

    /**
     * Export Area to PDF with Lot/Unit Data
     */
    window.exportSpatialAreaPDF = async function(overlay, type) {
        if (!window.allLotes) return;
        window.Toast.info("Buscando lotes na área...");

        const insideLotes = [];
        window.allLotes.forEach(lote => {
            if (!lote._lat || !lote._lng) return;
            const pt = new google.maps.LatLng(lote._lat, lote._lng);
            
            let isInside = false;
            if (type === 'polygon') {
                isInside = google.maps.geometry.poly.containsLocation(pt, overlay);
            } else if (type === 'rectangle') {
                isInside = overlay.getBounds().contains(pt);
            } else if (type === 'circle') {
                const dist = google.maps.geometry.spherical.computeDistanceBetween(pt, overlay.getCenter());
                isInside = dist <= overlay.getRadius();
            }

            if (isInside) insideLotes.push(lote);
        });

        if (insideLotes.length === 0) {
            window.Toast.warning("Nenhum lote na área selecionada para exportar.");
            return;
        }

        window.Loading.show('Coletando Dados Completo', 'Buscando unidades filiadas no servidor...');
        
        // Extrair todas as inscrições de lotes da área para fazer um batch fetch
        const lotInscricoes = insideLotes.map(l => l.inscricao);
        
        // Buscar todas as unidades pertencentes a estes lotes no banco (até 1000 por request para grandes áreas)
        let allUnits = [];
        try {
            const { data, error } = await window.supabaseApp
                .from('unidades')
                .select('*')
                .in('lote_inscricao', lotInscricoes);
                
            if (error) throw error;
            if (data) allUnits = data;
        } catch (e) {
            console.error("Erro ao buscar unidades para o PDF:", e);
            window.Toast.warning("Algumas unidades podem estar faltando no arquivo.");
        }

        const isElite = window.Monetization && window.Monetization.isEliteOrAbove();

        const exportData = [];
        insideLotes.forEach(lote => {
            let addr = (lote.logradouro || lote.endereco || '').trim();
            addr = addr.replace(/\s+N[°º]?\s*\d+$/i, '').trim();
            let num = lote.numero ? String(lote.numero).replace(/^0+/, '') : '';
            let b = (lote.bairro || '').trim();
            let fullAddr = `${addr}${num ? ', ' + num : ''}${b ? ' - ' + b : ''}`;

            // Filtrar unidades que pertencem a este lote
            const lotUnits = allUnits.filter(u => u.lote_inscricao === lote.inscricao);

            if (lotUnits.length === 0) {
                const isUnlocked = isElite || (window.Monetization && window.Monetization.isUnlockedPerson(lote.cpf_cnpj));
                exportData.push({
                    inscricao: lote.inscricao,
                    endereco: fullAddr,
                    unidade: 'Terreno/Privativo',
                    proprietario: window.maskName(lote.nome_proprietario || 'N/D', isUnlocked),
                    doc: window.formatDocument(lote.cpf_cnpj || 'N/D', isUnlocked)
                });
            } else {
                lotUnits.forEach(u => {
                    const isUnlocked = isElite || (window.Monetization && window.Monetization.isUnlockedPerson(u.cpf_cnpj));
                    exportData.push({
                        inscricao: u.inscricao,
                        endereco: fullAddr,
                        unidade: (u.complemento && u.complemento.trim().length > 1) ? u.complemento : `Unidade ${u.inscricao.slice(-3)}`,
                        proprietario: window.maskName(u.nome_proprietario || lote.nome_proprietario || 'N/D', isUnlocked),
                        doc: window.formatDocument(u.cpf_cnpj || lote.cpf_cnpj || 'N/D', isUnlocked)
                    });
                });
            }
        });

        window.Loading.hide();

        // Generate Print HTML
        const printDiv = document.createElement('div');
        printDiv.id = 'print-area-container';
        printDiv.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: white; z-index: 999999; display: none; padding: 40px;
            font-family: 'Inter', sans-serif; color: #1e293b; overflow: auto;
        `;
        
        let tableRows = exportData.map(d => `
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px; font-size:11px;">${d.inscricao}</td>
                <td style="padding: 8px; font-size:11px;">${d.endereco}</td>
                <td style="padding: 8px; font-size:11px;">${d.unidade}</td>
                <td style="padding: 8px; font-size:11px;">${d.proprietario}</td>
                <td style="padding: 8px; font-size:11px;">${d.doc}</td>
            </tr>
        `).join('');

        printDiv.innerHTML = `
            <style>
                @media print {
                    body * { visibility: hidden; }
                    #print-area-container, #print-area-container * { visibility: visible; }
                    #print-area-container { position: absolute; left: 0; top: 0; display: block !important; padding: 0 !important; }
                    .no-print { display: none !important; }
                    @page { margin: 1cm; size: landscape; }
                }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th { text-align: left; padding: 10px 8px; background: #f1f5f9; border-bottom: 2px solid #cbd5e1; font-size: 11px; color:#475569;}
            </style>
            <div style="border-bottom: 2px solid #1e293b; padding-bottom: 10px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items:flex-end;">
                <div>
                    <h1 style="margin: 0; font-size: 24px; font-weight: 900;">RELATÓRIO DE ÁREA (ENGLOBAMENTO)</h1>
                    <p style="margin: 5px 0 0; color: #64748b; font-weight: 500;">Guarujá GeoMap • Inteligência Geo-Estratégica</p>
                </div>
                <div style="text-align:right;">
                    <div style="font-weight:700; font-size:14px; color:#3b82f6;">Total: ${exportData.length} registros</div>
                    <div style="font-size:11px; color:#64748b;">Gerado em: ${new Date().toLocaleDateString('pt-BR')} as ${new Date().toLocaleTimeString('pt-BR')}</div>
                </div>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>INSCRIÇÃO</th>
                        <th>ENDEREÇO BASE</th>
                        <th>UNIDADE/COMPLEMENTO</th>
                        <th>NOME PROPRIETÁRIO</th>
                        <th>CPF/CNPJ</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        `;

        document.body.appendChild(printDiv);
        setTimeout(() => {
            window.print();
            setTimeout(() => printDiv.remove(), 1000);
        }, 500);
    };

    function getBoundsPath(rectangle) {
        const bounds = rectangle.getBounds();
        const path = [
            bounds.getNorthEast(),
            {lat: bounds.getNorthEast().lat(), lng: bounds.getSouthWest().lng()},
            bounds.getSouthWest(),
            {lat: bounds.getSouthWest().lat(), lng: bounds.getNorthEast().lng()}
        ];
        return path;
    }

    // Draw Tools already defined inside or handled separately

    // Função para carregar Refs (Versão Simplificada para Google Maps)
    window.loadReferenciasGeo = async function () {
        console.log("Carregando Referências Geográficas (Google Maps)...");
        try {
            const { data, error } = await window.supabaseApp
                .from('referencias_geograficas')
                .select('*');

            if (error) throw error;

            if (data && data.length > 0) {
                window.georefs = data; // Persist for distance calculations
                data.forEach(ref => {
                    const geometry = ref.geometria;
                    const features = window.map.data.addGeoJson(geometry);
                    
                    features.forEach(feature => {
                        let label = ref.nome;
                        const color = ref.cor || (ref.tipo === 'MAR' ? '#4fc3f7' : '#3388ff');
                        
                        window.map.data.overrideStyle(feature, {
                            strokeColor: color,
                            strokeWeight: 4,
                            strokeOpacity: 0.7,
                            fillColor: color,
                            fillOpacity: 0.2,
                            title: label
                        });
                    });
                });
                console.log(`🗺️ ${data.length} referências carregadas.`);
            }
        } catch (e) {
            console.error("Erro carregando referências:", e);
        }
    };

    // Alias para compatibilidade com chamadas antigas
    const loadReferences = window.loadReferenciasGeo;

    if (window.Loading) {
        window.Loading.setProgress(30);
        window.Loading.setProgress(40);
    }

    let isCachedLoaded = false;
    window.currentCity = window.currentCity || 'Guarujá';

// changeCity disabled and removed per dead code cleanup

    window.initMapData = async function() {
        try {
            // --- CACHE STRATEGY: Stale-While-Revalidate ---
        // 1. Try Load from Cache
        let cached = await window.loadLotesFromCache();

        if (cached && cached.data && cached.data.length > 0) {
            console.log("Loading from Cache...", cached.data.length);
            window.allLotes = cached.data;
            window.allLotesSet = new Set(window.allLotes.map(l => l.inscricao));

            // Render Cache Immediately
            window.processDataHierarchy();
            window.renderHierarchy();
            
            const totalLotesEl = document.getElementById('totalLotes');
            if (totalLotesEl) totalLotesEl.innerText = `${window.allLotes.length.toLocaleString()} Lotes (Cache)`;

            // Setup Back Button immediately if cached
            const mapBackBtn = document.getElementById('mapBackBtn');
            if (mapBackBtn) mapBackBtn.onclick = window.goUpLevel;

            isCachedLoaded = true;
            window.Loading.hide();
            window.Toast.info('Dados locais carregados. Sincronizando...', 'Início Rápido');
            if (window.Onboarding) window.Onboarding.checkAndStart();
        }

        // 2. Stop Global Chunked Fetch (Nuclear Performance Fix)
        // But keep a SEED of 500 lotes for macro labels (Neighborhoods)
        if (!isCachedLoaded) {
            window.Loading.show('Iniciando Mapa...', 'Carregando semente de dados');
            const { data, error } = await window.supabaseApp
                .from('lotes')
                .select('*')
                .eq('municipio', window.currentCity || 'Guarujá')
                .limit(2000); // Aumentado de 500 para cobrir mais bairros no início

            if (!error && data) {
                const initialLotes = data.map(row => ({
                    ...row,
                    metadata: {
                        inscricao: row.inscricao,
                        zona: row.zona,
                        setor: row.setor,
                        lote: row.lote_geo,
                        quadra: row.quadra,
                        loteamento: row.loteamento,
                        bairro: row.bairro,
                        valor_m2: row.valor_m2 ? row.valor_m2.toString().replace('.', ',') : null
                    },
                    bounds_utm: {
                        minx: row.minx, miny: row.miny, maxx: row.maxx, maxy: row.maxy
                    }
                }));
                window.allLotes = initialLotes;
                window.allLotesSet = new Set(initialLotes.map(l => l.inscricao));
            }
        }

        // Add Listener to fetch data on Viewport change
        window.map.addListener('idle', () => {
             console.log("📍 Map Idle: Checking Viewport for data update...");
             window.loadLotesInViewport();
        });


        // Update State & Cache
        await window.saveLotesToCache(window.allLotes);

        // Setup Realtime Subscription
        window.supabaseApp.channel('public:all_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'lotes' }, payload => {
                handleRealtimeUpdate(payload);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'unidades' }, payload => {
                handleRealtimeUpdate(payload);
            })
            .subscribe();

        if (!isCachedLoaded) Loading.setProgress(90);

        processDataHierarchy();
        window.renderHierarchy();

        const totalLotesEl = document.getElementById('totalLotes');
        if (totalLotesEl) totalLotesEl.innerText = `${window.allLotes.length.toLocaleString()} Lotes`;

        if (!isCachedLoaded) Loading.setProgress(100);

        // Initialize Drawing Tools
        window.initDraw();

        // 3D Perspective Feedback
        window.map.addListener('tilt_changed', () => {
            const tilt = window.map.getTilt();
            if (tilt > 0) {
                console.log(`👁️ Visão 3D Ativada: ${tilt}°`);
            }
        });

        if (isCachedLoaded) {
            Toast.success('Dados sincronizados com o servidor!', 'Atualizado');
        } else {
            setTimeout(() => {
                Loading.hide();
                // O primeiro carregamento ocorrerá via listener 'idle' disparado logo após o init
            }, 500);
        }
    } catch (e) {
        console.error(e);
        if (isCachedLoaded) {
            Toast.warning('Falha na sincronização. Usando dados locais.', 'Offline');
        } else {
            Loading.hide();
            Toast.error(`Não foi possível carregar os dados: ${e.message}`, 'Erro Crítico');
        }
    }
};

/**
 * Viewport-Based Data Fetching (BBOX)
 * Fetches lotes within the current map view from Supabase.
 */
window.loadLotesInViewport = async function() {
    if (!window.map || !window.supabaseApp) return;
    
    const bounds = window.map.getBounds();
    if (!bounds) return;

    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    
    // Convert Lat/Lng bounds to UTM scale for numeric comparison
    const utmNE = window.latLonToUtm(ne.lat(), ne.lng());
    const utmSW = window.latLonToUtm(sw.lat(), sw.lng());
    
    const padding = 200; // Margem extra para evitar requisições constantes em pequenos movimentos

    try {
        const zoom = window.map.getZoom();
        // Só carrega lotes em nível de detalhe alto para não sobrecarregar
        if (zoom < 14) { // Reduzido de 15 para 14 para capturar dados em nível de bairro
            console.log("☁️ Zoom baixo demais para lotes. Pulando busca.");
            return;
        }

        const { data, error } = await window.supabaseApp
            .from('lotes')
            .select('*')
            .eq('municipio', window.currentCity || 'Guarujá')
            .gte('maxx', utmSW.x - padding)
            .lte('minx', utmNE.x + padding)
            .gte('maxy', utmSW.y - padding)
            .lte('miny', utmNE.y + padding)
            .limit(2000); // Aumentado de 1000 para 2000 (limite recomendado do Supabase)

        if (error) throw error;
        if (!data || data.length === 0) return;

        // Mesclar novos dados no window.allLotes sem recriar o Set toda vez (Performance)
        let newCount = 0;
        
        const processedNew = data
            .filter(row => !window.allLotesSet.has(row.inscricao))
            .map(row => {
                newCount++;
                window.allLotesSet.add(row.inscricao);
                return {
                    ...row,
                    metadata: {
                        inscricao: row.inscricao,
                        zona: row.zona,
                        setor: row.setor,
                        lote: row.lote_geo,
                        quadra: row.quadra,
                        loteamento: row.loteamento,
                        bairro: row.bairro,
                        valor_m2: row.valor_m2 ? row.valor_m2.toString().replace('.', ',') : null
                    },
                    bounds_utm: {
                        minx: row.minx, miny: row.miny, maxx: row.maxx, maxy: row.maxy
                    }
                };
            });

        if (newCount > 0) {
            window.allLotes = window.allLotes.concat(processedNew);
            console.log(`📦 Viewport: +${newCount} lotes novos.`);
            
            // Re-processa hierarquia e renderiza
            processDataHierarchy();
            window.renderHierarchy();
            
            const totalLotesEl = document.getElementById('totalLotes');
            if (totalLotesEl) totalLotesEl.innerText = `${window.allLotes.length.toLocaleString()} Lotes`;
        }

    } catch (err) {
        console.warn("[BBOX Fetch] Erro:", err);
    }
};

// ========================================
// HIERARCHY PROCESSING
// ========================================
function processDataHierarchy() {
    window.cityData = {};

    for (const lote of window.allLotes) {
        const b = lote.bounds_utm || lote.bounds;
        if (!b) continue;

        const cx = (b.minx + b.maxx) / 2;
        const cy = (b.miny + b.maxy) / 2;
        const ll = window.utmToLatLon(cx, cy);

        lote._lat = ll.lat;
        lote._lng = ll.lng;

        const meta = lote.metadata || {};
        const zona = meta.zona;

        // Filter: Ignore Undefined, Null, or "Unk" Zones
        if (!zona || zona === "Indefinida" || zona.toLowerCase() === "unk") {
            continue;
        }

        const setor = meta.setor || "Indefinido";

        if (!window.cityData[zona]) {
            window.cityData[zona] = {
                id: zona,
                sectors: {},
                count: 0,
                latSum: 0,
                lngSum: 0
            };
        }
        window.cityData[zona].count++;
        window.cityData[zona].latSum += ll.lat;
        window.cityData[zona].lngSum += ll.lng;

        if (!window.cityData[zona].sectors[setor]) {
            window.cityData[zona].sectors[setor] = {
                id: setor,
                parentId: zona,
                lotes: [],
                count: 0,
                latSum: 0,
                lngSum: 0
            };
        }
        window.cityData[zona].sectors[setor].lotes.push(lote);
        window.cityData[zona].sectors[setor].count++;
        window.cityData[zona].sectors[setor].latSum += ll.lat;
        window.cityData[zona].sectors[setor].lngSum += ll.lng;
    }

    // --- Multi-Centroid Calculation for Large Zones ---
    const GRID_SIZE = 0.008; // Cluster muito maior para evitar "mar de etiquetas" no nível 0

    for (const zoneKey in window.cityData) {
        const zone = window.cityData[zoneKey];

        // 1. Gather Sector Centroids
        const sectorCentroids = [];
        for (const sKey in zone.sectors) {
            const s = zone.sectors[sKey];
            if (s.count > 0) {
                sectorCentroids.push({
                    lat: s.latSum / s.count,
                    lng: s.lngSum / s.count,
                    weight: s.count
                });
            }
        }

        // 2. Grid-based Clustering
        const clusters = {};
        for (const p of sectorCentroids) {
            const gx = Math.floor(p.lng / GRID_SIZE);
            const gy = Math.floor(p.lat / GRID_SIZE);
            const key = `${gx}_${gy}`;

            if (!clusters[key]) clusters[key] = { wLat: 0, wLng: 0, wSum: 0 };

            clusters[key].wLat += p.lat * p.weight;
            clusters[key].wLng += p.lng * p.weight;
            clusters[key].wSum += p.weight;
        }

        // 3. Convert Clusters to Display Points
        zone.displayPoints = [];
        for (const key in clusters) {
            const c = clusters[key];
            if (c.wSum > 0) {
                zone.displayPoints.push({
                    lat: c.wLat / c.wSum,
                    lng: c.wLng / c.wSum
                });
            }
        }   

        // Fallback: If no clusters found, use global average
        if (zone.displayPoints.length === 0) {
            zone.displayPoints.push({
                lat: zone.latSum / zone.count,
                lng: zone.lngSum / zone.count
            });
        }
    }

    // Populate zone legend after processing
    if (typeof populateZoneLegend === 'function') {
        populateZoneLegend();
    }

    window.cityData = window.cityData; // Ensure on window
}

// ========================================
// RENDER HIERARCHY (Zones -> Sectors -> Lots)
// ========================================
let googleMarkers = []; // Armazenar referências para limpeza

window.goUpLevel = function() {
    if (window.currentLevel === 2) {
        window.currentLevel = 1;
        window.currentSector = null;
        window.map.setZoom(15);
    } else if (window.currentLevel === 1) {
        window.currentLevel = 0;
        window.currentZone = null;
        window.map.setZoom(13);
        window.map.setCenter({ lat: -23.9608, lng: -46.2694 });
    }
    window.renderHierarchy();
};

window.renderHierarchy = function() {
    const totalLotesEl = document.getElementById('totalLotes');
    const mapBackBtn = document.getElementById('mapBackBtn');

    // 0. Safeguard: Check if map is ready
    if (!window.map || !document.getElementById('map')) {
        console.warn("Skipping renderHierarchy: Map or container not ready.");
        return;
    }

    // Sync Breadcrumbs UI
    window.updateBreadcrumbs();

    // Toggle Back Button Visibility
    if (mapBackBtn) {
        if (window.currentLevel > 0) {
            mapBackBtn.classList.remove('hidden');
        } else {
            mapBackBtn.classList.add('hidden');
        }
    }

    // Limpar marcadores anteriores
    googleMarkers.forEach(m => {
        if (m) m.setMap(null);
    });
    googleMarkers = [];

    if (window.currentLevel === 0) {
        // --- LEVEL 0: ZONES (Multi-Centroid) ---
        if (totalLotesEl) {
            totalLotesEl.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px; justify-content: center;">
                    Visão Geral: Selecione uma Zona
                    <button onclick="window.RegionalHandler.showTopInvestors(window.currentZone || '0')" 
                        class="btn-primary-rich" style="padding: 4px 10px; font-size: 10px; background: #0f172a; border: 1px solid #334155;">
                        <i class="fas fa-chart-line"></i> Analisar Mercado Regional
                    </button>
                </div>
            `;
        }

        for (const zoneKey in window.cityData) {
            const zone = window.cityData[zoneKey];

            zone.displayPoints.forEach(pt => {
                const zoneColor = window.getZoneColor(zoneKey);
                
                // Inject premium animations if not already present
                if (!window._zoneStylesInjected) {
                    const style = document.createElement('style');
                    style.innerHTML = `
                        @keyframes zone-entry {
                            from { opacity: 0; transform: scale(0.9); }
                            to { opacity: 1; transform: scale(1); }
                        }
                        .zone-label-premium {
                            animation: zone-entry 0.3s ease-out forwards;
                            transition: all 0.2s ease-in-out !important;
                            cursor: pointer;
                        }
                        .zone-label-premium:hover {
                            transform: scale(1.15) !important;
                            z-index: 1000 !important;
                            filter: brightness(1.05);
                        }
                    `;
                    document.head.appendChild(style);
                    window._zoneStylesInjected = true;
                }

                // Config de estilo do rótulo
                const hex = zoneColor.replace('#', '');
                const r = parseInt(hex.substring(0, 2), 16);
                const g = parseInt(hex.substring(2, 4), 16);
                const b = parseInt(hex.substring(4, 6), 16);
                const brightness = (r * 299 + g * 587 + b * 114) / 1000;
                const textColor = brightness < 160 ? '#ffffff' : '#0f172a';
                const borderColor = brightness < 160 ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.2)';
                const content = document.createElement('div');
                content.className = 'zone-label-premium';
                content.innerHTML = `<div style="
                    background-color: ${zoneColor}; 
                    color: ${textColor};
                    border: 1.5px solid ${borderColor};
                    border-radius: 20px;
                    padding: 4px 12px;
                    display: table;
                    white-space: nowrap;
                    text-align: center;
                    font-weight: 800;
                    font-size: 10px;
                    box-shadow: 0 3px 8px rgba(0,0,0,0.2);
                    cursor: pointer;
                    transform: translate(-50%, -50%);
                    font-family: 'Outfit', sans-serif;
                    text-transform: uppercase;
                    letter-spacing: 0.8px;
                ">
                    ZONA ${zone.id}
                </div>`;

                try {
                    const marker = new google.maps.marker.AdvancedMarkerElement({
                        map: window.map,
                        position: { lat: pt.lat, lng: pt.lng },
                        content: content,
                        title: `ZONA ${zone.id}`
                    });

                    marker.addListener('gmp-click', () => {
                        window.currentLevel = 1;
                        window.currentZone = zoneKey;
                        window.map.setCenter({ lat: pt.lat, lng: pt.lng });
                        window.map.setZoom(15);
                        window.renderHierarchy();
                    });
                    googleMarkers.push(marker);
                } catch (markerErr) {
                    console.error("Error creating AdvancedMarker (Zone):", markerErr);
                }
            });
        }

    } else if (window.currentLevel === 1) {
        // --- LEVEL 1: SECTORS ---
        if (!window.cityData[window.currentZone]) {
            window.currentLevel = 0;
            window.currentZone = null;
            window.renderHierarchy();
            return;
        }

        if (totalLotesEl) {
            totalLotesEl.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px; justify-content: center;">
                    Zona ${window.currentZone}: Selecione um Setor
                    <button onclick="window.RegionalHandler.showTopInvestors('${window.currentZone}')" 
                        class="btn-primary-rich" style="padding: 4px 10px; font-size: 10px; background: #1e293b; border: 1px solid #475569;">
                        <i class="fas fa-crown" style="color: #f59e0b;"></i> Ranking Tubarões
                    </button>
                </div>
            `;
        }

        const zone = window.cityData[window.currentZone];
        for (const sectorKey in zone.sectors) {
            const sector = zone.sectors[sectorKey];
            const centerLat = sector.latSum / sector.count;
            const centerLng = sector.lngSum / sector.count;

            const zoneColor = window.getZoneColor(window.currentZone);
            
            // Determinar contraste para o Setor
            const hex = zoneColor.replace('#', '');
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            const brightness = (r * 299 + g * 587 + b * 114) / 1000;
            const textColor = brightness < 160 ? '#ffffff' : '#0f172a';
            const borderColor = brightness < 160 ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.2)';

            const content = document.createElement('div');
            content.className = 'zone-label-premium';
            content.innerHTML = `<div style="
                background-color:${zoneColor};
                color: ${textColor};
                border: 1.5px solid ${borderColor};
                border-radius: 20px;
                padding: 3px 10px;
                display: table;
                white-space: nowrap;
                text-align: center;
                font-weight: 800;
                font-size: 10px;
                box-shadow: 0 3px 8px rgba(0, 0, 0, 0.15);
                cursor: pointer;
                transform: translate(-50%, -50%);
                font-family: 'Outfit', sans-serif;
                letter-spacing: 0.5px;
            ">
                ${sector.id}
            </div>`;

            try {
                const marker = new google.maps.marker.AdvancedMarkerElement({
                    map: window.map,
                    position: { lat: centerLat, lng: centerLng },
                    content: content,
                    title: `Setor ${sector.id}`
                });

                marker.addListener('gmp-click', () => {
                    window.currentLevel = 2;
                    window.currentSector = sectorKey;
                    window.map.setCenter({ lat: centerLat, lng: centerLng });
                    window.map.setZoom(17);
                    window.renderHierarchy();
                });
                googleMarkers.push(marker);
            } catch (markerErr) {
                console.error("Error creating AdvancedMarker (Sector):", markerErr);
            }
        }
    } else if (window.currentLevel === 2) {
        // --- LEVEL 2: LOTES ---
        if (!window.cityData[window.currentZone] || !window.cityData[window.currentZone].sectors[window.currentSector]) {
            Toast.warning('Setor vazio. Retornando...');
            window.currentLevel = 1;
            window.currentSector = null;
            window.renderHierarchy();
            return;
        }

        const sector = window.cityData[window.currentZone].sectors[window.currentSector];
        if (totalLotesEl) totalLotesEl.innerText = `Zona ${window.currentZone} > Setor ${window.currentSector}: ${sector.count} Lotes`;

        for (const lote of sector.lotes) {
            const meta = lote.metadata || {};
            const hasUnits = lote.unidades && lote.unidades.length > 0;
            let hasSublots = false;

            if (hasUnits) {
                const sortedUnits = [...lote.unidades].sort((a, b) => {
                    const endA = a.inscricao.slice(-3);
                    const endB = b.inscricao.slice(-3);
                    if (endA === '000') return -1;
                    if (endB === '000') return 1;
                    return a.inscricao.localeCompare(b.inscricao);
                });
                hasSublots = sortedUnits.some(u => u.inscricao.slice(-3) !== '000');
            }

            let color;
            if (window.isNeighborhoodMode) {
                const bairro = meta.bairro || 'Desconhecido';
                color = window.getNeighborhoodColor(bairro);
            } else {
                color = window.getZoneColor(meta.zona);
            }

            if (hasSublots) color = '#9C27B0';
            if (lote.inscricao && window.editedLotes && window.editedLotes[lote.inscricao]) color = '#ff9800';

            // OFF MARKET FILTER OVERRIDE (Visual Mock para Apresentação de Vendas)
            if (window.currentOffMarketFilter && window.currentOffMarketFilter !== 'todos') {
                const num = parseInt(lote.inscricao.replace(/\D/g, '').substring(0, 6) || '0');
                const hash = num % 100;
                const isDivida = hash < 15;
                const isAnulado = hash >= 15 && hash < 20;
                const isAtivo = hash >= 20;
                
                if (window.currentOffMarketFilter === 'divida') {
                    if (isDivida) color = '#ef4444';
                    else continue;
                } 
                else if (window.currentOffMarketFilter === 'anulado') {
                    if (isAnulado) color = '#f59e0b';
                    else continue;
                } 
                else if (window.currentOffMarketFilter === 'ativo') {
                    if (isAtivo) color = '#10b981';
                    else continue;
                }
            }

            let displayLabel = lote.building_name || meta.lote || '?';
            
            // FAROL PREDITIVO: Adicionar Fogo de Oportunidade
            const leadScore = window.PredictiveHandler.calculateScore(lote);
            if (leadScore.score >= 80) {
                displayLabel = `🔥 ${displayLabel}`;
            }

            // Determinar contraste para o Lote
            const hexLote = color.replace('#', '');
            const rL = parseInt(hexLote.substring(0, 2), 16) || 0;
            const gL = parseInt(hexLote.substring(2, 4), 16) || 0;
            const bL = parseInt(hexLote.substring(4, 6), 16) || 0;
            const brightnessL = (rL * 299 + gL * 587 + bL * 114) / 1000;
            const textColorL = brightnessL < 160 ? '#ffffff' : '#0f172a';
            const borderColorL = brightnessL < 160 ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.15)';

            const content = document.createElement('div');
            content.className = 'zone-label-premium';
            content.innerHTML = `<div style="
                background-color: ${color}; 
                color: ${textColorL}; 
                border-radius: 20px; 
                padding: 3px 10px; 
                font-size: 10px; 
                font-weight: 700;
                box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2); 
                cursor: pointer; 
                border: 1.5px solid ${borderColorL}; 
                transform: translate(-50%, -50%);
                display: -webkit-box; 
                -webkit-line-clamp: 2; 
                -webkit-box-orient: vertical; 
                overflow: hidden; 
                text-overflow: ellipsis;
                max-width: 120px; 
                white-space: normal; 
                line-height: 1.2; 
                text-align: center;
                font-family: 'Outfit', sans-serif;
            ">${displayLabel}</div>`;

            const marker = new google.maps.marker.AdvancedMarkerElement({
                map: window.map,
                position: { lat: lote._lat, lng: lote._lng },
                content: content,
                title: displayLabel
            });

            marker.addListener('gmp-click', async () => {
                const fullLote = await window.fetchLotDetails(lote.inscricao);
                if (fullLote) {
                    // Decouple rendering from touchend event to avoid performance violations (1s+ lag)
                    setTimeout(() => window.showLotTooltip(fullLote, 0, 0), 10);
                }
            });

            content.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const syntheticEvent = {
                    latlng: { lat: lote._lat, lng: lote._lng },
                    originalEvent: e,
                    containerPoint: { x: e.pageX, y: e.pageY }
                };
                window.handleContextMenu(syntheticEvent, 'lote', lote);
            });

            googleMarkers.push(marker);
        }
    }

    // ========================================
    // PERSISTENT PRIORITY LAYER (Unlocked/Edited)
    // ========================================
    // Renderiza lotes liberados/editados mesmo que não estejam no setor/zona atual
    if (window.Monetization && window.Monetization.unlockedLots) {
        const priorityLotIds = window.Monetization.unlockedLots;
        
        for (const lotId of priorityLotIds) {
            // Se o nível atual for 2 e o lote já estiver no setor renderizado, evitamos duplicata
            const isAtLotLevel = window.currentLevel === 2;
            const alreadyRendered = isAtLotLevel && window.cityData[window.currentZone]?.sectors[window.currentSector]?.lotes.some(l => l.inscricao === lotId);
            
            if (alreadyRendered) continue;

            const lote = window.allLotes.find(l => l.inscricao === lotId);
            if (!lote || !lote._lat) continue;

            const displayLabel = lote.building_name || lote.metadata?.lote || '⭐';
            const color = "#10b981"; // Emerald para liberados

            const content = document.createElement('div');
            content.innerHTML = `<div style="
                background-color:${color};
                color: white;
                border-radius: 50px;
                padding: 4px 8px;
                font-size: 9px;
                font-weight: 800;
                box-shadow: 0 4px 10px rgba(16, 185, 129, 0.4);
                cursor: pointer;
                border: 2px solid white;
                transform: translate(-50%, -50%);
                display: flex; align-items: center; gap: 4px;
                max-width: 120px; white-space: nowrap;
                overflow: hidden; text-overflow: ellipsis;
            ">
                <i class="fas fa-star" style="font-size: 8px;"></i>
                ${displayLabel}
            </div>`;

            try {
                const marker = new google.maps.marker.AdvancedMarkerElement({
                    map: window.map,
                    position: { lat: lote._lat, lng: lote._lng },
                    content: content,
                    title: `SEU IMÓVEL: ${displayLabel}`,
                    zIndex: 2000 // Sempre no topo
                });

                marker.addListener('gmp-click', async () => {
                    const fullLote = await window.fetchLotDetails(lote.inscricao);
                    if (fullLote) {
                        setTimeout(() => window.showLotTooltip(fullLote, 0, 0), 10);
                    }
                });

                googleMarkers.push(marker);
            } catch (e) { console.error("Error drawing persistent marker:", e); }
        }
    }

    updateBackBtn();
}

// ========================================
// NAVIGATION
// ========================================
function updateBackBtn() {
    const mapBackBtn = document.getElementById('mapBackBtn');
    if (!mapBackBtn) {
        // console.warn("Botão voltar não encontrado no DOM");
        return;
    }

    console.log(`Update Back Btn: Level ${window.currentLevel}`);

    if (window.currentLevel === 0) {
        mapBackBtn.style.display = 'none';
        mapBackBtn.classList.add('hidden');
    } else {
        mapBackBtn.classList.remove('hidden');
        mapBackBtn.style.display = 'block'; // Forçar display block

        // Estilo flutuante para garantir visibilidade
        mapBackBtn.style.position = 'absolute';
        mapBackBtn.style.top = '10px';
        mapBackBtn.style.left = '60px'; // Ao lado do controle de zoom
        mapBackBtn.style.zIndex = '1000';
        mapBackBtn.style.padding = '8px 12px';
        mapBackBtn.style.background = 'white';
        mapBackBtn.style.border = '2px solid rgba(0,0,0,0.2)';
        mapBackBtn.style.borderRadius = '4px';
        mapBackBtn.style.cursor = 'pointer';
        mapBackBtn.style.fontWeight = 'bold';
        mapBackBtn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';

        // Dynamic Text
        if (window.currentLevel === 2) {
            mapBackBtn.innerText = "⬅ Voltar para Setor";
        } else if (window.currentLevel === 1) {
            mapBackBtn.innerText = "⬅ Voltar para Visão Geral";
        }
    }
}

function goUpLevel() {
    if (window.currentLevel === 2) {
        window.currentLevel = 1;
        window.currentSector = null;
        const zone = window.cityData[window.currentZone];
        const centerLat = zone.latSum / zone.count;
        const centerLng = zone.lngSum / zone.count;
        window.map.setCenter({ lat: centerLat, lng: centerLng });
        window.map.setZoom(15);
    } else if (window.currentLevel === 1) {
        window.currentLevel = 0;
        window.currentZone = null;
        window.map.setCenter({ lat: -23.9934, lng: -46.2567 });
        window.map.setZoom(13);
    }
    // Update Breadcrumbs
    window.updateBreadcrumbs();
}

/**
 * window.updateBreadcrumbs
 * Updates the hierarchy navigation bar based on current level
 */
window.updateBreadcrumbs = function() {
    const container = document.getElementById('mapBreadcrumbs');
    if (!container) return;

    if (window.currentLevel === 0) {
        container.classList.add('hidden');
        return;
    }

    container.classList.remove('hidden');
    
    let html = `
        <div class="breadcrumb-item" onclick="window.navigateToLevel(0)">
            <i class="fas fa-city"></i> Guarujá
        </div>
    `;

    if (window.currentLevel >= 1 && window.currentZone !== null) {
        html += `<div class="breadcrumb-separator"><i class="fas fa-chevron-right"></i></div>`;
        html += `
            <div class="breadcrumb-item ${window.currentLevel === 1 ? 'active' : ''}" 
                 onclick="${window.currentLevel > 1 ? `window.navigateToLevel(1, '${window.currentZone}')` : ''}">
                <i class="fas fa-layer-group"></i> Zona ${window.currentZone}
            </div>
        `;
    }

    if (window.currentLevel >= 2 && window.currentSector !== null) {
        html += `<div class="breadcrumb-separator"><i class="fas fa-chevron-right"></i></div>`;
        html += `
            <div class="breadcrumb-item active">
                <i class="fas fa-vector-square"></i> Setor ${window.currentSector}
            </div>
        `;
    }

    container.innerHTML = html;
};

/**
 * window.navigateToLevel
 * Handles jumping back to a specific level with appropriate zoom
 */
window.navigateToLevel = function(level, zoneId = null) {
    if (level === 0) {
        window.currentLevel = 0;
        window.currentZone = null;
        window.currentSector = null;
        window.map.setZoom(13);
        // Center city approximately
        window.map.setCenter({ lat: -23.9608, lng: -46.2694 });
    } else if (level === 1) {
        window.currentLevel = 1;
        window.currentZone = zoneId;
        window.currentSector = null;
        window.map.setZoom(15);
    }
    
    window.renderHierarchy();
};

// ========================================
// EXPORTS
// ========================================
window.processDataHierarchy = processDataHierarchy;
window.renderHierarchy = renderHierarchy;
window.goUpLevel = goUpLevel;
window.updateBackBtn = updateBackBtn;

// ========================================
// REALTIME UPDATES
// ========================================
window.handleRealtimeUpdate = function (payload) {
    console.log("Realtime Event:", payload);
    const { eventType, table, new: newRow, old: oldRow } = payload;

    if (table === 'lotes') {
        if (eventType === 'INSERT') {
            const transformed = {
                ...newRow,
                metadata: {
                    inscricao: newRow.inscricao,
                    zona: newRow.zona,
                    setor: newRow.setor,
                    lote: newRow.lote_geo,
                    quadra: newRow.quadra,
                    loteamento: newRow.loteamento,
                    bairro: newRow.bairro,
                    valor_m2: newRow.valor_m2 ? newRow.valor_m2.toString().replace('.', ',') : null
                },
                bounds_utm: { minx: newRow.minx, miny: newRow.miny, maxx: newRow.maxx, maxy: newRow.maxy },
                unidades: []
            };
            window.allLotes.push(transformed);
            processDataHierarchy();
            window.renderHierarchy();
            window.Toast.info(`Novo lote recebido: ${newRow.inscricao}`);
        }
        else if (eventType === 'UPDATE') {
            const index = window.allLotes.findIndex(l => l.inscricao === newRow.inscricao);
            if (index !== -1) {
                const currentMeta = window.allLotes[index].metadata || {};
                const currentBounds = window.allLotes[index].bounds_utm || { minx: 0, miny: 0, maxx: 0, maxy: 0 };

                window.allLotes[index] = {
                    ...window.allLotes[index],
                    ...newRow,
                    metadata: {
                        ...currentMeta,
                        zona: newRow.zona !== undefined ? newRow.zona : currentMeta.zona,
                        setor: newRow.setor !== undefined ? newRow.setor : currentMeta.setor,
                        lote: newRow.lote_geo !== undefined ? newRow.lote_geo : currentMeta.lote,
                        quadra: newRow.quadra !== undefined ? newRow.quadra : currentMeta.quadra,
                        bairro: newRow.bairro !== undefined ? newRow.bairro : currentMeta.bairro
                    },
                    bounds_utm: {
                        minx: newRow.minx !== undefined ? newRow.minx : currentBounds.minx,
                        miny: newRow.miny !== undefined ? newRow.miny : currentBounds.miny,
                        maxx: newRow.maxx !== undefined ? newRow.maxx : currentBounds.maxx,
                        maxy: newRow.maxy !== undefined ? newRow.maxy : currentBounds.maxy
                    }
                };
                processDataHierarchy();
                window.renderHierarchy();
            }
        }
        else if (eventType === 'DELETE') {
            const index = window.allLotes.findIndex(l => l.inscricao === oldRow.inscricao);
            if (index !== -1) {
                window.allLotes.splice(index, 1);
                processDataHierarchy();
                window.renderHierarchy();
                window.Toast.info(`Lote removido: ${oldRow.inscricao}`);
            }
        }
    } else if (table === 'unidades') {
        const parentId = (newRow && newRow.lote_inscricao) || (oldRow && oldRow.lote_inscricao);
        const parentLot = window.allLotes.find(l => l.inscricao === parentId);
        if (parentLot) {
            parentLot._detailsLoaded = false;
            // console.log(`Unit updated: ${parentId} - Not re-rendering full map.`);
        }
    }
};

// ========================================
// ZONE LEGEND POPULATION
// ========================================
window.populateZoneLegend = function () {
    const container = document.getElementById('zoneLegendContainer');
    if (!container) return;

    container.innerHTML = '';

    // Sort zones numerically
    const zones = Object.keys(window.cityData).sort((a, b) => {
        return parseInt(a) - parseInt(b);
    });

    zones.forEach(zoneKey => {
        const zone = window.cityData[zoneKey];
        const color = window.getZoneColor(zoneKey);

        const item = document.createElement('div');
        item.className = 'legend-item';
        item.style.cursor = 'pointer';
        item.onclick = (e) => {
            e.stopPropagation();
            const centerLat = zone.latSum / zone.count;
            const centerLng = zone.lngSum / zone.count;
            window.currentLevel = 1;
            window.currentZone = zoneKey;
            window.map.setCenter({ lat: centerLat, lng: centerLng });
            window.map.setZoom(14);
            window.window.renderHierarchy();
        };

        const colorBox = document.createElement('div');
        colorBox.className = 'legend-color';
        colorBox.style.cssText = `width:10px; height:10px; border-radius:3px; background-color:${color}; flex-shrink:0;`;

        const label = document.createElement('div');
        label.className = 'legend-label';
        label.style.cssText = `font-size:12px; font-weight:600; color:#475569; display:flex; align-items:center; gap:6px;`;
        label.innerHTML = `<span>Zona ${zoneKey}</span> <span style=\"font-weight:400; font-size:10px; color:#94a3b8;\">(${zone.count})</span>`;

        item.style.cssText = `display:flex; align-items:center; gap:8px; padding:4px 0; border-bottom:1px solid #f1f5f9;`;
        item.appendChild(colorBox);
        item.appendChild(label);
        container.appendChild(item);
    });
};

// ========================================
// CONTEXT MENU
// ========================================
let contextMenuTarget = null;
let contextMenuPos = null;

window.handleContextMenu = function (e, type, data) {
    if (e.originalEvent) {
        e.originalEvent.preventDefault();
        e.originalEvent.stopPropagation();
    }

    const menu = document.getElementById('context-menu');
    if (!menu) return;

    contextMenuTarget = { type, data };
    contextMenuPos = e.latlng;

    menu.querySelectorAll('.context-menu-item').forEach(el => el.style.display = 'none');
    const dividers = menu.querySelectorAll('.context-menu-divider');
    dividers.forEach(d => d.style.display = 'none');

    if (type === 'map') {
        const isMaster = window.Monetization && window.Monetization.userRole === 'master';
        if (isMaster) {
            document.getElementById('ctx-create-lote').style.display = 'flex';
        }
        document.getElementById('ctx-add-lead').style.display = 'flex';
        document.getElementById('ctx-report-discrepancy').style.display = 'flex';
        if (dividers[0]) dividers[0].style.display = 'block';
        if (dividers[1]) dividers[1].style.display = 'block';
    } else if (type === 'lote') {
        document.getElementById('ctx-report-discrepancy').style.display = 'flex';
        document.getElementById('ctx-add-unit').style.display = 'flex';
        document.getElementById('ctx-move-lote').style.display = 'flex';
        document.getElementById('ctx-edit-details').style.display = 'flex';
        document.getElementById('ctx-delete-lote').style.display = 'flex';
        document.getElementById('ctx-add-lead').style.display = 'flex';
        if (dividers[0]) dividers[0].style.display = 'block';
        if (dividers[1]) dividers[1].style.display = 'block';
    }

    // Always show cancel
    const items = menu.querySelectorAll('.context-menu-item');
    if (items.length > 0) items[items.length - 1].style.display = 'flex';

    const x = e.originalEvent ? e.originalEvent.pageX : e.containerPoint.x;
    const y = e.originalEvent ? e.originalEvent.pageY : e.containerPoint.y;

    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.style.display = 'block';
};

window.hideContextMenu = function () {
    const menu = document.getElementById('context-menu');
    if (menu) menu.style.display = 'none';
};

document.addEventListener('click', () => window.hideContextMenu());

window.handleContextAction = function (action) {
    const target = contextMenuTarget;
    const pos = contextMenuPos;
    window.hideContextMenu();

    if (!target) return;
    const { type, data } = target;

    if (action === 'create' && type === 'map') {
        if (typeof window.openAddLoteModal === 'function') window.openAddLoteModal(pos);
    } else if (action === 'add-unit' && type === 'lote') {
        if (typeof window.openAddUnitModal === 'function') window.openAddUnitModal(data);
    } else if (action === 'edit' && type === 'lote') {
        // Open tooltip first, then activate edit mode
        if (typeof window.showLotTooltip === 'function' && typeof window.editFromTooltip === 'function') {
            const lote = window.allLotes.find(l => l.inscricao === data.inscricao);
            if (lote) {
                // Open the tooltip
                window.showLotTooltip(lote, pos.x, pos.y);
                // Wait a bit for tooltip to render, then activate edit mode
                setTimeout(() => {
                    window.editFromTooltip(data.inscricao);
                }, 100);
            }
        }
    } else if (action === 'move' && type === 'lote') {
        window.Toast.info('Clique no mapa para mover o lote para a nova localização');
        // Set up one-time click handler for new position
        google.maps.event.addListenerOnce(window.map, 'click', (e) => {
            if (typeof window.moveLote === 'function') {
                window.moveLote(data.inscricao, { lat: e.latLng.lat(), lng: e.latLng.lng() });
            }
        });
    } else if (action === 'delete' && type === 'lote') {
        if (typeof window.deleteLote === 'function') window.deleteLote(data.inscricao);
    } else if (action === 'report') {
        if (window.Maintenance && window.Maintenance.showReportModal) {
            window.Maintenance.showReportModal(type, data);
        } else {
            window.Toast.info("Solicitando suporte para: " + (data?.inscricao || "Mapa"));
        }
    } else if (action === 'add-lead') {
        if (typeof window.openAddLeadTooltip === 'function') {
            window.openAddLeadTooltip();
            // Pre-select zone if clicked inside a zone
            setTimeout(() => {
                if (window.currentZone) {
                    const cb = document.getElementById(`zona-${window.currentZone}`);
                    if (cb) cb.checked = true;
                }
            }, 300);
        }
    }
};

// ========================================
// OFF-MARKET VISUAL FILTERS
// ========================================
window.currentOffMarketFilter = 'todos';

// applyOffMarketFilter removed along with UI filters

console.log("✅ Map Handler module loaded");
