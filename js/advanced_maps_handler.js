/**
 * ADVANCED_MAPS_HANDLER.JS
 * Extra interactive features: Drone Flyover, Elevation and Walking distances.
 */

window.AdvancedMaps = (function() {
    
    /**
     * DRONE FLYOVER (360º Orbital Animation)
     * Creates a circular camera movement around the target lot.
     */
    function startDroneFlyover(lat, lng) {
        if (!window.map) return;
        
        console.log(`[Drone] Starting flyover for: ${lat}, ${lng}`);
        window.Toast.info("📡 Iniciando Voo de Drone 3D...");

        const center = { lat, lng };
        let heading = window.map.getHeading() || 0;
        let tilt = window.map.getTilt() || 0;
        let zoom = window.map.getZoom() || 19;

        // Configuration
        const targetTilt = 55;
        const targetZoom = 19.5;
        const rotationSpeed = 0.5; // degrees per frame
        let isRunning = true;

        // Prepare Map
        window.map.setOptions({ 
            gestureHandling: 'none',
            tilt: 0 // Reset first for smooth transition
        });
        window.map.panTo(center);

        function animate() {
            if (!isRunning) return;

            heading += rotationSpeed;
            if (heading > 360) heading -= 360;

            // Smoothly reach target tilt/zoom during rotation
            if (tilt < targetTilt) tilt += 0.5;
            if (zoom < targetZoom) zoom += 0.01;

            window.map.setOptions({
                heading: heading,
                tilt: tilt,
                zoom: zoom,
                center: center
            });

            requestAnimationFrame(animate);
        }

        // Start animation
        requestAnimationFrame(animate);

        // Add a "Stop" control
        const stopBtn = document.createElement('button');
        stopBtn.id = 'drone-stop-btn';
        stopBtn.innerHTML = '<i class="fas fa-stop"></i> PARAR VOO';
        stopBtn.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #ef4444;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 30px;
            font-weight: bold;
            z-index: 40000;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4);
            letter-spacing: 1px;
            animation: pulse-red 2s infinite;
        `;
        
        const style = document.createElement('style');
        style.innerHTML = `
            @keyframes pulse-red { 0% { transform: translateX(-50%) scale(1); } 50% { transform: translateX(-50%) scale(1.05); } 100% { transform: translateX(-50%) scale(1); } }
        `;
        document.head.appendChild(style);
        document.body.appendChild(stopBtn);

        stopBtn.onclick = () => {
            isRunning = false;
            window.map.setOptions({ 
                gestureHandling: 'greedy',
                heading: 0,
                tilt: 45,
                zoom: 19
            });
            stopBtn.remove();
            window.Toast.success("Voo finalizado.");
        };
    }

    /**
     * ELEVATION (Altimetria)
     * Fetches terrain height from Google Elevation Service.
     */
    async function getElevation(lat, lng) {
        if (!window.google || !window.google.maps.ElevationService) return null;
        
        const elevator = new google.maps.ElevationService();
        try {
            const response = await elevator.getElevationForLocations({
                locations: [{ lat, lng }]
            });
            if (response.results && response.results[0]) {
                return response.results[0].elevation.toFixed(1);
            }
        } catch (e) {
            // Ignorar erro do elevation (serviço bloqueado por quota/billing)
        }
        return null;
    }

    /**
     * WALKING DISTANCE (Tempo de Caminhada)
     * Estimates time using Google Distance Matrix.
     */
    async function getWalkingInfo(origin, destination) {
        if (!window.google || !window.google.maps.DistanceMatrixService) return null;
        
        const service = new google.maps.DistanceMatrixService();
        try {
            const response = await service.getDistanceMatrix({
                origins: [origin],
                destinations: [destination],
                travelMode: google.maps.TravelMode.WALKING,
                unitSystem: google.maps.UnitSystem.METRIC,
            });

            if (response.rows && response.rows[0].elements[0].status === "OK") {
                const element = response.rows[0].elements[0];
                return {
                    distance: element.distance.text,
                    duration: element.duration.text
                };
            }
        } catch (e) {
            console.error("Distance Matrix error:", e);
        }
        return null;
    }

    return {
        startDroneFlyover,
        getElevation,
        getWalkingInfo
    };
})();
