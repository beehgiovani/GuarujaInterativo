const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ijmgvsztgljribnogtsx.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkFunctions() {
    console.log("🔍 Verificando presença de RPCs no Swagger da API...");
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/?apikey=${SUPABASE_SERVICE_KEY}`);
        const swaggerData = await response.json();

        const required = [
            'unlock_lote_with_plan',
            'unlock_lote_with_credits',
            'consume_user_credits',
            'get_user_role'
        ];

        console.log("\nEstado dos RPCs:");
        required.forEach(fn => {
            const exists = swaggerData.paths && swaggerData.paths[`/rpc/${fn}`];
            console.log(`${exists ? '✅' : '❌'} ${fn}`);
        });

        if (swaggerData.paths) {
            console.log("\nTodos os RPCs disponíveis:");
            Object.keys(swaggerData.paths)
                .filter(p => p.startsWith('/rpc/'))
                .forEach(p => console.log(`  - ${p}`));
        }

    } catch (e) {
        console.error("Erro ao verificar funções:", e);
    }
}

checkFunctions();
