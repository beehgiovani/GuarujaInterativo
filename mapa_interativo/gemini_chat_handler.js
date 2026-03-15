/**
 * GEMINI CHAT HANDLER - GeoMap AI Assistant
 */

class GeminiChatHandler {
    constructor() {
        this.apiKey = "AIzaSyBtPbWKlq9YbXAI1NEsuoM7pjhtreskltU";

        // Model Registry
        this.models = {
            'smart': 'gemini-2.5-flash-lite',
            'balanced': 'gemini-2.5-flash-lite',
            'fast': 'gemini-2.5-flash-lite'
        };

        // Default Model
        this.currentModel = this.models.smart;
        this.apiUrl = (model) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;

        // Inject Custom Styles if missing
        if (!document.getElementById('ai-chat-styles')) {
            const link = document.createElement('link');
            link.id = 'ai-chat-styles';
            link.rel = 'stylesheet';
            link.href = 'ai_chat_styles.css';
            document.head.appendChild(link);
        }

        this.container = null;
        this.trigger = null;
        this.messagesDiv = null;
        this.input = null;
        this.typingIndicator = null;
        this.history = [];

        // --- AGENTIC SYSTEM PROMPT ---
        this.systemPrompt = `
Você é o "GuaruBot" (Codenome: Farol), a Inteligência Central do Guarujá GeoMap.
Seu objetivo é ser um Agente de Mercado Imobiliário capaz de CRUZAR DADOS complexos.

PERMISSÃO TOTAL DE DADOS (IMPORTANTE):
Você TEM ACESSO de leitura às tabelas: 'lotes', 'unidades', 'proprietarios' através das TOOLS.
NUNCA diga "não consigo acessar o banco de dados". Se precisar de dados, USE AS TOOLS.

FERRAMENTAS DISPONÍVEIS (Use JSON):
Para buscar dados, você DEVE gerar um bloco JSON no formato:
\`\`\`json
{ "tool": "NOME_DA_TOOL", "args": { ... } }
\`\`\`

TOOLS:
1. "search_properties": Buscar imóveis (unidades/lotes).
   - Args: 
     - "query" (string, termos gerais), 
     - "bairro" (string), 
     - "quartos_min/max" (int), 
     - "valor_min/max" (float), 
     - "area_min/max" (float), 
     - "tipo" (string: 'Apartamento', 'Casa', 'Terreno', 'Comercial')

2. "search_owners": Buscar proprietários.
   - Args: "name" (nome parcial), "doc" (cpf/cnpj parcial)

3. "get_building_details": Ver detalhes de um prédio específico.
   - Args: "inscricao_lote" (ou nome parcial do prédio)

4. "list_documents": Listar certidões disponíveis.
   - Args: "inscricao" (unidade ou lote)

5. "update_property_data": CORRIGIR dados errados no banco.
   - Args: "table" ('unidades' ou 'lotes'), "id" (inscricao), "field" (coluna), "value" (novo valor)
   - USE QUANDO: Encontrar discrepância entre o banco (vazio/errado) e a WEB (Google Search).
   - EXIGÊNCIA: Tenha 100% de certeza (ex: Site da Construtora, Portal Imobiliário confiável).

REGRA DE AUTO-CORREÇÃO (CRÍTICO):
Se você notar que um imóvel tem dados faltantes (ex: Área=0, Quartos=null) E você encontrar essa informação no Google:
1. CONFIRME a informação em 2 fontes se possível.
2. EXECUTE 'update_property_data' IMEDIATAMENTE.
3. Avise o usuário: "Notei que a área estava 0m², mas encontrei 120m² no site da construtora. Atualizei para você."

REGRA DE INTERAÇÃO (CRUCIAL):
O usuário espera que você seja PROATIVO. Se a busca no banco ('search_properties') retornar ZERO resultados ou dados errados:
1. NÃO DESISTA.
2. Use seu conhecimento web (Google Search) para encontrar os dados reais do edifício/imóvel.
3. Exemplo: "Não achei no banco, mas pesquisei e vi que o Edifício X tem aptos de 3 dormitórios de 120m²."
4. Se tiver certeza, USE 'update_property_data' para corrigir o banco e depois mostre o resultado.

5. "generate_contract": GERAR MINUTAS JURÍDICAS.
   - Args: "type" ('compra_venda', 'autorizacao'), "inscricao" (imóvel), "client_name" (opcional), "client_doc" (opcional), "price" (opcional)
   - Resposta: Você receberá um LINK para download.
   - USE QUANDO: O usuário pedir "Faça um contrato", "Gere uma autorização de venda".

PERSONALIDADE:
Profissional, direto, focado em fechar negócios. Use emojis imobiliários (🏢, 🔑, 📄).
`;

        this.init();
    }

