"""
Main Scraper Orchestrator
Fetches addresses from Supabase and runs scrapers
"""
from supabase import create_client
from config import SUPABASE_URL, SUPABASE_KEY
import database as db
from sources import olx_scraper
import time

# Initialize
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
db.init_db()

def get_distinct_neighborhoods():
    """Fetch distinct neighborhoods from Supabase"""
    print("📡 Fetching neighborhoods from Supabase...")
    try:
        response = supabase.table('unidades').select('bairro_unidade').execute()
        
        # Normalize: Upper case, strip, ignore empty
        neighborhoods = set()
        for u in response.data:
            bairro = u.get('bairro_unidade')
            if bairro and isinstance(bairro, str) and bairro.strip():
                neighborhoods.add(bairro.strip().upper())
                
        return sorted(list(neighborhoods))
    except Exception as e:
        print(f"❌ Error fetching neighborhoods: {e}")
        return []

def fetch_addresses_from_supabase(limit=50, neighborhood=None):
    """Fetch unidades without images/data from Supabase (Pagination support)"""
    print("📡 Fetching addresses from Supabase...")
    
    try:
        all_units = []
        offset = 0
        batch_size = 1000  # Max supabase limit per request usually
        
        while True:
            query = supabase.table('unidades').select(
                'inscricao, logradouro, numero, bairro_unidade, imagens'
            )
            
            if neighborhood:
                query = query.eq('bairro_unidade', neighborhood)
            
            # Fetch batch
            print(f"   🔄 Fetching batch offset={offset}, limit={batch_size}...")
            response = query.range(offset, offset + batch_size - 1).execute()
            batch = response.data
            
            batch_count = len(batch) if batch else 0
            print(f"   📦 Batch received: {batch_count} records")
            
            if not batch:
                print("   ⏹️ No more records in batch.")
                break
                
            all_units.extend(batch)
            offset += len(batch)
            print(f"   📈 Total accumulated so far: {len(all_units)}")
            
            # If we got less than batch_size, we reached the end
            if len(batch) < batch_size:
                print("   ✅ Reached end of results (batch < limit).")
                break
                
            # Safety break for huge datasets during dev (optional, remove for prod)
            if offset > 20000: 
                print("⚠️ Safety limit reached (20k)")
                break

        print(f"   Retrieved total {len(all_units)} candidates in neighborhood")
        
        # Filter units without images
        units = [u for u in all_units if not u.get('imagens') or len(u.get('imagens', [])) == 0]
        print(f"✅ Found {len(units)} units needing enrichment")
        
        # Add to queue
        count = 0
        for unit in units:
            db.add_to_queue(
                unit['inscricao'],
                unit['logradouro'] or '',
                unit['numero'] or '',
                unit['bairro_unidade'] or ''
            )
            count += 1
        
        return count
        
    except Exception as e:
        print(f"❌ Error fetching from Supabase: {e}")
        return 0

def process_queue(batch_size=10):
    """Process addresses in queue"""
    pending = db.get_pending_addresses(batch_size)
    
    if not pending:
        print("⚠️ No addresses in queue")
        return 0
    
    print(f"\n🚀 Processing {len(pending)} addresses...\n")
    
    processed = 0
    for addr in pending:
        inscricao = addr['inscricao']
        logradouro = addr['logradouro']
        numero = addr['numero']
        bairro = addr['bairro']
        
        print(f"\n{'='*60}")
        print(f"📍 {inscricao} - {logradouro} {numero}, {bairro}")
        print(f"{'='*60}")
        
        # Run SERPER scraper
        try:
            # Note: serper_scraper.search_property returns a list of result objects
            from sources import serper_scraper
            results = serper_scraper.search_property(logradouro, numero, bairro, inscricao)
            
            if results:
                print(f"✅ Found {len(results)} matches for {inscricao}")
                for result in results:
                    db.save_scraped_property(result)
                    db.log_scraping(inscricao, 'serper', 'success', f"Found {len(results)} matches")
            else:
                print(f"⚠️ No matches found for {inscricao}")
                db.log_scraping(inscricao, 'serper', 'no_results', 'No matches found')
            
            processed += 1
            
        except Exception as e:
            print(f"❌ Error scraping {inscricao}: {e}")
            db.log_scraping(inscricao, 'serper', 'error', str(e))
        
        # Rate limiting
        time.sleep(2)
    
    print(f"\n✅ Processed {processed}/{len(pending)} addresses")
    return processed

if __name__ == '__main__':
    print("=" * 60)
    print("🏠 Property Scraper - Starting...")
    print("=" * 60)
    
    # Step 1: Fetch from Supabase
    num_fetched = fetch_addresses_from_supabase(limit=20)
    
    if num_fetched > 0:
        # Step 2: Process queue
        num_processed = process_queue(batch_size=5)
        
        print("\n" + "=" * 60)
        print(f"✅ Scraping complete!")
        print(f"   - Fetched: {num_fetched} addresses")
        print(f"   - Processed: {num_processed} addresses")
        print(f"\n🌐 Open http://localhost:5001 to review results")
        print("=" * 60)
    else:
        print("\n⚠️ No addresses to process. All units already have data.")
