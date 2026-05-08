/**
 * Gestor do Tooltip de Lote (lot_tooltip_handler.js)
 * Cuida da visão geral do prédio, carrossel de fotos e grade de unidades.
 */

window.LotTooltipHandler = {
    // Abre o tooltip principal do lote
    show: async function(lote, x, y, isRefresh = false, targetTab = null, targetScroll = null) {
        if (!lote) return;
        
        // Evita refreshes excessivos em curto intervalo
        if (isRefresh && lote._lastRefresh && (Date.now() - lote._lastRefresh < 2000)) return;
        if (isRefresh) lote._lastRefresh = Date.now();

        // 1. CRM PESSOAL: Status de carteira
        if (window.UserUnitStatusHandler) {
            await window.UserUnitStatusHandler.fetchStatusMapForLot(lote.inscricao);
        }

        window.currentTooltipType = 'lote';
        window.currentLoteForUnit = lote;

        // 2. Histórico e Analytics
        if (window.HistoryHandler) window.HistoryHandler.add(lote);
        if (window.Analytics) {
            window.Analytics.trackLotView(lote.inscricao, lote.zona, lote.bairro, lote.building_name);
        }

        // 3. Renderização
        this.render(lote, isRefresh, targetTab, targetScroll);
    },

    render: function(lote, isRefresh = false, targetTab = null, targetScroll = null) {
        if (!window.LotTooltipUI) {
            console.error("❌ LotTooltipUI não carregado!");
            return;
        }

        const html = window.LotTooltipUI.render(lote);
        
        if (window.currentTooltip) window.currentTooltip.remove();
        if (window.currentTooltip?.backdrop) window.currentTooltip.backdrop.remove();
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        const tooltipEl = tempDiv.firstElementChild;
        document.body.appendChild(tooltipEl);
        window.currentTooltip = tooltipEl;

        const backdrop = document.createElement('div');
        backdrop.className = 'sidebar-backdrop active';
        backdrop.style.zIndex = '9998';
        backdrop.onclick = window.closeLotTooltip;
        document.body.appendChild(backdrop);
        tooltipEl.backdrop = backdrop;

        // Renderiza a lista de unidades
        const unitListContainer = tooltipEl.querySelector(`#unit-list-container-${lote.inscricao}`);
        if (unitListContainer && window.TooltipUnitList) {
            window.TooltipUnitList.render(lote, unitListContainer);
        }

        // 4. Restaurar estado (Aba e Scroll)
        if (targetTab) {
            this.switchTab(tooltipEl.querySelector(`[onclick*="${targetTab}"]`), targetTab);
        }

        if (targetScroll) {
            const body = tooltipEl.querySelector('.lot-tooltip-body');
            if (body) body.scrollTop = targetScroll;
        }

        this.setupEvents(tooltipEl, lote);
        this.fetchAsyncData(lote);
    },

    setupEvents: function(el, lote) {
        const closeBtn = el.querySelector('.lot-tooltip-close');
        if (closeBtn) closeBtn.onclick = window.closeLotTooltip;

        // Previne fechamento do tooltip ao interagir com seus elementos
        ['click', 'mousedown', 'touchstart'].forEach(evt => {
            el.addEventListener(evt, e => e.stopPropagation());
        });

        // Handler de navegação entre abas
        window.switchLotTab = (tab) => this.switchTab(el, tab);
    },

    switchTab: function(el, tab) {
        const tabs = el.querySelectorAll('.lot-tab-content');
        const btns = el.querySelectorAll('.lot-tab-btn');
        
        tabs.forEach(t => {
            t.style.display = 'none';
            t.classList.remove('active');
        });
        btns.forEach(b => {
            b.classList.remove('active');
            b.style.opacity = '0.6';
            b.style.borderBottomColor = 'transparent';
        });

        const activeTab = el.querySelector(`#lot-tab-${tab}-content`);
        const activeBtn = el.querySelector(`#tab-btn-${tab}`);
        
        if (activeTab) {
            activeTab.style.display = 'block';
            activeTab.classList.add('active');
        }
        if (activeBtn) {
            activeBtn.classList.add('active');
            activeBtn.style.opacity = '1';
            activeBtn.style.borderBottomColor = '#60a5fa';
        }
    },

    // Busca dados assíncronos (lat/lng necessários)
    fetchAsyncData: function(lote) {
        const meta = lote.metadata || {};
        const lat = parseFloat(lote._lat || lote.latitude || meta.latitude);
        const lng = parseFloat(lote._lng || lote.longitude || meta.longitude);

        if (!lat || !lng) {
            console.warn("[LotTooltip] Missing lat/lng for async data fetching.", lote);
            return;
        }

        // Altimetria: Proxy via Google Maps Elevation API
        if (window.AdvancedMaps) {
            window.AdvancedMaps.getElevation(lat, lng).then(elev => {
                const el = document.getElementById(`elevation-value-${lote.inscricao}`);
                if (el) {
                    if (elev !== null) {
                        const h = parseFloat(elev);
                        let badge = h <= 2.5 ? 'PLANÍCIE' : (h <= 15 ? 'NÍVEL MÉDIO' : 'ELEVAÇÃO REFERENCIA "MAR"');
                        let color = h <= 2.5 ? '#3b82f6' : (h <= 15 ? '#10b981' : '#8b5cf6');

                        el.innerHTML = `
                            <span style="color: ${color}; font-weight: 800;">${h.toFixed(1)}m</span>
                            <div style="font-size: 8px; padding: 2px 4px; background: ${color}20; color: ${color}; border-radius: 4px; border: 1px solid ${color}40; margin-top: 2px;">${badge}</div>
                        `;
                    } else {
                        el.innerHTML = `<span style="color: #94a3b8; font-size: 10px;">Indisponível</span>`;
                    }
                }
            });
        }

        // POIs: Consulta via OpenStreetMap / Overpass
        if (window.OSMHandler) {
            const osmId = `osm-context-${lote.inscricao}`;
            setTimeout(() => {
                try {
                    window.OSMHandler.fetchPOIs(lat, lng, osmId);
                } catch (e) {
                    console.warn('[LotTooltip] OSM fetch error:', e);
                    const el = document.getElementById(osmId);
                    if (el) el.innerHTML = '<div style="padding:8px;text-align:center;color:#94a3b8;font-size:10px;">Vizinhança indisponível</div>';
                }
            }, 200);
        }

        // FOTOS: Busca inteligente no Google Places
        if (window.MediaHandler) {
            window.MediaHandler.fetchGooglePhotos(lote).then(urls => {
                if (urls && urls.length > 0) {
                    console.log(`[LotTooltip] Received ${urls.length} photos from Google.`);
                    // Se o tooltip ainda estiver aberto e for deste lote, atualiza a imagem
                    const img = document.querySelector('.tooltip-header-img img');
                    if (img && !lote.image_url) {
                        img.src = urls[0];
                    }
                }
            });
        }
    },

    // --- MÉTODOS DE EDIÇÃO (ADMIN) ---

    renameTower: async function(loteInscricao, oldName) {
        const newName = prompt(`Renomear grupo "${oldName}" para:`, oldName);
        if (!newName || newName === oldName) return;
        
        window.Loading?.show('Sincronizando...', 'Alterando nomes das unidades...');
        try {
            let query = window.supabaseApp.from('unidades').update({ complemento: newName }).eq('lote_inscricao', loteInscricao);
                
            if (oldName === 'Geral') query = query.is('complemento', null);
            else query = query.eq('complemento', oldName);
            
            const { error } = await query;
            if (error) throw error;
            
            // Atualiza estado local
            const lote = window.allLotes.find(l => l.inscricao === loteInscricao);
            if (lote && lote.unidades) {
                lote.unidades.forEach(u => {
                    const currentGroup = (u.complemento && u.complemento.trim().length > 1) ? u.complemento.trim() : 'Geral';
                    if (currentGroup === oldName) u.complemento = newName;
                });
            }
            
            window.Toast?.success('Grupo renomeado.');
            this.show(lote, 0, 0, true);
        } catch (e) {
            console.error(e);
            window.Toast?.error('Falha: ' + e.message);
        } finally {
            window.Loading?.hide();
        }
    },

    startEditMatricula: (id) => {
        document.getElementById(`matricula-display-${id}`).style.display = 'none';
        document.getElementById(`matricula-edit-form-${id}`).style.display = 'block';
    },

    cancelEditMatricula: (id) => {
        document.getElementById(`matricula-display-${id}`).style.display = 'flex';
        document.getElementById(`matricula-edit-form-${id}`).style.display = 'none';
    },

    saveMatriculaInline: async function(inscricao) {
        const input = document.getElementById(`input-matricula-${inscricao}`);
        const newValue = input ? input.value.trim() : '';
        
        window.Loading.show('Salvando...', 'Gravando matrícula');
        try {
            const isAdmin = ['admin', 'master'].includes(window.Monetization?.userRole);
            if (isAdmin) {
                const { error } = await window.supabaseApp.from('lotes').update({ matricula_mae: newValue }).eq('inscricao', inscricao);
                if (error) throw error;
                
                const lote = window.allLotes.find(l => l.inscricao === inscricao);
                if (lote) lote.matricula_mae = newValue;
                
                window.Toast.success('Matrícula atualizada.');
                this.show(lote, 0, 0, true);
            } else {
                window.Toast.info('Sugestão enviada.');
            }
        } catch (e) {
            window.Toast.error('Erro: ' + e.message);
        } finally {
            window.Loading.hide();
        }
    },

    handleQuickAssetUpload: async function(file, inscricao, type) {
        if (!file) return;
        window.Loading.show('Enviando...', `Subindo ${type}...`);
        
        try {
            const fileName = `${inscricao}_${type}_${Date.now()}.${file.name.split('.').pop()}`;
            const { data, error } = await window.supabaseApp.storage.from('lotes_images').upload(fileName, file);
            if (error) throw error;
            
            const { data: { publicUrl } } = window.supabaseApp.storage.from('lotes_images').getPublicUrl(fileName);
                
            const lote = window.allLotes.find(l => l.inscricao === inscricao);
            if (lote) {
                const currentList = Array.isArray(lote[type]) ? [...lote[type]] : [];
                currentList.push(publicUrl);
                
                const { error: dbError } = await window.supabaseApp.from('lotes').update({ [type]: currentList }).eq('inscricao', inscricao);
                if (dbError) throw dbError;
                
                lote[type] = currentList;
                window.Toast.success('Anexo enviado.');
                this.show(lote, 0, 0, true);
            }
        } catch (e) {
            window.Toast.error('Erro no upload: ' + e.message);
        } finally {
            window.Loading.hide();
        }
    }
};

// Aliases Globais
window.showLotTooltip = (l, x, y, r) => window.LotTooltipHandler.show(l, x, y, r);
window.renameTower = (ins, old) => window.LotTooltipHandler.renameTower(ins, old);
window.startEditMatricula = (ins) => window.LotTooltipHandler.startEditMatricula(ins);
window.cancelEditMatricula = (ins) => window.LotTooltipHandler.cancelEditMatricula(ins);
window.saveMatriculaInline = (ins) => window.LotTooltipHandler.saveMatriculaInline(ins);
window.handleQuickAssetUpload = (f, ins, t) => window.LotTooltipHandler.handleQuickAssetUpload(f, ins, t);
