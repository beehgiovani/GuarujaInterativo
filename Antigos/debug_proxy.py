import requests
import time
import socket
import socks

PROXY_PORT = 10010
TARGET_URL = "http://mapas.scimpmgsp.geometrus.com.br:8008/mapserver2013/guaruja/geo/geoprocessamento.php"

print(f"Testing connection via SOCKS5 localhost:{PROXY_PORT}...")

proxies = {
    'http': f'socks5://127.0.0.1:{PROXY_PORT}',
    'https': f'socks5://127.0.0.1:{PROXY_PORT}'
}

PORTS_TO_TEST = [9050, 9150]

for port in PORTS_TO_TEST:
    print(f"\n--- Testing Port {port} ---")
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(2)
        result = s.connect_ex(('127.0.0.1', port))
        if result == 0:
            print(f"[OK] Port {port} is OPEN (TCP connected).")
        else:
            print(f"[FAIL] Port {port} is CLOSED/REFUSED (Err: {result}).")
        s.close()
    except Exception as e:
        print(f"[ERR] Exception checking port {port}: {e}")

print("2. Attempting HTTP request via requests + pysocks...")
try:
    start = time.time()
    resp = requests.get(TARGET_URL, proxies=proxies, timeout=15)
    print(f"   [OK] Response received in {time.time() - start:.2f}s")
    print(f"   Status Code: {resp.status_code}")
    print(f"   Content Snippet: {resp.text[:100]}")
except Exception as e:
    print(f"   [FAIL] Request failed: {e}")
.gitignore
