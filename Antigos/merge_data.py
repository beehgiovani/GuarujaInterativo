
import json
import os

def merge():
    print("Loading geometry data (lotes.json)...")
    lotes_path = 'mapa_interativo/lotes.json'
    if not os.path.exists(lotes_path):
        lotes_path = 'lotes_vetorizados.json'
        
    with open(lotes_path, 'r', encoding='utf-8') as f:
        lotes_geo = json.load(f)
        
    print("Loading detailed data (_saida_imoveis.json)...")
    with open('_saida_imoveis.json', 'r', encoding='utf-8') as f:
        saida_imoveis = json.load(f)
        
    # Group details by first 8 digits
    grouped = {}
    for item in saida_imoveis:
        insc = item.get('inscricao')
        if not insc or len(insc) < 8:
            continue
        
        # Use first 8 characters as key
        key = insc[:8]
        if key not in grouped:
            grouped[key] = []
        grouped[key].append(item)
        
    print(f"Grouped detailed data into {len(grouped)} keys.")
    
    # Merge into geometry
    merged_count = 0
    for lote in lotes_geo:
        geo_insc = lote.get('inscricao')
        if not geo_insc:
            continue
            
        # The geo_insc might be 8 digits (e.g. 10089003)
        # We look it up in grouped
        if geo_insc in grouped:
            units = grouped[geo_insc]
            # sort units by full inscription
            units.sort(key=lambda x: x['inscricao'])
            
            lote['unidades'] = units
            
            # Enrich metadata with the "parent" info (usually the one ending in 000)
            # Find the parent or the first one
            parent = next((u for u in units if u['inscricao'].endswith('000')), units[0])
            
            if 'metadata' not in lote:
                lote['metadata'] = {}
            
            # Update metadata with some parent details if missing
            lote['metadata']['proprietario'] = parent.get('nome_proprietario')
            lote['metadata']['endereco_completo'] = parent.get('endereco')
            lote['metadata']['bairro'] = parent.get('bairro')
            lote['metadata']['valor_venal'] = parent.get('valor_venal')
            
            merged_count += 1
            
    print(f"Merged details into {merged_count} lots.")
    
    output_path = 'mapa_interativo/lotes_detalhados.json'
    print(f"Saving to {output_path}...")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(lotes_geo, f, ensure_ascii=False) # remove indent for smaller size
        
    print("Done.")

if __name__ == "__main__":
    merge()
.gitignore
