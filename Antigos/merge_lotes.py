import json
import sys

print("Carregando lotes.json...")
with open('mapa_interativo/lotes.json', 'r', encoding='utf-8') as f:
    lotes_basic = json.load(f)

print(f"Carregados {len(lotes_basic)} lotes básicos")

print("\nCarregando lotes_detalhados.json...")
with open('mapa_interativo/lotes_detalhados.json', 'r', encoding='utf-8') as f:
    lotes_detailed = json.load(f)

print(f"Carregados {len(lotes_detailed)} lotes detalhados")

# Create a map of inscricao -> detailed data
print("\nCriando índice de lotes detalhados...")
detailed_map = {}
for lote in lotes_detailed:
    inscricao = lote.get('inscricao')
    if inscricao:
        detailed_map[inscricao] = lote

# Merge detailed data into basic lotes
print("\nMesclando dados...")
merged_count = 0
for lote in lotes_basic:
    inscricao = lote.get('inscricao')
    if inscricao and inscricao in detailed_map:
        detailed = detailed_map[inscricao]
        
        # Merge unidades if they exist in detailed
        if 'unidades' in detailed:
            lote['unidades'] = detailed['unidades']
        
        # Merge any other fields from detailed that don't exist in basic
        for key, value in detailed.items():
            if key not in lote and key != 'inscricao':
                lote[key] = value
        
        merged_count += 1

print(f"Mesclados {merged_count} lotes com dados detalhados")

# Save merged data
print("\nSalvando lotes_merged.json...")
with open('mapa_interativo/lotes_merged.json', 'w', encoding='utf-8') as f:
    json.dump(lotes_basic, f, ensure_ascii=False, indent=2)

print(f"\n✓ Arquivo mesclado salvo: mapa_interativo/lotes_merged.json")
print(f"  Total de lotes: {len(lotes_basic)}")
print(f"  Lotes com dados detalhados: {merged_count}")
.gitignore
