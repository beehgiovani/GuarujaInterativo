import os
import webbrowser
import http.server
import socketserver
import threading
import time

PORT = 8000
DIRECTORY = "mapa_interativo"

# Ensure we are in the root directory
if os.path.exists("lotes_vetorizados.json"):
    print(f"Server root: {os.getcwd()}")
else:
    print("Warning: lotes_vetorizados.json not found in current dir!")

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Enable CORS for local dev flex
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

def start_server():
    # Change to root to serve ../lotes...
    # But wait, index.html is in /mapa_interativo
    # If we serve root, URL is localhost:8000/mapa_interativo/
    # If we serve subdir, we can't access ../lotes...
    # Solution: Serve ROOT, open /mapa_interativo/index.html
    
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Serving at http://localhost:{PORT}")
        httpd.serve_forever()

# Start Server in thread
t = threading.Thread(target=start_server, daemon=True)
t.start()

print("Launching Browser...")
time.sleep(1)
webbrowser.open(f"http://localhost:{PORT}/mapa_interativo/index.html")

print("\n SERVER RUNNING. Press Ctrl+C to stop.")
try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    print("Stopping...")
.gitignore
