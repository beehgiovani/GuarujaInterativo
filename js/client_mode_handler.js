/**
 * CLIENT_MODE_HANDLER.JS
 * Manages the "Secure Client Mode" (Deep Linking).
 * Hides UI elements and locks navigation when accessing via a shared link.
 */

window.ClientModeHandler = (function() {
    
    let isClientMode = false;

    function init() {
        const params = new URLSearchParams(window.location.search);
        if (params.get('mode') === 'client') {
            enableClientMode();
            
            // Auto-open lot if present
            const inscricao = params.get('lote');
            if (inscricao) {
                // Wait for map and data to load
                const check = setInterval(() => {
                    if (window.allLotes && window.allLotes.length > 0 && window.map) {
                        clearInterval(check);
                        openSecureLot(inscricao);
                    }
                }, 500);
            }
        }
    }

    function enableClientMode() {
        isClientMode = true;
        document.body.classList.add('client-mode');
        
        // Inject Secure CSS
        const style = document.createElement('style');
        style.innerHTML = `
            body.client-mode #sidebar { display: none !important; }
            body.client-mode .search-box { display: none !important; }
            body.client-mode #loginOverlay { display: none !important; }
            body.client-mode #mapBackBtn { display: none !important; }
            body.client-mode #statsPanel, body.client-mode .stats-panel { display: none !important; }
            body.client-mode .leaflet-control-zoom { display: none !important; }
            body.client-mode .leaflet-draw { display: none !important; }
            body.client-mode #context-menu { display: none !important; }
            body.client-mode .crm-leads-btn, 
            body.client-mode .analytics-btn,
            body.client-mode #btnFarolInsights,
            body.client-mode #btnNotifications { display: none !important; }
            body.client-mode .sidebar-logo-container { display: none !important; }
            
            /* Hide specific tooltip actions that allow navigation back */
            body.client-mode .unit-tooltip-close { display: none !important; }
            body.client-mode button[onclick*="showLotTooltip"] { display: none !important; }
            
            /* Show a premium header for the client */
            body.client-mode::before {
                content: '📌 Visualização Exclusiva de Imóvel • Guarujá GeoMap';
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
                color: white;
                text-align: center;
                padding: 14px;
                font-weight: 800;
                z-index: 20000;
                font-size: 14px;
                letter-spacing: 0.5px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.4);
                border-bottom: 2px solid #2563eb;
            }
        `;
        document.head.appendChild(style);

        // Lock basic interactions if desired (optional)
        // For now, we assume "Exclusiva Visualização" means "Clean UI" but map is still interactive
    }

    function openSecureLot(inscricao) {
        const params = new URLSearchParams(window.location.search);
        const unitSuffix = params.get('unidade');

        const lote = window.allLotes.find(l => l.inscricao === inscricao);
        if (!lote) {
            alert('Lote não encontrado ou imóvel inativo.');
            return;
        }

        // --- ISOLATION LOGIC ---
        // Hide all markers except the requested one
        if (window.googleMarkers) {
            window.googleMarkers.forEach(m => {
                if (m.position.lat !== lote._lat || m.position.lng !== lote._lng) {
                    m.setMap(null);
                }
            });
        }

        // Lock Map Interactions
        if (window.map) {
            window.map.setOptions({
                gestureHandling: 'none', // Block panning/zooming
                zoomControl: false,
                mapTypeControl: false,
                streetViewControl: false,
                fullscreenControl: false
            });
        }

        if (window.showLotTooltip) {
            // Calculate center
            let lat, lng;
            if (lote.minx) {
                const centerX = (parseFloat(lote.minx) + parseFloat(lote.maxx)) / 2;
                const centerY = (parseFloat(lote.miny) + parseFloat(lote.maxy)) / 2;
                const coords = window.utmToLatLon(centerX, centerY);
                lat = coords.lat;
                lng = coords.lng;
            } else {
                lat = lote._lat;
                lng = lote._lng;
            }

            if (lat && lng) {
                // Fly to lot (Instant)
                if (window.map) {
                    window.map.setCenter({ lat, lng });
                    window.map.setZoom(20); // Deep zoom
                }

                // Show appropriate tooltip (Lot or specific Unit)
                if (unitSuffix && unitSuffix !== '000') {
                    // It's a specific unit. We need to fetch details to show the unit tooltip
                    window.fetchLotDetails(inscricao).then(fullLot => {
                        if (fullLot && fullLot.unidades) {
                            const targetUnit = fullLot.unidades.find(u => u.inscricao.endsWith(unitSuffix));
                            if (targetUnit && window.showUnitTooltip) {
                                window.showUnitTooltip(targetUnit, fullLot);
                                // Hide the 'Back' button in unit tooltip for clients
                                setTimeout(() => {
                                    const backBtn = document.querySelector('.unit-tooltip-body').parentElement.querySelector('button[onclick*="showLotTooltip"]');
                                    if (backBtn) backBtn.style.display = 'none';
                                }, 50);
                            } else {
                                window.showLotTooltip(fullLot, 0, 0);
                            }
                        }
                    });
                } else {
                    window.showLotTooltip(lote, 0, 0);
                }
            }
        }
    }

    function generateLink(lote, unit) {
        const baseUrl = window.location.origin + window.location.pathname;
        let link = `${baseUrl}?mode=client&lote=${lote.inscricao}`;
        
        // If a specific unit is provided (and it's not the 000 lot/main unit)
        if (unit && unit.inscricao.slice(-3) !== '000') {
            link += `&unidade=${unit.inscricao.slice(-3)}`;
        }
        
        // Copy to clipboard
        navigator.clipboard.writeText(link).then(() => {
            window.Toast.success('Link Seguro copiado para a área de transferência!');
        }).catch(() => {
            prompt("Copie o link seguro:", link);
        });
    }

    return {
        init,
        generateLink,
        isClientMode: () => isClientMode
    };
})();

// Auto-init
document.addEventListener('DOMContentLoaded', () => {
    window.ClientModeHandler.init();
});
