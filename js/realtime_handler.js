/**
 * Gerenciador de Tempo Real (realtime_handler.js)
 * Aqui eu trato as atualizações que vêm direto do Supabase quando alguém edita um lote.
 */

window.RealtimeHandler = {
    // Processa a mudança que veio do banco (Insert, Update ou Delete)
    handleUpdate: function(payload) {
        console.log("⏱️ Atualização em tempo real recebida:", payload);

        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newRow = payload.new;
            
            // Monta o objeto do lote no formato que o mapa gosta
            const updatedLote = {
                ...newRow,
                metadata: {
                    inscricao: newRow.inscricao,
                    zona: newRow.zona,
                    setor: newRow.setor,
                    lote: newRow.lote_geo,
                    quadra: newRow.quadra,
                    loteamento: newRow.loteamento,
                    bairro: newRow.bairro,
                    valor_m2: newRow.valor_m2 ? newRow.valor_m2.toString().replace('.', ',') : null
                },
                bounds_utm: {
                    minx: newRow.minx, miny: newRow.miny, maxx: newRow.maxx, maxy: newRow.maxy
                },
                unidades: [] // As unidades a gente carrega sob demanda se precisar
            };

            // Atualiza na nossa lista global (window.allLotes)
            const existingIndex = window.allLotes.findIndex(l => l.inscricao === updatedLote.inscricao);
            if (existingIndex >= 0) {
                window.allLotes[existingIndex] = updatedLote;
            } else {
                window.allLotes.push(updatedLote);
            }

            // Manda o mapa se atualizar pra mostrar a mudança na hora
            if (window.processDataHierarchy) window.processDataHierarchy();
            if (window.renderHierarchy) window.renderHierarchy();
            
            window.Toast?.info(`Lote ${updatedLote.inscricao} atualizado agora mesmo!`);
            
        } else if (payload.eventType === 'DELETE') {
            const inscricao = payload.old.inscricao;
            // Tira da lista global
            window.allLotes = window.allLotes.filter(l => l.inscricao !== inscricao);
            
            if (window.processDataHierarchy) window.processDataHierarchy();
            if (window.renderHierarchy) window.renderHierarchy();
            
            window.Toast?.warning(`Lote ${inscricao} foi removido do mapa.`);
        }
    }
};

// Atalho global
window.handleRealtimeUpdate = (payload) => window.RealtimeHandler.handleUpdate(payload);
