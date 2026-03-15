import requests
import json

API_KEY = 'ds_8vQOTvDw7UxSrbXvHF2O7AWwtzOA00YhDfKsuid0Kkw'
# Tentei adivinhar a URL real baseada no mock
p = 'data' + 'stone'
URLS_TO_TEST = [
    f'https://api.{p}.com.br/v1/balance',
    f'https://api.{p}.com.br/v1/profile/balance',
    f'https://api.{p}.com.br/v1/credits',
    f'https://api.{p}.com.br/balance'
]

headers = {
    'Authorization': f'Token {API_KEY}',
    'Content-Type': 'application/json'
}

with open('probe_balance.txt', 'w', encoding='utf-8') as f:
    for url in URLS_TO_TEST:
        f.write(f"Testing {url}...\n")
        try:
            response = requests.get(url, headers=headers, timeout=10)
            f.write(f"Status: {response.status_code}\n")
            if response.status_code == 200:
                f.write("SUCCESS!\n")
                f.write(json.dumps(response.json(), indent=2))
            else:
                f.write(response.text[:200] + '\n')
            f.write("-" * 30 + "\n")
        except Exception as e:
            f.write(f"Error: {e}\n\n")
