# 📋 Checklist de Implementação - Guarujá GeoMap

Este checklist acompanha o progresso da migração para o sistema real de Monetização e Autenticação.

## 1. 🔐 Autenticação & Segurança (Auth)
- [x] Criar `auth_handler.js` para integração com Supabase Auth.
- [x] Implementar tela de Login Real (E-mail/Senha).
- [x] Implementar Fluxo de **Solicitação de Acesso** (Cadastro de novos usuários).
- [x] Configurar RLS (Row Level Security) no Supabase (Proteção de dados por usuário).
- [ ] Ativar confirmação de e-mail no painel do Supabase (Opcional).

## 2. 🪙 Sistema de Monetização (Créditos)
- [x] Criar tabelas `profiles` e `credit_transactions`.
- [x] Criar RPC `add_credits` para gestão de saldo.
- [x] Implementar `monetization_handler.js` com suporte a consumo de créditos.
- [x] Criar interface de **Recarga via Pix** (Simulada).
- [ ] Implementar Edge Function para Pix Real (API Bancária: Efi/Inter/Celcoin).
- [ ] Implementar Webhook de confirmação automática de pagamento.

## 3. 🏢 Funcionalidades Geográficas & Dados
- [x] **Banco de Dados Particular (Multi-Verdade):** Edições de usuários salvam em camada separada.
- [x] **Painel de Curadoria Admin:** Admin visualiza e aprova edições da comunidade.
- [ ] **Integração Pix Real:** Mudar de simulação para API bancária real.
- [x] **Relatórios Customizados:** Usuário exporta suas próprias notas em PDF.
- [x] **Informação Mascarada:** Mostrar apenas parte do nome para usuários sem créditos.
- [x] **Botão "Adquirir Ficha":** Desbloqueio de dados completos via crédito.

## 4. 🛠️ Painel Administrativo
- [x] Interface de Admin para gestão de usuários.
- [x] Ferramenta de **Injeção de Créditos** manual pelo Admin.
- [x] Log de Atividades global (Quem consultou o quê).

## 5. 🚀 Estabilidade & Deploy
- [x] Deploy Firebase Hosting.
- [x] Ajuste de Visibilidade (Correção da "Tela em Branco").
- [ ] Teste de carga com base de dados de 50k lotes.

---
*Ultima atualização: 14/03/2026 03:00 (Fase Premium UI Concluída)*
