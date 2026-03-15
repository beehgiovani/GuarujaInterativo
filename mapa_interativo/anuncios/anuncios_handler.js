console.log("📢 AnunciosHandler Loading...");

const AnunciosHandler = (() => {
    // Private state
    let currentLoteId = null;
    let currentAnuncios = [];

    // Ensure we use the initialized client
    const supabaseClient = window.supabaseApp || window.supabase || window.supabaseClient;

    /**
     * Initialize anuncios for a specific lote
     * @param {string} loteId - The lote ID (inscription)
     * @param {string} containerId - Optional custom container ID
     */
    async function loadAnunciosForLote(loteId, containerId = null) {
        currentLoteId = loteId;
        const containerEl = containerId ? document.getElementById(containerId) : document.getElementById(`anuncios-container-${loteId}`);
        const countBadge = document.getElementById(`anuncios-count-${loteId}`);
        
        if (!containerEl) {
            console.error('Anuncios container not found:', containerId || `anuncios-container-${loteId}`);
            return;
        }

        // Show loading state
        containerEl.innerHTML = `
            <div class="loading-state">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Buscando oportunidades...</p>
            </div>
        `;

        try {
            // Note: loteId passed here is expected to be the STRING inscription 
            const { data, error } = await supabaseClient
                .from('anuncios')
                .select('*')
                .eq('lote_id', loteId)
                .eq('is_active', true)
                .order('match_score', { ascending: false });

            if (error) throw error;

            currentAnuncios = data || [];

            // Update badges if they exist
            updateBadges(loteId, currentAnuncios.length);

            // Render results
            if (currentAnuncios.length === 0) {
                containerEl.innerHTML = createEmptyState();
            } else {
                containerEl.innerHTML = currentAnuncios.map(anuncio => createAnuncioCard(anuncio)).join('');
            }

        } catch (err) {
            console.error('Erro carregando anúncios:', err);
            containerEl.innerHTML = createErrorState(err.message);
        }
    }

    /**
     * Update all badges for this lot
     */
    function updateBadges(loteId, count) {
        const headerBadge = document.getElementById(`header-anuncios-badge-${loteId}`);
        if (headerBadge) {
            headerBadge.textContent = count;
            headerBadge.style.display = count > 0 ? 'inline-block' : 'none';
        }
    }

    /**
     * Check badge without opening panel (for tooltip header)
     */
    async function checkBadge(loteId) {
        try {
            const { count, error } = await supabaseClient
                .from('anuncios')
                .select('*', { count: 'exact', head: true })
                .eq('lote_id', loteId)
                .eq('is_active', true);
            
            if (!error) {
                updateBadges(loteId, count || 0);
            }
        } catch (e) {
            console.error("Error checking badge:", e);
        }
    }

    /**
     * Open floating panel
     */
    function openPanel(loteInscricao) {
        // Close existing if any
        const existing = document.getElementById('anuncios-floating-panel');
        if (existing) existing.remove();

        const panel = document.createElement('div');
        panel.id = 'anuncios-floating-panel';
        panel.className = 'anuncios-panel-floating';
        panel.innerHTML = `
            <div class="anuncios-panel-header">
                <div style="font-weight: 700; display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-bullhorn"></i> Oportunidades
                </div>
                <button class="anuncios-panel-close" onclick="document.getElementById('anuncios-floating-panel').remove()">
                    &times;
                </button>
            </div>
            <div id="anuncios-panel-body-${loteInscricao}" class="anuncios-panel-body">
                <!-- Content loads here -->
            </div>
            <div style="padding: 12px; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; background: #fff;">
                <button onclick="document.getElementById('anuncios-floating-panel').remove()" 
                    style="padding: 6px 14px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer; color: #475569; font-weight: 600; font-size: 0.85rem; transition: all 0.2s;"
                    onmouseover="this.style.background='#e2e8f0'"
                    onmouseout="this.style.background='#f1f5f9'">
                    Fechar
                </button>
            </div>
        `;

        document.body.appendChild(panel);
        
        // Load data into the body
        // Ensure we pass the string inscription
        loadAnunciosForLote(loteInscricao, `anuncios-panel-body-${loteInscricao}`);
    }

    /**
     * Create empty state HTML
     */
    function createEmptyState() {
        return `
            <div class="anuncios-empty-state">
                <i class="fas fa-bullhorn"></i>
                <h4>Nenhum anúncio ativo</h4>
                <p>Este lote não possui anúncios capturados pelo scraper</p>
                <small class="hint">Execute o scraper para buscar novos anúncios</small>
            </div>
        `;
    }

    /**
     * Create error state HTML
     */
    function createErrorState(message) {
        return `
            <div class="anuncios-error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h4>Erro ao carregar anúncios</h4>
                <p>${message}</p>
            </div>
        `;
    }

    /**
     * Create anuncio card HTML
     */
    function createAnuncioCard(anuncio) {
        const matchClass = getMatchClass(anuncio.match_score);
        const matchLabel = getMatchLabel(anuncio.match_score);
        
        return `
            <div class="anuncio-card ${matchClass}" data-anuncio-id="${anuncio.id}">
                <div class="anuncio-header">
                    <div class="anuncio-title-section">
                        <h4 class="anuncio-title">${escapeHtml(anuncio.titulo)}</h4>
                        <span class="source-badge ${anuncio.source}">${anuncio.source.toUpperCase()}</span>
                    </div>
                    <div class="match-badge ${matchClass}">
                        ${matchLabel}
                    </div>
                </div>

                <div class="anuncio-specs">
                    ${anuncio.preco ? `
                        <span class="spec spec-price">
                            <i class="fas fa-tag"></i>
                            <strong>R$ ${formatPrice(anuncio.preco)}</strong>
                        </span>
                    ` : ''}
                    ${anuncio.area_anunciada ? `
                        <span class="spec">
                            <i class="fas fa-ruler-combined"></i>
                            ${anuncio.area_anunciada}m²
                        </span>
                    ` : ''}
                    ${anuncio.quartos ? `
                        <span class="spec">
                            <i class="fas fa-bed"></i>
                            ${anuncio.quartos} quarto${anuncio.quartos > 1 ? 's' : ''}
                        </span>
                    ` : ''}
                    ${anuncio.vagas ? `
                        <span class="spec">
                            <i class="fas fa-car"></i>
                            ${anuncio.vagas} vaga${anuncio.vagas > 1 ? 's' : ''}
                        </span>
                    ` : ''}
                </div>

                ${anuncio.descricao ? `
                    <p class="anuncio-desc">${truncateText(escapeHtml(anuncio.descricao), 150)}</p>
                ` : ''}

                ${anuncio.endereco_anuncio ? `
                    <p class="anuncio-address">
                        <i class="fas fa-map-marker-alt"></i>
                        ${escapeHtml(anuncio.endereco_anuncio)}
                    </p>
                ` : ''}

                <div class="anuncio-footer">
                    <small class="scraped-date">
                        <i class="fas fa-clock"></i>
                        Capturado em ${formatDate(anuncio.scraped_at)}
                    </small>
                    <a href="${anuncio.url}" 
                       target="_blank" 
                       rel="noopener noreferrer"
                       class="btn-view-listing">
                        <i class="fas fa-external-link-alt"></i>
                        Ver Anúncio Original
                    </a>
                </div>
            </div>
        `;
    }

    // Helpers
    function getMatchClass(score) {
        if (score === 100) return 'perfect-match';
        if (score >= 85) return 'excellent-match';
        if (score >= 75) return 'good-match';
        return 'ok-match';
    }

    function getMatchLabel(score) {
        if (score === 100) return '💯 Match Perfeito!';
        return `${score}% Match`;
    }

    function formatPrice(price) {
        return parseFloat(price).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }

    function formatDate(dateStr) {
        return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    function truncateText(text, maxLength) {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Get count of anuncios for a lote
     */
    async function getAnunciosCount(loteId) {
        try {
            const { count, error } = await supabaseClient
                .from('anuncios')
                .select('*', { count: 'exact', head: true })
                .eq('lote_id', loteId)
                .eq('is_active', true);

            if (error) throw error;
            return count || 0;

        } catch (err) {
            console.error('Erro contando anúncios:', err);
            return 0;
        }
    }

    /**
     * Escanear Web Tool (Serper API directly from Frontend)
     */
    async function liveScrapeWeb(inscricao, logradouro, numero, bairro) {
        if (!window.Monetization || !window.Monetization.canAccess('radar_mercado')) {
            window.Monetization.showSubscriptionPlans();
            return;
        }
        if (!logradouro) {
            window.Toast.error("Endereço incompleto para busca.");
            return;
        }

        window.Toast.info("🔍 Iniciando Radar de Mercado...");

        const queryParts = [logradouro.replace('R ', '').replace('AV ', '').replace('AL ', ''), numero, bairro, 'Guarujá', 'SP', 'venda'];
        const query = queryParts.filter(Boolean).join(' ');

        const GOOGLE_API_KEY = "2ea4a1ec1f0c3e29e5c35ee4e5b279520011f641";
        const url = "https://google.serper.dev/search";
        const payload = { q: query, gl: 'br', hl: 'pt', num: 10 };

        try {
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "X-API-KEY": GOOGLE_API_KEY,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error("Erro na API de busca");

            const data = await response.json();
            const items = data.organic || [];

            if (items.length === 0) {
                window.Toast.warning("Nenhum anúncio encontrado em tempo real.");
                return;
            }

            // Quick parsing for Real Estate matches
            let foundPrices = [];
            let outputItems = [];

            const logClean = logradouro.toLowerCase().replace(/^(r |av |al |rua |avenida )/i, '').trim();
            const logWords = logClean.split(' ').filter(w => w.length > 2);
            const bClean = (bairro || '').toLowerCase();

            items.forEach(item => {
                const text = (item.title + " " + (item.snippet || "")).toLowerCase();
                
                // --- MATCHING SCORE CALCULATION ---
                let score = 0;
                let maxScore = 3; // base: street(2), neighborhood(1)

                // 1. Street Match
                if (text.includes(logClean)) {
                    score += 2;
                } else if (logWords.some(w => text.includes(w))) {
                    score += 1; // Partial street match
                }

                // 2. Neighborhood Match
                if (bClean && text.includes(bClean)) {
                    score += 1;
                }

                // 3. Number Match (Bonus)
                if (numero && numero !== '0' && text.includes(String(numero))) {
                    score += 1.5;
                    maxScore += 1.5;
                }

                const matchPercent = Math.min(100, Math.round((score / maxScore) * 100));

                const priceMatch = text.match(/r\$\s*([\d.,]+)/) || text.match(/([\d.,]+)\s*mil/);
                let priceRaw = 0;
                
                if (priceMatch) {
                    let numStr = priceMatch[1].replace(/\./g, '').replace(',', '.');
                    priceRaw = parseFloat(numStr);
                    if (text.includes('mil')) priceRaw *= 1000;
                    if (priceRaw > 50000) {
                        foundPrices.push(priceRaw);
                    }
                }

                // FILTER: Only accept if match is > 30% or if it clearly found a price and the neighborhood matches
                if (matchPercent >= 33 || (priceRaw > 0 && score >= 1)) {
                    let domain = '';
                    try { domain = new URL(item.link).hostname.replace('www.', ''); } catch(e){}
                    
                    let badgeColor = matchPercent >= 75 ? '#10b981' : (matchPercent >= 50 ? '#fbbf24' : '#94a3b8');
                    
                    outputItems.push(`
                        <div style="border:1px solid #e2e8f0; border-radius:8px; padding:10px; background:#f8fafc; transition: all 0.2s; position:relative;" onmouseover="this.style.background='#f1f5f9';" onmouseout="this.style.background='#f8fafc';">
                            <div style="position:absolute; top:10px; right:10px; font-size:9px; font-weight:800; color:white; background:${badgeColor}; padding:2px 6px; border-radius:4px;" title="Match Score">
                                ${matchPercent}% MATCH
                            </div>
                            <a href="${item.link}" target="_blank" style="color:#2563eb; font-weight:700; text-decoration:none; display:block; margin-bottom:4px; font-size:12px; padding-right: 50px;">${item.title.substring(0, 60)}...</a>
                            <div style="font-size:11px; color:#64748b; margin-bottom:8px;">${item.snippet ? item.snippet.substring(0, 80) + '...' : ''}</div>
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <div style="font-size:10px; color:#94a3b8; font-weight:700; text-transform:uppercase;"><i class="fas fa-globe"></i> ${domain}</div>
                                ${priceRaw > 50000 ? `<div style="font-size:13px; font-weight:800; color:#10b981; background:#ecfdf5; padding:2px 8px; border-radius:4px; border: 1px solid #a7f3d0;">R$ ${priceRaw.toLocaleString('pt-BR')}</div>` : ''}
                            </div>
                        </div>
                    `);
                }
            });

            if (outputItems.length === 0) {
                window.Toast.warning("Anúncios encontrados não atingiram o nível de precisão (Match) esperado.");
                return;
            }

            let outputHtml = `<div style="font-family:'Inter', sans-serif;">
                               <div style="font-size: 13px; font-weight:600; color:#475569; margin-bottom:10px; display:flex; justify-content:space-between;">
                                 <span>Resultados (Alta Precisão):</span>
                                 <span style="color:#2563eb;">${numero ? logradouro + ', ' + numero : logradouro}</span>
                               </div>
                               <div style="display:flex; flex-direction:column; gap:8px;">
                               ${outputItems.join('')}
                               </div></div>`;

            // Average price logic
            let infoSummary = "";
            if (foundPrices.length > 0) {
                // Filter outliers (e.g. > 2.5x standard dev could be done, but keep simple for now)
                const sorted = foundPrices.sort((a,b) => a - b);
                // Remove highly skewed ends if many results
                if(sorted.length > 3) {
                    sorted.pop();
                    sorted.shift();
                }
                const avg = sorted.reduce((a,b) => a + b, 0) / sorted.length;
                
                infoSummary = `<div style="background:#ecfdf5; border:1px solid #10b981; padding:12px; border-radius:8px; margin-bottom:15px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div style="font-size:10px; color:#047857; font-weight:700; text-transform:uppercase; margin-bottom:2px;">Média Pedida (Internet)</div>
                        <div style="font-size:18px; color:#065f46; font-weight:900;">R$ ${avg.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits:0})}</div>
                    </div>
                     <div style="font-size:24px; color:#10b981; opacity:0.8;"><i class="fas fa-chart-bar"></i></div>
                </div>`;
            }

            // Create Modal
            const modalId = 'live-scraper-modal';
            let modal = document.getElementById(modalId);
            if (!modal) {
                modal = document.createElement('div');
                modal.id = modalId;
                modal.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.7); z-index:999999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(4px); -webkit-backdrop-filter:blur(4px);";
                document.body.appendChild(modal);
            }

            modal.innerHTML = `
                <div style="background:white; width:90%; max-width:480px; border-radius:12px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.25); overflow:hidden; animation: fadeIn 0.3s ease;">
                    <div style="padding:15px 20px; background:linear-gradient(to right, #6366f1, #8b5cf6); color:white; display:flex; justify-content:space-between; align-items:center;">
                         <div style="font-weight:700; display:flex; align-items:center; gap:8px;"><i class="fas fa-radar"></i> Radar de Mercado WEB</div>
                         <button onclick="document.getElementById('${modalId}').remove()" style="background:transparent; border:none; color:white; font-size:20px; cursor:pointer;">&times;</button>
                    </div>
                    <div style="padding:20px; max-height:65vh; overflow-y:auto;">
                        ${infoSummary}
                        ${outputHtml}
                    </div>
                </div>
            `;
            
            window.Toast.success("Análise web concluída com sucesso!");

        } catch (e) {
            console.error(e);
            window.Toast.error("Falha ao escanear web: " + e.message);
        }
    }

    /**
     * Gerador de Whatspp com Dados da Unidade
     */
    function sendFichaWhatsApp(lote, unit) {
        let uLogradouro = unit.logradouro || lote.logradouro || '';
        uLogradouro = uLogradouro.replace(/\s+N[°º]?\s*\d+$/i, '').trim();
        let uNum = unit.numero ? String(unit.numero).replace(/^0+/, '') : (lote.numero ? String(lote.numero).replace(/^0+/, '') : '');
        let uBairro = unit.bairro_unidade || lote.bairro || '';
        let uAddr = uLogradouro ? (uLogradouro + (uNum && uNum !== 'null' ? ', ' + uNum : '')) : '';
        if (uBairro && uBairro !== 'null') uAddr += (uAddr ? ' - ' : '') + uBairro;

        let text = `*OPORTUNIDADE EXCLUSIVA | GUARUJÁ*\n\n`;
        text += `*${lote.building_name || 'Terreno/Área'}*\n`;
        text += `${uAddr}\n\n`;
        
        text += `*CARACTERÍSTICAS PRINCIPAIS*\n`;
        if(unit.metragem) text += `Área: ${unit.metragem}m²\n`;
        if(unit.quartos) text += `Quartos: ${unit.quartos}\n`;
        if(unit.suites) text += `Suítes: ${unit.suites}\n`;
        if(unit.vagas) text += `Vagas: ${unit.vagas}\n`;
        text += `\n`;

        if (unit.valor_vendavel || unit.valor_real) {
             text += `*INVESTIMENTO*\n`;
             if (unit.valor_vendavel) text += `Valor Pedido: R$ ${parseFloat(unit.valor_vendavel).toLocaleString('pt-BR')}\n`;
             if (unit.valor_real) text += `Valor Estimado: R$ ${parseFloat(unit.valor_real).toLocaleString('pt-BR')}\n`;
             text += `\n`;
        }
        
        text += `_Converse comigo para mais detalhes e agendar uma visita!_\n`;
        text += `*(Seu Nome Aqui)*`;

        const encodedText = encodeURIComponent(text);
        window.open(`https://wa.me/?text=${encodedText}`, '_blank');
        window.Toast.success("Resumo copiado para o WhatsApp!");
    }

    // Public API Object
    const api = {
        loadAnunciosForLote,
        getAnunciosCount,
        openPanel,
        checkBadge,
        liveScrapeWeb,
        sendFichaWhatsApp,
        getCurrentAnuncios: () => currentAnuncios
    };

    // Expose globally
    window.AnunciosHandler = api;
    console.log("✅ AnunciosHandler Assigned to window.AnunciosHandler");

    return api;
})();

// Safety check
if (!window.AnunciosHandler) {
    console.error("❌ AnunciosHandler Failed to Assign!");
}
