import folium
import math
import json
import os
import subprocess
import sys
from typing import List, Dict, Tuple, Optional
from folium import plugins

# Tentar importar de módulo local
try:
    from guaruja_extrator_completo import ExtratorCompletoGuaruja
except ImportError:
    ExtratorCompletoGuaruja = None

def utm_to_latlon(easting, northing, zone=23, south=True):
    # Same standard conversion
    a = 6378137.0
    f = 1 / 298.257223563
    k0 = 0.9996
    b = a * (1 - f)
    e2 = (a**2 - b**2) / a**2
    x = easting - 500000.0
    y = northing
    if south: y -= 10000000.0
    M = y / k0
    mu = M / (a * (1 - e2 / 4 - 3 * e2**2 / 64 - 5 * e2**3 / 256))
    e1 = (1 - math.sqrt(1 - e2)) / (1 + math.sqrt(1 - e2))
    phi1_rad = mu + (3 * e1 / 2 - 27 * e1**3 / 32) * math.sin(2 * mu) + \
                (21 * e1**2 / 16 - 55 * e1**4 / 32) * math.sin(4 * mu) + \
                (151 * e1**3 / 96) * math.sin(6 * mu)
    N1 = a / math.sqrt(1 - e2 * math.sin(phi1_rad)**2)
    R1 = a * (1 - e2) / math.pow(1 - e2 * math.sin(phi1_rad)**2, 1.5)
    D = x / (N1 * k0)
    T1 = math.tan(phi1_rad)**2
    C1 = (e2 / (1 - e2)) * math.cos(phi1_rad)**2
    lat_rad = phi1_rad - (N1 * math.tan(phi1_rad) / R1) * (D**2 / 2) # Simplified for brevity, matches helper
    
    # Re-using the robust one from before effectively:
    # Actually let's use the one that works:
    return _utm_to_latlon_robust(easting, northing, zone, south)

def _utm_to_latlon_robust(easting, northing, zone=23, south=True):
    a = 6378137.0
    f = 1 / 298.257223563
    k0 = 0.9996
    b = a * (1 - f)
    e2 = (a**2 - b**2) / a**2
    e2_prime = (a**2 - b**2) / b**2
    x = easting - 500000.0
    y = northing
    if south: y -= 10000000.0
    M = y / k0
    mu = M / (a * (1 - e2 / 4 - 3 * e2**2 / 64 - 5 * e2**3 / 256))
    e1 = (1 - math.sqrt(1 - e2)) / (1 + math.sqrt(1 - e2))
    phi1_rad = mu + (3 * e1 / 2 - 27 * e1**3 / 32) * math.sin(2 * mu) + \
                (21 * e1**2 / 16 - 55 * e1**4 / 32) * math.sin(4 * mu) + \
                (151 * e1**3 / 96) * math.sin(6 * mu)
    N1 = a / math.sqrt(1 - e2 * math.sin(phi1_rad)**2)
    T1 = math.tan(phi1_rad)**2
    C1 = e2_prime * math.cos(phi1_rad)**2
    R1 = a * (1 - e2) / math.pow(1 - e2 * math.sin(phi1_rad)**2, 1.5)
    D = x / (N1 * k0)
    lat_rad = phi1_rad - (N1 * math.tan(phi1_rad) / R1) * \
              (D**2 / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1**2 - 9 * e2_prime) * D**4 / 24 + \
               (61 + 90 * T1 + 298 * C1 + 45 * T1**2 - 252 * e2_prime - 3 * C1**2) * D**6 / 720)
    lon0 = math.radians((zone - 1) * 6 - 180 + 3)
    lon_rad = lon0 + (D - (1 + 2 * T1 + C1) * D**3 / 6 + \
              (5 - 2 * C1 + 28 * T1 - 3 * C1**2 + 8 * e2_prime + 24 * T1**2) * D**5 / 120) / math.cos(phi1_rad)
    return math.degrees(lat_rad), math.degrees(lon_rad)

class CoordinateTransformer:
    def __init__(self, config_file="config_transformacao.json"):
        self.enabled = False
        self.offset_lat = 0.0
        self.offset_lon = 0.0
        self.control_points = []
        self.load_config(config_file)
        
    def load_config(self, config_file):
        try:
            with open(config_file, 'r') as f:
                config = json.load(f)
                self.enabled = config.get('enabled', False)
                if self.enabled:
                    self.control_points = config.get('control_points', [])
                    self.calculate_transform()
        except FileNotFoundError:
            print("Config file not found.")

    def calculate_transform(self):
        if not self.control_points: return
        points = self.control_points
        d_lat = []
        d_lon = []
        for p in points:
            curr_lat, curr_lon = utm_to_latlon(p['source']['x'], p['source']['y'])
            diff_lat = p['target']['lat'] - curr_lat
            diff_lon = p['target']['lon'] - curr_lon
            d_lat.append(diff_lat)
            d_lon.append(diff_lon)
        self.offset_lat = sum(d_lat) / len(d_lat)
        self.offset_lon = sum(d_lon) / len(d_lon)
        print(f"  Offset Lat: {self.offset_lat:.6f}, Lon: {self.offset_lon:.6f}")

    def transform(self, x: float, y: float) -> Tuple[float, float]:
        lat, lon = utm_to_latlon(x, y)
        if self.enabled:
            return (lat + self.offset_lat, lon + self.offset_lon)
        return (lat, lon)

transformer = None

