"""Quick test of OLX scraper with one address"""
from sources import olx_scraper

# Test with one of the addresses from queue
results = olx_scraper.search_property(
    'R JOSE DA SILVA MONTEIRO DE BARROS',
    '00922',
    'ASTÚRIAS',
    '10137023004'
)

print(f"\n✅ RESULTS: Found {len(results)} matches")
for r in results:
    print(f"\n  Title: {r.get('title')}")
    print(f"  Match: {r.get('match_score')}%")
    print(f"  Price: R$ {r.get('price')}")
    print(f"  Images: {len(r.get('images', []))}")
