const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// INSIRA A SERVICE_ROLE_KEY ABAIXO ANTES DE RODAR
const SUPABASE_URL = 'https://ijmgvsztgljribnogtsx.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_B6FJEtKvVNE-ANG9dccwEQ_oTgo_YNH';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function dumpDatabaseSchema() {
    console.log("🔍 Conectando à nuvem para mapear tabelas reais...");

    // Acessando as estatísticas do banco via RPC se a gente não tiver acesso ao information_schema via driver nativo
    // Supabase permite consultar swagger em /rest/v1/?apikey=...
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/?apikey=${SUPABASE_SERVICE_KEY}`);
        const swaggerData = await response.json();

        let schemaDoc = "-- ESQUEMA EXTRAÍDO DIRETAMENTE DA NUVEM (API REST) --\n\n";

        if (swaggerData && swaggerData.definitions) {
            for (const [tableName, details] of Object.entries(swaggerData.definitions)) {
                schemaDoc += `Tabela: ${tableName}\n`;
                schemaDoc += `----------${'-'.repeat(tableName.length)}\n`;
                
                if (details.properties) {
                    for (const [colName, colMeta] of Object.entries(details.properties)) {
                        schemaDoc += `  - ${colName} (${colMeta.type || 'unknown'} - format: ${colMeta.format || 'N/A'})\n`;
                    }
                }
                schemaDoc += `\n`;
            }

            fs.writeFileSync('ESQUEMA_REAL_NUVEM.txt', schemaDoc);
            console.log("✅ Esquema baixado com sucesso! Arquivo: ESQUEMA_REAL_NUVEM.txt");
        } else {
            console.log("❌ Não foi possível ler as definições. Verifique sua Service Key.");
        }
    } catch (e) {
        console.error("Erro ao mapear esquema: ", e);
    }
}

dumpDatabaseSchema();
