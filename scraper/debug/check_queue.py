import database as db
import sqlite3

conn = sqlite3.connect(db.DB_PATH)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

print("\n📋 Address Queue:\n")
cursor.execute('SELECT * FROM address_queue LIMIT 5')
rows = cursor.fetchall()

for r in rows:
    print(f"Inscricao: {r['inscricao']}")
    print(f"  Logradouro: '{r['logradouro']}'")
    print(f"  Numero: '{r['numero']}'")
    print(f"  Bairro: '{r['bairro']}'")
    print()

conn.close()
