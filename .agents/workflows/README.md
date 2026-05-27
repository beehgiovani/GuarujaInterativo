# Workflows e Rules Universais

Este diretório organiza a forma oficial de trabalho para qualquer projeto criado ou mantido neste workspace.

A pasta `rules/gerais` é a base universal: deve ser aplicada em todo projeto, independente de stack, tamanho ou domínio. As regras em `rules/projetos` existem apenas para complementar a base com particularidades de um produto específico.

## Estrutura

```txt
.agents/workflows/
  README.md
  rules/
    README.md
    gerais/
      00-protocolo-global.md
      01-arquitetura-e-higiene.md
      02-seguranca-dados-observabilidade.md
      03-performance-qualidade-frontend.md
      04-inicio-de-projeto.md
      05-checklist-decisao-entrega.md
    projetos/
      _template/
        00-visao-e-estrutura.md
      guarugeo/
        00-visao-e-estrutura.md
        01-cartografia-e-layer-engine.md
        02-inteligencia-territorial.md
        03-offline-mobile-field-mode.md
        04-security-ops.md
        05-anti-entropy.md
```

## Regra de uso

1. Leia primeiro as regras em `rules/gerais`.
2. Depois leia as regras do projeto em `rules/projetos/<nome-do-projeto>`.
3. Em caso de conflito, a regra mais específica do projeto prevalece, desde que não viole segurança, privacidade ou qualidade mínima.
4. Toda exceção técnica deve ser documentada com motivo, impacto e plano de revisão.
5. Para projeto novo, copie mentalmente a base `rules/gerais` como contrato obrigatório e crie uma pasta em `rules/projetos/<nome-do-projeto>` somente com as regras específicas daquele produto.

## Padrão de trabalho

- Escrever como Bruno Giovani: direto, humano, técnico e com contexto.
- Não trabalhar em modo "vibe code".
- Priorizar arquitetura limpa, baixa latência, rastreabilidade e manutenção de longo prazo.
- Manter documentação viva junto com as mudanças importantes.
- Antes de implementar, entender domínio, risco, dados sensíveis, fluxo crítico e impacto no usuário.
- Depois de implementar, validar build/testes possíveis e registrar o que não foi possível validar.
