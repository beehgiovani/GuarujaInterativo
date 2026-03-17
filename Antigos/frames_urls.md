# Frames e URLs do Sistema MapGuide - Guarujá

## Frames Identificados

O sistema utiliza uma estrutura de framesets com os seguintes componentes:

| Frame | URL |
|-------|-----|
| tbFrame (toolbar) | http://mapas.scimpmgsp.geometrus.com.br:8008/mapserver2013/mapviewerphp/toolbar.php?LOCALE=en |
| mapFrame | http://mapas.scimpmgsp.geometrus.com.br:8008/mapserver2013/mapviewerphp/mapframe.php?MAPDEFINITION=Library://GUARUJA/GEO_SITE/MAPA/MAPA_SITE.MapDefinition&... |
| formFrame | http://mapas.scimpmgsp.geometrus.com.br:8008/mapserver2013/mapviewerphp/formframe.php |
| scriptFrame | http://mapas.scimpmgsp.geometrus.com.br:8008/mapserver2013/viewerfiles/blank.html |
| taskBar | http://mapas.scimpmgsp.geometrus.com.br:8008/mapserver2013/mapviewerphp/taskbar.php?LOCALE=en |
| taskFrame | http://mapas.scimpmgsp.geometrus.com.br:8008/mapserver2013/mapviewerphp/taskframe.php?WEBLAYOUT=Library://GUARUJA/GEO_SITE/WEB/WEB_SITE.WebLayout&... |
| sbFrame (statusbar) | http://mapas.scimpmgsp.geometrus.com.br:8008/mapserver2013/mapviewerphp/statusbar.php?LOCALE=en |

## Parâmetros Importantes

**SESSION:** f8c3672a-e2dc-11f0-8000-00155dc26f0f_en_MTI3LjAuMC4x0AF20AF10AF0

**MAPDEFINITION:** Library://GUARUJA/GEO_SITE/MAPA/MAPA_SITE.MapDefinition

**WEBLAYOUT:** Library://GUARUJA/GEO_SITE/WEB/WEB_SITE.WebLayout

## Próximos Passos

O frame **mapFrame** é onde está o mapa e provavelmente contém as APIs para consulta de features (lotes). Precisamos analisar as requisições HTTP que o sistema faz para obter dados dos lotes.
.gitignore
