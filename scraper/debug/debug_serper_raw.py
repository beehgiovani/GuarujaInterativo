import requests
import json
import os
import sys

# Load env manually or simple config
# Assuming .env is in valid path or I can just use the key if I knew it. 
# I'll try to load from .env

def load_env_key():
    # Try different paths
    paths = ['scraper/.env', '.env', '../.env']
    for p in paths:
        if os.path.exists(p):
            print(f"Reading from {p}")
            try:
                with open(p, 'r') as f:
                    for line in f:
                        if line.startswith('GOOGLE_API_KEY'):
                            return line.strip().split('=')[1]
            except:
                pass
    return None

API_KEY = load_env_key()

def debug_search(query):
    print(f"🔍 Debug Search: {query}")
    
    url = "https://google.serper.dev/search"
    payload = json.dumps({
      "q": query,
      "gl": "br",
      "hl": "pt",
      "num": 5
    })
    headers = {
      'X-API-KEY': API_KEY,
      'Content-Type': 'application/json'
    }

    try:
        response = requests.request("POST", url, headers=headers, data=payload)
        data = response.json()
        
        # Save raw dump
        with open('debug_serper_dump.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            
        print("✅ Raw response saved to debug_serper_dump.json")
        
        # Analyze images
        if 'organic' in data:
            print(f"\nFound {len(data['organic'])} items.")
            for i, item in enumerate(data['organic']):
                print(f"\nItem {i+1}: {item.get('title')}")
                
                # Check known image fields
                has_image = False
                if 'imageUrl' in item:
                    print(f"  FOUND imageUrl: {item['imageUrl']}")
                    has_image = True
                if 'thumbnail' in item:
                    print(f"  FOUND thumbnail: {item['thumbnail']}")
                    has_image = True
                if 'image' in item:
                    print(f"  FOUND image: {item['image']}")
                    has_image = True
                    
                # Check pagemap
                if 'pagemap' in item:
                    print("  Has pagemap keys:", item['pagemap'].keys())
                    if 'cse_image' in item['pagemap']:
                        print(f"  FOUND cse_image: {item['pagemap']['cse_image']}")
                        has_image = True
                    if 'cse_thumbnail' in item['pagemap']:
                        print(f"  FOUND cse_thumbnail: {item['pagemap']['cse_thumbnail']}")
                        has_image = True
                    if 'metatags' in item['pagemap']:
                        # search for og:image
                        for meta in item['pagemap']['metatags']:
                            if 'og:image' in meta:
                                print(f"  FOUND og:image: {meta['og:image']}")
                                has_image = True
                                
                if not has_image:
                    print("  ❌ NO IMAGES FOUND IN THIS ITEM")
                    
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    if not API_KEY:
        print("❌ Could not load GOOGLE_API_KEY from scraper/.env")
    else:
        # Search for a property likely to exist on portals
        debug_search("Apartamento à venda Guarujá Astúrias 2 quartos")
