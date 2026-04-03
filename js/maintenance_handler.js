// ==========================================
// MAINTENANCE HANDLER - MAINTENANCE_HANDLER.JS
// ==========================================
// Centralizes support reporting and discrepancy feedback

window.Maintenance = {
    /**
     * Shows a modal to report an error or discrepancy
     * @param {string} type - 'lote', 'unit', 'map', 'ranking'
     * @param {object} data - Data related to the subject (e.g., lote details)
     */
    showReportModal: function(type, data) {
        const modal = document.createElement('div');
        modal.className = 'custom-modal-overlay active';
        modal.style.zIndex = '10050';
        
        const subject = data?.inscricao || data?.building_name || (type === 'map' ? 'Mapa' : 'Sistema');

        modal.innerHTML = `
            <div class="custom-modal" style="max-width: 450px; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);">
                <div style="background: linear-gradient(135deg, #6d28d9, #4c1d95); color: white; padding: 20px; position: relative;">
                    <div style="font-size: 18px; font-weight: 800;">🚩 Reportar Divergência</div>
                    <div style="font-size: 12px; opacity: 0.8; margin-top: 4px;">Assunto: ${subject}</div>
                    <button onclick="this.closest('.custom-modal-overlay').remove()" style="position: absolute; right: 15px; top: 15px; background: none; border: none; color: white; font-size: 20px; cursor: pointer;">&times;</button>
                </div>
                
                <div style="padding: 24px;">
                    <p style="font-size: 13px; color: #64748b; margin-bottom: 20px;">
                        Encontrou algo errado? Informe abaixo para que nossa equipe de curadoria possa corrigir. 
                        <strong>Sua ajuda mantém o GuaruGeo preciso!</strong>
                    </p>

                    <div style="margin-bottom: 16px;">
                        <label style="display: block; font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; margin-bottom : 6px;">Tipo de Problema</label>
                        <select id="report-type" style="width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; background: #f8fafc;">
                            <option value="data_error">Dados Incorretos (Erro na ficha)</option>
                            <option value="owner_change">Troca de Proprietário</option>
                            <option value="location_error">Localização Errada no Mapa</option>
                            <option value="visual_bug">Erro Visual / Bug no Sistema</option>
                            <option value="other">Outro Assunto</option>
                        </select>
                    </div>

                    <div style="margin-bottom: 20px;">
                        <label style="display: block; font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; margin-bottom: 6px;">O que está errado?</label>
                        <textarea id="report-desc" placeholder="Descreva os detalhes aqui... Ex: 'O dono mudou há 2 meses' ou 'O prédio tem 10 andares, não 8'." 
                            style="width: 100%; height: 100px; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; resize: none; font-family: inherit;"></textarea>
                    </div>

                    <button onclick="window.Maintenance.submitReport('${type}', '${subject}')" 
                        style="width: 100%; padding: 14px; background: #6d28d9; color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 800; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(109, 40, 217, 0.3);"
                        onmouseover="this.style.background='#5b21b6'; this.style.transform='translateY(-1px)'" 
                        onmouseout="this.style.background='#6d28d9'; this.style.transform='none'">
                        <i class="fas fa-paper-plane" style="margin-right: 8px;"></i> Enviar para Curadoria
                    </button>
                    
                    <div style="text-align: center; margin-top: 15px;">
                        <span style="font-size: 11px; color: #94a3b8;">Sua identidade e contexto do mapa serão anexados ao reporte.</span>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    submitReport: async function(type, subject) {
        const reportType = document.getElementById('report-type').value;
        const description = document.getElementById('report-desc').value.trim();

        if (description.length < 5) {
            window.Toast.warning("Por favor, descreva melhor o problema.");
            return;
        }

        window.Loading.show('Enviando...', 'Registrando seu reporte');
        
        try {
            const { data: { user } } = await window.supabaseApp.auth.getUser();
            
            const payload = {
                user_id: user?.id,
                user_email: user?.email,
                action: 'USER_REPORT',
                details: {
                    type,
                    subject,
                    category: reportType,
                    description: description,
                    url: window.location.href,
                    timestamp: new Date().toISOString()
                },
                severity: 'info'
            };

            const { error } = await window.supabaseApp.from('audit_logs').insert(payload);
            
            if (error) throw error;

            window.Toast.success("Obrigado pelo feedback! Analisaremos o quanto antes.");
            document.querySelector('.custom-modal-overlay.active').remove();
            
        } catch (e) {
            console.error("Erro ao reportar:", e);
            window.Toast.error("Erro ao enviar reporte: " + e.message);
        } finally {
            window.Loading.hide();
        }
    }
};
