// ==========================================
// SEARCH & FILTER HANDLER (V1.0.1 - REFRESHED)
// ==========================================

window.currentSearchType = 'all';

// Initialize Search Listeners
window.setupSearchAndFilters = function () {
// Search function removed

    console.log("Initializing Search Handler...");

    // Filter Chips
    const chips = document.querySelectorAll('.filter-chip[data-search-type]');
    chips.forEach(chip => {
        chip.addEventListener('click', (e) => {
            const type = e.currentTarget.dataset.searchType;
            
            // Check Access (New curation rule)
            let featureId = null;
            if (type === 'building') featureId = 'search_building';
            if (type === 'owner') featureId = 'search_owner';
            if (type === 'property') featureId = 'search_property';
            if (type === 'opportunity') featureId = 'search_opportunity';

            if (featureId && window.Monetization && !window.Monetization.checkFeatureAccess(featureId)) {
                window.Monetization.showSubscriptionPlans();
                window.Toast.info("Este tipo de busca exige um plano superior.");
                return;
            }

            // UI Toggle
            chips.forEach(c => c.classList.remove('active'));
            e.currentTarget.classList.add('active');

            // Logic Update
            window.currentSearchType = type;
            console.log(`Search Type Changed to: ${window.currentSearchType}`);

            if (window.currentSearchType === 'opportunity') {
                const typeFilterRow = document.getElementById('typeFilterRow');
                if (typeFilterRow) typeFilterRow.style.display = 'flex';
                // Reset chips to 'all' on first enter
                window.switchOpportunityType('all', false); 
                window.performOpportunitySearch();
                return;
            } else {
                const typeFilterRow = document.getElementById('typeFilterRow');
                if (typeFilterRow) typeFilterRow.style.display = 'none';
            }

            // Re-run search if input is present
            const query = document.getElementById('searchInput').value;
            if (query && query.length >= 3) {
                window.performSearch(query);
            }
        });
    });

    // Search Input Logic
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('searchClearBtn');

    if (searchInput) {
        let searchTimeout;
        searchInput.oninput = (e) => {
            const query = e.target.value;
            
            // Toggle Clear Button
            if (clearBtn) clearBtn.style.display = query ? 'flex' : 'none';

            // Debounced Search
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                if (query.length >= 3) {
                    window.performSearch(query);
                } else if (query.length === 0) {
                    window.clearSearchResults();
                }
            }, 600);
        };
        // --- CUSTOM GOOGLE PLACES INTEGRATION ---
        window.initSearchAutocomplete = async function() {
            if (!window.google || !window.google.maps) return;
            
            try {
                const { AutocompleteService, PlacesService } = await google.maps.importLibrary("places");
                const autocompleteService = new AutocompleteService();
                const placesService = new PlacesService(document.createElement('div'));
                
                const input = document.getElementById('searchInput');
                const suggestionsBox = document.getElementById('googleSuggestions');
                if (!input || !suggestionsBox) return;

                const guarujaBounds = new google.maps.LatLngBounds(
                    { lat: -24.03, lng: -46.33 }, // South West
                    { lat: -23.85, lng: -46.10 }  // North East
                );

                let googleTimeout;
                input.addEventListener('input', (e) => {
                    const query = e.target.value;
                    clearTimeout(googleTimeout);

                    if (!query || query.length < 3) {
                        suggestionsBox.innerHTML = '';
                        suggestionsBox.classList.add('hidden');
                        return;
                    }

                    googleTimeout = setTimeout(() => {
                        autocompleteService.getPlacePredictions({
                            input: query,
                            locationBias: guarujaBounds,
                            origin: guarujaBounds.getCenter(),
                            componentRestrictions: { country: 'br' }
                        }, (predictions, status) => {
                            if (status !== google.maps.places.PlacesServiceStatus.OK || !predictions) {
                                suggestionsBox.innerHTML = '';
                                suggestionsBox.classList.add('hidden');
                                return;
                            }

                            // Filtro extra manual para garantir que o resultado seja no Guarujá
                            const filtered = predictions.filter(p => 
                                p.description.toLowerCase().includes('guaruja') || 
                                p.description.toLowerCase().includes('guarujá')
                            );

                            if (filtered.length > 0) {
                                renderGoogleSuggestions(filtered);
                            } else {
                                suggestionsBox.innerHTML = '';
                                suggestionsBox.classList.add('hidden');
                            }
                        });
                    }, 300);
                });

                function renderGoogleSuggestions(predictions) {
                    suggestionsBox.innerHTML = '';
                    
                    predictions.forEach(prediction => {
                        const item = document.createElement('div');
                        item.className = 'suggestion-item';
                        item.innerHTML = `
                            <i class="fas fa-map-marker-alt"></i>
                            <div class="suggestion-text">
                                <span class="suggestion-main">${prediction.structured_formatting.main_text}</span>
                                <span class="suggestion-sub">${prediction.structured_formatting.secondary_text}</span>
                            </div>
                        `;
                        item.onclick = () => selectGoogleSuggestion(prediction);
                        suggestionsBox.appendChild(item);
                    });

                    suggestionsBox.classList.remove('hidden');
                }

                async function selectGoogleSuggestion(prediction) {
                    input.value = prediction.description;
                    suggestionsBox.innerHTML = '';
                    suggestionsBox.classList.add('hidden');

                    placesService.getDetails({
                        placeId: prediction.place_id,
                        fields: ['geometry', 'address_components']
                    }, (place, status) => {
                        if (status === google.maps.places.PlacesServiceStatus.OK && place.geometry && place.geometry.location) {
                            const lat = place.geometry.location.lat();
                            const lng = place.geometry.location.lng();

                            // EXTRA VALIDATION: Check if address is actually in Guarujá
                            const isGuaruja = place.address_components.some(c => 
                                (c.types.includes("locality") || c.types.includes("administrative_area_level_2")) &&
                                (c.long_name.toLowerCase().includes("guaruja") || c.long_name.toLowerCase().includes("guarujá"))
                            );

                            if (!isGuaruja) {
                                window.Toast.warning("Este endereço está fora do Guarujá.", "Localização Externa");
                                return;
                            }

                            // 1. Cross-reference with our DB FIRST
                            const nearestLot = window.findNearestLot(lat, lng);
                            
                            if (nearestLot) {
                                window.Toast.success("Lote identificado no banco de dados!", "Sincronização Farol");
                                // 2. Use internal navigation (handles flight + tooltip)
                                window.navigateToInscricao(nearestLot.inscricao);
                            } else {
                                // Fallback: fly to Google point if lot not found
                                window.Toast.info("Endereço encontrado (Google Maps).");
                                window.cinematicFlight({ lat, lng }, 19, 45);
                            }

                            // 3. Trigger local search for the street too
                            const route = place.address_components.find(c => c.types.includes("route"));
                            if (route) {
                                window.performSearch(route.long_name);
                            }
                        }
                    });
                }

                // Close suggestions on outside click
                document.addEventListener('click', (e) => {
                    if (!input.contains(e.target) && !suggestionsBox.contains(e.target)) {
                        suggestionsBox.classList.add('hidden');
                    }
                });

            } catch (e) {
                console.error("Custom Autocomplete failed", e);
            }
        };
    }

    if (clearBtn) {
        clearBtn.onclick = () => {
            window.clearSearchResults();
        };
    }

    const searchBtn = document.getElementById('searchBtn');
    if (searchBtn) {
        searchBtn.onclick = () => {
            const query = searchInput.value;
            if (query && query.length >= 3) {
                window.performSearch(query);
            }
        };
    }

    if (searchInput) {
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const query = e.target.value;
                if (query && query.length >= 3) {
                    window.performSearch(query);
                    // Hide google suggestions if open
                    const suggestionsBox = document.getElementById('googleSuggestions');
                    if (suggestionsBox) suggestionsBox.classList.add('hidden');
                }
            }
        });
    }
};