def criar_mapa_lotes(lotes: List[Dict], arquivo_saida: str = "mapa_lotes_guaruja.html", centro: Tuple[float, float] = None) -> folium.Map:
    global transformer
    if transformer is None: transformer = CoordinateTransformer()
    if centro is None: centro = (-23.9934, -46.2567)
    
    mapa = folium.Map(location=centro, zoom_start=14, tiles=None, prefer_canvas=True)
    folium.TileLayer(tiles='OpenStreetMap', name='OpenStreetMap', control=True).add_to(mapa)
    folium.TileLayer(tiles='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr='Esri', name='Satélite (Esri)', control=True).add_to(mapa)
    
    grupo_lotes = folium.FeatureGroup(name='Lotes (Vetores)')
    
    global_minx, global_miny = float('inf'), float('inf')
    global_maxx, global_maxy = float('-inf'), float('-inf')

    for lote in lotes:
        # Determine bounds for map fitting
        b = None
        if 'bounds_utm' in lote:
            b = lote['bounds_utm']
        elif 'bounds' in lote:
             b = lote['bounds']
        elif 'minx' in lote:
             b = {'minx': lote['minx'], 'maxx': lote['maxx'], 'miny': lote['miny'], 'maxy': lote['maxy']}
        
        if b:
            global_minx = min(global_minx, float(b['minx']))
            global_miny = min(global_miny, float(b['miny']))
            global_maxx = max(global_maxx, float(b['maxx']))
            global_maxy = max(global_maxy, float(b['maxy']))

        # Draw Centroid Squares (10m x 10m)
        if b:
            # Calculate Centroid in UTM
            cx = (float(b['minx']) + float(b['maxx'])) / 2
            cy = (float(b['miny']) + float(b['maxy'])) / 2
            
            # 1cm² at 1:1000 scale = 10 meters side length (half_side=5.0)
            # User requested 0.7 cm -> 7 meters side length
            # half_side = 3.5 meters
            half_side = 3.5
            
            # Define Square vertices in UTM
            square_utm = [
                (cx - half_side, cy - half_side),
                (cx + half_side, cy - half_side),
                (cx + half_side, cy + half_side),
                (cx - half_side, cy + half_side)
            ]
            
            # Transform to LatLon (applying offsets)
            poly_latlon = []
            if transformer:
                for ux, uy in square_utm:
                    lat, lon = transformer.transform(ux, uy)
                    poly_latlon.append([lat, lon])
            
            inscricao = lote.get('inscricao', 'S/N')

            # Prepare rich popup content
            if 'metadata' in lote and lote['metadata']:
                meta = lote['metadata']
                popup_html = f"""
                <div style="font-family: Arial; font-size: 12px; min-width: 200px;">
                    <h4 style="margin: 0 0 5px 0; color: #333;">Lote {inscricao}</h4>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr><td><b>Zona:</b></td><td>{meta.get('zona','')}</td></tr>
                        <tr><td><b>Setor:</b></td><td>{meta.get('setor','')}</td></tr>
                        <tr><td><b>Lote:</b></td><td>{meta.get('lote','')}</td></tr>
                        <tr><td><b>Bairro:</b></td><td>{meta.get('bairro','')}</td></tr>
                        <tr><td><b>Quadra:</b></td><td>{meta.get('quadra','')}</td></tr>
                        <tr><td><b>Loteamento:</b></td><td>{meta.get('loteamento','')}</td></tr>
                        <tr><td><b>Logradouro:</b></td><td>{meta.get('cod_logradouro','')}</td></tr>
                        <tr><td><b>Valor M²:</b></td><td>{meta.get('valor_m2','')}</td></tr>
                    </table>
                </div>
                """
            else:
                popup_html = f"Inscrição: {inscricao}"

            folium.Polygon(
                locations=poly_latlon,
                popup=folium.Popup(popup_html, max_width=300),
                tooltip=f"Lote {inscricao}",
                color='#3388ff',      # Blue Border
                weight=1,
                fill=True,
                fill_color='#3388ff', # Blue Fill
                fill_opacity=0.6      # More opaque for small squares
            ).add_to(grupo_lotes)
            
    print(f"Total polygons added: {len(grupo_lotes._children)}")
    grupo_lotes.add_to(mapa)
    folium.LayerControl().add_to(mapa)
    plugins.Fullscreen().add_to(mapa)
    
    if global_minx != float('inf'):
        sw_total = transformer.transform(global_minx, global_miny)
        ne_total = transformer.transform(global_maxx, global_maxy)
        mapa.fit_bounds([sw_total, ne_total])

    if arquivo_saida:
        mapa.save(arquivo_saida)
        print(f"✓ Mapa salvo em: {arquivo_saida}")
    return mapa

if __name__ == "__main__":
    def carregar_dados_exemplo():
        try:
            with open("teste_geo_sucesso.json", "r") as f: return json.load(f)
        except: return []
    # Carregar lotes vetorizados
    arquivo_vetor = "lotes_vetorizados.json"
    if os.path.exists(arquivo_vetor):
        print(f"Carregando lotes de {arquivo_vetor}...")
        with open(arquivo_vetor, 'r') as f:
            lotes = json.load(f)
        criar_mapa_lotes(lotes)
    else:
        print("Arquivo lotes_vetorizados.json não encontrado. Execute capture_and_vectorize.py primeiro.")
        lotes = carregar_dados_exemplo()
        if lotes: criar_mapa_lotes(lotes)
.gitignore
