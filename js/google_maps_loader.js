/**
 * GOOGLE_MAPS_LOADER.JS
 * Dynamically loads Google Maps API with vector-map defaults.
 */

window.GoogleMapsConfig = {
    API_KEY: window.CONFIG.GOOGLE_MAPS_KEY,
    MAP_ID: window.CONFIG.GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID',
    VERSION: window.CONFIG.GOOGLE_MAPS_VERSION || '3.65',
    LIBRARIES: ['maps', 'marker', 'geometry']
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
            const params = new URLSearchParams({
                key: window.GoogleMapsConfig.API_KEY,
                v: window.GoogleMapsConfig.VERSION,
                libraries: window.GoogleMapsConfig.LIBRARIES.join(','),
                callback: 'onGoogleMapsLoaded',
                loading: 'async'
            });

            if (window.GoogleMapsConfig.MAP_ID) {
                params.set('map_ids', window.GoogleMapsConfig.MAP_ID);
            }

            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
            script.async = true;
            script.defer = true;

            window.onGoogleMapsLoaded = () => {
                console.log(`Google Maps API loaded v${window.GoogleMapsConfig.VERSION}`);
                isLoading = false;
                resolve(window.google.maps);
            };

            script.onerror = () => {
                console.error('Failed to load Google Maps API');
                isLoading = false;
                loadPromise = null;
                reject(new Error('Google Maps load failed'));
            };

            document.head.appendChild(script);
        });

        return loadPromise;
    };
})();

window.loadGoogleMapsLibrary = async function(libraryName) {
    await window.loadGoogleMaps();
    return google.maps.importLibrary(libraryName);
};

window.loadGoogleMaps3D = function() {
    return window.loadGoogleMapsLibrary('maps3d');
};
