# Estrutura do Sistema de Geoprocessamento do Guarujá

## URLs Identificadas

O sistema utiliza uma arquitetura baseada em framesets com os seguintes componentes:

**Frame de Título:**
http://mapas.scimpmgsp.geometrus.com.br:8008/mapserver2013/guaruja/geo/titulo.html

**Frame Principal (ViewerFrame):**
http://mapas.scimpmgsp.geometrus.com.br:8008/mapserver2013/mapviewerphp/ajaxviewer.php?SESSION=f8c3672a-e2dc-11f0-8000-00155dc26f0f_en_MTI3LjAuMC4x0AF20AF10AF0&WEBLAYOUT=Library://GUARUJA/GEO_SITE/WEB/WEB_SITE.WebLayout

## Tecnologia Identificada

O sistema parece utilizar **MapGuide** ou tecnologia similar, baseado na estrutura de URLs com:
- SESSION parameter
- WEBLAYOUT parameter referenciando Library://
- ajaxviewer.php como visualizador

## Camadas Disponíveis
- Lotes
- Logradouros
- Cidade de Guarujá
- Foto Aérea - 2022
- Foto Aérea - 2012
- Foto Aérea - 2002

## Pesquisas Disponíveis
- Logradouros
- Cadastro do Imóvel

## Próximos Passos
1. Acessar o frame principal diretamente
2. Identificar endpoints de API para consulta de dados
3. Analisar requisições de rede para mapear as APIs
.gitignore
