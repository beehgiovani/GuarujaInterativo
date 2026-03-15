// ==========================================
// PORTFOLIO HANDLER - PORTFOLIO_HANDLER.JS
// ==========================================
// Lógica para visualizar o patrimônio consolidado de proprietários no mapa

window.PortfolioHandler = {
    activePortfolioMarkers: [],
    activePortfolioPolygons: [],

    /**
     * Visualiza todo o patrimônio de um CPF ou Nome no mapa
     */
    async viewPortfolio(identifier) {
        if (!identifier) return;

        window.Loading.show('Mapeando Patrimônio...', `Buscando propriedades vinculadas a "${identifier}"`);

        try {
            // 1. Limpar visualizações anteriores
            this.clearPortfolio();

            // 2. Buscar Proprietário
            let query = window.supabaseApp.from('proprietarios').select('*');
            
            if (identifier.replace(/\D/g, '').length >= 11) {
                query = query.eq('cpf_cnpj', identifier.replace(/\D/g, ''));
            } else {
                query = query.ilike('nome_completo', `%${identifier}%`);
            }

            const { data: prop, error: propError } = await query.single();

            if (propError || !prop) {
                // Tentativa direta na tabela unidades por nome se não achar proprietário unificado
                return this.viewByUnidadeName(identifier);
            }

            // 3. Buscar todas as unidades do proprietário
            const { data: unidades, error: unitError } = await window.supabaseApp
                .from('unidades')
                .select(`
                    *,
                    lotes (*)
                `)
                .eq('proprietario_id', prop.id);

            if (unitError || !unidades || unidades.length === 0) {
                window.Toast.warning('Nenhum imóvel mapeado encontrado para este CPF.');
                window.Loading.hide();
                return;
            }

            await this.highlightPortfolio(prop, unidades);

        } catch (e) {
            console.error('Erro ao visualizar portfólio:', e);
            window.Toast.error('Erro ao carregar mapa de patrimônio');
        } finally {
            window.Loading.hide();
        }
    },

    async viewByUnidadeName(name) {
        const { data: unidades, error } = await window.supabaseApp
            .from('unidades')
            .select('*, lotes(*)')
            .ilike('nome_proprietario', `%${name}%`);

        if (error || !unidades || unidades.length === 0) {
            window.Toast.warning('Nenhuma propriedade encontrada com este nome.');
            window.Loading.hide();
            return;
        }

        const virtualProp = { nome_completo: name, virtual: true };
        await this.highlightPortfolio(virtualProp, unidades);
    },

    /**
     * Destaca os imóveis no mapa e calcula estatísticas
     */
    async highlightPortfolio(prop, unidades) {
        const bounds = new google.maps.LatLngBounds();
        let totalValor = 0;
        let totalMetragem = 0;
        const bairros = new Set();
        const lotesManaged = new Set();

        unidades.forEach(unit => {
            const lote = unit.lotes;
            if (!lote) return;

            // Extrair coordenadas (UTM -> Lat/Lng se necessário)
            let lat = lote._lat;
            let lng = lote._lng;

            if (!lat && lote.minx) {
                const cx = (lote.minx + lote.maxx) / 2;
                const cy = (lote.miny + lote.maxy) / 2;
                const ll = window.utmToLatLon(cx, cy);
                lat = ll.lat;
                lng = ll.lng;
            }

            if (lat && lng) {
                const pos = { lat, lng };
                bounds.extend(pos);

                // Criar Marcador Higienizado de Patrimônio
                const marker = new google.maps.Marker({
                    position: pos,
                    map: window.map,
                    title: `${unit.complemento || 'Unidade'} - ${lote.building_name || ''}`,
                    icon: {
                        path: google.maps.SymbolPath.CIRCLE,
                        fillColor: '#764ba2', // Roxinho Premium
                        fillOpacity: 0.9,
                        strokeColor: '#FFFFFF',
                        strokeWeight: 2,
                        scale: 10
                    },
                    animation: google.maps.Animation.DROP,
                    zIndex: 9999
                });

                marker.addListener('click', () => {
                    if (window.showUnitTooltip) {
                        window.showUnitTooltip(unit, 0, 0);
                    } else if (window.showLotTooltip) {
                        window.showLotTooltip(lote, 0, 0);
                    }
                });

                this.activePortfolioMarkers.push(marker);

                // Acumular estatísticas
                totalValor += parseFloat(unit.valor_venal || 0);
                totalMetragem += parseFloat(unit.metragem || 0);
                if (lote.bairro) bairros.add(lote.bairro);
                lotesManaged.add(lote.inscricao);
            }
        });

        // 5. Ajustar Zoom
        if (this.activePortfolioMarkers.length > 0) {
            window.map.fitBounds(bounds);
            
            // Se for apenas 1 imóvel, não dar zoom infinito
            if (this.activePortfolioMarkers.length === 1) {
                window.map.setZoom(18);
            }

            // 6. Mostrar Dashboard de Patrimônio (Resumo)
            this.showPortfolioDashboard(prop, unidades.length, totalValor, totalMetragem, Array.from(bairros));
            
            window.Toast.success(`Patrimônio de ${prop.nome_completo} mapeado com sucesso!`);
        }
    },

    showPortfolioDashboard(prop, count, valor, metragem, bairros) {
        const existing = document.getElementById('portfolio-dashboard');
        if (existing) existing.remove();

        const dash = document.createElement('div');
        dash.id = 'portfolio-dashboard';
        dash.className = 'premium-card portfolio-dash';
        dash.style.cssText = `
            position: fixed; top: 80px; left: 50%; transform: translateX(-50%);
            background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
            padding: 15px 25px; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.15);
            z-index: 9000; border: 1px solid #764ba233; display: flex; gap: 25px;
            align-items: center; animation: slideDown 0.4s cubic-bezier(0.17, 0.04, 0.03, 0.94);
        `;

        dash.innerHTML = `
            <div style="border-right: 2px solid #764ba222; padding-right: 20px;">
                <div style="font-size: 10px; text-transform: uppercase; color: #764ba2; font-weight: 800;">Proprietário</div>
                <div style="font-size: 16px; font-weight: 800; color: #1e293b;">${prop.nome_completo}</div>
            </div>
            <div style="display: flex; gap: 8px;">
                <button onclick="window.ProprietarioTooltip.show(${prop.id})" style="
                    background: #764ba2; color: white; border: none; padding: 6px 12px; 
                    border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer;
                    display: flex; align-items: center; gap: 5px;
                ">
                    <i class="fas fa-user-circle"></i> VER PERFIL
                </button>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 10px; color: #64748b; font-weight: 600;">Unidades</div>
                <div style="font-size: 18px; font-weight: 800; color: #1e293b;">${count}</div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 10px; color: #64748b; font-weight: 600;">Área Total</div>
                <div style="font-size: 18px; font-weight: 800; color: #1e293b;">${metragem.toLocaleString()} m²</div>
            </div>
             <div style="text-align: center;">
                <div style="font-size: 10px; color: #64748b; font-weight: 600;">VGV Estimado</div>
                <div style="font-size: 18px; font-weight: 800; color: #059669;">R$ ${valor > 0 ? valor.toLocaleString('pt-BR') : '---'}</div>
            </div>
            <button onclick="window.PortfolioHandler.clearPortfolio()" style="
                background: #f1f5f9; border: none; width: 32px; height: 32px; 
                border-radius: 50%; cursor: pointer; color: #94a3b8; transition: all 0.2s;
            " onmouseover="this.style.background='#fee2e2'; this.style.color='#ef4444'">&times;</button>
        `;

        document.body.appendChild(dash);
    },

    clearPortfolio() {
        this.activePortfolioMarkers.forEach(m => m.setMap(null));
        this.activePortfolioMarkers = [];
        this.activePortfolioPolygons.forEach(p => p.setMap(null));
        this.activePortfolioPolygons = [];
        
        const dash = document.getElementById('portfolio-dashboard');
        if (dash) dash.remove();
    }
};

window.viewPortfolio = (id) => window.PortfolioHandler.viewPortfolio(id);
