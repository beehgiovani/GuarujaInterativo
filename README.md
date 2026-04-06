# 🗺️ Guarujá GeoMap

**Sistema web interativo de geoprocessamento e gestão imobiliária para o município de Guarujá/SP**

Sistema completo que combina visualização interativa de mapa, busca avançada, CRM integrado e enriquecimento de dados cadastrais de todos os lotes e unidades do Guarujá.

---

## 📋 Visão Geral

O **Guarujá GeoMap** é uma plataforma web premium desenvolvida para imobiliárias e construtoras, oferecendo:

- ✅ **Mapa interativo hierárquico** com navegação imersiva Zona → Setor → Lote
- ✅ **Modo de Visualização por Bairros** com labels inteligentes e centróides automáticos
- ✅ **Base de dados unificada de Proprietários** (Perfil 360° com portfólio completo)
- ✅ **Dashboard de Analytics** para tracking de buscas e visualizações em tempo real
- ✅ **Busca Robusta** com suporte a nomes longos, conectores e normalização de acentos
- ✅ **CRM integrado** para gestão de leads e matching automático
- ✅ **Enriquecimento de dados** via integração com Enriquecimento API API
- ✅ **Interface premium** com tooltips ricos, carrossel de imagens e Google Street View

---

## 🎯 Funcionalidades Principais

### 1. Visualização Interativa
- Mapa hierárquico com zoom progressivo (Zonas → Setores → Lotes)
- Legenda de cores por zona fiscal
- Identificação visual de condomínios/edifícios
- Navegação intuitiva com botão "Voltar"

### 2. Sistema de Busca Avançado
- **Busca por inscrição cadastral** (8 ou 11 dígitos)
- **Busca por rua/endereço** com text search otimizado
- **Busca por nome de edifício** 
- **Busca por proprietário** (nome ou CPF/CNPJ)
- Filtros rápidos por tipo de busca

### 3. Tooltips Premium
- **Tooltip de Lote**: Informações cadastrais, galeria, lista de unidades
- **Tooltip de Unidade**: Dados completos, proprietário, contatos enriquecidos
- Agrupamento de unidades por torre/bloco
- Botão direto para Google Street View

### 4. CRM Integrado
- Cadastro de leads com orçamento e preferências
- Match automático com lotes compatíveis
- Gestão por temperatura (Quente/Morno/Frio)
- Busca de imóveis por critérios do cliente

### 5. Edição e CRUD
- Criação, edição e exclusão de lotes
- Adição e gestão de unidades
- Upload de imagens para galeria
- Movimentação de marcadores no mapa

### 6. Enriquecimento de Dados
- Integração com **Enriquecimento API API** via Edge Function
- Busca automática de telefones e emails por CPF/CNPJ
- [ ] Atualização em tempo real no banco de dados

### 7. Automação Jurídica & Certidões ⚖️
- **Consulta Automatizada**: Integração com API Infosimples para busca de certidões.
- **Múltiplos Órgãos**: TRF, TJSP, TRT, Receita Federal, CNDT e mais.
- **Visualizador Premium**: Modal dedicado para conferência e impressão de certidões HTML/PDF.
- **Gestão de Saldos**: Controle de custos por consulta.

### 8. Sistema de Notificações 🔔 (Sininho)
- **Real-time Alert**: Notificações instantâneas via Supabase Realtime.
- **Golden Bell**: Ícone de sino com badge de contagem de não lidas.
- **Monitoramento Passivo**: Robô que monitora e-mails e notifica novas certidões prontas.
- **Toasts Premium**: Balões informativos clicáveis para acesso rápido ao documento.

---

## 🛠️ Stack Tecnológica

### Frontend
- **HTML5 + JavaScript ES6+** (modular)
- **Leaflet.js** - Mapas interativos
- **RBush** - Índice espacial para performance
- **CSS moderno** - Interface premium responsiva

### Backend
- **Supabase** (PostgreSQL)
  - Tabelas: `lotes`, `unidades`, `crm_leads`
  - Row Level Security (RLS)
  - Realtime subscriptions
- **Supabase Edge Functions** (Deno)
  - `enrich-data` - Proxy para Enriquecimento API API
  - `infosimples-api` - Proxy para emissão de certidões
  - `email-monitor` - Robô de monitoramento de e-mails (Cron Job)
- **Supabase Storage** - Armazenamento de imagens e documentos jurídicos

