# 📘 Manual do Usuário - Guarujá GeoMap

## Bem-vindo ao Guarujá GeoMap!

Este guia vai ajudá-lo a utilizar todas as funcionalidades do sistema de forma
rápida e eficiente.

---

## 1. Introdução

O **Guarujá GeoMap** é um sistema web interativo de geoprocessamento
desenvolvido especialmente para imobiliárias e construtoras. Com ele, você tem
acesso imediato a:

- 🗺️ Mapa completo de todos os lotes e unidades do Guarujá
- 🔍 Busca rápida por endereço, proprietário, inscrição ou edifício
- 👥 Gestão de clientes (CRM) integrada
- 📸 Galeria de imagens dos imóveis
- 📊 Informações cadastrais detalhadas e indicadores de mercado

---

## 2. Primeiros Passos

### Acessando o Sistema

1. Abra seu navegador (Chrome, Firefox, Edge ou Safari)
2. Digite o endereço fornecido pela sua imobiliária
3. **Login default**: Usuário `admin` / Senha `admin123`

---

## 3. Navegação e Visualização no Mapa

### 📍 Navegação Hierárquica (Mergulho no Mapa)

O mapa funciona com um sistema de zoom progressivo em 3 níveis:

- **Nível 1 (Zonas):** Visão geral da cidade separada por zonas fiscais.
- **Nível 2 (Setores):** Ao clicar em uma zona, você vê os setores cadastrais.
- **Nível 3 (Lotes):** Ao clicar em um setor, você vê os lotes e edifícios
  individuais.

> 💡 **Dica**: Use o botão **"⬅ Voltar"** no canto superior esquerdo para subir
> de nível e explorar os arredores.

### 🎨 Modos de Visualização (Zonas vs Bairros)

No canto superior direito, você pode alternar entre:

- **Modo Zonas:** Colore o mapa conforme as zonas fiscais (Padrão).
- **Modo Bairros:** Colore o mapa por nomes comerciais (ex: Astúrias,
  Pitangueiras). Etiquetas flutuantes ajudam na identificação rápida de regiões.

---

## 🔍 4. Sistema de Busca Inteligente

A busca é multicasco e aceita diversos formatos:

- **🔢 Inscrição:** Digite 8 dígitos para o lote ou 11 para a unidade.
- **🏠 Endereço:** Digite o nome da rua ou bairro.
- **🏢 Edifício:** Digite o nome do condomínio.
- **👤 Proprietário:** Digite o nome completo ou apenas o **CPF/CNPJ**.

> ⚡ **Dica de Busca**: O sistema trata acentos automaticamente e aceita nomes
> parciais. Se buscar por "Abel Joaquim", ele encontrará mesmo que o nome
> completo seja mais longo.

---

## 👤 5. Perfil 360° do Proprietário

