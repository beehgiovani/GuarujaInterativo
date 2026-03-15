/**
 * OSM_HANDLER.JS
 * Fetches neighborhood context (POIs) from OpenStreetMap via Overpass API.
 * Adds context like "Schools nearby", "Bakeries", etc.
 */

window.OSMHandler = (function() {
    
    const CACHE = {}; // Simple memory cache
    
    async function fetchPOIs(lat, lng, containerId) {
        const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
        const container = document.getElementById(containerId);
        if (!container) return;

        // Check Cache
        if (CACHE[cacheKey]) {
            renderWidget(CACHE[cacheKey], container);
            return;
        }

        // Loading UI
        container.innerHTML = `
            <div style="padding: 12px; text-align: center; color: #64748b; font-size: 11px;">
                <i class="fas fa-spinner fa-spin"></i> Buscando vizinhança...
            </div>
        `;

        try {
            // Overpass Query: 500m radius
            // We look for: Schools, Pharmacies, Bakeries, Supermarkets/Convenience, Restaurants
            const query = `
                [out:json][timeout:10];
                (
                  node["amenity"~"school|pharmacy|bakery|restaurant|cafe|marketplace"](around:400,${lat},${lng});
                  way["amenity"~"school|pharmacy|bakery|restaurant|cafe|marketplace"](around:400,${lat},${lng});
                  node["shop"~"supermarket|convenience|bakery"](around:400,${lat},${lng});
                );
                out body;
                >;
                out skel qt;
            `;

            const url = 'https://overpass-api.de/api/interpreter';
            const body = `data=${encodeURIComponent(query)}`;

            const response = await fetch(url, {
                method: 'POST',
                body: body
            });

            if (!response.ok) throw new Error('OSM Error');

            const data = await response.json();
            const elements = data.elements || [];

            // Process Data
            const pois = processElements(elements, lat, lng);
            CACHE[cacheKey] = pois;
            
            renderWidget(pois, container);

        } catch (e) {
            console.error('OSM Fetch Error:', e);
            container.innerHTML = `
                <div style="padding: 12px; text-align: center; color: #94a3b8; font-size: 10px;">
                    <i class="fas fa-wifi"></i> Não foi possível carregar a vizinhança.
                </div>
            `;
        }
    }

    function processElements(elements, centerLat, centerLng) {
        const groups = {
            'school': { label: 'Escolas', icon: 'fa-graduation-cap', count: 0, items: [] },
            'pharmacy': { label: 'Farmácias', icon: 'fa-notes-medical', count: 0, items: [] },
            'bakery': { label: 'Padarias', icon: 'fa-bread-slice', count: 0, items: [] },
            'supermarket': { label: 'Mercados', icon: 'fa-shopping-basket', count: 0, items: [] },
            'restaurant': { label: 'Restaurantes', icon: 'fa-utensils', count: 0, items: [] },
            'cafe': { label: 'Cafés', icon: 'fa-coffee', count: 0, items: [] }
        };

        elements.forEach(el => {
            const tags = el.tags || {};
            const type = tags.amenity || tags.shop;
            
            // Validate Name
            if (!tags.name) return;

            let cat = null;
            if (type === 'school' || type === 'kindergarten') cat = 'school';
            else if (type === 'pharmacy') cat = 'pharmacy';
            else if (type === 'bakery') cat = 'bakery';
            else if (type === 'supermarket' || type === 'convenience') cat = 'supermarket';
            else if (type === 'restaurant') cat = 'restaurant';
            else if (type === 'cafe') cat = 'cafe';

            if (cat && groups[cat]) {
                groups[cat].count++;
                // Calculate distance if node
                if (el.lat && el.lon) {
                    const d = getDist(centerLat, centerLng, el.lat, el.lon);
                    groups[cat].items.push({ name: tags.name, dist: d });
                } else {
                    groups[cat].items.push({ name: tags.name, dist: 0 }); // ways handling simplified
                }
            }
        });

        return groups;
    }

    function renderWidget(groups, container) {
        let html = `
            <div style="margin-top: 10px; border-top: 1px dashed #e2e8f0; paddingTop: 12px;">
                <div style="font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; margin-bottom: 8px;">
                    📍 Vizinhança (Raio 400m)
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
        `;

        let hasData = false;

        Object.keys(groups).forEach(key => {
            const g = groups[key];
            if (g.count > 0) {
                hasData = true;
                // Get closest item name
                g.items.sort((a,b) => a.dist - b.dist);
                const closest = g.items[0];
                const distStr = closest.dist > 0 ? `aprox. ${Math.round(closest.dist)}m` : 'perto';

                html += `
                    <div style="background: #f8fafc; padding: 6px 10px; border-radius: 6px; border: 1px solid #f1f5f9; display: flex; align-items: center; gap: 8px;">
                        <i class="fas ${g.icon}" style="color: #64748b; font-size: 12px; width: 14px; text-align: center;"></i>
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-size: 11px; font-weight: 600; color: #334155;">${g.count} ${g.label}</div>
                            <div style="font-size: 9px; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                ${closest.name} (${distStr})
                            </div>
                        </div>
                    </div>
                `;
            }
        });

        html += `</div></div>`;

        if (!hasData) {
            container.innerHTML = `
                <div style="padding: 10px; text-align: center; color: #94a3b8; font-size: 10px; border-top: 1px dashed #e2e8f0; margin-top: 10px;">
                    Nenhum ponto de interesse relevante encontrado nesta proximidade.
                </div>
            `;
        } else {
            container.innerHTML = html;
        }
    }

    // Helper: Haversine distance in meters
    function getDist(lat1, lon1, lat2, lon2) {
        const R = 6371e3; 
        const φ1 = lat1 * Math.PI/180; 
        const φ2 = lat2 * Math.PI/180;
        const Δφ = (lat2-lat1) * Math.PI/180;
        const Δλ = (lon2-lon1) * Math.PI/180;
        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    return {
        fetchPOIs
    };
})();
