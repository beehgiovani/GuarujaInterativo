/**
 * MEDIA_HANDLER.JS
 * Manages external media sources (Google Places, etc)
 */

window.MediaHandler = (function() {
    let placesService = null;

    function initService() {
        if (!placesService && window.google && window.google.maps) {
            placesService = new google.maps.places.PlacesService(window.map);
        }
        return placesService;
    }

    /**
     * Fetch photos for a lot using name and address
     */
    async function fetchGooglePhotos(lote) {
        if (!initService()) return [];

        // Avoid redundant calls if already fetched
        if (lote._googlePhotos) {
            console.log(`[MediaHandler] Using cached photos for ${lote.inscricao}`);
            return lote._googlePhotos;
        }

        const runQuery = (q) => {
            return new Promise((resolve) => {
                const request = {
                    query: q,
                    fields: ['photos', 'place_id', 'name', 'formatted_address'],
                    locationBias: { 
                        lat: parseFloat(lote._lat), 
                        lng: parseFloat(lote._lng) 
                    }
                };
                
                placesService.findPlaceFromQuery(request, (results, status) => {
                    if (status === google.maps.places.PlacesServiceStatus.OK && results && results[0]) {
                        resolve(results[0]);
                    } else {
                        resolve(null);
                    }
                });
            });
        };

        const name = (lote.building_name || lote.nome_edificio || '').trim();
        
        // Smarter Address Resolution (mirroring tooltip_handler.js)
        let addr = (lote.logradouro || lote.endereco || '').trim();
        let num = (lote.numero || '').toString().trim();

        // 1. Fallback to first unit if lot address is missing/empty
        if ((!addr || addr.length < 3) && lote.unidades && lote.unidades.length > 0) {
            const u = lote.unidades[0];
            if (u.logradouro) addr = u.logradouro.trim();
            if (u.numero) num = u.numero.toString().trim();
            console.log(`[MediaHandler] Using unit address for ${lote.inscricao}: ${addr}, ${num}`);
        }

        // Combine Address + Number
        if (addr && num) addr = `${addr}, ${num}`;

        // Guard: If we still have no name and no address, ABORT.
        // Prevents searching "Guarujá SP" and getting a generic city photo.
        if (name.length < 2 && addr.length < 5) {
             console.warn(`[MediaHandler] Skipping photo fetch for ${lote.inscricao} - Insufficient data (No name/address)`);
             lote._googlePhotos = [];
             return [];
        }
        
        // Strategy 1: Name + Address
        let q1 = `${name} ${addr} Guarujá SP`.trim();
        
        // Cleanup double spaces
        q1 = q1.replace(/\s+/g, ' ');

        console.log(`[MediaHandler] Strategy 1: ${q1}`);
        let place = await runQuery(q1);

        // Strategy 2: Just Name (often better for landmarks)
        if (!place && name.length > 3) {
            const q2 = `${name} Guarujá SP`.trim();
            console.log(`[MediaHandler] Strategy 2: ${q2}`);
            place = await runQuery(q2);
        }

        // Strategy 3: Just Address (if name logic failed)
        if (!place && addr.length > 5) {
            const q3 = `${addr} Guarujá SP`.trim();
            console.log(`[MediaHandler] Strategy 3: ${q3}`);
            place = await runQuery(q3);
        }

        if (place && place.photos && place.photos.length > 0) {
            const urls = place.photos.slice(0, 15).map(p => p.getUrl({ maxWidth: 1200, maxHeight: 800 }));
            lote._googlePhotos = urls;
            console.log(`[MediaHandler] Success! Found ${urls.length} photos for ${place.name} at ${place.formatted_address}`);
            return urls;
        }

        console.warn(`[MediaHandler] No photos found for ${lote.inscricao}`);
        lote._googlePhotos = [];
        return [];
    }

    return {
        fetchGooglePhotos
    };
})();