### Analytics & Deploy
- **Firebase Hosting** - Deploy e CDN
- **Firebase Analytics** - Métricas de uso

### APIs Externas
- **Enriquecimento API** - Enriquecimento de dados cadastrais
- **Google Maps** - Street View integration

---

## 📁 Estrutura do Projeto

```
guaruja_geo/
├── mapa_interativo/           # Aplicação Web Principal (Frontend + Handlers)
├── scraper/                   # Sistema de Scraping (Python)
│   ├── sources/               # Extratores por fonte (OLX, Google, Serper)
│   ├── core/                  # DB, Configurações e Matcher
│   ├── sync/                  # Scripts de sincronização cloud/local
│   └── cron/                  # Scripts disparados via CRON
├── scripts/                   # Scripts de Ferramentas e IA
│   ├── automation/            # Git push, Automação de Releases
│   ├── ai_tools/              # Debug Gemini, Listagem de Modelos
│   └── valuation/             # Ferramentas de avaliação por IA
├── docs/                      # Documentação Centralizada
│   ├── business/              # Estratégia, Monetização e Prospectos
│   ├── planning/              # Roadmaps e Tarefas futuras
│   ├── database/              # Esquema Real Nuvem (Source of Truth)
│   └── technical/             # Manuais de deploy e comandos Firebase
├── Antigos/                   # Legacy & Backup (Não deletar sem backup)
│   ├── migrations/            # Migrations antigas do Supabase
│   ├── Curriculos/            # Arquivos pessoais (Bruno)
│   └── drafts/                # Rascunhos de e-mails e notas antigas
├── supabase/                  # Backend Supabase Configs
└── firebase.json              # Configuração Firebase Hosting
```

---

## 🗄️ Estrutura do Banco de Dados

### Tabela: `lotes`
Cadastro de lotes/terrenos com geometria UTM

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `inscricao` | VARCHAR(20) PK | Inscrição cadastral (8 dígitos) |
| `zona` | VARCHAR(10) | Zona fiscal |
| `setor` | VARCHAR(10) | Setor cadastral |
| `quadra` | VARCHAR(10) | Quadra |
| `lote_geo` | VARCHAR(10) | Número do lote |
| `bairro` | TEXT | Nome do bairro |
| `endereco` | TEXT | Endereço completo |
| `logradouro` | TEXT | Nome da rua |
| `numero` | VARCHAR(20) | Número predial |
| `cod_logradouro` | VARCHAR(20) | Código do logradouro |
| `loteamento` | TEXT | Nome do loteamento |
| `valor_m2` | NUMERIC | Valor do m² |
| `minx`, `miny`, `maxx`, `maxy` | NUMERIC | Bounds UTM (zona 23S) |
| `_lat`, `_lng` | NUMERIC | Coordenadas WGS84 (calculadas) |
| `nome_edificio` | TEXT | Nome do edifício/condomínio |
| `galeria` | JSONB | Array de URLs de imagens |

### Tabela: `unidades`
Unidades autônomas (apartamentos, salas, garagens)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `inscricao` | VARCHAR(20) PK | Inscrição da unidade (11 dígitos) |
| `lote_inscricao` | VARCHAR(20) FK | Referência ao lote pai |
| `nome_proprietario` | TEXT | Nome do proprietário |
| `cpf_cnpj` | VARCHAR(20) | CPF ou CNPJ |
| `logradouro` | TEXT | Endereço da unidade |
| `numero` | VARCHAR(20) | Número |
| `complemento` | TEXT | Complemento (apto, bloco, etc) |
| `bairro_unidade` | TEXT | Bairro |
| `cep` | VARCHAR(15) | CEP |
| `metragem` | NUMERIC | Área em m² |
| `valor_venal` | NUMERIC | Valor venal |
| `valor_venal_edificado` | NUMERIC | Valor venal edificado |
| `descricao_imovel` | TEXT | Descrição |
| `tipo` | VARCHAR(50) | Tipo (residencial, comercial, garagem) |
| `torre` | TEXT | Torre/bloco do edifício |
| `telefone`, `email` | TEXT | Contatos enriquecidos |
| `galeria` | JSONB | Imagens da unidade |

