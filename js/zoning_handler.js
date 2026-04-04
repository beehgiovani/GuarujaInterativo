/**
 * ZONING_HANDLER.JS
 * Urban Intelligence & Constructive Potential Simulator
 * REDESIGNED: Glassmorphism Side Panel
 */

window.ZoningHandler = (function() {
    
    const ZoningRules = {
        'ZUM':  { name: 'Zona de Uso Misto', ca: 4.0, to: 0.6, gabarito: 'Livre' },
        'ZR-1': { name: 'Residencial Unifamiliar', ca: 1.0, to: 0.5, gabarito: '2 Pav.' },
        'ZR-2': { name: 'Residencial Multifamiliar', ca: 2.5, to: 0.6, gabarito: '8 Pav.' },
        'ZC':   { name: 'Centro Comercial', ca: 3.5, to: 0.7, gabarito: '12 Pav.' },
        'AEAS': { name: 'Ambiental', ca: 0.1, to: 0.1, gabarito: 'Restrito' },
        'AEIP': { name: 'Interesse Especial', ca: 1.5, to: 0.5, gabarito: '6 Pav.' },
        'DEFAULT': { name: 'Zon. Não Identificado', ca: 1.5, to: 0.5, gabarito: 'Consulte' }
    };

    /**
     * Side Panel UI
     */
    function showSimulationResult(stats) {
        // Remove existing panel if any
        const existing = document.getElementById('zoning-insight-panel');
        if (existing) existing.remove();

        const panel = document.createElement('div');
        panel.id = 'zoning-insight-panel';
        
        const buildableArea = (stats.area * stats.rule.ca).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
        const footprint = (stats.area * stats.rule.to).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
        
        panel.style.cssText = `
            position: fixed;
            right: 20px;
            top: 80px;
            width: 320px;
            background: rgba(255, 255, 255, 0.85);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 20px;
            box-shadow: 0 15px 35px rgba(0,0,0,0.15);
            z-index: 9000;
            padding: 24px;
            animation: slideInRight 0.5s cubic-bezier(0.16, 1, 0.3, 1);
            color: #1e293b;
            display: flex;
            flex-direction: column;
            gap: 20px;
        `;

        panel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 36px; height: 36px; background: #0ea5e9; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-size: 16px;">
                        <i class="fas fa-building-circle-check"></i>
                    </div>
                    <span style="font-weight: 800; font-size: 14px; letter-spacing: -0.5px;">Potencial Urbano</span>
                </div>
                <button onclick="this.closest('#zoning-insight-panel').remove()" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #64748b;">&times;</button>
            </div>

            <div style="background: rgba(255,255,255,0.5); border-radius: 16px; padding: 16px; border: 1px solid rgba(0,0,0,0.05);">
                <div style="font-size: 10px; font-weight: 800; color: #0284c7; text-transform: uppercase; margin-bottom: 4px;">Zoneamento</div>
                <div style="font-size: 18px; font-weight: 900; color: #0f172a;">${stats.zoneCode}</div>
                <div style="font-size: 11px; color: #64748b; font-weight: 500;">${stats.rule.name}</div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div style="background: rgba(255,255,255,0.5); padding: 12px; border-radius: 12px; border: 1px solid rgba(0,0,0,0.03);">
                    <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Terreno</div>
                    <div style="font-size: 14px; font-weight: 800;">${Math.round(stats.area)} m²</div>
                </div>
                <div style="background: rgba(255,255,255,0.5); padding: 12px; border-radius: 12px; border: 1px solid rgba(0,0,0,0.03);">
                    <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Gabarito</div>
                    <div style="font-size: 14px; font-weight: 800;">${stats.rule.gabarito}</div>
                </div>
            </div>

            <div style="border-top: 1px solid rgba(0,0,0,0.05); padding-top: 15px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 8px;">
                    <div>
                        <div style="font-size: 9px; font-weight: 800; color: #0284c7; text-transform: uppercase;">Aproveitamento (CA)</div>
                        <div style="font-size: 13px; font-weight: 700;">Máx. ${buildableArea} m²</div>
                    </div>
                    <div style="font-size: 18px; font-weight: 900; color: #0369a1;">${stats.rule.ca}x</div>
                </div>
                <div style="height: 6px; background: rgba(0,0,0,0.05); border-radius: 3px; overflow: hidden;">
                    <div style="width: 100%; height: 100%; background: linear-gradient(90deg, #0ea5e9, #0284c7);"></div>
                </div>
            </div>

            <div>
                <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 8px;">
                    <div>
                        <div style="font-size: 9px; font-weight: 800; color: #059669; text-transform: uppercase;">Ocupação (TO)</div>
                        <div style="font-size: 13px; font-weight: 700;">Máx. ${footprint} m²</div>
                    </div>
                    <div style="font-size: 18px; font-weight: 900; color: #059669;">${stats.rule.to * 100}%</div>
                </div>
                <div style="height: 6px; background: rgba(0,0,0,0.05); border-radius: 3px; overflow: hidden;">
                    <div style="width: ${stats.rule.to * 100}%; height: 100%; background: linear-gradient(90deg, #10b981, #059669);"></div>
                </div>
            </div>

            <button class="btn-primary-rich" 
                    style="width: 100%; background: #2563eb; color: white; padding: 14px; border-radius: 14px; font-weight: 700; font-size: 13px; display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 4px 12px rgba(37,99,235,0.25);"
                    onclick="window.ZoningHandler.shareOnWhatsApp('${stats.zoneCode}', '${buildableArea}', '${Math.round(stats.area)}')">
                <i class="fab fa-whatsapp" style="font-size: 16px;"></i> Enviar p/ Investidor
            </button>

            <div style="font-size: 9px; color: #94a3b8; text-align: center; font-style: italic; line-height: 1.4;">
                *Estimativa baseada no Plano Diretor do Guarujá. <br> Consulte a prefeitura para dados oficiais.
            </div>
        `;

        if (!panel.parentElement) {
            document.body.appendChild(panel);
        }

        // Add specific keyframe if not present
        if (!document.getElementById('zoning-anim-style')) {
            const style = document.createElement('style');
            style.id = 'zoning-anim-style';
            style.textContent = `
                @keyframes slideInRight {
                    from { transform: translateX(100%) opacity(0); }
                    to { transform: translateX(0) opacity(1); }
                }
            `;
            document.head.appendChild(style);
        }
    }

    async function runSimulation(overlay, type) {
        window.Loading.show('Consultando Plano Diretor...', 'Análise de Solo em curso');
        
        let area = 0;
        if (type === 'polygon' || type === 'rectangle') {
            area = google.maps.geometry.spherical.computeArea(overlay.getPath ? overlay.getPath() : getBoundsPath(overlay));
        } else if (type === 'circle') {
            area = Math.PI * Math.pow(overlay.getRadius(), 2);
        }

        let zoneCode = 'DEFAULT';
        if (window.allLotes) {
            const zonesFound = {};
            window.allLotes.forEach(lote => {
                if (!lote._lat || !lote._lng || !lote.zona) return;
                const pt = new google.maps.LatLng(lote._lat, lote._lng);
                let isInside = false;
                if (type === 'polygon' || type === 'rectangle') {
                    isInside = google.maps.geometry.poly.containsLocation(pt, overlay);
                } else if (type === 'circle') {
                    const dist = google.maps.geometry.spherical.computeDistanceBetween(pt, overlay.getCenter());
                    isInside = dist <= overlay.getRadius();
                }
                if (isInside) zonesFound[lote.zona] = (zonesFound[lote.zona] || 0) + 1;
            });
            const sortedZones = Object.entries(zonesFound).sort((a,b) => b[1] - a[1]);
            if (sortedZones.length > 0) zoneCode = sortedZones[0][0];
        }

        const rule = ZoningRules[zoneCode] || ZoningRules['DEFAULT'];
        window.Loading.hide();
        showSimulationResult({ area, zoneCode, rule });
    }

    function getBoundsPath(rectangle) {
        const bounds = rectangle.getBounds();
        return [
            bounds.getNorthEast(),
            {lat: bounds.getNorthEast().lat(), lng: bounds.getSouthWest().lng()},
            bounds.getSouthWest(),
            {lat: bounds.getSouthWest().lat(), lng: bounds.getNorthEast().lng()}
        ];
    }

    function shareOnWhatsApp(zone, potential, area) {
        const text = encodeURIComponent(`🏢 *ANÁLISE DE VIABILIDADE - OMEGA IMÓVEIS*\n\n📍 *Zoneamento:* ${zone}\n📐 *Terreno:* ${area} m²\n🏗️ *Potencial Construtivo:* ${potential} m²\n\n_Dados baseados no Plano Diretor do Guarujá._`);
        window.open(`https://wa.me/?text=${text}`, '_blank');
    }

    return { runSimulation, shareOnWhatsApp, rules: ZoningRules };
})();
