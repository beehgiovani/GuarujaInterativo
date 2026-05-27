/**
 * Controles e Ferramentas do Mapa (map_controls.js)
 * Aqui ficam as ferramentas interativas: Régua, Modo 3D, Legenda e Mapas de Calor.
 */

window.MapControls = {
    controlStyle: `
        margin: 10px; background: white; border-radius: 8px; width: 44px; height: 44px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.15); cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        border: 1px solid #e2e8f0; font-size: 18px; color: #334155;
    `,

    // Régua para medir distâncias no mapa
    initRuler: function() {
        if (!window.map) return;
        let isRulerActive = false;
        let rulerPolyline = null;
        let rulerPoints = [];
        let rulerLabels = [];

        const rulerBtn = document.createElement('div');
        rulerBtn.className = 'landscape-control ruler-btn';
        rulerBtn.title = 'Medir Distância (Régua)';
        rulerBtn.style.cssText = this.controlStyle;
        rulerBtn.innerHTML = '<i class="fas fa-ruler-combined"></i>';
        window.map.controls[google.maps.ControlPosition.RIGHT_TOP].push(rulerBtn);

        const clearRuler = () => {
            if (rulerPolyline) rulerPolyline.setMap(null);
            rulerPoints = [];
            rulerLabels.forEach(l => l.setMap(null));
            rulerLabels = [];
            rulerPolyline = new google.maps.Polyline({
                path: [], 
                geodesic: true, 
                strokeColor: '#ef4444', 
                strokeWeight: 3, 
                map: window.map
            });
        };

        rulerBtn.onclick = () => {
            isRulerActive = !isRulerActive;
            rulerBtn.style.backgroundColor = isRulerActive ? '#eff6ff' : 'white';
            if (isRulerActive) {
                window.map.setOptions({ draggableCursor: 'crosshair' });
                clearRuler();
                window.Toast.info("Modo de Medição Ativado. Clique no mapa pra medir.");
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
                const label = new google.maps.InfoWindow({
                    content: `<div style="color:#ef4444; font-weight:bold;">${totalDist.toFixed(1)}m</div>`, 
                    position: point
                });
                label.open(window.map);
                rulerLabels.push(label);
            }
        });
    },

    // Alternador entre visão 2D (topo) e 3D (perspectiva)
    init3DToggle: function() {
        if (!window.map) return;
        const isMobile = window.innerWidth <= 768;

        const angleUp = document.createElement('div');
        angleUp.className = 'landscape-control';
        angleUp.title = 'Inclinar Mapa (Perspectiva 3D)';
        angleUp.innerHTML = '<i class="fas fa-cube"></i>';
        angleUp.style.cssText = this.controlStyle;
        
        const angleDown = angleUp.cloneNode(true);
        angleDown.title = 'Visão de Topo (2D)';
        angleDown.innerHTML = '<i class="fas fa-layer-group"></i>';
        
        angleUp.onclick = () => {
            window.map.setTilt(45);
            window.Toast.info(isMobile ? "Modo 3D Ativo" : "Perspectiva de 45° Ativada.");
            angleUp.style.color = '#2563eb';
            angleDown.style.color = '#334155';
            if (isMobile) window.closeMobileSidebar?.();
        };

        angleDown.onclick = () => {
            window.map.setTilt(0);
            window.Toast.info("Voltando para Visão 2D.");
            angleDown.style.color = '#2563eb';
            angleUp.style.color = '#334155';
        };

        window.map.controls[google.maps.ControlPosition.RIGHT_CENTER].push(angleUp);
        window.map.controls[google.maps.ControlPosition.RIGHT_CENTER].push(angleDown);
    },

    initPhotorealistic3DToggle: function() {
        if (!window.map) return;
        let map3dEl = null;
        let close3dBtn = null;
        let lot3dBtn = null;
        let back3dBtn = null;
        let overview3dBtn = null;
        let hierarchy3dMarkers = [];
        let lot3dMarkers = [];
        let areLot3dMarkersVisible = false;
        let isActive = false;

        const clearHierarchy3dMarkers = () => {
            hierarchy3dMarkers.forEach(marker => marker.remove());
            hierarchy3dMarkers = [];
        };

        const clearLot3dMarkers = () => {
            lot3dMarkers.forEach(marker => marker.remove());
            lot3dMarkers = [];
            areLot3dMarkersVisible = false;
            syncLot3dButton();
        };

        const make3dMarker = ({ lat, lng, label, zIndex = 1, altitude = 24, interactive = false, color = '#2563eb', fill = '#ffffff' }) => {
            const marker = document.createElement(interactive ? 'gmp-marker-3d-interactive' : 'gmp-marker-3d');
            marker.setAttribute('position', `${lat},${lng},${altitude}`);
            marker.setAttribute('altitude-mode', 'relative-to-ground');
            marker.setAttribute('label', label);
            marker.setAttribute('title', label);
            marker.setAttribute('z-index', String(zIndex));
            marker.setAttribute('collision-behavior', 'required');
            marker.setAttribute('size-preserved', '');
            marker.setAttribute('draws-when-occluded', '');
            attach3dLabelSvg(marker, label, { color, fill });
            return marker;
        };

        const focus3dCamera = (lat, lng, range = 900, altitude = 120) => {
            if (!map3dEl || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
            map3dEl.setAttribute('center', `${lat},${lng},${altitude}`);
            map3dEl.setAttribute('range', String(range));
        };

        const focus3dOverview = () => {
            focus3dCamera(-23.9608, -46.2694, 6200, 650);
        };

        const focus3dCurrentZone = () => {
            const zone = window.cityData?.[window.currentZone];
            if (!zone?.count) return;
            focus3dCamera(zone.latSum / zone.count, zone.lngSum / zone.count, 1150, 180);
        };

        const syncLot3dButton = () => {
            const active = Boolean(window.MapLayerState?.lotMarkersVisible);
            areLot3dMarkersVisible = active && lot3dMarkers.length > 0;
            if (lot3dBtn) {
                lot3dBtn.style.background = active ? '#eff6ff' : 'rgba(255,255,255,0.92)';
                lot3dBtn.style.color = active ? '#2563eb' : '#334155';
            }
        };

        const update3dNavButtons = () => {
            if (back3dBtn) {
                back3dBtn.style.display = window.currentLevel > 0 ? 'inline-flex' : 'none';
                back3dBtn.innerHTML = window.currentLevel === 2
                    ? '<i class="fas fa-vector-square"></i> Ver setores'
                    : '<i class="fas fa-layer-group"></i> Visao geral';
            }

            if (overview3dBtn) {
                overview3dBtn.style.display = window.currentLevel > 0 ? 'inline-flex' : 'none';
            }
        };

        const navigate3dOverview = () => {
            window.currentLevel = 0;
            window.currentZone = null;
            window.currentSector = null;
            window.MapLayerState = window.MapLayerState || {};
            window.MapLayerState.lotMarkersVisible = false;
            window.MapLayerState.syncLotMarkersButton?.();
            clearLot3dMarkers();
            focus3dOverview();
            window.renderHierarchy?.();
        };

        const navigate3dBack = () => {
            if (window.currentLevel === 2) {
                window.currentLevel = 1;
                window.currentSector = null;
                window.MapLayerState = window.MapLayerState || {};
                window.MapLayerState.lotMarkersVisible = false;
                window.MapLayerState.syncLotMarkersButton?.();
                clearLot3dMarkers();
                focus3dCurrentZone();
                window.renderHierarchy?.();
                return;
            }

            if (window.currentLevel === 1) {
                navigate3dOverview();
            }
        };

        const escapeSvgText = (value) => String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');

        const attach3dLabelSvg = (marker, label, { color = '#2563eb', fill = '#ffffff' } = {}) => {
            const text = String(label || '').slice(0, 18);
            const width = Math.min(178, Math.max(74, text.length * 8 + 30));
            const template = document.createElement('template');
            template.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="38" viewBox="0 0 ${width} 38">
                    <rect x="2" y="3" width="${width - 4}" height="28" rx="14" fill="${fill}" stroke="${color}" stroke-width="2"/>
                    <path d="M${width / 2 - 6} 31 L${width / 2} 37 L${width / 2 + 6} 31 Z" fill="${fill}" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>
                    <text x="${width / 2}" y="22" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" font-weight="800" fill="#0f172a">${escapeSvgText(text)}</text>
                </svg>
            `;
            marker.appendChild(template);
        };

        const render3dZoneLabels = () => {
            if (!map3dEl || !window.cityData) return;

            Object.entries(window.cityData).forEach(([zoneKey, zone]) => {
                const points = zone.displayPoints?.length
                    ? zone.displayPoints
                    : [{ lat: zone.latSum / zone.count, lng: zone.lngSum / zone.count }];

                points.forEach((pt, index) => {
                    if (!Number.isFinite(pt.lat) || !Number.isFinite(pt.lng)) return;
                    const color = window.getZoneColor?.(zoneKey) || '#2563eb';
                    const marker = make3dMarker({
                        lat: pt.lat,
                        lng: pt.lng,
                        label: index === 0 ? `Zona ${zoneKey}` : `Z${zoneKey}`,
                        zIndex: 1000 + Number(zoneKey || 0),
                        altitude: 52,
                        interactive: true,
                        color
                    });

                    marker.addEventListener('gmp-click', async () => {
                        if (window.loadZoneData) await window.loadZoneData(zoneKey);
                        window.currentLevel = 1;
                        window.currentZone = zoneKey;
                        window.currentSector = null;
                        focus3dCamera(pt.lat, pt.lng, 650, 130);
                        window.renderHierarchy?.();
                    });

                    map3dEl.appendChild(marker);
                    hierarchy3dMarkers.push(marker);
                });
            });
        };

        const render3dSectorLabels = () => {
            const zone = window.cityData?.[window.currentZone];
            if (!map3dEl || !zone?.sectors) return;

            Object.entries(zone.sectors).forEach(([sectorKey, sector], index) => {
                if (!sector.count) return;
                const lat = sector.latSum / sector.count;
                const lng = sector.lngSum / sector.count;
                if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

                const color = window.getZoneColor?.(window.currentZone) || '#2563eb';
                const marker = make3dMarker({
                    lat,
                    lng,
                    label: `Setor ${sector.id}`,
                    zIndex: 2000 + index,
                    altitude: 48,
                    interactive: true,
                    color
                });

                marker.addEventListener('gmp-click', async () => {
                    if (window.loadSectorData) await window.loadSectorData(sectorKey);
                    window.currentLevel = 2;
                    window.currentSector = sectorKey;
                    window.MapLayerState = window.MapLayerState || {};
                    window.MapLayerState.lotMarkersVisible = true;
                    window.MapLayerState.syncLotMarkersButton?.();
                    focus3dCamera(lat, lng, 380, 95);
                    window.renderHierarchy?.();
                });

                map3dEl.appendChild(marker);
                hierarchy3dMarkers.push(marker);
            });
        };

        const getCurrent3dLots = () => {
            if (window.currentLevel === 2 && window.currentZone && window.currentSector) {
                return window.cityData?.[window.currentZone]?.sectors?.[window.currentSector]?.lotes || [];
            }

            if (window.currentLevel === 1 && window.currentZone) {
                const sectors = window.cityData?.[window.currentZone]?.sectors || {};
                return Object.values(sectors).flatMap(sector => sector.lotes || []).slice(0, 300);
            }

            return [];
        };

        const render3dLotMarkers = ({ silent = false } = {}) => {
            if (!map3dEl) return;

            clearLot3dMarkers();

            const lots = getCurrent3dLots().filter(lote => Number.isFinite(lote._lat) && Number.isFinite(lote._lng));
            if (!lots.length) {
                if (!silent) window.Toast?.warning?.('Entre em uma zona ou setor para carregar os lotes 3D.');
                return;
            }

            lots.slice(0, 300).forEach((lote, index) => {
                const label = lote.building_name || lote.metadata?.lote || lote.lote_geo || lote.inscricao?.slice(-3) || 'Lote';
                const marker = make3dMarker({
                    lat: lote._lat,
                    lng: lote._lng,
                    label: String(label).slice(0, 18),
                    zIndex: 500 + index,
                    altitude: 34,
                    interactive: true
                });

                marker.addEventListener('gmp-click', async () => {
                    const fullLote = await window.fetchLotDetails?.(lote.inscricao);
                    if (fullLote) window.showLotTooltip?.(fullLote, 0, 0);
                });

                map3dEl.appendChild(marker);
                lot3dMarkers.push(marker);
            });

            window.MapLayerState = window.MapLayerState || {};
            window.MapLayerState.lotMarkersVisible = true;
            window.MapLayerState.syncLotMarkersButton?.();
            areLot3dMarkersVisible = true;
            syncLot3dButton();
            if (!silent) window.Toast?.success?.(`${lot3dMarkers.length} lotes renderizados no 3D.`);
        };

        const toggle3dLotMarkers = () => {
            if (!map3dEl) return;

            if (areLot3dMarkersVisible) {
                window.MapLayerState = window.MapLayerState || {};
                window.MapLayerState.lotMarkersVisible = false;
                window.MapLayerState.syncLotMarkersButton?.();
                clearLot3dMarkers();
                window.renderHierarchy?.();
                window.Toast?.info?.('Lotes 3D desativados.');
                return;
            }

            render3dLotMarkers();
        };

        const refresh3dHierarchyLabels = () => {
            if (!map3dEl || !isActive) return;

            clearHierarchy3dMarkers();
            update3dNavButtons();
            syncLot3dButton();

            if (window.currentLevel === 0) {
                window.MapLayerState = window.MapLayerState || {};
                window.MapLayerState.lotMarkersVisible = false;
                window.MapLayerState.syncLotMarkersButton?.();
                clearLot3dMarkers();
                render3dZoneLabels();
            } else if (window.currentLevel === 1) {
                render3dSectorLabels();
                if (window.MapLayerState?.lotMarkersVisible) {
                    render3dLotMarkers({ silent: true });
                } else {
                    clearLot3dMarkers();
                }
            } else if (window.currentLevel === 2) {
                render3dSectorLabels();
                if (window.MapLayerState?.lotMarkersVisible) {
                    render3dLotMarkers({ silent: true });
                } else {
                    clearLot3dMarkers();
                }
            }
        };

        window.refreshPhotorealistic3DLabels = refresh3dHierarchyLabels;

        const btn = document.createElement('div');
        btn.className = 'landscape-control maps3d-btn';
        btn.title = 'Ativar/Desativar 3D fotorrealista';
        btn.innerHTML = '<i class="fas fa-mountain-city"></i>';
        btn.style.cssText = this.controlStyle;

        btn.onclick = async () => {
            isActive = !isActive;
            btn.style.color = isActive ? '#7c3aed' : '#334155';
            btn.style.background = isActive ? '#f5f3ff' : 'white';

            if (!isActive) {
                if (map3dEl) {
                    map3dEl.remove();
                    map3dEl = null;
                }
                if (close3dBtn) {
                    close3dBtn.remove();
                    close3dBtn = null;
                }
                if (lot3dBtn) {
                    lot3dBtn.remove();
                    lot3dBtn = null;
                }
                if (back3dBtn) {
                    back3dBtn.remove();
                    back3dBtn = null;
                }
                if (overview3dBtn) {
                    overview3dBtn.remove();
                    overview3dBtn = null;
                }
                clearHierarchy3dMarkers();
                clearLot3dMarkers();
                if (window.refreshPhotorealistic3DLabels === refresh3dHierarchyLabels) {
                    window.refreshPhotorealistic3DLabels = null;
                }
                window.Toast?.info?.('3D fotorrealista desativado.');
                return;
            }

            try {
                await window.loadGoogleMaps3D?.();
                const center = window.map.getCenter()?.toJSON?.() || { lat: -23.9934, lng: -46.2567 };

                map3dEl = document.createElement('gmp-map-3d');
                map3dEl.id = 'guarugeo-map3d-overlay';
                map3dEl.setAttribute('center', `${center.lat},${center.lng},120`);
                map3dEl.setAttribute('range', '900');
                map3dEl.setAttribute('tilt', '60');
                map3dEl.setAttribute('heading', String(window.map.getHeading?.() || 0));
                map3dEl.setAttribute('mode', 'hybrid');
                map3dEl.setAttribute('gesture-handling', 'greedy');
                map3dEl.setAttribute('map-id', window.GoogleMapsConfig?.MAP_ID || 'DEMO_MAP_ID');
                map3dEl.style.cssText = 'position:absolute; inset:0; z-index:15; width:100%; height:100%;';

                close3dBtn = document.createElement('button');
                close3dBtn.type = 'button';
                close3dBtn.className = 'maps3d-close-btn';
                close3dBtn.innerHTML = '<i class="fas fa-times"></i> Sair do 3D';
                close3dBtn.style.cssText = 'position:absolute; top:18px; right:18px; z-index:30; border:none; border-radius:999px; padding:10px 14px; background:rgba(15,23,42,0.86); color:white; font-weight:800; cursor:pointer; box-shadow:0 10px 25px rgba(0,0,0,0.25);';
                close3dBtn.onclick = () => btn.onclick();

                lot3dBtn = document.createElement('button');
                lot3dBtn.type = 'button';
                lot3dBtn.className = 'maps3d-lots-btn';
                lot3dBtn.innerHTML = '<i class="fas fa-map-pin"></i> Lotes 3D';
                lot3dBtn.style.cssText = 'position:absolute; top:18px; right:138px; z-index:30; border:1px solid rgba(226,232,240,0.95); border-radius:999px; padding:10px 14px; background:rgba(255,255,255,0.92); color:#334155; font-weight:800; cursor:pointer; box-shadow:0 10px 25px rgba(0,0,0,0.18);';
                lot3dBtn.onclick = toggle3dLotMarkers;

                back3dBtn = document.createElement('button');
                back3dBtn.type = 'button';
                back3dBtn.className = 'maps3d-back-btn';
                back3dBtn.style.cssText = 'display:none; position:absolute; top:18px; left:18px; z-index:30; align-items:center; gap:8px; border:1px solid rgba(226,232,240,0.95); border-radius:999px; padding:10px 14px; background:rgba(255,255,255,0.94); color:#0f172a; font-weight:800; cursor:pointer; box-shadow:0 10px 25px rgba(0,0,0,0.18);';
                back3dBtn.onclick = navigate3dBack;

                overview3dBtn = document.createElement('button');
                overview3dBtn.type = 'button';
                overview3dBtn.className = 'maps3d-overview-btn';
                overview3dBtn.innerHTML = '<i class="fas fa-globe-americas"></i> Visao geral';
                overview3dBtn.style.cssText = 'display:none; position:absolute; top:18px; left:160px; z-index:30; align-items:center; gap:8px; border:1px solid rgba(226,232,240,0.95); border-radius:999px; padding:10px 14px; background:rgba(15,23,42,0.86); color:white; font-weight:800; cursor:pointer; box-shadow:0 10px 25px rgba(0,0,0,0.22);';
                overview3dBtn.onclick = navigate3dOverview;

                const mapDiv = document.getElementById('map');
                mapDiv.appendChild(map3dEl);
                refresh3dHierarchyLabels();
                mapDiv.appendChild(back3dBtn);
                mapDiv.appendChild(overview3dBtn);
                update3dNavButtons();
                mapDiv.appendChild(close3dBtn);
                mapDiv.appendChild(lot3dBtn);
                window.Toast?.success?.('3D fotorrealista ativado sob demanda.');
            } catch (err) {
                isActive = false;
                btn.style.color = '#334155';
                btn.style.background = 'white';
                if (map3dEl) map3dEl.remove();
                if (close3dBtn) close3dBtn.remove();
                if (lot3dBtn) lot3dBtn.remove();
                if (back3dBtn) back3dBtn.remove();
                if (overview3dBtn) overview3dBtn.remove();
                map3dEl = null;
                close3dBtn = null;
                lot3dBtn = null;
                back3dBtn = null;
                overview3dBtn = null;
                clearHierarchy3dMarkers();
                clearLot3dMarkers();
                if (window.refreshPhotorealistic3DLabels === refresh3dHierarchyLabels) {
                    window.refreshPhotorealistic3DLabels = null;
                }
                console.error('Erro ao ativar Maps 3D:', err);
                window.Toast?.error?.('Não foi possível ativar o 3D fotorrealista nesta sessão.');
            }
        };

        window.map.controls[google.maps.ControlPosition.RIGHT_CENTER].push(btn);
    },

    initLotMarkersToggle: function() {
        if (!window.map) return;
        window.MapLayerState = window.MapLayerState || {};
        window.MapLayerState.lotMarkersVisible = false;

        const btn = document.createElement('div');
        btn.className = 'landscape-control lot-marker-toggle-btn';
        btn.title = 'Ativar/Desativar marcadores de lotes';
        btn.innerHTML = '<i class="fas fa-map-pin"></i>';
        btn.style.cssText = this.controlStyle;

        window.MapLayerState.syncLotMarkersButton = () => {
            const active = Boolean(window.MapLayerState.lotMarkersVisible);
            btn.style.color = active ? '#2563eb' : '#334155';
            btn.style.background = active ? '#eff6ff' : 'white';
        };

        btn.onclick = () => {
            window.MapLayerState.lotMarkersVisible = !window.MapLayerState.lotMarkersVisible;
            window.MapLayerState.syncLotMarkersButton();
            window.Toast?.info?.(window.MapLayerState.lotMarkersVisible ? 'Marcadores de lotes ativados.' : 'Marcadores de lotes desativados.');
            window.renderHierarchy?.();
        };

        window.MapLayerState.syncLotMarkersButton();
        window.map.controls[google.maps.ControlPosition.RIGHT_CENTER].push(btn);
    },

    // Legenda colorida das Zonas do Guarujá
    initMapLegend: function() {
        if (!window.map || !window.GUARA_ZONES) return;

        const legendBtn = document.createElement('div');
        legendBtn.className = 'landscape-control legend-toggle-btn';
        legendBtn.title = 'Legenda de Zonas';
        legendBtn.style.cssText = this.controlStyle;
        legendBtn.innerHTML = '<i class="fas fa-map-marked-alt"></i>';
        window.map.controls[google.maps.ControlPosition.LEFT_TOP].push(legendBtn);

        const legendPanel = document.createElement('div');
        legendPanel.style.cssText = `
            display: none; position: absolute; top: 120px; left: 14px;
            background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(12px);
            color: white; border-radius: 12px; padding: 20px; width: 260px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1);
            z-index: 10000;
        `;
        
        let html = '<div style="font-size: 11px; font-weight: 900; text-transform: uppercase; margin-bottom: 15px; color: #94a3b8; letter-spacing: 1px;">Zonas do Guarujá</div>';
        Object.entries(window.GUARA_ZONES).forEach(([id, zone]) => {
            html += `
                <div style="display: flex; gap: 10px; margin-bottom: 10px; align-items: center;">
                    <div style="width: 12px; height: 12px; border-radius: 3px; background: ${zone.color};"></div>
                    <div style="font-size: 12px; font-weight: 700;">${zone.name}</div>
                </div>`;
        });
        
        legendPanel.innerHTML = html;
        document.getElementById('map').appendChild(legendPanel);

        legendBtn.onclick = () => {
            const isVisible = legendPanel.style.display === 'block';
            legendPanel.style.display = isVisible ? 'none' : 'block';
            legendBtn.style.color = isVisible ? '#334155' : '#2563eb';
        };
    },

    // Mapa de Calor baseado no valor do m²
    initHeatmap: function() {
        if (!window.map) return;
        let heatmap = null;
        let isActive = false;

        const createVectorHeatmap = (points) => {
            const circles = points.map(point => {
                const weight = Math.max(1, Math.min(point.weight || 1, 120));
                return new google.maps.Circle({
                    center: point.location,
                    radius: 18 + weight,
                    strokeWeight: 0,
                    fillColor: weight > 60 ? '#ef4444' : '#f97316',
                    fillOpacity: 0.18,
                    map: window.map
                });
            });

            return {
                setMap: (map) => circles.forEach(circle => circle.setMap(map))
            };
        };
        
        const heatmapBtn = document.createElement('div');
        heatmapBtn.className = 'landscape-control heatmap-btn';
        heatmapBtn.title = 'Mapa de Calor (Valor m²)';
        heatmapBtn.style.cssText = this.controlStyle;
        heatmapBtn.innerHTML = '<i class="fas fa-fire"></i>';
        window.map.controls[google.maps.ControlPosition.LEFT_CENTER].push(heatmapBtn);

        heatmapBtn.onclick = async () => {
            isActive = !isActive;
            heatmapBtn.style.color = isActive ? '#f97316' : '#334155';
            
            if (isActive) {
                window.Toast.info("Gerando mapa de calor de mercado...");
                try {
                    if (!heatmap) {
                        const { data } = await window.supabaseApp.from('lotes').select('minx, miny, maxx, maxy, valor_m2').not('valor_m2', 'is', null).gt('valor_m2', 0);
                        
                        const points = data.map(l => {
                            const ll = window.utmToLatLon((l.minx + l.maxx) / 2, (l.miny + l.maxy) / 2);
                            return {
                                location: new google.maps.LatLng(ll.lat, ll.lng),
                                weight: parseFloat(l.valor_m2) / 100
                            };
                        });

                        if (google.maps.visualization?.HeatmapLayer) {
                            heatmap = new google.maps.visualization.HeatmapLayer({
                                data: points,
                                map: window.map,
                                radius: 40,
                                opacity: 0.8
                            });
                        } else {
                            heatmap = createVectorHeatmap(points);
                        }
                    } else {
                        heatmap.setMap(window.map);
                    }
                } catch (err) {
                    console.error("Erro no Heatmap:", err);
                    window.Toast.error("Não deu pra carregar o mapa de calor.");
                }
            } else {
                if (heatmap) heatmap.setMap(null);
            }
        };
    }
};

// Atalhos globais pra manter a compatibilidade
window.initRuler = () => window.MapControls.initRuler();
window.init3DToggle = () => window.MapControls.init3DToggle();
window.initPhotorealistic3DToggle = () => window.MapControls.initPhotorealistic3DToggle();
window.initLotMarkersToggle = () => window.MapControls.initLotMarkersToggle();
window.initMapLegend = () => window.MapControls.initMapLegend();
window.initHeatmap = () => window.MapControls.initHeatmap();
