"""
Database Module - SQLite staging database for scraped data
"""
import sqlite3
import json
import os
from datetime import datetime
from typing import Optional, List, Dict

DB_PATH = 'scraper/scraped_data.db'

def init_db():
    """Initialize SQLite database with required tables"""
    # Ensure directory exists
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Scraped properties table (enhanced with more fields)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS scraped_properties (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            inscricao TEXT,
            source TEXT NOT NULL,
            url TEXT,
            title TEXT,
            description TEXT,
            
            -- Legacy/compatibility fields
            price REAL,
            area REAL,
            bedrooms INTEGER,
            bathrooms INTEGER,
            suites INTEGER,
            parking INTEGER,
            images_json TEXT,
            features_json TEXT,
            
            -- Enhanced Unidades fields
            complemento TEXT,
            quartos INTEGER,
            suites_new INTEGER,
            banheiros INTEGER,
            vagas INTEGER,
            area_util REAL,
            area_total REAL,
            valor_real REAL,
            cod_ref TEXT,
            caracteristicas_json TEXT,
            imagens_list_json TEXT,
            
            -- Address matching
            scraped_address TEXT NOT NULL,
            unit_logradouro TEXT,
            unit_numero TEXT,
            unit_bairro TEXT,
            match_score INTEGER,
            
            -- Status
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            synced_at TIMESTAMP
        )
    ''')
    
    # Address queue table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS address_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            inscricao TEXT UNIQUE NOT NULL,
            logradouro TEXT,
            numero TEXT,
            bairro TEXT,
            status TEXT DEFAULT 'queued',
            last_scraped_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Scraping logs
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS scraping_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            inscricao TEXT,
            source TEXT,
            status TEXT,
            message TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    conn.close()
    print("✅ Database initialized")

def add_to_queue(inscricao: str, logradouro: str, numero: str, bairro: str):
    """Add address to scraping queue"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT OR IGNORE INTO address_queue (inscricao, logradouro, numero, bairro)
            VALUES (?, ?, ?, ?)
        ''', (inscricao, logradouro, numero, bairro))
        conn.commit()
    except Exception as e:
        print(f"Error adding to queue: {e}")
    finally:
        conn.close()

def get_pending_addresses(limit: int = 10, neighborhood: str = None) -> List[Dict]:
    """Get addresses pending scraping"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    query = "SELECT * FROM address_queue WHERE status = 'queued'"
    params = []
    
    if neighborhood:
        query += " AND UPPER(bairro) = ?"
        params.append(neighborhood.strip().upper())
        
    query += " ORDER BY created_at ASC LIMIT ?"
    params.append(limit)
    
    cursor.execute(query, tuple(params))
    
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def save_scraped_property(data: Dict):
    """Save scraped property to database with enhanced fields"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('''
        INSERT INTO scraped_properties (
            inscricao, source, url, title, description,
            price, area, bedrooms, bathrooms, suites, parking,
            images_json, features_json,
            complemento, quartos, suites_new, banheiros, vagas,
            area_util, area_total, valor_real, cod_ref,
            caracteristicas_json, imagens_list_json,
            scraped_address, unit_logradouro, unit_numero, unit_bairro, match_score
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        data.get('inscricao'),
        data.get('source'),
        data.get('url'),
        data.get('title'),
        data.get('description'),
        # Legacy
        data.get('valor_real'),  # Map to legacy price
        data.get('area_util'),    # Map to legacy area
        data.get('quartos'),      # Map to legacy bedrooms
        data.get('banheiros'),    # Map to legacy bathrooms
        data.get('suites'),
        data.get('vagas'),        # Map to legacy parking
        json.dumps(data.get('imagens', [])),
        json.dumps(data.get('caracteristicas', [])),
        # Enhanced
        data.get('complemento'),
        data.get('quartos'),
        data.get('suites'),
        data.get('banheiros'),
        data.get('vagas'),
        data.get('area_util'),
        data.get('area_total'),
        data.get('valor_real'),
        data.get('cod_ref'),
        json.dumps(data.get('caracteristicas', [])),
        json.dumps(data.get('imagens', [])),
        # Address
        data.get('scraped_address'),
        data.get('unit_logradouro'),
        data.get('unit_numero'),
        data.get('unit_bairro'),
        data.get('match_score')
    ))
    
    conn.commit()
    conn.close()

