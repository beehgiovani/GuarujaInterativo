
// Supabase Configuration
const SUPABASE_URL = window.CONFIG.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.CONFIG.SUPABASE_KEY;

// Initialize Supabase Client
// We use 'supabaseApp' to avoid conflict with the global 'supabase' object provided by the SDK
if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
    window.supabaseApp = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log("✅ Supabase App initialized and exported to window.supabaseApp");

    // Global Activity Logger
    window.logActivity = async function(action, detail = "") {
        try {
            const { data: { user } } = await window.supabaseApp.auth.getUser();
            if (!user) return;

            await window.supabaseApp.from('audit_logs').insert([
                { 
                    user_id: user.id, 
                    user_email: user.email, 
                    action: action, 
                    detail: detail 
                }
            ]);
        } catch (e) {
            console.warn("Audit Log silent fail:", e);
        }
    };
} else {
    console.error("❌ Supabase SDK not found! Make sure to include the CDN script.");
}