Ao clicar em um proprietário (seja nos resultados da busca ou pelo botão "Ver
Perfil" na unidade), você abre uma visão completa:

- **Portfólio Imobiliário:** Veja todos os imóveis registrados para aquele
  CPF/CNPJ no Guarujá.
- **Navegação Direta:** Clique em qualquer imóvel da lista e o mapa fará o "voo"
  (zoom progressivo) direto para o local.
- **Consulta de Dados (API de Enriquecimento):** Clique em **"Consultar Dados"** para buscar
  telefones e e-mails originais da RFB/API de Enriquecimento.
- **Relacionamentos (Empresas e Família):** Na aba **"Outras Info"**, veja os
  sócios de uma empresa ou os membros da família de um proprietário.
- **Sync Automático:** Assim que você consulta um dono, os novos contatos
  aparecem em todas as suas unidades automaticamente.
- **Sininho Dourado:** Atente-se ao ícone de sino na barra lateral; ele mudará
  para **Dourado** quando o monitoramento encontrar novidades para esse dono.

---

## 📊 6. Analytics e Exportação

### Painel de Indicadores

Clique no ícone de gráfico (**📊**) no menu superior para ver:

- **Top Imóveis:** Quais lotes estão sendo mais visualizados pela equipe.
- **Donos em Foco:** Quais proprietários estão sendo mais pesquisados.
- **Zonas de Calor:** Regiões com maior atividade de busca.

### Exportação de Dados

No painel de busca, você encontrará o botão **"Exportar CSV/Excel"**. Ele
permite baixar:

- Lista de resultados da busca atual.
- Dados de proprietários e contatos para planilhas externas.

---

## 👥 7. Sistema CRM

O CRM permite gerenciar seus leads e fazer o "matching" com imóveis:

1. Clique no botão **👥**.
2. Cadastre o Lead (Nome, WhatsApp, Orçamento).
3. Use o botão **"🔍 Buscar Compatíveis"** para o sistema sugerir unidades que
   atendem ao perfil do cliente.

---

## ⚖️ 8. Automação Jurídica (Certidões Negativas)

Agora você pode emitir certidões automaticamente sem sair do sistema!

### Como usar:

1. **Acesse a aba Jurídico:**
   - Clique no ícone de balança (⚖️) no topo direito ou selecione um
     proprietário.
2. **Selecione os Órgãos:**
   - Marque as caixas dos órgãos desejados (TJSP, TRF, TRT, Receita Federal,
     CNDT, etc).
3. **Clique em "Solicitar Certidões":**
   - O sistema mostrará o progresso em tempo real.

### Tipos de Resultado:

- **✅ Sucesso:** A certidão foi emitida em PDF. Clique em **"Abrir PDF"**
  (botão Azul).
- **✅ Nada Consta:** O sistema verificou e não há processos, mas o órgão não
  gera PDF. (Aparece um "Check" verde).
- **🌐 Comprovante Web:** O órgão retornou um HTML/Recibo web. Clique em **"Ver
  Comprovante Web"** (botão Amarelo).
- **⏳ Aguardando:** O pedido foi aceito, mas o tribunal demora algumas horas.
  **Fique tranquilo!** O sino da barra lateral avisará quando ficar pronto.

### 🔔 9. Sistema de Notificações

O sistema monitora seu e-mail e as certidões solicitadas em tempo real:

- **Ícone Dourado:** Indica que você tem mensagens não lidas.
- **Badge Vermelha:** Mostra a quantidade de documentos prontos para
  visualização.
- **Balões (Toasts):** Quando uma certidão chega, um aviso aparece no canto da
  tela. Basta clicar nele para abrir o documento.
- **Abertura Direta:** As notificações abrem as certidões diretamente no
  visualizador premium, prontas para impressão.

---

## 10. Problemas Comuns

- **Tela Escurecida:** Se o mapa travar escuro após uma consulta, basta dar zoom
  ou fechar a ficha do proprietário. (Corrigido na V2.0).
- **Busca Lenta:** O sistema usa cache. Se sentir lentidão, use o F5 para
  atualizar os dados.

---

## 🚀 11. Monitoramento de Leads (Anúncios Externos)

O sistema agora possui um poderoso "Leads Hunter" que varre a internet (OLX,
Zap, VivaReal, Google) em busca de anúncios ativos para os lotes do mapa.

### Como Funciona:

1. **Detecção Automática:** O sistema monitora 24/7 portais imobiliários.
2. **Matching Inteligente:** Ao encontrar um anúncio, ele cruza o
   endereço/número com o mapa e calcula um "Match Score".
   - 🟢 **100% (Perfeito):** O sistema tem certeza que é aquele lote.
   - 🟡 **80-99% (Alto):** Muito provável, mas requer conferência visual.

### Painel de Oportunidades:

Ao clicar em um lote, se houver anúncios ativos, você verá um botão **"Leads"**
no topo da janelinha (tooltip), com um número vermelho indicando a quantidade de
ofertas.

- **Clique em "Leads":** Abre um painel flutuante com a lista completa de
  anúncios.
- **Comparativo:** Veja preço, m², fotos e link original do anúncio.
- **Histórico:** Saiba quando o anúncio foi capturado.

### 🔔 Alertas em Tempo Real:

Sempre que um novo anúncio "Quente" (100% Match) cair no sistema, você receberá
um **alerta instantâneo** na tela, mesmo que esteja navegando em outra área do
mapa.

---

## 🎉 Conclusão

O Guarujá GeoMap é sua ferramenta definitiva para prospecção imobiliária.

**Bom trabalho e boas vendas!** 🚀
