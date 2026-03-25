const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ijmgvsztgljribnogtsx.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_B6FJEtKvVNE-ANG9dccwEQ_oTgo_YNH';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function testData() {
    console.log("🔍 Checking for units with Matricula or RIP...");
    
    const { data, error } = await supabase
        .from('unidades')
        .select('inscricao, matricula, rip')
        .or('matricula.neq.null,rip.neq.null')
        .limit(10);

    if (error) {
        console.error("❌ Error fetching data:", error);
        return;
    }

    if (data && data.length > 0) {
        console.log("✅ Found units with data:");
        console.table(data);
    } else {
        console.log("ℹ️ No units found with populated Matricula or RIP.");
    }
}

testData();
