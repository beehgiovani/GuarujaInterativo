# 🎯 Plano Estratégico: Expansão & Onboarding (Guarujá GeoMap)

Este documento detalha o planejamento para a próxima fase do projeto, focado em transformar o sistema em um produto de mercado de alto valor (SaaS) e expandir para plataformas nativas.

---

## 1. 🎓 User Onboarding (Ambientação e Valor)
O objetivo é que o corretor entenda o poder da ferramenta no primeiro minuto.

### Etapas do Tour Guiado (Intro.js):
- [x] **Passo 1: O "Voo"**: Demonstrar a busca por endereço ou edifício e o zoom automático.
- [x] **Passo 2: Perfil 360°**: Mostrar onde ficam os contatos (Phones/Emails) e o portfólio do dono.
- [x] **Passo 3: Jurídico sem Escada**: Demonstrar a solicitação de certidões em 1 clique.
- [x] **Passo 4: Sininho Inteligente**: Explicar a notificação real-time para documentos prontos.

### Materiais de Apoio:
- [ ] Criar playlist de "Micro-Training" (vídeos de 20s embutidos nos modais).
- [ ] Implementar "Checklist de Boas-Vindas" no painel lateral.

---

## 📱 2. Expansão Multi-Plataforma (App Mobile & Desktop)
Migrar de uma aba de navegador para um ícone no sistema do usuário.

### Mobile (React Native / Capacitor):
- [x] **Notificações Push**: Alertas de certidões diretamente na tela de bloqueio.
- [x] **Geolocalização**: Ver lotes ao redor com base no GPS do celular (uso em campo).
- [x] **Câmera Integrada**: Foto da fachada direto do celular para o Supabase Storage.

### Desktop (Electron):
- [x] **Auto-Start**: Iniciar com o Windows/Mac (Configurado no `package.json`).
- [x] **Modo Janela**: Funcionar como um dashboard fixo na segunda tela do corretor (`electron-main.js`).

---

## 🤖 3. Inteligência de Mercado (Monopólio de Dados)
Aumentar o ticket médio através de funções que ninguém no mercado possui.

- [x] **Heatmap de Interesse**: Mapa de calor mostrando as áreas mais buscadas no sistema.
- [x] **GuaruBot (AI Assistant)**: Chatbot que responde consultas complexas (ex: *"Quem são os top 10 proprietários da Enseada?"*).
- [x] **Integração Total**: Acesso total a ia, certidões, links, localizações, fotos, documentos, proprietarios, etc. todo o nosso sql nas mãos da ia.
- [x] **Gerador de Contratos**: Preenchimento automático de contratos de venda e autorizações com dados do proprietário + imóvel e cliente selecionado para estar tudo encaixado pronto só imprimir e assinar, ou assinar digitalmente.
- [x] **Radar de Renovação**: Notificar corretor quando uma certidão baixada há 90 dias expirar.

---

## 💰 4. Proposta de Valor e Precificação (SaaS)
*Estratégia focada na exclusividade total dos dados cadastrais do Guarujá.*

### Venda de Ativo (Exclusividade):
- **Range:** R$ 250k - R$ 400k (Venda da tecnologia + base de dados consolidada para investidor/rede).

### Modelos de Licenciamento (Mensal):
1. **Plano Individual (Corretor)**: R$ 397/mês.
2. **Plano imobiliária (Time até 10)**: R$ 1.297/mês.
3. **Plano Master (Redes/Franquias)**: Sob consulta + taxas por consulta API.

---

## 🚀 Próximas Implementações (Checklist)
- [ ] Escolher biblioteca de Tour (Intro.js ou Shepherd.js).
- [ ] Estruturar projeto base em React Native para portabilidade.
- [ ] Criar Mockup do Dashboard de Analytics (Heatmap).

---
**Status:** 📅 Agendado para execução futura.
**Foco:** Transformar dados em faturamento recorrente.
