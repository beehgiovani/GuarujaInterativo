
import json
import os
import requests
import time

# Configuration
SUPABASE_URL = 'https://ijmgvsztgljribnogtsx.supabase.co'
SUPABASE_KEY = 'sb_publishable_tHrPQdJlE9sOPkAr_muBlQ_bGDx8pxU' # Anon key provided by user

HEADERS = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal,resolution=merge-duplicates' # UPSERT: Update if exists
}

def clean_data(item):
    """Deep clean dictionary, handling Units and linking to existing Lotes"""
    inscricao = item.get('inscricao')
    if not inscricao: return None, []
    
    # 1. SKIP "Lote Header" records (ending in 000) from this JSON
    # The JSON contains "shell" records for lots (000) which lack metadata.
    # We only want to import the UNIDADES (001, 002...) and link them to existing Lots.
    if inscricao.endswith('000'):
        return None, []

    # helper for floats
    def to_float(v):
        if not v: return None
        if isinstance(v, (int, float)): return v
        clean = str(v).replace('.', '').replace(',', '.')
        try: return float(clean)
        except: return None
    
    # helper for string truncation
    def truncate(text, length):
        if not text: return None
        s = str(text)
        return s[:length] if len(s) > length else s
    
    lote_obj = None
    unidades_objs = []
    
    # Parse as UNIT
    # Derive parent lote: Remove the last 3 digits to match the 8-digit Format in DB.
    # Ex: 00039011001 (Unit) -> 00039011 (Lote Parent)
    parent_inscricao = inscricao[:-3]
    
    unidades_objs.append({
        'inscricao': inscricao,
        'lote_inscricao': parent_inscricao,
        'nome_proprietario': item.get('nome_proprietario'),
        'cpf_cnpj': truncate(item.get('cpf_cnpj'), 20),
        'logradouro': item.get('rua'),
        'numero': truncate(item.get('numero'), 20),
        'complemento': item.get('complemento'),
        'bairro_unidade': item.get('bairro'),
        'cep': truncate(item.get('cep'), 15),
        'endereco_completo': item.get('endereco'),
        'metragem': to_float(item.get('metragem')),
        'valor_venal': to_float(item.get('valor_venal')),
        'valor_venal_edificado': to_float(item.get('valor_venal_edificado')),
        'descricao_imovel': item.get('descricao_imovel'),
        'status_processamento': truncate(item.get('status_processamento'), 50),
        'proprietario_id': None # Ensure key definition for batch consistency
    })

    return lote_obj, unidades_objs

def deduplicate_batch(batch, pk_field):
    """Remove duplicates from batch keeping the last occurrence"""
    seen = set()
    unique_batch = []
    # Reverse to keep last? Or just keep first?
    # Usually in data processing "last update wins", so let's keep valid one.
    # But for a batch insert, we just need ANY valid one unique.z
    # Let's use a dict to dedupe by PK
    deduped = {}
    for item in batch:
        pk = item.get(pk_field)
        if pk:
            deduped[pk] = item
            
    return list(deduped.values())

def upload_batch(table, batch):
    # Specify conflict target to enable UPSERT
    # For 'lotes', pk is 'inscricao'. For 'unidades', pk is 'inscricao'.
    
    # DEDUPLICATION STEP
    pk_field = 'inscricao' 
    batch = deduplicate_batch(batch, pk_field)
    
    if not batch:
        return True

    url = f"{SUPABASE_URL}/rest/v1/{table}?on_conflict=inscricao"
    try:
        response = requests.post(url, headers=HEADERS, json=batch, timeout=60)
        if response.status_code not in [200, 201]:
            print(f"Erro ao inserir em {table}: {response.status_code} - {response.text}")
            return False
        return True
    except Exception as e:
        print(f"Exceção ao inserir em {table}: {e}")
        return False

def save_checkpoint(index):
    try:
        with open("upload_checkpoint.txt", "w") as f:
            f.write(str(index))
    except:
        pass

def load_checkpoint():
    if os.path.exists("upload_checkpoint.txt"):
        try:
            with open("upload_checkpoint.txt", "r") as f:
                return int(f.read().strip())
        except:
            return 0
    return 0

def check_field_lengths(batch, table_name):
    """Debug helper to find violating fields"""
    # Define limits based on schema
    limits = {
        'lotes': {
            'inscricao': 20, 'zona': 10, 'setor': 10, 'lote_geo': 10
        },
        'unidades': {
            'inscricao': 20, 'lote_inscricao': 20, 'cpf_cnpj': 20, 'numero': 20, 'cep': 15
        }
    }
    
    table_limits = limits.get(table_name, {})
    
    for i, item in enumerate(batch):
        for field, max_len in table_limits.items():
            val = item.get(field)
            if val and len(str(val)) > max_len:
                print(f"[DEBUG] VIOLATION in record index {i}: Field '{field}' has value '{val}' (len {len(str(val))}) > {max_len}")

