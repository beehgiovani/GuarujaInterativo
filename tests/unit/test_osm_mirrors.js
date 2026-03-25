const mirrors = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter',
    'https://overpass.openstreetmap.ru/api/interpreter'
];

const lat = -23.9935;
const lng = -46.2570;
const query = `
    [out:json][timeout:10];
    (
      node["amenity"~"school|pharmacy"](around:400,${lat},${lng});
    );
    out body;
`;

async function testMirrors() {
    console.log("🧪 Testing OSM Overpass Mirrors...");
    
    for (const url of mirrors) {
        console.log(`📡 Checking ${url}...`);
        const start = Date.now();
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            
            const response = await fetch(url + '?data=' + encodeURIComponent(query), {
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const data = await response.json();
                console.log(`✅ Success in ${Date.now() - start}ms. Found ${data.elements.length} elements.`);
            } else {
                console.log(`❌ Failed with status ${response.status} in ${Date.now() - start}ms.`);
            }
        } catch (e) {
            console.log(`❌ Error: ${e.message} in ${Date.now() - start}ms.`);
        }
    }
}

testMirrors();