### Tabela: `leads`
Sistema CRM para gestão de clientes

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID PK | ID único |
| `nome` | TEXT | Nome do lead |
| `contato` | TEXT | Telefone/WhatsApp |
| `status` | VARCHAR(20) | Temperatura (Quente/Morno/Frio) |
| `orcamento` | NUMERIC | Orçamento máximo |
| `quartos_min` | INTEGER | Mínimo de quartos |
| `bairros_interesse` | TEXT | Bairros preferidos |
| `created_at` | TIMESTAMP | Data de criação |

---

## 🚀 Instalação e Configuração

### Pré-requisitos
- Node.js 16+ (apenas para Firebase CLI)
- Python 3.8+ (para scripts de coleta)
- Conta Supabase (backend)
- Conta Firebase (deploy opcional)

### 1. Clone o Repositório
```bash
git clone <repository-url>
cd guaruja_geo
```

### 2. Configurar Supabase

#### Criar Projeto no Supabase
1. Acesse [supabase.com](https://supabase.com)
2. Crie um novo projeto
3. Copie as credenciais (URL e Anon Key)

#### Configurar Cliente
Edite `mapa_interativo/supabase_client.js`:
```javascript
const SUPABASE_URL = 'https://seu-projeto.supabase.co';
const SUPABASE_ANON_KEY = 'sua-anon-key';
```

#### Criar Tabelas
Execute as migrations SQL no Supabase Dashboard (SQL Editor):
```sql
-- Ver seção "Schema SQL" abaixo
```

### 3. Scripts Python (Coleta de Dados)

#### Instalar Dependências
```bash
cd scripts
pip install -r requirements.txt
```

#### Upload de Dados
```bash
python upload_data_via_api.py
```

### 4. Deploy (Firebase Hosting)

#### Instalar Firebase CLI
```bash
npm install -g firebase-tools
```

#### Login e Deploy
```bash
firebase login
firebase deploy --only hosting
```

A aplicação estará disponível em: `https://seu-projeto.web.app`

---

## 📖 Uso da Aplicação

### Login
- **Acesso**: Via E-mail e Senha (com verificação anti-bot hCaptcha)

### Navegação no Mapa
1. **Visão de Zonas** (inicial): Clique em uma zona para explorar
2. **Visão de Setores**: Clique em um setor
3. **Visão de Lotes**: Clique em um lote para ver detalhes
4. Use o botão **"⬅ Voltar"** para subir níveis

### Buscar Imóveis
1. Digite na barra de busca:
   - **Inscrição**: `30661176` ou `30661176001`
   - **Rua**: `Rua do Sol`
   - **Edifício**: `Edifício Porto Fino`
   - **Proprietário**: `João Silva` ou `123.456.789-00`
2. Selecione o tipo de busca nos chips (Todos/Rua/Edifício/Proprietário)
3. Clique no resultado para visualizar

### Gerenciar Leads (CRM)
1. Clique no botão **👥** no header
2. **Adicionar Lead**: Preencha nome, orçamento, preferências
3. **Buscar Compatíveis**: Sistema encontra imóveis que atendem critérios
4. **Editar/Excluir**: Gerencie leads existentes

### Editar Lotes/Unidades
1. Clique com **botão direito** em um lote no mapa
2. Escolha a ação:
   - **Editar Detalhes**: Modifica informações
   - **Adicionar Unidade**: Cria nova unidade
   - **Mover Localização**: Reposiciona no mapa
   - **Excluir Lote**: Remove do sistema

---

## 🔧 Scripts Python de Coleta

### `upload_data_via_api.py`
Upload em lote de dados para Supabase

**Uso:**
```bash
python scripts/upload_data_via_api.py
```

**Funcionalidades:**
- Upload com UPSERT (atualiza se já existe)
- Processamento em batches de 500 registros
- Checkpoint para retomar uploads interrompidos
- Deduplicação automática

### `probe_balance.py`
Verifica saldo da API Enriquecimento API

```bash
python scripts/probe_balance.py
```

### `probe_enrichment.py`
Testa chamadas à API Enriquecimento API

```bash
python scripts/probe_enrichment.py
```

---

## 🗂️ Scripts Legacy de Coleta

Localizados em `_legacy/`, são responsáveis pela coleta inicial dos dados:

### `guaruja_lotes_extractor.py`
Extrator básico de lotes do sistema de geoprocessamento do município

### `guaruja_extrator_completo.py`
Extrator completo com geometria e metadados

### `capture_and_vectorize.py`
Captura de telas e vetorização de geometrias

### Outros
- `merge_data.py` - Merge de múltiplos datasets
- `vectorizer.py` - Vetorização de coordenadas
- `analyze_data.py` - Análise estatística dos dados

---

## 🔒 Segurança

### Autenticação
- Login básico com credenciais armazenadas localmente
- Para produção, migrar para Supabase Auth

### Row Level Security (RLS)
Configurar políticas no Supabase:
```sql
-- Exemplo: Apenas leitura para usuários anônimos
ALTER TABLE lotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON lotes FOR SELECT USING (true);
```

### API Keys
- **Supabase Anon Key**: Segura para frontend (RLS protege)
- **Enriquecimento API Key**: Apenas via Edge Function (nunca expor no frontend)

---

## 🐛 Troubleshooting

### Lotes não aparecem no mapa
- Verifique se os dados foram carregados no Supabase
- Abra o console do navegador (F12) e procure erros
- Confirme que `SUPABASE_URL` e `SUPABASE_ANON_KEY` estão corretos

### Busca não retorna resultados
- Para busca de proprietário, certifique-se que há dados em `unidades.nome_proprietario`
- Busca por texto usa `websearch_to_tsquery` - tente termos mais genéricos

### Upload de imagens falha
- Verifique configuração do Supabase Storage
- Bucket `lotes-images` deve existir e estar público
- Confirme permissões de upload

### Edge Function retorna erro
- Verifique se a Edge Function foi deployada: `supabase functions deploy enrich-data`
- Confirme que as secrets estão configuradas

---

## 📊 Analytics (Futuro)

Sistema de analytics será implementado para rastrear:
- Métricas de uso (buscas, visualizações)
- Lotes e proprietários mais buscados
- Performance do CRM
- Exportação de relatórios

---

## 🤝 Suporte e Manutenção

### Logs e Debugging
- **Browser Console** (F12): Erros de JavaScript
- **Supabase Logs**: Erros de queries e Edge Functions
- **Firebase Console**: Logs de hosting

### Backup de Dados
```bash
# Exportar dados do Supabase
psql "postgresql://..." -c "COPY lotes TO '/tmp/lotes_backup.csv' CSV HEADER;"
```

---

## 📝 Licença

Sistema proprietário desenvolvido para uso comercial.

---

## 👨‍💻 Desenvolvimento

**Desenvolvido para o mercado imobiliário do Guarujá/SP**

Sistema completo de geoprocessamento e gestão imobiliária com dados cadastrais de todos os lotes da cidade.

---

## 🔄 Próximas Melhorias

- [ ] Dashboard de Analytics completo
- [ ] Exportação de relatórios (PDF/Excel)
- [ ] Sistema de notificações push
- [ ] Integração com WhatsApp Business
- [ ] App mobile (React Native)
- [ ] Multi-tenant (múltiplas cidades)

---

# 🤖 Guaruja Geo - Email Monitor (Standalone)

Este serviço monitora a caixa de email configurada para baixar automaticamente certidões (PDFs) e salvar no Supabase Storage do projeto Guaruja Geo.

## Pré-requisitos

1. **Node.js**: v18+ instalado.
2. **Conta de Email**: Gmail com "App Password" gerada.
3. **Supabase**: URL e Service Role Key.

## Instalação Local

1. Entre na pasta:
   ```bash
   cd backend_monitor
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Crie um arquivo `.env` com suas credenciais:
   ```env
   IMAP_USER=seu_email@gmail.com
   IMAP_PASSWORD=sua_senha_de_app
   IMAP_HOST=imap.gmail.com
   SUPABASE_URL=https://seu-projeto.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=sua_chave_service_role
   ```

4. Inicie o monitor:
   ```bash
   npm start
   ```

   O serviço ficará rodando e mostrará logs no console a cada email novo.

## Deploy no Render.com (Recomendado)

O Render é ideal para rodar este tipo de "Background Worker" gratuitamente ou com baixo custo.

1. Crie uma conta no [Render.com](https://render.com).
2. Conecte seu repositório GitHub.
3. Clique em **New +** -> **Background Worker**.
4. Selecione este repositório.
5. Configure:
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node backend_monitor/index.js` (ajuste o caminho se necessário)
6. Na aba **Environment**, adicione as variáveis do `.env` acima.
7. Clique em **Create Background Worker**.

Pronto! O Render manterá o script rodando 24/7.
