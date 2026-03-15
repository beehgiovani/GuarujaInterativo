"""
Serper API Scraper - Google Search results via Serper
https://serper.dev - Easier and cheaper than Google Custom Search
"""
import requests
from typing import List, Dict, Optional
import re
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from address_matcher import validate_address
from google_api_config import GOOGLE_API_KEY  # Using as Serper API key

def extract_from_serper_result(item: Dict) -> Optional[Dict]:
    """Extract detailed property data from Serper result"""
    
    title = item.get('title', '')
    url = item.get('link', '')
    snippet = item.get('snippet', '')
    
    # Skip PDFs and non-listing pages
    if url.endswith('.pdf') or 'google.com' in url:
        return None
    
    combined = f"{title} {snippet}"
    
    data = {
        'url': url,
        'title': title,
        'description': snippet,
        'scraped_address': combined,
        
        # Unidades fields
        'complemento': None,  # Apt number
        'quartos': None,
        'suites': None,
        'banheiros': None,
        'vagas': None,
        'area_util': None,
        'area_total': None,
        'valor_real': None,  # Selling price
        'cod_ref': None,
        'caracteristicas': [],
        'imagens': [],
        
        # Building/Lote fields
        'building_amenities': []
    }
    
    # Extract apartment/unit number (apt, apto, apartamento)
    apt_patterns = [
        r'apt\.?\s*(\d+)',
        r'apto\.?\s*(\d+)',
        r'apartamento\s+(\d+)',
        r'unidade\s+(\d+)',
    ]
    for pattern in apt_patterns:
        match = re.search(pattern, combined, re.IGNORECASE)
        if match:
            data['complemento'] = f"Apto {match.group(1)}"
            break
    
    # Extract reference code (codigo, ref, cod)
    ref_patterns = [
        r'c[oó]digo[:\s]+(\d+)',
        r'ref[:\s]+([A-Z0-9\-]+)',
        r'cod[:\s]+(\d+)',
    ]
    for pattern in ref_patterns:
        match = re.search(pattern, combined, re.IGNORECASE)
        if match:
            data['cod_ref'] = match.group(1)
            break
    
    # Extract price (valor real)
    price_patterns = [
        r'R\$\s*([\d.,]+)',
        r'([\d.,]+)\s*mil',
        r'([\d.,]+)\s*reais',
    ]
    for pattern in price_patterns:
        match = re.search(pattern, combined, re.IGNORECASE)
        if match:
            try:
                price_text = match.group()
                price_match = re.search(r'[\d.,]+', price_text)
                if price_match:
                    price_str = price_match.group().replace('.', '').replace(',', '.')
                    price = float(price_str)
                    # If in thousands
                    if 'mil' in price_text.lower():
                        price *= 1000
                    data['valor_real'] = price
                    break
            except:
                pass
    
    # Extract bedrooms (quartos)
    bedroom_patterns = [
        r'(\d+)\s*quartos?',
        r'(\d+)\s*dorm',
        r'(\d+)\s*quarto',
    ]
    for pattern in bedroom_patterns:
        match = re.search(pattern, combined, re.IGNORECASE)
        if match:
            try:
                data['quartos'] = int(match.group(1))
                break
            except:
                pass
    
    # Extract suites
    suite_patterns = [
        r'(\d+)\s*su[íi]tes?',
    ]
    for pattern in suite_patterns:
        match = re.search(pattern, combined, re.IGNORECASE)
        if match:
            try:
                data['suites'] = int(match.group(1))
                break
            except:
                pass
    
    # Extract bathrooms
    bathroom_patterns = [
        r'(\d+)\s*banheiros?',
        r'(\d+)\s*wc',
    ]
    for pattern in bathroom_patterns:
        match = re.search(pattern, combined, re.IGNORECASE)
        if match:
            try:
                data['banheiros'] = int(match.group(1))
                break
            except:
                pass
    
    # Extract parking (vagas)
    parking_patterns = [
        r'(\d+)\s*vagas?',
        r'(\d+)\s*garagens?',
    ]
    for pattern in parking_patterns:
        match = re.search(pattern, combined, re.IGNORECASE)
        if match:
            try:
                data['vagas'] = int(match.group(1))
                break
            except:
                pass
    
    # Extract area (m²)
    area_patterns = [
        r'(\d+(?:[.,]\d+)?)\s*m[²2]',
        r'(\d+(?:[.,]\d+)?)\s*metros',
    ]
    for pattern in area_patterns:
        match = re.search(pattern, combined, re.IGNORECASE)
        if match:
            try:
                area_str = match.group(1).replace(',', '.')
                area = float(area_str)
                # Use as area_util if not set
                if not data['area_util']:
                    data['area_util'] = area
                break
            except:
                pass
    
    # Extract building amenities
    amenities_keywords = {
        'piscina': 'Piscina',
        'academia': 'Academia',
        'churrasqueira': 'Churrasqueira',
        'salão de festas': 'Salão de Festas',
        'elevador': 'Elevador',
        'portaria 24h': 'Portaria 24h',
        'playground': 'Playground',
        'quadra': 'Quadra',
        'sauna': 'Sauna',
        'salão de jogos': 'Salão de Jogos',
    }
    
    # Extract images from rich snippets (pagemap)
    try:
        # 1. Try direct Serper image fields
        if 'imageUrl' in item:
            data['imagens'].append(item['imageUrl'])
        if 'thumbnail' in item:
            data['imagens'].append(item['thumbnail'])
        if 'image' in item:
            data['imagens'].append(item['image'])

        # 2. Try pagemap (standard Google structure)
        if 'pagemap' in item:
            pagemap = item['pagemap']
            
            # Try cse_image
            if 'cse_image' in pagemap:
                for img in pagemap['cse_image']:
                    if 'src' in img and img['src'].startswith('http'):
                        data['imagens'].append(img['src'])
            
            # Try cse_thumbnail
            elif 'cse_thumbnail' in pagemap:
                for img in pagemap['cse_thumbnail']:
                    if 'src' in img and img['src'].startswith('http'):
                        data['imagens'].append(img['src'])
                        
            # Try og:image key in metatags
            if 'metatags' in pagemap:
                for meta in pagemap['metatags']:
                    if 'og:image' in meta:
                        data['imagens'].append(meta['og:image'])
                        
        # Remove duplicates
        data['imagens'] = list(dict.fromkeys(data['imagens']))
        
    except Exception as e:
        print(f"Error extracting images: {e}")

    return data

