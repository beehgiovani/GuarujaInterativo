"""
Fetch REAL addresses from Supabase to populate the queue
"""
import main
import database as db

# Initialize
db.init_db()

print("🔄 Fetching real addresses from Supabase...")
try:
    # Use the function from main.py
    count = main.fetch_addresses_from_supabase(limit=50)
    
    if count > 0:
        print(f"\n✅ Successfully added {count} real addresses from Supabase to the queue!")
        print("🚀 You can now run the scraper in the web interface.")
    else:
        print("\n⚠️ No 'pending' addresses found in Supabase (all might have images already).")
        
except Exception as e:
    print(f"\n❌ Error fetching from Supabase: {e}")
