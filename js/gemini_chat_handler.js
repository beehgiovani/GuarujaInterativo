/**
 * GEMINI CHAT HANDLER - GeoMap AI Assistant
 */

class GeminiChatHandler {
    constructor() {
        // PRIORIDADE: Chave salva localmente > Chave padrão
        this.apiKey = localStorage.getItem('gemini_api_key') || "";

        // Model Registry - Prioritizing models with higher RPM/TPM based on user registry
        this.models = {
            'smart': 'gemini-3.1-flash-lite', // Higher RPM (15) + RPD (500)
            'balanced': 'gemini-2.5-flash-lite', // RPM 10
            'fast': 'gemini-3-flash' // RPM 5
        };

        // Fallback models to try if 404 or persistent 429 occurs
        this.fallbackModels = [
            'gemini-3.1-flash-lite',
            'gemini-2.5-flash-lite',
            'gemini-3-flash',
            'gemini-3-flash-preview',
            'gemini-3.1-pro',
            'gemini-2.5-pro',
            'gemini-2-flash',
            'gemma-3-27b' 
        ];

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

        // O systemPrompt é gerado dinamicamente no primeiro uso (após Monetization carregar)
        this._systemPromptCache = null;

        this.init();
    }

    init() {
        this.createElements();
        this.bindEvents();
        console.log("🧠 GuaruBot Agent Initialized");

        // Regenerar prompt quando monetização estiver pronta (garante dados do plano corretos)
        window.addEventListener('monetizationReady', () => {
            this._systemPromptCache = null; // Invalida cache para rebuild
            this._updateWelcomeMessage();
        });
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
                <div class="ai-msg bot" id="guarubot-welcome">
                    Olá! Sou o <b>GuaruBot</b> 🤖 — carregando seu plano...
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

        // Atualiza welcome message assim que possível
        setTimeout(() => this._updateWelcomeMessage(), 1500);
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

    // ─────────────────────────────────────────────────────────
    // SISTEMA DE PROMPT DINÂMICO — baseado nas funções ativas
    // ─────────────────────────────────────────────────────────

    get systemPrompt() {
        // Lazy build: gerado uma vez e cacheado até invalidação (ex: troca de plano)
        if (!this._systemPromptCache) {
            this._systemPromptCache = this.buildSystemPrompt();
        }
        return this._systemPromptCache;
    }

    buildSystemPrompt() {
        const role  = window.Monetization?.userRole || 'user';
        const can   = (f) => window.Monetization?.canAccess(f) ?? false;
        const isGuest = window.isGuest;

        // ── Identidade base ──────────────────────────────────
        let prompt = `Você é o "GuaruBot" (Farol), assistente de IA do Guarujá GeoMap — plataforma imobiliária inteligente de Guarujá/SP.
Plano atual do usuário: ${role.toUpperCase()}.

REGRAS FUNDAMENTAIS:
- NUNCA mencione ou explique funcionalidades que o usuário NÃO tem acesso.
- NUNCA invente dados. Use TOOLS para acessar o banco de dados real.
- Se a busca retornar vazio, tente variações; se ainda vazio, informe honestamente.
- Seja direto, profissional, use emojis imobiliários (🏢 🔑 📄 🗺️ 💰).
- Responda SEMPRE em português brasileiro.

ACESSO AO BANCO (TOOLS):
Para buscar dados, gere um bloco JSON no formato:
\`\`\`json
{ "tool": "NOME", "args": { } }
\`\`\`
NUNCA diga "não consigo acessar o banco". Se precisar de dados, USE AS TOOLS.\n`;

        // ── Funcionalidades ativas ────────────────────────────
        prompt += `\n## FUNCIONALIDADES DISPONÍVEIS PARA ESTE USUÁRIO (${role.toUpperCase()}):\n`;
        prompt += `- 🗺️ Mapa interativo: navegar, clicar em lotes e ver fichas cadastrais básicas\n`;
        prompt += `- 🔍 Buscar imóveis: por bairro, tipo, valor, área e dormitórios\n`;

        if (can('unlock_lote')) {
            prompt += `- 🔓 Desbloquear fichas: acessar dados completos de unidades (proprietário, contato, valores)\n`;
        }
        if (can('radar_mercado')) {
            prompt += `- 📡 Radar de mercado: filtros avançados no mapa (status de venda, faixa de preço, oportunidades)\n`;
        }
        if (can('search_owner')) {
            prompt += `- 👤 Buscar proprietários: por nome ou CPF/CNPJ\n`;
        }
        if (can('marketing_tools')) {
            prompt += `- 📊 Ficha Avançada: enriquecer proprietário com telefones, endereços e empresas\n`;
        }
        if (can('crm_history')) {
            prompt += `- 📋 CRM: adicionar leads e registrar histórico de contato com proprietários\n`;
        }
        if (can('mapear_patrimonio')) {
            prompt += `- 🏘️ Patrimônio: visualizar no mapa todos os imóveis de um proprietário\n`;
        }
        if (can('advanced_ai')) {
            prompt += `- 🧠 Análise Farol IA: score preditivo de oportunidade de negócio por imóvel\n`;
            prompt += `- 🌐 Receita Federal (PJ): consultar dados de empresas pelo CNPJ\n`;
            prompt += `- 🎯 Alertas de Oportunidade: encontrar imóveis com alta probabilidade de negociação\n`;
        }
        if (can('dossier_pdf')) {
            prompt += `- 📄 Dossiê PDF: gerar relatório completo e profissional do imóvel\n`;
        }
        if (can('link_cliente') || can('dossier_pdf')) {
            prompt += `- 📝 Minutas: gerar contratos de compra e venda ou autorização de venda\n`;
        }
        if (can('owner_history')) {
            prompt += `- 🕐 Histórico do Proprietário: ver movimentações e histórico de negociações\n`;
        }

        // ── TOOLS disponíveis ─────────────────────────────────
        prompt += `\n## TOOLS DISPONÍVEIS:\n`;
        prompt += `- "search_properties": buscar imóveis\n`;
        prompt += `  Args: bairro (string), tipo (Apartamento/Casa/Terreno/Comercial), quartos_min (int), valor_min (float), valor_max (float), area_min (float)\n`;

        if (can('search_owner')) {
            prompt += `- "search_owners": buscar proprietários\n`;
            prompt += `  Args: name (nome parcial), doc (CPF/CNPJ parcial)\n`;
        }
        if (can('link_cliente') || can('dossier_pdf')) {
            prompt += `- "generate_contract": gerar minuta jurídica\n`;
            prompt += `  Args: type ('compra_venda' | 'autorizacao'), inscricao (código do imóvel), client_name, client_doc, price\n`;
        }

        // ── Exemplos de uso ───────────────────────────────────
        prompt += `\n## EXEMPLOS DE PERGUNTAS QUE VOCÊ PODE RESPONDER:\n`;
        prompt += `- "Busque apartamentos na Enseada com 3 quartos"\n`;
        prompt += `- "Mostre imóveis disponíveis até R$ 800.000 em Guarujá"\n`;
        if (can('search_owner'))    prompt += `- "Quem é o dono do Ed. Marina Park?"\n`;
        if (can('radar_mercado'))   prompt += `- "Tem algum imóvel com status 'Captar' na Praia das Pitangueiras?"\n`;
        if (can('advanced_ai'))     prompt += `- "Analise o potencial de oportunidade deste proprietário"\n`;
        if (can('dossier_pdf'))     prompt += `- "Gere um contrato de autorização de venda para inscrição 12345678901"\n`;

        prompt += `\nSe o usuário perguntar "o que posso fazer?" ou "como funciona?", responda APENAS com as funcionalidades listadas acima.`;
        prompt += `\nSe o usuário tentar usar algo além do seu plano, informe educadamente que aquela função requer um plano superior e sugira fazer upgrade.`;

        return prompt;
    }

    buildWelcomeMessage() {
        const role = window.Monetization?.userRole || 'user';
        const can  = (f) => window.Monetization?.canAccess(f) ?? false;

        const roleLabel = {
            user:   '🔓 Gratuito',
            start:  '⭐ Start',
            pro:    '🔵 Pro',
            elite:  '🟣 Elite',
            vip:    '👑 VIP Anual',
            master: '🏆 Master',
            admin:  '🏆 Master',
            guest:  '👤 Visitante'
        }[role] || role;

        let msg = `Olá! Sou o <b>GuaruBot</b> 🤖 — seu assistente do Guarujá GeoMap.<br>`;
        msg += `<span style="font-size:11px;opacity:0.7;">Plano: ${roleLabel}</span><br><br>`;
        msg += `Posso te ajudar com:<br>`;
        msg += `• 🗺️ Buscar imóveis no mapa<br>`;

        if (can('unlock_lote'))     msg += `• 🔓 Desbloquear fichas de imóveis<br>`;
        if (can('search_owner'))    msg += `• 👤 Encontrar proprietários por nome ou CPF<br>`;
        if (can('radar_mercado'))   msg += `• 📡 Filtros avançados de mercado<br>`;
        if (can('marketing_tools')) msg += `• 📊 Ficha Avançada do proprietário<br>`;
        if (can('mapear_patrimonio')) msg += `• 🏘️ Mapear patrimônio completo<br>`;
        if (can('advanced_ai'))     msg += `• 🧠 Análise Farol IA (score preditivo)<br>`;
        if (can('dossier_pdf'))     msg += `• 📄 Gerar Dossiê PDF ou Contrato<br>`;

        msg += `<br><i style="opacity:0.7;">Tente: "Busque aptos na Enseada com 3 quartos"</i>`;
        return msg;
    }

    _updateWelcomeMessage() {
        const el = document.getElementById('guarubot-welcome');
        if (el) el.innerHTML = this.buildWelcomeMessage();
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

            const isElite = window.Monetization ? window.Monetization.isEliteOrAbove() : false;

            if (error) {
                console.error("❌ Search Properties Error:", error);
                return { error: error.message };
            }

            // MASKING: Ensure privacy in AI results
            const maskedData = (data || []).map(unit => {
                const isMaster = window.Monetization && (window.Monetization.userRole === 'admin' || window.Monetization.userRole === 'master');
                const isUnlocked = isMaster || (window.Monetization && window.Monetization.isUnlocked(unit.inscricao, unit.lote_inscricao));
                
                return {
                    ...unit,
                    nome_proprietario: window.maskName(unit.nome_proprietario, isUnlocked),
                    contato_proprietario: isUnlocked ? unit.contato_proprietario : '********',
                    cpf_cnpj: window.formatDocument(unit.cpf_cnpj, isUnlocked)
                };
            });

            // FALLBACK LOGIC: If no specific units found, try finding the BUILDINGS (Lotes) in that neighborhood
            if (!maskedData || maskedData.length === 0) {
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

            console.log(`📊 Found ${maskedData.length} properties for query.`);
            return { count: maskedData.length, results: maskedData };
        }

        if (toolName === 'search_owners') {
            const isElite = window.Monetization ? window.Monetization.isEliteOrAbove() : false;
            let query = window.supabaseApp.from('proprietarios').select('*');
            if (args.name) query = query.ilike('nome_completo', `%${args.name}%`);
            if (args.doc) query = query.ilike('cpf_cnpj', `%${args.doc}%`);

            const { data, error } = await query.limit(5);
            if (error) return { error: error.message };

            // MASKING
            const isMaster = window.Monetization && (window.Monetization.userRole === 'admin' || window.Monetization.userRole === 'master');
            
            return (data || []).map(owner => {
                const isUnlocked = isMaster || (window.Monetization && window.Monetization.isUnlockedPerson(owner.cpf_cnpj));
                return {
                    ...owner,
                    nome_completo: window.maskName(owner.nome_completo, isUnlocked),
                    cpf_cnpj: window.formatDocument(owner.cpf_cnpj, isUnlocked)
                };
            });
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
                    
                    // ERRO 403: API Desativada ou Sem Permissão
                    if (response.status === 403) {
                        console.error("🚫 Gemini 403 Forbidden:", errText);
                        this.handle403Error(errText);
                        throw new Error("API do Gemini desativada. Verifique o modal de configuração.");
                    }

                    // ERRO 404: Modelo não encontrado - Tentar Fallback
                    if (response.status === 404 && this.fallbackModels && this.fallbackModels.length > 0) {
                        const nextModel = this.fallbackModels.shift();
                        console.warn(`⚠️ Model ${this.currentModel} not found. Retrying with ${nextModel}...`);
                        this.currentModel = nextModel;
                        
                        // Wait a bit before retry to avoid spamming
                        await new Promise(res => setTimeout(res, 1000));
                        return this._callGeminiApi(history); 
                    }

                    // ERRO 429: API Busy - Se persistir, tentar trocar de modelo no fallback
                    if (response.status === 429) {
                        if (retries >= 2 && this.fallbackModels && this.fallbackModels.length > 0) {
                            const nextModel = this.fallbackModels.shift();
                            console.warn(`⏳ Model ${this.currentModel} remains busy (429). Switching to fallback: ${nextModel}`);
                            this.currentModel = nextModel;
                            return this._callGeminiApi(history);
                        }
                        throw new Error(`API Busy (${response.status})`);
                    }

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

    handle403Error(errorBody) {
        let activationUrl = "https://aistudio.google.com/app/apikey";
        
        // Tenta extrair a URL de ativação do corpo do erro (Google Cloud Console)
        try {
            const errJson = JSON.parse(errorBody);
            const helpLink = errJson.error?.details?.find(d => d.links)?.links?.[0]?.url;
            if (helpLink) activationUrl = helpLink;
        } catch(e) {}

        this.showApiConfigModal(activationUrl);
    }

    showApiConfigModal(activationUrl) {
        // Evita múltiplos modais
        if (document.getElementById('gemini-config-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'gemini-config-modal';
        modal.className = 'custom-modal-overlay active';
        modal.style.zIndex = '10002';
        modal.innerHTML = `
            <div class="custom-modal" style="max-width: 500px;">
                <div class="custom-modal-header" style="background: #ef4444; color: white;">
                    <div class="custom-modal-title">🚨 IA Desativada (Erro 403)</div>
                    <button class="custom-modal-close" onclick="this.closest('.custom-modal-overlay').remove()">&times;</button>
                </div>
                <div class="custom-modal-body" style="padding: 25px;">
                    <p style="margin-bottom: 15px; font-weight: 600; color: #1e293b;">
                        A API do Google Gemini não está ativa ou sua chave expirou.
                    </p>
                    
                    <div style="background: #fef2f2; border: 1px solid #fee2e2; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <h4 style="margin: 0 0 10px 0; color: #991b1b; font-size: 14px;">Como resolver (Grátis):</h4>
                        <ol style="margin: 0; padding-left: 20px; font-size: 13px; color: #7f1d1d;">
                            <li style="margin-bottom: 8px;"><b>Ative a API:</b> Clique no botão abaixo para ir ao console do Google e ativar a "Generative Language API".</li>
                            <li style="margin-bottom: 8px;"><b>Ou use sua própria chave:</b> Vá em <a href="https://aistudio.google.com/" target="_blank" style="color: #b91c1c; font-weight: bold;">AI Studio</a>, gere uma chave grátis e cole abaixo.</li>
                        </ol>
                    </div>

                    <div style="margin-bottom: 20px;">
                        <label style="display: block; font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 800; margin-bottom: 5px;">Sua Nova Chave API (Opcional)</label>
                        <input type="password" id="new-gemini-key" placeholder="AIzaSy..." 
                               style="width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-family: monospace;">
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        <a href="${activationUrl}" target="_blank" 
                           style="background: #1e293b; color: white; padding: 12px; border-radius: 8px; text-decoration: none; text-align: center; font-weight: 700; font-size: 13px;">
                           <i class="fas fa-external-link-alt"></i> Abrir Console de Ativação
                        </a>
                        <button id="save-gemini-key" 
                                style="background: #10b981; color: white; border: none; padding: 12px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer;">
                           Salvar Chave e Tentar Novamente
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('#save-gemini-key').onclick = () => {
            const newKey = document.getElementById('new-gemini-key').value.trim();
            if (newKey) {
                localStorage.setItem('gemini_api_key', newKey);
                window.location.reload(); // Recarrega para aplicar a nova chave
            } else {
                window.Toast.info("Por favor, ative a API no console primeiro ou insira uma nova chave.");
            }
        };
    }
}

// Inicializa quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    window.Farol = new GeminiChatHandler();
});
