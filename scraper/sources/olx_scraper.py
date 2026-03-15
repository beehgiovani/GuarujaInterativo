"""
OLX Scraper - Extract property listings from OLX
"""
import requests
from bs4 import BeautifulSoup
import time
import random
from typing import List, Dict, Optional
from config import RATE_LIMIT_DELAY, USER_AGENTS, SOURCES
from address_matcher import validate_address

def build_search_url(logradouro: str, numero: str, bairro: str) -> str:
    """Build OLX search URL with address"""
    base = SOURCES['olx']['search_url']
    
    # Clean and format query
    query_parts = []
    if logradouro:
        query_parts.append(logradouro.replace('AV ', 'AVENIDA ').replace('R ', 'RUA '))
    if numero:
        query_parts.append(str(int(numero)) if numero.isdigit() else numero)
    if bairro:
        query_parts.append(bairro)
    
    query = ' '.join(query_parts)
    search_url = f"{base}?q={query.replace(' ', '+')}"
    
    return search_url

def extract_listing_data(listing_url: str) -> Optional[Dict]:
    """Extract detailed data from a single listing page"""
    try:
        headers = {'User-Agent': random.choice(USER_AGENTS)}
        response = requests.get(listing_url, headers=headers, timeout=10)
        
        if response.status_code != 200:
            return None
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Extract data (OLX-specific selectors - may need adjustment)
        data = {
            'url': listing_url,
            'title': None,
            'description': None,
            'price': None,
            'area': None,
            'bedrooms': None,
            'bathrooms': None,
            'parking': None,
            'images': [],
            'features': [],
            'scraped_address': None
        }
        
        # Title
        title_elem = soup.select_one('h1[data-testid="ad-title"]')
        if title_elem:
            data['title'] = title_elem.get_text(strip=True)
        
        # Price
        price_elem = soup.select_one('[data-testid="ad-price"]')
        if price_elem:
            price_text = price_elem.get_text(strip=True)
            # Extract numeric value
            import re
            price_match = re.search(r'[\d.,]+', price_text.replace('.', '').replace(',', '.'))
            if price_match:
                data['price'] = float(price_match.group())
        
        # Description
        desc_elem = soup.select_one('[data-testid="ad-description"]')
        if desc_elem:
            data['description'] = desc_elem.get_text(strip=True)
        
        # Address
        addr_elem = soup.select_one('[data-testid="ad-location"]')
        if addr_elem:
            data['scraped_address'] = addr_elem.get_text(strip=True)
        
        # Details (área, quartos, etc)
        details = soup.select('[data-testid="detail-item"]')
        for detail in details:
            label = detail.select_one('[data-testid="detail-label"]')
            value = detail.select_one('[data-testid="detail-value"]')
            
            if not label or not value:
                continue
            
            label_text = label.get_text(strip=True).lower()
            value_text = value.get_text(strip=True)
            
            if 'área' in label_text or 'area' in label_text:
                import re
                area_match = re.search(r'(\d+)', value_text)
                if area_match:
                    data['area'] = int(area_match.group(1))
            elif 'quarto' in label_text:
                data['bedrooms'] = int(value_text) if value_text.isdigit() else None
            elif 'banheiro' in label_text:
                data['bathrooms'] = int(value_text) if value_text.isdigit() else None
            elif 'vaga' in label_text or 'garagem' in label_text:
                data['parking'] = int(value_text) if value_text.isdigit() else None
        
        # Images
        image_thumbs = soup.select('img[src*="img.olxcdn"]')
        for img in image_thumbs:
            src = img.get('src', '')
            # Get high-res version
            if src:
                high_res = src.replace('_thumb', '').replace('_small', '')
                data['images'].append(high_res)
        
        # Remove duplicates
        data['images'] = list(set(data['images']))
        
        return data
        
    except Exception as e:
        print(f"Error extracting listing {listing_url}: {e}")
        return None

def search_property(logradouro: str, numero: str, bairro: str, inscricao: str) -> List[Dict]:
    """
    Search OLX for property matching address
    Returns list of validated matches
    """
    search_url = build_search_url(logradouro, numero, bairro)
    print(f"🔍 Searching OLX: {search_url}")
    
    try:
        headers = {'User-Agent': random.choice(USER_AGENTS)}
        response = requests.get(search_url, headers=headers, timeout=10)
        
        if response.status_code != 200:
            print(f"❌ OLX search failed: HTTP {response.status_code}")
            return []
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Find listing links (OLX-specific selector - may need adjustment)
        listing_links = soup.select('a[data-testid="ad-card"]')
        
        if not listing_links:
            print("⚠️ No listings found")
            return []
        
        print(f"📋 Found {len(listing_links)} listings")
        
        results = []
        unit_data = {'logradouro': logradouro, 'numero': numero, 'bairro': bairro}
        
        for link in listing_links[:5]:  # Limit to first 5 results
            listing_url = link.get('href', '')
            if not listing_url.startswith('http'):
                listing_url = SOURCES['olx']['base_url'] + listing_url
            
            # Rate limiting
            time.sleep(RATE_LIMIT_DELAY + random.uniform(0, 1))
            
            # Extract data
            data = extract_listing_data(listing_url)
            if not data or not data.get('scraped_address'):
                continue
            
            # Validate address
            match_score, reason = validate_address(data['scraped_address'], unit_data)
            
            print(f"  Match: {match_score}% - {reason}")
            
            if match_score >= 50:  # LOWERED temporarily for testing
                data['inscricao'] = inscricao
                data['source'] = 'olx'
                data['match_score'] = match_score
                data['unit_logradouro'] = logradouro
                data['unit_numero'] = numero
                data['unit_bairro'] = bairro
                results.append(data)
                print(f"  ✅ Added to results")
            else:
                print(f"  ❌ Score too low ({match_score}%)")
        
        return results
        
    except Exception as e:
        print(f"❌ OLX scraping error: {e}")
        return []

if __name__ == '__main__':
    # Test
    results = search_property('AV MIGUEL ALONSO GONZALEZ', '00164', 'ASTÚRIAS', '1-0123-456-001')
    print(f"\n✅ Found {len(results)} validated matches")
    for r in results:
        print(f"  - {r['title']} ({r['match_score']}%)")