    init() {
        this.createElements();
        this.bindEvents();
        console.log("🧠 GuaruBot Agent Initialized");
    }

    createElements() {
        // ... (Same UI Code - Keeping it brief for diff) ...
        // Floating Chat Button
        this.trigger = document.createElement('div');
        this.trigger.id = 'ai-chat-trigger'; 
        this.trigger.innerHTML = '<i class="fas fa-brain"></i><div class="ai-pulse"></div>'; 
        // document.body.appendChild(this.trigger); // Removed for native map control integration

        // Chat Container
        this.container = document.createElement('div');
        this.container.id = 'ai-chat-container'; // Updated ID

        this.container.innerHTML = `
            <div class="ai-chat-header">
                <h3><i class="fas fa-robot"></i> GuaruBot <span class="ai-status">Beta 2.0</span></h3>
                <span class="ai-chat-close">&times;</span>
            </div>
            
            <div id="ai-chat-messages">
                <div class="ai-msg bot">
                    Olá! Sou o GuaruBot. Posso cruzar dados de proprietários, imóveis e certidões.
                    <br><br>
                    <i>Ex: "Busque aptos na Enseada com 3 quartos acima de 1M"</i>
                </div>
            </div>

            <div class="ai-chat-input-area">
                <input type="text" id="ai-chat-input" placeholder="Digite sua busca complexa...">
                <button class="ai-chat-send"><i class="fas fa-paper-plane"></i></button>
            </div>
        `;

        document.body.appendChild(this.container);

        // Cache refs
        this.messagesDiv = this.container.querySelector('#ai-chat-messages');
        this.input = this.container.querySelector('#ai-chat-input');

        // Typing
        this.typingIndicator = document.createElement('div');
        this.typingIndicator.className = 'ai-typing';
        this.typingIndicator.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Analisando base de dados...';
        this.messagesDiv.appendChild(this.typingIndicator);
    }

    bindEvents() {
        this.trigger.onclick = () => this.toggleChat();
        this.container.querySelector('.ai-chat-close').onclick = () => this.toggleChat();

        const sendBtn = this.container.querySelector('.ai-chat-send');
        sendBtn.onclick = () => this.sendMessage();

        this.input.onkeypress = (e) => {
            if (e.key === 'Enter') this.sendMessage();
        };
    }

    toggleChat() {
        const isActive = this.container.classList.contains('active');
        if (isActive) {
            this.container.classList.remove('active');
        } else {
            this.container.classList.add('active');
            setTimeout(() => this.input.focus(), 100);
        }
    }

    addMessage(text, sender, isHtml = false) {
        const div = document.createElement('div');
        div.className = `ai-msg ${sender}`;

        if (isHtml) {
            div.innerHTML = text; // Trusted HTML from our own formatter
        } else {
            // Basic Markdown Parser for text responses
            const parsed = window.parseMarkdown ? window.parseMarkdown(text) : text.replace(/\n/g, '<br>');
            div.innerHTML = parsed;
        }

        this.messagesDiv.insertBefore(div, this.typingIndicator);
        this.messagesDiv.scrollTop = this.messagesDiv.scrollHeight;
    }

    async sendMessage() {
        const text = this.input.value.trim();
        if (!text) return;

        this.addMessage(text, 'user');
        this.input.value = '';
        this.typingIndicator.style.display = 'block';

        try {
            const response = await this.agentLoop(text);
            this.addMessage(response, 'bot');
        } catch (error) {
            console.error("AI Error:", error);
            this.addMessage("❌ Erro ao processar: " + error.message, 'bot');
        } finally {
            this.typingIndicator.style.display = 'none';
        }
    }

