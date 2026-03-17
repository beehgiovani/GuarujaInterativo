import json
import os

try:
    with open('lotes_vetorizados.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    total = len(data)
    undefined_count = 0
    undefined_sector_count = 0
    
    zones_found = {}

    for item in data:
        if not item: continue
        meta = item.get('metadata')
        if not meta: meta = {}
        
        zona = meta.get('zona')
        setor = meta.get('setor')

        if not zona:
            undefined_count += 1
        else:
            zones_found[zona] = zones_found.get(zona, 0) + 1

        if not setor:
            undefined_sector_count += 1

    print(f"Total de Lotes: {total}")
    print(f"Zonas Indefinidas (sem info): {undefined_count}")
    print(f"Setores Indefinidos: {undefined_sector_count}")
    print("-" * 30)
    print("Zonas Encontradas:")
    for z, count in sorted(zones_found.items()):
        print(f"  Zona {z}: {count} lotes")

except Exception as e:
    print(f"Erro: {e}")
.gitignore
