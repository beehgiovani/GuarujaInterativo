/**
 * CAMERA HANDLER (Mobile & Web)
 * Manages photo capture and uploads to Supabase.
 */

// NOTE: In a non-bundler environment (like this), we avoid top-level ESM imports which require type="module".
// We rely on the global 'Capacitor' object injected at runtime (Native) or via PWA Elements (Web).


const CameraHandler = {
    init() {
        console.log("📷 Camera Handler Initialized");
        // Define Custom Element for PWA Camera UI if needed
        if (window.customElements && !customElements.get('pwa-camera-modal')) {
            console.log("📷 Loading PWA Elements for Web Camera support...");
            import('https://unpkg.com/@ionic/pwa-elements@latest/loader/index.js').then(module => {
                module.defineCustomElements(window);
                console.log("✅ PWA Elements loaded.");
            }).catch(err => console.error("❌ Failed to load PWA elements:", err));
        }
    },

    async takePhoto(loteId) {
        try {
            // 1. Check for Capacitor
            if (typeof Capacitor === 'undefined') {
                console.warn("⚠️ Capacitor not found. Running in browser mode?");
                // Fallback or specific browser logic could go here
                // For now, just alert or return to avoid crash
                if (window.Toast) window.Toast.warning("Câmera disponível apenas no App Móvel.");
                return;
            }
            if (window.Toast) window.Toast.info("Abrindo câmera...");

            // 1. Capture
            const image = await Capacitor.Plugins.Camera.getPhoto({
                quality: 90,
                allowEditing: false,
                resultType: 'base64', // Upload needs Blob usually, but Base64 is easier to bridge here
                source: 'CAMERA'
            });
            console.log("📷 Photo captured successfully. Length:", image.base64String ? image.base64String.length : 0);

            // 2. Upload to Supabase
            if (window.Toast) window.Toast.info("Enviando foto...", "Aguarde");
            console.log("🚀 Starting upload to Supabase: property-images/captures");

            const fileName = `${loteId}_${Date.now()}.jpeg`;
            const blob = this.base64ToBlob(image.base64String, 'image/jpeg');

            const { data, error } = await window.supabaseApp.storage
                .from('property-images')
                .upload(`captures/${fileName}`, blob);

            if (error) {
                console.error("❌ Supabase Upload Error:", error);
                throw error;
            }
            console.log("✅ Upload successful:", data);

            // 3. Update Database (Gallery)
            const publicUrl = window.supabaseApp.storage.from('property-images').getPublicUrl(`captures/${fileName}`).data.publicUrl;

            // Fetch current gallery
            const { data: lote } = await window.supabaseApp.from('lotes').select('gallery').eq('inscricao', loteId).single();
            const currentGallery = lote.gallery || [];

            // Update
            await window.supabaseApp.from('lotes').update({
                gallery: [...currentGallery, publicUrl]
            }).eq('inscricao', loteId);

            if (window.Toast) window.Toast.success("Foto salva com sucesso!");
            console.log("✅ Gallery updated for lote:", loteId);

            // Refresh UI if Tooltip is open
            if (window.showLotTooltip) {
                console.log("🔄 Refreshing UI...");
                // Reload tooltip (mock refresh by closing/opening or updating state)
                // Simple way: User will see it next time.
            }

        } catch (e) {
            console.error("Camera Error:", e);
            if (window.Toast) window.Toast.error("Erro na câmera ou envio.");
        }
    },

    base64ToBlob(base64, mime) {
        const byteChars = atob(base64);
        const byteNumbers = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
            byteNumbers[i] = byteChars.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: mime });
    }
};

window.CameraHandler = CameraHandler;
window.addEventListener('load', () => CameraHandler.init());