    // --- AGENT LOOP (The Brain) ---
    // --- AGENT LOOP (The Brain) ---
    async agentLoop(userPrompt) {
        // Main Chat: Uses and updates global history
        const activeHistory = [...this.history];
        const response = await this.runsInternalLoop(userPrompt, activeHistory);

        // Update Global History only on success
        this.history = [...activeHistory,
        { role: 'user', parts: [{ text: userPrompt }] },
        { role: 'model', parts: [{ text: response }] }
        ];
        // Note: The internal loop handles intermediate tool steps, 
        // but for simplicity in the UI history we might just want input/output.
        // However, keeping tool logs in history is better for context.
        // Let's stick to the previous logic but refactored:

        return response;
    }

    /**
     * Headless interaction for internal system calls (Insights, Tooltips)
     * Does NOT update global history.
     */
    async ask(prompt) {
        console.log("🧠 Farol.ask (Headless):", prompt.substring(0, 50) + "...");
        // Start with empty history for specific tasks to avoid pollution
        return await this.internalAgentLoop(prompt, []);
    }

    async internalAgentLoop(userPrompt, initialHistory) {
        // Clone history to avoid mutating arguments
        let currentTurnHistory = [...initialHistory, { role: 'user', parts: [{ text: userPrompt }] }];
        let finalResponse = "";
        let maxSteps = 5;

        for (let step = 0; step < maxSteps; step++) {

            // 1. Call LLM
            const llmResponse = await this._callGeminiApi(currentTurnHistory);

            // 2. Check for Tool Calls
            const toolCallMatch = llmResponse.match(/```json\s*({[\s\S]*?"tool"[\s\S]*?})\s*```/);

            if (toolCallMatch) {
                try {
                    const toolData = JSON.parse(toolCallMatch[1]);
                    console.log(`🔧 Tool Call: ${toolData.tool}`, toolData.args);

                    // Show indicator if visible (only for main chat, but harmless if helpful)
                    if (this.typingIndicator) {
                        this.typingIndicator.innerHTML = `<i class="fas fa-database fa-spin"></i> Executando: ${toolData.tool}...`;
                    }

                    const toolResult = await this.executeTool(toolData.tool, toolData.args);

                    const toolOutputMsg = {
                        role: 'user',
                        parts: [{ text: `[TOOL_RESULT]\n${JSON.stringify(toolResult)}\n[/TOOL_RESULT]\n\nAgora analise.` }]
                    };

                    currentTurnHistory.push({ role: 'model', parts: [{ text: llmResponse }] });
                    currentTurnHistory.push(toolOutputMsg);

                    continue;

                } catch (e) {
                    console.error("Tool Parse Error", e);
                    return "Erro ao processar comando da IA.";
                }
            } else {
                finalResponse = llmResponse;
                currentTurnHistory.push({ role: 'model', parts: [{ text: finalResponse }] });
                break;
            }
        }

        // Return just the text. 
        // For agentLoop (Main Chat), we might want to capture the full history with tools.
        // But for 'ask', we just want the answer.

        // SIDE EFFECT: For the main chat we want to persist the 'currentTurnHistory'.
        // We'll handle that in the caller if needed.
        if (this.history && initialHistory === this.history) {
            // Logic to update global history if we passed the reference (not done here to be safe)
        }

        return finalResponse;
    }

    // Wrapper for the main chat UI
    async agentLoop(userPrompt) {
        // We pass the CURRENT global history context
        // BUT we need to capture the UPDATED history (with tools) to save it.
        // The internal loop does the work locally. We need it to return the updated history or we reconstruct it.

        // Let's copy-paste the logic properly to `internalAgentLoop` and make `agentLoop` use it 
        // AND update `this.history`.

        // actually, refactoring is risky. I will just ADD `ask` passing [] as history 
        // and DUPLICATE the loop logic to avoid breaking the delicate `agentLoop` currently working.
        // It's safer to just paste a separate `ask` method that is self-contained.

        return await this.askWithHistory(userPrompt, this.history, true);
    }

