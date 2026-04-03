/**
 * RENOVATION RADAR - RENOVATION_RADAR.JS
 * Monitors certificates ("Certidões") and alerts when they expire (90 days).
 */

const RenovationRadar = {
    EXPIRATION_DAYS: 90,
    CHECK_INTERVAL_MS: 1000 * 60 * 60, // Check every hour

    init() {
        console.log("📡 Radar de Renovação Inicializado");

        // Initial check after short delay
        setTimeout(() => this.checkExpirations(), 5000);

        // Periodic check
        setInterval(() => this.checkExpirations(), this.CHECK_INTERVAL_MS);
    },

    async checkExpirations() {
        if (!window.supabaseApp) return;

        try {
            // 1. Calculate Threshold Date (Now - 90 days)
            const thresholdDate = new Date();
            thresholdDate.setDate(thresholdDate.getDate() - this.EXPIRATION_DAYS);
            const thresholdISO = thresholdDate.toISOString();

            // 2. Query 'notificacoes' for OLD certificates
            // We look for:
            // - tipo: 'certidao'
            // - created_at < thresholdISO
            // - lida: true (assuming we only care about ones user has seen/used, or maybe all?)
            // let's check all to be safe.

            const { data: oldCerts, error } = await window.supabaseApp
                .from('notificacoes')
                .select('*')
                .eq('tipo', 'certidao')
                .lt('created_at', thresholdISO)
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (!oldCerts || oldCerts.length === 0) return;

            // 3. Filter items that ALREADY have a "Renewal Alert" created recently
            // This prevents spamming the user every hour about the same expired cert.
            // We can check local storage or check if there is a 'renovacao' notification linked.

            const alertsNeeded = [];

            for (const cert of oldCerts) {
                const alertKey = `radar_alert_${cert.id}`;
                if (localStorage.getItem(alertKey)) continue; // Already alerted locally

                alertsNeeded.push(cert);
            }

            if (alertsNeeded.length > 0) {
                console.log(`📡 Radar found ${alertsNeeded.length} expired certificates.`);
                this.triggerRenovationAlert(alertsNeeded);
            }

        } catch (e) {
            console.error("Radar Check Error:", e);
        }
    },

    triggerRenovationAlert(expiredItems) {
        // 1. Create a System Notification
        // We group them if multiple
        const count = expiredItems.length;
        const msg = count === 1
            ? `A certidão "${expiredItems[0].titulo}" venceu. Renove agora para manter a segurança jurídica.`
            : `${count} certidões venceram recentemente. Evite riscos jurídicos.`;

        // Add to Sidebar Badge (Reuse notification system or specialized radar badge)
        this.addRadarBadge(count);

        // Create notification in DB
        // We use a specific type 'renovacao' to distinguish
        window.Infosimples.criarNotificacao(
            '🚨 Radar de Renovação',
            msg,
            '#radar-view' // Pseudo-link to open radar view
        );

        // Mark as alerted locally
        expiredItems.forEach(item => {
            localStorage.setItem(`radar_alert_${item.id}`, new Date().toISOString());
        });

        // Show Toast
        if (window.Toast) window.Toast.warning(msg, 10000);
    },

    addRadarBadge(count) {
        // Log logic: existing sidebar doesn't have a dedicated Radar icon yet.
        // We should add one if it doesn't exist, or piggyback on notifications.
        // Let's piggyback on the 'Sininho' but make it Pulse Red.

        const bell = document.querySelector('.fa-bell');
        if (bell) {
            bell.style.color = '#ef4444';
            bell.classList.add('fa-beat-fade');
            bell.title = `${count} Certidões Vencidas!`;
        }
    }
};

window.RenovationRadar = RenovationRadar;
