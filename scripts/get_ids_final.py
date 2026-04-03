import requests
import os
from dotenv import load_dotenv

load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

url = f"https://generativelanguage.googleapis.com/v1beta/models?key={GEMINI_API_KEY}"

response = requests.get(url)
data = response.json()
for m in data.get('models', []):
    name = m['name']
    methods = m.get('supportedGenerationMethods', [])
    if 'generateContent' in methods:        
        print(f"MODEL_ID: {name}")
