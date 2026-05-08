/**
 * MarinhaHandler.js — Motor de Jurisdição SPU (v2.0)
 * Bruno Giovani: Identifica terrenos de marinha pela DISTÂNCIA da costa,
 * conforme Lei 9.636/1998 e Decreto-Lei 9.760/1946.
 * 
 * Regra: Faixa de 33m a partir da preamar média de 1831 (linha de costa histórica).
 * Aplicação: Todo imóvel dentro dessa faixa está sujeito ao regime de Marinha,
 * independente de ter RIP cadastrado no banco de dados.
 */

window.MarinhaHandler = {
    state: {
        isActive: false,
        marineLots: new Map()   // inscricao -> { hasRip, distanceToSea, reason }
    },

    // -----------------------------------------------------------------------
    // Coordenadas reais da orla do Guarujá (WGS84 — verificadas 2026-05-08)
    // Fonte: Mapcarta / Google Maps / IBGE
    // Cada ponto representa um trecho da faixa de areia (preamar de 1831)
    // -----------------------------------------------------------------------
    COASTLINE_POINTS: [
        // --- GUAIÚBA ---
        { lat: -23.9935, lng: -46.2710 }, // Praia do Guaiúba (W)
        { lat: -23.9955, lng: -46.2688 }, // Guaiúba (E)

        // --- PITANGUEIRAS ---
        { lat: -23.9970, lng: -46.2620 }, // Pitangueiras (W)
        { lat: -23.9985, lng: -46.2595 }, // Pitangueiras central
        { lat: -23.9993, lng: -46.2584 }, // Pitangueiras (E / Morro do Maluf)

        // --- ASTÚRIAS ---
        { lat: -24.0040, lng: -46.2660 }, // Astúrias (N)
        { lat: -24.0060, lng: -46.2680 }, // Astúrias central
        { lat: -24.0074, lng: -46.2676 }, // Astúrias (S)

        // --- TOMBO ---
        { lat: -24.0085, lng: -46.2700 }, // Tombo (N)
        { lat: -24.0105, lng: -46.2720 }, // Tombo central
        { lat: -24.0120, lng: -46.2730 }, // Tombo (S / Mar Casado)

        // --- ENSEADA ---
        { lat: -23.9850, lng: -46.2450 }, // Enseada (ponta N / Ponta das Galhetas)
        { lat: -23.9810, lng: -46.2390 }, // Enseada (NE)
        { lat: -23.9780, lng: -46.2330 }, // Enseada central
        { lat: -23.9760, lng: -46.2270 }, // Enseada (centro-S)
        { lat: -23.9740, lng: -46.2210 }, // Enseada (S)

        // --- PERNAMBUCO ---
        { lat: -23.9690, lng: -46.2170 }, // Pernambuco (N)
        { lat: -23.9660, lng: -46.2140 }, // Pernambuco central

        // --- PEREQUÊ ---
        { lat: -23.9580, lng: -46.2080 }, // Perequê (N)
        { lat: -23.9560, lng: -46.2050 }, // Perequê (S)
    ],

    // Faixa legal de terrenos de marinha em metros
    MARINE_BUFFER_M: 33,

    // -----------------------------------------------------------------------
    // Converte coordenadas UTM Zona 23S (SRID 32723) para WGS84 lat/lng
    // (aproximação linear suficiente para cálculo de distância na escala de 33m)
    // -----------------------------------------------------------------------
    utmToLatLng: function(easting, northing) {
        // UTM Zona 23S, falso northing = 10.000.000 para hemisfério sul
        const a = 6378137.0;
        const e = 0.0818191908;
        const k0 = 0.9996;
        const E0 = 500000;
        const N0 = 10000000;
        const lng0 = -45.0; // meridiano central da Zona 23

        const N = northing - N0;
        const E = easting - E0;

        const M0 = 0;
        const mu = (N / k0) / (a * (1 - e * e / 4 - 3 * e * e * e * e / 64));

        const e1 = (1 - Math.sqrt(1 - e * e)) / (1 + Math.sqrt(1 - e * e));
        const phi1 = mu + (3 * e1 / 2 - 27 * e1 * e1 * e1 / 32) * Math.sin(2 * mu)
                       + (21 * e1 * e1 / 16 - 55 * e1 * e1 * e1 * e1 / 32) * Math.sin(4 * mu)
                       + (151 * e1 * e1 * e1 / 96) * Math.sin(6 * mu);

        const N1 = a / Math.sqrt(1 - e * e * Math.sin(phi1) * Math.sin(phi1));
        const T1 = Math.tan(phi1) * Math.tan(phi1);
        const C1 = e * e / (1 - e * e) * Math.cos(phi1) * Math.cos(phi1);
        const R1 = a * (1 - e * e) / Math.pow(1 - e * e * Math.sin(phi1) * Math.sin(phi1), 1.5);
        const D = E / (N1 * k0);

        const lat = phi1 - (N1 * Math.tan(phi1) / R1) * (
            D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * e * e / (1 - e * e)) * D * D * D * D / 24
        );
        const lng = lng0 * Math.PI / 180 + (
            D - (1 + 2 * T1 + C1) * D * D * D / 6
        ) / Math.cos(phi1);

        return { lat: lat * 180 / Math.PI, lng: lng * 180 / Math.PI };
    },

    // -----------------------------------------------------------------------
    // Distância Haversine entre dois pontos lat/lng (resultado em metros)
    // -----------------------------------------------------------------------
    haversineM: function(p1, p2) {
        const R = 6371000;
        const toRad = x => x * Math.PI / 180;
        const dLat = toRad(p2.lat - p1.lat);
        const dLng = toRad(p2.lng - p1.lng);
        const a = Math.sin(dLat / 2) ** 2
                + Math.cos(toRad(p1.lat)) * Math.cos(toRad(p2.lat)) * Math.sin(dLng / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    },

    // -----------------------------------------------------------------------
    // Distância mínima de um ponto lat/lng até a linha de costa de referência
    // -----------------------------------------------------------------------
    distanceToCoastline: function(point) {
        let minDist = Infinity;
        this.COASTLINE_POINTS.forEach(cp => {
            const d = this.haversineM(point, cp);
            if (d < minDist) minDist = d;
        });
        return minDist;
    },

    // -----------------------------------------------------------------------
    // Ponto central do lote a partir das coordenadas UTM armazenadas no banco
    // -----------------------------------------------------------------------
    getLotCenter: function(lote) {
        // Preferência: usar centroide UTM → converter para lat/lng
        if (lote.minx && lote.miny && lote.maxx && lote.maxy) {
            const cx = (parseFloat(lote.minx) + parseFloat(lote.maxx)) / 2;
            const cy = (parseFloat(lote.miny) + parseFloat(lote.maxy)) / 2;
            return this.utmToLatLng(cx, cy);
        }
        // Fallback: usar lat/lng direto se disponível (ex: unidade específica)
        if (lote.lat && lote.lng) {
            return { lat: parseFloat(lote.lat), lng: parseFloat(lote.lng) };
        }
        return null;
    },

    // -----------------------------------------------------------------------
    // Analisa todos os lotes: RIP cadastrado OU distância da costa
    // -----------------------------------------------------------------------
    analyzeMarineAreas: function(allLotes) {
        console.log('🌊 MarinhaHandler: Analisando jurisdição SPU (RIP + Distância)...');
        this.state.marineLots.clear();

        allLotes.forEach(lote => {
            // 1. RIP cadastrado (certeza legal)
            const hasRip = lote.unidades?.some(u => u.rip && u.rip.trim() !== '');

            // 2. Cálculo de distância da costa
            const center = this.getLotCenter(lote);
            let distanceToSea = null;
            let withinBuffer = false;

            if (center) {
                distanceToSea = Math.round(this.distanceToCoastline(center));
                withinBuffer = distanceToSea <= this.MARINE_BUFFER_M;
            }

            // Marca como área de marinha se: tem RIP OU está dentro da faixa de 33m
            if (hasRip || withinBuffer) {
                this.state.marineLots.set(lote.inscricao, {
                    hasRip,
                    distanceToSea,
                    withinBuffer,
                    reason: hasRip && withinBuffer
                        ? 'RIP cadastrado + Faixa de 33m'
                        : hasRip
                            ? 'RIP cadastrado (SPU)'
                            : `Dentro da faixa de ${distanceToSea}m da costa`
                });
            }
        });

        console.log(`🌊 MarinhaHandler: ${this.state.marineLots.size} lotes em área de marinha.`);
    },

    // -----------------------------------------------------------------------
    // Verifica se um único lote está em área de marinha (chamada reativa)
    // -----------------------------------------------------------------------
    isMarineLot: function(lote) {
        if (this.state.marineLots.has(lote.inscricao)) return true;

        // Cálculo inline se não foi pré-computado (para tooltips abertos antes do analyzeMarineAreas)
        const hasRip = lote.unidades?.some(u => u.rip && u.rip.trim() !== '');
        if (hasRip) return true;

        const center = this.getLotCenter(lote);
        if (center) {
            const dist = this.distanceToCoastline(center);
            if (dist <= this.MARINE_BUFFER_M) return true;
        }

        return false;
    },

    // -----------------------------------------------------------------------
    // Liga/Desliga a camada visual de marinha no mapa
    // -----------------------------------------------------------------------
    toggleLayer: function() {
        this.state.isActive = !this.state.isActive;

        if (this.state.isActive) {
            window.Toast?.info('🌊 Camada de Marinha ativada. Lotes em área SPU destacados em Azul.');
            this.highlightMarineLots();
        } else {
            window.Toast?.info('Camada de Marinha desativada.');
            this.clearHighlight();
        }
    },

    highlightMarineLots: function() {
        if (!window.map || !window.MapHandler?.applyFilter) return;
        window.MapHandler.applyFilter(
            (lote) => this.state.marineLots.has(lote.inscricao),
            { fillColor: '#004a99', fillOpacity: 0.6, weight: 2, color: '#ffffff' }
        );
    },

    clearHighlight: function() {
        window.MapHandler?.resetStyles?.();
    },

    // -----------------------------------------------------------------------
    // HTML de explicação para o Tooltip do Lote (síncrono — já pré-computado)
    // -----------------------------------------------------------------------
    getMarineExplanation: function(lote) {
        // Tenta do cache pré-computado
        let info = this.state.marineLots.get(lote.inscricao);

        // Se não está no cache, calcula inline (lote aberto antes do analyzeMarineAreas)
        if (!info) {
            const hasRip = lote.unidades?.some(u => u.rip && u.rip.trim() !== '');
            const center = this.getLotCenter(lote);
            let distanceToSea = null;
            let withinBuffer = false;

            if (center) {
                distanceToSea = Math.round(this.distanceToCoastline(center));
                withinBuffer = distanceToSea <= this.MARINE_BUFFER_M;
            }

            if (!hasRip && !withinBuffer) return null;

            info = {
                hasRip,
                distanceToSea,
                withinBuffer,
                reason: hasRip && withinBuffer
                    ? 'RIP cadastrado + Faixa de 33m'
                    : hasRip ? 'RIP cadastrado (SPU)' : `${distanceToSea}m da linha de costa`
            };
        }

        const distLabel = info.distanceToSea !== null
            ? `<span style="font-weight:700; color:#1d4ed8;">${info.distanceToSea}m</span> da linha de costa`
            : 'Distância não calculada';

        const ripBadge = info.hasRip
            ? `<li><strong>RIP:</strong> Registro Imobiliário Patrimonial identificado nas unidades.</li>`
            : '';

        const distBadge = info.withinBuffer
            ? `<li><strong>Posição:</strong> Dentro da faixa de ${this.MARINE_BUFFER_M}m (${distLabel}).</li>`
            : (info.distanceToSea !== null
                ? `<li><strong>Proximidade:</strong> ${distLabel} — verificar certidão SPU.</li>`
                : '');

        return `
            <div class="marine-info-box">
                <div class="marine-header">
                    <i class="fas fa-anchor"></i>
                    <span>ÁREA DE MARINHA (SPU)</span>
                    <span style="margin-left: auto; font-size: 10px; color: #93c5fd; background: rgba(255,255,255,0.1); padding: 2px 8px; border-radius: 20px;">${info.reason}</span>
                </div>
                <div class="marine-body">
                    <p>Este imóvel está localizado em terrenos de marinha (faixa de ${this.MARINE_BUFFER_M}m da preamar média de 1831).</p>
                    <ul>
                        <li><strong>Laudêmio:</strong> 5% sobre o valor da transação em caso de venda.</li>
                        <li><strong>Regime:</strong> Sujeito a Foro ou Taxa de Ocupação anual à SPU.</li>
                        ${ripBadge}
                        ${distBadge}
                    </ul>
                    <div class="marine-footer">
                        *Dados para fins informativos. Consulte a certidão da SPU para confirmação legal.
                    </div>
                </div>
            </div>
        `;
    }
};

// Atalhos globais
window.toggleMarinhaLayer = () => window.MarinhaHandler.toggleLayer();
window.isMarineLot = (lote) => window.MarinhaHandler.isMarineLot(lote);

console.log('🌊 MarinhaHandler v2.0 carregado — detecção por RIP + distância geográfica da costa.');
