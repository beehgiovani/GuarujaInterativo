import requests
import json
import os
from dotenv import load_dotenv

load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "AIzaSyCMDj4RXAJheWLJX61Vbt6WG_M6eQ_nPrE")

url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"

payload = {
    "contents": [{
        "parts": [{"text": "Diga Oi em uma palavra."}]
    }]
}

headers = {
    'Content-Type': 'application/json'
}

print(f"--- Teste REST Direto (flash) ---")
response = requests.post(url, headers=headers, data=json.dumps(payload))

print(f"Status: {response.status_code}")
try:
    print(f"Resposta:\n{json.dumps(response.json(), indent=2)}")
except:
    print(f"Raw Body: {response.text}")
