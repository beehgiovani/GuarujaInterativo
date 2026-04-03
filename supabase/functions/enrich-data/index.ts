import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Configuração de Enriquecimento
const PROVIDER_API_URL = 'https://api.' + ['data', 'stone'].join('') + '.com.br/v1';
const API_KEYS = (Deno.env.get('ENRICH_API_KEYS') || '')
    .split(',')
    .map(k => k.trim())
    .filter(k => k.length > 0);
if (API_KEYS.length === 0) {
    console.warn('[Proxy] ENRICH_API_KEYS not configured. Service will fail.');
}

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const reqUrl = new URL(req.url);

        // [ACTION: Check Status]
        // Verifica o status de todas as chaves (Ativa/Inválida/Sem Saldo)
        const action = reqUrl.searchParams.get('action');
        if (action === 'check_status') {
            console.log('[Proxy] Checking status of all keys...');
            const results = [];

            for (let i = 0; i < API_KEYS.length; i++) {
                const key = API_KEYS[i];
                if (!key || key.includes('INSIRA')) {
                    results.push({ index: i, key: '...', status: 'MOCKED', valid: false, message: 'Chave não configurada' });
                    continue;
                }

                const keyMasked = `...${key.slice(-5)}`;
                try {
                    // Consulta de Saldo Exato
                    const checkUrl = `${PROVIDER_API_URL}/balance`;
                    const response = await fetch(checkUrl, {
                        method: 'GET',
                        headers: { 'Authorization': `Token ${key}`, 'Content-Type': 'application/json' }
                    });

                    let status = 'UNKNOWN';
                    let valid = false;
                    let message = '';
                    let balanceValue = 0;

                    if (response.status === 200) {
                        const balanceData = await response.json();
                        // Somar créditos
                        if (balanceData.balance && Array.isArray(balanceData.balance.credits)) {
                            balanceValue = balanceData.balance.credits.reduce((acc: number, curr: any) => acc + (Number(curr.value) || 0), 0);
                        }
                        
                        valid = true; // A chave é válida pois retornou 200
                        message = `R$ ${balanceValue.toFixed(2)}`;
                        
                        if (balanceValue > 0) {
                            status = 'ACTIVE';
                        } else {
                            status = 'NO_CREDIT'; // Saldo zerado, mas chave válida
                        }
                        if (balanceValue <= 0) status = 'NO_CREDIT';

                    } else if (response.status === 401) {
                        // 401 = Token não existe ou inválido
                        status = 'INVALID';
                        valid = false;
                        message = 'Chave Inválida';
                    } else if (response.status === 403) {
                        // 403 = Token existe mas não tem permissão (provavelmente sem saldo ou bloqueada)
                        status = 'NO_CREDIT';
                        valid = true; // Visualmente tratamos como "existente", cor laranja
                        message = 'Bloqueada / Sem Saldo';
                    } else if (response.status === 402 || response.status === 400) {
                        // O provedor pode retornar 402 Payment Required quando acaba o saldo
                        status = 'NO_CREDIT';
                        valid = true; 
                        message = 'Sem Saldo (R$ 0.00)';
                    } else if (response.status === 404) {
                        status = 'ACTIVE';
                        valid = true;
                        message = 'Ativa (Saldo n/a)';
                    } else {
                        status = `ERROR_${response.status}`;
                        valid = false;
                        // @ts-ignore: dynamic status message
                        message = `Erro ${response.status}`;
                    }

                    // @ts-ignore: heterogenous results array
                    results.push({ index: i, key: keyMasked, status, valid, message, http_code: response.status, balance: balanceValue });

                } catch (e) {
                    // @ts-ignore: Error handling for heterogeneous data
                    results.push({ index: i, key: keyMasked, status: 'ERROR', valid: false, message: 'Erro de conexão' });
                }
            }

            return new Response(JSON.stringify({ keys: results }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        // Determine target endpoint and parameter name based on path
        let endpoint = '';
        let paramName = '';
        
        if (reqUrl.pathname.includes('/persons')) {
            endpoint = '/persons';
            paramName = 'cpf';  // A API usa 'cpf' para pessoas físicas
        } else if (reqUrl.pathname.includes('/companies')) {
            endpoint = '/companies';
            paramName = 'cnpj';  // A API usa 'cnpj' para pessoas jurídicas
        } else {
            return new Response(JSON.stringify({ error: 'Endpoint inválido. Use /persons ou /companies' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            });
        }

        // Extrair o parâmetro 'document' e converter para cpf/cnpj conforme necessário
        const docParam = reqUrl.searchParams.get('document');
        if (!docParam) {
            return new Response(JSON.stringify({ error: 'Parâmetro "document" é obrigatório' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            });
        }
        
        const targetUrl = `${PROVIDER_API_URL}${endpoint}?${paramName}=${docParam}`;
        console.log(`[Proxy] Forwarding to: ${targetUrl}`);

        let lastResponse = null;

        // Failover Loop
        for (const key of API_KEYS) {
            if (!key || key.includes('INSIRA')) continue;

            console.log(`[Proxy] Trying key ending in ...${key.slice(-5)}`);

            try {
                const response = await fetch(targetUrl, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Token ${key}`,
                        'Content-Type': 'application/json'
                    }
                });

                lastResponse = response;

                // If Success (200) or Not Found (404 - valid API response), return immediately
                // Note: A API retorna 404 se pessoa não encontrada, o que é um resultado válido, não uma falha de chave.
                if (response.status === 200 || response.status === 404) {
                    const data = await response.json();
                    return new Response(JSON.stringify(data), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                        status: response.status,
                    });
                }

                // If 403 (Auth) or 400 (Credits/Error), convert body to text for logging and try next key
                const errText = await response.text();
                console.warn(`[Proxy] Key failed with ${response.status}: ${errText}`);

                // Store detailed error for final response
                if (!lastResponse || response.status !== 400) {
                    // @ts-ignore: dynamic property assignment for error logging
                    lastResponse = { status: response.status, body: errText };
                }

                // Continue loop to next key...
                
            } catch (err) {
                console.error(`[Proxy] Network error with key: ${err}`);
            }
        }

        // If we exit the loop, all keys failed
        return new Response(JSON.stringify({
            error: 'Todas as chaves de API falharam ou estão sem créditos.',
            last_status: lastResponse?.status || 500,
            last_error: lastResponse?.body || 'No response from API',
            details: 'Verifique se as chaves de enriquecimento estão válidas e com créditos.'
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 502,
        })

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return new Response(JSON.stringify({ error: errorMessage }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        })
    }
})
