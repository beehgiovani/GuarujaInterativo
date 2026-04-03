#!/usr/bin/env python3
"""
Migração de Proprietários - Guarujá GeoMap
==========================================
Consolida proprietários duplicados usando CPF como chave única.

IMPORTANTE:
- Apenas unidades COM cpf_cnpj são processadas
- Unidades SEM cpf_cnpj permanecem inalteradas (proprietario_id = NULL)
- Script pode ser executado múltiplas vezes (UPSERT)
"""

import os
import json
from supabase import create_client, Client
from datetime import datetime

# ============================================
# CONFIGURAÇÃO
# ============================================
SUPABASE_URL = os.getenv('SUPABASE_URL', 'https://ijmgvsztgljribnogtsx.supabase.co')
# Fallback to the known publishable key if env var is not set
SUPABASE_KEY = os.getenv('SUPABASE_KEY') 

if not SUPABASE_KEY:
    print("❌ ERRO: Configure SUPABASE_KEY como variável de ambiente")
    print("   export SUPABASE_KEY='sua-service-role-key'")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ============================================
# FUNÇÕES AUXILIARES
# ============================================

def limpar_cpf_cnpj(doc):
    """Remove formatação de CPF/CNPJ"""
    if not doc:
        return None
    return ''.join(c for c in str(doc) if c.isdigit())

def detectar_tipo(cpf_cnpj):
    """Detecta se é PF (11 dígitos) ou PJ (14 dígitos)"""
    if not cpf_cnpj:
        return None
    limpo = limpar_cpf_cnpj(cpf_cnpj)
    if len(limpo) == 11:
        return 'PF'
    elif len(limpo) == 14:
        return 'PJ'
    return None

def extrair_campo_enrich(dados, campo, default=None):
    """Extrai campo do JSON de enriquecimento"""
    if not dados or not isinstance(dados, dict):
        return default
    return dados.get(campo, default)

# ============================================
# MIGRAÇÃO PRINCIPAL
# ============================================

