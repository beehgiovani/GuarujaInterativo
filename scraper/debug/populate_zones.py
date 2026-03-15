"""
Populate queue with test addresses for different Zones (0-6)
"""
import database as db

db.init_db()

# Mock addresses for different zones
# Zone 0: Centro/Astúrias
# Zone 1: Pitangueiras
# Zone 2: Enseada
# Zone 3: Pernambuco
# Zone 4: Sta Cruz
# Zone 5: Vicente de Carvalho
# Zone 6: Perequê

zone_tests = [
    {
        'inscricao': '00123000000', # Zone 0
        'logradouro': 'AV GENERAL RONDON',
        'numero': '50',
        'bairro': 'ASTÚRIAS'
    },
    {
        'inscricao': '10123000000', # Zone 1
        'logradouro': 'AV MAL DEODORO DA FONSECA',
        'numero': '750',
        'bairro': 'PITANGUEIRAS'
    },
    {
        'inscricao': '20123000000', # Zone 2
        'logradouro': 'AV DOM PEDRO I',
        'numero': '1500',
        'bairro': 'ENSEADA'
    },
    {
        'inscricao': '30123000000', # Zone 3
        'logradouro': 'RUA DAS FLORES',
        'numero': '120',
        'bairro': 'PERNAMBUCO'
    },
    {
        'inscricao': '50123000000', # Zone 5
        'logradouro': 'AV SANTOS DUMONT',
        'numero': '550',
        'bairro': 'VICENTE DE CARVALHO'
    }
]

print("📋 Adding multi-zone test addresses...")
for addr in zone_tests:
    db.add_to_queue(
        addr['inscricao'],
        addr['logradouro'],
        addr['numero'],
        addr['bairro']
    )
    print(f"   ✅ Added Zone {addr['inscricao'][0]}: {addr['logradouro']}")

print("\n🚀 Queue populated! Try selecting different zones in the UI.")
