
import json
import os

def clean_decimal(value_str):
    if not value_str:
        return 'NULL'
    if isinstance(value_str, (int, float)):
        return str(value_str)
    # Remove dots (thousands separators) and replace comma with dot
    clean = value_str.replace('.', '').replace(',', '.')
    try:
        return str(float(clean))
    except (ValueError, TypeError):
        return 'NULL'

def escape_string(val):
    if val is None:
        return 'NULL'
    val_str = str(val)
    # Escape single quotes by doubling them
    return "'" + val_str.replace("'", "''") + "'"

def main():
    json_path = os.path.join("mapa_interativo", "lotes_merged.json")
    output_path = "supabase_seed.sql"
    
    print(f"Lendo {json_path}...")
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"ERRO: Arquivo {json_path} não encontrado.")
        return

    print(f"Gerando {output_path}...")
    
    with open(output_path, 'w', encoding='utf-8') as sql:
        sql.write("-- SCRIPT DE POPULAÇÃO DE DADOS (SEED)\n")
        sql.write("-- Gerado automaticamente a partir de lotes_merged.json\n\n")
        
        # Disable constraints temporarily to speed up insertion if needed, 
        # but standard inserts are safer for data integrity checks.
        
        count_lotes = 0
        count_unidades = 0

        for lote in data:
            # --- Tabela LOTES ---
            inscricao = lote.get('inscricao')
            if not inscricao:
                continue

            meta = lote.get('metadata') or {}
            bounds = lote.get('bounds_utm') or {}
            
            val = {
                'inscricao': escape_string(inscricao),
                'zona': escape_string(meta.get('zona') or lote.get('zona')),
                'setor': escape_string(meta.get('setor') or lote.get('setor')),
                'lote_geo': escape_string(meta.get('lote') or lote.get('lote_geo')),
                'quadra': escape_string(meta.get('quadra')),
                'loteamento': escape_string(meta.get('loteamento')),
                'bairro': escape_string(meta.get('bairro')),
                'valor_m2': clean_decimal(meta.get('valor_m2')),
                'minx': str(bounds.get('minx', 'NULL')),
                'miny': str(bounds.get('miny', 'NULL')),
                'maxx': str(bounds.get('maxx', 'NULL')),
                'maxy': str(bounds.get('maxy', 'NULL'))
            }

            stmt_lote = (
                f"INSERT INTO lotes (inscricao, zona, setor, lote_geo, quadra, loteamento, bairro, valor_m2, minx, miny, maxx, maxy) "
                f"VALUES ({val['inscricao']}, {val['zona']}, {val['setor']}, {val['lote_geo']}, {val['quadra']}, "
                f"{val['loteamento']}, {val['bairro']}, {val['valor_m2']}, {val['minx']}, {val['miny']}, {val['maxx']}, {val['maxy']}) "
                f"ON CONFLICT (inscricao) DO NOTHING;\n"
            )
            sql.write(stmt_lote)
            count_lotes += 1

            # --- Tabela UNIDADES ---
            unidades = lote.get('unidades', [])
            for un in unidades:
                un_inscricao = un.get('inscricao')
                if not un_inscricao:
                    continue

                u_val = {
                    'inscricao': escape_string(un_inscricao),
                    'lote_inscricao': escape_string(inscricao),
                    'nome_proprietario': escape_string(un.get('nome_proprietario')),
                    'cpf_cnpj': escape_string(un.get('cpf_cnpj')),
                    'logradouro': escape_string(un.get('rua')),  # JSON key is 'rua'
                    'numero': escape_string(un.get('numero')),
                    'complemento': escape_string(un.get('complemento')),
                    'bairro_unidade': escape_string(un.get('bairro')),
                    'cep': escape_string(un.get('cep')),
                    'endereco_completo': escape_string(un.get('endereco')),
                    
                    'metragem': clean_decimal(un.get('metragem')),
                    'valor_venal': clean_decimal(un.get('valor_venal')),
                    'valor_venal_edificado': clean_decimal(un.get('valor_venal_edificado')),
                    
                    'descricao_imovel': escape_string(un.get('descricao_imovel')),
                    'status_processamento': escape_string(un.get('status_processamento'))
                }

                stmt_un = (
                    f"INSERT INTO unidades (inscricao, lote_inscricao, nome_proprietario, cpf_cnpj, logradouro, numero, complemento, bairro_unidade, cep, endereco_completo, metragem, valor_venal, valor_venal_edificado, descricao_imovel, status_processamento) "
                    f"VALUES ({u_val['inscricao']}, {u_val['lote_inscricao']}, {u_val['nome_proprietario']}, {u_val['cpf_cnpj']}, "
                    f"{u_val['logradouro']}, {u_val['numero']}, {u_val['complemento']}, {u_val['bairro_unidade']}, {u_val['cep']}, "
                    f"{u_val['endereco_completo']}, {u_val['metragem']}, {u_val['valor_venal']}, {u_val['valor_venal_edificado']}, "
                    f"{u_val['descricao_imovel']}, {u_val['status_processamento']}) "
                    f"ON CONFLICT (inscricao) DO NOTHING;\n"
                )
                sql.write(stmt_un)
                count_unidades += 1

    print(f"Concluído!")
    print(f"- Lotes processados: {count_lotes}")
    print(f"- Unidades processadas: {count_unidades}")
    print(f"Arquivo gerado: {os.path.abspath(output_path)}")

if __name__ == "__main__":
    main()
.gitignore
