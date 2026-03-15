# 🔧 Manual Técnico - Guarujá GeoMap

**Leia primeiro o Blueprint:** [BLUEPRINT_SISTEMA.md](./BLUEPRINT_SISTEMA.md)\
**Schema do Banco de Dados:**
[SCHEMA_COMPLETO_V2.sql](../database/SCHEMA_COMPLETO_V2.sql)

**Documentação técnica de referência para manutenção evolutiva.**

---

## 1. Arquitetura do Sistema

### Visão Geral

O Guarujá GeoMap é uma aplicação web progressiva (PWA) com arquitetura
client-side moderna:

```mermaid
graph TB
    subgraph Cliente["🌐 Cliente (Browser)"]
        HTML[index.html]
        JS[JavaScript Modules]
        CSS[Stylesheets]
    end
    
    subgraph Backend["☁️ Supabase (Backend)"]
        PG[(PostgreSQL)]
        Storage[Storage/CDN]
        EdgeFn[Edge Functions]
    end
    
    subgraph External["🔌 APIs Externas"]
        DS[API de Enriquecimento]
        GM[Google Maps]
        FA[Firebase Analytics]
    end
    
    HTML --> JS
    JS --> PG
    JS --> Storage
    JS --> EdgeFn
    EdgeFn --> DS
    EdgeFn --> IS[Infosimples API]
    JS --> GM
    JS --> FA
    Mon[Email Monitor Service] --> PG
    Mon --> Storage
```

### Fluxo de Dados

