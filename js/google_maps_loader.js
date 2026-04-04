/**
 * GOOGLE_MAPS_LOADER.JS
 * Dynamically loads Google Maps API with 3D support
 */

window.GoogleMapsConfig = {

    API_KEY: window.CONFIG.GOOGLE_MAPS_KEY, // Lendo do arquivo de configuração seguro
    MAP_ID: null, // Desativado fotorrealismo 3D temporariamente
    VERSION: 'weekly' // Canal semanal estável
};

window.loadGoogleMaps = (function() {
    let isLoading = false;
    let loadPromise = null;

    return function() {
        if (window.google && window.google.maps) {
            return Promise.resolve(window.google.maps);
        }

        if (isLoading) {
            return loadPromise;
        }

        isLoading = true;
        loadPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            // Removemos maps3d e places daqui para carregar via importLibrary e evitar o erro 'Ea'
            script.src = `https://maps.googleapis.com/maps/api/js?key=${window.GoogleMapsConfig.API_KEY}&v=${window.GoogleMapsConfig.VERSION}&libraries=marker,visualization,drawing,geometry&callback=onGoogleMapsLoaded&loading=async`;
            script.async = true;
            script.defer = true;
            
            window.onGoogleMapsLoaded = () => {
                console.log("✅ Google Maps API Loaded");
                isLoading = false;
                resolve(window.google.maps);
            };

            script.onerror = () => {
                console.error("❌ Failed to load Google Maps API");
                isLoading = false;
                loadPromise = null;
                reject(new Error("Google Maps load failed"));
            };

            document.head.appendChild(script);
        });

        return loadPromise;
    };
})();
