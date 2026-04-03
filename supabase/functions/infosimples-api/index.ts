// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Configuração Infosimples
const INFOSIMPLES_API_URL = 'https://api.infosimples.com/api/v2/consultas';
const INFOSIMPLES_ADMIN_URL = 'https://api.infosimples.com/api/admin/account';
const API_TOKEN = Deno.env.get('INFOSIMPLES_API_TOKEN');
if (!API_TOKEN) throw new Error('INFOSIMPLES_API_TOKEN is not configured');

// Configuração de certidões disponíveis
const CERTIDOES_CONFIG: Record<string, { endpoint: string; preco: number; nome: string; allowedParams?: string[] }> = {
    'tst-cndt': {
        endpoint: 'tribunal/tst/cndt',
        preco: 0.06,
        nome: 'TST - CNDT (Trabalhista)',
        allowedParams: ['nome', 'cpf', 'cnpj', 'birthdate', 'nome_parte', 'preferencia_emissao']
    },
    'trt2-digital': {
        endpoint: 'tribunal/trt2/ceat-digital',
        preco: 0.06,
        nome: 'TRT2 Digital (SP)',
        allowedParams: ['nome', 'cpf', 'cnpj', 'birthdate', 'nome_parte', 'preferencia_emissao']
    },
    'trt2-fisico': {
        endpoint: 'tribunal/trt2/ceat',
        preco: 0.06,
        nome: 'TRT2 Físico (SP)',
        allowedParams: ['nome', 'cpf', 'cnpj', 'birthdate', 'nome_parte', 'preferencia_emissao']
    },
    'trf-unificada': {
        endpoint: 'tribunal/trf/cert-unificada',
        preco: 0.06,
        nome: 'TRF Unificada',
        allowedParams: ['cpf', 'cnpj', 'tipo', 'email', 'preferencia_emissao']
    },
    'trf3': {
        endpoint: 'tribunal/trf3/certidao-distr',
        preco: 0.06,
        nome: 'TRF3 - Distribuição',
        allowedParams: ['cpf', 'tipo', 'abrangencia']
    },
    'tjsp-segundo-grau': {
        endpoint: 'tribunal/tjsp/segundo-grau',
        preco: 0.20,
        nome: 'TJSP 2º Grau',
        allowedParams: ['nome', 'cpf', 'cnpj', 'birthdate', 'nome_parte']
    },
    'cenprot-sp': {
        endpoint: 'cenprot-sp/protestos',
        preco: 0.06,
        nome: 'CENPROT SP (Protestos)',
        allowedParams: ['cpf', 'cnpj']
    },
    'pgfn': {
        endpoint: 'receita-federal/pgfn',
        preco: 0.06,
        nome: 'Receita Federal PGFN',
        allowedParams: ['nome', 'cpf', 'cnpj', 'birthdate', 'nome_parte', 'preferencia_emissao']
    },
    'sefaz-sp': {
        endpoint: 'sefaz/certidao-debitos',
        preco: 0.04,
        nome: 'SEFAZ SP',
        allowedParams: ['nome', 'cpf', 'cnpj', 'uf']
    },
    'cnj-improbidade': {
        endpoint: 'cnj/improbidade',
        preco: 0.04,
        nome: 'CNJ Improbidade',
        allowedParams: ['nome', 'cpf', 'cnpj', 'birthdate', 'nome_parte', 'preferencia_emissao']
    }
};

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
        const action = reqUrl.searchParams.get('action');

        // ========================================
        // ACTION: Check Balance
        // ========================================
        if (action === 'check_balance') {
            console.log('[Infosimples] Checking account balance...');
            
            try {
                const response = await fetch(INFOSIMPLES_ADMIN_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: `token=${API_TOKEN}`
                });

                const data = await response.json();
                
                if (data.code === 200 && data.data && data.data[0]) {
                    const accountInfo = data.data[0];
                    return new Response(JSON.stringify({
                        success: true,
                        balance: accountInfo.balance || 0,
                        prepaid: accountInfo.prepaid,
                        current_usage: accountInfo.current_usage || 0,
                        name: accountInfo.name
                    }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                        status: 200,
                    });
                } else {
                    return new Response(JSON.stringify({
                        success: false,
                        error: data.code_message || 'Erro ao consultar saldo',
                        code: data.code
                    }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                        status: 400,
                    });
                }
            } catch (e) {
                return new Response(JSON.stringify({
                    success: false,
                    error: 'Erro de conexão com Infosimples API'
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 500,
                });
            }
        }

        // ========================================
        // ACTION: Get Certidoes Config
        // ========================================
        if (action === 'get_config') {
            return new Response(JSON.stringify({
                success: true,
                certidoes: CERTIDOES_CONFIG
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        // ========================================
        // ACTION: Request Certidao
        // ========================================
        if (action === 'request_certidao') {
            const body = await req.json();
            const certidaoId = body.certidao_id;
            const params = body.params || {};

            if (!certidaoId || !CERTIDOES_CONFIG[certidaoId]) {
                return new Response(JSON.stringify({
                    success: false,
                    error: `Certidão inválida: ${certidaoId}`,
                    available: Object.keys(CERTIDOES_CONFIG)
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 400,
                });
            }

            const certidao = CERTIDOES_CONFIG[certidaoId];
            const endpoint = `${INFOSIMPLES_API_URL}/${certidao.endpoint}`;

            console.log(`[Infosimples] Requesting ${certidao.nome} at ${endpoint}`);

            // Build form data
            const formData = new URLSearchParams();
            formData.append('token', API_TOKEN);
            formData.append('timeout', params.timeout || '600'); // Increased from 300 to 600

            // Filter params based on whitelist
            const allowedParams = certidao.allowedParams || [];
            const filteredParams: Record<string, any> = {};
            
            for (const [key, value] of Object.entries(params)) {
                if (key !== 'timeout' && value) {
                    // Only add if in whitelist (or if no whitelist defined)
                    if (allowedParams.length === 0 || allowedParams.includes(key)) {
                        filteredParams[key] = value;
                        formData.append(key, String(value));
                    } else {
                        console.log(`[Infosimples] Skipping param '${key}' - not in whitelist for ${certidaoId}`);
                    }
                }
            }

            console.log(`[Infosimples] FormData being sent:`, Object.fromEntries(formData.entries()));

            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: formData.toString()
                });

                const data = await response.json();
                const code = data.code;

                // Extract PDFs from response
                const pdfs: string[] = [];
                
                // site_receipts (list of URLs)
                if (data.site_receipts && Array.isArray(data.site_receipts)) {
                    for (const url of data.site_receipts) {
                        if (typeof url === 'string') pdfs.push(url);
                    }
                }
                
                // data[].site_receipt
                if (data.data && Array.isArray(data.data)) {
                    for (const item of data.data) {
                        if (item && item.site_receipt) {
                            pdfs.push(item.site_receipt);
                        }
                    }
                }

                // Determine success
                const isSuccess = code === 200 || code === 612; // 612 = "Nada consta" is also success
                const nadaConsta = code === 612;

                return new Response(JSON.stringify({
                    success: isSuccess,
                    nada_consta: nadaConsta,
                    code: code,
                    code_message: data.code_message,
                    data: data.data,
                    pdfs: pdfs,
                    certidao_nome: certidao.nome,
                    certidao_preco: certidao.preco
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: isSuccess ? 200 : 400,
                });

            } catch (e) {
                console.error('[Infosimples] Request error:', e);
                return new Response(JSON.stringify({
                    success: false,
                    error: 'Erro ao processar consulta',
                    details: e.message
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 500,
                });
            }
        }

        // ========================================
        // ACTION: Save PDF to Supabase Storage
        // ========================================
        if (action === 'save_pdf') {
            const body = await req.json();
            const pdfUrl = body.pdf_url;
            const documento = body.documento;
            const certidaoId = body.certidao_id;

            if (!pdfUrl || !documento || !certidaoId) {
                return new Response(JSON.stringify({
                    success: false,
                    error: 'Parâmetros obrigatórios: pdf_url, documento, certidao_id'
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 400,
                });
            }

            console.log(`[Infosimples] Downloading PDF from: ${pdfUrl}`);

            try {
                // 1. Download PDF from Infosimples
                const pdfResponse = await fetch(pdfUrl);
                if (!pdfResponse.ok) {
                    throw new Error(`Failed to download PDF: ${pdfResponse.status}`);
                }
                // Determine file extension
                // Determine file extension
                const downloadContentType = pdfResponse.headers.get('content-type') || 'application/pdf';
                const ext = downloadContentType.includes('pdf') ? 'pdf' : 'html';
                
                let pdfBuffer: ArrayBuffer | Uint8Array;

                if (ext === 'html') {
                    // Se for HTML, vamos "embonecar" o conteúdo antes de salvar
                    let htmlContent = await pdfResponse.text();
                    
                    // Verifica se já tem estrutura completa, senão envolve
                    const wrapperStart = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Comprovante de Certidão</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px; }
        .page-container {
            max-width: 21cm;
            min-height: 29.7cm;
            margin: 0 auto;
            background: white;
            padding: 2cm;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            border-radius: 4px;
        }
        .header {
            text-align: center;
            margin-bottom: 2rem;
            padding-bottom: 1rem;
            border-bottom: 2px solid #e5e7eb;
        }
        .header h1 { color: #1f2937; margin: 0; font-size: 1.5rem; text-transform: uppercase; }
        .header p { color: #6b7280; margin: 0.5rem 0 0; }
        
        /* Estilos genéricos para melhorar tabelas feias */
        table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
        th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; }
        th { background-color: #f9fafb; }
        
        /* Botão de impressão */
        .fab-print {
            position: fixed;
            bottom: 2rem;
            right: 2rem;
            background-color: #2563eb;
            color: white;
            border: none;
            border-radius: 50%;
            width: 60px;
            height: 60px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.2);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            transition: transform 0.2s;
            z-index: 1000;
        }
        .fab-print:hover { transform: scale(1.1); background-color: #1d4ed8; }
        
        @media print {
            body { background: white; padding: 0; }
            .page-container { box-shadow: none; padding: 0; margin: 0; width: 100%; }
            .no-print, .fab-print { display: none !important; }
        }
    </style>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
</head>
<body>
    <button class="fab-print" onclick="window.print()" title="Imprimir / Salvar PDF">
        <i class="fas fa-print"></i>
    </button>
    
    <div class="page-container">
        <div class="header">
            <h1>Comprovante de Consulta</h1>
            <p>Emitido via Guarujá Geo</p>
            <p style="font-size: 0.8rem; margin-top: 5px;">${new Date().toLocaleString('pt-BR')}</p>
        </div>
        <div class="content">
`;
                    const wrapperEnd = `
        </div>
        <div style="margin-top: 2rem; text-align: center; font-size: 0.8rem; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 1rem;">
            Documento gerado automaticamente. A validade deste comprovante deve ser verificada junto ao órgão emissor.
        </div>
    </div>
</body>
</html>`;

                    // Simple check if it's a full HTML document or fragment
                    if (htmlContent.includes('<html') || htmlContent.includes('<body')) {
                        const injection = `
                            <style>
                                @media print { .fab-print { display: none !important; } }
                                .fab-print { position: fixed; bottom: 20px; right: 20px; width: 60px; height: 60px; background: #2563eb; color: white; border-radius: 50%; border: none; font-size: 24px; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; }
                            </style>
                            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
                            <button class="fab-print" onclick="window.print()"><i class="fas fa-print"></i></button>
                        `;
                        htmlContent = htmlContent.replace('</body>', `${injection}</body>`);
                    } else {
                        htmlContent = wrapperStart + htmlContent + wrapperEnd;
                    }
                    
                    pdfBuffer = new TextEncoder().encode(htmlContent);
                } else {
                    pdfBuffer = await pdfResponse.arrayBuffer();
                }

                // 2. Generate filename with timestamp
                const now = new Date();
                const timestamp = now.toISOString().replace(/[:.]/g, '-').substring(0, 19);
                const fileName = `${certidaoId}_${timestamp}.${ext}`;
                const fullPath = `${documento}/${fileName}`;

                // 3. Supabase Storage Configuration
                const SUPABASE_URL = 'https://ijmgvsztgljribnogtsx.supabase.co';
                const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

                if (!SUPABASE_SERVICE_KEY) {
                    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not defined in Edge Function environment.');
                }
                
                // 4. List existing files to delete old versions
                const listResponse = await fetch(
                    `${SUPABASE_URL}/storage/v1/object/list/certidoes_juridicas`,
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                            'Content-Type': 'application/json',
                            'apikey': SUPABASE_SERVICE_KEY
                        },
                        body: JSON.stringify({ prefix: `${documento}/` })
                    }
                );
                
                if (listResponse.ok) {
                    const files = await listResponse.json();
                    // Find old files of the same certidao type
                    const oldFiles = files.filter((f: any) => 
                        f.name && f.name.startsWith(`${certidaoId}_`)
                    );
                    
                    // Delete old files
                    for (const oldFile of oldFiles) {
                        const deletePath = `${documento}/${oldFile.name}`;
                        console.log(`[Infosimples] Deleting old file: ${deletePath}`);
                        await fetch(
                            `${SUPABASE_URL}/storage/v1/object/certidoes_juridicas/${deletePath}`,
                            {
                                method: 'DELETE',
                                headers: {
                                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                                    'apikey': SUPABASE_SERVICE_KEY
                                }
                            }
                        );
                    }
                }

                // 5. Upload new PDF to Supabase
                const uploadContentType = ext === 'html' ? 'text/html; charset=utf-8' : (pdfResponse.headers.get('content-type') || 'application/pdf');

                const uploadResponse = await fetch(
                    `${SUPABASE_URL}/storage/v1/object/certidoes_juridicas/${fullPath}`,
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                            'Content-Type': uploadContentType,
                            'apikey': SUPABASE_SERVICE_KEY,
                            'x-upsert': 'true'
                        },
                        body: pdfBuffer
                    }
                );

                if (!uploadResponse.ok) {
                    const errorText = await uploadResponse.text();
                    throw new Error(`Upload failed: ${errorText}`);
                }

                console.log(`[Infosimples] PDF saved: ${fullPath}`);

                // 6. Get public URL
                const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/certidoes_juridicas/${fullPath}`;

                return new Response(JSON.stringify({
                    success: true,
                    saved_path: fullPath,
                    public_url: publicUrl
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 200,
                });

            } catch (e) {
                console.error('[Infosimples] Save PDF error:', e);
                return new Response(JSON.stringify({
                    success: false,
                    error: `Erro ao salvar PDF: ${e.message}`
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 500,
                });
            }
        }

        // ========================================
        // Default: Invalid action
        // ========================================
        return new Response(JSON.stringify({
            error: 'Ação inválida. Use: check_balance, get_config, request_certidao, save_pdf',
            available_actions: ['check_balance', 'get_config', 'request_certidao', 'save_pdf']
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });

    } catch (error) {
        console.error('[Infosimples] Server error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        })
    }
})
