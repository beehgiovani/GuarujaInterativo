// ==========================================
// ENRICHMENT HANDLER - CORE API
// ==========================================
// Integração para enriquecimento de dados (Telefones, Emails)

const ENRICHMENT_API_URL = 'https://ijmgvsztgljribnogtsx.supabase.co/functions/v1/enrich-data'; // Edge Function Production
// const API_KEY = '...'; // Key is now handled by the proxy for security

window.Enrichment = {

    // Verifica se já temos dados em cache (menos de 30 dias)
    _isCacheValid(dados_enrichment, data_enriquecimento) {
        if (!dados_enrichment || !data_enriquecimento) return false;
        const diffDays = (Date.now() - new Date(data_enriquecimento).getTime()) / (1000 * 60 * 60 * 24);
        return diffDays < 30;
    },

    // Destaca visualmente no mapa todas as unidades do proprietário (efeito radar)
    highlightOwnerPortfolio(cpf_cnpj, propNome) {
        if (!window.allLotes || !cpf_cnpj) return;
        let count = 0;
        window.allLotes.forEach(lote => {
            if (!lote.polygons) return;
            const ownerUnits = (lote.unidades || []).filter(
                u => u.cpf_cnpj && u.cpf_cnpj.replace(/\D/g, '') === cpf_cnpj.replace(/\D/g, '')
            );
            if (ownerUnits.length > 0) {
                count++;
                // Pulsar o polígono por 3 segundos
                lote.polygons.forEach(poly => {
                    poly.setOptions({ fillColor: '#7c3aed', fillOpacity: 0.5, strokeColor: '#7c3aed', strokeWeight: 3 });
                    setTimeout(() => {
                        try { poly.setOptions({ fillColor: lote._originalFillColor || '#2563eb', fillOpacity: 0.25, strokeColor: '#1e40af', strokeWeight: 1 }); } catch(e) {}
                    }, 3500);
                });
            }
        });
        if (count > 1) {
            window.Toast.info(`📍 ${count} imóveis de '${propNome || 'Proprietário'}' destacados no mapa!`, 'Portfólio Detectado');
        }
    },

    // Função Principal: Enriquecer Unidade
    async enrichUnit(inscricao) {
        // SECURITY GUARD: Check if user can use marketing tools (Enrichment)
        if (window.Monetization && !window.Monetization.canAccess('marketing_tools')) {
            window.Monetization.showSubscriptionPlans();
            window.Toast.info("Fichas Avançadas são exclusivas para planos Pro ou superiores.");
            return;
        }

        // Encontrar unidade localmente...
        let unit = window.allLotes
            ? window.allLotes.flatMap(l => l.unidades || []).find(u => u.inscricao === inscricao)
            : null;

        if (!unit) {
            const { data, error } = await window.supabaseApp
                .from('unidades')
                .select('*')
                .eq('inscricao', inscricao)
                .single();
            if (error || !data) { window.Toast.error('Unidade não encontrada.'); return; }
            unit = data;
        }

        const doc = unit.cpf_cnpj ? unit.cpf_cnpj.replace(/\D/g, '') : null;
        if (!doc) { window.Toast.warning('Unidade sem CPF/CNPJ para consulta.'); return; }

        // MONETIZATION CHECK
        const hasCredits = await window.Monetization.checkCredits(1);
        if (!hasCredits) return;

        // 💾 CACHE CHECK: Verificar se já temos dados do proprietário no banco
        const { data: cachedProp } = await window.supabaseApp
            .from('proprietarios')
            .select('id, nome_completo, dados_enrichment, data_enriquecimento, cpf_cnpj')
            .eq('cpf_cnpj', doc)
            .maybeSingle();

        const isAlreadyUnlocked = window.Monetization.isUnlockedEnrichment(doc);

        if (this._isCacheValid(cachedProp?.dados_enrichment, cachedProp?.data_enriquecimento) && isAlreadyUnlocked) {
            // Só libera do cache sem cobrar se JÁ foi desbloqueado pelo usuário (ou é Master)
            window.Loading.show('Visualizando Ficha...', 'Recuperando do banco local (Gratuito)...');
            try {
                window.Toast.success(`Ficha de ${cachedProp.nome_completo} (Cache Local)`);
                this.highlightOwnerPortfolio(doc, cachedProp.nome_completo);
                if (window.ProprietarioTooltip && cachedProp.id) {
                    window.ProprietarioTooltip.show(cachedProp.id);
                }
            } finally {
                window.Loading.hide();
            }
            return;
        }

        // Sem cache válido — chamar API de Enriquecimento
        window.Loading.show('Consultando Ficha Avançada...', 'Buscando contatos atualizados...');
        try {
            let result = null;
            if (doc.length === 11) result = await this.searchPerson(doc, unit.nome_proprietario);
            else if (doc.length === 14) result = await this.searchCompany(doc);
            else throw new Error('Documento inválido (nem CPF nem CNPJ).');

            if (result) {
                const savedProp = await this.saveEnrichment(unit, result);
                await window.Monetization.consumeCredits(2, `Ficha Avançada ${unit.inscricao}`);
                this.highlightOwnerPortfolio(doc, result.name || result.company_name);
                if (savedProp && window.ProprietarioTooltip) {
                    window.ProprietarioTooltip.show(savedProp.id);
                }
                // 🕸️ GRAFO RELACIONAL: processar familiares/sócios retornados
                if (savedProp && window.EnrichmentRelationsUI) {
                    window.EnrichmentRelationsUI.process(
                        savedProp.id,
                        savedProp.nome_completo || result.name || result.company_name,
                        result
                    );
                }
            } else {
                window.Toast.info('Nenhum dado encontrado na base externa. Seus créditos foram preservados.');
            }
        } catch (e) {
            console.error('Enrichment Error:', e);
            window.Toast.error('Erro na consulta: ' + e.message);
        } finally {
            window.Loading.hide();
        }
    },

    // Função: Enriquecer via CPF/CNPJ direto (Para Tooltip Proprietário)
    async enrichPerson(cpf_cnpj, nome_proprietario) {
        // SECURITY GUARD: Check if user can use marketing tools (Enrichment)
        if (window.Monetization && !window.Monetization.canAccess('marketing_tools')) {
            window.Monetization.showSubscriptionPlans();
            return;
        }

        const doc = cpf_cnpj ? cpf_cnpj.replace(/\D/g, '') : null;
        if (!doc) {
            window.Toast.warning('Documento inválido para consulta.');
            return;
        }

        // MONETIZATION CHECK
        const hasCredits = await window.Monetization.checkCredits(1);
        if (!hasCredits) return;

        // 💾 CACHE CHECK: Se já temos dados em nosso banco, servir do cache
        const { data: cachedProp } = await window.supabaseApp
            .from('proprietarios')
            .select('id, nome_completo, dados_enrichment, data_enriquecimento')
            .eq('cpf_cnpj', doc)
            .maybeSingle();

        // Se não veio nome pelo parâmetro, tenta usar o cache do banco
        if (!nome_proprietario && cachedProp?.nome_completo) {
            nome_proprietario = cachedProp.nome_completo;
        }

        const isAlreadyUnlocked = window.Monetization.isUnlockedEnrichment(doc);

        if (this._isCacheValid(cachedProp?.dados_enrichment, cachedProp?.data_enriquecimento) && isAlreadyUnlocked) {
            window.Loading.show('Visualizando Ficha...', 'Recuperando do banco local (Gratuito)...');
            try {
                window.Toast.success(`Dados de ${cachedProp.nome_completo} (Cache Local)`);
                this.highlightOwnerPortfolio(doc, cachedProp.nome_completo);
                if (window.ProprietarioTooltip && cachedProp.id) {
                    window.ProprietarioTooltip.show(cachedProp.id);
                }
            } finally {
                window.Loading.hide();
            }
            return;
        }

        // Sem cache — chamar a API de Enriquecimento
        window.Loading.show('Consultando Ficha Avançada...', 'Buscando dados do proprietário...');

        try {
            let result = null;
            if (doc.length === 11) {
                result = await this.searchPerson(doc, nome_proprietario);
            } else if (doc.length === 14) {
                result = await this.searchCompany(doc);
            } else {
                throw new Error('Documento inválido.');
            }

            if (result) {
                const cpfLimpo = doc;
                const tipo = cpfLimpo.length === 11 ? 'PF' : 'PJ';

                const { data: proprietario, error: propError } = await window.supabaseApp
                    .from('proprietarios')
                    .upsert({
                        cpf_cnpj: cpfLimpo,
                        nome_completo: result.name || result.company_name,
                        tipo: tipo,
                        dados_enrichment: result,
                        rg: result.rg,
                        data_nascimento: result.birthday,
                        idade: result.age ? parseInt(String(result.age).match(/\d+/)) : null,
                        genero: result.gender,
                        nome_mae: result.mother_name,
                        situacao_cadastral: result.registry_situation,
                        pep: result.pep || false,
                        aposentado: result.retired || false,
                        possivelmente_falecido: result.possibly_dead || false,
                        bolsa_familia: result.bolsa_familia || false,
                        ocupacao: result.cbo_description,
                        renda_estimada: result.estimated_income,
                        data_enriquecimento: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'cpf_cnpj' })
                    .select()
                    .single();

                if (propError) throw propError;

                // Sync phones para todas as unidades do CPF
                let syncPhones = [];
                if (result.mobile_phones) {
                    result.mobile_phones.forEach(p => {
                        const ddd = String(p.ddd).padStart(2, '0');
                        syncPhones.push(window.formatPhone(ddd + p.number));
                    });
                }
                if (result.land_lines) {
                    result.land_lines.forEach(p => {
                        const ddd = String(p.ddd).padStart(2, '0');
                        syncPhones.push(window.formatPhone(ddd + p.number));
                    });
                }
                const uniqueSyncPhones = [...new Set(syncPhones)];

                const syncByCPF = window.supabaseApp
                    .from('unidades')
                    .update({
                        contato_proprietario: uniqueSyncPhones,
                        last_enrichment_at: new Date().toISOString(),
                        proprietario_id: proprietario.id,
                        nome_proprietario: proprietario.nome_completo
                    })
                    .eq('cpf_cnpj', cpfLimpo);

                const syncByName = window.supabaseApp
                    .from('unidades')
                    .update({
                        cpf_cnpj: cpfLimpo,
                        contato_proprietario: uniqueSyncPhones,
                        last_enrichment_at: new Date().toISOString(),
                        proprietario_id: proprietario.id
                    })
                    .ilike('nome_proprietario', proprietario.nome_completo)
                    .is('cpf_cnpj', null);

                await Promise.all([syncByCPF, syncByName]);

                // Consumir créditos
                const consumeResult = await window.Monetization.consumeCredits(2, `Ficha Avançada Proprietário ${cpfLimpo}`);

                if (consumeResult && consumeResult.success) {
                    // Registrar persistência do desbloqueio para este usuário
                    try {
                        const { data: { user } } = await window.supabaseApp.auth.getUser();
                        if (user) {
                            await window.supabaseApp.from('unlocked_persons').insert({
                                user_id: user.id,
                                cpf_cnpj: String(cpf_cnpj).replace(/\D/g, '')
                            });
                            // Atualizar estado local
                            if (window.Monetization.unlockedPersons) {
                                window.Monetization.unlockedPersons.add(String(cpf_cnpj).replace(/\D/g, ''));
                            }
                        }
                    } catch (e) {
                        console.warn("Erro ao registrar persistência do desbloqueio de proprietário:", e);
                    }
                }

                window.Toast.success(`Dados de ${proprietario.nome_completo} desbloqueados e salvos!`);

                // Efeito Radar: destacar todos os imóveis deste proprietário
                this.highlightOwnerPortfolio(cpfLimpo, proprietario.nome_completo);

                // 🕸️ GRAFO RELACIONAL: processar familiares/sócios retornados
                if (window.EnrichmentRelationsUI) {
                    window.EnrichmentRelationsUI.process(
                        proprietario.id,
                        proprietario.nome_completo,
                        result
                    );
                }

                if (window.ProprietarioTooltip && window.currentTooltip) {
                    window.ProprietarioTooltip.show(proprietario.id);
                }
            } else {
                window.Toast.info('Nenhum dado encontrado na base externa. Seus créditos foram preservados.');
            }
        } catch (e) {
            console.error('Enrichment Person Error:', e);
            window.Toast.error('Erro na consulta: ' + e.message);
        } finally {
            window.Loading.hide();
        }
    },

    // Buscar Pessoa Física
    async searchPerson(cpf, name) {
        // Endpoint mock/doc sugeria search?name=... mas para CPF direto geralmente é /persons/{cpf} ou query
        // Analisando padrão REST para a API de Enriquecimento: 
        // GET /persons?tax_id=... ou GET /persons/{cpf}
        // O usuário passou Java com query params: map... .GET... url + query.
        // Vamos tentar buscar por CPF primeiro, que é mais preciso.

        // A Edge Function espera o parâmetro 'document' e converte internamente
        const url = `${ENRICHMENT_API_URL}/persons?document=${cpf}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // Tenta fallback se der 404 ou erro na rota de search
        if (!response.ok) {
            console.warn('Search failed, trying direct endpoint...');
            // Fallback logic could go here
            throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();
        // A API retorna lista ou objeto? Exemplo Java mostrava lista `[ ... ]`.
        if (Array.isArray(data) && data.length > 0) return data[0];
        if (!Array.isArray(data) && data.nme) return data; // Se retornar objeto direto

        return null;
    },

    // Buscar Pessoa Jurídica
    async searchCompany(cnpj) {
        // A Edge Function espera o parâmetro 'document' e converte internamente
        const url = `${ENRICHMENT_API_URL}/companies?document=${cnpj}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error(`API Error: ${response.status}`);

        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) return data[0];
        return data;
    },

    // Salvar no Banco
    async saveEnrichment(unit, data) {
        // Extrair telefones (estrutura real da API)
        let newPhones = [];

        // Celulares - formato: { ddd: 13, number: "991248146", priority: 1, whatsapp_datetime: "..." }
        if (data.mobile_phones && Array.isArray(data.mobile_phones)) {
            data.mobile_phones.forEach(p => {
                if (p.ddd && p.number) {
                    // Garantir que DDD tenha sempre 2 dígitos (ex: 01, 13)
                    const ddd = String(p.ddd).padStart(2, '0');
                    // Formatar usando utilitário centralizado
                    const formatted = window.formatPhone(ddd + p.number);
                    newPhones.push(formatted);
                }
            });
        }

        // Fixos - formato: { ddd: 13, number: "30248944", priority: 1 }
        if (data.land_lines && Array.isArray(data.land_lines)) {
            data.land_lines.forEach(p => {
                if (p.ddd && p.number) {
                    // Garantir que DDD tenha sempre 2 dígitos (ex: 01, 13)
                    const ddd = String(p.ddd).padStart(2, '0');
                    // Formatar usando utilitário centralizado
                    const formatted = window.formatPhone(ddd + p.number);
                    newPhones.push(formatted);
                }
            });
        }

        // Emails - formato: { email: "...", priority: 1 }
        let newEmails = [];
        if (data.emails && Array.isArray(data.emails)) {
            data.emails.forEach(e => {
                if (e.email) {
                    newEmails.push(e.email);
                }
            });
        }

        // Remover duplicatas
        const uniquePhones = [...new Set(newPhones)];
        const uniqueEmails = [...new Set(newEmails)];

        // Mesclar com contatos existentes
        const currentContacts = Array.isArray(unit.contato_proprietario)
            ? unit.contato_proprietario
            : (unit.contato_proprietario ? [unit.contato_proprietario] : []);

        const allContacts = [...new Set([...currentContacts, ...uniquePhones])];

        // Preparar dados adicionais para salvar (opcional - informações extras úteis)
        const enrichmentSummary = {
            phones: uniquePhones,
            emails: uniqueEmails,
            name: data.name || null,
            age: data.age || null,
            birthday: data.birthday || null,
            gender: data.gender || null,
            occupation: data.cbo_description || null,
            estimated_income: data.estimated_income || null,
            employer: data.employer && data.employer[0] ? data.employer[0].company_name : null,
            addresses: data.addresses || [],
            enriched_at: new Date().toISOString()
        };

        // Atualizar DB
        const { error } = await window.supabaseApp
            .from('unidades')
            .update({
                contato_proprietario: allContacts,
                dados_enrichment: data, // SALVAR DADOS COMPLETOS (não summary)
                last_enrichment_at: new Date().toISOString()
            })
            .eq('inscricao', unit.inscricao);

        if (error) throw error;

        // ============================================
        // NOVO: Atualizar/Criar Proprietário Unificado
        // ============================================
        if (unit.cpf_cnpj) {
            const cpfLimpo = unit.cpf_cnpj.replace(/\D/g, '');
            const tipo = cpfLimpo.length === 11 ? 'PF' : 'PJ';

            try {
                // UPSERT em proprietarios (Registro de Ouro)
                const { data: proprietario, error: propError } = await window.supabaseApp
                    .from('proprietarios')
                    .upsert({
                        cpf_cnpj: cpfLimpo,
                        nome_completo: data.name || unit.nome_proprietario,
                        tipo: tipo,
                        dados_enrichment: data,
                        rg: data.rg,
                        data_nascimento: data.birthday,
                        idade: data.age ? parseInt(String(data.age).match(/\d+/)) : null,
                        genero: data.gender,
                        nome_mae: data.mother_name,
                        situacao_cadastral: data.registry_situation,
                        pep: data.pep || false,
                        aposentado: data.retired || false,
                        possivelmente_falecido: data.possibly_dead || false,
                        bolsa_familia: data.bolsa_familia || false,
                        ocupacao: data.cbo_description,
                        renda_estimada: data.estimated_income,
                        data_enriquecimento: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'cpf_cnpj' })
                    .select()
                    .single();

                if (!propError && proprietario) {
                    // --- SINCRONIZAÇÃO UNIVERSAL (Master Sync) ---
                    // 1. Atualiza todas as unidades pelo CPF
                    const syncByCPF = window.supabaseApp
                        .from('unidades')
                        .update({ 
                            proprietario_id: proprietario.id,
                            contato_proprietario: allContacts,
                            nome_proprietario: proprietario.nome_completo
                        })
                        .eq('cpf_cnpj', cpfLimpo);

                    // 2. Atualiza via NOME (para unidades que ainda estão sem CPF)
                    const syncByName = window.supabaseApp
                        .from('unidades')
                        .update({ 
                            proprietario_id: proprietario.id,
                            cpf_cnpj: cpfLimpo,
                            contato_proprietario: allContacts
                        })
                        .ilike('nome_proprietario', proprietario.nome_completo)
                        .is('cpf_cnpj', null);

                    await Promise.all([syncByCPF, syncByName]);
                    console.log(`✅ Patrimônio de ${proprietario.nome_completo} unificado e sincronizado.`);
                }
            } catch (propErr) {
                console.warn('Erro na sincronização universal:', propErr);
            }
        }

        // Atualizar memória local (Refletir no tooltip instantaneamente)
        unit.contato_proprietario = allContacts;
        unit.dados_enrichment = data; // DADOS COMPLETOS

        window.Toast.success(`✅ ${uniquePhones.length} telefones e ${uniqueEmails.length} e-mails encontrados!`);

        // Re-render tooltip se estiver aberto
        if (window.currentTooltip) {
            if (window.currentLoteForUnit && unit.inscricao) {
                // We are likely in unit view
                window.showUnitTooltip(unit, window.currentLoteForUnit, 0, 0);
            } else {
                // Fallback to lot view refresh
                window.closeLotTooltip();
                const lote = window.allLotes.find(l => l.inscricao === unit.lote_inscricao);
                setTimeout(() => window.showLotTooltip(lote, 0, 0), 100);
            }
        }
    },

    // ========================================
    // API STATUS CHECK (Sidebar)
    // ========================================
    async checkApiStatus() {
        const statusContainer = document.getElementById('api-status-list');
        if (!statusContainer) return;

        statusContainer.innerHTML = '<div style="color: #666; font-size: 11px; font-style: italic;">Verificando...</div>';

        try {
            // Chama a Edge Function com action=check_status
            const response = await fetch(`${ENRICHMENT_API_URL}?action=check_status`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) throw new Error(`Erro API: ${response.status}`);

            const data = await response.json();
            statusContainer.innerHTML = '';

            if (data.keys && Array.isArray(data.keys)) {
                data.keys.forEach(k => {
                    const color = k.valid && k.balance > 0 ? '#22c55e' : (k.valid ? '#f59e0b' : '#ef4444');
                    const icon = k.valid ? 'fa-coins' : 'fa-times-circle';

                    // Nomes amigáveis baseados no índice (conforme combinado)
                    let name = `Chave #${k.index + 1}`;
                    if (k.index === 0) name = 'Bruno';
                    else if (k.index === 1) name = 'Luis';
                    else if (k.index === 2) name = 'Reinaldo';
                    else if (k.index === 3) name = 'Jânio';
                    else if (k.index === 4) name = 'RENATO';
                    
                    const div = document.createElement('div');
                    div.style.marginBottom = '6px';
                    div.style.fontSize = '11px';
                    div.style.display = 'flex';
                    div.style.alignItems = 'center';
                    div.style.justifyContent = 'space-between';
                    div.innerHTML = `
                        <span style="display: flex; align-items: center; gap: 6px;">
                            <i class="fas ${icon}" style="color: ${color};"></i> 
                            ${name} <span style="opacity: 0.5; font-size: 9px;">(${k.key})</span>
                        </span>
                        <span style="font-weight: 600; color: ${color}; font-size: 10px;">${k.message}</span>
                    `;
                    statusContainer.appendChild(div);
                });
            } else {
                statusContainer.innerText = 'Resposta inesperada.';
            }

        } catch (e) {
            console.error(e);
            statusContainer.innerHTML = `<div style="color: red; font-size: 11px;">Erro: ${e.message}</div>`;
        }
    },

    // Helper: Get formatted balance string for confirmation
    async getBalancesString() {
        try {
            const response = await fetch(`${ENRICHMENT_API_URL}?action=check_status`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) return 'Não foi possível obter o saldo atual.';

            const data = await response.json();
            if (data.keys && Array.isArray(data.keys)) {
                let msg = '💰 SALDO ATUAL:\n';
                data.keys.forEach(k => {
                    let name = `Chave #${k.index + 1}`;
                    if (k.index === 0) name = 'Bruno';
                    else if (k.index === 1) name = 'Luis';
                    else if (k.index === 2) name = 'Reinaldo';

                    msg += `- ${name}: ${k.message}\n`;
                });
                return msg;
            }
            return 'Saldo indisponível.';
        } catch (e) {
            console.error(e);
            return 'Erro ao verificar saldo.';
        }
    },

    // ========================================
    // CNPJ PUBLICO & PARTNERS
    // ========================================

    // Busca dados públicos de CNPJ (Gratuito - receita)
    async fetchPublicCNPJ(cnpj) {
        const cleanCNPJ = cnpj.replace(/\D/g, '');
        if (cleanCNPJ.length !== 14) throw new Error('CNPJ inválido');

        // Usando proxy ou chamada direta se CORS permitir (publica.cnpj.ws tem CORS aberto geralmente)
        // Rate limit: 3 req/min
        const url = `https://publica.cnpj.ws/cnpj/${cleanCNPJ}`;

        try {
            const response = await fetch(url);

            if (response.status === 429) {
                throw new Error('Muitas requisições (Limite: 3/min). Aguarde um pouco.');
            }
            if (!response.status === 200) {
                throw new Error(`Erro API: ${response.status}`);
            }

            const data = await response.json();
            return data;

        } catch (e) {
            console.error('Erro fetching public CNPJ:', e);
            throw e;
        }
    },

    // Processa sócios retornados da API Pública
    // Cria/Atualiza perfis para eles e cria vínculo
    async processPartners(pjProprietarioId, socios) {
        if (!socios || socios.length === 0) return;

        let processedCount = 0;

        for (const socio of socios) {
            // Tenta identificar se o sócio já existe
            // A API Publica retorna cpf_cnpj_socio mascarado (***123456**) ou completo?
            // Geralmente mascarado. Mas retorna NOME.

            const nomeSocio = socio.nome;
            const papel = socio.qualificacao_socio ? socio.qualificacao_socio.descricao : 'Sócio';

            // Se nome for muito curto, ignora
            if (!nomeSocio || nomeSocio.length < 3) continue;

            // 1. Tentar achar proprietário existente pelo NOME (já que CPF vem mascarado)
            // Usar FTS ou ILIQUE na coluna nome_busca
            let existingId = null;

            const { data: existing } = await window.supabaseApp
                .from('proprietarios')
                .select('id, nome_completo')
                .ilike('nome_completo', nomeSocio)
                .limit(1);

            if (existing && existing.length > 0) {
                existingId = existing[0].id;
                console.log(`Sócio encontrado existente: ${existingId} - ${nomeSocio}`);
            } else {
                // 2. Se não existe, CRIAR um "Skel" de proprietário (PF)
                // Marcado como 'Rascunho' ou apenas com nome
                const { data: newProp, error: createError } = await window.supabaseApp
                    .from('proprietarios')
                    .insert({
                        nome_completo: nomeSocio,
                        tipo: 'PF', // Assumimos PF, mas pode ser PJ
                        cpf_cnpj: `S_PJ_${pjProprietarioId}_${Math.floor(Math.random() * 10000)}`, // CPF temporário único
                        dados_enrichment: {
                            origem: 'socio_public_api',
                            raw_socio_data: socio,
                            masked_cpf: socio.cpf_cnpj_socio
                        }
                    })
                    .select()
                    .single();

                if (!createError && newProp) {
                    existingId = newProp.id;
                    console.log(`Novo perfil de sócio criado: ${existingId}`);
                } else {
                    console.warn("Erro criando sócio:", createError);
                }
            }

            // 3. Criar Vínculo na tabela proprietario_relacionamentos
            if (existingId) {
                // Upsert no relacionamento
                const { error: relError } = await window.supabaseApp
                    .from('proprietario_relacionamentos')
                    .upsert({
                        proprietario_origem_id: pjProprietarioId,
                        proprietario_destino_id: existingId,
                        tipo_vinculo: papel,
                        metadata: { data_entrada: socio.data_entrada }
                    }, { onConflict: 'proprietario_origem_id,proprietario_destino_id,tipo_vinculo' });

                if (!relError) processedCount++;
            }
        }

        return processedCount;
    },

    // Buscar Pessoa Física via Nome (Fallback para sócios com CPF mascarado)
    async searchPersonByName(name, state = 'SP') {
        const url = `${ENRICHMENT_API_URL}/persons?name=${encodeURIComponent(name)}&state=${state}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) throw new Error(`API Error: ${response.status}`);

        const data = await response.json();
        // Pode retornar lista
        if (Array.isArray(data) && data.length > 0) return data;
        return [];
    },

    initSidebarStatus() {
        // Bloquear visualização para não-admins
        const isMaster = window.Monetization && (window.Monetization.userRole === 'admin' || window.Monetization.userRole === 'master');
        if (!isMaster) return;

        const sidebarContent = document.getElementById('sidebar');
        if (!sidebarContent) return;

        if (document.getElementById('enrichment-status-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'enrichment-status-panel';
        panel.style.margin = '15px 0';
        panel.style.padding = '15px';
        panel.style.borderTop = '1px solid rgba(0,0,0,0.1)';
        panel.style.background = 'rgba(255,255,255,0.5)';
        panel.style.borderRadius = '8px';

        panel.innerHTML = `
            <div style="font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; display: flex; justify-content: space-between; align-items: center;">
                STATUS FICHAS AVANÇADAS
                <button onclick="window.Enrichment.checkApiStatus()" style="background: none; border: none; color: #3b82f6; cursor: pointer; font-size: 11px;" title="Atualizar Agora">
                    <i class="fas fa-sync-alt"></i>
                </button>
            </div>
            <div id="api-status-list">
                <button onclick="window.Enrichment.checkApiStatus()" style="width: 100%; padding: 8px; background: white; border: 1px solid #cbd5e1; color: #3b82f6; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.2s;">
                    <i class="fas fa-search-dollar"></i> Atualizar Status de Limites
                </button>
            </div>
        `;

        const statsPanel = sidebarContent.querySelector('.stats-panel');
        if (statsPanel) {
            sidebarContent.insertBefore(panel, statsPanel);
        } else {
            sidebarContent.appendChild(panel);
        }
    },

    // ========================================
    // NEW: SHOW FULL DETAILS MODAL (+ INF)
    // ========================================
    async showFullDetails(proprietarioId) {
        if (!proprietarioId || proprietarioId === 'null' || proprietarioId === 'undefined') {
            window.Toast.warning('Proprietário não identificado. Realize a consulta avançada primeiro.');
            return;
        }

        window.Loading.show('Buscando Detalhes...', 'Acessando base de dados');
        try {
            const { data: prop, error } = await window.supabaseApp
                .from('proprietarios')
                .select('*')
                .eq('id', proprietarioId)
                .single();

            if (error || !prop) throw error || new Error('Proprietário não encontrado');

            // SECURITY GUARD: Ensure user has unlocked this person or is Elite
            const isUnlocked = window.Monetization && (window.Monetization.isEliteOrAbove() || window.Monetization.isUnlockedPerson(prop.cpf_cnpj));
            if (!isUnlocked) {
                window.Loading.hide();
                window.Monetization.showSubscriptionPlans();
                window.Toast.error("Você precisa desbloquear este proprietário para ver a ficha completa.");
                return;
            }

            const data = prop.dados_enrichment || {};

            const detailModal = document.createElement('div');
            detailModal.className = 'custom-modal-overlay active';
            detailModal.style.zIndex = '10005';
            
            let html = `
                <div class="custom-modal" style="max-width: 700px; width: 95%; max-height: 85vh; display: flex; flex-direction: column;">
                    <div class="custom-modal-header" style="background: linear-gradient(135deg, #1e3a8a, #1e40af); color: white;">
                        <div class="custom-modal-title"><i class="fas fa-database"></i> Ficha Cadastral Avançada</div>
                        <button class="custom-modal-close" onclick="this.closest('.custom-modal-overlay').remove()">&times;</button>
                    </div>
                    <div class="custom-modal-body" style="padding: 24px; overflow-y: auto; background: #f8fafc;">
                        
                        <div style="background: white; border-radius: 12px; border: 1px solid #e2e8f0; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 20px;">
                            <div style="font-size: 18px; font-weight: 800; color: #1e293b; margin-bottom: 12px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px;">Dados Cadastrais</div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                                ${this.renderDetailRow('Nome', prop.nome_completo)}
                                ${this.renderDetailRow('CPF/CNPJ', window.formatDocument(prop.cpf_cnpj, true))}
                                ${this.renderDetailRow('RG', prop.rg)}
                                ${this.renderDetailRow('Nascimento', prop.data_nascimento ? new Date(prop.data_nascimento).toLocaleDateString('pt-BR') : '-')}
                                ${this.renderDetailRow('Idade', prop.idade)}
                                ${this.renderDetailRow('Gênero', prop.genero)}
                                ${this.renderDetailRow('Situação CPF', prop.situacao_cadastral)}
                                ${this.renderDetailRow('Nome da Mãe', prop.nome_mae)}
                            </div>
                        </div>

                        <div style="background: white; border-radius: 12px; border: 1px solid #e2e8f0; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 20px;">
                            <div style="font-size: 18px; font-weight: 800; color: #1e293b; margin-bottom: 12px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px;">Perfil Socioeconômico</div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                                ${this.renderDetailRow('Ocupação', prop.ocupacao)}
                                ${this.renderDetailRow('Renda Estimada', prop.renda_estimada)}
                                ${this.renderDetailRow('Aposentado', prop.aposentado ? 'Sim' : 'Não')}
                                ${this.renderDetailRow('PEP (Polít. Exp.)', prop.pep ? 'Sim' : 'Não')}
                                ${this.renderDetailRow('Bolsa Família', prop.bolsa_familia ? 'Sim' : 'Não')}
                                ${this.renderDetailRow('Possiv. Falecido', prop.possivelmente_falecido ? 'Sim' : 'Não')}
                            </div>
                        </div>

                        ${data.addresses ? `
                        <div style="background: white; border-radius: 12px; border: 1px solid #e2e8f0; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 20px;">
                            <div style="font-size: 18px; font-weight: 800; color: #1e293b; margin-bottom: 12px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px;">Endereços Conhecidos</div>
                            <div style="display: flex; flex-direction: column; gap: 8px;">
                                ${data.addresses.slice(0, 10).map(addr => `
                                    <div style="font-size: 12px; border-bottom: 1px dashed #f1f5f9; padding: 4px 0;">
                                        <i class="fas fa-map-marker-alt" style="color: #64748b;"></i> ${addr.street || ''}, ${addr.number || ''} ${addr.complement || ''} - ${addr.neighborhood || ''}, ${addr.city || ''}/${addr.state || ''}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        ` : ''}

                    </div>
                </div>
            `;
            detailModal.innerHTML = html;
            document.body.appendChild(detailModal);

        } catch (e) {
            console.error(e);
            window.Toast.error('Erro ao buscar detalhes: ' + e.message);
        } finally {
            window.Loading.hide();
        }
    },

    renderDetailRow(label, value) {
        return `
            <div>
                <div style="font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase;">${label}</div>
                <div style="font-size: 13px; color: #334155; font-weight: 600;">${value || '-'}</div>
            </div>
        `;
    }
};

// Auto-init sidebar UI when module loads (or wait for DOMContentLoaded)
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => window.Enrichment.initSidebarStatus(), 2000); // Small delay to ensure sidebar exists
});
