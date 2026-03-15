"""
Flask Web Interface for Property Review
"""
import sys
import os
# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
import database as db
import sync
import threading
import sys
from datetime import datetime

# Import main_local to run scraper
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import main_local

app = Flask(__name__)
CORS(app)

# Status tracking
scraper_status = {
    'is_running': False,
    'progress': 0,
    'total': 0,
    'message': 'Idle',
    'logs': []
}

def add_log(message, type='info'):
    """Add log message to status"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    scraper_status['logs'].append({
        'time': timestamp,
        'message': message,
        'type': type
    })
    # Keep last 100 logs
    if len(scraper_status['logs']) > 100:
        scraper_status['logs'].pop(0)

# Old functions replaced at bottom of file
# Keeping file clean
pass

@app.route('/api/scraper_status')
def api_scraper_status():
    """Get current scraper status"""
    return jsonify(scraper_status)


@app.route('/')
def index():
    """Main dashboard"""
    return render_template('index.html')

@app.route('/api/pending')
def get_pending():
    """Get properties pending review with pagination"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        min_match = request.args.get('min_match', 0, type=int)
        
        result = db.get_pending_reviews(page=page, per_page=per_page, min_match=min_match)
        properties = result['properties']
        
        # Optimize: Fetch all current unit data in one batch
        if properties:
            inscricoes = [p['inscricao'] for p in properties if p.get('inscricao')]
            
            if inscricoes:
                # Remove duplicates for query
                unique_inscricoes = list(set(inscricoes))
                
                try:
                    from sync import supabase
                    # Fetch in batch
                    unit_response = supabase.table('unidades').select('*').in_('inscricao', unique_inscricoes).execute()
                    units_data = unit_response.data or []
                    
                    # Create lookup dict
                    units_map = {u['inscricao']: u for u in units_data}
                    
                    # Attach to properties
                    for prop in properties:
                        inscricao = prop.get('inscricao')
                        prop['current_data'] = units_map.get(inscricao, {})
                        
                except Exception as e:
                    print(f"❌ Error fetching batch from Supabase: {e}")
                    # Fallback to empty context on error, don't crash
                    for prop in properties:
                        prop['current_data'] = {}
            else:
                for prop in properties:
                    prop['current_data'] = {}
        
        return jsonify({
            'success': True, 
            'properties': properties,
            'pagination': {
                'total': result['total'],
                'page': result['page'],
                'total_pages': result['total_pages']
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/approve/<int:prop_id>', methods=['POST'])
def approve_property(prop_id):
    """Approve property and sync to Supabase anuncios table"""
    try:
        # Mark as approved in local DB
        db.approve_property(prop_id)
        
        # Get property data
        props = db.get_approved_properties()
        prop_to_sync = next((p for p in props if p['id'] == prop_id), None)
        
        if not prop_to_sync:
            return jsonify({'success': False, 'error': 'Property not found'}), 404
        
        # Sync to Supabase ANUNCIOS table (not unidades!)
        try:
            import anuncios_sync
            print(f"🔄 Syncing property {prop_id} to anuncios...")
            
            # Force match_score to 100 for manual approval to trigger notification
            prop_to_sync['match_score'] = 100
            
            print(f"  Data: {prop_to_sync}")
            success = anuncios_sync.sync_property_to_anuncios(prop_to_sync)
            
            if success:
                db.mark_synced(prop_id)
                return jsonify({'success': True, 'message': 'Anúncio sincronizado como lead de prospecção!'})
            else:
                print(f"❌ Sync function returned False")
                return jsonify({'success': False, 'error': 'Sync to anuncios failed - check server logs'}), 500
                
        except Exception as sync_error:
            print(f"❌ Exception during sync: {sync_error}")
            import traceback
            traceback.print_exc()
            return jsonify({'success': False, 'error': f'Sync exception: {str(sync_error)}'}), 500
        
    except Exception as e:
        print(f"❌ General error in approve_property: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/reject/<int:prop_id>', methods=['POST'])
def reject_property(prop_id):
    """Reject property"""
    try:
        db.reject_property(prop_id)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/stats')
def get_stats():
    """Get scraping statistics"""
    try:
        import sqlite3
        conn = sqlite3.connect(db.DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute('SELECT COUNT(*) FROM scraped_properties WHERE status = ?', ('pending',))
        pending = cursor.fetchone()[0]
        
        cursor.execute('SELECT COUNT(*) FROM scraped_properties WHERE status = ?', ('approved',))
        approved = cursor.fetchone()[0]
        
        cursor.execute('SELECT COUNT(*) FROM scraped_properties WHERE synced_at IS NOT NULL')
        synced = cursor.fetchone()[0]
        
        conn.close()
        
        return jsonify({
            'success': True,
            'stats': {
                'pending': pending,
                'approved': approved,
                'synced': synced
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/neighborhoods')
def api_get_neighborhoods():
    """Get list of distinct neighborhoods"""
    import main
    try:
        # Cache this? For now fetch fresh.
        neighborhoods = main.get_distinct_neighborhoods()
        return jsonify(neighborhoods)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/queue')
def api_queue():
    """Get next items in queue"""
    limit = request.args.get('limit', 30, type=int)
    zone = request.args.get('zone')
    neighborhood = request.args.get('neighborhood')
    
    pending = db.get_pending_addresses(limit=100 if (zone or neighborhood) else limit, neighborhood=neighborhood)
    
    # Zone filtering (if needed)
    if zone and not neighborhood:
         pending = [p for p in pending if p['inscricao'].startswith(str(zone))]
         
    pending = pending[:limit]
    return jsonify(pending)

def run_scraper_thread(limit, zone=None, neighborhood=None):
    """Run scraper in background thread"""
    global scraper_status
    scraper_status['is_running'] = True
    scraper_status['message'] = 'Starting scraper...'
    scraper_status['logs'] = []
    
    filter_msg = ""
    if neighborhood:
        filter_msg = f" (Bairro: {neighborhood})"
    elif zone:
        filter_msg = f" (Zone {zone})"
        
    add_log(f"🚀 Starting scrape job for {limit} addresses{filter_msg}", 'info')
    
    try:
        # If neighborhood selected, try to populate queue from Supabase mostly to be safe
        import main
        if neighborhood:
            add_log(f"📡 Syncing properties for {neighborhood} from Supabase...", 'info')
            count = main.fetch_addresses_from_supabase(neighborhood=neighborhood)
            if count > 0:
                add_log(f"✅ Added {count} new addresses to queue", 'success')
            else:
                add_log(f"ℹ️ No new addresses found on Supabase for this neighborhood (or error)", 'info')
        
        # Then process
        processed = main_local.process_queue(
            batch_size=limit, 
            logger_callback=add_log, 
            zone=zone,
            neighborhood=neighborhood
        )
        
        scraper_status['message'] = f'Completed! Processed {processed} properties'
        add_log(f"✅ Job complete. Processed {processed} properties.", 'success')
    except Exception as e:
        scraper_status['message'] = f'Error: {str(e)}'
        add_log(f"❌ Critical error: {str(e)}", 'error')
        print(f"Scraper thread error: {e}")
    finally:
        scraper_status['is_running'] = False

@app.route('/api/run_scraper', methods=['POST'])
def api_run_scraper():
    """Start the scraper process"""
    global scraper_status
    
    if scraper_status['is_running']:
        return jsonify({'status': 'error', 'message': 'Scraper already running'}), 400
    
    data = request.json or {}
    limit = int(data.get('limit', 10))
    zone = data.get('zone')
    neighborhood = data.get('neighborhood')
    
    thread = threading.Thread(target=run_scraper_thread, args=(limit, zone, neighborhood))
    thread.daemon = True
    thread.start()
    
    return jsonify({'status': 'success', 'message': 'Scraper started'})

@app.route('/api/sync_queue', methods=['POST'])
def api_sync_queue():
    """Sync queue from Supabase for a specific neighborhood"""
    data = request.json or {}
    neighborhood = data.get('neighborhood')
    
    if not neighborhood:
        return jsonify({'status': 'error', 'message': 'Neighborhood required'}), 400
        
    try:
        import main
        count = main.fetch_addresses_from_supabase(neighborhood=neighborhood)
        return jsonify({
            'status': 'success', 
            'message': f'Synced {count} new addresses',
            'count': count
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

if __name__ == '__main__':
    # Initialize database
    db.init_db()
    
    print("🚀 Starting review interface at http://localhost:5001")
    app.run(debug=True, port=5001)
