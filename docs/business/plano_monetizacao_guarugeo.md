# 💎 PLANO MESTRE DE MONETIZAÇÃO - GUARUGEO MAP

Este documento detalha o plano estratégico, técnico e de negócios para
transformar a plataforma em uma máquina de gerar faturamento recorrente e
transacional, utilizando o conceito de **"Fácil de Entrar, Impossível de Sair"**
(Freemium com Paywall Transacional e Assinaturas Premium).

---

## 🟢 O QUE JÁ TEMOS (Fundação Pronta)

1. **Gestão de Créditos e Papéis (Roles):**
   - Tabela `profiles` no Supabase preparada para armazenar saldo de moedas
     (`credits`) de cada usuário.
   - Níveis de acesso: `user`, `admin`, `master`.

2. **Mecânica de Desbloqueio e Ofuscação (Teaser):**
   - A função `maskName` já ofusca o nome e dados sensíveis dos proprietários.
   - Os usuários comuns enxergam apenas as "migalhas", gerando o desejo de
     comprar a ficha completa.
   - Botão de "Adquirir Ficha (Custa 1 Crédito)" já posicionado estrategicamente
     na interface (Tooltip dos lotes).

3. **Restrição de Funcionalidades:**
   - Recursos avançados e filtros agressivos (Buscas por Proprietário e
     Oportunidades/Farol) restringidos no front-end para usuários normais,
     criando o terreno ideal para os planos de assinatura.

4. **API de Altíssimo Valor (API de Enriquecimento/Infosimples):**
   - Mecanismo backend pronto para buscar dados e protestos reais. Como esta
     chamada custa dinheiro ao nosso caixa, é imperativo que ela seja o ponto
     focal da venda transacional.

---

## 🟡 O QUE FALTA IMPLEMENTAR (Fase de Engenharia e Checkout)

1. **Gateway de Pagamento Real (A Máquina de Vendas):**
   - **Objetivo:** Automatizar a compra de créditos sem intervenção humana (sem
     precisar chamar no WhatsApp).
   - **Solução Técnica:** Integração com MercadoPago API ou Stripe via Webhooks
     no Supabase (Edge Functions) para liberar créditos no instante em que o PIX
     for compensado.

2. **Registro de Consumo (Tabela de Desbloqueios):**
   - **Objetivo:** Lembrar de quais imóveis o usuário já comprou. (O usuário não
     pode pagar duas vezes pela mesma ficha).
   - **Solução Técnica:** Criação de uma tabela
     `unlocked_lots (user_id, inscricao_lote, data_desbloqueio)` no Supabase. O
     tooltip verificará se a chave já existe lá antes de ofuscar os dados.

3. **Extrato e "Minha Carteira" (Gerenciador do Usuário):**
   - **Objetivo:** Um painel onde o usuário visualiza seu saldo, compra pacotes
     de créditos e revisita todos os imóveis que ele já comprou, montando sua
     própria carteira de prospecção.
   - **Solução Técnica:** Uma nova aba "Meus Lotes" no modal de Monetização.

4. **Painel de Controle Financeiro (Admin):**
   - **Objetivo:** O Master precisa ver quem está comprando, aprovar créditos
     manuais e auditar o sistema. (Uma boa parte já existe no Painel Master, mas
     precisa de uma grid focada em receita).

---

## 🚀 ESTRATÉGIA E FASES DE EXECUÇÃO (Plano de Voo Negocial)

### FASE 1: Venda Transacional / Micro-Transações ("A Isca")

Nós usamos o que já está pronto para gerar fluxo de caixa amanhã. O Mapa e a
busca simples por rua são abertos e grátis.

- **A Dores dos Corretores Locais:** Encontrar o dono e seu telefone (o famoso
  "Direct to Seller").
