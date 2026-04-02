const CACHE_NAME = 'guarugeo-cache-v1.5';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './layout.css',
    './sidebar_styles.css',
    './map_styles.css',
    './overlays_styles.css',
    './neighborhood_styles.css',
    './editor_styles.css',
    './premium_styles.css',
    './analytics_styles.css',
    './carousel_styles.css',
    './modal_styles.css',
    './toast_styles.css',
    './crm_styles.css',
    './ai_chat_styles.css',
    './mobile_styles.css',
    './image_viewer.css',
    './introjs.min.css',
    './onboarding_styles.css',
    './logo.png',
    
    // Core JS Logic
    './app.js',
    './utils.js',
    './map_handler.js',
    './tooltip_handler.js',
    './search_handler.js',
    './neighborhood_handler.js',
    './history_handler.js',
    './solar_handler.js',
    './osm_handler.js',
    './client_mode_handler.js',
    './google_maps_loader.js',
    './google_earth_handler.js',
    './monetization_handler.js',
    './admin_handler.js',
    './enrichment_handler.js',
    './anuncios/anuncios_styles.css',
    './anuncios/anuncios_handler.js',

    // External Libs
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
    'https://unpkg.com/@turf/turf/turf.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/suncalc/1.9.0/suncalc.min.js'
];

self.addEventListener('install', (event) => {
    // We don't skipWaiting() automatically anymore to allow user to save work
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Caching app shell');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});


self.addEventListener('activate', (event) => {
    event.waitUntil(
        Promise.all([
            // Clean up old caches
            caches.keys().then((keyList) => {
                return Promise.all(keyList.map((key) => {
                    if (key !== CACHE_NAME) {
                        console.log('[Service Worker] Removing old cache', key);
                        return caches.delete(key);
                    }
                }));
            }),
            // Take control of all pages immediately
            self.clients.claim()
        ])
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    if (event.request.url.includes('supabase.co') || event.request.url.includes('googleapis.com')) return;

    // Special logic for the big JSON - Cache First
    if (event.request.url.includes('lotes_merged.json')) {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) return cachedResponse;
                return fetch(event.request).then((networkResponse) => {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
                    return networkResponse;
                });
            })
        );
        return;
    }

    // Default strategy: Stale-While-Revalidate
    event.respondWith(
        caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch((err) => {
                if (cachedResponse) return cachedResponse;
                return new Response('Network error occurred', { status: 503, headers: { 'Content-Type': 'text/plain' } });
            });

            return cachedResponse || fetchPromise;
        })
    );
});

// Listener for manual update triggering from index.html
self.addEventListener('message', (event) => {
    if (event.data === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

