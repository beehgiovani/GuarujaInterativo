
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv('.env')
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

target_lote = "00012011"

print(f"🔍 Checking if Lote {target_lote} exists in 'lotes' table...")

try:
    res = supabase.table('lotes').select('*').eq('inscricao', target_lote).execute()
    if res.data:
        print(f"✅ Found Lote {target_lote}!")
        print(f"   UUID: {res.data[0]['id']}")
    else:
        print(f"❌ Lote {target_lote} NOT FOUND in Supabase!")
        
    # Also check the unit property that failed
    target_unit = "00012011013"
    print(f"\n🔍 Checking Unit {target_unit}...")
    res_unit = supabase.table('unidades').select('*').eq('inscricao', target_unit).execute()
    if res_unit.data:
         print(f"✅ Found Unit!")
         print(f"   lote_inscricao in Unit: {res_unit.data[0].get('lote_inscricao')}")
    else:
         print(f"❌ Unit NOT FOUND in Supabase")

except Exception as e:
    print(e)
