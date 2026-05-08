/**
 * Controles e Ferramentas do Mapa (map_controls.js)
 * Aqui ficam as ferramentas interativas: Régua, Modo 3D, Legenda e Mapas de Calor.
 */

window.MapControls = {
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

    // Legenda colorida das Zonas do Guarujá
    initMapLegend: function() {
        if (!window.map || !window.GUARA_ZONES) return;

        const legendBtn = document.createElement('div');
        legendBtn.className = 'landscape-control legend-toggle-btn';
        legendBtn.title = 'Legenda de Zonas';
        legendBtn.style.cssText = `
            margin: 10px; background: white; border-radius: 8px; width: 44px; height: 44px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.15); cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            border: 1px solid #e2e8f0; font-size: 18px; color: #334155;
        `;
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
        window.map.controls[google.maps.ControlPosition.LEFT_CENTER].push(heatmapBtn);

        heatmapBtn.onclick = async () => {
            isActive = !isActive;
            heatmapBtn.style.color = isActive ? '#f97316' : '#334155';
            
            if (isActive) {
                window.Toast.info("Gerando mapa de calor de mercado...");
                try {
                    if (!heatmap) {
                        await google.maps.importLibrary("visualization");
                        const { data } = await window.supabaseApp.from('lotes').select('minx, miny, maxx, maxy, valor_m2').not('valor_m2', 'is', null).gt('valor_m2', 0);
                        
                        const points = data.map(l => {
                            const ll = window.utmToLatLon((l.minx + l.maxx) / 2, (l.miny + l.maxy) / 2);
                            return {
                                location: new google.maps.LatLng(ll.lat, ll.lng),
                                weight: parseFloat(l.valor_m2) / 100
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
window.initMapLegend = () => window.MapControls.initMapLegend();
window.initHeatmap = () => window.MapControls.initHeatmap();
