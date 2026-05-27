# Rules Universais

As regras estão separadas em duas camadas:

- `gerais`: valem para qualquer projeto deste workspace e devem ser consideradas universais.
- `projetos`: valem para um produto específico e complementam as regras gerais.

## Ordem de leitura obrigatória

1. `gerais/00-protocolo-global.md`
2. `gerais/01-arquitetura-e-higiene.md`
3. `gerais/02-seguranca-dados-observabilidade.md`
4. `gerais/03-performance-qualidade-frontend.md`
5. `gerais/04-inicio-de-projeto.md`
6. `gerais/05-checklist-decisao-entrega.md`
7. `projetos/<projeto>/00-visao-e-estrutura.md`
8. Demais regras específicas do projeto conforme o tipo de tarefa.

## Como decidir

- Segurança, privacidade e dados sensíveis sempre têm prioridade máxima.
- Regras de domínio do projeto prevalecem sobre preferências genéricas de implementação.
- Performance percebida pelo usuário é requisito de produto, não acabamento.
- Mudanças estruturais devem atualizar documentação e schema quando aplicável.

## Para projetos novos

Todo projeto novo deve começar com:

- leitura completa de `rules/gerais`;
- criação de `rules/projetos/<nome-do-projeto>`;
- cópia adaptada do template em `rules/projetos/_template`;
- definição explícita de domínio, stack, dados sensíveis, estrutura modular e critérios de qualidade;
- documentação do que é regra universal e do que é regra exclusiva do produto.
