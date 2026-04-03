import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY não configurada no ambiente.")

genai.configure(api_key=GEMINI_API_KEY)

print("--- Diagnóstico Gemini ---")
try:
    print(f"Chave utilizada: {GEMINI_API_KEY[:5]}...{GEMINI_API_KEY[-5:]}")
    
    # Tenta listar os modelos com detalhes
    print("\nModelos suportados para geração de conteúdo:")
    models = list(genai.list_models())
    if not models:
        print("Nenhum modelo retornado pela API.")
    else:
        for m in models:
            if 'generateContent' in m.supported_generation_methods:
                print(f"- {m.name} (DisplayName: {m.display_name})")

    # Tenta uma chamada minimalista com o modelo mais básico
    print("\nTeste de geração com 'models/gemini-1.5-flash':")
    model = genai.GenerativeModel('models/gemini-1.5-flash')
    response = model.generate_content("Diga Oi em uma palavra.")
    print(f"Resposta: {response.text}")

except Exception as e:
    print(f"\nERRO DETECTADO: {type(e).__name__}: {e}")
