import os
import requests
import json
import time
from gemini_assistant import GeminiAssistant

# Configurações do Supabase (reutilizando do upload_data_via_api.py se necessário)
SUPABASE_URL = 'https://ijmgvsztgljribnogtsx.supabase.co'
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "sb_publishable_tHrPQdJlE9sOPkAr_muBlQ_bGDx8pxU")

HEADERS = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type': 'application/json'
}

def get_sample_units(limit=5):
    """Busca unidades reais do banco para demonstrar a avaliação."""
    url = f"{SUPABASE_URL}/rest/v1/unidades?select=inscricao,logradouro,bairro_unidade,metragem,valor_venal&limit={limit}"
    try:
        response = requests.get(url, headers=HEADERS)
        if response.status_code == 200:
            return response.json()
        else:
            print(f"Erro ao buscar unidades: {response.text}")
            return []
    except Exception as e:
        print(f"Exceção ao buscar unidades: {e}")
        return []

def run_ia_valuation():
    assistant = GeminiAssistant()
    units = get_sample_units(3) # Testando com 3 unidades para não estourar cota
    
    if not units:
        print("Nenhuma unidade encontrada para avaliar.")
        return

    print(f"--- Iniciando Avaliação Assistida por IA (3 Amostras) ---")
    
    for unit in units:
        inscricao = unit.get('inscricao')
        rua = unit.get('logradouro')
        bairro = unit.get('bairro_unidade')
        m2 = unit.get('metragem', 0)
        venal = unit.get('valor_venal', 0)
        
        prompt = (
            f"Como Assistente Sênior, avalie o seguinte imóvel:\n"
            f"- Rua: {rua}\n"
            f"- Bairro: {bairro}, Guarujá\n"
            f"- Metragem: {m2}m²\n"
            f"- Valor Venal (Prefeitura): R$ {venal}\n\n"
            "Pesquise o valor de mercado atual por m² nesta região específica. "
            "Forneça uma estimativa de 'Valor Real de Mercado' e um breve comentário sobre o potencial de valorização."
        )
        
        print(f"\nAvaliando Insc: {inscricao} ({bairro})...")
        avaliacao = assistant.ask(prompt, persona="imobiliario")
        
        print(f"--- RESULTADO IA ---")
        print(avaliacao)
        print("-" * 30)
        
        # Delay para respeitar cota gratuita (RPM)
        time.sleep(10)

if __name__ == "__main__":
    run_ia_valuation()