- **O Gatilho:** Ao clicar em qualquer lote, ele vê dados incríveis: Zona, Área,
  Restrições, mas com os dados do proprietário ofuscados ("Pedro Ant**** / (13)
  998**-12**").
- **A Compra Impulsiva:** Um botão brilhante chama-o: "Destravar Contato e Ficha
  Completa: 1 Crédito".
- **O Pacote Base:** Ele clica, abre um modal de compra: "Adquira 10 Fichas por
  R$ 69,90". (Compra via PIX dinâmico com QR Code em tela).

### FASE 2: Planos de Assinatura Recorrente ("O Motor do Farol")

Mudar o jogo. Em vez de esconder o botão genial "✨ Oportunidades", nós o
deixamos visível para todo mundo gerar curiosidade.

- **A Abordagem:** O botão de "Busca por Oportunidades (Farol)" e os "Heatmaps
  Profissionais" ficam cinzas, com um cadeado e uma tag "Exclusivo Planos Pro".
- **A Promessa:** Quando o usuário clica ali, ao invés de sumir, abre uma página
  de desembarque dentro do app: _"A Inteligência Artificial que rastreia
  proprietários precisando vender por necessidade. Economize semanas batendo
  porta. Apenas R$ 199,00/mês."_
- **Vantagem Casada:** Assinantes do plano recebem 50 Créditos Tradicionais
  gratuitos todo mês (para destravar certidões/telefones).

### FASE 3: Enriquecimento Jurídico

Cobranças Premium em cima da API de Enriquecimento. Consultar protestos graves será cobrado
por fora ou demandará 5 Créditos, ao invés de 1.

---

## 🛠️ ORDEM DAS PRÓXIMAS DEMANDAS TÉCNICAS (Backlog)

1. Ajustar o Supabase criando a tabela `unlocked_lots` e as policies (RLS)
   seguras da monetização.
2. Construir o painel "Minha Carteira" na interface front-end, listando o que o
   usuário já abriu com as moedas.
3. Projetar e codar a conexão MercadoPago (ou similar) em uma Supabase Edge
   Function de recebimento PIX seguro.
4. Adaptar as "Buscas Proibidas" para aparecerem com um Icone de Cadeado
   (Teaser) na tela de busca principal.

# Estratégia de Mercado e Expansão - Guarugeo

Este documento detalha os novos horizontes comerciais e modelos de negócio para
a venda ou licenciamento enterprise da plataforma.

---

## 1. Modelos de Negócio (Monetização)

### A. API de "Due Diligence Instantânea" (Bancos/Fintechs)

- **Produto:** Uma API onde o banco envia a coordenada ou Inscrição Imobiliária
  e recebe o JSON limpo com Proprietário, CPF e Dívidas.
- **Venda:** Cobrança por consulta (SaaS - Pay per use).

### B. Monitoramento de Portfólio (FIIs/REITs)

- **Produto:** Dashboard para fundos imobiliários acompanharem mudanças em seus
  ativos.
- **Valor:** Alerta em tempo real se um imóvel do fundo entrar em dívida ativa
  ou se houver alteração no Plano Diretor do entorno.

### C. Módulo de Fiscalização (GovTech B2B)

- **Produto:** Plugin para sistemas de gestão municipal (Betha, IPM).
- **Valor:** Detectar evasão fiscal de IPTU comparando a área construída real
  (via mapa) com o cadastro fiscal.

---

## 2. Novos Leads e Contatos (Setores Adjacentes)

### Setor Financeiro (Crédito Imobiliário)

- **Itaú BBA:** Ronaldo D'Lazzari (Head of Real Estate) -
  ronaldo.lazzari@itaubba.com
- **Santander Brasil:** Eduardo Gularte (Head of Real Estate) -
  eduardo.gularte@santander.com.br
- **Bradesco:** (Pesquisar Head de Crédito Imobiliário)

### Setor de Seguros e Garantias

- **PortoBank (Porto Seguro):** Adriano Arruda (Diretor de Riscos) -
  adriano.arruda@portoseguro.com.br
- **Tokio Marine:** (Foco em Seguro Garantia Imobiliária)

### Setor de Dados e Compliance

- **Serasa Experian:** Anna Carolina Amaral (Diretora Jurídica/Compliance) -
  anna.amaral@serasa.com.br
- **LexisNexis Brasil:** Gustavo Rodrigues (Diretor Comercial) -
  gustavo.rodrigues@lexisnexisrisk.com

---

## 3. Roadshow de Venda (Divulgação)

1. **Demonstração Personalizada (Loom):** Gravar a tela extraindo dados de um
   imóvel específico que o lead já possui/conhece.
2. **LinkedIn Executive Outreach:** Abordagem direta focada na "Dor da
   Burocracia Municipal".
3. **Participação em Eventos de Proptech:** (Ex: Real Estate Tech Day, GRI
   Club).
4. **M&A Advisory:** Consultar boutiques de M&A focadas em tecnologia se o
   objetivo for a venda total (Exit).
