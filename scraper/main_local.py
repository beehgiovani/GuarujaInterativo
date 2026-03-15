"""
Main Scraper Orchestrator (Local Mode)
Uses Serper API - Google results without blocking
"""
import database as db
from sources import serper_scraper
import time

# Initialize
db.init_db()

def process_queue(batch_size=10, logger_callback=None, zone=None, neighborhood=None):
    """
    Process addresses in queue
    logger_callback: function(message, type='info')
    zone: str or int (0-6) - Filter by first digit of inscricao (Legacy)
    neighborhood: str - Filter by bairro
    """
    def log(msg, type='info'):
        print(msg)
        if logger_callback:
            logger_callback(msg, type)

    # Get pending addresses (filtering at SQL level)
    pending = db.get_pending_addresses(limit=1000, neighborhood=neighborhood)
    
    # Filter by Zone (Legacy support)
    if zone is not None and str(zone) != "" and not neighborhood:
        zone_str = str(zone)
        log(f"🔎 Filtering by Zone {zone_str}", 'info')
        pending = [p for p in pending if p['inscricao'].startswith(zone_str)]
    
    # Apply batch limit
    pending = pending[:batch_size]
    
    if not pending:
        if neighborhood:
             log(f"⚠️ No addresses found for {neighborhood} in queue", 'warning')
        else:
             log("⚠️ No addresses in queue", 'warning')
        return 0
    
    log(f"\n🚀 Processing {len(pending)} addresses...\n", 'info')
    
    processed = 0
    for addr in pending:
        inscricao = addr['inscricao']
        logradouro = addr['logradouro']
        numero = addr['numero']
        bairro = addr['bairro']
        
        log(f"📍 Processing: {inscricao} - {logradouro} {numero}", 'info')
        
        # Mark as processing
        import sqlite3
        conn = sqlite3.connect(db.DB_PATH)
        cursor = conn.cursor()
        cursor.execute('UPDATE address_queue SET status = ? WHERE inscricao = ?', ('processing', inscricao))
        conn.commit()
        conn.close()
        
        # Run Serper API scraper
        try:
            results = serper_scraper.search_property_serper(logradouro, numero, bairro, inscricao)
            
            if results:
                log(f"✅ Found {len(results)} matches for {inscricao}", 'success')
                for result in results:
                    db.save_scraped_property(result)
                    db.log_scraping(inscricao, 'serper', 'success', f"Found {len(results)} matches")
            else:
                log(f"⚠️ No matches found for {inscricao}", 'warning')
                db.log_scraping(inscricao, 'serper', 'no_results', 'No matches found')
            
            # Mark as completed
            conn = sqlite3.connect(db.DB_PATH)
            cursor = conn.cursor()
            cursor.execute('UPDATE address_queue SET status = ?, last_scraped_at = CURRENT_TIMESTAMP WHERE inscricao = ?', ('completed', inscricao))
            conn.commit()
            conn.close()
            
            processed += 1
            
        except Exception as e:
            log(f"❌ Error scraping {inscricao}: {e}", 'error')
            db.log_scraping(inscricao, 'serper', 'error', str(e))
            
            # Mark as failed
            conn = sqlite3.connect(db.DB_PATH)
            cursor = conn.cursor()
            cursor.execute('UPDATE address_queue SET status = ? WHERE inscricao = ?', ('failed', inscricao))
            conn.commit()
            conn.close()
        
        # Rate limiting
        time.sleep(2)
    
    print(f"\n✅ Processed {processed}/{len(pending)} addresses")
    return processed

if __name__ == '__main__':
    print("=" * 60)
    print("🏠 Property Scraper - Local Mode")
    print("=" * 60)
    
    # Process queue
    num_processed = process_queue(batch_size=10)
    
    if num_processed > 0:
        print("\n" + "=" * 60)
        print(f"✅ Scraping complete!")
        print(f"   - Processed: {num_processed} addresses")
        print(f"\n🌐 Open http://localhost:5001 to review results")
        print(f"   Run: cd web && python app.py")
        print("=" * 60)
