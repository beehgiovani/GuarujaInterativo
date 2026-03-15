"""
Google Search Scraper - Find property listings via Google
More flexible than site-specific scrapers
"""
import requests
from bs4 import BeautifulSoup
import time
import random
from typing import List, Dict, Optional
import re

# Import from parent directory
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import RATE_LIMIT_DELAY, USER_AGENTS
from address_matcher import validate_address

def build_google_search_url(logradouro: str, numero: str, bairro: str) -> str:
    """Build Google search URL for property"""
    # Clean and format query
    query_parts = []
    if logradouro:
        # Remove R, AV prefixes for cleaner search
        clean_log = logradouro.replace('R ', '').replace('AV ', '').replace('AL ', '')
        query_parts.append(clean_log)
    if numero:
        query_parts.append(str(int(numero)) if numero.isdigit() else numero)
    if bairro:
        query_parts.append(bairro)
    
    query_parts.extend(['Guarujá', 'SP', 'venda'])
    
    query = ' '.join(query_parts)
    # Google search URL
    search_url = f"https://www.google.com/search?q={query.replace(' ', '+')}"
    
    return search_url

def extract_from_google_result(url: str, title: str, snippet: str) -> Optional[Dict]:
    """
    Extract basic data from Google result
    We don't visit each page (too slow), just use Google's snippet
    """
    data = {
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
        'scraped_address': None
    }
    
    # Extract address from title or snippet
    combined_text = f"{title} {snippet}"
    data['scraped_address'] = combined_text
    
    # Try to extract price from snippet (R$ patterns)
    price_patterns = [
        r'R\$\s*[\d.,]+',
        r'reais\s+[\d.,]+',
        r'[\d.,]+\s*mil'
    ]
    for pattern in price_patterns:
        match = re.search(pattern, combined_text, re.IGNORECASE)
        if match:
            price_text = match.group()
            # Extract numeric value
            price_match = re.search(r'[\d.,]+', price_text)
            if price_match:
                try:
                    price_str = price_match.group().replace('.', '').replace(',', '.')
                    data['price'] = float(price_str)
                    # If in thousands (mil)
                    if 'mil' in price_text.lower():
                        data['price'] *= 1000
                    break
                except:
                    pass
    
    # Try to extract area (m², m2)
    area_patterns = [
        r'(\d+)\s*m[²2]',
        r'(\d+)\s*metros',
    ]
    for pattern in area_patterns:
        match = re.search(pattern, combined_text, re.IGNORECASE)
        if match:
            try:
                data['area'] = int(match.group(1))
                break
            except:
                pass
    
    # Try to extract bedrooms
    bedroom_patterns = [
        r'(\d+)\s*quartos?',
        r'(\d+)\s*dorm',
    ]
    for pattern in bedroom_patterns:
        match = re.search(pattern, combined_text, re.IGNORECASE)
        if match:
            try:
                data['bedrooms'] = int(match.group(1))
                break
            except:
                pass
    
    return data

def search_property_google(logradouro: str, numero: str, bairro: str, inscricao: str) -> List[Dict]:
    """
    Search Google for property matching address
    Returns list of validated matches from ANY site
    """
    search_url = build_google_search_url(logradouro, numero, bairro)
    print(f"🔍 Searching Google: {search_url}")
    
    try:
        headers = {
            'User-Agent': random.choice(USER_AGENTS),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        }
        
        response = requests.get(search_url, headers=headers, timeout=10)
        
        if response.status_code != 200:
            print(f"❌ Google search failed: HTTP {response.status_code}")
            return []
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Find search result divs (Google uses div with class 'g')
        search_results = soup.find_all('div', class_='g')
        
        if not search_results:
            # Try alternative selectors
            search_results = soup.find_all('div', {'data-sokoban-container': True})
        
        if not search_results:
            print("⚠️ No search results found (possible CAPTCHA or format change)")
            return []
        
        print(f"📋 Found {len(search_results)} Google results")
        
        results = []
        unit_data = {'logradouro': logradouro, 'numero': numero, 'bairro': bairro}
        
        for result in search_results[:10]:  # Top 10 results
            # Extract title
            title_elem = result.find('h3')
            if not title_elem:
                continue
            title = title_elem.get_text(strip=True)
            
            # Extract URL
            link_elem = result.find('a')
            if not link_elem or not link_elem.get('href'):
                continue
            url = link_elem.get('href')
            
            # Skip Google's own links
            if 'google.com' in url or url.startswith('/search'):
                continue
            
            # Extract snippet (description)
            snippet_elem = result.find('div', class_='VwiC3b') or result.find('span', class_='aCOpRe')
            snippet = snippet_elem.get_text(strip=True) if snippet_elem else ''
            
            # Extract data from snippet
            data = extract_from_google_result(url, title, snippet)
            
            if not data or not data.get('scraped_address'):
                continue
            
            # Validate address
            match_score, reason = validate_address(data['scraped_address'], unit_data)
            
            print(f"  {title[:50]}...")
            print(f"    Match: {match_score}% - {reason}")
            
            if match_score >= 50:  # Threshold
                data['inscricao'] = inscricao
                data['source'] = 'google'
                data['match_score'] = match_score
                data['unit_logradouro'] = logradouro
                data['unit_numero'] = numero
                data['unit_bairro'] = bairro
                results.append(data)
                print(f"    ✅ Added to results")
            else:
                print(f"    ❌ Score too low ({match_score}%)")
        
        return results
        
    except Exception as e:
        print(f"❌ Google scraping error: {e}")
        import traceback
        traceback.print_exc()
        return []

if __name__ == '__main__':
    # Test
    results = search_property_google(
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
        print(f"  Price: {r.get('price')}")