    // Unified Logic
    async askWithHistory(userPrompt, historyContext, updateGlobal = false) {
        let currentTurnHistory = [...historyContext, { role: 'user', parts: [{ text: userPrompt }] }];
        let finalResponse = "";
        let maxSteps = 5;

        for (let step = 0; step < maxSteps; step++) {
            const llmResponse = await this._callGeminiApi(currentTurnHistory);
            const toolCallMatch = llmResponse.match(/```json\s*({[\s\S]*?"tool"[\s\S]*?})\s*```/);

            if (toolCallMatch) {
                try {
                    const toolData = JSON.parse(toolCallMatch[1]);
                    console.log(`🔧 Tool: ${toolData.tool}`);
                    if (this.typingIndicator && updateGlobal) this.typingIndicator.innerHTML = `<i class="fas fa-database fa-spin"></i> ${toolData.tool}...`;

                    const toolResult = await this.executeTool(toolData.tool, toolData.args);

                    currentTurnHistory.push({ role: 'model', parts: [{ text: llmResponse }] });
                    currentTurnHistory.push({ role: 'user', parts: [{ text: `[TOOL_RESULT]\n${JSON.stringify(toolResult)}\n[/TOOL_RESULT]` }] });
                    continue;
                } catch (e) {
                    console.error("Tool Error", e);
                    return "Erro na Tool.";
                }
            } else {
                finalResponse = llmResponse;
                currentTurnHistory.push({ role: 'model', parts: [{ text: finalResponse }] });
                break;
            }
        }

        if (updateGlobal) {
            this.history = currentTurnHistory;
        }
        return finalResponse;
    }

    // --- TOOL EXECUTOR ---
    async executeTool(toolName, args) {
        if (toolName === 'search_properties') {
            let query = window.supabaseApp.from('unidades').select('*, lotes(*)'); // Join with Lotes

            if (args.bairro) query = query.ilike('bairro_unidade', `%${args.bairro}%`);

            if (args.valor_min) query = query.gte('valor_vendavel', args.valor_min);
            if (args.valor_max) query = query.lte('valor_vendavel', args.valor_max);
            if (args.quartos_min) query = query.gte('quartos', args.quartos_min);
            if (args.area_min) query = query.gte('area_util', args.area_min);

            const { data, error } = await query.limit(5);

            if (error) {
                console.error("❌ Search Properties Error:", error);
                return { error: error.message };
            }

            // FALLBACK LOGIC: If no specific units found, try finding the BUILDINGS (Lotes) in that neighborhood
            if (!data || data.length === 0) {
                console.warn("⚠️ No detailed units found. Searching for Buildings in neighborhood...");
                const { data: lotesData } = await window.supabaseApp
                    .from('lotes')
                    .select('*')
                    .ilike('bairro', `%${args.bairro || ''}%`)
                    .limit(5);

                if (lotesData && lotesData.length > 0) {
                    return {
                        count: lotesData.length,
                        results: lotesData,
                        message: "Não encontrei unidades exatas com esses filtros, mas aqui estão os PRÉDIOS/LOTES nessa região. O usuário pode clicar para ver se há unidades cadastradas manualmente."
                    };
                }
            }

            console.log(`📊 Found ${data.length} properties for query.`);
            return { count: data.length, results: data };
        }

        if (toolName === 'search_owners') {
            let query = window.supabaseApp.from('proprietarios').select('*');
            if (args.name) query = query.ilike('nome_completo', `%${args.name}%`);
            if (args.doc) query = query.ilike('cpf_cnpj', `%${args.doc}%`);

            const { data, error } = await query.limit(5);
            return error ? { error: error.message } : data;
        }

        if (toolName === 'generate_contract') {
            const { type, inscricao, client_name, client_doc, price } = args;

            // 1. Fetch Property Data
            const { data: units, error } = await window.supabaseApp
                .from('unidades')
                .select('*, lotes(*)')
                .eq('inscricao', inscricao)
                .limit(1);

            if (error || !units || units.length === 0) {
                console.warn("⚠️ Contract Gen: Unit not found for:", inscricao);
                return { error: "Imóvel não encontrado. Verifique a inscrição." };
            }

            const unit = units[0];
            const lote = unit.lotes;

            // 2. Prepare Data Payload
            const contractData = {
                owner_name: unit.nome_proprietario || 'Proprietário Desconhecido',
                owner_doc: unit.cpf_cnpj_proprietario || 'Não informado',
                owner_address: unit.endereco_proprietario || 'Não informado',
                client_name: client_name || '',
                client_doc: client_doc || '',
                client_address: '',
                property_address: lote ? lote.endereco : '',
                property_neighborhood: lote ? lote.bairro : '',
                building_name: lote ? lote.building_name : '',
                unit_id: unit.inscricao,
                matricula: unit.matricula,
                price: price || unit.valor_vendavel || unit.valor_venal || ''
            };

            // 3. Render Template
            if (!window.ContractTemplates) return { error: "Módulo de Contratos não carregado." };

            const htmlContent = window.ContractTemplates.render(type, contractData);

            // 4. Create Blob Link
            const blob = new Blob([htmlContent], { type: 'text/html' });
            const url = URL.createObjectURL(blob);

            console.log("📜 Contract generated:", `Contrato_${type}_${inscricao}.html`);
            return {
                success: true,
                message: "Contrato gerado com sucesso.",
                download_link: url,
                file_name: `Contrato_${type}_${inscricao}.html`
            };
        }

        return { error: "Tool not found or not implemented yet." };
    }


