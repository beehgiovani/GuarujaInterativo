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

- [x] **Refinamento Premium**:
  - [x] Integrar logotipos no Sidebar e Login.
  - [x] Melhorar sombras e efeitos de glassmorphism (Layout).
  - [x] Polir transições e estados de hover.

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
