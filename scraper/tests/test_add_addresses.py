"""
Test Scraper - Add addresses manually for testing
"""
import database as db

# Initialize database
db.init_db()

# Add test addresses
test_addresses = [
    {
        'inscricao': '1-TEST-001',
        'logradouro': 'AV MIGUEL ALONSO GONZALEZ',
        'numero': '00164',
        'bairro': 'ASTÚRIAS'
    },
    {
        'inscricao': '1-TEST-002',
        'logradouro': 'RUA ANTONIO CANDIDO',
        'numero': '00123',
        'bairro': 'PITANGUEIRAS'
    }
]

print("📋 Adding test addresses to queue...")
for addr in test_addresses:
    db.add_to_queue(
        addr['inscricao'],
        addr['logradouro'],
        addr['numero'],
        addr['bairro']
    )
    print(f"   ✅ Added: {addr['logradouro']} {addr['numero']}, {addr['bairro']}")

print("\n✅ Test addresses added!")
print("\n🚀 Now run: python main_local.py")
