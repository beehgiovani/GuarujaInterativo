/**
 * LOCATION HANDLER (GPS)
 * Manages user geolocation and the "Minha Localização" feature.
 */

const LocationHandler = {
    watchId: null,
    userMarker: null,
    isFollowing: false,

    init() {
        if (this.btn) {
            console.warn("📍 Location Handler already initialized.");
            return;
        }
        this.createControl();
        console.log("📍 Location Handler Initialized");
    },

    createControl() {
        // Create the GPS button
        const controlDiv = document.createElement('div');
        controlDiv.className = 'landscape-control'; 
        controlDiv.style.cssText = `
            margin: 10px;
            background: white; border-radius: 50%; width: 44px; height: 44px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.15); cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            border: 1px solid #e2e8f0;
        `;
        controlDiv.innerHTML = '<i class="fas fa-crosshairs" style="font-size: 20px; color: #334155;"></i>';

        controlDiv.onclick = () => this.toggleTracking();

        this.btn = controlDiv;
        return controlDiv;
    },

    toggleTracking() {
        if (this.isFollowing) {
            this.stopTracking();
        } else {
            this.startTracking();
        }
    },

    startTracking() {
        if (!navigator.geolocation) {
            console.error("❌ Geolocation API not supported in this environment.");
            if (window.Toast) window.Toast.error("GPS não suportado neste dispositivo.");
            return;
        }

        if (window.Toast) window.Toast.info("Buscando sua localização...");
        this.btn.innerHTML = '<i class="fas fa-spinner fa-spin" style="color: #0284c7;"></i>';

        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                const accuracy = position.coords.accuracy;

                this.updateMarker(lat, lng, accuracy);

                // Centering (First time or Follow Mode)
                if (!this.userMarker || this.isFollowing) {
                    window.map.setCenter({ lat, lng });
                    window.map.setZoom(18);
                }

                if (!this.isFollowing) {
                    this.isFollowing = true;
                    this.btn.innerHTML = '<i class="fas fa-location-arrow" style="color: #0284c7;"></i>'; // Active Icon
                    if (window.Toast) window.Toast.success("Localização encontrada!");
                }

                console.log(`📍 GPS Update: Lat ${lat.toFixed(5)}, Lng ${lng.toFixed(5)}, Acc ${accuracy}m`);

                // AUTO-DETECT PROXIMITY
                if (window.findNearestLot && accuracy < 50) { 
                    const nearest = window.findNearestLot(lat, lng);
                    if (nearest) {
                        const currentInscricao = window.currentTooltip && window.currentLoteForUnit ? window.currentLoteForUnit.inscricao : null;

                        if (currentInscricao !== nearest.inscricao) {
                            console.log("📍 GPS Auto-Select:", nearest.inscricao);
                            window.Toast.info(`📍 Você está no lote: ${nearest.metadata.bairro}`, 'Localização Detectada');
                            window.showLotTooltip(nearest);
                        }
                    }
                }
            },
            (error) => {
                console.error("❌ GPS Error Code:", error.code, "Message:", error.message);
                let msg = "Erro ao obter localização.";
                if (error.code === 1) msg = "Permissão de GPS negada.";
                if (error.code === 2) msg = "Sinal de GPS indisponível.";
                if (error.code === 3) msg = "Tempo limite esgotado.";

                if (window.Toast) window.Toast.error(msg);
                this.stopTracking();
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    },

    stopTracking() {
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
        this.isFollowing = false;
        this.btn.innerHTML = '<i class="fas fa-crosshairs" style="color: #334155;"></i>';
    },

    updateMarker(lat, lng, accuracy) {
        const position = { lat, lng };

        if (this.userMarker) {
            this.userMarker.setPosition(position);
            this.userCircle.setCenter(position);
            this.userCircle.setRadius(accuracy / 2);
        } else {
            // Create Google Maps Geolocation Marker
            this.userCircle = new google.maps.Circle({
                map: window.map,
                center: position,
                radius: accuracy / 2,
                fillColor: '#0284c7',
                fillOpacity: 0.1,
                strokeColor: '#0284c7',
                strokeWeight: 1,
                clickable: false
            });

            this.userMarker = new google.maps.Marker({
                map: window.map,
                position: position,
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 8,
                    fillColor: '#0284c7',
                    fillOpacity: 1,
                    strokeColor: '#ffffff',
                    strokeWeight: 3
                },
                title: "Você está aqui",
                optimized: false // Better for updates
            });
        }
    }
};

// Auto-init if map is ready, or wait
if (window.map) {
    LocationHandler.init();
} else {
    // Poll for map or listen to an event (simplest is polling or waiting for load)
    const checkMap = setInterval(() => {
        if (window.map) {
            LocationHandler.init();
            clearInterval(checkMap);
        }
    }, 500);
}
