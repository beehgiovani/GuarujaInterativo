
import json

def analyze():
    print("Loading lotes.json...")
    try:
        with open('mapa_interativo/lotes.json', 'r', encoding='utf-8') as f:
            lotes_geo = json.load(f)
    except FileNotFoundError:
        with open('lotes_vetorizados.json', 'r', encoding='utf-8') as f:
            lotes_geo = json.load(f)
            
    print(f"Loaded {len(lotes_geo)} geo lotes.")
    
    print("Loading _saida_imoveis.json...")
    with open('_saida_imoveis.json', 'r', encoding='utf-8') as f:
        saida_imoveis = json.load(f)
    print(f"Loaded {len(saida_imoveis)} saida records.")
    
    # Create a map of shortened inscription to list of details
    # The user says: 10089003000 is parent, 10089003001 is child.
    # The common prefix is 10089003 (8 digits).
    
    grouped = {}
    
    for item in saida_imoveis:
        insc = item.get('inscricao')
        if not insc:
            continue
        
        # Assuming the first 8 digits are the lot identifier
        if len(insc) >= 8:
            short_insc = insc[:8]
            if short_insc not in grouped:
                grouped[short_insc] = []
            grouped[short_insc].append(item)
            
    # Check intersections
    geo_map = {}
    for l in lotes_geo:
        i = l.get('inscricao')
        if i:
            geo_map[i] = l
            
    print(f"Geo lots with matches in data: {len(set(geo_map.keys()) & set(grouped.keys()))}")
    
    # Show an example of hierarchy
    example_key = "10089003"
    if example_key in grouped:
        print(f"\nExample for {example_key}:")
        items = grouped[example_key]
        print(f"Total items: {len(items)}")
        for it in items[:5]:
            print(f" - {it['inscricao']}: {it.get('nome_lote')} ({it.get('descricao_imovel')})")
    else:
        # Find another example
        for k, v in grouped.items():
            if len(v) > 2:
                print(f"\nExample for {k}:")
                for it in v[:5]:
                    print(f" - {it['inscricao']}: {it.get('nome_lote')}")
                break

if __name__ == "__main__":
    analyze()
.gitignore
