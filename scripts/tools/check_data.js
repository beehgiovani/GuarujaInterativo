const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ijmgvsztgljribnogtsx.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const TEST_USER_ID = 'e90393fd-0106-4693-ae9c-c5f467f44981';

async function checkData() {
    console.log(`🔍 Verificando dados para o usuário: ${TEST_USER_ID}...`);
    
    try {
        // 1. Perfil
        const { data: profile, error: pError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', TEST_USER_ID)
            .single();
        
        console.log("\n--- PERFIL ---");
        if (pError) console.error("Erro perfil:", pError);
        else console.log(profile);

        // 2. Desbloqueios de Lote
        const { data: lots, error: lError } = await supabase
            .from('unlocked_lots')
            .select('*')
            .eq('user_id', TEST_USER_ID);
        
        console.log("\n--- UNLOCKED LOTS ---");
        if (lError) console.error("Erro lots:", lError);
        else {
            console.log(`Total: ${lots.length}`);
            lots.forEach(l => console.log(`  - Lote: ${l.lote_inscricao} | Unid: ${l.unidade_inscricao} | Em: ${l.desbloqueado_em || l.unlocked_at || '?'}`));
        }

        // 3. Transações de Crédito
        const { data: txs, error: tError } = await supabase
            .from('credit_transactions')
            .select('*')
            .eq('user_id', TEST_USER_ID)
            .order('created_at', { ascending: false })
            .limit(5);
        
        console.log("\n--- ÚLTIMAS TRANSAÇÕES ---");
        if (tError) console.error("Erro txs:", tError);
        else txs.forEach(t => console.log(`  - ${t.amount} créditos | ${t.description} | status: ${t.status}`));

    } catch (e) {
        console.error("Erro geral no script:", e);
    }
}

checkData();
