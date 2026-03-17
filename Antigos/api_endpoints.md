# Endpoints da API MapGuide - Guarujá

## URLs Identificadas

| Endpoint | URL |
|----------|-----|
| Web Agent | /mapserver2013/mapagent/mapagent.fcgi |
| Feature Request | /mapserver2013/mapviewerphp/getselectedfeatures.php |

## Operação QUERYMAPFEATURES

A função `QueryFeatureInfo` mostra como fazer consultas de features:

```
OPERATION=QUERYMAPFEATURES
VERSION=1.0.0
PERSIST=1
MAPNAME=MAPA_SITE
SESSION={sessionId}
LAYERNAMES=Lotes
GEOMETRY={geometria WKT}
SELECTIONVARIANT=INTERSECTS
MAXFEATURES={número}
```

## Session ID Atual
a90b6a6a-e2dd-11f0-8000-00155dc26f0f_en_MTI3LjAuMC4x0AF20AF10AF0

## Próximos Passos

1. Testar a API getselectedfeatures.php para obter dados de features
2. Identificar os campos disponíveis (Zona, Setor, Lote, geometria)
3. Criar script Python para automação
.gitignore
