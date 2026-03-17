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

        // SECURITY GUARD: Elite feature
        if (window.Monetization && !window.Monetization.canAccess('mapear_patrimonio')) {
            window.Monetization.showSubscriptionPlans();
            window.Toast.info("Mapeamento de Patrimônio Consolidado exige plano Elite ou Master.");
            return;
        }

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
     * Destaca os imóveis no mapa e calcula estatísticas refinadas
     */
    async highlightPortfolio(prop, unidades) {
        const bounds = new google.maps.LatLngBounds();
        let valorMercadoTotal = 0;
        let areaTotalAgregada = 0;
        let unidadesDesbloqueadas = 0;
        const bairros = {};
        
        // Verificar quais lotes/unidades o usuário já desbloqueou
        const unlockedSet = window.Monetization?.unlockedLots || new Set();

        unidades.forEach(unit => {
            const lote = unit.lotes;
            if (!lote) return;

            const isUnlocked = unlockedSet.has(unit.inscricao) || unlockedSet.has(lote.inscricao) || prop.virtual;
            if (isUnlocked) unidadesDesbloqueadas++;

            // Extrair coordenadas
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

                // Cor conforme status de desbloqueio
                const markerColor = isUnlocked ? '#764ba2' : '#94a3b8'; // Roxo se livre, Cinza se bloqueado
                
                const marker = new google.maps.marker.AdvancedMarkerElement({
                    position: pos,
                    map: window.map,
                    title: `${unit.complemento || 'Unidade'} - ${lote.building_name || 'Lote'}`,
                    content: this.createPortfolioMarkerEl(isUnlocked, unit.complemento),
                    zIndex: isUnlocked ? 3000 : 2500
                });

                marker.addListener('gmp-click', () => {
                   if (isUnlocked) {
                       if (window.showUnitTooltip) window.showUnitTooltip(unit, 0, 0);
                       else if (window.showLotTooltip) window.showLotTooltip(lote, 0, 0);
                   } else {
                       window.Toast.info("Esta unidade ainda não foi desbloqueada em sua carteira.");
                       if (window.showLotTooltip) window.showLotTooltip(lote, 0, 0);
                   }
                });

                this.activePortfolioMarkers.push(marker);

                // Acumular estatísticas apenas se tivermos dados de valor/m2
                if (isUnlocked) {
                    const vm2 = parseFloat(lote.valor_m2 || 0);
                    const m2 = parseFloat(unit.metragem || 0);
                    if (vm2 > 0 && m2 > 0) {
                        valorMercadoTotal += (vm2 * m2);
                    }
                    areaTotalAgregada += m2;
                }

                if (lote.bairro) {
                    bairros[lote.bairro] = (bairros[lote.bairro] || 0) + 1;
                }
            }
        });

        if (this.activePortfolioMarkers.length > 0) {
            window.map.fitBounds(bounds);
            if (this.activePortfolioMarkers.length === 1) window.map.setZoom(18);

            this.showPortfolioDashboard(prop, unidades.length, unidadesDesbloqueadas, valorMercadoTotal, areaTotalAgregada, bairros);
            window.Toast.success(`Patrimônio de ${prop.nome_completo} mapeado com sucesso!`);
        }
    },

    createPortfolioMarkerEl(unlocked, label) {
        const div = document.createElement('div');
        div.style.cssText = `
            background: ${unlocked ? '#7c3aed' : '#64748b'};
            color: white; padding: 4px 8px; border-radius: 12px;
            font-size: 10px; font-weight: 800; border: 2px solid white;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            display: flex; align-items: center; gap: 4px;
            transform: translate(-50%, -50%);
        `;
        div.innerHTML = `<i class="fas ${unlocked ? 'fa-gem' : 'fa-lock'}"></i> ${label || 'Imóvel'}`;
        return div;
    },

    showPortfolioDashboard(prop, total, desbloqueadas, valor, area, bairros) {
        const existing = document.getElementById('portfolio-dashboard');
        if (existing) existing.remove();

        const dash = document.createElement('div');
        dash.id = 'portfolio-dashboard';
        dash.style.cssText = `
            position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
            background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
            padding: 20px 30px; border-radius: 24px; box-shadow: 0 20px 50px rgba(0,0,0,0.2);
            z-index: 9000; border: 1px solid rgba(124, 58, 237, 0.2); 
            display: flex; flex-direction: column; gap: 15px; width: 90%; max-width: 800px;
            animation: slideUp 0.5s cubic-bezier(0.17, 0.04, 0.03, 0.94);
        `;

        const bairrosHtml = Object.entries(bairros)
            .map(([n, c]) => `<span style="font-size: 10px; background: #f1f5f9; padding: 2px 8px; border-radius: 4px; color: #475569;">${n} (${c})</span>`)
            .join(' ');

        dash.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <div>
                    <div style="font-size: 10px; text-transform: uppercase; color: #7c3aed; font-weight: 800; letter-spacing: 1px;">Visão Consolidada de Patrimônio</div>
                    <div style="font-size: 22px; font-weight: 900; color: #0f172a; margin-top: 2px;">${prop.nome_completo}</div>
                    <div style="margin-top: 8px; display: flex; flex-wrap: wrap; gap: 5px;">${bairrosHtml}</div>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button onclick="window.ProprietarioTooltip.show(${prop.id})" class="btn-primary-rich" style="padding: 8px 16px; font-size: 11px;">
                        <i class="fas fa-user-circle"></i> Perfil Completo
                    </button>
                    <button onclick="window.PortfolioHandler.clearPortfolio()" style="background: #f1f5f9; border: none; width: 36px; height: 36px; border-radius: 12px; cursor: pointer; color: #64748b;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; border-top: 1px solid #f1f5f9; padding-top: 15px;">
                <div style="text-align: center;">
                    <div style="font-size: 9px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Total Imóveis</div>
                    <div style="font-size: 18px; font-weight: 900; color: #1e293b;">${total}</div>
                    <div style="font-size: 10px; color: #10b981; font-weight: 600;">${desbloqueadas} Desbloqueados</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 9px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Área Privativa Est.</div>
                    <div style="font-size: 18px; font-weight: 900; color: #1e293b;">${area > 0 ? area.toLocaleString() : '---'} m²</div>
                    <div style="font-size: 9px; color: #94a3b8;">Soma das unidades livres</div>
                </div>
                <div style="text-align: center; background: #f8fafc; border-radius: 16px; padding: 10px; display: flex; align-items: center; justify-content: center;">
                    <div style="font-size: 11px; color: #64748b; font-weight: 600;">Valores: Sob Consulta</div>
                </div>
            </div>

            <div style="text-align: right;">
                <button onclick="window.PortfolioHandler.generateExecutiveSummary('${prop.nome_completo}', ${total}, ${desbloqueadas}, ${area})" style="background: none; border: none; color: #7c3aed; font-size: 11px; font-weight: 700; cursor: pointer; text-decoration: underline;">
                    <i class="fas fa-file-pdf"></i> Gerar Resumo Executivo para WhatsApp
                </button>
            </div>
        `;

        document.body.appendChild(dash);
    },

    generateExecutiveSummary(nome, total, desbloqueadas, area) {
        const data = new Date().toLocaleDateString('pt-BR');
        let texto = `*RESUMO EXECUTIVO DE PATRIMÔNIO - GUARUGEO*\n`;
        texto += `_Data: ${data}_\n\n`;
        texto += `*Proprietário:* ${nome}\n`;
        texto += `*Total de Imóveis Mapeados:* ${total}\n`;
        texto += `*Unidades Desbloqueadas:* ${desbloqueadas}\n\n`;
        
        if (area > 0) {
            texto += `*Área Privativa Estimada Total:* ${area.toLocaleString()} m²\n`;
        }
        
        texto += `*Valor de Mercado:* Sob consulta com corretor responsável\n`;

        texto += `\n🔗 *Acesse o mapa:* https://guarugeo.omegaimoveis.com.br\n`;
        texto += `\n_Gerado automaticamente via Inteligência GuaruGeo_`;

        const encoded = encodeURIComponent(texto);
        window.open(`https://wa.me/?text=${encoded}`, '_blank');
        window.Toast.success("Resumo gerado! Escolha o contato no WhatsApp.");
    },

    clearPortfolio() {
        this.activePortfolioMarkers.forEach(m => m.map = null);
        this.activePortfolioMarkers = [];
        this.activePortfolioPolygons.forEach(p => p.setMap(null));
        this.activePortfolioPolygons = [];
        
        const dash = document.getElementById('portfolio-dashboard');
        if (dash) dash.remove();
    }
};

window.viewPortfolio = (id) => window.PortfolioHandler.viewPortfolio(id);