def sync_owners_and_get_ids(unidades_batch):
    """
    Extract owners from units, upsert to 'proprietarios', and return mapping {cpf: id}.
    """
    owners_map = {} # cpf -> name
    
    # 1. Extract unique owners
    for u in unidades_batch:
        cpf = u.get('cpf_cnpj')
        name = u.get('nome_proprietario')
        
        if cpf and name and len(cpf) > 0:
            # Simple cleaning for CPF
            cpf_clean = "".join(filter(str.isdigit, str(cpf)))
            if cpf_clean:
                # Update map (latest name wins)
                owners_map[cpf_clean] = name.strip()
                # Update unit with clean cpf temporarily
                u['cpf_cnpj'] = cpf_clean

    if not owners_map:
        return {}

    # 2. Prepare Batch
    owners_batch = [{'cpf_cnpj': k, 'nome_completo': v, 'tipo': 'PF' if len(k) <= 11 else 'PJ'} for k, v in owners_map.items()]
    
    # 3. Upsert and Get IDs
    url = f"{SUPABASE_URL}/rest/v1/proprietarios?on_conflict=cpf_cnpj"
    # Special header to return data
    headers = HEADERS.copy()
    headers['Prefer'] = 'return=representation,resolution=merge-duplicates'
    
    try:
        print(f"Sincronizando {len(owners_batch)} proprietários...", end='\r')
        response = requests.post(url, headers=headers, json=owners_batch, timeout=60)
        if response.status_code in [200, 201]:
            saved_owners = response.json()
            # 4. Build Map {cpf: id}
            id_map = {o['cpf_cnpj']: o['id'] for o in saved_owners}
            return id_map
        else:
            print(f"\nErro sync proprietarios: {response.text}")
            return {}
    except Exception as e:
        print(f"\nExceção sync proprietarios: {e}")
        return {}

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.dirname(script_dir)
    
    # Priority paths for the data file
    search_paths = [
        os.path.join(root_dir, "_legacy", "lotes_merged.json"),
        os.path.join(root_dir, "mapa_interativo", "lotes_merged.json"),
        os.path.join(os.getcwd(), "lotes_merged.json"),
        os.path.join(os.getcwd(), "output_processed.json"),
    ]
    
    json_path = None
    for path in search_paths:
        if os.path.exists(path):
            json_path = path
            break
            
    if not json_path:
        print("ERRO: Nenhum arquivo de dados encontrado!")
        print("Caminhos verificados:")
        for p in search_paths:
            print(f"  - {p}")
        return

    print(f"Lendo {json_path}...")
    
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    start_index = load_checkpoint()
    if start_index > 0:
        print(f"Retomando do índice {start_index}...")
        
    lotes_batch = []
    unidades_batch = []
    
    # Reduzido para 100 para evitar timeout/disconnect no sync de proprietários
    BATCH_SIZE = 100 
    
    print(f"Iniciando upload de {len(data)} registros via API...")
    
    for i, item in enumerate(data):
        if i < start_index:
            continue
            
        lote, unidades = clean_data(item)
        if lote:
            lotes_batch.append(lote)
        if unidades:
            unidades_batch.extend(unidades)
        
        
        if len(lotes_batch) >= BATCH_SIZE:
            print(f"Enviando lote de LOTES {i}...", end='\r')
            if not upload_batch('lotes', lotes_batch):
                print("\nErro no upload de LOTES. Verificando campos...")
                check_field_lengths(lotes_batch, 'lotes')
                return 
            lotes_batch = []
            time.sleep(0.5) # Throttle
            
        if len(unidades_batch) >= BATCH_SIZE:
            # Prepare dependent lotes first if any pending
            if lotes_batch:
                print(f"Forçando envio de {len(lotes_batch)} LOTES pendentes antes das UNIDADES...", end='\r')
                if not upload_batch('lotes', lotes_batch):
                    return
                lotes_batch = []
                time.sleep(0.5)
            
            # --- OWNER SYNC LOGIC ---
            print(f"Sincronizando proprietários da remessa {i}...", end='\r')
            cpf_id_map = sync_owners_and_get_ids(unidades_batch)
            
            # Link Units to Owners
            linked_count = 0
            for u in unidades_batch:
                cpf = u.get('cpf_cnpj')
                if cpf and cpf in cpf_id_map:
                    u['proprietario_id'] = cpf_id_map[cpf]
                    linked_count += 1
            
            print(f"Enviando lote de UNIDADES {i} (Vínculos: {linked_count}/{len(unidades_batch)})...", end='\r')
            if not upload_batch('unidades', unidades_batch):
                print("\nErro no upload de UNIDADES. Verificando campos...")
                check_field_lengths(unidades_batch, 'unidades')
                return
            unidades_batch = []
            
            # Save checkpoint
            save_checkpoint(i + 1)
            time.sleep(0.5) # Throttle

    # Final batches
    if lotes_batch:
        upload_batch('lotes', lotes_batch)
    if unidades_batch:
        # Sync final batch owners
        cpf_id_map = sync_owners_and_get_ids(unidades_batch)
        for u in unidades_batch:
            cpf = u.get('cpf_cnpj')
            if cpf and cpf in cpf_id_map:
                u['proprietario_id'] = cpf_id_map[cpf]
                
        upload_batch('unidades', unidades_batch)
        
    print("\nUpload concluído com sucesso!")
    # Clear checkpoint on success
    if os.path.exists("upload_checkpoint.txt"):
        os.remove("upload_checkpoint.txt")

if __name__ == "__main__":
    main()
