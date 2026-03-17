# Plano de Implementação: Melhorias Gratuitas & UX (V1.2)

Este documento descreve melhorias de alto impacto e custo zero (ou muito baixo)
para o **Guarugeo**, focando em experiência do usuário, performance e
ferramentas de vendas.

## 1. Contexto de Vizinhança (Dados Gratuitos via OpenStreetMap) (aprovado)

**Objetivo:** Enriquecer o tooltip do lote com pontos de interesse (escolas,
padarias, farmácias) sem usar a cota da Google Places API. **Como:** Utilizar a
**Overpass API** (OpenStreetMap) para buscar POIs (Points of Interest) ao redor
do lote.

- **Custo:** Gratuito (Community Server).
- **Implementação:**
  - Criar `osm_handler.js`.
  - Buscar num raio de 500m:
    `node["amenity"~"school|pharmacy|bakery"](around:500, lat, lon);`.
  - Exibir ícones no tooltip ("3 Farmácias a 200m").

## 2. Compartilhamento Inteligente (Deep Linking) (aprovado com restrições)

**Objetivo:** Permitir que o corretor envie um link do WhatsApp que abre o mapa
**exatamente** no lote e com o zoom correto. **Como:** Manipular a URL do
navegador. interessante somente se conseguir travar a visualização naquele lote,
sem poder buscar ou fazer qualquer outra coisa (o mapa é de exclusiva
visualização do corretor) então seria interessante mostrar somente o lote e
informações da unidade seelcionada a compartilhar

- **Funcionalidade:**
  - Ao clicar num lote, atualizar URL: `?lote=12345&lat=...&lng=...`.
  - Botão "Compartilhar no WhatsApp" no Tooltip que gera esse link.
  - Ao abrir o app, ler parâmetros da URL e disparar `flyTo` + `openTooltip`.

## 3. Análise Solar Básica (SunCalc)

**Objetivo:** Argumento de venda sobre "Sol da Manhã / Sol da Tarde". **Como:**
Usar a biblioteca leve `suncalc.js` (gratuita). interressantissimo !!!

- **Implementação:**
  - Calcular a posição do sol para a data atual.
  - Exibir no Tooltip: "Incidência Solar Prevista: Leste (Manhã)".
  - _Bônus (Visual):_ Desenhar um pequeno cone de sombra no mapa (Canvas
    overlay) estimando a sombra do prédio se tivermos a altura. a altura não
    teremos mas ja é bom sabor as informações referente ao sol da manha/tarde

## 5. Histórico de "Vistos Recentemente" (aprovado)

**Objetivo:** Ajudar o corretor a reencontrar lotes que ele clicou 5 minutos
atrás. **Como:** `localStorage` do navegador., muito bom !!!

- **UI:**
  - Uma pequena barra ou lista flutuante "Recentes".
  - Armazena os últimos 5 IDs de lotes clicados.

## 6. Filtro de Área Desenhável (Drawing Manager) (Ja aplicado)

**Objetivo:** "Cliente quer algo nesta região específica". **Como:** Google Maps
Drawing Library (já incluída na API JS padrão, uso básico gratuito).

- **Funcionalidade:**
  - Ferramenta "Lápis".
  - Usuário desenha um círculo ou polígono irregular.
  - Filtrar apenas lotes dentro desse polígono (usando
    `turf.booleanPointInPolygon`).

---

### Próximos Passos

Por favor, analise as sugestões acima. Recomendo começar pelo **Item 2
(Compartilhamento)** e **Item 5 (Histórico)** pois geram valor imediato para a
produtividade do corretor.
.gitignore
