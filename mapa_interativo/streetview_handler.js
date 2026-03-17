/**
 * STREETVIEW_HANDLER.JS
 * Immersive Street View with Database Overlays
 */

window.StreetViewHandler = (function() {
    let panorama = null;
    let markers = [];

    /**
     * Open integrated Street View
     */
    function open(lat, lng, currentLote = null) {
        console.log(`[StreetView] Opening for: ${lat}, ${lng}`);
        
        let overlay = document.getElementById('streetview-overlay');
        if (!overlay) {
            overlay = createOverlay();
        }

        overlay.classList.add('active');
        const container = document.getElementById('streetview-pano');

        // Calculate Heading towards the building if possible
        let initialPOV = { heading: 165, pitch: 0 };
        if (currentLote && currentLote._lat) {
            const start = new google.maps.LatLng(lat, lng);
            const end = new google.maps.LatLng(currentLote._lat, currentLote._lng);
            const hdg = google.maps.geometry.spherical.computeHeading(start, end);
            initialPOV.heading = hdg;
        }

        // Initialize Panorama
        panorama = new google.maps.StreetViewPanorama(container, {
            position: { lat, lng },
            pov: initialPOV,
            zoom: 1,
            addressControl: true,
            showRoadLabels: true,
            motionTracking: false, // Better for PC
            motionTrackingControl: false
        });

        // Add Database Overlays
        highlightNearbyLots(lat, lng, currentLote);
    }

    function createOverlay() {
        const div = document.createElement('div');
        div.id = 'streetview-overlay';
        div.style.cssText = `
            position: fixed;
            inset: 0;
            background: black;
            z-index: 30000;
            display: none;
            flex-direction: column;
        `;
        div.innerHTML = `
            <div id="streetview-header" style="padding: 12px 20px; background: rgba(0,0,0,0.8); color: white; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #333;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <i class="fas fa-street-view" style="font-size: 20px; color: #60a5fa;"></i>
                    <div>
                        <div style="font-weight: bold; font-size: 14px;">Visão de Rua Inteligente</div>
                        <div style="font-size:10px; opacity:0.6;">Pins do banco de dados integrados</div>
                    </div>
                </div>
                <button onclick="window.StreetViewHandler.close()" style="background: #ef4444; border: none; color: white; padding: 6px 16px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12px;">
                    <i class="fas fa-times"></i> FECHAR VISÃO
                </button>
            </div>
            <div id="streetview-pano" style="flex: 1; min-height: 0;"></div>
            <div id="streetview-infobox" style="position: absolute; bottom: 20px; left: 20px; background: white; padding: 12px; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); display: none; max-width: 280px; z-index: 1;">
                <div id="sv-info-content"></div>
            </div>
        `;
        document.body.appendChild(div);
        
        // Add class support
        const style = document.createElement('style');
        style.innerHTML = `
            #streetview-overlay.active { display: flex !important; }
        `;
        document.head.appendChild(style);

        return div;
    }

    function highlightNearbyLots(lat, lng, currentLote) {
        clearMarkers();
        if (!window.allLotes) return;

        const center = new google.maps.LatLng(lat, lng);
        
        window.allLotes.forEach(lote => {
            if (!lote._lat || !lote._lng) return;

            const pos = new google.maps.LatLng(lote._lat, lote._lng);
            const dist = google.maps.geometry.spherical.computeDistanceBetween(center, pos);

            if (dist < 100) { // Shows lots within 100m
                const isCurrent = currentLote && lote.inscricao === currentLote.inscricao;
                const buildingName = lote.building_name || lote.metadata?.lote || lote.inscricao;
                
                const marker = new google.maps.Marker({
                    position: { lat: lote._lat, lng: lote._lng },
                    panorama: panorama,
                    title: buildingName,
                    icon: {
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: isCurrent ? 14 : 10,
                        fillColor: isCurrent ? "#2563eb" : "#fbbf24",
                        fillOpacity: 1,
                        strokeWeight: 3,
                        strokeColor: "white"
                    },
                    label: {
                        text: buildingName,
                        color: "white",
                        fontSize: "11px",
                        fontWeight: "900",
                        className: "sv-marker-label"
                    }
                });

                marker.addListener('click', () => {
                    showInfo(lote);
                });

                markers.push(marker);
            }
        });
    }

    function showInfo(lote) {
        const infobox = document.getElementById('streetview-infobox');
        const content = document.getElementById('sv-info-content');
        if (!infobox || !content) return;

        const ownerInfo = lote.nome_proprietario || 'Proprietário Não Identificado';
        const docInfo = lote.cpf_cnpj ? `DOC: ${lote.cpf_cnpj}` : '';

        content.innerHTML = `
            <div style="font-weight: 900; font-size: 15px; margin-bottom: 2px; color: #1e293b; text-transform: uppercase;">
                ${lote.building_name || 'Edifício/Loteamento'}
            </div>
            <div style="font-family: monospace; font-size: 10px; color: #2563eb; margin-bottom: 10px; font-weight: bold;">
                ID: ${lote.inscricao}
            </div>
            <div style="background: #f8fafc; padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 12px;">
                <div style="font-size: 10px; color: #94a3b8; font-weight: 800; text-transform: uppercase;">Proprietário Base</div>
                <div style="font-size: 13px; color: #1e293b; font-weight: 700;">${ownerInfo}</div>
                <div style="font-size: 10px; color: #64748b;">${docInfo}</div>
            </div>
            <div style="font-size:12px; color: #475569; line-height: 1.4; margin-bottom: 10px;">
                <i class="fas fa-building"></i> ${lote.unidades ? `<b>${lote.unidades.length}</b> unidades cadastradas` : 'Dados de unidades em rede'}
            </div>
            <button onclick="window.StreetViewHandler.goToLot('${lote.inscricao}')" style="width: 100%; background: #2563eb; color: white; border: none; padding: 10px; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: bold; transition: all 0.2s; box-shadow: 0 4px 6px rgba(37, 99, 235, 0.2);">
                ABRIR FICHA COMPLETA
            </button>
        `;
        infobox.style.display = 'block';
    }

    function goToLot(inscricao) {
        close();
        if (window.navigateToInscricao) {
            window.navigateToInscricao(inscricao);
        }
    }

    function clearMarkers() {
        markers.forEach(m => m.setMap(null));
        markers = [];
    }

    function close() {
        const overlay = document.getElementById('streetview-overlay');
        if (overlay) overlay.classList.remove('active');
        if (panorama) {
            // Clean up to save memory
            panorama = null;
        }
        clearMarkers();
        const infobox = document.getElementById('streetview-infobox');
        if (infobox) infobox.style.display = 'none';
    }

    return {
        open,
        close,
        goToLot
    };
})();