def get_pending_reviews(page: int = 1, per_page: int = 20, min_match: int = 0) -> Dict:
    """
    Get properties pending review with pagination, GROUPED by inscricao.
    One 'item' in pagination is one Unit (which may have multiple scraped results).
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    offset = (page - 1) * per_page
    
    # 1. Get total unique units pending (that have at least one candidate >= min_match)
    cursor.execute("SELECT COUNT(DISTINCT inscricao) FROM scraped_properties WHERE status = 'pending' AND match_score >= ?", (min_match,))
    total = cursor.fetchone()[0]
    
    # 2. Get Page of Inscricoes (Units)
    cursor.execute('''
        SELECT inscricao, MAX(created_at) as last_seen 
        FROM scraped_properties 
        WHERE status = 'pending' AND match_score >= ?
        GROUP BY inscricao
        ORDER BY last_seen DESC
        LIMIT ? OFFSET ?
    ''', (min_match, per_page, offset))
    
    unit_rows = cursor.fetchall()
    
    if not unit_rows:
        conn.close()
        return {
            'properties': [],
            'total': total,
            'page': page,
            'per_page': per_page,
            'total_pages': (total + per_page - 1) // per_page if per_page else 1
        }
        
    target_inscricoes = [r['inscricao'] for r in unit_rows]
    
    # 3. Get ALL candidates for these units (filtered by match score too)
    placeholders = ','.join(['?'] * len(target_inscricoes))
    params = target_inscricoes + [min_match]
    
    cursor.execute(f'''
        SELECT * FROM scraped_properties 
        WHERE inscricao IN ({placeholders}) AND status = 'pending' AND match_score >= ?
        ORDER BY created_at DESC
    ''', params)
    
    rows = cursor.fetchall()
    conn.close()
    
    # 4. Group by Inscricao
    grouped_results = {insc: [] for insc in target_inscricoes}
    
    for row in rows:
        item = dict(row)
        # Parse JSON fields
        item['images'] = json.loads(item['images_json']) if item.get('images_json') else []
        item['features'] = json.loads(item['features_json']) if item.get('features_json') else []
        
        insc = item['inscricao']
        if insc in grouped_results:
            grouped_results[insc].append(item)
            
    # Convert dict to list maintaining order of unit_rows
    final_list = []
    for insc in target_inscricoes:
        candidates = grouped_results.get(insc, [])
        if candidates:
            # Pick a representative for the Unit address info
            best_candidate = max(candidates, key=lambda x: x.get('match_score', 0))
            
            final_list.append({
                'inscricao': insc,
                'unit_logradouro': best_candidate.get('unit_logradouro', ''),
                'unit_numero': best_candidate.get('unit_numero', ''),
                'unit_bairro': best_candidate.get('unit_bairro', ''),
                'candidates': candidates,
                'candidate_count': len(candidates)
            })
    
    return {
        'properties': final_list,
        'total': total,
        'page': page,
        'per_page': per_page,
        'total_pages': (total + per_page - 1) // per_page if per_page else 1
    }

def approve_property(prop_id: int):
    """Mark property as approved"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('UPDATE scraped_properties SET status = ? WHERE id = ?', ('approved', prop_id))
    conn.commit()
    conn.close()

def reject_property(prop_id: int):
    """Mark property as rejected"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('UPDATE scraped_properties SET status = ? WHERE id = ?', ('rejected', prop_id))
    conn.commit()
    conn.close()

def get_approved_properties() -> List[Dict]:
    """Get approved properties ready for sync"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT * FROM scraped_properties 
        WHERE status = 'approved' AND synced_at IS NULL
    ''')
    
    rows = cursor.fetchall()
    conn.close()
    
    results = []
    for row in rows:
        item = dict(row)
        item['images'] = json.loads(item['images_json']) if item['images_json'] else []
        item['features'] = json.loads(item['features_json']) if item['features_json'] else []
        results.append(item)
    
    return results

def mark_synced(prop_id: int):
    """Mark property as synced to Supabase"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE scraped_properties 
        SET synced_at = CURRENT_TIMESTAMP 
        WHERE id = ?
    ''', (prop_id,))
    conn.commit()
    conn.close()

def log_scraping(inscricao: str, source: str, status: str, message: str):
    """Log scraping activity"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO scraping_logs (inscricao, source, status, message)
        VALUES (?, ?, ?, ?)
    ''', (inscricao, source, status, message))
    conn.commit()
    conn.close()

if __name__ == '__main__':
    init_db()
