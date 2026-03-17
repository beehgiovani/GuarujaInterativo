// ==========================================
// PREDICTIVE HANDLER - FAROL PREDITIVO
// ==========================================
// Platinum Level: Intelligence that identifies selling opportunities

window.PredictiveHandler = {
    /**
     * Calculates a sales score (0-100) for an owner
     * @param {object} owner - Owner data (from DB)
     * @returns {object} { score, reasons }
     */
    calculateScore: function(owner) {
        if (!owner) return { score: 0, reasons: [] };

        let score = 0;
        const reasons = [];

        // 0. Espólio (Prioridade Máxima para Venda)
        if (owner.nome_completo && owner.nome_completo.toUpperCase().startsWith('ESPOLIO')) {
            score += 85;
            reasons.push("⚖️ Espólio Identificado (Oportunidade Crítica)");
        }

        // 1. Possivelmente Falecido (Inventário é a oportunidade #1)
        if (owner.possivelmente_falecido) {
            score += 65;
            reasons.push("🚀 Inventário Potencial (Possível Falecimento)");
        }

        // 2. Idade Avançada (> 70 anos)
        if (owner.idade > 70) {
            score += 20;
            reasons.push("👵 Proprietário Sênio (Planejamento Sucessório)");
        } else if (owner.idade > 60) {
            score += 10;
        }

        // 3. Concentração de Patrimônio (> 5 imóveis)
        const totalProp = owner.total_propriedades || (owner.unidades ? owner.unidades.length : 0);
        if (totalProp > 10) {
            score += 15;
            reasons.push("🏢 Grande Carteira (Investidor Institucional)");
        } else if (totalProp > 3) {
            score += 5;
        }

        // 4. Tempo de Posse (Se tivermos data de aquisição - Simulado)
        // Se o enriquecimento foi feito há muito tempo, pode indicar estagnação
        if (owner.data_enriquecimento) {
            const lastSeen = new Date(owner.data_enriquecimento);
            const yearsSince = (new Date() - lastSeen) / (1000 * 60 * 60 * 24 * 365);
            if (yearsSince > 5) {
                score += 10;
                reasons.push("⏳ Posse Prolongada (> 5 anos)");
            }
        }

        // Cap at 100
        score = Math.min(score, 100);

        return {
            score,
            reasons,
            color: this.getScoreColor(score)
        };
    },

    getScoreColor: function(score) {
        if (score >= 80) return "#ef4444"; // Red - Hot
        if (score >= 50) return "#f59e0b"; // Orange/Yellow - Warm
        return "#3b82f6"; // Blue - Regular
    },

    /**
     * Fetches top opportunities from a specific zone/neighborhood
     */
    getHotLeads: async function(filters = {}) {
        console.log("🔥 Searching for hot leads with filters:", filters);
        
        try {
            const { data, error } = await window.supabaseApp.rpc('get_predictive_opportunities', {
                p_zone: filters.zone || null,
                p_min_score: filters.minScore || 30,
                p_type: filters.type || 'all'
            });

            if (error) throw error;
            return data || [];
        } catch (e) {
            console.error("Error in getHotLeads:", e);
            return [];
        }
    }
};