def search_property_serper(logradouro: str, numero: str, bairro: str, inscricao: str) -> List[Dict]:
    """Search using Serper API - returns Google results"""
    
    if not GOOGLE_API_KEY:
        print("❌ Serper API Key not configured")
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
    
    print(f"🔍 Serper API Search: {query}")
    
    # Serper API endpoint
    url = "https://google.serper.dev/search"
    
    payload = {
        'q': query,
        'gl': 'br',  # Brazil
        'hl': 'pt',  # Portuguese
        'num': 10    # Number of results
    }
    
    headers = {
        'X-API-KEY': GOOGLE_API_KEY,
        'Content-Type': 'application/json'
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        
        if response.status_code != 200:
            print(f"❌ Serper API Error: {response.status_code}")
            print(f"   {response.text}")
            return []
        
        data = response.json()
        
        if 'organic' not in data or len(data['organic']) == 0:
            print("⚠️ No results found")
            return []
        
        items = data['organic']
        print(f"📋 Found {len(items)} results")
        
        results = []
        unit_data = {'logradouro': logradouro, 'numero': numero, 'bairro': bairro}
        
        for item in items:
            # Extract comprehensive data
            property_data = extract_from_serper_result(item)
            
            if not property_data:
                continue
            
            # Validate address
            match_score, reason = validate_address(property_data['scraped_address'], unit_data)
            
            # Get domain for display
            url = property_data['url']
            domain = url.split('/')[2] if '/' in url else url
            
            print(f"  {property_data['title'][:50]}...")
            print(f"    Site: {domain}")
            print(f"    Match: {match_score}% - {reason}")
            if property_data.get('quartos'):
                print(f"    Specs: {property_data['quartos']} quartos, {property_data.get('area_util', 0)}m²")
            if property_data.get('valor_real'):
                print(f"    Preço: R$ {property_data['valor_real']:,.2f}")
            
            if match_score >= 75:
                property_data['inscricao'] = inscricao
                property_data['source'] = 'serper'
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
    results = search_property_serper(
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
        if r.get('valor_real'):
            print(f"  Preço: R$ {r['valor_real']:,.2f}")
        if r.get('area_util'):
            print(f"  Área: {r['area_util']}m²")
        if r.get('quartos'):
            print(f"  Quartos: {r['quartos']}")
