const { createClient } = require('@supabase/supabase-js');

// These should be set in the environment or replaced with actual values for local testing
const supabaseUrl = 'https://ijmgvsztgljribnogtsx.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDeduction() {
    console.log("🔍 Checking Credit Deduction Logic...");
    
    // 1. Get a test user (non-admin if possible)
    const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('id, email, credits, role, monthly_unlocks_used, total_unlocked')
        .order('updated_at', { ascending: false })
        .limit(5);
    
    if (pError) {
        console.error("❌ Error fetching profiles:", pError);
        return;
    }

    console.log("Recent profiles:");
    profiles.forEach(p => {
        console.log(`- ${p.email} | Credits: ${p.credits} | Role: ${p.role} | Monthly Used: ${p.monthly_unlocks_used} | ID: ${p.id}`);
    });

    // 2. Check recent transactions
    const { data: txs, error: tError } = await supabase
        .from('credit_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
    
    if (tError) {
        console.warn("⚠️ Error fetching credit_transactions (maybe table doesn't exist?):", tError.message);
    } else {
        console.log("Recent transactions:");
        txs.forEach(t => {
            console.log(`- ${t.created_at} | User: ${t.user_id} | Amount: ${t.amount} | Desc: ${t.description}`);
        });
    }

    // 3. Check recent unlocks
    const { data: unlocks, error: uError } = await supabase
        .from('unlocked_lots')
        .select('*')
        .order('desbloqueado_em', { ascending: false })
        .limit(10);

    if (uError) {
        console.error("❌ Error fetching unlocked_lots:", uError);
    } else {
        console.log("Recent unlocks:");
        unlocks.forEach(u => {
            console.log(`- ${u.desbloqueado_em} | User: ${u.user_id} | Lote: ${u.lote_inscricao} | Price: ${u.preco_creditos}`);
        });
    }
}

checkDeduction();
