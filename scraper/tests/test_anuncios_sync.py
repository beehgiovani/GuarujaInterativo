
import os
import sys

# Ensure we can import from local directory
sys.path.append(os.getcwd())

print("🧪 Starting Manual Sync Test")

try:
    print("1. Importing anuncios_sync...")
    import anuncios_sync
    print("   ✅ Import successful")
    
    # Check enviroment manually first
    from dotenv import load_dotenv
    load_dotenv()
    print(f"2. Check Env: SUPABASE_URL present? {'Yes' if os.getenv('SUPABASE_URL') else 'No'}")
    
    print("3. Testing sync function with dummy data...")
    test_data = {
        'inscricao': '1-0001-001-001',
        'title': 'TEST PROPERTY',
        'url': 'https://test.com/123',
        'source': 'test',
        'price': 100000,
        'match_score': 100
    }
    
    result = anuncios_sync.sync_property_to_anuncios(test_data)
    print(f"4. Sync Result: {result}")

except Exception as e:
    print(f"\n❌ FATAL ERROR: {e}")
    import traceback
    traceback.print_exc()
