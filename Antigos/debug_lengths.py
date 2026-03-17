
import json
import os

def main():
    json_path = os.path.join("mapa_interativo", "lotes_merged.json")
    print(f"Lendo {json_path}...")
    
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print("Verificando registros...")
    
    violations = []
    
    possible_cols = ['inscricao', 'lote_inscricao', 'cpf_cnpj', 'numero']
    
    for i, item in enumerate(data):
        # Check lotes (inscricao)
        if len(str(item.get('inscricao', ''))) > 20:
             violations.append(f"LOTE {i} inscricao > 20: {item.get('inscricao')}")
             
        # Check units
        for u in item.get('unidades', []):
            u_insc = u.get('inscricao', '')
            if len(str(u_insc)) > 20:
                violations.append(f"UNIT inscricao > 20: {u_insc}")
                
            lote_fk = item.get('inscricao') # Effectively lote_inscricao
            if len(str(lote_fk)) > 20:
                 violations.append(f"UNIT FK lote_inscricao > 20: {lote_fk}")

            # Note: We are already truncating numero and cpf_cnpj in the upload script, 
            # but let's see if there are any that are huge, which justifies the truncation.
            # Also checking if there are fields I missed.
            
    if violations:
        print(f"Encontradas {len(violations)} violações!")
        for v in violations[:20]:
            print(v)
    else:
         print("Nenhuma violação óbvia de 'inscricao' encontrada.")
         print("Verificando 'numero' e 'cpf_cnpj' originais (sem truncamento)...")
         # Check original data just to be sure what WAS causing it
         cnt_num = 0
         cnt_cpf = 0
         for item in data:
             for u in item.get('unidades', []):
                 if len(str(u.get('numero', ''))) > 20: cnt_num += 1
                 if len(str(u.get('cpf_cnpj', ''))) > 20: cnt_cpf += 1
         print(f"Originalmente: {cnt_num} numeros > 20, {cnt_cpf} cpfs > 20")

if __name__ == "__main__":
    main()
.gitignore
