/**
 * Gestor de Sincronização de Dados (sync_handler.js)
 * Aqui eu cuido de tudo que entra e sai de dados: Cache local, sincronização total e busca por área.
 */

window.SyncHandler = {
    isCachedLoaded: false,

    // Inicializa os dados do mapa (tenta cache primeiro, depois vai pro banco)
    init: async function() {
        try {
            console.log("📦 SyncHandler: Iniciando sincronização...");
            
            // 1. Tenta carregar do cache local pra dar um "boot" rápido
            let cached = await window.loadLotesFromCache();

            if (cached && cached.data && cached.data.length > 0) {
                console.log(`📦 Cache encontrado: ${cached.data.length} lotes.`);
                window.allLotes = cached.data;
                window.allLotesSet = new Set(window.allLotes.map(l => l.inscricao));

                // Processa a hierarquia (Zonas/Setores) e mostra no mapa
                window.processDataHierarchy();
                if (window.MarinhaHandler) window.MarinhaHandler.analyzeMarineAreas(window.allLotes);
                window.renderHierarchy();
                
                this.updateCounter(`${window.allLotes.length.toLocaleString()} Lotes (Local)`);
                this.isCachedLoaded = true;
                
                window.Loading?.hide();
                window.Toast?.info('Dados locais carregados. Sincronizando com a nuvem...', 'Início Rápido');
            }

            // 2. Se não tinha nada no cache, pega uma "semente" inicial do banco
            if (!this.isCachedLoaded) {
                await this.fetchInitialSeed();
            }

            // 3. Inicia a sincronização total em segundo plano (pra não travar o mapa)
            this.syncFullData();

            // 4. Se inscreve no tempo real do Supabase
            this.setupRealtime();

            // Salva o que pegamos até agora no cache
            await window.saveLotesToCache(window.allLotes);

        } catch (e) {
            console.error("❌ Erro na sincronização:", e);
        }
    },

    // Pega os primeiros 2000 lotes pra não começar com o mapa vazio
    fetchInitialSeed: async function() {
        console.log("🌐 Buscando semente inicial de dados...");
        const { data, error } = await window.supabaseApp
            .from('v_lotes_tipados')
            .select('*')
            .eq('municipio', window.currentCity || 'Guarujá')
            .limit(2000);

        if (!error && data) {
            window.allLotes = data.map(row => this.normalizeLote(row));
            window.allLotesSet = new Set(window.allLotes.map(l => l.inscricao));
            
            window.processDataHierarchy();
            if (window.MarinhaHandler) window.MarinhaHandler.analyzeMarineAreas(window.allLotes);
            window.renderHierarchy();
            this.updateCounter(`${window.allLotes.length.toLocaleString()} Lotes`);
        }
    },

    // Sincronização Total Silenciosa: Baixa tudo em pedaços de 1000
    syncFullData: async function() {
        console.log("🔄 Iniciando varredura total em background...");
        let from = 0;
        const chunkSize = 1000;
        let isFetching = true;

        while (isFetching) {
            const to = from + chunkSize - 1;
            const { data, error } = await window.supabaseApp
                .from('lotes')
                .select('*')
                .eq('municipio', window.currentCity || 'Guarujá')
                .range(from, to);

            if (error || !data || data.length === 0) {
                isFetching = false;
                break;
            }

            let newCount = 0;
            data.forEach(row => {
                if (!window.allLotesSet.has(row.inscricao)) {
                    window.allLotesSet.add(row.inscricao);
                    window.allLotes.push(this.normalizeLote(row));
                    newCount++;
                }
            });

            if (newCount > 0) {
                window.processDataHierarchy();
                if (window.MarinhaHandler) window.MarinhaHandler.analyzeMarineAreas(window.allLotes);
                this.updateCounter(`${window.allLotes.length.toLocaleString()} Lotes`);
            }

            if (data.length < chunkSize) break;
            from += chunkSize;
        }
        
        // No final de tudo, guarda no cache o banco inteiro
        await window.saveLotesToCache(window.allLotes);
        console.log("✅ Sincronização total finalizada.");
    },

    // Busca lotes baseados na área que o usuário está vendo no mapa
    loadLotesInViewport: async function() {
        if (!window.map || window.map.getZoom() < 14) return;
        
        const bounds = window.map.getBounds();
        if (!bounds) return;

        const ne = window.latLonToUtm(bounds.getNorthEast().lat(), bounds.getNorthEast().lng());
        const sw = window.latLonToUtm(bounds.getSouthWest().lat(), bounds.getSouthWest().lng());
        
        const padding = 200; // Margem de segurança pra não carregar toda hora

        const { data, error } = await window.supabaseApp
            .from('lotes')
            .select('*')
            .eq('municipio', window.currentCity || 'Guarujá')
            .gte('maxx', sw.x - padding).lte('minx', ne.x + padding)
            .gte('maxy', sw.y - padding).lte('miny', ne.y + padding)
            .limit(1000);

        if (!error && data) {
            let added = false;
            data.forEach(row => {
                if (!window.allLotesSet.has(row.inscricao)) {
                    window.allLotesSet.add(row.inscricao);
                    window.allLotes.push(this.normalizeLote(row));
                    added = true;
                }
            });

            if (added) {
                window.processDataHierarchy();
                if (window.MarinhaHandler) window.MarinhaHandler.analyzeMarineAreas(window.allLotes);
                window.renderHierarchy();
                this.updateCounter(`${window.allLotes.length.toLocaleString()} Lotes`);
            }
        }
    },

    // Normaliza o objeto do lote pra não dar erro de undefined depois
    normalizeLote: function(row) {
        return {
            ...row,
            metadata: {
                inscricao: row.inscricao,
                zona: row.zona,
                setor: row.setor,
                lote: row.lote_geo,
                quadra: row.quadra,
                loteamento: row.loteamento,
                bairro: row.bairro,
                valor_m2: row.valor_m2 ? row.valor_m2.toString().replace('.', ',') : null
            },
            bounds_utm: {
                minx: row.minx, miny: row.miny, maxx: row.maxx, maxy: row.maxy
            }
        };
    },

    // Configura o Realtime do Supabase pra escutar mudanças
    setupRealtime: function() {
        window.supabaseApp.channel('map_sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'lotes' }, payload => {
                window.handleRealtimeUpdate?.(payload);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'unidades' }, payload => {
                window.handleRealtimeUpdate?.(payload);
            })
            .subscribe();
    },

    // Atualiza o contador de lotes na tela
    updateCounter: function(text) {
        const el = document.getElementById('totalLotes');
        if (el) el.innerText = text;
    },

    // Carrega todos os lotes de uma zona específica
    loadZoneData: async function(zoneId) {
        if (!window.supabaseApp) return;
        const toastId = window.Toast?.info(`Sincronizando Zona ${zoneId}...`, "Aguarde", 0);
        
        try {
            const { data, error } = await window.supabaseApp
                .from('lotes')
                .select('*')
                .eq('municipio', window.currentCity || 'Guarujá')
                .eq('zona', zoneId);

            if (!error && data) {
                let added = false;
                data.forEach(row => {
                    if (!window.allLotesSet.has(row.inscricao)) {
                        window.allLotesSet.add(row.inscricao);
                        window.allLotes.push(this.normalizeLote(row));
                        added = true;
                    }
                });
                if (added) window.processDataHierarchy();
            }
        } finally {
            if (toastId) window.Toast?.hide(toastId);
        }
    },

    // Garante que todos os lotes de um setor estejam carregados
    loadSectorData: async function(sectorId) {
        if (!window.supabaseApp) return;
        const toastId = window.Toast?.info(`Carregando Setor ${sectorId}...`, "Sincronizando", 0);

        try {
            const { data, error } = await window.supabaseApp
                .from('lotes')
                .select('*')
                .eq('municipio', window.currentCity || 'Guarujá')
                .eq('setor', sectorId);

            if (!error && data) {
                let added = false;
                data.forEach(row => {
                    if (!window.allLotesSet.has(row.inscricao)) {
                        window.allLotesSet.add(row.inscricao);
                        window.allLotes.push(this.normalizeLote(row));
                        added = true;
                    }
                });
                if (added) window.processDataHierarchy();
            }
        } finally {
            if (toastId) window.Toast?.hide(toastId);
        }
    }
};

// Atalhos globais pra manter o resto do app funcionando
window.initMapData = () => window.SyncHandler.init();
window.loadLotesInViewport = () => window.SyncHandler.loadLotesInViewport();
window.syncFullData = () => window.SyncHandler.syncFullData();
window.loadZoneData = (id) => window.SyncHandler.loadZoneData(id);
window.loadSectorData = (id) => window.SyncHandler.loadSectorData(id);
