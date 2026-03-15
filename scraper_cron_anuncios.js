const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch'); // Requer: npm install node-fetch@2

// ==========================================
// CONFIGURAÇÃO DO ROBÔ CRON ⚙️
// ==========================================
// Insira sua SERVICE_ROLE_KEY para ignorar as permissões RLS durante a gravação
const SUPABASE_URL = 'https://ijmgvsztgljribnogtsx.supabase.co';
const SUPABASE_SERVICE_KEY = 'SUA_SERVICE_ROLE_KEY_AQUI'; // Pegue no painel do Supabase -> API
const SERPER_API_KEY = '2ea4a1ec1f0c3e29e5c35ee4e5b279520011f641'; // API de busca do Google (Serper.dev)

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Função principal do Robô
 */
async function startCronScraper() {
    console.log("🤖 Iniciando Robô de Extração de Anúncios (Cron)...");

    try {
        // 1. Buscar Lotes/Unidades Alvo (Ex: Lotes que precisamos monitorar)
        // Dica: Você pode filtrar por bairros específicos para economizar API
        const { data: unidades, error } = await supabase
            .from('unidades')
            .select('inscricao, endereco_completo, numero, bairro_unidade, lote_inscricao')
            .limit(50); // Reduzido para teste. Remova o limit em prod.

        if (error) throw error;
        console.log(`📡 Monitorando ${unidades.length} imóveis no Guarujá...`);

        // 2. Processar cada imóvel (com delay para não bloquear a API)
        for (const unit of unidades) {
            await scanMarketForUnit(unit);
            await sleep(2000); // Aguarda 2s entre consultas para evitar Rate Limit
        }

        console.log("✅ Ciclo de captura finalizado com sucesso!");

    } catch (err) {
        console.error("❌ Erro Crítico no Robô:", err);
    }
}

/**
 * Busca anúncios para uma unidade específica e salva no banco
 */
async function scanMarketForUnit(unit) {
    if (!unit.endereco_completo || unit.endereco_completo === 'null') return;

    const queryParts = [
        unit.endereco_completo.replace(/RUA|AVENIDA|AV|R\./gi, '').trim(),
        unit.numero !== '0' ? unit.numero : '',
        unit.bairro_unidade,
        'Guarujá', 'SP', 'venda'
    ];
    const query = queryParts.filter(Boolean).join(' ');

    console.log(`\n🔎 Buscando mercado para: ${query} (Inscrição: ${unit.inscricao})`);

    try {
        // Consultar Google (Isso busca as páginas do VivaReal, Zap, etc)
        const response = await fetch("https://google.serper.dev/search", {
            method: "POST",
            headers: {
                "X-API-KEY": SERPER_API_KEY,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ q: query, gl: 'br', hl: 'pt', num: 10 })
        });

        const result = await response.json();
        const items = result.organic || [];

        let addedCount = 0;

        for (const item of items) {
            const text = (item.title + " " + (item.snippet || "")).toLowerCase();
            
            // Lógica de Score de Precisão (Match)
            let score = calculateMatchScore(text, unit);
            if (score.percent < 40) continue; // Ignora se não tiver clareza que é o mesmo imóvel

            // Tentar extrair preço
            const priceRaw = extractPrice(text);

            // Identificar Fonte
            const source = detectSource(item.link);

            // Preparar Objeto para o Banco (Tabela 'anuncios')
            const anuncioDB = {
                lote_id: unit.lote_inscricao, // Vinculado ao Lote Principal
                inscricao: unit.inscricao,    // <--- CORRIGIDO PELO ESQUEMA REAL
                source: source,
                url: item.link,
                titulo: item.title,
                descricao: item.snippet,
                preco: priceRaw,
                match_score: score.percent,
                is_active: true,
                scraped_at: new Date().toISOString()
            };

            // Salva no Supabase (Upsert para evitar duplicatas da mesma URL)
            const { error: dbError } = await supabase
                .from('anuncios')
                .upsert(anuncioDB, { onConflict: 'url' });

            if (!dbError) addedCount++;
        }

        if (addedCount > 0) {
            console.log(`✨ ${addedCount} anúncios identificados e salvos para esta unidade.`);
        } else {
            console.log(`➖ Nenhum anúncio relevante encontrado.`);
        }

    } catch (e) {
        console.error(`⚠️ Erro ao escanear a unidade ${unit.inscricao}:`, e.message);
    }
}

// ==========================================
// UTILITÁRIOS DO ROBÔ
// ==========================================

function calculateMatchScore(text, unit) {
    let score = 0;
    let max = 3;
    const log = unit.endereco_completo.toLowerCase().replace(/rua|av|avenida/g, '').trim();
    
    // Bateu a rua?
    if (text.includes(log)) score += 2;
    // Bateu o bairro?
    if (unit.bairro_unidade && text.includes(unit.bairro_unidade.toLowerCase())) score += 1;
    // Bateu o número exato do prédio/casa?
    if (unit.numero && unit.numero !== '0' && text.includes(String(unit.numero))) {
        score += 2;
        max += 2;
    }

    return { percent: Math.round((score / max) * 100), raw: score };
}

function extractPrice(text) {
    const match = text.match(/r\$\s*([\d.,]+)/) || text.match(/([\d.,]+)\s*mil/i);
    if (!match) return null;
    let numStr = match[1].replace(/\./g, '').replace(',', '.');
    let price = parseFloat(numStr);
    if (text.includes('mil')) price *= 1000;
    return price > 10000 ? price : null;
}

function detectSource(url) {
    if (url.includes('vivareal')) return 'vivareal';
    if (url.includes('zapimoveis')) return 'zap';
    if (url.includes('olx')) return 'olx';
    return 'google';
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ==========================================
// START
// ==========================================
// Aviso: Certifique-se de configurar a SERVICE_ROLE_KEY antes de rodar.
// startCronScraper();
