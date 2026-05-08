/**
 * MEDIA_HANDLER.JS
 * Manages external media sources (Google Places, Street View Static)
 * Bruno Giovani: Optimized for performance and smart fallbacks.
 */

window.MediaHandler = (function() {
    /**
     * getSmartPhoto: Prioritizes images by quality/relevance
     * 1. Local image_url / gallery (Database)
     * 3. Google Places Photos (Modern API)
     * 4. Street View Static Image (Automatic Heading)
     */
    async function getSmartPhoto(lote) {
        if (lote.image_url && lote.image_url.startsWith('http')) return lote.image_url;
        const gallery = normalizeMediaArray(lote.gallery);
        if (gallery.length > 0) return gallery[0];
        
        if (lote._googlePhotos && lote._googlePhotos.length > 0) return lote._googlePhotos[0];

        // If no google photos cached, try fetching
        const googlePhotos = await fetchGooglePhotos(lote);
        if (googlePhotos && googlePhotos.length > 0) return googlePhotos[0];

        // Fallback to Street View Static (now async for heading calculation)
        return await getStreetViewStaticUrl(lote);
    }

    function normalizeMediaArray(value) {
        if (!value) return [];
        if (Array.isArray(value)) return value.filter(Boolean);
        if (typeof value === 'string') {
            try {
                const parsed = JSON.parse(value);
                return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
            } catch (e) {
                return value.startsWith('http') ? [value] : [];
            }
        }
        return [];
    }

    /**
     * fetchGooglePhotos: Uses Modern Places API v1
     */
    async function fetchGooglePhotos(lote) {
        // Avoid redundant calls
        if (lote._googlePhotos) return lote._googlePhotos;

        try {
            if (!window.google || !window.google.maps) {
                console.warn('[MediaHandler] Google Maps API is not loaded. Cannot fetch Places photos.');
                return [];
            }
            // Load library properly
            const { Place } = await google.maps.importLibrary("places");
            
            const name = (lote.building_name || lote.nome_edificio || '').trim();
            const addr = (lote.logradouro || lote.endereco || '').trim();
            const num = (lote.numero || '').toString().trim();
            
            const meta = lote.metadata || {};
            const lat = parseFloat(lote._lat || lote.latitude || meta.latitude);
            const lng = parseFloat(lote._lng || lote.longitude || meta.longitude);

            if (!lat || !lng) return [];
            if (name.length < 2 && addr.length < 5) return [];

            const query = `${name} ${addr}, ${num} Guarujá SP`.replace(/\s+/g, ' ').trim();
            const request = {
                textQuery: query,
                fields: ['photos', 'id', 'displayName', 'formattedAddress'],
                locationBias: { 
                    center: { lat: lat, lng: lng },
                    radius: 300 
                }
            };
            
            const { places } = await Place.searchByText(request);
            const place = (places && places.length > 0) ? places[0] : null;

            if (place && place.photos && place.photos.length > 0) {
                const urls = place.photos.slice(0, 10).map(p => {
                    try {
                        if (typeof p.getURI === 'function') return p.getURI({ maxWidth: 1200, maxHeight: 800 });
                    } catch (e) { return null; }
                    return null;
                }).filter(Boolean);

                lote._googlePhotos = urls;
                return urls;
            }
        } catch (e) {
            console.error('[MediaHandler] Error fetching Places photos:', e);
        }

        lote._googlePhotos = [];
        return [];
    }

    /**
     * getStreetViewStaticUrl: Generates a static URL with optimized heading
     * points the camera from the nearest street point to the property.
     */
    async function getStreetViewStaticUrl(lote) {
        const meta = lote.metadata || {};
        const lat = parseFloat(lote._lat || lote.latitude || meta.latitude);
        const lng = parseFloat(lote._lng || lote.longitude || meta.longitude);
        if (!lat || !lng) return null;

        const key = window.CONFIG?.GOOGLE_MAPS_KEY || '';
        
        // Find nearest panorama to calculate heading
        const panoInfo = await verifyStreetView(lat, lng);
        let heading = 180; // Default fallback
        
        if (panoInfo && panoInfo.latLng) {
            // Calculate heading from panorama position to property position
            const panoLat = panoInfo.latLng.lat();
            const panoLng = panoInfo.latLng.lng();
            
            // Formula for heading between two points
            const y = Math.sin(lng - panoLng) * Math.cos(lat);
            const x = Math.cos(panoLat) * Math.sin(lat) -
                      Math.sin(panoLat) * Math.cos(lat) * Math.cos(lng - panoLng);
            heading = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
        }

        const pitch = 5;
        return `https://maps.googleapis.com/maps/api/streetview?size=1000x600&location=${lat},${lng}&fov=90&heading=${heading}&pitch=${pitch}&key=${key}`;
    }

    /**
     * verifyStreetView: Checks if a location has SV and returns pano metadata
     */
    async function verifyStreetView(lat, lng) {
        return new Promise((resolve) => {
            try {
                if (!window.google || !window.google.maps) {
                    return resolve(null);
                }
                const service = new google.maps.StreetViewService();
                service.getPanorama({ location: { lat, lng }, radius: 50 }, (data, status) => {
                    if (status === "OK" && data && data.location) {
                        resolve(data.location);
                    } else {
                        resolve(null);
                    }
                });
            } catch (error) {
                console.warn("[MediaHandler] StreetViewService error:", error);
                resolve(null);
            }
        });
    }

    return {
        fetchGooglePhotos,
        getSmartPhoto,
        getStreetViewStaticUrl,
        verifyStreetView
    };
})();
