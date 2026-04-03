/**
 * USER UNIT STATUS HANDLER (CRM PESSOAL)
 * Gerencia o estado comercial privado de cada unidade para o usuário logado.
 */
window.UserUnitStatusHandler = {
    _cache: {}, // Cache temporário por prédio { lote_inscricao: { unit_inscricao: status } }
    
    // Status Disponíveis & Cores/Emoji correspondentes
    STATUS_CONFIG: {
        'disponivel':  { label: 'Disponível',     emoji: '🔵', color: '#10b981' },
        'captada':     { label: 'Captada',        emoji: '🟢', color: '#059669' },
        'negociando':  { label: 'Em Negociação',  emoji: '🟡', color: '#f59e0b' },
        'fechado':     { label: 'Vendido/Fechado', emoji: '🏆', color: '#6366f1' },
        'prioridade':  { label: 'Prioridade',     emoji: '🔥', color: '#ef4444' }
    },

    /**
     * Busca todos os status pessoais das unidades de um lote específico.
     * Otimizado para 1 query por prédio.
     */
    async fetchStatusMapForLot(loteInscricao) {
        try {
            const { data: { user } } = await window.supabaseApp.auth.getUser();
            if (!user) return {};

            // Busca todos os registros do usuário para esse lote (LIKE prefixo ou match na lista)
            const { data, error } = await window.supabaseApp
                .from('user_unit_status')
                .select('unit_inscricao, status')
                .eq('user_id', user.id)
                .like('unit_inscricao', `${loteInscricao}%`);

            if (error) throw error;

            // Transforma em mapa para busca rápida O(1) na renderização
            const map = {};
            data.forEach(row => {
                map[row.unit_inscricao] = row.status;
            });

            this._cache[loteInscricao] = map;
            return map;
        } catch (e) {
            console.error('[CRM] Erro ao buscar status pessoal:', e);
            return {};
        }
    },

    /**
     * Retorna o status atual de uma unidade (Busca Cache -> Default)
     */
    getStatus(unitInscricao) {
        const loteInscricao = unitInscricao.substring(0, 12);
        const map = this._cache[loteInscricao] || {};
        return map[unitInscricao] || 'disponivel';
    },

    /**
     * Retorna o objeto completo de configuração do status atual
     */
    getStatusConfig(status) {
        return this.STATUS_CONFIG[status] || this.STATUS_CONFIG['disponivel'];
    },

    /**
     * Atualiza o status pessoal de uma unidade no banco e no cache
     */
    async updateStatus(unitInscricao, status) {
        try {
            const { data: { user } } = await window.supabaseApp.auth.getUser();
            if (!user) {
                window.Toast.error('Usuário não autenticado.');
                return false;
            }

            const loteInscricao = unitInscricao.substring(0, 12);

            // UPSERT (Insere ou Atualiza se já existir para este user/unit)
            const { error } = await window.supabaseApp
                .from('user_unit_status')
                .upsert({
                    user_id: user.id,
                    unit_inscricao: unitInscricao,
                    status: status,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id, unit_inscricao' });

            if (error) throw error;

            // Atualiza cache local
            if (!this._cache[loteInscricao]) this._cache[loteInscricao] = {};
            this._cache[loteInscricao][unitInscricao] = status;

            window.Toast.success(`Status atualizado para: ${this.STATUS_CONFIG[status].label}`);
            return true;
        } catch (e) {
            console.error('[CRM] Erro ao salvar status:', e);
            window.Toast.error('Erro ao salvar status comercial.');
            return false;
        }
    }
};

console.log("✅ UserUnitStatusHandler carregado (CRM Pessoal)");
