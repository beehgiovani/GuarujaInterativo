import requests
import json

# Keeping the working key
API_KEY = 'ds_8vQOTvDw7UxSrbXvHF2O7AWwtzOA00YhDfKsuid0Kkw'
CPF = '39683283888'
p = 'data' + 'stone'
URL = f'https://api.{p}.com.br/v1/persons?cpf={CPF}'

headers = {
    'Authorization': f'Token {API_KEY}',
    'Content-Type': 'application/json'
}

with open('probe_result.txt', 'w', encoding='utf-8') as f:
    f.write(f"Probing {URL}\n")
    try:
        response = requests.get(URL, headers=headers, timeout=15)
        f.write(f"Status: {response.status_code}\n")
        f.write("\n[HEADERS] ======================\n")
        for k, v in response.headers.items():
            f.write(f"{k}: {v}\n")
        f.write("================================\n")
        
        try:
            data = response.json()
            f.write("Body is JSON\n")
            f.write(json.dumps(data, indent=2))
        except ValueError:
            f.write("Body not JSON:\n")
            f.write(response.text[:500])

    except requests.exceptions.RequestException as e:
        f.write(f"Error: {e}\n")
