// ==========================================
// ANALYTICS TRACKER
// ==========================================
// Captures system usage events and persists to Supabase
// ==========================================

window.Analytics = {
    sessionID: null,

    init: function () {
        this.sessionID = this.generateSessionID();
        console.log("📊 Analytics Initialized. Session:", this.sessionID);
    },

    generateSessionID: function () {
        return 'sess_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    },

    /**
     * Track a generic event
     * @param {string} type - 'search', 'view_lot', 'view_unit', 'crm_action', 'edit'
     * @param {object} data - Flexible payload
     */
    trackEvent: async function (type, data = {}) {
        if (!window.supabaseApp) return;

        try {
            const event = {
                event_type: type,
                event_data: data,
                user_session: this.sessionID,
                user_agent: navigator.userAgent
            };

            const { error } = await window.supabaseApp
                .from('analytics_events')
                .insert([event]);

            if (error) throw error;
            console.log(`📈 Event Tracked: ${type}`, data);

        } catch (e) {
            console.warn("⚠️ Analytics Error:", e.message);
        }
    },

    // --- Specialized Helpers ---

    trackSearch: function (query, type, resultsCount) {
        this.trackEvent('search', {
            query: query,
            searchType: type,
            results: resultsCount
        });
    },

    trackLotView: function (inscricao, zona, bairro) {
        this.trackEvent('view_lot', {
            inscricao: inscricao,
            zona: zona,
            bairro: bairro
        });
    },

    trackUnitView: function (inscricao, proprietario) {
        this.trackEvent('view_unit', {
            inscricao: inscricao,
            has_proprietario: !!proprietario
        });
    },

    trackCRMAction: function (action, target) {
        this.trackEvent('crm_action', {
            action: action,
            target: target
        });
    }
};

// Auto-init on load
window.Analytics.init();
