import requests
import os
from dotenv import load_dotenv

load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "AIzaSyCMDj4RXAJheWLJX61Vbt6WG_M6eQ_nPrE")

url = f"https://generativelanguage.googleapis.com/v1beta/models?key={GEMINI_API_KEY}"

print(f"--- Listando Modelos Acessíveis (REST) ---")
response = requests.get(url)

if response.status_code == 200:
    models = response.json().get('models', [])
    for m in models:
        print(f"Name: {m['name']} | Methods: {m.get('supportedGenerationMethods', [])}")
else:
    print(f"Erro {response.status_code}: {response.text}")