1. **Carregamento Inicial**:
   ````
   Browser → index.html → Scripts JS → Supabase (fetch lotes) → Renderização no Mapa
   ```f
   ````

2. **Busca**:
   ```
   Input do usuário → search_handler.js → PostgreSQL Full-Text Search → Resultados
   ```

3. **Enriquecimento de Dados**:
   ```
   Botão "Buscar Contatos" → enrichment_handler.js → Edge Function → API de Enriquecimento → Update DB
   ```

---

## 2. Stack Tecnológica Detalhada

### Frontend

#### Core

- **HTML5**: Estrutura semântica
- **JavaScript ES6+**: Lógica modular
  - Modules pattern
  - Async/await para operações assíncronas
  - Event-driven architecture

#### Bibliotecas

**Leaflet.js 1.9.4**

```javascript
// Biblioteca de mapas interativos
// Licença: BSD 2-Clause
// CDN: unpkg.com/leaflet@1.9.4
```

**RBush.js**

```javascript
// Índice espacial R-tree para performance
// Usado para busca rápida de lotes por coordenadas
```

**Supabase JS Client**

```javascript
// Cliente oficial do Supabase
// CDN: cdn.jsdelivr.net/npm/@supabase/supabase-js@2
```

#### CSS

- **CSS3 Custom Properties** (variáveis CSS)
- **Flexbox & Grid** para layouts
- **Media Queries** para responsividade
- **Animations** com `@keyframes`

### Backend

#### Supabase (BaaS)

**PostgreSQL 15.x**

- Banco de dados relacional
- Full-Text Search com `tsvector`
- JSON/JSONB support
- PostGIS para dados geoespaciais (opcional)

**Row Level Security (RLS)**

- Políticas de acesso por tabela
- Segurança a nível de linha

**Realtime**

- WebSocket subscriptions
- Atualização automática de dados

**Storage**

- Armazenamento de imagens
- CDN integrado
- Políticas de acesso por bucket

**Edge Functions (Deno)**

- Serverless functions
- Proxy seguro para APIs externas
- TypeScript support nativo

### Deploy & Analytics

**Firebase Hosting**

- CDN global
- HTTPS automático
- Deploy via CLI
- Rollback de versões

**Firebase Analytics**

- Métricas de uso
- Eventos customizados
- Integração Google Analytics 4

---

## 3. Estrutura do Banco de Dados

### Schema SQL Completo

```sql
-- ============================================
-- TABELA: lotes
-- ============================================
CREATE TABLE IF NOT EXISTS lotes (
    -- Identificação
    inscricao VARCHAR(20) PRIMARY KEY,
    
    -- Localização Administrativa
    zona VARCHAR(10),
    setor VARCHAR(10),
    quadra VARCHAR(10),
    lote_geo VARCHAR(10),
    
    -- Endereço
    bairro TEXT,
    endereco TEXT,
    logradouro TEXT,
    numero VARCHAR(20),
    cod_logradouro VARCHAR(20),
    loteamento TEXT,
    
    -- Valores
    valor_m2 NUMERIC(15,2),
    
    -- Geometria (UTM Zona 23S - SIRGAS 2000)
    minx NUMERIC(15,6),
    miny NUMERIC(15,6),
    maxx NUMERIC(15,6),
    maxy NUMERIC(15,6),
    
    -- Coordenadas calculadas (WGS84)
    _lat NUMERIC(12,8),
    _lng NUMERIC(12,8),
    
    -- Edifícios
    nome_edificio TEXT,
    
    -- Galeria de Imagens
    galeria JSONB DEFAULT '[]'::jsonb,
    
    -- Metadados
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para Performance
CREATE INDEX idx_lotes_zona ON lotes(zona);
CREATE INDEX idx_lotes_setor ON lotes(setor);
CREATE INDEX idx_lotes_bairro ON lotes(bairro);
CREATE INDEX idx_lotes_coords ON lotes(_lat, _lng);
CREATE INDEX idx_lotes_nome_edificio ON lotes(nome_edificio);

-- Full-Text Search Index
CREATE INDEX idx_lotes_search ON lotes USING GIN (
    to_tsvector('portuguese', 
        COALESCE(endereco, '') || ' ' || 
        COALESCE(bairro, '') || ' ' || 
        COALESCE(logradouro, '') || ' ' ||
        COALESCE(nome_edificio, '')
    )
);

-- ============================================
-- TABELA: unidades
-- ============================================
CREATE TABLE IF NOT EXISTS unidades (
    -- Identificação
    inscricao VARCHAR(20) PRIMARY KEY,
    lote_inscricao VARCHAR(20) REFERENCES lotes(inscricao) ON DELETE CASCADE,
    
    -- Proprietário
    nome_proprietario TEXT,
    cpf_cnpj VARCHAR(20),
    
    -- Endereço da Unidade
    logradouro TEXT,
    numero VARCHAR(20),
    complemento TEXT,
    bairro_unidade TEXT,
    cep VARCHAR(15),
    endereco_completo TEXT,
    
    -- Características
    metragem NUMERIC(10,2),
    valor_venal NUMERIC(15,2),
    valor_venal_edificado NUMERIC(15,2),
    descricao_imovel TEXT,
    
    -- Tipo e Localização no Edifício
    tipo VARCHAR(50) DEFAULT 'residencial', -- residencial, comercial, garagem
    torre TEXT,
    
    -- Contatos Enriquecidos
    telefone TEXT,
    email TEXT,
    
    -- Status
    status_processamento VARCHAR(50),
    
    -- Galeria
    galeria JSONB DEFAULT '[]'::jsonb,
    
    -- Metadados
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_unidades_lote ON unidades(lote_inscricao);
CREATE INDEX idx_unidades_proprietario ON unidades(nome_proprietario);
CREATE INDEX idx_unidades_cpf_cnpj ON unidades(cpf_cnpj);
CREATE INDEX idx_unidades_tipo ON unidades(tipo);
CREATE INDEX idx_unidades_torre ON unidades(torre);

-- Full-Text Search para Proprietários
CREATE INDEX idx_unidades_search_proprietario ON unidades USING GIN (
    to_tsvector('portuguese', COALESCE(nome_proprietario, ''))
);

-- ============================================
-- TABELA: crm_leads
-- ============================================
CREATE TABLE IF NOT EXISTS crm_leads (
    id BIGSERIAL PRIMARY KEY,
    
    -- Informações do Lead
    nome TEXT NOT NULL,
    contato TEXT,
    
    -- Preferências
    status VARCHAR(20) DEFAULT 'Morno', -- Quente, Morno, Frio
    orcamento NUMERIC(15,2),
    quartos_min INTEGER,
    bairros_interesse TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_leads_status ON crm_leads(status);
CREATE INDEX idx_leads_created ON crm_leads(created_at DESC);

-- ============================================
-- TRIGGERS: Updated_at automático
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_lotes_updated_at BEFORE UPDATE ON lotes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_unidades_updated_at BEFORE UPDATE ON unidades
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON crm_leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- TABELA: notificacoes
-- ============================================
CREATE TABLE IF NOT EXISTS notificacoes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    titulo TEXT NOT NULL,
    mensagem TEXT,
    link_url TEXT,
    tipo TEXT DEFAULT 'certidao',
    lida BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================
-- TABELA: proprietario_relacionamentos
-- ============================================
CREATE TABLE IF NOT EXISTS proprietario_relacionamentos (
    id BIGSERIAL PRIMARY KEY,
    proprietario_origem_id BIGINT REFERENCES proprietarios(id) ON DELETE CASCADE,
    proprietario_destino_id BIGINT REFERENCES proprietarios(id) ON DELETE CASCADE,
    tipo_vinculo VARCHAR(100),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Relacionamentos

```
lotes (1) ----< (N) unidades
   |
   └─ inscricao (PK)
         ↑
         |
   lote_inscricao (FK)
```

### Constraints e Validações

- `inscricao`: Sempre 8 dígitos (lotes) ou 11 dígitos (unidades)
- `cpf_cnpj`: Máximo 20 caracteres (inclui pontuação)
- `galeria`: JSONB array de URLs

---

## 4. Módulos JavaScript

### Arquitetura Modular

```
app.js (Entry Point)
  ├── utils.js (Utilitários)
  ├── supabase_client.js (Cliente DB)
  ├── map_handler.js (Mapa e Hierarquia)
  ├── tooltip_handler.js (Tooltips)
  ├── search_handler.js (Busca)
  ├── editor_handler.js (CRUD)
  ├── crm_handler.js (CRM)
  ├── enrichment_handler.js (APIs Externas)
  ├── notifications_handler.js (Sininho)
  └── infosimples_handler.js (Certidões Jurídicas)
```

### `app.js` - Entry Point

**Responsabilidades:**

- Inicialização do sistema
- Autenticação básica
- Coordenação entre módulos
- Loading inicial de dados

**Principais Funções:**

```javascript
async function init()              // Inicializa app
async function loadInitialData()   // Carrega lotes do Supabase
function attemptLogin()            // Valida login
window.fetchLotDetails()           // Busca detalhes de lote individual
```

**Fluxo de Inicialização:**

1. Verifica autenticação (`localStorage`)
2. Inicializa mapa (`initMap()`)
3. Inicializa módulos (`initMapHandlerRefs()`, etc)
4. Carrega dados (`loadInitialData()`)
5. Processa hierarquia (`processDataHierarchy()`)
6. Renderiza mapa (`renderHierarchy()`)

### `map_handler.js` - Gerenciamento de Mapa

**Responsabilidades:**

- Renderização do mapa Leaflet
- Navegação hierárquica (Zonas → Setores → Lotes)
- Spatial indexing com RBush
- Context menu (botão direito)

**Estrutura de Dados:**

```javascript
window.cityData = {
    "Zona 1": {
        color: "#FF6B6B",
        setores: {
            "Setor 0001": {
                lotes: [...],
                bounds: {...}
            }
        }
    }
}
```

**Principais Funções:**

```javascript
initMap(); // Cria mapa Leaflet
processDataHierarchy(); // Organiza lotes hierarquicamente
renderHierarchy(); // Renderiza nível atual (zonas/setores/lotes)
goUpLevel(); // Volta um nível
populateZoneLegend(); // Popula legenda de cores
handleContextMenu(); // Menu de botão direito
```

### `tooltip_handler.js` - Tooltips

**Responsabilidades:**

- Renderização de tooltips de lotes e unidades
- Galeria de imagens com carrossel
- Agrupamento de unidades por torre
- Botão Google Street View

**Principais Funções:**

```javascript
showLotTooltip(lote, x, y); // Exibe tooltip de lote
showUnitTooltip(unit, lote, x, y); // Exibe tooltip de unidade
closeLotTooltip(); // Fecha tooltip
renderUnitItem(unit); // Renderiza item de unidade
setupUnitClickHandlers(); // Configura clicks em unidades
```

**Formato de Galeria:**

```javascript
lote.galeria = [
  "https://supabase.co/storage/image1.jpg",
  "https://supabase.co/storage/image2.jpg",
];
```

### `search_handler.js` - Busca e Filtros

**Responsabilidades:**

- Busca full-text no PostgreSQL
- Filtros por tipo (rua, edifício, proprietário)
- Exibição de resultados
- Navegação para resultados no mapa

**Busca Full-Text:**

```javascript
// Usa websearch_to_tsquery para busca inteligente
.textSearch('search_column', query, {
    type: 'websearch',
    config: 'portuguese'
})
```

**Tipos de Busca:**

- `all`: Busca em todos os campos
- `street`: Apenas `endereco`, `logradouro`
- `building`: Apenas `nome_edificio`
- `owner`: Apenas `nome_proprietario` em `unidades`

**Principais Funções:**

```javascript
setupSearchAndFilters(); // Inicializa listeners
performSearch(query); // Executa busca no Supabase
displaySearchResults(results); // Exibe resultados na sidebar
handleResultClick(item); // Navega para resultado no mapa
```

### `editor_handler.js` - CRUD

**Responsabilidades:**

- Edição de lotes e unidades
- Upload de imagens para Supabase Storage
- Criação/exclusão de registros
- Validação de dados

**Upload de Imagens:**

```javascript
async function uploadToSupabase(file, inscricao) {
  const fileName = `${inscricao}_${Date.now()}.${ext}`;
  const { data, error } = await supabaseApp.storage
    .from("lotes-images")
    .upload(fileName, file);

  return publicURL;
}
```

**Principais Funções:**

```javascript
editFromTooltip(inscricao); // Abre editor de lote
saveEditFromTooltip(inscricao); // Salva edições
editUnitFromTooltip(unitInscricao); // Abre editor de unidade
saveUnitEdit(unitInscricao); // Salva unidade
handleGalleryUpload(file); // Upload de imagem
deleteLote(inscricao); // Exclui lote
```

### `crm_handler.js` - CRM

**Responsabilidades:**

- CRUD de leads
- Matching automático (lead ↔ imóveis)
- Gestão de temperatura
- Painel de leads

**Algoritmo de Matching:**

```javascript
// Busca imóveis compatíveis:
// 1. Valor venal <= orçamento
// 2. Bairro em lista de interesses
// 3. (Futuro) Número de quartos >= mínimo

SELECT u.*, l.*
FROM unidades u
JOIN lotes l ON u.lote_inscricao = l.inscricao
WHERE u.valor_venal <= lead.orcamento
  AND l.bairro = ANY(lead.bairros_interesse)
ORDER BY u.valor_venal ASC
```

**Principais Funções:**

```javascript
initCRM(); // Inicializa e carrega contagem
saveLead(); // Cria novo lead
updateLead(id); // Atualiza lead
deleteLead(id); // Exclui lead
findMatches(id); // Busca imóveis compatíveis
showLeadsPanel(); // Exibe painel de leads
```

### `enrichment_handler.js` - Enriquecimento

**Responsabilidades:**

- Integração com API de Enriquecimento via Edge Function
- Busca de telefones e emails por CPF/CNPJ
- Atualização de contatos nas unidades

**Fluxo:**

```
User clica "Buscar Contatos"
  → enrichUnit(inscricao)
    → Fetcha unit do DB
    → Se CPF: searchPerson(cpf, nome)
    → Se CNPJ: searchCompany(cnpj)
      → Edge Function proxy → API de Enriquecimento
    → saveEnrichment(unit, data)
      → UPDATE unidades SET telefone=..., email=...
```

**Principais Funções:**

```javascript
enrichUnit(inscricao); // Orquestra enriquecimento
searchPerson(cpf, name); // Busca PF
searchCompany(cnpj); // Busca PJ
saveEnrichment(unit, data); // Salva contatos no DB
checkApiStatus(); // Verifica API key válida
```

### `utils.js` - Utilitários

**Funções Globais:**

**Toast Notifications:**

```javascript
Toast.success("Mensagem");
Toast.error("Erro");
Toast.warning("Alerta");
Toast.info("Info");
```

**Loading Overlay:**

```javascript
Loading.show("Carregando...", "Subtext");
Loading.hide();
Loading.setProgress(50); // Atualiza barra de progresso
```

**Formatação de Documentos:**

```javascript
formatDocument("12345678900", visible = false);
// Retorna: "123.456.789-**"

formatDocument("123 45678900", visible = true);
// Retorna: "123.456.789-00"
```

**Conversão UTM ↔ LatLon:**

```javascript
utmToLatLon(x, y); // UTM Zona 23S → WGS84
latLonToUtm(lat, lng); // WGS84 → UTM
```

**Cache (IndexedDB):**

```javascript
saveLotesToCache(lotes); // Salva no IndexedDB
loadLotesFromCache(); // Carrega do cache
```

### `supabase_client.js` - Cliente Supabase

**Configuração:**

```javascript
const SUPABASE_URL = "https://seu-projeto.supabase.co";
const SUPABASE_ANON_KEY = "sua-anon-key";

window.supabaseApp = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

---

## 5. Arquitetura de Analytics e Tracking

### Rastreamento de Eventos (`analytics_tracker.js`)

O sistema utiliza um rastreador customizado que envia eventos diretamente para a
tabela `analytics_events` no Supabase:

- `trackSearch(query, searchType, resultsCount)`
- `trackLotView(inscricao, zona, bairro)`
- `trackUnitView(id, ownerName)`

### Dashboard (`analytics_dashboard.js`)

Painel interativo que consulta views especializadas (`analytics_top_lots`,
`analytics_top_owners`) para exibir métricas de performance da equipe.

---

## 6. Lógica de Visualização e Bairros

### Modo Bairros (`isNeighborhoodMode`)

Alterna o motor de cores de `window.getZoneColor` para
`window.getNeighborhoodColor`.

- **Fonte de Dados:** `vw_bairros_centroids` (Materialized View).
- **Labeling:** Etiquetas dinâmicas ancoradas no centróide UTM do bairro,
  ocultadas automaticamente conforme o nível de zoom para evitar poluição
  visual.

### Navegação Hierárquica (`navigateToInscricao`)

Implementa um funil de imersão progressivo usando `window.map.flyTo`:

1. **Nível Zona:** Zoom 14.
2. **Nível Setor:** Zoom 16.
3. **Nível Lote:** Zoom 19 + Abertura de tooltips.

- Centralizado em `search_handler.js` para garantir consistência entre busca e
  cliques no perfil.

---

## 7. Gestão Unificada de Proprietários

### Sincronização (`proprietarios` table)

- Toda unidade com CPF é vinculada a um registro único na tabela
  `proprietarios`.
- **Trigger `nome_busca`:** Mantém uma coluna normalizada (sem acentos,
  minúscula) para buscas `ILIKE` de alta performance.
- **Enriquecimento:** Adaptado para enriquecer o proprietário unificado e
  replicar contatos para todas as unidades vinculadas via patches em lote.

---

## 8. Edge Functions (Supabase)

### `enrich-data` - Proxy para API de Enriquecimento

**Localização:** `supabase/functions/enrich-data/index.ts`

**Propósito:**

- Proteger API key da API de Enriquecimento (não expor no frontend)
- Proxy seguro para requisições
- Rate limiting (futuro)

**Código:**

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  const { type, cpf, cnpj, name } = await req.json();

  const API de Enriquecimento_KEY = Deno.env.get("API de Enriquecimento_API_KEY");

  let url = "";
  if (type === "person") {
    url =
      `https://api.API de Enriquecimento.com.br/v1/pessoa_fisica?cpf=${cpf}&nome=${name}`;
  } else if (type === "company") {
    url = `https://api.API de Enriquecimento.com.br/v1/pessoa_juridica?cnpj=${cnpj}`;
  }

  const response = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${API de Enriquecimento_KEY}`,
    },
  });

  const data = await response.json();
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
});
```

**Deploy:**

```bash
supabase functions deploy enrich-data
supabase secrets set API de Enriquecimento_API_KEY=your-key
```

### `infosimples-api` - Automação de Certidões

**Localização:** `supabase/functions/infosimples-api/index.ts`

**Propósito:**

- Proxy para API Infosimples (emissão de documentos jurídicos)
- Tratamento de parâmetros específicos por tribunal (TJSP, TRF, etc)
- Validação de saldo

**Fluxo:**

1. Recebe `params` do frontend
2. Chama API Infosimples (POST)
3. Retorna JSON com links ou status "Pendente"

### `email-monitor` - Cron Job de Monitoramento

**Localização:** `supabase/functions/email-monitor/index.ts`

**Propósito:**

- Monitorar caixa de email (Gmail/IMAP) a cada 10 min
- Identificar e-mails de tribunais com anexos (PDFs)
- Download automático para Storage
- Notificação por e-mail para o administrador

**Configuração (Cron):**

- Agendamento via `pg_cron` no banco de dados.
- Frequência: `*\/10 * * * *` (A cada 10 minutos).

**Variáveis de Ambiente Necessárias:**

- `IMAP_USER`, `IMAP_PASSWORD`, `IMAP_HOST`
- `INFOSIMPLES_TOKEN` (para api)

---

## 6. Scripts Python de Coleta

### `upload_data_via_api.py`

**Propósito:** Upload em lote de JSON para Supabase via REST API

**Configuração:**

```python
SUPABASE_URL = 'https://seu-projeto.supabase.co'
SUPABASE_KEY = 'sua-service-role-key'  # Use service_role para bypass RLS
```

**Funcionalidades:**

- UPSERT (insert ou update se já existe)
- Batches de 500 registros
- Checkpoint para retomar uploads
- Deduplicação automática
- Validação de tamanho de campos

**Uso:**

```bash
python scripts/upload_data_via_api.py
```

**Como Funciona:**

1. Lê `mapa_interativo/lotes_merged.json`
2. Para cada registro:
   - Separa lotes vs unidades
   - Limpa e valida dados
   - Acumula em batches
3. Envia batches para Supabase via POST
4. Salva checkpoint a cada batch de unidades

### `probe_balance.py` & `probe_API de Enriquecimento.py`

**Propósito:** Testar APIs externas

**Uso:**

```bash
python scripts/probe_balance.py
python scripts/probe_API de Enriquecimento.py
```

---

---

## 8. Módulo Leads Hunter (Anúncios Externos)

Sistema de captura e exibição de anúncios imobiliários ativos na web (OLX, Zap,
VivaReal, etc).

### 8.1 Arquitetura

1. **Scraper (Python):**
   - Localizado em `scraper/`.
   - Executa rotinas de busca em múltiplos portais.
   - Filtra resultados por bairro "Guarujá".
   - Salva dados em banco SQLite temporário `scraped_data.db`.

2. **Sincronizador (`anuncios_sync.py`):**
   - Lê do SQLite.
   - Resolve o `lote_id` cruzando endereço/número com a tabela `unidades` ->
     `lotes`.
   - Upsert na tabela `anuncios` do Supabase.
   - Gera notificações na tabela `anuncios_notifications` para leads com **Match
     Score = 100**.

3. **Frontend (`anuncios_handler.js`):**
   - **Leads Button:** Injetado dinamicamente no header do tooltip do lote.
   - **Floating Panel:** Painel arrastável/flutuante que carrega os anúncios via
     AJAX.
   - **Badges:** Indicadores vermelhos nos tooltips baseados em `count`
     realtime.

4. **Realtime Notifications (`anuncios_notifications.js`):**
   - Escuta canal `postgres_changes` na tabela `anuncios_notifications`.
   - Exibe Toasts (balões) e toca som quando um novo lead 100% é inserido pelo
     scraper.

### 8.2 Tabela `anuncios`

| Coluna        | Tipo        | Descrição                              |
| :------------ | :---------- | :------------------------------------- |
| `id`          | UUID        | PK                                     |
| `lote_id`     | VARCHAR(20) | FK para `lotes.inscricao` (Loose Link) |
| `titulo`      | TEXT        | Título do anúncio                      |
| `url`         | TEXT        | Link original (Unique)                 |
| `preco`       | NUMERIC     | Valor de venda                         |
| `match_score` | INT         | De 0 a 100 (Confiança do vínculo)      |
| `source`      | VARCHAR     | Origem (olx, zap, etc)                 |
| `is_active`   | BOOL        | Se ainda está no ar                    |

---

## 9. Configuração e Deploy

### Desenvolvimento Local

**1. Servir Arquivos:**

```bash
# Opção 1: Python
cd mapa_interativo
python -m http.server 8000

# Opção 2: Node.js
npm install -g http-server
http-server mapa_interativo -p 8000
```

**2. Abrir no Browser:**

```
http://localhost:8000
```

### Deploy em Produção (Firebase)

**1. Instalar Firebase CLI:**

```bash
npm install -g firebase-tools
```

**2. Login:**

```bash
firebase login
```

**3. Criar Projeto:**

```bash
firebase init hosting
```

- Selecione diretório: `mapa_interativo`
- Configure SPA (single-page app): **Não**
- Não sobrescrever index.html

**4. Deploy:**

```bash
firebase deploy --only hosting
```

**5. Ver Site:**

```
https://seu-projeto.web.app
```

### Variáveis de Ambiente

**Supabase:**

- `SUPABASE_URL` - Em `supabase_client.js`
- `SUPABASE_ANON_KEY` - Em `supabase_client.js`

**API de Enriquecimento:**

- `API de Enriquecimento_API_KEY` - Em Supabase Secrets (para Edge Function)

### firebase.json

```json
{
  "hosting": {
    "public": "mapa_interativo",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "headers": [{
      "source": "**/*.@(jpg|jpeg|gif|png|webp)",
      "headers": [{
        "key": "Cache-Control",
        "value": "max-age=604800"
      }]
    }]
  }
}
```

---

## 8. Segurança

### Autenticação

**Estado Atual:**

- Login básico com credenciais hardcoded
- Armazenamento em `localStorage`

**Produção (Recomendado):** Migrar para Supabase Auth:

```javascript
// Login
const { data, error } = await supabaseApp.auth.signInWithPassword({
  email: "user@example.com",
  password: "senha",
});

// Logout
await supabaseApp.auth.signOut();

// Verificar sessão
const { data: { session } } = await supabaseApp.auth.getSession();
```

### Row Level Security (RLS)

**Exemplo de Políticas:**

```sql
-- Leitura pública, escrita apenas autenticados
ALTER TABLE lotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON lotes
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated write" ON lotes
  FOR ALL USING (auth.role() = 'authenticated');
```

### Proteção de API Keys

✅ **Correto:**

- API de Enriquecimento key apenas em Edge Function
- Supabase Anon Key no frontend (protegida por RLS)

❌ **Errado:**

- API de Enriquecimento key direto no JavaScript frontend

---

## 9. Performance e Otimizações

### Indexação Espacial (RBush)

**Problema:** Verificar 50k+ lotes para encontrar qual foi clicado é lento.

**Solução:** RBush cria índice R-tree:

```javascript
const tree = rbush();
tree.load(lotes.map((l) => ({
  minX: l._lat,
  minY: l._lng,
  maxX: l._lat,
  maxY: l._lng,
  lote: l,
})));

// Busca rápida de lotes em área
const results = tree.search({
  minX: lat - 0.001,
  minY: lng - 0.001,
  maxX: lat + 0.001,
  maxY: lng + 0.001,
});
```

### Cache com IndexedDB

```javascript
// App salva lotes em IndexedDB (1h de validade)
saveLotesToCache(lotes);

// Próximas visitas carregam do cache
const cached = await loadLotesFromCache();
```

### Lazy Loading de Imagens

```javascript
<img loading="lazy" src="...">
```

### Debouncing de Busca

```javascript
// Espera usuário parar de digitar antes de buscar
let searchTimeout;
searchInput.addEventListener("input", (e) => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => performSearch(e.target.value), 300);
});
```

---

## 10. Debugging e Logs

### Browser Console

**Ativar:**

- Chrome/Edge: F12 → Console
- Firefox: F12 → Console
- Safari: Cmd+Option+C

**Logs do Sistema:**

```
✅ Utils module loaded
✅ Supabase App initialized
✅ Map Handler module loaded
✅ Tooltip Handler module loaded
✅ Search Handler module loaded
✅ CRM Handler module loaded
✅ Editor Handler module loaded
✅ Main App (app.js) initialized
🚀 Starting Guarujá GeoMap...
📦 Data loaded from Cache
```

### Supabase Logs

**Dashboard → Logs:**

- SQL queries executadas
- Erros de Edge Functions
- Performance de queries

### Firebase Logs

**Console → Hosting:**

- Requisições HTTP
- Erros de deploy
- Analytics integrados

### Debug Mode

Adicionar em `app.js`:

```javascript
window.DEBUG = true;

// Uso em módulos:
if (window.DEBUG) {
  console.log("Debug info:", data);
}
```

---

## 11. Manutenção

### Backup de Dados

**Supabase Dashboard:**

1. Database → Backups
2. Habilitar backups automáticos diários

**Export Manual:**

```bash
# Via psql
pg_dump "postgresql://user:pass@db.supabase.co:5432/postgres" > backup.sql

# Ou via Supabase CLI
supabase db dump -f backup.sql
```

### Atualização de Dados

**Via Script Python:**

```bash
# Atualiza lotes_merged.json com novos dados
python _legacy/capture_and_vectorize.py

# Upload para Supabase
python scripts/upload_data_via_api.py
```

**Direto no Supabase:**

```sql
-- Exemplo: Atualizar valor do m²
UPDATE lotes 
SET valor_m2 = 5000 
WHERE zona = '3' AND setor = '661';
```

### Monitoramento

**Métricas para Acompanhar:**

- Tempo de carregamento inicial
- Taxa de erro em buscas
- Uso de storage (imagens)
- Queries lentas no Supabase

**Firebase Analytics:**

- Usuários ativos
- Páginas mais visitadas
- Eventos customizados

---

## 12. CI/CD (Futuro)

### GitHub Actions

**Exemplo de workflow:**

```yaml
name: Deploy to Firebase
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: npm install -g firebase-tools
      - run: firebase deploy --token ${{ secrets.FIREBASE_TOKEN }}
```

---

## 13. Troubleshooting Técnico

### "Failed to fetch" em Supabase

**Causa:** CORS ou credenciais incorretas

**Solução:**

- Verifique `SUPABASE_URL` e `SUPABASE_ANON_KEY`
- Confira se API não está bloqueada por Supabase Dashboard

### Edge Function retorna 500

**Causa:** Erro no código Deno ou secret não configurada

**Solução:**

```bash
# Ver logs
supabase functions logs enrich-data

# Redeploy
supabase functions deploy enrich-data
```

### Mapa não renderiza

**Causa:** Leaflet não carregou ou bounds inválidos

**Solução:**

- Verifique se CDN do Leaflet está acessível
- Confirme que `_lat` e `_lng` estão populados

### Upload de imagem retorna 413

**Causa:** Imagem muito grande

**Solução:**

- Redimensionar imagem antes do upload
- Aumentar limite no Supabase Storage

---

## 14. Extensões Futuras

### Analytics Completo

- Tabela `analytics_events`
- Dashboard com Chart.js
- Relatórios exportáveis

### Autenticação Multi-usuário

- Supabase Auth
- Permissões por papel (admin, corretor)
- RLS por usuário

### Notificações Push

- Firebase Cloud Messaging
- Notificar quando novo lead é compatível

### WhatsApp Integration

- Botão "Enviar no WhatsApp"
- Templates de mensagem

### Multi-tenant

- Suportar múltiplas cidades
- Schema separado por cidade ou filtro por coluna

---

## 📚 Referências

- [Supabase Docs](https://supabase.com/docs)
- [Leaflet Documentation](https://leafletjs.com/)
- [Firebase Hosting](https://firebase.google.com/docs/hosting)
- [RBush GitHub](https://github.com/mourner/rbush)
- [PostgreSQL Full-Text Search](https://www.postgresql.org/docs/current/textsearch.html)

---

**Fim do Manual Técnico**

Para suporte ou dúvidas, consulte a equipe de desenvolvimento.
