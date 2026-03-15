/**
 * ANALYTICS & MARKET INTELLIGENCE HANDLER
 * Manages Heatmaps and Strategic Data Visualization.
 */

const AnalyticsHandler = {
    heatmapLayer: null,
    isOn: false,

    init() {
        console.log("🔥 Analytics Handler Initialized");
        this.addHeatmapToggle();
    },

    addHeatmapToggle() {
        // Find the specific actions container in the stats panel
        const dashboardActions = document.querySelector('.dashboard-actions');
        if (dashboardActions) {
            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'dashboard-btn secondary';
            toggleBtn.style.marginLeft = '8px'; // Spacing
            toggleBtn.innerHTML = '<i class="fas fa-fire"></i> Calor';
            toggleBtn.title = "Ativar/Desativar Mapa de Calor";

            toggleBtn.onclick = () => {
                const isActive = toggleBtn.classList.contains('active');
                if (isActive) {
                    toggleBtn.classList.remove('active');
                    toggleBtn.style.background = ''; // Revert to secondary style
                    toggleBtn.style.color = '';
                    this.toggleHeatmap(false);
                } else {
                    toggleBtn.classList.add('active');
                    toggleBtn.style.background = 'linear-gradient(135deg, #f87171, #ef4444)';
                    toggleBtn.style.color = 'white';
                    this.toggleHeatmap(true);
                }
            };

            dashboardActions.appendChild(toggleBtn);
        }
    },

    toggleHeatmap(show) {
        if (!window.map) return;

        if (show) {
            this.generateMockData().then(points => {
                if (this.heatmapLayer) {
                    this.heatmapLayer.setMap(null);
                }

                // Converter pontos para objetos LatLng do Google
                // points vem como [lat, lng, intensity] ou similar
                const heatmapData = points.map(p => {
                    return {
                        location: new google.maps.LatLng(p[0], p[1]),
                        weight: p[2] || 1
                    };
                });

                // Google Maps Heatmap Layer
                this.heatmapLayer = new google.maps.visualization.HeatmapLayer({
                    data: heatmapData,
                    map: window.map,
                    radius: 30,
                    opacity: 0.6
                });

                if (window.Toast) window.Toast.info("Mapa de Calor ativado: Zonas de Alta Demanda");
                this.isOn = true;
                console.log("🔥 Heatmap Layer Enabled (Google Maps)");
            });
        } else {
            if (this.heatmapLayer) {
                this.heatmapLayer.setMap(null);
                this.heatmapLayer = null;
            }
            this.isOn = false;
            console.log("❄️ Heatmap Layer Disabled");
        }
    },

    async generateMockData() {
        console.log("🔥 Generating/Fetching Heatmap Data...");
        const hotspots = [];

        try {
            // 1. Try fetching REAL data from Supabase (Lotes centroids)
            const { data: lotes, error } = await window.supabaseApp
                .from('lotes')
                .select('minx, miny, bairro')
                .limit(1000); // Sample size

            if (!error && lotes && lotes.length > 0) {
                console.log(`📡 Loaded ${lotes.length} real points for Heatmap.`);

                lotes.forEach(lote => {
                    if (lote.minx && lote.miny && window.utmToLatLon) {
                        try {
                            const coords = window.utmToLatLon(lote.minx, lote.miny);
                            // Add some jitter to avoid perfect overlap if precision is low
                            // But usually centroids are unique enough.
                            // Intensity: 1.0 (Standard)
                            hotspots.push([coords.lat, coords.lng, 0.8]);
                        } catch (e) {
                            // Ignore conversion errors
                        }
                    }
                });
            }

            // If we got real data, return it
            if (hotspots.length > 0) return hotspots;

        } catch (e) {
            console.error("Heatmap Fetch Error:", e);
        }

        // FALLBACK: Corrected Coordinates (On Land)
        console.warn("⚠️ Using Fallback Mock Data for Heatmap");

        // Helper to add random points around a center
        const addCluster = (lat, lng, count, spread) => {
            for (let i = 0; i < count; i++) {
                hotspots.push([
                    lat + (Math.random() - 0.5) * spread,
                    lng + (Math.random() - 0.5) * spread,
                    Math.random() // Intensity
                ]);
            }
        };

        // Pitangueiras (Corrected: Moved North-West onto land)
        addCluster(-23.9980, -46.2600, 300, 0.015);

        // Enseada (Corrected: Moved North onto land)
        addCluster(-23.9850, -46.2250, 400, 0.020);

        // Jardim Acapulco (Corrected: Inland)
        addCluster(-23.9600, -46.1900, 150, 0.010);

        return hotspots;
    }
};

// Init
window.addEventListener('load', () => {
    setTimeout(() => AnalyticsHandler.init(), 1000);
});
