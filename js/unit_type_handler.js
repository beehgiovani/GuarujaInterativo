/**
 * Gestor de Tipos de Unidade (unit_type_handler.js)
 * Identifica se uma unidade e Garagem, Comercial ou Residencial.
 */

window.UnitTypeHandler = {
    detectType: function(unit) {
        if (!unit) return 'Residencial';

        const textToCheck = `${unit.complemento || ''} ${unit.inscricao || ''} ${unit.tipo || ''}`
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');

        const garageKeywords = ['garagem', 'vaga', 'box', 'moto', 'estacionamento', 'bicicletario'];
        if (garageKeywords.some(kw => textToCheck.includes(kw))) return 'Garagem';

        const commercialKeywords = ['loja', 'comercial', 'escritorio', 'sala', 'consultorio', 'store'];
        if (commercialKeywords.some(kw => textToCheck.includes(kw))) return 'Comercial';

        return 'Residencial';
    },

    checkAndFix: async function(unit) {
        if (!unit) return;

        const detectedType = this.detectType(unit);
        const currentType = (unit.tipo || '').toLowerCase();

        if (detectedType === 'Garagem' && currentType !== 'garagem') {
            unit.tipo = 'Garagem';
            this.silentUpdate(unit.inscricao, 'Garagem');
            return 'Garagem';
        }

        if (detectedType === 'Comercial' && !['loja', 'comercial', 'sala'].includes(currentType)) {
            unit.tipo = 'Comercial';
            this.silentUpdate(unit.inscricao, 'Comercial');
            return 'Comercial';
        }

        return unit.tipo || detectedType;
    },

    silentUpdate: async function(inscricao, newType) {
        try {
            await window.supabaseApp
                .from('unidades')
                .update({ tipo: newType })
                .eq('inscricao', inscricao);

            console.log(`Unidade ${inscricao} atualizada para ${newType} no banco.`);
            window.Toast?.success(`Unidade classificada como ${newType} automaticamente.`);
        } catch (err) {
            console.error('Falha no auto-fix silencioso:', err);
        }
    }
};

window.detectUnitType = (u) => window.UnitTypeHandler.detectType(u);
window.checkAndFixUnitType = (u) => window.UnitTypeHandler.checkAndFix(u);
