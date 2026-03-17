// ==========================================
// REPORT HANDLER - Gerador de Dossiês PDF
// ==========================================

window.ReportHandler = {
    generatePDF: async function(lote, unit) {
        window.Loading.show('Gerando Dossiê...', 'Compilando inteligência imobiliária');

        // Check permission (Master Plan or Credits)
        const isMaster = window.Monetization && window.Monetization.userRole === 'master';
        if (!isMaster) {
            const hasCredits = await window.Monetization.checkCredits(5); // Dossiê custa 5 créditos
            if (!hasCredits) {
                window.Loading.hide();
                return;
            }
            await window.supabaseApp.rpc('spend_credits', { amount_to_spend: 5, detail: `Dossiê Unit ${unit.inscricao}` });
        }

        const reportWindow = window.open('', '_blank');
        const html = this.buildReportHTML(lote, unit);
        if (reportWindow) {
            reportWindow.document.write(html);
            reportWindow.document.close();
            window.logActivity('generate_pdf', `Dossiê Unit ${unit.inscricao}`);
            window.Toast.success('Dossiê gerado com sucesso!');
        }
        
        window.Loading.hide();
    },

    buildReportHTML: function(lote, unit) {
        const date = new Date().toLocaleDateString('pt-BR');
        const buildingName = lote.building_name || 'Terreno/Imóvel Individual';
        const address = `${lote.logradouro || ''}, ${lote.numero || ''} - ${lote.bairro || 'Guarujá'}`;
        
        return `
            <!DOCTYPE html>
            <html lang="pt-br">
            <head>
                <meta charset="UTF-8">
                <title>Dossiê Inteligente - ${unit.inscricao}</title>
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=JetBrains+Mono:wght@700&display=swap" rel="stylesheet">
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
                <style>
                    :root { --primary: #0f172a; --accent: #2563eb; --text: #1e293b; }
                    body { font-family: 'Inter', sans-serif; color: var(--text); line-height: 1.5; margin: 0; padding: 0; background: #f1f5f9; }
                    .page { background: white; width: 21cm; min-height: 29.7cm; padding: 2cm; margin: 1cm auto; box-shadow: 0 0 20px rgba(0,0,0,0.1); position: relative; box-sizing: border-box; }
                    
                    header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid var(--primary); padding-bottom: 20px; margin-bottom: 30px; }
                    .logo-area { display: flex; align-items: center; gap: 15px; }
                    .logo-text { font-weight: 800; font-size: 24px; color: var(--primary); letter-spacing: -1px; }
                    .report-tag { background: var(--accent); color: white; padding: 4px 12px; border-radius: 4px; font-size: 10px; font-weight: 800; text-transform: uppercase; }

                    .hero-section { background: #f8fafc; border-radius: 12px; padding: 30px; margin-bottom: 40px; border: 1px solid #e2e8f0; }
                    .inscricao { font-family: 'JetBrains Mono', monospace; font-size: 18px; color: var(--accent); margin-bottom: 10px; }
                    .title { font-size: 32px; font-weight: 800; margin: 0; color: var(--primary); line-height: 1.1; }
                    .subtitle { font-size: 16px; color: #64748b; margin-top: 5px; }

                    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 40px; }
                    .info-box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; }
                    .info-title { font-size: 12px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 15px; border-bottom: 1px solid #f1f5f9; padding-bottom: 5px; }
                    .info-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px; }
                    .info-label { color: #94a3b8; font-weight: 600; }
                    .info-value { color: var(--primary); font-weight: 700; }

                    .ai-insight { background: #eff6ff; border-left: 5px solid var(--accent); padding: 25px; border-radius: 0 12px 12px 0; margin-bottom: 40px; }
                    .ai-title { font-weight: 800; color: var(--accent); margin-bottom: 10px; display: flex; align-items: center; gap: 10px; }
                    
                    .images { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 20px; }
                    .img-wrap { width: 100%; aspect-ratio: 16/9; background: #eee; border-radius: 8px; overflow: hidden; }
                    .img-wrap img { width: 100%; height: 100%; object-fit: cover; }

                    footer { position: absolute; bottom: 2cm; left: 2cm; right: 2cm; border-top: 1px solid #e2e8f0; padding-top: 15px; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }
                    
                    @media print {
                        body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        .page { margin: 0; box-shadow: none; border: none; padding: 1.5cm; }
                        .no-print { display: none; }
                        .info-box { border: 1px solid #eee !important; }
                    }
                </style>
            </head>
            <body>
                <div class="no-print" style="position: fixed; top: 20px; right: 20px; z-index: 1000;">
                    <button onclick="window.print()" style="padding: 12px 25px; background: var(--accent); color: white; border: none; border-radius: 8px; font-weight: 800; cursor: pointer; box-shadow: 0 4px 12px rgba(37,99,235,0.3);">
                        <i class="fas fa-print"></i> IMPRIMIR DOSSIÊ
                    </button>
                </div>

                <div class="page">
                    <header>
                        <div class="logo-area">
                            <div style="width: 40px; height: 40px; background: var(--primary); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white;">
                                <i class="fas fa-map-marked-alt"></i>
                            </div>
                            <div>
                                <div class="logo-text">Guarujá GeoMap</div>
                                <div style="font-size: 10px; letter-spacing: 2px; color: #64748b;">INTELIGÊNCIA IMOBILIÁRIA</div>
                            </div>
                        </div>
                        <div class="report-tag">Relatório de Ativos v2.0</div>
                    </header>

                    <section class="hero-section">
                        <div class="inscricao">${unit.inscricao}</div>
                        <h1 class="title">${buildingName}</h1>
                        <div class="subtitle">${address}</div>
                    </section>

                     <div class="grid">
                        <div class="info-box">
                            <div class="info-title">Dados da Unidade</div>
                            <div class="info-row"><span class="info-label">Tipo:</span><span class="info-value">${unit.tipo || 'Residencial'}</span></div>
                            <div class="info-row"><span class="info-label">Área Privativa:</span><span class="info-value">${unit.metragem || '-'} m²</span></div>
                            <div class="info-row"><span class="info-label">Quartos/Suítes:</span><span class="info-value">${unit.quartos || 0} / ${unit.suites || 0}</span></div>
                            <div class="info-row"><span class="info-label">Vagas:</span><span class="info-value">${unit.vagas || 0}</span></div>
                        </div>
                        <div class="info-box">
                            <div class="info-title">Farol Preditivo 💎</div>
                            <div style="display: flex; align-items: center; gap: 20px;">
                                <div style="position: relative; width: 80px; height: 80px;">
                                    <svg viewBox="0 0 36 36" style="transform: rotate(-90deg); width: 80px; height: 80px;">
                                        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#eee" stroke-width="3" />
                                        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="${(lote.predictive_score || 0) > 70 ? '#10b981' : '#f59e0b'}" stroke-width="3" stroke-dasharray="${lote.predictive_score || 0}, 100" />
                                    </svg>
                                    <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-weight: 800; font-size: 18px; color: var(--primary);">
                                        ${lote.predictive_score || 0}%
                                    </div>
                                </div>
                                <div style="flex: 1; font-size: 11px; color: #64748b;">
                                    <strong>Probabilidade de Negócio:</strong> Este imóvel possui características que o colocam no topo dos leads qualificados da região.
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="ai-insight">
                        <div class="ai-title"><i class="fas fa-robot"></i> Parecer Farol IA Platinum</div>
                        <div style="font-size: 14px; color: #334155; font-style: italic;">
                            "${lote.predictive_analysis || `Análise preliminar indica alto potencial de liquidez devido à metragem e localização em ${lote.bairro || 'zona valorizada'}. O valor de mercado estimado está alinhado com a média da região.`}"
                        </div>
                    </div>

                    <div class="grid">
                        <div class="info-box">
                            <div class="info-title">Informações Fiscais</div>
                            <div class="info-row"><span class="info-label">Matrícula:</span><span class="info-value">${unit.matricula || 'N/A'}</span></div>
                            <div class="info-row"><span class="info-label">RIP:</span><span class="info-value">${unit.rip || 'N/A'}</span></div>
                            <div class="info-row"><span class="info-label">Valor Venal:</span><span class="info-value">R$ ${(unit.valor_venal || 0).toLocaleString('pt-BR')}</span></div>
                            <div class="info-row"><span class="info-label">IPTU Estimado:</span><span class="info-value">Consultar Prefeitura</span></div>
                        </div>
                        <div class="info-box">
                            <div class="info-title">Ecossistema de Influência</div>
                            <div style="font-size: 12px; color: #1e293b; line-height: 1.4;">
                                <i class="fas fa-project-diagram" style="color: #6366f1; margin-right: 5px;"></i> 
                                Proprietário possui <strong>${lote.conexoes_count || 'conexões diretas'}</strong> mapeadas na Teia de Influência.
                                <p style="margin-top: 5px; font-size: 10px; color: #94a3b8;">* Detalhes societários completos disponíveis na plataforma online.</p>
                            </div>
                        </div>
                    </div>

                    <div class="info-title">Visualização do Ativo</div>
                    <div class="images">
                        <div class="img-wrap"><img src="${unit.image_url || 'https://images.unsplash.com/photo-1582407947304-fd86f028f716?auto=format&fit=crop&q=80&w=800'}" alt="Foto 1"></div>
                        <div class="img-wrap"><img src="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&q=80&w=800" alt="Foto 2"></div>
                    </div>

                    <footer>
                        <div>Guarujá GeoMap PLATINUM - Documento gerado em ${date}</div>
                        <div>ID: ${unit.inscricao} | Página 01 / 01</div>
                    </footer>
                </div>
            </body>
            </html>
        `;
    }
};