def migrar_proprietarios():
    print("🚀 Iniciando migração de proprietários...")
    print("=" * 60)
    
    # 1. Buscar TODAS as unidades que TÊM cpf_cnpj (Com Paginação)
    print("\n📊 Buscando unidades com CPF/CNPJ...")
    unidades_com_cpf = []
    offset = 0
    limit = 1000 # Config to match typical server paging size to avoid gaps
    
    while True:
        print(f"   Buscando unidades {offset} a {offset+limit}...", end='\r')
        response = supabase.table('unidades').select(
            'inscricao, cpf_cnpj, nome_proprietario, dados_enrichment, last_enrichment_at, proprietario_id'
        ).not_.is_('cpf_cnpj', 'null').range(offset, offset + limit - 1).execute()
        
        batch = response.data
        if not batch:
            break
            
        unidades_com_cpf.extend(batch)
        
        # If we received fewer than the requested limit, we've reached the end.
        if len(batch) < limit:
            break
            
        offset += limit

    print(f"\n   ✅ Encontradas {len(unidades_com_cpf)} unidades com CPF/CNPJ (Total)")
    
    # 2. Agrupar por CPF único
    print("\n🔄 Agrupando por CPF único...")
    cpf_groups = {}
    
    for unidade in unidades_com_cpf:
        cpf_limpo = limpar_cpf_cnpj(unidade['cpf_cnpj'])
        if not cpf_limpo:
            continue
        
        if cpf_limpo not in cpf_groups:
            cpf_groups[cpf_limpo] = []
        cpf_groups[cpf_limpo].append(unidade)
    
    print(f"   ✅ Identificados {len(cpf_groups)} proprietários únicos")
    
    # 3. Preparar dados (In Memory) e processar em Lote
    print("\n📝 Preparando lotes de dados...")
    proprietarios_payload = []
    total_errors = 0
    
    for cpf, unidades in cpf_groups.items():
        primeira_unidade = unidades[0]
        dados_enrich = primeira_unidade.get('dados_enrichment') or {}
        enrich_final = dados_enrich.copy()
        enrich_final['last_unit_sync'] = datetime.now().isoformat()
        
        proprietario_data = {
            'cpf_cnpj': cpf,
            'nome_completo': primeira_unidade['nome_proprietario'] or 'Nome Desconhecido',
            'tipo': detectar_tipo(cpf),
            'dados_enrichment': enrich_final,
            'total_propriedades': len(unidades),
            'updated_at': datetime.now().isoformat()
        }
        proprietarios_payload.append(proprietario_data)

    # 4. Bulk Upsert Proprietários (Chunks de 500)
    print(f"\n🚀 Enviando {len(proprietarios_payload)} proprietários em lotes...")
    CHUNK_SIZE = 500
    for i in range(0, len(proprietarios_payload), CHUNK_SIZE):
        chunk = proprietarios_payload[i:i + CHUNK_SIZE]
        print(f"   Processando proprietários {i+1} a {min(i+CHUNK_SIZE, len(proprietarios_payload))}...", end='\r')
        try:
            supabase.table('proprietarios').upsert(chunk, on_conflict='cpf_cnpj').execute()
        except Exception as e:
            print(f"\n   ❌ Erro no lote {i}: {e}")
            total_errors += 1

    print("\n✅ Proprietários sincronizados.")

    # 5. Recuperar IDs para vincular (Mapa CPF -> ID)
    # Precisamos dos IDs gerados/existentes.
    # O jeito mais seguro é re-consultar tudo (ou confiar no return do upsert se coubesse na ram)
    print("\n🔗 Recuperando IDs para vinculação...")
    
    cpf_id_map = {}
    # Paginação para buscar todos os proprietários
    offset = 0
    limit = 1000
    while True:
        print(f"   Buscando mapa de IDs (Offset {offset})...", end='\r')
        resp = supabase.table('proprietarios').select('id, cpf_cnpj').range(offset, offset + limit - 1).execute()
        if not resp.data:
            break
            
        for p in resp.data:
            cpf_id_map[p['cpf_cnpj']] = p['id']
            
        if len(resp.data) < limit:
            break
        offset += limit
        
    print(f"\n   ✅ Mapa construído com {len(cpf_id_map)} proprietários.")

    # 6. Atualizar Unidades (Vinculação Segura via Update)
    print("\n📦 Analisando unidades para vinculação (Skipping already done)...")
    
    # --- CHECKPOINT SYSTEM ---
    CHECKPOINT_FILE = "migration_checkpoint.txt"
    
    def load_checkpoint():
        if os.path.exists(CHECKPOINT_FILE):
            try:
                with open(CHECKPOINT_FILE, 'r') as f:
                    return int(f.read().strip())
            except:
                return 0
        return 0

    def save_checkpoint(count):
        with open(CHECKPOINT_FILE, 'w') as f:
            f.write(str(count))

    # Carregar onde parou
    start_index = load_checkpoint()
    
    import concurrent.futures
    
    # Preparar tarefas: (owner_id, [lista_inscricoes])
    update_tasks = []
    skipped_units = 0
    
    for cpf, unidades in cpf_groups.items():
        owner_id = cpf_id_map.get(cpf)
        if owner_id:
            # FILTRO DE IDEMPOTÊNCIA: Apenas unidades que ainda não têm o proprietario_id correto
            inscricoes_to_update = [
                u['inscricao'] for u in unidades 
                if u.get('proprietario_id') != owner_id
            ]
            
            # Contabilizar quantos pulamos
            skipped_units += (len(unidades) - len(inscricoes_to_update))
            
            if inscricoes_to_update:
                update_tasks.append((owner_id, inscricoes_to_update))
    
    if skipped_units > 0:
        print(f"   ⏭️  Pulei {skipped_units} unidades que já estavam corretamente vinculadas.")
    
    total_tasks = len(update_tasks)
    print(f"   Processando {total_tasks} grupos de vinculação...")
    
    if start_index > 0:
        print(f"   ⏩ Retomando do grupo {start_index}...")

    def link_owner_units(task):
        oid, inscs = task
        # Tenta 3 vezes antes de desistir
        for attempt in range(3):
            try:
                # Update seguro (PATCH) - não apaga outros dados
                supabase.table('unidades').update({
                    'proprietario_id': oid
                }).in_('inscricao', inscs).execute()
                return True
            except Exception as e:
                # Se for o último, retorna o erro
                if attempt == 2:
                    return e
                # Senão, espera e tenta de novo
                time.sleep(1 * (attempt + 1))
        return False

    # Executar SEQUENCIALMENTE (Para estabilidade total)
    import time
    completed = 0
    
    for i, task in enumerate(update_tasks):
        # Pular se já foi processado
        if i < start_index:
            completed += 1
            continue

        result = link_owner_units(task)
        completed += 1
        
        # Loga de 100 em 100 para menos spam no terminal e SALVA CHECKPOINT
        if completed % 100 == 0:
            print(f"   Vinculado {completed}/{total_tasks} grupos...", end='\r')
            save_checkpoint(completed)
        
        if result is not True:
             print(f"\n   ❌ Erro em vinculação: {result}")
             total_errors += 1
             # Pausa maior em caso de erro
             time.sleep(1)
        else:
            # Pequeno throttle
            time.sleep(0.02)

    # Limpar checkpoint ao finalizar
    if os.path.exists(CHECKPOINT_FILE):
        os.remove(CHECKPOINT_FILE)

    print(f"\n✅ Vínculos concluídos.")
    
    # 4. Resumo
    print("\n" + "=" * 60)
    print("📊 RESUMO DA MIGRAÇÃO")
    print("=" * 60)
    print(f"✅ Proprietários processados: {len(proprietarios_payload)}")
    print(f"📦 Unidades vinculadas:      {len(update_tasks)} grupos")
    print(f"❌ Erros de vínculo:         {total_errors}")
    print("=" * 60)
    
    # 5. Verificar unidades SEM CPF (apenas para informação)
    print("\n🔍 Verificando unidades sem CPF...")
    resp_sem_cpf = supabase.table('unidades').select(
        'inscricao', count='exact'
    ).is_('cpf_cnpj', 'null').execute()
    
    total_sem_cpf = resp_sem_cpf.count if resp_sem_cpf.count else 0
    print(f"   ℹ️  {total_sem_cpf} unidades SEM CPF (permanecem inalteradas)")
    
    print("\n✅ Migração concluída com sucesso!")

# ============================================
# EXECUÇÃO
# ============================================

if __name__ == '__main__':
    try:
        migrar_proprietarios()
    except KeyboardInterrupt:
        print("\n\n⚠️  Migração interrompida pelo usuário")
    except Exception as e:
        print(f"\n\n❌ ERRO FATAL: {str(e)}")
        import traceback
        traceback.print_exc()
