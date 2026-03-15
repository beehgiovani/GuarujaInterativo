"""
Google Custom Search API Scraper
Uses official Google API - no blocking, 100 free queries/day
"""
import requests
from typing import List, Dict, Optional
import re
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from address_matcher import validate_address
from google_api_config import GOOGLE_API_KEY, GOOGLE_CSE_ID

def search_property_google_api(logradouro: str, numero: str, bairro: str, inscricao: str) -> List[Dict]:
    """
    Search using Google Custom Search API
    Returns property listings from ANY site
    """
    if not GOOGLE_API_KEY:
        print("❌ Google API Key not configured")
        return []
    
    # Build search query
    query_parts = []
    if logradouro:
        clean_log = logradouro.replace('R ', '').replace('AV ', '').replace('AL ', '')
        query_parts.append(clean_log)
    if numero:
        query_parts.append(str(int(numero)) if numero.isdigit() else numero)
    if bairro:
        query_parts.append(bairro)
    
    query_parts.extend(['Guarujá', 'SP', 'venda'])
    query = ' '.join(query_parts)
    
    print(f"🔍 Google API Search: {query}")
    
    # Google Custom Search API endpoint
    url = "https://www.googleapis.com/customsearch/v1"
    
    params = {
        'key': GOOGLE_API_KEY,
        'q': query,
        'num': 10,  # Up to 10 results
        'lr': 'lang_pt',  # Portuguese results
        'gl': 'br'  # Brazil region
    }
    
    # Add CSE ID if configured (otherwise searches entire web)
    if GOOGLE_CSE_ID:
        params['cx'] = GOOGLE_CSE_ID
    
    try:
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code != 200:
            print(f"❌ API Error: {response.status_code}")
            if response.status_code == 429:
                print("   Daily quota exceeded (100 queries/day)")
            else:
                print(f"   {response.text}")
            return []
        
        data = response.json()
        
        if 'items' not in data:
            print("⚠️ No results found")
            return []
        
        items = data['items']
        print(f"📋 Found {len(items)} results")
        
        results = []
        unit_data = {'logradouro': logradouro, 'numero': numero, 'bairro': bairro}
        
        for item in items:
            title = item.get('title', '')
            url = item.get('link', '')
            snippet = item.get('snippet', '')
            
            # Skip PDFs and non-listing pages
            if url.endswith('.pdf') or 'google.com' in url:
                continue
            
            # Extract data from snippet
            property_data = {
                'url': url,
                'title': title,
                'description': snippet,
                'price': None,
                'area': None,
                'bedrooms': None,
                'bathrooms': None,
                'parking': None,
                'images': [],
                'features': [],
                'scraped_address': f"{title} {snippet}"
            }
            
            # Extract price
            combined = f"{title} {snippet}"
            price_patterns = [r'R\$\s*[\d.,]+', r'[\d.,]+\s*mil']
            for pattern in price_patterns:
                match = re.search(pattern, combined, re.IGNORECASE)
                if match:
                    try:
                        price_text = match.group()
                        price_match = re.search(r'[\d.,]+', price_text)
                        if price_match:
                            price_str = price_match.group().replace('.', '').replace(',', '.')
                            property_data['price'] = float(price_str)
                            if 'mil' in price_text.lower():
                                property_data['price'] *= 1000
                            break
                    except:
                        pass
            
            # Extract area
            area_match = re.search(r'(\d+)\s*m[²2]', combined, re.IGNORECASE)
            if area_match:
                try:
                    property_data['area'] = int(area_match.group(1))
                except:
                    pass
            
            # Extract bedrooms
            bedroom_match = re.search(r'(\d+)\s*quartos?|(\d+)\s*dorm', combined, re.IGNORECASE)
            if bedroom_match:
                try:
                    property_data['bedrooms'] = int(bedroom_match.group(1) or bedroom_match.group(2))
                except:
                    pass
            
            # Validate address
            match_score, reason = validate_address(property_data['scraped_address'], unit_data)
            
            print(f"  {title[:60]}...")
            print(f"    Source: {url.split('/')[2] if '/' in url else url}")
            print(f"    Match: {match_score}% - {reason}")
            
            if match_score >= 50:
                property_data['inscricao'] = inscricao
                property_data['source'] = 'google_api'
                property_data['match_score'] = match_score
                property_data['unit_logradouro'] = logradouro
                property_data['unit_numero'] = numero
                property_data['unit_bairro'] = bairro
                results.append(property_data)
                print(f"    ✅ Added")
            else:
                print(f"    ❌ Low score")
        
        return results
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return []

if __name__ == '__main__':
    # Test
    results = search_property_google_api(
        'R JOSE DA SILVA MONTEIRO DE BARROS',
        '00922',
        'ASTÚRIAS',
        '10137023004'
    )
    print(f"\n✅ Found {len(results)} validated matches")
    for r in results:
        print(f"\n  Title: {r['title']}")
        print(f"  URL: {r['url']}")
        print(f"  Match: {r['match_score']}%")
        print(f"  Price: R$ {r.get('price')} | Area: {r.get('area')}m²")
