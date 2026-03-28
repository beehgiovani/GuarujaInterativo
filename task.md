# 📋 Plano de Trabalho - GuaruGeo

## 🚀 Próximos Passos (Ação Requerida)

- [ ] **Deploy Geral**: Fazer deploy de todas as migrations e funções.

## 🛠️ O Que Foi Feito Hoje (Prospecção de Leads)

### 1. Sistema de Prospecção (Anúncios)

- [x] **Schema**: Tabelas `anuncios` e `anuncios_notifications` criadas e
      corrigidas (Link via `inscricao`).
- [x] **Backend**: Serviço `anuncios_sync.py` implementado para sincronizar
      ofertas.
- [x] **Frontend (Tooltip)**:
  - [x] Botão "Leads" no cabeçalho.
  - [x] Painel Flutuante (Separado do corpo principal).
  - [x] Badge contador de ofertas.
  - [x] Correção de Erros de Carregamento (JS Order).

### 2. Polimento Final e Documentação

- [x] **UI Premium**: Painel flutuante com bordas arredondadas e efeito blur
      (Glassmorphism).
- [x] **Limpeza**: Remoção de scripts temporários de debug.
- [x] **Documentação**: Atualização do Manual do Usuário e Técnico.
- [x] **Schema**: `SCHEMA_COMPLETO_V2.sql` atualizado.

### 3. Automação Jurídica (Anterior)

- [x] **PGFN & Certidões**: Backend e visualizador corrigidos.
- [x] **Notificações**: Sistema de sininho realtime implementado.

### 4. Inteligência Farol Preditivo (Diferenciação)

- [x] **Diferenciar Oportunidades**:
  - [x] Classificar perfis como "Vendedores" (Concentração/Inventário) ou "Compradores" (Aquisições recentes).
  - [x] Atualizar UI de busca para filtrar por tipo de oportunidade.
  - [x] Ajustar algoritmo de scoring para refletir as duas categorias.

### 5. Estética e Branding

- [x] Analyze existing plan definitions and permission logic
- [x] Verify plan-based restrictions
- [x] Verify individual credit purchase logic
- [x] Fix logout functionality
- [x] Audit and Fix Owner Privacy Leaks (Data Masking)
    - [x] `search_handler.js`: Mask owner names in search results
    - [x] `gemini_chat_handler.js`: Mask owner data in AI tool results
    - [x] `streetview_handler.js`: Mask owner info in Street View infobox
    - [x] `history_handler.js`: Mask owner names in "Recently Viewed" history
    - [x] `enrichment_handler.js`: Secure `showFullDetails` with permission check
    - [x] `portfolio_handler.js`: Verify Elite-only restriction
    - [x] `proprietario_tooltip.js`: Audit visibility logic
# 📋 Plano de Trabalho - GuaruGeo

## 🚀 Próximos Passos (Ação Requerida)

- [ ] **Deploy Geral**: Fazer deploy de todas as migrations e funções.

## 🛠️ O Que Foi Feito Hoje (Prospecção de Leads)

### 1. Sistema de Prospecção (Anúncios)

- [x] **Schema**: Tabelas `anuncios` e `anuncios_notifications` criadas e
      corrigidas (Link via `inscricao`).
- [x] **Backend**: Serviço `anuncios_sync.py` implementado para sincronizar
      ofertas.
- [x] **Frontend (Tooltip)**:
  - [x] Botão "Leads" no cabeçalho.
  - [x] Painel Flutuante (Separado do corpo principal).
  - [x] Badge contador de ofertas.
  - [x] Correção de Erros de Carregamento (JS Order).

### 2. Polimento Final e Documentação

- [x] **UI Premium**: Painel flutuante com bordas arredondadas e efeito blur
      (Glassmorphism).
- [x] **Limpeza**: Remoção de scripts temporários de debug.
- [x] **Documentação**: Atualização do Manual do Usuário e Técnico.
- [x] **Schema**: `SCHEMA_COMPLETO_V2.sql` atualizado.

### 3. Automação Jurídica (Anterior)

- [x] **PGFN & Certidões**: Backend e visualizador corrigidos.
- [x] **Notificações**: Sistema de sininho realtime implementado.

### 4. Inteligência Farol Preditivo (Diferenciação)

- [x] **Diferenciar Oportunidades**:
  - [x] Classificar perfis como "Vendedores" (Concentração/Inventário) ou "Compradores" (Aquisições recentes).
  - [x] Atualizar UI de busca para filtrar por tipo de oportunidade.
  - [x] Ajustar algoritmo de scoring para refletir as duas categorias.

### 5. Estética e Branding

- [x] Analyze existing plan definitions and permission logic
- [x] Verify plan-based restrictions
- [x] Verify individual credit purchase logic
- [x] Fix logout functionality
- [x] Audit and Fix Owner Privacy Leaks (Data Masking)
    - [x] `search_handler.js`: Mask owner names in search results
    - [x] `gemini_chat_handler.js`: Mask owner data in AI tool results
    - [x] `streetview_handler.js`: Mask owner info in Street View infobox
    - [x] `history_handler.js`: Mask owner names in "Recently Viewed" history
    - [x] `enrichment_handler.js`: Secure `showFullDetails` with permission check
    - [x] `portfolio_handler.js`: Verify Elite-only restriction
    - [x] `proprietario_tooltip.js`: Audit visibility logic
- [x] Implement persistence for owner enrichment
- [ ] Final Codebase-wide Privacy Scan
- [ ] Create application preview
    - [ ] Start local server and capture recordings
    - [x] Final verification and walkthrough <!-- id: 11 -->
- [x] Force #app-container to top:0 to fix persistent gap <!-- id: 12 -->
- [x] Fix media_handler.js TypeError (getUrl -> getURI) <!-- id: 17 -->
- [x] Resolve Map ID vs Styles conflict in map_handler.js <!-- id: 18 -->
- [x] Migrate AutocompleteService to modern Places API (v1) <!-- id: 19 -->
- [x] Fix desktop close button overlap in layout.css <!-- id: 20 -->
- [x] Optimize OSM resilience for 504 Gateway Timeouts <!-- id: 21 -->
- [ ] Capture "User" flow (Restricted)
- [ ] Capture "Master" flow (Professional/Clean)

## 7. Branding Profisisonal (LinkedIn & CV)
- [x] Gerar novo currículo e bio.
- [x] Aplicar em 10 vagas no LinkedIn (SysManager, PicPay, TOTVS, etc).
- [/] Aplicar em 10 vagas externas (Indeed/Gupy).
- [/] Gerar prints e mockups dos projetos (GuaruGeo, Cimed, Scrapers) para posts.

## 8. Mobile Optimization
- [ ] Otimizar formularios e tooltips para uso mobile.
- [ ] Corrigir race condition entre Landing Page e Login.

## 9. Auth & Registro (Manual Approval)
- [ ] Auditoria do sistema de cadastro.
- [ ] Implementar gate de aprovação manual para novos usuários.

---

## 🌎 Futuras Expansões

- [x] **Mantendo Foco no Guarujá**:
  - [x] Remover seletor de cidades da UI.
  - [x] Garantir que a busca continua vinculada ao banco (Guarujá).
  - [x] Validar linkagem de busca Google -> Lote via coordenada.
- [x] **Correção de Visibilidade do Autocomplete**:
  - [x] Adicionar biblioteca de componentes estendidos do Google Maps.
  - [x] Ajustar estilos CSS para garantir que o componente seja visível.
  - [x] Verificar inicialização no `search_handler.js`.

**Status Final**: Sistema consolidado no Guarujá. Busca híbrida (Google + Supabase) operacional. 🚀
