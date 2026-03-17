# API MapGuide - Guarujá

## Informações da Sessão

O sistema utiliza MapGuide Open Source com os seguintes parâmetros:

| Parâmetro | Valor |
|-----------|-------|
| Session ID | f8c3672a-e2dc-11f0-8000-00155dc26f0f_en_MTI3LjAuMC4x0AF20AF10AF0 |
| Map Name | MAPA_SITE |
| Web Agent | /mapserver2013/mapagent/mapagent.fcgi |
| Centro do Mapa | X: 375982.01, Y: 7352132.92 (UTM) |

## URL Base da API

A API MapGuide está disponível em:
**http://mapas.scimpmgsp.geometrus.com.br:8008/mapserver2013/mapagent/mapagent.fcgi**

## Funções JavaScript Disponíveis

O sistema expõe várias funções úteis para consulta de dados:

- **GetSessionId()** - Retorna o ID da sessão atual
- **GetMapName()** - Retorna o nome do mapa
- **GetSelectionXML()** - Retorna XML da seleção atual
- **SetSelectionXML()** - Define seleção via XML
- **GetScale()** - Retorna a escala atual
- **GetCenter()** - Retorna o centro do mapa (coordenadas UTM)
- **Selection()** - Função de seleção de features
- **PolygonSelection()** - Seleção por polígono

## Operações MapGuide Típicas

Para consultar features (lotes), podemos usar operações como:
- QUERYMAPFEATURES - Consulta features do mapa
- GETFEATUREINFO - Obtém informações de features
- SELECTFEATURES - Seleciona features por critério
.gitignore
