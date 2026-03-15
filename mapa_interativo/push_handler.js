/**
 * PUSH NOTIFICATIONS HANDLER
 * Manages native push notifications via Capacitor.
 */

const PushHandler = {
    init() {
        // Check if Capacitor is available and we are on a native platform
        if (!window.Capacitor || !window.Capacitor.isNativePlatform()) {
            console.log("🌐 Web Environment: Push Notifications skipped.");
            return;
        }

        console.log("📱 Native Environment: Initializing Push...");
        this.register();
        this.addListeners();
    },

    async register() {
        // Access Plugins securely
        const PushNotifications = window.Capacitor.Plugins?.PushNotifications;

        if (!PushNotifications) {
            console.warn("⚠️ PushNotifications Plugin not found.");
            return;
        }

        try {
            let permStatus = await PushNotifications.checkPermissions();

            if (permStatus.receive === 'prompt') {
                permStatus = await PushNotifications.requestPermissions();
            }

            if (permStatus.receive !== 'granted') {
                console.warn("🚫 Push permission denied");
                return;
            }

            await PushNotifications.register();
        } catch (e) {
            console.error("Push Register Error:", e);
        }
    },

    addListeners() {
        const PushNotifications = window.Capacitor.Plugins?.PushNotifications;
        if (!PushNotifications) return;

        // Registration success
        PushNotifications.addListener('registration', (token) => {
            console.log('✅ Push Token:', token.value);
            this.saveToken(token.value);
        });

        // Registration error
        PushNotifications.addListener('registrationError', (error) => {
            console.error('❌ Push Registration Error:', error);
        });

        // Receive notification (foreground)
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
            console.log('🔔 Push Received:', notification);
            // Show toast or update UI
            if (window.Toast) {
                window.Toast.info(
                    notification.title || 'Nova Notificação',
                    notification.body,
                    5000
                );
            }
            // Refresh notifications list if handler exists
            if (window.NotificationsHandler) window.NotificationsHandler.checkNotifications();
        });

        // Action performed (tap on notification)
        PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
            console.log('👆 Push Action:', notification);
            // Logic to navigate to specific screen can be added here
        });
    },

    async saveToken(token) {
        // Save the token to Supabase for the current user
        console.log("💾 Saving Push Token to DB...", token);

        /* 
         * Note: Actual DB saving requires an authenticated user session.
         * We will implement the Supabase Upsert here when Auth is fully active.
         * 
         * Example:
         * const { data: { user } } = await window.supabaseApp.auth.getUser();
         * if (user) {
         *    await window.supabaseApp.from('profiles').upsert({ id: user.id, push_token: token });
         * }
         */
    }
};

window.PushHandler = PushHandler;
