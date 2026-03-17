# Estrutura de Dados do Lote - Guarujá

## Dados Identificados no Tooltip

A URL `https://scimpmgsp.geometrus.com.br/mctm_inscricoes/tooltip_prefeitura/inscricao:{codigo}` retorna os seguintes dados:

| Campo | Exemplo |
|-------|---------|
| **ZONA** | 3 |
| **SETOR** | 0661 |
| **LOTE** | 176 |
| **QUADRA** | - |
| **LOTEAMENTO** | 079 - BALNEARIO PRAIA DO PEREQUE |
| **Bairro** | PRAINHA BRANCA |
| **CÓD. LOGRAD.** | 038776 |
| **Valor M² Terreno** | R$ 91,13 |

## Código de Inscrição

O código de inscrição **30661176000** parece ser composto por:
- **3** = Zona
- **0661** = Setor
- **176** = Lote
- **000** = numeros colocados manulamente 

Formato: `{ZONA}{SETOR}{LOTE}{NUMERO}` = `3` + `0661` + `176` + `000` = `30661176000`

## API de Consulta

**URL Base:** `https://scimpmgsp.geometrus.com.br/mctm_inscricoes/tooltip_prefeitura/inscricao:{codigo}`

Esta API pode ser usada para obter dados de qualquer lote conhecendo seu código de inscrição.

## Próximos Passos

1. Identificar como obter a geometria (coordenadas) do polígono do lote
2. Criar script Python para extrair dados em massa
3. Implementar visualização em mapa gratuito (Folium/Leaflet)
.gitignore
