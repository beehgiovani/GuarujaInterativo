# Descoberta Importante - API de Dados de Lotes

## Tooltip URL Identificada

A consulta QUERYMAPFEATURES retorna um tooltip que contém um iframe com URL para dados do lote:

```
https://scimpmgsp.geometrus.com.br/mctm_inscricoes/tooltip_prefeitura/inscricao:30661176
```

Esta URL parece conter o código de inscrição do imóvel (30661176), que provavelmente é composto por:
- **Zona** + **Setor** + **Quadra** + **Lote** + sufixo

## Estrutura do Response XML

```xml
<FeatureInformation>
  <FeatureSet>
    <Layer id="aa6ea8cc-e2dd-11f0-8004-00155dc26f0f">
      <Class id="Default:Lotes">
        <ID>ZVEAAA==</ID>
      </Class>
    </Layer>
  </FeatureSet>
  <Tooltip>
    <iframe src="https://scimpmgsp.geometrus.com.br/mctm_inscricoes/tooltip_prefeitura/inscricao:30661176">
  </Tooltip>
</FeatureInformation>
```

## Próximos Passos

1. Acessar a URL do tooltip para ver os dados completos do lote
2. Identificar como obter a geometria (coordenadas) do lote
3. Mapear a estrutura Zona/Setor/Quadra/Lote
.gitignore