window.clearSearchResults = function() {
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('searchClearBtn');
    if (searchInput) searchInput.value = '';
    if (clearBtn) clearBtn.style.display = 'none';
    document.getElementById('searchResults')?.classList.add('hidden');
    document.getElementById('sidebar')?.classList.remove('searching');
    document.querySelector('.search-box')?.classList.remove('loading');
};

window.performSearch = async function (query) {
    if (!query || query.trim().length < 2) {
        window.Toast.warning('Digite pelo menos 2 caracteres.');
        return;
    }

    if (query.trim().toLowerCase() === 'null') {
        window.Toast.error('A palavra "null" não é um termo de busca válido.');
        return;
    }

    // Format for Text Search (Prefix matching on all terms)
    // "Rua do Sol" -> "'Rua':* & 'do':* & 'Sol':*"
    const formatTsQuery = (input) => {
        // 1. Remove accents (NFD normalization)
        let clean = input.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        // 2. Remove special chars except spaces, alphanumeric and basic punctuation if needed
        clean = clean.replace(/['"]/g, ""); // Remove quotes to prevent query errors

        return clean.trim().split(/\s+/).filter(w => w.length > 0).map(w => `'${w}':*`).join(' & ');
    };

    const tsQuery = formatTsQuery(query);
    const cleanDigits = query.replace(/\D/g, '');
    const isNumeric = cleanDigits.length >= 3;
    const type = window.currentSearchType;
    let results = [];

    // VERIFICADOR DE PRIVILÉGIOS 
    const role = window.Monetization ? window.Monetization.userRole : 'user';
    const isOwnerSearchAllowed = window.Monetization ? window.Monetization.checkFeatureAccess('search_owner') : false;
    const isBuildingSearchAllowed = window.Monetization ? window.Monetization.checkFeatureAccess('search_building') : true; // Usually minimal building search allowed

    const searchBox = document.querySelector('.search-box');
    if (searchBox) searchBox.classList.add('loading');

    try {
        console.log(`Searching for "${tsQuery}" (TextSearch) with type "${type}"`);

        // 1. Street Search (Old functionality preserved)
        if (type === 'all' || type === 'street') {
            // Check if query contains a number at the end
            let streetTerm = query.trim();
            const numberMatch = streetTerm.match(/^(.*?)(?:\s+(?:nº?|num|no|-)?\s*)(\d+)$/i);

            let queryBuilder = window.supabaseApp
                .from('unidades')
                .select('inscricao, endereco_completo, numero, bairro_unidade, lote_inscricao');

            if (window.currentCity) {
                queryBuilder = queryBuilder.eq('municipio', window.currentCity);
            }

            if (numberMatch) {
                const rawStreet = numberMatch[1].trim();
                const rawNumber = numberMatch[2];
                const paddedNumber = rawNumber.padStart(5, '0');
                const unpaddedNumber = parseInt(rawNumber, 10).toString();
                const variants = [...new Set([rawNumber, paddedNumber, unpaddedNumber])];
                const streetTsQuery = formatTsQuery(rawStreet);

                queryBuilder = queryBuilder
                    .textSearch('endereco_completo', streetTsQuery, { config: 'portuguese' })
                    .in('numero', variants);
            } else {
                queryBuilder = queryBuilder
                    .textSearch('endereco_completo', tsQuery, { config: 'portuguese' });
            }

            const { data: streets } = await queryBuilder.limit(20);

            if (streets) {
                results = results.concat(streets.map(item => {
                    // Strictly string-based logic to avoid NaN
                    let address = String(item.endereco_completo || '').trim();
                    let houseNum = String(item.numero || '').replace(/^0+/, '').trim();

                    // Sanitize House Number
                    if (houseNum === 'NaN' || houseNum === 'null' || houseNum === 'undefined') {
                        houseNum = '';
                    }

                    // Build Label gracefully
                    let finalLabel = address;
                    if (houseNum && houseNum !== 'S/N' && !address.includes(houseNum)) {
                        finalLabel += ', ' + houseNum;
                    }

                    return {
                        ...item,
                        type: 'Rua',
                        label: finalLabel,
                        sub: `${item.bairro_unidade || '-'} - Ref: ${item.lote_inscricao || item.inscricao}`,
                        isUnit: true,
                        lote_inscricao: item.lote_inscricao
                    };
                }));
            }
        }

        // 2. Property / Building / Legacy Owner Search
        // "Imóveis" agora busca Edifícios + Proprietários nas UNIDADES (Legado)
        if (type === 'all' || type === 'property' || type === 'building') {
            const promises = [];

            // Edifícios
            promises.push(window.supabaseApp
                .from('lotes')
                .select('inscricao, building_name')
                .textSearch('building_name', tsQuery, { config: 'portuguese' })
                .eq('municipio', window.currentCity || 'Guarujá')
                .limit(10)
                .then(r => ({ type: 'building', data: r.data || [] })));

            // Proprietários na tabela de UNIDADES (Busca Clássica "Imóveis de Fulano")
            // Acesso restrito
            if (isOwnerSearchAllowed && (type === 'property' || type === 'all')) {
                let unitQuery = window.supabaseApp
                    .from('unidades')
                    .select('inscricao, nome_proprietario, cpf_cnpj, lote_inscricao, tipo, complemento, endereco_completo')
                    .eq('municipio', window.currentCity || 'Guarujá')
                    .limit(20);

                if (isNumeric) {
                    unitQuery = unitQuery.or(`nome_proprietario.ilike.%${query.trim()}%,cpf_cnpj.ilike.%${cleanDigits}%`);
                } else {
                    unitQuery = unitQuery.textSearch('nome_proprietario', tsQuery, { config: 'portuguese' });
                }

                promises.push(unitQuery.then(r => ({ type: 'legacy_unit', data: r.data || [] })));
            }

            const resultsData = await Promise.all(promises);

            resultsData.forEach(res => {
                if (res.type === 'building') {
                    results = results.concat(res.data.map(item => ({
                        ...item,
                        type: 'Edifício',
                        label: item.building_name || 'Edifício sem Nome',
                        sub: `Ref: ${item.inscricao || '-'}`,
                        loteInscricao: item.inscricao
                    })));
                } else if (res.type === 'legacy_unit') {
                    results = results.concat(res.data.map(item => {
                        const hasName = item.nome_proprietario && String(item.nome_proprietario).toLowerCase() !== 'null' && item.nome_proprietario.trim() !== '';
                        const hasAddress = item.endereco_completo && String(item.endereco_completo).toLowerCase() !== 'null' && item.endereco_completo.trim() !== '';
                        
                        const isUnlocked = window.Monetization && (window.Monetization.isEliteOrAbove() || window.Monetization.isUnlocked(item.inscricao, item.lote_inscricao));
                        
                        return {
                            ...item,
                            type: 'Imóvel',
                            label: hasName ? (isUnlocked ? item.nome_proprietario : window.maskName(item.nome_proprietario)) : (hasAddress ? item.endereco_completo : `Unidade ${item.complemento || 's/n'}`),
                            sub: hasName ? `${item.tipo || ''} ${item.complemento || ''} - ${hasAddress ? item.endereco_completo : (item.lote_inscricao || '-')}` : `Ref: ${item.lote_inscricao || item.inscricao}`,
                            isUnit: true,
                            loteInscricao: item.lote_inscricao
                        };
                    }));
                }
            });
        }

        // 3. New Owner Search (Unified Only)
        // Acesso restrito
        if (isOwnerSearchAllowed && (type === 'all' || type === 'owner')) {
            // Normaliza termo para bater com a coluna 'nome_busca' (que é lower + unaccent)
            // Atenção: Esta lógica depende da migration 12_fix_accents ter sido rodada no banco
            const term = query.trim();
            let ownerQuery = window.supabaseApp
                .from('proprietarios')
                .select('id, nome_completo, cpf_cnpj, total_propriedades')
                .limit(20);

            if (isNumeric) {
                // Se houver números, busca por CPF (limpo) ou Nome (parcial)
                ownerQuery = ownerQuery.or(`cpf_cnpj.ilike.%${cleanDigits}%,nome_completo.ilike.%${term}%`);
            } else {
                ownerQuery = ownerQuery.ilike('nome_completo', `%${term}%`);
            }

            const { data: owners } = await ownerQuery;
            
            // Note: Proprietarios table might need a municipio link in the future 
            // but for now they are global or matched via units.

            if (owners && owners.length > 0) {
                results = results.concat(owners.map(owner => {
                    const isUnlocked = window.Monetization && (window.Monetization.isEliteOrAbove() || window.Monetization.isUnlockedPerson(owner.cpf_cnpj));
                    return {
                        type: 'Proprietário',
                        label: (owner.nome_completo && owner.nome_completo !== 'null') ? (isUnlocked ? owner.nome_completo : window.maskName(owner.nome_completo)) : 'Sem Nome',
                        sub: `${owner.total_propriedades > 0 ? owner.total_propriedades + ' imóveis • ' : ''}CPF: ${window.formatDocument ? window.formatDocument(owner.cpf_cnpj, false) : owner.cpf_cnpj}`,
                        isOwner: true,
                        proprietarioId: owner.id,
                        inscricao: 'P-' + owner.id
                    };
                }));
            }
        }

        // Inscricao Search (Keep ILIKE just for safe number matching)
        if (type === 'all' || type === 'property') {
            const { data: byInscricao } = await window.supabaseApp
                .from('lotes')
                .select('inscricao, bairro')
                .ilike('inscricao', `%${query.trim()}%`)
                .eq('municipio', window.currentCity || 'Guarujá')
                .limit(5);

            if (byInscricao) {
                results = results.concat(byInscricao.map(item => ({
                    ...item,
                    type: 'Inscrição',
                    label: item.inscricao || '-',
                    sub: item.bairro || '-'
                })));
            }
        }

        // Deduplicate results by inscricao
        const uniqueResults = [];
        const seen = new Set();
        results.forEach(r => {
            if (!seen.has(r.inscricao)) {
                seen.add(r.inscricao);
                uniqueResults.push(r);
            }
        });

        window.displaySearchResults(uniqueResults);
        if (window.Analytics) {
            window.Analytics.trackSearch(query, type, uniqueResults.length);
        }

    } catch (e) {
        console.error("Search error:", e);
        window.Toast.error("Erro na busca.");
    } finally {
        if (searchBox) searchBox.classList.remove('loading');
    }
};

window.performOpportunitySearch = async function() {
    const isAllowed = window.Monetization ? window.Monetization.checkFeatureAccess('search_opportunity') : false;
    
    if (!isAllowed) {
        window.Toast.warning("Radar Farol bloqueado. Exclusivo para perfis Pro ou Superior.", "Acesso Restrito");
        return;
    }

    const searchBox = document.querySelector('.search-box');
    if (searchBox) searchBox.classList.add('loading');
    
    window.logActivity('opportunity_search', 'Busca por radar de oportunidades');
    window.Loading.show("Radar Farol Ativo...", "Buscando distorções de mercado");

    try {
        // Prioridade 1: Unidades com Valor de Avaliação (Real) > Valor Pedido (Vendável)
        // Prioridade 2: Unidades com status explicitamente como 'Oportunidade'
        const { data: opportunities, error } = await window.supabaseApp
            .from('unidades')
            .select('inscricao, endereco_completo, numero, bairro_unidade, lote_inscricao, valor_venal, valor_real, valor_vendavel, status_venda')
            .or('status_venda.eq.Oportunidade,valor_vendavel.gt.0')
            .order('status_venda', { ascending: false })
            .limit(50);

        if (error) throw error;

        // Filtrar e processar resultados
        const filteredOpps = (opportunities || []).filter(item => {
            if (item.status_venda === 'Oportunidade') return true;
            if (item.valor_real && item.valor_vendavel && item.valor_real > item.valor_vendavel) return true;
            return false;
        });

        const results = filteredOpps.map(item => {
            // Cálculo do GAP se houver dados (Valor Justo vs Valor Pedido)
            let gapLabel = "Oportunidade de Mercado";
            if (item.valor_real && item.valor_vendavel && item.valor_vendavel > 0) {
                const gapPerc = (((item.valor_real - item.valor_vendavel) / item.valor_vendavel) * 100).toFixed(0);
                if (gapPerc > 0) gapLabel = `Margem/Lucro Acumulado: +${gapPerc}%`;
            } else if (item.status_venda === 'Oportunidade') {
                gapLabel = "Potencial para Investidor";
            }

            // Limpeza de endereço (evita 'null' no UI)
            const num = item.numero && item.numero !== 'null' ? `, ${item.numero}` : '';
            const bairro = item.bairro_unidade && item.bairro_unidade !== 'null' ? ` - ${item.bairro_unidade}` : '';
            const end = item.endereco_completo && item.endereco_completo !== 'null' ? item.endereco_completo : item.inscricao;

            return {
                ...item,
                type: 'Edifício/Loteamento', // Categorizar para agrupar no UI
                label: gapLabel,
                sub: `${end}${num}${bairro}`,
                isUnit: true,
                lote_inscricao: item.lote_inscricao
            };
        });

        // Ordenar os que tem GAP real para o topo
        results.sort((a, b) => {
            const hasGapA = a.label.includes('%') ? 1 : 0;
            const hasGapB = b.label.includes('%') ? 1 : 0;
            return hasGapB - hasGapA;
        });

        window.displaySearchResults(results);
        window.Toast.success(`${results.length} oportunidades identificadas no radar.`);

    } catch (e) {
        console.error("Erro radar:", e);
        window.Toast.error("Erro ao processar radar de oportunidades.");
    } finally {
        if (searchBox) searchBox.classList.remove('loading');
        window.Loading.hide();
    }
};

window.lastSearchResults = [];

window.displaySearchResults = function (results) {
    const container = document.getElementById('searchResults');
    const sidebar = document.getElementById('sidebar');
    window.lastSearchResults = results;

    if (!results || results.length === 0) {
        container.innerHTML = '<div style="padding:20px; text-align:center; color:#64748b; font-size:13px; font-weight:500;">Nenhum resultado encontrado para esta filtragem.</div>';
        container.classList.remove('hidden');
        sidebar.classList.add('searching');
        return;
    }

    // --- Export Header ---
    container.innerHTML = `
            <div style="padding: 12px 16px; background: white; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 10;">
                <span style="font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">Encontrados: ${results.length}</span>
                <button onclick="window.downloadCSV(window.lastSearchResults, 'busca_guaruja_geo.csv')" 
                    style="background: #10b981; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 10px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2); transition: all 0.2s;"
                    onmouseover="this.style.background='#059669'; this.style.transform='translateY(-1px)'"
                    onmouseout="this.style.background='#10b981'; this.style.transform='none'">
                    <i class="fas fa-file-csv"></i> Exportar
                </button>
            </div>
        `;

    // Grouping Logic
    const groups = {
        'Rua': [],
        'Edifício/Loteamento': [],
        'Proprietário': [],
        'Outros': []
    };

    results.forEach(item => {
        const type = item.type || 'Outros';
        if (groups[type]) groups[type].push(item);
        else groups['Outros'].push(item);
    });

    const categories = [
        { id: 'Rua', label: 'Logradouros', icon: '🛣️', color: '#3b82f6' },
        { id: 'Edifício/Loteamento', label: 'Empreendimentos', icon: '🏢', color: '#8b5cf6' },
        { id: 'Proprietário', label: 'Proprietários', icon: '👤', color: '#f59e0b' },
        { id: 'Outros', label: 'Outros', icon: '📍', color: '#64748b' }
    ];

    categories.forEach(cat => {
        const items = groups[cat.id];
        if (items && items.length > 0) {
            const section = document.createElement('div');
            section.style.cssText = `
                padding: 12px 16px 4px;
                font-size: 10px;
                font-weight: 800;
                color: ${cat.color};
                text-transform: uppercase;
                letter-spacing: 1px;
                background: #f8fafc;
                display: flex;
                align-items: center;
                gap: 8px;
            `;
            section.innerHTML = `<span style="font-size: 14px;">${cat.icon}</span> ${cat.label}`;
            container.appendChild(section);

            items.forEach(item => {
                const div = document.createElement('div');
                div.className = 'search-item';
                div.style.cssText = `
                    padding: 12px 16px;
                    border-bottom: 1px solid #f1f5f9;
                    cursor: pointer;
                    transition: all 0.2s;
                    background: white;
                `;
                
                const displayLabel = item.label;

                div.innerHTML = `
                    <div class="result-title" style="font-weight: 700; font-size: 13px; color: #1e293b; margin-bottom: 2px;">
                        ${displayLabel}
                        ${(item.isOwner && !window.Monetization.isEliteOrAbove() && !window.Monetization.isUnlockedPerson(item.cpf_cnpj)) ? '<i class="fas fa-lock" style="font-size: 10px; margin-left: 4px; opacity: 0.5;"></i>' : ''}
                    </div>
                    <div class="result-subtitle" style="font-size: 11px; color: #64748b; display: flex; align-items: center; justify-content: space-between;">
                        <span>${item.sub || ''}</span>
                        ${item.isUnit ? `<span style="background: #e0f2fe; color: #0284c7; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 9px;">UNIDADE</span>` : ''}
                    </div>
                `;

                div.onmouseover = () => { div.style.background = '#f1f5f9'; };
                div.onmouseout = () => { div.style.background = 'white'; };
                div.onclick = () => window.handleResultClick(item);
                container.appendChild(div);
            });
        }
    });

    container.classList.remove('hidden');
    sidebar.classList.add('searching');
};

window.handleResultClick = async function (item) {
    console.log("Result clicked:", item);

    // MOBILE AUTO-COLLAPSE (Save state)
    if (window.innerWidth <= 768) {
        window.mobileSidebarWasOpen = true; // Flag for restoration
        if (window.closeMobileSidebar) window.closeMobileSidebar();
    }

    // 0. Handle Consolidated Owner Click (NEW FLOW)
    if (item.isOwner && item.proprietarioId) {
        if (window.ProprietarioTooltip) {
            window.ProprietarioTooltip.show(item.proprietarioId);
        } else {
            console.error("ProprietarioTooltip module not loaded");
            window.Toast.error("Erro: Módulo de proprietário não carregado.");
        }
        return;
    }

    // 1. Fetch Full Details (LEGACY FLOW - Works for Units, Lots, and Legacy Owners)
    if (item.isUnit) {
        window.navigateToInscricao(item.lote_inscricao, item.inscricao);
    } else {
        window.navigateToInscricao(item.inscricao);
    }
};

/**
 * Smooth camera transition ("Avião subindo e descendo")
 */
window.cinematicFlight = function(target, finalZoom = 19, finalTilt = 45) {
    if (!window.map) return Promise.resolve();

    return new Promise(resolve => {
        const startZoom = window.map.getZoom();
        const midZoom = Math.max(12, Math.min(startZoom, 14)); 

        console.log(`[Flight] Smooth take-off initiated`);
        window.map.setOptions({ gestureHandling: 'none' });

        // Use a more subtle status indicator if possible, or just don't block the whole screen
        // For now, we'll keep Loading.show but use the semi-transparent version we polished before
        window.Loading.show('Viajando...', 'Navegação em curso');

        // Step 1: Smooth Zoom Out (Take off)
        window.map.setZoom(midZoom);

        // Map pan starts almost immediately after zoom begins for a more dynamic feel
        setTimeout(() => {
            console.log(`[Flight] Panning...`);
            window.map.panTo(target);

            // Once the pan is done (idle), we descend
            google.maps.event.addListenerOnce(window.map, 'idle', () => {
                console.log(`[Flight] Descending and Tilting`);
                
                // Final landing: Move Zoom and Tilt together
                // Increase the 'fluidity' by reducing the wait time
                setTimeout(() => {
                    window.map.setZoom(finalZoom);
                    window.map.setTilt(finalTilt);

                    // Re-enable interaction after a short stabilization
                    setTimeout(() => {
                        window.map.setOptions({ gestureHandling: 'greedy' });
                        console.log(`[Flight] Arrived.`);
                        resolve();
                    }, 400);
                }, 100);
            });
        }, 300); 
    });
};

/**
 * Core Navigation Logic: Fly hierarchically to a lot/unit and open tooltip
 * @param {string} loteInscricao 
 * @param {string} unitInscricao (Optional)
 */
window.navigateToInscricao = async function (loteInscricao, unitInscricao = null) {
    if (!loteInscricao) return;

    window.Loading.show('Localizando...', 'Preparando vôo cinemático');

    try {
        const loteToOpen = await window.fetchLotDetails(loteInscricao);
        if (!loteToOpen) {
            window.Toast.error("Lote não encontrado.");
            return;
        }

        let unitToFocus = null;
        if (unitInscricao && loteToOpen.unidades) {
            unitToFocus = loteToOpen.unidades.find(u => u.inscricao === unitInscricao);
        }

        // --- Ensure Lot is in Hierarchy ---
        const existingIdx = window.allLotes.findIndex(l => l.inscricao === loteToOpen.inscricao);
        if (existingIdx >= 0) {
            window.allLotes[existingIdx] = loteToOpen;
        } else {
            window.allLotes.push(loteToOpen);
        }
        window.processDataHierarchy();

        // --- Calculate Target Coordinates ---
        let targetLat, targetLng;
        if (loteToOpen._lat && loteToOpen._lng) {
            targetLat = loteToOpen._lat;
            targetLng = loteToOpen._lng;
        } else if (loteToOpen.minx) {
            const cx = (loteToOpen.minx + loteToOpen.maxx) / 2;
            const cy = (loteToOpen.miny + loteToOpen.maxy) / 2;
            const ll = window.utmToLatLon(cx, cy);
            targetLat = ll.lat;
            targetLng = ll.lng;
        }

        const position = { lat: targetLat, lng: targetLng };

        // --- Navigation Sequence (Cinematic) ---
        const meta = loteToOpen.metadata || {};
        const targetZone = meta.zona || loteToOpen.zona;
        const targetSector = meta.setor || loteToOpen.setor;

        // Set Hierarchy context immediately so UI updates
        if (targetZone) {
            window.currentLevel = 2; // Directly to lot level contextually
            window.currentZone = targetZone;
            window.currentSector = targetSector;
            window.renderHierarchy();
        }

        // START CINEMATIC FLIGHT
        await window.cinematicFlight(position, 19, 45);

        // Open Tooltip after arrival
        if (unitToFocus && typeof window.showUnitTooltip === 'function') {
            window.showUnitTooltip(unitToFocus, loteToOpen, window.innerWidth / 2, window.innerHeight / 2);
        } else if (typeof window.showLotTooltip === 'function') {
            window.showLotTooltip(loteToOpen, window.innerWidth / 2, window.innerHeight / 2);
        }

    } catch (e) {
        console.error("Navigation error:", e);
        window.Toast.error("Erro na navegação.");
    } finally {
        window.Loading.hide();
    }
};


window.performOpportunitySearch = async function () {
    console.log("🔥 Searching for Platinum Opportunities...");
    
    // UI Loading State
    const searchResults = document.getElementById('searchResults');
    const sidebar = document.getElementById('sidebar');
    if (searchResults) searchResults.classList.remove('hidden');
    if (sidebar) sidebar.classList.add('searching');
    
    searchResults.innerHTML = '<div style="padding: 40px; text-align: center; color: #64748b;"><i class="fas fa-fire fa-spin" style="color: #ef4444; font-size: 24px; margin-bottom: 15px;"></i><br>Farol IA analisando o mercado...</div>';

    try {
        const zoneSelect = document.getElementById('opportunityZoneSelect');
        const activeChip = document.querySelector('.opt-chip.active');
        const zone = zoneSelect ? zoneSelect.value : (window.currentZone || null);
        const type = activeChip ? activeChip.dataset.type : 'all';
        
        console.log(`🔍 Filtering by Zone: ${zone || 'GLOBAL'}, Type: ${type}`);

        const { data: leads, error } = await window.supabaseApp.rpc('get_predictive_opportunities', {
            p_zone: zone || null,
            p_min_score: 30,
            p_type: type
        });

        if (error) throw error;

        if (!leads || leads.length === 0) {
            searchResults.innerHTML = `
                <div style="padding: 60px 20px; text-align: center;">
                    <div style="font-size: 40px; margin-bottom: 20px;">🌊</div>
                    <div style="font-weight: 800; font-size: 18px; color: #1e293b;">Mercado Calmo</div>
                    <p style="color: #64748b; font-size: 14px; margin-top: 10px;">Não encontramos oportunidades urgentes (Score > 70) nesta região no momento.</p>
                </div>
            `;
            return;
        }

        let html = `
            <div style="padding: 15px; background: #fee2e2; border-bottom: 1px solid #fecaca; color: #991b1b; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; display: flex; align-items: center; gap: 8px;">
                <i class="fas fa-fire"></i> ${leads.length} OPORTUNIDADES QUENTES
            </div>
        `;

        leads.forEach(lead => {
            const scoreColor = window.PredictiveHandler.getScoreColor(lead.score);
            const isSeller = lead.opportunity_type === 'seller';
            const typeLabel = isSeller ? 'VENDA' : 'COMPRA';
            const typeColor = isSeller ? '#ef4444' : '#10b981';
            const typeBg = isSeller ? '#fee2e2' : '#dcfce7';
            
            html += `
                <div class="search-result-item" onclick="window.ProprietarioTooltip.show(${lead.proprietario_id})" style="border-left: 4px solid ${scoreColor}; padding: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div style="flex: 1;">
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                                <span style="background: ${typeBg}; color: ${typeColor}; padding: 2px 8px; border-radius: 6px; font-size: 9px; font-weight: 900; border: 1px solid ${typeColor}30;">${typeLabel}</span>
                                <div style="font-weight: 800; font-size: 14px; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px;">
                                    ${window.Monetization.isEliteOrAbove() ? lead.nome_completo : window.maskName(lead.nome_completo)}
                                </div>
                            </div>
                            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
                                ${window.formatDocument(lead.cpf_cnpj, true)} · <b>${lead.total_propriedades}</b> Propriedades
                            </div>
                            <div style="margin-top: 8px; display: flex; gap: 6px; flex-wrap: wrap;">
                                <span style="background: ${scoreColor}15; color: ${scoreColor}; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 800;">
                                    SCORE: ${lead.score}
                                </span>
                                <span style="background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700;">
                                    ${lead.top_reason}
                                </span>
                            </div>
                        </div>
                        <div style="width: 32px; height: 32px; background: ${typeBg}; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: ${typeColor}; flex-shrink: 0;">
                            <i class="fas ${isSeller ? 'fa-sign-out-alt' : 'fa-shopping-cart'}"></i>
                        </div>
                    </div>
                </div>
            `;
        });

        searchResults.innerHTML = html;

    } catch (e) {
        console.error("Opportunity search failed:", e);
        searchResults.innerHTML = `<div style="padding:40px; text-align:center; color:#64748b;">Farol Temporariamente offline.</div>`;
    }
};

// Re-export fetchLotDetails if not globally available, but it should be in app.js
// We assume fetchLotDetails is window.fetchLotDetails in app.js.

window.switchOpportunityType = function(type, triggerSearch = true) {
    const chips = document.querySelectorAll('.opt-chip');
    chips.forEach(chip => {
        if (chip.dataset.type === type) {
            chip.classList.add('active');
            chip.style.background = 'white';
            chip.style.border = '1px solid #fcd34d';
            chip.style.fontWeight = '800';
            chip.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
        } else {
            chip.classList.remove('active');
            chip.style.background = 'rgba(255,255,255,0.5)';
            chip.style.border = '1px solid transparent';
            chip.style.fontWeight = '700';
            chip.style.boxShadow = 'none';
        }
    });

    if (triggerSearch) {
        window.performOpportunitySearch();
    }
};

// Initialize on Load
document.addEventListener('DOMContentLoaded', window.setupSearchAndFilters);
