# 🛠️ Funcionalidades - Visão Técnica (Developer)

Documentação das capacidades técnicas e integrações do motor **Guarujá GeoMap**.

## 1. GIS & Engine de Mapa
- **Leaflet Implementation**: Uso de layers hierárquicos para renderização progressiva.
- **RBush Spatial Indexing**: Busca de lotes no viewport em O(log n), permitindo interatividade com >10.000 polígonos.
- **UTM to WGS84 Translation**: Motor de conversão on-the-fly de coordenadas UTM (Sirgas 2000) para coordenadas geográficas.
- **Dynamic Labeling**: Sistema de etiquetas para bairros baseado em centróides calculados via Materialized Views.

## 2. Backend & Data (Supabase)
- **Unified Owner Schema**: Tabela `proprietarios` com unificação por CPF/CNPJ e suporte a relacionamentos (Sócio/Família).
- **Full-Text Search (FTS)**: Implementação de GIN indexes com `tsvector` para busca fonética e insensível a acentos em endereços e nomes.
- **Row Level Security (RLS)**: Políticas granulares para leitura pública e escrita autenticada.
- **Realtime Subscriptions**: Escuta ativa de inserções na tabela `notificacoes` para feedback visual instantâneo.

## 3. Automação e APIs Externas
- **Infosimples Proxy**: Edge Function em Deno que abstrai a complexidade do scraping de tribunais (TJSP, TRF, TRT, Receita).
- **API de Enriquecimento Enrichment**: Fluxo assíncrono para obtenção de contatos (phones/emails) via proxy seguro.
- **Email Monitor (Python/Cron)**: Robô autônomo IMAP que parseia e-mails de tribunais, extrai anexos e injeta no Supabase Storage.

## 4. UI/UX Architecture
- **Vanilla JS Modules**: Arquitetura desacoplada em handlers específicos (`search`, `tooltip`, `map`, `crm`, `notifications`).
- **Glassmorphic Toasts**: Sistema de notificações com CSS moderno e animações de entrada/saída.
- **Premium Modal Viewer**: Visualizador de certidões com suporte a iFrame de segurança e comando de impressão (`window.print`).
- **Image Gallery Engine**: Carrossel responsivo integrado ao Supabase Storage.

## 5. CRM & Business Logic
- **Matching Algorithm**: Query SQL otimizada para cruzar preferências de leads com atributos de unidades e lotes.
- **Lead Lifecycle**: Gestão de estado de leads persistida via PostgreSQL.
- **Analytics Engine**: Tracking de eventos client-side enviado para banco de dados para geração de relatórios de uso.

---
**Stack**: JS ES6+, Leaflet, Supabase (PG + Functions + Storage), Firebase (Hosting).
