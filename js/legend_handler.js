/**
 * LEGEND HANDLER - Dicionário de Zonas e Bairros
 * Facilita o onboarding de novos usuários mapeando Zonas para Bairros reais.
 */
window.LegendHandler = {
    // Mapeamento baseado nos dados reais do banco GuarujaGeo
    ZONES: [
        { id: '1', name: 'Centro & Pitangueiras', neighborhoods: 'Pitangueiras, Vila Maia, Barra Funda', icon: '🏙️', color: '#FF6B6B' },
        { id: '2', name: 'Astúrias & Tombo', neighborhoods: 'Astúrias, Tombo, Guaiúba, Jd. Las Palmas', icon: '🏄‍♂️', color: '#4ECDC4' },
        { id: '3', name: 'Enseada & Tortugas', neighborhoods: 'Enseada, Tortugas, Jd. Virgínia, Aquário', icon: '🏨', color: '#45B7D1' },
        { id: '4', name: 'Cidade Atlântica', neighborhoods: 'Cidade Atlântica, Balneário Guarujá', icon: '🏡', color: '#FFA07A' },
        { id: '5', name: 'Pernambuco & Mar Casado', neighborhoods: 'Pernambuco, Mar Casado, Balneário Praia do Pernambuco', icon: '🌴', color: '#98D8C8' },
        { id: '6', name: 'Perequê & Marinas', neighborhoods: 'Perequê, Marinas, Porto, Ferry Boat', icon: '🚤', color: '#F7DC6F' }
    ],

    /**
     * Abre o modal didático de Legenda de Zonas
     */
    show() {
        if (window.hideContextMenu) window.hideContextMenu();

        const overlay = document.createElement('div');
        overlay.className = 'sidebar-backdrop active';
        overlay.id = 'legend-overlay';
        overlay.style.zIndex = '10000';

        const modal = document.createElement('div');
        modal.className = 'legend-modal';
        modal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 30px;
            border-radius: 20px;
            width: 90%;
            max-width: 500px;
            box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
            z-index: 10001;
            animation: slideUp 0.3s ease;
        `;

        let zonesHtml = this.ZONES.map(z => `
            <div style="display: flex; gap: 15px; margin-bottom: 20px; align-items: flex-start; padding: 12px; border-radius: 12px; background: #f8fafc; border: 1px solid #e2e8f0;">
                <div style="background: ${z.color}; color: white; width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                    ${z.icon}
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: 800; color: #1e293b; font-size: 14px; margin-bottom: 2px;">Zona ${z.id}: ${z.name}</div>
                    <div style="font-size: 11px; color: #64748b; line-height: 1.4;">${z.neighborhoods}</div>
                </div>
            </div>
        `).join('');

        modal.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
                <h3 style="margin: 0; font-size: 20px; color: #1e293b; font-weight: 800;">🗺️ Guia de Zonas & Bairros</h3>
                <button onclick="document.getElementById('legend-overlay').remove(); document.getElementById('legend-modal-container').remove();" style="border: none; background: none; font-size: 24px; color: #94a3b8; cursor: pointer;">×</button>
            </div>
            
            <p style="font-size: 13px; color: #475569; margin-bottom: 25px; line-height: 1.5;">O Guarujá é dividido em 6 zonas principais para fins tributários e de planejamento urbano. Use este guia para se localizar rapidamente no mapa.</p>
            
            <div style="max-height: 400px; overflow-y: auto; padding-right: 10px;">
                ${zonesHtml}
            </div>

            <button onclick="document.getElementById('legend-overlay').remove(); document.getElementById('legend-modal-container').remove();" style="width: 100%; margin-top: 25px; padding: 12px; border: none; background: #1e293b; color: white; border-radius: 12px; font-weight: 700; cursor: pointer; transition: background 0.2s;">Entendi, Vamos lá!</button>
        `;

        const container = document.createElement('div');
        container.id = 'legend-modal-container';
        container.appendChild(modal);

        document.body.appendChild(overlay);
        document.body.appendChild(container);

        overlay.onclick = () => { overlay.remove(); container.remove(); };
    }
};

console.log("✅ LegendHandler carregado (Guia Geográfico)");
