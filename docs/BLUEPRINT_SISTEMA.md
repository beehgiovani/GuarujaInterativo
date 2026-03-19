# 📐 Blueprint do Sistema - Guarujá GeoMap

**Versão da Blueprint:** 2.0 (Pós-Unificação de Proprietários)
**Data:** 26/01/2026

Este documento serve como a **Constituição do Projeto**. Qualquer nova alteração, refatoração ou funcionalidade deve respeitar os princípios e a arquitetura aqui descritos.

---

## 1. Visão Geral da Arquitetura

O Guarujá GeoMap é um sistema de Inteligência Imobiliária Geográfica (GIS) focado em alta performance e experiência de usuário premium.

*   **Frontend:** Vanilla JS (ES6 Modules) + Leaflet (Mapas) + Supabase Client. Sem frameworks pesados (React/Angular) para manter a leveza.
*   **Backend:** Supabase (PostgreSQL) como BaaS.
*   **Enriquecimento:** API de Enriquecimento (via Edge Function) e Geoprocessamento local.

---

## 2. Regras de Ouro (Golden Rules) ⚠️

1.  **Não Quebre a Simplicidade:** Use JavaScript nativo sempre que possível. Evite adicionar bibliotecas npm pesadas sem necessidade absoluta.
2.  **Proprietários são Únicos:**
    *   **NUNCA** confie apenas no nome para identificar donos. O CPF/CNPJ (`cpf_cnpj` na tabela `proprietarios`) é a chave única.
    *   Toda lógica de vínculo deve tratar *Race Conditions* (erros 409) usando `try/catch` e fallback.
3.  **Busca Insensível a Acentos:**
    *   Sempre use a coluna `nome_busca` (normalizada) e o operador `ilike` para buscar proprietários.
    *   **NUNCA** dependa de configuração de dicionário (`fts`) exclusivamente para nomes próprios.
4.  **Geometrias Persistentes:**
    *   Desenhos no mapa (linhas de mar, POIs) devem ser salvos na tabela `referencias_geograficas`.
5.  **Offline-First (Cache):**
    *   Dados pesados (lotes) devem usar `IndexedDB` (via `map_handler.js`). Sempre verifique o cache antes de bater na rede.
6.  **Notificações & Realtime:**
    *   Toda ação assíncrona (certidões, enriquecimento) deve gerar uma entrada na tabela `notificacoes`.
    *   O frontend deve escutar eventos `INSERT` em tempo real para disparar o "balão" (Toast) e atualizar o sininho.
7.  **UX de Documentos:**
    *   Sempre use o visualizador HTML dedicado para certidões enviadas por órgãos governamentais para garantir legibilidade e facilitar impressão.

---

## 3. Estado Atual do Banco de Dados

O arquivo fonte da verdade é `database/SCHEMA_COMPLETO_V2.sql`.

### Tabelas Principais

| Tabela | Função | Chave Primária | Notas |
| :--- | :--- | :--- | :--- |
| `lotes` | Dados geográficos e prediais | `inscricao` | Base do mapa. Contém coordenadas UTM convertidas. |
| `unidades` | Apartamentos/Casas | `inscricao` | FK `lote_inscricao`. Agora tem FK `proprietario_id`. |
| `proprietarios` | Pessoas Físicas/Jurídicas | `id` | **Centralizador de dados**. Contém JSON `dados_enrichment` (API de Enriquecimento). |
| `referencias_geograficas` | Desenhos manuais | `id` | Guarda GeoJSON de marcações (Mar, Pontos). |
| `analytics_events` | Rastreamento | `id` | Logs de busca e visualização. |

### Fluxo de Unificação (Sync)

O sistema possui uma ferramenta de **Sincronização em Massa** (`window.runFullOwnerSync()`) e scripts (`migrate_proprietarios.py`) que:
1.  Varre unidades com CPF mas sem `proprietario_id`.
2.  Cria ou encontra o proprietário na tabela `proprietarios`.
3.  Vincula e copia dados de enriquecimento (Backfill) gratuitamente.
4.  **Idempotência:** Scripts agora ignoram registros já vinculados para performance.

---

## 4. Princípios de Navegação e Visualização

### 4.1 Hierarquia de Zoom (Imersão)
A navegação deve sempre seguir o funil: **Cidade (Zonas) → Setor → Lote**.
*   Ao pesquisar ou clicar em um proprietário, o mapa executa um `flyTo` sequencial para dar contexto geográfico ao usuário.
*   Centralizado em `window.navigateToInscricao`.

### 4.2 Camadas de Calor (Heatmaps)
*   **Zona Fiscal:** Visão técnica/prefeitura.
*   **Bairros Imobiliários:** Visão comercial baseada em `vw_bairros_centroids`.
*   As cores dos lotes devem respeitar o modo ativo (`window.isNeighborhoodMode`).

---

## 5. Guia de Desenvolvimento

### Adicionar Nova Busca
Para adicionar um novo filtro de busca:
1.  Edite `search_handler.js`.
2.  Adicione a lógica no `performSearch`.
3.  **SEMPRE** normalize a string de entrada e trate conectores (ex: "DE", "DA") para buscas de nomes longos.

### Adicionar Nova Ferramenta de Mapa
1.  Edite `map_handler.js`.
2.  Inicialize controles no `initMap`.
3.  Garanta que o CSS (`index.html`) tenha `z-index` correto (Tooltips > Backdrop > Sidebar).

---

## 6. Próximos Passos (Roadmap)

1.  **Módulo de Vendas:** Implementar fluxos de contrato e propostas em unidades específicas.
2.  **Controle de Captação:** Tracking de unidades "Captar" com prioridade no mapa.
3.  **CRM Upgrade:** Pipelines de vendas e funil de conversão.
4.  **Integração WhatsApp:** Disparo direto de mensagens enriquecidas para donos.

---

*Este Blueprint deve ser consultado antes de qualquer Pull Request ou alteração estrutural.*
pelo contrario, reclamei a noite toda e minha esposa reclamou tanto quanto, porem preferi beber para não encher meu saco 
 