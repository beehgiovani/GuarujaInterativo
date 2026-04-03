
import os
import sys
from supabase import create_client, Client

# Config
SUPABASE_URL = os.getenv('SUPABASE_URL', 'https://ijmgvsztgljribnogtsx.supabase.co')
SUPABASE_KEY = os.getenv('SUPABASE_KEY') 

if not SUPABASE_KEY:
    print("Erro: SUPABASE_KEY nao definida")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def run_migration(file_path):
    print(f"Lendo migracao: {file_path}")
    with open(file_path, 'r', encoding='utf-8') as f:
        sql = f.read()
    
    # Split by statement if needed, or try running full block if supported via rpc
    # Supabase-py doesn't support raw SQL directly without RPC usually, unless we use postgres driver.
    # But wait, we might not have pure postgres driver installed.
    # Let's check if there is an 'exec_sql' function or similar exposed in the project, or use a workaround.
    
    # WORKAROUND: In many Supabase setups without direct SQL access from client, 
    # we rely on the dashboard. But here I should try to see if I can use a simpler approach.
    # Actually, the user might have to run this in the dashboard if I can't connect directly.
    
    print("⚠️ ATENCAO: A biblioteca padrao supabase-py nao executa SQL puro diretamente no client-side por seguranca.")
    print("   Se voce nao tiver uma RPC 'exec_sql' configurada, este script falhara.")
    print("   Tentando via RPC 'exec_sql' (comum em setups dev)...")

    try:
        response = supabase.rpc('exec_sql', {'query': sql}).execute()
        print("Resultado:", response)
    except Exception as e:
        print(f"RPC Falhou: {e}")
        print("\n>>> POR FAVOR: Copie o conteudo de 'database/migrations/13_create_neighborhood_view.sql' e execute no SQL Editor do Supabase.")

if __name__ == "__main__":
    run_migration("../database/migrations/13_create_neighborhood_view.sql")