    async _callGeminiApi(history) {
        // Construct Payload with Context
        const activeHistory = history.length > 10 ? history.slice(-10) : history;
        const messages = JSON.parse(JSON.stringify(activeHistory));
        if (messages.length > 0) {
            messages[0].parts[0].text = this.systemPrompt + "\n\n" + messages[0].parts[0].text;
        }

        const url = this.apiUrl(this.currentModel);

        // Auto-Retry Logic (Exponential Backoff - Hardened)
        let retries = 0;
        const maxRetries = 5; // Increased from 3 to 5
        let delay = 3000; // Start with 3s (was 2s)

        while (retries <= maxRetries) {
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: messages,
                        tools: [{ google_search: {} }]
                    })
                });

                if (response.status === 429 || response.status === 503) {
                    throw new Error(`API Busy (${response.status})`);
                }

                if (!response.ok) {
                    const errText = await response.text();
                    // If 400 with 'google_search not supported', fallback to no tools? 
                    // No, invalid argument usually means config error. 
                    if (response.status === 400 && errText.includes('google_search')) {
                        console.warn("⚠️ Google Search Tool not supported by this model variant. Retrying without tools.");
                        return this._callGeminiApiWithoutTools(messages);
                    }
                    throw new Error(`HTTP Error ${response.status}: ${errText}`);
                }

                const data = await response.json();

                if (data.candidates && data.candidates[0].content) {
                    return data.candidates[0].content.parts[0].text;
                } else {
                    console.error("Gemini API Error Payload", data);
                    throw new Error("Resposta da API inválida ou bloqueada.");
                }

            } catch (error) {
                console.warn(`⚠️ Gemini API Attempt ${retries + 1} failed: ${error.message}`);

                if (retries === maxRetries || !error.message.includes('API Busy')) {
                    throw error; // Give up
                }

                // Wait and Retry
                await new Promise(res => setTimeout(res, delay));
                delay *= 2; // Exponential backoff (2s -> 4s -> 8s)
                retries++;
            }
        }
    }

    async _callGeminiApiWithoutTools(messages) {
        const url = this.apiUrl(this.currentModel);
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: messages })
        });
        const data = await response.json();
        if (data.candidates && data.candidates[0].content) {
            return data.candidates[0].content.parts[0].text;
        }
        throw new Error("Falha no Fallback (Sem Tools).");
    }
}

// Inicializa quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    window.Farol = new GeminiChatHandler();
});
