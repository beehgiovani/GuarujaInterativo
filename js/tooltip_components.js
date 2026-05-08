/**
 * Componentes de Interface do Tooltip (tooltip_components.js)
 * Aqui eu guardo as funções que geram o HTML dos blocos visuais do lote.
 * O objetivo é tirar o "lixo" visual do handler principal e focar em performance.
 */

window.TooltipComponents = {
    // Gera o carrossel de fotos (Google Photos + Fotos Locais)
    renderCarousel: function(lote) {
        if (!lote) return '';
        const gallery = Array.isArray(lote.gallery) ? lote.gallery : [];
        const internalImages = (gallery.length > 0) ? gallery : (lote.image_url ? [lote.image_url] : []);
        const externalImages = Array.isArray(lote._googlePhotos) ? lote._googlePhotos : [];
        const allImages = [...internalImages, ...externalImages];
        
        if (allImages.length === 0) return '';

        const imagesJson = JSON.stringify(allImages).replace(/"/g, '&quot;');
        
        return `
        <div class="custom-carousel-wrapper" style="margin-bottom: 24px; position: relative;">
            <div class="custom-carousel" style="display: flex; overflow-x: auto; scroll-snap-type: x mandatory; gap: 10px; border-radius: 12px; scrollbar-width: none; -ms-overflow-style: none;">
                ${allImages.map((img, i) => `
                    <div style="flex: 0 0 100%; scroll-snap-align: start; position: relative; height: 320px; border-radius: 12px; overflow: hidden; background: #0f172a; cursor: pointer;"
                         onclick="window.openImageModal(${i}, ${imagesJson})">
                        <img src="${img}" loading="lazy" style="width: 100%; height: 100%; object-fit: contain;" onerror="this.src='/placeholder.png'">
                        ${externalImages.includes(img) ? `<div style="position: absolute; bottom: 12px; right: 12px; background: rgba(0,0,0,0.6); color: white; padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: bold; display: flex; align-items: center; gap: 6px; backdrop-filter: blur(4px); border: 1px solid rgba(255,255,255,0.1);"><i class="fab fa-google"></i> Google Photos</div>` : ''}
                        ${internalImages.includes(img) ? `<div style="position: absolute; bottom: 12px; left: 12px; background: rgba(30,58,138,0.6); color: white; padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: bold; display: flex; align-items: center; gap: 6px; backdrop-filter: blur(4px); border: 1px solid rgba(255,255,255,0.1);"><i class="fas fa-camera"></i> Foto do Lote</div>` : ''}
                    </div>
                `).join('')}
            </div>
            ${allImages.length > 1 ? `
                <div style="position: absolute; bottom: -18px; left: 0; right: 0; display: flex; justify-content: center; gap: 4px;">
                    ${allImages.slice(0, 8).map((_, i) => `<div style="width: 6px; height: 6px; border-radius: 50%; background: ${i === 0 ? '#3b82f6' : '#cbd5e1'};"></div>`).join('')}
                </div>
            ` : ''}
        </div>`;
    },

    // Gera o comparativo de preço Market IQ
    renderMarketIQ: function(lote) {
        const meta = lote.metadata || {};
        const valorM2 = parseFloat(lote.valor_m2 ? lote.valor_m2.toString().replace(',', '.') : 0);
        if (valorM2 <= 0) return '';

        const bairro = meta.bairro || 'Guarujá';
        const avgBairro = window.Store ? window.Store.getNeighborhoodAvg(bairro) : 0;
        const diff = avgBairro > 0 ? ((valorM2 - avgBairro) / avgBairro * 100).toFixed(1) : 0;
        const isAbove = diff > 0;
        const barColor = isAbove ? '#f59e0b' : '#10b981';
        
        return `
            <div class="market-iq-block" style="margin-bottom: 24px; padding: 15px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <div style="font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase;">Market IQ: Comparativo de Mercado</div>
                    <div style="font-size: 10px; padding: 2px 6px; background: ${barColor}20; color: ${barColor}; border-radius: 4px; font-weight: 700;">
                        ${isAbove ? `↑ ${diff}% acima da média` : `↓ ${Math.abs(diff)}% abaixo da média`}
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div>
                        <div style="font-size: 10px; color: #94a3b8; margin-bottom: 4px;">Valor m² (Este Lote)</div>
                        <div style="font-size: 18px; font-weight: 900; color: #1e293b;">R$ ${valorM2.toLocaleString('pt-BR')}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 10px; color: #94a3b8; margin-bottom: 4px;">Média ${bairro}</div>
                        <div style="font-size: 18px; font-weight: 700; color: #64748b;">R$ ${avgBairro.toLocaleString('pt-BR')}</div>
                    </div>
                </div>
            </div>
        `;
    },

    // Gera o bloco de Pontos de Interesse (Distâncias)
    renderPOIs: function(lote, lat, lng) {
        if (!window.turf || !lote.minx) return '';
        
        try {
            const centerX = (parseFloat(lote.minx) + parseFloat(lote.maxx)) / 2;
            const centerY = (parseFloat(lote.miny) + parseFloat(lote.maxy)) / 2;
            const loteLatLng = window.utmToLatLon(centerX, centerY);
            const lotePoint = turf.point([loteLatLng.lng, loteLatLng.lat]);

            const dists = [];
            if (window.georefs && window.georefs.length > 0) {
                window.georefs.forEach(ref => {
                    if (!ref.geometria) return;
                    const target = (ref.geometria.geometry.type === 'Point') ? ref.geometria : turf.centroid(ref.geometria);
                    const d = turf.distance(lotePoint, target, { units: 'meters' });
                    if (d <= 3000) {
                        dists.push({ name: ref.nome || ref.tipo, type: ref.tipo, dist: Math.round(d), lat: target.geometry.coordinates[1], lng: target.geometry.coordinates[0] });
                    }
                });
            }

            if (dists.length === 0) return '';
            dists.sort((a, b) => a.dist - b.dist);
            const uniqueDists = dists.slice(0, 6);

            return `
                <div style="margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px dashed #e2e8f0;">
                    <div style="font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; margin-bottom: 8px;">Pontos de Interesse & Praia</div>
                    <div style="display:flex; gap:8px; flex-wrap:wrap;">
                        ${uniqueDists.map(item => `
                            <div class="poi-tag" onclick="window.flyToPOI(${item.lat}, ${item.lng}, '${item.name}')" 
                                 style="font-size:11px; font-weight:600; background:#f1f5f9; padding:4px 10px; border-radius:6px; display:flex; align-items:center; gap:6px; cursor:pointer;">
                                <i class="fas fa-map-marker-alt"></i> ${item.dist}m - ${item.name}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } catch (e) {
            console.warn("❌ Erro ao calcular distâncias:", e);
            return '';
        }
    }
};
