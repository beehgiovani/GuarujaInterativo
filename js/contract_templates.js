/**
 * CONTRACT TEMPLATES
 * Standard legal drafts to be filled by AI.
 */

const ContractTemplates = {

    render(type, data) {
        if (type === 'compra_venda') return this.compraVenda(data);
        if (type === 'autorizacao') return this.autorizacaoVenda(data);
        return "<h1>Erro: Tipo de contrato desconhecido.</h1>";
    },

    compraVenda(data) {
        const date = new Date().toLocaleDateString('pt-BR');

        return `
        <html>
        <head>
            <style>
                body { font-family: 'Times New Roman', serif; padding: 40px; max-width: 800px; margin: 0 auto; line-height: 1.6; }
                h1 { text-align: center; text-decoration: underline; font-size: 18px; margin-bottom: 40px; }
                h2 { font-size: 14px; margin-top: 20px; text-transform: uppercase; }
                .clause { margin-bottom: 15px; text-align: justify; }
                .signature-box { margin-top: 60px; display: flex; justify-content: space-between; gap: 40px; }
                .sig-line { border-top: 1px solid black; width: 45%; text-align: center; padding-top: 5px; font-size: 12px; }
            </style>
        </head>
        <body>
            <h1>INSTRUMENTO PARTICULAR DE COMPROMISSO DE COMPRA E VENDA</h1>

            <h2>1. DAS PARTES</h2>
            <div class="clause">
                <strong>VENDEDOR(ES):</strong> ${data.owner_name || '______________________'}, 
                CPF/CNPJ: ${data.owner_doc || '______________________'}, 
                residente e domiciliado em: ${data.owner_address || '______________________'}.
            </div>
            <div class="clause">
                <strong>COMPRADOR(ES):</strong> ${data.client_name || '______________________'}, 
                CPF/CNPJ: ${data.client_doc || '______________________'}, 
                residente e domiciliado em: ${data.client_address || '______________________'}.
            </div>

            <h2>2. DO OBJETO</h2>
            <div class="clause">
                O objeto deste contrato é o imóvel situado à <strong>${data.property_address}, ${data.property_neighborhood} - Guarujá/SP</strong>, 
                Edifício: ${data.building_name || 'Não informado'}, Unidade: ${data.unit_id}, 
                Matrícula nº ${data.matricula || '_______'}, registrado no Cartório de Registro de Imóveis de Guarujá.
            </div>

            <h2>3. DO PREÇO E CONDIÇÕES</h2>
            <div class="clause">
                O preço certo e ajustado é de <strong>R$ ${data.price ? parseFloat(data.price).toLocaleString('pt-BR') : '________________'}</strong>, 
                a ser pago da seguinte forma:
                <br>
                ( ) À vista
                <br>
                ( ) Financiamento Bancário
            </div>

            <h2>4. DA POSSE E ESCRITURA</h2>
            <div class="clause">
                A posse do imóvel será transmitida na data da assinatura da Escritura Definitiva, livre de pessoas e objetos.
            </div>

            <div style="margin-top: 60px; text-align: right;">
                Guarujá, ${date}.
            </div>

            <div class="signature-box">
                <div class="sig-line">
                    ${data.owner_name || 'VENDEDOR'}<br>
                    Vendedor
                </div>
                <div class="sig-line">
                    ${data.client_name || 'COMPRADOR'}<br>
                    Comprador
                </div>
            </div>
        </body>
        </html>
        `;
    },

    autorizacaoVenda(data) {
        const date = new Date().toLocaleDateString('pt-BR');

        return `
        <html>
        <head>
            <style>
                body { font-family: 'Arial', sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; line-height: 1.5; color: #333; }
                h1 { text-align: center; font-size: 20px; font-weight: bold; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 10px; }
                .field { margin-bottom: 20px; }
                .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #666; }
            </style>
        </head>
        <body>
            <h1>AUTORIZAÇÃO DE VENDA COM EXCLUSIVIDADE</h1>
            
            <p>Eu, <strong>${data.owner_name}</strong>, inscrito no CPF/CNPJ sob nº <strong>${data.owner_doc}</strong>, 
            proprietário do imóvel situado à <strong>${data.property_address}, Unidade ${data.unit_id}</strong>, 
            AUTORIZO a <strong>Omega Imóveis</strong> a promover a venda do referido bem.</p>

            <p><strong>Valor de Venda:</strong> R$ ${data.price ? parseFloat(data.price).toLocaleString('pt-BR') : '___________'}</p>
            <p><strong>Comissão:</strong> 6% (seis por cento) sobre o valor total da venda.</p>
            <p><strong>Validade:</strong> 180 dias a partir desta data.</p>

            <p>Comprometo-me a não tratar da venda diretamente ou por intermédio de outrem durante o prazo de vigência desta autorização.</p>

            <p style="margin-top: 40px;">Guarujá, ${date}</p>

            <div style="margin-top: 60px; border-top: 1px solid #333; width: 300px; padding-top: 10px;">
                Assinatura do Proprietário
            </div>
            
            <div class="footer">Gerado automaticamente por Guarujá GeoMap Intelligence</div>
        </body>
        </html>
        `;
    }
};
