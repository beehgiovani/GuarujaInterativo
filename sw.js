const CACHE_NAME = 'guarugeo-cache-v2.0';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './css/layout.css',
    './css/sidebar_styles.css',
    './css/map_styles.css',
    './css/overlays_styles.css',
    './css/neighborhood_styles.css',
    './css/editor_styles.css',
    './css/premium_styles.css',
    './css/analytics_styles.css',
    './css/carousel_styles.css',
    './css/modal_styles.css',
    './css/toast_styles.css',
    './css/crm_styles.css',
    './css/ai_chat_styles.css',
    './css/mobile_styles.css',
    './css/image_viewer.css',
    './css/introjs.min.css',
    './css/onboarding_styles.css',
    './css/anuncios_styles.css',
    './css/hub_styles.css',
    './assets/logo_v2.png',
    
    // Core JS Logic
    './js/hub_handler.js',
    './js/app.js',
    './js/utils.js',
    './js/map_handler.js',
    './js/tooltip_handler.js',
    './js/search_handler.js',
    './js/neighborhood_handler.js',
    './js/solar_handler.js',
    './js/osm_handler.js',
    './js/client_mode_handler.js',
    './js/google_maps_loader.js',
    './js/monetization_handler.js',
    './js/admin_handler.js',
    './js/enrichment_handler.js',
    './js/anuncios_handler.js',

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

