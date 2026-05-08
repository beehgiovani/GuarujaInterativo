/**
 * Gestor de Tipos de Unidade (unit_type_handler.js)
 * Aqui eu cuido da inteligência que identifica se uma unidade é Garagem, Comercial ou Residencial
 * baseando-se no texto do complemento ou da inscrição.
 */

window.UnitTypeHandler = {
    // Detecta e corrige o tipo da unidade automaticamente
    checkAndFix: async function(unit) {
        if (!unit) return;
        
        const textToCheck = `${unit.complemento || ''} ${unit.inscricao || ''} ${unit.tipo || ''}`.toLowerCase();

        // 1. Regras para Garagem (Vagas, Box, etc)
        const garageKeywords = ['garagem', 'vaga', 'box', 'moto', 'estacionamento', 'bicicletario'];
        const matchesGarage = garageKeywords.some(kw => textToCheck.includes(kw));
        const isAlreadyGarage = (unit.tipo || '').toLowerCase() === 'garagem';

        if (matchesGarage && !isAlreadyGarage) {
            console.log(`🔧 Auto-Fix: Unidade ${unit.inscricao} detectada como Garagem.`);
            unit.tipo = 'Garagem';
            this.silentUpdate(unit.inscricao, 'Garagem');
            return 'Garagem';
        }

        // 2. Regras para Comercial (Lojas, Salas, Escritórios)
        const commercialKeywords = ['loja', 'comercial', 'escritorio', 'sala', 'consultorio'];
        const matchesCommercial = commercialKeywords.some(kw => textToCheck.includes(kw));
        const isAlreadyCommercial = ['loja', 'comercial', 'sala'].includes((unit.tipo || '').toLowerCase());

        if (matchesCommercial && !isAlreadyCommercial) {
            console.log(`🔧 Auto-Fix: Unidade ${unit.inscricao} detectada como Comercial.`);
            unit.tipo = 'Comercial';
            this.silentUpdate(unit.inscricao, 'Comercial');
            return 'Comercial';
        }

        return unit.tipo;
    },

    // Faz o update no banco de forma silenciosa pra não interromper o usuário
    silentUpdate: async function(inscricao, newType) {
        try {
            await window.supabaseApp
                .from('unidades')
                .update({ tipo: newType })
                .eq('inscricao', inscricao);
                
            console.log(`✅ Unidade ${inscricao} atualizada para ${newType} no banco.`);
            window.Toast?.success(`Unidade classificada como ${newType} automaticamente.`);
        } catch (err) {
            console.error("❌ Falha no auto-fix silencioso:", err);
        }
    }
};

// Atalhos globais
window.checkAndFixUnitType = (u) => window.UnitTypeHandler.checkAndFix(u);
