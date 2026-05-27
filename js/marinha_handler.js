/**
 * MarinhaHandler.js - Motor de Jurisdicao SPU (v2.1)
 *
 * Identifica indicios de terreno de marinha por RIP cadastrado e por
 * proximidade geografica estimada da costa. O calculo geografico nao substitui
 * a linha oficial da SPU nem a certidao patrimonial.
 */

window.MarinhaHandler = {
    state: {
        isActive: false,
        marineLots: new Map() // inscricao -> { hasRip, distanceToSea, withinBuffer, reason }
    },

    // Linhas estimadas da costa do Guaruja (WGS84). Mantemos praias separadas
    // para nao criar segmentos artificiais atravessando morros/canais.
    COASTLINE_PATHS: [
        [
            { lat: -23.9935, lng: -46.2710 }, // Guaiuba W
            { lat: -23.9955, lng: -46.2688 }  // Guaiuba E
        ],
        [
            { lat: -23.9970, lng: -46.2620 }, // Pitangueiras W
            { lat: -23.9985, lng: -46.2595 }, // Pitangueiras central
            { lat: -23.9993, lng: -46.2584 }  // Pitangueiras E
        ],
        [
            { lat: -24.0040, lng: -46.2660 }, // Asturias N
            { lat: -24.0060, lng: -46.2680 }, // Asturias central
            { lat: -24.0074, lng: -46.2676 }  // Asturias S
        ],
        [
            { lat: -24.0085, lng: -46.2700 }, // Tombo N
            { lat: -24.0105, lng: -46.2720 }, // Tombo central
            { lat: -24.0120, lng: -46.2730 }  // Tombo S
        ],
        [
            { lat: -23.9850, lng: -46.2450 }, // Enseada N
            { lat: -23.9810, lng: -46.2390 },
            { lat: -23.9780, lng: -46.2330 },
            { lat: -23.9760, lng: -46.2270 },
            { lat: -23.9740, lng: -46.2210 }  // Enseada S
        ],
        [
            { lat: -23.9690, lng: -46.2170 }, // Pernambuco N
            { lat: -23.9660, lng: -46.2140 }  // Pernambuco central
        ],
        [
            { lat: -23.9580, lng: -46.2080 }, // Pereque N
            { lat: -23.9560, lng: -46.2050 }  // Pereque S
        ]
    ],

    MARINE_BUFFER_M: 33,

    get COASTLINE_POINTS() {
        return this.COASTLINE_PATHS.flat();
    },

    utmToLatLng: function(easting, northing) {
        const converter = window.utmToLatLon || window.utmToLatLng;
        if (typeof converter === 'function' && converter !== this.utmToLatLng) {
            try {
                const converted = converter(easting, northing);
                if (converted?.lat != null && converted?.lng != null) {
                    return { lat: Number(converted.lat), lng: Number(converted.lng) };
                }
            } catch (error) {
                console.warn('MarinhaHandler: conversor UTM global falhou, usando fallback local.', error);
            }
        }

        // Fallback UTM Zona 23S (SRID 32723) -> WGS84.
        const a = 6378137.0;
        const e = 0.0818191908;
        const k0 = 0.9996;
        const E0 = 500000;
        const N0 = 10000000;
        const lng0 = -45.0;

        const N = Number(northing) - N0;
        const E = Number(easting) - E0;
        const mu = (N / k0) / (a * (1 - e * e / 4 - 3 * e ** 4 / 64));

        const e1 = (1 - Math.sqrt(1 - e * e)) / (1 + Math.sqrt(1 - e * e));
        const phi1 = mu
            + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu)
            + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu)
            + (151 * e1 ** 3 / 96) * Math.sin(6 * mu);

        const N1 = a / Math.sqrt(1 - e * e * Math.sin(phi1) ** 2);
        const T1 = Math.tan(phi1) ** 2;
        const C1 = e * e / (1 - e * e) * Math.cos(phi1) ** 2;
        const R1 = a * (1 - e * e) / Math.pow(1 - e * e * Math.sin(phi1) ** 2, 1.5);
        const D = E / (N1 * k0);

        const lat = phi1 - (N1 * Math.tan(phi1) / R1) * (
            D ** 2 / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * e * e / (1 - e * e)) * D ** 4 / 24
        );
        const lng = lng0 * Math.PI / 180 + (
            D - (1 + 2 * T1 + C1) * D ** 3 / 6
        ) / Math.cos(phi1);

        return { lat: lat * 180 / Math.PI, lng: lng * 180 / Math.PI };
    },

    haversineM: function(p1, p2) {
        const R = 6371000;
        const toRad = x => x * Math.PI / 180;
        const dLat = toRad(p2.lat - p1.lat);
        const dLng = toRad(p2.lng - p1.lng);
        const a = Math.sin(dLat / 2) ** 2
            + Math.cos(toRad(p1.lat)) * Math.cos(toRad(p2.lat)) * Math.sin(dLng / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    },

    getLotBounds: function(lote) {
        const bounds = lote?.bounds_utm || lote?.bounds || lote;
        const minx = Number(bounds?.minx);
        const miny = Number(bounds?.miny);
        const maxx = Number(bounds?.maxx);
        const maxy = Number(bounds?.maxy);

        if (![minx, miny, maxx, maxy].every(Number.isFinite)) return null;
        return { minx, miny, maxx, maxy };
    },

    projectToMeters: function(point, origin) {
        const R = 6371000;
        const toRad = x => x * Math.PI / 180;
        return {
            x: toRad(point.lng - origin.lng) * R * Math.cos(toRad(origin.lat)),
            y: toRad(point.lat - origin.lat) * R
        };
    },

    distanceToSegmentM: function(point, a, b) {
        const p = this.projectToMeters(point, point);
        const pa = this.projectToMeters(a, point);
        const pb = this.projectToMeters(b, point);
        const dx = pb.x - pa.x;
        const dy = pb.y - pa.y;
        const lengthSq = dx * dx + dy * dy;

        if (lengthSq === 0) return this.haversineM(point, a);

        const t = Math.max(0, Math.min(1, ((p.x - pa.x) * dx + (p.y - pa.y) * dy) / lengthSq));
        const closest = { x: pa.x + t * dx, y: pa.y + t * dy };
        return Math.hypot(p.x - closest.x, p.y - closest.y);
    },

    distanceToCoastline: function(point) {
        if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return Infinity;

        let minDist = Infinity;

        this.COASTLINE_PATHS.forEach(path => {
            for (let i = 0; i < path.length - 1; i++) {
                minDist = Math.min(minDist, this.distanceToSegmentM(point, path[i], path[i + 1]));
            }
        });

        // Fallback importante para caminhos com poucos pontos ou extremidades.
        this.COASTLINE_POINTS.forEach(cp => {
            minDist = Math.min(minDist, this.haversineM(point, cp));
        });

        return minDist;
    },

    getLotCenter: function(lote) {
        const bounds = this.getLotBounds(lote);

        if (bounds) {
            return this.utmToLatLng((bounds.minx + bounds.maxx) / 2, (bounds.miny + bounds.maxy) / 2);
        }

        const lat = Number(lote?.lat);
        const lng = Number(lote?.lng);
        if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };

        return null;
    },

    getLotReferencePoints: function(lote) {
        const points = [];
        const center = this.getLotCenter(lote);
        if (center) points.push(center);

        const bounds = this.getLotBounds(lote);

        if (bounds) {
            [
                [bounds.minx, bounds.miny],
                [bounds.minx, bounds.maxy],
                [bounds.maxx, bounds.miny],
                [bounds.maxx, bounds.maxy]
            ].forEach(([x, y]) => {
                const point = this.utmToLatLng(x, y);
                if (point && Number.isFinite(point.lat) && Number.isFinite(point.lng)) points.push(point);
            });
        }

        return points;
    },

    distanceToLotCoastline: function(lote) {
        const points = this.getLotReferencePoints(lote);
        if (!points.length) return null;

        const minDist = points.reduce((min, point) => {
            return Math.min(min, this.distanceToCoastline(point));
        }, Infinity);

        return Number.isFinite(minDist) ? minDist : null;
    },

    getRipUnits: function(lote) {
        return lote?.unidades?.filter(u => String(u?.rip || '').trim() !== '') || [];
    },

    buildMarineInfo: function(lote) {
        const hasRip = this.getRipUnits(lote).length > 0;
        const rawDistance = this.distanceToLotCoastline(lote);
        const distanceToSea = rawDistance === null ? null : Math.round(rawDistance);
        const withinBuffer = distanceToSea !== null && distanceToSea <= this.MARINE_BUFFER_M;

        if (!hasRip && !withinBuffer) return null;

        return {
            hasRip,
            distanceToSea,
            withinBuffer,
            distanceMethod: 'lot_bounds_to_segmented_coastline',
            reason: hasRip && withinBuffer
                ? 'RIP cadastrado + faixa estimada de 33m'
                : hasRip
                    ? 'RIP cadastrado (SPU)'
                    : `Faixa estimada de ${distanceToSea}m da costa`
        };
    },

    analyzeMarineAreas: function(allLotes) {
        console.log('MarinhaHandler: analisando indicios SPU (RIP + distancia estimada)...');
        this.state.marineLots.clear();

        allLotes.forEach(lote => {
            const info = this.buildMarineInfo(lote);
            if (info) this.state.marineLots.set(lote.inscricao, info);
        });

        console.log(`MarinhaHandler: ${this.state.marineLots.size} lotes com indicio de area/SPU.`);
    },

    isMarineLot: function(lote) {
        if (this.state.marineLots.has(lote.inscricao)) return true;
        return Boolean(this.buildMarineInfo(lote));
    },

    toggleLayer: function() {
        this.state.isActive = !this.state.isActive;

        if (this.state.isActive) {
            window.Toast?.info('Camada de Marinha ativada. Lotes com indicio SPU destacados em azul.');
            this.highlightMarineLots();
        } else {
            window.Toast?.info('Camada de Marinha desativada.');
            this.clearHighlight();
        }
    },

    highlightMarineLots: function() {
        if (!window.map || !window.MapHandler?.applyFilter) return;
        window.MapHandler.applyFilter(
            lote => this.state.marineLots.has(lote.inscricao),
            { fillColor: '#004a99', fillOpacity: 0.6, weight: 2, color: '#ffffff' }
        );
    },

    clearHighlight: function() {
        window.MapHandler?.resetStyles?.();
    },

    getMarineExplanation: function(lote) {
        const info = this.state.marineLots.get(lote.inscricao) || this.buildMarineInfo(lote);
        if (!info) return null;

        const distLabel = info.distanceToSea !== null
            ? `<span style="font-weight:700; color:#1d4ed8;">${info.distanceToSea}m</span> da linha de costa estimada`
            : 'Distancia nao calculada';

        const paragraph = info.withinBuffer
            ? `Este imovel esta dentro da faixa geografica estimada de ${this.MARINE_BUFFER_M}m da costa.`
            : 'Este imovel possui indicio documental/operacional de SPU, mas a distancia geografica estimada nao confirma sozinha a faixa legal.';

        const ripBadge = info.hasRip
            ? '<li><strong>RIP:</strong> Registro Imobiliario Patrimonial identificado nas unidades.</li>'
            : '';

        const distBadge = info.withinBuffer
            ? `<li><strong>Posicao:</strong> Dentro da faixa estimada de ${this.MARINE_BUFFER_M}m (${distLabel}).</li>`
            : (info.distanceToSea !== null
                ? `<li><strong>Proximidade:</strong> ${distLabel} - verificar certidao SPU.</li>`
                : '');

        return `
            <div class="marine-info-box">
                <div class="marine-header">
                    <i class="fas fa-anchor"></i>
                    <span>AREA DE MARINHA / SPU</span>
                    <span style="margin-left: auto; font-size: 10px; color: #93c5fd; background: rgba(255,255,255,0.1); padding: 2px 8px; border-radius: 20px;">${info.reason}</span>
                </div>
                <div class="marine-body">
                    <p>${paragraph} A referencia legal e a faixa de ${this.MARINE_BUFFER_M}m a partir da preamar media de 1831.</p>
                    <ul>
                        <li><strong>Laudemio:</strong> 5% sobre o valor da transacao em caso de venda, quando aplicavel.</li>
                        <li><strong>Regime:</strong> Pode estar sujeito a Foro ou Taxa de Ocupacao anual perante a SPU.</li>
                        ${ripBadge}
                        ${distBadge}
                    </ul>
                    <div class="marine-footer">
                        *Dados informativos. Calculo estimativo por linha de costa vetorial e bounds UTM; consulte certidao e linha oficial da SPU para confirmacao legal.
                    </div>
                </div>
            </div>
        `;
    }
};

window.toggleMarinhaLayer = () => window.MarinhaHandler.toggleLayer();
window.isMarineLot = (lote) => window.MarinhaHandler.isMarineLot(lote);

console.log('MarinhaHandler v2.1 carregado - RIP + distancia estimada por segmentos da costa.');
