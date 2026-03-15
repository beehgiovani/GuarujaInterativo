// ==========================================
// MARKETING AUTOMATION HANDLER
// ==========================================
// Generates social media content and sales scripts using Gemini AI

window.MarketingHandler = {

    // Main entry point called from buttons
    generate: async function (inscricao, platform) {
        console.log(`🤖 Marketing Robot: Generatin content for ${platform} (Unit: ${inscricao})`);

        // 1. Get Data
        const unit = await this.getUnitData(inscricao);
        if (!unit) {
            window.Toast.error("Dados da unidade não encontrados.");
            return;
        }

        // 2. Prepare Prompt based on Platform
        const prompt = this.buildPrompt(unit, platform);

        // 3. Show Loading Modal with specific context
        this.showModal(platform, "Gerando conteúdo com IA...");
        this.startProgressBar(); // Start Animation

        // 4. Call Gemini
        try {
            if (!window.Farol || !window.Farol.ask) {
                throw new Error("Assistente Farol IA não está inicializado.");
            }

            const response = await window.Farol.ask(prompt);

            // 5. Save to History
            if (window.AIHistoryHandler) {
                window.AIHistoryHandler.save(inscricao, `MARKETING: ${platform}`, response);
            }

            // 6. Auto-Save to Documents (PDF/Text)
            if (window.saveAIReportToStorage) {
                // Map platform to folder name
                let folderName = 'Relatórios IA';
                if (platform === 'Instagram') folderName = 'Posts Instagram';
                else if (platform === 'WhatsApp') folderName = 'Mensagens WhatsApp';
                else if (platform === 'Script Captação') folderName = 'Roteiros de Venda';
                else if (platform === 'Exclusividade') folderName = 'Argumentos e Objeções';

                window.saveAIReportToStorage(inscricao, `Marketing-${platform}`, response, 'text', folderName);
            }

            // 7. Display Result
            this.finishProgressBar(); // Complete Animation
            this.updateModalContent(platform, response);

        } catch (e) {
            console.error(e);
            this.updateModalContent(platform, "❌ Erro ao conectar com o Farol IA. Tente novamente.");
            this.hideProgressBar();
        }
    },

    getUnitData: async function (inscricao) {
        // 1. Try Context (Tooltip Navigation)
        if (window.currentLoteForUnit && window.currentLoteForUnit.unidades) {
            const unit = window.currentLoteForUnit.unidades.find(u => u.inscricao === inscricao);
            if (unit) {
                unit.parentLote = window.currentLoteForUnit;
                return unit;
            }
        }

        // 2. Try Explorer Context
        if (window.currentExplorerUnit === inscricao && window.currentLoteForUnit) {
            const unit = window.currentLoteForUnit.unidades.find(u => u.inscricao === inscricao);
            if (unit) {
                unit.parentLote = window.currentLoteForUnit;
                return unit;
            }
        }

        // 3. Try Global Cache (All Lotes)
        if (window.allLotes) {
            for (const lote of window.allLotes) {
                if (lote.unidades) {
                    const unit = lote.unidades.find(u => u.inscricao === inscricao);
                    if (unit) {
                        unit.parentLote = lote;
                        return unit;
                    }
                }
            }
        }

        return null;
    },

    buildPrompt: function (unit, platform) {
        const u = unit;
        const l = unit.parentLote || {};

        const features = [
            u.quartos ? `${u.quartos} quartos` : '',
            u.suites ? `${u.suites} suítes` : '',
            u.vagas ? `${u.vagas} vagas` : '',
            u.area_util ? `${u.area_util}m² úteis` : '',
            l.bairro ? `Bairro ${l.bairro}` : '',
            l.building_name ? `Edifício ${l.building_name}` : ''
        ].filter(Boolean).join(', ');

        // GPS Conversion
        let gpsInfo = '';
        if (window.utmToLatLon && l.minx && l.miny) {
            const cx = (l.minx + l.maxx) / 2;
            const cy = (l.miny + l.maxy) / 2;
            const latLon = window.utmToLatLon(cx, cy);
            if (latLon) {
                gpsInfo = `LATITUDE: ${latLon.lat}, LONGITUDE: ${latLon.lon}`;
            }
        }

        const baseContext = `
            Você é um especialista em Marketing Imobiliário de Alto Padrão.
            Dados do Imóvel:
            - Tipo: ${u.tipo || 'Imóvel'}
            - Edifício: ${l.building_name || 'Nome não informado'}
            - Bairro: ${l.bairro || 'Guarujá'}
            - Principais Características: ${features}
            - Valor: Consulte valor (ou use "Sob consulta")
            - Diferenciais do Condomínio: ${l.amenities || 'Estrutura completa'}
            - Localização EXATA (GPS): ${gpsInfo}
            
            INSTRUÇÃO DE IMAGEM OBRIGATÓRIA:
            1. Pesquise no Google imagens REAIS da fachada deste edifício ou da rua.
            2. Se encontrar, NÃO use markdown de imagem (pois isso vai para o WhatsApp/Instagram).
            3. Em vez disso, coloque os LINKS DIRETOS no final do texto, desta forma:
               "📸 Fotos de Referência: [Link]"
            4. Se não achar do prédio exato, pegue uma foto bonita da praia/bairro próximo para ilustrar.
        `;

        if (platform === 'Instagram') {
            return `${baseContext}
            TAREFA: Crie uma legenda de Instagram atraente, usando emojis, hashtags relevantes (#guaruja #imoveis) e focada em DESEJO e EXCLUSIVIDADE. 
            Formatação: Use quebras de linha para facilitar a leitura.
            Inclua uma chamada para ação (CTA) para enviar Direct.`;
        }

        if (platform === 'WhatsApp') {
            return `${baseContext}
            TAREFA: Crie um script de mensagem para WhatsApp para enviar a um cliente interessado.
            Tom: Profissional, breve e convidativo.
            Estrutura: Saudação, Destaque do imóvel ("Lembrei de você..."), Link para fotos (placeholder), Pergunta de fechamento ("Podemos agendar visita?").`;
        }

        if (platform === 'Script Captação') {
            return `${baseContext}
            TAREFA: Crie um roteiro de ligação telefônica (Telemarketing Ativo) para ligar para o proprietário deste imóvel e oferecer nossos serviços de corretagem.
            Foco: Convencer a dar exclusividade ou autorizar a venda.
            Pontos chave: Temos clientes na base procurando exatamente esse perfil.
            `;
        }

        if (platform === 'Exclusividade') {
            return `${baseContext}
             TAREFA: Liste 5 argumentos infalíveis para convencer o proprietário deste imóvel específico a assinar um contrato de exclusividade conosco.
             Foco: Segurança, investimento em mídia paga, fotógrafo profissional.
            `;
        }

        return `${baseContext} Fale sobre este imóvel.`;
    },

    showModal: function (platform, initialText) {
        const modalId = 'marketing-modal';
        let modal = document.getElementById(modalId);

        if (!modal) {
            modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'custom-modal-overlay active';
            modal.style.zIndex = '10100'; // Above everything
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div class="custom-modal" style="max-width: 600px; width: 90%;">
                <div class="custom-modal-header" style="background: linear-gradient(135deg, #ec4899, #be185d); color: white;">
                    <div class="custom-modal-title">🤖 Robô de Marketing: ${platform}</div>
                    <button class="custom-modal-close" onclick="document.getElementById('${modalId}').remove()">&times;</button>
                </div>
                <!-- Loading Bar Container -->
                <div id="ai-progress-container" style="width: 100%; height: 4px; background: #f1f5f9; display:none;">
                    <div id="ai-progress-bar" style="width: 0%; height: 100%; background: #be185d; transition: width 0.3s ease-out;"></div>
                </div>

                <div class="custom-modal-body" style="background: #fff;">
                    <textarea id="marketing-output" style="width: 100%; height: 300px; padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px; font-family: monospace; font-size: 13px; resize: vertical;">${initialText}</textarea>
                    
                    <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 15px;">
                        <button class="btn secondary" onclick="document.getElementById('${modalId}').remove()">Fechar</button>
                        <button class="btn primary" onclick="window.MarketingHandler.copyText()">📋 Copiar Texto</button>
                    </div>
                </div>
            </div>
        `;
    },

    updateModalContent: function (platform, text) {
        const output = document.getElementById('marketing-output');
        if (output) {
            output.value = text;
        }
    },

    startProgressBar: function () {
        const container = document.getElementById('ai-progress-container');
        const bar = document.getElementById('ai-progress-bar');
        if (container && bar) {
            container.style.display = 'block';
            bar.style.width = '10%';

            // Simulate progress
            window.marketingProgressInterval = setInterval(() => {
                const currentWidth = parseFloat(bar.style.width);
                if (currentWidth < 90) {
                    bar.style.width = (currentWidth + (Math.random() * 10)) + '%';
                }
            }, 500);
        }
    },

    finishProgressBar: function () {
        clearInterval(window.marketingProgressInterval);
        const bar = document.getElementById('ai-progress-bar');
        if (bar) {
            bar.style.width = '100%';
            setTimeout(() => {
                const container = document.getElementById('ai-progress-container');
                if (container) container.style.display = 'none';
            }, 500);
        }
    },

    hideProgressBar: function () {
        clearInterval(window.marketingProgressInterval);
        const container = document.getElementById('ai-progress-container');
        if (container) container.style.display = 'none';
    },

    copyText: function () {
        const output = document.getElementById('marketing-output');
        if (output) {
            output.select();
            document.execCommand('copy');
            window.Toast.success("Texto copiado para a área de transferência!");
        }
    }
};

// Global Expose
window.generateMarketing = function (inscricao, platform) {
    window.MarketingHandler.generate(inscricao, platform);
};
